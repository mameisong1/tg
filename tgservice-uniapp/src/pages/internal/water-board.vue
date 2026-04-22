<template>
  <view class="page">
    <!-- 固定标题栏 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">水牌管理</text>
        <view class="refresh-btn" @click="loadData"><text class="refresh-icon">🔄</text></view>
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
    <view class="board-list">
      <view class="status-section" v-for="group in filteredBoards" :key="group.status" :data-status="group.status" :class="{ 'free-section': freeStatuses.includes(group.status) }">
        <view class="section-header" @click="showSectionExpand(group.status, group.coaches)">
          <text class="section-title" :style="{ color: statusColors[group.status] || '#d4af37' }">{{ group.status }}</text>
          <text class="section-count">{{ group.coaches.length }}人 ⛶</text>
        </view>
        <view class="coach-grid">
          <!-- 正常助教（排除休息/公休/请假） -->
          <view class="coach-card" v-for="coach in group.coaches.filter(c => !c._offDuty && !c._overtime && !c._free)" :key="coach.coach_no" @longpress="showStatusChange(coach)">
            <image class="coach-avatar" :src="getCoachPhoto(coach)" mode="aspectFill" />
            <text class="coach-id">{{ formatCoachId(coach) }}</text>
            <view class="name-row">
              <text class="coach-name">{{ coach.stage_name }}</text>
              <text class="rank-badge" v-if="getRankBadge(coach)" :class="{ 'late-shift': getRankBadge(coach) > 50 }">{{ getRankBadge(coach) }}</text>
            </view>
          </view>
        </view>
        <!-- 休息/公休/请假助教（下班样式，保留长按修改） -->
        <view class="coach-grid off-duty-row" v-if="group.coaches.some(c => c._free)">
          <view class="coach-card coach-card--offduty"
                v-for="coach in group.coaches.filter(c => c._free)"
                :key="'free-' + coach.coach_no"
                @longpress="showStatusChange(coach)">
            <text class="coach-id coach-id--offduty">{{ coach.employee_id || '未知' }}</text>
            <text class="coach-name coach-name--offduty">{{ coach.stage_name }}</text>
          </view>
        </view>
        <!-- 下班助教单独一行（不显示加班角标） -->
        <view class="coach-grid off-duty-row" v-if="group.coaches.some(c => c._offDuty)">
          <view class="coach-card coach-card--offduty"
                v-for="coach in group.coaches.filter(c => c._offDuty)"
                :key="'off-' + coach.coach_no"
                @longpress="showStatusChange(coach)">
            <text class="coach-id coach-id--offduty">{{ coach.employee_id || '未知' }}</text>
            <text class="coach-name coach-name--offduty">{{ coach.stage_name }}</text>
          </view>
        </view>
        <!-- 加班助教单独一行 -->
        <view class="coach-grid off-duty-row overtime-row" v-if="group.coaches.some(c => c._overtime)">
          <view class="coach-card coach-card--offduty"
                v-for="coach in group.coaches.filter(c => c._overtime)"
                :key="'ot-' + coach.coach_no"
                @longpress="showStatusChange(coach)">
            <text class="coach-id coach-id--offduty">{{ coach.employee_id || '未知' }}</text>
            <text class="coach-name coach-name--offduty">{{ coach.stage_name }}</text>
            <text class="overtime-hours" v-if="getOvertimeHours(coach) > 0">{{ getOvertimeHours(coach) }}</text>
          </view>
        </view>
      </view>
      <view class="empty" v-if="groupedBoards.length === 0"><text>暂无数据</text></view>
    </view>

    <!-- 分段放大弹窗 -->
    <view class="expand-overlay" v-if="showExpand" @click="closeExpand">
      <view class="expand-box" @click.stop>
        <view class="expand-header">
          <text class="expand-title" :style="{ color: expandColor }">{{ expandStatus }}</text>
          <text class="expand-count">{{ expandCoaches.length }}人</text>
        </view>
        <scroll-view class="expand-content" scroll-y>
          <view class="expand-grid">
            <!-- 正常助教（排除休息/公休/请假） -->
            <view class="expand-card" v-for="coach in expandCoaches.filter(c => !c._offDuty && !c._overtime && !c._free)" :key="coach.coach_no" @longpress="showStatusChange(coach)">
              <image class="expand-avatar" :src="getCoachPhoto(coach)" mode="aspectFill" />
              <text class="expand-id">{{ formatCoachId({ ...coach, status: expandStatus }) }}</text>
              <view class="expand-name-row">
                <text class="expand-name">{{ coach.stage_name }}</text>
                <text class="rank-badge" v-if="getRankBadge(coach)" :class="{ 'late-shift': getRankBadge(coach) > 50 }">{{ getRankBadge(coach) }}</text>
              </view>
            </view>
          </view>
          <!-- 休息/公休/请假助教（下班样式） -->
          <view class="expand-grid off-duty-row" v-if="expandCoaches.some(c => c._free)">
            <view class="expand-card expand-card--offduty"
                  v-for="coach in expandCoaches.filter(c => c._free)"
                  :key="'free-' + coach.coach_no"
                  @longpress="showStatusChange(coach)">
              <text class="expand-id expand-id--offduty">{{ coach.employee_id || '未知' }}</text>
              <text class="expand-name expand-name--offduty">{{ coach.stage_name }}</text>
            </view>
          </view>
          <!-- 下班助教单独一行（不显示加班角标） -->
          <view class="expand-grid off-duty-row" v-if="expandCoaches.some(c => c._offDuty)">
            <view class="expand-card expand-card--offduty"
                  v-for="coach in expandCoaches.filter(c => c._offDuty)"
                  :key="'off-' + coach.coach_no"
                  @longpress="showStatusChange(coach)">
              <text class="expand-id expand-id--offduty">{{ coach.employee_id || '未知' }}</text>
              <text class="expand-name expand-name--offduty">{{ coach.stage_name }}</text>
            </view>
          </view>
          <!-- 加班助教单独一行 -->
          <view class="expand-grid off-duty-row overtime-row" v-if="expandCoaches.some(c => c._overtime)">
            <view class="expand-card expand-card--offduty"
                  v-for="coach in expandCoaches.filter(c => c._overtime)"
                  :key="'ot-' + coach.coach_no"
                  @longpress="showStatusChange(coach)">
              <text class="expand-id expand-id--offduty">{{ coach.employee_id || '未知' }}</text>
              <text class="expand-name expand-name--offduty">{{ coach.stage_name }}</text>
              <text class="overtime-hours" v-if="getOvertimeHours(coach) > 0">{{ getOvertimeHours(coach) }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 修改状态弹窗 -->
    <view class="modal-overlay" v-if="showModal" @click="closeModal">
      <view class="modal-box" @click.stop>
        <text class="modal-title">🔄 修改水牌状态</text>
        <text class="modal-coach-info" v-if="selectedCoach">{{ selectedCoach.employee_id || '未知' }}号 - {{ selectedCoach.stage_name }}</text>
        <view class="status-grid">
          <view class="status-btn" v-for="s in simpleStatusList" :key="s"
                :class="{ current: getSimpleStatus(selectedCoach?.status) === s }"
                @click="changeStatus(s)">
            <text>{{ s }}</text>
          </view>
        </view>
        <view class="modal-exempt" @click="setExempt(selectedCoach)">
          <text class="exempt-text">免门迎</text>
        </view>
        <view class="modal-cancel" @click="closeModal"><text>取消</text></view>
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

// ===== 自动刷新机制 =====
let refreshTimer = null
const REFRESH_INTERVAL = 30000 // 30秒

// #ifdef H5
// H5 环境下阻止浏览器长按菜单
let contextmenuHandler = null
let selectstartHandler = null
// 悬浮按钮位置
const floatPosition = ref('left')
const isFullscreen = ref(false)
// #endif

// 合并 onMounted：所有环境共享初始化 + H5 长按阻止
onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  const adminInfo = uni.getStorageSync('adminInfo') || {}
  isEditable.value = ['店长', '助教管理'].includes(adminInfo.role)

  // #ifdef H5
  // 在 capture 阶段捕获并阻止 contextmenu
  contextmenuHandler = (e) => {
    const chip = e.target.closest('.coach-card, .expand-card')
    if (chip) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      return false
    }
  }
  selectstartHandler = (e) => {
    const chip = e.target.closest('.coach-card, .expand-card')
    if (chip) {
      e.preventDefault()
      return false
    }
  }
  document.addEventListener('contextmenu', contextmenuHandler, true)
  document.addEventListener('selectstart', selectstartHandler, true)
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
  // 读取悬浮按钮位置
  floatPosition.value = uni.getStorageSync('floatButtonPosition') || 'left'
  // #endif

  loadData()
  loadOvertimeHours()

  // 启动30秒自动刷新（所有环境）
  refreshTimer = setInterval(() => {
    loadData() // 静默刷新，不弹提示
  }, REFRESH_INTERVAL)
})

