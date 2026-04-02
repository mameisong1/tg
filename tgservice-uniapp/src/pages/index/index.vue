<template>
  <view class="page">
    <!-- #ifdef H5 -->
    <!-- 测试环境红色警告横幅 -->
    <view class="test-env-banner" v-if="isTestEnv">
      <text>⚠️ 当前是测试环境！</text>
    </view>
    <!-- #endif -->
    <!-- 标题栏：小程序固定，H5不固定 -->
    <!-- #ifndef H5 -->
    <view class="fixed-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="header-content">
        <view class="pool-cue-container">
          <view class="pool-cue"></view>
          <view class="pool-balls">
            <view class="ball ball-7">7</view>
            <view class="ball ball-8">8</view>
            <view class="ball ball-9">9</view>
          </view>
        </view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>
    <!-- #endif -->
    
    <!-- #ifdef H5 -->
    <view class="h5-header">
      <view class="header-content">
        <view class="pool-cue-container">
          <view class="pool-cue"></view>
          <view class="pool-balls">
            <view class="ball ball-7">7</view>
            <view class="ball ball-8">8</view>
            <view class="ball ball-9">9</view>
          </view>
        </view>
      </view>
    </view>
    <!-- #endif -->
    
    <!-- 顶部品牌区 -->
    <view class="brand-header">
      <view class="brand-row">
        <image class="brand-logo" src="/static/logo.png" mode="aspectFit"></image>
        <text class="brand-name">天宫国际</text>
      </view>
      <text class="brand-en">TIANGONG INTERNATIONAL</text>
    </view>
    
    <!-- 充值活动Banner -->
    <view class="promo-banner">
      <view class="promo-content">
        <text class="promo-title">🎁 {{ homeData.banner.title || '充值送台费活动' }}</text>
        <text class="promo-desc">{{ homeData.banner.desc || '充值满500送50元台费，多充多送' }}</text>
        <view class="promo-btn" @click="showPromoTip">立即参与</view>
      </view>
    </view>
    
    <!-- 主按钮区 -->
    <view class="main-actions">
      <view class="main-btn" @click="goProducts">
        <text class="icon">🛒</text>
        <text class="label">商品点单</text>
        <text class="sub">酒水·小吃·饮料</text>
      </view>
      <view class="main-btn coach" @click="goCoaches">
        <view class="coach-icon-wrap">
          <image class="coach-icon-img" src="/static/coach-icon.png" mode="aspectFit"></image>
        </view>
        <view class="coach-text-wrap">
          <text class="label">专业教练</text>
        </view>
      </view>
    </view>
    
    <!-- 滚动公告 -->
    <view class="notice-bar" v-if="homeData.notice">
      <text class="notice-icon">📢</text>
      <view class="notice-text">
        <text class="notice-scroll">{{ homeData.notice }}</text>
      </view>
    </view>
    
    <!-- 热销V包 -->
    <view class="section" v-if="homeData.hotVipRooms.length > 0">
      <view class="section-header">
        <text class="section-title">🛋️ 热销V包</text>
        <text class="section-more" @click="goVipRooms">更多 ›</text>
      </view>
      <view class="vip-grid">
        <view class="vip-card" v-for="room in homeData.hotVipRooms" :key="room.id" @click="goVipDetail(room.id)">
          <view class="vip-img-wrap">
            <image class="vip-img" :src="getVipPhoto(room)" mode="aspectFill"></image>
          </view>
          <view class="vip-info">
            <view class="vip-name-row">
              <view class="status-dot" :class="room.status === '空闲' ? 'idle' : 'occupied'"></view>
              <text class="vip-name">{{ room.name }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
    
    <!-- 热门商品 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">🔥 热门商品</text>
        <text class="section-more" @click="goProducts">更多 ›</text>
      </view>
      <view class="products-grid">
        <view class="product-card" v-for="item in homeData.hotProducts" :key="item.name" @click="goCart(item.name)">
          <view class="product-img-wrap">
            <image class="product-img" :src="getProductImage(item)" mode="aspectFill"></image>
          </view>
          <view class="product-info">
            <text class="product-name">{{ item.name }}</text>
            <text class="product-price">¥{{ item.price }}</text>
          </view>
        </view>
        <view class="empty-tip" v-if="homeData.hotProducts.length === 0">
          <text>暂无热门商品</text>
        </view>
      </view>
    </view>
    
    <!-- 人气教练 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">⭐ 人气教练</text>
        <text class="section-more" @click="goCoaches">更多 ›</text>
      </view>
      <view class="coaches-grid">
        <view class="coach-card" v-for="coach in homeData.popularCoaches" :key="coach.coach_no" @click="goCoachDetail(coach.coach_no)">
          <view class="coach-avatar-wrap">
            <image class="coach-avatar" :src="getCoachPhoto(coach)" mode="aspectFill"></image>
          </view>
          <view class="coach-info">
            <text class="coach-name">{{ coach.stage_name }}-{{ coach.employee_id }}号</text>
            <text class="coach-level">{{ coach.level || '教练' }}</text>
          </view>
        </view>
        <view class="empty-tip" v-if="homeData.popularCoaches.length === 0">
          <text>暂无人气教练</text>
        </view>
      </view>
    </view>
    
    <!-- 底部铭牌 -->
    <view class="footer-plate">
      <view class="plate-inner">
        <view class="plate-left">
          <image class="plate-logo" src="/static/logo.png" mode="aspectFit"></image>
        </view>
        <view class="plate-right">
          <text class="plate-brand">天宫国际</text>
          <text class="plate-version">v1.0.0</text>
          <text class="plate-company">中山市开火体育文化有限公司</text>
          <!-- #ifdef H5 -->
          <a href="https://beian.miit.gov.cn" target="_blank" class="plate-icp" style="text-decoration: none; color: #6a6040;">粤ICP备2026027219号</a>
          <!-- #endif -->
          <!-- #ifndef H5 -->
          <text class="plate-icp">粤ICP备2026027219号</text>
          <!-- #endif -->
          <view class="plate-links">
            <text class="plate-link" @click="goAgreement('user')">用户协议</text>
            <text class="plate-divider">|</text>
            <text class="plate-link" @click="goAgreement('privacy')">隐私政策</text>
          </view>
        </view>
      </view>
    </view>
    
    <!-- 美化弹框 -->
    <BeautyModal 
      v-model:visible="showModal" 
      :content="modalContent"
      confirmText="知道了"
      @confirm="showModal = false"
    />
    
    <!-- #ifdef H5 -->
    <!-- 全屏按钮（iOS设备不显示，因为PWA已默认全屏） -->
    <view class="fullscreen-btn" v-if="!isIOS" :style="{ left: floatPosition === 'left' ? '20px' : 'auto', right: floatPosition === 'right' ? '20px' : 'auto' }" @click="toggleFullscreen">
      <text>⛶</text>
    </view>
    <!-- #endif -->
  </view>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/utils/api.js'
import BeautyModal from '@/components/BeautyModal.vue'

// 状态栏高度
const statusBarHeight = ref(0)

// 悬浮按钮位置
const floatPosition = ref('left')

// 弹框状态
const showModal = ref(false)
const modalContent = ref('')

// #ifdef H5
// iOS 设备检测
const isIOS = ref(false)
// 全屏状态
const isFullscreen = ref(false)
// 测试环境判断
const isTestEnv = ref(false)

// 切换全屏
const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    document.documentElement.requestFullscreen()
  }
}
// #endif

