<template>
  <view class="page">
    <!-- 固定标题栏 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">通知管理</text>
        <view class="header-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder-block" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 标签切换 -->
    <view class="tab-bar">
      <view class="tab" :class="{ active: activeTab === 'send' }" @click="activeTab = 'send'">
        <text>发送通知</text>
      </view>
      <view class="tab" :class="{ active: activeTab === 'list' }" @click="switchToList">
        <text>已发送列表</text>
      </view>
    </view>

    <!-- 发送通知板块 -->
    <scroll-view class="send-section" scroll-y v-if="activeTab === 'send'">
      <!-- 标题输入 -->
      <view class="input-item">
        <text class="input-label">通知标题</text>
        <input class="input-field" v-model="form.title" placeholder="请输入标题" placeholder-class="placeholder-text" />
      </view>
      
      <!-- 内容输入 -->
      <view class="input-item">
        <text class="input-label">通知内容</text>
        <textarea class="input-area" v-model="form.content" placeholder="请输入内容" placeholder-class="placeholder-text" />
      </view>
      
      <!-- 接收者选择 -->
      <view class="recipient-section">
        <text class="section-title">接收者</text>
        <view class="recipient-type">
          <view class="type-btn" :class="{ active: form.recipient_type === 'all' }" @click="selectRecipientType('all')">
            <text>全员发送</text>
          </view>
          <view class="type-btn" :class="{ active: form.recipient_type === 'selected' }" @click="selectRecipientType('selected')">
            <text>指定员工</text>
          </view>
        </view>
        
        <!-- 指定员工选择器 -->
        <view class="employee-selector" v-if="form.recipient_type === 'selected'">
          <!-- 搜索框 -->
          <input class="search-input" v-model="searchKeyword" placeholder="搜索姓名/艺名/工号" placeholder-class="placeholder-text" @input="searchEmployees" confirm-type="search" />
          
          <!-- 筛选按钮 -->
          <view class="filter-bar">
            <view class="filter-label">助教级别：</view>
            <view class="filter-btn" :class="{ active: levelFilter === 'none' }" @click="setLevelFilter('none')">不显示</view>
            <view class="filter-btn" :class="{ active: levelFilter === '' }" @click="setLevelFilter('')">全部</view>
            <view class="filter-btn" v-for="lv in coachLevels" :key="lv" :class="{ active: levelFilter === lv }" @click="setLevelFilter(lv)">{{ lv }}</view>
          </view>
          <view class="filter-bar" v-if="adminRoles.length > 0">
            <view class="filter-label">后台角色：</view>
            <view class="filter-btn" :class="{ active: roleFilter === 'none' }" @click="setRoleFilter('none')">不显示</view>
            <view class="filter-btn" :class="{ active: roleFilter === '' }" @click="setRoleFilter('')">全部</view>
            <view class="filter-btn" v-for="r in adminRoles" :key="r" :class="{ active: roleFilter === r }" @click="setRoleFilter(r)">{{ r }}</view>
          </view>
          
          <!-- 全选按钮 -->
          <view class="select-actions">
            <view class="action-btn" @click="selectAllFiltered">全选当前</view>
            <view class="action-btn" @click="clearSelection">取消全选</view>
            <text class="selected-count">已选择 {{ selectedEmployeeIds.length }} 人</text>
          </view>
          
          <!-- 员工列表 -->
          <scroll-view class="employee-list" scroll-y>
            <view class="employee-item" v-for="emp in filteredEmployees" :key="emp.id" @click="toggleEmployee(emp)">
              <view class="checkbox" :class="{ checked: selectedEmployeeIds.includes(emp.id) }">
                <text v-if="selectedEmployeeIds.includes(emp.id)">✓</text>
              </view>
              <view class="emp-info">
                <text class="emp-name">{{ emp.name }}</text>
                <text class="emp-extra">{{ emp.type === 'coach' ? (emp.employee_id + '号') : emp.role }}</text>
              </view>
            </view>
          </scroll-view>
        </view>
      </view>
      
      <!-- 发送按钮 -->
      <view class="send-btn" :class="{ disabled: !canSend }" @click="sendNotification">
        <text>{{ sending ? '发送中...' : '发送通知' }}</text>
      </view>
    </scroll-view>

    <!-- 已发送列表板块 -->
    <scroll-view class="list-section" scroll-y v-if="activeTab === 'list'">
      <view class="sent-item" v-for="item in sentNotifications" :key="item.id" @click="showRecipients(item)">
        <text class="sent-title">{{ item.title }}</text>
        <text class="sent-content">{{ item.content }}</text>
        <view class="sent-footer">
          <text class="sent-time">{{ formatTime(item.created_at) }}</text>
          <view class="sent-stats">
            <text class="stat-total">发送 {{ item.total_recipients }} 人</text>
            <text class="stat-unread">未阅 {{ item.unread_count }} 人</text>
          </view>
        </view>
      </view>
      
      <!-- 空状态 -->
      <view class="empty" v-if="sentNotifications.length === 0">
        <text class="empty-icon">📭</text>
        <text class="empty-text">暂无已发送通知</text>
      </view>
    </scroll-view>

    <!-- 接收者弹框 -->
    <view class="recipients-modal" v-if="showRecipientsModal" @click="closeRecipientsModal">
      <view class="modal-content" @click.stop>
        <text class="modal-title">{{ currentNotification?.title }}</text>
        <text class="modal-subtitle">接收者列表</text>
        <scroll-view class="recipients-list" scroll-y>
          <view class="recipient-item" v-for="r in recipients" :key="r.recipient_id + r.recipient_type">
            <view class="recipient-info">
              <text class="r-name">{{ r.recipient_name }}</text>
              <text class="r-id" v-if="r.recipient_employee_id">{{ r.recipient_employee_id }}号</text>
              <text class="r-type">{{ r.recipient_type === 'coach' ? '助教' : '后台' }}</text>
            </view>
            <view class="read-status" :class="{ read: r.is_read === 1 }">
              <text>{{ r.is_read === 1 ? '已阅' : '未阅' }}</text>
            </view>
          </view>
        </scroll-view>
        <view class="modal-close" @click="closeRecipientsModal">
          <text>关闭</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import api from '@/utils/api.js';

