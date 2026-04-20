你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
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
| `executeTimer(timerId, timerType, recordId, callback)` | 通用定时器回调执行 |
| `getActiveCount()` | 活跃定时器数量 |
| `getCountByType(type)` | 按类型计数 |
| `getActiveTimers()` | 获取活跃定时器基础信息 |

### 3.2 修改的方法

#### 3.2.1 `createTimer` — 扩展参数，记录 coachInfo

**当前签名**：
```javascript
function createTimer(timerId, timerType, recordId, execTime, callback)
```

**新签名**：
```javascript
function createTimer(timerId, timerType, recordId, execTime, callback, coachInfo = {})
```

**`coachInfo` 结构**：
```javascript
{
  coach_no:      'C001',       // 教练编号（内部使用，不显示在页面）
  employee_id:   'TG001',      // 助教工号（页面显示用）
  stage_name:    '3号台',      // 台桌名称
  application_type: '休息申请' // 仅 application 类型需要
}
```

**`activeTimers` 存储扩展**：
```javascript
activeTimers[timerId] = {
    timerId: timerObj,
    type: timerType,
    recordId: recordId,
    execTime: execTime,
    coachInfo: coachInfo          // 新增：完整助教信息
};
```

**向后兼容**：`coachInfo` 为可选参数，不传时为 `{}`，不影响现有调用。

#### 3.2.2 `getActiveTimers` / `getActiveTimersWithDetails` — 直接读取 coachInfo

**改动**：由于 `activeTimers` 已存储 `coachInfo`，`getActiveTimers()` 直接返回 coachInfo 信息。`getActiveTimersWithDetails()` 中的 `enrichLejuanTimer` / `enrichApplicationTimer` 方法降级为**兜底查询**（仅当内存中无 coachInfo 时才查库）。

### 3.3 新增方法（从旧服务迁入并重构）

#### 3.3.1 `scheduleApplicationTimer(record, coachInfo)` — 注册申请定时器

```javascript
/**
 * 注册申请定时器（替代 applicationTimer.addNewRecord）
 * @param {object} record - 申请记录
 *   - id: 申请ID
 *   - exec_time: 执行时间 "YYYY-MM-DD HH:MM:SS"
 *   - application_type: "休息申请" | "请假申请"
 * @param {object} coachInfo - 助教信息
 *   - coach_no, employee_id, stage_name
 */
function scheduleApplicationTimer(record, coachInfo) {
    const timerId = `application_${record.id}`;
    createTimer(timerId, 'application', record.id, record.exec_time, executeApplicationRecovery, coachInfo);
}
```

#### 3.3.2 `scheduleLejuanTimer(record, coachInfo)` — 注册乐捐定时器

```javascript
/**
 * 注册乐捐定时器（替代 lejuanTimer.addNewRecord）
 * @param {object} record - 乐捐记录（含 scheduled_start_time）
 * @param {object} coachInfo - 助教信息
 *   - coach_no, employee_id, stage_name
 */
function scheduleLejuanTimer(record, coachInfo) {
    const timerId = `lejuan_${record.id}`;
    createTimer(timerId, 'lejuan', record.id, record.scheduled_start_time, executeLejuanActivation, coachInfo);
}
```

#### 3.3.3 `cancelApplicationTimer(applicationId)` — 取消申请定时器

```javascript
function cancelApplicationTimer(applicationId) {
    cancelTimer(`application_${applicationId}`);
}
```

#### 3.3.4 `cancelLejuanTimer(recordId)` — 取消乐捐定时器

```javascript
function cancelLejuanTimer(recordId) {
    cancelTimer(`lejuan_${recordId}`);
}
```

#### 3.3.5 `executeApplicationRecovery(applicationId)` — 迁移自 application-timer.js

**完整逻辑**（从 `application-timer.js::executeRecovery` 迁移）：