const homeData = reactive({
  banner: { image: '', title: '充值送台费活动', desc: '充值满500送50元台费' },
  notice: '',
  hotProducts: [],
  popularCoaches: [],
  hotVipRooms: []
})

const loadHome = async () => {
  try {
    const data = await api.getHome()
    Object.assign(homeData, data)
  } catch (err) {
    console.error('加载首页失败', err)
  }
}

const getCoachPhoto = (coach) => {
  const photo = coach.photos && coach.photos[0]
  if (!photo) return '/static/avatar-default.png'
  
  // OSS图片压缩到400px
  if (photo.includes('aliyuncs.com')) {
    const separator = photo.includes('?') ? '&' : '?'
    return `${photo}${separator}x-oss-process=image/resize,w_400`
  }
  
  if (photo.startsWith('http')) return photo
  return 'http://47.238.80.12:8081' + photo
}

const getProductImage = (item) => {
  const url = item.image_url
  if (!url) return '/static/avatar-default.png'
  
  // OSS图片压缩到400px
  if (url.includes('aliyuncs.com')) {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}x-oss-process=image/resize,w_400`
  }
  
  if (url.startsWith('http')) return url
  return 'http://47.238.80.12:8081' + url
}

const getVipPhoto = (room) => {
  const photo = room.photos && room.photos[0]
  if (!photo) return '/static/avatar-default.png'
  
  // OSS图片压缩到400px
  if (photo.includes('aliyuncs.com')) {
    const separator = photo.includes('?') ? '&' : '?'
    return `${photo}${separator}x-oss-process=image/resize,w_400`
  }
  
  if (photo.startsWith('http')) return photo
  return 'http://47.238.80.12:8081' + photo
}

const goProducts = () => uni.switchTab({ url: '/pages/products/products' })
const goCoaches = () => uni.switchTab({ url: '/pages/coaches/coaches' })
const goVipRooms = () => uni.switchTab({ url: '/pages/vip-rooms/vip-rooms' })
const goCart = (name) => {
  // 存储高亮商品名，用于商品页定位
  uni.setStorageSync('highlightProduct', name)
  uni.switchTab({ url: '/pages/products/products' })
}
const goCoachDetail = (coachNo) => uni.navigateTo({ url: `/pages/coach-detail/coach-detail?no=${coachNo}` })
const goVipDetail = (id) => uni.navigateTo({ url: `/pages/vip-detail/vip-detail?id=${id}` })
const goAgreement = (type) => uni.navigateTo({ url: `/pages/agreement/agreement?type=${type}` })
const showPromoTip = () => {
  modalContent.value = '请贵客移步到前台充值入会'
  showModal.value = true
}

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  loadHome()
  // 记录设备访问
  api.recordDeviceVisit().catch(() => {})
  
  // 读取悬浮按钮位置设置
  floatPosition.value = uni.getStorageSync('floatButtonPosition') || 'left'
  
  // #ifdef H5
  // 检测 iOS 设备
  isIOS.value = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  
  // 判断是否是测试环境（从 URL 判断，后续由 API 更新）
  // 先根据 URL 快速判断
  const url = window.location.href
  isTestEnv.value = url.includes('localhost') || url.includes('env=test')
  
  // 异步从 API 获取准确环境
  const xhr = new XMLHttpRequest()
  xhr.open('GET', '/api/front-config', true)
  xhr.onload = function() {
    if (xhr.status === 200) {
      try {
        const data = JSON.parse(xhr.responseText)
        isTestEnv.value = data.env === 'test'
      } catch(e) {}
    }
  }
  xhr.send()
  
  // 监听全屏状态变化
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
  // #endif
})

onShow(() => {
  // 检查台桌信息已在App.vue中完成
})
</script>

<style scoped>
.page { min-height: 100vh; background: #0a0a0f; padding-bottom: 60px; }

/* #ifdef H5 */
/* 测试环境红色警告横幅 */
.test-env-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 30px;
  background: #ff4444;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  z-index: 9999;
}
/* #endif */

/* 固定置顶标题栏 */
.fixed-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  background: #0a0a0f;
}
.header-content {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.pool-cue-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0 20px;
}

.pool-cue {
  position: absolute;
  left: 20px;
  right: 20px;
  height: 4px;
  background: linear-gradient(90deg, #8B4513 0%, #D2691E 20%, #F4A460 50%, #D2691E 80%, #8B4513 100%);
  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.5);
}

.pool-balls {
  display: flex;
  gap: 8px;
  align-items: center;
  z-index: 1;
}

.ball {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  color: #fff;
  box-shadow: inset -2px -2px 4px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.5);
}

.ball-7 { background: linear-gradient(135deg, #CD853F 0%, #8B4513 100%); }
.ball-8 { background: linear-gradient(135deg, #333 0%, #000 100%); }
.ball-9 { background: linear-gradient(135deg, #FFD700 0%, #DAA520 100%); color: #000; }

.header-placeholder { background: #0a0a0f; }

/* 顶部品牌区 */
.brand-header {
  padding: 45px 20px 24px;
  text-align: center;
  background: linear-gradient(180deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.05) 50%, transparent 100%);
  position: relative;
  overflow: hidden;
}
.brand-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 180px;
  background: radial-gradient(ellipse at top, rgba(218,165,32,0.2) 0%, transparent 70%);
}
.brand-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  position: relative;
}
.brand-logo { width: 36px; height: 36px; }
.brand-name {
  font-size: 28px;
  font-weight: 600;
  background: linear-gradient(135deg, #d4af37, #ffd700);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 4px;
}
.brand-en {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  letter-spacing: 4px;
  margin-top: 6px;
  position: relative;
}

/* 充值活动Banner */
.promo-banner {
  margin: 16px;
  height: 140px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  border-radius: 16px;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(218,165,32,0.2);
}
.promo-banner::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -10%;
  width: 150px;
  height: 150px;
  background: radial-gradient(circle, rgba(218,165,32,0.3) 0%, transparent 70%);
}
.promo-content { position: relative; z-index: 1; padding: 24px; }
.promo-title { font-size: 17px; font-weight: 600; margin-bottom: 8px; display: block; }
.promo-desc { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 16px; display: block; }
.promo-btn {
  display: inline-block;
  padding: 10px 24px;
  background: linear-gradient(135deg, #d4af37 0%, #ffd700 100%);
  border-radius: 20px;
  color: #000;
  font-size: 13px;
  font-weight: 600;
}

/* 主按钮区 */
.main-actions {
  display: flex;
  gap: 12px;
  padding: 0 16px 24px;
}
.main-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 16px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(218,165,32,0.15);
  border-radius: 14px;
}
.main-btn.coach {
  flex: 1.6;
  background: linear-gradient(135deg, rgba(26,26,46,0.9), rgba(22,33,62,0.9));
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  padding: 8px 16px;
  gap: 12px;
  min-height: 115px;
}
.main-btn .icon { font-size: 32px; }
.main-btn .label { font-size: 14px; font-weight: 500; }
.main-btn .sub { font-size: 11px; color: rgba(255,255,255,0.5); }
.main-btn .coach-icon-wrap {
  width: 86px;
  height: 115px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.main-btn .coach-icon-img {
  width: 86px;
  height: 115px;
  object-fit: contain;
}
.main-btn .coach-text-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 4px;
}
.main-btn .coach-text-wrap .label {
  color: #fff;
  letter-spacing: 2px;
  font-size: 16px;
  font-weight: 600;
}
.main-btn .coach-text-wrap .sub {
  font-size: 12px;
  color: rgba(255,255,255,0.6);
  letter-spacing: 1px;
}

/* 滚动公告 */
.notice-bar {
  background: rgba(212,175,55,0.1);
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  overflow: hidden;
}
.notice-icon { font-size: 16px; }
.notice-text { flex: 1; overflow: hidden; white-space: nowrap; }
.notice-scroll {
  display: inline-block;
  animation: scroll 15s linear infinite;
  color: rgba(255,255,255,0.8);
  font-size: 13px;
  white-space: nowrap;
}
@keyframes scroll {
  0% { transform: translateX(100vw); }
  100% { transform: translateX(-100%); }
}

/* Section */
.section { padding: 16px; }
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.section-title { font-size: 17px; font-weight: 500; }
.section-more { font-size: 12px; color: rgba(255,255,255,0.5); }

/* 热销V包网格 - 2列 */
.vip-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.vip-card {
  background: rgba(255,255,255,0.03);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(218,165,32,0.1);
}
.vip-img-wrap { aspect-ratio: 16/9; overflow: hidden; }
.vip-img {
  width: 100%;
  height: 100%;
  background: rgba(30,30,40,0.5);
}
.vip-info {
  padding: 12px;
}
.vip-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.idle {
  background: #2ecc71;
  box-shadow: 0 0 6px 2px rgba(46, 204, 113, 0.8);
}
.status-dot.occupied {
  background: #d4a017;
}
.vip-name { font-size: 14px; font-weight: 500; }

/* 热门商品网格 - 3列2行 */
.products-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.product-card {
  background: rgba(255,255,255,0.03);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(218,165,32,0.08);
}
.product-img-wrap { aspect-ratio: 1; overflow: hidden; }
.product-img { width: 100%; height: 100%; }
.product-info { padding: 10px; }
.product-name {
  color: #fff;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
.product-price { color: #d4af37; font-size: 13px; font-weight: 600; margin-top: 4px; display: block; }

/* 人气助教网格 - 3列2行 */
.coaches-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.coach-card {
  background: rgba(255,255,255,0.03);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(218,165,32,0.08);
}
.coach-avatar-wrap { aspect-ratio: 1; overflow: hidden; }
.coach-avatar {
  width: 100%;
  height: 100%;
  background: rgba(30,30,40,0.5);
}
.coach-info { padding: 8px; text-align: center; }
.coach-name { font-size: 12px; color: #fff; display: block; }
.coach-level { font-size: 10px; color: #d4af37; margin-top: 2px; white-space: nowrap; display: block; }

.empty-tip {
  grid-column: span 3;
  text-align: center;
  padding: 20px;
  color: rgba(255,255,255,0.3);
  font-size: 13px;
}

/* 底部铭牌 */
.footer-plate {
  padding: 12px 16px 16px;
  display: flex;
  justify-content: center;
}
.plate-inner {
  display: flex;
  align-items: center;
  gap: 14px;
  background: linear-gradient(135deg, #181814 0%, #121210 100%);
  border: 1px solid #3a3520;
  border-radius: 12px;
  padding: 14px 20px;
  width: 92%;
  max-width: 360px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
}
.plate-left {
  flex-shrink: 0;
}
.plate-logo {
  width: 36px;
  height: 36px;
  opacity: 0.5;
  filter: grayscale(100%) sepia(20%) hue-rotate(10deg);
}
.plate-right {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.plate-brand {
  font-size: 18px;
  font-weight: 600;
  color: #6a6040;
  letter-spacing: 2px;
}
.plate-version {
  font-size: 14px;
  color: #4a4535;
}
.plate-company {
  font-size: 13px;
  color: #3a3528;
  margin-top: 2px;
}
.plate-icp {
  font-size: 10px;
  color: #6a6040;
  margin-top: 2px;
}
.plate-icp a {
  color: #6a6040 !important;
}
.plate-links {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}
.plate-link {
  font-size: 10px;
  color: #6a6040;
}
.plate-divider {
  font-size: 10px;
  color: #4a4535;
}

/* #ifdef H5 */
/* 全屏按钮 */
.fullscreen-btn {
  position: fixed;
  bottom: 80px;
  width: 44px;
  height: 44px;
  background: rgba(212, 175, 55, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  z-index: 100;
}
.fullscreen-btn text {
  font-size: 20px;
  color: #000;
}
/* #endif */
</style>
