<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">助教休假日历</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 本月日历 -->
    <view class="calendar-section">
      <view class="calendar-title">
        <text class="title-text">{{ currentMonth.yearMonth }}</text>
      </view>
      <view class="calendar-grid">
        <view class="weekday-row">
          <view class="weekday-cell" v-for="d in weekdays" :key="d"><text>{{ d }}</text></view>
        </view>
        <view class="date-row" v-for="(row, ri) in currentMonthDays" :key="ri">
          <view class="date-cell" v-for="(cell, ci) in row" :key="ci" :class="{ empty: !cell.day, today: cell.isToday }">
            <text class="date-number" v-if="cell.day">{{ cell.day }}</text>
            <view class="date-badge" v-if="cell.day && cell.count > 0">
              <text class="badge-number">{{ cell.count }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 下月日历 -->
    <view class="calendar-section">
      <view class="calendar-title">
        <text class="title-text">{{ nextMonth.yearMonth }}</text>
      </view>
      <view class="calendar-grid">
        <view class="weekday-row">
          <view class="weekday-cell" v-for="d in weekdays" :key="d"><text>{{ d }}</text></view>
        </view>
        <view class="date-row" v-for="(row, ri) in nextMonthDays" :key="ri">
          <view class="date-cell" v-for="(cell, ci) in row" :key="ci" :class="{ empty: !cell.day }">
            <text class="date-number" v-if="cell.day">{{ cell.day }}</text>
            <view class="date-badge" v-if="cell.day && cell.count > 0">
              <text class="badge-number">{{ cell.count }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 说明 -->
    <view class="notice-section">
      <text class="notice-text">角标数字表示当天已同意请假/休息的助教人数</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/utils/api.js'
import errorReporter from '@/utils/error-reporter.js'

const statusBarHeight = ref(0)
const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const currentMonth = ref({ yearMonth: '', days: {} })
const nextMonth = ref({ yearMonth: '', days: {} })
const todayStr = ref('')

// 计算本月日历网格
const currentMonthDays = computed(() => {
  return generateCalendarGrid(currentMonth.value.yearMonth, currentMonth.value.days, todayStr.value)
})

// 计算下月日历网格
const nextMonthDays = computed(() => {
  return generateCalendarGrid(nextMonth.value.yearMonth, nextMonth.value.days, '')
})

// 生成日历网格
function generateCalendarGrid(yearMonth, daysData, today) {
  if (!yearMonth) return []
  
  const [year, month] = yearMonth.split('-')
  const firstDay = new Date(year, parseInt(month) - 1, 1)
  const lastDay = new Date(year, parseInt(month), 0)
  const daysInMonth = lastDay.getDate()
  const startWeekday = firstDay.getDay()
  
  const grid = []
  let day = 1
  
  // 生成6行日历
  for (let row = 0; row < 6; row++) {
    const rowCells = []
    for (let col = 0; col < 7; col++) {
      if (row === 0 && col < startWeekday) {
        rowCells.push({ day: null, count: 0, isToday: false })
      } else if (day > daysInMonth) {
        rowCells.push({ day: null, count: 0, isToday: false })
      } else {
        const dateStr = `${yearMonth}-${String(day).padStart(2, '0')}`
        const count = daysData[dateStr] || 0
        const isToday = dateStr === today
        rowCells.push({ day, count, isToday })
        day++
      }
    }
    grid.push(rowCells)
    if (day > daysInMonth) break
  }
  
  return grid
}

const loadCalendarStats = async () => {
  try {
    const res = await api.leaveCalendar.getStats()
    if (res.success) {
      currentMonth.value = res.data.currentMonth
      nextMonth.value = res.data.nextMonth
    } else {
      // 发送错误日志到后端
      errorReporter.track('leave-calendar-load-failed', { message: res.error || '加载失败' })
      uni.showToast({ title: '加载失败', icon: 'none' })
    }
  } catch (e) {
    // 发送错误日志到后端
    errorReporter.track('leave-calendar-load-exception', { message: e.message || String(e) })
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

// 注意：日志上报已统一使用 errorReporter.track()
// sendErrorLog 函数已移除

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
  statusBarHeight.value = systemInfo.statusBarHeight || 0
  
  // 获取今天日期
  const today = new Date()
  todayStr.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  
  loadCalendarStats()
})
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

.calendar-section { margin: 16px; background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; padding: 16px; }
.calendar-title { margin-bottom: 12px; text-align: center; }
.title-text { font-size: 16px; font-weight: 600; color: #d4af37; }

.calendar-grid { }
.weekday-row { display: flex; justify-content: space-around; margin-bottom: 8px; }
.weekday-cell { width: 14.28%; text-align: center; }
.weekday-cell text { font-size: 12px; color: rgba(255,255,255,0.5); }

.date-row { display: flex; justify-content: space-around; margin-bottom: 4px; }
.date-cell { width: 14.28%; height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; }
.date-cell.empty { }
.date-cell.today { background: rgba(212,175,55,0.2); border-radius: 8px; }
.date-number { font-size: 14px; color: #fff; }
.date-cell.today .date-number { color: #d4af37; font-weight: 600; }

.date-badge { position: absolute; top: 2px; right: 2px; min-width: 16px; height: 16px; background: #e74c3c; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 0 4px; }
.badge-number { font-size: 10px; color: #fff; font-weight: 600; }

.notice-section { margin: 16px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; }
.notice-text { font-size: 12px; color: rgba(255,255,255,0.6); text-align: center; }
</style>