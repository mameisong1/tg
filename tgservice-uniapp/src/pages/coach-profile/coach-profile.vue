<template>
  <view class="page">
    <!-- 固定区域 -->
    <view class="fixed-area">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="fixed-header">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">‹</text>
        </view>
        <text class="header-title">教练个人中心</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    
    <!-- 占位区域 -->
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>
    
    <view class="container">
      <view class="profile-header">
        <image class="profile-avatar" :src="mainPhoto" mode="aspectFill"></image>
        <view class="profile-name">{{ coachInfo.stageName || '未命名' }}</view>
        <view class="profile-level">{{ coachInfo.level || '教练' }}</view>
        <view class="profile-no">工号: {{ coachInfo.employeeId }}</view>
      </view>
      
      <view class="section">
        <view class="section-title">基本信息</view>
        <view class="form-card">
          <view class="form-item"><text class="form-label">年龄</text><input class="form-input" v-model="form.age" type="number" placeholder="未填写" /></view>
          <view class="form-item"><text class="form-label">身高 (cm)</text><input class="form-input" v-model="form.height" type="number" placeholder="未填写" /></view>
        </view>
      </view>
      
      <view class="section">
        <view class="section-header"><text class="section-title">照片展示</text><text class="section-hint">最多50张，每张最大10M</text></view>
        <view class="photo-grid">
          <view class="photo-item" v-for="(photo, index) in photos" :key="index" @click="managePhoto(index)">
            <image class="photo-img" :src="photo" mode="aspectFill"></image>
            <view class="photo-avatar-badge" v-if="index === 0">头像</view>
          </view>
          <view class="photo-add" @click="addPhoto" v-if="photos.length < 50"><text>+</text></view>
        </view>
      </view>
      
      <view class="section">
        <view class="section-header"><text class="section-title">个人视频</text><text class="section-hint">最多6个，每个最大50M</text></view>
        <view class="video-area">
          <view class="video-item" v-for="(video, index) in videos" :key="index">
            <video class="video-thumb-video" :src="video" preload="metadata" :controls="false" :show-center-play-btn="false"></video>
            <view class="video-info"><text class="video-name">视频 {{ index + 1 }}</text><text class="video-status">已上传</text></view>
            <view class="video-btn" @click="removeVideo(index)">删除</view>
          </view>
          <view class="video-upload" v-if="videos.length < 6" @click="addVideo">
            <text class="video-upload-icon">📹</text>
            <text class="video-upload-text">点击上传视频</text>
          </view>
        </view>
      </view>
      
      <view class="section">
        <view class="section-title">个人简介</view>
        <textarea class="intro-textarea" v-model="form.intro" placeholder="写点什么介绍自己吧~" placeholder-class="placeholder"></textarea>
      </view>
      
      <view class="save-btn" @click="saveProfile">保存修改</view>
    </view>
    
    <!-- 照片管理弹窗 -->
    <view class="photo-modal" v-if="showPhotoModal" @click="closePhotoModal">
      <view class="photo-modal-content" @click.stop>
        <image class="modal-img" :src="photos[currentPhotoIndex]" mode="aspectFill"></image>
        <view class="modal-actions">
          <view class="modal-btn primary" @click="setAsAvatar" v-if="currentPhotoIndex !== 0">设为头像</view>
          <view class="modal-btn danger" @click="deletePhoto" v-if="currentPhotoIndex !== 0">删除照片</view>
          <view class="modal-btn disabled" v-if="currentPhotoIndex === 0">头像不可删除</view>
          <view class="modal-btn cancel" @click="closePhotoModal">取消</view>
        </view>
      </view>
    </view>
    
    <!-- 上传进度 -->
    <view class="upload-progress" v-if="uploading">
      <view class="progress-content">
        <text class="progress-text">{{ uploadText }}</text>
        <view class="progress-bar"><view class="progress-fill" :style="{ width: uploadProgress + '%' }"></view></view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/utils/api.js'

// 状态栏高度
const statusBarHeight = ref(0)

const coachInfo = ref({})
const form = reactive({ age: '', height: '', intro: '' })
const photos = ref([])
const videos = ref([])
const showPhotoModal = ref(false)
const currentPhotoIndex = ref(-1)
const uploading = ref(false)
const uploadText = ref('')
const uploadProgress = ref(0)

const mainPhoto = computed(() => photos.value.length > 0 ? photos.value[0] : '/static/avatar-default.png')

const checkLogin = () => {
  const info = uni.getStorageSync('coachInfo')
  if (!info) return uni.redirectTo({ url: '/pages/coach-login/coach-login' })
  coachInfo.value = info
}

