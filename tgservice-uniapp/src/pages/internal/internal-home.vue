<template>
  <view class="page">
    <!-- 固定标题栏 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">‹</text>
        </view>
        <text class="header-title">内部专用</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 用户信息 -->
    <view class="user-info">
      <text class="user-name">{{ adminInfo.name || adminInfo.username }}</text>
      <text class="user-role">{{ adminInfo.role }}</text>
    </view>

    <!-- 助教专用按钮 -->
    <view class="section" v-if="isCoach">
      <text class="section-title">助教专用</text>
      <view class="btn-grid">
        <view class="action-btn" @click="navigate('/pages/coach-profile/coach-profile')">
          <text class="btn-icon">👤</text>
          <text class="btn-label">个人中心</text>
        </view>
        <view class="action-btn" @click="navigate('/pages/internal/clock')">
          <text class="btn-icon">⏰</text>
          <text class="btn-label">上班/下班</text>
        </view>
        <view class="action-btn" @click="navigate('/pages/internal/table-action')">
          <text class="btn-icon">🎱</text>
          <text class="btn-label">上桌/下桌</text>
        </view>
        <view class="action-btn" @click="navigate('/pages/internal/service-order')">
          <text class="btn-icon">🔔</text>
          <text class="btn-label">服务下单</text>
        </view>
        <view class="action-btn" @click="navigate('/pages/internal/overtime-apply')">
          <text class="btn-icon">📋</text>
          <text class="btn-label">加班申请</text>
        </view>
        <view class="action-btn" @click="navigate('/pages/internal/leave-apply')">
          <text class="btn-icon">🏖️</text>
          <text class="btn-label">公休申请</text>
        </view>
        <view class="action-btn" @click="navigate('/pages/internal/lejuan')">
          <text class="btn-icon">💰</text>
          <text class="btn-label">乐捐报备</text>
        </view>
        <view class="action-btn" @click="navigate('/pages/internal/invitation-upload')">
          <text class="btn-icon">📸</text>
          <text class="btn-label">上传约客记录</text>
        </view>
      </view>
    </view>

    <!-- 管理按钮 -->
    <view class="section" v-if="isManager">
      <text class="section-title">管理功能</text>
      <view class="btn-grid">
        <view class="action-btn" @click="navigate('/pages/internal/water-board')">
          <text class="btn-icon">📋</text>
          <text class="btn-label">水牌管理</text>
        </view>
        <view class="action-btn" @click="navigate('/pages/internal/overtime-approval')">
          <text class="btn-icon">✅</text>
          <text class="btn-label">加班审批 ({{ overtimeCount }})</text>
        </view>
        <view class="action-btn" @click="navigate('/pages/internal/leave-approval')">
          <text class="btn-icon">🏖️</text>
          <text class="btn-label">公休审批 ({{ leaveCount }})</text>
        </view>
        <view class="action-btn" @click="navigate('/pages/internal/lejuan-list')">
          <text class="btn-icon">💰</text>
          <text class="btn-label">乐捐报备一览</text>
        </view>
        <view class="action-btn" @click="navigate('/pages/internal/invitation-review?shift=早班')">
          <text class="btn-icon">🌅</text>
          <text class="btn-label">早班约客审查</text>
        </view>
        <view class="action-btn" @click="navigate('/pages/internal/invitation-review?shift=晚班')">
          <text class="btn-icon">🌙</text>
          <text class="btn-label">晚班约客审查</text>
        </view>
        <view class="action-btn" @click="navigate('/pages/internal/switch-control')">
          <text class="btn-icon">💡</text>
          <text class="btn-label">智能开关</text>
        </view>
      </view>
    </view>

    <!-- 所有后台用户：服务下单 -->
    <view class="section" v-if="!isCoach && !isManager">
      <text class="section-title">常用功能</text>
      <view class="btn-grid">
        <view class="action-btn" @click="navigate('/pages/internal/service-order')">
          <text class="btn-icon">🔔</text>
          <text class="btn-label">服务下单</text>
        </view>
      </view>
    </view>

    <!-- 教练只读水牌 -->
    <view class="section" v-if="isCoachViewer">
      <text class="section-title">查看</text>
      <view class="btn-grid">
        <view class="action-btn" @click="navigate('/pages/internal/water-board-view')">
          <text class="btn-icon">📋</text>
          <text class="btn-label">水牌查看</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/utils/api-v2.js'

const statusBarHeight = ref(0)
const adminInfo = ref({})

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  adminInfo.value = uni.getStorageSync('adminInfo') || {}
  loadPendingCounts()
})

const isCoach = computed(() => {
  const info = uni.getStorageSync('coachInfo')
  return !!info
})

const isManager = computed(() => {
  const role = adminInfo.value.role
  return ['店长', '助教管理', '管理员'].includes(role)
})

const isCoachViewer = computed(() => {
  return adminInfo.value.role === '教练'
})

const overtimeCount = ref(0)
const leaveCount = ref(0)

const loadPendingCounts = async () => {
  try {
    const [overtime, leave] = await Promise.all([
      api.applications.getList({ application_type: '早加班申请', status: 0, limit: 1 }),
      api.applications.getList({ application_type: '公休申请', status: 0, limit: 1 })
    ])
    overtimeCount.value = overtime.data?.length || 0
    leaveCount.value = leave.data?.length || 0
  } catch (e) {
    // 忽略
  }
}

const goBack = () => { const pages = getCurrentPages(); if (pages.length > 1) { uni.navigateBack() } else { uni.switchTab({ url: '/pages/member/member' }) } }
const navigate = (url) => uni.navigateTo({ url })
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

.user-info { padding: 24px 20px 16px; text-align: center; background: linear-gradient(180deg, rgba(212,175,55,0.1) 0%, transparent 100%); }
.user-name { font-size: 20px; font-weight: 600; color: #d4af37; display: block; margin-bottom: 4px; }
.user-role { font-size: 13px; color: rgba(255,255,255,0.5); }

.section { padding: 16px; }
.section-title { font-size: 15px; color: rgba(255,255,255,0.7); margin-bottom: 12px; display: block; padding-left: 4px; }
.btn-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.action-btn { background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; padding: 16px 8px; display: flex; flex-direction: column; align-items: center; }
.btn-icon { font-size: 28px; margin-bottom: 6px; }
.btn-label { font-size: 12px; color: rgba(255,255,255,0.8); text-align: center; line-height: 1.3; }
</style>
