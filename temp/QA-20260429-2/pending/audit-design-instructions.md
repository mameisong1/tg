你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
```
# 通知功能技术设计方案

> QA需求编号：QA-20260429-2
> 设计时间：2026-04-29
> 设计者：程序员A

---

## 一、需求概述

### 1.1 通知功能
- 店长/助教管理/管理员可发送通知给所有员工（未离职助教 + 所有后台用户）
- 系统自动发送异常通知（台桌同步异常、批处理异常、计时器任务异常）
- 通知状态：已阅/未阅

### 1.2 通知查阅
- 前台H5「常用功能」板块新增通知图标
- 权限：所有员工
- 角标显示未阅数量
- 通知列表：未阅优先 + 发送时间倒序
- 未阅消息有 New 图标
- 已阅按钮（已阅不可改回未阅）

### 1.3 通知管理
- 前台H5「管理功能」板块新增通知管理按钮
- 权限：店长/助教管理/管理员
- **通知发送板块**：
  - 员工选择器：复选/搜索（姓名/艺名/工号）
  - 助教级别筛选、后台用户角色筛选
- **通知列表板块**：
  - 显示已发送通知列表（发送时间倒序，最多50条）
  - 显示发送总人数和未阅人数
  - 点击弹框显示未阅者姓名/工号/艺名

---

## 二、数据库设计

### 2.1 新增表

#### 表1：notifications（通知主表）

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,                   -- 通知标题
  content TEXT NOT NULL,                 -- 通知内容
  sender_type TEXT NOT NULL,             -- 发送者类型：'admin'（后台用户）或 'system'（系统）
  sender_id TEXT,                        -- 发送者ID：后台用户username 或 'system'
  sender_name TEXT,                      -- 发送者姓名：用于显示
  notification_type TEXT DEFAULT 'manual', -- 通知类型：'manual'（手动）或 'system_error'（系统异常）
  error_type TEXT,                       -- 异常类型（仅系统通知）：'sync_error'/'batch_error'/'timer_error'
  created_at TEXT NOT NULL,              -- 创建时间（TimeUtil.nowDB()）
  total_recipients INTEGER DEFAULT 0,    -- 接收总人数
  read_count INTEGER DEFAULT 0           -- 已阅人数
);
```

#### 表2：notification_recipients（通知接收者表）

```sql
CREATE TABLE IF NOT EXISTS notification_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_id INTEGER NOT NULL,      -- 关联 notifications.id
  recipient_type TEXT NOT NULL,          -- 接收者类型：'coach'（助教）或 'admin'（后台用户）
  recipient_id TEXT NOT NULL,            -- 接收者ID：coach_no 或 username
  recipient_name TEXT,                   -- 接收者姓名：用于显示（stage_name 或 name）
  recipient_employee_id TEXT,            -- 工号：用于显示（employee_id）
  is_read INTEGER DEFAULT 0,             -- 是否已阅：0 未阅，1 已阅
  read_at TEXT,                          -- 已阅时间
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_notification_id 
  ON notification_recipients(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_recipient 
  ON notification_recipients(recipient_type, recipient_id, is_read);
```

### 2.2 数据库变更说明

- **无现有表修改**：完全新增两张表，不影响现有数据
- **存储规范**：
  - 所有时间字段使用 `TimeUtil.nowDB()` 格式：`YYYY-MM-DD HH:MM:SS`
  - recipient_id 存储 coach_no（助教）或 username（后台用户）
  - 不存储 coach_no 到页面显示，只显示 employee_id

---

## 三、后端 API 设计

### 3.1 新增路由文件

**文件**：`/TG/tgservice/backend/routes/notifications.js`

### 3.2 API 接口列表

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/api/notifications` | GET | 所有员工 | 获取我的通知列表 |
| `/api/notifications/unread-count` | GET | 所有员工 | 获取未阅数量 |
| `/api/notifications/:id/read` | POST | 所有员工 | 标记已阅 |
| `/api/notifications/manage/send` | POST | 店长/助教管理/管理员 | 发送通知 |
| `/api/notifications/manage/list` | GET | 店长/助教管理/管理员 | 获取已发送通知列表 |
| `/api/notifications/manage/:id/recipients` | GET | 店长/助教管理/管理员 | 获取通知接收者详情 |
| `/api/notifications/manage/employees` | GET | 店长/助教管理/管理员 | 获取可选员工列表 |

### 3.3 接口详细设计

#### 3.3.1 获取我的通知列表

```javascript
// GET /api/notifications
// 权限：所有员工（authMiddleware）
// 参数：page（默认1），pageSize（默认20）

