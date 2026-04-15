<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">提交付款截图</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 记录信息 -->
    <view class="info-section">
      <view class="info-row">
        <text class="info-label">助教</text>
        <text class="info-value">{{ stageName }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">预约时间</text>
        <text class="info-value">{{ scheduledStartTime }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">出发时间</text>
        <text class="info-value">{{ actualStartTime }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">回来时间</text>
        <text class="info-value">{{ returnTime }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">外出小时数</text>
        <text class="info-value">{{ lejuanHours }}</text>
      </view>
      <view class="info-row" v-if="proofUrl">
        <text class="info-label">当前截图</text>
        <image :src="proofUrl" mode="aspectFill" class="proof-preview" @click="previewProof" />
      </view>
    </view>

    <!-- 上传区域 -->
    <view class="upload-section">
      <text class="upload-title">上传付款截图</text>
      <view v-if="!currentProofUrl" class="upload-btn" @click="chooseAndUpload">
        <text class="upload-icon">📷</text>
        <text class="upload-text">点击拍照/选择图片</text>
      </view>
      <view v-else class="upload-btn replace-btn" @click="chooseAndUpload">
        <text class="upload-icon">🔄</text>
        <text class="upload-text">替换截图</text>
      </view>
    </view>

    <!-- 提交按钮 -->
    <view class="submit-btn" :class="{ disabled: !currentProofUrl }" @click="submitProof"><text>提交截图</text></view>

    <!-- 上传进度 -->
    <view class="upload-progress" v-if="uploading">
      <view class="progress-content">
        <text class="progress-text">{{ uploadText }}</text>
        <view class="progress-bar"><view class="progress-fill" :style="{ width: uploadProgress + '%' }"></view></view>
      </view>
    </view>

    <!-- 成功弹窗 -->
    <SuccessModal :visible="showSuccess" title="提交成功" content="付款截图已上传" @confirm="handleSuccessConfirm" />
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api-v2.js'
import { useImageUpload } from '@/utils/image-upload.js'
import SuccessModal from '@/components/SuccessModal.vue'

const statusBarHeight = ref(0)
const recordId = ref(null)
const stageName = ref('')
const scheduledStartTime = ref('')
const actualStartTime = ref('未出发')
const returnTime = ref('未归来')
const lejuanHours = ref('-')
const proofUrl = ref('')
const currentProofUrl = ref('')
const showSuccess = ref(false)

onMounted(async () => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20

  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  recordId.value = currentPage.options?.id || null
  stageName.value = decodeURIComponent(currentPage.options?.stageName || '')
  
  // 获取记录详情
  await loadRecordDetail()
})

const loadRecordDetail = async () => {
  if (!recordId.value) return
  try {
    // 通过 my 接口获取详情（需要 employee_id）
    const coachInfo = uni.getStorageSync('coachInfo') || {}
    const res = await api.lejuanRecords.getMyList({ employee_id: coachInfo.employeeId })
    const records = res.data || []
    const record = records.find(r => r.id === parseInt(recordId.value))
    if (record) {
      stageName.value = record.stage_name || stageName.value
      scheduledStartTime.value = record.scheduled_start_time || '-'
      actualStartTime.value = record.actual_start_time || '未出发'
      returnTime.value = record.return_time || '未归来'
      lejuanHours.value = record.lejuan_hours !== null ? record.lejuan_hours + '小时' : '-'
      proofUrl.value = record.proof_image_url || ''
    }
  } catch (e) {
    console.error('获取记录详情失败:', e)
  }
}

const { imageUrls, uploading, uploadProgress, uploadText, chooseAndUpload } =
  useImageUpload({ maxCount: 1, ossDir: 'TgTemp/', errorType: 'lejuan_proof' })

const submitProof = async () => {
  if (!currentProofUrl.value) return uni.showToast({ title: '请先选择图片', icon: 'none' })
  if (!recordId.value) return uni.showToast({ title: '记录ID缺失', icon: 'none' })

  try {
    uni.showLoading({ title: '提交中...' })
    await api.lejuanRecords.updateProof(recordId.value, {
      proof_image_url: currentProofUrl.value
    })
    uni.hideLoading()
    showSuccess.value = true
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '提交失败', icon: 'none' })
  }
}

// 监听 imageUrls 变化
import { watch } from 'vue'
watch(imageUrls, (urls) => {
  if (urls && urls.length > 0) {
    currentProofUrl.value = urls[0]
  }
})

const previewProof = () => {
  if (proofUrl.value) {
    uni.previewImage({ urls: [proofUrl.value] })
  }
}

const handleSuccessConfirm = () => {
  showSuccess.value = false
  uni.navigateBack()
}

const goBack = () => { uni.navigateBack() }
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

.info-section { margin: 16px; padding: 16px; background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; }
.info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.info-row:last-child { border-bottom: none; }
.info-label { font-size: 13px; color: rgba(255,255,255,0.5); }
.info-value { font-size: 14px; color: #fff; }
.proof-preview { width: 80px; height: 80px; border-radius: 8px; }

.upload-section { margin: 16px; text-align: center; }
.upload-title { font-size: 14px; color: rgba(255,255,255,0.6); margin-bottom: 16px; display: block; }
.upload-btn { width: 100%; height: 120px; background: rgba(255,255,255,0.05); border: 2px dashed rgba(218,165,32,0.3); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.upload-icon { font-size: 36px; margin-bottom: 8px; }
.upload-text { font-size: 14px; color: rgba(255,255,255,0.4); }
.replace-btn { border-color: rgba(218,165,32,0.5); background: rgba(212,175,55,0.05); }

.submit-btn { height: 50px; background: linear-gradient(135deg, #d4af37, #ffd700); border-radius: 25px; display: flex; align-items: center; justify-content: center; margin: 20px 16px; }
.submit-btn text { font-size: 16px; font-weight: 600; color: #000; }
.submit-btn.disabled { opacity: 0.5; }

.upload-progress { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 1001; }
.progress-content { text-align: center; }
.progress-text { font-size: 14px; color: rgba(255,255,255,0.6); display: block; margin-bottom: 20px; }
.progress-bar { width: 200px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #d4af37, #ffd700); transition: width 0.3s; }
</style>
