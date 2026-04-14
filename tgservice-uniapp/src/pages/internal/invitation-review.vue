<template>
  <view class="page">
    <!-- 固定标题栏 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">今日约客审查-{{ shiftLabel }}</text>
        <view class="refresh-btn" @click="loadAll"><text class="refresh-icon">🔄</text></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 时间提示 -->
    <view class="time-tip">
      <text class="tip-icon">⏰</text>
      <text class="tip-text">{{ shift === '早班' ? '早班约客审查需在16:00后开始' : '晚班约客审查需在20:00后开始' }}</text>
    </view>

    <!-- 开始审查按钮 -->
    <view class="start-section">
      <view v-if="!isLocked" class="start-btn" @click="startReview">
        <text class="start-text">🔓 开始审查（锁定应约课空闲助教）</text>
      </view>
      <view v-else class="locked-tip">
        <text>✅ 已锁定 {{ lockedCount }} 名应约客人员</text>
      </view>
    </view>

    <!-- 统计卡片（可点击筛选） -->
    <view class="stats-row">
      <view class="stat-item" :class="{ active: filterResult === '待审查' }" @click="filterResult = '待审查'; loadData()">
        <text class="stat-value" style="color:#f1c40f">{{ stats.pending }}</text>
        <text class="stat-label">待审查</text>
      </view>
      <view class="stat-item" :class="{ active: filterResult === '未约客' }" @click="filterResult = '未约客'; loadData()">
        <text class="stat-value" style="color:#f39c12">{{ stats.not_invited }}</text>
        <text class="stat-label">未约客</text>
      </view>
      <view class="stat-item" :class="{ active: filterResult === '约客有效' }" @click="filterResult = '约客有效'; loadData()">
        <text class="stat-value" style="color:#2ecc71">{{ stats.approved }}</text>
        <text class="stat-label">有效</text>
      </view>
      <view class="stat-item" :class="{ active: filterResult === '约客无效' }" @click="filterResult = '约客无效'; loadData()">
        <text class="stat-value" style="color:#e74c3c">{{ stats.rejected }}</text>
        <text class="stat-label">无效</text>
      </view>
    </view>

    <!-- 筛选结果列表 -->
    <!-- 未约客列表 -->
    <view v-if="filterResult === '未约客'">
      <view class="section-title"><text>⚠️ 未约客</text><text class="count">{{ notInvitedList.length }}条</text></view>
      <view class="reviewed-list" v-if="notInvitedList.length > 0">
        <view class="reviewed-item" v-for="item in notInvitedList" :key="item.coach_no">
          <view class="image-grid-small" v-if="getImageUrls(item).length > 0">
            <image 
              v-for="(url, idx) in getImageUrls(item).slice(0, 3)" 
              :key="idx" 
              :src="url" 
              mode="aspectFill" 
              class="reviewed-thumb" 
              @click="previewAllImages(item)" 
            />
          </view>
          <view class="reviewed-info">
            <text class="reviewed-name">{{ item.stage_name }} ({{ item.employee_id || item.coach_no }}号)</text>
            <text class="reviewed-time">{{ formatTime(item.created_at) }}</text>
          </view>
          <view class="reviewed-badge badge-not-invited"><text>未约客</text></view>
        </view>
      </view>
      <view class="empty" v-else><text>✅ 暂无未约客助教</text></view>
    </view>

    <!-- 有效/无效列表 -->
    <view v-else-if="filterResult === '约客有效' || filterResult === '约客无效'">
      <view class="section-title"><text>📋 {{ filterResult === '约客有效' ? '有效' : '无效' }}</text><text class="count">{{ filterList.length }}条</text></view>
      <view class="reviewed-list" v-if="filterList.length > 0">
        <view class="reviewed-item" v-for="inv in filterList" :key="inv.id">
          <view class="image-grid-small" v-if="getImageUrls(inv).length > 0">
            <image 
              v-for="(url, idx) in getImageUrls(inv).slice(0, 3)" 
              :key="idx" 
              :src="url" 
              mode="aspectFill" 
              class="reviewed-thumb" 
              @click="previewAllImages(inv)" 
            />
          </view>
          <view class="reviewed-info">
            <text class="reviewed-name">{{ inv.stage_name }} ({{ inv.employee_id || inv.coach_no }}号)</text>
            <text class="reviewed-time">{{ formatTime(inv.created_at) }}</text>
          </view>
          <view class="reviewed-badge" :class="inv.result === '约客有效' ? 'badge-approved' : 'badge-rejected'"><text>{{ inv.result }}</text></view>
        </view>
      </view>
      <view class="empty" v-else><text>暂无{{ filterResult === '约客有效' ? '有效' : '无效' }}记录</text></view>
    </view>

    <!-- 待审查（默认）：卡片网格 -->
    <view v-else>
      <view class="section-title"><text>📋 待审查</text><text class="count">{{ pendingList.length }}条</text></view>
      <view class="cards-grid" v-if="pendingList.length > 0">
        <view class="card" v-for="(inv, idx) in pendingList" :key="inv.id" @click="openReview(idx)">
          <!-- 多图缩略图 -->
          <view class="card-image-grid" v-if="getImageUrls(inv).length > 0">
            <image 
              v-for="(url, imgIdx) in getImageUrls(inv).slice(0, 3)" 
              :key="imgIdx" 
              :src="url" 
              mode="aspectFill" 
              class="card-thumb"
            />
          </view>
          <view class="card-placeholder" v-else><text>暂无截图</text></view>
          <view class="card-info">
            <text class="card-name">{{ inv.stage_name }}</text>
            <text class="card-meta">{{ inv.employee_id || inv.coach_no }}号 · {{ formatTime(inv.created_at) }}</text>
            <view class="card-badge badge-pending"><text>待审查</text></view>
          </view>
        </view>
      </view>
      <view class="empty" v-else><text>✅ 暂无待审查</text></view>
    </view>

    <!-- 全屏审查弹窗 -->
    <view class="review-overlay" v-if="showReview" @click="closeReview">
      <view class="review-box" @click.stop>
        <view class="review-header">
          <text class="review-counter">{{ reviewIndex + 1 }} / {{ pendingList.length }}</text>
          <view class="review-close" @click="closeReview"><text>✕</text></view>
        </view>
        
        <!-- 图片展示区（大图 85vh） -->
        <view class="review-image-container">
          <!-- 左箭头 -->
          <view v-if="currentReviewImages.length > 1" class="img-nav-arrow img-nav-left" @click="prevReviewImage">
            <text>‹</text>
          </view>
          
          <image 
            v-if="currentReviewImages.length > 0" 
            :src="currentReviewImages[currentImageIndex]" 
            mode="aspectFit" 
            class="review-image-full" 
            @click="previewAllCurrentImages"
          />
          <view class="review-placeholder" v-else><text>暂无截图</text></view>
          
          <!-- 右箭头 -->
          <view v-if="currentReviewImages.length > 1" class="img-nav-arrow img-nav-right" @click="nextReviewImage">
            <text>›</text>
          </view>
        </view>
        
        <!-- 多图指示器 -->
        <view class="indicator-dots" v-if="currentReviewImages.length > 1">
          <view 
            v-for="(_, idx) in currentReviewImages" 
            :key="idx" 
            class="indicator-dot" 
            :class="{ active: idx === currentImageIndex }"
          ></view>
          <text class="image-counter-text">{{ currentImageIndex + 1 }} / {{ currentReviewImages.length }}</text>
        </view>
        
        <view class="review-info">
          <text class="review-name">{{ currentReview?.stage_name }} ({{ currentReview?.employee_id || currentReview?.coach_no }}号)</text>
          <text class="review-meta">{{ formatTime(currentReview?.created_at) }} · {{ shiftLabel }}</text>
        </view>
        <view class="review-actions">
          <view class="review-btn btn-invalid" @click="submitReview('约客无效')"><text>❌ 无效</text></view>
          <view class="review-btn btn-valid" @click="submitReview('约客有效')"><text>✅ 有效</text></view>
        </view>
        <view class="review-nav" v-if="pendingList.length > 1">
          <view class="nav-arrow" @click="navigateReview(-1)"><text>‹</text></view>
          <view class="nav-arrow" @click="navigateReview(1)"><text>›</text></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/utils/api-v2.js'
