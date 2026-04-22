你是程序员A。请按设计稿编码实现。

## 设计稿
```
# 助教门迎排序功能 - 技术设计方案

> QA 编号：QA-20260422-02  
> 设计日期：2026-04-22  
> 设计者：程序员A

---

## 一、现有代码分析

### 1.1 批处理脚本实现方式

**参考文件**：`/TG/tgservice/backend/services/cron-scheduler.js`

现有 cron 调度器模式：
- 使用 `cron_tasks` 表管理任务配置和状态（task_name, task_type, cron_expression, next_run, last_status）
- 使用 `cron_log` 表记录执行历史
- 每分钟检查 `next_run <= now()` 的任务并触发执行
- 内部任务通过 **HTTP 调用内部 API** 执行（如 `taskLockGuestInvitation` 调用 `POST /api/guest-invitations/internal/lock`）
- 内部接口通过检查 IP（`127.0.0.1` / `::1`）限制外部访问

```javascript
// 参考：lock_guest_invitation_morning 的内部 HTTP 调用模式
const options = {
    hostname: '127.0.0.1',
    port: parseInt(process.env.PORT) || (process.env.TGSERVICE_ENV === 'test' ? 8088 : 80),
    path: '/api/guest-invitations/internal/lock',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
};
```

### 1.2 系统配置表结构

**参考文件**：`/TG/tgservice/backend/server.js` (L3631)

```sql
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT,                    -- JSON 格式存储
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

现有配置项：
- `sms_provider` — 短信服务商
- `reward_penalty_types` — 奖罚类型配置 JSON

### 1.3 水牌管理页面

**参考文件**：`/TG/tgservice-uniapp/src/pages/internal/water-board.vue`

- 长按助教卡片触发 `showStatusChange(coach)`，弹出修改状态弹窗
- H5 环境通过 `contextmenu` 事件阻止浏览器默认长按菜单
- 助教卡片使用 `@longpress="showStatusChange(coach)"` 绑定
- 卡片结构：头像 + 工号（`formatCoachId`）+ 艺名
- 空闲状态卡片有特殊的白色背景样式（`.free-section .coach-card`）

### 1.4 水牌查看页面

**参考文件**：`/TG/tgservice-uniapp/src/pages/internal/water-board-view.vue`

- 只读页面，无长按交互
- 数据结构与水牌管理页面相同
- 空闲/上桌助教卡片样式类似

### 1.5 water_boards 表结构

```
water_boards:
  id, coach_no, stage_name, status, table_no, clock_in_time, updated_at, created_at
```

- `clock_in_time` 存储上班打卡时间（已存在，用于排序）
- `status` 枚举：早班上桌/早班空闲/晚班上桌/晚班空闲/早加班/晚加班/休息/公休/请假/乐捐/下班

### 1.6 数据库操作规范

- **唯一连接**：`/TG/tgservice/backend/db/index.js`
- **写操作**：使用 `runInTransaction` 或 `enqueueRun`
- **时间处理...
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
2. 修复记录写入 /TG/temp/QA-20260422-02/fix-log.md（如有修复）