```javascript
async function executeApplicationRecovery(applicationId) {
    try {
        await runInTransaction(async (tx) => {
            // 1. 查询申请记录
            const application = await tx.get(
                'SELECT * FROM applications WHERE id = ? AND status = 1',
                [applicationId]
            );
            if (!application) {
                console.log(`[TimerManager] 申请记录 ${applicationId} 已无效，跳过`);
                return;
            }

            // 2. 查询教练信息
            const coach = await tx.get(
                'SELECT coach_no, stage_name, shift FROM coaches WHERE employee_id = ? OR phone = ?',
                [application.applicant_phone, application.applicant_phone]
            );
            if (!coach) {
                console.log(`[TimerManager] 教练不存在，跳过 ${applicationId}`);
                return;
            }

            // 3. 查询水牌
            const waterBoard = await tx.get(
                'SELECT * FROM water_boards WHERE coach_no = ?',
                [coach.coach_no]
            );
            if (!waterBoard) {
                console.log(`[TimerManager] 水牌不存在，跳过 ${applicationId}`);
                return;
            }

            // 4. 恢复水牌状态
            const newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
            const now = TimeUtil.nowDB();
            await tx.run(
                'UPDATE water_boards SET status = ?, updated_at = ? WHERE coach_no = ?',
                [newStatus, now, coach.coach_no]
            );

            // 5. 标记 executed=1
            const extraData = JSON.parse(application.extra_data || '{}');
            extraData.executed = 1;
            await tx.run(
                'UPDATE applications SET extra_data = ?, updated_at = ? WHERE id = ?',
                [JSON.stringify(extraData), now, applicationId]
            );

            // 6. 写操作日志
            const { create: createOpLog } = require('./operation-log');
            await createOpLog(tx, {
                operator_phone: 'system',
                operator_name: '系统定时任务',
                operation_type: '申请定时恢复',
                target_type: 'water_board',
                target_id: waterBoard.id,
                old_value: JSON.stringify({ status: waterBoard.status }),
                new_value: JSON.stringify({ status: newStatus }),
                remark: `${application.application_type}定时结束，${coach.stage_name}恢复为${newStatus}`
            });
        });

        console.log(`[TimerManager] 申请 ${applicationId} 恢复执行完成`);
    } catch (err) {
        console.error(`[TimerManager] 申请 ${applicationId} 恢复失败:`, err);
    }
}
```

#### 3.3.6 `executeLejuanActivation(recordId)` — 迁移自 lejuan-timer.js

**完整逻辑**（从 `lejuan-timer.js::activateLejuan` 迁移）：

```javascript
async function executeLejuanActivation(recordId) {
    let stageName = '未知';
    try {
        await runInTransaction(async (tx) => {
            const record = await tx.get(
                'SELECT * FROM lejuan_records WHERE id = ? AND lejuan_status = ?',
                [recordId, 'pending']
            );
            if (!record) {
                console.log(`[TimerManager] 乐捐记录 ${recordId} 已不是 pending，跳过`);
                return;
            }

            stageName = record.stage_name || '未知';
            const now = TimeUtil.nowDB();

            // 1. 更新乐捐记录状态
            await tx.run(
                `UPDATE lejuan_records
                 SET lejuan_status = 'active',
                     actual_start_time = ?,
                     scheduled = 1,
                     updated_at = ?
                 WHERE id = ?`,
                [now, now, recordId]
            );

            // 2. 更新水牌状态
            const waterBoard = await tx.get(
                'SELECT * FROM water_boards WHERE coach_no = ?',
                [record.coach_no]
            );
            if (waterBoard) {
                await tx.run(
                    `UPDATE water_boards SET status = '乐捐', updated_at = ? WHERE coach_no = ?`,
                    [now, record.coach_no]
                );

                // 3. 写操作日志
                const { create: createOpLog } = require('./operation-log');
                await createOpLog(tx, {
                    operator_phone: 'system',
                    operator_name: '系统定时任务',
                    operation_type: '乐捐自动生效',
                    target_type: 'water_board',
                    target_id: waterBoard.id,
                    old_value: JSON.stringify({ status: waterBoard.status }),
                    new_value: JSON.stringify({ status: '乐捐' }),
                    remark: `乐捐报备自动生效（预约时间: ${record.scheduled_start_time}）`
                });
            }
        });

        console.log(`[TimerManager] 乐捐 ${recordId} 激活完成: ${stageName}`);
    } catch (err) {
        console.error(`[TimerManager] 乐捐 ${recordId} 激活失败:`, err);
    }
}
```

#### 3.3.7 `recoverApplicationTimers()` — 迁移并精简

