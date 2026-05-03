<template>
  <view class="page">
    <!-- 固定标题栏 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">‹</text>
        </view>
        <text class="header-title">奶茶果盘</text>
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
    <view v-else-if="statsData" class="stats-content">
      <!-- 任务进度卡片 -->
      <view class="progress-row">
        <!-- 奶茶任务 -->
        <view class="progress-card">
          <view class="progress-header">
            <text class="progress-icon">🧋</text>
            <text class="progress-title">奶茶任务</text>
          </view>
          <text class="progress-value" :class="teaColorClass">{{ statsData.tea.completed }}/{{ statsData.tea.target }}</text>
          <text class="progress-unit">杯</text>
          <view class="progress-bar">
            <view class="progress-bar-fill" :style="{ width: teaPercent + '%', backgroundColor: teaBarColor }"></view>
          </view>
          <text class="progress-percent" :class="teaColorClass">{{ statsData.tea.percent }}</text>
        </view>

        <!-- 果盘任务 -->
        <view class="progress-card">
          <view class="progress-header">
            <text class="progress-icon">🍉</text>
            <text class="progress-title">果盘任务</text>
          </view>
          <text class="progress-value" :class="fruitColorClass">{{ statsData.fruit.totalEquivalent }}/{{ statsData.fruit.target }}</text>
          <text class="progress-unit">个</text>
          <view class="progress-bar">
            <view class="progress-bar-fill" :style="{ width: fruitPercent + '%', backgroundColor: fruitBarColor }"></view>
          </view>
          <text class="progress-percent" :class="fruitColorClass">{{ statsData.fruit.percent }}</text>
        </view>
      </view>

      <!-- 奶茶订单明细 -->
      <view class="order-section">
        <view class="section-title-row">
          <text class="section-title">📋 奶茶订单明细</text>
          <text class="section-count" v-if="statsData.tea.orders.length > 0">共 {{ statsData.tea.completed }} 杯</text>
        </view>

        <view v-if="statsData.tea.orders.length === 0" class="empty-orders">
          <text class="empty-text">{{ currentPeriodLabel }}暂无奶茶订单</text>
        </view>

        <view v-else class="order-list">
          <view
            v-for="(order, idx) in statsData.tea.orders"
            :key="'tea-' + idx"
            class="order-item"
          >
            <view class="order-info">
              <text class="order-name">{{ order.product_name }}</text>
              <text class="order-no">{{ order.order_no }}</text>
            </view>
            <view class="order-meta">
              <text class="order-qty">x{{ order.quantity }}</text>
              <text class="order-time">{{ formatTime(order.created_at) }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 果盘订单明细 -->
      <view class="order-section">
        <view class="section-title-row">
          <text class="section-title">📋 果盘订单明细</text>
          <text class="section-count" v-if="statsData.fruit.orders.length > 0">
            {{ statsData.fruit.platterCount || 0 }}个果盘 + {{ statsData.fruit.singleFruitTotal || 0 }}份水果
          </text>
        </view>

        <view v-if="statsData.fruit.orders.length === 0" class="empty-orders">
          <text class="empty-text">{{ currentPeriodLabel }}暂无果盘订单</text>
        </view>

        <view v-else class="order-list">
          <view
            v-for="(order, idx) in statsData.fruit.orders"
            :key="'fruit-' + idx"
            class="order-item"
          >
            <view class="order-info">
              <text class="order-name">
                {{ order.product_name }}
                <text v-if="!order.is_platter" class="fruit-equivalent">(≈{{ order.fruit_equivalent }}个果盘)</text>
              </text>
              <text class="order-no">{{ order.order_no }}</text>
            </view>
            <view class="order-meta">
              <text class="order-qty">x{{ order.quantity }}</text>
              <text class="order-time">{{ formatTime(order.created_at) }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 无数据 -->
    <view v-else class="no-data">
      <text class="no-data-icon">📭</text>
      <text class="no-data-text">暂无统计数据</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api, { getDeviceFingerprint } from '@/utils/api.js'

const statusBarHeight = ref(0)
const loading = ref(false)
const currentPeriod = ref('this-month')
const statsData = ref(null)
const dateRange = ref('')

const periodTabs = [
  { label: '本月', value: 'this-month' },
  { label: '上月', value: 'last-month' }
]

const currentPeriodLabel = computed(() => {
  return currentPeriod.value === 'this-month' ? '本月' : '上月'
})

// 奶茶进度条百分比
const teaPercent = computed(() => {
  if (!statsData.value) return 0
  const percent = (statsData.value.tea.completed / statsData.value.tea.target) * 100
  return Math.min(percent, 100)
})

// 奶茶颜色
const teaColorClass = computed(() => {
  const percent = teaPercent.value
  if (percent >= 100) return 'color-complete'
  if (percent >= 50) return 'color-progress'
  return 'color-incomplete'
})

const teaBarColor = computed(() => {
  const percent = teaPercent.value
  if (percent >= 100) return '#4CAF50'
  if (percent >= 50) return '#FF9800'
  return '#F44336'
})

// 果盘进度条百分比（使用精确小数）
const fruitPercent = computed(() => {
  if (!statsData.value) return 0
  const percent = (statsData.value.fruit.totalEquivalent / statsData.value.fruit.target) * 100
  return Math.min(percent, 100)
})

// 果盘颜色
const fruitColorClass = computed(() => {
  const percent = fruitPercent.value
  if (percent >= 100) return 'color-complete'
  if (percent >= 50) return 'color-progress'
  return 'color-incomplete'
})

const fruitBarColor = computed(() => {
  const percent = fruitPercent.value
  if (percent >= 100) return '#4CAF50'
  if (percent >= 50) return '#FF9800'
  return '#F44336'
})

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return '-'
  // 格式：2026-05-01 14:30:00 → 05-01 14:30
  const parts = timeStr.split(' ')
  if (parts.length < 2) return timeStr
  const datePart = parts[0].substring(5) // 取 MM-DD
  const timePart = parts[1].substring(0, 5) // 取 HH:MM
  return `${datePart} ${timePart}`
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
  statsData.value = null
  dateRange.value = ''

  try {
    const deviceFingerprint = getDeviceFingerprint()
    const res = await api.getTeaFruitMyStats(currentPeriod.value, deviceFingerprint)
    if (res.success && res.data) {
      statsData.value = res.data
      dateRange.value = res.data.date_range
    } else {
      uni.showToast({ title: res.error || '加载失败', icon: 'none' })
    }
  } catch (e) {
    console.error('加载奶茶果盘统计失败:', e)
    uni.showToast({ title: '加载失败', icon: 'none' })
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
  if (statsData.value) {
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

/* 进度卡片行 */
.stats-content { padding: 0 16px; }
.progress-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.progress-card {
  flex: 1;
  background: rgba(20, 20, 30, 0.6);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  border: 1px solid rgba(218, 165, 32, 0.1);
}
.progress-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-bottom: 10px;
}
.progress-icon { font-size: 20px; }
.progress-title {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}
.progress-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 2px;
}
.progress-unit {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  display: block;
  margin-bottom: 10px;
}
.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}
.progress-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}
.progress-percent {
  font-size: 13px;
  font-weight: 500;
}

/* 颜色样式 */
.color-complete { color: #4CAF50; }
.color-progress { color: #FF9800; }
.color-incomplete { color: #F44336; }

/* 订单明细 */
.order-section {
  background: rgba(20, 20, 30, 0.6);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
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
.empty-orders {
  padding: 20px 0;
  text-align: center;
}
.empty-text { font-size: 14px; color: rgba(255, 255, 255, 0.4); }

/* 订单列表 */
.order-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.order-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.order-info {
  flex: 1;
}
.order-name {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}
.fruit-equivalent {
  font-size: 12px;
  color: #d4af37;
  margin-left: 4px;
}
.order-no {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  display: block;
  margin-top: 2px;
}
.order-meta {
  text-align: right;
  flex-shrink: 0;
}
.order-qty {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
  display: block;
}
.order-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  display: block;
  margin-top: 2px;
}
</style>