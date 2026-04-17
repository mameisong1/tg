你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
```
# 下桌单缺失统计功能 — 设计方案

> QA编号：QA-20260417-08 | 设计：程序员A | 日期：2026-04-17

---

## 1. 需求理解

### 1.1 业务逻辑

助教每次**上桌**应产生一张 `上桌单`（`order_type = '上桌单'`），完成后应产生一张对应的**下桌单**（`order_type = '下桌单'`）。

**对应关系判定条件**（三字段一致）：
- `coach_no`（助教工号）
- `table_no`（桌号）
- `stage_name`（艺名）

**缺失判定**：
- 下桌单的 `created_at` 必须在 上桌单 `created_at` 之后 **15 小时内**
- 若找不到对应的下桌单 → 属于**下桌单缺失**

### 1.2 功能要求

| 维度 | 要求 |
|------|------|
| 入口 | H5 会员中心 → 管理功能（`isManager = true`） |
| 权限 | 店长、助教管理、管理员 |
| 周期选项 | 昨天 / 前天 / 本月 / 上月 |
| 统计展示 | 工号、艺名、缺失数量，按数量**倒序** |
| 明细弹框 | 上桌日期、上桌时间、桌号、下桌单（无） |
| 性能 | 查询必须有索引支持 |

---

## 2. 技术选型与依据

### 2.1 数据来源

**表：`table_action_orders`**（依据：`db/index.js` schema + `routes/table-action-orders.js`）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| order_time | DATETIME | 下单时间 |
| table_no | TEXT | 台桌号 |
| coach_no | TEXT | 助教编号 |
| order_type | TEXT | '上桌单' / '下桌单' / '取消单' |
| action_category | TEXT | 上桌类别（普通课/标签课） |
| stage_name | TEXT | 助教艺名 |
| status | TEXT | '待处理' / '已完成' / '已取消' |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

**表：`coaches`**（依据：`db/index.js` schema）

| 字段 | 类型 | 说明 |
|------|------|------|
| coach_no | INTEGER PK | 助教系统编号 |
| employee_id | TEXT | 助教工号（页面显示用） |
| stage_name | TEXT | 艺名 |
| status | TEXT | 状态（全职/离职等） |

### 2.2 现有索引（依据：`db/index.js` schema）

```sql
-- table_action_orders 已有
CREATE INDEX idx_table_action_orders_type ON table_action_orders(order_type);
CREATE INDEX idx_table_action_orders_coach_no ON table_action_orders(coach_no);
CREATE INDEX idx_table_action_orders_created_at ON table_action_orders(created_at);
```

### 2.3 权限矩阵

依据 `middleware/permission.js`，新增权限字段 `missingTableOutStats`：

| 角色 | missingTableOutStats |
|------|---------------------|
| 管理员 | `true` |
| 店长 | `true` |
| 助教管理 | `true` |
| 其他角色 | `false`（继承现有逻辑） |

---

## 3. 新增 / 修改文件清单

### 3.1 后端文件

| 操作 | 文件 | 说明 |
|------|------|------|
| **新增** | `backend/routes/missing-table-out-orders.js` | 新 API 路由 |
| **修改** | `backend/server.js` | 注册新路由 +4 行 |
| **修改** | `backend/middleware/permission.js` | 新增权限字段 +5 行 |

### 3.2 前端文件

| 操作 | 文件 | 说明 |
|------|------|------|
| **新增** | `tgservice-uniapp/src/pages/internal/missing-table-out-stats.vue` | 统计页面 |
| **修改** | `tgservice-uniapp/src/pages.json` | 注册新页面路由 |
| **修改** | `tgservice-uniapp/src/pages/member/member.vue` | 添加入口按钮 |
| **修改** | `tgservice-uniapp/src/utils/api-v2.js` | 新增 API 封装 |

---

## 4. 数据库设计

### 4.1 新增索引

**核心查询**需要复合索引来覆盖 LEFT JOIN 和日期范围过滤：

```sql
-- 用于下桌单匹配查找：按教练+桌号+艺名+创建时间定位
CREATE INDEX IF NOT EXISTS idx_tao_out_match 
  ON table_action_orders(order_type, coach_no, table_no, stage_name, created_at);
