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
      <!-- 快捷场景卡片（移到最上面，排除全部开灯/关灯） -->
      <view class="card scene-card scene-card-top" v-if="topScenes.length > 0">
        <view class="card-header">
          <text class="card-icon">🎬</text>
          <text class="card-title">快捷场景</text>
        </view>
        <view class="card-body">
          <view class="scene-grid scene-grid-top">
            <view class="scene-btn scene-btn-top"
                  v-for="scene in topScenes"
                  :key="scene.id"
                  :class="scene.action === 'ON' ? 'scene-on' : 'scene-off'"
                  @click="executeScene(scene)">
              <text class="scene-btn-icon scene-btn-icon-top">{{ scene.action === 'ON' ? '💡' : '🌙' }}</text>
              <text class="scene-btn-text scene-btn-text-top">{{ scene.scene_name }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 智能省电-自动（原自动关灯） -->
      <view class="card auto-off-card">
        <view class="card-header">
          <text class="card-icon">⚡</text>
          <text class="card-title">智能省电-自动</text>
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
          <!-- 智能省电-手动按钮 -->
          <view class="manual-btn" @click="executeManualOff">
            <text class="manual-btn-icon">⏻</text>
            <text class="manual-btn-text">智能省电-手动（测试专用）</text>
          </view>
        </view>
      </view>

      <!-- 台桌控制卡片 -->
      <view class="card table-card">
        <view class="card-header">
          <text class="card-icon">🎱</text>
          <text class="card-title">台桌控制</text>
        </view>
        <view class="card-body">
          <!-- 区域筛选（去掉"全部"，允许折行） -->
          <view class="area-btns area-btns-wrap">
            <view class="area-btn" v-for="area in areas" :key="area" :class="{ active: selectedArea === area }" @click="selectArea(area)">
              <text>{{ area }}</text>
            </view>
          </view>
          <!-- 台桌网格（折行显示，无滚动条） -->
          <view class="table-grid">
            <view class="table-btn" v-for="t in filteredTables" :key="t.table_name_en" @click="selectTable(t)">
              <text class="table-btn-text">{{ t.table_name_cn }}</text>
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

      <!-- 全部开灯/全部关灯（仅这两个在底部） -->
      <view class="card scene-card scene-card-bottom" v-if="bottomScenes.length > 0">
        <view class="card-body">
          <view class="scene-grid scene-grid-bottom">
            <view class="scene-btn scene-btn-bottom"
                  v-for="scene in bottomScenes"
                  :key="scene.id"
                  :class="scene.action === 'ON' ? 'scene-on' : 'scene-off'"
                  @click="executeScene(scene)">
              <text class="scene-btn-icon scene-btn-icon-small">{{ scene.action === 'ON' ? '💡' : '🌙' }}</text>
              <text class="scene-btn-text scene-btn-text-small">{{ scene.scene_name }}</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 操作确认弹窗（场景/标签/手动省电） -->
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

    <!-- 台桌控制弹窗 -->
    <view class="confirm-overlay" v-if="showTableConfirm" @click="closeTableConfirm">
      <view class="confirm-box table-confirm" @click.stop>
        <text class="confirm-title">{{ selectedTable?.table_name_cn || '' }}</text>
        <text class="confirm-text">选择操作</text>
        <view class="confirm-buttons">
          <view class="confirm-btn cancel" @click="closeTableConfirm"><text>取消</text></view>
          <view class="confirm-btn ok btn-on-action" @click="tableControlAction('ON')"><text>💡 开灯</text></view>
          <view class="confirm-btn cancel btn-off-action" @click="tableControlAction('OFF')"><text>🌙 关灯</text></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getBeijingTimestamp } from '@/utils/time-util.js'

const statusBarHeight = ref(20)
const autoOffEnabled = ref(false)
const scenes = ref([])
const labels = ref([])
const labelNames = computed(() => labels.value.map(l => l.switch_label))
const selectedLabelIndex = ref(-1)
const selectedLabel = ref('')
const showConfirm = ref(false)
const confirmText = ref('')
let pendingAction = null

// 台桌控制
const tables = ref([])
const areas = computed(() => [...new Set(tables.value.map(t => t.area).filter(Boolean))])
const selectedArea = ref('')  // 默认选中第一个区域
const filteredTables = computed(() => {
  if (!selectedArea.value) return tables.value
  return tables.value.filter(t => t.area === selectedArea.value)
})
const showTableConfirm = ref(false)
const selectedTable = ref(null)