const loadProfile = async () => {
  if (!coachInfo.value.coachNo) return
  try {
    const data = await api.getCoach(coachInfo.value.coachNo)
    form.age = data.age || ''
    form.height = data.height || ''
    form.intro = data.intro || ''
    photos.value = data.photos || []
    // 兼容单个video字段和videos数组
    if (data.videos && Array.isArray(data.videos)) {
      videos.value = data.videos
    } else if (data.video) {
      videos.value = [data.video]
    } else {
      videos.value = []
    }
  } catch (e) {}
}

const managePhoto = (index) => { currentPhotoIndex.value = index; showPhotoModal.value = true }
const closePhotoModal = () => { showPhotoModal.value = false; currentPhotoIndex.value = -1 }

const setAsAvatar = () => {
  if (currentPhotoIndex.value < 0) return
  const photo = photos.value.splice(currentPhotoIndex.value, 1)[0]
  photos.value.unshift(photo)
  closePhotoModal()
  uni.showToast({ title: '已设为头像', icon: 'success' })
}

const deletePhoto = () => {
  if (currentPhotoIndex.value < 0) return
  photos.value.splice(currentPhotoIndex.value, 1)
  closePhotoModal()
  uni.showToast({ title: '已删除', icon: 'success' })
}

const addPhoto = () => {
  if (photos.value.length >= 50) return uni.showToast({ title: '最多上传50张', icon: 'none' })
  uni.chooseImage({
    count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
    success: async (res) => {
      const fileInfo = await uni.getFileInfo({ filePath: res.tempFilePaths[0] })
      if (fileInfo.size > 10 * 1024 * 1024) return uni.showToast({ title: '照片不能超过10M', icon: 'none' })
      uploadFile(res.tempFilePaths[0], 'image')
    }
  })
}

const addVideo = () => {
  if (videos.value.length >= 6) return uni.showToast({ title: '最多上传6个视频', icon: 'none' })
  uni.chooseVideo({
    sourceType: ['album', 'camera'], maxDuration: 60,
    success: (res) => {
      if (res.size > 50 * 1024 * 1024) return uni.showToast({ title: '视频不能超过50M', icon: 'none' })
      uploadFile(res.tempFilePath, 'video')
    }
  })
}

