<template>
  <view class="page">
    <!-- 固定标题栏 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">系统通知</text>
        <view class="header-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder-block" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 通知列表 -->
    <scroll-view class="notification-list" scroll-y @scrolltolower="loadMore">
      <view 
        class="notification-item" 
        v-for="item in notifications" 
        :key="item.id"
        :class="{ unread: item.is_read === 0 }"
        @click="showDetail(item)"
      >
        <view class="item-header">
          <text class="item-title">{{ item.title }}</text>
          <text class="new-badge" v-if="item.is_read === 0">NEW</text>
        </view>
        <text class="item-content">{{ item.content }}</text>
        <view class="item-footer">
          <text class="item-sender">{{ item.sender_name }}</text>
          <text class="item-time">{{ formatTime(item.created_at) }}</text>
        </view>
        <!-- 已阅按钮（仅未阅消息显示） -->
        <view class="read-btn" v-if="item.is_read === 0" @click.stop="markAsRead(item)">
          <text>标记已阅</text>
        </view>
      </view>
      
      <!-- 空状态 -->
      <view class="empty" v-if="notifications.length === 0 && !loading">
        <text class="empty-icon">📭</text>
        <text class="empty-text">暂无系统通知</text>
      </view>
      
      <!-- 加载状态 -->
      <view class="loading" v-if="loading">
        <text>加载中...</text>
      </view>
      
      <!-- 加载更多 -->
      <view class="load-more" v-if="hasMore && !loading">
        <text>下拉加载更多</text>
      </view>
      
      <!-- 无更多 -->
      <view class="no-more" v-if="!hasMore && notifications.length > 0">
        <text>没有更多通知了</text>
      </view>
    </scroll-view>

    <!-- 详情弹框 -->
    <view class="detail-modal" v-if="showModal" @click="closeModal">
      <view class="modal-content" @click.stop>
        <text class="modal-title">{{ selectedItem?.title }}</text>
        <text class="modal-content-text">{{ selectedItem?.content }}</text>
        <view class="modal-info">
          <text class="modal-sender">{{ selectedItem?.sender_name }}</text>
          <text class="modal-time">{{ selectedItem?.created_at }}</text>
        </view>
        <view class="modal-btn" v-if="selectedItem?.is_read === 0" @click="markAsRead(selectedItem)">
          <text>标记已阅</text>
        </view>
        <view class="modal-btn secondary" @click="closeModal">
          <text>关闭</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import api from '@/utils/api.js';

const statusBarHeight = ref(0);
const notifications = ref([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(false);
const hasMore = ref(true);
const showModal = ref(false);
const selectedItem = ref(null);

// 获取状态栏高度
onMounted(() => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight || 20;
  loadNotifications();
});

onShow(() => {
  // 每次显示时刷新列表
  page.value = 1;
  notifications.value = [];
  hasMore.value = true;
  loadNotifications();
});

// 加载系统通知列表
const loadNotifications = async () => {
  if (loading.value) return;
  loading.value = true;
  
  try {
    const res = await api.notifications.getSystemList({ page: page.value, pageSize: pageSize.value });
    
    if (res.success) {
      const list = res.data.notifications || [];
      if (page.value === 1) {
        notifications.value = list;
      } else {
        notifications.value.push(...list);
      }
      total.value = res.data.total;
      hasMore.value = notifications.value.length < total.value;
    } else {
      uni.showToast({ title: res.error || '加载失败', icon: 'none' });
    }
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' });
  }
  
  loading.value = false;
};

// 加载更多
const loadMore = () => {
  if (!hasMore.value || loading.value) return;
  page.value++;
  loadNotifications();
};

// 标记已阅
const markAsRead = async (item) => {
  try {
    const res = await api.notifications.markAsRead(item.id);
    
    if (res.success) {
      item.is_read = 1;
      item.read_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
      uni.showToast({ title: '已标记已阅', icon: 'success' });
      
      // 重新排序：未阅优先
      notifications.value.sort((a, b) => {
        if (a.is_read !== b.is_read) return a.is_read - b.is_read;
        return b.created_at.localeCompare(a.created_at);
      });
      
      // 关闭弹框
      if (showModal.value) {
        closeModal();
      }
    } else {
      uni.showToast({ title: res.error || '操作失败', icon: 'none' });
    }
  } catch (e) {
    uni.showToast({ title: '操作失败', icon: 'none' });
  }
};

// 显示详情
const showDetail = (item) => {
  selectedItem.value = item;
  showModal.value = true;
};

// 关闭弹框
const closeModal = () => {
  showModal.value = false;
  selectedItem.value = null;
};

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return '';
  // "2026-04-14 07:23:00" -> "04/14 07:23"
  const parts = timeStr.split(' ');
  if (parts.length < 2) return timeStr;
  const dateParts = parts[0].split('-');
  const timePart = parts[1].substring(0, 5);
  const currentYear = new Date().getFullYear();
  if (parseInt(dateParts[0]) === currentYear) {
    return `${dateParts[1]}/${dateParts[2]} ${timePart}`;
  }
  return `${dateParts[0]}/${dateParts[1]}/${dateParts[2]} ${timePart}`;
};

// 返回
const goBack = () => {
  uni.navigateBack();
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 100%);
  width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
}

.fixed-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: #0a0a0f;
}

.status-bar-bg {
  background: #0a0a0f;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 15px;
}

.back-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 28px;
  color: #d4af37;
}

.header-title {
  font-size: 18px;
  color: #fff;
  font-weight: 500;
}

.header-placeholder {
  width: 40px;
}

.header-placeholder-block {
  background: transparent;
}

.notification-list {
  height: calc(100vh - 44px);
  padding: 15px;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
}

.notification-item {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.notification-item.unread {
  background: rgba(212, 175, 55, 0.1);
  border-color: rgba(212, 175, 55, 0.3);
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.item-title {
  font-size: 16px;
  color: #fff;
  font-weight: 500;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.new-badge {
  font-size: 12px;
  color: #d4af37;
  background: rgba(212, 175, 55, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
}

.item-content {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}

.item-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
}

.item-sender {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.item-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.read-btn {
  margin-top: 12px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #d4af37 0%, #b8962e 100%);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.read-btn text {
  font-size: 14px;
  color: #0a0a0f;
  font-weight: 500;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
}

.empty-icon {
  font-size: 48px;
  color: rgba(255, 255, 255, 0.3);
}

.empty-text {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 12px;
}

.loading, .load-more, .no-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.loading text, .load-more text, .no-more text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}

/* 详情弹框 */
.detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal-content {
  width: 85%;
  max-width: 320px;
  background: #1a1a2e;
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(212, 175, 55, 0.3);
  box-sizing: border-box;
  overflow: hidden;
}

.modal-title {
  font-size: 18px;
  color: #fff;
  font-weight: 500;
  margin-bottom: 12px;
}

.modal-content-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.6;
  margin-bottom: 12px;
}

.modal-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.modal-sender {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.modal-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.modal-btn {
  padding: 12px;
  background: linear-gradient(135deg, #d4af37 0%, #b8962e 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 10px;
}

.modal-btn text {
  font-size: 14px;
  color: #0a0a0f;
  font-weight: 500;
}

.modal-btn.secondary {
  background: rgba(255, 255, 255, 0.1);
}

.modal-btn.secondary text {
  color: rgba(255, 255, 255, 0.7);
}
</style>
