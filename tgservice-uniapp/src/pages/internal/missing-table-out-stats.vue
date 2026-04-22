<template>
  <view class="page">
    <!-- 固定头部 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">漏单统计</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 周期筛选标签 -->
    <view class="period-section">
      <view class="period-tabs">
        <view
          v-for="tab in periodTabs"
          :key="tab.value"
          class="period-tab"
          :class="{ active: currentPeriodValue === tab.value }"
          @click="switchPeriod(tab.value)"
        >
          <text class="period-tab-text">{{ tab.label }}</text>
        </view>
      </view>
    </view>

    <!-- 统计卡片 -->
    <view class="stats-card" v-if="statsData">
      <view class="stat-item">
        <text class="stat-value">{{ statsData.total_coaches }}</text>
        <text class="stat-label">漏单助教</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value">{{ statsData.total_missing }}</text>
        <text class="stat-label">漏单总数</text>
      </view>
    </view>

    <!-- 助教列表 -->
    <view class="list-section" v-if="coachList.length > 0">
      <view class="coach-item" v-for="(coach, index) in coachList" :key="coach.coach_no"
            @click="showDetail(coach)">
        <view class="coach-info">
          <text class="coach-rank-icon" v-if="index === 0">🚨</text>
          <text class="coach-rank-icon" v-else-if="index < 3">⚠️</text>
          <text class="coach-empid">{{ coach.employee_id || '-' }}</text>
          <text class="coach-name">{{ coach.stage_name || '未知' }}</text>
        </view>
        <view class="coach-count">
          <text class="count-num">{{ coach.missing_count }}</text>
          <text class="count-unit">单</text>
          <text class="arrow">❯</text>
        </view>
      </view>
    </view>
    <view class="empty" v-else-if="!loading">
      <text class="empty-icon">✅</text>
      <text class="empty-text">该周期无漏单</text>
    </view>

    <!-- 明细弹框 -->
    <view class="modal-overlay" v-if="showModal" @click="closeModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">
            {{ detailData.stage_name }} ({{ detailData.employee_id }}) 漏单明细
          </text>
          <view class="modal-close" @click="closeModal"><text>✕</text></view>
        </view>
        <view class="modal-body" v-if="detailData.details.length > 0">
          <view class="detail-item" v-for="item in detailData.details" :key="item.id">
            <view class="detail-row">
              <text class="detail-date">{{ item.table_date }}</text>
              <text class="detail-time">{{ item.table_time }}</text>
              <text class="detail-table">{{ item.table_no }}</text>
            </view>
            <view class="detail-status">
              <text class="status-label">下桌单：</text>
              <text class="status-none">无 ❌</text>
            </view>
          </view>
        </view>
        <view class="modal-empty" v-else>
          <text>暂无明细数据</text>
        </view>
      </view>
    </view>

    <view class="loading" v-if="loading && !statsData">
      <text>加载中...</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { missingTableOutOrders } from '@/utils/api.js'

const statusBarHeight = ref(0)
const loading = ref(false)
const statsData = ref(null)
const coachList = ref([])

const showModal = ref(false)
const detailData = ref({ details: [] })

const periodTabs = [
  { label: '昨天', value: 'yesterday' },
  { label: '前天', value: 'beforeYesterday' },
  { label: '本月', value: 'thisMonth' },
  { label: '上月', value: 'lastMonth' }
]
const currentPeriodValue = ref('yesterday')

const goBack = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/member/member' })
}

const switchPeriod = (value) => {
  currentPeriodValue.value = value
  loadStats()
}

const loadStats = async () => {
  loading.value = true
  try {
    const res = await missingTableOutOrders.getStats({ period: currentPeriodValue.value })
    if (res.success) {
      statsData.value = res.data
      coachList.value = res.data.list || []
    }
  } catch (err) {
    uni.showToast({ title: err.error || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const showDetail = async (coach) => {
  try {
    const res = await missingTableOutOrders.getDetail({
      period: currentPeriodValue.value,
      coach_no: coach.coach_no
    })
    if (res.success) {
      detailData.value = res.data
      showModal.value = true
    }
  } catch (err) {
    uni.showToast({ title: err.error || '加载明细失败', icon: 'none' })
  }
}

const closeModal = () => {
  showModal.value = false
  detailData.value = { details: [] }
}

onMounted(() => {
  const sys = uni.getSystemInfoSync()
  statusBarHeight.value = sys.statusBarHeight || 20
  loadStats()
})
</script>

<style scoped>
.page {
  background: #0a0a0f;
  color: #e8e8e8;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* 固定头部 */
.fixed-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.status-bar-bg {
  background: #0a0a0f;
}

.header-content {
  height: 44px;
  background: #0a0a0f;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid #1a1a2e;
}

.back-btn {
  width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 24px;
  color: #e8e8e8;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: #e8e8e8;
}

.back-placeholder {
  width: 40px;
}

.header-placeholder {
  background: #0a0a0f;
}

/* 周期筛选标签 */
.period-section {
  padding: 16px 16px 8px;
}
.period-tabs {
  display: flex;
  gap: 10px;
  background: rgba(20, 20, 30, 0.6);
  border-radius: 12px;
  padding: 6px;
  border: 1px solid rgba(79, 195, 247, 0.15);
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
  background: linear-gradient(135deg, #1a73e8, #4fc3f7);
}
.period-tab-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
}
.period-tab.active .period-tab-text {
  color: #fff;
  font-weight: 600;
}

/* 统计卡片 */
.stats-card {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 12px 16px;
  padding: 16px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #4fc3f7;
}

.stat-label {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: #333;
  margin: 0 24px;
}

/* 助教列表 */
.list-section {
  margin: 0 16px;
}

.coach-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: #111118;
  border-radius: 10px;
  margin-bottom: 8px;
}

.coach-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.coach-rank-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.coach-empid {
  font-size: 14px;
  color: #4fc3f7;
  font-weight: 500;
}

.coach-name {
  font-size: 14px;
  color: #ccc;
}

.coach-count {
  display: flex;
  align-items: center;
  gap: 4px;
}

.count-num {
  font-size: 20px;
  font-weight: 700;
  color: #ff6b6b;
}

.count-unit {
  font-size: 12px;
  color: #888;
  margin-right: 8px;
}

.arrow {
  font-size: 16px;
  color: #555;
}

/* 空状态 */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-text {
  font-size: 14px;
  color: #666;
}

/* 加载状态 */
.loading {
  text-align: center;
  padding: 40px 0;
  color: #666;
  font-size: 14px;
}

/* 弹框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-content {
  background: #111118;
  border-radius: 12px;
  width: 100%;
  max-width: 400px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #1a1a2e;
}

.modal-title {
  font-size: 14px;
  font-weight: 600;
  color: #e8e8e8;
}

.modal-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #1a1a2e;
}

.modal-close text {
  font-size: 14px;
  color: #888;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.detail-item {
  padding: 12px 0;
  border-bottom: 1px solid #1a1a2e;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.detail-date {
  font-size: 13px;
  color: #4fc3f7;
}

.detail-time {
  font-size: 13px;
  color: #e8e8e8;
}

.detail-table {
  font-size: 13px;
  color: #ffb347;
  font-weight: 500;
}

.detail-status {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-label {
  font-size: 12px;
  color: #666;
}

.status-none {
  font-size: 12px;
  color: #ff6b6b;
}

.modal-empty {
  padding: 40px 16px;
  text-align: center;
  color: #666;
  font-size: 14px;
}
</style>
