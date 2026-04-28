# QA-20260429-1 设计方案

## QA需求概述

1. **订单表新增会员手机号字段**，确认已有设备指纹字段。用户下单时，已登录H5则写入手机号+设备指纹，未登录则只写设备指纹。
2. **会员表新增设备指纹字段**。每次会员登录时写入设备指纹，已有则覆盖。
3. **前台H5购物车页面新增「我的订单」标签页**。购物车和我的订单标签可切换。我的订单展示近3天手机号或设备指纹匹配的订单，按下单时间倒序，最多50条。显示商品图片、商品名、数量、金额、订单合计金额。默认显示购物车页面，不切换不加载订单数据。

---

## 一、数据库变更

### 1.1 orders 表新增 member_phone 字段

```sql
-- 新增字段
ALTER TABLE orders ADD COLUMN member_phone TEXT;

-- 新增索引（用于按手机号查询订单）
CREATE INDEX IF NOT EXISTS idx_orders_member_phone ON orders(member_phone);

-- 新增复合索引（用于「我的订单」查询优化）
CREATE INDEX IF NOT EXISTS idx_orders_member_phone_created_at ON orders(member_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_device_fingerprint_created_at ON orders(device_fingerprint, created_at DESC);
```

**现有 orders 表结构确认**：
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| order_no | TEXT | 订单号 |
| table_no | TEXT | 台桌号 |
| items | TEXT | 商品列表(JSON) |
| total_price | REAL | 总金额 |
| status | TEXT | 状态 |
| device_fingerprint | TEXT | 设备指纹(已存在) |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |
| **member_phone** | TEXT | **新增：会员手机号** |

### 1.2 members 表新增 device_fingerprint 字段

```sql
-- 新增字段
ALTER TABLE members ADD COLUMN device_fingerprint TEXT;

-- 新增索引（用于按设备指纹查询会员）
CREATE INDEX IF NOT EXISTS idx_members_device_fingerprint ON members(device_fingerprint);
```

**现有 members 表结构确认**：
| 字段 | 类型 | 说明 |
|------|------|------|
| member_no | INTEGER | 主键 |
| phone | TEXT | 手机号 |
| openid | TEXT | 微信openid |
| name | TEXT | 姓名 |
| gender | TEXT | 性别 |
| remark | TEXT | 备注 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |
| **device_fingerprint** | TEXT | **新增：设备指纹** |

---

## 二、后端 API 变更

### 2.1 下单 API 修改 (`POST /api/order`)

**文件**：`/TG/tgservice/backend/server.js`

**修改点**：
1. 从请求中获取会员身份（通过 memberToken）
2. 已登录：写入 member_phone + device_fingerprint
3. 未登录：只写入 device_fingerprint

**修改代码位置**：约第 855 行 `app.post('/api/order', async (req, res) => {...})`

**修改方案**：
```javascript
// 下单
app.post('/api/order', async (req, res) => {
  try {
    const { sessionId, deviceFingerprint } = req.body;

    // 获取会员手机号（从 token 解析）
    let memberPhone = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, config.jwt.secret);
        // 检查是否为会员 token（包含 memberNo）
        if (decoded.memberNo && decoded.phone) {
          memberPhone = decoded.phone;
        }
      } catch (e) {
        // token 无效或过期，忽略，视为未登录
      }
    }

    // 检查设备指纹黑名单
    if (deviceFingerprint) {
      const blacklisted = await dbGet(
        'SELECT id FROM device_blacklist WHERE device_fingerprint = ?',
        [deviceFingerprint]
      );
      if (blacklisted) {
        logger.warn(`黑名单设备尝试下单: ${deviceFingerprint}`);
        return res.status(403).json({ error: '订单提交失败' });
      }
    }

    // ... 获取购物车、验证台桌等原有逻辑 ...

    // 保存订单(存UTC时间)
    await enqueueRun(
      `INSERT INTO orders (order_no, table_no, items, total_price, status, device_fingerprint, member_phone, created_at) 
       VALUES (?, ?, ?, ?, '待处理', ?, ?, ?)`,
      [orderNo, tableNo, JSON.stringify(orderItems), totalPrice, deviceFingerprint || null, memberPhone, TimeUtil.nowDB()]
    );

    // ... 清空购物车、返回结果等原有逻辑 ...
  } catch (err) {
    logger.error(`下单失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});
