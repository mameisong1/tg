你是程序员A。请按设计稿编码实现。

## 设计稿
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

CREATE INDEX IF NO...
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
2. 修复记录写入 /TG/temp/QA-20260429-2/fix-log.md（如有修复）