你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
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

### 2.6 自动关灯/关空调
- **`executeAutoOffLighting()`** (`auto-off-lighting.js`): 返回 `{ status, maybeOffCount, cannotOffCount, turnedOffCount }`
- **`executeAutoOffAC()`** (`auto-off-ac.js`): 返回同上格式

---

## 三、数据库变更

### 3.1 无需新建表

所有必要的表已存在：

| 表名 | 状态 | 说明 |
|------|------|------|
| `cron_log` | ✅ 已有 | 记录 cron 执行历史 |
| `cron_tasks` | ✅ 已有 | 记录 cron 任务配置 |
| `notifications` | ✅ 已有 | 已有 `notification_type` 和 `error_type` 字段 |
| `notification_recipients` | ✅ 已有 | 记录通知接收者 |

### 3.2 无需修改表结构

所有字段均已存在（`error_type` 在 QA-20260429-2 中已添加）。

---

## 四、后端改造

### 4.1 修改 `POST /api/admin/sync/tables`（server.js）

**文件**: `backend/server.js`，约第 4668-4740 行

**修改内容**:

1. 引入 `logCron` 和通知函数：
```javascript
const { logCron } = require('./services/cron-scheduler');
const { sendSystemNotificationToAdmins } = require('./routes/notifications');
```

2. 同步成功后，在返回 response 之前，增加写 Cron 日志逻辑：

```javascript
// 原有代码：触发自动关灯/关空调
const autoOffResult = await triggerAutoOffIfEligible(result.tablesUpdated, result.vipRoomsUpdated);
const autoOffACResult = await triggerAutoOffACIfEligible(result.tablesUpdated, result.vipRoomsUpdated);

// === 新增：计算开台数量 ===
const openCount = tables.filter(t => t.status === '接待中').length;

// === 新增：获取自动关灯/关空调数量 ===
const autoOffLightCount = (autoOffResult && autoOffResult.triggered && autoOffResult.turnedOffCount) || 0;
const autoOffACCount = (autoOffACResult && autoOffACResult.triggered && autoOffACResult.turnedOffCount) || 0;

// === 新增：写入 Cron 日志 ===
const now = TimeUtil.nowDB();
const details = JSON.stringify({
  tablesCount: tables.length,
  tablesUpdated: result.tablesUpdated,
  vipRoomsUpdated: result.vipRoomsUpdated,
  openCount: openCount,
  autoOffLightCount: autoOffLightCount,
  autoOffACCount: autoOffACCount,
  autoOffTriggered: autoOffResult.triggered,
  autoOffACTriggered: autoOffACResult.triggered
});

await logCron(
  'table_sync',      // task_name
  'table_sync',      // task_type
  'success',         // status
  result.tablesUpdated, // records_affected
  details,           // details (JSON 格式)
  null,              // error
  now,               // started_at
  now                // finished_at
);
```

### 4.2 新增 `POST /api/admin/sync/tables/error` 接口（server.js）

**文件**: `backend/server.js`，在现有 `POST /api/admin/sync/tables` 之后添加

**接口说明**: 由宿主机同步脚本在失败时调用，写入 cron_log 并发送系统通知

```javascript
// 台桌同步错误上报接口（无需认证，由同步脚本调用）
app.post('/api/admin/sync/tables/error', async (req, res) => {
  try {
    const { error_message, tablesCount, elapsedMs } = req.body;

    if (!error_message) {
      return res.status(400).json({ error: '缺少错误信息' });
    }

    const now = TimeUtil.nowDB();
    const details = JSON.stringify({
      tablesCount: tablesCount || 0,
      elapsedMs: elapsedMs || 0,
      source: 'sync-tables-status.js'
    });

    // 写入 Cron 日志（status='failed'）
    await logCron(
      'table_sync',
      'table_sync',
      'failed',
      0,
      details,
      error_message.substring(0, 500), // 截断过长错误信息
      now,
      now
    );

    // 发送系统通知给所有管理员
    try {
      await sendSystemNotificationToAdmins(
        '台桌状态同步异常',
        `台桌状态同步失败，错误：${error_message.substring(0, 200)}`,
        'table_sync_error'
      );
    } catch (notifyErr) {
      logger.error(`发送同步异常通知失败: ${notifyErr.message}`);
    }

    res.json({ success: true });
  } catch (err) {
    logger.error(`台桌同步错误上报失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});
