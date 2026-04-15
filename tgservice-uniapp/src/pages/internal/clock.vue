<template>
  <view class="page">
    <!-- 固定标题栏 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">‹</text>
        </view>
        <text class="header-title">上班/下班</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 助教信息 -->
    <view class="coach-info-section">
      <text class="coach-name">{{ coachInfo.stageName }}</text>
      <text class="coach-no">工号: {{ coachInfo.employeeId }}</text>
      <text class="coach-shift" v-if="waterBoard">当前班次: {{ waterBoard.shift }}</text>
    </view>

    <!-- 当前水牌状态 -->
    <view class="current-status" v-if="waterBoard">
      <text class="status-label">当前状态</text>
      <view class="status-badge" :class="statusClass(waterBoard.status)">
        <text>{{ waterBoard.status }}</text>
      </view>
      <template v-if="waterBoard.table_no_list && waterBoard.table_no_list.length">
        <text class="table-info-label">台桌</text>
        <view class="table-tags">
          <text class="table-tag" v-for="(t, i) in waterBoard.table_no_list" :key="i">{{ t }}</text>
        </view>
      </template>
    </view>

    <!-- 操作按钮 -->
    <view class="action-section">
      <view class="action-btn clock-in-btn" :class="{ disabled: !canClockIn }" @click="handleClockIn">
        <text class="action-icon">⏰</text>
        <text class="action-text">上班</text>
      </view>
      <view class="action-btn clock-out-btn" :class="{ disabled: !canClockOut }" @click="handleClockOut">
        <text class="action-icon">🌙</text>
        <text class="action-text">下班</text>
      </view>
    </view>

    <!-- 提示 -->
    <view class="tips">
      <text class="tips-title">状态说明</text>
      <text class="tips-text">上班：从非在班状态进入空闲状态（根据班次决定早班/晚班）</text>
      <text class="tips-text">下班：从在班状态（空闲/上桌/加班）变为下班状态</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/utils/api-v2.js'

const statusBarHeight = ref(0)
const coachInfo = ref({})
const waterBoard = ref(null)

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
})

// 每次页面显示时重新读取 coachInfo 和加载水牌
onShow(() => {
  coachInfo.value = uni.getStorageSync('coachInfo') || {}
  if (coachInfo.value.coachNo) {
    loadWaterBoard()
  }
})

const loadWaterBoard = async () => {
  try {
    const res = await api.waterBoards.getOne(coachInfo.value.coachNo)
    waterBoard.value = res.data
  } catch (e) {
    uni.showToast({ title: '获取状态失败', icon: 'none' })
  }
}

const canClockIn = computed(() => {
  if (!waterBoard.value) return false
  const status = waterBoard.value.status
  // 乐捐状态不能自行上班，必须由助教管理/店长操作乐捐归来
  return ['早加班', '晚加班', '休息', '公休', '请假', '下班'].includes(status)
})

const canClockOut = computed(() => {
  if (!waterBoard.value) return false
  const status = waterBoard.value.status
  return ['早班空闲', '晚班空闲', '早班上桌', '晚班上桌', '早加班', '晚加班'].includes(status)
})

const statusClass = (status) => {
  if (status?.includes('上桌')) return 'status-on-table'
  if (status?.includes('空闲')) return 'status-free'
  if (status === '下班') return 'status-off'
  return 'status-other'
}

const handleClockIn = async () => {
  if (!canClockIn.value) return
  try {
    uni.showLoading({ title: '上班中...' })
    await api.coachesV2.clockIn(coachInfo.value.coachNo)
    uni.hideLoading()
    uni.showToast({ title: '上班成功', icon: 'success' })
    await loadWaterBoard()
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '上班失败', icon: 'none' })
  }
}

const handleClockOut = async () => {
  if (!canClockOut.value) return
  uni.showModal({
    title: '确认下班',
    content: '确定要下班吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '下班中...' })
          await api.coachesV2.clockOut(coachInfo.value.coachNo)
          uni.hideLoading()
          uni.showToast({ title: '下班成功', icon: 'success' })
          await loadWaterBoard()
        } catch (e) {
          uni.hideLoading()
          uni.showToast({ title: e.error || '下班失败', icon: 'none' })
        }
      }
    }
  })
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

.coach-info-section { padding: 30px 20px 20px; text-align: center; background: linear-gradient(180deg, rgba(212,175,55,0.1) 0%, transparent 100%); }
.coach-name { font-size: 24px; font-weight: 600; color: #d4af37; display: block; margin-bottom: 8px; }
.coach-no { font-size: 14px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 4px; }
.coach-shift { font-size: 13px; color: rgba(255,255,255,0.4); display: block; }

.current-status { margin: 16px; padding: 20px; background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; text-align: center; }
.status-label { font-size: 13px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 8px; }
.status-badge { display: inline-block; padding: 8px 20px; border-radius: 20px; font-size: 16px; font-weight: 600; }
.status-on-table { background: rgba(46,204,113,0.2); border: 1px solid rgba(46,204,113,0.3); color: #2ecc71; }
.status-free { background: rgba(52,152,219,0.2); border: 1px solid rgba(52,152,219,0.3); color: #3498db; }
.status-off { background: rgba(231,76,60,0.2); border: 1px solid rgba(231,76,60,0.3); color: #e74c3c; }
.status-other { background: rgba(241,196,15,0.2); border: 1px solid rgba(241,196,15,0.3); color: #f1c40f; }
.table-info-label { font-size: 13px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 6px; }
.table-tags { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.table-tag { font-size: 13px; font-weight: 600; color: #d4af37; background: rgba(212,175,55,0.15); border: 1px solid rgba(212,175,55,0.3); border-radius: 8px; padding: 3px 10px; }

.action-section { display: flex; gap: 16px; padding: 20px 16px; }
.action-btn { flex: 1; height: 100px; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
.action-icon { font-size: 32px; }
.action-text { font-size: 16px; font-weight: 600; }
.clock-in-btn { background: linear-gradient(135deg, rgba(46,204,113,0.2), rgba(46,204,113,0.1)); border: 1px solid rgba(46,204,113,0.3); color: #2ecc71; }
.clock-out-btn { background: linear-gradient(135deg, rgba(231,76,60,0.2), rgba(231,76,60,0.1)); border: 1px solid rgba(231,76,60,0.3); color: #e74c3c; }
.action-btn.disabled { opacity: 0.3; }

.tips { margin: 16px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 10px; }
.tips-title { font-size: 14px; color: rgba(255,255,255,0.6); font-weight: 600; display: block; margin-bottom: 8px; }
.tips-text { font-size: 12px; color: rgba(255,255,255,0.4); display: block; margin-bottom: 4px; line-height: 1.5; }
</style>
