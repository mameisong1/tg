<template>
  <view class="page">
    <!-- 固定顶部导航 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">智能开关管理</text>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <scroll-view class="content" scroll-y>
      <!-- 自动关灯启停卡片 -->
      <view class="card auto-off-card">
        <view class="card-header">
          <text class="card-icon">⚡</text>
          <text class="card-title">自动关灯功能</text>
        </view>
        <view class="card-body">
          <view class="toggle-row" @click="toggleAutoOff">
            <text class="toggle-status" :class="autoOffEnabled ? 'on' : 'off'">
              {{ autoOffEnabled ? '已开启' : '已关闭' }}
            </text>
            <view class="toggle-switch" :class="{ active: autoOffEnabled }">
              <view class="toggle-thumb"></view>
            </view>
          </view>
          <text class="toggle-desc">开启后，台桌空闲且处于自动关灯时段时将自动关灯（支持跨午夜时段）</text>
        </view>
      </view>

      <!-- 定时自动开灯启停卡片 -->
      <view class="card auto-on-card">
        <view class="card-header">
          <text class="card-icon">🌅</text>
          <text class="card-title">定时自动开灯功能</text>
        </view>
        <view class="card-body">
          <view class="toggle-row" @click="toggleAutoOn">
            <text class="toggle-status" :class="autoOnEnabled ? 'on' : 'off'">
              {{ autoOnEnabled ? '已开启' : '已关闭' }}
            </text>
            <view class="toggle-switch" :class="{ active: autoOnEnabled }">
              <view class="toggle-thumb"></view>
            </view>
          </view>
          <text class="toggle-desc">开启后，空闲台桌在开灯时段内将自动开灯（每5分钟检查一次，支持跨午夜时段）</text>
        </view>
      </view>

      <!-- 快捷场景卡片 -->
      <view class="card scene-card" v-if="scenes.length > 0">
        <view class="card-header">
          <text class="card-icon">🎬</text>
          <text class="card-title">快捷场景</text>
        </view>
        <view class="card-body">
          <view class="scene-grid">
            <view class="scene-btn"
                  v-for="scene in scenes"
                  :key="scene.id"
                  :class="scene.action === 'ON' ? 'scene-on' : 'scene-off'"
                  @click="executeScene(scene)">
              <text class="scene-btn-icon">{{ scene.action === 'ON' ? '💡' : '🌙' }}</text>
              <text class="scene-btn-text">{{ scene.scene_name }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 标签控制卡片 -->
      <view class="card label-card">
        <view class="card-header">
          <text class="card-icon">🔌</text>
          <text class="card-title">标签控制</text>
        </view>
        <view class="card-body">
          <picker mode="selector" :range="labelNames" :value="selectedLabelIndex" @change="onLabelChange">
            <view class="label-picker">
              <text class="label-picker-text">{{ selectedLabel || '选择开关标签' }}</text>
              <text class="label-picker-arrow">▼</text>
            </view>
          </picker>
          <view class="label-actions" v-if="selectedLabel">
            <view class="action-btn btn-on" @click="labelControl('ON')">
              <text>💡 开灯</text>
            </view>
            <view class="action-btn btn-off" @click="labelControl('OFF')">
              <text>🌙 关灯</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 操作确认弹窗 -->
    <view class="confirm-overlay" v-if="showConfirm" @click="closeConfirm">
      <view class="confirm-box" @click.stop>
        <text class="confirm-title">确认操作</text>
        <text class="confirm-text">{{ confirmText }}</text>
        <view class="confirm-buttons">
          <view class="confirm-btn cancel" @click="closeConfirm"><text>取消</text></view>
          <view class="confirm-btn ok" @click="confirmAction"><text>确认</text></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const statusBarHeight = ref(20)
const autoOffEnabled = ref(false)
const autoOnEnabled = ref(false)
const scenes = ref([])
const labels = ref([])
const labelNames = computed(() => labels.value.map(l => l.switch_label))
const selectedLabelIndex = ref(-1)
const selectedLabel = ref('')
const showConfirm = ref(false)
const confirmText = ref('')
let pendingAction = null

onLoad(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  checkPermission()
  loadAllData()
})

