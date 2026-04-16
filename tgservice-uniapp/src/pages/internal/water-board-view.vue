<template>
  <view class="page">
    <!-- 固定标题栏 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">水牌查看</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 状态筛选按钮 -->
    <view class="filter-bar">
      <view class="filter-item" :class="{ active: activeFilter === '' }" @click="activeFilter = ''">
        <text class="filter-label">全部</text>
        <text class="filter-count" v-if="getCount('') > 0">{{ getCount('') }}</text>
      </view>
      <!-- 工作状态按钮：始终显示 -->
      <view class="filter-item" v-for="s in workStatusList" :key="s" :class="{ active: activeFilter === s }" @click="activeFilter = s">
        <text class="filter-label">{{ s }}</text>
        <text class="filter-count" v-if="getCount(s) > 0">{{ getCount(s) }}</text>
      </view>
      <!-- 非工作状态切换按钮 -->
      <view class="filter-item filter-toggle" @click="offStatusVisible = !offStatusVisible">
        <text class="filter-label">{{ offStatusVisible ? '收起 ▴' : '展开 ▾' }}</text>
      </view>
      <!-- 非工作状态按钮：点击展开 -->
      <template v-if="offStatusVisible">
        <view class="filter-item" v-for="s in offStatusList" :key="s" :class="{ active: activeFilter === s }" @click="activeFilter = s">
          <text class="filter-label">{{ s }}</text>
          <text class="filter-count" v-if="getCount(s) > 0">{{ getCount(s) }}</text>
        </view>
      </template>
    </view>

    <!-- 按状态分组显示 -->
    <view class="board-list" v-if="groupedBoards.length > 0">
      <view class="status-section" v-for="group in filteredBoards" :key="group.status" :data-status="group.status" :class="{ 'free-section': freeStatuses.includes(group.status) }">
        <view class="section-header" @click="showSectionExpand(group.status, group.coaches)">
          <text class="section-title" :style="{ color: statusColors[group.status] || '#d4af37' }">{{ group.status }}</text>
          <text class="section-count">{{ group.coaches.length }}人 ⛶</text>
        </view>
        <view class="coach-grid">
          <!-- 正常助教 -->
          <view class="coach-card" v-for="coach in group.coaches.filter(c => !c._offDuty)" :key="coach.coach_no">
            <image class="coach-avatar" :src="getAvatar(coach)" mode="aspectFill" />
            <text class="coach-id">{{ coach.employee_id || coach.coach_no }}</text>
            <text class="coach-name">{{ coach.stage_name }}</text>
          </view>
        </view>
        <!-- 下班助教单独一行 -->
        <view class="coach-grid off-duty-row" v-if="group.coaches.some(c => c._offDuty)">
          <view class="coach-card coach-card--offduty"
                v-for="coach in group.coaches.filter(c => c._offDuty)"
                :key="'off-' + coach.coach_no">
            <!-- 无头像 -->
            <text class="coach-id">{{ coach.employee_id || coach.coach_no }}</text>
            <text class="coach-name">{{ coach.stage_name }}</text>
            <!-- 加班小时数 -->
            <text class="overtime-hours"
                  v-if="getOvertimeHours(coach) > 0">
              {{ getOvertimeHours(coach) }}h
            </text>
          </view>
        </view>
      </view>
    </view>
    <view class="empty" v-else><text>暂无数据</text></view>

    <!-- 分段放大弹窗 -->
    <view class="expand-overlay" v-if="showExpand" @click="closeExpand">
      <view class="expand-box" @click.stop>
        <view class="expand-header">
          <text class="expand-title" :style="{ color: expandColor }">{{ expandStatus }}</text>
          <text class="expand-count">{{ expandCoaches.length }}人</text>
        </view>
        <scroll-view class="expand-content" scroll-y>
          <view class="expand-grid">
            <!-- 正常助教 -->
            <view class="expand-card" v-for="coach in expandCoaches.filter(c => !c._offDuty)" :key="coach.coach_no">
              <image class="expand-avatar" :src="getAvatar(coach)" mode="aspectFill" />
              <text class="expand-id">{{ coach.employee_id || coach.coach_no }}</text>
              <text class="expand-name">{{ coach.stage_name }}</text>
            </view>
          </view>
          <!-- 下班助教单独一行 -->
          <view class="expand-grid off-duty-row" v-if="expandCoaches.some(c => c._offDuty)">
            <view class="expand-card expand-card--offduty"
                  v-for="coach in expandCoaches.filter(c => c._offDuty)"
                  :key="'off-' + coach.coach_no">
              <text class="expand-id">{{ coach.employee_id || coach.coach_no }}</text>
              <text class="expand-name">{{ coach.stage_name }}</text>
              <text class="overtime-hours"
                    v-if="getOvertimeHours(coach) > 0">
                {{ getOvertimeHours(coach) }}h
              </text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- #ifdef H5 -->
    <!-- 全屏悬浮按钮 -->
    <view class="fullscreen-btn" :style="{ left: floatPosition === 'left' ? '20px' : 'auto', right: floatPosition === 'right' ? '20px' : 'auto' }" @click="toggleFullscreen">
      <text>⛶</text>
    </view>
    <!-- #endif -->
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '@/utils/api-v2.js'

