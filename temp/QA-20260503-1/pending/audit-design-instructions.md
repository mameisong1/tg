你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
```
# QA-20260503-1 果盘和奶茶任务统计功能 设计方案

## 一、需求概述

### 1.1 业务规则

| 维度 | 规则 |
|------|------|
| 奶茶任务 | 助教每人每月 **30杯**，统计范围为 `product_categories.name = '奶茶店'` 的所有商品 |
| 果盘任务 | 助教每人每月 **5个**，统计规则：(1) 商品名包含"果盘"的 = 1个果盘；(2) 单份水果商品：**3份 = 1个果盘** |
| 统计周期 | 当月（本月1号至今日）/ 上月（上月1号至末） |
| 关联规则 | 通过订单 `device_fingerprint` 或 `member_phone` 关联到 `coaches` 表中的助教 |

### 1.2 功能模块

| 模块 | 位置 | 功能 | 权限 |
|------|------|------|------|
| 助教端 - 奶茶果盘页 | 助教专用板块 | 当月/上月订单明细 + 任务进度 | 助教（`coach` 身份） |
| 管理端 - 奶茶果盘统计 | 管理功能板块 - 审查组 | 各助教任务进度（标红未完成/标绿已完成）+ 查看明细 | 店长/助教管理/管理员 |

### 1.3 数据修复功能
- 自动修复早期数据：设备指纹写入助教表、补手机号
- 通过订单的 `device_fingerprint` 匹配 `members.device_fingerprint` → `members.phone` → `coaches.phone` 建立关联

---

## 二、数据库设计

### 2.1 新增字段

**coaches 表**：新增 `device_fingerprint` 字段（TEXT, 可空）
```sql
-- Migration SQL（后端启动时自动执行，模式同现有 ALTER TABLE 逻辑）
ALTER TABLE coaches ADD COLUMN device_fingerprint TEXT;
CREATE INDEX IF NOT EXISTS idx_coaches_device_fingerprint ON coaches(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_coaches_phone ON coaches(phone);
```

> **说明**：现有 `coaches` 表已有 `phone` 字段。早期订单只有 `device_fingerprint` 没有助教关联，通过 `orders.device_fingerprint → members.device_fingerprint → members.phone → coaches.phone` 建立关联。新增 `device_fingerprint` 字段用于未来直接关联。

### 2.2 无需新增表
- 所有统计数据通过 `orders` + `products` + `coaches` + `members` 四表关联查询实时计算
- 无需新建统计表，保持数据一致性

### 2.3 现有字段确认

| 表 | 字段 | 说明 |
|---|---|---|
| orders | id, order_no, table_no, items(JSON), total_price, status, device_fingerprint, member_phone, created_at | ✅ 已存在 |
| products | name, category, image_url, price, stock_available, status, popularity | ✅ 已存在 |
| coaches | coach_no, employee_id, stage_name, phone, level, shift, status | ✅ 已存在 |
| members | member_no, phone, device_fingerprint, created_at | ✅ 已存在 |

### 2.4 items 字段格式

```json
[
  { "name": "珍珠奶茶", "quantity": 2, "price": 15, "options": "冰" },
  { "name": "水果拼盘", "quantity": 1, "price": 38, "options": "" }
]
```

---

## 三、后端 API 设计

### 3.1 新建路由文件

**文件**：`/TG/tgservice/backend/routes/tea-fruit-stats.js`

### 3.2 API 列表

#### API 1: `GET /api/tea-fruit/my-stats` - 助教个人统计
- **权限**：助教（`auth.required`, 通过 `req.user.userType === 'coach'` 判断）
- **参数**：
  - `period`（必填）：`'this-month'` | `'last-month'`
- **返回**：
```json
{
  "success": true,
  "data": {
    "period": "this-month",
    "period_label": "本月",
    "date_range": "2026-05-01 ~ 2026-05-03",
    "tea": {
      "target": 30,
      "completed": 18,
      "orders": [
        { "order_no": "TG...", "product_name": "珍珠奶茶", "quantity": 2, "created_at": "2026-05-01 14:30:00" }
      ]
    },
    "fruit": {
      "target": 5,
      "completed": 3,
      "orders": [
        { "order_no": "TG...", "product_name": "豪华果盘", "quantity": 1, "is_platter": true, "created_at": "2026-05-02 16:00:00" },
        { "order_no": "TG...", "product_name": "西瓜", "quantity": 5, "is_platter": false, "fruit_equivalent": 1.67, "created_at": "2026-05-02 18:00:00" }
      ]
    }
  }
}
```

#### API 2: `GET /api/tea-fruit/admin-stats` - 管理员统计（助教列表）
- **权限**：`requireBackendPermission(['teaFruitStats'])`
- **参数**：
  - `period`（必填）：`'this-month'` | `'last-month'`
  - `coach_no`（可选）：筛选特定助教
- **返回**：
```json
{
  "success": true,
  "data": {
    "period": "this-month",
    "period_label": "本月",
    "coaches": [
      {
        "coach_no": "001",
        "employee_id": "A001",
        "stage_name": "小美",
        "tea_target": 30,
        "tea_completed": 18,
        "tea_status": "incomplete",
        "fruit_target": 5,
        "fruit_completed": 3,
        "fruit_status": "incomplete"
      }
    ]
  }
}
```

#### API 3: `GET /api/tea-fruit/coach-detail` - 管理员查看助教明细
- **权限**：`requireBackendPermission(['teaFruitStats'])`
- **参数**：
  - `coach_no`（必填）
  - `period`（必填）：`'this-month'` | `'last-month'`
  - `type`（必填）：`'tea'` | `'fruit'`
- **返回**：与 API 1 类似的订单明细数据

#### API 4: `POST /api/tea-fruit/repair-data` - 数据修复（管理端触发）
- **权限**：`requireBackendPermission(['teaFruitStats'])`
- **功能**：遍历历史订单，通过 `device_fingerprint` 匹配助教，写入关联关系
- **返回**：
```json
{
  "success": true,
  "data": {
    "processed_orders": 1500,
    "matched_coaches": 23,
    "repaired_count": 15
  }
}
```

### 3.3 权限配置变更

**文件**：`/TG/tgservice/backend/middleware/permission.js`

在 `PERMISSION_MATRIX` 中为 '管理员'/'店长'/'助教管理' 添加 `teaFruitStats: true`。

在 `FRONTEND_PERMISSION_MATRIX` 中为 '助教' 添加 `teaFruit: true`，为 '店长'/'助教管理'/'管理员' 添加 `teaFruitStats: true`。

### 3.4 核心计算逻辑（重点验收项）

#### 3.4.1 奶茶商品识别规则

**识别标准**：商品分类（`products.category`）等于 `'奶茶店'` 的所有商品。

```javascript
// 奶茶商品识别逻辑（后端）
async function getTeaProducts() {
  // 从 products 表查询 category = '奶茶店' 的所有商品名称
  const teaProducts = await dbAll(
    "SELECT name FROM products WHERE category = '奶茶店' AND status = '上架'"
  );
  return teaProducts.map(p => p.name);
  // 返回如：['珍珠奶茶', '芒果奶茶', '芋泥奶茶', '柠檬茶', ...]
}

// 判断订单项是否为奶茶商品
function isTeaProduct(itemName, teaProductNames) {
  return teaProductNames.includes(itemName);
}
```

**SQL 实现**：
```sql
-- 查询指定助教在时间范围内的奶茶订单
SELECT o.order_no, o.created_at, o.member_phone,
       JSON_EXTRACT(item.value, '$.name') as product_name,
       JSON_EXTRACT(item.value, '$.quantity') as quantity
FROM orders o, json_each(o.items) as item
WHERE o.created_at >= :dateStart AND o.created_at <= :dateEnd
  AND o.status = '已完成'
  AND JSON_EXTRACT(item.value, '$.name') IN (
    SELECT name FROM products WHERE category = '奶茶店'
  )
  AND (
    o.device_fingerprint IN (SELECT device_fingerprint FROM coaches WHERE coach_no = :coachNo)
    OR o.member_phone IN (SELECT phone FROM coaches WHERE coach_no = :coachNo)
  )
```

**示例**：
| 订单项商品名 | products.category | 是否计入奶茶任务 |
|-------------|-------------------|------------------|
| 珍珠奶茶 | 奶茶店 | ✅ 计入 |
| 芋泥奶茶 | 奶茶店 | ✅ 计入 |
| 柠檬茶 | 奶茶店 | ✅ 计入 |
| 可乐 | 酒水 | ❌ 不计入 |
| 果盘 | 水果 | ❌ 不计入 |

---

#### 3.4.2 果盘商品识别规则

**识别标准**：两种情况
1. **整份果盘**：商品名称包含 `"果盘"` 字样（括号后缀可无视）
2. **单份水果**：需要折算，**3份单份水果 = 1个果盘任务**

```javascript
// 果盘商品识别逻辑（后端）

// 规则1：整份果盘识别
// 商品名包含"果盘"即认定为整份果盘，括号后缀不影响识别
function isFruitPlatter(itemName) {
  // 去除常见括号后缀后判断
  const cleanName = itemName
    .replace(/\s*\([^)]*\)/g, '')  // 去除 (小)、(大)、(豪华) 等后缀
    .replace(/\s*【[^】]*】/g, '')  // 去除 【小】【大】 等后缀
    .trim();
  return cleanName.includes('果盘');
}

