<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">乐捐报备</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 预约表单 -->
    <view class="form-section">
      <view class="section-title">📋 预约乐捐</view>
      <view class="form-item">
        <text class="form-label">日期</text>
        <picker mode="date" :value="form.scheduledDate" :start="today" @change="e => { form.scheduledDate = e.detail.value; onDateChange() }">
          <view class="picker-value">
            <text :class="{ placeholder: !form.scheduledDate }">{{ form.scheduledDate || '选择日期' }}</text>
            <text class="arrow">›</text>
          </view>
        </picker>
      </view>
      <view class="form-item">
        <text class="form-label">开始时间（整点）</text>
        <picker :range="hourOptions" @change="e => form.scheduledHour = hourOptions[e.detail.value]">
          <view class="picker-value">
            <text :class="{ placeholder: form.scheduledHour === null }">{{ form.scheduledHour !== null ? String(form.scheduledHour).padStart(2, '0') + ':00' : '选择整点时间' }}</text>
            <text class="arrow">›</text>
          </view>
        </picker>
      </view>
      <view class="form-item">
        <text class="form-label">预计外出小时数（可选）</text>
        <picker :range="hourOptions2" @change="e => form.extraHours = hourOptions2[e.detail.value]">
          <view class="picker-value">
            <text :class="{ placeholder: !form.extraHours }">{{ form.extraHours ? form.extraHours + '小时' : '选择小时数' }}</text>
            <text class="arrow">›</text>
          </view>
        </picker>
      </view>
      <view class="form-item">
        <text class="form-label">备注</text>
        <input class="input" v-model="form.remark" placeholder="请输入备注（如和客人外出）" maxlength="200" />
      </view>
      <view class="submit-btn" :class="{ disabled: !canSubmit }" @click="submitLejuan"><text>提交预约</text></view>
    </view>

    <!-- 我的乐捐记录（近2天） -->
    <view class="records-section" v-if="myRecords.length > 0">
      <view class="section-title">📝 近2天记录</view>
      <view v-for="rec in myRecords" :key="rec.id" class="record-card" @click="goToProof(rec)">
        <view class="record-header">
          <text class="record-status" :class="'status-' + rec.lejuan_status">{{ statusLabel(rec.lejuan_status) }}</text>
          <text class="record-time">{{ rec.scheduled_start_time.substring(5, 16) }}</text>
        </view>
        <view class="record-body">
          <text class="record-detail" v-if="rec.actual_start_time">生效: {{ rec.actual_start_time.substring(11, 16) }}</text>
          <text class="record-detail" v-if="rec.lejuan_hours !== null">外出: {{ rec.lejuan_hours }}小时</text>
          <text class="record-detail" v-if="rec.remark">{{ rec.remark }}</text>
          <text class="record-detail" v-if="rec.proof_image_url">✅ 已传截图</text>
          <text class="record-detail proof-hint" v-else-if="canUploadProof(rec)">📷 点击传截图</text>
        </view>
      </view>
    </view>

    <!-- 成功弹窗 -->
    <SuccessModal :visible="showSuccess" title="预约成功" content="乐捐报备已提交，到时间自动生效" @confirm="handleSuccessConfirm" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/utils/api-v2.js'
import SuccessModal from '@/components/SuccessModal.vue'
import { getBeijingDate } from '@/utils/time-util.js'

const statusBarHeight = ref(0)
const coachInfo = ref({})
const showSuccess = ref(false)
const myRecords = ref([])

const today = getBeijingDate()
const form = ref({
  scheduledDate: today,
  scheduledHour: null,
  extraHours: null,
  remark: ''
})

// 可用小时选项：从当前小时+1开始
const hourOptions = computed(() => {
  const now = new Date()
  const currentHour = now.getHours()
  const options = []
  for (let h = currentHour + 1; h <= 23; h++) {
    options.push(h)
  }
  return options
})

const hourOptions2 = [1, 2, 3, 4, 5, 6, 7, 8]

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  coachInfo.value = uni.getStorageSync('coachInfo') || {}
})