const statusBarHeight = ref(0)
const waterBoards = ref([])
const showExpand = ref(false)
const expandStatus = ref('')
const expandCoaches = ref([])
const expandColor = ref('#d4af37')
const activeFilter = ref('')
// 非工作状态筛选按钮折叠
const offStatusVisible = ref(false)

// #ifdef H5
const floatPosition = ref('left')
const isFullscreen = ref(false)
// #endif

const workStatusList = ['早班上桌', '早班空闲', '晚班上桌', '晚班空闲', '乐捐']
const offStatusList = ['休息', '公休', '请假', '早加班', '晚加班']
const statusList = [...workStatusList, ...offStatusList]
const freeStatuses = ['早班空闲', '晚班空闲']

// 加班小时数映射（phone -> hours）
const overtimeHoursMap = ref({})

const loadOvertimeHours = async () => {
  try {
    const res = await api.applications.getTodayApprovedOvertime()
    overtimeHoursMap.value = res.data || {}
  } catch (e) {
    // 静默失败，不影响水牌显示
  }
}

const getOvertimeHours = (coach) => {
  const key = coach.employee_id
  if (!key || !overtimeHoursMap.value[key]) return 0
  return overtimeHoursMap.value[key].hours || 0
}

const statusColors = {
  '早班上桌': '#3498db', '早班空闲': '#2ecc71', '晚班上桌': '#9b59b6', '晚班空闲': '#f1c40f',
  '早加班': '#e67e22', '晚加班': '#e74c3c', '休息': '#95a5a6', '公休': '#1abc9c',
  '请假': '#7f8c8d', '乐捐': '#f39c12', '下班': '#bdc3c7'
}

// ===== 自动刷新机制 =====
let refreshTimer = null
const REFRESH_INTERVAL = 30000 // 30秒

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20

  // #ifdef H5
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
  floatPosition.value = uni.getStorageSync('floatButtonPosition') || 'left'
  // #endif

  loadData()
  loadOvertimeHours()
  // 启动30秒自动刷新
  refreshTimer = setInterval(() => {
    loadData() // 静默刷新，不弹提示
  }, REFRESH_INTERVAL)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})