// 顶部快捷场景（排除"全部开灯""全部关灯"和"大厅全开"）
const topScenes = computed(() => scenes.value.filter(s => s.scene_name !== '全部开灯' && s.scene_name !== '全部关灯' && s.scene_name !== '大厅全开'))
// 底部只留"全部开灯""全部关灯"和"大厅全开"
const bottomScenes = computed(() => scenes.value.filter(s => ['全部开灯', '全部关灯', '大厅全开'].includes(s.scene_name)))

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
    uni.showToast({ title: '权限不足，仅店长/助教管理/管理员可用', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 1500)
  }
}

/**
 * 错误日志上报
 */
async function reportError(action, error, extra = {}) {
  try {
    const adminToken = uni.getStorageSync('adminToken')
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://tiangong.club/api'
    uni.request({
      url: baseUrl + '/admin/frontend-error-log',
      method: 'POST',
      data: {
        action,
        timestamp: getBeijingTimestamp(),
        url: window?.location?.href || '',
        userAgent: navigator?.userAgent || '',
        userToken: adminToken || '',
        state: JSON.stringify({
          autoOffEnabled: autoOffEnabled.value,
          scenesCount: scenes.value.length,
          labelsCount: labels.value.length,
          selectedLabel: selectedLabel.value,
          pendingAction: pendingAction
        }),
        errorMessage: error?.message || String(error),
        errorStack: error?.stack || '',
        ...extra
      },
      header: {
        'Content-Type': 'application/json',
        'Authorization': adminToken ? `Bearer ${adminToken}` : ''
      },
      fail: () => console.error('[错误上报] 上报失败')
    })
    console.log('[错误上报]', action, error?.message || error)
  } catch (e) {
    console.error('[错误上报] 上报函数异常:', e)
  }
}

async function apiRequest(url, method = 'GET', data = null) {
  const adminToken = uni.getStorageSync('adminToken')
  const coachToken = uni.getStorageSync('coachToken')
  const token = adminToken || coachToken
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://tiangong.club/api'

  console.log('[API请求]', method, baseUrl + url)

  return new Promise((resolve, reject) => {
    uni.request({
      url: baseUrl + url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        console.log('[API响应]', url, 'status:', res.statusCode, 'data:', JSON.stringify(res.data).substring(0, 200))
        if (res.statusCode === 200) resolve(res.data)
        else if (res.statusCode === 401) {
          uni.showToast({ title: '请先登录', icon: 'none' })
          reject(new Error('未授权'))
        } else reject(new Error(res.data?.error || '请求失败'))
      },
      fail: (err) => {
        console.error('[API失败]', url, err)
        reportError('api_request_fail', err, { url, method })
        uni.showToast({ title: '网络请求失败', icon: 'none' })
        reject(err)
      }
    })
  })
}

async function loadAllData() {
  await Promise.all([loadAutoStatus(), loadScenes(), loadLabels(), loadTables()])
}

