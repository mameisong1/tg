<template>
  <view class="page">
    <!-- 固定标题栏 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">‹</text>
        </view>
        <text class="header-title">约客统计</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 时间周期选择 -->
    <view class="period-section">
      <view class="period-tabs">
        <view
          v-for="tab in periodTabs"
          :key="tab.value"
          class="period-tab"
          :class="{ active: currentPeriod === tab.value }"
          @click="switchPeriod(tab.value)"
        >
          <text class="period-tab-text">{{ tab.label }}</text>
        </view>
      </view>
    </view>

    <!-- 统计周期显示 -->
    <view class="date-range-section">
      <text class="date-range-label">统计周期：</text>
      <text class="date-range-value">{{ dateRange || '-' }}</text>
    </view>

    <!-- 加载状态 -->
    <view v-if="loading" class="loading-wrap">
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 数据内容 -->
    <view v-else-if="summary" class="stats-content">
      <!-- 统计卡片行 -->
      <view class="stats-row">
        <view class="stat-card stat-not-invited">
          <text class="stat-value">{{ summary.not_invited }}</text>
          <text class="stat-label">未约课</text>
        </view>
        <view class="stat-card stat-valid">
          <text class="stat-value">{{ summary.valid }}</text>
          <text class="stat-label">有效约课</text>
        </view>
        <view class="stat-card stat-invalid">
          <text class="stat-value">{{ summary.invalid }}</text>
          <text class="stat-label">无效约课</text>
        </view>
      </view>

      <!-- 约课率卡片 -->
      <view class="rate-card">
        <view class="rate-header">
          <text class="rate-label">约课率</text>
          <text class="rate-hint">有效 / (未约 + 无效 + 有效)</text>
        </view>
        <text class="rate-value" :class="rateColorClass">{{ summary.invite_rate }}</text>
        <view class="rate-bar">
          <view class="rate-bar-fill" :style="{ width: ratePercent + '%' }"></view>
        </view>
        <view class="rate-detail">
          <text class="rate-detail-text">
            应约客人数：{{ summary.total_should }} 人（未约 {{ summary.not_invited }} + 无效 {{ summary.invalid }} + 有效 {{ summary.valid }}）
          </text>
        </view>
      </view>

      <!-- 待确认提示 -->
      <view class="pending-hint" v-if="summary.pending > 0">
        <text class="pending-icon">⏳</text>
        <text class="pending-text">另有 {{ summary.pending }} 条记录待审查确认</text>
      </view>

      <!-- 未约（无效）助教一览 -->
      <view class="missed-section">
        <view class="section-title-row">
          <text class="section-title">📋 未约（无效）助教一览</text>
          <text class="section-count" v-if="missedCoaches.length > 0">共 {{ missedCoaches.length }} 人</text>
        </view>

        <view v-if="missedCoaches.length === 0" class="empty-missed">
          <text class="empty-text">🎉 暂无未约（无效）助教</text>
        </view>

        <view v-else class="missed-list">
          <view
            v-for="coach in missedCoaches"
            :key="coach.coach_no"
            class="missed-item"
          >
            <view class="missed-rank" :class="rankClass(coach)">
              <text class="rank-text">{{ coachRank(coach) }}</text>
            </view>
            <image class="missed-avatar" :src="coach.photo_url" mode="aspectFill"></image>
            <view class="missed-info">
              <text class="missed-name">{{ coach.employee_id }}号 {{ coach.stage_name }}</text>
            </view>
            <view class="missed-count">
              <text class="count-num">{{ coach.missed_count }}</text>
              <text class="count-label">次</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 无数据 -->
    <view v-else class="no-data">
      <text class="no-data-icon">📭</text>
      <text class="no-data-text">暂无约客数据</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/utils/api.js'

const statusBarHeight = ref(0)
const loading = ref(false)
const currentPeriod = ref('yesterday')
const summary = ref(null)
const missedCoaches = ref([])
const dateRange = ref('')

const periodTabs = [
  { label: '昨天', value: 'yesterday' },
  { label: '前天', value: 'day-before-yesterday' },
  { label: '本月', value: 'this-month' },
  { label: '上月', value: 'last-month' }
]

// 约课率颜色
const ratePercent = computed(() => {
  if (!summary.value) return 0
  const rate = parseFloat(summary.value.invite_rate)
  return isNaN(rate) ? 0 : rate
})

const rateColorClass = computed(() => {
  const rate = ratePercent.value
  if (rate >= 80) return 'rate-high'
  if (rate >= 50) return 'rate-medium'
  return 'rate-low'
})

// 排名样式：前三名显示警示样式
const rankClass = (coach) => {
  const idx = missedCoaches.value.indexOf(coach)
  if (idx === 0 && coach.missed_count > 0) return 'rank-warning-1'
  if (idx === 1 && coach.missed_count > 0) return 'rank-warning-2'
  if (idx === 2 && coach.missed_count > 0) return 'rank-warning-3'
  return ''
}

const coachRank = (coach) => {
  const idx = missedCoaches.value.indexOf(coach) + 1
  if (idx === 1) return '⚠️'
  if (idx === 2) return '⚠️'
  if (idx === 3) return '⚠️'
  return idx
}

// 切换时间周期
const switchPeriod = (period) => {
  if (period === currentPeriod.value) return
  currentPeriod.value = period
  loadData()
}