```

### 2.2 会员登录 API 修改

**涉及 API**：
- `POST /api/member/login-sms`（H5短信登录）- 约第 1599 行
- `POST /api/member/login`（微信手机号登录）- 约第 1719 行
- `POST /api/member/auto-login`（自动登录）- 级第 1840 行

**修改方案**：在请求体中接收设备指纹，登录成功后写入/更新 members 表的 device_fingerprint 字段。

#### 2.2.1 H5短信登录修改

```javascript
// 短信验证码登录(H5用)
app.post('/api/member/login-sms', async (req, res) => {
  try {
    const { phone, code, deviceFingerprint } = req.body;  // 新增 deviceFingerprint 参数

    // ... 验证码校验逻辑 ...

    // 查询或创建会员
    let member = await dbGet('SELECT * FROM members WHERE phone = ?', [phone]);

    if (!member) {
      // 新用户注册
      member = await runInTransaction(async (tx) => {
        const result = await tx.run(
          'INSERT INTO members (phone, device_fingerprint, created_at, updated_at) VALUES (?, ?, ?, ?)',
          [phone, deviceFingerprint || null, TimeUtil.nowDB(), TimeUtil.nowDB()]  // 新增 device_fingerprint
        );
        const newMember = await tx.get(
          'SELECT * FROM members WHERE member_no = ?',
          [result.lastID]
        );
        return newMember;
      });
      operationLog.info(`新会员注册(H5): ${phone}`);
    } else {
      // 更新设备指纹（已有则覆盖）
      if (deviceFingerprint) {
        await enqueueRun(
          'UPDATE members SET device_fingerprint = ?, updated_at = ? WHERE member_no = ?',
          [deviceFingerprint, TimeUtil.nowDB(), member.member_no]
        );
        member.device_fingerprint = deviceFingerprint;
      }
    }

    // ... 后续 token 生成、身份检查等逻辑不变 ...
  } catch (err) {
    logger.error(`短信登录失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});
```

#### 2.2.2 微信手机号登录修改

```javascript
// 微信手机号登录/注册
app.post('/api/member/login', async (req, res) => {
  try {
    const { code, encryptedData, iv, deviceFingerprint } = req.body;  // 新增 deviceFingerprint 参数

    // ... 微信解密逻辑获取手机号 ...

    // 查询或创建会员
    let member = await dbGet('SELECT * FROM members WHERE phone = ?', [phone]);

    if (!member) {
      // 新用户注册
      const result = await enqueueRun(
        'INSERT INTO members (phone, openid, device_fingerprint, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [phone, openid, deviceFingerprint || null, TimeUtil.nowDB(), TimeUtil.nowDB()]  // 新增 device_fingerprint
      );
      member = await dbGet('SELECT * FROM members WHERE member_no = ?', [result.lastID]);
      operationLog.info(`新会员注册: ${phone}`);
    } else {
      // 更新 openid 和设备指纹
      const updates = [];
      const params = [];
      if (member.openid !== openid) {
        updates.push('openid = ?');
        params.push(openid);
      }
      if (deviceFingerprint) {
        updates.push('device_fingerprint = ?');
        params.push(deviceFingerprint);
      }
      if (updates.length > 0) {
        params.push(TimeUtil.nowDB());
        params.push(member.member_no);
        await enqueueRun(
          `UPDATE members SET ${updates.join(', ')}, updated_at = ? WHERE member_no = ?`,
          params
        );
      }
    }

    // ... 后续逻辑不变 ...
  } catch (err) {
    logger.error(`微信登录失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});
```

### 2.3 新增「我的订单」查询 API

**新增 API**：`GET /api/orders/my-orders`

**文件**：`/TG/tgservice/backend/server.js`

**功能**：
- 根据会员手机号或设备指纹查询订单
- 近3天（created_at >= 3天前）
- 按下单时间倒序
- 最多50条

**代码方案**：
```javascript
// 获取我的订单（近3天，手机号或设备指纹匹配）
app.get('/api/orders/my-orders', async (req, res) => {
  try {
    const { deviceFingerprint } = req.query;

    // 获取会员手机号（从 token 解析）
    let memberPhone = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, config.jwt.secret);
        if (decoded.memberNo && decoded.phone) {
          memberPhone = decoded.phone;
        }
      } catch (e) {
        // token 无效，忽略
      }
    }

    // 近3天的时间阈值
    const threeDaysAgo = TimeUtil.offsetDB(-3 * 24 * 60);  // 3天前的分钟数

    let orders = [];

    if (memberPhone) {
      // 已登录：优先按手机号查询
      orders = await dbAll(
        `SELECT * FROM orders 
         WHERE member_phone = ? AND created_at >= ? 
         ORDER BY created_at DESC 
         LIMIT 50`,
        [memberPhone, threeDaysAgo]
      );
    } else if (deviceFingerprint) {
      // 未登录：按设备指纹查询
      orders = await dbAll(
        `SELECT * FROM orders 
         WHERE device_fingerprint = ? AND created_at >= ? 
         ORDER BY created_at DESC 
         LIMIT 50`,
        [deviceFingerprint, threeDaysAgo]
      );
    }

    // 处理订单数据：解析 items JSON，获取商品图片
    const processedOrders = orders.map(o => {
      const items = o.items ? JSON.parse(o.items) : [];
      // 为每个商品获取图片（从 products 表或缓存）
      const itemsWithImage = items.map(item => ({
        ...item,
        image_url: getProductImage(item.name)  // 需要从 products 表获取
      }));
      return {
        ...o,
        items: itemsWithImage
      };
    });

    res.json(processedOrders);
  } catch (err) {
    logger.error(`获取我的订单失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});
```

**辅助函数**：获取商品图片
```javascript
// 获取商品图片（使用已有缓存）
async function getProductImage(productName) {
  try {
    const productMap = await getProductMap();
    return productMap[productName]?.image_url || '/static/avatar-default.png';
  } catch (e) {
    return '/static/avatar-default.png';
  }
}
```

---

## 三、前端变更

### 3.1 购物车页面新增「我的订单」标签页

**文件**：`/TG/tgservice-uniapp/src/pages/cart/cart.vue`

**修改方案**：

#### 3.1.1 模板修改

```vue
<template>
  <view class="page">
    <!-- 标签切换 -->
    <view class="tabs-container">
      <view class="tab" :class="{ active: activeTab === 'cart' }" @click="switchTab('cart')">
        <text>购物车</text>
      </view>
      <view class="tab" :class="{ active: activeTab === 'orders' }" @click="switchTab('orders')">
        <text>我的订单</text>
      </view>
    </view>

    <!-- 购物车内容（原有内容） -->
    <view v-if="activeTab === 'cart'">
      <!-- ... 原有购物车模板内容 ... -->
    </view>

    <!-- 我的订单内容 -->
    <view v-else class="orders-list">
      <view v-if="myOrders.length > 0" class="order-item" v-for="(order, index) in myOrders" :key="index">
        <view class="order-header">
          <text class="order-time">{{ formatOrderTime(order.created_at) }}</text>
          <text class="order-status">{{ order.status }}</text>
          <text class="order-total">¥{{ order.total_price.toFixed(2) }}</text>
        </view>
        <view class="order-items">
          <view class="order-product" v-for="(item, idx) in order.items" :key="idx">
            <image class="product-img" :src="getProductImageUrl(item)" mode="aspectFill"></image>
            <view class="product-info">
              <text class="product-name">{{ item.name }}</text>
              <text v-if="item.options" class="product-options">{{ item.options }}</text>
              <text class="product-qty">x{{ item.quantity }}</text>
              <text class="product-price">¥{{ (item.price * item.quantity).toFixed(2) }}</text>
            </view>
          </view>
        </view>
      </view>
      <view v-else class="empty-orders">
        <text class="empty-icon">📋</text>
        <text class="empty-text">近3天无订单记录</text>
      </view>
    </view>

    <!-- ... 其他原有组件 ... -->
  </view>
</template>
```

#### 3.1.2 脚本修改

```javascript
<script setup>
import { ref, onMounted, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/utils/api.js'
import BeautyModal from '@/components/BeautyModal.vue'
import TableInfo from '@/components/TableInfo.vue'
import TableSelector from '@/components/TableSelector.vue'
import TimeUtil from '@/utils/time-util.js'  // 引入时间工具

// ... 原有变量 ...

// 新增：标签切换
const activeTab = ref('cart')  // 默认显示购物车
const myOrders = ref([])       // 我的订单数据
const ordersLoaded = ref(false) // 是否已加载订单数据

// 切换标签
const switchTab = async (tab) => {
  if (activeTab.value === tab) return
  activeTab.value = tab
  
  // 切换到「我的订单」时才加载数据（延迟加载）
  if (tab === 'orders' && !ordersLoaded.value) {
    await loadMyOrders()
    ordersLoaded.value = true
  }
}

// 加载我的订单
const loadMyOrders = async () => {
  try {
    uni.showLoading({ title: '加载中...' })
    const deviceFingerprint = api.getDeviceFingerprint()
    const data = await api.getMyOrders(deviceFingerprint)
    uni.hideLoading()
    myOrders.value = data || []
  } catch (e) {
    uni.hideLoading()
    myOrders.value = []
    console.log('加载订单失败', e)
  }
}

// 格式化订单时间
const formatOrderTime = (timeStr) => {
  return TimeUtil.format(timeStr)  // 使用 TimeUtil 格式化
}

// 获取商品图片 URL
const getProductImageUrl = (item) => {
  const url = item.image_url
  if (!url) return '/static/avatar-default.png'
  if (url.startsWith('http')) return url
  return 'https://tiangong.club' + url
}

// ... 原有其他方法 ...

onMounted(() => { 
  sessionId.value = uni.getStorageSync('sessionId') || ''
  // 默认显示购物车，不加载订单数据
  loadCart()
  floatPosition.value = uni.getStorageSync('floatButtonPosition') || 'left'
})

onShow(() => {
  tableName.value = uni.getStorageSync('tableName') || ''
  tableInfoRef.value?.loadTableInfo()
  loadCart()
  // 如果当前是「我的订单」标签，刷新数据
  if (activeTab.value === 'orders') {
    loadMyOrders()
  }
})
</script>
```

#### 3.1.3 样式修改

```css
/* 标签切换样式 */
.tabs-container {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  background: rgba(20, 20, 30, 0.6);
  border-radius: 12px;
  padding: 4px;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  border-radius: 8px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.6);
  transition: all 0.2s;
}

.tab.active {
  background: linear-gradient(135deg, #d4af37, #ffd700);
  color: #000;
  font-weight: 600;
}

/* 我的订单列表样式 */
.orders-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.order-item {
  background: rgba(20, 20, 30, 0.6);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(218, 165, 32, 0.1);
}

.order-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.order-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.order-status {
  font-size: 12px;
  color: #d4af37;
  margin-left: 8px;
  padding: 2px 8px;
  background: rgba(212, 175, 55, 0.1);
  border-radius: 4px;
}

.order-total {
  font-size: 16px;
  color: #d4af37;
  font-weight: 600;
  margin-left: auto;
}

.order-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.order-product {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.order-product:last-child {
  border-bottom: none;
}

.product-img {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  background: rgba(30, 30, 40, 0.5);
}

.product-info {
  flex: 1;
}

.product-name {
  font-size: 14px;
  font-weight: 500;
}

.product-options {
  font-size: 12px;
  color: #e6553a;
}

.product-qty {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-left: 8px;
}

.product-price {
  font-size: 14px;
  color: #d4af37;
  margin-left: auto;
}

.empty-orders {
  text-align: center;
  padding: 60px 20px;
}

.empty-orders .empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.empty-orders .empty-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.3);
}
```

### 3.2 API 工具修改

**文件**：`/TG/tgservice-uniapp/src/utils/api.js`

**新增接口**：
```javascript
// 我的订单（近3天）
getMyOrders: (deviceFingerprint) => request({ 
  url: `/orders/my-orders?deviceFingerprint=${deviceFingerprint}` 
}),
```

**修改接口**：会员登录时传递设备指纹
```javascript
// H5短信验证码登录（修改）
loginBySms: (phone, code) => {
  const deviceFingerprint = getDeviceFingerprint();
  return request({ 
    url: '/member/login-sms', 
    method: 'POST', 
    data: { phone, code, deviceFingerprint } 
  });
},

// 微信手机号登录/注册（修改）
memberLogin: (data) => {
  const deviceFingerprint = getDeviceFingerprint();
  return request({ 
    url: '/member/login', 
    method: 'POST', 
    data: { ...data, deviceFingerprint } 
  });
},
```

### 3.3 时间工具引入

**文件**：`/TG/tgservice-uniapp/src/utils/time-util.js`（确认是否存在）

如果不存在，需要创建或使用已有的时间处理逻辑。

---

## 四、文件变更清单

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `/TG/tgservice/backend/server.js` | 修改 | 下单API新增member_phone写入；会员登录API新增device_fingerprint写入；新增「我的订单」查询API |
| `/TG/tgservice-uniapp/src/pages/cart/cart.vue` | 修改 | 新增标签切换UI、「我的订单」列表展示 |
| `/TG/tgservice-uniapp/src/utils/api.js` | 修改 | 新增getMyOrders接口；修改loginBySms/memberLogin传递设备指纹 |
| `/TG/tgservice/backend/db/migrations/v2.5-orders-member-phone.sql` | 新增 | orders表新增member_phone字段及索引 |
| `/TG/tgservice/backend/db/migrations/v2.6-members-device-fingerprint.sql` | 新增 | members表新增device_fingerprint字段及索引 |

---

## 五、前后端交互流程

### 5.1 下单流程

```
用户点击下单
    ↓
前端获取 memberToken 和 deviceFingerprint
    ↓
POST /api/order { sessionId, deviceFingerprint }
    ↓
后端解析 memberToken 获取 memberPhone
    ↓
INSERT orders (..., device_fingerprint, member_phone, ...)
    ↓
返回下单结果
```

### 5.2 会员登录流程

```
用户输入手机号+验证码
    ↓
前端获取 deviceFingerprint
    ↓
POST /api/member/login-sms { phone, code, deviceFingerprint }
    ↓
后端验证验证码
    ↓
查询/创建会员记录
    ↓
UPDATE members SET device_fingerprint = ...
    ↓
返回 token + 会员信息
```

### 5.3 我的订单查询流程

```
用户切换到「我的订单」标签
    ↓
前端获取 memberToken 和 deviceFingerprint
    ↓
GET /api/orders/my-orders?deviceFingerprint=xxx
    ↓
后端解析 memberToken 获取 memberPhone
    ↓
if (memberPhone) → 查询 WHERE member_phone = ?
else → 查询 WHERE device_fingerprint = ?
    ↓
返回订单列表（含商品图片）
    ↓
前端展示订单列表
```

---

## 六、边界情况和异常处理

### 6.1 下单时边界情况

| 场景 | 处理方式 |
|------|----------|
| 已登录会员下单 | 写入 member_phone + device_fingerprint |
| 未登录用户下单 | member_phone 为 null，只写入 device_fingerprint |
| token 无效/过期 | 视为未登录，只写入 device_fingerprint |
| 黑名单设备指纹 | 返回 403，订单提交失败 |

### 6.2 会员登录时边界情况

| 场景 | 处理方式 |
|------|----------|
| 新会员注册 | 创建记录时写入 device_fingerprint |
| 已有会员登录 | 覆盖更新 device_fingerprint |
| 未提供设备指纹 | device_fingerprint 保持原值（不强制写入null） |

### 6.3 我的订单查询边界情况

| 场景 | 处理方式 |
|------|----------|
| 已登录会员 | 按手机号查询 |
| 未登录用户 | 按设备指纹查询 |
| 既无手机号也无设备指纹 | 返回空数组 |
| 订单超过50条 | 返回前50条（按时间倒序） |
| 订单商品无图片 | 使用默认图片 `/static/avatar-default.png` |

### 6.4 前端展示边界情况

| 场景 | 处理方式 |
|------|----------|
| 默认进入购物车页面 | 显示购物车，不加载订单数据 |
| 切换到「我的订单」 | 延迟加载订单数据 |
| 再次切换回购物车 | 保持订单数据，不重新加载 |
| 页面刷新/重新进入 | 重置为购物车标签 |

---

## 七、验收要点

1. ✅ 订单表 member_phone 字段正确写入（登录带手机号+指纹，未登录仅指纹）
2. ✅ 会员表 device_fingerprint 字段登录时正确写入/覆盖
3. ✅ H5购物车页面我的订单标签切换正常
4. ✅ 订单数据按手机号/指纹匹配查询，近3天、倒序、最多50条
5. ✅ 默认显示购物车，不切换不加载订单
6. ✅ 商品图片正确显示

---

## 八、编码规范确认

- ✅ 时间处理使用 `TimeUtil.nowDB()` / `TimeUtil.offsetDB()`
- ✅ 数据库连接使用 `const { db, dbRun, dbAll, dbGet } = require('./db/index')`
- ✅ 数据库写入使用 `enqueueRun()` 或 `runInTransaction()`
- ✅ 页面不显示 coach_no，只显示 employee_id

---

_设计完成。待程序员B实现代码后进行测试验收。_