```

**注意**: 此接口放在 `authMiddleware` 之前（或在 authMiddleware 应用前注册），因为同步脚本运行在宿主机上，没有认证 token。具体位置需确保在 `app.use(authMiddleware)` 之前或单独处理。

### 4.3 修改 `GET /api/system-report/cron-logs`（system-report.js）

**文件**: `backend/routes/system-report.js`，约第 91-120 行

**修改内容**: 增加 `taskType` 查询参数过滤

```javascript
router.get('/cron-logs', async (req, res) => {
    try {
        const { taskName, taskType, status, limit = 50 } = req.query;

        let sql = 'SELECT * FROM cron_log WHERE 1=1';
        const params = [];

        if (taskName) {
            sql += ' AND (task_name = ? OR task_type = ?)';
            params.push(taskName, taskName);
        }
        if (taskType) {
            sql += ' AND task_type = ?';
            params.push(taskType);
        }
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        sql += ' ORDER BY id DESC LIMIT ?';
        params.push(parseInt(limit) || 50);

        const logs = await all(sql, params);

        res.json({
            success: true,
            logs,
            total: logs.length
        });
    } catch (err) {
        console.error(`Cron 日志查询失败: ${err.message}`);
        res.status(500).json({ error: '服务器错误' });
    }
});
```

### 4.4 新增通知辅助函数 `sendSystemNotificationToAdmins`（notifications.js）

**文件**: `backend/routes/notifications.js`，在 `module.exports` 之前添加

**函数签名**:
```javascript
/**
 * 发送系统通知给所有管理员
 * @param {string} title - 通知标题
 * @param {string} content - 通知内容
 * @param {string} errorType - 错误类型: 'table_sync_error' | 'cron_error' | 'timer_error'
 * @returns {Promise<{notificationId, recipientCount}>}
 */