```javascript
async function recoverApplicationTimers() {
    try {
        const pendingRecords = await all(`
            SELECT a.*, c.coach_no, c.stage_name, c.shift, w.status as water_status
            FROM applications a
            LEFT JOIN coaches c ON a.applicant_phone = c.employee_id OR a.applicant_phone = c.phone
            LEFT JOIN water_boards w ON c.coach_no = w.coach_no
            WHERE a.application_type IN ('休息申请', '请假申请')
                AND a.status = 1
                AND a.extra_data LIKE '%"timer_set":true%'
        `, []);

        console.log(`[TimerManager] 恢复申请定时器: 找到 ${pendingRecords.length} 条 timer_set=true 记录`);

        let scheduled = 0, executed = 0, skipped = 0;

        for (const record of pendingRecords) {
            try {
                const extraData = JSON.parse(record.extra_data || '{}');
                if (extraData.executed === 1) { skipped++; continue; }
                if (!extraData.exec_time) { skipped++; continue; }
                if (record.water_status && record.water_status !== '休息' && record.water_status !== '请假') {
                    extraData.executed = 1;
                    await enqueueRun('UPDATE applications SET extra_data = ? WHERE id = ?',
                        [JSON.stringify(extraData), record.id]);
                    skipped++;
                    continue;
                }

                const coachInfo = {
                    coach_no: record.coach_no,
                    employee_id: '',    // 恢复时从 coaches 表已有数据查不到 employee_id？——用 applicant_phone 再查一次
                    stage_name: record.stage_name,
                    application_type: record.application_type
                };
                // 补充 employee_id
                if (record.applicant_phone) {
                    const c = await get('SELECT employee_id FROM coaches WHERE employee_id = ? OR phone = ?',
                        [record.applicant_phone, record.applicant_phone]);
                    if (c) coachInfo.employee_id = c.employee_id || '-';
                }

                const timerId = `application_${record.id}`;
                createTimer(timerId, 'application', record.id, extraData.exec_time, executeApplicationRecovery, coachInfo);
                scheduled++;
            } catch (e) {
                console.error(`[TimerManager] 恢复申请记录 ${record.id} 失败:`, e);
            }
        }

        console.log(`[TimerManager] 申请定时器恢复: 调度 ${scheduled}, 跳过 ${skipped}`);
    } catch (err) {
        console.error('[TimerManager] 恢复申请定时器失败:', err);
    }
}
```

#### 3.3.8 `recoverLejuanTimers()` — 迁移并精简

```javascript
async function recoverLejuanTimers() {
    try {
        const now = TimeUtil.nowDB();
        const pendingRecords = await all(`
            SELECT lr.*, c.employee_id
            FROM lejuan_records lr
            LEFT JOIN coaches c ON lr.coach_no = c.coach_no
            WHERE lr.lejuan_status = 'pending'
                AND lr.scheduled_start_time <= datetime(?, '+20 hours')
                AND lr.scheduled_start_time > ?
            ORDER BY lr.scheduled_start_time
        `, [now, now]);

        console.log(`[TimerManager] 恢复乐捐定时器: 找到 ${pendingRecords.length} 条待处理记录`);

        for (const record of pendingRecords) {
            const coachInfo = {
                coach_no: record.coach_no,
                employee_id: record.employee_id || '-',
                stage_name: record.stage_name
            };
            const timerId = `lejuan_${record.id}`;
            createTimer(timerId, 'lejuan', record.id, record.scheduled_start_time, executeLejuanActivation, coachInfo);
            await enqueueRun('UPDATE lejuan_records SET scheduled = 1 WHERE id = ?', [record.id]);
        }
    } catch (err) {
        console.error('[TimerManager] 恢复乐捐定时器失败:', err);
    }
}
```

### 3.4 修改 `init()` 方法

**当前**：
```javascript
function init(callbacks = {}) {
    ensureTable();
    if (callbacks.lejuanActivate) recoverLejuanTimers(callbacks.lejuanActivate);
    if (callbacks.applicationRecover) recoverApplicationTimers(callbacks.applicationRecover);
    setInterval(() => pollCheck(callbacks.lejuanActivate, callbacks.applicationRecover), 5 * 60 * 1000);
}
```

