# 时区统一改造方案

> 2026-04-14 创建 | 触发问题：后台数据概览"今日订单"在 00:00-08:00 显示为 0

---

## 一、问题根因

### Bug 1：订单创建存 UTC，其他表存北京时间

| 表 | 写入方式 | 实际存储 | 举例 |
|---|---------|---------|------|
| **orders** | `datetime('now')` | UTC | `2026-04-13 21:46` = 北京时间 04-14 05:46 |
| **service_orders** | `DEFAULT CURRENT_TIMESTAMP` | UTC | 同上 |
| **table_action_orders** | `DEFAULT CURRENT_TIMESTAMP` | UTC | 同上 |
| members/coaches/products/tables/vip_rooms 等 | `datetime('now', 'localtime')` | 北京时间 | `2026-04-14 02:18` |

### Bug 2：前端时区重复偏移

`index.html` 第 378-380 行：
```javascript
const now = new Date();
const bj = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 容器已设 Asia/Shanghai，又加 8 小时
const today = bj.toISOString().slice(0, 10);
```

### Bug 3：前端格式化把北京时间当 UTC 解析

`index.html` 第 346-352 行、`cashier-dashboard.html` 第 455 行等：
```javascript
const d = new Date(timeStr + ' UTC'); // 数据库存的是北京时间，却被当 UTC 解析
```

### 叠加效果

北京时间 00:00-08:00 区间：
- 前端发 `date=2026-04-14`
- 后端 SQL：`DATE(created_at) = '2026-04-14'`
- 但 orders 存的是 UTC，此时 UTC 还是 04-13
- 结果：0 条匹配

---

## 二、改造目标

1. **数据库统一存北京时间**（`YYYY-MM-DD HH:MM:SS`，不含时区标记）
2. **后端统一通过工具类生成/格式化时间**，不再用 SQL `datetime()` 函数
3. **前端统一通过工具类格式化显示**，不再手动偏移或拼接 `' UTC'`
4. **SQL 参数化**：时间比较参数由 Node.js 生成，不依赖 SQLite 时区函数

---

## 三、现状统计

### 后端 server.js

| 类型 | 数量 | 说明 |
|------|------|------|
| `datetime('now', 'localtime')` | 36 处 | 北京时间，基本正确 |
| `datetime('now')` UTC | 1 处 | 订单创建，**需修复** |
| `datetime('now', '-5 hours')` | 2 处 | 助教排班，**需适配** |
| `Date.now()` | ~20 处 | 缓存时间戳/文件名，不改 |
| `new Date().toLocaleString(...)` | 2 处 | 订单号打印，需适配 |

### 前端 admin/*.html

| 文件 | 问题 |
|------|------|
| `index.html` | `+8h` 重复偏移 + `' UTC'` 错误解析 |
| `cashier-dashboard.html` | `' UTC'` 错误解析 |
| `categories.html` | `' UTC'` 错误解析 |
| `operation-logs.html` | `' UTC'` 错误解析 |
| `members.html` | `.toISOString()` UTC 日期 |

### 同步脚本（宿主机）

| 文件 | 状态 |
|------|------|
| `sync-tables-status.js` | `toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})` ✅ |
| `sync-products.js` | `toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})` ✅ + SQL 用 `datetime('now', 'localtime')` |

---

## 四、数据库迁移（A方案）

### 步骤 1：修复 orders 表存量数据

```bash
# orders：UTC → 北京时间
docker exec tgservice sqlite3 /app/tgservice/db/tgservice.db \
  "UPDATE orders SET created_at = datetime(created_at, '+8 hours') WHERE created_at NOT LIKE '%+%';"

# service_orders：UTC → 北京时间（同时更新 order_time）
docker exec tgservice sqlite3 /app/tgservice/db/tgservice.db \
  "UPDATE service_orders SET created_at = datetime(created_at, '+8 hours'), order_time = datetime(order_time, '+8 hours') WHERE created_at NOT LIKE '%+%';"

# table_action_orders：UTC → 北京时间（同时更新 order_time）
docker exec tgservice sqlite3 /app/tgservice/db/tgservice.db \
  "UPDATE table_action_orders SET created_at = datetime(created_at, '+8 hours'), order_time = datetime(order_time, '+8 hours') WHERE created_at NOT LIKE '%+%';"
```

### 步骤 2：修复 orders 创建代码

`server.js` 第 762 行：
```javascript
// 改前
datetime('now')
// 改后
datetime('now', 'localtime')
```

### 步骤 3：修复 service_orders / table_action_orders 表定义

表定义中的 `DEFAULT CURRENT_TIMESTAMP` 改为由代码显式插入北京时间。
（CURRENT_TIMESTAMP 在 SQLite 中始终是 UTC，无法改）

---

## 五、工具类设计

### 5.1 后端 `backend/utils/time.js`

