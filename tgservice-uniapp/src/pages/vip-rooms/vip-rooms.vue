<template>
  <view class="page">
    <!-- #ifndef H5 -->
    <!-- 小程序：固定区域 -->
    <view class="fixed-area">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="fixed-header">
        <text class="header-title">V包预约</text>
      </view>
      <view class="filter-bar">
        <view class="filter-btn" :class="{ active: currentFilter === 'all' }" @click="setFilter('all')">
          <text>全部</text>
        </view>
        <view class="filter-btn" :class="{ active: currentFilter === 'boss' }" @click="setFilter('boss')">
          <text>BOSS房</text>
        </view>
        <view class="filter-btn" :class="{ active: currentFilter === 'vip' }" @click="setFilter('vip')">
          <text>VIP房</text>
        </view>
        <view class="filter-btn" :class="{ active: currentFilter === 'ma' }" @click="setFilter('ma')">
          <text>麻将房</text>
        </view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44 + 44) + 'px' }"></view>
    <!-- #endif -->
    
    <!-- #ifdef H5 -->
    <!-- H5 标题栏 -->
    <view class="h5-title-bar">
      <text class="h5-title-text">VIP包房</text>
    </view>
    <!-- 筛选按钮（不固定） -->
    <view class="h5-filter-area">
      <view class="filter-bar">
        <view class="filter-btn" :class="{ active: currentFilter === 'all' }" @click="setFilter('all')">
          <text>全部</text>
        </view>
        <view class="filter-btn" :class="{ active: currentFilter === 'boss' }" @click="setFilter('boss')">
          <text>BOSS房</text>
        </view>
        <view class="filter-btn" :class="{ active: currentFilter === 'vip' }" @click="setFilter('vip')">
          <text>VIP房</text>
        </view>
        <view class="filter-btn" :class="{ active: currentFilter === 'ma' }" @click="setFilter('ma')">
          <text>麻将房</text>
        </view>
      </view>
    </view>
    <!-- #endif -->
    
    <!-- 包房列表 -->
    <view class="room-list">
      <view class="room-card" v-for="room in filteredRooms" :key="room.id" @click="goDetail(room.id)">
        <!-- 包房封面 -->
        <view class="room-cover-wrap">
          <image class="room-cover" :src="getRoomPhoto(room)" mode="aspectFill"></image>
          <view class="cover-gradient"></view>
          <view class="status-badge" :class="room.status === '空闲' ? 'idle' : 'occupied'">
            {{ room.status }}
          </view>
        </view>
        
        <!-- 包房信息 -->
        <view class="room-info">
          <view class="room-name">{{ room.name }}</view>
          <view class="room-intro" v-if="room.intro">{{ room.intro }}</view>
          <view class="room-action">
            <text class="action-text">点击查看详情</text>
            <text class="action-arrow">›</text>
          </view>
        </view>
      </view>
      
      <view class="empty-state" v-if="filteredRooms.length === 0 && !loading">
        <text class="empty-icon">🛋️</text>
        <text class="empty-text">暂无包房信息</text>
      </view>
      
      <view class="loading-state" v-if="loading">
        <text>加载中...</text>
      </view>
    </view>
    
    <!-- 回到顶部按钮 -->
    <view class="back-to-top" v-if="showBackToTop" :style="{ left: floatPosition === 'left' ? '20px' : 'auto', right: floatPosition === 'right' ? '20px' : 'auto' }" @click="scrollToTop">
      <text>↑</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '@/utils/api.js'

const statusBarHeight = ref(0)
const rooms = ref([])
const loading = ref(false)
const currentFilter = ref('all')

// 悬浮按钮位置
const floatPosition = ref('left')

// 回到顶部
const showBackToTop = ref(false)

const loadRooms = async () => {
  loading.value = true
  try {
    rooms.value = await api.getVipRooms()
  } catch (err) {
    console.error('加载包房失败', err)
  }
  loading.value = false
}

// 筛选后的包房列表
const filteredRooms = computed(() => {
  if (currentFilter.value === 'all') return rooms.value
  
  const filterMap = {
    'boss': (name) => name.toUpperCase().includes('BOSS'),
    'vip': (name) => name.toUpperCase().includes('VIP'),
    'ma': (name) => name.includes('雀')
  }
  
  const filterFn = filterMap[currentFilter.value]
  return filterFn ? rooms.value.filter(r => filterFn(r.name)) : rooms.value
})

const setFilter = (filter) => {
  currentFilter.value = filter
}