// 规则2：单份水果识别
// 单份水果的认定标准：
// - products.category = '水果' 且 name 不含 "果盘"
// - 或在配置表中定义的单份水果商品列表
async function getSingleFruitProducts() {
  const fruits = await dbAll(
    `SELECT name FROM products 
     WHERE category = '水果' 
       AND name NOT LIKE '%果盘%' 
       AND status = '上架'`
  );
  return fruits.map(p => p.name);
  // 返回如：['西瓜', '哈密瓜', '橙子', '苹果', '香蕉', ...]
}

function isSingleFruit(itemName, fruitProductNames) {
  // 先排除果盘类
  if (isFruitPlatter(itemName)) return false;
  // 再判断是否在单份水果列表中
  return fruitProductNames.includes(itemName);
}
```

**示例**：
| 订单项商品名 | 是否认定为果盘 | 计算规则 |
|-------------|---------------|----------|
| 豪华果盘 | ✅ 整份果盘 | quantity 直接计入果盘数 |
| 果盘(大) | ✅ 整份果盘 | quantity 直接计入果盘数（括号后缀无视） |
| 果盘【小】 | ✅ 整份果盘 | quantity 直接计入果盘数（括号后缀无视） |
| 西瓜 | ✅ 单份水果 | quantity / 3 折算果盘数 |
| 哈密瓜 | ✅ 单份水果 | quantity / 3 折算果盘数 |
| 橙子 | ✅ 单份水果 | quantity / 3 折算果盘数 |
| 珍珠奶茶 | ❌ 不是果盘 | 不计入 |

---

#### 3.4.3 任务进度计算规则

**奶茶任务**：每月 **30杯**，按订单项数量累加。

**果盘任务**：每月 **5个**，整份果盘直接计数，单份水果折算。

```javascript
// 任务进度计算（后端核心逻辑）

