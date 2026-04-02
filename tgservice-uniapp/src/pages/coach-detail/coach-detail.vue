<template>
  <view class="page">
    <!-- #ifdef H5 -->
    <!-- H5 标题栏（返回按钮+标题同一行） -->
    <view class="h5-title-bar">
      <view class="h5-back-btn" @click="goBack">
        <text class="h5-back-icon">‹</text>
      </view>
      <text class="h5-title-text">教练介绍</text>
      <view class="h5-back-placeholder"></view>
    </view>
    <!-- #endif -->
    
    <!-- #ifndef H5 -->
    <!-- 小程序：固定标题栏 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">‹</text>
        </view>
        <text class="header-title">教练介绍</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    
    <!-- 占位区域 -->
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>
    <!-- #endif -->
    
    <!-- 封面轮播 -->
    <view class="banner">
      <swiper class="banner-swiper" :indicator-dots="photos.length > 1" indicator-color="rgba(255,255,255,0.3)" indicator-active-color="#d4af37">
        <swiper-item v-for="(photo, index) in photos" :key="index">
          <view class="banner-item" @click="previewPhoto(index)">
            <image class="banner-img" :src="photo" mode="aspectFill"></image>
            <view class="banner-gradient"></view>
          </view>
        </swiper-item>
      </swiper>
      <!-- 默认封面（无照片时） -->
      <view class="banner-default" v-if="photos.length === 0">
        <image class="banner-img" :src="mainPhoto" mode="aspectFill"></image>
        <view class="banner-gradient"></view>
      </view>
    </view>
    
    <view class="info-section">
      <view class="coach-header">
        <image class="coach-avatar" :src="mainPhoto" mode="aspectFill"></image>
        <view class="coach-basic">
          <view class="coach-name">{{ coach.stage_name || '未命名' }}</view>
          <view class="coach-no">工号: {{ coach.employee_id || '-' }}</view>
          <view class="coach-level">{{ formatLevel(coach.level) }}</view>
        </view>
      </view>
      
      <view class="info-cards">
        <view class="info-card"><text class="info-label">年龄</text><text class="info-value">{{ coach.age ? coach.age + '岁' : '-' }}</text></view>
        <view class="info-card"><text class="info-label">身高</text><text class="info-value">{{ coach.height ? coach.height + 'cm' : '-' }}</text></view>
        <view class="info-card"><text class="info-label">价格</text><text class="info-value">{{ priceDisplay }}</text></view>
      </view>
      
      <view class="intro-section">
        <view class="section-title">📝 自我介绍</view>
        <view class="intro-text">{{ coach.intro || '暂无介绍' }}</view>
      </view>
      
      <view class="video-section" v-if="videos.length > 0">
        <view class="section-title">🎬 个人视频</view>
        <view class="video-list">
          <view 
            v-for="(video, index) in videos" 
            :key="index" 
            class="video-wrapper"
          >
            <video 
              class="video-player" 
              :src="video" 
              controls 
              :show-fullscreen-btn="false"
              preload="metadata"
              :id="'video-' + index"
            ></video>
            <!-- #ifdef H5 -->
            <!-- 自定义全屏按钮 -->
            <view class="custom-fullscreen-btn" @click="handleVideoFullscreen(index)">
              <text class="fullscreen-icon">⛶</text>
            </view>
            <!-- #endif -->
          </view>
        </view>
      </view>
      
      <view class="photos-section">
        <view class="section-title">📷 相册</view>
        <view class="photos-grid">
          <view class="photo-item" v-for="(photo, index) in photos" :key="index" @click="previewPhoto(index)">
            <image class="photo-img" :src="photo" mode="aspectFill"></image>
            <view class="photo-gradient"></view>
          </view>
        </view>
      </view>
    </view>
    
    <view class="bottom-bar">
      <view class="price-info">
        <text class="price-label">陪练价格</text>
        <text class="price-value">¥{{ pricePerMin }}<text class="price-unit">/分钟</text></text>
      </view>
      <view class="book-btn" @click="showBookModal = true">预约教练</view>
    </view>
    
    <!-- 预约教练弹框 -->
    <BeautyModal 
      v-model:visible="showBookModal" 
      title="预约教练"
      :showCancel="false"
      confirmText="知道了"
      @confirm="showBookModal = false"
    >
      <template #default>
        <view class="modal-content">
          <text class="modal-text">请联系附近的教练，也可加前台微信点教练。</text>
          <image class="qrcode-img" src="/static/front_wechat_qrcode.png" mode="widthFix"></image>
        </view>
      </template>
    </BeautyModal>
    
    <!-- #ifdef H5 -->
    <!-- 悬浮返回按钮 -->
    <view class="float-back-btn" :style="{ left: floatPosition === 'left' ? '20px' : 'auto', right: floatPosition === 'right' ? '20px' : 'auto' }" @click="goBack">
      <text class="float-back-icon">‹</text>
    </view>
    <!-- #endif -->
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '@/utils/api.js'
import BeautyModal from '@/components/BeautyModal.vue'

