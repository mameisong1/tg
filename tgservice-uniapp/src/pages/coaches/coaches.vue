<template>
  <view class="page">
    <!-- #ifndef H5 -->
    <!-- 小程序：固定区域 -->
    <view class="fixed-area">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="fixed-header">
        <text class="header-title">专业教练</text>
      </view>
      <view class="level-bar">
        <view class="level-grid">
          <view 
            class="level-btn" 
            :class="{ active: currentLevel === '全部' }"
            @click="selectLevel('全部')"
          >
            <text class="level-icon">👩‍🎓</text>
            <text class="level-text">全部</text>
          </view>
          <view 
            class="level-btn" 
            v-for="level in levels" 
            :key="level"
            :class="{ active: currentLevel === level }"
            @click="selectLevel(level)"
          >
            <text class="level-icon">{{ getLevelIcon(level) }}</text>
            <text class="level-text">{{ level }}</text>
          </view>
        </view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44 + 56) + 'px' }"></view>
    <!-- #endif -->
    
    <!-- #ifdef H5 -->
    <!-- H5 标题栏 -->
    <view class="h5-title-bar">
      <text class="h5-title-text">专业教练</text>
    </view>
    <!-- 筛选按钮（不固定） -->
    <view class="h5-filter-area">
      <view class="level-bar">
        <view class="level-grid">
          <view
            class="level-btn"
            :class="{ active: currentLevel === '全部' }"
            @click="selectLevel('全部')"
          >
            <text class="level-icon">👩‍🎓</text>
            <text class="level-text">全部</text>
          </view>
          <view
            class="level-btn"
            v-for="level in levels"
            :key="level"
            :class="{ active: currentLevel === level }"
            @click="selectLevel(level)"
          >
            <text class="level-icon">{{ getLevelIcon(level) }}</text>
            <text class="level-text">{{ level }}</text>
          </view>
        </view>
      </view>
    </view>
    <!-- #endif -->
    
    <!-- 助教列表 - 两个一行 -->
    <view class="coaches-section">
      <view class="coaches-grid">
        <view class="coach-card" v-for="coach in coaches" :key="coach.coach_no" @click="goDetail(coach.coach_no)">
          <view class="coach-img-wrap">
            <image class="coach-img" :src="getPhoto(coach)" mode="aspectFill"></image>
            <!-- 水牌状态徽章 -->
            <view class="status-badge" :class="'status-' + (coach.display_status || '离店')">
              <text class="status-icon">{{ coach.display_status_icon || '⚪' }}</text>
              <text class="status-text">{{ coach.display_status_text || '离店' }}</text>
            </view>
          </view>
          <view class="coach-info">
            <view class="coach-header">
              <text class="coach-name">{{ coach.stage_name }}-{{ coach.employee_id }}号</text>
              <text class="coach-level">{{ getLevelIcon(coach.level) }} {{ coach.level || '-' }}</text>
            </view>
            <view class="coach-meta">
              <text v-if="coach.age">{{ coach.age }}岁</text>
              <text v-if="coach.height">{{ coach.height }}cm</text>
            </view>
          </view>
        </view>
        <view class="empty-tip" v-if="coaches.length === 0 && !loading">
          <text>暂无教练</text>
        </view>
        <view class="loading-tip" v-if="loading">
          <text>加载中...</text>
        </view>
      </view>
    </view>
    
    <!-- 回到顶部按钮 -->
    <view class="back-to-top" v-if="showBackToTop" :style="{ left: floatPosition === 'left' ? '20px' : 'auto', right: floatPosition === 'right' ? '20px' : 'auto' }" @click="scrollToTop">
      <text>↑</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import api from '@/utils/api.js'

// 状态栏高度
const statusBarHeight = ref(0)

// 悬浮按钮位置
const floatPosition = ref('left')

const levels = ['女神', '高级', '中级', '初级']
const currentLevel = ref('全部')
const coaches = ref([])
const loading = ref(false)

// 回到顶部
const showBackToTop = ref(false)