**新版**（自包含，无需外部回调）：
```javascript
function init() {
    ensureTable();
    recoverApplicationTimers();     // 无回调，内部调用 executeApplicationRecovery
    recoverLejuanTimers();          // 无回调，内部调用 executeLejuanActivation
    setInterval(() => pollCheck(), 5 * 60 * 1000);
    console.log('[TimerManager] 已初始化（5分钟轮询，自包含业务逻辑）');
}
```

### 3.5 修改 `pollCheck()` 方法

**新版**（自包含，调用内部 `executeApplicationRecovery` 和 `executeLejuanActivation`）：

```javascript
async function pollCheck() {
    try {
        const now = TimeUtil.nowDB();

        // === 乐捐轮询 ===
        const missedLejuan = await all(`
            SELECT lr.*, c.employee_id
            FROM lejuan_records lr
            LEFT JOIN coaches c ON lr.coach_no = c.coach_no
            WHERE lr.lejuan_status = 'pending'
                AND lr.scheduled = 0
                AND lr.scheduled_start_time <= datetime(?, '+13 hours')
            ORDER BY lr.scheduled_start_time
        `, [now]);

        for (const record of missedLejuan) {
            const coachInfo = {
                coach_no: record.coach_no,
                employee_id: record.employee_id || '-',
                stage_name: record.stage_name
            };
            const timerId = `lejuan_${record.id}`;
            createTimer(timerId, 'lejuan', record.id, record.scheduled_start_time, executeLejuanActivation, coachInfo);
            await enqueueRun('UPDATE lejuan_records SET scheduled = 1 WHERE id = ?', [record.id]);
            await logTimer(timerId, 'lejuan', record.id, 'poll_miss');
        }

        // === 申请轮询 ===
        const records = await all(`
            SELECT a.*, c.coach_no, c.stage_name, c.shift, w.status as water_status
            FROM applications a
            LEFT JOIN coaches c ON a.applicant_phone = c.employee_id OR a.applicant_phone = c.phone
            LEFT JOIN water_boards w ON c.coach_no = w.coach_no
            WHERE a.application_type IN ('休息申请', '请假申请')
                AND a.status = 1
                AND a.extra_data LIKE '%"timer_set":true%'
        `, []);

        for (const record of records) {
            try {
                const extraData = JSON.parse(record.extra_data || '{}');
                if (extraData.executed === 1) continue;
                if (!extraData.exec_time) continue;

                const timerId = `application_${record.id}`;
                if (activeTimers[timerId]) continue;

                const nowDate = new Date(now + '+08:00');
                const execTime = new Date(extraData.exec_time + '+08:00');
                const delay = execTime.getTime() - nowDate.getTime();

                if (delay <= 0) {
                    console.log(`[TimerManager] 轮询: 申请 ${record.id} exec_time 已过，立即执行`);
                    executeApplicationRecovery(record.id);  // 直接调用，不通过 createTimer
                } else {
                    const coachInfo = {
                        coach_no: record.coach_no,
                        stage_name: record.stage_name,
                        application_type: record.application_type
                    };
                    // 补充 employee_id
                    if (record.applicant_phone) {
                        const c = await get('SELECT employee_id FROM coaches WHERE employee_id = ? OR phone = ?',
                            [record.applicant_phone, record.applicant_phone]);
                        if (c) coachInfo.employee_id = c.employee_id || '-';
                    }
                    createTimer(timerId, 'application', record.id, extraData.exec_time, executeApplicationRecovery, coachInfo);
                    extraData.scheduled = 1;
                    await enqueueRun(
                        'UPDATE applications SET extra_data = ?, updated_at = ? WHERE id = ?',
                        [JSON.stringify(extraData), now, record.id]
                    );
                    await logTimer(timerId, 'application', record.id, 'poll_miss');
                }
            } catch (e) {
                console.error(`[TimerManager] 轮询处理申请 ${record.id} 失败:`, e);
            }
        }
    } catch (err) {
        console.error('[TimerManager] 轮询检查失败:', err);
    }
}
```

### 3.6 精简 `getActiveTimersWithDetails`

由于 `activeTimers` 已存储 `coachInfo`，大部分情况下无需查库：

