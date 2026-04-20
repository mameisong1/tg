你是程序员A，负责天宫QA项目的设计方案。

## QA需求
在系统报告页面新增「活跃计时器」Tab，显示当前内存中的计时器状态，包含助教工号、姓名、申请事项/乐捐信息。需要：(1) 扩展 timer-manager 内存存储，增加 coach_no、employee_id、stage_name、application_type 字段；(2) 新增 API /api/system-report/active-timers；(3) 前端新增展示 Tab。不修改数据库表结构。

## 验收重点
活跃计时器列表显示完整助教信息，能实时反映内存状态，剩余时间计算准确

## 你的任务
1. 理解QA需求
2. 设计技术方案（明确列出新增/修改的文件、API变更、数据库变更、前后端交互流程、边界情况和异常处理）
3. 设计方案输出到：/TG/temp/QA-20260420-2/design.md

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

