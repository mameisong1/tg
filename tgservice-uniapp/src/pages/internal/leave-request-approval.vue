<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">请假审批</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- QA-20260420-4: 时间段提示栏 -->
    <view class="time-notice" :class="timeNoticeClass">
      <text class="notice-icon">{{ timeNoticeIcon }}</text>
      <text class="notice-text">{{ timeNoticeText }}</text>
    </view>

    <!-- 标签页 -->
    <view class="tabs">
      <view class="tab-item" :class="{ active: activeTab === 'pending' }" @click="switchTab('pending')">
        <text>等待审批</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'approved' }" @click="switchTab('approved')">
        <text>已同意</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'rejected' }" @click="switchTab('rejected')">
        <text>已拒绝</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'cancelled' }" @click="switchTab('cancelled')">
        <text>已撤销</text>
      </view>
    </view>

    <!-- 待审批列表 -->
    <view class="list-section" v-if="activeTab === 'pending'">
      <view class="app-card" v-for="app in pendingList" :key="app.id">
        <view class="app-header">
          <text class="app-type">请假申请</text>
          <text class="app-status status-0">待处理</text>
        </view>
        <view class="app-body">
          <view class="info-row">
            <text class="info-label">助教工号</text>
            <text class="info-value">{{ app.employee_id || '-' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">艺名</text>
            <text class="info-value">{{ app.stage_name || '未知' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">请假类型</text>
            <text class="info-value">{{ getLeaveType(app) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">请假日期</text>
            <text class="info-value">{{ getLeaveDate(app) }}</text>
          </view>
          <!-- 预计休息人数高亮行 -->
          <view class="info-row highlight-row">
            <text class="info-label">预计休息人数</text>
            <text class="info-value highlight">{{ getDayRestCount(app) }} 人</text>
          </view>
          <text class="app-remark" v-if="app.remark">理由：{{ app.remark }}</text>
          <!-- 照片 -->
          <scroll-view v-if="getImageUrls(app).length > 0" class="image-scroll" scroll-x>
            <image 
              v-for="(url, idx) in getImageUrls(app)" 
              :key="idx" 
              :src="url" 
              mode="aspectFill" 
              class="app-image-thumb" 
              @click="previewImages(app, idx)" 
            />
          </scroll-view>
          <text class="app-time">{{ app.created_at }}</text>
        </view>
        <view class="app-actions">
          <view class="action-btn reject" @click="approve(app.id, 2)"><text>拒绝</text></view>
          <view class="action-btn approve" @click="approve(app.id, 1)"><text>同意</text></view>
        </view>
      </view>
      <view class="empty" v-if="pendingList.length === 0"><text>暂无待审批申请</text></view>
    </view>

    <!-- 已同意列表（带撤销按钮） -->
    <view class="list-section" v-if="activeTab === 'approved'">
      <view class="result-card" v-for="item in approvedList" :key="item.id">
        <view class="result-row">
          <text class="result-label">助教工号</text>
          <text class="result-value">{{ item.employee_id || '-' }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">艺名</text>
          <text class="result-value">{{ item.stage_name }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">请假类型</text>
          <text class="result-value">{{ getLeaveType(item) }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">请假日期</text>
          <text class="result-value">{{ getLeaveDate(item) }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">审批结果</text>
          <text class="result-value text-approved">已同意</text>
        </view>
        <view class="result-row result-time">
          <text class="result-label">审批时间</text>
          <text class="result-value">{{ item.approve_time || item.created_at }}</text>
        </view>
        <!-- 撤销按钮 -->
        <view v-if="canCancel(item)" class="cancel-btn-wrap">
          <view class="cancel-btn" @click="cancelApproved(item)">
            <text>撤销申请</text>
          </view>
        </view>
      </view>
      <view class="empty" v-if="approvedList.length === 0">
        <text>暂无记录</text>
      </view>
    </view>

    <!-- 已拒绝列表 -->
    <view class="list-section" v-if="activeTab === 'rejected'">
      <view class="result-card" v-for="item in approvedList" :key="item.id">
        <view class="result-row">
          <text class="result-label">助教工号</text>
          <text class="result-value">{{ item.employee_id || '-' }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">艺名</text>
          <text class="result-value">{{ item.stage_name }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">请假类型</text>
          <text class="result-value">{{ getLeaveType(item) }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">请假日期</text>
          <text class="result-value">{{ getLeaveDate(item) }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">审批结果</text>
          <text class="result-value text-rejected">已拒绝</text>
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

    <!-- 已撤销列表 -->
    <view class="list-section" v-if="activeTab === 'cancelled'">
      <view class="result-card" v-for="item in cancelledList" :key="item.id">
        <view class="result-row">
          <text class="result-label">助教工号</text>
          <text class="result-value">{{ item.employee_id || '-' }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">艺名</text>
          <text class="result-value">{{ item.stage_name }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">请假类型</text>
          <text class="result-value">{{ getLeaveType(item) }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">请假日期</text>
          <text class="result-value">{{ getLeaveDate(item) }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">审批结果</text>
          <text class="result-value text-cancelled">已撤销</text>
        </view>
        <view class="result-row result-time">
          <text class="result-label">更新时间</text>
          <text class="result-value">{{ item.updated_at }}</text>
        </view>
      </view>
      <view class="empty" v-if="cancelledList.length === 0">
        <text>暂无记录</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/utils/api.js'

const statusBarHeight = ref(0)
const adminInfo = ref({})
const activeTab = ref('pending')
const serverHour = ref(null)

const pendingList = ref([])
const approvedList = ref([])
const cancelledList = ref([])

// 预计休息人数缓存（按日期）
const dayRestCountCache = ref({})

// QA-20260420-4: 时间段提示栏 computed
const timeNoticeClass = computed(() => {
  const hour = serverHour.value !== null ? serverHour.value : new Date().getHours()
  return hour >= 12 && hour < 18 ? 'success' : 'error'
})
const timeNoticeIcon = computed(() => {
  const hour = serverHour.value !== null ? serverHour.value : new Date().getHours()
  return hour >= 12 && hour < 18 ? '✅' : '❌'
})
const timeNoticeText = computed(() => {
  const hour = serverHour.value !== null ? serverHour.value : new Date().getHours()
  return hour >= 12 && hour < 18 ? '审批时间：12:00 - 18:00' : '审批时间仅限 12:00 - 18:00'
})

onMounted(async () => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  adminInfo.value = uni.getStorageSync('adminInfo') || {}
  await fetchServerHour()
  loadData()
})

async function fetchServerHour() {
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL
    const res = await new Promise((resolve, reject) => {
      uni.request({
        url: baseUrl + '/server-time', method: 'GET',
        success: (r) => r.statusCode === 200 ? resolve(r.data) : reject(new Error('请求失败')),
        fail: reject
      })
    })
    serverHour.value = res.hour
  } catch (e) { serverHour.value = new Date().getHours() }
}

const switchTab = (tab) => {
  activeTab.value = tab
  loadData()
}

const loadData = async () => {
  if (activeTab.value === 'pending') {
    await loadPendingWithRestCount()
  } else if (activeTab.value === 'cancelled') {
    await loadCancelled()
  } else {
    await loadApprovedRecent()
  }
}

const loadPending = async () => {
  try {
    const res = await api.applications.getList({ application_type: '请假申请', status: 0, limit: 50 })
    pendingList.value = res.data || []
  } catch (e) { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

const loadApprovedRecent = async () => {
  try {
    const status = activeTab.value === 'approved' ? 1 : 2
    const params = {
      application_types: '请假申请',
      status: status
    }
    // 已同意标签：显示所有日期>=今天的已审批记录，按日期升序
    if (activeTab.value === 'approved') {
      params.future_only = true
    } else {
      params.days = 2
    }
    const res = await api.applications.getApprovedRecent(params)
    approvedList.value = res.data || []
  } catch (e) { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

// 加载已撤销列表
const loadCancelled = async () => {
  try {
    const res = await api.applications.getList({
      application_type: '请假申请',
      status: 3,
      limit: 50
    })
    cancelledList.value = res.data || []
  } catch (e) { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

// 判断是否可撤销：当前时间 < 请假日期 12:00
const canCancel = (item) => {
  const leaveDate = getLeaveDate(item)
  if (!leaveDate || leaveDate === '-') return false

  const deadline = new Date(leaveDate + ' 12:00:00+08:00')
  const now = new Date()
  return now.getTime() < deadline.getTime()
}

// 撤销申请
const cancelApproved = async (item) => {
  const leaveDate = getLeaveDate(item)
  uni.showModal({
    title: '确认撤销',
    content: `确定撤销 ${item.stage_name} 的请假申请（${leaveDate}）？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await api.applications.cancelApproved(item.id)
          uni.showToast({ title: '撤销成功', icon: 'success' })
          loadData()
        } catch (e) { uni.showToast({ title: e.error || '撤销失败', icon: 'none' }) }
      }
    }
  })
}

const getLeaveType = (app) => {
  try {
    const ed = JSON.parse(app.extra_data || '{}')
    return ed.leave_type || '-'
  } catch (e) {
    return '-'
  }
}

const getLeaveDate = (app) => {
  try {
    const ed = JSON.parse(app.extra_data || '{}')
    return ed.leave_date || '-'
  } catch (e) {
    return '-'
  }
}

// 获取预计休息人数（当天已同意的请假+休息人数）
const getDayRestCount = (app) => {
  try {
    const ed = JSON.parse(app.extra_data || '{}')
    const date = ed.leave_date
    if (!date) return '-'
    // 从缓存获取
    return dayRestCountCache.value[date] || 0
  } catch (e) {
    return '-'
  }
}

// 加载待处理列表时，预加载休息人数
const loadPendingWithRestCount = async () => {
  try {
    const res = await api.applications.getList({ application_type: '请假申请', status: 0, limit: 50 })
    pendingList.value = res.data || []
    
    // 预加载每条申请日期的休息人数
    const dates = new Set()
    for (const app of pendingList.value) {
      try {
        const ed = JSON.parse(app.extra_data || '{}')
        if (ed.leave_date) dates.add(ed.leave_date)
      } catch (e) {}
    }
    
    // 并行请求每个日期的休息人数
    for (const date of dates) {
      try {
        const countRes = await api.leaveCalendar.getDayCount(date)
        if (countRes.success) {
          dayRestCountCache.value[date] = countRes.data.count
        }
      } catch (e) {}
    }
  } catch (e) { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

const getImageUrls = (record) => {
  if (record.images) {
    try {
      const imgs = typeof record.images === 'string' ? JSON.parse(record.images) : record.images
      if (Array.isArray(imgs)) return imgs
    } catch (e) {}
  }
  return []
}

const previewImages = (record, idx) => {
  uni.previewImage({ urls: getImageUrls(record), current: idx })
}

const approve = async (id, status) => {
  const msg = status === 1 ? '同意' : '拒绝'
  uni.showModal({ title: `确认${msg}`, content: `确定${msg}该申请？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await api.applications.approve(id, { approver_phone: adminInfo.value.username, status })
          uni.showToast({ title: '操作成功', icon: 'success' })
          loadData()
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

/* QA-20260420-4: 提示栏样式 */
.time-notice { margin: 12px 16px; padding: 12px 16px; border-radius: 8px; display: flex; align-items: center; gap: 8px; }
.time-notice.success { background: rgba(46,204,113,0.15); border: 1px solid rgba(46,204,113,0.3); }
.time-notice.error { background: rgba(231,76,60,0.15); border: 1px solid rgba(231,76,60,0.3); }
.notice-icon { font-size: 16px; }
.notice-text { font-size: 13px; color: rgba(255,255,255,0.8); }

.tabs { display: flex; padding: 0 16px; gap: 8px; margin-bottom: 12px; }
.tab-item { flex: 1; height: 36px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; }
.tab-item text { font-size: 13px; color: rgba(255,255,255,0.5); }
.tab-item.active { background: rgba(212,175,55,0.15); border-color: rgba(212,175,55,0.4); }
.tab-item.active text { color: #d4af37; font-weight: 600; }

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
.highlight-row { background: rgba(241,196,15,0.15); border-radius: 6px; padding: 6px 8px; margin: 4px 0; }
.highlight-row .info-label { color: #f1c40f; }
.highlight { color: #f1c15f !important; font-weight: 600; }
.app-remark { font-size: 13px; color: rgba(255,255,255,0.6); }
.app-time { font-size: 11px; color: rgba(255,255,255,0.3); }

.app-image-thumb { width: 60px; height: 60px; border-radius: 6px; margin-right: 6px; margin-top: 6px; flex-shrink: 0; }
.image-scroll { margin-top: 6px; white-space: nowrap; }

.app-actions { display: flex; gap: 12px; margin-top: 12px; }
.action-btn { flex: 1; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 500; }
.action-btn.reject { background: rgba(231,76,60,0.15); border: 1px solid rgba(231,76,60,0.3); color: #e74c3c; }
.action-btn.approve { background: rgba(46,204,113,0.15); border: 1px solid rgba(46,204,113,0.3); color: #2ecc71; }

.result-card { background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.result-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; }
.result-row:not(:last-child) { border-bottom: 1px solid rgba(255,255,255,0.05); }
.result-label { font-size: 13px; color: rgba(255,255,255,0.5); }
.result-value { font-size: 13px; color: #fff; font-weight: 500; }
.text-approved { color: #2ecc71 !important; }
.text-rejected { color: #e74c3c !important; }
.text-cancelled { color: #f39c12 !important; }
.result-time .result-label, .result-time .result-value { font-size: 11px; color: rgba(255,255,255,0.3); }

.cancel-btn-wrap { margin-top: 12px; }
.cancel-btn { height: 40px; background: rgba(231,76,60,0.15); border: 1px solid rgba(231,76,60,0.3); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.cancel-btn text { font-size: 14px; font-weight: 500; color: #e74c3c; }

.empty { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.3); }
</style>