// 奶茶任务计算
function calculateTeaProgress(teaOrders) {
  const target = 30;  // 每月目标 30杯
  const completed = teaOrders.reduce((sum, order) => {
    return sum + order.quantity;  // 直接累加数量
  }, 0);
  const rate = Math.min(completed / target, 1);  // 进度比率（上限100%）
  return {
    target,
    completed,
    rate,
    percent: ((completed / target) * 100).toFixed(1) + '%',
    status: completed >= target ? 'complete' : 'incomplete'
  };
}

// 果盘任务计算
function calculateFruitProgress(fruitPlatterOrders, singleFruitOrders) {
  const target = 5;  // 每月目标 5个
  
  // 1. 整份果盘直接计数
  const platterCount = fruitPlatterOrders.reduce((sum, order) => {
    return sum + order.quantity;
  }, 0);
  
  // 2. 单份水果折算：3份 = 1个果盘
  const singleFruitTotal = singleFruitOrders.reduce((sum, order) => {
    return sum + order.quantity;
  }, 0);
  const fruitEquivalent = Math.floor(singleFruitTotal / 3);  // 向下取整
  
  // 3. 总果盘数
  const completed = platterCount + fruitEquivalent;
  
  // 4. 计算进度（含小数显示）
  const totalEquivalent = platterCount + singleFruitTotal / 3;  // 精确小数
  const rate = Math.min(totalEquivalent / target, 1);
  
  return {
    target,
    completed,           // 整数（用于达标判断）
    totalEquivalent,     // 精确小数（用于显示）
    platterCount,        // 整份果盘数
    singleFruitTotal,    // 单份水果总数
    fruitEquivalent,     // 单份水果折算果盘数（整数）
    rate,
    percent: ((totalEquivalent / target) * 100).toFixed(1) + '%',
    status: completed >= target ? 'complete' : 'incomplete'
  };
}
```

**计算示例**：

| 场景 | 订单明细 | 奶茶进度 | 果盘进度 |
|------|---------|---------|---------|
| 场景1 | 珍珠奶茶x10, 豪华果盘x2 | 10/30杯 (33.3%) | 2/5个 (40%) |
| 场景2 | 芋泥奶茶x30, 果盘(大)x5 | 30/30杯 ✅ | 5/5个 ✅ |
| 场景3 | 柠檬茶x15, 西瓜x6 | 15/30杯 (50%) | 6/3=2个果盘 (2/5=40%) |
| 场景4 | 西瓜x3, 哈密瓜x3, 橙子x3 | 0/30杯 | 9/3=3个果盘 (3/5=60%) |
| 场景5 | 西瓜x2（不足3份） | 0/30杯 | 2/3=0.67个果盘（不计入完整数，显示为0/5） |
| 场景6 | 豪华果盘x3 + 西瓜x4 | 0/30杯 | 3 + 4/3=1.33 = 4.33个果盘（整数4/5，显示4.33/5） |

---

#### 3.4.4 SQL 完整实现

```sql
-- ===== 奶茶统计 SQL =====
SELECT 
  o.order_no,
  o.created_at,
  JSON_EXTRACT(item.value, '$.name') as product_name,
  JSON_EXTRACT(item.value, '$.quantity') as quantity,
  JSON_EXTRACT(item.value, '$.price') as price