// 返回：
{
  success: true,
  data: {
    notifications: [
      {
        id: 1,
        title: "系统维护通知",
        content: "...",
        sender_name: "店长-张三",
        notification_type: "manual",
        created_at: "2026-04-29 10:00:00",
        is_read: 0,  // 0未阅，1已阅
        read_at: null
      }
    ],
    total: 30,
    page: 1,
    pageSize: 20
  }
}

// 排序：未阅优先（is_read=0 排前面），然后按 created_at 倒序
```

#### 3.3.2 获取未阅数量

```javascript
// GET /api/notifications/unread-count
// 权限：所有员工

// 返回：
{
  success: true,
  data: {
    unread_count: 5
  }
}
```

#### 3.3.3 标记已阅

```javascript
// POST /api/notifications/:id/read
// 权限：所有员工（只能标记自己的通知）

// 返回：
{
  success: true,
  message: "已标记已阅"
}

// 注意：已阅不可改回未阅（is_read=1 后不允许修改）
```

#### 3.3.4 发送通知

```javascript
// POST /api/notifications/manage/send
// 权限：店长/助教管理/管理员
// 参数：
{
  title: "通知标题",          // 必填
  content: "通知内容",        // 必填
  recipient_type: "all",      // 'all'（全员）或 'selected'（指定员工）
  recipients: []              // 指定员工时必填：[{type:'coach', id:'coach_no'}, {type:'admin', id:'username'}]
}

// 返回：
{
  success: true,
  data: {
    notification_id: 1,
    total_recipients: 25
  }
}
```

#### 3.3.5 获取已发送通知列表

```javascript
// GET /api/notifications/manage/list
// 权限：店长/助教管理/管理员
// 参数：page（默认1），pageSize（默认50，最多50）

// 返回：
{
  success: true,
  data: {
    notifications: [
      {
        id: 1,
        title: "...",
        content: "...",
        sender_name: "店长-张三",
        created_at: "2026-04-29 10:00:00",
        total_recipients: 25,
        read_count: 10,
        unread_count: 15
      }
    ],
    total: 5
  }
}

// 排序：created_at 倒序
// 限制：最多返回50条
```

#### 3.3.6 获取通知接收者详情

```javascript
// GET /api/notifications/manage/:id/recipients
// 权限：店长/助教管理/管理员

// 返回：
{
  success: true,
  data: {
    recipients: [
      {
        recipient_type: "coach",
        recipient_name: "小美",
        recipient_employee_id: "001",
        is_read: 0,
        read_at: null
      },
      {
        recipient_type: "admin",
        recipient_name: "张三",
        recipient_employee_id: null,  // 后台用户无工号
        is_read: 1,
        read_at: "2026-04-29 10:30:00"
      }
    ]
  }
}
```

#### 3.3.7 获取可选员工列表

```javascript
// GET /api/notifications/manage/employees
// 权限：店长/助教管理/管理员
// 参数：search（搜索关键词），level（助教级别），role（后台角色）

// 返回：
{
  success: true,
  data: {
    coaches: [
      {
        coach_no: "C001",        // 内部ID，不显示
        employee_id: "001",      // 显示工号
        stage_name: "小美",
        level: "金牌"
      }
    ],
    admins: [
      {
        username: "admin001",    // 内部ID，不显示
        name: "张三",
        role: "店长"
      }
    ]
  }
}

// 筛选逻辑：
// - 未离职助教：status != '离职' 且 employee_id IS NOT NULL
// - 所有后台用户：从 admin_users 获取
// - 搜索：匹配 stage_name/employee_id（助教）或 name/username（后台用户）
```

---

## 四、后端实现要点

### 4.1 路由注册

**文件**：`/TG/tgservice/backend/server.js`

```javascript
// 在路由注册区域添加（约 line 430）
const notificationsRouter = require('./routes/notifications');
app.use('/api/notifications', notificationsRouter);
```

### 4.2 权限控制

**文件**：`/TG/tgservice/backend/routes/notifications.js`

```javascript
const { authMiddleware } = require('../middleware/auth');
const { requireBackendPermission, hasBackendPermission } = require('../middleware/permission');

// 所有员工可访问（助教 + 后台用户）
router.get('/', authMiddleware, async (req, res) => { ... });
router.get('/unread-count', authMiddleware, async (req, res) => { ... });
router.post('/:id/read', authMiddleware, async (req, res) => { ... });

// 管理权限：店长/助教管理/管理员
const canManageNotification = (req, res, next) => {
  const user = req.user;
  if (user.userType === 'coach') {
    // 助教没有管理权限
    return res.status(403).json({ error: '权限不足' });
  }
  if (!['管理员', '店长', '助教管理'].includes(user.role)) {
    return res.status(403).json({ error: '权限不足' });
  }
  next();
};

