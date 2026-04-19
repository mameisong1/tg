你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
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
    timer_id TEXT NOT NULL,              -- 定时器唯一标识（如 'lejuan_123'、'application_456'）
    timer_type TEXT NOT NULL,            -- 定时器类型：'lejuan'、'application'
    event_type TEXT NOT NULL,            -- 事件类型：'scheduled'、'recovered'、'executed'、'cancelled'、'error'
    record_id INTEGER,                   -- 关联业务记录 ID
    coach_no TEXT,                       -- 助教编号
    stage_name TEXT,                     -- 助教艺名
    scheduled_time TEXT,                 -- 计划执行时间
    actual_time TEXT,                    -- 实际执行时间
    detail TEXT,                         -- JSON 详情
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_timer_log_type ON timer_log(timer_type);
CREATE INDEX IF NOT EXISTS idx_timer_log_event ON timer_log(event_type);
CREATE INDEX IF NOT EXISTS idx_timer_log_created ON timer_log(created_at DESC);
```

#### 3.2.2 新建 `cron_log` 表

记录 cron 批处理的执行历史：

```sql
CREATE TABLE IF NOT EXISTS cron_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_name TEXT NOT NULL,              -- 任务名称：'end_lejuan'、'sync_reward_penalty'
    scheduled_time TEXT NOT NULL,        -- 计划执行时间（cron 表达式对应时间）
    start_time TEXT,                     -- 实际开始时间
    end_time TEXT,                       -- 实际结束时间
    status TEXT DEFAULT 'running',       -- running / success / failed / skipped
    result_summary TEXT,                 -- JSON 结果摘要
    error_message TEXT,                  -- 错误信息
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_cron_log_job ON cron_log(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_log_status ON cron_log(status);
CREATE INDEX IF NOT EXISTS idx_cron_log_created ON cron_log(created_at DESC);
```

#### 3.2.3 新建 `cron_tasks` 表

记录定时任务的配置和运行状态：

```sql
CREATE TABLE IF NOT EXISTS cron_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_name TEXT NOT NULL UNIQUE,       -- 任务唯一标识
    display_name TEXT NOT NULL,          -- 显示名称
    cron_expression TEXT NOT NULL,       -- cron 表达式
    is_enabled INTEGER DEFAULT 1,        -- 是否启用
    last_run_time TEXT,                  -- 上次执行时间
    last_run_status TEXT,               -- 上次执行状态
    next_run_time TEXT,                  -- 下次计划执行时间
    description TEXT,                    -- 任务描述
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
```

### 3.3 核心模块设计

#### 3.3.1 `services/timer-manager.js` - 公共计时器管理器

```
类: TimerManager
  属性:
    timers: Map<timerId, { timerId, timerType, recordId, execTime, timerObj }>
    
  方法:
    init()                  → 启动时调用，恢复所有定时器
    schedule(config)        → 注册新定时器
    cancel(timerId)         → 取消指定定时器
    getStatus()             → 返回所有定时器状态
    getLog(filters)         → 查询 timer_log
    _recoverTimers()        → 从 DB 恢复（内部方法）
    _pollCheck()            → 轮询兜底检查（内部方法）
    _writeLog(event)        → 写入 timer_log（内部方法）
```

**核心流程**：

```
schedule(config):
  1. 验证 execTime 合法性
  2. 计算 delay = execTime - now
  3. 如果 delay <= 0 → 立即执行 execute(taskId)
  4. 否则 → setTimeout(exec, delay)
  5. 写入 timer_log (event=scheduled)
  6. 更新业务表的 scheduled=1 标记

execute(taskId):
  1. 根据 timerType 路由到对应处理函数
     - 'lejuan' → lejuanTimer.activateLejuan(recordId)
     - 'application' → applicationTimer.executeRecovery(recordId)
  2. 写入 timer_log (event=executed)
  3. 清理内存 timers Map

recoverTimers():
  1. 查询所有 scheduled=0 或 scheduled=1 但未执行的记录
  2. lejuan: lejuan_status='pending' AND scheduled=0
  3. application: extra_data LIKE '%timer_set:true%' AND extra_data NOT LIKE '%executed:1%'
  4. execTime 已过 → 立即执行
  5. execTime 未到 → 注册 setTimeout
  6. 写入 timer_log (event=recovered)
  7. 标记 scheduled=1

pollCheck():
  每分钟执行，兜底遗漏的定时器
  查询 scheduled=0 的记录，重新调度
```

#### 3.3.2 `services/cron-scheduler.js` - cron 批处理调度器

```
类: CronScheduler
  属性:
    jobs: Map<jobName, { name, cron, handler, lastRun, nextRun }>
    
  方法:
    init()                  → 启动时加载配置，计算下次执行时间
    register(config)        → 注册 cron 任务
    runJob(jobName)         → 手动触发指定任务
    getJobs()               → 获取所有任务状态
    getLogs(filters)        → 查询 cron_log
    _tick()                 → 每分钟检查是否到执行时间
    _writeLog(job, status, result) → 写入 cron_log
```

**已注册任务**：

| 任务名 | 显示名 | cron 表达式 | 处理函数 |
|--------|--------|------------|----------|
| `end_lejuan` | 自动结束乐捐 | `0 2 * * *` | `handleEndLejuan()` |
| `sync_reward_penalty` | 奖罚自动同步 | `0 12 * * *` | `handleSyncRewardPenalty()` |

**`handleEndLejuan()` 逻辑**：

```
1. 查询所有 active 状态的乐捐记录
2. 对每条记录:
   a. 计算外出时长 = now - actual_start_time（向上取整，最小1）
   b. 更新 lejuan_records:
      - lejuan_status = 'returned'
      - return_time = now
      - lejuan_hours = 计算值
   c. 更新 water_boards:
      - status = '早班空闲' 或 '晚班空闲'（根据教练班次）
   d. 写入操作日志
3. 写入 cron_log (status=success, result=处理条数)
4. 异常时写入 cron_log (status=failed, error=错误信息)
```

**`handleSyncRewardPenalty()` 逻辑**：

```
1. 确定同步日期范围（前一天 00:00:00 ~ 23:59:59）
2. 遍历奖罚类型:
   - 未约客罚金
   - 漏单罚金
   - 漏卡罚金
   - 助教日常
3. 对每个类型，从对应数据源计算金额:
   a. 未约客罚金: 查询 attendance_records + coaches 表，
      统计昨天未约客（未打卡/未上桌）的助教，按规则计算罚金
   b. 漏单罚金: 查询 service_orders/orders，统计昨天漏单的助教
   c. 漏卡罚金: 查询 attendance_records，统计昨天漏打卡的助教
   d. 助教日常: 查询 system_config 中的助教日常奖罚规则
4. 对每条奖罚记录:
   a. 先去重查询: SELECT id FROM reward_penalties 
                   WHERE confirm_date = ? AND type = ? AND phone = ?
   b. 如果已存在 → 跳过（写入 cron_log detail 标记 skipped）
   c. 如果不存在 → INSERT INTO reward_penalties
5. 写入 cron_log (status=success, result=新增数/跳过数)
```

> **注意**: 具体的罚金计算规则需要在实现时与业务确认。
> 当前设计方案中，计算逻辑通过可配置的规则函数实现，方便后续调整。

#### 3.3.3 `routes/system-report.js` - 系统报告 API

```
GET  /api/system-report/timers
  参数: type, days
  返回: 计时器状态 + 近期日志

GET  /api/system-report/timer-log
  参数: type, event, startDate, endDate, page, pageSize
  返回: 计时器日志列表 + 总数

GET  /api/system-report/cron-jobs
  返回: 所有 cron 任务配置和状态

GET  /api/system-report/cron-log
  参数: job, status, startDate, endDate, page, pageSize
  返回: cron 执行日志列表 + 总数

POST /api/system-report/cron-jobs/:name/run
  手动触发指定 cron 任务

PUT  /api/system-report/cron-jobs/:name/toggle
  启用/禁用指定 cron 任务
```

### 3.4 前后端交互流程

#### 3.4.1 计时器生命周期

```
[助教提交乐捐报备]
  → lejuan-records.js 路由
    → timerManager.schedule({
        timerType: 'lejuan',
        recordId: 新记录ID,
        execTime: scheduled_start_time,
        coachNo: coach.coach_no,
        stageName: coach.stage_name
      })

[服务启动]
  → server.js 启动
    → timerManager.init()
      → recoverTimers() 从 DB 恢复
      → 启动 pollCheck() 每分钟检查

[定时器触发]
  → timerManager.execute()
    → 路由到对应处理函数
    → 更新业务表
    → 写入 timer_log

[Admin 页面查看]
  → system-report.html 加载
    → GET /api/system-report/timers
    → GET /api/system-report/timer-log
    → 渲染表格 + 状态卡片
```

#### 3.4.2 cron 执行流程

```
[每分钟 tick]
  → cronScheduler._tick()
    → 遍历所有已注册任务
    → 检查 now >= nextRunTime && task.isEnabled
    → 到达执行时间 → 执行任务

[任务执行]
  → cronScheduler.runJob(jobName)
    → 写入 cron_log (status='running')
    → 执行 handler 函数
    → 成功 → 更新 cron_log (status='success', result_summary)
    → 失败 → 更新 cron_log (status='failed', error_message)
    → 计算 nextRunTime

[Admin 页面查看]
  → GET /api/system-report/cron-jobs
  → GET /api/system-report/cron-log
  → 渲染任务卡片 + 执行日志表格
```

### 3.5 Admin 页面设计 (`system-report.html`)

**页面布局**：

```
┌─────────────────────────────────────────────────┐
│ 📊 系统报告                                      │
├─────────────────────────────────────────────────┤
│ [计时器概览]                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ 活跃计时 │ │ 今日执行 │ │ 待执行   │        │
│  │    3     │ │    12    │ │    5     │        │
│  └──────────┘ └──────────┘ └──────────┘        │
│                                                 │
│ [计时器列表]                                    │
│ 类型 | 关联ID | 助教 | 计划时间 | 状态 | 操作  │
│ ───────────────────────────────────────────── │
│ 乐捐 | 123    | 张三 | 14:00   | 待执行│ 取消  │
│ 申请 | 456    | 李四 | 明天12点│ 已恢复│ -     │
│                                                 │
├─────────────────────────────────────────────────┤
│ [Cron 任务状态]                                 │
│  ┌──────────────────┬────────┬─────────────┐   │
│  │ 任务名           │ 状态   │ 下次执行    │   │
│  ├──────────────────┼────────┼─────────────┤   │
│  │ 自动结束乐捐     │ ✅启用 │ 明天 02:00  │   │
│  │ 奖罚自动同步     │ ✅启用 │ 今天 12:00  │   │
│  └──────────────────┴────────┴─────────────┘   │
│                                                 │
│ [执行日志]  [筛选: 全部/成功/失败] [刷新]       │
│ 时间    | 任务       | 状态 | 耗时 | 结果摘要 │
│ ───────────────────────────────────────────── │
│ 04-19 02:00 | 自动结束乐捐 | ✅ | 1.2s | 结束3条│
│ 04-19 12:00 | 奖罚同步    | ✅ | 2.5s | 新增2条│
└─────────────────────────────────────────────────┘
```

### 3.6 server.js 变更

#### 3.6.1 初始化部分

```javascript
// 删除旧的 lejuan-timer 和 application-timer 直接调用
// 改为:
const timerManager = require('./services/timer-manager');
const cronScheduler = require('./services/cron-scheduler');

app.listen(PORT, () => {
  // ... 现有代码 ...
  
  // 初始化公共计时器管理器
  timerManager.init();
  
  // 初始化 cron 调度器
  cronScheduler.init();
});
```

#### 3.6.2 路由注册

```javascript
// 系统报告路由（在 authMiddleware 之后注册）
app.use(authMiddleware, require('./routes/system-report'));
```

#### 3.6.3 删除旧 cron

```javascript
// 删除 server.js 中第 4706-4725 行的 setInterval cleanOldDeviceVisits
// 改为注册到 cron-scheduler:
cronScheduler.register({
  jobName: 'clean_old_data',
  displayName: '清理90天前数据',
  cronExpression: '0 3 * * *',
  handler: cleanOldDeviceVisits
});
```

#### 3.6.4 删除旧的定时器初始化

```javascript
// 删除:
// require('./services/lejuan-timer').init();
// require('./services/application-timer').init();
```

### 3.7 sidebar.js 变更

```javascript
var MENU_CONFIG = [
  // ... 现有菜单 ...
  // 【系统】
  { label: '系统报告', icon: '📊', href: 'system-report.html', group: '系统' },
  // ...
];
```

---

## 四、边界情况和异常处理

### 4.1 计时器相关

| 场景 | 处理方式 |
|------|----------|
| 服务重启后 execTime 已过 | 立即执行（recovery 逻辑中 delay<=0 时 execute） |
| 服务重启后 execTime 未到 | 重新注册 setTimeout |
| 定时器执行失败 | 捕获异常，写入 timer_log (event='error')，不阻断其他定时器 |
| 同一 recordId 重复注册 | 检查 timers Map 中是否已存在，存在则跳过 |
| 轮询发现已执行过的记录 | 通过 scheduled=1 标记跳过 |
| 系统时钟跳变 | pollCheck 兜底，每分钟检查一次 |
| DB 写入失败 | 写入文件日志 + console.error，不阻断定时器执行 |

### 4.2 cron 相关

| 场景 | 处理方式 |
|------|----------|
| 任务执行中（上次未结束） | 跳过本次执行，记录 skipped |
| 任务执行失败 | 记录 error_message，下次正常执行 |
| 任务手动触发 | 不依赖 cron 时间，立即执行 |
| 服务重启后错过执行窗口 | 启动时检查 lastRunTime < 上次应该执行的时间 → 立即补执行（可选配置） |
| 奖罚数据去重 | `SELECT id FROM reward_penalties WHERE confirm_date=? AND type=? AND phone=?`，已存在则跳过 |
| 数据源查询为空 | 记录 0 条新增，status=success |

### 4.3 乐捐自动结束

| 场景 | 处理方式 |
|------|----------|
| active 记录但 water_board 不存在 | 只更新 lejuan_records，记录警告 |
| 教练已离职 | 跳过，记录警告 |
| 外出时长为 0 | 最小 1 小时（与现有乐捐归来逻辑一致） |

### 4.4 奖罚同步

| 场景 | 处理方式 |
|------|----------|
| 记录已存在（去重） | 跳过，记录 skipped 数量 |
| 找不到对应教练 | 记录警告，跳过该条 |
| 奖罚类型未配置 | 跳过该类型，记录警告 |

---

## 五、实现优先级

### Phase 1: 基础设施
1. 创建 `timer_log`、`cron_log`、`cron_tasks` 表（server.js 启动初始化 DDL）
2. 创建 `services/timer-manager.js`
3. 创建 `services/cron-scheduler.js`
4. 修改 `server.js` 初始化和路由注册

### Phase 2: 乐捐自动结束
5. 实现 `handleEndLejuan()` cron handler
6. 注册 `end_lejuan` cron 任务

### Phase 3: 奖罚自动同步
7. 实现 `handleSyncRewardPenalty()` cron handler
8. 注册 `sync_reward_penalty` cron 任务

### Phase 4: 前端页面
9. 创建 `admin/system-report.html`
10. 创建 `routes/system-report.js`
11. 修改 `admin/sidebar.js` 添加菜单

### Phase 5: 迁移旧定时器
12. 将 lejuan-timer 和 application-timer 迁移到 timer-manager
13. 删除旧的独立初始化调用

---

## 六、编码规范检查

| 规范项 | 遵守方式 |
|--------|----------|
| 时间处理 | 所有时间使用 `TimeUtil.nowDB()` / `TimeUtil.offsetDB()` / `TimeUtil.todayStr()` |
| 数据库连接 | `const { all, get, enqueueRun, runInTransaction } = require('../db');` |
| 数据库写入 | 使用 `await enqueueRun(...)` 和 `await runInTransaction(...)` |
| 页面显示 | 只显示 `employee_id`，不显示 `coach_no` |
| 禁止裸开事务 | 不使用 `db.run('BEGIN TRANSACTION')` |
| 禁止手动时区偏移 | 不使用 `new Date().getTime() + 8*60*60*1000` |

---

## 七、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| timer-manager 与现有定时器冲突 | 乐捐/申请定时功能异常 | Phase 5 迁移前保留旧逻辑，逐步替换 |
| cron 任务执行时间过长阻塞 | 后续任务延迟 | 每个 handler 内设置超时，超时记录失败 |
| DB 写入队列拥堵 | timer_log/cron_log 写入延迟 | 日志写入使用 enqueueRun，不阻塞主流程 |
| 奖罚同步规则不明确 | 金额计算错误 | 与业务确认规则后再实现 Phase 3 |

```

## 审计检查清单
# 代码审计检查清单

## 编码规范检查（自动化）

运行 `check-style.js` 脚本，检查：

| 规则ID | 检查项 | 禁止 | 必须 |
|--------|--------|------|------|
| TIME | 时间处理 | `datetime('now')`、手动时区偏移 | `TimeUtil` |
| DB_CONN | 数据库连接 | `new sqlite3.Database()` | `db/index.js` |
| DB_WRITE | 数据库写入 | 裸开事务 | `writeQueue` |

## 人工审计检查项

### 逻辑正确性

- [ ] API路径、方法、参数与设计方案一致
- [ ] 数据库字段名、类型与设计一致
- [ ] 业务逻辑分支完整（if/else覆盖所有情况）
- [ ] 边界值处理（空值、最大值、最小值）

### 安全性

- [ ] 输入验证（参数类型、长度、范围）
- [ ] SQL注入防护（参数化查询）
- [ ] 权限校验（用户身份验证）

### 错误处理

- [ ] API错误有明确的错误码和消息
- [ ] 数据库操作有try/catch
- [ ] 异常情况有fallback处理

### 代码质量

- [ ] 变量命名清晰
- [ ] 函数单一职责
- [ ] 无死代码（未使用的变量/函数）
- [ ] Git提交信息描述清晰

### 前后端一致性

- [ ] API请求/响应格式前后端匹配
- [ ] 前端字段名与后端返回一致
- [ ] 错误处理前后端对齐


## 输出要求
1. 审计结果：通过/不通过
2. 如不通过，列出具体问题（对应检查清单的哪些项）
3. 如果通过，提取设计摘要（改了什么文件、新增什么API、数据表变更等）

这是第 1/3 次审计。