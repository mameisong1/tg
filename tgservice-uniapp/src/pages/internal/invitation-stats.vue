<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">约客统计-{{ shiftLabel }}</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <view class="stats-section" v-if="stats">
      <view class="stat-card">
        <text class="stat-value">{{ stats.should_invite_count }}</text>
        <text class="stat-label">应约客人数</text>
      </view>
      <view class="stat-card highlight">
        <text class="stat-value">{{ stats.invited_count }}</text>
        <text class="stat-label">已约客人数</text>
      </view>
    </view>

    <view class="list-section" v-if="stats">
      <view class="list-title">无效约客助教</view>
      <view class="list-item" v-for="item in stats.invalid_list" :key="item.coach_no">
        <text>{{ item.stage_name }} ({{ item.coach_no }})</text>
      </view>
      <view class="list-empty" v-if="!stats.invalid_list?.length"><text>无</text></view>

      <view class="list-title" style="margin-top: 16px;">未约客助教</view>
      <view class="list-item" v-for="item in stats.missing_list" :key="item.coach_no">
        <text>{{ item.stage_name }} ({{ item.coach_no }})</text>
      </view>
      <view class="list-empty" v-if="!stats.missing_list?.length"><text>无</text></view>
    </view>

    <view class="generate-btn" v-if="!stats" @click="generateStats">
      <text>生成约客统计</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api-v2.js'

const statusBarHeight = ref(0)
const shiftLabel = ref('早班')
const shift = ref('早班')
const stats = ref(null)

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (currentPage.options?.shift) {
    shift.value = currentPage.options.shift
    shiftLabel.value = shift.value
  }
  loadStats()
})

const loadStats = async () => {
  const today = new Date().toISOString().split('T')[0]
  try {
    const res = await api.guestInvitations.getStats(today, shift.value)
    stats.value = res.data
  } catch (e) {}
}

const generateStats = async () => {
  const today = new Date().toISOString().split('T')[0]
  try {
    uni.showLoading({ title: '生成中...' })
    const res = await api.guestInvitations.generateStats({ date: today, shift: shift.value })
    uni.hideLoading()
    stats.value = res.data
    uni.showToast({ title: '生成成功', icon: 'success' })
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '生成失败', icon: 'none' })
  }
}

const goBack = () => uni.navigateBack()
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

.stats-section { display: flex; gap: 12px; padding: 16px; }
.stat-card { flex: 1; background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; padding: 20px; text-align: center; }
.stat-card.highlight { background: rgba(212,175,55,0.1); border-color: rgba(212,175,55,0.3); }
.stat-value { font-size: 36px; font-weight: 700; color: #d4af37; display: block; margin-bottom: 4px; }
.stat-label { font-size: 13px; color: rgba(255,255,255,0.5); }

.list-section { padding: 0 16px; }
.list-title { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.7); margin-bottom: 8px; }
.list-item { padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: 8px; margin-bottom: 6px; font-size: 14px; color: #fff; }
.list-empty { padding: 12px; text-align: center; color: rgba(255,255,255,0.3); font-size: 13px; }

.generate-btn { margin: 40px 16px; height: 50px; background: linear-gradient(135deg, #d4af37, #ffd700); border-radius: 25px; display: flex; align-items: center; justify-content: center; }
.generate-btn text { font-size: 16px; font-weight: 600; color: #000; }
</style>