const statusBarHeight = ref(0);
const activeTab = ref('send');
const sending = ref(false);

// 表单数据
const form = ref({
  title: '',
  content: '',
  recipient_type: 'all',
  recipients: []
});

// 员工选择器数据
const allEmployees = ref([]);
const selectedEmployeeIds = ref([]);
const searchKeyword = ref('');
const levelFilter = ref('');
const roleFilter = ref(''); // 后台角色筛选

// 已发送列表
const sentNotifications = ref([]);

// 接收者弹框
const showRecipientsModal = ref(false);
const recipients = ref([]);
const currentNotification = ref(null);

// 助教级别列表
const coachLevels = ref(['金牌', '钻石', ' 普通']);
// 后台角色列表
const adminRoles = ref([]);

// 获取状态栏高度
onMounted(() => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight || 20;
  loadEmployees();
});

onShow(() => {
  loadSentNotifications();
});

// 筛选后的员工列表
const filteredEmployees = computed(() => {
  return allEmployees.value.filter(emp => {
    // 搜索过滤
    if (searchKeyword.value) {
      const kw = searchKeyword.value.toLowerCase();
      const nameMatch = emp.name.toLowerCase().includes(kw);
      const idMatch = emp.employee_id && emp.employee_id.includes(kw);
      if (!nameMatch && !idMatch) return false;
    }
    // 助教过滤
    if (emp.type === 'coach') {
      if (levelFilter.value === 'none') return false;  // 不显示助教
      if (levelFilter.value && emp.level !== levelFilter.value) return false;  // 级别筛选
    }
    // 后台用户过滤
    if (emp.type === 'admin') {
      if (roleFilter.value === 'none') return false;  // 不显示后台
      if (roleFilter.value && emp.role !== roleFilter.value) return false;  // 角色筛选
    }
    return true;
  });
});

// 发送按钮是否可用
const canSend = computed(() => {
  if (!form.value.title.trim() || !form.value.content.trim()) return false;
  if (form.value.recipient_type === 'selected' && selectedEmployeeIds.value.length === 0) return false;
  return true;
});

// 加载可选员工
const loadEmployees = async () => {
  try {
    const res = await api.notifications.getEmployees();
    
    if (res.success) {
      // 合并助教和后台用户
      allEmployees.value = [
        ...res.data.coaches.map(c => ({
          id: `coach_${c.coach_no}`,
          type: 'coach',
          coach_no: c.coach_no,
          name: c.stage_name,
          employee_id: c.employee_id,
          level: c.level
        })),
        ...res.data.admins.map(a => ({
          id: `admin_${a.username}`,
          type: 'admin',
          username: a.username,
          name: a.name,
          role: a.role
        }))
      ];
      
      // 提取级别列表
      const levels = new Set(res.data.coaches.map(c => c.level).filter(l => l));
      coachLevels.value = Array.from(levels);
      // 提取后台角色列表
      const roles = new Set(res.data.admins.map(a => a.role).filter(r => r));
      adminRoles.value = Array.from(roles);
    }
  } catch (e) {
    uni.showToast({ title: '加载员工失败', icon: 'none' });
  }
};