const uploadFile = async (filePath, type) => {
  uploading.value = true
  uploadText.value = type === 'video' ? '上传视频中...' : '上传照片中...'
  uploadProgress.value = 0
  
  // 错误上报函数
  const reportError = async (info) => {
    try {
      await uni.request({
        url: '/api/upload-error',
        method: 'POST',
        data: { time: new Date().toISOString(), type, ...info },
        header: { 'Content-Type': 'application/json' }
      })
    } catch (e) {}
  }
  
  try {
    // H5环境：使用签名URL直传OSS
    // #ifdef H5
    let ext = type === 'video' ? 'mp4' : 'jpg'
    try {
      const blobCheck = await fetch(filePath).then(r => r.blob())
      if (blobCheck.type) {
        const mimeExt = blobCheck.type.split('/')[1]
        if (mimeExt && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'webm'].includes(mimeExt)) {
          ext = mimeExt === 'jpeg' ? 'jpg' : mimeExt
        }
      }
    } catch (e) {}
    
    const signData = await api.getOSSSignature(type, ext)
    if (!signData.success) throw new Error(signData.error || '获取上传凭证失败')
    
    const response = await fetch(filePath)
    const blob = await response.blob()
    
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signData.signedUrl, true)
    xhr.setRequestHeader('Content-Type', type === 'video' ? 'video/mp4' : 'image/jpeg')
    
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        uploadProgress.value = Math.round((e.loaded / e.total) * 100)
      }
    }
    
    xhr.timeout = 300000
    
    xhr.onload = async () => {
      uploading.value = false
      if (xhr.status === 200) {
        const url = signData.accessUrl
        if (type === 'video') videos.value.push(url)
        else photos.value.push(url)
        uni.showToast({ title: '上传成功', icon: 'success' })
        try {
          await api.updateCoachProfile({
            coachNo: coachInfo.value.coachNo,
            age: parseInt(form.age) || null,
            height: parseInt(form.height) || null,
            intro: form.intro,
            photos: photos.value,
            videos: videos.value
          })
        } catch (e) { uni.showToast({ title: '自动保存失败', icon: 'none' }) }
      } else {
        let errorMsg = `上传失败(${xhr.status})`
        if (xhr.status === 413) errorMsg = '文件太大，请压缩后重试'
        else if (xhr.status === 504 || xhr.status === 502) errorMsg = '服务器超时，请稍后重试'
        else if (xhr.status === 500) errorMsg = '服务器错误，请联系管理员'
        else if (xhr.status === 403) errorMsg = '没有上传权限'
        else if (xhr.status === 401) errorMsg = '登录已过期，请重新登录'
        uni.showToast({ title: errorMsg, icon: 'none' })
      }
    }
    
    xhr.onerror = async () => {
      uploading.value = false
      uni.showToast({ title: '网络错误，请检查网络连接', icon: 'none' })
    }
    
    xhr.ontimeout = async () => {
      uploading.value = false
      uni.showToast({ title: '上传超时，请压缩文件后重试', icon: 'none' })
    }
    
    xhr.send(blob)
    // #endif
    
    // #ifndef H5
    // 微信小程序环境使用后端代理上传
    await reportError({ stage: '开始上传', filePath: filePath?.substring(0, 50) })
    
    const uploadTask = uni.uploadFile({
      url: '/api/oss/upload',
      filePath: filePath,
      name: 'file',
      formData: { type: type },
      success: async (res) => {
        uploading.value = false
        await reportError({ stage: '上传响应', statusCode: res.statusCode, data: res.data?.substring(0, 200) })
        try {
          const data = JSON.parse(res.data)
          if (data.success && data.url) {
            if (type === 'video') videos.value.push(data.url)
            else photos.value.push(data.url)
            uni.showToast({ title: '上传成功', icon: 'success' })
            try {
              await api.updateCoachProfile({
                coachNo: coachInfo.value.coachNo,
                age: parseInt(form.age) || null,
                height: parseInt(form.height) || null,
                intro: form.intro,
                photos: photos.value,
                videos: videos.value
              })
            } catch (e) { uni.showToast({ title: '自动保存失败', icon: 'none' }) }
          } else {
            // 根据 HTTP 状态码提供详细错误信息
            let errorMsg = data.error || '上传失败'
            if (res.statusCode === 413) errorMsg = '文件太大，请压缩后重试'
            else if (res.statusCode === 504 || res.statusCode === 502) errorMsg = '服务器超时，请稍后重试'
            else if (res.statusCode === 500) errorMsg = '服务器错误: ' + (data.error || '未知错误')
            else if (res.statusCode === 403) errorMsg = '没有上传权限'
            uni.showToast({ title: errorMsg, icon: 'none' })
          }
        } catch (e) {
          uni.showToast({ title: '解析响应失败', icon: 'none' })
        }
      },
      fail: async (err) => {
        uploading.value = false
        await reportError({ stage: '上传失败', error: err.errMsg || JSON.stringify(err) })
        uni.showToast({ title: '上传失败: ' + (err.errMsg || '未知错误'), icon: 'none' })
      }
    })
    uploadTask.onProgressUpdate((res) => {
      uploadProgress.value = res.progress
    })
    
    // 设置超时处理
    setTimeout(async () => {
      if (uploading.value) {
        uploading.value = false
        await reportError({ stage: '上传超时', type })
        uni.showToast({ title: '上传超时，请压缩文件后重试', icon: 'none' })
      }
    }, 300000) // 5分钟超时
    // #endif
    
  } catch (e) {
    uploading.value = false
    await reportError({ stage: '异常', error: e.message || String(e) })
    uni.showToast({ title: e.message || '上传失败', icon: 'none' })
  }
}

// 上报上传错误到后端
const reportUploadError = async (errorInfo) => {
  try {
    await uni.request({
      url: '/api/upload-error',
      method: 'POST',
      data: errorInfo,
      header: { 'Content-Type': 'application/json' }
    })
    console.log('错误已上报:', JSON.stringify(errorInfo))
  } catch (e) {
    console.log('上报错误失败:', e.message)
  }
}

const removeVideo = (index) => {
  uni.showModal({ title: '提示', content: '确定删除该视频吗？', success: (res) => { if (res.confirm) videos.value.splice(index, 1) } })
}

const saveProfile = async () => {
  try {
    uni.showLoading({ title: '保存中...' })
    await api.updateCoachProfile({
      coachNo: coachInfo.value.coachNo,
      age: parseInt(form.age) || null,
      height: parseInt(form.height) || null,
      intro: form.intro,
      photos: photos.value,
      videos: videos.value
    })
    uni.hideLoading()
    uni.showToast({ title: '保存成功', icon: 'success' })
  } catch (e) { uni.hideLoading(); uni.showToast({ title: '保存失败', icon: 'none' }) }
}

const goBack = () => {
  uni.navigateBack()
}

onMounted(() => { 
  // 获取状态栏高度
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  
  checkLogin()
  loadProfile() 
})
</script>

