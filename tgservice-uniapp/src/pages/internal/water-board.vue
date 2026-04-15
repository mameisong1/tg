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
      <view class="filter-item" :class="{ active: activeFilter === '' }" @click="activeFilter = ''"><text>全部</text></view>
      <view class="filter-item" v-for="s in statusList" :key="s" :class="{ active: activeFilter === s }" @click="activeFilter = s"><text>{{ s }}</text></view>
    </view>

    <!-- 按状态分组显示 -->
    <scroll-view class="board-list" scroll-y>
      <view class="status-section" v-for="group in filteredBoards" :key="group.status" :data-status="group.status">
        <view class="section-header" @click="showSectionExpand(group.status, group.coaches)">
          <text class="section-title">{{ group.status }}</text>
          <text class="section-count">{{ group.coaches.length }}人 ⛶</text>
        </view>
        <view class="coach-chips">
          <view class="coach-chip" v-for="coach in group.coaches" :key="coach.coach_no" @longpress="showStatusChange(coach)">
            <image class="coach-chip-avatar" :src="getCoachPhoto(coach)" mode="aspectFill" />
            <text class="coach-chip-id">{{ coach.employee_id || coach.coach_no }}</text>
            <text class="coach-chip-name">{{ coach.stage_name }}</text>
            <view class="coach-chip-table-tags" v-if="coach.table_no_list && coach.table_no_list.length">
              <text class="coach-chip-table-tag" v-for="(t, i) in coach.table_no_list" :key="i">{{ t }}</text>
            </view>
          </view>
          <view class="empty-chip" v-if="group.coaches.length === 0"><text>暂无</text></view>
        </view>
      </view>
      <view class="empty" v-if="groupedBoards.length === 0"><text>暂无数据</text></view>
    </scroll-view>

    <!-- 分段放大弹窗 -->
    <view class="expand-overlay" v-if="showExpand" @click="closeExpand">
      <view class="expand-box" @click.stop>
        <view class="expand-header">
          <text class="expand-title" :style="{ color: expandColor }">{{ expandStatus }}</text>
          <text class="expand-count">{{ expandCoaches.length }}人</text>
        </view>
        <scroll-view class="expand-content" scroll-y>
          <view class="expand-chips">
            <view class="expand-chip" v-for="coach in expandCoaches" :key="coach.coach_no" @longpress="showStatusChange(coach)">
              <image class="expand-avatar" :src="getCoachPhoto(coach)" mode="aspectFill" />
              <text class="expand-id">{{ coach.employee_id || coach.coach_no }}</text>
              <text class="expand-name">{{ coach.stage_name }}</text>
              <view class="expand-table-tags" v-if="coach.table_no_list && coach.table_no_list.length">
                <text class="expand-table-tag" v-for="(t, i) in coach.table_no_list" :key="i">{{ t }}</text>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 修改状态弹窗 -->
    <view class="modal-overlay" v-if="showModal" @click="closeModal">
      <view class="modal-box" @click.stop>
        <text class="modal-title">🔄 修改水牌状态</text>
        <text class="modal-coach-info" v-if="selectedCoach">{{ selectedCoach.employee_id || selectedCoach.coach_no }}号 - {{ selectedCoach.stage_name }}</text>
        <view class="status-grid">
          <view class="status-btn" v-for="s in simpleStatusList" :key="s"
                :class="{ current: getSimpleStatus(selectedCoach?.status) === s }"
                @click="changeStatus(s)">
            <text>{{ s }}</text>
          </view>
        </view>
        <view class="modal-cancel" @click="closeModal"><text>取消</text></view>
      </view>
    </view>
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
    const chip = e.target.closest('.coach-chip, .expand-chip')
    if (chip) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      return false
    }
  }
  selectstartHandler = (e) => {
    const chip = e.target.closest('.coach-chip, .expand-chip')
    if (chip) {
      e.preventDefault()
      return false
    }
  }
  document.addEventListener('contextmenu', contextmenuHandler, true)
  document.addEventListener('selectstart', selectstartHandler, true)
  // #endif

  loadData()

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

const statusList = ['早班上桌', '早班空闲', '晚班上桌', '晚班空闲', '早加班', '晚加班', '休息', '公休', '请假', '乐捐', '下班']
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
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

const activeFilter = ref('')