// 获取带OSS压缩参数的图片URL
const getRoomPhoto = (room) => {
  const photo = room.photos && room.photos[0]
  if (!photo) return '/static/avatar-default.png'
  
  // 如果是OSS图片，添加压缩参数
  if (photo.includes('aliyuncs.com')) {
    // 封面图宽度约350px，设置400px压缩
    const separator = photo.includes('?') ? '&' : '?'
    return `${photo}${separator}x-oss-process=image/resize,w_800`
  }
  
  if (photo.startsWith('http')) return photo
  return 'http://47.238.80.12:8081' + photo
}

const goDetail = (id) => {
  uni.navigateTo({ url: `/pages/vip-detail/vip-detail?id=${id}` })
}

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  loadRooms()
  
  // 读取悬浮按钮位置设置
  floatPosition.value = uni.getStorageSync('floatButtonPosition') || 'left'
  
  // #ifdef H5
  // 监听全屏状态变化
  document.addEventListener('fullscreenchange', updateFullscreenClass)
  updateFullscreenClass()
  // 监听滚动
  window.addEventListener('scroll', () => {
    showBackToTop.value = window.scrollY > 300
  })
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

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
// #endif
</script>

<style scoped>
.page { min-height: 100vh; background: #0a0a0f; padding-bottom: 100px; }

/* ===== 小程序：固定区域 ===== */
/* #ifndef H5 */
.fixed-area {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  background: #0a0a0f;
}
.status-bar-bg { background: #0a0a0f; }
.fixed-header {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a0f;
}
.header-placeholder { background: #0a0a0f; }
.header-title {
  font-size: 17px;
  font-weight: 600;
  color: #d4af37;
  letter-spacing: 4px;
}
/* #endif */

/* ===== H5 标题栏 ===== */
/* #ifdef H5 */
.h5-title-bar {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a0f;
}
.h5-title-text {
  font-size: 17px;
  font-weight: 600;
  color: #d4af37;
  letter-spacing: 4px;
}
/* 筛选按钮区域（不固定） */
.h5-filter-area {
  background: #0a0a0f;
}
/* #endif */

/* 筛选按钮 */
.filter-bar {
  display: flex;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(10,10,15,0.98);
  border-bottom: 1px solid rgba(218,165,32,0.1);
}
.filter-btn {
  padding: 8px 16px;
  background: rgba(255,255,255,0.05);
  border-radius: 20px;
  font-size: 13px;
  color: rgba(255,255,255,0.6);
  border: 1px solid rgba(255,255,255,0.1);
}
.filter-btn.active {
  background: rgba(212,175,55,0.2);
  color: #d4af37;
  border-color: rgba(218,165,32,0.3);
}

.room-list {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.room-card {
  background: rgba(20,20,30,0.6);
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(218,165,32,0.15);
}

/* 包房封面 */
.room-cover-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
}

.room-cover {
  width: 100%;
  height: 100%;
  background: rgba(30,30,40,0.5);
}

/* 渐变色遮罩 - 增加高级感 */
.cover-gradient {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 80px;
  background: linear-gradient(180deg, transparent 0%, rgba(10,10,15,0.8) 60%, rgba(20,18,30,0.95) 100%);
  pointer-events: none;
}

/* 状态标签 */
.status-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(8px);
}

.status-badge.idle {
  background: rgba(46,204,113,0.85);
  color: #fff;
  box-shadow: 0 2px 10px rgba(46,204,113,0.3);
}

.status-badge.occupied {
  background: rgba(241,196,15,0.85);
  color: #000;
  box-shadow: 0 2px 10px rgba(241,196,15,0.3);
}

/* 包房信息 */
.room-info {
  padding: 16px;
}

.room-name {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #fff;
}

.room-intro {
  font-size: 13px;
  color: rgba(255,255,255,0.55);
  line-height: 1.6;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.room-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid rgba(218,165,32,0.1);
}

.action-text {
  font-size: 13px;
  color: rgba(212,175,55,0.8);
}

.action-arrow {
  font-size: 20px;
  color: rgba(212,175,55,0.6);
}

.empty-state, .loading-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 14px;
  color: rgba(255,255,255,0.3);
}

.loading-state {
  color: rgba(255,255,255,0.3);
  font-size: 14px;
}

/* 全屏模式样式保留 */
:global(.fullscreen-mode) .h5-title-bar {
  /* 保持一致 */
}

/* 回到顶部按钮 */
.back-to-top {
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
.back-to-top text {
  font-size: 20px;
  color: #000;
  font-weight: bold;
}
</style>
