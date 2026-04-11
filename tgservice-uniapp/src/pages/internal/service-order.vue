<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">服务下单</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <view class="form-section">
      <!-- 台桌号 -->
      <view class="form-item" @click="showTableSelector = true">
        <text class="form-label">台桌号</text>
        <view class="form-value">
          <text :class="{ placeholder: !form.table_no }">{{ form.table_no || '请选择台桌' }}</text>
          <text class="arrow">›</text>
        </view>
      </view>

      <!-- 快捷需求按钮 -->
      <view class="form-item">
        <text class="form-label">快捷需求</text>
        <view class="quick-tags">
          <view class="quick-tag" v-for="tag in quickTags" :key="tag" @click="selectQuickTag(tag)">
            <text>{{ tag }}</text>
          </view>
        </view>
      </view>

      <!-- 自定义需求（必填） -->
      <view class="form-item">
        <text class="form-label">需求内容 <text class="required">*</text></text>
        <input class="input" v-model="form.requirement" placeholder="请输入需求内容" maxlength="200" />
      </view>

      <!-- 下单人 -->
      <view class="form-item">
        <text class="form-label">下单人</text>
        <text class="requester-name">{{ requesterName }}</text>
      </view>

      <view class="submit-btn" @click="submitOrder"><text>提交服务单</text></view>
    </view>

    <!-- 台桌选择器 -->
    <TableSelector :visible="showTableSelector" @confirm="onTableSelected" @cancel="showTableSelector = false" />
    
    <!-- 成功弹窗 -->
    <SuccessModal :visible="showSuccess" title="提交成功" content="服务单已提交，请等待处理" @confirm="handleSuccessConfirm" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/utils/api-v2.js'
import TableSelector from '@/components/TableSelector.vue'
import SuccessModal from '@/components/SuccessModal.vue'

const statusBarHeight = ref(0)
const showTableSelector = ref(false)
const showSuccess = ref(false)
const adminInfo = ref({})
const coachInfo = ref({})

const quickTags = ['换垃圾袋', '搞卫生', '音响连接', '加水']

const form = ref({ table_no: '', requirement: '' })

const requesterName = computed(() => {
  if (coachInfo.value?.stageName) return coachInfo.value.stageName
  return adminInfo.value.name || adminInfo.value.username || '未知'
})

const requesterType = computed(() => {
  return coachInfo.value?.stageName ? '助教' : '后台用户'
})

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  adminInfo.value = uni.getStorageSync('adminInfo') || {}
  coachInfo.value = uni.getStorageSync('coachInfo') || {}

  // 如果是已上桌助教，默认选中当前台桌
  if (coachInfo.value?.coachNo) {
    loadDefaultTable()
  }
})

const loadDefaultTable = async () => {
  try {
    const res = await api.waterBoards.getOne(coachInfo.value.coachNo)
    if (res.data?.table_no) {
      form.value.table_no = res.data.table_no
    }
  } catch (e) {}
}

const onTableSelected = (tableNo) => {
  form.value.table_no = tableNo
  showTableSelector.value = false
  // 同步到 localStorage，让商品页/购物车的台桌号也更新
  uni.setStorageSync('tableName', tableNo)
  // 当作扫码成功：同时写入 tableAuth
  uni.setStorageSync('tableAuth', JSON.stringify({ table: tableNo, time: Date.now() }))
}

// 点击快捷需求，直接填入需求内容
const selectQuickTag = (tag) => {
  form.value.requirement = tag
}

const submitOrder = async () => {
  if (!form.value.table_no) return uni.showToast({ title: '请选择台桌', icon: 'none' })
  if (!form.value.requirement) return uni.showToast({ title: '请输入需求内容', icon: 'none' })

  try {
    uni.showLoading({ title: '提交中...' })
    await api.serviceOrders.create({
      table_no: form.value.table_no,
      requirement: form.value.requirement,
      requester_name: requesterName.value,
      requester_type: requesterType.value
    })
    uni.hideLoading()
    form.value.table_no = ''
    form.value.requirement = ''
    showSuccess.value = true
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '提交失败', icon: 'none' })
  }
}

const handleSuccessConfirm = () => {
  showSuccess.value = false
  uni.switchTab({ url: '/pages/member/member' })
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

.form-section { margin: 16px; }
.form-item { margin-bottom: 24px; }
.form-label { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 8px; display: block; }
.required { color: #e74c3c; }
.form-value { display: flex; justify-content: space-between; align-items: center; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0 16px; }
.form-value .placeholder { color: rgba(255,255,255,0.3); }
.arrow { font-size: 18px; color: rgba(255,255,255,0.3); }

.quick-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.quick-tag { padding: 10px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; font-size: 13px; color: rgba(255,255,255,0.7); }
.quick-tag:active { background: rgba(212,175,55,0.2); border-color: #d4af37; color: #d4af37; }

.input { width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0 12px; font-size: 14px; color: #fff; box-sizing: border-box; }

.requester-name { font-size: 15px; color: #d4af37; }

.submit-btn { height: 50px; background: linear-gradient(135deg, #d4af37, #ffd700); border-radius: 25px; display: flex; align-items: center; justify-content: center; margin-top: 30px; }
.submit-btn text { font-size: 16px; font-weight: 600; color: #000; }
</style>