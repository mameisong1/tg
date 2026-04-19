<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">班次切换审批</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 班次统计 -->
    <view class="stats-bar">
      <view class="stat-item">
        <text class="stat-label">早班</text>
        <text class="stat-value">{{ shiftStats.early_shift }}人</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-label">晚班</text>
        <text class="stat-value">{{ shiftStats.late_shift }}人</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-label">总计</text>
        <text class="stat-value">{{ shiftStats.total }}人</text>
      </view>
    </view>

    <!-- 标签页 -->
    <view class="tabs">
      <view class="tab-item" :class="{ active: activeTab === 'pending' }" @click="switchTab('pending')">
        <text>等待审批 ({{ pendingCount }})</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'approved' }" @click="switchTab('approved')">
        <text>已同意</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'rejected' }" @click="switchTab('rejected')">
        <text>已拒绝</text>
      </view>
    </view>

    <!-- 待审批列表 -->
    <view class="list-section" v-if="activeTab === 'pending'">
      <view class="app-card" v-for="app in pendingList" :key="app.id">
        <view class="app-header">
          <text class="app-type">班次切换申请</text>
          <text class="app-status status-0">待处理</text>
        </view>
        <view class="app-body">
          <view class="info-row">
            <text class="info-label">助教工号</text>
            <text class="info-value">{{ getEmployeeId(app) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">艺名</text>
            <text class="info-value">{{ app.stage_name || '未知' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">当前班次 → 目标班次</text>
            <text class="info-value shift-change">{{ getCoachShift(app) }} → {{ getTargetShift(app) }}</text>
          </view>
          <text class="app-remark" v-if="app.remark">{{ app.remark }}</text>
          <text class="app-time">{{ app.created_at }}</text>
        </view>
        <view class="app-actions">
          <view class="action-btn reject" @click="approve(app.id, 2)"><text>拒绝</text></view>
          <view class="action-btn approve" @click="approve(app.id, 1)"><text>同意</text></view>
        </view>
      </view>
      <view class="empty" v-if="pendingList.length === 0"><text>暂无待审批申请</text></view>
    </view>

    <!-- 已同意/已拒绝列表 -->
    <view class="list-section" v-if="activeTab !== 'pending'">
      <view class="result-card" v-for="item in approvedList" :key="item.id">
        <view class="result-row">
          <text class="result-label">助教工号</text>
          <text class="result-value">{{ getEmployeeId(item) }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">艺名</text>
          <text class="result-value">{{ item.stage_name }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">班次变更</text>
          <text class="result-value">{{ getCoachShift(item) }} → {{ getTargetShift(item) }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">审批结果</text>
          <text class="result-value" :class="activeTab === 'approved' ? 'text-approved' : 'text-rejected'">
            {{ activeTab === 'approved' ? '已同意' : '已拒绝' }}
          </text>
        </view>
        <view class="result-row result-time">
          <text class="result-label">审批时间</text>
          <text class="result-value">{{ item.approve_time || item.created_at }}</text>
        </view>
      </view>
      <view class="empty" v-if="approvedList.length === 0">
        <text>暂无记录</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api-v2.js'

const statusBarHeight = ref(0)
const adminInfo = ref({})
const activeTab = ref('pending')

const pendingList = ref([])
const approvedList = ref([])
const shiftStats = ref({ early_shift: 0, late_shift: 0, total: 0 })
const pendingCount = ref(0)

onMounted(async () => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  adminInfo.value = uni.getStorageSync('adminInfo') || {}
  await loadShiftStats()
  await loadData()
})

const switchTab = (tab) => {
  activeTab.value = tab
  loadData()
}

const loadShiftStats = async () => {
  try {
    const res = await api.applications.getShiftStats()
    shiftStats.value = res.data || { early_shift: 0, late_shift: 0, total: 0 }
  } catch (e) {}
}

const loadData = async () => {
  if (activeTab.value === 'pending') {
    await loadPending()
  } else {
    await loadApprovedRecent()
  }
}

const loadPending = async () => {
  try {
    const res = await api.applications.getList({ application_type: '班次切换申请', status: 0, limit: 50 })
    pendingList.value = res.data || []
    pendingCount.value = pendingList.value.length
  } catch (e) { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

const loadApprovedRecent = async () => {
  try {
    const status = activeTab.value === 'approved' ? 1 : 2
    const res = await api.applications.getApprovedRecent({
      application_types: '班次切换申请',
      days: 2,
      status: status
    })
    approvedList.value = res.data || []
  } catch (e) { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

const getEmployeeId = (app) => {
  return app.employee_id || '-'
}

const getCoachShift = (app) => {
  return app.shift || '-'
}

const getTargetShift = (app) => {
  try {
    const ed = JSON.parse(app.extra_data || '{}')
    return ed.target_shift || '-'
  } catch (e) {
    return '-'
  }
}

const approve = async (id, status) => {
  const msg = status === 1 ? '同意' : '拒绝'
  uni.showModal({ title: `确认${msg}`, content: `确定${msg}该申请？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await api.applications.approve(id, { approver_phone: adminInfo.value.username, status })
          uni.showToast({ title: '操作成功', icon: 'success' })
          await loadShiftStats()
          await loadData()
        } catch (e) { uni.showToast({ title: e.error || '操作失败', icon: 'none' }) }
      }
    }
  })
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

/* 统计栏 */
.stats-bar { display: flex; align-items: center; justify-content: space-around; padding: 12px 16px; background: rgba(20,20,30,0.6); margin: 0 16px 12px; border-radius: 12px; border: 1px solid rgba(218,165,32,0.1); }
.stat-item { display: flex; flex-direction: column; align-items: center; }
.stat-label { font-size: 12px; color: rgba(255,255,255,0.5); }
.stat-value { font-size: 18px; font-weight: 600; color: #d4af37; margin-top: 2px; }
.stat-divider { width: 1px; height: 30px; background: rgba(255,255,255,0.1); }

/* 标签页 */
.tabs { display: flex; padding: 0 16px; gap: 8px; margin-bottom: 12px; }
.tab-item { flex: 1; height: 36px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; transition: all 0.2s; }
.tab-item text { font-size: 13px; color: rgba(255,255,255,0.5); }
.tab-item.active { background: rgba(212,175,55,0.15); border-color: rgba(212,175,55,0.4); }
.tab-item.active text { color: #d4af37; font-weight: 600; }

/* 列表 */
.list-section { padding: 0 16px; }
.app-card { background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.app-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.app-type { font-size: 15px; font-weight: 600; color: #d4af37; }
.app-status { font-size: 12px; padding: 4px 10px; border-radius: 12px; }
.status-0 { background: rgba(241,196,15,0.2); color: #f1c40f; }
.app-body { display: flex; flex-direction: column; gap: 4px; }
.info-row { display: flex; justify-content: space-between; align-items: center; }
.info-label { font-size: 12px; color: rgba(255,255,255,0.4); }
.info-value { font-size: 13px; color: #fff; font-weight: 500; }
.shift-change { color: #d4af37; font-weight: 600; }
.app-remark { font-size: 13px; color: rgba(255,255,255,0.6); }
.app-time { font-size: 11px; color: rgba(255,255,255,0.3); }
.app-actions { display: flex; gap: 12px; margin-top: 12px; }
.action-btn { flex: 1; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 500; }
.action-btn.reject { background: rgba(231,76,60,0.15); border: 1px solid rgba(231,76,60,0.3); color: #e74c3c; }
.action-btn.approve { background: rgba(46,204,113,0.15); border: 1px solid rgba(46,204,113,0.3); color: #2ecc71; }

/* 审批结果卡片 */
.result-card { background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.result-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; }
.result-row:not(:last-child) { border-bottom: 1px solid rgba(255,255,255,0.05); }
.result-label { font-size: 13px; color: rgba(255,255,255,0.5); }
.result-value { font-size: 13px; color: #fff; font-weight: 500; }
.text-approved { color: #2ecc71 !important; }
.text-rejected { color: #e74c3c !important; }
.result-time .result-label, .result-time .result-value { font-size: 11px; color: rgba(255,255,255,0.3); }

.empty { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.3); }
</style>