```javascript
function getActiveTimers() {
    return Object.values(activeTimers).map(t => ({
        timerId: t.timerId ? 'active' : 'unknown',
        type: t.type,
        recordId: t.recordId,
        execTime: t.execTime,
        coachInfo: t.coachInfo || {}    // 新增：直接返回教练信息
    }));
}

async function getActiveTimersWithDetails() {
    const timers = getActiveTimers();
    const detailedTimers = [];

    for (const timer of timers) {
        const ci = timer.coachInfo || {};

        const detail = {
            timerId: timer.timerId,
            type: timer.type,
            recordId: timer.recordId,
            execTime: timer.execTime,
            employee_id: ci.employee_id || null,     // 直接从 coachInfo 取
            stage_name: ci.stage_name || null,
            coach_no: ci.coach_no || null,
            application_type: ci.application_type || null,
            remainingSeconds: null
        };

        if (timer.execTime) {
            const now = new Date(TimeUtil.nowDB() + '+08:00');
            const execDate = new Date(timer.execTime + '+08:00');
            detail.remainingSeconds = Math.max(0, Math.round((execDate.getTime() - now.getTime()) / 1000));
        }

        // 兜底：如果 coachInfo 为空，从数据库补全
        if (!ci.coach_no) {
            if (timer.type === 'lejuan') {
                await enrichLejuanTimer(detail, timer.recordId);
            } else if (timer.type === 'application') {
                await enrichApplicationTimer(detail, timer.recordId);
            }
        }

        detailedTimers.push(detail);
    }

    return detailedTimers;
}
```

### 3.7 新 exports

```javascript
module.exports = {
    // 初始化
    init,
    ensureTable,

    // 通用定时器操作
    createTimer,
    cancelTimer,

    // 申请定时器（替代 application-timer.js）
    scheduleApplicationTimer,
    cancelApplicationTimer,
    executeApplicationRecovery,

    // 乐捐定时器（替代 lejuan-timer.js）
    scheduleLejuanTimer,
    cancelLejuanTimer,
    executeLejuanActivation,

    // 恢复
    recoverApplicationTimers,
    recoverLejuanTimers,

    // 查询
    getActiveCount,
    getCountByType,
    getActiveTimers,
    getActiveTimersWithDetails,
    getTimers: () => Object.keys(activeTimers).length,

    // 内部/调试
    pollCheck,
    logTimer
};
```

---

## 4. 调用方修改清单

### 4.1 `server.js`（~5866 行）

**删除**：
```javascript
const LejuanTimer = require('./services/lejuan-timer');
const ApplicationTimer = require('./services/application-timer');
```

**修改**：
```javascript
// 旧
const TimerManager = require('./services/timer-manager');
const LejuanTimer = require('./services/lejuan-timer');
const ApplicationTimer = require('./services/application-timer');
TimerManager.init({
    lejuanActivate: function(recordId) { LejuanTimer.activateLejuan(recordId); },
    applicationRecover: function(applicationId) { ApplicationTimer.executeRecovery(applicationId); }
});

// 新
const TimerManager = require('./services/timer-manager');
TimerManager.init();  // 自包含，无需回调
```

### 4.2 `routes/applications.js`

**import 修改**（第 14 行）：
```javascript
// 旧
const applicationTimer = require('../services/application-timer');
// 新
const timerManager = require('../services/timer-manager');
```

**调用修改 1**（休息申请创建，~493 行）：
```javascript
// 旧
applicationTimer.addNewRecord({
    id: parseInt(id),
    application_type: '休息申请',
    applicant_phone: application.applicant_phone,
    coach_no: coach.coach_no,
    stage_name: coach.stage_name,
    exec_time: execTime,
    current_shift: coach.shift
});

// 新
timerManager.scheduleApplicationTimer(
    { id: parseInt(id), exec_time: execTime, application_type: '休息申请' },
    { coach_no: coach.coach_no, employee_id: coach.employee_id || '-', stage_name: coach.stage_name, application_type: '休息申请' }
);
```

**调用修改 2**（请假申请创建，~518 行）：
```javascript
// 旧
applicationTimer.addNewRecord({
    id: parseInt(id),
    application_type: '请假申请',
    applicant_phone: application.applicant_phone,
    coach_no: coach.coach_no,
    stage_name: coach.stage_name,
    exec_time: execTime,
    current_shift: coach.shift
});

// 新
timerManager.scheduleApplicationTimer(
    { id: parseInt(id), exec_time: execTime, application_type: '请假申请' },
    { coach_no: coach.coach_no, employee_id: coach.employee_id || '-', stage_name: coach.stage_name, application_type: '请假申请' }
);
```