FROM orders o, json_each(o.items) as item
WHERE o.created_at >= :dateStart AND o.created_at <= :dateEnd
  AND o.status = '已完成'
  AND JSON_EXTRACT(item.value, '$.name') IN (
    SELECT name FROM products WHERE category = '奶茶店'
  )
  AND (
    o.device_fingerprint IN (
      SELECT device_fingerprint FROM coaches WHERE coach_no = :coachNo
    )
    OR o.member_phone IN (
      SELECT phone FROM coaches WHERE coach_no = :coachNo
    )
  )
ORDER BY o.created_at DESC;

-- ===== 果盘统计 SQL（整份果盘） =====
SELECT 
  o.order_no,
  o.created_at,
  JSON_EXTRACT(item.value, '$.name') as product_name,
  JSON_EXTRACT(item.value, '$.quantity') as quantity,
  1 as is_platter  -- 标记为整份果盘
FROM orders o, json_each(o.items) as item
WHERE o.created_at >= :dateStart AND o.created_at <= :dateEnd
  AND o.status = '已完成'
  AND JSON_EXTRACT(item.value, '$.name') LIKE '%果盘%'
  AND (
    o.device_fingerprint IN (
      SELECT device_fingerprint FROM coaches WHERE coach_no = :coachNo
    )
    OR o.member_phone IN (
      SELECT phone FROM coaches WHERE coach_no = :coachNo
    )
  )
ORDER BY o.created_at DESC;

-- ===== 果盘统计 SQL（单份水果） =====
SELECT 
  o.order_no,
  o.created_at,
  JSON_EXTRACT(item.value, '$.name') as product_name,
  JSON_EXTRACT(item.value, '$.quantity') as quantity,
  0 as is_platter  -- 标记为单份水果
FROM orders o, json_each(o.items) as item
WHERE o.created_at >= :dateStart AND o.created_at <= :dateEnd
  AND o.status = '已完成'
  AND JSON_EXTRACT(item.value, '$.name') IN (
    SELECT name FROM products 
    WHERE category = '水果' 
      AND name NOT LIKE '%果盘%'
  )
  AND JSON_EXTRACT(item.value, '$.name') NOT LIKE '%果盘%'
  AND (
    o.device_fingerprint IN (
      SELECT device_fingerprint FROM coaches WHERE coach_no = :coachNo
    )
    OR o.member_phone IN (
      SELECT phone FROM coaches WHERE coach_no = :coachNo
    )
  )
