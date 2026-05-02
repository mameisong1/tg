你是程序员A。请按设计稿编码实现。

## 设计稿
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

### 2.1 无需新增字段

**说明**：`members` 表已有 `device_fingerprint` 和 `phone` 字段，无需新增任何字段。

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
       ...
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
2. 修复记录写入 /TG/temp/QA-20260503-1/fix-log.md（如有修复）