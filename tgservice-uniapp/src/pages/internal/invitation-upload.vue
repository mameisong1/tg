<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">上传约客记录</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <view class="info-section">
      <text class="info-text">早班上传时间：14:00 - 18:00</text>
      <text class="info-text">晚班上传时间：18:00 - 22:00</text>
      <text class="info-hint">（仅限时间段内可提交）</text>
    </view>

    <view class="form-section">
      <view class="form-item">
        <text class="form-label">班次</text>
        <!-- 测试环境下显示当前班次（不可选），生产环境可选择 -->
        <view v-if="isTestEnv" class="shift-display">
          <text class="shift-value">{{ form.shift === '早班' ? '🌅 早班' : '🌙 晚班' }}</text>
        </view>
        <view v-else class="shift-btns">
          <view class="shift-btn" :class="{ active: form.shift === '早班' }" @click="form.shift = '早班'">
            <text>🌅 早班</text>
          </view>
          <view class="shift-btn" :class="{ active: form.shift === '晚班' }" @click="form.shift = '晚班'">
            <text>🌙 晚班</text>
          </view>
        </view>
      </view>
      <view class="form-item">
        <text class="form-label">约客截图</text>
        <view class="upload-area" @click="uploadImage">
          <image v-if="form.invitation_image_url" :src="form.invitation_image_url" mode="aspectFill" class="upload-img" />
          <view v-else class="upload-placeholder">
            <text class="upload-icon">📷</text>
            <text class="upload-text">点击上传约客截图</text>
          </view>
        </view>
      </view>
      <view class="submit-btn" :class="{ disabled: !canSubmit }" @click="submitInvitation">
        <text>提交约客记录</text>
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
import { ref, computed, onMounted } from 'vue'
import { guestInvitations } from '@/utils/api-v2.js'
import api from '@/utils/api.js'

const statusBarHeight = ref(0)
const coachInfo = ref({})
const uploading = ref(false)
const uploadText = ref('')
const uploadProgress = ref(0)

const form = ref({
  shift: '',
  invitation_image_url: ''
})

// 判断是否为测试环境
const isTestEnv = import.meta.env.VITE_API_BASE_URL?.includes('tg.tiangong.club') || 
                   import.meta.env.VITE_API_BASE_URL?.includes('localhost') ||
                   window.location.hostname === 'tg.tiangong.club'

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  coachInfo.value = uni.getStorageSync('coachInfo') || {}
  
  console.log('[约客上传] coachInfo:', JSON.stringify(coachInfo.value))
  console.log('[约客上传] shift from storage:', coachInfo.value.shift)
  
  // 设置班次：优先从助教信息读取，如果没有则根据时间判断
  if (coachInfo.value.shift) {
    form.value.shift = coachInfo.value.shift
    console.log('[约客上传] 使用助教班次:', coachInfo.value.shift)
  } else {
    form.value.shift = new Date().getHours() < 18 ? '早班' : '晚班'
    console.log('[约客上传] 无助教班次，使用时间判断:', form.value.shift)
  }
})

const today = computed(() => new Date().toISOString().split('T')[0])
const canSubmit = computed(() => form.value.invitation_image_url)

// 错误上报函数
const reportError = async (info) => {
  try {
    await uni.request({
      url: '/api/upload-error',
      method: 'POST',
      data: { time: new Date().toISOString(), type: 'invitation_screenshot', ...info },
      header: { 'Content-Type': 'application/json' }
    })
  } catch (e) {}
}

const uploadImage = () => {
  uni.chooseImage({
    count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
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
        form.value.invitation_image_url = signData.accessUrl
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

const submitInvitation = async () => {
  if (!canSubmit.value) return uni.showToast({ title: '请上传截图', icon: 'none' })
  
  // 检查提交时间限制
  const hour = new Date().getHours()
  const shift = form.value.shift
  
  if (shift === '早班') {
    // 早班限制在14:00-18:00（16点前后2小时）
    if (hour < 14 || hour >= 18) {
      return uni.showToast({ title: '早班上传时间为14:00-18:00', icon: 'none' })
    }
  } else if (shift === '晚班') {
    // 晚班限制在18:00-22:00（20点前后2小时）
    if (hour < 18 || hour >= 22) {
      return uni.showToast({ title: '晚班上传时间为18:00-22:00', icon: 'none' })
    }
  }
  
  try {
    uni.showLoading({ title: '提交中...' })
    await guestInvitations.create({
      coach_no: coachInfo.value.coachNo,
      date: today.value,
      shift: form.value.shift,
      invitation_image_url: form.value.invitation_image_url
    })
    uni.hideLoading()
    uni.showToast({ title: '提交成功', icon: 'success' })
    form.value.invitation_image_url = ''
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '提交失败', icon: 'none' })
  }
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

.info-section { margin: 16px; padding: 12px 16px; background: rgba(241,196,15,0.1); border: 1px solid rgba(241,196,15,0.2); border-radius: 10px; }
.info-text { font-size: 13px; color: #f1c40f; display: block; margin-bottom: 4px; }
.info-hint { font-size: 12px; color: rgba(241,196,15,0.6); display: block; margin-top: 8px; }

.form-section { margin: 16px; }
.form-item { margin-bottom: 24px; }
.form-label { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 8px; display: block; }
.shift-btns { display: flex; gap: 12px; }
.shift-btn { flex: 1; height: 44px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 14px; color: rgba(255,255,255,0.6); }
.shift-btn.active { background: rgba(212,175,55,0.2); border-color: #d4af37; color: #d4af37; }
.shift-display { height: 44px; background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.3); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.shift-value { font-size: 15px; color: #d4af37; font-weight: 500; }

.upload-area { width: 140px; height: 140px; background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.upload-img { width: 100%; height: 100%; }
.upload-placeholder { text-align: center; }
.upload-icon { font-size: 36px; display: block; margin-bottom: 4px; }
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
