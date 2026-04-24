<template>
  <view class="page">
    <!-- 固定头部 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">乐捐一览</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 统计卡片 -->
    <view class="stats-row">
      <view class="stat-card stat-active">
        <text class="stat-num">{{ statActive }}</text>
        <text class="stat-label">乐捐中</text>
      </view>
      <view class="stat-card stat-pending">
        <text class="stat-num">{{ statPending }}</text>
        <text class="stat-label">待出发</text>
      </view>
      <view class="stat-card stat-returned">
        <text class="stat-num">{{ statReturned }}</text>
        <text class="stat-label">已归来</text>
      </view>
    </view>

    <!-- 筛选栏 -->
    <view class="filter-bar">
      <picker :range="statusOptions" @change="onStatusChange">
        <view class="filter-picker">
          <text class="filter-text">{{ statusDisplay }}</text>
          <text class="filter-arrow">▼</text>
        </view>
      </picker>
      <picker :range="daysOptions" @change="onDaysChange">
        <view class="filter-picker">
          <text class="filter-text">{{ daysDisplay }}</text>
          <text class="filter-arrow">▼</text>
        </view>
      </picker>
      <view class="filter-refresh" @click="loadData">
        <text class="refresh-icon">↻</text>
      </view>
    </view>

    <!-- 记录列表 -->
    <view class="list-section" v-if="recordList.length > 0">
      <view class="lj-card" v-for="item in recordList" :key="item.id">
        <!-- 头部：艺名 + 状态 -->
        <view class="lj-header">
          <view class="lj-name-row">
            <text class="lj-name">{{ item.stage_name || '未知' }}</text>
            <text class="lj-id">{{ item.employee_id || '-' }}</text>
          </view>
          <text class="lj-badge" :class="'badge-' + item.lejuan_status">{{ statusLabel(item.lejuan_status) }}</text>
        </view>

        <!-- 详细信息 -->
        <view class="lj-info-grid">
          <view class="lj-info-item">
            <text class="lj-info-label">预约时间</text>
            <text class="lj-info-value">{{ formatTime(item.scheduled_start_time) }}</text>
          </view>
          <view class="lj-info-item" v-if="item.shift">
            <text class="lj-info-label">班次</text>
            <text class="lj-info-value">{{ item.shift }}</text>
          </view>
          <view class="lj-info-item" v-if="item.extra_hours">
            <text class="lj-info-label">预计</text>
            <text class="lj-info-value">{{ item.extra_hours }}小时</text>
          </view>
          <view class="lj-info-item" v-if="item.actual_start_time">
            <text class="lj-info-label">实际开始</text>
            <text class="lj-info-value">{{ formatTimeShort(item.actual_start_time) }}</text>
          </view>
          <view class="lj-info-item" v-if="item.return_time">
            <text class="lj-info-label">归来时间</text>
            <text class="lj-info-value">{{ formatTimeShort(item.return_time) }}</text>
          </view>
          <view class="lj-info-item dingtalk-item" v-if="item.dingtalk_out_time">
            <text class="lj-info-label dingtalk-label">钉钉外出</text>
            <text class="lj-info-value dingtalk-value">{{ formatTimeShort(item.dingtalk_out_time) }}</text>
          </view>
          <view class="lj-info-item dingtalk-item" v-if="item.dingtalk_return_time">
            <text class="lj-info-label dingtalk-label">钉钉归来</text>
            <text class="lj-info-value dingtalk-value">{{ formatTimeShort(item.dingtalk_return_time) }}</text>
          </view>
          <view class="lj-info-item" v-if="item.lejuan_hours !== null && item.lejuan_hours !== undefined">
            <text class="lj-info-label">乐捐小时</text>
            <text class="lj-info-value highlight">{{ item.lejuan_hours }}小时</text>
          </view>
        </view>

        <!-- 备注 -->
        <text class="lj-remark" v-if="item.remark">{{ item.remark }}</text>

        <!-- 付款截图 -->
        <view class="lj-proof" v-if="getProofUrls(item).length > 0">
          <text class="lj-proof-label">付款截图 ({{ getProofUrls(item).length }}张)</text>
          <view class="proof-thumbs">
            <image
              v-for="(url, idx) in getProofUrls(item)"
              :key="idx"
              :src="url"
              mode="aspectFill"
              class="lj-proof-thumb"
              @click="previewProofImages(item, idx)"
            />
          </view>
        </view>

        <!-- 乐捐归来按钮（仅店长/管理员/助教管理/教练可见） -->
        <view class="lj-actions" v-if="item.lejuan_status === 'active' && canReturnLejuan">
          <view class="lj-btn-return" @click="handleReturnLejuan(item)" @click.stop>
            <text class="lj-btn-text">乐捐归来</text>
          </view>
        </view>

      </view>
    </view>
    <view class="empty" v-else-if="!loading"><text>暂无乐捐记录</text></view>
    <view class="empty" v-else><text>加载中...</text></view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/utils/api.js'