// 等级图标映射
const levelIcons = {
  '女神': '👑',
  '高级': '⭐',
  '中级': '✨',
  '初级': '🌟'
}

const getLevelIcon = (level) => levelIcons[level] || '💫'

const getPhoto = (coach) => {
  const photo = coach.photos && coach.photos[0]
  if (!photo) return '/static/avatar-default.png'
  
  // OSS图片压缩到600px
  if (photo.includes('aliyuncs.com')) {
    const separator = photo.includes('?') ? '&' : '?'
    return `${photo}${separator}x-oss-process=image/resize,w_400`
  }
  
  if (photo.startsWith('http')) return photo
  return 'http://47.238.80.12:8081' + photo
}

const loadCoaches = async () => {
  loading.value = true
  try { 
    const data = await api.getCoaches(currentLevel.value === '全部' ? '' : currentLevel.value)
    coaches.value = data
  } catch (e) {}
  loading.value = false
}

const selectLevel = (level) => {
  currentLevel.value = level
  loadCoaches()
}

const goDetail = (coachNo) => uni.navigateTo({ url: `/pages/coach-detail/coach-detail?no=${coachNo}` })

onMounted(() => {
  // 获取状态栏高度
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  loadCoaches()
  
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

.header-title {
  font-size: 17px;
  font-weight: 600;
  color: #d4af37;
  letter-spacing: 4px;
}

/* 第3块：等级按钮 */
.level-bar {
  background: rgba(10,10,15,0.98);
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.level-grid {
  display: flex;
  gap: 8px;
  justify-content: center;
}
.level-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 8px 12px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(218,165,32,0.1);
  border-radius: 16px;
}
.level-btn.active {
  background: rgba(212,175,55,0.15);
  border-color: rgba(218,165,32,0.3);
}
.level-btn.active .level-text { color: #d4af37; }
.level-icon { font-size: 12px; }
.level-text { font-size: 12px; color: rgba(255,255,255,0.7); }

/* 助教列表 - 两个一行 */
.coaches-section { padding: 12px; }
.coaches-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.coach-card {
  background: rgba(255,255,255,0.12);
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(218,165,32,0.1);
}
.coach-img-wrap {
  aspect-ratio: 1;
  overflow: hidden;
  position: relative;
}
.coach-img {
  width: 100%;
  height: 100%;
  background: rgba(30,30,40,0.5);
}

/* 水牌状态徽章 */
.status-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px 8px;
  border-radius: 12px;
  backdrop-filter: blur(8px);
  z-index: 2;
}
.status-badge.status-空闲 {
  background: rgba(34, 197, 94, 0.85);
  border: 1px solid rgba(34, 197, 94, 0.6);
}
.status-badge.status-上桌 {
  background: rgba(245, 158, 11, 0.85);
  border: 1px solid rgba(245, 158, 11, 0.6);
}
.status-badge.status-离店 {
  background: rgba(107, 114, 128, 0.7);
  border: 1px solid rgba(107, 114, 128, 0.5);
}
.status-icon {
  font-size: 10px;
  line-height: 1;
}
.status-text {
  font-size: 10px;
  color: #fff;
  font-weight: 600;
  line-height: 1;
}

/* 黑色渐变色渲染效果 - 高级氛围感 */
.coach-img-wrap::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  top: 0;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(0, 0, 0, 0.2) 40%,
    rgba(0, 0, 0, 0.5) 70%,
    rgba(0, 0, 0, 0.75) 100%
  );
  pointer-events: none;
}
.coach-info { padding: 12px; }
.coach-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.coach-name {
  font-size: 15px;
  color: #fff;
  font-weight: 500;
}
.coach-level {
  font-size: 12px;
  color: #d4af37;
  padding: 4px 10px;
  background: rgba(212,175,55,0.15);
  border-radius: 12px;
  white-space: nowrap;
}
.coach-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: rgba(255,255,255,0.4);
}

.empty-tip, .loading-tip {
  grid-column: span 2;
  text-align: center;
  padding: 40px;
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