ORDER BY o.created_at DESC;
```

---

#### 3.4.5 前端显示逻辑

```javascript
// 前端进度条计算（Vue 组件内）

// 奶茶进度条宽度
const teaProgressWidth = computed(() => {
  const percent = (teaData.completed / teaData.target) * 100;
  return Math.min(percent, 100);  // 上限 100%
});

// 果盘进度条宽度（使用精确小数）
const fruitProgressWidth = computed(() => {
  const percent = (fruitData.totalEquivalent / fruitData.target) * 100;
  return Math.min(percent, 100);
});

// 进度条颜色
function getProgressColor(percent) {
  if (percent >= 100) return '#4CAF50';  // 绿色 - 已完成
  if (percent >= 50) return '#FF9800';   // 橙色 - 进行中
  return '#F44336';                       // 红色 - 未达标
}

// 果盘明细显示格式化
function formatFruitItem(item) {
  if (item.is_platter) {
    // 整份果盘
    return `${item.product_name} x${item.quantity}`;
  } else {
    // 单份水果：显示折算信息
    const equivalent = item.quantity / 3;
    return `${item.product_name} x${item.quantity} (≈${equivalent.toFixed(2)}个果盘)`;
  }
}
```

**前端显示示例**：
```
┌─────────────────────────────┐
│ 🧋 奶茶任务                 │
│ ━━━━━━━━━━━░░░░░░░░░░░░░░  │
│ 18/30杯 (60%)               │
│ 颜色: 橙色 #FF9800          │
├─────────────────────────────┤
│ 🍉 果盘任务                 │
│ ━━━━━━━━━━━━━░░░░░░░░░░░░  │
│ 4.33/5个 (86.6%)            │
│ 颜色: 橙色 #FF9800          │
│ （整份3个 + 西瓜x4折算1.33）│
├─────────────────────────────┤
│ 订单明细:                   │
│ • 豪华果盘 x1               │
│ • 西瓜 x4 (≈1.33个果盘)     │
│ • 果盘(大) x2               │
└─────────────────────────────┘
```

#### 数据修复逻辑
```javascript
async function repairData() {
  const orders = await dbAll(`
    SELECT DISTINCT device_fingerprint, member_phone
    FROM orders
    WHERE device_fingerprint IS NOT NULL
      AND device_fingerprint != ''
  `);
  
  let repaired = 0;
  for (const order of orders) {
    // 通过 device_fingerprint 找 members.phone
    const member = await dbGet(
      'SELECT phone FROM members WHERE device_fingerprint = ?',
      [order.device_fingerprint]
    );
    if (member && member.phone) {
      // 通过 phone 找 coaches
      const coach = await dbGet(
        'SELECT coach_no, phone, device_fingerprint FROM coaches WHERE phone = ?',
        [member.phone]
      );
      if (coach && !coach.device_fingerprint) {
        // 写入 device_fingerprint 到 coaches 表
        await enqueueRun(
          'UPDATE coaches SET device_fingerprint = ? WHERE coach_no = ?',
          [order.device_fingerprint, coach.coach_no]
        );
        repaired++;
      }
    }
  }
  return { repaired };
}
```

### 3.5 日期计算

**严格遵循 TimeUtil 规范**，禁止使用 `datetime('now')` 或手动时区偏移。

```javascript
const TimeUtil = require('./utils/time');