// 加载数据
const loadData = async () => {
  loading.value = true
  summary.value = null
  missedCoaches.value = []
  dateRange.value = ''

  try {
    const res = await api.guestInvitations.getPeriodStats({ period: currentPeriod.value })
    if (res.success && res.data) {
      summary.value = res.data.summary
      missedCoaches.value = res.data.missed_coaches || []
      dateRange.value = res.data.date_range
    }
  } catch (e) {
    console.error('加载约客统计失败:', e)
    uni.showToast({ title: e.error || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 返回
const goBack = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/member/member' })
  }
}

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  loadData()
})

onShow(() => {
  // 从其他页面返回时刷新数据
  if (summary.value) {
    loadData()
  }
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #0a0a0f;
  padding-bottom: 40px;
}

/* 固定标题栏 */
.fixed-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  background: #0a0a0f;
}
.status-bar-bg { background: #0a0a0f; }
.header-content {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
}
.back-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.back-icon { font-size: 28px; color: #d4af37; }
.header-title {
  font-size: 17px;
  font-weight: 600;
  color: #d4af37;
  letter-spacing: 2px;
}
.back-placeholder { width: 36px; }
.header-placeholder { background: #0a0a0f; }

/* 时间周期选择 */
.period-section {
  padding: 16px 16px 8px;
}
.period-tabs {
  display: flex;
  gap: 10px;
  background: rgba(20, 20, 30, 0.6);
  border-radius: 12px;
  padding: 6px;
  border: 1px solid rgba(218, 165, 32, 0.1);
}
.period-tab {
  flex: 1;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.2s;
}
.period-tab.active {
  background: linear-gradient(135deg, #d4af37, #ffd700);
}
.period-tab-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}
.period-tab.active .period-tab-text {
  color: #000;
  font-weight: 600;
}

/* 统计周期显示 */
.date-range-section {
  padding: 8px 16px 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.date-range-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}
.date-range-value {
  font-size: 13px;
  color: #d4af37;
  font-weight: 500;
}

/* 加载状态 */
.loading-wrap {
  padding: 60px 0;
  text-align: center;
}
.loading-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.4);
}

/* 无数据 */
.no-data {
  padding: 80px 0;
  text-align: center;
}
.no-data-icon { font-size: 48px; display: block; margin-bottom: 12px; }
.no-data-text { font-size: 15px; color: rgba(255, 255, 255, 0.4); }

/* 统计卡片行 */
.stats-content { padding: 0 16px; }
.stats-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.stat-card {
  flex: 1;
  background: rgba(20, 20, 30, 0.6);
  border-radius: 12px;
  padding: 16px 12px;
  text-align: center;
  border: 1px solid rgba(218, 165, 32, 0.1);
}
.stat-card.stat-not-invited { border-color: rgba(231, 76, 60, 0.3); }
.stat-card.stat-valid { border-color: rgba(46, 204, 113, 0.3); }
.stat-card.stat-invalid { border-color: rgba(241, 196, 15, 0.3); }
.stat-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 6px;
}
.stat-card.stat-not-invited .stat-value { color: #e74c3c; }
.stat-card.stat-valid .stat-value { color: #2ecc71; }
.stat-card.stat-invalid .stat-value { color: #f1c40f; }
.stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

/* 约课率卡片 */
.rate-card {
  background: rgba(20, 20, 30, 0.6);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  border: 1px solid rgba(218, 165, 32, 0.15);
  text-align: center;
}
.rate-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 8px;
}
.rate-label {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}
.rate-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}
.rate-value {
  display: block;
  font-size: 42px;
  font-weight: 700;
  margin-bottom: 12px;
}
.rate-high { color: #2ecc71; }
.rate-medium { color: #f1c40f; }
.rate-low { color: #e74c3c; }
.rate-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}
.rate-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
  background: linear-gradient(90deg, #d4af37, #ffd700);
}
.rate-detail-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

/* 待确认提示 */
.pending-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(241, 196, 15, 0.08);
  border-radius: 10px;
  margin-bottom: 16px;
  border: 1px solid rgba(241, 196, 15, 0.15);
}
.pending-icon { font-size: 16px; }
.pending-text { font-size: 13px; color: rgba(241, 196, 15, 0.8); }

/* 未约（无效）助教一览 */
.missed-section {
  background: rgba(20, 20, 30, 0.6);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(218, 165, 32, 0.1);
}
.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.section-title {
  font-size: 15px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}
.section-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}
.empty-missed {
  padding: 30px 0;
  text-align: center;
}
.empty-text { font-size: 14px; color: rgba(255, 255, 255, 0.4); }

/* 漏约列表项 */
.missed-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.missed-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.missed-rank {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}
.missed-rank.rank-warning-1 { background: linear-gradient(135deg, #e74c3c, #c0392b); }
.missed-rank.rank-warning-2 { background: linear-gradient(135deg, #e74c3c, #c0392b); }
.missed-rank.rank-warning-3 { background: linear-gradient(135deg, #e74c3c, #c0392b); }
.rank-text { font-size: 14px; }
.missed-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(30, 30, 40, 0.5);
  border: 1px solid rgba(218, 165, 32, 0.2);
  flex-shrink: 0;
}
.missed-info { flex: 1; }
.missed-name {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}
.missed-count {
  text-align: right;
  flex-shrink: 0;
}
.count-num {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: #e74c3c;
}
.count-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}
</style>
