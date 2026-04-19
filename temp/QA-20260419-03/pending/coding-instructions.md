你是程序员A。请按设计稿编码实现。

## 设计稿
```
# QA3 & QA4 技术设计方案

**日期**: 2026-04-19  
**需求**: QA3 公共计时器类 + QA4 cron批处理  
**设计者**: 程序员A

---

## 一、需求理解

### QA3: 公共计时器类
将当前分散在 `lejuan-timer.js` 和 `application-timer.js` 中的定时器逻辑统一管理，实现：
- 计时器模块化管理（统一入口、统一恢复、统一状态查询）
- 系统重启后自动恢复（从 DB 读取待执行任务重新注册 setTimeout）
- 后台 Admin 系统报告页面可视化显示计时器日志

### QA4: cron批处理
- **(1) 凌晨2点**：自动结束乐捐（active → returned，计算外出时长）
- **(2) 中午12点**：奖罚数据自动同步（未约客罚金、漏单罚金、漏卡罚金、助教日常）
- 执行结果写日志 + 可视化（系统报告页面）
- 去重逻辑：奖罚数据已存在则跳过

---

## 二、现状分析

### 2.1 现有定时器

| 文件 | 功能 | 恢复机制 | 轮询检查 |
|------|------|----------|----------|
| `services/lejuan-timer.js` | 乐捐预约定时生效 | ✅ DB `scheduled` 字段 + `recoverTimers()` | ✅ 60s pollCheck |
| `services/application-timer.js` | 休息/请假申请定时恢复 | ✅ DB `extra_data.timer_set` 字段 + `recoverTimers()` | ✅ 60s pollCheck |

**共性**：两套代码逻辑高度重复，均使用 `setTimeout` + DB 持久化 + 启动恢复 + 轮询兜底。

### 2.2 现有 cron 实现

```javascript
// server.js 第4722行 - 脆弱实现
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 3 && now.getMinutes() === 0) {
    cleanOldDeviceVisits();
  }
}, 60000);
```

**问题**：
- 内嵌在 server.js 中，难以管理
- 无法查看执行历史
- 缺乏执行结果记录
- 重启后需要等待下一个整点窗口

### 2.3 奖罚系统

- **表**: `reward_penalties`（已有 `exec_status`, `exec_date`, `confirm_date`, `type`, `phone` 字段）
- **去重**: `ON CONFLICT(confirm_date, type, phone) DO UPDATE` 已实现
- **类型**: 未约客罚金、漏单罚金、漏卡罚金、助教日常 均在 `system_config.reward_penalty_types` 中配置

---

## 三、设计方案

### 3.1 文件清单

| 操作 | 文件路径 | 说明 |
|------|----------|------|
| **新增** | `backend/services/timer-manager.js` | 公共计时器管理器 |
| **新增** | `backend/services/cron-scheduler.js` | cron 批处理调度器 |
| **新增** | `backend/routes/system-report.js` | 系统报告 API 路由 |
| **新增** | `admin/system-report.html` | 系统报告管理页面 |
| **新增** | `admin/system-report.css` | 系统报告页面样式（可选，内联也可） |
| **修改** | `backend/server.js` | 注册新路由、初始化服务、添加 sidebar 菜单项 |
| **修改** | `admin/sidebar.js` | 新增"系统报告"菜单项 |

### 3.2 数据库变更

#### 3.2.1 新建 `timer_log` 表

记录所有计时器的生命周期事件：

```sql
CREATE TABLE IF NOT EXISTS timer_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timer_id TEXT...
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
2. 修复记录写入 /TG/temp/QA-20260419-03/fix-log.md（如有修复）