<style scoped>
.page { min-height: 100vh; background: #0a0a0f; padding-bottom: 40px; }

/* 固定头部 - 参考会员中心 */
.fixed-area {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  background: #0a0a0f;
}
.status-bar-bg { background: #0a0a0f; }
.fixed-header {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #0a0a0f;
}
.back-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.back-icon {
  font-size: 28px;
  color: #d4af37;
}
.back-placeholder {
  width: 32px;
}
.header-title {
  font-size: 17px;
  font-weight: 600;
  color: #d4af37;
  letter-spacing: 4px;
}
.header-placeholder { background: #0a0a0f; }

.container { padding: 16px; }
.profile-header { text-align: center; padding: 30px 0; }
.profile-avatar { width: 100px; height: 100px; border-radius: 50%; border: 3px solid rgba(218,165,32,0.3); background: rgba(30,30,40,0.5); }
.profile-name { font-size: 22px; margin-top: 16px; }
.profile-level { display: inline-block; padding: 6px 16px; background: linear-gradient(135deg, rgba(212,175,55,0.2), rgba(255,215,0,0.2)); border-radius: 16px; font-size: 14px; color: #d4af37; margin-top: 8px; }
.profile-no { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 4px; }
.section { margin-bottom: 20px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 0 4px; }
.section-title { font-size: 14px; color: rgba(255,255,255,0.6); padding: 0 4px; margin-bottom: 12px; display: block; }
.section-hint { font-size: 11px; color: rgba(255,255,255,0.3); }
.form-card { background: rgba(20,20,30,0.6); border-radius: 16px; border: 1px solid rgba(218,165,32,0.1); overflow: hidden; }
.form-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.form-item:last-child { border-bottom: none; }
.form-label { font-size: 15px; }
.form-input { text-align: right; font-size: 15px; color: #fff; }
.placeholder { color: rgba(255,255,255,0.3); }
.photo-grid { display: flex; gap: 12px; flex-wrap: wrap; }
.photo-item { width: 80px; height: 80px; border-radius: 12px; overflow: hidden; position: relative; }
.photo-img { width: 100%; height: 100%; }
.photo-avatar-badge { position: absolute; top: 4px; left: 4px; background: linear-gradient(135deg, #ffd700, #ffaa00); color: #000; font-size: 10px; padding: 2px 6px; border-radius: 8px; font-weight: 600; }
.photo-add { width: 80px; height: 80px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 2rpx dashed rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 28px; color: rgba(255,255,255,0.3); }
.video-area { background: rgba(20,20,30,0.6); border-radius: 16px; border: 1px solid rgba(218,165,32,0.1); overflow: hidden; }
.video-item { display: flex; align-items: center; gap: 16px; padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.video-item:last-child { border-bottom: none; }
.video-thumb-video { width: 100px; height: 70px; border-radius: 10px; background: rgba(30,30,40,0.5); }
.video-info { flex: 1; }
.video-name { font-size: 14px; display: block; margin-bottom: 4px; }
.video-status { font-size: 12px; color: rgba(255,255,255,0.4); }
.video-btn { padding: 8px 16px; background: rgba(231,76,60,0.2); border-radius: 8px; color: #e74c3c; font-size: 12px; }
.video-upload { padding: 40px; text-align: center; }
.video-upload-icon { font-size: 40px; display: block; margin-bottom: 10px; }
.video-upload-text { font-size: 14px; color: rgba(255,255,255,0.5); }
.intro-textarea { width: 100%; min-height: 120px; padding: 16px; background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 16px; color: #fff; font-size: 14px; line-height: 1.6; }
.save-btn { width: 100%; height: 50px; background: linear-gradient(135deg, #d4af37, #ffd700); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-top: 20px; color: #000; font-size: 16px; font-weight: 600; }
.photo-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.photo-modal-content { width: 85%; max-width: 320px; background: #1a1a24; border-radius: 16px; overflow: hidden; }
.modal-img { width: 100%; height: 280px; }
.modal-actions { padding: 16px; }
.modal-btn { width: 100%; height: 44px; margin-bottom: 8px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 14px; }
.modal-btn:last-child { margin-bottom: 0; }
.modal-btn.primary { background: linear-gradient(135deg, #d4af37, #ffd700); color: #000; font-weight: 600; }
.modal-btn.danger { background: rgba(231,76,60,0.2); color: #e74c3c; }
.modal-btn.cancel { background: rgba(255,255,255,0.1); color: #fff; }
.modal-btn.disabled { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.3); cursor: not-allowed; }
.upload-progress { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 1001; }
.progress-content { text-align: center; }
.progress-text { font-size: 14px; color: rgba(255,255,255,0.6); display: block; margin-bottom: 20px; }
.progress-bar { width: 200px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #d4af37, #ffd700); transition: width 0.3s; }
</style>