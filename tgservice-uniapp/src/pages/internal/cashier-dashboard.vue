<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">收银看板</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 标签页 -->
    <view class="tabs">
      <view class="tab" :class="{ active: activeTab === 'pending' }" @click="activeTab = 'pending'">
        <text>待处理</text>
        <text class="tab-count" v-if="pendingCount > 0">{{ pendingCount }}</text>
      </view>
      <view class="tab" :class="{ active: activeTab === 'completed' }" @click="activeTab = 'completed'">
        <text>已完成</text>
      </view>
      <view class="tab" :class="{ active: activeTab === 'cancelled' }" @click="activeTab = 'cancelled'">
        <text>已取消</text>
      </view>
    </view>

    <!-- 三列布局 -->
    <view class="columns">
      <!-- 服务单列 -->
      <view class="column">
        <view class="column-header">
          <text class="column-title">服务单</text>
          <text class="column-count">{{ serviceOrders.length }}</text>
        </view>
        <scroll-view class="column-body" scroll-y>
          <view class="order-card" v-for="order in serviceOrders" :key="'s' + order.id">
            <view class="card-header">
              <text class="card-table">{{ order.table_no }}</text>
              <text class="card-status" :class="'status-' + order.status">{{ order.status }}</text>
            </view>
            <text class="card-requirement">{{ order.requirement }}</text>
            <text class="card-requester">{{ order.requester_name }} · {{ order.requester_type }}</text>
            <text class="card-time">{{ order.created_at }}</text>
            <view class="card-actions" v-if="order.status === '待处理'">
              <view class="mini-btn cancel" @click="updateServiceOrder(order.id, '已取消')"><text>取消</text></view>
              <view class="mini-btn complete" @click="updateServiceOrder(order.id, '已完成')"><text>完成</text></view>
            </view>
          </view>
          <view class="empty-col" v-if="serviceOrders.length === 0"><text>暂无</text></view>
        </scroll-view>
      </view>

      <!-- 上下桌单列 -->
      <view class="column">
        <view class="column-header">
          <text class="column-title">上下桌单</text>
          <text class="column-count">{{ tableOrders.length }}</text>
        </view>
        <scroll-view class="column-body" scroll-y>
          <view class="order-card" v-for="order in tableOrders" :key="'t' + order.id">
            <view class="card-header">
              <text class="card-table">{{ order.table_no }}</text>
              <text class="card-type">{{ order.order_type }}</text>
            </view>
            <text class="card-coach">{{ order.stage_name }} ({{ order.employee_id || '未知' }}号)</text>
            <text class="card-category" v-if="order.action_category">{{ order.action_category }}</text>
            <text class="card-status" :class="'status-' + order.status">{{ order.status }}</text>
            <text class="card-time">{{ order.created_at }}</text>
            <view class="card-actions" v-if="order.status === '待处理'">
              <view class="mini-btn cancel" @click="updateTableOrder(order.id, '已取消')"><text>取消</text></view>
              <view class="mini-btn complete" @click="updateTableOrder(order.id, '已完成')"><text>完成</text></view>
            </view>
          </view>
          <view class="empty-col" v-if="tableOrders.length === 0"><text>暂无</text></view>
        </scroll-view>
      </view>

      <!-- 商品订单列 -->
      <view class="column">
        <view class="column-header">
          <text class="column-title">商品订单</text>
          <text class="column-count">{{ productOrders.length }}</text>
        </view>
        <scroll-view class="column-body" scroll-y>
          <view class="order-card" v-for="order in productOrders" :key="'p' + order.id">
            <view class="card-header">
              <text class="card-table">{{ order.table_no }}</text>
              <text class="card-status" :class="'status-' + order.status">{{ order.status }}</text>
            </view>
            <view class="card-items">
              <text class="card-item" v-for="(item, idx) in order.items" :key="idx">
                {{ item.name }} x{{ item.quantity }}
              </text>
            </view>
            <text class="card-total">合计：¥{{ order.total_price }}</text>
            <text class="card-time">{{ order.created_at }}</text>
            <view class="card-actions" v-if="order.status === '待处理'">
              <view class="mini-btn cancel" @click="updateProductOrder(order.id, '已取消')"><text>取消</text></view>
              <view class="mini-btn complete" @click="updateProductOrder(order.id, '已完成')"><text>完成</text></view>
            </view>
          </view>
          <view class="empty-col" v-if="productOrders.length === 0"><text>暂无</text></view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import api from '@/utils/api.js'

const statusBarHeight = ref(0)
const activeTab = ref('pending')
const serviceOrders = ref([])
const tableOrders = ref([])
const productOrders = ref([])
let timer = null

// 获取昨天的日期（YYYY-MM-DD 格式）
const getYesterday = () => {
  const now = new Date()
  now.setDate(now.getDate() - 1)
  return now.toISOString().split('T')[0]
}

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  loadPendingData() // 首次加载待处理数据
  startAutoRefresh()
})

onUnmounted(() => { stopAutoRefresh() })

// 监听标签切换：已完成/已取消标签页停止自动刷新并加载对应数据
watch(activeTab, (newTab, oldTab) => {
  if (newTab === 'pending') {
    // 切换回待处理时：立刻刷新数据 + 启动定时器
    loadPendingData()
    startAutoRefresh()
  } else {
    // 切换到已完成/已取消时：停止定时器 + 加载对应数据
    stopAutoRefresh()
    loadData()
  }
})

