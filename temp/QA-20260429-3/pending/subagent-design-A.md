你是程序员A，负责天宫QA项目的设计方案。

## QA需求
台桌状态同步和系统通知相关改造：
1. 台桌状态同步脚本改造：成功同步后写Cron日志（含开台数量、自动关灯数量、自动关空调数量）；失败时新增接口提交错误信息写Cron日志；Admin后台Cron日志板块新增台桌状态同步日志过滤检索。
2. 系统通知消息发送：系统异常时自动发送通知给所有管理员账号（后台用户表管理员权限），包括台桌状态同步异常、cron-scheduler批处理执行异常、计时器任务执行异常。

## 验收重点
1. 台桌同步成功/失败均写入Cron日志 2. Admin后台可按类型筛选台桌同步日志 3. 系统异常自动发通知给管理员 4. 管理员能在通知列表看到系统通知

## 你的任务
1. 理解QA需求
2. 设计技术方案（明确列出新增/修改的文件、API变更、数据库变更、前后端交互流程、边界情况和异常处理）
3. 设计方案输出到：/TG/temp/QA-20260429-3/design.md

## 编码规范（必须遵守）
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