// 合并 onUnmounted：H5 长按清理 + 所有环境定时器清理
onUnmounted(() => {
  // #ifdef H5
  document.removeEventListener('contextmenu', contextmenuHandler, true)
  document.removeEventListener('selectstart', selectstartHandler, true)
  // #endif

  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})

const statusBarHeight = ref(0)
const waterBoards = ref([])
const isEditable = ref(false)
const showModal = ref(false)
const selectedCoach = ref(null)
const showExpand = ref(false)
const expandStatus = ref('')
const expandCoaches = ref([])
const expandColor = ref('#d4af37')
// 非工作状态筛选按钮折叠
const offStatusVisible = ref(false)

// 门迎排序数据
const guestRankingData = ref({ ranking: {}, exempt: [] })

const loadGuestRanking = async () => {
  try {
    const res = await api.guestRankings.getToday()
    if (res.success) {
      guestRankingData.value = res.data
    }
  } catch (e) {
    // 静默失败
  }
}

const workStatusList = ['早班上桌', '早班空闲', '晚班上桌', '晚班空闲', '乐捐']
const offStatusList = ['休息', '公休', '请假']
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

const simpleStatusList = ['上桌', '空闲', '加班', '休息', '公休', '请假', '乐捐', '下班']

const statusColors = {
  '早班上桌': '#3498db', '早班空闲': '#2ecc71', '晚班上桌': '#9b59b6', '晚班空闲': '#f1c40f',
  '早加班': '#e67e22', '晚加班': '#e74c3c', '休息': '#95a5a6', '公休': '#1abc9c',
  '请假': '#7f8c8d', '乐捐': '#f39c12', '下班': '#bdc3c7'
}