import { getBeijingDate } from '@/utils/time-util.js'

const statusBarHeight = ref(0)
const shiftLabel = ref('早班')
const shift = ref('早班')
const filterResult = ref('待审查')
const invitations = ref([])
const showReview = ref(false)
const reviewIndex = ref(0)
const notInvitedList = ref([])

// 审查锁定状态
const isLocked = ref(false)
const lockedCount = ref(0)

// 审查弹窗内的当前图片索引
const currentImageIndex = ref(0)

// 统计数据
const reviewStats = ref({
  should_invite_count: 0,
  invited_count: 0,
  missing_list: [],
  invalid_list: []
})

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (currentPage.options?.shift) {
    shift.value = currentPage.options.shift
    shiftLabel.value = shift.value
  }
  loadAll()
})

const pendingList = computed(() => invitations.value.filter(i => i.result === '待审查'))
const reviewedList = computed(() => invitations.value.filter(i => i.result !== '待审查'))
const currentReview = computed(() => pendingList.value[reviewIndex.value] || null)

// 当前审查记录的图片列表
const currentReviewImages = computed(() => {
  if (!currentReview.value) return []
  return getImageUrls(currentReview.value)
})

const stats = computed(() => ({
  total: invitations.value.length,
  pending: invitations.value.filter(i => i.result === '待审查').length,
  approved: invitations.value.filter(i => i.result === '约客有效').length,
  rejected: invitations.value.filter(i => i.result === '约客无效').length,
  not_invited: notInvitedList.value.length
}))