const statusBarHeight = ref(0)
const recordList = ref([])
const loading = ref(false)
const statusFilter = ref('all')
const daysFilter = ref(3)
const adminInfo = ref({})

const statusOptions = ref(['全部状态', '乐捐中', '待出发', '已归来'])
const statusMap = { '全部状态': 'all', '乐捐中': 'active', '待出发': 'pending', '已归来': 'returned' }
const statusMapReverse = { 'all': '全部状态', 'active': '乐捐中', 'pending': '待出发', 'returned': '已归来' }

const daysOptions = ref(['近1天', '近3天', '近7天'])
const daysMap = { '近1天': 1, '近3天': 3, '近7天': 7 }
const daysMapReverse = { 1: '近1天', 3: '近3天', 7: '近7天' }

const statusDisplay = computed(() => statusMapReverse[statusFilter.value])
const daysDisplay = computed(() => daysMapReverse[daysFilter.value])

// 权限判断（店长/管理员/助教管理/教练可以使用乐捐归来按钮）
const canReturnLejuan = computed(() => {
  return ['店长', '管理员', '助教管理', '教练'].includes(adminInfo.value.role)
})

// 统计
const statActive = computed(() => recordList.value.filter(r => r.lejuan_status === 'active').length)
const statPending = computed(() => recordList.value.filter(r => r.lejuan_status === 'pending').length)
const statReturned = computed(() => recordList.value.filter(r => r.lejuan_status === 'returned').length)

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  adminInfo.value = uni.getStorageSync('adminInfo') || {}
  loadData()
})

