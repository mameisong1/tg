<template>
  <view class="page">
    <!-- 固定标题栏 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">打卡审查</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 日期班次切换 -->
    <view class="date-shift-tabs">
      <view class="date-shift-btn" :class="{ active: currentDate === 'today' && currentShift === '早班' }"
            @click="selectDateShift('today', '早班')">
        <text>今天-早班</text>
      </view>
      <view class="date-shift-btn" :class="{ active: currentDate === 'today' && currentShift === '晚班' }"
            @click="selectDateShift('today', '晚班')">
        <text>今天-晚班</text>
      </view>
      <view class="date-shift-btn" :class="{ active: currentDate === 'yesterday' && currentShift === '早班' }"
            @click="selectDateShift('yesterday', '早班')">
        <text>昨天-早班</text>
      </view>
      <view class="date-shift-btn" :class="{ active: currentDate === 'yesterday' && currentShift === '晚班' }"
            @click="selectDateShift('yesterday', '晚班')">
        <text>昨天-晚班</text>
      </view>
    </view>

    <!-- 审查提示 -->
    <view class="review-tips">
      <view class="tip-item">
        <text class="tip-icon">📌</text>
        <text class="tip-text">请审查打卡时间和截图时间是否一致</text>
      </view>
      <view class="tip-item">
        <text class="tip-icon">⚠️</text>
        <text class="tip-text">迟到人员请按迟到处罚规则处理</text>
      </view>
    </view>

    <!-- 打卡记录列表 -->
    <view class="attendance-list">
      <view v-if="records.length === 0" class="empty-tip">
        <text>暂无打卡记录</text>
      </view>
      <view v-for="(record, index) in records" :key="record.id || index" class="record-card">
        <view class="record-header">
          <text class="record-id">{{ record.employee_id }}号</text>
          <text class="record-name">{{ record.stage_name }}</text>
          <text class="record-shift">{{ record.shift }}</text>
          <!-- 迟到状态徽章放在header末尾 -->
          <view class="late-badge" :class="{ 'is-late': record.is_late === 1 }">
            <text>{{ record.is_late_text }}</text>
          </view>
        </view>
        <!-- 左右布局：文字信息 + 图片 -->
        <view class="record-content">
          <!-- 左侧文字信息 -->
          <view class="record-info">
            <view class="record-row">
              <text class="label">上班时间:</text>
              <text class="value">{{ formatTime(record.clock_in_time) || '-' }}</text>
            </view>
            <view class="record-row">
              <text class="label">下班时间:</text>
              <text class="value">{{ formatTime(record.clock_out_time) || '-' }}</text>
            </view>
            <view class="record-row dingtalk-row">
              <text class="label dingtalk-label">钉钉上班:</text>
              <text class="value dingtalk-value">{{ formatTime(record.dingtalk_in_time) || '-' }}</text>
            </view>
            <view class="record-row dingtalk-row">
              <text class="label dingtalk-label">钉钉下班:</text>
              <text class="value dingtalk-value">{{ formatTime(record.dingtalk_out_time) || '-' }}</text>
            </view>
            <view class="record-row">
              <text class="label">加班小时:</text>
              <text class="value">{{ record.overtime_hours }}小时</text>
            </view>
          </view>
          <!-- 右侧打卡照片 -->
          <view class="record-photo" v-if="record.clock_in_photo">
            <image :src="record.clock_in_photo" mode="aspectFill" class="photo-img" @click="previewPhoto(record.clock_in_photo)" />
          </view>
        </view>
        <!-- 审查操作按钮 -->
        <view v-if="record.is_reviewed === 0" class="review-action">
          <view class="review-btn" @click="handleMarkReviewed(record)">
            <text>审查完毕</text>
          </view>
        </view>
        <view v-else class="review-done">
          <text class="done-text">✓ 已审查</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api.js'

const statusBarHeight = ref(0)
const currentDate = ref('today')
const currentShift = ref('早班')
const records = ref([])

// 格式化时间（只显示时:分）
const formatTime = (timeStr) => {
  if (!timeStr) return ''
  // 格式：YYYY-MM-DD HH:MM:SS
  const parts = timeStr.split(' ')
  if (parts.length === 2) {
    return parts[1].substring(0, 5) // 只取 HH:MM
  }
  return timeStr
}

