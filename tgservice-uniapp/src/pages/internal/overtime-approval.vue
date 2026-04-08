<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">加班审批</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <view class="list-section" v-if="applications.length > 0">
      <view class="app-card" v-for="app in applications" :key="app.id">
        <view class="app-header">
          <text class="app-type">{{ app.application_type }}</text>
          <text class="app-status" :class="'status-' + app.status">{{ statusText(app.status) }}</text>
        </view>
        <view class="app-body">
          <text class="app-name">{{ app.stage_name || '未知' }}</text>
          <text class="app-phone">{{ app.applicant_phone }}</text>
          <text class="app-remark" v-if="app.remark">{{ app.remark }}</text>
          <text class="app-time">{{ app.created_at }}</text>
          <!-- 截图 -->
          <image v-if="app.proof_image_url" :src="app.proof_image_url" mode="widthFix" class="app-image" @click="previewImage(app.proof_image_url)" />
        </view>
        <view class="app-actions" v-if="app.status === 0">
          <view class="action-btn reject" @click="approve(app.id, 2)"><text>拒绝</text></view>
          <view class="action-btn approve" @click="approve(app.id, 1)"><text>同意</text></view>
        </view>
      </view>
    </view>
    <view class="empty" v-else><text>暂无待审批申请</text></view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api-v2.js'

const statusBarHeight = ref(0)
const adminInfo = ref({})
const applications = ref([])

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  adminInfo.value = uni.getStorageSync('adminInfo') || {}
  loadData()
})

const loadData = async () => {
  try {
    const res = await api.applications.getList({ application_type: '早加班申请', status: 0, limit: 50 })
    const res2 = await api.applications.getList({ application_type: '晚加班申请', status: 0, limit: 50 })
    applications.value = [...(res.data || []), ...(res2.data || [])]
  } catch (e) { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

const statusText = (s) => s === 0 ? '待处理' : s === 1 ? '已同意' : '已拒绝'
const previewImage = (url) => uni.previewImage({ urls: [url] })

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

.list-section { padding: 12px 16px; }
.app-card { background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.app-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.app-type { font-size: 15px; font-weight: 600; color: #d4af37; }
.app-status { font-size: 12px; padding: 4px 10px; border-radius: 12px; }
.status-0 { background: rgba(241,196,15,0.2); color: #f1c40f; }
.status-1 { background: rgba(46,204,113,0.2); color: #2ecc71; }
.status-2 { background: rgba(231,76,60,0.2); color: #e74c3c; }
.app-body { display: flex; flex-direction: column; gap: 4px; }
.app-name { font-size: 14px; color: #fff; font-weight: 500; }
.app-phone { font-size: 12px; color: rgba(255,255,255,0.4); }
.app-remark { font-size: 13px; color: rgba(255,255,255,0.6); }
.app-time { font-size: 11px; color: rgba(255,255,255,0.3); }
.app-image { margin-top: 8px; border-radius: 8px; max-width: 200px; }
.app-actions { display: flex; gap: 12px; margin-top: 12px; }
.action-btn { flex: 1; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 500; }
.action-btn.reject { background: rgba(231,76,60,0.15); border: 1px solid rgba(231,76,60,0.3); color: #e74c3c; }
.action-btn.approve { background: rgba(46,204,113,0.15); border: 1px solid rgba(46,204,113,0.3); color: #2ecc71; }
.empty { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.3); }
</style>
