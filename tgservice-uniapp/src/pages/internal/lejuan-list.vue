<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">乐捐报备一览</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <view class="list-section" v-if="lejuanList.length > 0">
      <view class="lj-card" v-for="item in lejuanList" :key="item.id">
        <view class="lj-header">
          <text class="lj-name">{{ item.stage_name || '未知' }}</text>
          <text class="lj-hours">{{ item.hours }}小时</text>
        </view>
        <text class="lj-phone">{{ item.applicant_phone }}</text>
        <text class="lj-date">{{ item.date }}</text>
        <text class="lj-remark" v-if="item.remark">{{ item.remark }}</text>
      </view>
    </view>
    <view class="empty" v-else><text>暂无乐捐报备记录</text></view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api-v2.js'

const statusBarHeight = ref(0)
const lejuanList = ref([])

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  loadData()
})

const loadData = async () => {
  try {
    const res = await api.applications.getLejuanList({ days: 10 })
    lejuanList.value = res.data || []
  } catch (e) { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

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

.list-section { padding: 12px 16px; }
.lj-card { background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.lj-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.lj-name { font-size: 15px; font-weight: 600; color: #d4af37; }
.lj-hours { font-size: 14px; color: #f1c40f; font-weight: 600; }
.lj-phone { font-size: 12px; color: rgba(255,255,255,0.4); display: block; margin-bottom: 2px; }
.lj-date { font-size: 12px; color: rgba(255,255,255,0.4); display: block; margin-bottom: 2px; }
.lj-remark { font-size: 13px; color: rgba(255,255,255,0.6); display: block; }
.empty { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.3); }
</style>
