<template>
  <view class="page">
    <!-- 固定标题栏 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">‹</text>
        </view>
        <text class="header-title">水牌管理</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 状态筛选 -->
    <scroll-view class="filter-bar" scroll-x>
      <view class="filter-item" :class="{ active: filterStatus === '' }" @click="filterStatus = ''">
        <text>全部</text>
      </view>
      <view class="filter-item" v-for="s in statusList" :key="s" :class="{ active: filterStatus === s }" @click="filterStatus = s">
        <text>{{ s }}</text>
      </view>
    </scroll-view>

    <!-- 水牌列表 -->
    <scroll-view class="board-list" scroll-y>
      <!-- 按状态分组显示 -->
      <view class="status-group" v-for="group in groupedBoards" :key="group.status">
        <view class="group-header">
          <text class="group-title">{{ group.status }}</text>
          <text class="group-count">({{ group.coaches.length }}人)</text>
        </view>
        <view class="coach-cards">
          <view class="coach-card" v-for="coach in group.coaches" :key="coach.coach_no">
            <view class="coach-info">
              <text class="coach-no">{{ coach.coach_no }}</text>
              <text class="coach-name">{{ coach.stage_name }}</text>
              <text class="coach-shift" v-if="coach.shift">{{ coach.shift }}</text>
              <text class="coach-table" v-if="coach.table_no">{{ coach.table_no }}</text>
            </view>
            <!-- 手动修改状态 -->
            <view class="status-actions" v-if="isEditable">
              <picker :value="statusIndex(coach.status)" :range="statusList" @change="e => changeStatus(coach.coach_no, statusList[e.detail.value])">
                <view class="status-picker">
                  <text>{{ coach.status }}</text>
                  <text class="picker-arrow">▼</text>
                </view>
              </picker>
            </view>
            <view class="status-label" v-else>
              <text>{{ coach.status }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="empty" v-if="groupedBoards.length === 0">
        <text>暂无数据</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/utils/api-v2.js'

const statusBarHeight = ref(0)
const waterBoards = ref([])
const filterStatus = ref('')
const isEditable = ref(false)

const statusList = ['早班上桌', '早班空闲', '晚班上桌', '晚班空闲', '早加班', '晚加班', '休息', '公休', '请假', '乐捐', '下班']

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  const adminInfo = uni.getStorageSync('adminInfo') || {}
  isEditable.value = ['店长', '助教管理'].includes(adminInfo.role)
  loadData()
})

const loadData = async () => {
  try {
    const res = await api.waterBoards.getList(filterStatus.value ? { status: filterStatus.value } : {})
    waterBoards.value = res.data || []
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

const groupedBoards = computed(() => {
  const groups = {}
  const order = [...statusList]
  waterBoards.value.forEach(board => {
    if (!groups[board.status]) {
      groups[board.status] = { status: board.status, coaches: [] }
    }
    groups[board.status].coaches.push(board)
  })
  return order.filter(s => groups[s]).map(s => groups[s])
})

const statusIndex = (status) => {
  const idx = statusList.indexOf(status)
  return idx >= 0 ? idx : 10
}

const changeStatus = async (coachNo, newStatus) => {
  uni.showModal({
    title: '确认修改',
    content: `确认将该助教状态改为「${newStatus}」？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await api.waterBoards.updateStatus(coachNo, { status: newStatus, table_no: null })
          uni.showToast({ title: '修改成功', icon: 'success' })
          loadData()
        } catch (e) {
          uni.showToast({ title: e.error || '修改失败', icon: 'none' })
        }
      } else {
        loadData()
      }
    }
  })
}

const goBack = () => uni.navigateBack()
</script>

<style scoped>
.page { min-height: 100vh; background: #0a0a0f; display: flex; flex-direction: column; }
.fixed-header { position: fixed; top: 0; left: 0; right: 0; z-index: 999; background: #0a0a0f; }
.status-bar-bg { background: #0a0a0f; }
.header-content { height: 44px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; }
.back-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.back-icon { font-size: 28px; color: #d4af37; }
.back-placeholder { width: 32px; }
.header-title { font-size: 17px; font-weight: 600; color: #d4af37; letter-spacing: 2px; }
.header-placeholder { background: #0a0a0f; }

.filter-bar { white-space: nowrap; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.filter-item { display: inline-block; padding: 6px 14px; margin-right: 8px; background: rgba(255,255,255,0.05); border-radius: 16px; font-size: 13px; color: rgba(255,255,255,0.6); }
.filter-item.active { background: rgba(212,175,55,0.2); color: #d4af37; border: 1px solid rgba(212,175,55,0.3); }

.board-list { flex: 1; min-height: 0; padding: 8px 12px; }

.status-group { margin-bottom: 16px; }
.group-header { display: flex; align-items: center; margin-bottom: 8px; padding-left: 4px; }
.group-title { font-size: 15px; font-weight: 600; color: #d4af37; }
.group-count { font-size: 12px; color: rgba(255,255,255,0.4); margin-left: 6px; }

.coach-cards { display: flex; flex-wrap: wrap; gap: 8px; }
.coach-card { background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 10px; padding: 10px 12px; min-width: calc(50% - 4px); display: flex; flex-direction: column; gap: 8px; }
.coach-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.coach-no { font-size: 14px; font-weight: 600; color: #d4af37; }
.coach-name { font-size: 14px; color: #fff; }
.coach-shift { font-size: 11px; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; }
.coach-table { font-size: 11px; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; }

.status-actions { align-self: flex-end; }
.status-picker { display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: rgba(212,175,55,0.15); border: 1px solid rgba(212,175,55,0.3); border-radius: 6px; font-size: 12px; color: #d4af37; }
.picker-arrow { font-size: 10px; }
.status-label { align-self: flex-end; padding: 4px 10px; background: rgba(255,255,255,0.05); border-radius: 6px; font-size: 12px; color: rgba(255,255,255,0.6); }

.empty { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.3); }
</style>