// 获取日期字符串
const getDateStr = (dateType) => {
  const now = new Date()
  if (dateType === 'yesterday') {
    now.setDate(now.getDate() - 1)
  }
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 选择日期班次
const selectDateShift = async (dateType, shift) => {
  currentDate.value = dateType
  currentShift.value = shift
  await loadRecords()
}

// 加载打卡记录
const loadRecords = async () => {
  try {
    uni.showLoading({ title: '加载中...' })
    const dateStr = getDateStr(currentDate.value)
    const result = await api.attendanceReview.getList({ date: dateStr, shift: currentShift.value })
    records.value = result.data || []
    uni.hideLoading()
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '加载失败', icon: 'none' })
  }
}

// 标记审查完毕
const handleMarkReviewed = async (record) => {
  uni.showModal({
    title: '确认',
    content: '确定标记此条打卡记录为已审查吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '处理中...' })
          await api.attendanceReview.markReviewed(record.id)
          uni.hideLoading()
          uni.showToast({ title: '已标记', icon: 'success' })
          // 重新加载列表
          await loadRecords()
        } catch (e) {
          uni.hideLoading()
          uni.showToast({ title: e.error || '操作失败', icon: 'none' })
        }
      }
    }
  })
}

// 预览照片
const previewPhoto = (url) => {
  uni.previewImage({ urls: [url] })
}

const goBack = () => {
  uni.navigateBack()
}

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  loadRecords()
})
</script>

<style scoped>
.page { min-height: 100vh; background: #1a1a2e; padding-bottom: 40px; }
.fixed-header { position: fixed; top: 0; left: 0; right: 0; z-index: 999; background: #1a1a2e; }
.status-bar-bg { background: #1a1a2e; }
.header-content { height: 44px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; }
.back-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.back-icon { font-size: 28px; color: #FFD700; }
.back-placeholder { width: 32px; }
.header-title { font-size: 17px; font-weight: 600; color: #FFD700; letter-spacing: 2px; }
.header-placeholder { background: #1a1a2e; }

/* 日期班次切换 */
.date-shift-tabs { display: flex; gap: 8px; padding: 16px; flex-wrap: wrap; }
.date-shift-btn {
  padding: 10px 16px;
  border-radius: 8px;
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6);
  font-size: 14px;
}
.date-shift-btn.active {
  background: rgba(218,165,32,0.3);
  color: #FFD700;
  font-weight: 600;
}

/* 审查提示 */
.review-tips { margin: 0 16px 16px; padding: 12px; background: rgba(255,193,7,0.1); border: 1px solid rgba(255,193,7,0.3); border-radius: 10px; }
.tip-item { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.tip-item:last-child { margin-bottom: 0; }
.tip-icon { font-size: 14px; }
.tip-text { font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.4; }

/* 打卡记录列表 */
.attendance-list { padding: 0 16px; }
.empty-tip { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.4); }
.record-card {
  background: rgba(255,255,255,0.05); border-radius: 12px; padding: 12px 16px; margin-bottom: 12px; }
.record-header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.record-id { color: #FFD700; font-weight: bold; font-size: 14px; }
.record-name { color: #fff; font-size: 14px; }
.record-shift { color: rgba(255,255,255,0.5); font-size: 12px; }

/* 左右布局 */
.record-content { display: flex; gap: 12px; }
.record-info { flex: 1; display: flex; flex-direction: column; gap: 5px; }
.record-row { display: flex; align-items: center; }
.label { color: rgba(255,255,255,0.5); width: 70px; font-size: 12px; }
.value { color: #fff; font-size: 13px; }

/* 钉钉时间样式 */
.dingtalk-row { background: rgba(255,165,0,0.05); border-radius: 4px; padding: 2px 4px; }
.dingtalk-label { color: rgba(255,165,0,0.7); }
.dingtalk-value { color: #FFA500; font-weight: 500; }

/* 打卡照片 */
.record-photo { flex-shrink: 0; }
.photo-img { width: 60px; height: 60px; border-radius: 6px; }

/* 迟到状态徽章 */
.late-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-left: auto; }
.late-badge.is-late { background: rgba(231,76,60,0.2); color: #e74c3c; }
.late-badge:not(.is-late) { background: rgba(46,204,113,0.2); color: #2ecc71; }

/* 审查操作按钮 */
.review-action { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); }
.review-btn { height: 32px; background: rgba(46,204,113,0.2); border: 1px solid rgba(46,204,113,0.3); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.review-btn text { font-size: 13px; color: #2ecc71; font-weight: 600; }
.review-done { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center; }
.done-text { font-size: 12px; color: rgba(46,204,113,0.6); }
</style>
