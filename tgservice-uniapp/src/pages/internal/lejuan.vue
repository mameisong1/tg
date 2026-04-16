<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">乐捐报备</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 流程提示栏 -->
    <view class="hint-banner">
      <text class="hint-title">📌 乐捐流程</text>
      <text class="hint-text">1.选择日期时间提交预约 → 2.到时间自动变为乐捐状态 → 3.助教自己点"上班"按钮结束乐捐 → 4.提交付款截图</text>
    </view>

    <!-- 预约表单 -->
    <view class="form-section">
      <view class="section-title">📋 预约乐捐</view>
      <view class="form-item">
        <text class="form-label">日期</text>
        <picker mode="date" :value="form.scheduledDate" :start="today" @change="e => { form.scheduledDate = e.detail.value; onDateChange() }">
          <view class="picker-value">
            <text :class="{ placeholder: !form.scheduledDate }">{{ form.scheduledDate || '选择日期' }}</text>
            <text class="arrow">›</text>
          </view>
        </picker>
      </view>
      <view class="form-item">
        <text class="form-label">开始时间（整点）</text>
        <picker :range="hourLabels" @change="e => form.scheduledHour = hourOptions[e.detail.value]">
          <view class="picker-value">
            <text :class="{ placeholder: form.scheduledHour === null }">{{ form.scheduledHour !== null ? String(form.scheduledHour).padStart(2, '0') + ':00' : '选择整点时间' }}</text>
            <text class="arrow">›</text>
          </view>
        </picker>
      </view>
      <view class="form-item">
        <text class="form-label">备注</text>
        <input class="input" v-model="form.remark" placeholder="请输入备注（如和客人外出）" maxlength="200" />
      </view>
      <view class="submit-btn" :class="{ disabled: !canSubmit }" @click="submitLejuan"><text>提交预约</text></view>
    </view>

    <!-- 我的乐捐记录（近2天） -->
    <view class="records-section" v-if="myRecords.length > 0">
      <view class="section-title">📝 近2天记录</view>
      <view v-for="rec in myRecords" :key="rec.id" class="record-card" @click="goToProof(rec)">
        <view class="record-header">
          <text class="record-status" :class="'status-' + rec.lejuan_status">{{ statusLabel(rec.lejuan_status) }}</text>
          <view class="record-actions">
            <text class="record-time">{{ rec.scheduled_start_time.substring(5, 16) }}</text>
            <view v-if="rec.lejuan_status === 'pending'" class="delete-btn" @click.stop="deleteRecord(rec)"><text>删除</text></view>
          </view>
        </view>
        <view class="record-body">
          <text class="record-detail" v-if="rec.actual_start_time">生效: {{ rec.actual_start_time.substring(11, 16) }}</text>
          <text class="record-detail" v-if="rec.lejuan_hours !== null">外出: {{ rec.lejuan_hours }}小时</text>
          <text class="record-detail" v-if="rec.remark">{{ rec.remark }}</text>
          <view class="record-detail proof-images" v-if="getProofUrls(rec).length > 0">
            <text>✅ 已传截图 ({{ getProofUrls(rec).length }}张)</text>
            <view class="proof-thumbs">
              <image
                v-for="(url, idx) in getProofUrls(rec)"
                :key="idx"
                :src="url"
                mode="aspectFill"
                class="proof-thumb"
                @click.stop="previewProofImages(rec, idx)"
              />
            </view>
          </view>
          <text class="record-detail proof-hint" v-else-if="canUploadProof(rec)">📷 点击传截图</text>
        </view>
      </view>
    </view>

    <!-- 成功弹窗 -->
    <SuccessModal :visible="showSuccess" :title="successTitle" :content="successContent" @confirm="handleSuccessConfirm" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/utils/api-v2.js'
import SuccessModal from '@/components/SuccessModal.vue'
import { getBeijingDate } from '@/utils/time-util.js'

const statusBarHeight = ref(0)
const coachInfo = ref({})
const showSuccess = ref(false)
const successTitle = ref('预约成功')
const successContent = ref('乐捐报备已提交，到时间自动生效')
const myRecords = ref([])

const today = getBeijingDate()
const form = ref({
  scheduledDate: today,
  scheduledHour: null,
  remark: ''
})

// 获取当前小时（24小时制）
function getCurrentHour() {
  return new Date().getHours()
}