const filterList = computed(() => {
  if (filterResult.value === '未约客') return notInvitedList.value
  return invitations.value.filter(i => i.result === filterResult.value)
})

// 解析图片 URL 数组
const getImageUrls = (record) => {
  if (!record) return []
  if (record.images) {
    try {
      const imgs = typeof record.images === 'string' ? JSON.parse(record.images) : record.images
      if (Array.isArray(imgs)) return imgs
    } catch (e) {}
  }
  return []
}

// 修复：解析数据库时间字符串时加 '+08:00' 显式指定北京时间时区
// 数据库存的是北京时间 "YYYY-MM-DD HH:MM:SS"，不加时区会被当作 UTC
const formatTime = (t) => {
  if (!t) return '-'
  const d = new Date(t.replace(' ', 'T') + '+08:00')
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// 加载所有数据
const loadAll = async () => {
  await loadData()
  await loadNotInvited()
  await loadReviewStats()
  await checkLocked()
}

const loadData = async () => {
  const today = getBeijingDate() // 修复：使用北京时间
  try {
    const res = await api.guestInvitations.getList({ date: today, shift: shift.value })
    invitations.value = res.data || []
  } catch (e) { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

// 加载未约客列表（result = '应约客'）
const loadNotInvited = async () => {
  const today = getBeijingDate() // 修复：使用北京时间
  try {
    const res = await api.guestInvitations.getList({ date: today, shift: shift.value, result: '应约客' })
    notInvitedList.value = res.data || []
  } catch (e) {
    notInvitedList.value = []
  }
}

// 加载统计数据
const loadReviewStats = async () => {
  const today = getBeijingDate() // 修复：使用北京时间
  try {
    const res = await api.guestInvitations.getStats(today, shift.value)
    if (res.data) {
      reviewStats.value = res.data
    }
  } catch (e) {
    // 统计可能还没生成，忽略
  }
}

// 检查是否已锁定（从内存变量读取）
const checkLocked = async () => {
  const today = getBeijingDate() // 修复：使用北京时间
  try {
    const res = await api.guestInvitations.checkLock({ date: today, shift: shift.value })
    if (res.data && res.data.is_locked) {
      isLocked.value = true
      lockedCount.value = res.data.count || 0
    }
  } catch (e) {
    // 忽略
  }
}

// 开始审查（锁定应约客人员）
const startReview = async () => {
  const today = getBeijingDate() // 修复：使用北京时间
  try {
    uni.showLoading({ title: '锁定中...' })
    const res = await api.guestInvitations.lockShouldInvite({ date: today, shift: shift.value })
    uni.hideLoading()
    if (res.success) {
      isLocked.value = true
      const totalCount = res.data.total_count || 0
      lockedCount.value = totalCount
      uni.showToast({ title: `已锁定，该班次共${totalCount}人`, icon: 'success' })
      loadAll()
    } else {
      uni.showToast({ title: res.error || '锁定失败', icon: 'none' })
    }
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '锁定失败', icon: 'none' })
  }
}

// 图片预览
const previewAllImages = (record) => {
  const urls = getImageUrls(record)
  if (urls.length > 0) {
    uni.previewImage({ urls: urls, current: 0 })
  }
}

const previewAllCurrentImages = () => {
  const images = currentReviewImages.value
  if (images.length > 0) {
    uni.previewImage({ urls: images, current: currentImageIndex.value })
  }
}

// 审查弹窗内的图片切换
const prevReviewImage = () => {
  if (currentImageIndex.value > 0) currentImageIndex.value--
}

const nextReviewImage = () => {
  if (currentImageIndex.value < currentReviewImages.value.length - 1) currentImageIndex.value++
}

const openReview = (idx) => {
  reviewIndex.value = idx
  currentImageIndex.value = 0  // 重置图片索引
  showReview.value = true
}
const closeReview = () => { showReview.value = false }
const navigateReview = (dir) => {
  if (pendingList.value.length === 0) return
  reviewIndex.value = (reviewIndex.value + dir + pendingList.value.length) % pendingList.value.length
  currentImageIndex.value = 0  // 切换助教时重置图片索引
}

const submitReview = async (result) => {
  if (!currentReview.value) return
  try {
    const adminInfo = uni.getStorageSync('adminInfo') || {}
    await api.guestInvitations.review(currentReview.value.id, { result, reviewer_phone: adminInfo.username })
    uni.showToast({ title: result === '约客有效' ? '✅ 已标记有效' : '❌ 已标记无效', icon: 'success' })
    if (pendingList.value.length <= 1) {
      closeReview()
      reviewIndex.value = 0
    } else if (reviewIndex.value >= pendingList.value.length - 1) {
      reviewIndex.value = Math.max(0, pendingList.value.length - 2)
    }
    loadAll()
  } catch (e) { uni.showToast({ title: e.error || '操作失败', icon: 'none' }) }
}

const goBack = () => { const pages = getCurrentPages(); if (pages.length > 1) { uni.navigateBack() } else { uni.switchTab({ url: '/pages/member/member' }) } }
</script>

<style scoped>
.page { min-height: 100vh; background: #0a0a0f; padding-bottom: 40px; }
.fixed-header { position: fixed; top: 0; left: 0; right: 0; z-index: 999; background: #0a0a0f; }
.status-bar-bg { background: #0a0a0f; }
.header-content { height: 44px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; }
.back-btn, .refresh-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.back-icon { font-size: 28px; color: #d4af37; }
.refresh-icon { font-size: 18px; }
.header-title { font-size: 17px; font-weight: 600; color: #d4af37; letter-spacing: 2px; }
.header-placeholder { background: #0a0a0f; }

/* 时间提示 */
.time-tip { margin: 12px; padding: 10px 16px; background: rgba(241,196,15,0.1); border: 1px solid rgba(241,196,15,0.2); border-radius: 10px; display: flex; align-items: center; }
.tip-icon { font-size: 16px; margin-right: 8px; }
.tip-text { font-size: 13px; color: #f1c40f; }

/* 开始审查按钮 */
.start-section { padding: 0 12px 8px; }
.start-btn { height: 44px; background: linear-gradient(135deg, #d4af37, #ffd700); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.start-text { font-size: 15px; font-weight: 600; color: #000; }
.locked-tip { height: 44px; background: rgba(46,204,113,0.1); border: 1px solid rgba(46,204,113,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.locked-tip text { font-size: 13px; color: #2ecc71; }

/* 统计卡片 */
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 12px; }
.stat-item { background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 10px; padding: 12px 8px; text-align: center; cursor: pointer; }
.stat-item.active { background: rgba(212,175,55,0.2); border-color: #d4af37; }
.stat-value { font-size: 20px; color: #d4af37; display: block; }
.stat-label { font-size: 11px; color: rgba(255,255,255,0.5); display: block; margin-top: 4px; }

/* 列表区域 */
.section-title { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; font-size: 15px; color: rgba(255,255,255,0.8); }
.section-title .count { font-size: 12px; color: rgba(255,255,255,0.4); }

/* 卡片网格 */
.cards-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 0 12px 12px; }
.card { background: rgba(20,20,30,0.8); border: 1px solid rgba(218,165,32,0.1); border-radius: 10px; overflow: hidden; }

/* 多图缩略图网格 */
.card-image-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px; width: 100%; }
.card-thumb { width: 100%; height: 80px; }
.card-placeholder { width: 100%; height: 120px; background: #1a1a2a; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.3); font-size: 12px; }
.card-info { padding: 8px; }
.card-name { font-size: 13px; color: #d4af37; font-weight: 500; display: block; }
.card-meta { font-size: 10px; color: rgba(255,255,255,0.5); display: block; margin-top: 2px; }
.card-badge { display: inline-block; padding: 2px 6px; border-radius: 6px; font-size: 10px; margin-top: 4px; }
.badge-pending { background: rgba(241,196,15,0.2); color: #f1c40f; }
.badge-approved { background: rgba(46,204,113,0.2); color: #2ecc71; }
.badge-rejected { background: rgba(231,76,60,0.2); color: #e74c3c; }
.badge-not-invited { background: rgba(149,165,166,0.2); color: #95a5a6; }

/* 已审查列表 */
.reviewed-list { padding: 0 12px; }
.reviewed-item { display: flex; align-items: center; gap: 10px; background: rgba(20,20,30,0.6); border: 1px solid rgba(218,165,32,0.1); border-radius: 10px; padding: 10px; margin-bottom: 8px; }
.image-grid-small { display: flex; gap: 4px; }
.reviewed-thumb { width: 40px; height: 40px; border-radius: 6px; flex-shrink: 0; }
.reviewed-info { flex: 1; }
.reviewed-name { font-size: 13px; color: #fff; display: block; }
.reviewed-time { font-size: 10px; color: rgba(255,255,255,0.4); display: block; margin-top: 2px; }
.reviewed-badge { padding: 3px 8px; border-radius: 8px; font-size: 10px; flex-shrink: 0; }

.empty { text-align: center; padding: 40px 20px; color: rgba(255,255,255,0.3); font-size: 14px; }

/* 全屏审查弹窗 */
.review-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 998; display: flex; align-items: center; justify-content: center; }
.review-box { width: 95%; max-width: 420px; display: flex; flex-direction: column; align-items: center; }
.review-header { width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.review-counter { font-size: 13px; color: #d4af37; background: rgba(20,20,30,0.8); padding: 6px 14px; border-radius: 14px; }
.review-close { width: 28px; height: 28px; background: rgba(255,255,255,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 14px; }

/* 图片容器（带左右箭头） */
.review-image-container { position: relative; width: 100%; display: flex; align-items: center; justify-content: center; }
.review-image-full { width: 100%; max-height: 85vh; border-radius: 10px; }
.review-placeholder { width: 100%; height: 200px; background: #1a1a2a; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.3); font-size: 14px; }

/* 左右切换箭头 */
.img-nav-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; background: rgba(0,0,0,0.6); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 22px; z-index: 10; }
.img-nav-left { left: 8px; }
.img-nav-right { right: 8px; }

/* 多图指示器 */
.indicator-dots { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
.indicator-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.3); transition: all 0.2s; }
.indicator-dot.active { background: #d4af37; transform: scale(1.2); }
.image-counter-text { font-size: 12px; color: rgba(255,255,255,0.5); margin-left: 8px; }

.review-info { text-align: center; margin-top: 8px; }
.review-name { font-size: 15px; color: #d4af37; font-weight: 600; display: block; }
.review-meta { font-size: 12px; color: rgba(255,255,255,0.5); display: block; margin-top: 4px; }
.review-actions { display: flex; gap: 10px; margin-top: 12px; width: 100%; }
.review-btn { flex: 1; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; }
.btn-invalid { background: rgba(231,76,60,0.2); border: 1px solid rgba(231,76,60,0.3); color: #e74c3c; }
.btn-valid { background: linear-gradient(135deg, #d4af37, #ffd700); color: #000; }
.review-nav { display: flex; justify-content: space-between; width: 100%; margin-top: 10px; }
.nav-arrow { width: 36px; height: 36px; background: rgba(255,255,255,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; }
</style>
