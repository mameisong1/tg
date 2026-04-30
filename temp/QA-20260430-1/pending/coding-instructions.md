你是程序员A。请按设计稿编码实现。

## 设计稿
```
# QA-20260430-1 设计方案 - 订单管理页面

## 1. 需求理解

后台 Admin 前厅菜单目录下增加订单管理页面，管理订单表的 CRUD（增删改查）：
- 订单列表展示（支持分页和筛选）
- 订单详情查看
- 订单状态修改
- 订单删除

## 2. 现状分析

### 2.1 订单表结构（orders）

根据代码分析，`orders` 表字段如下：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| order_no | TEXT | 订单号（TG+yyyyMMddHHmmss+3位序号）|
| table_no | TEXT | 台桌号 |
| items | TEXT | 商品列表（JSON）|
| total_price | REAL | 总价 |
| status | TEXT | 状态：待处理/已完成/已取消 |
| device_fingerprint | TEXT | 设备指纹 |
| member_phone | TEXT | 会员手机号 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

**索引**（已有）：
- idx_orders_member_phone
- idx_orders_member_phone_created_at
- idx_orders_device_fingerprint_created_at

### 2.2 现有订单 API（server.js）

| API | 方法 | 说明 | 状态 |
|------|------|------|------|
| `/api/admin/orders` | GET | 订单列表（筛选状态/日期） | ✅ 已存在 |
| `/api/admin/orders/stats` | GET | 订单统计 | ✅ 已存在 |
| `/api/admin/orders/:id/complete` | POST | 完成订单 | ✅ 已存在 |
| `/api/admin/orders/:id/cancel` | POST | 取消订单 | ✅ 已存在 |
| `/api/admin/orders/:id/cancel-item` | POST | 取消单个商品 | ✅ 已存在 |
| `/api/admin/orders/:id` | GET | 订单详情 | ❌ 需新增 |
| `/api/admin/orders/:id` | DELETE | 删除订单 | ❌ 需新增 |
| `/api/admin/orders/:id/status` | PUT | 更新订单状态 | ❌ 需新增 |

### 2.3 菜单结构（sidebar.js）

前厅分组现有菜单：
- 收银看板（cashier-dashboard.html）
- 商品管理（products.html）
- 包房管理（vip-rooms.html）
- 台桌管理（tables.html）
- 商品分类（categories.html）

**权限控制**（ROLE_ALLOWED）：
- 管理员：all
- 店长：包含 cashier-dashboard.html、products.html 等
- 前厅管理：包含 cashier-dashboard.html、products.html、vip-rooms.html、tables.html、categories.html

## 3. 技术方案

### 3.1 新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `/TG/tgservice/admin/orders.html` | 新增 | 订单管理页面 |
| `/TG/tgservice/admin/sidebar.js` | 修改 | 添加订单管理菜单项 |
| `/TG/tgservice/backend/server.js` | 修改 | 新增订单详情/删除/状态更新 API |

### 3.2 API 变更

#### 3.2.1 新增 API

**1. GET /api/admin/orders/:id - 订单详情**

```javascript
// 位置：server.js，在 app.get('/api/admin/orders') 之后
app.get('/api/admin/orders/:id', authMiddleware, requireBackendPermission(['cashierDashboa...
```

## 编码要求
# 程序员A — 任务指令模板

## 角色

你是程序员A，负责天宫QA项目的设计方案和编码实现。

**禁止**：编写测试用例、运行测试。

## 设计规范

1. 明确列出新增/修改的文件
2. 说明API变更（路径、方法、参数、返回值）
3. 说明数据库变更（新表、字段、索引）
4. 说明前后端交互流程
5. 考虑边界情况和异常处理

## 编码规范（必须遵守）

### 🔴 时间处理

- ✅ 后端：`const TimeUtil = require('./utils/time'); TimeUtil.nowDB()`
- ✅ 前端：`TimeUtil.today()` / `TimeUtil.format(timeStr)`
- ❌ 禁止：`datetime('now')`、手动时区偏移、`new Date().getTime() + 8*60*60*1000`

### 🔴 数据库连接

- ✅ 唯一连接：`const { db, dbRun, dbAll, dbGet } = require('./db/index');`（连接 Turso 云端 DB）
- ❌ 禁止：`new sqlite3.Database()`、自行实例化
- ❌ 禁止 `sqlite3` CLI 操作本地 .db 文件（已废弃）

### 🔴 数据库写入

- ✅ `await enqueueRun('INSERT ...', [...])`
- ✅ `await runInTransaction(async (tx) => { ... })`
- ❌ 禁止：`db.run('BEGIN TRANSACTION')`、裸开事务

### 🔴 页面显示规范

- ✅ 页面显示助教工号：`{{ employee_id }}` 或 `${employee_id}`
- ❌ 禁止：在页面显示 `coach_no`（如 `{{ coach_no }}`、`${c.coach_no}`）
- ❌ 禁止：使用回退逻辑 `employee_id || coach_no`（可能暴露系统编号）
- ✅ `coach_no` 仅限内部用途：API 参数、`:key` 绑定、`data-*` 属性、JS 内部逻辑

## 工作目录

所有设计/代码产出写入指定工作目录。

## 输出要求

- 设计方案：写入 `design.md`
- 代码实现：直接修改项目代码，提交Git
- 修复记录：写入工作目录的 `fix-log.md`


## 完成要求
1. 代码提交到Git
2. 修复记录写入 /TG/temp/QA-20260430-1/fix-log.md（如有修复）