```

**索引说明**：
- `order_type` 在前：先过滤出 '下桌单'，大幅减少扫描范围
- `coach_no, table_no, stage_name`：对应匹配条件，支持 JOIN 查找
- `created_at`：支持时间范围比较（`> T AND <= T + 15h`）

**已有索引利用**：
- `idx_table_action_orders_type`：统计汇总时按 order_type 过滤
- `idx_table_action_orders_created_at`：日期范围过滤
- `idx_table_action_orders_coach_no`：按教练分组

### 4.2 无表结构变更

不需要新增字段或新表，完全基于现有表结构实现。

---

## 5. API 设计

### 5.1 统计列表

```
GET /api/missing-table-out-orders/stats?period=yesterday
```

**权限**：`requireBackendPermission(['missingTableOutStats'])`

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| period | string | 是 | 周期：`yesterday` / `beforeYesterday` / `thisMonth` / `lastMonth` |

**响应**：

```json
{
  "success": true,
  "data": {
    "period": "yesterday",
    "date_start": "2026-04-16",
    "date_end": "2026-04-16",
    "list": [
      {
        "coach_no": 5,
        "employee_id": "A005",
        "stage_name": "小美",
        "missing_count": 3
      }
    ],
    "total_coaches": 2,
    "total_missing": 5
  }
}
```

### 5.2 明细查询

```
GET /api/missing-table-out-orders/detail?period=yesterday&coach_no=5
```

**权限**：`requireBackendPermission(['missingTableOutStats'])`

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| period | string | 是 | 周期（同统计接口） |
| coach_no | number | 是 | 助教编号 |

**响应**：

```json
{
  "success": true,
  "data": {
    "coach_no": 5,
    "employee_id": "A005",
    "stage_name": "小美",
    "details": [
      {
        "id": 102,
        "table_no": "A3",
        "table_date": "2026-04-16",
        "table_time": "14:30",
        "action_category": "普通课",
        "created_at": "2026-04-16 14:30:00"
      }
    ]
  }
}
```

---

## 6. 核心查询逻辑

### 6.1 缺失判定 SQL

```sql
SELECT 
  t_in.coach_no,
  c.employee_id,
  t_in.stage_name,
  t_in.id,
  t_in.table_no,
  t_in.action_category,
  DATE(t_in.created_at) AS table_date,
  TIME(t_in.created_at) AS table_time,
  t_in.created_at
FROM table_action_orders t_in
LEFT JOIN coaches c ON t_in.coach_no = c.coach_no
WHERE t_in.order_type = '上桌单'
  AND DATE(t_in.created_at) >= :date_start
  AND DATE(t_in.created_at) <= :date_end
  AND NOT EXISTS (
    SELECT 1 FROM table_action_orders t_out
    WHERE t_out.order_type = '下桌单'
      AND t_out.coach_no = t_in.coach_no
      AND t_out.table_no = t_in.table_no
      AND t_out.stage_name = t_in.stage_name
      AND t_out.created_at > t_in.created_at
      AND t_out.created_at <= datetime(t_in.created_at, '+15 hours')
  )
```

**逻辑说明**：
1. 筛选指定周期内的所有 **上桌单**
2. 对每张上桌单，查找是否存在对应的 **下桌单**（三字段匹配 + 15小时内）
3. `NOT EXISTS` 保证只返回**缺失下桌单**的上桌记录
4. 按教练分组 `COUNT(*)` 得到缺失数量

### 6.2 统计聚合 SQL

```sql
SELECT 
  t_in.coach_no,
  c.employee_id,
  t_in.stage_name,
  COUNT(*) AS missing_count
FROM table_action_orders t_in
LEFT JOIN coaches c ON t_in.coach_no = c.coach_no
WHERE t_in.order_type = '上桌单'
  AND DATE(t_in.created_at) >= :date_start
  AND DATE(t_in.created_at) <= :date_end
  AND NOT EXISTS (
    SELECT 1 FROM table_action_orders t_out
    WHERE t_out.order_type = '下桌单'
      AND t_out.coach_no = t_in.coach_no
      AND t_out.table_no = t_in.table_no
      AND t_out.stage_name = t_in.stage_name
      AND t_out.created_at > t_in.created_at
      AND t_out.created_at <= datetime(t_in.created_at, '+15 hours')
  )