async function loadAutoStatus() {
  try {
    const res = await apiRequest('/switch/auto-status')
    autoOffEnabled.value = res?.auto_off_enabled === true
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

async function loadTables() {
  try {
    const res = await apiRequest('/switch/tables')
    tables.value = res || []
    // 默认选中第一个区域
    if (areas.value.length > 0 && !selectedArea.value) {
      selectedArea.value = areas.value[0]
    }
    console.log('[台桌列表] 加载', tables.value.length, '个台桌, 区域:', areas.value.join(', '))
  } catch (e) { console.error('[台桌列表] 加载失败', e) }
}

// 区域筛选
function selectArea(area) {
  selectedArea.value = area
  console.log('[区域筛选]', area)
}

// 选择台桌
function selectTable(table) {
  console.log('[选择台桌]', table.table_name_cn, table.table_name_en, '开关数:', table.switches?.length)
  if (!table.switches || table.switches.length === 0) {
    uni.showToast({ title: '该台桌未关联开关设备', icon: 'none' })
    return
  }
  selectedTable.value = table
  showTableConfirm.value = true
}

function closeTableConfirm() {
  showTableConfirm.value = false
  selectedTable.value = null
}

async function tableControlAction(action) {
  const table = selectedTable.value
  if (!table) return
  closeTableConfirm()
  try {
    console.log('[台桌控制]', table.table_name_cn, table.table_name_en, action)
    await apiRequest('/switch/table-control', 'POST', {
      table_name_en: table.table_name_en,
      action
    })
    uni.showToast({ title: `${table.table_name_cn} ${action === 'ON' ? '开灯' : '关灯'}成功`, icon: 'success' })
  } catch (e) {
    console.error('[台桌控制异常]', e)
    reportError('tableControl', e, { table_name_en: table.table_name_en, action })
    uni.showToast({ title: e.message || '操作失败', icon: 'none' })
  }
}

async function toggleAutoOff() {
  const action = autoOffEnabled.value ? '关闭' : '开启'
  confirmText.value = `确认${action}智能省电-自动？`
  pendingAction = 'toggleAutoOff'
  showConfirm.value = true
}

// 智能省电-手动
function executeManualOff() {
  const adminInfo = uni.getStorageSync('adminInfo') || {}
  const role = adminInfo.role

  // 非管理员直接拦截
  if (role !== '管理员') {
    return uni.showToast({ title: '测试专用，仅限管理员使用', icon: 'none' })
  }

  confirmText.value = '确认执行一次智能省电（手动）？将关闭当前空闲台桌的灯。'
  pendingAction = 'manualOff'
  showConfirm.value = true
}

function executeScene(scene) {
  console.log('[执行场景]', scene.scene_name, scene.action, 'id:', scene.id)
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
  // 先保存 pendingAction 的副本，避免 closeConfirm() 将其置为 null
  const action = pendingAction
  closeConfirm()
  try {
    console.log('[执行操作]', JSON.stringify(action))
    if (action === 'toggleAutoOff') {
      await apiRequest('/switch/auto-off-toggle', 'POST')
      autoOffEnabled.value = !autoOffEnabled.value
      uni.showToast({ title: autoOffEnabled.value ? '已开启' : '已关闭', icon: 'success' })
    } else if (action === 'manualOff') {
      const res = await apiRequest('/switch/auto-off-manual', 'POST')
      const count = res?.turnedOffCount || 0
      uni.showToast({ title: `智能省电执行完成，实际关灯 ${count} 个`, icon: 'success', duration: 3000 })
    } else if (action.type === 'scene') {
      const scene = action.scene
      console.log('[场景执行] scene.id:', scene.id, 'scene.action:', scene.action)
      if (!scene || !scene.id) {
        throw new Error('场景数据无效: scene=' + JSON.stringify(scene))
      }
      await apiRequest(`/switch/scene/${scene.id}`, 'POST')
      uni.showToast({ title: '场景执行成功', icon: 'success' })
    } else if (action.type === 'label') {
      await apiRequest('/switch/label-control', 'POST', {
        label: selectedLabel.value,
        action: action.action
      })
      uni.showToast({ title: '操作成功', icon: 'success' })
    }
  } catch (e) {
    console.error('[执行操作异常]', e)
    reportError('confirmAction', e, { pendingAction: JSON.stringify(action) })
    uni.showToast({ title: e.message || '操作失败', icon: 'none' })
  }
}

function closeConfirm() {
  showConfirm.value = false
  pendingAction = null
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/member/member' })
  }
}
</script>

<style scoped>
/* 页面基础 */
.page { background: #0a0a0f; min-height: 100vh; color: #fff; overflow-x: hidden; box-sizing: border-box; max-width: 100vw; }

/* 固定顶部 */
.fixed-header { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(10,10,15,0.95); backdrop-filter: blur(10px); box-sizing: border-box; }
.status-bar-bg { background: rgba(10,10,15,0.95); }
.header-content { display: flex; align-items: center; height: 44px; padding: 0 16px; box-sizing: border-box; }
.back-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.back-icon { font-size: 24px; color: #d4af37; }
.header-title { flex: 1; text-align: center; font-size: 17px; font-weight: 500; }
.header-placeholder { width: 100%; }

/* 内容区 */
.content { padding: 16px; padding-bottom: 40px; box-sizing: border-box; overflow-x: hidden; }

/* 卡片通用样式 */
.card {
  background: rgba(20,20,30,0.8);
  border-radius: 16px;
  border: 1px solid rgba(218,165,32,0.15);
  margin-bottom: 16px;
  overflow: hidden;
  box-sizing: border-box;
}
.card-header {
  display: flex; align-items: center; gap: 8px;
  padding: 16px 16px 0;
}
.card-icon { font-size: 20px; }
.card-title { font-size: 16px; font-weight: 500; color: #d4af37; }
.card-body { padding: 12px 16px 16px; box-sizing: border-box; }

/* 智能省电卡片 */
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

/* 手动省电按钮 */
.manual-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin-top: 14px; padding: 12px;
  background: rgba(34,197,94,0.12);
  border: 1px solid rgba(34,197,94,0.3);
  border-radius: 10px;
  transition: all 0.2s;
}
.manual-btn:active { transform: scale(0.97); background: rgba(34,197,94,0.2); }
.manual-btn-icon { font-size: 16px; color: #22c55e; }
.manual-btn-text { font-size: 14px; color: #22c55e; font-weight: 500; }

/* 区域筛选（折行显示，无滚动条） */
.area-btns-wrap { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.area-btn {
  flex-shrink: 0; padding: 6px 14px; border-radius: 16px;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
  font-size: 13px; color: rgba(255,255,255,0.7);
  box-sizing: border-box;
}
.area-btn.active {
  background: rgba(218,165,32,0.25); border-color: rgba(218,165,32,0.5); color: #d4af37;
}
.area-btn text { white-space: nowrap; }

/* 台桌网格（折行显示，无滚动条） */
.table-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.table-btn {
  padding: 10px 12px; border-radius: 8px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  flex: 1;
  min-width: calc(25% - 6px);
  max-width: calc(25% - 6px);
  text-align: center;
  overflow: hidden;
  box-sizing: border-box;
}
.table-btn:active { transform: scale(0.95); }
.table-btn-text { font-size: 13px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }

.table-confirm .confirm-buttons { flex-wrap: wrap; gap: 8px; }
.btn-on-action { background: rgba(218,165,32,0.3) !important; color: #d4af37 !important; }
.btn-off-action { background: rgba(100,100,150,0.3) !important; color: #aaa !important; }

/* 标签选择器 */
.label-picker {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: rgba(255,255,255,0.05);
  border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
  box-sizing: border-box;
}
.label-picker-text { font-size: 15px; color: #fff; }
.label-picker-arrow { font-size: 12px; color: rgba(255,255,255,0.4); }
.label-actions { display: flex; gap: 12px; margin-top: 12px; box-sizing: border-box; }
.action-btn {
  flex: 1; padding: 14px; border-radius: 10px;
  text-align: center; font-size: 15px; font-weight: 500;
  box-sizing: border-box;
}
.btn-on { background: rgba(218,165,32,0.2); color: #d4af37; }
.btn-off { background: rgba(100,100,150,0.2); color: #aaa; }
.action-btn:active { transform: scale(0.96); }

/* 快捷场景（顶部缩小，一行3个） */
.scene-card-top .card-title { color: rgba(255,255,255,0.5); font-size: 14px; }
.scene-grid-top { display: flex; flex-wrap: wrap; gap: 8px; }
.scene-btn-top {
  flex: 1;
  min-width: 0;
  max-width: calc(33.33% - 6px);
  padding: 10px 6px;
  border-radius: 8px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  transition: all 0.2s;
  overflow: hidden;
}
.scene-btn-top:active { transform: scale(0.95); }
.scene-btn-icon-top { font-size: 18px; }
.scene-btn-text-top { font-size: 11px; text-align: center; word-break: break-all; }
.scene-on {
  background: rgba(218,165,32,0.15);
  border: 1px solid rgba(218,165,32,0.3);
}
.scene-off {
  background: rgba(100,100,150,0.15);
  border: 1px solid rgba(100,100,150,0.3);
}

/* 快捷场景卡片（底部缩小版） */
.scene-card-bottom {
  border-color: rgba(255,255,255,0.1);
  background: rgba(15,15,22,0.7);
}
.scene-card-bottom .card-title { color: rgba(255,255,255,0.5); font-size: 14px; }
.scene-card-bottom .card-body { padding: 10px 16px 14px; }

/* 底部场景按钮 */
.scene-grid-bottom { display: flex; flex-wrap: wrap; gap: 8px; }
.scene-btn-bottom {
  flex: 1;
  min-width: calc(50% - 4px);
  padding: 10px 8px;
  border-radius: 8px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  transition: all 0.2s;
}
.scene-btn-bottom:active { transform: scale(0.96); }
.scene-btn-bottom .scene-btn-icon-small { font-size: 18px; }
.scene-btn-bottom .scene-btn-text-small { font-size: 12px; text-align: center; }

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