const statusMap = { pending: '待处理', completed: '已完成', cancelled: '已取消' }

const startAutoRefresh = () => {
  stopAutoRefresh() // 先清除旧的定时器
  timer = setInterval(() => {
    // 只刷新待处理订单
    if (activeTab.value === 'pending') {
      loadPendingData()
    }
  }, 10000) // 每10秒刷新
}

const stopAutoRefresh = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

// 只加载待处理数据（用于自动刷新）
const loadPendingData = async () => {
  try {
    const [svc, tbl, prod] = await Promise.all([
      api.serviceOrders.getList({ status: '待处理', limit: 50 }),
      api.tableActionOrders.getList({ status: '待处理', limit: 50 }),
      api.productOrders.getList({ status: '待处理' })
    ])
    serviceOrders.value = svc.data || []
    tableOrders.value = tbl.data || []
    productOrders.value = prod || []
  } catch (e) {}
}

// 加载全部数据（用于标签切换和首次加载）
const loadData = async () => {
  const status = statusMap[activeTab.value]
  const yesterday = getYesterday()
  
  try {
    const [svc, tbl, prod] = await Promise.all([
      api.serviceOrders.getList({ status, date_start: yesterday, limit: 50 }),
      api.tableActionOrders.getList({ status, date_start: yesterday, limit: 50 }),
      api.productOrders.getList({ status, date_start: yesterday })
    ])
    serviceOrders.value = svc.data || []
    tableOrders.value = tbl.data || []
    productOrders.value = prod || []
  } catch (e) {}
}

const pendingCount = computed(() => 
  serviceOrders.value.filter(o => o.status === '待处理').length + 
  tableOrders.value.filter(o => o.status === '待处理').length + 
  productOrders.value.filter(o => o.status === '待处理').length
)

const updateServiceOrder = async (id, status) => {
  try {
    await api.serviceOrders.updateStatus(id, { status })
    uni.showToast({ title: '操作成功', icon: 'success' })
    loadData()
  } catch (e) { uni.showToast({ title: e.error || '操作失败', icon: 'none' }) }
}

const updateTableOrder = async (id, status) => {
  try {
    await api.tableActionOrders.updateStatus(id, { status })
    uni.showToast({ title: '操作成功', icon: 'success' })
    loadData()
  } catch (e) { uni.showToast({ title: e.error || '操作失败', icon: 'none' }) }
}

const updateProductOrder = async (id, status) => {
  try {
    if (status === '已完成') {
      await api.productOrders.complete(id)
    } else if (status === '已取消') {
      await api.productOrders.cancel(id)
    }
    uni.showToast({ title: '操作成功', icon: 'success' })
    loadData()
  } catch (e) { uni.showToast({ title: e.error || '操作失败', icon: 'none' }) }
}

const goBack = () => { const pages = getCurrentPages(); if (pages.length > 1) { uni.navigateBack() } else { uni.switchTab({ url: '/pages/member/member' }) } }
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

.tabs { display: flex; padding: 8px 16px; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.tab { flex: 1; height: 36px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 18px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; color: rgba(255,255,255,0.6); }
.tab.active { background: rgba(212,175,55,0.2); border-color: #d4af37; color: #d4af37; }
.tab-count { font-size: 11px; background: #e74c3c; color: #fff; padding: 2px 6px; border-radius: 10px; }

.columns { flex: 1; display: flex; gap: 8px; padding: 8px; min-height: 0; }
.column { flex: 1; display: flex; flex-direction: column; background: rgba(20,20,30,0.4); border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); }
.column-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.column-title { font-size: 13px; font-weight: 600; color: #d4af37; }
.column-count { font-size: 11px; color: rgba(255,255,255,0.4); }
.column-body { flex: 1; min-height: 0; padding: 8px; }

.order-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px; margin-bottom: 8px; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.card-table { font-size: 14px; font-weight: 600; color: #d4af37; }
.card-type { font-size: 11px; padding: 2px 8px; background: rgba(52,152,219,0.2); color: #3498db; border-radius: 10px; }
.card-status { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
.status-待处理 { background: rgba(241,196,15,0.2); color: #f1c40f; }
.status-已完成 { background: rgba(46,204,113,0.2); color: #2ecc71; }
.status-已取消 { background: rgba(231,76,60,0.2); color: #e74c3c; }
.card-requirement { font-size: 13px; color: #fff; margin-bottom: 4px; }
.card-requester { font-size: 11px; color: rgba(255,255,255,0.4); }
.card-coach { font-size: 13px; color: #fff; margin-bottom: 2px; }
.card-category { font-size: 11px; color: rgba(255,255,255,0.4); }
.card-time { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 4px; display: block; }
.card-actions { display: flex; gap: 8px; margin-top: 8px; }
.mini-btn { flex: 1; height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; }
.mini-btn.cancel { background: rgba(231,76,60,0.15); color: #e74c3c; }
.mini-btn.complete { background: rgba(46,204,113,0.15); color: #2ecc71; }
.card-items { margin-bottom: 4px; }
.card-item { font-size: 12px; color: rgba(255,255,255,0.7); display: block; margin-bottom: 2px; }
.card-total { font-size: 13px; color: #2ecc71; font-weight: 500; }
.empty-col { text-align: center; padding: 20px; color: rgba(255,255,255,0.2); font-size: 12px; }
</style>
