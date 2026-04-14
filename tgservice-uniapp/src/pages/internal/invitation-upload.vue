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

    <!-- 测试环境下隐藏时间提示 -->
    <view class="info-section" v-if="!isTestEnv">
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
        <text class="form-label">约客截图（最多3张）</text>
        <view class="image-grid">
          <view v-for="(url, idx) in imageUrls" :key="idx" class="image-item">
            <image :src="url" mode="aspectFill" class="uploaded-img" @click="previewImage(idx)" />
            <view class="remove-btn" @click.stop="removeImage(idx)"><text>✕</text></view>
          </view>
          <view v-if="imageUrls.length < 3" class="upload-btn" @click="chooseAndUpload">
            <text class="upload-icon">📷</text>
            <text class="upload-text">上传图片</text>
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
import { useImageUpload } from '@/utils/image-upload.js'
import { getBeijingDate } from '@/utils/time-util.js'

const statusBarHeight = ref(0)
const coachInfo = ref({})

const form = ref({
  shift: ''
})

const { imageUrls, uploading, uploadProgress, uploadText, chooseAndUpload, removeImage, clearAll } =
  useImageUpload({ maxCount: 3, ossDir: 'TgTemp/', errorType: 'invitation_screenshot' })

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

const today = computed(() => getBeijingDate()) // 修复：使用北京时间，避免 toISOString() UTC 偏移
const canSubmit = computed(() => imageUrls.value.length > 0)

const previewImage = (idx) => {
  uni.previewImage({ urls: imageUrls.value, current: idx })
}

const submitInvitation = async () => {
  if (!canSubmit.value) return uni.showToast({ title: '请上传截图', icon: 'none' })
  
  // 测试环境下跳过时间限制检查
  if (!isTestEnv) {
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
  }
  
  try {
    uni.showLoading({ title: '提交中...' })
    await guestInvitations.create({
      coach_no: coachInfo.value.coachNo,
      date: today.value,
      shift: form.value.shift,
      images: imageUrls.value.length > 0 ? JSON.stringify(imageUrls.value) : null
    })
    uni.hideLoading()
    uni.showToast({ title: '提交成功', icon: 'success' })
    clearAll()
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

/* 图片网格 */
.image-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.image-item { position: relative; width: 90px; height: 90px; border-radius: 10px; overflow: hidden; }
.uploaded-img { width: 100%; height: 100%; }
.remove-btn { position: absolute; top: 2px; right: 2px; width: 22px; height: 22px; background: rgba(0,0,0,0.7); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.remove-btn text { color: #fff; font-size: 14px; }
.upload-btn { width: 90px; height: 90px; background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.2); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.upload-icon { font-size: 28px; display: block; margin-bottom: 4px; }
.upload-text { font-size: 11px; color: rgba(255,255,255,0.4); }

.submit-btn { height: 50px; background: linear-gradient(135deg, #d4af37, #ffd700); border-radius: 25px; display: flex; align-items: center; justify-content: center; margin-top: 30px; }
.submit-btn text { font-size: 16px; font-weight: 600; color: #000; }
.submit-btn.disabled { opacity: 0.5; }

.upload-progress { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 1001; }
.progress-content { text-align: center; }
.progress-text { font-size: 14px; color: rgba(255,255,255,0.6); display: block; margin-bottom: 20px; }
.progress-bar { width: 200px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #d4af37, #ffd700); transition: width 0.3s; }
</style>
