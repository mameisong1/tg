<template>
  <view class="page">
    <!-- 固定标题栏 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">‹</text>
        </view>
        <text class="header-title">上班/下班</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 助教信息 -->
    <view class="coach-info-section">
      <text class="coach-name">{{ coachInfo.stageName }}</text>
      <text class="coach-no">工号: {{ coachInfo.employeeId }}</text>
      <text class="coach-shift" v-if="waterBoard">当前班次: {{ waterBoard.shift }}</text>
    </view>

    <!-- 当前水牌状态 -->
    <view class="current-status" v-if="waterBoard">
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

    <!-- QA-20260501-1: 钉钉打卡提示区域（上班时显示） -->
    <view class="dingtalk-tip-section" v-if="canClockIn">
      <view class="tip-alert">
        <text class="tip-icon">⚠️</text>
        <view class="tip-text-lines">
          <text class="tip-text">请先在钉钉打卡</text>
          <text class="tip-text">钉钉打卡后5分钟内来系统打卡翻牌</text>
        </view>
      </view>
      <view class="checkbox-row" @click="toggleDingtalkConfirm">
        <view class="checkbox-box" :class="{ checked: dingtalkConfirmed }">
          <text v-if="dingtalkConfirmed" class="checkbox-check">✓</text>
        </view>
        <text class="checkbox-label">我确认已完成钉钉打卡</text>
      </view>
    </view>

    <!-- 打卡截图上传区域（QA-20260501-1: 改为可选，仅上班时显示） -->
    <view class="photo-section" v-if="canClockIn && showPhotoUpload">
      <text class="photo-title">上传打卡截图（可选）</text>
      <view class="photo-grid">
        <view v-if="imageUrls.length > 0" class="photo-item">
          <image :src="imageUrls[0]" mode="aspectFill" class="photo-img" @click="previewImage" />
          <view class="photo-remove" @click="removeImage(0)"><text>✕</text></view>
        </view>
        <view v-else class="photo-upload" @click="chooseAndUpload">
          <text class="photo-icon">📷</text>
          <text class="photo-text">点击上传</text>
        </view>
      </view>
      <text class="photo-tip">如钉钉打卡失败，可上传截图由管理员手动处理</text>
    </view>

    <!-- 上传进度 -->
    <view class="upload-progress" v-if="uploading">
      <text>{{ uploadText }}</text>
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: uploadProgress + '%' }"></view>
      </view>
    </view>

    <!-- QA-20260501-1: 沙漏弹框 -->
    <view class="hourglass-modal" v-if="showHourglass">
      <view class="hourglass-content">
        <text class="hourglass-icon">⏳</text>
        <text class="hourglass-text">正在同步5分钟内钉钉打卡数据...</text>
        <text class="hourglass-counter">{{ countdownSeconds }}秒</text>
      </view>
    </view>

    <!-- QA-20260501-1: 超时弹框 -->
    <view class="timeout-modal" v-if="showTimeoutModal">
      <view class="timeout-content">
        <text class="timeout-title">打卡失败</text>
        <text class="timeout-text">未获取到钉钉打卡时间，请联系助教管理或店长提交打卡截图手动打卡翻牌</text>
        <view class="timeout-btn" @click="onTimeoutConfirm">
          <text>我知道了</text>
        </view>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="action-section">
      <!-- QA-20260501-1: 上班按钮禁用条件增加 dingtalkConfirmed -->
      <view class="action-btn clock-in-btn" :class="{ disabled: !canClockIn || !dingtalkConfirmed || uploading }" @click="handleClockIn">
        <text class="action-icon">⏰</text>
        <text class="action-text">上班</text>
      </view>
      <view class="action-btn clock-out-btn" :class="{ disabled: !canClockOut }" @click="handleClockOut">
        <text class="action-icon">🌙</text>
        <text class="action-text">下班</text>
      </view>
    </view>

    <!-- 提示 -->
    <view class="tips">
      <text class="tips-title">状态说明</text>
      <text class="tips-text">上班：从非在班状态进入空闲状态（根据班次决定早班/晚班）</text>
      <text class="tips-text">下班：从在班状态（空闲/上桌/加班）变为下班状态</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/utils/api.js'
import { useImageUpload } from '@/utils/image-upload.js'

const statusBarHeight = ref(0)
const coachInfo = ref({})
const waterBoard = ref(null)