const loadData = async () => {
  try {
    const res = await api.waterBoards.getList({})
    waterBoards.value = res.data || []
    // 同时刷新加班小时数
    await loadOvertimeHours()
    // 加载门迎排序数据
    await loadGuestRanking()
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

/**
 * 获取助教的门迎序号徽章
 */
const getRankBadge = (coach) => {
  if (!coach || !guestRankingData.value.ranking) return null
  const ranking = guestRankingData.value.ranking
  return ranking[String(coach.coach_no)] || null
}

/**
 * 设置免门迎
 */
const setExempt = async (coach) => {
  if (!coach) return
  try {
    await api.guestRankings.setExempt(coach.coach_no)
    uni.showToast({ title: `${coach.stage_name}: 已设免门迎`, icon: 'success' })
    closeModal()
    loadData()
  } catch (e) {
    uni.showToast({ title: e.error || '设置失败', icon: 'none' })
  }
}

const activeFilter = ref('')

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
  
  waterBoards.value.forEach(board => {
    if (board.status === '下班') {
      // 根据班次合并到对应空闲组
      if (board.shift === '晚班') {
        groups['晚班空闲'].push({ ...board, _offDuty: true })
      } else {
        groups['早班空闲'].push({ ...board, _offDuty: true })
      }
    } else if (board.status === '早加班') {
      // 早加班合并到早班空闲
      groups['早班空闲'].push({ ...board, _overtime: true })
    } else if (board.status === '晚加班') {
      // 晚加班合并到晚班空闲
      groups['晚班空闲'].push({ ...board, _overtime: true })
    } else if (groups[board.status]) {
      // 休息/公休/请假标记为 _free，使用下班样式
      groups[board.status].push({ ...board, _free: offStatusList.includes(board.status) })
    }
  })
  
  // 排序：空闲组内，正常助教在前（按 clock_in_time 倒序），下班助教其次，加班助教最后
  freeStatuses.forEach(s => {
    const normal = groups[s].filter(c => !c._offDuty && !c._overtime && !c._free)
    const free = groups[s].filter(c => c._free)
    const offDuty = groups[s].filter(c => c._offDuty)
    const overtime = groups[s].filter(c => c._overtime)
    
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
    
    // 加班助教保持原有排序（按 updated_at 倒序）
    overtime.sort((a, b) => {
      const ta = a.updated_at ? new Date(a.updated_at + '+08:00').getTime() : 0
      const tb = b.updated_at ? new Date(b.updated_at + '+08:00').getTime() : 0
      return tb - ta
    })
    
    groups[s] = [...normal, ...free, ...offDuty, ...overtime]
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

const getSimpleStatus = (actualStatus) => {
  if (actualStatus === '早班上桌' || actualStatus === '晚班上桌') return '上桌'
  if (actualStatus === '早班空闲' || actualStatus === '晚班空闲') return '空闲'
  if (actualStatus === '早加班' || actualStatus === '晚加班') return '加班'
  return actualStatus
}

const getActualStatus = (simpleStatus) => {
  if (!selectedCoach.value) return simpleStatus
  const shift = selectedCoach.value.shift === '晚班' ? '晚班' : '早班'
  switch (simpleStatus) {
    case '上桌': return shift + '上桌'
    case '空闲': return shift + '空闲'
    case '加班': return shift === '早班' ? '早加班' : '晚加班'
    default: return simpleStatus
  }
}

const getCoachPhoto = (coach) => {
  if (!coach.photos || coach.photos.length === 0) return '/static/avatar-default.png'
  const photo = coach.photos[0]
  return photo.startsWith('http') ? photo : 'http://47.238.80.12:8081' + photo
}

const showStatusChange = (coach) => {
  if (!isEditable.value) return
  selectedCoach.value = coach
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  selectedCoach.value = null
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

const changeStatus = async (simpleStatus) => {
  if (!selectedCoach.value) return
  const actualStatus = getActualStatus(simpleStatus)
  try {
    await api.waterBoards.updateStatus(selectedCoach.value.coach_no, { status: actualStatus, table_no: selectedCoach.value.table_no || null })
    uni.showToast({ title: `${selectedCoach.value.stage_name}: ${actualStatus}`, icon: 'success' })
    closeModal()
    loadData()
  } catch (e) {
    uni.showToast({ title: e.error || '修改失败', icon: 'none' })
  }
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

// 显示等级的状态列表
const showLevelStatuses = ['早班空闲', '早班上桌', '晚班空闲', '晚班上桌', '乐捐']

// 等级字母映射：S=女神, A=高级, B=中级, C=初级
const getLevelLetter = (level) => {
  const letters = {
    '女神': 'S',
    '高级': 'A',
    '中级': 'B',
    '初级': 'C'
  }
  return letters[level] || ''
}

// 是否显示等级
const shouldShowLevel = (status) => {
  return showLevelStatuses.includes(status)
}

// 格式化工号显示（带等级字母）
const formatCoachId = (coach) => {
  const id = coach.employee_id || '未知'
  if (shouldShowLevel(coach.status) && coach.level) {
    return `${id}-${getLevelLetter(coach.level)}`
  }
  return id
}

const goBack = () => { const pages = getCurrentPages(); if (pages.length > 1) { uni.navigateBack() } else { uni.switchTab({ url: '/pages/member/member' }) } }
</script>

<style scoped>
.page { min-height: 100vh; background: #0a0a0f; padding-bottom: 40px; }
.fixed-header { position: fixed; top: 0; left: 0; right: 0; z-index: 999; background: #0a0a0f; }
.status-bar-bg { background: #0a0a0f; }
.header-content { height: 44px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; }
.back-btn, .refresh-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.back-icon { font-size: 28px; color: #d4af37; }
.refresh-icon { font-size: 18px; }
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
  position: relative;
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

/* 下班/加班助教卡片：隐藏头像 */
.coach-card--offduty .coach-avatar {
  display: none !important;
}

/* 下班/加班助教独立行样式 */
.coach-grid.off-duty-row {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed rgba(255,255,255,0.08);
}
.coach-grid.off-duty-row:first-of-type {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

/* 下班/加班助教：工号和艺名灰白色 */
.coach-id--offduty {
  color: rgba(200, 200, 200, 0.7) !important;
}
.coach-name--offduty {
  color: rgba(200, 200, 200, 0.6) !important;
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

/* 弹窗下班/加班助教：工号和艺名灰白色 */
.expand-id--offduty {
  color: rgba(200, 200, 200, 0.7) !important;
}
.expand-name--offduty {
  color: rgba(200, 200, 200, 0.6) !important;
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
  position: relative;
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

/* ===== 修改状态弹窗 ===== */
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0,0,0,0.7);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-box {
  background: rgba(20,20,30,0.95);
  border-radius: 14px;
  padding: 18px;
  width: 85%;
  max-width: 300px;
  border: 1px solid rgba(218,165,32,0.2);
}
.modal-title { font-size: 15px; color: #d4af37; margin-bottom: 6px; display: block; }
.modal-coach-info { font-size: 11px; color: rgba(255,255,255,0.4); margin-bottom: 10px; display: block; }
.status-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.status-btn {
  padding: 8px 4px;
  border-radius: 6px;
  font-size: 12px;
  text-align: center;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.7);
}
.status-btn.current {
  background: rgba(212,175,55,0.2);
  border-color: rgba(212,175,55,0.5);
  color: #d4af37;
  font-weight: 600;
}
.modal-cancel {
  text-align: center;
  padding: 10px;
  margin-top: 10px;
  background: rgba(255,255,255,0.04);
  border-radius: 6px;
  font-size: 13px;
  color: rgba(255,255,255,0.5);
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

/* 门迎序号徽章 */
.rank-badge {
  position: absolute;
  top: 2px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ff6b35;
  color: #fff;
  font-size: 10px;
  font-weight: bold;
  line-height: 18px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.free-section .rank-badge {
  background: #e74c3c;
}

.rank-badge.late-shift {
  background: #9b59b6;
}

/* 名称行容器 */
.name-row,
.expand-name-row {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
}

/* 免门迎按钮 */
.modal-exempt {
  text-align: center;
  padding: 10px;
  margin-top: 8px;
  background: rgba(52,152,219,0.15);
  border: 1px solid rgba(52,152,219,0.4);
  border-radius: 6px;
}

.exempt-text {
  font-size: 13px;
  font-weight: bold;
  color: #3498db;
}
</style>