onShow(() => {
  coachInfo.value = uni.getStorageSync('coachInfo') || {}
  loadMyRecords()
})

const canSubmit = computed(() => {
  return form.value.scheduledDate && form.value.scheduledHour !== null
})

// 日期变化时重置小时选择
const onDateChange = () => {
  form.value.scheduledHour = null
}

const statusLabel = (status) => {
  const map = { pending: '待出发', active: '乐捐中', returned: '已归来' }
  return map[status] || status
}

// 判断是否可上传截图（近2天）
const canUploadProof = (rec) => {
  const createdDate = rec.created_at.split(' ')[0]
  const twoDaysAgo = getBeijingDate()
  // 简单比较：2天前
  const d1 = new Date(createdDate + 'T00:00:00+08:00')
  const d2 = new Date(twoDaysAgo + 'T00:00:00+08:00')
  const diffDays = (d2 - d1) / (1000 * 60 * 60 * 24)
  return diffDays <= 2
}

const loadMyRecords = async () => {
  try {
    const res = await api.lejuanRecords.getMyList({ employee_id: coachInfo.value.employeeId })
    myRecords.value = res.data || []
  } catch (e) {
    // 静默失败，不影响页面
  }
}

const submitLejuan = async () => {
  if (!canSubmit.value) return uni.showToast({ title: '请选择日期和时间', icon: 'none' })

  const scheduledTime = `${form.value.scheduledDate} ${String(form.value.scheduledHour).padStart(2, '0')}:00:00`

  try {
    uni.showLoading({ title: '提交中...' })
    await api.lejuanRecords.create({
      employee_id: coachInfo.value.employeeId,
      scheduled_start_time: scheduledTime,
      extra_hours: form.value.extraHours,
      remark: form.value.remark
    })
    uni.hideLoading()
    form.value.remark = ''
    form.value.extraHours = null
    form.value.scheduledHour = null
    showSuccess.value = true
    await loadMyRecords()
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '提交失败', icon: 'none' })
  }
}

const goToProof = (rec) => {
  if (rec.proof_image_url) {
    // 已有截图，预览
    uni.previewImage({ urls: [rec.proof_image_url] })
    return
  }
  if (canUploadProof(rec)) {
    uni.navigateTo({
      url: `/pages/internal/lejuan-proof?id=${rec.id}&stageName=${rec.stage_name || ''}`
    })
  }
}

const handleSuccessConfirm = () => {
  showSuccess.value = false
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

.section-title { font-size: 15px; color: #d4af37; padding: 16px 16px 12px; font-weight: 600; }

.form-section { margin: 0 16px; }
.form-item { margin-bottom: 24px; }
.form-label { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 8px; display: block; }
.picker-value { display: flex; justify-content: space-between; align-items: center; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0 16px; }
.picker-value .placeholder { color: rgba(255,255,255,0.3); }
.arrow { font-size: 18px; color: rgba(255,255,255,0.3); }
.input { width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0 12px; font-size: 14px; color: #fff; box-sizing: border-box; }

.submit-btn { height: 50px; background: linear-gradient(135deg, #d4af37, #ffd700); border-radius: 25px; display: flex; align-items: center; justify-content: center; margin-top: 10px; margin-bottom: 20px; }
.submit-btn text { font-size: 16px; font-weight: 600; color: #000; }
.submit-btn.disabled { opacity: 0.5; }

/* 记录卡片 */
.records-section { margin: 0 16px; }
.record-card { background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; }
.record-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.record-status { font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 8px; }
.status-pending { background: rgba(241,196,15,0.2); color: #f1c40f; }
.status-active { background: rgba(231,76,60,0.2); color: #e74c3c; }
.status-returned { background: rgba(46,204,113,0.2); color: #2ecc71; }
.record-time { font-size: 13px; color: rgba(255,255,255,0.5); }
.record-body { display: flex; flex-direction: column; gap: 4px; }
.record-detail { font-size: 12px; color: rgba(255,255,255,0.4); }
.proof-hint { color: #d4af37 !important; }
</style>
