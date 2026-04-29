你是程序员A。请按设计稿编码实现。

## 设计稿
```
# QA-20260429-3 设计方案：台桌状态同步 + 系统通知

## 一、需求概述

### 1.1 台桌状态同步改造
- **成功**：同步后写入 Cron 日志（含开台数量、自动关灯数量、自动关空调数量）
- **失败**：新增错误提交接口，由同步脚本调用写 Cron 日志
- **Admin 后台**：Cron 日志板块新增台桌同步日志过滤检索

### 1.2 系统通知改造
- 台桌状态同步异常 → 自动通知所有管理员
- cron-scheduler 批处理执行异常 → 自动通知所有管理员
- 计时器任务执行异常 → 自动通知所有管理员

### 1.3 管理员定义
`admin_users` 表中 `role IN ('店长', '助教管理', '管理员')`

---

## 二、现有代码分析

### 2.1 台桌同步 API `POST /api/admin/sync/tables`
- **文件**: `backend/server.js` 第 ~4668 行
- **输入**: `{ tables: [{name, status}] }`
- **流程**:
  1. `runInTransaction` 更新 `tables` 和 `vip_rooms` 表
  2. 调用 `triggerAutoOffIfEligible()` → 返回 `{ triggered, status, maybeOffCount, cannotOffCount, turnedOffCount, independentTurnedOffCount }`
  3. 调用 `triggerAutoOffACIfEligible()` → 返回同上格式
  4. 返回 `{ success, data: { tablesUpdated, vipRoomsUpdated, tablesCount, elapsedMs } }`
- **关键**: 当前成功时**未写 cron_log**，也**未发送通知**

### 2.2 Cron 日志系统
- **文件**: `backend/services/cron-scheduler.js`
- **表 `cron_log`**: `id, task_name, task_type, status, records_affected, details, error, started_at, finished_at, duration_ms`
- **函数 `logCron(taskName, taskType, status, recordsAffected, details, error, startedAt, finishedAt)`**: 已存在，使用 `enqueueRun` 写入

### 2.3 Cron 日志查询 API
- **文件**: `backend/routes/system-report.js` 第 ~91 行
- **路由**: `GET /api/system-report/cron-logs`
- **参数**: `taskName`, `status`, `limit` (默认50)
- **当前逻辑**: `taskName` 同时匹配 `task_name = ? OR task_type = ?`
- **前端**: `admin/system-report.html`，Cron 日志 tab

### 2.4 通知系统
- **文件**: `backend/routes/notifications.js`（QA-20260429-2 新增）
- **表 `notifications`**: 已有 `notification_type`、`error_type` 字段
- **表 `notification_recipients`**: 已有 `recipient_type`, `recipient_id`, `recipient_name`, `recipient_employee_id`, `is_read`, `read_at`
- **API `POST /api/notifications/manage/send`**: 已存在，需管理员权限
- **当前 `notification_type`**: 仅支持 `'manual'`，需新增 `'system'`

### 2.5 计时器异常处理
- **文件**: `backend/services/timer-manager.js`
- **`executeTimer()` 函数**: 失败时写 `timer_log` + `console.error`，**无通知机制**
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
2. 修复记录写入 /TG/temp/QA-20260429-3/fix-log.md（如有修复）