// 搜索员工 - 触发API搜索（防抖）
let searchTimer = null;
const searchEmployees = async () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    // 通过API搜索，传入search参数
    try {
      const res = await api.notifications.getEmployees({
        search: searchKeyword.value,
        level: levelFilter.value || undefined,
        role: roleFilter.value || undefined
      });
      if (res.success) {
        allEmployees.value = [
          ...res.data.coaches.map(c => ({
            id: `coach_${c.coach_no}`,
            type: 'coach',
            coach_no: c.coach_no,
            name: c.stage_name,
            employee_id: c.employee_id,
            level: c.level
          })),
          ...res.data.admins.map(a => ({
            id: `admin_${a.username}`,
            type: 'admin',
            username: a.username,
            name: a.name,
            role: a.role
          }))
        ];
      }
    } catch (e) {
      console.error('搜索员工失败:', e);
    }
  }, 300);
};

// 选择接收者类型
const selectRecipientType = (type) => {
  form.value.recipient_type = type;
  if (type === 'all') {
    selectedEmployeeIds.value = [];
  }
};

// 设置级别筛选
const setLevelFilter = (level) => {
  levelFilter.value = level;
  // 触发API搜索
  searchEmployees();
};

// 设置后台角色筛选
const setRoleFilter = (role) => {
  roleFilter.value = role;
  // 触发API搜索
  searchEmployees();
};

// 切换员工选择
const toggleEmployee = (emp) => {
  const idx = selectedEmployeeIds.value.indexOf(emp.id);
  if (idx >= 0) {
    selectedEmployeeIds.value.splice(idx, 1);
  } else {
    selectedEmployeeIds.value.push(emp.id);
  }
};

// 全选当前筛选结果
const selectAllFiltered = () => {
  filteredEmployees.value.forEach(emp => {
    if (!selectedEmployeeIds.value.includes(emp.id)) {
      selectedEmployeeIds.value.push(emp.id);
    }
  });
};

// 取消全选
const clearSelection = () => {
  selectedEmployeeIds.value = [];
};

// 发送通知
const sendNotification = async () => {
  if (sending.value) return;
  if (!canSend.value) {
    uni.showToast({ title: '请填写标题和内容', icon: 'none' });
    return;
  }
  sending.value = true;
  
  try {
    // 构建接收者列表
    let recipients = [];
    if (form.value.recipient_type === 'selected') {
      recipients = selectedEmployeeIds.value.map(id => {
        const emp = allEmployees.value.find(e => e.id === id);
        return {
          type: emp.type,
          id: emp.type === 'coach' ? emp.coach_no : emp.username
        };
      });
    }
    
    const res = await api.notifications.send({
      title: form.value.title.trim(),
      content: form.value.content.trim(),
      recipient_type: form.value.recipient_type,
      recipients: form.value.recipient_type === 'selected' ? recipients : []
    });
    
    if (res.success) {
      uni.showToast({ title: `发送成功，共${res.data.total_recipients}人`, icon: 'success' });
      // 重置表单
      form.value = { title: '', content: '', recipient_type: 'all', recipients: [] };
      selectedEmployeeIds.value = [];
      // 切换到列表
      switchToList();
    } else {
      uni.showToast({ title: res.error || '发送失败', icon: 'none' });
    }
  } catch (e) {
    uni.showToast({ title: '发送失败', icon: 'none' });
  }
  
  sending.value = false;
};

// 切换到列表
const switchToList = () => {
  activeTab.value = 'list';
  loadSentNotifications();
};

// 加载已发送列表
const loadSentNotifications = async () => {
  try {
    const res = await api.notifications.getSentList();
    
    if (res.success) {
      sentNotifications.value = res.data.notifications || [];
    }
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' });
  }
};

// 显示接收者详情
const showRecipients = async (item) => {
  currentNotification.value = item;
  
  try {
    const res = await api.notifications.getRecipients(item.id);
    
    if (res.success) {
      recipients.value = res.data.recipients || [];
      showRecipientsModal.value = true;
    }
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' });
  }
};

// 关闭接收者弹框
const closeRecipientsModal = () => {
  showRecipientsModal.value = false;
  recipients.value = [];
  currentNotification.value = null;
};

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const parts = timeStr.split(' ');
  if (parts.length < 2) return timeStr;
  const dateParts = parts[0].split('-');
  const timePart = parts[1].substring(0, 5);
  return `${dateParts[1]}/${dateParts[2]} ${timePart}`;
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