GROUP BY t_in.coach_no
ORDER BY missing_count DESC
```

### 6.3 周期计算（后端使用 TimeUtil）

依据 `backend/utils/time.js`：

```javascript
const TimeUtil = require('../utils/time');

function getDateRange(period) {
  const now = new Date(); // 服务器已设为 Asia/Shanghai
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const d = now.getDate();

  switch (period) {
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(d - 1);
      return {
        date_start: formatDate(yesterday),
        date_end: formatDate(yesterday)
      };
    }
    case 'beforeYesterday': {
      const before = new Date(now);
      before.setDate(d - 2);
      return {
        date_start: formatDate(before),
        date_end: formatDate(before)
      };
    }
    case 'thisMonth': {
      const firstDay = new Date(y, m, 1);
      return {
        date_start: formatDate(firstDay),
        date_end: formatDate(now)
      };
    }
    case 'lastMonth': {
      const firstDay = new Date(y, m - 1, 1);
      const lastDay = new Date(y, m, 0);
      return {
        date_start: formatDate(firstDay),
        date_end: formatDate(lastDay)
      };
    }
  }
}

function formatDate(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
```

> **注意**：时间计算在 Node.js 层完成，SQL 中不使用 `datetime('now')`。

---

## 7. 后端路由实现

### 7.1 `backend/routes/missing-table-out-orders.js`

```javascript
/**
 * 下桌单缺失统计 API
 * 路径：/api/missing-table-out-orders
 */
const express = require('express');
const router = express.Router();
const { all, get } = require('../db');
const { requireBackendPermission } = require('../middleware/permission');
const auth = require('../middleware/auth');

// ========== 周期计算 ==========
const VALID_PERIODS = ['yesterday', 'beforeYesterday', 'thisMonth', 'lastMonth'];
const PERIOD_LABELS = {
  yesterday: '昨天',
  beforeYesterday: '前天',
  thisMonth: '本月',
  lastMonth: '上月'
};

function getDateRange(period) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  let startDate, endDate;
  switch (period) {
    case 'yesterday': {
      const dt = new Date(now); dt.setDate(d - 1);
      startDate = endDate = formatDate(dt); break;
    }
    case 'beforeYesterday': {
      const dt = new Date(now); dt.setDate(d - 2);
      startDate = endDate = formatDate(dt); break;
    }
    case 'thisMonth': {
      startDate = formatDate(new Date(y, m, 1));
      endDate = formatDate(now); break;
    }
    case 'lastMonth': {
      startDate = formatDate(new Date(y, m - 1, 1));
      endDate = formatDate(new Date(y, m, 0)); break;
    }
  }
  return { date_start: startDate, date_end: endDate };
}