const statusBarHeight = ref(0)
const coachNo = ref(null)
const coach = ref({})
const photos = ref([])
const videos = ref([])
const showBookModal = ref(false)
const floatPosition = ref('left')

const mainPhoto = computed(() => photos.value.length > 0 ? photos.value[0] : '/static/avatar-default.png')
const pricePerMin = computed(() => coach.value.price ? (coach.value.price / 60).toFixed(2) : '-')
const priceDisplay = computed(() => coach.value.price ? '¥' + pricePerMin.value + '/分钟' : '-')

const loadCoach = async () => {
  if (!coachNo.value) return
  try {
    const data = await api.getCoach(coachNo.value)
    coach.value = data
    // 转换照片URL：相对路径转为完整URL
    photos.value = (data.photos || []).map(p => {
      if (p.startsWith('http')) return p
      return 'http://47.238.80.12:8081' + p
    })
    // 兼容单个video字段和videos数组
    if (data.videos && Array.isArray(data.videos)) {
      videos.value = data.videos.map(v => {
        if (v.startsWith('http')) return v
        return 'http://47.238.80.12:8081' + v
      })
    } else if (data.video) {
      const v = data.video
      videos.value = [v.startsWith('http') ? v : 'http://47.238.80.12:8081' + v]
    } else {
      videos.value = []
    }
  } catch (e) { 
    // 离职教练或不存在时显示提示
    uni.showToast({ title: e.error || '教练不存在', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 1500)
  }
}

const formatLevel = (level) => {
  const icons = { '女神': '👑', '高级': '⭐', '中级': '✨', '初级': '🌟' }
  return (icons[level] || '💫') + ' ' + (level || '教练')
}

const previewPhoto = (index) => uni.previewImage({ urls: photos.value, current: index })

// #ifdef H5
// 处理视频全屏：如果页面已全屏，先退出页面全屏再让视频全屏
const handleVideoFullscreen = async (index) => {
  const videoContext = uni.createVideoContext('video-' + index)
  
  if (document.fullscreenElement) {
    // 页面已全屏，先退出页面全屏
    try {
      await document.exitFullscreen()
      // 等待退出完成后再让视频进入全屏
      setTimeout(() => {
        videoContext.requestFullScreen()
      }, 100)
    } catch (err) {
      console.error('退出页面全屏失败:', err)
    }
  } else {
    // 页面未全屏，直接让视频进入全屏
    videoContext.requestFullScreen()
  }
}
// #endif

const goBack = () => {
  uni.navigateBack()
}

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  coachNo.value = currentPage.options?.no
  loadCoach()
  
  // 读取悬浮按钮位置设置
  floatPosition.value = uni.getStorageSync('floatButtonPosition') || 'left'
  
  // #ifdef H5
  // 监听全屏状态变化
  document.addEventListener('fullscreenchange', updateFullscreenClass)
  updateFullscreenClass()
  // #endif
})

// #ifdef H5
onUnmounted(() => {
  document.removeEventListener('fullscreenchange', updateFullscreenClass)
})

const updateFullscreenClass = () => {
  if (document.fullscreenElement) {
    document.body.classList.add('fullscreen-mode')
  } else {
    document.body.classList.remove('fullscreen-mode')
  }
}
// #endif
</script>