const groupedBoards = computed(() => {
  const groups = {}
  statusList.forEach(s => { groups[s] = [] })
  waterBoards.value.forEach(board => {
    if (groups[board.status]) groups[board.status].push(board)
  })
  
  // 对每组内排序
  const freeStatuses = ['早班空闲', '晚班空闲']
  statusList.forEach(s => {
    if (freeStatuses.includes(s)) {
      // 空闲状态：按 clock_in_time 倒序
      groups[s].sort((a, b) => {
        const ta = a.clock_in_time ? new Date(a.clock_in_time + '+08:00').getTime() : 0
        const tb = b.clock_in_time ? new Date(b.clock_in_time + '+08:00').getTime() : 0
        return tb - ta
      })
    } else {
      // 其他状态：按 updated_at 倒序
      groups[s].sort((a, b) => {
        const ta = a.updated_at ? new Date(a.updated_at + '+08:00').getTime() : 0
        const tb = b.updated_at ? new Date(b.updated_at + '+08:00').getTime() : 0
        return tb - ta
      })
    }
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

const goBack = () => { const pages = getCurrentPages(); if (pages.length > 1) { uni.navigateBack() } else { uni.switchTab({ url: '/pages/member/member' }) } }
</script>

<style scoped>
.page { min-height: 100vh; background: #0a0a0f; display: flex; flex-direction: column; }
.fixed-header { position: fixed; top: 0; left: 0; right: 0; z-index: 999; background: #0a0a0f; }
.status-bar-bg { background: #0a0a0f; }
.header-content { height: 44px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; }
.back-btn, .refresh-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.back-icon { font-size: 28px; color: #d4af37; }
.refresh-icon { font-size: 18px; }
.header-title { font-size: 17px; font-weight: 600; color: #d4af37; letter-spacing: 2px; }
.header-placeholder { background: #0a0a0f; }

/* 状态筛选 */
.filter-bar { display: flex; flex-wrap: wrap; padding: 12px; gap: 9px; overflow-x: hidden; }
.filter-item { padding: 9px 18px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 24px; font-size: 18px; color: rgba(255,255,255,0.6); }
.filter-item.active { background: rgba(212,175,55,0.2); border-color: #d4af37; color: #d4af37; }

.board-list { flex: 1; min-height: 0; padding: 0 18px 18px; overflow-x: hidden; }

/* 状态分段 */
.status-section { border: 2px solid rgba(218,165,32,0.15); border-radius: 12px; padding: 15px; margin-bottom: 18px; min-height: 60px; overflow: hidden; box-sizing: border-box; width: 100%; max-width: 100%; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 9px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.section-title { font-size: 21px; font-weight: 600; color: #d4af37; }
.section-count { font-size: 18px; color: rgba(255,255,255,0.4); }

/* 状态颜色 */
.status-section[data-status="早班上桌"] { border-color: rgba(52,152,219,0.3); }
.status-section[data-status="早班空闲"] { border-color: rgba(46,204,113,0.3); background: rgba(255,255,255,0.18); }
.status-section[data-status="晚班上桌"] { border-color: rgba(155,89,182,0.3); }
.status-section[data-status="晚班空闲"] { border-color: rgba(241,196,15,0.3); background: rgba(255,255,255,0.18); }
.status-section[data-status="早加班"] { border-color: rgba(230,126,34,0.3); }
.status-section[data-status="晚加班"] { border-color: rgba(231,76,60,0.3); }
.status-section[data-status="休息"] { border-color: rgba(149,165,166,0.3); }
.status-section[data-status="公休"] { border-color: rgba(26,188,156,0.3); }
.status-section[data-status="请假"] { border-color: rgba(52,73,94,0.3); }
.status-section[data-status="乐捐"] { border-color: rgba(243,156,18,0.3); }
.status-section[data-status="下班"] { border-color: rgba(44,62,80,0.3); }

.status-section[data-status="早班上桌"] .section-title { color: #3498db; }
.status-section[data-status="早班空闲"] .section-title { color: #2ecc71; }
.status-section[data-status="晚班上桌"] .section-title { color: #9b59b6; }
.status-section[data-status="晚班空闲"] .section-title { color: #f1c40f; }
.status-section[data-status="早加班"] .section-title { color: #e67e22; }
.status-section[data-status="晚加班"] .section-title { color: #e74c3c; }
.status-section[data-status="休息"] .section-title { color: #95a5a6; }
.status-section[data-status="公休"] .section-title { color: #1abc9c; }
.status-section[data-status="请假"] .section-title { color: #7f8c8d; }
.status-section[data-status="乐捐"] .section-title { color: #f39c12; }
.status-section[data-status="下班"] .section-title { color: #bdc3c7; }

/* 助教圆形卡片 */
.coach-chips { display: flex; flex-wrap: wrap; gap: 15px; }
.coach-chip { display: flex; flex-direction: column; align-items: center; width: 120px; padding: 12px 6px; background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.15); border-radius: 50%; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation; }
.coach-chip-avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 3px solid rgba(218,165,32,0.3); margin-bottom: 6px; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; pointer-events: none; }
.coach-chip-id { font-size: 18px; color: #d4af37; font-weight: 600; user-select: none; -webkit-user-select: none; pointer-events: none; }
.coach-chip-name { font-size: 18px; color: rgba(255,255,255,0.8); text-align: center; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 108px; user-select: none; -webkit-user-select: none; pointer-events: none; }
.coach-chip-table-tags { display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; margin-top: 2px; }
.coach-chip-table-tag { font-size: 14px; color: #d4af37; background: rgba(212,175,55,0.12); border-radius: 4px; padding: 2px 6px; }
.empty-chip { text-align: center; padding: 16px; color: rgba(255,255,255,0.15); font-size: 12px; }

/* 分段放大弹窗 */
.expand-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 999; display: flex; align-items: center; justify-content: center; }
.expand-box { background: rgba(20,20,30,0.95); border-radius: 16px; padding: 20px; width: 90%; max-width: 600px; max-height: 80vh; border: 2px solid rgba(218,165,32,0.3); }
.expand-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); }
.expand-title { font-size: 18px; font-weight: 600; }
.expand-count { font-size: 13px; color: rgba(255,255,255,0.4); }
.expand-content { max-height: 60vh; }
.expand-chips { display: flex; flex-wrap: wrap; gap: 12px; padding-bottom: 10px; }
.expand-chip { display: flex; flex-direction: column; align-items: center; width: 100px; padding: 10px 6px; background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.15); border-radius: 50%; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation; }
.expand-avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(218,165,32,0.3); margin-bottom: 6px; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; pointer-events: none; }
.expand-id { font-size: 12px; color: #d4af37; font-weight: 600; user-select: none; -webkit-user-select: none; pointer-events: none; }
.expand-name { font-size: 12px; color: rgba(255,255,255,0.8); text-align: center; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 90px; user-select: none; -webkit-user-select: none; pointer-events: none; }
.expand-table-tags { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin-top: 4px; }
.expand-table-tag { font-size: 10px; color: #d4af37; background: rgba(212,175,55,0.12); border-radius: 4px; padding: 1px 5px; }

/* 修改状态弹窗 */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.modal-box { background: rgba(20,20,30,0.95); border-radius: 16px; padding: 20px; width: 85%; max-width: 320px; border: 1px solid rgba(218,165,32,0.3); }
.modal-title { font-size: 16px; color: #d4af37; margin-bottom: 8px; display: block; }
.modal-coach-info { font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 12px; display: block; }
.status-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.status-btn { padding: 10px 6px; border-radius: 8px; font-size: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: #fff; }
.status-btn.current { background: rgba(212,175,55,0.3); border-color: #d4af37; color: #d4af37; font-weight: 600; }
.modal-cancel { text-align: center; padding: 12px; margin-top: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; font-size: 14px; color: rgba(255,255,255,0.6); }

.empty { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.3); }

/* === 窄屏响应式优化 === */

/* 窄屏：≤420px */
@media (max-width: 420px) {
  .filter-bar { gap: 6px; padding: 9px 12px; }
  .filter-item { padding: 8px 12px; font-size: 17px; }
  .coach-chips { gap: 9px; }
  .coach-chip { width: 96px; padding: 9px 3px; }
  .coach-chip-avatar { width: 57px; height: 57px; }
  .coach-chip-id { font-size: 17px; }
  .coach-chip-name { font-size: 17px; max-width: 84px; }
  .coach-chip-table-tags { gap: 2px; }
  .coach-chip-table-tag { font-size: 12px; padding: 1px 3px; }
  .status-section { padding: 12px; margin-bottom: 12px; }
  .board-list { padding: 0 6px 12px; }
}

/* 极窄屏：≤360px */
@media (max-width: 360px) {
  .filter-bar { gap: 5px; padding: 6px 9px; }
  .filter-item { padding: 6px 9px; font-size: 15px; border-radius: 18px; }
  .coach-chips { gap: 6px; }
  .coach-chip { width: 84px; padding: 6px 3px; }
  .coach-chip-avatar { width: 45px; height: 45px; border-width: 2px; }
  .coach-chip-id { font-size: 15px; }
  .coach-chip-name { font-size: 15px; max-width: 72px; }
  .coach-chip-table-tag { font-size: 11px; padding: 0 2px; }
  .board-list { padding: 0 6px 12px; }
  .status-section { padding: 9px 6px; margin-bottom: 9px; }
}
</style>