function getDateRange(period) {
  const now = new Date(); // 服务器已设 Asia/Shanghai
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  const day = now.getDate();
  
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  
  if (period === 'this-month') {
    return { dateStart: dateStr(year, month, 1), dateEnd: dateStr(year, month, day), label: '本月' };
  }
  if (period === 'last-month') {
    const lastMonthEnd = new Date(year, month, 0).getDate();
    return {
      dateStart: dateStr(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, 1),
      dateEnd: dateStr(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, lastMonthEnd),
      label: '上月'
    };
  }
}
```

### 3.6 新增/修改文件清单

| 操作 | 文件路径 | 说明 |
|------|----------|------|
| **新增** | `backend/routes/tea-fruit-stats.js` | 核心统计 API 路由 |
| **修改** | `backend/server.js` | 引入新路由 + coaches 表 device_fingerprint 字段初始化 |
| **修改** | `backend/middleware/permission.js` | 新增 teaFruitStats / teaFruit 权限 |

---

## 四、前端设计

### 4.1 新增页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 助教端 - 奶茶果盘 | `pages/internal/tea-fruit-stats.vue` | 助教个人任务统计 |
| 管理端 - 奶茶果盘统计 | `pages/internal/tea-fruit-admin-stats.vue` | 管理员查看所有助教任务进度 |
| 管理端 - 奶茶果盘明细 | `pages/internal/tea-fruit-detail.vue` | 管理员查看单个助教明细（可复用助教页面样式） |

### 4.2 页面注册

**文件**：`pages.json` 新增 3 个页面配置：

```json
{
  "path": "pages/internal/tea-fruit-stats",
  "style": {
    "navigationBarTitleText": "奶茶果盘",
    "navigationBarBackgroundColor": "#0a0a0f",
    "navigationBarTextStyle": "white",
    "navigationStyle": "custom"
  }
},
{
  "path": "pages/internal/tea-fruit-admin-stats",
  "style": {
    "navigationBarTitleText": "奶茶果盘统计",
    "navigationBarBackgroundColor": "#0a0a0f",
    "navigationBarTextStyle": "white",
    "navigationStyle": "custom"
  }
},
{
  "path": "pages/internal/tea-fruit-detail",
  "style": {
    "navigationBarTitleText": "奶茶果盘明细",
    "navigationBarBackgroundColor": "#0a0a0f",
    "navigationBarTextStyle": "white",
    "navigationStyle": "custom"
  }
}
```

### 4.3 入口修改

#### 助教端入口（member.vue - 助教专用板块）
在 "日常" 分组中新增入口：
```vue
<view class="internal-btn" @click="navigateTo('/pages/internal/tea-fruit-stats')">
  <text class="internal-btn-icon">🧋</text>
  <text class="internal-btn-text">奶茶果盘</text>
</view>
```

#### 管理端入口（member.vue - 管理功能板块）
在 "审查" 分组中新增入口：
```vue
<view class="internal-btn" @click="navigateTo('/pages/internal/tea-fruit-admin-stats')">
  <text class="internal-btn-icon">🧋</text>
  <text class="internal-btn-text">奶茶果盘</text>
</view>
```

### 4.4 助教端页面设计（tea-fruit-stats.vue）

参考现有 `guest-invitation-stats.vue` 的结构：

```
┌──────────────────────────────┐
│  ←  奶茶果盘任务            │ ← 固定标题栏
├──────────────────────────────┤
│  [本月]  [上月]              │ ← 周期切换
├──────────────────────────────┤
│  📊 统计周期: 2026-05-01~03  │
│                              │
│  ┌──────────┐ ┌──────────┐  │
│  │  🧋 奶茶 │ │  🍉 果盘 │  │
│  │  18/30   │ │  3/5     │  │
│  │  █████░░ │ │  ██████░ │  │
│  │  60%     │ │  60%     │  │
│  └──────────┘ └──────────┘  │
├──────────────────────────────┤
│  📋 奶茶订单明细             │
│  ┌──────────────────────┐   │
│  │ TG20260501... 珍珠奶茶x2│
│  │ 2026-05-01 14:30     │   │
│  ├──────────────────────┤   │
│  │ TG20260502... 奶茶x1  │
│  │ 2026-05-02 16:00     │   │
│  └──────────────────────┘   │
├──────────────────────────────┤
│  📋 果盘订单明细             │
│  ┌──────────────────────┐   │
│  │ TG20260501... 豪华果盘x1│
│  │ 2026-05-01 18:00     │   │
│  ├──────────────────────┤   │
│  │ TG20260502... 西瓜x5  │
│  │ 2026-05-02 20:00 (≈1.67)│
│  └──────────────────────┘   │
└──────────────────────────────┘
```

#### 进度条颜色规则
- 完成率 ≥ 100%：绿色 `#4CAF50`
- 完成率 < 100%：橙色 `#FF9800`
- 完成率 < 50%：红色 `#F44336`

### 4.5 管理端页面设计（tea-fruit-admin-stats.vue）

