<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">公休申请</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <view class="form-section">
      <view class="form-item">
        <text class="form-label">加班到几点</text>
        <view class="quick-hours">
          <view class="hour-btn" v-for="h in [6,7,8,9,10]" :key="h" @click="setHours(h)">
            <text>{{ h }}点以后</text>
          </view>
        </view>
      </view>
      <view class="form-item">
        <text class="form-label">备注</text>
        <input class="input" v-model="form.remark" placeholder="如通宵加班后申请公休" maxlength="200" />
      </view>
      <view class="form-item">
        <text class="form-label">加班截图证明</text>
        <view class="upload-area" @click="uploadImage">
          <image v-if="form.proof_image_url" :src="form.proof_image_url" mode="aspectFill" class="upload-img" />
          <view v-else class="upload-placeholder">
            <text class="upload-icon">📷</text>
            <text class="upload-text">点击上传截图</text>
          </view>
        </view>
      </view>
      <view class="submit-btn" :class="{ disabled: !canSubmit }" @click="submitApply"><text>提交公休申请</text></view>
    </view>

    <!-- 上传进度 -->
    <view class="upload-progress" v-if="uploading">
      <view class="progress-content">
        <text class="progress-text">{{ uploadText }}</text>
        <view class="progress-bar"><view class="progress-fill" :style="{ width: uploadProgress + '%' }"></view></view>
      </view>
    </view>

    <!-- 成功弹窗 -->
    <SuccessModal :visible="showSuccess" title="提交成功" content="公休申请已提交，请等待审批" @confirm="handleSuccessConfirm" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { applications } from '@/utils/api-v2.js'
import api from '@/utils/api.js'
import SuccessModal from '@/components/SuccessModal.vue'

const statusBarHeight = ref(0)
const coachInfo = ref({})
const showSuccess = ref(false)
const uploading = ref(false)
const uploadText = ref('')
const uploadProgress = ref(0)

const form = ref({ remark: '', proof_image_url: '' })

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  coachInfo.value = uni.getStorageSync('coachInfo') || {}
})

const canSubmit = computed(() => form.value.proof_image_url && form.value.remark)

// 错误上报函数
const reportError = async (info) => {
  try {
    await uni.request({
      url: '/api/upload-error',
      method: 'POST',
      data: { time: new Date().toISOString(), type: 'leave_proof', ...info },
      header: { 'Content-Type': 'application/json' }
    })
  } catch (e) {}
}

const setHours = (hours) => {
  form.value.remark = `通宵加班到${hours}点以后`
}

const uploadImage = () => {
  uni.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
    success: async (res) => {
      await uploadFile(res.tempFilePaths[0], 'image')
    }
  })
}

const uploadFile = async (filePath, type) => {
  uploading.value = true
  uploadText.value = '上传图片中...'
  uploadProgress.value = 0
  
  try {
    // 先检查文件类型，推断扩展名
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
    const signData = await api.getOSSSignature(type, ext, 'TgTemp/')
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
    
    xhr.onload = async () => {
      uploading.value = false
      if (xhr.status === 200) {
        form.value.proof_image_url = signData.accessUrl
        uni.showToast({ title: '上传成功', icon: 'success' })
      } else {
        let errorMsg = `上传失败(${xhr.status})`
        if (xhr.status === 413) errorMsg = '文件太大，请压缩后重试'
        else if (xhr.status === 504 || xhr.status === 502) errorMsg = '服务器超时，请稍后重试'
        else if (xhr.status === 500) errorMsg = '服务器错误，请联系管理员'
        else if (xhr.status === 403) errorMsg = '没有上传权限'
        else if (xhr.status === 401) errorMsg = '登录已过期，请重新登录'
        uni.showToast({ title: errorMsg, icon: 'none' })
        await reportError({ stage: 'XHR上传', status: xhr.status, response: xhr.responseText?.substring(0, 200) })
      }
    }
    
    xhr.onerror = async () => {
      uploading.value = false
      uni.showToast({ title: '网络错误，请检查网络连接', icon: 'none' })
      await reportError({ stage: 'XHR网络错误', signedUrl: signData.signedUrl?.substring(0, 80) })
    }
    
    xhr.ontimeout = async () => {
      uploading.value = false
      uni.showToast({ title: '上传超时，请重试', icon: 'none' })
      await reportError({ stage: 'XHR超时' })
    }
    
    xhr.send(blob)
    
  } catch (e) {
    uploading.value = false
    await reportError({ stage: '异常', error: e.message || String(e) })
    uni.showToast({ title: e.message || '上传失败', icon: 'none' })
  }
}

const submitApply = async () => {
  if (!canSubmit.value) return uni.showToast({ title: '请完成所有必填项', icon: 'none' })
  let phone = coachInfo.value.phone || coachInfo.value.employeeId
  if (!phone) return uni.showToast({ title: '未获取到手机号', icon: 'none' })
  try {
    uni.showLoading({ title: '提交中...' })
    await applications.create({ applicant_phone: phone, application_type: '公休申请', remark: form.value.remark, proof_image_url: form.value.proof_image_url })
    uni.hideLoading()
    form.value.remark = ''
    form.value.proof_image_url = ''
    showSuccess.value = true
  } catch (e) { uni.hideLoading(); uni.showToast({ title: e.error || '提交失败', icon: 'none' }) }
}

const handleSuccessConfirm = () => {
  showSuccess.value = false
  uni.switchTab({ url: '/pages/member/member' })
}

const goBack = () => { const pages = getCurrentPages(); if (pages.length > 1) { uni.navigateBack() } else { uni.switchTab({ url: '/pages/member/member' }) } }
</script>

<style scoped>
.page { min-height: 100vh; background: #0a0a0f; padding-bottom: 40px; }
.fixed-header { position: fixed; top: 0; left: 0; right: 0; z-index: 999; background: #0a0a0f; }
.status-bar-bg { background: #0a0a0f; }
.header-content { height: 44px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; }
.back-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.back-icon { font-size: 28px; color: #d4af37; }
.back-placeholder { width: 32px; }
.header-title { font-size: 17px; font-weight: 600; color: #d4af37; letter-spacing: 2px; }
.header-placeholder { background: #0a0a0f; }
.form-section { margin: 16px; }
.form-item { margin-bottom: 24px; }
.form-label { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 8px; display: block; }
.quick-hours { display: flex; flex-wrap: wrap; gap: 8px; }
.hour-btn { width: 18%; height: 36px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.hour-btn text { font-size: 13px; color: rgba(255,255,255,0.8); }
.hour-btn:active { background: rgba(212,175,55,0.2); border-color: #d4af37; }
.hour-btn:active text { color: #d4af37; }
.input { width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0 12px; font-size: 14px; color: #fff; box-sizing: border-box; }
.upload-area { width: 120px; height: 120px; background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.upload-img { width: 100%; height: 100%; }
.upload-placeholder { text-align: center; }
.upload-icon { font-size: 32px; display: block; margin-bottom: 4px; }
.upload-text { font-size: 12px; color: rgba(255,255,255,0.4); }
.submit-btn { height: 50px; background: linear-gradient(135deg, #d4af37, #ffd700); border-radius: 25px; display: flex; align-items: center; justify-content: center; margin-top: 30px; }
.submit-btn text { font-size: 16px; font-weight: 600; color: #000; }
.submit-btn.disabled { opacity: 0.5; }

.upload-progress { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 1001; }
.progress-content { text-align: center; }
.progress-text { font-size: 14px; color: rgba(255,255,255,0.6); display: block; margin-bottom: 20px; }
.progress-bar { width: 200px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #d4af37, #ffd700); transition: width 0.3s; }
</style>
