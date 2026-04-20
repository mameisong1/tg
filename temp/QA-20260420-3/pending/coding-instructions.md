你是程序员A。请按设计稿编码实现。

## 设计稿
```
# 计时器系统重构设计方案

> QA任务编号：QA-20260420-3  
> 日期：2026-04-20  
> 目标：合并 application-timer.js 和 lejuan-timer.js 到 timer-manager.js

---

## 1. 现状分析

### 1.1 现有文件职责

| 文件 | 职责 | 保留？ |
|------|------|--------|
| `timer-manager.js` | 通用定时器基础设施（createTimer/cancelTimer/logTimer/pollCheck/恢复/active-timers API） | ✅ 保留并增强 |
| `application-timer.js` | 申请恢复业务逻辑（`executeRecovery`）+ 重复的调度/恢复/轮询代码 | ❌ 删除，业务逻辑迁入 timer-manager |
| `lejuan-timer.js` | 乐捐激活业务逻辑（`activateLejuan`）+ 重复的调度/恢复/轮询代码 | ❌ 删除，业务逻辑迁入 timer-manager |

### 1.2 核心问题

1. **三套独立的内存 Map**：`activeTimers`（timer-manager）、`applicationTimers`（application-timer）、`lejuanTimers`（lejuan-timer）各自为战
2. **双重初始化**：`server.js` 同时初始化 timer-manager 和两个独立服务，两套轮询并行运行
3. **重复代码**：scheduleRecord/pollCheck/recoverTimers 在三个文件中各有一份，逻辑高度相似
4. **回调耦合**：timer-manager 的 `init()` 需要外部传入业务回调，依赖两个独立服务

### 1.3 调用关系图（当前）

```
server.js
  ├── TimerManager.init({ lejuanActivate: LejuanTimer.activateLejuan, ... })
  ├── LejuanTimer.init()           ← 独立轮询(60s)
  └── ApplicationTimer.init()       ← 独立轮询(60s)

routes/applications.js
  └── applicationTimer.addNewRecord() / cancelRecord()

routes/lejuan-records.js
  └── lejuanTimer.addNewRecord() / cancelRecord()

routes/system-report.js
  └── timerManager.getActiveTimersWithDetails()
```

---

## 2. 目标架构

```
server.js
  └── TimerManager.init()           ← 唯一入口，内置回调，一个轮询(5min)

routes/applications.js
  └── timerManager.scheduleApplicationTimer() / cancelApplicationTimer()

routes/lejuan-records.js
  └── timerManager.scheduleLejuanTimer() / cancelLejuanTimer()

routes/system-report.js
  └── timerManager.getActiveTimersWithDetails()
```

**原则**：timer-manager.js 是唯一的计时器管理中心，自包含所有业务逻辑，不再需要外部回调。

---

## 3. timer-manager.js 新结构

### 3.1 保留的方法（现有，不做改动）

| 方法 | 说明 |
|------|------|
| `ensureTable()` | 创建 timer_log 表 |
| `logTimer()` | 记录计时器操作日志 |
| `createTimer(timerId, timerType, recordId, execTime, callback)` | 通用定时器创建 |
| `cancelTimer(timerId)` | 通用定时器取消 |
| `executeTimer(timerId, timerType, recordId, callback)...
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
2. 修复记录写入 /TG/temp/QA-20260420-3/fix-log.md（如有修复）