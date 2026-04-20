<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">休息申请</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- QA-20260420-4: 时间段提示栏 -->
    <view class="time-notice" :class="timeNoticeClass">
      <text class="notice-icon">{{ timeNoticeIcon }}</text>
      <text class="notice-text">{{ timeNoticeText }}</text>
    </view>

    <view class="form-section">
      <!-- 本月次数提示 -->
      <view class="form-item">
        <text class="form-label">本月已休息天数</text>
        <text class="count-text">{{ monthCount.count }}/{{ monthCount.limit }}</text>
      </view>
      
      <!-- 日期选择 -->
      <view class="form-item">
        <text class="form-label">休息日期</text>
        <view class="date-picker-wrapper" @click="showDatePicker = !showDatePicker">
          <view class="date-picker">
            <text :class="{ placeholder: !form.restDate }">{{ form.restDate || '请选择日期' }}</text>
            <text class="picker-arrow">›</text>
          </view>
        </view>
        <!-- 日期下拉弹框 -->
        <view class="date-dropdown" v-if="showDatePicker" @click="showDatePicker = false">
          <view class="date-dropdown-content" @click.stop>
            <view class="date-option" v-for="d in dateOptions" :key="d.value"
                  :class="{ active: form.restDate === d.value }"
                  @click="selectDate(d.value)">
              <text>{{ d.label }}</text>
            </view>
          </view>
        </view>
      </view>
      
      <!-- 备注 -->
      <view class="form-item">
        <text class="form-label">备注（选填）</text>
        <input class="input" v-model="form.remark" placeholder="请输入备注" maxlength="200" />
      </view>
      
      <!-- 提交按钮 -->
      <view class="submit-btn" :class="{ disabled: !canSubmit }" @click="submitApply"><text>提交申请</text></view>
    </view>

    <!-- 我的申请记录 -->
    <view class="form-section" v-if="myApplications.length > 0">
      <text class="section-subtitle">我的申请记录</text>
      <view class="app-card" v-for="app in myApplications" :key="app.id">
        <view class="app-header">
          <text class="app-type">休息申请</text>
          <text class="app-status" :class="'status-' + app.status">
            {{ app.status === 0 ? '待处理' : app.status === 1 ? '已同意' : '已拒绝' }}
          </text>
        </view>
        <view class="app-body">
          <text class="app-info">📅 {{ JSON.parse(app.extra_data || '{}').rest_date || '-' }}</text>
          <text class="app-time">{{ app.created_at }}</text>
        </view>
        <view class="app-actions" v-if="app.status === 0">
          <view class="action-btn cancel" @click="cancelApplication(app.id)"><text>取消申请</text></view>
        </view>
      </view>
    </view>

    <!-- 成功弹窗 -->
    <SuccessModal :visible="showSuccess" title="提交成功" content="休息申请已提交，请等待审批" @confirm="handleSuccessConfirm" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/utils/api-v2.js'
import { getBeijingDate, offsetBeijingDate } from '@/utils/time-util.js'
import SuccessModal from '@/components/SuccessModal.vue'

const statusBarHeight = ref(0)
const coachInfo = ref({})
const showSuccess = ref(false)
const showDatePicker = ref(false)
const myApplications = ref([])
const monthCount = ref({ count: 0, limit: 4, remaining: 4 })

const form = ref({ restDate: '', remark: '' })
const serverHour = ref(null)

// QA-20260420-4: 时间段提示栏 computed
const timeNoticeClass = computed(() => {
  const hour = serverHour.value !== null ? serverHour.value : new Date().getHours()
  return hour >= 16 ? 'warning' : 'success'
})
const timeNoticeIcon = computed(() => {
  const hour = serverHour.value !== null ? serverHour.value : new Date().getHours()
  return hour >= 16 ? '⚠️' : '✅'
})
const timeNoticeText = computed(() => {
  const hour = serverHour.value !== null ? serverHour.value : new Date().getHours()
  return hour >= 16 ? '已过16:00，只能选择明天以后的日期' : '可申请当日休息'
})

// QA-20260420-4: 自定义日期选项（16点后不含当天）
const dateOptions = computed(() => {
  const options = []
  const hour = serverHour.value !== null ? serverHour.value : new Date().getHours()
  const startIndex = hour >= 16 ? 1 : 0 // 16点后从明天开始
  for (let i = startIndex; i <= 30; i++) {
    const value = offsetBeijingDate(i)
    let label
    if (i === 0) label = '今天'
    else if (i === 1) label = '明天'
    else if (i === 2) label = '后天'
    else label = value
    options.push({ value, label })
  }
  return options
})

const canSubmit = computed(() => {
  return form.value.restDate
})

onMounted(async () => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  coachInfo.value = uni.getStorageSync('coachInfo') || {}
  await fetchServerHour()
  await loadMonthCount()
  await loadMyApplications()
})

async function fetchServerHour() {
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://tiangong.club/api'
    const res = await new Promise((resolve, reject) => {
      uni.request({
        url: baseUrl + '/server-time', method: 'GET',
        success: (r) => r.statusCode === 200 ? resolve(r.data) : reject(new Error('请求失败')),
        fail: reject
      })
    })
    serverHour.value = res.hour
  } catch (e) { serverHour.value = new Date().getHours() }
}