```
┌──────────────────────────────┐
│  ←  奶茶果盘统计            │
├──────────────────────────────┤
│  [本月]  [上月]              │
├──────────────────────────────┤
│  📋 助教任务进度             │
│                              │
│  ┌──────────────────────┐   │
│  │ A001 小美             │   │
│  │ 🧋 奶茶: 18/30 🔴    │   │
│  │ 🍉 果盘: 3/5  🔴     │   │
│  │ [查看明细 →]          │   │
│  ├──────────────────────┤   │
│  │ A002 小红             │   │
│  │ 🧋 奶茶: 35/30 🟢    │   │
│  │ 🍉 果盘: 6/5  🟢     │   │
│  │ [查看明细 →]          │   │
│  └──────────────────────┘   │
│                              │
│  汇总：完成 X/Y 人          │
└──────────────────────────────┘
```

#### 状态颜色规则
- 奶茶 ≥ 30 且 果盘 ≥ 5：绿色 ✅ 已完成
- 任一未达标：红色 ❌ 未完成
- 两个都未达标：深红色

### 4.6 前端修改文件清单

| 操作 | 文件路径 | 说明 |
|------|----------|------|
| **新增** | `src/pages/internal/tea-fruit-stats.vue` | 助教端页面 |
| **新增** | `src/pages/internal/tea-fruit-admin-stats.vue` | 管理端列表页面 |
| **新增** | `src/pages/internal/tea-fruit-detail.vue` | 管理端明细页面 |
| **修改** | `src/pages.json` | 注册 3 个新页面 |
| **修改** | `src/pages/member/member.vue` | 助教/管理板块添加入口 |

---

## 五、前后端交互流程

### 5.1 助教端流程
```
1. 助教登录 H5
2. 进入"我的" → 助教专用 → 点击"奶茶果盘"
3. 前端调用 GET /api/tea-fruit/my-stats?period=this-month
4. 后端通过 req.user.coachNo 查询该助教数据
5. 返回统计结果 + 订单明细
6. 前端渲染进度条和明细列表
7. 切换"上月"时重新请求 period=last-month
```

### 5.2 管理端流程
```
1. 管理员登录 H5
2. 进入"我的" → 管理功能 → 审查 → 点击"奶茶果盘"
3. 前端调用 GET /api/tea-fruit/admin-stats?period=this-month
4. 后端查询所有助教（status != '离职'）的统计
5. 返回列表，按 employee_id 排序
6. 点击"查看明细" → 跳转 /pages/internal/tea-fruit-detail?coach_no=XXX&period=XXX&type=tea
7. 前端调用 GET /api/tea-fruit/coach-detail 获取明细
```

### 5.3 数据修复流程
```
1. 管理员进入管理端统计页面
2. 页面检测早期订单数据是否已修复（通过 API 检测）
3. 如未修复，显示"修复数据"按钮
4. 点击后调用 POST /api/tea-fruit/repair-data
5. 后端遍历订单，建立 device_fingerprint → coaches 关联
6. 返回修复结果，前端刷新统计
```

---

## 六、边界情况和异常处理

### 6.1 边界情况

| 场景 | 处理方式 |
|------|----------|
| 新助教当月入职 | 按实际天数计算，任务目标不变（30杯/5个），但页面提示"本月入职 X 天" |
| 助教离职 | 管理端统计中排除 status = '离职' 的助教 |
| 订单已取消 | 统计时只计 status = '已完成' 的订单 |
| 同一订单含多商品 | 每个商品分别统计（如同时点了奶茶和果盘） |
| 单份水果正好3份 | 3/3 = 1 个果盘（向下取整） |
| 单份水果2份 | 2/3 = 0.67，不计入完整果盘数 |
| 商品分类变更 | 按订单创建时的商品快照计算（查询 orders.items JSON 中的 name） |
| 商品名为"果盘"但实际不是果盘 | 依赖商品名 LIKE '%果盘%' 的匹配，需确保商品命名规范 |
| 助教换了手机/设备 | 通过 phone 匹配，device_fingerprint 作为补充 |
| 早期订单无 device_fingerprint | 通过 member_phone → coaches.phone 匹配 |
| 跨月订单 | 按 created_at 归属月份统计 |
| 多个助教共用一个设备 | 通过 member_phone 区分（需助教登录后下单） |

