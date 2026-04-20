你是程序员A。请按设计稿编码实现。

## 设计稿
```
# QA-20260420-2: 活跃计时器功能 — 技术方案设计

> 设计者：程序员A | 日期：2026-04-20

---

## 一、需求概述

在系统报告页面新增「活跃计时器」Tab，展示当前内存中所有计时器的实时状态，包含助教完整信息（工号、姓名）和计时器详情（申请事项/乐捐信息、剩余时间等）。**不修改数据库表结构。**

### 验收重点
1. 活跃计时器列表显示完整助教信息
2. 能实时反映内存状态
3. 剩余时间计算准确

---

## 二、现有架构分析

### 2.1 计时器三层架构

```
┌──────────────────────────────────────────────────────────┐
│                    timer-manager.js                       │
│  activeTimers Map: {timerId, type, recordId, execTime}   │
│  用途: 系统报告统计、5分钟轮询兜底                         │
│  数据源: 仅恢复/轮询时创建的定时器                         │
└──────────────────┬───────────────────────────────────────┘
                   │ callbacks
         ┌─────────┴──────────┐
         ▼                    ▼
┌─────────────────┐  ┌────────────────────┐
│ lejuan-timer.js │  │ application-timer  │
│ lejuanTimers Map│  │ applicationTimers  │
│ 真正的乐捐定时器 │  │ 真正的申请定时器    │
│ 被路由直接调用   │  │ 被路由直接调用      │
└─────────────────┘  └────────────────────┘
```

### 2.2 关键发现

| 模块 | 内存 Map 内容 | 谁在用 | 数据来源 |
|------|-------------|--------|---------|
| timer-manager | 仅恢复/轮询时 | system-report API | 不完整 |
| lejuan-timer | 全部乐捐定时器 | lejuan-records 路由 | 完整 |
| application-timer | 全部申请定时器 | applications 路由 | 完整 |

**核心问题：** `timer-manager.js` 的 `activeTimers` 只记录了 `type` 和 `recordId`，缺少助教详细信息。且正常流程中通过 `addNewRecord` 创建的定时器不会注册到 timer-manager。

### 2.3 现有数据结构

**timer-manager `activeTimers` Map：**
```javascript
{
  "lejuan_123": {
    timerId: Timeout,        // setTimeout 引用
    type: "lejuan",          // 类型
    recordId: "123",         // 记录 ID
    execTime: "2026-04-20 18:00:00"  // 执行时间
  }
}
```

**coaches 表相关字段：**
```
coach_no (TEXT, 内部编号)
employee_id (TEXT, 页面显示用工号)
stage_name (TEXT, 艺名/姓名)
phone (TEXT, 手机号)
```

**lejuan_records 表相关字段：**
```
id, coach_no, stage_name, scheduled_start_time, lejuan_status, scheduled
```

**applications 表相关字段：**
```
id, applicant_phone, application_type, status, extra_data(JSON: {exec_time, timer_set, executed})
```

---

## 三、技术方案

### 3.1 总体策略

采用**查询时 enrichment（数据...
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
2. 修复记录写入 /TG/temp/QA-20260420-2/fix-log.md（如有修复）