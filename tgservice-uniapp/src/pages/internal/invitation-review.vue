<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">约客审查-{{ shiftLabel }}</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 筛选 -->
    <view class="filter-bar">
      <view class="filter-item" :class="{ active: filterResult === '' }" @click="filterResult = ''; loadData()">
        <text>全部</text>
      </view>
      <view class="filter-item" :class="{ active: filterResult === '待审查' }" @click="filterResult = '待审查'; loadData()">
        <text>待审查</text>
      </view>
      <view class="filter-item" :class="{ active: filterResult === '约客有效' }" @click="filterResult = '约客有效'; loadData()">
        <text>有效</text>
      </view>
      <view class="filter-item" :class="{ active: filterResult === '约客无效' }" @click="filterResult = '约客无效'; loadData()">
        <text>无效</text>
      </view>
    </view>

    <view class="list-section" v-if="invitations.length > 0">
      <view class="inv-card" v-for="inv in invitations" :key="inv.id">
        <view class="inv-header">
          <text class="inv-name">{{ inv.stage_name }} ({{ inv.coach_no }})</text>
          <text class="inv-result" :class="'result-' + inv.result">{{ inv.result }}</text>
        </view>
        <image v-if="inv.invitation_image_url" :src="inv.invitation_image_url" mode="widthFix" class="inv-image" @click="previewImage(inv.invitation_image_url)" />
        <view class="inv-actions" v-if="inv.result === '待审查'">
          <view class="action-btn reject" @click="review(inv.id, '约客无效')"><text>无效</text></view>
          <view class="action-btn approve" @click="review(inv.id, '约客有效')"><text>有效</text></view>
        </view>
        <text class="inv-time" v-if="inv.reviewed_at">审查时间: {{ inv.reviewed_at }}</text>
      </view>
    </view>
    <view class="empty" v-else><text>暂无约客记录</text></view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api-v2.js'

const statusBarHeight = ref(0)
const shiftLabel = ref('早班')
const shift = ref('早班')
const filterResult = ref('')
const invitations = ref([])

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (currentPage.options?.shift) {
    shift.value = currentPage.options.shift
    shiftLabel.value = shift.value
  }
  loadData()
})

const loadData = async () => {
  const today = new Date().toISOString().split('T')[0]
  const params = { date: today, shift: shift.value }
  if (filterResult.value) params.result = filterResult.value
  try {
    const res = await api.guestInvitations.getList(params)
    invitations.value = res.data || []
  } catch (e) { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

const previewImage = (url) => uni.previewImage({ urls: [url] })

const review = async (id, result) => {
  uni.showModal({ title: `确认${result}`, content: `确定标记为${result}？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          const adminInfo = uni.getStorageSync('adminInfo') || {}
          await api.guestInvitations.review(id, { result, reviewer_phone: adminInfo.username })
          uni.showToast({ title: '操作成功', icon: 'success' })
          loadData()
        } catch (e) { uni.showToast({ title: e.error || '操作失败', icon: 'none' }) }
      }
    }
  })
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

.filter-bar { display: flex; padding: 8px 16px; gap: 8px; }
.filter-item { padding: 6px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; font-size: 13px; color: rgba(255,255,255,0.6); }
.filter-item.active { background: rgba(212,175,55,0.2); border-color: #d4af37; color: #d4af37; }

.list-section { padding: 12px 16px; }
.inv-card { background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.inv-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.inv-name { font-size: 15px; font-weight: 600; color: #d4af37; }
.inv-result { font-size: 12px; padding: 4px 10px; border-radius: 12px; }
.result-待审查 { background: rgba(241,196,15,0.2); color: #f1c40f; }
.result-约客有效 { background: rgba(46,204,113,0.2); color: #2ecc71; }
.result-约客无效 { background: rgba(231,76,60,0.2); color: #e74c3c; }
.inv-image { border-radius: 8px; max-width: 100%; margin-bottom: 8px; }
.inv-actions { display: flex; gap: 12px; margin-bottom: 8px; }
.action-btn { flex: 1; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 500; }
.action-btn.reject { background: rgba(231,76,60,0.15); border: 1px solid rgba(231,76,60,0.3); color: #e74c3c; }
.action-btn.approve { background: rgba(46,204,113,0.15); border: 1px solid rgba(46,204,113,0.3); color: #2ecc71; }
.inv-time { font-size: 11px; color: rgba(255,255,255,0.3); }
.empty { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.3); }
</style>