const hourOptions = computed(() => {
  const h = getCurrentHour()

  // 00:00 ~ 02:59: 窗口末尾，从当前小时到 02:00
  if (h >= 0 && h <= 2) {
    const opts = []
    for (let i = h; i <= 2; i++) opts.push(i)
    return opts
  }

  // 03:00 ~ 13:59: 窗口未到，显示全部13个选项（允许提前预约）
  if (h >= 3 && h < 14) {
    return [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2]
  }

  // 14:00 ~ 23:59: 从当前小时到次日 02:00
  const opts = []
  for (let i = h; i <= 23; i++) opts.push(i)
  opts.push(0, 1, 2)
  return opts
})

const formatHour = (hour) => {
  const h = String(hour).padStart(2, '0')
  const currentHour = getCurrentHour()
  if (currentHour >= 3 && hour <= 2) {
    return `次日${h}:00`
  }
  return `${h}:00`
}

const hourLabels = computed(() => {
  return hourOptions.value.map(h => {
    const label = `${String(h).padStart(2, '0')}:00`
    if (getCurrentHour() >= 3 && h <= 2) {
      return `次日${label}`
    }
    return label
  })
})

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  coachInfo.value = uni.getStorageSync('coachInfo') || {}
})

onShow(() => {
  coachInfo.value = uni.getStorageSync('coachInfo') || {}
  loadMyRecords()
})

const canSubmit = computed(() => {
  return form.value.scheduledDate && form.value.scheduledHour !== null
})

// 日期变化时重置小时选择
const onDateChange = () => {
  form.value.scheduledHour = null
}

const statusLabel = (status) => {
  const map = { pending: '待出发', active: '乐捐中', returned: '已归来' }
  return map[status] || status
}

// 判断是否可上传截图（近2天）
const canUploadProof = (rec) => {
  const createdDate = rec.created_at.split(' ')[0]
  const twoDaysAgo = getBeijingDate()
  // 简单比较：2天前
  const d1 = new Date(createdDate + 'T00:00:00+08:00')
  const d2 = new Date(twoDaysAgo + 'T00:00:00+08:00')
  const diffDays = (d2 - d1) / (1000 * 60 * 60 * 24)
  return diffDays <= 2
}

const deleteRecord = async (rec) => {
  if (rec.lejuan_status !== 'pending') return
  uni.showModal({
    title: '确认删除',
    content: '确认删除该乐捐预约？',
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '删除中...' })
          await api.lejuanRecords.delete(rec.id)
          uni.hideLoading()
          uni.showToast({ title: '已删除', icon: 'success' })
          await loadMyRecords()
        } catch (e) {
          uni.hideLoading()
          uni.showToast({ title: e.error || '删除失败', icon: 'none' })
        }
      }
    }
  })
}

const loadMyRecords = async () => {
  try {
    const res = await api.lejuanRecords.getMyList({ employee_id: coachInfo.value.employeeId })
    let records = res.data || []
    // 排序：乐捐中 > 待出发 > 已归来
    const statusPriority = { active: 0, pending: 1, returned: 2 }
    records.sort((a, b) => {
      const pa = statusPriority[a.lejuan_status] ?? 9
      const pb = statusPriority[b.lejuan_status] ?? 9
      if (pa !== pb) return pa - pb
      return b.scheduled_start_time.localeCompare(a.scheduled_start_time)
    })
    myRecords.value = records
  } catch (e) {
    // 静默失败，不影响页面
  }
}

const submitLejuan = async () => {
  if (!canSubmit.value) return uni.showToast({ title: '请选择日期和时间', icon: 'none' })

  // 检查是否有待出发或乐捐中的记录
  const activeRecord = myRecords.value.find(r =>
    r.lejuan_status === 'pending' || r.lejuan_status === 'active'
  )
  if (activeRecord) {
    const statusText = activeRecord.lejuan_status === 'pending' ? '待出发' : '乐捐中'
    return uni.showToast({
      title: `已有${statusText}的乐捐记录，请先处理`,
      icon: 'none',
      duration: 3000
    })
  }

  let submitDate = form.value.scheduledDate
  const currentHour = getCurrentHour()
  // 当前在3-23点时选了0/1/2点 → 日期+1天
  if (currentHour >= 3 && form.value.scheduledHour <= 2) {
    const d = new Date(submitDate + 'T00:00:00+08:00')
    d.setDate(d.getDate() + 1)
    submitDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }
  const scheduledTime = `${submitDate} ${String(form.value.scheduledHour).padStart(2, '0')}:00:00`

  try {
    uni.showLoading({ title: '提交中...' })
    const res = await api.lejuanRecords.create({
      employee_id: coachInfo.value.employeeId,
      scheduled_start_time: scheduledTime,
      remark: form.value.remark
    })
    uni.hideLoading()
    form.value.remark = ''
    form.value.scheduledHour = null
    
    if (res.data.immediate) {
      successTitle.value = '乐捐已生效'
      successContent.value = '当前小时提交，水牌已变为乐捐状态'
    } else {
      successTitle.value = '预约成功'
      successContent.value = '乐捐报备已提交，到时间自动生效'
    }
    showSuccess.value = true
    await loadMyRecords()
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '提交失败', icon: 'none' })
  }
}

