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

    <!-- 成功弹窗 -->
    <SuccessModal :visible="showSuccess" title="提交成功" content="公休申请已提交，请等待审批" @confirm="handleSuccessConfirm" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/utils/api-v2.js'
import apiCommon from '@/utils/api.js'
import SuccessModal from '@/components/SuccessModal.vue'

const statusBarHeight = ref(0)
const coachInfo = ref({})
const showSuccess = ref(false)
const form = ref({ remark: '', proof_image_url: '' })

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  coachInfo.value = uni.getStorageSync('coachInfo') || {}
})

const canSubmit = computed(() => form.value.proof_image_url && form.value.remark)

const setHours = (hours) => {
  form.value.remark = `通宵加班到${hours}点以后`
}

const uploadImage = async () => {
  try {
    uni.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
      success: async (res) => {
        uni.showLoading({ title: '上传中...' })
        try {
          const uploadRes = await apiCommon.uploadImageToOSS(res.tempFilePaths[0], 'image', 'TgTemp/')
          if (uploadRes && uploadRes.url) {
            form.value.proof_image_url = uploadRes.url
            uni.hideLoading()
            uni.showToast({ title: '上传成功', icon: 'success' })
          } else {
            uni.hideLoading()
            uni.showToast({ title: uploadRes?.error || '上传失败', icon: 'none' })
          }
        } catch (e) {
          uni.hideLoading()
          uni.showToast({ title: e?.error || '上传失败', icon: 'none' })
        }
      }
    })
  } catch (e) { uni.showToast({ title: '选择图片失败', icon: 'none' }) }
}

const submitApply = async () => {
  if (!canSubmit.value) return uni.showToast({ title: '请完成所有必填项', icon: 'none' })
  let phone = coachInfo.value.phone || coachInfo.value.employeeId
  if (!phone) return uni.showToast({ title: '未获取到手机号', icon: 'none' })
  try {
    uni.showLoading({ title: '提交中...' })
    await api.applications.create({ applicant_phone: phone, application_type: '公休申请', remark: form.value.remark, proof_image_url: form.value.proof_image_url })
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
</style>