// QA-20260501-1: 新增状态变量
const dingtalkConfirmed = ref(false)  // 钉钉打卡确认勾选框
const showPhotoUpload = ref(false)    // 截图上传默认隐藏（可选）
const showHourglass = ref(false)      // 沙漏弹框
const showTimeoutModal = ref(false)   // 超时弹框
const countdownSeconds = ref(300)     // 倒计时秒数（5分钟）
const pollingTimer = ref(null)        // 轮询定时器
const countdownTimer = ref(null)      // 倒计时定时器
const currentLejuanId = ref(null)     // 当前乐捐记录ID（双重场景）

// 图片上传模块
const { imageUrls, uploading, uploadProgress, uploadText, chooseAndUpload, removeImage } =
  useImageUpload({ maxCount: 1, ossDir: 'TgTemp/', errorType: 'clock_in' })

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
})

// QA-20260501-1: 清理定时器
onUnmounted(() => {
  if (pollingTimer.value) {
    clearInterval(pollingTimer.value)
    pollingTimer.value = null
  }
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
    countdownTimer.value = null
  }
})

// 每次页面显示时重新读取 coachInfo 和加载水牌
onShow(() => {
  coachInfo.value = uni.getStorageSync('coachInfo') || {}
  if (coachInfo.value.coachNo) {
    loadWaterBoard()
  }
})

const loadWaterBoard = async () => {
  try {
    const res = await api.waterBoards.getOne(coachInfo.value.coachNo)
    waterBoard.value = res.data
  } catch (e) {
    uni.showToast({ title: '获取状态失败', icon: 'none' })
  }
}

const canClockIn = computed(() => {
  if (!waterBoard.value) return false
  const status = waterBoard.value.status
  return ['早加班', '晚加班', '休息', '公休', '请假', '下班', '乐捐'].includes(status)
})

const canClockOut = computed(() => {
  if (!waterBoard.value) return false
  const status = waterBoard.value.status
  // 只允许从空闲状态下班，其他状态需先回到空闲
  return ['早班空闲', '晚班空闲'].includes(status)
})

const statusClass = (status) => {
  if (status?.includes('上桌')) return 'status-on-table'
  if (status?.includes('空闲')) return 'status-free'
  if (status === '下班') return 'status-off'
  return 'status-other'
}

// QA-20260501-1: 切换钉钉打卡确认勾选框
const toggleDingtalkConfirm = () => {
  dingtalkConfirmed.value = !dingtalkConfirmed.value
}

// QA-20260501-1: 上班打卡流程（强制钉钉打卡）
const handleClockIn = async () => {
  if (!canClockIn.value) return
  if (!dingtalkConfirmed.value) {
    uni.showToast({ title: '请先勾选确认钉钉打卡', icon: 'none' })
    return
  }

  try {
    // 1. 获取乐捐记录ID（如果当前状态是乐捐）
    if (waterBoard.value.status === '乐捐') {
      // 查询活跃乐捐记录
      const lejuanRes = await api.lejuanRecords.getMyList({ coach_no: coachInfo.value.coachNo })
      const activeLejuan = lejuanRes.data?.find(r => r.lejuan_status === 'active')
      if (activeLejuan) {
        currentLejuanId.value = activeLejuan.id
      }
    }

    // 2. 调用钉钉打卡查询接口
    uni.showLoading({ title: '检查钉钉打卡...' })
    const queryRes = await api.dingtalkAttendance.query({
      coach_no: coachInfo.value.coachNo,
      clock_type: 'in',
      lejuan_id: currentLejuanId.value
    })
    uni.hideLoading()

    if (queryRes.data.status === 'found') {
      // 钉钉打卡时间已获取 → 直接上班
      await doClockIn()
    } else if (queryRes.data.status === 'not_found' || queryRes.data.status === 'pending') {
      // 钉钉打卡时间未获取 → 显示沙漏弹框，启动轮询
      showHourglass.value = true
      countdownSeconds.value = 300
      startPolling()
      startCountdown()
    } else if (queryRes.data.status === 'error') {
      // 钉钉用户ID未绑定等错误
      uni.showToast({ title: queryRes.data.message || '钉钉配置错误', icon: 'none', duration: 3000 })
    }
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '查询失败', icon: 'none' })
  }
}

// QA-20260501-1: 启动轮询（每10秒查询一次钉钉打卡状态）
const startPolling = () => {
  pollingTimer.value = setInterval(async () => {
    try {
      const statusRes = await api.dingtalkAttendance.getStatus({
        coach_no: coachInfo.value.coachNo,
        clock_type: 'in',
        lejuan_id: currentLejuanId.value
      })

      if (statusRes.data.status === 'found') {
        // 钉钉打卡时间已获取 → 关闭沙漏，上班
        stopPolling()
        showHourglass.value = false
        await doClockIn()
      }
      // status === 'pending' → 继续轮询，前端倒计时控制超时
    } catch (e) {
      // 轮询失败，继续轮询
      console.error('轮询钉钉打卡状态失败:', e)
    }
  }, 10000)  // 每10秒轮询一次
}