const loadData = async () => {
  try {
    const res = await api.waterBoards.getList()
    waterBoards.value = res.data || []
    // 同时刷新加班小时数
    await loadOvertimeHours()
  } catch (e) { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

// 筛选按钮人数统计
const statusCountMap = computed(() => {
  const map = {}
  statusList.forEach(s => { map[s] = 0 })
  waterBoards.value.forEach(board => {
    if (map[board.status] !== undefined) map[board.status]++
  })
  return map
})

const getCount = (status) => {
  if (!status) return waterBoards.value.length
  return statusCountMap.value[status] || 0
}

const groupedBoards = computed(() => {
  const groups = {}
  statusList.forEach(s => { groups[s] = [] })
  // 下班助教不参与独立分组，后续合并到空闲组
  
  waterBoards.value.forEach(b => {
    if (b.status === '下班') {
      // 根据班次合并到对应空闲组
      if (b.shift === '晚班') {
        groups['晚班空闲'].push({ ...b, _offDuty: true })
      } else {
        groups['早班空闲'].push({ ...b, _offDuty: true })
      }
    } else if (groups[b.status]) {
      groups[b.status].push({ ...b, _offDuty: false })
    }
  })
  
  // 排序：空闲组内，正常助教在前（按 clock_in_time 倒序），下班助教在后
  freeStatuses.forEach(s => {
    const normal = groups[s].filter(c => !c._offDuty)
    const offDuty = groups[s].filter(c => c._offDuty)
    
    normal.sort((a, b) => {
      const ta = a.clock_in_time ? new Date(a.clock_in_time + '+08:00').getTime() : 0
      const tb = b.clock_in_time ? new Date(b.clock_in_time + '+08:00').getTime() : 0
      return tb - ta
    })
    
    // 下班助教保持原有排序（按 updated_at 倒序）
    offDuty.sort((a, b) => {
      const ta = a.updated_at ? new Date(a.updated_at + '+08:00').getTime() : 0
      const tb = b.updated_at ? new Date(b.updated_at + '+08:00').getTime() : 0
      return tb - ta
    })
    
    groups[s] = [...normal, ...offDuty]
  })
  
  // 其他非空闲组排序（不变）
  statusList.filter(s => !freeStatuses.includes(s)).forEach(s => {
    groups[s].sort((a, b) => {
      const ta = a.updated_at ? new Date(a.updated_at + '+08:00').getTime() : 0
      const tb = b.updated_at ? new Date(b.updated_at + '+08:00').getTime() : 0
      return tb - ta
    })
  })
  
  return statusList.filter(s => groups[s].length > 0).map(s => ({ status: s, coaches: groups[s] }))
})

const filteredBoards = computed(() => {
  if (!activeFilter.value) return groupedBoards.value
  return groupedBoards.value.filter(g => g.status === activeFilter.value)
})

const getAvatar = (coach) => {
  if (coach.photos && coach.photos.length > 0) return coach.photos[0]
  return '/static/avatar-default.png'
}

const goBack = () => { 
  const pages = getCurrentPages()
  if (pages.length > 1) { uni.navigateBack() } 
  else { uni.switchTab({ url: '/pages/member/member' }) } 
}

const showSectionExpand = (status, coaches) => {
  expandStatus.value = status
  expandCoaches.value = coaches
  expandColor.value = statusColors[status] || '#d4af37'
  showExpand.value = true
}

const closeExpand = () => {
  showExpand.value = false
}

// #ifdef H5
const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    document.documentElement.requestFullscreen()
  }
}
// #endif
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

/* ===== 状态筛选（新设计） ===== */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  padding: 10px 14px;
  gap: 8px;
}
.filter-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  transition: all 0.2s;
}
.filter-item.active {
  background: rgba(212,175,55,0.15);
  border-color: rgba(212,175,55,0.4);
}
.filter-item.filter-toggle {
  background: rgba(255,255,255,0.06);
  border-style: dashed;
}
.filter-label {
  font-size: 13px;
  color: rgba(255,255,255,0.5);
  white-space: nowrap;
}
.filter-item.active .filter-label {
  color: #d4af37;
}
.filter-count {
  font-size: 11px;
  color: rgba(255,255,255,0.3);
  background: rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 1px 6px;
  min-width: 18px;
  text-align: center;
}
.filter-item.active .filter-count {
  background: rgba(212,175,55,0.25);
  color: #d4af37;
}

