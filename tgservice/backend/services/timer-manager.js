/**
 * 公共计时器管理器（重构版）
 * 统一管理乐捐和申请定时器，自包含所有业务逻辑，无需外部回调。
 * 
 * 计时器类型：
 *   - lejuan: 乐捐预约到时间自动激活
 *   - application: 休息/请假申请到时间自动恢复
 */

const { all, get, enqueueRun, runInTransaction } = require('../db');
const TimeUtil = require('../utils/time');

// 内存中的定时器 Map<timer_id, { timerId, type, recordId, execTime, coachInfo }>
const activeTimers = {};

// ============================================================
// 基础方法（保留现有逻辑）
// ============================================================

/**
 * 确保 timer_log 表存在
 */
async function ensureTable() {
    await enqueueRun(`
        CREATE TABLE IF NOT EXISTS timer_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timer_id TEXT NOT NULL,          -- 唯一标识: lejuan_123, application_456
            timer_type TEXT NOT NULL,        -- lejuan | application
            record_id TEXT,                  -- 关联记录 ID
            action TEXT NOT NULL,            -- create | execute | cancel | recover | poll_miss
            status TEXT DEFAULT 'success',   -- success | failed
            scheduled_time TEXT,             -- 计划执行时间
            actual_time TEXT,                -- 实际执行时间
            delay_ms INTEGER,                -- 延迟毫秒
            error TEXT,                      -- 错误信息
            created_at TEXT DEFAULT (datetime('now', '+8 hours'))
        )
    `);
    console.log('[TimerManager] timer_log 表就绪');
}

/**
 * 记录计时器日志
 */