function selectDate(value) {
  form.value.restDate = value
  showDatePicker.value = false
}

const loadMonthCount = async () => {
  try {
    const phone = coachInfo.value.phone || coachInfo.value.employeeId
    if (!phone) return
    const res = await api.applications.getMyMonthCount(phone, '休息申请')
    monthCount.value = res.data || { count: 0, limit: 4, remaining: 4 }
  } catch (e) {}
}

const loadMyApplications = async () => {
  try {
    const phone = coachInfo.value.phone || coachInfo.value.employeeId
    if (!phone) return
    const res = await api.applications.getList({
      applicant_phone: phone,
      application_type: '休息申请',
      limit: 10
    })
    myApplications.value = res.data || []
  } catch (e) {}
}

const submitApply = async () => {
  if (!canSubmit.value) return uni.showToast({ title: '请选择休息日期', icon: 'none' })
  
  let phone = coachInfo.value.phone || coachInfo.value.employeeId
  if (!phone) return uni.showToast({ title: '未获取到手机号信息', icon: 'none' })
  
  try {
    uni.showLoading({ title: '提交中...' })
    await api.applications.create({
      applicant_phone: phone,
      application_type: '休息申请',
      remark: form.value.remark || null,
      extra_data: { rest_date: form.value.restDate }
    })
    uni.hideLoading()
    form.value.restDate = ''
    form.value.remark = ''
    await loadMonthCount()
    await loadMyApplications()
    showSuccess.value = true
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '提交失败', icon: 'none' })
  }
}

const cancelApplication = async (id) => {
  uni.showModal({
    title: '确认取消',
    content: '确定取消此申请？',
    success: async (res) => {
      if (res.confirm) {
        try {
          const phone = coachInfo.value.phone || coachInfo.value.employeeId
          await api.applications.delete(id, phone)
          uni.showToast({ title: '申请已取消', icon: 'success' })
          await loadMonthCount()
          await loadMyApplications()
        } catch (e) {
          uni.showToast({ title: e.error || '取消失败', icon: 'none' })
        }
      }
    }
  })
}

const handleSuccessConfirm = () => {
  showSuccess.value = false
  uni.navigateBack()
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

/* QA-20260420-4: 提示栏样式 */
.time-notice { margin: 12px 16px; padding: 12px 16px; border-radius: 8px; display: flex; align-items: center; gap: 8px; }
.time-notice.success { background: rgba(46,204,113,0.15); border: 1px solid rgba(46,204,113,0.3); }
.time-notice.warning { background: rgba(241,196,15,0.15); border: 1px solid rgba(241,196,15,0.3); }
.notice-icon { font-size: 16px; }
.notice-text { font-size: 13px; color: rgba(255,255,255,0.8); }

.form-section { margin: 16px; }
.form-item { margin-bottom: 24px; }
.form-label { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 8px; display: block; }

.count-text { font-size: 14px; color: rgba(255,255,255,0.6); }

.date-picker { height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0 12px; display: flex; align-items: center; justify-content: space-between; }
.date-picker text { font-size: 14px; color: #fff; }
.date-picker .placeholder { color: rgba(255,255,255,0.3); }
.picker-arrow { font-size: 20px; color: rgba(255,255,255,0.3); }
.date-picker-wrapper { cursor: pointer; }
.date-dropdown {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 150; display: flex; align-items: flex-start; justify-content: center;
  padding-top: 200px;
}
.date-dropdown-content {
  width: 80%; max-height: 60vh; overflow-y: auto;
  background: #1a1a2e; border-radius: 12px;
  border: 1px solid rgba(212,175,55,0.3);
}
.date-option {
  padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05);
  font-size: 14px; color: rgba(255,255,255,0.8);
}
.date-option:last-child { border-bottom: none; }
.date-option.active { background: rgba(212,175,55,0.2); color: #fff; font-weight: 600; }

.input { width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0 12px; font-size: 14px; color: #fff; box-sizing: border-box; }

.submit-btn { height: 50px; background: linear-gradient(135deg, #d4af37, #ffd700); border-radius: 25px; display: flex; align-items: center; justify-content: center; margin-top: 30px; }
.submit-btn text { font-size: 16px; font-weight: 600; color: #000; }
.submit-btn.disabled { opacity: 0.5; }

.section-subtitle { font-size: 14px; color: rgba(255,255,255,0.5); margin-bottom: 12px; display: block; }

.app-card { background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; padding: 12px; margin-bottom: 10px; }
.app-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.app-type { font-size: 13px; font-weight: 600; color: #d4af37; }
.app-status { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
.status-0 { background: rgba(241,196,15,0.2); color: #f1c40f; }
.status-1 { background: rgba(46,204,113,0.2); color: #2ecc71; }
.status-2 { background: rgba(231,76,60,0.2); color: #e74c3c; }
.app-body { display: flex; flex-direction: column; gap: 4px; }
.app-info { font-size: 13px; color: rgba(255,255,255,0.7); }
.app-time { font-size: 11px; color: rgba(255,255,255,0.3); }
.app-actions { margin-top: 8px; }
.action-btn.cancel { height: 32px; background: rgba(231,76,60,0.15); border: 1px solid rgba(231,76,60,0.3); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.action-btn.cancel text { font-size: 12px; color: #e74c3c; }
</style>
