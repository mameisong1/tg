/**
 * Cron 批处理调度器
 * 定时任务：
 *   - end_lejuan_morning:  晚上 23:00 自动结束早班助教的乐捐，水牌设为下班
 *   - end_lejuan_evening:  凌晨 02:00 自动结束晚班助教的乐捐，水牌设为下班
 *   - sync_reward_penalty:  中午 12:00 奖罚自动同步（去重逻辑）
 */

const { all, get, enqueueRun, runInTransaction } = require('../db');
const TimeUtil = require('../utils/time');

// Cron 任务执行间隔（毫秒）
const CRON_CHECK_INTERVAL = 60 * 1000; // 每分钟检查一次

/**
 * 确保 cron 相关表存在
 */
async function ensureTables() {
    // cron_tasks - 任务配置和状态
    await enqueueRun(`
        CREATE TABLE IF NOT EXISTS cron_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_name TEXT NOT NULL UNIQUE,
            task_type TEXT NOT NULL,
            description TEXT,
            cron_expression TEXT DEFAULT '',
            is_enabled INTEGER DEFAULT 1,
            last_run TEXT,
            next_run TEXT,
            last_status TEXT DEFAULT 'pending',
            last_error TEXT,
            created_at TEXT DEFAULT (datetime('now', '+8 hours'))
        )
    `);

    // cron_log - Cron 执行历史
    await enqueueRun(`
        CREATE TABLE IF NOT EXISTS cron_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_name TEXT NOT NULL,
            task_type TEXT NOT NULL,
            status TEXT NOT NULL,
            records_affected INTEGER DEFAULT 0,
            details TEXT,
            error TEXT,
            started_at TEXT,
            finished_at TEXT,
            duration_ms INTEGER
        )
    `);

    // 为 lejuan_records 添加 extra_data 字段（用于标记同步状态）
    try {
        await enqueueRun(`ALTER TABLE lejuan_records ADD COLUMN extra_data TEXT`);
        console.log('[CronScheduler] lejuan_records.extra_data 列已添加');
    } catch (err) {
        if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) {
            console.error('[CronScheduler] 添加 lejuan_records.extra_data 失败:', err.message);
        }
    }

    console.log('[CronScheduler] cron_tasks, cron_log 表就绪');
}

/**
 * 初始化默认任务配置（UPSERT 模式）
 */
async function initDefaultTasks() {
    const now = new Date(TimeUtil.nowDB() + '+08:00');
    const todayStr = TimeUtil.todayStr();

    // 计算今晚 23:00
    let nextMorning = new Date(now);
    if (now.getHours() >= 23) {
        nextMorning.setDate(nextMorning.getDate() + 1);
    }
    nextMorning.setHours(23, 0, 0, 0);
    const nextMorningStr = formatBeijing(nextMorning);

    // 计算次日 02:00
    let nextEvening = new Date(now);
    if (now.getHours() >= 2) {
        nextEvening.setDate(nextEvening.getDate() + 1);
    }
    nextEvening.setHours(2, 0, 0, 0);
    const nextEveningStr = formatBeijing(nextEvening);

    // 计算次日 12:00
    let nextSync = new Date(now);
    if (now.getHours() >= 12) {
        nextSync.setDate(nextSync.getDate() + 1);
    }
    nextSync.setHours(12, 0, 0, 0);
    const nextSyncStr = formatBeijing(nextSync);

    const tasks = [
        {
            task_name: 'end_lejuan_morning',
            task_type: 'end_lejuan',
            description: '晚上23点自动结束早班助教的乐捐，水牌设为下班',
            cron_expression: '0 23 * * *',
            next_run: nextMorningStr
        },
        {
            task_name: 'end_lejuan_evening',
            task_type: 'end_lejuan',
            description: '凌晨2点自动结束晚班助教的乐捐，水牌设为下班',
            cron_expression: '0 2 * * *',
            next_run: nextEveningStr
        },
        {
            task_name: 'sync_reward_penalty',
            task_type: 'sync_reward_penalty',
            description: '中午12点奖罚自动同步（去重逻辑）',
            cron_expression: '0 12 * * *',
            next_run: nextSyncStr
        }
    ];

    for (const task of tasks) {
        await enqueueRun(
            `INSERT INTO cron_tasks (task_name, task_type, description, cron_expression, next_run)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(task_name) DO UPDATE SET
                 description = excluded.description,
                 cron_expression = excluded.cron_expression,
                 next_run = excluded.next_run`,
            [task.task_name, task.task_type, task.description, task.cron_expression, task.next_run]
        );
    }

    // 删除旧的 end_lejuan 任务（如果存在）
    await enqueueRun('DELETE FROM cron_tasks WHERE task_name = ?', ['end_lejuan']);

    console.log('[CronScheduler] 默认任务配置已初始化（按班次分时结束乐捐）');
}