/* 标签切换 */
.tab-bar {
  display: flex;
  background: rgba(255, 255, 255, 0.05);
  padding: 8px 15px;
  margin: 10px 15px;
  border-radius: 8px;
}

.tab {
  flex: 1;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.tab.active {
  background: linear-gradient(135deg, #d4af37 0%, #b8962e 100%);
}

.tab text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.tab.active text {
  color: #0a0a0f;
  font-weight: 500;
}

/* 发送板块 */
.send-section {
  height: calc(100vh - 44px - 60px);
  padding: 0 15px;
  box-sizing: border-box;
  width: 100%;
  overflow-x: hidden;
}

.input-item {
  margin-bottom: 15px;
  width: 100%;
  box-sizing: border-box;
}

.input-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 8px;
  display: block;
}

.input-field {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  color: #fff;
  width: 100%;
  box-sizing: border-box;
}

.input-area {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  color: #fff;
  height: 100px;
  width: 100%;
  box-sizing: border-box;
}

.placeholder-text {
  color: rgba(255, 255, 255, 0.4);
}

/* 接收者选择 */
.recipient-section {
  margin-bottom: 15px;
  width: 100%;
  box-sizing: border-box;
}

.section-title {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 10px;
  display: block;
}

.recipient-type {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  width: 100%;
  box-sizing: border-box;
}
}

.type-btn {
  flex: 1;
  padding: 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.type-btn.active {
  background: rgba(212, 175, 55, 0.2);
  border-color: #d4af37;
}

.type-btn text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.type-btn.active text {
  color: #d4af37;
}

/* 员工选择器 */
.employee-selector {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 10px;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.search-input {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 10px;
  font-size: 14px;
  color: #fff;
  margin-bottom: 10px;
  width: 100%;
  box-sizing: border-box;
}

.filter-bar {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  flex-wrap: wrap;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
}

.filter-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-right: 4px;
}

.filter-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.filter-btn.active {
  background: rgba(212, 175, 55, 0.2);
  color: #d4af37;
}

/* 全选按钮区域 */
.select-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  width: 100%;
  box-sizing: border-box;
}

.action-btn {
  padding: 6px 12px;
  background: rgba(212, 175, 55, 0.15);
  border-radius: 4px;
  font-size: 12px;
  color: #d4af37;
}

.selected-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-left: auto;
}

.employee-list {
  height: 200px;
}

.employee-item {
  display: flex;
  align-items: center;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  margin-bottom: 6px;
}

.checkbox {
  width: 20px;
  height: 20px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
}

.checkbox.checked {
  background: #d4af37;
  border-color: #d4af37;
}

.checkbox text {
  font-size: 12px;
  color: #0a0a0f;
}

.emp-info {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.emp-name {
  font-size: 14px;
  color: #fff;
}

.emp-extra {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

/* 发送按钮 */
.send-btn {
  margin-top: 20px;
  padding: 14px;
  background: linear-gradient(135deg, #d4af37 0%, #b8962e 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.send-btn.disabled {
  background: rgba(255, 255, 255, 0.1);
}

.send-btn text {
  font-size: 16px;
  color: #0a0a0f;
  font-weight: 500;
}

.send-btn.disabled text {
  color: rgba(255, 255, 255, 0.4);
}

/* 已发送列表 */
.list-section {
  height: calc(100vh - 44px - 60px);
  padding: 15px;
}

.sent-item {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.sent-title {
  font-size: 16px;
  color: #fff;
  font-weight: 500;
  margin-bottom: 8px;
  display: block;
}

.sent-content {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.4;
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.sent-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sent-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.sent-stats {
  display: flex;
  gap: 10px;
}

.stat-total, .stat-unread {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.stat-unread {
  color: #d4af37;
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

/* 接收者弹框 */
.recipients-modal {
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
  max-width: 350px;
  background: #1a1a2e;
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(212, 175, 55, 0.3);
}

.modal-title {
  font-size: 16px;
  color: #fff;
  font-weight: 500;
  margin-bottom: 5px;
}

.modal-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 15px;
}

.recipients-list {
  height: 300px;
}

.recipient-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  margin-bottom: 6px;
}

.recipient-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.r-name {
  font-size: 14px;
  color: #fff;
}

.r-id {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.r-type {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
}

.read-status {
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(212, 175, 55, 0.2);
}

.read-status.read {
  background: rgba(255, 255, 255, 0.1);
}

.read-status text {
  font-size: 12px;
  color: #d4af37;
}

.read-status.read text {
  color: rgba(255, 255, 255, 0.5);
}

.modal-close {
  margin-top: 15px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}
</style>