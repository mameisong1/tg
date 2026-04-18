<template>
  <view class="page">
    <!-- 固定顶部 -->
    <view class="fixed-area">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="fixed-header">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">‹</text>
        </view>
        <text class="header-title">我的奖罚</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>
    
    <view class="container">
      <!-- 筛选栏 -->
      <view class="filter-section">
        <view class="filter-row">
          <text class="filter-label">时间</text>
          <view class="filter-btns">
            <view class="filter-btn" :class="{ active: dateFilter === 'this' }" @click="setDateFilter('this')">本月</view>
            <view class="filter-btn" :class="{ active: dateFilter === 'last' }" @click="setDateFilter('last')">上月</view>
          </view>
        </view>
      </view>
      
      <!-- 统计栏 -->
      <view class="stats-bar" v-if="records.length > 0">
        <view class="stat-item">
          <text class="stat-label">奖金</text>
          <text class="stat-value positive">+¥{{ bonusTotal.toFixed(2) }}</text>
        </view>
        <view class="stat-item">
          <text class="stat-label">罚金</text>
          <text class="stat-value negative">-¥{{ penaltyTotal.toFixed(2) }}</text>
        </view>
        <view class="stat-item">
          <text class="stat-label">净额</text>
          <text class="stat-value" :class="netTotal >= 0 ? 'positive' : 'negative'">¥{{ netTotal.toFixed(2) }}</text>
        </view>
      </view>
      
      <!-- 明细列表 -->
      <view class="record-list">
        <view class="record-item" v-for="r in records" :key="r.id">
          <view class="record-header">
            <text class="record-type">{{ r.type }}</text>
            <text class="record-amount" :class="r.amount >= 0 ? 'positive' : 'negative'">
              {{ r.amount >= 0 ? '+' : '' }}¥{{ r.amount.toFixed(2) }}
            </text>
          </view>
          <view class="record-footer">
            <text class="record-date">{{ r.confirm_date }}</text>
            <text class="record-status" :class="r.exec_status === '已执行' ? 'executed' : 'pending'">{{ r.exec_status }}</text>
          </view>
          <view class="record-remark" v-if="r.remark">{{ r.remark }}</view>
        </view>
      </view>
      
      <view class="empty-state" v-if="!loading && records.length === 0">
        <text class="empty-icon">📭</text>
        <text class="empty-text">暂无奖罚记录</text>
      </view>
      
      <view class="loading" v-if="loading">加载中...</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/utils/api.js'

const statusBarHeight = ref(0)
const records = ref([])
const loading = ref(false)
const dateFilter = ref('this')
const userPhone = ref('')

// 统计
const bonusTotal = computed(() => records.value.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0))
const penaltyTotal = computed(() => records.value.filter(r => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0))
const netTotal = computed(() => records.value.reduce((s, r) => s + r.amount, 0))

// 查询月份
const queryMonth = computed(() => {
  const now = new Date()
  if (dateFilter.value === 'this') {
    return now.toISOString().slice(0, 7)
  } else {
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return last.toISOString().slice(0, 7)
  }
})

function goBack() {
  uni.navigateBack()
}

function setDateFilter(val) {
  dateFilter.value = val
  loadRecords()
}

async function loadRecords() {
  loading.value = true
  try {
    const params = {
      phone: userPhone.value,
      confirmDate: queryMonth.value
    }
    
    const res = await api.getRewardPenaltyList(params)
    if (res.success) {
      records.value = res.data || []
    }
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function detectUserPhone() {
  // 尝试从 adminInfo 获取
  const adminInfo = uni.getStorageSync('adminInfo')
  if (adminInfo && adminInfo.username) {
    userPhone.value = adminInfo.username
    return
  }
  
  // 尝试从 coachInfo 获取
  const coachInfo = uni.getStorageSync('coachInfo')
  if (coachInfo && coachInfo.phone) {
    userPhone.value = coachInfo.phone
    return
  }
}

onMounted(() => {
  const sysInfo = uni.getSystemInfoSync()
  statusBarHeight.value = sysInfo.statusBarHeight || 0
  
  detectUserPhone()
  
  if (!userPhone.value) {
    uni.showToast({ title: '未登录', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 1500)
    return
  }
  
  loadRecords()
})
</script>

<style scoped>
.page {
  background: #0a0a0f;
  min-height: 100vh;
  color: #fff;
}
.fixed-area { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: #0a0a0f; }
.fixed-header {
  display: flex; align-items: center; justify-content: space-between;
  height: 44px; padding: 0 12px;
}
.back-btn { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
.back-icon { font-size: 24px; color: #d4af37; }
.header-title { font-size: 17px; font-weight: 600; }
.back-placeholder { width: 44px; }
.container { padding: 16px; }

.filter-section {
  background: rgba(20,20,30,0.8); border-radius: 12px; padding: 16px; margin-bottom: 16px;
  border: 1px solid rgba(218,165,32,0.1);
}
.filter-row { display: flex; align-items: center; margin-bottom: 10px; }
.filter-row:last-child { margin-bottom: 0; }
.filter-label { font-size: 13px; color: rgba(255,255,255,0.5); margin-right: 10px; min-width: 40px; }
.filter-btns { display: flex; gap: 6px; flex-wrap: wrap; }
.filter-btn {
  padding: 5px 12px; font-size: 12px; background: rgba(255,255,255,0.05);
  border-radius: 16px; color: rgba(255,255,255,0.6);
}
.filter-btn.active { background: rgba(212,175,55,0.2); color: #d4af37; }

.stats-bar {
  display: flex; justify-content: space-around; background: rgba(20,20,30,0.8);
  border-radius: 12px; padding: 16px; margin-bottom: 16px;
  border: 1px solid rgba(218,165,32,0.1);
}
.stat-item { text-align: center; }
.stat-label { font-size: 11px; color: rgba(255,255,255,0.4); display: block; }
.stat-value { font-size: 18px; font-weight: 700; margin-top: 4px; display: block; }
.stat-value.positive { color: #4caf50; }
.stat-value.negative { color: #e74c3c; }

.record-list { display: flex; flex-direction: column; gap: 10px; }
.record-item {
  background: rgba(20,20,30,0.6); border-radius: 12px; padding: 14px;
  border: 1px solid rgba(218,165,32,0.08);
}
.record-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.record-type { font-size: 14px; font-weight: 600; color: #d4af37; }
.record-amount { font-size: 16px; font-weight: 700; }
.record-amount.positive { color: #4caf50; }
.record-amount.negative { color: #e74c3c; }
.record-footer { display: flex; justify-content: space-between; align-items: center; }
.record-date { font-size: 12px; color: rgba(255,255,255,0.4); }
.record-status { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
.record-status.executed { background: rgba(76,175,80,0.2); color: #4caf50; }
.record-status.pending { background: rgba(255,193,7,0.2); color: #ffc107; }
.record-remark { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 6px; }

.empty-state { text-align: center; padding: 60px 20px; }
.empty-icon { font-size: 48px; display: block; margin-bottom: 12px; }
.empty-text { font-size: 14px; color: rgba(255,255,255,0.4); }
.loading { text-align: center; padding: 20px; color: rgba(255,255,255,0.4); }
</style>