async function checkPermission() {
  const adminInfo = uni.getStorageSync('adminInfo') || {}
  const role = adminInfo.role
  const allowed = ['店长', '助教管理', '管理员']
  if (!allowed.includes(role)) {
    uni.showToast({ title: '权限不足，仅店长和助教管理可用', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 1500)
  }
}

async function apiRequest(url, method = 'GET', data = null) {
  const adminToken = uni.getStorageSync('adminToken')
  const coachToken = uni.getStorageSync('coachToken')
  const token = adminToken || coachToken
  
  return new Promise((resolve, reject) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://tiangong.club/api'
    uni.request({
      url: baseUrl + url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        if (res.statusCode === 200) resolve(res.data)
        else if (res.statusCode === 401) {
          uni.showToast({ title: '请先登录', icon: 'none' })
          reject(new Error('未授权'))
        } else reject(new Error(res.data?.error || '请求失败'))
      },
      fail: (err) => {
        uni.showToast({ title: '网络请求失败', icon: 'none' })
        reject(err)
      }
    })
  })
}

async function loadAllData() {
  await Promise.all([loadAutoStatus(), loadScenes(), loadLabels()])
}

async function loadAutoStatus() {
  try {
    const res = await apiRequest('/switch/auto-status')
    autoOffEnabled.value = res?.auto_off_enabled === true
    autoOnEnabled.value = res?.auto_on_enabled === true
  } catch (e) { /* ignore */ }
}

async function loadScenes() {
  try {
    const res = await apiRequest('/switch/scenes')
    scenes.value = res || []
  } catch (e) { /* ignore */ }
}

async function loadLabels() {
  try {
    const res = await apiRequest('/switch/labels')
    labels.value = res || []
  } catch (e) { /* ignore */ }
}

async function toggleAutoOff() {
  const action = autoOffEnabled.value ? '关闭' : '开启'
  confirmText.value = `确认${action}自动关灯功能？`
  pendingAction = 'toggleAutoOff'
  showConfirm.value = true
}

async function toggleAutoOn() {
  const action = autoOnEnabled.value ? '关闭' : '开启'
  confirmText.value = `确认${action}定时自动开灯功能？`
  pendingAction = 'toggleAutoOn'
  showConfirm.value = true
}

function executeScene(scene) {
  confirmText.value = `确认执行场景"${scene.scene_name}"？（${scene.action === 'ON' ? '开灯' : '关灯'}）`
  pendingAction = { type: 'scene', scene }
  showConfirm.value = true
}

function onLabelChange(e) {
  selectedLabelIndex.value = e.detail.value
  selectedLabel.value = labelNames.value[e.detail.value]
}

function labelControl(action) {
  if (!selectedLabel.value) return
  confirmText.value = `确认对标签"${selectedLabel.value}"执行${action === 'ON' ? '开灯' : '关灯'}？`
  pendingAction = { type: 'label', action }
  showConfirm.value = true
}

async function confirmAction() {
  closeConfirm()
  try {
    if (pendingAction === 'toggleAutoOff') {
      await apiRequest('/switch/auto-off-toggle', 'POST')
      autoOffEnabled.value = !autoOffEnabled.value
      uni.showToast({ title: autoOffEnabled.value ? '已开启' : '已关闭', icon: 'success' })
    } else if (pendingAction === 'toggleAutoOn') {
      await apiRequest('/switch/auto-on-toggle', 'POST')
      autoOnEnabled.value = !autoOnEnabled.value
      uni.showToast({ title: autoOnEnabled.value ? '已开启' : '已关闭', icon: 'success' })
    } else if (pendingAction.type === 'scene') {
      await apiRequest(`/switch/scene/${pendingAction.scene.id}`, 'POST')
      uni.showToast({ title: '场景执行成功', icon: 'success' })
    } else if (pendingAction.type === 'label') {
      await apiRequest('/switch/label-control', 'POST', {
        label: selectedLabel.value,
        action: pendingAction.action
      })
      uni.showToast({ title: '操作成功', icon: 'success' })
    }
  } catch (e) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' })
  }
  pendingAction = null
}

function closeConfirm() {
  showConfirm.value = false
  pendingAction = null
}

function goBack() {
  uni.navigateBack()
}
</script>