**调用修改 3**（取消申请，~728 行）：
```javascript
// 旧
applicationTimer.cancelRecord(parseInt(id));
// 新
timerManager.cancelApplicationTimer(parseInt(id));
```

### 4.3 `routes/lejuan-records.js`

**import 修改**（第 13 行）：
```javascript
// 旧
const lejuanTimer = require('../services/lejuan-timer');
// 新
const timerManager = require('../services/timer-manager');
```

**调用修改 1**（创建乐捐记录，~190 行）：
```javascript
// 旧
lejuanTimer.addNewRecord(result);

// 新
// result 包含 coach_no, stage_name 等字段，需查 employee_id
const coach = await get('SELECT employee_id FROM coaches WHERE coach_no = ?', [result.coach_no]);
timerManager.scheduleLejuanTimer(result, {
    coach_no: result.coach_no,
    employee_id: coach ? (coach.employee_id || '-') : '-',
    stage_name: result.stage_name
});
```

**调用修改 2**（删除乐捐记录，~474 行）：
```javascript
// 旧
lejuanTimer.cancelRecord(recordId);
// 新
timerManager.cancelLejuanTimer(recordId);
```

### 4.4 `routes/system-report.js`

**无需修改**。该文件已经 `require('../services/timer-manager')` 并调用 `timerManager.getActiveTimersWithDetails()`。

---

## 5. 删除文件清单

| 文件 | 说明 |
|------|------|
| `services/application-timer.js` | 业务逻辑已迁入 timer-manager.js |
| `services/lejuan-timer.js` | 业务逻辑已迁入 timer-manager.js |

删除后需确认无其他文件引用这两个模块（`grep -r 'application-timer\|lejuan-timer' backend/` 应无结果）。

---

## 6. 验收标准对照

| 验收项 | 实现方式 | 验证方法 |
|--------|----------|----------|
| 系统启动恢复所有定时器 | `init()` 调用 `recoverApplicationTimers()` + `recoverLejuanTimers()` | 重启服务后查看日志，确认恢复数量 |
| active-timers API 显示完整计时器列表 | `getActiveTimersWithDetails()` 直接从 `activeTimers` 的 `coachInfo` 读取，兜底查库 | `GET /api/system-report/active-timers`，确认返回含 employee_id/stage_name |
| 正常流程创建的定时器也能显示 | `scheduleApplicationTimer` / `scheduleLejuanTimer` 创建时即存 coachInfo | 创建新申请/乐捐后调用 API，确认列表中有新计时器 |

---

## 7. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| `coach.employee_id` 在 applications.js 事务中可能为空（查询条件是 phone/employee_id） | coachInfo.employee_id 为 '-' | 兜底逻辑确保查库补全，不影响功能 |
| 恢复时轮询间隔从 60s 变为 300s | 极端情况下遗漏恢复延迟最长 5 分钟 | pollCheck 已存在兜底机制，可接受 |
| `operation-log` 模块 import 方式 | 在函数内 `require('./operation-log')` 避免循环依赖 | 已使用动态 import 模式 |
| 双写期间（代码部署中）可能短暂同时存在两套计时器 | 同一记录可能被两个定时器执行 | `executeRecovery` 和 `activateLejuan` 都有幂等保护（检查 status/pending），不会重复执行 |

---

## 8. 修改文件汇总

| 序号 | 文件 | 操作 | 改动量（估算） |
|------|------|------|----------------|
| 1 | `services/timer-manager.js` | 大幅修改 | +200 行（迁入业务逻辑 + coachInfo 扩展） |
| 2 | `routes/applications.js` | import 改名 + 3 处调用修改 | ~10 行 |
| 3 | `routes/lejuan-records.js` | import 改名 + 2 处调用修改 | ~15 行 |
| 4 | `server.js` | 删除旧引用 + 简化 init 调用 | ~5 行 |
| 5 | `services/application-timer.js` | **删除** | - |
| 6 | `services/lejuan-timer.js` | **删除** | - |

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