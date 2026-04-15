<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">上下桌单</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 助教信息 -->
    <view class="coach-info-section" v-if="coachInfo.coachNo">
      <text class="coach-name">{{ coachInfo.stageName }}</text>
      <text class="coach-no">工号: {{ coachInfo.employeeId }}</text>
    </view>

    <!-- 当前状态 -->
    <view class="status-section" v-if="waterBoard">
      <text class="status-label">当前状态</text>
      <view class="status-badge" :class="statusClass(waterBoard.status)">
        <text>{{ waterBoard.status }}</text>
      </view>
      <template v-if="waterBoard.table_no_list && waterBoard.table_no_list.length">
        <text class="table-info-label">台桌</text>
        <view class="table-tags">
          <text class="table-tag" v-for="(t, i) in waterBoard.table_no_list" :key="i">{{ t }}</text>
        </view>
      </template>
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

    <!-- 下桌单：增加台桌号选择器 -->
    <view class="form-section" v-if="currentTab === 'table-out'">
      <view class="form-item" @click="showTableOutSelector = true">
        <text class="form-label">选择下桌台桌号</text>
        <view class="form-value">
          <text :class="{ placeholder: !form.table_out_no }">
            {{ form.table_out_no || '请选择要下桌的台桌' }}
          </text>
          <text class="arrow">›</text>
        </view>
      </view>
      <view class="submit-btn danger" @click="submitTableOut"><text>提交下桌单</text></view>
    </view>

    <!-- 取消单：增加台桌号选择器 -->
    <view class="form-section" v-if="currentTab === 'table-cancel'">
      <view class="form-item" @click="showTableCancelSelector = true">
        <text class="form-label">选择取消台桌号</text>
        <view class="form-value">
          <text :class="{ placeholder: !form.table_cancel_no }">
            {{ form.table_cancel_no || '请选择要取消的台桌' }}
          </text>
          <text class="arrow">›</text>
        </view>
      </view>
      <view class="submit-btn warning" @click="submitTableCancel"><text>提交取消单</text></view>
    </view>

    <!-- 台桌选择器（上桌单用）：过滤掉已在桌上的台桌号 -->
    <TableSelector :visible="showTableSelector" :default-table="''" :exclude-tables="currentTables"
      @confirm="onTableSelected" @cancel="showTableSelector = false" />
    
    <!-- 台桌选择器（下桌单/取消单用）：只显示当前在桌上的台桌号 -->
    <TableSelector :visible="showTableOutSelector" :default-table="''" :only-tables="currentTables"
      @confirm="onTableOutSelected" @cancel="showTableOutSelector = false" />
    <TableSelector :visible="showTableCancelSelector" :default-table="''" :only-tables="currentTables"
      @confirm="onTableCancelSelected" @cancel="showTableCancelSelector = false" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/utils/api-v2.js'
import TableSelector from '@/components/TableSelector.vue'

const statusBarHeight = ref(0)
const coachInfo = ref({})
const waterBoard = ref(null)
const currentTab = ref('table-in')
const showTableSelector = ref(false)
const showTableOutSelector = ref(false)
const showTableCancelSelector = ref(false)

const form = ref({ table_no: '', action_category: '普通课', table_out_no: '', table_cancel_no: '' })

// 解析当前在桌上的台桌号列表（逗号分隔字符串 → 数组）
const currentTables = computed(() => {
  const tableNo = waterBoard.value?.table_no
  if (!tableNo || tableNo.trim() === '') return []
  return tableNo.split(',').map(t => t.trim()).filter(t => t)
})

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  coachInfo.value = uni.getStorageSync('coachInfo') || {}
  loadWaterBoard()
})

const loadWaterBoard = async () => {
  try {
    const res = await api.waterBoards.getOne(coachInfo.value.coachNo)
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

const onTableOutSelected = (tableNo) => {
  form.value.table_out_no = tableNo
  showTableOutSelector.value = false
}

const onTableCancelSelected = (tableNo) => {
  form.value.table_cancel_no = tableNo
  showTableCancelSelector.value = false
}

const submitTableIn = async () => {
  if (!form.value.table_no) return uni.showToast({ title: '请选择台桌', icon: 'none' })
  try {
    uni.showLoading({ title: '提交中...' })
    await api.tableActionOrders.create({
      table_no: form.value.table_no,
      coach_no: coachInfo.value.coachNo,
      order_type: '上桌单',
      action_category: form.value.action_category,
      stage_name: coachInfo.value.stageName
    })
    uni.hideLoading()
    uni.showToast({ title: '上桌单已提交', icon: 'success' })
    form.value.table_no = ''
    await loadWaterBoard()
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '提交失败', icon: 'none' })
  }
}

const submitTableOut = async () => {
  if (!form.value.table_out_no) return uni.showToast({ title: '请选择要下桌的台桌', icon: 'none' })
  try {
    uni.showLoading({ title: '提交中...' })
    await api.tableActionOrders.create({
      table_no: form.value.table_out_no,
      coach_no: coachInfo.value.coachNo,
      order_type: '下桌单',
      stage_name: coachInfo.value.stageName
    })
    uni.hideLoading()
    uni.showToast({ title: '下桌单已提交', icon: 'success' })
    form.value.table_out_no = ''
    await loadWaterBoard()
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '提交失败', icon: 'none' })
  }
}

const submitTableCancel = async () => {
  if (!form.value.table_cancel_no) return uni.showToast({ title: '请选择要取消的台桌', icon: 'none' })
  try {
    uni.showLoading({ title: '提交中...' })
    await api.tableActionOrders.create({
      table_no: form.value.table_cancel_no,
      coach_no: coachInfo.value.coachNo,
      order_type: '取消单',
      stage_name: coachInfo.value.stageName
    })
    uni.hideLoading()
    uni.showToast({ title: '取消单已提交', icon: 'success' })
    form.value.table_cancel_no = ''
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

.coach-info-section { margin: 16px; padding: 16px; background: rgba(212,175,55,0.1); border: 1px solid rgba(218,165,32,0.3); border-radius: 12px; text-align: center; }
.coach-name { font-size: 18px; font-weight: 600; color: #d4af37; display: block; margin-bottom: 4px; }
.coach-no { font-size: 13px; color: rgba(255,255,255,0.6); display: block; }

.status-section { margin: 16px; padding: 16px; background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; text-align: center; }
.status-label { font-size: 13px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 8px; }
.status-badge { display: inline-block; padding: 6px 16px; border-radius: 16px; font-size: 14px; font-weight: 600; }
.status-on-table { background: rgba(46,204,113,0.2); border: 1px solid rgba(46,204,113,0.3); color: #2ecc71; }
.status-free { background: rgba(52,152,219,0.2); border: 1px solid rgba(52,152,219,0.3); color: #3498db; }
.status-other { background: rgba(241,196,15,0.2); border: 1px solid rgba(241,196,15,0.3); color: #f1c40f; }
.table-info-label { font-size: 13px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 6px; }
.table-tags { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.table-tag { font-size: 13px; font-weight: 600; color: #d4af37; background: rgba(212,175,55,0.15); border: 1px solid rgba(212,175,55,0.3); border-radius: 8px; padding: 3px 10px; }

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
