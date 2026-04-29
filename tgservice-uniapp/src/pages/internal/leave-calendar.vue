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
          <view class="date-cell" v-for="(cell, ci) in row" :key="ci" :class="{ empty: !cell.day, today: cell.isToday, clickable: cell.day && cell.count > 0 }" @click="onDateClick(cell, true)">
            <text class="date-number" v-if="cell.day">{{ cell.day }}</text>
            <view class="date-badge" v-if="cell.day && cell.count > 0" :class="{ past: cell.isPast }">
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
          <view class="date-cell" v-for="(cell, ci) in row" :key="ci" :class="{ empty: !cell.day, clickable: cell.day && cell.count > 0 }" @click="onDateClick(cell, false)">
            <text class="date-number" v-if="cell.day">{{ cell.day }}</text>
            <view class="date-badge" v-if="cell.day && cell.count > 0" :class="{ past: cell.isPast }">
              <text class="badge-number">{{ cell.count }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 说明 -->
    <view class="notice-section">
      <text class="notice-text">角标数字表示当天已同意请假/休息的助教人数，点击可查看详情</text>
    </view>

    <!-- 详情弹窗 -->
    <view class="detail-modal" v-if="showDetailModal" @click="closeModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ selectedDate }} 休假详情</text>
          <view class="close-btn" @click="closeModal"><text>✕</text></view>
        </view>
        <view class="modal-body" v-if="dayDetailList.length > 0">
          <view class="detail-item" v-for="(item, idx) in dayDetailList" :key="idx">
            <view class="item-info">
              <text class="item-id">{{ item.employee_id }}</text>
              <text class="item-name">{{ item.stage_name }}</text>
            </view>
            <view class="item-type" :class="item.type === '请假' ? 'leave' : 'rest'">
              <text>{{ item.type }}</text>
            </view>
          </view>
        </view>
        <view class="modal-empty" v-else>
          <text>当天无请假/休息助教</text>
        </view>
      </view>
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

// 弹窗状态
const showDetailModal = ref(false)
const selectedDate = ref('')
const dayDetailList = ref([])

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
  
  // 计算今天（用于判断过去日期）
  const todayDate = today ? new Date(today) : null
  
  const grid = []
  let day = 1
  
  // 生成6行日历
  for (let row = 0; row < 6; row++) {
    const rowCells = []
    for (let col = 0; col < 7; col++) {
      if (row === 0 && col < startWeekday) {
        rowCells.push({ day: null, count: 0, isToday: false, isPast: false })
      } else if (day > daysInMonth) {
        rowCells.push({ day: null, count: 0, isToday: false, isPast: false })
      } else {
        const dateStr = `${yearMonth}-${String(day).padStart(2, '0')}`
        const count = daysData[dateStr] || 0
        const isToday = dateStr === today
        // 判断是否为过去日期
        const cellDate = new Date(dateStr)
        const isPast = todayDate && cellDate < todayDate && !isToday
        rowCells.push({ day, count, isToday, isPast })
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

// 点击日期
const onDateClick = async (cell, isCurrentMonth) => {
  if (!cell.day || cell.count === 0) return
  
  // 构建完整日期
  const yearMonth = isCurrentMonth 
    ? currentMonth.value.yearMonth 
    : nextMonth.value.yearMonth
  selectedDate.value = `${yearMonth}-${String(cell.day).padStart(2, '0')}`
  
  // 调用 API 获取详情
  try {
    uni.showLoading({ title: '加载中...' })
    const res = await api.leaveCalendar.getDayDetail(selectedDate.value)
    uni.hideLoading()
    if (res.success) {
      dayDetailList.value = res.data || []
      showDetailModal.value = true
    } else {
      uni.showToast({ title: res.error || '加载失败', icon: 'none' })
    }
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

// 关闭弹窗
const closeModal = () => {
  showDetailModal.value = false
  dayDetailList.value = []
}

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
.date-cell.clickable { cursor: pointer; }
.date-cell.today { background: rgba(212,175,55,0.2); border-radius: 8px; }
.date-number { font-size: 14px; color: #fff; }
.date-cell.today .date-number { color: #d4af37; font-weight: 600; }

.date-badge { position: absolute; top: 2px; right: 2px; min-width: 16px; height: 16px; background: #e74c3c; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 0 4px; }
.date-badge.past { background: rgba(255,255,255,0.3); }
.badge-number { font-size: 10px; color: #fff; font-weight: 600; }

.notice-section { margin: 16px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; }
.notice-text { font-size: 12px; color: rgba(255,255,255,0.6); text-align: center; }

/* 弹窗样式 */
.detail-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.modal-content { width: 85%; max-width: 360px; max-height: 60vh; background: rgba(20,20,30,0.95); border: 1px solid rgba(218,165,32,0.2); border-radius: 12px; overflow: hidden; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); }
.modal-title { font-size: 16px; color: #d4af37; font-weight: 600; }
.close-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); border-radius: 14px; }
.close-btn text { font-size: 14px; color: rgba(255,255,255,0.6); }
.modal-body { padding: 12px 16px; max-height: 45vh; overflow-y: auto; }
.detail-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.detail-item:last-child { border-bottom: none; }
.item-info { display: flex; gap: 12px; align-items: center; }
.item-id { font-size: 14px; color: rgba(255,255,255,0.7); }
.item-name { font-size: 14px; color: #fff; font-weight: 500; }
.item-type { padding: 4px 12px; border-radius: 4px; }
.item-type.leave { background: rgba(231,76,60,0.2); }
.item-type.leave text { color: #e74c3c; font-size: 12px; }
.item-type.rest { background: rgba(76,175,80,0.2); }
.item-type.rest text { color: #4caf50; font-size: 12px; }
.modal-empty { padding: 40px 20px; text-align: center; }
.modal-empty text { color: rgba(255,255,255,0.5); font-size: 14px; }
</style>