router.post('/manage/send', authMiddleware, canManageNotification, async (req, res) => { ... });
router.get('/manage/list', authMiddleware, canManageNotification, async (req, res) => { ... });
router.get('/manage/:id/recipients', authMiddleware, canManageNotification, async (req, res) => { ... });
router.get('/manage/employees', authMiddleware, canManageNotification, async (req, res) => { ... });
```

### 4.3 数据库操作规范

```javascript
const { dbAll, dbGet, enqueueRun, runInTransaction } = require('../db/index');
const TimeUtil = require('../utils/time');

// 创建通知（使用 runInTransaction 保证原子性）
const createNotification = async (title, content, senderType, senderId, senderName, recipients) => {
  return runInTransaction(async (tx) => {
    // 1. 创建通知主记录
    const result = await tx.run(
      `INSERT INTO notifications (title, content, sender_type, sender_id, sender_name, created_at, total_recipients)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, content, senderType, senderId, senderName, TimeUtil.nowDB(), recipients.length]
    );
    const notificationId = result.lastID;
    
    // 2. 创建接收者记录
    for (const r of recipients) {
      await tx.run(
        `INSERT INTO notification_recipients (notification_id, recipient_type, recipient_id, recipient_name, recipient_employee_id)
         VALUES (?, ?, ?, ?, ?)`,
        [notificationId, r.type, r.id, r.name, r.employee_id]
      );
    }
    
    return notificationId;
  });
};

// 标记已阅（使用 enqueueRun）
const markAsRead = async (notificationId, recipientType, recipientId) => {
  const now = TimeUtil.nowDB();
  return enqueueRun(
    `UPDATE notification_recipients 
     SET is_read = 1, read_at = ?
     WHERE notification_id = ? AND recipient_type = ? AND recipient_id = ? AND is_read = 0`,
    [now, notificationId, recipientType, recipientId]
  );
};
```

### 4.4 系统异常通知自动发送

**场景**：
- 台桌同步异常：在 `coaches.js` 的同步逻辑中捕获异常后调用
- 批处理异常：在批处理脚本中捕获异常后调用
- 计时器任务异常：在定时任务中捕获异常后调用

**实现**：

```javascript
// 新增服务文件：/TG/tgservice/backend/services/notification-service.js

const { runInTransaction, dbAll, dbGet } = require('../db/index');
const TimeUtil = require('../utils/time');

/**
 * 发送系统异常通知给所有管理员
 * @param {string} errorType - 异常类型：'sync_error'/'batch_error'/'timer_error'
 * @param {string} title - 通知标题
 * @param {string} content - 通知内容（包含异常详情）
 */
async function sendSystemErrorNotification(errorType, title, content) {
  // 获取所有后台管理员（管理员角色）
  const admins = await dbAll(
    `SELECT username, name, role FROM admin_users WHERE role IN ('管理员', '店长', '助教管理')`
  );
  
  if (admins.length === 0) return;
  
  const recipients = admins.map(a => ({
    type: 'admin',
    id: a.username,
    name: a.name || a.username,
    employee_id: null
  }));
  
  return runInTransaction(async (tx) => {
    const result = await tx.run(
      `INSERT INTO notifications (title, content, sender_type, sender_id, sender_name, notification_type, error_type, created_at, total_recipients)
       VALUES (?, ?, 'system', 'system', '系统', 'system_error', ?, ?, ?)`,
      [title, content, errorType, TimeUtil.nowDB(), recipients.length]
    );
    
    const notificationId = result.lastID;
    
    for (const r of recipients) {
      await tx.run(
        `INSERT INTO notification_recipients (notification_id, recipient_type, recipient_id, recipient_name)
         VALUES (?, ?, ?, ?)`,
        [notificationId, r.type, r.id, r.name]
      );
    }
    
    return notificationId;
  });
}

module.exports = { sendSystemErrorNotification };
```

**调用位置**：

1. **台桌同步异常**：`/TG/tgservice/backend/routes/coaches.js` 同步水牌逻辑
2. **批处理异常**：批处理脚本（如日结、月结等）
3. **计时器任务异常**：server.js 定时任务

---

## 五、前端页面设计

### 5.1 新增页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 通知列表 | `/pages/internal/notification-list.vue` | 查看通知、标记已阅 |
| 通知管理 | `/pages/internal/notification-manage.vue` | 发送通知、查看已发送 |

### 5.2 pages.json 配置

```json
{
  "path": "pages/internal/notification-list",
  "style": {
    "navigationBarTitleText": "通知列表",
    "navigationBarBackgroundColor": "#0a0a0f",
    "navigationBarTextStyle": "white",
    "navigationStyle": "custom"
  }
},
{
  "path": "pages/internal/notification-manage",
  "style": {
    "navigationBarTitleText": "通知管理",
    "navigationBarBackgroundColor": "#0a0a0f",
    "navigationBarTextStyle": "white",
    "navigationStyle": "custom"
  }
}
```

### 5.3 member.vue 修改

#### 5.3.1 常用功能板块新增通知图标

**位置**：`常用功能` 板块（约 line 148-167）

```vue
<view class="internal-group" v-if="!isCheckingLogin && memberInfo.memberNo && showCommonFeatures">
  <view class="group-header">
    <text class="group-title">🔧 常用功能</text>
  </view>
  <view class="group-section">
    <view class="internal-btns">
      <!-- 新增：通知按钮（角标显示未阅数量） -->
      <view class="internal-btn" @click="navigateTo('/pages/internal/notification-list')">
        <text class="internal-btn-icon">🔔</text>
        <text class="internal-btn-text">通知</text>
        <view class="badge" v-if="notificationUnreadCount > 0">{{ notificationUnreadCount }}</view>
      </view>
      <!-- 水牌查看 -->
      <view class="internal-btn" v-if="canViewWaterBoard" @click="navigateTo('/pages/internal/water-board-view')">
        <text class="internal-btn-icon">📋</text>
        <text class="internal-btn-text">水牌查看</text>
      </view>
      <!-- 服务下单 -->
      <view class="internal-btn" @click="navigateTo('/pages/internal/service-order')">
        <text class="internal-btn-icon">🔔</text>
        <text class="internal-btn-text">服务下单</text>
      </view>
      <!-- 我的奖罚 -->
      <view class="internal-btn" @click="navigateTo('/pages/internal/reward-penalty-view')">
        <text class="internal-btn-icon">🏆</text>
        <text class="internal-btn-text">我的奖罚</text>
        <view class="badge" v-if="rewardPenaltyCount > 0">{{ rewardPenaltyCount }}</view>
      </view>
    </view>
  </view>
</view>
```

#### 5.3.2 管理功能板块新增通知管理按钮

**位置**：`管理功能` 板块（约 line 218-240）

```vue
<!-- 组1: 管理 -->
<view class="group-section">
  <view class="section-header">
    <text class="section-title">📋 管理</text>
  </view>
  <view class="internal-btns">
    <!-- 新增：通知管理 -->
    <view class="internal-btn" @click="navigateTo('/pages/internal/notification-manage')">
      <text class="internal-btn-icon">🔔</text>
      <text class="internal-btn-text">通知管理</text>
    </view>
    <!-- 水牌管理 -->
    <view class="internal-btn" @click="navigateTo('/pages/internal/water-board')">
      <text class="internal-btn-icon">📋</text>
      <text class="internal-btn-text">水牌管理</text>
    </view>
    <!-- 其他按钮... -->
  </view>
</view>
```

#### 5.3.3 新增数据获取

```javascript
// 新增响应式数据
const notificationUnreadCount = ref(0);

// 新增 API 获取（在 onShow 中）
const loadNotificationUnreadCount = async () => {
  try {
    const res = await api.get('/notifications/unread-count');
    if (res.success) {
      notificationUnreadCount.value = res.data.unread_count;
    }
  } catch (e) {
    console.error('获取未阅通知数量失败:', e);
  }
};

// 在 onShow 中调用
onShow(() => {
  loadNotificationUnreadCount();
});
```

### 5.4 notification-list.vue 设计

#### 5.4.1 页面结构

```vue
<template>
  <view class="page">
    <!-- 固定标题栏 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">通知列表</text>
        <view class="header-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 通知列表 -->
    <scroll-view class="notification-list" scroll-y @scrolltolower="loadMore">
      <view class="notification-item" 
            v-for="item in notifications" 
            :key="item.id"
            :class="{ unread: item.is_read === 0 }"
            @click="showDetail(item)">
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
      <view class="empty" v-if="notifications.length === 0">
        <text>暂无通知</text>
      </view>
      <view class="loading" v-if="loading">
        <text>加载中...</text>
      </view>
    </scroll-view>

    <!-- 详情弹框 -->
    <view class="detail-modal" v-if="showModal" @click="closeModal">
      <view class="modal-content" @click.stop>
        <text class="modal-title">{{ selectedItem.title }}</text>
        <text class="modal-content-text">{{ selectedItem.content }}</text>
        <text class="modal-time">{{ selectedItem.created_at }}</text>
        <view class="modal-btn" v-if="selectedItem.is_read === 0" @click="markAsRead(selectedItem)">
          <text>标记已阅</text>
        </view>
      </view>
    </view>
  </view>
</template>
```

#### 5.4.2 核心逻辑

```javascript
<script setup>
import { ref, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import api from '@/utils/api.js';
import TimeUtil from '@/utils/time.js';

const notifications = ref([]);
const page = ref(1);
const loading = ref(false);
const showModal = ref(false);
const selectedItem = ref(null);

// 加载通知列表
const loadNotifications = async () => {
  if (loading.value) return;
  loading.value = true;
  try {
    const res = await api.get('/notifications', { page: page.value, pageSize: 20 });
    if (res.success) {
      if (page.value === 1) {
        notifications.value = res.data.notifications;
      } else {
        notifications.value.push(...res.data.notifications);
      }
    }
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' });
  }
  loading.value = false;
};

// 标记已阅
const markAsRead = async (item) => {
  try {
    const res = await api.post(`/notifications/${item.id}/read`);
    if (res.success) {
      item.is_read = 1;
      item.read_at = TimeUtil.nowDB();
      uni.showToast({ title: '已标记已阅', icon: 'success' });
    }
  } catch (e) {
    uni.showToast({ title: '操作失败', icon: 'none' });
  }
};

// 格式化时间
const formatTime = (timeStr) => {
  return TimeUtil.format(timeStr);
};

onMounted(() => loadNotifications());
onShow(() => loadNotifications());
</script>
```

### 5.5 notification-manage.vue 设计

#### 5.5.1 页面结构

```vue
<template>
  <view class="page">
    <!-- 固定标题栏 -->
    <view class="fixed-header">...</view>
    
    <!-- 标签切换 -->
    <view class="tab-bar">
      <view class="tab" :class="{ active: activeTab === 'send' }" @click="activeTab = 'send'">
        <text>发送通知</text>
      </view>
      <view class="tab" :class="{ active: activeTab === 'list' }" @click="activeTab = 'list'">
        <text>已发送列表</text>
      </view>
    </view>

    <!-- 发送通知板块 -->
    <view class="send-section" v-if="activeTab === 'send'">
      <!-- 标题输入 -->
      <view class="input-item">
        <text class="input-label">通知标题</text>
        <input class="input-field" v-model="form.title" placeholder="请输入标题" />
      </view>
      
      <!-- 内容输入 -->
      <view class="input-item">
        <text class="input-label">通知内容</text>
        <textarea class="input-area" v-model="form.content" placeholder="请输入内容" />
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
          <input class="search-input" v-model="searchKeyword" placeholder="搜索姓名/艺名/工号" @input="searchEmployees" />
          
          <!-- 筛选按钮 -->
          <view class="filter-bar">
            <view class="filter-btn" :class="{ active: levelFilter === '' }" @click="levelFilter = ''">全部级别</view>
            <view class="filter-btn" v-for="lv in coachLevels" :key="lv" :class="{ active: levelFilter === lv }" @click="levelFilter = lv">{{ lv }}</view>
          </view>
          <view class="filter-bar">
            <view class="filter-btn" :class="{ active: roleFilter === '' }" @click="roleFilter = ''">全部角色</view>
            <view class="filter-btn" v-for="r in adminRoles" :key="r" :class="{ active: roleFilter === r }" @click="roleFilter = r">{{ r }}</view>
          </view>
          
          <!-- 员工列表（可复选） -->
          <scroll-view class="employee-list" scroll-y>
            <view class="employee-item" v-for="emp in filteredEmployees" :key="emp.id" @click="toggleEmployee(emp)">
              <view class="checkbox" :class="{ checked: selectedEmployees.includes(emp.id) }">
                <text v-if="selectedEmployees.includes(emp.id)">✓</text>
              </view>
              <text class="emp-name">{{ emp.name }}</text>
              <text class="emp-id">{{ emp.employee_id || emp.role }}</text>
            </view>
          </scroll-view>
          
          <!-- 已选人数 -->
          <text class="selected-count">已选择 {{ selectedEmployees.length }} 人</text>
        </view>
      </view>
      
      <!-- 发送按钮 -->
      <view class="send-btn" :class="{ disabled: !canSend }" @click="sendNotification">
        <text>发送通知</text>
      </view>
    </view>

    <!-- 已发送列表板块 -->
    <view class="list-section" v-if="activeTab === 'list'">
      <scroll-view class="sent-list" scroll-y>
        <view class="sent-item" v-for="item in sentNotifications" :key="item.id" @click="showRecipients(item)">
          <text class="sent-title">{{ item.title }}</text>
          <text class="sent-time">{{ formatTime(item.created_at) }}</text>
          <view class="sent-stats">
            <text class="stat-total">发送 {{ item.total_recipients }} 人</text>
            <text class="stat-unread">未阅 {{ item.unread_count }} 人</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 未阅者弹框 -->
    <view class="recipients-modal" v-if="showRecipientsModal" @click="closeRecipientsModal">
      <view class="modal-content" @click.stop>
        <text class="modal-title">未阅者列表</text>
        <scroll-view class="recipients-list" scroll-y>
          <view class="recipient-item" v-for="r in unreadRecipients" :key="r.recipient_id">
            <text class="r-name">{{ r.recipient_name }}</text>
            <text class="r-id" v-if="r.recipient_employee_id">{{ r.recipient_employee_id }}号</text>
            <text class="r-type">{{ r.recipient_type === 'coach' ? '助教' : '后台' }}</text>
          </view>
        </scroll-view>
        <view class="modal-close" @click="closeRecipientsModal">
          <text>关闭</text>
        </view>
      </view>
    </view>
  </view>
</template>
```

#### 5.5.2 核心逻辑

```javascript
<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '@/utils/api.js';

const activeTab = ref('send');
const form = ref({
  title: '',
  content: '',
  recipient_type: 'all',
  recipients: []
});

// 员工选择器数据
const employees = ref([]);
const selectedEmployees = ref([]);
const searchKeyword = ref('');
const levelFilter = ref('');
const roleFilter = ref('');

// 筛选后的员工列表
const filteredEmployees = computed(() => {
  return employees.value.filter(emp => {
    // 搜索过滤
    if (searchKeyword.value) {
      const kw = searchKeyword.value.toLowerCase();
      if (!emp.name.toLowerCase().includes(kw) && 
          !(emp.employee_id && emp.employee_id.includes(kw))) {
        return false;
      }
    }
    // 级别过滤（助教）
    if (levelFilter.value && emp.type === 'coach' && emp.level !== levelFilter.value) {
      return false;
    }
    // 角色过滤（后台用户）
    if (roleFilter.value && emp.type === 'admin' && emp.role !== roleFilter.value) {
      return false;
    }
    return true;
  });
});

// 加载可选员工
const loadEmployees = async () => {
  try {
    const res = await api.get('/notifications/manage/employees');
    if (res.success) {
      // 合并助教和后台用户
      employees.value = [
        ...res.data.coaches.map(c => ({
          id: `coach_${c.coach_no}`,
          type: 'coach',
          coach_no: c.coach_no,  // 内部ID
          name: c.stage_name,
          employee_id: c.employee_id,
          level: c.level
        })),
        ...res.data.admins.map(a => ({
          id: `admin_${a.username}`,
          type: 'admin',
          username: a.username,  // 内部ID
          name: a.name,
          role: a.role
        }))
      ];
    }
  } catch (e) {
    uni.showToast({ title: '加载员工失败', icon: 'none' });
  }
};

// 发送通知
const sendNotification = async () => {
  if (!canSend.value) return;
  
  // 构建接收者列表
  let recipients = [];
  if (form.value.recipient_type === 'selected') {
    recipients = selectedEmployees.value.map(id => {
      const emp = employees.value.find(e => e.id === id);
      return {
        type: emp.type,
        id: emp.type === 'coach' ? emp.coach_no : emp.username
      };
    });
  }
  
  try {
    const res = await api.post('/notifications/manage/send', {
      title: form.value.title,
      content: form.value.content,
      recipient_type: form.value.recipient_type,
      recipients: form.value.recipient_type === 'selected' ? recipients : []
    });
    if (res.success) {
      uni.showToast({ title: '发送成功', icon: 'success' });
      // 重置表单
      form.value = { title: '', content: '', recipient_type: 'all', recipients: [] };
      selectedEmployees.value = [];
      // 切换到列表
      activeTab.value = 'list';
      loadSentNotifications();
    }
  } catch (e) {
    uni.showToast({ title: '发送失败', icon: 'none' });
  }
};

// 发送按钮是否可用
const canSend = computed(() => {
  if (!form.value.title || !form.value.content) return false;
  if (form.value.recipient_type === 'selected' && selectedEmployees.value.length === 0) return false;
  return true;
});

// 已发送列表
const sentNotifications = ref([]);
const loadSentNotifications = async () => {
  try {
    const res = await api.get('/notifications/manage/list');
    if (res.success) {
      sentNotifications.value = res.data.notifications;
    }
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' });
  }
};

// 未阅者弹框
const showRecipientsModal = ref(false);
const unreadRecipients = ref([]);
const showRecipients = async (item) => {
  try {
    const res = await api.get(`/notifications/manage/${item.id}/recipients`);
    if (res.success) {
      unreadRecipients.value = res.data.recipients.filter(r => r.is_read === 0);
      showRecipientsModal.value = true;
    }
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' });
  }
};

onMounted(() => {
  loadEmployees();
  loadSentNotifications();
});
</script>
```

---

## 六、权限矩阵更新

### 6.1 后台权限矩阵

**文件**：`/TG/tgservice/backend/middleware/permission.js`

```javascript
// PERMISSION_MATRIX 新增：
'管理员': {
  ...
  notificationManagement: true,  // 新增
},
'店长': {
  ...
  notificationManagement: true,  // 新增
},
'助教管理': {
  ...
  notificationManagement: true,  // 新增
},
// 其他角色不添加，保持 false 或不设置
```

### 6.2 前台权限矩阵

```javascript
// FRONTEND_PERMISSION_MATRIX 新增：
'助教': {
  ...
  notificationList: true,      // 所有员工可查看通知列表
  notificationManage: false,   // 助教不能发送通知
},
'店长': {
  ...
  notificationList: true,
  notificationManage: true,    // 可发送通知
},
'助教管理': {
  ...
  notificationList: true,
  notificationManage: true,
},
// 后台用户角色同样处理
```

---

## 七、文件变更清单

### 7.1 新增文件

| 文件 | 说明 |
|------|------|
| `/TG/tgservice/backend/routes/notifications.js` | 通知路由（所有 API） |
| `/TG/tgservice/backend/services/notification-service.js` | 通知服务（系统异常通知） |
| `/TG/tgservice-uniapp/src/pages/internal/notification-list.vue` | 通知列表页面 |
| `/TG/tgservice-uniapp/src/pages/internal/notification-manage.vue` | 通知管理页面 |

### 7.2 修改文件

| 文件 | 变更内容 |
|------|------|
| `/TG/tgservice/backend/server.js` | 注册 notifications 路由（约 line 430） |
| `/TG/tgservice/backend/middleware/permission.js` | 新增 notificationManagement 权限 |
| `/TG/tgservice-uniapp/src/pages.json` | 新增两个页面路由配置 |
| `/TG/tgservice-uniapp/src/pages/member/member.vue` | 常用功能新增通知按钮，管理功能新增通知管理按钮 |

### 7.3 数据库变更

- 新增表 `notifications`
- 新增表 `notification_recipients`
- 新增索引

---

## 八、边界情况与异常处理

### 8.1 发送通知边界情况

| 场景 | 处理 |
|------|------|
| 标题为空 | 返回 400 错误：`缺少必填字段：标题` |
| 内容为空 | 返回 400 错误：`缺少必填字段：内容` |
| 指定员工但 recipients 为空 | 返回 400 错误：`请选择接收者` |
| 接收者不存在 | 跳过不存在的接收者，继续发送 |
| 全员发送但无员工 | 返回成功，total_recipients = 0 |

### 8.2 标记已阅边界情况

| 场景 | 处理 |
|------|------|
| 通知不属于当前用户 | 返回 403 错误：`无权操作此通知` |
| 已阅后再次标记 | 返回成功，不修改状态（幂等） |
| 通知不存在 | 返回 404 错误：`通知不存在` |

### 8.3 系统异常通知

| 场景 | 处理 |
|------|------|
| 发送失败 | 记录日志，不影响主流程 |
| 无管理员 | 不发送，记录日志 |
| 异常内容过长 | 截断至 1000 字符 |

### 8.4 前端异常处理

| 场景 | 处理 |
|------|------|
| API 调用失败 | 显示 toast：`加载失败` 或 `操作失败` |
| 网络断开 | 显示 toast：`网络错误` |
| 权限不足 | 返回 403 时跳转到登录页 |

---

## 九、前后端交互流程

### 9.1 查看通知流程

```
用户打开「我的」页面
  ↓
member.vue onShow 调用 GET /api/notifications/unread-count
  ↓
显示角标（未阅数量）
  ↓
用户点击「通知」按钮
  ↓
跳转 notification-list.vue
  ↓
调用 GET /api/notifications 获取列表
  ↓
显示通知列表（未阅优先，时间倒序）
  ↓
用户点击通知 → 显示详情弹框
  ↓
用户点击「标记已阅」
  ↓
调用 POST /api/notifications/:id/read
  ↓
更新本地状态（is_read = 1）
```

### 9.2 发送通知流程

```
用户（店长/助教管理/管理员）打开「通知管理」
  ↓
跳转 notification-manage.vue
  ↓
调用 GET /api/notifications/manage/employees 获取员工列表
  ↓
用户填写标题、内容
  ↓
选择「全员发送」或「指定员工」
  ↓
指定员工时：搜索、筛选、复选员工
  ↓
用户点击「发送通知」
  ↓
调用 POST /api/notifications/manage/send
  ↓
后端创建通知记录 + 接收者记录
  ↓
返回成功，显示 toast
  ↓
切换到「已发送列表」
```

### 9.3 系统异常通知流程

```
后台任务执行（同步/批处理/定时器）
  ↓
捕获异常
  ↓
调用 notification-service.sendSystemErrorNotification()
  ↓
查询所有管理员
  ↓
创建系统通知记录
  ↓
管理员在通知列表看到异常通知
```

---

## 十、编码规范遵守

### 10.1 时间处理

- ✅ 后端使用 `TimeUtil.nowDB()` 生成时间字符串
- ✅ 前端使用 `TimeUtil.format(timeStr)` 格式化显示
- ❌ 禁止 `datetime('now')`、手动时区偏移

### 10.2 数据库连接

- ✅ 使用 `const { dbAll, dbGet, enqueueRun, runInTransaction } = require('../db/index')`
- ❌ 禁止 `new sqlite3.Database()`
- ❌ 禁止直接访问本地 SQLite 文件

### 10.3 数据库写入

- ✅ 创建通知使用 `runInTransaction`
- ✅ 标记已阅使用 `enqueueRun`
- ❌ 禁止 `db.run('BEGIN TRANSACTION')`

### 10.4 页面显示规范

- ✅ 页面显示工号：`{{ employee_id }}`
- ❌ 禁止显示 `coach_no`
- ✅ `coach_no` 仅用于 API 参数和内部逻辑

---

## 十一、验收要点

1. ✅ 通知发送功能：店长/助教管理/管理员可发送，权限正确
2. ✅ 通知查阅功能：所有员工可查看，角标显示未阅数量
3. ✅ 系统异常通知：自动发送给管理员
4. ✅ 员工选择器：搜索、筛选、复选功能正常
5. ✅ 已阅/未阅状态：标记已阅后不可改回
6. ✅ 编码规范：时间处理、数据库操作、页面显示符合规范

---

## 十二、开发工作量估算

| 任务 | 预估时间 |
|------|------|
| 数据库表创建 | 0.5h |
| 后端路由开发 | 2h |
| 后端服务（系统异常通知） | 1h |
| 前端通知列表页面 | 1.5h |
| 前端通知管理页面 | 2h |
| member.vue 修改 | 0.5h |
| 权限矩阵更新 | 0.5h |
| 测试与调试 | 2h |
| **总计** | **10h** |

---

_设计方案完成。程序员A 输出。_
```

## 审计检查清单
# 代码审计检查清单

## 编码规范检查（自动化）

运行 `check-style.js` 脚本，检查：

| 规则ID | 检查项 | 禁止 | 必须 |
|--------|--------|------|------|
| TIME | 时间处理 | `datetime('now')`、手动时区偏移 | `TimeUtil` |
| DB_CONN | 数据库连接 | `new sqlite3.Database()` | `db/index.js`（连接 Turso 云端 DB） |
| DB_WRITE | 数据库写入 | 裸开事务 | `writeQueue` |

## 人工审计检查项

### 逻辑正确性

- [ ] API路径、方法、参数与设计方案一致
- [ ] 数据库字段名、类型与设计一致
- [ ] 业务逻辑分支完整（if/else覆盖所有情况）
- [ ] 边界值处理（空值、最大值、最小值）

### 安全性

- [ ] 输入验证（参数类型、长度、范围）
- [ ] SQL注入防护（参数化查询）
- [ ] 权限校验（用户身份验证）

### 错误处理

- [ ] API错误有明确的错误码和消息
- [ ] 数据库操作有try/catch
- [ ] 异常情况有fallback处理

### 代码质量

- [ ] 变量命名清晰
- [ ] 函数单一职责
- [ ] 无死代码（未使用的变量/函数）
- [ ] Git提交信息描述清晰

### 前后端一致性

- [ ] API请求/响应格式前后端匹配
- [ ] 前端字段名与后端返回一致
- [ ] 错误处理前后端对齐


## 输出要求
1. 审计结果：通过/不通过
2. 如不通过，列出具体问题（对应检查清单的哪些项）
3. 如果通过，提取设计摘要（改了什么文件、新增什么API、数据表变更等）

这是第 1/3 次审计。