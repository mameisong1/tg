<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">加班/晚到申请</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <view class="form-section">
      <view class="form-item">
        <text class="form-label">申请类型</text>
        <text class="apply-type">{{ applicationType }}</text>
      </view>
      <view class="form-item">
        <text class="form-label">加班时长</text>
        <view class="quick-hours">
          <view class="hour-btn" v-for="h in [1,2,3,4,5,6,7,8,9,10]" :key="h" @click="setHours(h)">
            <text>{{ h }}小时</text>
          </view>
        </view>
      </view>
      <view class="form-item">
        <text class="form-label">备注</text>
        <input class="input" v-model="form.remark" placeholder="请输入备注" maxlength="200" />
      </view>
      <view class="form-item">
        <text class="form-label">加班截图证明（最多3张）</text>
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
      <view class="submit-btn" :class="{ disabled: !canSubmit }" @click="submitApply"><text>提交申请</text></view>
    </view>

    <!-- 上传进度 -->
    <view class="upload-progress" v-if="uploading">
      <view class="progress-content">
        <text class="progress-text">{{ uploadText }}</text>
        <view class="progress-bar"><view class="progress-fill" :style="{ width: uploadProgress + '%' }"></view></view>
      </view>
    </view>

    <!-- 成功弹窗 -->
    <SuccessModal :visible="showSuccess" title="提交成功" content="加班/晚到申请已提交，请等待审批" @confirm="handleSuccessConfirm" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { applications } from '@/utils/api-v2.js'
import { useImageUpload } from '@/utils/image-upload.js'
import SuccessModal from '@/components/SuccessModal.vue'

const statusBarHeight = ref(0)
const coachInfo = ref({})
const showSuccess = ref(false)
const serverHour = ref(null) // 服务器北京时间小时

const form = ref({ remark: '' })

const { imageUrls, uploading, uploadProgress, uploadText, chooseAndUpload, removeImage } =
  useImageUpload({ maxCount: 3, ossDir: 'TgTemp/', errorType: 'overtime_proof' })

/**
 * 获取服务器北京时间小时数
 */
async function fetchServerHour() {
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://tiangong.club/api'
    const res = await new Promise((resolve, reject) => {
      uni.request({
        url: baseUrl + '/server-time',
        method: 'GET',
        success: (r) => r.statusCode === 200 ? resolve(r.data) : reject(new Error('请求失败')),
        fail: reject
      })
    })
    serverHour.value = res.hour
  } catch (e) {
    console.error('[加班申请] 获取服务器时间失败，使用本地时间兜底:', e)
    serverHour.value = new Date().getHours()
  }
}

onMounted(async () => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  coachInfo.value = uni.getStorageSync('coachInfo') || {}
  await fetchServerHour()
})

const applicationType = computed(() => {
  if (coachInfo.value.shift) {
    return coachInfo.value.shift === '早班' ? '早加班申请' : '晚加班申请'
  }
  const hour = serverHour.value !== null ? serverHour.value : new Date().getHours()
  return hour < 18 ? '早加班申请' : '晚加班申请'
})

const canSubmit = computed(() => {
  return imageUrls.value.length > 0 && form.value.remark
})

const selectedHours = ref(0)

const setHours = (hours) => {
  selectedHours.value = hours
  form.value.remark = `加班${hours}小时`
}

const previewImage = (idx) => {
  uni.previewImage({ urls: imageUrls.value, current: idx })
}

const submitApply = async () => {
  if (!canSubmit.value) return uni.showToast({ title: '请完成所有必填项', icon: 'none' })

  let phone = coachInfo.value.phone || coachInfo.value.employeeId
  if (!phone) return uni.showToast({ title: '未获取到手机号信息', icon: 'none' })

  try {
    uni.showLoading({ title: '提交中...' })
    await applications.create({
      applicant_phone: phone,
      application_type: applicationType.value,
      remark: form.value.remark,
      images: imageUrls.value.length > 0 ? JSON.stringify(imageUrls.value) : null,
      extra_data: selectedHours.value > 0 ? { hours: selectedHours.value } : undefined
    })
    uni.hideLoading()
    form.value.remark = ''
    imageUrls.value = []
    showSuccess.value = true
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '提交失败', icon: 'none' })
  }
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
.apply-type { font-size: 16px; font-weight: 600; color: #d4af37; }

.quick-hours { display: flex; flex-wrap: wrap; gap: 8px; }
.hour-btn { width: 18%; height: 36px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.hour-btn text { font-size: 13px; color: rgba(255,255,255,0.8); }
.hour-btn:active { background: rgba(212,175,55,0.2); border-color: #d4af37; }
.hour-btn:active text { color: #d4af37; }

.input { width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0 12px; font-size: 14px; color: #fff; box-sizing: border-box; }

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
