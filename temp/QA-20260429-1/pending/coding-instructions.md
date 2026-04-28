你是程序员A。请按设计稿编码实现。

## 设计稿
```
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
app.post('/api/order', async (req, res) => ...
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
2. 修复记录写入 /TG/temp/QA-20260429-1/fix-log.md（如有修复）