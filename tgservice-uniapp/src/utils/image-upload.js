/**
 * useImageUpload - Vue3 Composable 公共图片上传模块
 * 
 * 功能：支持多图上传（最多3张），阿里云 OSS STS 签名直传，进度条，错误处理
 * 
 * 用法：
 *   import { useImageUpload } from '@/utils/image-upload.js'
 *   const { imageUrls, uploading, uploadProgress, uploadText, chooseAndUpload, removeImage, clearAll } =
 *     useImageUpload({ maxCount: 3, ossDir: 'TgTemp/', errorType: 'lejuan_proof' })
 */

import { ref } from 'vue'
import api from '@/utils/api.js'
import { getBeijingTimestamp } from '@/utils/time-util.js'

/**
 * @param {Object} options
 * @param {number} options.maxCount - 最大上传数量，默认 3
 * @param {string} options.ossDir - OSS 目录前缀，默认 'TgTemp/'
 * @param {string} options.errorType - 错误上报类型标识，默认 'image_upload'
 */
export function useImageUpload(options = {}) {
  const maxCount = options.maxCount || 3
  const ossDir = options.ossDir || 'TgTemp/'
  const errorType = options.errorType || 'image_upload'

  // 状态
  const imageUrls = ref([])       // 已上传图片 URL 数组
  const uploading = ref(false)    // 是否正在上传
  const uploadProgress = ref(0)   // 上传进度 0-100
  const uploadText = ref('')      // 上传状态文本

  // 错误上报
  const reportError = async (info) => {
    try {
      await uni.request({
        url: '/api/upload-error',
        method: 'POST',
        data: { time: getBeijingTimestamp(), type: errorType, ...info }, // 修复：使用北京时间
        header: { 'Content-Type': 'application/json' }
      })
    } catch (e) {}
  }

  // 上传单个文件
  const uploadFile = async (filePath) => {
    uploading.value = true
    uploadText.value = '上传图片中...'
    uploadProgress.value = 0

    try {
      // 推断文件扩展名
      let ext = 'jpg'
      try {
        const blobCheck = await fetch(filePath).then(r => r.blob())
        if (blobCheck.type) {
          const mimeExt = blobCheck.type.split('/')[1]
          if (mimeExt && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(mimeExt)) {
            ext = mimeExt === 'jpeg' ? 'jpg' : mimeExt
          }
        }
      } catch (e) {}

      // 获取 OSS 签名
      const signData = await api.getOSSSignature('image', ext, ossDir)
      if (!signData.success) {
        throw new Error(signData.error || '获取上传凭证失败')
      }

      // 读取文件为 blob
      const response = await fetch(filePath)
      const blob = await response.blob()

      // XHR 直传 OSS
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', signData.signedUrl, true)
      xhr.setRequestHeader('Content-Type', 'image/jpeg')

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          uploadProgress.value = Math.round((e.loaded / e.total) * 100)
        }
      }

      xhr.timeout = 300000

      return new Promise((resolve, reject) => {
        xhr.onload = async () => {
          uploading.value = false
          if (xhr.status === 200) {
            imageUrls.value.push(signData.accessUrl)
            uni.showToast({ title: '上传成功', icon: 'success' })
            resolve(signData.accessUrl)
          } else {
            let errorMsg = `上传失败(${xhr.status})`
            if (xhr.status === 413) errorMsg = '文件太大，请压缩后重试'
            else if (xhr.status === 504 || xhr.status === 502) errorMsg = '服务器超时，请稍后重试'
            else if (xhr.status === 500) errorMsg = '服务器错误，请联系管理员'
            else if (xhr.status === 403) errorMsg = '没有上传权限'
            else if (xhr.status === 401) errorMsg = '登录已过期，请重新登录'
            uni.showToast({ title: errorMsg, icon: 'none' })
            await reportError({ stage: 'XHR上传', status: xhr.status, response: xhr.responseText?.substring(0, 200) })
            reject(new Error(errorMsg))
          }
        }

        xhr.onerror = async () => {
          uploading.value = false
          uni.showToast({ title: '网络错误，请检查网络连接', icon: 'none' })
          await reportError({ stage: 'XHR网络错误', signedUrl: signData.signedUrl?.substring(0, 80) })
          reject(new Error('网络错误'))
        }

        xhr.ontimeout = async () => {
          uploading.value = false
          uni.showToast({ title: '上传超时，请重试', icon: 'none' })
          await reportError({ stage: 'XHR超时' })
          reject(new Error('上传超时'))
        }

        xhr.send(blob)
      })
    } catch (e) {
      uploading.value = false
      await reportError({ stage: '异常', error: e.message || String(e) })
      uni.showToast({ title: e.message || '上传失败', icon: 'none' })
      throw e
    }
  }

  // 选择图片并上传（支持多图）
  const chooseAndUpload = async () => {
    // 还能上传几张
    const canChoose = maxCount - imageUrls.value.length
    if (canChoose <= 0) {
      return uni.showToast({ title: `最多上传${maxCount}张图片`, icon: 'none' })
    }

    uni.chooseImage({
      count: canChoose,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        for (const filePath of res.tempFilePaths) {
          await uploadFile(filePath)
        }
      }
    })
  }

  // 删除指定图片
  const removeImage = (index) => {
    imageUrls.value.splice(index, 1)
  }

  // 清空所有图片
  const clearAll = () => {
    imageUrls.value = []
  }

  return {
    imageUrls,
    uploading,
    uploadProgress,
    uploadText,
    chooseAndUpload,
    removeImage,
    clearAll
  }
}
