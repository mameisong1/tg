<template>
  <view class="page">
    <!-- 固定标题栏 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">‹</text>
        </view>
        <text class="header-title">{{ title }}</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    
    <!-- 占位区域 -->
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>
    
    <!-- 协议内容 -->
    <view class="content">
      <text class="content-text">{{ content }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api.js'

const statusBarHeight = ref(0)
const title = ref('')
const content = ref('')

const goBack = () => {
  uni.navigateBack()
}

onMounted(async () => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const type = currentPage.options?.type || 'user'
  
  try {
    let data
    if (type === 'privacy') {
      data = await api.getPrivacyPolicy()
    } else {
      data = await api.getUserAgreement()
    }
    title.value = data.title
    content.value = data.content
  } catch (err) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
})
</script>

<style scoped>
.page { min-height: 100vh; background: #0a0a0f; }

/* 固定标题栏 */
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
.back-icon { font-size: 28px; color: #d4af37; }
.back-placeholder { width: 32px; }
.header-title {
  font-size: 17px;
  font-weight: 600;
  color: #d4af37;
  letter-spacing: 2px;
}
.header-placeholder { background: #0a0a0f; }

/* 内容 */
.content {
  padding: 16px;
  padding-bottom: 40px;
}
.content-text {
  font-size: 14px;
  color: rgba(255,255,255,0.75);
  line-height: 1.8;
  white-space: pre-wrap;
}
</style>