function formatDate(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// ========== 核心 SQL ==========
const MISSING_BASE_SQL = `
  SELECT 
    t_in.coach_no,
    c.employee_id,
    t_in.stage_name,
    t_in.id,
    t_in.table_no,
    t_in.action_category,
    DATE(t_in.created_at) AS table_date,
    TIME(t_in.created_at) AS table_time,
    t_in.created_at
  FROM table_action_orders t_in
  LEFT JOIN coaches c ON t_in.coach_no = c.coach_no
  WHERE t_in.order_type = '上桌单'
    AND DATE(t_in.created_at) >= ?
    AND DATE(t_in.created_at) <= ?
    AND NOT EXISTS (
      SELECT 1 FROM table_action_orders t_out
      WHERE t_out.order_type = '下桌单'
        AND t_out.coach_no = t_in.coach_no
        AND t_out.table_no = t_in.table_no
        AND t_out.stage_name = t_in.stage_name
        AND t_out.created_at > t_in.created_at
        AND t_out.created_at <= datetime(t_in.created_at, '+15 hours')
    )
`;

// ========== GET /api/missing-table-out-orders/stats ==========
router.get('/stats', auth.required, requireBackendPermission(['missingTableOutStats']), async (req, res) => {
  try {
    const { period } = req.query;
    if (!period || !VALID_PERIODS.includes(period)) {
      return res.status(400).json({
        success: false,
        error: `无效周期参数，应为: ${VALID_PERIODS.join(', ')}`
      });
    }

    const { date_start, date_end } = getDateRange(period);

    const rows = await all(MISSING_BASE_SQL, [date_start, date_end]);

    // 按教练聚合
    const coachMap = {};
    for (const row of rows) {
      const key = row.coach_no;
      if (!coachMap[key]) {
        coachMap[key] = {
          coach_no: row.coach_no,
          employee_id: row.employee_id || '-',
          stage_name: row.stage_name || '未知',
          missing_count: 0
        };
      }
      coachMap[key].missing_count++;
    }

    const list = Object.values(coachMap)
      .sort((a, b) => b.missing_count - a.missing_count);

    const totalMissing = list.reduce((sum, c) => sum + c.missing_count, 0);

    res.json({
      success: true,
      data: {
        period,
        period_label: PERIOD_LABELS[period],
        date_start,
        date_end,
        list,
        total_coaches: list.length,
        total_missing: totalMissing
      }
    });
  } catch (error) {
    console.error('下桌单缺失统计失败:', error);
    res.status(500).json({ success: false, error: '获取下桌单缺失统计失败' });
  }
});

// ========== GET /api/missing-table-out-orders/detail ==========
router.get('/detail', auth.required, requireBackendPermission(['missingTableOutStats']), async (req, res) => {
  try {
    const { period, coach_no } = req.query;

    if (!period || !VALID_PERIODS.includes(period)) {
      return res.status(400).json({
        success: false,
        error: `无效周期参数，应为: ${VALID_PERIODS.join(', ')}`
      });
    }
    if (!coach_no) {
      return res.status(400).json({
        success: false,
        error: '缺少 coach_no 参数'
      });
    }

    const { date_start, date_end } = getDateRange(period);

    const rows = await all(MISSING_BASE_SQL + ' AND t_in.coach_no = ?', 
      [date_start, date_end, coach_no]);

    // 获取教练基本信息
    const coach = await get(
      'SELECT coach_no, employee_id, stage_name FROM coaches WHERE coach_no = ?',
      [coach_no]
    );

    const details = rows.map(row => ({
      id: row.id,
      table_no: row.table_no,
      table_date: row.table_date,
      table_time: row.table_time,
      action_category: row.action_category || '-',
      created_at: row.created_at
    }));

    res.json({
      success: true,
      data: {
        coach_no: parseInt(coach_no),
        employee_id: coach?.employee_id || '-',
        stage_name: coach?.stage_name || '未知',
        details
      }
    });
  } catch (error) {
    console.error('获取下桌单缺失明细失败:', error);
    res.status(500).json({ success: false, error: '获取明细失败' });
  }
});

module.exports = router;
```

### 7.2 `backend/server.js` 修改

在路由注册区域（约第 342 行附近）添加：

```javascript
const missingTableOutOrdersRouter = require('./routes/missing-table-out-orders');
// ...
app.use('/api/missing-table-out-orders', missingTableOutOrdersRouter);
```

### 7.3 `backend/middleware/permission.js` 修改

在 `PERMISSION_MATRIX` 中为三个管理角色添加 `missingTableOutStats: true`：

```javascript
'管理员': {
  // ... 现有字段
  missingTableOutStats: true
},
'店长': {
  // ... 现有字段
  missingTableOutStats: true
},
'助教管理': {
  // ... 现有字段
  missingTableOutStats: true
},
```

---

## 8. 前端页面设计

### 8.1 页面结构

```
pages/internal/missing-table-out-stats.vue
```

**UI 布局**：
```
┌─────────────────────────────────┐
│  ←  下桌单缺失统计              │  ← 自定义导航栏
├─────────────────────────────────┤
│  周期选择：[ 昨天 ▼ ]  [ 刷新 ↻] │
├─────────────────────────────────┤
│  统计卡片：缺失 X 人 / 共 X 单    │
├─────────────────────────────────┤
│  列表（按缺失数量倒序）：         │
│  ┌───────────────────────────┐  │
│  │ A005  小美        3 单 ❯  │  │
│  ├───────────────────────────┤  │
│  │ A012  小雪        2 单 ❯  │  │
│  ├───────────────────────────┤  │
│  │ A003  小丽        1 单 ❯  │  │
│  └───────────────────────────┘  │
├─────────────────────────────────┤
│  [弹框] 小美 (A005) 缺失明细      │
│  ┌───────────────────────────┐  │
│  │ 04-16  14:30  A3  无 ❌   │  │
│  │ 04-16  16:00  A1  无 ❌   │  │
│  │ 04-16  20:15  B2  无 ❌   │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### 8.2 页面代码结构

```vue
<template>
  <view class="page">
    <!-- 固定头部 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">下桌单缺失统计</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 周期选择 + 刷新 -->
    <view class="toolbar">
      <picker :range="periodOptions" @change="onPeriodChange">
        <view class="period-picker">
          <text class="period-text">{{ currentPeriodLabel }}</text>
          <text class="period-arrow">▼</text>
        </view>
      </picker>
      <view class="refresh-btn" @click="loadStats">
        <text class="refresh-icon">↻</text>
      </view>
    </view>

    <!-- 统计卡片 -->
    <view class="stats-card" v-if="statsData">
      <view class="stat-item">
        <text class="stat-value">{{ statsData.total_coaches }}</text>
        <text class="stat-label">缺失助教</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value">{{ statsData.total_missing }}</text>
        <text class="stat-label">缺失总单数</text>
      </view>
    </view>

    <!-- 助教列表 -->
    <view class="list-section" v-if="coachList.length > 0">
      <view class="coach-item" v-for="coach in coachList" :key="coach.coach_no" 
            @click="showDetail(coach)">
        <view class="coach-info">
          <text class="coach-empid">{{ coach.employee_id }}</text>
          <text class="coach-name">{{ coach.stage_name }}</text>
        </view>
        <view class="coach-count">
          <text class="count-num">{{ coach.missing_count }}</text>
          <text class="count-unit">单</text>
          <text class="arrow">❯</text>
        </view>
      </view>
    </view>
    <view class="empty" v-else-if="!loading">
      <text class="empty-icon">✅</text>
      <text class="empty-text">该周期无下桌单缺失</text>
    </view>

    <!-- 明细弹框 -->
    <view class="modal-overlay" v-if="showModal" @click="closeModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">
            {{ detailData.stage_name }} ({{ detailData.employee_id }}) 缺失明细
          </text>
          <view class="modal-close" @click="closeModal"><text>✕</text></view>
        </view>
        <view class="modal-body" v-if="detailData.details.length > 0">
          <view class="detail-item" v-for="item in detailData.details" :key="item.id">
            <view class="detail-row">
              <text class="detail-date">{{ item.table_date }}</text>
              <text class="detail-time">{{ item.table_time }}</text>
              <text class="detail-table">{{ item.table_no }}</text>
            </view>
            <view class="detail-status">
              <text class="status-label">下桌单：</text>
              <text class="status-none">无 ❌</text>
            </view>
          </view>
        </view>
        <view class="modal-empty" v-else>
          <text>暂无明细数据</text>
        </view>
      </view>
    </view>

    <view class="loading" v-if="loading && !statsData">
      <text>加载中...</text>
    </view>
  </view>
</template>
```

### 8.3 页面脚本

```javascript
<script setup>
import { ref, computed, onMounted } from 'vue'
import { missingTableOutOrders } from '@/utils/api-v2.js'

const statusBarHeight = ref(0)
const loading = ref(false)
const statsData = ref(null)
const coachList = ref([])

const showModal = ref(false)
const detailData = ref({ details: [] })

const periodOptions = ref(['昨天', '前天', '本月', '上月'])
const periodValues = ['yesterday', 'beforeYesterday', 'thisMonth', 'lastMonth']
const currentPeriodIndex = ref(0)

const currentPeriodLabel = computed(() => periodOptions.value[currentPeriodIndex.value])
const currentPeriodValue = computed(() => periodValues[currentPeriodIndex.value])

const goBack = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/member/member' })
}

const onPeriodChange = (e) => {
  currentPeriodIndex.value = e.detail.value
  loadStats()
}

const loadStats = async () => {
  loading.value = true
  try {
    const res = await missingTableOutOrders.getStats({ period: currentPeriodValue.value })
    if (res.success) {
      statsData.value = res.data
      coachList.value = res.data.list || []
    }
  } catch (err) {
    uni.showToast({ title: err.error || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const showDetail = async (coach) => {
  try {
    const res = await missingTableOutOrders.getDetail({
      period: currentPeriodValue.value,
      coach_no: coach.coach_no
    })
    if (res.success) {
      detailData.value = res.data
      showModal.value = true
    }
  } catch (err) {
    uni.showToast({ title: err.error || '加载明细失败', icon: 'none' })
  }
}

const closeModal = () => {
  showModal.value = false
  detailData.value = { details: [] }
}

onMounted(() => {
  const sys = uni.getSystemInfoSync()
  statusBarHeight.value = sys.statusBarHeight || 20
  loadStats()
})
</script>
```

### 8.4 `api-v2.js` 新增封装

在 `api-v2.js` 末尾 `export default` 前添加：

```javascript
// ========== 下桌单缺失统计 ==========
export const missingTableOutOrders = {
  // 获取统计列表
  getStats: (params) => request({ url: '/missing-table-out-orders/stats', data: params }),
  // 获取明细
  getDetail: (params) => request({ url: '/missing-table-out-orders/detail', data: params })
}
```

并在 default export 中添加：

```javascript
export default {
  // ... 现有导出
  missingTableOutOrders
}
```

### 8.5 `pages.json` 新增路由

在 `pages` 数组中添加（建议在 `lejuan-list` 之后）：

```json
{
  "path": "pages/internal/missing-table-out-stats",
  "style": {
    "navigationBarTitleText": "下桌单缺失统计",
    "navigationBarBackgroundColor": "#0a0a0f",
    "navigationBarTextStyle": "white",
    "navigationStyle": "custom"
  }
}
```

### 8.6 `member.vue` 入口修改

在**管理功能**板块（`isManager` 条件块）中添加入口按钮：

```vue
<!-- 在现有的管理功能按钮中追加 -->
<view class="internal-btn" @click="navigateTo('/pages/internal/missing-table-out-stats')">
  <text class="internal-btn-icon">📊</text>
  <text class="internal-btn-text">下桌单缺失</text>
</view>
```

**注意**：当前 4×4 网格已有 8 个按钮，添加第 9 个按钮后会自动换行显示（CSS `grid-template-columns: repeat(4, 1fr)` 支持自动换行）。

---

## 9. 前后端交互流程

```
用户操作                     前端页面                        后端 API
─────────                    ────────                        ────────
1. 点击「下桌单缺失」     member.vue → 导航
   入口按钮                    ↓
2. 选择周期「昨天」         发起请求                    GET /api/missing-table-out-orders/stats
                               ↓                        ?period=yesterday
3. 显示统计列表             渲染 coachList
                               ↓
4. 点击某助教条目          发起请求                    GET /api/missing-table-out-orders/detail
                               ↓                        ?period=yesterday&coach_no=5
5. 弹框显示明细             渲染 detailData
```

---

## 10. 边界情况处理

### 10.1 周期边界

| 场景 | 处理 |
|------|------|
| 上月跨年（1月查去年12月） | `new Date(y, m-1, 1)` 自动处理 |
| 今天凌晨查昨天 | 日期计算基于 `now`，不受凌晨影响 |
| 跨月周期（本月） | `date_start` = 本月1日，`date_end` = 今天 |

### 10.2 数据边界

| 场景 | 处理 |
|------|------|
| 助教已离职 | 仍统计（历史数据有效），但 `employee_id` 可能为 null → 显示 `-` |
| 多桌上桌（同一助教同时在多桌） | `table_no` 为逗号分隔字符串，按完整字符串匹配 |
| 上桌单/下桌单状态为「已取消」 | **不**排除，因为取消单是另一种 order_type |
| 同一助教同一桌号多次上桌 | 每次上桌单独立检查是否有对应的下桌单 |
| 下桌单在上桌单之前（数据异常） | `t_out.created_at > t_in.created_at` 自动排除 |
| 无缺失数据 | 显示「该周期无下桌单缺失」✅ 提示 |

### 10.3 权限边界

| 场景 | 处理 |
|------|------|
| 助教登录访问 | 403（权限矩阵中无此权限） |
| 前厅管理/收银访问 | 403（权限矩阵中无此权限） |
| token 过期 | 401 → 前端提示「请先登录」 |
| 无 adminToken 也无 coachToken | 请求无 Authorization header → 401 |

### 10.4 性能边界

| 场景 | 预期 |
|------|------|
| 单日数据量（~500 上桌单） | LEFT JOIN + 索引 → < 100ms |
| 整月数据量（~15000 上桌单） | 有 `idx_tao_out_match` 索引 → < 1s |
| 无索引（回退全表扫描） | ~3s（不推荐，必须建索引） |

---

## 11. 验收检查清单

### 11.1 数据库查询性能 ✅

- [ ] 新增 `idx_tao_out_match` 复合索引
- [ ] 使用 `EXPLAIN QUERY PLAN` 验证索引命中
- [ ] 月度数据查询 < 1s

### 11.2 15 小时判定逻辑 ✅

- [ ] SQL 使用 `datetime(t_in.created_at, '+15 hours')` 精确计算
- [ ] 下桌单必须 `> t_in.created_at`（严格大于，不能同时刻）
- [ ] 下桌单必须 `<= t_in.created_at + 15h`（包含边界）

### 11.3 周期筛选 ✅

- [ ] 昨天：`date_start = date_end = 昨天`
- [ ] 前天：`date_start = date_end = 前天`
- [ ] 本月：`date_start = 1号`, `date_end = 今天`
- [ ] 上月：`date_start = 上月1号`, `date_end = 上月最后一天`

### 11.4 弹框明细展示 ✅

- [ ] 点击助教条目弹出模态框
- [ ] 显示：上桌日期、上桌时间、桌号
- [ ] 下桌单列显示「无 ❌」
- [ ] 点击遮罩层或 ✕ 按钮关闭

### 11.5 权限控制 ✅

- [ ] 新增 `missingTableOutStats` 权限字段
- [ ] 仅 管理员 / 店长 / 助教管理 可访问
- [ ] 其他角色返回 403

### 11.6 编码规范 ✅

- [ ] 时间计算在 Node.js 层完成，SQL 不使用 `datetime('now')`
- [ ] 数据库查询复用 `db/index.js` 的 `all` / `get` 方法
- [ ] 无数据库写入操作（纯查询），不涉及 writeQueue
- [ ] 页面显示使用 `employee_id`，不显示 `coach_no`

---

## 12. 测试用例建议（供程序员B参考）

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| TC01 | 周期=昨天，有1张上桌单无下桌单 | 缺失计数=1 |
| TC02 | 周期=昨天，上桌单14:00，下桌单次日04:00（14h后） | 不缺失 |
| TC03 | 周期=昨天，上桌单14:00，下桌单次日06:00（16h后） | 缺失 |
| TC04 | 周期=昨天，上桌单和下桌单 coach_no/table_no/stage_name 都一致 | 不缺失 |
| TC05 | 周期=昨天，coach_no 相同但 table_no 不同 | 缺失 |
| TC06 | 权限=前厅管理访问 API | 返回 403 |
| TC07 | 周期=非法值 | 返回 400 |
| TC08 | 无缺失数据周期 | 显示「该周期无下桌单缺失」 |
| TC09 | 月度查询大数据量 | 响应时间 < 1s |

```

## 审计检查清单
# 代码审计检查清单

## 编码规范检查（自动化）

运行 `check-style.js` 脚本，检查：

| 规则ID | 检查项 | 禁止 | 必须 |
|--------|--------|------|------|
| TIME | 时间处理 | `datetime('now')`、手动时区偏移 | `TimeUtil` |
| DB_CONN | 数据库连接 | `new sqlite3.Database()` | `db/index.js` |
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