/**
 * 记录 Cron 执行日志
 */
async function logCron(taskName, taskType, status, recordsAffected, details, error, startedAt, finishedAt) {
    const durationMs = startedAt && finishedAt
        ? new Date(finishedAt + '+08:00').getTime() - new Date(startedAt + '+08:00').getTime()
        : null;

    await enqueueRun(
        `INSERT INTO cron_log (task_name, task_type, status, records_affected, details, error, started_at, finished_at, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [taskName, taskType, status, recordsAffected || 0, details || null, error || null, startedAt, finishedAt, durationMs]
    );
}

/**
 * 更新任务状态
 */
async function updateTaskStatus(taskName, updates) {
    const { lastRun, nextRun, lastStatus, lastError } = updates;
    const parts = [];
    const params = [];

    if (lastRun !== undefined) { parts.push('last_run = ?'); params.push(lastRun); }
    if (nextRun !== undefined) { parts.push('next_run = ?'); params.push(nextRun); }
    if (lastStatus !== undefined) { parts.push('last_status = ?'); params.push(lastStatus); }
    if (lastError !== undefined) { parts.push('last_error = ?'); params.push(lastError); }

    if (parts.length > 0) {
        params.push(taskName);
        await enqueueRun(
            `UPDATE cron_tasks SET ${parts.join(', ')} WHERE task_name = ?`,
            params
        );
    }
}

/**
 * 任务：按班次自动结束乐捐
 * @param {string} shiftType - 班次类型：'早班' 或 '晚班'
 * 将对应班次 active 状态的乐捐记录设为 returned，水牌设为下班
 */
async function taskEndLejuan(shiftType) {
    const taskName = shiftType === '早班' ? 'end_lejuan_morning' : 'end_lejuan_evening';
    const taskType = 'end_lejuan';
    const startedAt = TimeUtil.nowDB();

    console.log(`[CronScheduler] 开始执行: ${taskName} (${shiftType})`);

    try {
        const result = await runInTransaction(async (tx) => {
            const now = TimeUtil.nowDB();

            // 查找对应班次的 active 状态乐捐记录
            const activeRecords = await tx.all(
                `SELECT lr.*, wb.status as water_status, wb.id as wb_id, wb.coach_no, c.shift
                 FROM lejuan_records lr
                 LEFT JOIN water_boards wb ON lr.coach_no = wb.coach_no
                 LEFT JOIN coaches c ON lr.coach_no = c.coach_no
                 WHERE lr.lejuan_status = 'active'
                   AND (c.shift = ? OR (c.shift IS NULL AND ? = '晚班'))`,
                [shiftType, shiftType]  // shift 为空默认视为晚班
            );

            let affected = 0;

            for (const record of activeRecords) {
                // 更新乐捐记录状态
                // 计算外出时长（向上取整，最小1小时）
                let hours = 1;
                if (record.actual_start_time) {
                    const startTime = new Date(record.actual_start_time + '+08:00');
                    const endTime = new Date(now + '+08:00');
                    hours = Math.max(1, Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)));
                }

                await tx.run(
                    `UPDATE lejuan_records 
                     SET lejuan_status = 'returned', 
                         return_time = ?,
                         lejuan_hours = ?,
                         extra_data = json_set(COALESCE(extra_data, '{}'), '$.cron_ended', true),
                         updated_at = ?
                     WHERE id = ?`,
                    [now, hours, now, record.id]
                );

                // 如果水牌当前状态是"乐捐"，设为下班
                if (record.water_status === '乐捐') {
                    await tx.run(
                        'UPDATE water_boards SET status = ?, updated_at = ? WHERE coach_no = ?',
                        ['下班', now, record.coach_no]
                    );

                    console.log(`[CronScheduler] ${taskName}: ${record.stage_name || record.coach_no} 水牌设为下班`);
                }

                affected++;
            }

            return { affected };
        });

        const finishedAt = TimeUtil.nowDB();
        const nextRun = calcNextRun(shiftType === '早班' ? '0 23 * * *' : '0 2 * * *');

        await logCron(
            taskName, taskType, 'success', result.affected,
            `结束 ${shiftType} ${result.affected} 个 active 乐捐，水牌设为下班`,
            null, startedAt, finishedAt
        );

        await updateTaskStatus(taskName, {
            lastRun: finishedAt,
            nextRun: nextRun,
            lastStatus: 'success',
            lastError: null
        });

        console.log(`[CronScheduler] ${taskName} 完成: 影响 ${result.affected} 条记录`);
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
    }
}

/**
 * 任务：中午 12:00 奖罚自动同步（去重逻辑）
 * 从乐捐记录和申请表中同步奖罚数据，去重插入 reward_penalties 表
 */
async function taskSyncRewardPenalty() {
    const taskName = 'sync_reward_penalty';
    const taskType = 'sync_reward_penalty';
    const startedAt = TimeUtil.nowDB();

    console.log('[CronScheduler] 开始执行: sync_reward_penalty');

    try {
        const result = await runInTransaction(async (tx) => {
            const now = TimeUtil.nowDB();
            let affected = 0;

            // === 1. 从乐捐记录同步 ===
            // 将 active/ended 状态的乐捐同步到奖罚表
            // 使用 confirm_date = 乐捐的 actual_start_time 或 scheduled_start_time 日期部分
            // 去重: ON CONFLICT(confirm_date, type, phone) DO UPDATE
            const lejuanRecords = await tx.all(`
                SELECT lr.*, c.phone, c.stage_name, c.employee_id
                FROM lejuan_records lr
                LEFT JOIN coaches c ON lr.coach_no = c.coach_no
                WHERE lr.lejuan_status IN ('active', 'ended')
                    AND (lr.extra_data IS NULL
                         OR lr.extra_data NOT LIKE '%"reward_synced":true%')
                ORDER BY lr.id
            `);

            for (const record of lejuanRecords) {
                // 使用 employee_id 或 phone 作为联系标识
                const contactPhone = record.phone || record.employee_id;
                if (!contactPhone) {
                    console.log(`[CronScheduler] sync_reward_penalty: 乐捐记录 ${record.id} 无关联联系方式，跳过`);
                    continue;
                }

                const syncTime = record.actual_start_time || record.scheduled_start_time;
                const confirmDate = syncTime ? syncTime.substring(0, 10) : TimeUtil.todayStr();
                const type = '乐捐';
                const amount = 0; // 乐捐金额由后续手动设置
                const name = record.stage_name || '';

                await tx.run(
                    `INSERT INTO reward_penalties (type, confirm_date, phone, name, amount, remark, exec_status, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, '未执行', ?)
                     ON CONFLICT(confirm_date, type, phone) DO UPDATE SET
                         name = excluded.name,
                         remark = excluded.remark,
                         updated_at = excluded.updated_at`,
                    [type, confirmDate, contactPhone, name, amount,
                     `乐捐同步: ${record.stage_name || ''} (${syncTime || ''})`, now]
                );

                // 标记已同步（用 extra_data JSON 字段）
                const extraData = record.extra_data ? JSON.parse(record.extra_data) : {};
                extraData.reward_synced = true;
                extraData.reward_synced_at = now;
                await tx.run(
                    'UPDATE lejuan_records SET extra_data = ?, updated_at = ? WHERE id = ?',
                    [JSON.stringify(extraData), now, record.id]
                );

                affected++;
            }

            // === 2. 从申请表同步（休息/请假扣款）===
            const applicationRecords = await tx.all(`
                SELECT a.*, c.phone, c.stage_name
                FROM applications a
                LEFT JOIN coaches c ON a.applicant_phone = c.phone OR a.applicant_phone = c.employee_id
                WHERE a.status = 1
                    AND a.application_type IN ('休息申请', '请假申请')
                    AND (a.extra_data NOT LIKE '%"reward_penalty_synced":true%'
                         OR a.extra_data NOT LIKE '%"reward_penalty_synced_at"%')
                ORDER BY a.id
            `);

            for (const record of applicationRecords) {
                if (!record.phone) continue;

                const confirmDate = record.updated_at ? record.updated_at.substring(0, 10) : TimeUtil.todayStr();
                const type = record.application_type === '休息申请' ? '休息扣款' : '请假扣款';
                const amount = -100; // 默认扣款金额，可配置
                const name = record.stage_name || '';

                await tx.run(
                    `INSERT INTO reward_penalties (type, confirm_date, phone, name, amount, remark, exec_status, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, '未执行', ?)
                     ON CONFLICT(confirm_date, type, phone) DO UPDATE SET
                         amount = excluded.amount,
                         updated_at = excluded.updated_at`,
                    [type, confirmDate, record.phone, name, amount,
                     `${record.application_type}同步: ID ${record.id}`, now]
                );

                // 标记已同步
                try {
                    const extraData = JSON.parse(record.extra_data || '{}');
                    extraData.reward_penalty_synced = true;
                    extraData.reward_penalty_synced_at = now;
                    await tx.run(
                        'UPDATE applications SET extra_data = ?, updated_at = ? WHERE id = ?',
                        [JSON.stringify(extraData), now, record.id]
                    );
                } catch (e) {
                    console.error(`[CronScheduler] 更新申请 extra_data 失败:`, e);
                }

                affected++;
            }

            return { affected };
        });

        const finishedAt = TimeUtil.nowDB();
        const nextRun = calcNextRun('0 12 * * *');

        await logCron(
            taskName, taskType, 'success', result.affected,
            `同步 ${result.affected} 条奖罚记录`,
            null, startedAt, finishedAt
        );

        await updateTaskStatus(taskName, {
            lastRun: finishedAt,
            nextRun: nextRun,
            lastStatus: 'success',
            lastError: null
        });

        console.log(`[CronScheduler] sync_reward_penalty 完成: 同步 ${result.affected} 条记录`);
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
    }
}

/**
 * 计算下次运行时间
 */
function calcNextRun(cronExpression) {
    const now = new Date(TimeUtil.nowDB() + '+08:00');

    if (cronExpression.includes('23 *')) {
        // 晚上23点
        const next = new Date(now);
        if (now.getHours() >= 23) {
            next.setDate(next.getDate() + 1);
        }
        next.setHours(23, 0, 0, 0);
        return formatBeijing(next);
    } else if (cronExpression.includes('2 *')) {
        // 凌晨2点
        const next = new Date(now);
        if (now.getHours() >= 2) {
            next.setDate(next.getDate() + 1);
        }
        next.setHours(2, 0, 0, 0);
        return formatBeijing(next);
    } else if (cronExpression.includes('12 *')) {
        // 中午12点
        const next = new Date(now);
        if (now.getHours() >= 12) {
            next.setDate(next.getDate() + 1);
        }
        next.setHours(12, 0, 0, 0);
        return formatBeijing(next);
    }

    // 默认：下一个整点
    const next = new Date(now);
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return formatBeijing(next);
}

function formatBeijing(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

/**
 * 检查并执行到期任务
 */
async function checkAndRunTasks() {
    try {
        const now = TimeUtil.nowDB();

        const tasks = await all(
            'SELECT * FROM cron_tasks WHERE is_enabled = 1 AND next_run <= ?',
            [now]
        );

        for (const task of tasks) {
            console.log(`[CronScheduler] 触发任务: ${task.task_name} (计划: ${task.next_run})`);

            if (task.task_type === 'end_lejuan') {
                // 根据任务名判断班次
                const shiftType = task.task_name === 'end_lejuan_morning' ? '早班' : '晚班';
                await taskEndLejuan(shiftType);
            } else if (task.task_type === 'sync_reward_penalty') {
                await taskSyncRewardPenalty();
            }

            // 更新下次运行时间
            const nextRun = calcNextRun(task.cron_expression);
            await updateTaskStatus(task.task_name, { nextRun });
        }
    } catch (err) {
        console.error('[CronScheduler] 检查任务失败:', err);
    }
}

/**
 * 初始化调度器
 */
function init() {
    ensureTables().then(() => {
        initDefaultTasks();

        // 启动定时检查
        setInterval(checkAndRunTasks, CRON_CHECK_INTERVAL);

        console.log('[CronScheduler] 已初始化，每分钟检查任务');
    });
}

/**
 * 手动触发任务（供 API 调用）
 */
async function triggerTask(taskName) {
    const task = await get('SELECT * FROM cron_tasks WHERE task_name = ?', [taskName]);
    if (!task) {
        throw new Error(`任务 ${taskName} 不存在`);
    }

    if (!task.is_enabled) {
        throw new Error(`任务 ${taskName} 已禁用`);
    }

    if (task.task_type === 'end_lejuan') {
        // 根据任务名判断班次
        const shiftType = task.task_name === 'end_lejuan_morning' ? '早班' : '晚班';
        await taskEndLejuan(shiftType);
    } else if (task.task_type === 'sync_reward_penalty') {
        await taskSyncRewardPenalty();
    }

    const nextRun = calcNextRun(task.cron_expression);
    await updateTaskStatus(taskName, { nextRun });

    return { success: true, taskName };
}

/**
 * 获取任务状态
 */
async function getTaskStatus(taskName) {
    return await get('SELECT * FROM cron_tasks WHERE task_name = ?', [taskName]);
}

/**
 * 获取所有任务状态
 */
async function getAllTasks() {
    return await all('SELECT * FROM cron_tasks ORDER BY id');
}

/**
 * 获取 Cron 执行日志
 */
async function getCronLogs(taskName, limit = 20) {
    if (taskName) {
        return await all(
            'SELECT * FROM cron_log WHERE task_name = ? ORDER BY id DESC LIMIT ?',
            [taskName, limit]
        );
    }
    return await all(
        'SELECT * FROM cron_log ORDER BY id DESC LIMIT ?',
        [limit]
    );
}

/**
 * 启用/禁用任务
 */
async function toggleTask(taskName, enabled) {
    await enqueueRun(
        'UPDATE cron_tasks SET is_enabled = ? WHERE task_name = ?',
        [enabled ? 1 : 0, taskName]
    );
    return { success: true, taskName, enabled };
}

module.exports = {
    init,
    triggerTask,
    getTaskStatus,
    getAllTasks,
    getCronLogs,
    toggleTask,
    // 内部方法（供测试）
    taskEndLejuan,
    taskSyncRewardPenalty,
    ensureTables,
    initDefaultTasks
};