const loadData = async () => {
  loading.value = true
  try {
    const res = await api.lejuanRecords.getList({ status: statusFilter.value, days: daysFilter.value })
    recordList.value = res.data || []
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const onStatusChange = (e) => {
  statusFilter.value = statusMap[statusOptions.value[e.detail.value]]
  loadData()
}

const onDaysChange = (e) => {
  daysFilter.value = daysMap[daysOptions.value[e.detail.value]]
  loadData()
}

const statusLabel = (status) => {
  const map = { pending: '待出发', active: '乐捐中', returned: '已归来' }
  return map[status] || status
}

const formatTime = (t) => {
  if (!t) return '-'
  return t.replace('T', ' ').substring(5, 16)
}

const formatTimeShort = (t) => {
  if (!t) return '-'
  return t.replace('T', ' ').substring(5, 16)
}

// 解析 proof_image_url 为 URL 数组
const getProofUrls = (item) => {
  if (!item.proof_image_url) return []
  try {
    const parsed = JSON.parse(item.proof_image_url)
    return Array.isArray(parsed) ? parsed : [item.proof_image_url]
  } catch (e) {
    return [item.proof_image_url]
  }
}

// 预览多张截图
const previewProofImages = (item, idx) => {
  const urls = getProofUrls(item)
  uni.previewImage({ urls, current: idx })
}

const previewProof = (url) => {
  uni.previewImage({ urls: [url] })
}

// 乐捐归来
const handleReturnLejuan = async (item) => {
  const localAdminInfo = uni.getStorageSync('adminInfo') || {}
  if (!['店长', '管理员', '助教管理', '教练'].includes(localAdminInfo.role)) {
    uni.showToast({ title: '权限不足', icon: 'none' })
    return
  }
  
  uni.showModal({
    title: '确认操作',
    content: `确定结束 ${item.stage_name} 的乐捐吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          const result = await api.lejuanRecords.returnRecord(item.id, { operator: localAdminInfo.username })
          uni.showToast({ title: '乐捐归来成功', icon: 'success' })
          loadData() // 刷新列表
        } catch (e) {
          uni.showToast({ title: e.error || '操作失败', icon: 'none' })
        }
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

/* 统计卡片 */
.stats-row { display: flex; gap: 10px; padding: 12px 16px; }
.stat-card { flex: 1; background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 10px; padding: 12px 8px; text-align: center; }
.stat-num { display: block; font-size: 22px; font-weight: 600; }
.stat-label { display: block; font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 4px; }
.stat-active .stat-num { color: #e74c3c; }
.stat-pending .stat-num { color: #f1c40f; }
.stat-returned .stat-num { color: #2ecc71; }

/* 筛选栏 */
.filter-bar { display: flex; gap: 8px; padding: 0 16px 12px; align-items: center; }
.filter-picker { flex: 1; height: 36px; display: flex; align-items: center; justify-content: center; gap: 4px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; overflow: hidden; padding: 0 8px; min-width: 0; }
.filter-text { font-size: 13px; color: rgba(255,255,255,0.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.filter-arrow { font-size: 10px; color: rgba(255,255,255,0.3); flex-shrink: 0; }
.filter-refresh { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: rgba(212,175,55,0.15); border: 1px solid rgba(212,175,55,0.3); border-radius: 8px; }
.refresh-icon { font-size: 18px; color: #d4af37; }

/* 记录列表 */
.list-section { padding: 0 16px; }
.lj-card { background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; }

/* 头部 */
.lj-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.lj-name-row { display: flex; align-items: baseline; gap: 8px; }
.lj-name { font-size: 15px; font-weight: 600; color: #d4af37; }
.lj-id { font-size: 11px; color: rgba(255,255,255,0.3); }
.lj-badge { font-size: 11px; font-weight: 500; padding: 3px 8px; border-radius: 10px; }
.badge-pending { background: rgba(241,196,15,0.2); color: #f1c40f; }
.badge-active { background: rgba(231,76,60,0.2); color: #e74c3c; }
.badge-returned { background: rgba(46,204,113,0.2); color: #2ecc71; }

/* 信息网格 */
.lj-info-grid { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 8px; }
.lj-info-item { display: flex; flex-direction: column; min-width: 80px; }
.lj-info-label { font-size: 10px; color: rgba(255,255,255,0.4); margin-bottom: 2px; }
.lj-info-value { font-size: 12px; color: rgba(255,255,255,0.7); }
.lj-info-value.highlight { color: #2ecc71; font-weight: 600; }

/* 钉钉时间样式 */
.dingtalk-item { background: rgba(255,165,0,0.08); border-radius: 4px; padding: 2px 4px; }
.dingtalk-label { color: rgba(255,165,0,0.8); }
.dingtalk-value { color: #FFA500; font-weight: 500; }

/* 备注 */
.lj-remark { font-size: 12px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 8px; line-height: 1.4; }

/* 付款截图 */
.lj-proof { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 8px; }
.lj-proof-label { font-size: 11px; color: rgba(255,255,255,0.4); }
.proof-thumbs { display: flex; gap: 6px; margin-top: 4px; }
.lj-proof-thumb { width: 50px; height: 50px; border-radius: 6px; }

/* 操作按钮 */
.lj-actions { display: flex; justify-content: flex-end; margin-top: 4px; }
.lj-btn-return { padding: 8px 16px; background: rgba(46,204,113,0.2); border: 1px solid rgba(46,204,113,0.3); border-radius: 8px; }
.lj-btn-text { font-size: 13px; color: #2ecc71; font-weight: 500; }

/* 空状态 */
.empty { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.3); }
</style>