```javascript
/**
 * 统一时间工具 - 北京时间 (Asia/Shanghai, UTC+8)
 * 
 * 数据库存储格式: "YYYY-MM-DD HH:MM:SS"（无时区标记，统一北京时间）
 */

/**
 * 生成当前北京时间，格式适合存入数据库
 * 返回: "2026-04-14 07:23:00"
 */
function nowDB() {
  const d = new Date();
  // new Date() 返回的是服务器本地时间（容器已设 Asia/Shanghai）
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

/**
 * 生成过去/未来时间的数据库格式（相对当前北京时间偏移）
 * @param {number} hours - 偏移小时数（正数=未来，负数=过去）
 * 返回: "2026-04-14 02:23:00"
 */
function offsetDB(hours) {
  const d = new Date(Date.now() + hours * 60 * 60 * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

/**
 * 获取今天的日期字符串（北京时间），用于 SQL DATE() 比较
 * 返回: "2026-04-14"
 */
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 把数据库中的时间字符串转成 JavaScript Date 对象（已正确解释为北京时间）
 * @param {string} dbTime - "2026-04-14 07:23:00"
 * 返回: Date 对象（UTC 内部值正确对应北京时间）
 */
function toDate(dbTime) {
  if (!dbTime) return null;
  // 明确指定 +08:00 时区，避免 Node.js 时区设置变化导致解析错误
  return new Date(dbTime + '+08:00');
}

/**
 * 格式化时间字符串，用于 API 返回或日志
 * @param {string} dbTime - "2026-04-14 07:23:00"
 * @param {object} options - toLocaleString 选项
 */
function format(dbTime, options = {}) {
  const d = toDate(dbTime);
  if (!d) return '-';
  const defaultOptions = {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  return d.toLocaleString('zh-CN', { ...defaultOptions, ...options });
}

/**
 * 格式化日期（不含时间）
 */
function formatDate(dbTime) {
  const d = toDate(dbTime);
  if (!d) return '-';
  return d.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

/**
 * 格式化时间（不含日期）
 */
function formatTime(dbTime) {
  const d = toDate(dbTime);
  if (!d) return '-';
  return d.toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * 判断数据库时间是否在 N 分钟前到现在（北京时间比较）
 */
function isWithinMinutes(dbTime, minutes) {
  const d = toDate(dbTime);
  if (!d) return false;
  const now = new Date();
  return (now - d) <= minutes * 60 * 1000;
}

/**
 * 安全版 toLocaleString（给前端打印用）
 */
function toLocaleStr(options = {}) {
  return new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    ...options
  });
}

module.exports = {
  nowDB,
  offsetDB,
  todayStr,
  toDate,
  format,
  formatDate,
  formatTime,
  isWithinMinutes,
  toLocaleStr
};
```

### 5.2 前端 `admin/js/time-util.js`

```javascript
/**
 * 前端统一时间工具 - 北京时间 (Asia/Shanghai, UTC+8)
 * 
 * 数据库中所有时间都是北京时间 "YYYY-MM-DD HH:MM:SS"
 * 本工具统一解析和格式化
 */

window.TimeUtil = {
  /**
   * 获取今天日期（北京时间），用于 API 查询参数
   * 返回: "2026-04-14"
   */
  today() {
    return new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }).replace(/\//g, '-');
  },

  /**
   * 把数据库时间字符串转成正确的 Date 对象
   * 数据库存的是北京时间，明确指定 +08:00 避免误判
   */
  toDate(timeStr) {
    if (!timeStr) return null;
    return new Date(timeStr + '+08:00');
  },

  /**
   * 格式化完整日期时间
   * 返回: "04月14日 07:23"
   */
  format(timeStr) {
    if (!timeStr) return '-';
    const d = this.toDate(timeStr);
    return d.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  },

  /**
   * 只格式化时间
   * 返回: "07:23"
   */
  formatTime(timeStr) {
    if (!timeStr) return '-';
    const d = this.toDate(timeStr);
    return d.toLocaleTimeString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  },

  /**
   * 格式化完整日期时间（含年月）
   * 返回: "2026/04/14 07:23:00"
   */
  formatFull(timeStr) {
    if (!timeStr) return '-';
    const d = this.toDate(timeStr);
    return d.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  },

  /**
   * 判断数据库时间是否在 N 分钟内
   */
  isWithinMinutes(timeStr, minutes) {
    if (!timeStr) return false;
    const d = this.toDate(timeStr);
    const now = new Date();
    return (now - d) <= minutes * 60 * 1000;
  },

  /**
   * 获取过去 N 小时的数据库格式时间（用于 SQL 参数）
   */
  hoursAgo(hours) {
    const d = new Date(Date.now() - hours * 60 * 60 * 1000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}:${s}`;
  }
};
```

---

## 六、后端 server.js 改造清单

### 6.1 新增 import

文件顶部添加：
```javascript
const TimeUtil = require('./utils/time');
```

### 6.2 订单创建（第 762 行）

```javascript
// 改前
`INSERT INTO orders (..., created_at) VALUES (..., datetime('now'))`

