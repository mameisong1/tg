你是程序员A。请按设计稿编码实现。

## 设计稿
```
# QA-20260416-05 设计方案：H5 商品页面人气值排序

## 1. 需求概述

**目标**：H5 商品页面按人气值倒序排序，让用户优先看到最受欢迎的商品。

**三项变更**：
1. 数据库 `products` 表新增 `popularity` 字段（INTEGER，默认 0）
2. 用户将商品加入购物车时 `popularity + 1`，从购物车删除时 `popularity - 1`（不低于 0）
3. 前台 H5 商品列表按 `popularity DESC` 排序

---

## 2. 现有代码分析

### 2.1 数据库表结构

**products 表**（当前）：
```sql
CREATE TABLE products (
  name TEXT PRIMARY KEY,
  category TEXT,
  image_url TEXT,
  price REAL DEFAULT 0,
  stock_total INTEGER DEFAULT 0,
  stock_available INTEGER DEFAULT 0,
  status TEXT DEFAULT '上架',
  creator TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**carts 表**（当前）：
```sql
CREATE TABLE carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  table_no TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  options TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 相关后端 API（server.js）

| API | 方法 | 当前行为 | 需要修改？ |
|-----|------|---------|-----------|
| `GET /api/products` | GET | 查询上架商品，无排序 | ✅ 加 `ORDER BY` |
| `POST /api/cart` | POST | 加入购物车（新增或累加 quantity） | ✅ 加 popularity + 1 |
| `PUT /api/cart` | PUT | 更新购物车数量（quantity ≤ 0 时删除） | ✅ 删除时 popularity - 1 |
| `DELETE /api/cart` | DELETE | 删除购物车商品 | ✅ 加 popularity - 1 |

### 2.3 前端相关页面

| 页面 | 文件 | 作用 |
|------|------|------|
| 商品页 | `src/pages/products/products.vue` | 展示商品列表 |
| 购物车页 | `src/pages/cart/cart.vue` | 管理购物车、修改数量、删除商品 |
| API 封装 | `src/utils/api.js` | 前端 HTTP 请求封装 |

---

## 3. 技术方案

### 3.1 数据库变更

#### 3.1.1 新增字段

```sql
ALTER TABLE products ADD COLUMN popularity INTEGER DEFAULT 0;
```

**说明**：
- 字段名：`popularity`
- 类型：`INTEGER`
- 默认值：`0`
- 已有商品自动补 0

#### 3.1.2 迁移脚本

创建文件：`/TG/tgservice/backend/db/v2.1.sql`

```sql
-- =====================================================
-- 天宫国际 V2.1 数据库迁移脚本
-- 日期：2026-04-16
-- 说明：商品表新增人气值字段
-- =====================================================

ALTER TABLE products ADD COLUMN popularity INTEGER DEFAULT 0;

-- 迁移完成
```

#### 3....
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

- ✅ 唯一连接：`const { db, dbRun, dbAll, dbGet } = require('./db/index');`
- ❌ 禁止：`new sqlite3.Database()`、自行实例化

### 🔴 数据库写入

- ✅ `await enqueueRun('INSERT ...', [...])`
- ✅ `await runInTransaction(async (tx) => { ... })`
- ❌ 禁止：`db.run('BEGIN TRANSACTION')`、裸开事务

## 工作目录

所有设计/代码产出写入指定工作目录。

## 输出要求

- 设计方案：写入 `design.md`
- 代码实现：直接修改项目代码，提交Git
- 修复记录：写入工作目录的 `fix-log.md`


## 完成要求
1. 代码提交到Git
2. 修复记录写入 /TG/temp/QA-20260416-05/fix-log.md（如有修复）