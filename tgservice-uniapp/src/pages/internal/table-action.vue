<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">上桌/下桌</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 当前状态 -->
    <view class="status-section" v-if="waterBoard">
      <text class="status-label">当前状态</text>
      <view class="status-badge" :class="statusClass(waterBoard.status)">
        <text>{{ waterBoard.status }}</text>
      </view>
      <text class="table-info" v-if="waterBoard.table_no">台桌: {{ waterBoard.table_no }}</text>
    </view>

    <!-- 操作选项卡 -->
    <view class="tabs">
      <view class="tab" :class="{ active: currentTab === 'table-in' }" @click="currentTab = 'table-in'">
        <text>上桌单</text>
      </view>
      <view class="tab" :class="{ active: currentTab === 'table-out' }" @click="currentTab = 'table-out'">
        <text>下桌单</text>
      </view>
      <view class="tab" :class="{ active: currentTab === 'table-cancel' }" @click="currentTab = 'table-cancel'">
        <text>上桌取消单</text>
      </view>
    </view>

    <!-- 上桌单 -->
    <view class="form-section" v-if="currentTab === 'table-in'">
      <view class="form-item" @click="showTableSelector = true">
        <text class="form-label">台桌号</text>
        <view class="form-value">
          <text :class="{ placeholder: !form.table_no }">{{ form.table_no || '请选择台桌' }}</text>
          <text class="arrow">›</text>
        </view>
      </view>
      <view class="form-item">
        <text class="form-label">上桌类型</text>
        <view class="type-btns">
          <view class="type-btn" :class="{ active: form.action_category === '普通课' }" @click="form.action_category = '普通课'">
            <text>普通课</text>
          </view>
          <view class="type-btn" :class="{ active: form.action_category === '标签课' }" @click="form.action_category = '标签课'">
            <text>标签课</text>
          </view>
        </view>
      </view>
      <view class="submit-btn" @click="submitTableIn"><text>提交上桌单</text></view>
    </view>

    <!-- 下桌单 -->
    <view class="form-section" v-if="currentTab === 'table-out'">
      <view class="confirm-section">
        <text class="confirm-text">确认下桌</text>
        <text class="confirm-hint" v-if="waterBoard?.table_no">当前台桌: {{ waterBoard.table_no }}</text>
      </view>
      <view class="submit-btn danger" @click="submitTableOut"><text>提交下桌单</text></view>
    </view>

    <!-- 取消单 -->
    <view class="form-section" v-if="currentTab === 'table-cancel'">
      <view class="confirm-section">
        <text class="confirm-text">取消上桌</text>
        <text class="confirm-hint" v-if="waterBoard?.table_no">当前台桌: {{ waterBoard.table_no }}</text>
      </view>
      <view class="submit-btn warning" @click="submitTableCancel"><text>提交取消单</text></view>
    </view>

    <!-- 台桌选择器 -->
    <TableSelector :visible="showTableSelector" :default-table="waterBoard?.table_no || ''"
      @confirm="onTableSelected" @cancel="showTableSelector = false" />
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api-v2.js'
import TableSelector from '@/components/TableSelector.vue'

const statusBarHeight = ref(0)
const coachInfo = ref({})
const waterBoard = ref(null)
const currentTab = ref('table-in')
const showTableSelector = ref(false)

const form = ref({ table_no: '', action_category: '普通课' })

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  coachInfo.value = uni.getStorageSync('coachInfo') || {}
  loadWaterBoard()
})

const loadWaterBoard = async () => {
  try {
    const res = await api.waterBoards.getOne(coachInfo.value.coach_no)
    waterBoard.value = res.data
  } catch (e) {}
}

const statusClass = (status) => {
  if (status?.includes('上桌')) return 'status-on-table'
  if (status?.includes('空闲')) return 'status-free'
  return 'status-other'
}

const onTableSelected = (tableNo) => {
  form.value.table_no = tableNo
  showTableSelector.value = false
}