// 改后
`INSERT INTO orders (..., created_at) VALUES (?, ?)`, [..., TimeUtil.nowDB()]
```

### 6.3 订单完成/取消/修改（约 5 处）

```javascript
// 改前
"UPDATE orders SET status = '已完成', updated_at = datetime('now', 'localtime') WHERE id = ?"

// 改后
"UPDATE orders SET status = '已完成', updated_at = ? WHERE id = ?", [TimeUtil.nowDB(), id]
```

### 6.4 助教排班查询（第 1017、1043 行）

```javascript
// 改前
"AND datetime(created_at) >= datetime('now', '-5 hours')"

// 改后
"AND created_at >= ?", [TimeUtil.offsetDB(-5)]
```

### 6.5 所有其他 `datetime('now', 'localtime')`（约 30 处）

统一改为参数化：
```javascript
// 改前
"UPDATE members SET updated_at = datetime('now', 'localtime') WHERE ..."
// 改后
"UPDATE members SET updated_at = ? WHERE ...", [TimeUtil.nowDB(), ...]
```

### 6.6 订单号打印（第 745 行）

```javascript
// 改前
new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })

// 改后
TimeUtil.toLocaleStr()
```

### 6.7 健康检查（第 379 行）

```javascript
// 改前
new Date().toISOString()

// 改后
TimeUtil.nowDB()  // 或直接保留 toISOString() 给外部系统用（不改）
```

---

## 七、前端改造清单

### 7.1 引入工具类

所有 admin/*.html 在 `<script>` 区域顶部添加：
```html
<script src="js/time-util.js"></script>
```

### 7.2 `index.html` 数据概览

| 行号 | 改前 | 改后 |
|------|------|------|
| 378-380 | `+ 8*60*60*1000` 手动偏移 | `TimeUtil.today()` |
| 346-352 | `new Date(timeStr + ' UTC')` | `TimeUtil.format(timeStr)` |

### 7.3 `cashier-dashboard.html` 收银看板

| 函数 | 改前 | 改后 |
|------|------|------|
| `formatBeijingTime` | `+ ' UTC'` | `TimeUtil.format(timeStr)` |
| `formatBeijingTimeOnly` | `+ ' UTC'` | `TimeUtil.formatTime(timeStr)` |
| `isWithinMinutes` | `+ ' UTC'` | `TimeUtil.isWithinMinutes(timeStr, minutes)` |

### 7.4 `categories.html` 商品分类

| 函数 | 改前 | 改后 |
|------|------|------|
| `formatBeijingTime` | `+ ' UTC'` | `TimeUtil.format(timeStr)` |

### 7.5 `operation-logs.html` 操作日志

| 函数 | 改前 | 改后 |
|------|------|------|
| `formatBeijingTime` | `+ ' UTC'` | `TimeUtil.format(timeStr)` |

### 7.6 `members.html` 会员管理

| 行号 | 改前 | 改后 |
|------|------|------|
| 219 | `.toISOString().split('T')[0]` | `TimeUtil.today()` |

---

## 八、同步脚本改造

### `sync-products.js`

SQL 中 `datetime('now', 'localtime')` 改为参数化：

```javascript
// 改前
`INSERT INTO products (..., created_at, updated_at) VALUES (..., datetime('now', 'localtime'), datetime('now', 'localtime'))`

// 改后
const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
`INSERT INTO products (..., created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [..., now, now]
```

---

## 九、执行步骤

### SubAgent A（代码改造）

1. **数据迁移**：修复 orders/service_orders/table_action_orders 存量 UTC 时间
2. **创建工具类**：
   - `backend/utils/time.js`
   - `admin/js/time-util.js`
3. **改造后端**：替换所有 `datetime('now'...)` 为 `TimeUtil` 调用（约 38 处）
4. **改造前端**：替换所有 `formatBeijingTime` 等函数（约 6 个文件）
5. **改造同步脚本**：`sync-products.js` 中的 SQL 时间

### SubAgent B（测试）

1. 编写测试用例验证：
   - 工具类函数正确性
   - 数据库迁移后数据一致性
   - API 返回时间格式正确
   - 前端页面显示正确
2. 在测试环境执行测试

---

## 十、风险评估

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| 数据迁移出错 | 低 | 中 | 先备份数据库，迁移后验证 |
| 旧代码漏改 | 低 | 低 | SubAgent A 改完后人工审查 |
| 前端缓存旧页面 | 中 | 低 | 强制刷新或清除浏览器缓存 |
| 容器时区被改 | 极低 | 高 | 工具类不依赖 SQL 时区函数，已安全 |

---

## 十一、回退方案

1. 数据库迁移前备份：`docker cp tgservice:/app/tgservice/db/tgservice.db /TG/temp/tgservice-backup-$(date +%Y%m%d).db`
2. 代码修改前 git commit
3. 如有问题，恢复数据库 + git reset
