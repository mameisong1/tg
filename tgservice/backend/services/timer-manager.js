/**
 * 公共计时器管理器
 * 统一管理乐捐和申请定时器，提供：
 *   - createTimer() - 创建定时器
 *   - cancelTimer() - 取消定时器
 *   - recoverTimers() - 服务启动恢复
 *   - pollCheck() - 每 5 分钟兜底检查
 * 
 * 计时器类型：
 *   - lejuan: 乐捐预约到时间自动激活
 *   - application: 休息/请假申请到时间自动恢复
 */

const { all, get, enqueueRun, runInTransaction } = require('../db');
const TimeUtil = require('../utils/time');

// 内存中的定时器 Map<timer_id, { timerId, type, recordId, execTime }>
const activeTimers = {};

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
 * 执行计时器回调（通用）
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
 * 创建定时器
 * @param {string} timerId - 唯一标识: lejuan_123
 * @param {string} timerType - lejuan | application
 * @param {string} recordId - 关联记录ID
 * @param {string} execTime - 执行时间 "YYYY-MM-DD HH:MM:SS"
 * @param {Function} callback - async (recordId) => void
 */
function createTimer(timerId, timerType, recordId, execTime, callback) {
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
        execTime: execTime
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
 * 获取所有活跃定时器信息
 */
function getActiveTimers() {
    return Object.values(activeTimers).map(t => ({
        timerId: t.timerId ? 'active' : 'unknown',
        type: t.type,
        recordId: t.recordId,
        execTime: t.execTime
    }));
}

/**
 * 乐捐定时器恢复（服务启动时）
 * 从数据库恢复 pending 且未到执行时间的乐捐记录
 */
async function recoverLejuanTimers(lejuanActivateCallback) {
    try {
        const now = TimeUtil.nowDB();
        // 查询未来12小时内的 pending 记录
        const pendingRecords = await all(`
            SELECT * FROM lejuan_records 
            WHERE lejuan_status = 'pending' 
                AND scheduled_start_time <= datetime(?, '+20 hours')
                AND scheduled_start_time > ?
            ORDER BY scheduled_start_time
        `, [now, now]);

        console.log(`[TimerManager] 恢复乐捐定时器: 找到 ${pendingRecords.length} 条待处理记录`);

        for (const record of pendingRecords) {
            const timerId = `lejuan_${record.id}`;
            createTimer(
                timerId,
                'lejuan',
                record.id,
                record.scheduled_start_time,
                lejuanActivateCallback
            );
            // 标记为已调度
            await enqueueRun(
                'UPDATE lejuan_records SET scheduled = 1 WHERE id = ?',
                [record.id]
            );
        }
    } catch (err) {
        console.error('[TimerManager] 恢复乐捐定时器失败:', err);
    }
}

/**
 * 申请定时器恢复（服务启动时）
 * 从数据库恢复 timer_set=true 且状态仍为"休息/请假"的记录
 */
async function recoverApplicationTimers(applicationRecoverCallback) {
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

        let scheduled = 0;
        let executed = 0;
        let skipped = 0;

        for (const record of pendingRecords) {
            try {
                const extraData = JSON.parse(record.extra_data || '{}');

                if (extraData.executed === 1) {
                    skipped++;
                    continue;
                }

                if (!extraData.exec_time) {
                    skipped++;
                    continue;
                }

                if (record.water_status && record.water_status !== '休息' && record.water_status !== '请假') {
                    extraData.executed = 1;
                    await enqueueRun(
                        'UPDATE applications SET extra_data = ? WHERE id = ?',
                        [JSON.stringify(extraData), record.id]
                    );
                    skipped++;
                    continue;
                }

                const timerId = `application_${record.id}`;
                createTimer(
                    timerId,
                    'application',
                    record.id,
                    extraData.exec_time,
                    applicationRecoverCallback
                );
                scheduled++;
            } catch (e) {
                console.error(`[TimerManager] 恢复申请记录 ${record.id} 失败:`, e);
            }
        }

        console.log(`[TimerManager] 申请定时器恢复: 调度 ${scheduled} 个, 立即执行 ${executed} 个, 跳过 ${skipped} 个`);
    } catch (err) {
        console.error('[TimerManager] 恢复申请定时器失败:', err);
    }
}

/**
 * 轮询检查：每 5 分钟兜底处理遗漏的定时器
 */
async function pollCheck(lejuanActivateCallback, applicationRecoverCallback) {
    try {
        const now = TimeUtil.nowDB();

        // === 乐捐轮询 ===
        const missedLejuan = await all(`
            SELECT * FROM lejuan_records 
            WHERE lejuan_status = 'pending' 
                AND scheduled = 0
                AND scheduled_start_time <= datetime(?, '+13 hours')
            ORDER BY scheduled_start_time
        `, [now]);

        for (const record of missedLejuan) {
            console.log(`[TimerManager] 轮询发现乐捐待处理记录 ${record.id} (${record.stage_name || ''})`);
            const timerId = `lejuan_${record.id}`;
            createTimer(
                timerId,
                'lejuan',
                record.id,
                record.scheduled_start_time,
                lejuanActivateCallback
            );
            await enqueueRun(
                'UPDATE lejuan_records SET scheduled = 1 WHERE id = ?',
                [record.id]
            );
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
                    if (applicationRecoverCallback) {
                        applicationRecoverCallback(record.id);
                    }
                } else {
                    console.log(`[TimerManager] 轮询: 重新调度申请 ${record.id}`);
                    createTimer(
                        timerId,
                        'application',
                        record.id,
                        extraData.exec_time,
                        applicationRecoverCallback
                    );
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

/**
 * 初始化：创建表 + 恢复定时器 + 启动轮询
 * @param {object} callbacks - { lejuanActivate: Function, applicationRecover: Function }
 */
function init(callbacks = {}) {
    ensureTable();

    // 恢复已有定时器
    if (callbacks.lejuanActivate) {
        recoverLejuanTimers(callbacks.lejuanActivate);
    }
    if (callbacks.applicationRecover) {
        recoverApplicationTimers(callbacks.applicationRecover);
    }

    // 启动轮询（每 5 分钟）
    setInterval(() => {
        pollCheck(callbacks.lejuanActivate, callbacks.applicationRecover);
    }, 5 * 60 * 1000);

    console.log('[TimerManager] 已初始化（5分钟轮询）');
}

module.exports = {
    init,
    createTimer,
    cancelTimer,
    getActiveCount,
    getCountByType,
    getActiveTimers,
    pollCheck,
    recoverLejuanTimers,
    recoverApplicationTimers,
    ensureTable,
    logTimer,
    // 兼容旧 API
    getTimers: getActiveCount
};