// 解析 proof_image_url 为 URL 数组（兼容单URL和JSON数组）
const getProofUrls = (rec) => {
  if (!rec.proof_image_url) return []
  try {
    const parsed = JSON.parse(rec.proof_image_url)
    return Array.isArray(parsed) ? parsed : [rec.proof_image_url]
  } catch (e) {
    return [rec.proof_image_url]
  }
}

// 预览多张截图
const previewProofImages = (rec, idx) => {
  const urls = getProofUrls(rec)
  uni.previewImage({ urls, current: idx })
}

const goToProof = (rec) => {
  if (rec.proof_image_url) {
    // 已有截图，预览
    let urls = []
    try {
      const parsed = JSON.parse(rec.proof_image_url)
      urls = Array.isArray(parsed) ? parsed : [rec.proof_image_url]
    } catch (e) {
      urls = [rec.proof_image_url]
    }
    uni.previewImage({ urls })
    return
  }
  if (canUploadProof(rec)) {
    uni.navigateTo({
      url: `/pages/internal/lejuan-proof?id=${rec.id}&stageName=${rec.stage_name || ''}`
    })
  }
}

const handleSuccessConfirm = () => {
  showSuccess.value = false
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

/* 流程提示栏 */
.hint-banner { margin: 12px 16px 0; padding: 12px 16px; background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.3); border-radius: 10px; }
.hint-title { font-size: 14px; color: #d4af37; font-weight: 600; }
.hint-text { font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 4px; display: block; line-height: 1.5; }

.section-title { font-size: 15px; color: #d4af37; padding: 16px 16px 12px; font-weight: 600; }

.form-section { margin: 0 16px; }
.form-item { margin-bottom: 24px; }
.form-label { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 8px; display: block; }
.picker-value { display: flex; justify-content: space-between; align-items: center; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0 16px; }
.picker-value .placeholder { color: rgba(255,255,255,0.3); }
.arrow { font-size: 18px; color: rgba(255,255,255,0.3); }
.input { width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0 12px; font-size: 14px; color: #fff; box-sizing: border-box; }

.submit-btn { height: 50px; background: linear-gradient(135deg, #d4af37, #ffd700); border-radius: 25px; display: flex; align-items: center; justify-content: center; margin-top: 10px; margin-bottom: 20px; }
.submit-btn text { font-size: 16px; font-weight: 600; color: #000; }
.submit-btn.disabled { opacity: 0.5; }

/* 记录卡片 */
.records-section { margin: 0 16px; }
.record-card { background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; }
.record-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.record-status { font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 8px; }
.status-pending { background: rgba(241,196,15,0.2); color: #f1c40f; }
.status-active { background: rgba(231,76,60,0.2); color: #e74c3c; }
.status-returned { background: rgba(46,204,113,0.2); color: #2ecc71; }
.record-actions { display: flex; align-items: center; gap: 8px; }
.record-time { font-size: 13px; color: rgba(255,255,255,0.5); }
.delete-btn { padding: 4px 10px; background: rgba(231,76,60,0.2); border: 1px solid rgba(231,76,60,0.4); border-radius: 6px; }
.delete-btn text { font-size: 12px; color: #e74c3c; }
.record-body { display: flex; flex-direction: column; gap: 4px; }
.record-detail { font-size: 12px; color: rgba(255,255,255,0.4); }
.proof-hint { color: #d4af37 !important; }
.proof-images { display: flex; flex-direction: column; gap: 4px; }
.proof-thumbs { display: flex; gap: 6px; margin-top: 4px; }
.proof-thumb { width: 50px; height: 50px; border-radius: 6px; }
</style>