<style scoped>
.page { min-height: 100vh; background: #0a0a0f; padding-bottom: 90px; }

/* ===== H5 标题栏 ===== */
/* #ifdef H5 */
.h5-title-bar {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #0a0a0f;
}
.h5-back-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.h5-back-icon {
  font-size: 28px;
  color: #d4af37;
}
.h5-title-text {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 17px;
  font-weight: 600;
  color: #d4af37;
  letter-spacing: 4px;
}
.h5-back-placeholder {
  width: 32px;
}
/* #endif */

/* 固定标题栏（小程序） */
/* #ifndef H5 */
.fixed-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  background: #0a0a0f;
}
.status-bar-bg { background: #0a0a0f; }
.header-content {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #0a0a0f;
}
.back-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.back-icon {
  font-size: 28px;
  color: #d4af37;
}
.back-placeholder {
  width: 32px;
}
.header-title {
  font-size: 17px;
  font-weight: 600;
  color: #d4af37;
  letter-spacing: 4px;
}
.header-placeholder { background: #0a0a0f; }
/* #endif */

.banner { position: relative; height: 320px; }
.banner-swiper { width: 100%; height: 100%; }
.banner-item { width: 100%; height: 100%; position: relative; }
.banner-default { width: 100%; height: 100%; position: relative; }
.banner-img { width: 100%; height: 100%; }
.banner-gradient { position: absolute; bottom: 0; left: 0; right: 0; height: 150px; background: linear-gradient(transparent, rgba(10,10,15,0.9) 60%, rgba(10,10,15,0.98)); }

.info-section { padding: 0 16px 16px; margin-top: -60px; position: relative; z-index: 1; }

.coach-header { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
.coach-avatar { width: 80px; height: 80px; border-radius: 16px; border: 2px solid rgba(218,165,32,0.4); background: rgba(30,30,40,0.5); }
.coach-basic { flex: 1; }
.coach-name { font-size: 18px; font-weight: 500; margin-bottom: 4px; color: #fff; }
.coach-no { font-size: 14px; color: rgba(255,255,255,0.5); margin-bottom: 6px; }
.coach-level { display: inline-block; padding: 4px 12px; background: linear-gradient(135deg, #ffd700, #ffaa00); border-radius: 12px; font-size: 12px; color: #000; font-weight: 600; }

.info-cards { display: flex; gap: 10px; margin-bottom: 20px; }
.info-card { flex: 1; background: rgba(20,20,30,0.6); border-radius: 14px; padding: 14px; text-align: center; border: 1px solid rgba(218,165,32,0.1); }
.info-label { font-size: 11px; color: rgba(255,255,255,0.4); display: block; margin-bottom: 4px; }
.info-value { font-size: 16px; color: #d4af37; font-weight: 500; }

.intro-section { background: rgba(20,20,30,0.6); border-radius: 14px; padding: 16px; margin-bottom: 20px; border: 1px solid rgba(218,165,32,0.1); }
.section-title { font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #d4af37; letter-spacing: 2px; }
.intro-text { font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.7; }

.video-section { margin-bottom: 20px; }
.video-list { display: flex; flex-direction: column; gap: 12px; }
.video-player { width: 100%; height: 220px; border-radius: 14px; background: rgba(20,20,30,0.6); }

/* #ifdef H5 */
.video-wrapper { position: relative; width: 100%; }

/* 自定义全屏按钮 */
.custom-fullscreen-btn {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 36px;
  height: 36px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  cursor: pointer;
}
.custom-fullscreen-btn:active {
  background: rgba(0, 0, 0, 0.8);
}
.fullscreen-icon {
  color: #fff;
  font-size: 20px;
}
/* #endif */

.photos-section { margin-bottom: 20px; }
.photos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.photo-item { 
  aspect-ratio: 1; 
  border-radius: 12px; 
  overflow: hidden; 
  position: relative;
}
.photo-img { width: 100%; height: 100%; }
/* 相册照片渐变遮罩 */
.photo-gradient {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 50%;
  background: linear-gradient(180deg, transparent 0%, rgba(15,10,20,0.5) 50%, rgba(25,18,30,0.85) 100%);
  pointer-events: none;
}

.bottom-bar { position: fixed; bottom: 0; left: 0; right: 0; height: 70px; background: linear-gradient(180deg, rgba(10,10,15,0.98), #0a0a0f); border-top: 1px solid rgba(218,165,32,0.1); display: flex; align-items: center; padding: 0 16px; z-index: 100; }
.price-info { flex: 1; }
.price-label { font-size: 11px; color: rgba(255,255,255,0.4); }
.price-value { font-size: 22px; color: #d4af37; font-weight: 600; }
.price-unit { font-size: 12px; color: rgba(255,255,255,0.5); }
.book-btn { padding: 14px 28px; background: linear-gradient(135deg, rgba(218,165,32,0.9), rgba(255,215,0,0.9)); border-radius: 25px; font-size: 14px; font-weight: 600; color: #000; }

/* 弹框内容样式 */
.modal-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0;
}
.modal-text {
  font-size: 15px;
  color: rgba(255,255,255,0.75);
  text-align: center;
  line-height: 1.6;
  margin-bottom: 16px;
}
.qrcode-img {
  width: 180px;
  height: 180px;
  border-radius: 12px;
  background: rgba(255,255,255,0.95);
  padding: 8px;
}

/* 全屏模式样式保留 */
:global(.fullscreen-mode) .h5-title-bar {
  /* 保持一致 */
}

/* #ifdef H5 */
/* 悬浮返回按钮 */
.float-back-btn {
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
.float-back-icon {
  font-size: 20px;
  color: #000;
  font-weight: bold;
}
/* #endif */
</style>