// QA-20260501-1: 启动倒计时
const startCountdown = () => {
  countdownTimer.value = setInterval(() => {
    countdownSeconds.value -= 1
    if (countdownSeconds.value <= 0) {
      stopPolling()
      showHourglass.value = false
      showTimeoutModal.value = true
    }
  }, 1000)
}

// QA-20260501-1: 停止轮询和倒计时
const stopPolling = () => {
  if (pollingTimer.value) {
    clearInterval(pollingTimer.value)
    pollingTimer.value = null
  }
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
    countdownTimer.value = null
  }
}

// QA-20260501-1: 执行上班打卡
const doClockIn = async () => {
  try {
    uni.showLoading({ title: '上班中...' })
    await api.coachesV2.clockIn(coachInfo.value.coachNo, {
      clock_in_photo: imageUrls.value[0] || null,  // QA-20260501-1: 截图可选
      force_dingtalk: true
    })
    uni.hideLoading()
    uni.showToast({ title: '上班成功', icon: 'success' })
    // 清空图片和状态
    imageUrls.value = []
    dingtalkConfirmed.value = false
    currentLejuanId.value = null
    await loadWaterBoard()
  } catch (e) {
    uni.hideLoading()
    if (e.error === 'DINGTALK_NOT_FOUND') {
      // 钉钉打卡时间未找到 → 显示沙漏弹框
      showHourglass.value = true
      countdownSeconds.value = 300
      startPolling()
      startCountdown()
    } else {
      uni.showToast({ title: e.error || '上班失败', icon: 'none' })
    }
  }
}

// QA-20260501-1: 超时弹框确认 - 重置状态回初始界面
const onTimeoutConfirm = () => {
  showTimeoutModal.value = false
  // 重置所有状态，回到初始打卡界面
  // 此时用户需找助教管理或店长手动翻牌，不需要截图上传
  dingtalkConfirmed.value = false
  showPhotoUpload.value = false
  imageUrls.value = []
  currentLejuanId.value = null
  // 刷新水牌状态
  loadWaterBoard()
}

const handleClockOut = async () => {
  if (!canClockOut.value) return
  uni.showModal({
    title: '确认下班',
    content: '确定要下班吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '下班中...' })
          await api.coachesV2.clockOut(coachInfo.value.coachNo)
          uni.hideLoading()
          uni.showToast({ title: '下班成功', icon: 'success' })
          await loadWaterBoard()
        } catch (e) {
          uni.hideLoading()
          uni.showToast({ title: e.error || '下班失败', icon: 'none' })
        }
      }
    }
  })
}