### 6.2 异常处理

| 异常 | 处理 |
|------|------|
| API 请求失败 | 显示"加载失败，请重试" toast |
| 无订单数据 | 显示空状态："本月暂无订单记录" |
| 权限不足 | 后端返回 403，前端提示"权限不足" |
| 商品分类不存在 | 奶茶统计返回 0，提示"奶茶店分类下无商品" |
| JSON 解析失败（items 损坏） | try-catch 跳过该订单，记录日志 |

---

## 七、编码规范遵守清单

### 7.1 时间处理
- ✅ 后端统一使用 `const TimeUtil = require('./utils/time'); TimeUtil.nowDB()` / `TimeUtil.todayStr()` / `TimeUtil.offsetDateStr()`
- ✅ 前端统一使用 `import { getBeijingDate, format } from '@/utils/time-util.js'`
- ❌ 禁止 `datetime('now')`、`new Date().getTime() + 8*60*60*1000`

### 7.2 数据库连接
- ✅ 统一使用 `const { db, dbRun, dbAll, dbGet, enqueueRun, runInTransaction } = require('./db/index')`
- ❌ 禁止 `new sqlite3.Database()`
- ❌ 禁止 `sqlite3` CLI 操作本地 .db 文件

### 7.3 数据库写入
- ✅ `await enqueueRun('INSERT/UPDATE/DELETE ...', [...])`
- ✅ `await runInTransaction(async (tx) => { await tx.run(...); })`
- ❌ 禁止 `db.run('BEGIN TRANSACTION')`、裸开事务

### 7.4 页面显示
- ✅ 页面显示助教工号：`{{ employee_id }}` 或 `${employee_id}`
- ❌ 禁止在页面显示 `coach_no`（如 `{{ coach_no }}`、`${c.coach_no}`）
- ❌ 禁止 `employee_id || coach_no` 回退逻辑
- ✅ `coach_no` 仅限内部用途：API 参数、`:key` 绑定、`data-*` 属性、JS 内部逻辑

---

## 八、测试要点

| 测试项 | 验证内容 |
|--------|----------|
| 奶茶分类匹配 | category='奶茶店' 的商品订单正确计入 |
| 果盘名称匹配 | name LIKE '%果盘%' 的商品正确计入 |
| 单份水果折算 | 3份单份水果=1果盘，2份=0.67（不计入完整数） |
| 当月统计 | 本月1号至今日的订单正确计入 |
| 上月统计 | 上月1号至末日的订单正确计入 |
| 已完成订单 | 已取消订单不计入 |
| 助教权限 | 助教只能看自己的数据 |
| 管理员权限 | 管理员/店长/助教管理可看所有助教 |
| 数据修复 | device_fingerprint → members → coaches 关联正确 |
| 进度条颜色 | ≥100% 绿色，50-99% 橙色，<50% 红色 |
| 页面显示 | 显示 employee_id，不显示 coach_no |
| 离职助教 | 管理端统计中排除离职助教 |
| 空数据 | 无订单时显示空状态 |

---

## 九、实施步骤建议

1. **数据库变更**：后端添加 coaches.device_fingerprint 字段 + 索引
2. **后端 API**：创建 tea-fruit-stats.js 路由，实现 4 个 API
3. **权限配置**：更新 permission.js
4. **前端页面**：创建 3 个 Vue 页面组件
5. **页面注册**：更新 pages.json
6. **入口添加**：修改 member.vue 添加入口
7. **测试验证**：测试环境验证所有验收重点
8. **数据修复**：执行数据修复脚本修复早期数据

---

## 十、风险点

| 风险 | 影响 | 缓解 |
|------|------|------|
| JSON 查询性能 | orders 表大量使用 json_each 可能较慢 | 添加适当索引，数据量大时可考虑物化 |
| 商品分类不一致 | 奶茶商品未正确归类到"奶茶店" | 建议运营检查商品分类 |
| 水果类商品定义模糊 | 哪些是"单份水果"需明确 | 建议在后台配置水果分类或使用独立 category |
| 早期数据关联率 | 部分订单可能无法关联到助教 | 数据修复后统计成功率，人工补充 |

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