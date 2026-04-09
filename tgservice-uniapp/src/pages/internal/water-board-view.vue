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

    <view class="board-list" v-if="groupedBoards.length > 0">
      <view class="status-group" v-for="group in groupedBoards" :key="group.status">
        <view class="group-header">
          <text class="group-title">{{ group.status }}</text>
          <text class="group-count">({{ group.coaches.length }}人)</text>
        </view>
        <view class="coach-cards">
          <view class="coach-card" v-for="coach in group.coaches" :key="coach.coach_no">
            <text class="coach-no">{{ coach.coach_no }}</text>
            <text class="coach-name">{{ coach.stage_name }}</text>
            <text class="coach-table" v-if="coach.table_no">{{ coach.table_no }}</text>
          </view>
        </view>
      </view>
    </view>
    <view class="empty" v-else><text>暂无数据</text></view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/utils/api-v2.js'

const statusBarHeight = ref(0)
const waterBoards = ref([])
const statusList = ['早班上桌', '早班空闲', '晚班上桌', '晚班空闲', '早加班', '晚加班', '休息', '公休', '请假', '乐捐', '下班']

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  loadData()
})

const loadData = async () => {
  try {
    const res = await api.waterBoards.getList()
    waterBoards.value = res.data || []
  } catch (e) { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

const groupedBoards = computed(() => {
  const groups = {}
  waterBoards.value.forEach(b => {
    if (!groups[b.status]) groups[b.status] = { status: b.status, coaches: [] }
    groups[b.status].coaches.push(b)
  })
  return statusList.filter(s => groups[s]).map(s => groups[s])
})

const goBack = () => { const pages = getCurrentPages(); if (pages.length > 1) { uni.navigateBack() } else { uni.switchTab({ url: '/pages/member/member' }) } }
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

.board-list { padding: 8px 12px; }
.status-group { margin-bottom: 16px; }
.group-header { display: flex; align-items: center; margin-bottom: 8px; padding-left: 4px; }
.group-title { font-size: 15px; font-weight: 600; color: #d4af37; }
.group-count { font-size: 12px; color: rgba(255,255,255,0.4); margin-left: 6px; }
.coach-cards { display: flex; flex-wrap: wrap; gap: 8px; }
.coach-card { background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; gap: 8px; }
.coach-no { font-size: 14px; font-weight: 600; color: #d4af37; }
.coach-name { font-size: 14px; color: #fff; }
.coach-table { font-size: 11px; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; }
.empty { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.3); }
</style>
