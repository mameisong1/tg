<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">班次切换申请</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <view class="form-section">
      <!-- 当前班次 -->
      <view class="form-item">
        <text class="form-label">当前班次</text>
        <text class="current-shift">{{ currentShift }}</text>
      </view>
      
      <!-- 目标班次 -->
      <view class="form-item">
        <text class="form-label">目标班次</text>
        <view class="shift-options">
          <view class="shift-btn" :class="{ active: form.targetShift === '早班' && currentShift !== '早班' }" 
                @click="selectShift('早班')"
                v-if="currentShift !== '早班'">
            <text>早班</text>
          </view>
          <view class="shift-btn" :class="{ active: form.targetShift === '晚班' && currentShift !== '晚班' }" 
                @click="selectShift('晚班')"
                v-if="currentShift !== '晚班'">
            <text>晚班</text>
          </view>
        </view>
      </view>
      
      <!-- 本月次数提示 -->
      <view class="form-item" v-if="monthCount.limit > 0">
        <text class="form-label">本月已用次数</text>
        <text class="count-text">{{ monthCount.count }}/{{ monthCount.limit }}</text>
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
          <text class="app-type">班次切换</text>
          <text class="app-status" :class="'status-' + app.status">
            {{ app.status === 0 ? '待处理' : app.status === 1 ? '已同意' : '已拒绝' }}
          </text>
        </view>
        <view class="app-body">
          <text class="app-info">→ {{ JSON.parse(app.extra_data || '{}').target_shift || '-' }}</text>
          <text class="app-time">{{ app.created_at }}</text>
        </view>
        <view class="app-actions" v-if="app.status === 0">
          <view class="action-btn cancel" @click="cancelApplication(app.id)"><text>取消申请</text></view>
        </view>
      </view>
    </view>

    <!-- 成功弹窗 -->
    <SuccessModal :visible="showSuccess" title="提交成功" content="班次切换申请已提交，请等待审批" @confirm="handleSuccessConfirm" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/utils/api.js'
import { getBeijingDate } from '@/utils/time-util.js'
import SuccessModal from '@/components/SuccessModal.vue'

const statusBarHeight = ref(0)
const coachInfo = ref({})
const showSuccess = ref(false)
const myApplications = ref([])
const monthCount = ref({ count: 0, limit: 2, remaining: 2 })

const form = ref({ targetShift: '', remark: '' })

const currentShift = computed(() => {
  return coachInfo.value.shift || '未获取到班次信息'
})

const canSubmit = computed(() => {
  return form.value.targetShift && form.value.targetShift !== currentShift.value
})

onMounted(async () => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  coachInfo.value = uni.getStorageSync('coachInfo') || {}
  await loadMonthCount()
  await loadMyApplications()
})

const selectShift = (shift) => {
  form.value.targetShift = shift
}

const loadMonthCount = async () => {
  try {
    const phone = coachInfo.value.phone || coachInfo.value.employeeId
    if (!phone) return
    const res = await api.applications.getMyMonthCount(phone, '班次切换申请')
    monthCount.value = res.data || { count: 0, limit: 2, remaining: 2 }
  } catch (e) {}
}

const loadMyApplications = async () => {
  try {
    const phone = coachInfo.value.phone || coachInfo.value.employeeId
    if (!phone) return
    const res = await api.applications.getList({
      applicant_phone: phone,
      application_type: '班次切换申请',
      limit: 10
    })
    myApplications.value = res.data || []
  } catch (e) {}
}

const submitApply = async () => {
  if (!canSubmit.value) return uni.showToast({ title: '请选择目标班次', icon: 'none' })
  
  let phone = coachInfo.value.phone || coachInfo.value.employeeId
  if (!phone) return uni.showToast({ title: '未获取到手机号信息', icon: 'none' })
  
  try {
    uni.showLoading({ title: '提交中...' })
    await api.applications.create({
      applicant_phone: phone,
      application_type: '班次切换申请',
      remark: form.value.remark || null,
      extra_data: { target_shift: form.value.targetShift }
    })
    uni.hideLoading()
    form.value.targetShift = ''
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

.form-section { margin: 16px; }
.form-item { margin-bottom: 24px; }
.form-label { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 8px; display: block; }
.current-shift { font-size: 16px; font-weight: 600; color: #d4af37; }

.shift-options { display: flex; gap: 12px; }
.shift-btn { flex: 1; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.shift-btn text { font-size: 15px; color: rgba(255,255,255,0.8); }
.shift-btn:active, .shift-btn.active { background: rgba(212,175,55,0.2); border-color: #d4af37; }
.shift-btn:active text, .shift-btn.active text { color: #d4af37; }

.count-text { font-size: 14px; color: rgba(255,255,255,0.6); }

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