const submitTableIn = async () => {
  if (!form.value.table_no) return uni.showToast({ title: '请选择台桌', icon: 'none' })
  try {
    uni.showLoading({ title: '提交中...' })
    await api.tableActionOrders.create({
      table_no: form.value.table_no,
      coach_no: coachInfo.value.coach_no,
      order_type: '上桌单',
      action_category: form.value.action_category,
      stage_name: coachInfo.value.stage_name
    })
    uni.hideLoading()
    uni.showToast({ title: '上桌单已提交', icon: 'success' })
    await loadWaterBoard()
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '提交失败', icon: 'none' })
  }
}

const submitTableOut = async () => {
  if (!waterBoard.value?.table_no) return uni.showToast({ title: '当前未在桌上', icon: 'none' })
  try {
    uni.showLoading({ title: '提交中...' })
    await api.tableActionOrders.create({
      table_no: waterBoard.value.table_no,
      coach_no: coachInfo.value.coach_no,
      order_type: '下桌单',
      stage_name: coachInfo.value.stage_name
    })
    uni.hideLoading()
    uni.showToast({ title: '下桌单已提交', icon: 'success' })
    await loadWaterBoard()
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '提交失败', icon: 'none' })
  }
}

const submitTableCancel = async () => {
  if (!waterBoard.value?.table_no) return uni.showToast({ title: '当前未在桌上', icon: 'none' })
  try {
    uni.showLoading({ title: '提交中...' })
    await api.tableActionOrders.create({
      table_no: waterBoard.value.table_no,
      coach_no: coachInfo.value.coach_no,
      order_type: '取消单',
      stage_name: coachInfo.value.stage_name
    })
    uni.hideLoading()
    uni.showToast({ title: '取消单已提交', icon: 'success' })
    await loadWaterBoard()
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '提交失败', icon: 'none' })
  }
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

.status-section { margin: 16px; padding: 16px; background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; text-align: center; }
.status-label { font-size: 13px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 8px; }
.status-badge { display: inline-block; padding: 6px 16px; border-radius: 16px; font-size: 14px; font-weight: 600; }
.status-on-table { background: rgba(46,204,113,0.2); border: 1px solid rgba(46,204,113,0.3); color: #2ecc71; }
.status-free { background: rgba(52,152,219,0.2); border: 1px solid rgba(52,152,219,0.3); color: #3498db; }
.status-other { background: rgba(241,196,15,0.2); border: 1px solid rgba(241,196,15,0.3); color: #f1c40f; }
.table-info { font-size: 13px; color: rgba(255,255,255,0.4); display: block; margin-top: 6px; }

.tabs { display: flex; padding: 0 16px; gap: 8px; margin-bottom: 16px; }
.tab { flex: 1; height: 40px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 14px; color: rgba(255,255,255,0.6); }
.tab.active { background: rgba(212,175,55,0.2); border-color: #d4af37; color: #d4af37; }

.form-section { margin: 0 16px; }
.form-item { margin-bottom: 20px; }
.form-label { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 8px; display: block; }
.form-value { display: flex; justify-content: space-between; align-items: center; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0 16px; }
.form-value .placeholder { color: rgba(255,255,255,0.3); }
.arrow { font-size: 18px; color: rgba(255,255,255,0.3); }

.type-btns { display: flex; gap: 12px; }
.type-btn { flex: 1; height: 44px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 14px; color: rgba(255,255,255,0.6); }
.type-btn.active { background: rgba(212,175,55,0.2); border-color: #d4af37; color: #d4af37; }

.submit-btn { height: 50px; background: linear-gradient(135deg, #d4af37, #ffd700); border-radius: 25px; display: flex; align-items: center; justify-content: center; margin-top: 30px; }
.submit-btn text { font-size: 16px; font-weight: 600; color: #000; }
.submit-btn.danger { background: linear-gradient(135deg, #e74c3c, #c0392b); }
.submit-btn.danger text { color: #fff; }
.submit-btn.warning { background: linear-gradient(135deg, #f39c12, #e67e22); }
.submit-btn.warning text { color: #000; }

.confirm-section { text-align: center; padding: 30px 20px; }
.confirm-text { font-size: 18px; font-weight: 600; color: #d4af37; display: block; margin-bottom: 8px; }
.confirm-hint { font-size: 14px; color: rgba(255,255,255,0.5); display: block; }
</style>