<style scoped>
/* 页面基础 */
.page { background: #0a0a0f; min-height: 100vh; color: #fff; }

/* 固定顶部 */
.fixed-header { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(10,10,15,0.95); backdrop-filter: blur(10px); }
.status-bar-bg { background: rgba(10,10,15,0.95); }
.header-content { display: flex; align-items: center; height: 44px; padding: 0 16px; }
.back-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.back-icon { font-size: 24px; color: #d4af37; }
.header-title { flex: 1; text-align: center; font-size: 17px; font-weight: 500; }
.header-placeholder { width: 100%; }

/* 内容区 */
.content { padding: 16px; padding-bottom: 40px; }

/* 卡片通用样式 */
.card {
  background: rgba(20,20,30,0.8);
  border-radius: 16px;
  border: 1px solid rgba(218,165,32,0.15);
  margin-bottom: 16px;
  overflow: hidden;
}
.card-header {
  display: flex; align-items: center; gap: 8px;
  padding: 16px 16px 0;
}
.card-icon { font-size: 20px; }
.card-title { font-size: 16px; font-weight: 500; color: #d4af37; }
.card-body { padding: 12px 16px 16px; }

/* 自动关灯/开灯卡片 */
.toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 0;
}
.toggle-status { font-size: 15px; font-weight: 500; }
.toggle-status.on { color: #22c55e; }
.toggle-status.off { color: #e74c3c; }
.toggle-switch {
  width: 48px; height: 28px; border-radius: 14px;
  background: rgba(255,255,255,0.15);
  position: relative; transition: background 0.3s;
}
.toggle-switch.active { background: rgba(34,197,94,0.5); }
.toggle-thumb {
  width: 24px; height: 24px; border-radius: 12px;
  background: #fff; position: absolute; top: 2px; left: 2px;
  transition: transform 0.3s;
}
.toggle-switch.active .toggle-thumb { transform: translateX(20px); }
.toggle-desc { font-size: 12px; color: rgba(255,255,255,0.4); display: block; margin-top: 8px; line-height: 1.4; }

/* 场景按钮网格 */
.scene-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.scene-btn {
  flex: 1; min-width: calc(50% - 6px);
  padding: 16px 12px; border-radius: 12px;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  transition: all 0.2s;
}
.scene-on {
  background: rgba(218,165,32,0.15);
  border: 1px solid rgba(218,165,32,0.3);
}
.scene-off {
  background: rgba(100,100,150,0.15);
  border: 1px solid rgba(100,100,150,0.3);
}
.scene-btn:active { transform: scale(0.96); }
.scene-btn-icon { font-size: 24px; }
.scene-btn-text { font-size: 14px; }

/* 标签选择器 */
.label-picker {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: rgba(255,255,255,0.05);
  border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
}
.label-picker-text { font-size: 15px; color: #fff; }
.label-picker-arrow { font-size: 12px; color: rgba(255,255,255,0.4); }
.label-actions { display: flex; gap: 12px; margin-top: 12px; }
.action-btn {
  flex: 1; padding: 14px; border-radius: 10px;
  text-align: center; font-size: 15px; font-weight: 500;
}
.btn-on { background: rgba(218,165,32,0.2); color: #d4af37; }
.btn-off { background: rgba(100,100,150,0.2); color: #aaa; }
.action-btn:active { transform: scale(0.96); }

/* 确认弹窗 */
.confirm-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7); z-index: 200;
  display: flex; align-items: center; justify-content: center;
}
.confirm-box {
  background: rgba(20,20,30,0.95); border-radius: 16px;
  padding: 24px; width: 85%; max-width: 340px;
  border: 1px solid rgba(218,165,32,0.2);
}
.confirm-title { font-size: 17px; font-weight: 500; display: block; margin-bottom: 12px; }
.confirm-text { font-size: 14px; color: rgba(255,255,255,0.7); display: block; margin-bottom: 20px; line-height: 1.5; }
.confirm-buttons { display: flex; gap: 12px; }
.confirm-btn {
  flex: 1; padding: 12px; border-radius: 10px; text-align: center; font-size: 15px;
}
.confirm-btn.cancel { background: rgba(255,255,255,0.1); color: #fff; }
.confirm-btn.ok { background: linear-gradient(135deg, #d4af37, #ffd700); color: #000; font-weight: 500; }
</style>