async function sendSystemNotificationToAdmins(title, content, errorType)
```

**实现**:

```javascript
async function sendSystemNotificationToAdmins(title, content, errorType) {
  const { dbAll, enqueueRun, runInTransaction } = require('../db');
  const TimeUtil = require('../utils/time');

  // 1. 查询所有管理员（role IN ('店长', '助教管理', '管理员')）
  const admins = await dbAll(`
    SELECT username, name, role
    FROM admin_users
    WHERE role IN ('店长', '助教管理', '管理员')
    LIMIT 50
  `);

  if (!admins || admins.length === 0) {
    console.warn('[SystemNotification] 无管理员用户，跳过通知');
    return { notificationId: null, recipientCount: 0 };
  }

  const now = TimeUtil.nowDB();

  // 2. 创建通知记录
  const notificationId = await runInTransaction(async (tx) => {
    const result = await tx.run(`
      INSERT INTO notifications (title, content, sender_type, sender_id, sender_name, 
                                 notification_type, error_type, created_at, total_recipients)
      VALUES (?, ?, 'system', 'system', '系统', ?, ?, ?, ?)
    `, [title, content, 'system', errorType, now, admins.length]);

    const nid = result.lastID;

    // 3. 批量插入接收者记录
    for (const admin of admins) {
      await tx.run(`
        INSERT INTO notification_recipients (notification_id, recipient_type, recipient_id, 
                                             recipient_name, recipient_employee_id)
        VALUES (?, 'admin', ?, ?, NULL)
      `, [nid, admin.username, admin.name || admin.username]);
    }

    return nid;
  });

  console.log(`[SystemNotification] 发送系统通知(${errorType})给 ${admins.length} 位管理员, ID: ${notificationId}`);
  return { notificationId, recipientCount: admins.length };
}
```

**导出**（在 `module.exports = router;` 之后添加）:
```javascript
module.exports.sendSystemNotificationToAdmins = sendSystemNotificationToAdmins;
```

### 4.5 修改 cron-scheduler.js 错误处理

**文件**: `backend/services/cron-scheduler.js`

**修改内容**: 在各 cron 任务的 catch 块中添加通知发送

#### 4.5.1 在文件头部引入通知函数

```javascript
const { sendSystemNotificationToAdmins } = require('../routes/notifications');
```

#### 4.5.2 `taskEndLejuan` 的 catch 块

**位置**: `taskEndLejuan` 函数末尾的 catch 块（约第 290-300 行）

```javascript
} catch (err) {
    const finishedAt = TimeUtil.nowDB();
    console.error('[CronScheduler] end_lejuan 失败:', err);

    await logCron(
        taskName, taskType, 'failed', 0, null,
        err.message, startedAt, finishedAt
    );

    await updateTaskStatus(taskName, {
        lastRun: finishedAt,
        lastStatus: 'failed',
        lastError: err.message
    });

    // === 新增：发送系统通知 ===
    try {
        await sendSystemNotificationToAdmins(
            'Cron任务执行异常',
            `定时任务 ${taskName} (${taskType}) 执行失败: ${err.message.substring(0, 200)}`,
            'cron_error'
        );
    } catch (notifyErr) {
        console.error('[CronScheduler] 发送异常通知失败:', notifyErr.message);
    }
}
```

#### 4.5.3 `taskSyncRewardPenalty` 的 catch 块

**位置**: `taskSyncRewardPenalty` 函数末尾的 catch 块

```javascript
} catch (err) {
    const finishedAt = TimeUtil.nowDB();
    console.error('[CronScheduler] sync_reward_penalty 失败:', err);

    await logCron(
        taskName, taskType, 'failed', 0, null,
        err.message, startedAt, finishedAt
    );

    await updateTaskStatus(taskName, {
        lastRun: finishedAt,
        lastStatus: 'failed',
        lastError: err.message
    });

    // === 新增：发送系统通知 ===
    try {
        await sendSystemNotificationToAdmins(
            'Cron任务执行异常',
            `定时任务 ${taskName} 执行失败: ${err.message.substring(0, 200)}`,
            'cron_error'
        );
    } catch (notifyErr) {
        console.error('[CronScheduler] 发送异常通知失败:', notifyErr.message);
    }
}
```

#### 4.5.4 其他 cron 任务的 catch 块

对以下任务同样添加通知发送（模式同上）:
- `taskLockGuestInvitation` (lock_guest_invitation_morning / lock_guest_invitation_evening)
- `taskGuestRanking` (guest_ranking_morning / guest_ranking_evening / guest_ranking_midnight)
- `taskAutoOffTableIndependentLight` (auto_off_table_independent_light)
- `taskAutoOffTableIndependentAC` (auto_off_table_independent_ac)
- `taskResetWaterBoardStatus` (reset_water_board_status)

> **实现建议**: 由于所有任务都使用相同的 catch 模式，可考虑抽取一个通用的 `notifyCronError(taskName, taskType, error, startedAt)` 函数减少重复代码。

### 4.6 修改 timer-manager.js 错误处理

**文件**: `backend/services/timer-manager.js`

#### 4.6.1 在文件头部引入

```javascript
const { sendSystemNotificationToAdmins } = require('../routes/notifications');
```

#### 4.6.2 修改 `executeTimer` 函数的 catch 块

**位置**: `executeTimer` 函数（约第 68-80 行）

```javascript
async function executeTimer(timerId, timerType, recordId, callback) {
    const timerInfo = activeTimers[timerId];
    const scheduledTime = timerInfo ? timerInfo.execTime : null;
    const coachInfo = timerInfo ? timerInfo.coachInfo : {};
    const now = new Date(TimeUtil.nowDB() + '+08:00');
    const delayMs = scheduledTime ? now.getTime() - new Date(scheduledTime + '+08:00').getTime() : undefined;

    try {
        await callback(recordId);
        await logTimer(timerId, timerType, recordId, 'execute', {
            scheduledTime,
            delayMs: delayMs !== undefined ? delayMs : undefined
        });
        console.log(`[TimerManager] ${timerType} 计时器 ${timerId} 执行成功`);
    } catch (err) {
        await logTimer(timerId, timerType, recordId, 'execute', {
            status: 'failed',
            scheduledTime,
            delayMs: delayMs !== undefined ? delayMs : undefined,
            error: err.message
        });
        console.error(`[TimerManager] ${timerType} 计时器 ${timerId} 执行失败:`, err);

        // === 新增：发送系统通知 ===
        try {
            const coachDesc = coachInfo.stage_name
                ? `（助教: ${coachInfo.stage_name}${coachInfo.employee_id ? ', 工号: ' + coachInfo.employee_id : ''}）`
                : '';
            await sendSystemNotificationToAdmins(
                '计时器任务执行异常',
                `计时器 ${timerId} (${timerType}) 执行失败: ${err.message.substring(0, 200)}${coachDesc}`,
                'timer_error'
            );
        } catch (notifyErr) {
            console.error('[TimerManager] 发送异常通知失败:', notifyErr.message);
        }
    }

    delete activeTimers[timerId];
}
```

> **说明**: `executeApplicationStart` 和 `executeLejuanActivation` 函数内部的 catch 块不修改，因为它们的异常不会传播到 `executeTimer`。只在 `executeTimer` 的 catch 中添加通知即可捕获所有计时器执行失败。

---

## 五、同步脚本改造

### 5.1 修改 `sync-tables-status.js`

**文件**: `scripts/sync-tables-status.js`

#### 5.1.1 修改 main() 函数的 catch 块

**位置**: main() 函数末尾的 catch 块

```javascript
} catch (err) {
    const elapsed = Date.now() - startTime;
    writeSyncStatus(false, 0, err.message);
    
    // === 新增：调用错误上报接口 ===
    try {
        const apiUrl = process.env.TGSERVICE_API_URL || 'http://127.0.0.1:8081';
        await fetch(`${apiUrl}/api/admin/sync/tables/error`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error_message: err.message,
                tablesCount: 0,
                elapsedMs: elapsed
            })
        });
    } catch (reportErr) {
        log(`错误上报失败: ${reportErr.message}`);
    }
    
    // 原有错误日志...
}
```

#### 5.1.2 修改成功分支

**位置**: main() 函数成功分支，调用 API 后

**方案 A**（推荐）: 不改脚本，由 API 端负责写 cron_log。脚本只需确保调用 `POST /api/admin/sync/tables` 即可。

**方案 B**（如需脚本也感知结果）: 在脚本调用 API 后，解析返回值获取自动关灯/关空调数量。但由于当前脚本的 `updateDatabase()` 是本地写库而非调 API，需要统一改为调用 API。

> **结论**: 采用方案 A。当前脚本直接写本地 DB 的逻辑属于历史遗留（Turso 云端 DB 是正式数据源），cron_log 写入由 API 端（`POST /api/admin/sync/tables`）负责，与数据更新在同一事务上下文中。

---

## 六、前端改造

### 6.1 修改 `admin/system-report.html`

**文件**: `admin/system-report.html`

#### 6.1.1 Cron 日志 tab 增加筛选条件

在 Cron 日志 tab 的筛选栏中，增加 `task_type` 下拉筛选：

```html
<!-- 在现有筛选栏中添加 -->
<select id="cronLogTaskTypeFilter" onchange="filterCronLogs()">
    <option value="">全部类型</option>
    <option value="table_sync">台桌同步</option>
    <option value="end_lejuan">结束乐捐</option>
    <option value="sync_reward_penalty">奖罚同步</option>
    <option value="lock_guest_invitation">锁定应约客</option>
    <option value="guest_ranking">门迎排序</option>
    <option value="auto_off_table_independent">自动关灯/空调</option>
    <option value="reset_water_board_status">水牌状态重置</option>
