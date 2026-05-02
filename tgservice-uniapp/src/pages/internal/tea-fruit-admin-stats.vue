<template>
  <view class="page">
    <!-- 固定标题栏 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">‹</text>
        </view>
        <text class="header-title">奶茶果盘统计</text>
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

    <!-- 汇总统计 -->
    <view v-if="summary" class="summary-section">
      <text class="summary-text">
        奶茶达标 {{ summary.tea_complete }}/{{ summary.total_coaches }} 人，
        果盘达标 {{ summary.fruit_complete }}/{{ summary.total_coaches }} 人，
        双达标 {{ summary.both_complete }} 人
      </text>
    </view>

    <!-- 加载状态 -->
    <view v-if="loading" class="loading-wrap">
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 数据内容 -->
    <view v-else-if="coachStats.length > 0" class="stats-content">
      <view class="coach-list">
        <view
          v-for="coach in coachStats"
          :key="coach.coach_no"
          class="coach-card"
          @click="viewDetail(coach)"
        >
          <view class="coach-header">
            <text class="coach-id">{{ coach.employee_id }}号</text>
            <text class="coach-name">{{ coach.stage_name }}</text>
          </view>

          <view class="task-row">
            <!-- 奶茶任务 -->
            <view class="task-item">
              <text class="task-icon">🧋</text>
              <text class="task-label">奶茶：</text>
              <text class="task-value" :class="coach.tea_status === 'complete' ? 'color-complete' : 'color-incomplete'">
                {{ coach.tea_completed }}/{{ coach.tea_target }}
              </text>
              <text class="task-status" :class="coach.tea_status === 'complete' ? 'status-complete' : 'status-incomplete'">
                {{ coach.tea_status === 'complete' ? '✅' : '🔴' }}
              </text>
            </view>

            <!-- 果盘任务 -->
            <view class="task-item">
              <text class="task-icon">🍉</text>
              <text class="task-label">果盘：</text>
              <text class="task-value" :class="coach.fruit_status === 'complete' ? 'color-complete' : 'color-incomplete'">
                {{ coach.fruit_totalEquivalent }}/{{ coach.fruit_target }}
              </text>
              <text class="task-status" :class="coach.fruit_status === 'complete' ? 'status-complete' : 'status-incomplete'">
                {{ coach.fruit_status === 'complete' ? '✅' : '🔴' }}
              </text>
            </view>
          </view>

          <view class="view-detail-row">
            <text class="view-detail-text">查看明细 →</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 无数据 -->
    <view v-else class="no-data">
      <text class="no-data-icon">📭</text>
      <text class="no-data-text">暂无助教数据</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'

const statusBarHeight = ref(0)
const loading = ref(false)
const currentPeriod = ref('this-month')
const coachStats = ref([])
const summary = ref(null)
const dateRange = ref('')

const periodTabs = [
  { label: '本月', value: 'this-month' },
  { label: '上月', value: 'last-month' }
]

// 切换时间周期
const switchPeriod = (period) => {
  if (period === currentPeriod.value) return
  currentPeriod.value = period
  loadData()
}

// 加载数据
const loadData = async () => {
  loading.value = true
  coachStats.value = []
  summary.value = null
  dateRange.value = ''

  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://tiangong.club/api'
    const res = await fetch(baseUrl + '/tea-fruit/admin-stats?period=' + currentPeriod.value, {
      headers: {
        'Authorization': 'Bearer ' + uni.getStorageSync('memberToken')
      }
    })
    const data = await res.json()
    if (data.success && data.data) {
      coachStats.value = data.data.coaches || []
      summary.value = data.data.summary || null
      dateRange.value = data.data.date_range
    } else {
      uni.showToast({ title: data.error || '加载失败', icon: 'none' })
    }
  } catch (e) {
    console.error('加载奶茶果盘管理统计失败:', e)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 查看明细
const viewDetail = (coach) => {
  uni.navigateTo({
    url: `/pages/internal/tea-fruit-detail?coach_no=${coach.coach_no}&period=${currentPeriod.value}`
  })
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
  if (coachStats.value.length > 0) {
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

/* 汇总统计 */
.summary-section {
  padding: 8px 16px 12px;
}
.summary-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
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

/* 助教列表 */
.stats-content { padding: 0 16px; }
.coach-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.coach-card {
  background: rgba(20, 20, 30, 0.6);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(218, 165, 32, 0.1);
}
.coach-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.coach-id {
  font-size: 16px;
  font-weight: 600;
  color: #d4af37;
}
.coach-name {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
}

/* 任务行 */
.task-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.task-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.task-icon { font-size: 16px; }
.task-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}
.task-value {
  font-size: 14px;
  font-weight: 600;
}
.task-status {
  font-size: 14px;
  margin-left: 4px;
}

/* 颜色样式 */
.color-complete { color: #4CAF50; }
.color-incomplete { color: #F44336; }
.status-complete { color: #4CAF50; }
.status-incomplete { color: #F44336; }

/* 查看明细 */
.view-detail-row {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  text-align: right;
}
.view-detail-text {
  font-size: 13px;
  color: #d4af37;
}
</style>