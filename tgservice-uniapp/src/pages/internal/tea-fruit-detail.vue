<template>
  <view class="page">
    <!-- 固定标题栏 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">‹</text>
        </view>
        <text class="header-title">奶茶果盘明细</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 助教信息 -->
    <view v-if="coach" class="coach-info-section">
      <text class="coach-info-text">{{ coach.employee_id }}号 {{ coach.stage_name }}</text>
    </view>

    <!-- 类型切换 -->
    <view class="type-section">
      <view class="type-tabs">
        <view
          class="type-tab"
          :class="{ active: currentType === 'tea' }"
          @click="switchType('tea')"
        >
          <text class="type-tab-icon">🧋</text>
          <text class="type-tab-text">奶茶</text>
        </view>
        <view
          class="type-tab"
          :class="{ active: currentType === 'fruit' }"
          @click="switchType('fruit')"
        >
          <text class="type-tab-icon">🍉</text>
          <text class="type-tab-text">果盘</text>
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
    <view v-else-if="detailData" class="stats-content">
      <!-- 进度卡片 -->
      <view class="progress-card">
        <view class="progress-header">
          <text class="progress-icon">{{ currentType === 'tea' ? '🧋' : '🍉' }}</text>
          <text class="progress-title">{{ currentType === 'tea' ? '奶茶任务' : '果盘任务' }}</text>
        </view>
        <text class="progress-value" :class="progressColorClass">
          {{ currentType === 'tea' ? detailData.completed : detailData.totalEquivalent }}/{{ detailData.target }}
        </text>
        <text class="progress-unit">{{ currentType === 'tea' ? '杯' : '个' }}</text>
        <view class="progress-bar">
          <view class="progress-bar-fill" :style="{ width: progressPercent + '%', backgroundColor: progressBarColor }"></view>
        </view>
        <text class="progress-percent" :class="progressColorClass">{{ detailData.percent }}</text>
        <text class="progress-status" :class="progressColorClass">
          {{ detailData.status === 'complete' ? '✅ 已达标' : '🔴 未达标' }}
        </text>
      </view>

      <!-- 订单明细 -->
      <view class="order-section">
        <view class="section-title-row">
          <text class="section-title">📋 订单明细</text>
          <text class="section-count" v-if="detailData.orders.length > 0">
            {{ currentType === 'tea' ? `共 ${detailData.completed} 杯` : `${detailData.orders.length} 笔订单` }}
          </text>
        </view>

        <view v-if="detailData.orders.length === 0" class="empty-orders">
          <text class="empty-text">暂无订单记录</text>
        </view>

        <view v-else class="order-list">
          <view
            v-for="(order, idx) in detailData.orders"
            :key="idx"
            class="order-item"
          >
            <view class="order-info">
              <text class="order-name">
                {{ order.product_name }}
                <text v-if="currentType === 'fruit' && !order.is_platter" class="fruit-equivalent">
                  (≈{{ order.fruit_equivalent }}个果盘)
                </text>
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
      <text class="no-data-text">暂无数据</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const statusBarHeight = ref(0)
const loading = ref(false)
const coachNo = ref('')
const currentPeriod = ref('this-month')
const currentType = ref('tea')
const coach = ref(null)
const detailData = ref(null)
const dateRange = ref('')

// 进度百分比
const progressPercent = computed(() => {
  if (!detailData.value) return 0
  const completed = currentType.value === 'tea' 
    ? detailData.value.completed 
    : detailData.value.totalEquivalent
  const percent = (completed / detailData.value.target) * 100
  return Math.min(percent, 100)
})

// 进度颜色
const progressColorClass = computed(() => {
  const percent = progressPercent.value
  if (percent >= 100) return 'color-complete'
  if (percent >= 50) return 'color-progress'
  return 'color-incomplete'
})

const progressBarColor = computed(() => {
  const percent = progressPercent.value
  if (percent >= 100) return '#4CAF50'
  if (percent >= 50) return '#FF9800'
  return '#F44336'
})

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return '-'
  const parts = timeStr.split(' ')
  if (parts.length < 2) return timeStr
  const datePart = parts[0].substring(5)
  const timePart = parts[1].substring(0, 5)
  return `${datePart} ${timePart}`
}

// 切换类型
const switchType = (type) => {
  if (type === currentType.value) return
  currentType.value = type
  loadData()
}

// 加载数据
const loadData = async () => {
  loading.value = true
  detailData.value = null

  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://tiangong.club/api'
    const res = await fetch(
      baseUrl + '/tea-fruit/coach-detail?coach_no=${coachNo.value}&period=${currentPeriod.value}&type=${currentType.value}',
      {
        headers: {
          'Authorization': 'Bearer ' + uni.getStorageSync('memberToken')
        }
      }
    )
    const data = await res.json()
    if (data.success && data.data) {
      coach.value = data.data.coach
      detailData.value = data.data
      dateRange.value = data.data.date_range
    } else {
      uni.showToast({ title: data.error || '加载失败', icon: 'none' })
    }
  } catch (e) {
    console.error('加载明细失败:', e)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 返回
const goBack = () => {
  uni.navigateBack()
}

onLoad((options) => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20

  // 从 URL 参数获取
  coachNo.value = options.coach_no || ''
  currentPeriod.value = options.period || 'this-month'
  currentType.value = options.type || 'tea'

  if (coachNo.value) {
    loadData()
  } else {
    uni.showToast({ title: '缺少助教信息', icon: 'none' })
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

/* 助教信息 */
.coach-info-section {
  padding: 12px 16px 8px;
}
.coach-info-text {
  font-size: 15px;
  color: #d4af37;
  font-weight: 500;
}

/* 类型切换 */
.type-section {
  padding: 8px 16px 12px;
}
.type-tabs {
  display: flex;
  gap: 12px;
  background: rgba(20, 20, 30, 0.6);
  border-radius: 12px;
  padding: 8px;
  border: 1px solid rgba(218, 165, 32, 0.1);
}
.type-tab {
  flex: 1;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 8px;
  transition: all 0.2s;
}
.type-tab.active {
  background: linear-gradient(135deg, #d4af37, #ffd700);
}
.type-tab-icon { font-size: 18px; }
.type-tab-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}
.type-tab.active .type-tab-text {
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

/* 进度卡片 */
.stats-content { padding: 0 16px; }
.progress-card {
  background: rgba(20, 20, 30, 0.6);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  margin-bottom: 16px;
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
  font-size: 15px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}
.progress-value {
  display: block;
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 2px;
}
.progress-unit {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  display: block;
  margin-bottom: 12px;
}
.progress-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}
.progress-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}
.progress-percent {
  font-size: 14px;
  font-weight: 500;
  display: block;
  margin-bottom: 6px;
}
.progress-status {
  font-size: 14px;
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