/* ===== 列表区域 ===== */
.board-list { padding: 0 14px 14px; }

/* ===== 状态分段 ===== */
.status-section {
  border: 1px solid rgba(218,165,32,0.12);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 14px;
  overflow: hidden;
  box-sizing: border-box;
  width: 100%;
  background: rgba(255,255,255,0.02);
}
/* 空闲状态组：分组框底色与其他分组一致，不加特殊背景 */

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.section-title { font-size: 15px; font-weight: 600; color: #d4af37; }
.section-count { font-size: 12px; color: rgba(255,255,255,0.35); }

/* ===== 助教方格卡片 ===== */
.coach-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.coach-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 4px;
  overflow: hidden;
  background: rgba(212,175,55,0.15);
  border: 1px solid rgba(218,165,32,0.25);
  border-radius: 8px;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: manipulation;
}
.coach-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(218,165,32,0.3);
  margin-bottom: 3px;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
}
.coach-id {
  font-size: 13px;
  color: #d4af37;
  font-weight: 600;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
}
.coach-name {
  font-size: 13px;
  color: rgba(255,255,255,0.85);
  text-align: center;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
}

/* 空闲组中的卡片样式调整 */
.status-section.free-section .coach-card {
  background: rgba(255,255,255,0.75);
  border-color: rgba(0,0,0,0.06);
}
.status-section.free-section .coach-id {
  color: #b8860b;
}
.status-section.free-section .coach-name {
  color: rgba(0,0,0,0.7);
}

/* 下班助教卡片：深灰色底 */
.coach-card--offduty {
  background: rgba(60, 60, 60, 0.6) !important;
  border-color: rgba(100, 100, 100, 0.3) !important;
  position: relative;
}

/* 下班助教卡片：隐藏头像 */
.coach-card--offduty .coach-avatar {
  display: none !important;
}

/* 下班助教独立行样式 */
.coach-grid.off-duty-row {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed rgba(255,255,255,0.08);
}

/* 加班小时数：红色粗体右上角 */
.overtime-hours {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 11px;
  font-weight: bold;
  color: #ff3b30;
  line-height: 1;
}

/* 弹窗下班助教卡片 */
.expand-card--offduty {
  background: rgba(60, 60, 60, 0.6) !important;
  border-color: rgba(100, 100, 100, 0.3) !important;
  position: relative;
}

.expand-card--offduty .expand-avatar {
  display: none !important;
}

/* ===== 分段放大弹窗 ===== */
.expand-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0,0,0,0.85);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
}
.expand-box {
  background: rgba(20,20,30,0.95);
  border-radius: 14px;
  padding: 16px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  border: 1px solid rgba(218,165,32,0.2);
}
.expand-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.expand-title { font-size: 16px; font-weight: 600; }
.expand-count { font-size: 12px; color: rgba(255,255,255,0.4); }
.expand-content { max-height: 60vh; }
.expand-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding-bottom: 8px;
}
.expand-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 4px;
  overflow: hidden;
  background: rgba(212,175,55,0.15);
  border: 1px solid rgba(218,165,32,0.25);
  border-radius: 8px;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: manipulation;
}
.expand-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(218,165,32,0.3);
  margin-bottom: 3px;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
}
.expand-id {
  font-size: 11px;
  color: #d4af37;
  font-weight: 600;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
}
.expand-name {
  font-size: 11px;
  color: rgba(255,255,255,0.85);
  text-align: center;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
}

.empty { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.3); }

/* #ifdef H5 */
/* 全屏悬浮按钮 */
.fullscreen-btn {
  position: fixed;
  bottom: 80px;
  width: 44px;
  height: 44px;
  background: rgba(212, 175, 55, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  z-index: 100;
}
.fullscreen-btn text {
  font-size: 20px;
  color: #000;
}
/* #endif */
</style>
