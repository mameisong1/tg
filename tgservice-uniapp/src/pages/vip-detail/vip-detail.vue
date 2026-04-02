<template>
  <view class="page">
    <!-- #ifdef H5 -->
    <!-- H5 标题栏（返回按钮+标题同一行） -->
    <view class="h5-title-bar">
      <view class="h5-back-btn" @click="goBack">
        <text class="h5-back-icon">‹</text>
      </view>
      <text class="h5-title-text">包房详情</text>
      <view class="h5-back-placeholder"></view>
    </view>
    <!-- #endif -->
    
    <!-- 包房封面 -->
    <view class="cover-section">
      <swiper class="cover-swiper" :indicator-dots="room.photos.length > 1" indicator-color="rgba(255,255,255,0.3)" indicator-active-color="#d4af37">
        <swiper-item v-for="(photo, index) in room.photos" :key="index">
          <view class="cover-wrap">
            <image class="cover-img" :src="compressImage(photo)" mode="aspectFill" @click="previewImage(index)"></image>
            <view class="cover-gradient"></view>
          </view>
        </swiper-item>
      </swiper>
      <view class="status-badge" :class="room.status === '空闲' ? 'idle' : 'occupied'">
        {{ room.status }}
      </view>
      <!-- 封面底部渐变遮罩 -->
      <view class="cover-bottom-gradient"></view>
    </view>
    
    <!-- 包房信息 -->
    <view class="info-section">
      <!-- 状态提示 -->
      <view class="status-tip">💡 包房空闲状态未实时更新，请以实际为准</view>
      <view class="room-intro" v-if="room.intro">{{ room.intro }}</view>
    </view>
    
    <!-- 相册 -->
    <view class="section" v-if="room.photos.length > 0">
      <view class="section-title">📷 相册</view>
      <view class="photo-grid">
        <view class="photo-item" v-for="(photo, index) in room.photos" :key="index" @click="previewImage(index)">
          <image class="photo-img" :src="compressImage(photo, 150)" mode="aspectFill"></image>
          <view class="photo-gradient"></view>
        </view>
      </view>
    </view>
    
    <!-- 视频 -->
    <view class="section" v-if="room.videos && room.videos.length > 0">
      <view class="section-title">🎬 视频</view>
      <view class="video-list">
        <view class="video-item" v-for="(video, index) in room.videos" :key="index">
          <video class="video-player" :src="video" controls :show-center-play-btn="true"></video>
        </view>
      </view>
    </view>
    
    <!-- 预约按钮 -->
    <view class="bottom-bar">
      <view class="book-btn" @click="handleBook">预约包房</view>
    </view>
    
    <!-- 预约弹框 -->
    <BeautyModal 
      v-model:visible="showBookModal" 
      title="预约包房"
      :showCancel="false"
      confirmText="知道了"
      @confirm="showBookModal = false"
    >
      <template #default>
        <view class="modal-content">
          <text class="modal-text">请扫码联系前台预约</text>
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
import { ref, reactive, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import api from '@/utils/api.js'
import BeautyModal from '@/components/BeautyModal.vue'

const roomId = ref('')
const room = reactive({
  id: 0,
  name: '',
  status: '空闲',
  intro: '',
  photos: [],
  videos: []
})

// 预约弹框状态
const showBookModal = ref(false)
const floatPosition = ref('left')

const loadRoom = async () => {
  if (!roomId.value) return
  try {
    const data = await api.getVipRoom(roomId.value)
    Object.assign(room, data)
  } catch (err) {
    console.error('加载包房失败', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

// 不压缩图片，保留原图清晰度
const compressImage = (url, width = 0) => {
  return url || ''
}

const previewImage = (index) => {
  uni.previewImage({
    urls: room.photos,
    current: index
  })
}

const handleBook = () => {
  showBookModal.value = true
}

const goBack = () => {
  uni.navigateBack()
}

onLoad((options) => {
  roomId.value = options.id
  loadRoom()
  // 读取悬浮按钮位置设置
  floatPosition.value = uni.getStorageSync('floatButtonPosition') || 'left'
})
</script>

<style scoped>
.page { min-height: 100vh; background: #0a0a0f; padding-bottom: 100px; }

/* ===== H5 标题栏 ===== */
/* #ifdef H5 */
.h5-title-bar {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #0a0a0f;
  position: relative;
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

/* 封面区域 */
.cover-section {
  position: relative;
  width: 100%;
  height: 300px;
}

.cover-swiper {
  width: 100%;
  height: 100%;
}

.cover-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}

.cover-img {
  width: 100%;
  height: 100%;
  background: rgba(30,30,40,0.5);
}

/* 封面图片内部渐变 */
.cover-gradient {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100px;
  background: linear-gradient(180deg, transparent 0%, rgba(10,10,15,0.7) 50%, rgba(20,15,25,0.95) 100%);
  pointer-events: none;
}

/* 封面底部整体渐变遮罩 */
.cover-bottom-gradient {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 60px;
  background: linear-gradient(180deg, transparent, #0a0a0f);
  pointer-events: none;
  z-index: 2;
}

.status-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 600;
  z-index: 3;
  backdrop-filter: blur(8px);
}

.status-badge.idle {
  background: rgba(46,204,113,0.85);
  color: #fff;
  box-shadow: 0 2px 12px rgba(46,204,113,0.4);
}

.status-badge.occupied {
  background: rgba(241,196,15,0.85);
  color: #000;
  box-shadow: 0 2px 12px rgba(241,196,15,0.4);
}

/* 信息区域 */
.info-section {
  padding: 20px 16px;
  border-bottom: 1px solid rgba(218,165,32,0.1);
}

/* 状态提示 */
.status-tip {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  margin-bottom: 12px;
  padding: 8px 12px;
  background: rgba(218,165,32,0.08);
  border-radius: 8px;
  border-left: 3px solid rgba(218,165,32,0.4);
}

.room-intro {
  font-size: 14px;
  color: rgba(255,255,255,0.6);
  line-height: 1.8;
  white-space: pre-wrap;
}

/* 区块样式 */
.section {
  padding: 16px;
}

.section-title {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 12px;
  color: rgba(255,255,255,0.8);
}

/* 相册网格 */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.photo-item {
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

.photo-img {
  width: 100%;
  height: 100%;
  background: rgba(30,30,40,0.5);
}

/* 相册图片渐变遮罩 */
.photo-gradient {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 50%;
  background: linear-gradient(180deg, transparent 0%, rgba(15,10,20,0.5) 50%, rgba(25,20,35,0.9) 100%);
  pointer-events: none;
}

/* 视频列表 */
.video-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.video-item {
  border-radius: 12px;
  overflow: hidden;
}

.video-player {
  width: 100%;
  height: 200px;
  background: rgba(30,30,40,0.5);
}

/* 底部预约栏 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: linear-gradient(180deg, transparent, #0a0a0f 30%);
}

.book-btn {
  height: 50px;
  background: linear-gradient(135deg, #d4af37, #ffd700);
  border-radius: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #000;
  font-size: 16px;
  font-weight: 600;
}

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