</select>
```

#### 6.1.2 修改 `filterCronLogs()` 函数

```javascript
function filterCronLogs() {
    const taskName = document.getElementById('cronLogTaskFilter').value;
    const taskType = document.getElementById('cronLogTaskTypeFilter').value;
    const status = document.getElementById('cronLogStatusFilter').value;
    
    let url = '/api/system-report/cron-logs?';
    const params = [];
    if (taskName) params.push(`taskName=${encodeURIComponent(taskName)}`);
    if (taskType) params.push(`taskType=${encodeURIComponent(taskType)}`);
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    url += params.join('&');
    
    // 发送请求并渲染表格...
}
```

#### 6.1.3 渲染 cron 日志时展示 details 中的关键数据

对于 `task_type = 'table_sync'` 的记录，解析 `details` JSON 字段，在表格中额外展示：
- 开台数量（`openCount`）
- 自动关灯数量（`autoOffLightCount`）
- 自动关空调数量（`autoOffACCount`）

```javascript
// 渲染函数中
if (log.task_type === 'table_sync' && log.details) {
    try {
        const d = JSON.parse(log.details);
        detailsHtml += ` | 开台: ${d.openCount || 0} | 关灯: ${d.autoOffLightCount || 0} | 关空调: ${d.autoOffACCount || 0}`;
    } catch (e) {}
}
```

---

## 七、error_type 枚举定义

| error_type | 说明 | 触发场景 |
|------------|------|----------|
| `table_sync_error` | 台桌状态同步异常 | `POST /api/admin/sync/tables/error` 被调用 |
| `cron_error` | Cron 批任务执行异常 | cron-scheduler 中任一任务 catch |
| `timer_error` | 计时器执行异常 | timer-manager 中 executeTimer catch |

---

## 八、接口变更汇总

| 接口 | 类型 | 说明 |
|------|------|------|
| `POST /api/admin/sync/tables` | **修改** | 成功后增加写 cron_log |
| `POST /api/admin/sync/tables/error` | **新增** | 同步失败上报接口，写 cron_log + 发通知 |
| `GET /api/system-report/cron-logs` | **修改** | 增加 `taskType` 参数过滤 |
| `POST /api/notifications/manage/send` | 不变 | 已有，本次不使用 |

---

## 九、文件变更汇总

| 文件 | 变更类型 | 变更内容 |
|------|----------|----------|
| `backend/server.js` | **修改** | sync/tables 成功时写 cron_log |
| `backend/server.js` | **新增** | sync/tables/error 接口 |
| `backend/routes/system-report.js` | **修改** | cron-logs 增加 taskType 过滤 |
| `backend/routes/notifications.js` | **新增** | sendSystemNotificationToAdmins 函数 |
| `backend/services/cron-scheduler.js` | **修改** | 各任务 catch 块添加通知发送 |
| `backend/services/timer-manager.js` | **修改** | executeTimer catch 块添加通知发送 |
| `admin/system-report.html` | **修改** | Cron 日志 tab 增加筛选、展示开台/关灯数量 |

---

## 十、边界情况和异常处理

### 10.1 台桌同步
- **同步成功但自动关灯/关空调失败**: cron_log 仍记 success，details 中 `autoOffTriggered: true` 但 `turnedOffCount: 0`
- **tables 为空数组**: API 返回 400，脚本不写 cron_log
- **同步失败但错误上报接口也失败**: 脚本本地日志仍写入 `sync-tables-status.log`，作为兜底

### 10.2 系统通知
- **无管理员用户**: 函数返回 `{ recipientCount: 0 }`，不报错，console.warn 提示
- **通知发送失败**: 外层 catch 捕获，console.error 记录，不影响主流程
- **error_message 过长**: 截断至 500 字符（cron_log.error 字段）/ 200 字符（通知内容）
- **并发通知**: 多个异常同时触发时，各自独立发送通知，不做去重（符合预期，每个异常都应通知）

### 10.3 Cron 日志
- **details 字段**: 使用 JSON 格式存储，解析失败时前端优雅降级（不展示额外数据）
- **所有查询 LIMIT 上限 50**: 严格遵守

### 10.4 计时器通知
- **coachInfo 缺失**: 通知内容中不包含助教信息，仅显示 timerId 和错误信息
- **通知发送失败不影响计时器**: try-catch 包裹，通知失败仅 console.error

---

## 十一、测试用例建议

| # | 场景 | 预期结果 |
|---|------|----------|
| 1 | 台桌同步成功（≥40条） | cron_log 写入 success，details 含 openCount/autoOffLightCount/autoOffACCount |
| 2 | 台桌同步成功（<40条） | cron_log 写入 success，autoOffLightCount=0, autoOffACCount=0 |
| 3 | 台桌同步失败，调用 error 接口 | cron_log 写入 failed，通知发送给管理员 |
| 4 | 台桌同步失败，error 接口不可达 | cron_log 不写入，脚本本地日志存在 |
| 5 | cron 任务执行失败 | cron_log 写入 failed，通知发送给管理员 |
| 6 | 计时器执行失败 | timer_log 写入 failed，通知发送给管理员 |
| 7 | Admin 后台筛选台桌同步日志 | task_type=table_sync 仅显示台桌同步相关日志 |
| 8 | 管理员查看通知列表 | 能看到 notification_type=system 的系统通知 |
| 9 | 无管理员用户时发送通知 | 不报错，recipientCount=0 |

```

## 审计检查清单
# 代码审计检查清单

## 编码规范检查（自动化）

运行 `check-style.js` 脚本，检查：

| 规则ID | 检查项 | 禁止 | 必须 |
|--------|--------|------|------|
| TIME | 时间处理 | `datetime('now')`、手动时区偏移 | `TimeUtil` |
| DB_CONN | 数据库连接 | `new sqlite3.Database()` | `db/index.js`（连接 Turso 云端 DB） |
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

这是第 2/3 次审计。