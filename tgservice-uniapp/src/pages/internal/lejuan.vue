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

    <view class="form-section">
      <view class="form-item">
        <text class="form-label">日期</text>
        <picker mode="date" :value="form.date" @change="e => form.date = e.detail.value">
          <view class="picker-value">
            <text :class="{ placeholder: !form.date }">{{ form.date || '选择日期' }}</text>
            <text class="arrow">›</text>
          </view>
        </picker>
      </view>
      <view class="form-item">
        <text class="form-label">外出小时数</text>
        <picker :range="hourOptions" @change="e => form.hours = hourOptions[e.detail.value]">
          <view class="picker-value">
            <text :class="{ placeholder: !form.hours }">{{ form.hours ? form.hours + '小时' : '选择小时数' }}</text>
            <text class="arrow">›</text>
          </view>
        </picker>
      </view>
      <view class="form-item">
        <text class="form-label">备注</text>
        <textarea class="textarea" v-model="form.remark" placeholder="请输入备注（如和客人外出）" maxlength="200"></textarea>
      </view>
      <view class="submit-btn" :class="{ disabled: !canSubmit }" @click="submitLejuan"><text>提交乐捐报备</text></view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/utils/api-v2.js'

const statusBarHeight = ref(0)
const coachInfo = ref({})
const hourOptions = [1, 2, 3, 4, 5, 6, 7, 8]

const today = new Date().toISOString().split('T')[0]
const form = ref({ date: today, hours: null, remark: '' })

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  coachInfo.value = uni.getStorageSync('coachInfo') || {}
})

const canSubmit = computed(() => form.value.date && form.value.hours)

const submitLejuan = async () => {
  if (!canSubmit.value) return uni.showToast({ title: '请填写完整信息', icon: 'none' })

  let phone = coachInfo.value.phone || coachInfo.value.employee_id
  if (!phone) return uni.showToast({ title: '未获取到手机号', icon: 'none' })

  try {
    uni.showLoading({ title: '提交中...' })
    await api.applications.create({
      applicant_phone: phone,
      application_type: '乐捐报备',
      remark: form.value.remark || `${form.value.date} 外出${form.value.hours}小时`,
      extra_data: { date: form.value.date, hours: form.value.hours }
    })
    uni.hideLoading()
    uni.showToast({ title: '报备成功', icon: 'success' })
    form.value.remark = ''
    form.value.hours = null
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

.form-section { margin: 16px; }
.form-item { margin-bottom: 24px; }
.form-label { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 8px; display: block; }
.picker-value { display: flex; justify-content: space-between; align-items: center; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0 16px; }
.picker-value .placeholder { color: rgba(255,255,255,0.3); }
.arrow { font-size: 18px; color: rgba(255,255,255,0.3); }
.textarea { width: 100%; min-height: 80px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px; font-size: 14px; color: #fff; box-sizing: border-box; }

.submit-btn { height: 50px; background: linear-gradient(135deg, #d4af37, #ffd700); border-radius: 25px; display: flex; align-items: center; justify-content: center; margin-top: 30px; }
.submit-btn text { font-size: 16px; font-weight: 600; color: #000; }
.submit-btn.disabled { opacity: 0.5; }
</style>
