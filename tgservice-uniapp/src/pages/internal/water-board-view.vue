<template>
  <view class="page">
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
      <view class="filter-item" :class="{ active: activeFilter === '' }" @click="activeFilter = ''"><text>全部</text></view>
      <view class="filter-item" v-for="s in statusList" :key="s" :class="{ active: activeFilter === s }" @click="activeFilter = s">
        <text>{{ s }}</text>
      </view>
    </view>

    <view class="board-list" v-if="filteredBoards.length > 0">
      <view class="status-section" v-for="group in filteredBoards" :key="group.status" :data-status="group.status">
        <view class="section-header" @click="showSectionExpand(group.status, group.coaches)">
          <text class="section-title">{{ group.status }}</text>
          <text class="section-count">{{ group.coaches.length }}人 ⛶</text>
        </view>
        <view class="coach-chips">
          <view class="coach-chip" v-for="coach in group.coaches" :key="coach.coach_no">
            <image class="coach-avatar" :src="getAvatar(coach)" mode="aspectFill" />
            <text class="coach-id">{{ coach.employee_id || coach.coach_no }}</text>
            <text class="coach-name">{{ coach.stage_name }}</text>
            <view class="coach-table-tags" v-if="coach.table_no_list && coach.table_no_list.length">
              <text class="coach-table-tag" v-for="(t, i) in coach.table_no_list" :key="i">{{ t }}</text>
            </view>
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
          <view class="expand-chips">
            <view class="expand-chip" v-for="coach in expandCoaches" :key="coach.coach_no">
              <image class="expand-avatar" :src="getAvatar(coach)" mode="aspectFill" />
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
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '@/utils/api-v2.js'

const statusBarHeight = ref(0)
const waterBoards = ref([])
const statusList = ['早班上桌', '早班空闲', '晚班上桌', '晚班空闲', '早加班', '晚加班', '休息', '公休', '请假', '乐捐', '下班']
const showExpand = ref(false)
const expandStatus = ref('')
const expandCoaches = ref([])
const expandColor = ref('#d4af37')
const activeFilter = ref('')

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
  loadData()
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
  } catch (e) { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

const groupedBoards = computed(() => {
  const groups = {}
  statusList.forEach(s => { groups[s] = [] })
  waterBoards.value.forEach(b => {
    if (groups[b.status] !== undefined) groups[b.status].push(b)
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

/* 状态筛选 */
.filter-bar { display: flex; flex-wrap: wrap; padding: 8px 12px; gap: 6px; }
.filter-item { padding: 6px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; font-size: 12px; color: rgba(255,255,255,0.6); }
.filter-item.active { background: rgba(212,175,55,0.2); border-color: #d4af37; color: #d4af37; }

.board-list { padding: 0 12px 12px; }
.status-section { 
  border: 2px solid rgba(218,165,32,0.15); 
  border-radius: 12px; 
  padding: 10px; 
  margin-bottom: 12px; 
  overflow: hidden;
  box-sizing: border-box;
  width: 100%;
}
.section-header { 
  display: flex; 
  align-items: center; 
  justify-content: space-between; 
  margin-bottom: 8px; 
  padding-bottom: 6px; 
  border-bottom: 1px solid rgba(255,255,255,0.05); 
}
.section-title { font-size: 14px; font-weight: 600; color: #d4af37; white-space: nowrap; }
.section-count { font-size: 12px; color: rgba(255,255,255,0.5); }

.coach-chips { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; }

.coach-chip { 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  width: 80px; 
  padding: 8px 4px;
  background: rgba(20,20,30,0.6); 
  border: 1px solid rgba(218,165,32,0.15);
  border-radius: 50%; 
}
.coach-avatar { 
  width: 48px; 
  height: 48px; 
  border-radius: 50%; 
  object-fit: cover;
  border: 2px solid rgba(218,165,32,0.3); 
  margin-bottom: 4px; 
}
.coach-id { font-size: 12px; color: #d4af37; font-weight: 600; }
.coach-name { font-size: 12px; color: rgba(255,255,255,0.8); text-align: center; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 72px; }
.coach-table-tags { display: flex; flex-wrap: wrap; gap: 3px; justify-content: center; margin-top: 2px; }
.coach-table-tag { font-size: 10px; color: #d4af37; background: rgba(212,175,55,0.12); border-radius: 4px; padding: 1px 4px; }

/* 状态颜色 */
.status-section[data-status="早班上桌"] { border-color: rgba(52,152,219,0.3); }
.status-section[data-status="早班空闲"] { border-color: rgba(46,204,113,0.3); background: rgba(255,255,255,0.08); }
.status-section[data-status="晚班上桌"] { border-color: rgba(155,89,182,0.3); }
.status-section[data-status="晚班空闲"] { border-color: rgba(241,196,15,0.3); background: rgba(255,255,255,0.08); }
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

.empty { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.3); }

/* 分段放大弹窗 */
.expand-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 999; display: flex; align-items: center; justify-content: center; }
.expand-box { background: rgba(20,20,30,0.95); border-radius: 16px; padding: 20px; width: 90%; max-width: 600px; max-height: 80vh; border: 2px solid rgba(218,165,32,0.3); }
.expand-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); }
.expand-title { font-size: 18px; font-weight: 600; }
.expand-count { font-size: 13px; color: rgba(255,255,255,0.4); }
.expand-content { max-height: 60vh; }
.expand-chips { display: flex; flex-wrap: wrap; gap: 14px; padding-bottom: 10px; }
.expand-chip { display: flex; flex-direction: column; align-items: center; width: 100px; padding: 10px 6px; background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.15); border-radius: 50%; }
.expand-avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(218,165,32,0.3); margin-bottom: 6px; }
.expand-id { font-size: 12px; color: #d4af37; font-weight: 600; }
.expand-name { font-size: 12px; color: rgba(255,255,255,0.8); text-align: center; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 90px; }
.expand-table-tags { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin-top: 4px; }
.expand-table-tag { font-size: 10px; color: #d4af37; background: rgba(212,175,55,0.12); border-radius: 4px; padding: 1px 5px; }

/* === 窄屏响应式优化 === */

/* 窄屏：≤420px */
@media (max-width: 420px) {
  .filter-bar { gap: 4px; padding: 6px 8px; }
  .filter-item { padding: 5px 8px; font-size: 11px; }
  .coach-chips { gap: 6px; }
  .coach-chip { width: 68px; padding: 6px 2px; }
  .coach-avatar { width: 40px; height: 40px; }
  .coach-id { font-size: 11px; }
  .coach-name { font-size: 11px; max-width: 60px; }
  .coach-table-tags { gap: 2px; }
  .coach-table-tag { font-size: 8px; padding: 1px 3px; }
  .status-section { padding: 8px; margin-bottom: 8px; }
}

/* 极窄屏：≤360px */
@media (max-width: 360px) {
  .filter-bar { gap: 3px; padding: 4px 6px; }
  .filter-item { padding: 4px 6px; font-size: 10px; border-radius: 12px; }
  .coach-chips { gap: 4px; }
  .coach-chip { width: 60px; padding: 4px 2px; }
  .coach-avatar { width: 34px; height: 34px; border-width: 1px; }
  .coach-id { font-size: 10px; }
  .coach-name { font-size: 10px; max-width: 52px; }
  .coach-table-tag { font-size: 7px; padding: 0 2px; }
  .board-list { padding: 0 8px 8px; }
}
</style>