async function logTimer(timerId, timerType, recordId, action, opts = {}) {
    const now = TimeUtil.nowDB();
    await enqueueRun(
        `INSERT INTO timer_log (timer_id, timer_type, record_id, action, status, scheduled_time, actual_time, delay_ms, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            timerId, timerType, recordId || null, action,
            opts.status || 'success',
            opts.scheduledTime || null,
            now,
            opts.delayMs !== undefined ? opts.delayMs : null,
            opts.error || null
        ]
    );
}

/**
 * 执行定时器回调（通用）
 * @param {string} timerId - lejuan_123 | application_456
 * @param {string} timerType - lejuan | application
 * @param {string} recordId - 关联记录ID
 * @param {Function} callback - async (recordId) => void
 */
async function executeTimer(timerId, timerType, recordId, callback) {
    const timerInfo = activeTimers[timerId];
    const scheduledTime = timerInfo ? timerInfo.execTime : null;
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
    }

    delete activeTimers[timerId];
}

/**
 * 创建定时器（扩展版：支持 coachInfo）
 * @param {string} timerId - 唯一标识: lejuan_123
 * @param {string} timerType - lejuan | application
 * @param {string} recordId - 关联记录ID
 * @param {string} execTime - 执行时间 "YYYY-MM-DD HH:MM:SS"
 * @param {Function} callback - async (recordId) => void
 * @param {object} coachInfo - 可选，助教信息 { coach_no, employee_id, stage_name, application_type }
 */
function createTimer(timerId, timerType, recordId, execTime, callback, coachInfo = {}) {
    // 防止重复注册
    if (activeTimers[timerId]) {
        console.log(`[TimerManager] ${timerId} 已有定时器，跳过重复注册`);
        return;
    }

    const now = new Date(TimeUtil.nowDB() + '+08:00');
    const execDate = new Date(execTime + '+08:00');
    const delay = execDate.getTime() - now.getTime();

    if (delay <= 0) {
        // 时间已到或已过，立即执行
        console.log(`[TimerManager] ${timerId} exec_time 已过，立即执行`);
        executeTimer(timerId, timerType, recordId, callback);
        return;
    }

    const timerObj = setTimeout(() => {
        executeTimer(timerId, timerType, recordId, callback);
    }, delay);

    activeTimers[timerId] = {
        timerId: timerObj,
        type: timerType,
        recordId: recordId,
        execTime: execTime,
        coachInfo: coachInfo          // 新增：完整助教信息
    };

    logTimer(timerId, timerType, recordId, 'create', {
        scheduledTime: execTime
    });

    console.log(`[TimerManager] ${timerId} 已调度，延迟 ${Math.round(delay / 1000)}秒 后执行`);
}

/**
 * 取消定时器
 */
function cancelTimer(timerId) {
    if (activeTimers[timerId]) {
        clearTimeout(activeTimers[timerId].timerId);
        const info = activeTimers[timerId];
        logTimer(timerId, info.type, info.recordId, 'cancel');
        delete activeTimers[timerId];
        console.log(`[TimerManager] ${timerId} 定时器已取消`);
    }
}

/**
 * 获取活跃定时器数量
 */
function getActiveCount() {
    return Object.keys(activeTimers).length;
}

/**
 * 按类型获取活跃定时器数量
 */
function getCountByType(type) {
    return Object.values(activeTimers).filter(t => t.type === type).length;
}

/**
 * 获取所有活跃定时器基础信息
 */
function getActiveTimers() {
    return Object.values(activeTimers).map(t => ({
        timerId: t.timerId ? 'active' : 'unknown',
        type: t.type,
        recordId: t.recordId,
        execTime: t.execTime,
        coachInfo: t.coachInfo || {}    // 新增：直接返回教练信息
    }));
}

// ============================================================
// 业务方法：申请恢复（从 application-timer.js 迁入）
// ============================================================

/**
 * 执行申请恢复：恢复水牌状态为班次空闲
 */
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

            // QA-20260420-4: 水牌状态校验 - 必须是请假/休息状态才能恢复
            const currentStatus = waterBoard.status;
            if (currentStatus !== '请假' && currentStatus !== '休息') {
                console.log(`[TimerManager] 申请 ${applicationId} 水牌状态为「${currentStatus}」，不符合恢复条件，跳过`);
                // 标记已执行但不改变水牌
                const extraData = JSON.parse(application.extra_data || '{}');
                extraData.executed = 1;
                extraData.skip_reason = `水牌状态为「${currentStatus}」，不符合恢复条件`;
                await tx.run(
                    'UPDATE applications SET extra_data = ?, updated_at = ? WHERE id = ?',
                    [JSON.stringify(extraData), TimeUtil.nowDB(), applicationId]
                );
                return; // 不执行恢复
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

// ============================================================
// 业务方法：乐捐激活（从 lejuan-timer.js 迁入）
// ============================================================

/**
 * 执行乐捐激活：到时间后自动设为乐捐状态
 */
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

// ============================================================
// 调度方法（供路由调用）
// ============================================================

/**
 * 注册申请定时器（替代 applicationTimer.addNewRecord）
 * @param {object} record - 申请记录 { id, exec_time, application_type }
 * @param {object} coachInfo - 助教信息 { coach_no, employee_id, stage_name, application_type }
 */
function scheduleApplicationTimer(record, coachInfo) {
    const timerId = `application_${record.id}`;
    createTimer(timerId, 'application', record.id, record.exec_time, executeApplicationRecovery, coachInfo);
}

/**
 * 注册乐捐定时器（替代 lejuanTimer.addNewRecord）
 * @param {object} record - 乐捐记录（含 scheduled_start_time）
 * @param {object} coachInfo - 助教信息 { coach_no, employee_id, stage_name }
 */
function scheduleLejuanTimer(record, coachInfo) {
    const timerId = `lejuan_${record.id}`;
    createTimer(timerId, 'lejuan', record.id, record.scheduled_start_time, executeLejuanActivation, coachInfo);
}

/**
 * 取消申请定时器
 */
function cancelApplicationTimer(applicationId) {
    cancelTimer(`application_${applicationId}`);
}

/**
 * 取消乐捐定时器
 */
function cancelLejuanTimer(recordId) {
    cancelTimer(`lejuan_${recordId}`);
}

// ============================================================
// 恢复方法（服务启动时调用）
// ============================================================

/**
 * 恢复申请定时器
 */
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
                    employee_id: '',
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

/**
 * 恢复乐捐定时器
 */
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

// ============================================================
// 轮询检查
// ============================================================

/**
 * 轮询检查：每 5 分钟兜底处理遗漏的定时器
 */
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

// ============================================================
// 详情查询（coachInfo 直接从内存读取，兜底查库）
// ============================================================

/**
 * 补全乐捐定时器详细信息（兜底查库）
 */
async function enrichLejuanTimer(detail, recordId) {
    try {
        const record = await get(`
            SELECT lr.coach_no, lr.stage_name, c.employee_id
            FROM lejuan_records lr
            LEFT JOIN coaches c ON lr.coach_no = c.coach_no
            WHERE lr.id = ?
        `, [recordId]);

        if (record) {
            detail.coach_no = record.coach_no;
            detail.employee_id = record.employee_id || '-';
            detail.stage_name = record.stage_name || '-';
        }
    } catch (err) {
        console.error(`[TimerManager] 补全乐捐定时器 ${recordId} 信息失败:`, err);
    }
}

/**
 * 补全申请定时器详细信息（兜底查库）
 */
async function enrichApplicationTimer(detail, recordId) {
    try {
        const record = await get(`
            SELECT a.id, a.application_type, a.applicant_phone,
                   a.extra_data,
                   c.coach_no, c.stage_name, c.employee_id
            FROM applications a
            LEFT JOIN coaches c ON a.applicant_phone = c.employee_id
                                OR a.applicant_phone = c.phone
            WHERE a.id = ?
        `, [recordId]);

        if (record) {
            detail.application_type = record.application_type || '-';
            detail.coach_no = record.coach_no;
            detail.employee_id = record.employee_id || '-';
            detail.stage_name = record.stage_name || '-';
        }
    } catch (err) {
        console.error(`[TimerManager] 补全申请定时器 ${recordId} 信息失败:`, err);
    }
}

/**
 * 获取所有活跃计时器的详细信息（含助教信息）
 */
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
            employee_id: ci.employee_id || null,
            stage_name: ci.stage_name || null,
            coach_no: ci.coach_no || null,
            application_type: ci.application_type || null,
            remainingSeconds: null
        };

        // 计算剩余时间
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

// ============================================================
// 初始化
// ============================================================

/**
 * 初始化：创建表 + 恢复定时器 + 启动轮询（自包含，无需外部回调）
 */
function init() {
    ensureTable();

    // 恢复已有定时器
    recoverApplicationTimers();
    recoverLejuanTimers();

    // 启动轮询（每 5 分钟）
    setInterval(() => {
        pollCheck();
    }, 5 * 60 * 1000);

    console.log('[TimerManager] 已初始化（5分钟轮询，自包含业务逻辑）');
}

// ============================================================
// 导出
// ============================================================

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