// 预览图片
const previewImage = () => {
  if (imageUrls.value.length > 0) {
    uni.previewImage({ urls: imageUrls.value })
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

.coach-info-section { padding: 30px 20px 20px; text-align: center; background: linear-gradient(180deg, rgba(212,175,55,0.1) 0%, transparent 100%); }
.coach-name { font-size: 24px; font-weight: 600; color: #d4af37; display: block; margin-bottom: 8px; }
.coach-no { font-size: 14px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 4px; }
.coach-shift { font-size: 13px; color: rgba(255,255,255,0.4); display: block; }

.current-status { margin: 16px; padding: 20px; background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; text-align: center; }
.status-label { font-size: 13px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 8px; }
.status-badge { display: inline-block; padding: 8px 20px; border-radius: 20px; font-size: 16px; font-weight: 600; }
.status-on-table { background: rgba(46,204,113,0.2); border: 1px solid rgba(46,204,113,0.3); color: #2ecc71; }
.status-free { background: rgba(52,152,219,0.2); border: 1px solid rgba(52,152,219,0.3); color: #3498db; }
.status-off { background: rgba(231,76,60,0.2); border: 1px solid rgba(231,76,60,0.3); color: #e74c3c; }
.status-other { background: rgba(241,196,15,0.2); border: 1px solid rgba(241,196,15,0.3); color: #f1c40f; }
.table-info-label { font-size: 13px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 6px; }
.table-tags { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.table-tag { font-size: 13px; font-weight: 600; color: #d4af37; background: rgba(212,175,55,0.15); border: 1px solid rgba(212,175,55,0.3); border-radius: 8px; padding: 3px 10px; }

/* QA-20260501-1: 钉钉打卡提示区域 */
.dingtalk-tip-section { margin: 16px; padding: 16px; background: rgba(231,76,60,0.15); border: 1px solid rgba(231,76,60,0.3); border-radius: 12px; }
.tip-alert { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 12px; }
.tip-icon { font-size: 20px; line-height: 20px; }
.tip-text-lines { flex: 1; }
.tip-text-lines .tip-text { display: block; line-height: 1.5; }
.tip-text { font-size: 14px; color: #e74c3c; font-weight: 600; }
.checkbox-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
.checkbox-box { width: 22px; height: 22px; border-radius: 4px; border: 2px solid rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); }
.checkbox-box.checked { background: #2ecc71; border-color: #2ecc71; }
.checkbox-check { font-size: 14px; color: #fff; font-weight: 600; }
.checkbox-label { font-size: 14px; color: rgba(255,255,255,0.8); }

.action-section { display: flex; gap: 16px; padding: 20px 16px; }
.action-btn { flex: 1; height: 100px; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
.action-icon { font-size: 32px; }
.action-text { font-size: 16px; font-weight: 600; }
.clock-in-btn { background: linear-gradient(135deg, rgba(46,204,113,0.2), rgba(46,204,113,0.1)); border: 1px solid rgba(46,204,113,0.3); color: #2ecc71; }
.clock-out-btn { background: linear-gradient(135deg, rgba(231,76,60,0.2), rgba(231,76,60,0.1)); border: 1px solid rgba(231,76,60,0.3); color: #e74c3c; }
.action-btn.disabled { opacity: 0.3; }

.tips { margin: 16px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 10px; }
.tips-title { font-size: 14px; color: rgba(255,255,255,0.6); font-weight: 600; display: block; margin-bottom: 8px; }
.tips-text { font-size: 12px; color: rgba(255,255,255,0.4); display: block; margin-bottom: 4px; line-height: 1.5; }

/* 打卡截图上传区域 */
.photo-section { margin: 16px; padding: 16px; background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; }
.photo-title { font-size: 14px; color: #d4af37; font-weight: 600; display: block; margin-bottom: 10px; }
.photo-grid { display: flex; justify-content: center; }
.photo-item { position: relative; width: 80px; height: 80px; }
.photo-img { width: 80px; height: 80px; border-radius: 8px; object-fit: cover; }
.photo-remove { position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; background: #e74c3c; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.photo-remove text { font-size: 12px; color: #fff; line-height: 1; }
.photo-upload { width: 80px; height: 80px; border-radius: 8px; background: rgba(212,175,55,0.1); border: 1px dashed rgba(212,175,55,0.3); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.photo-icon { font-size: 24px; }
.photo-text { font-size: 11px; color: rgba(255,255,255,0.5); }
.photo-tip { font-size: 12px; color: rgba(255,255,255,0.4); display: block; margin-top: 10px; text-align: center; }

/* 上传进度 */
.upload-progress { margin: 16px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; text-align: center; }
.upload-progress text { font-size: 13px; color: rgba(255,255,255,0.6); display: block; margin-bottom: 8px; }
.progress-bar { height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: #d4af37; transition: width 0.3s; }

/* QA-20260501-1: 沙漏弹框 */
.hourglass-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.hourglass-content { padding: 40px 60px; background: rgba(20,20,30,0.9); border-radius: 20px; border: 1px solid rgba(212,175,55,0.3); display: flex; flex-direction: column; align-items: center; gap: 16px; }
.hourglass-icon { font-size: 48px; animation: rotate 2s linear infinite; }
@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.hourglass-text { font-size: 16px; color: rgba(255,255,255,0.8); }
.hourglass-counter { font-size: 20px; color: #d4af37; font-weight: 600; }

/* QA-20260501-1: 超时弹框 */
.timeout-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.timeout-content { padding: 30px; background: rgba(20,20,30,0.95); border-radius: 16px; border: 1px solid rgba(231,76,60,0.3); width: 80%; max-width: 320px; }
.timeout-title { font-size: 18px; color: #e74c3c; font-weight: 600; display: block; margin-bottom: 16px; text-align: center; }
.timeout-text { font-size: 14px; color: rgba(255,255,255,0.7); display: block; margin-bottom: 20px; text-align: center; line-height: 1.6; }
.timeout-btn { padding: 12px 30px; background: rgba(231,76,60,0.2); border: 1px solid rgba(231,76,60,0.3); border-radius: 8px; display: flex; align-items: center; justify-content: center; margin: 0 auto; }
.timeout-btn text { font-size: 14px; color: #e74c3c; font-weight: 600; }
</style>