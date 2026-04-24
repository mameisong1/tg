/**
 * Cron 批处理调度器
 * 定时任务：
 *   - end_lejuan_morning:  晚上 23:00 自动结束早班助教的乐捐，水牌设为下班
 *   - end_lejuan_evening:  凌晨 02:00 自动结束晚班助教的乐捐，水牌设为下班
 *   - sync_reward_penalty:  中午 12:00 奖罚自动同步（去重逻辑）
 *   - lock_guest_invitation_morning: 下午 16:00 自动锁定早班应约客人员
 *   - lock_guest_invitation_evening: 晚上 20:00 自动锁定晚班应约客人员
 */

const { all, get, enqueueRun, runInTransaction } = require('../db');
const TimeUtil = require('../utils/time');
const http = require('http');

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
        // 先检查字段是否存在
        const tableInfo = await all('PRAGMA table_info(lejuan_records)');
        const hasColumn = tableInfo.some(col => col.name === 'extra_data');
        if (!hasColumn) {
            await enqueueRun(`ALTER TABLE lejuan_records ADD COLUMN extra_data TEXT`);
            console.log('[CronScheduler] lejuan_records.extra_data 列已添加');
        }
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

    // 计算下午 16:00（早班约客锁定）
    let nextLockMorning = new Date(now);
    if (now.getHours() >= 16) {
        nextLockMorning.setDate(nextLockMorning.getDate() + 1);
    }
    nextLockMorning.setHours(16, 0, 0, 0);
    const nextLockMorningStr = formatBeijing(nextLockMorning);

    // 计算晚上 20:00（晚班约客锁定）
    let nextLockEvening = new Date(now);
    if (now.getHours() >= 20) {
        nextLockEvening.setDate(nextLockEvening.getDate() + 1);
    }
    nextLockEvening.setHours(20, 0, 0, 0);
    const nextLockEveningStr = formatBeijing(nextLockEvening);

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
        },
        {
            task_name: 'lock_guest_invitation_morning',
            task_type: 'lock_guest_invitation',
            description: '下午16点自动锁定早班应约客人员',
            cron_expression: '0 16 * * *',
            next_run: nextLockMorningStr
        },
        {
            task_name: 'lock_guest_invitation_evening',
            task_type: 'lock_guest_invitation',
            description: '晚上20点自动锁定晚班应约客人员',
            cron_expression: '0 20 * * *',
            next_run: nextLockEveningStr
        },
        {
            task_name: 'guest_ranking_morning',
            task_type: 'guest_ranking',
            description: '下午14点自动执行早班门迎排序',
            cron_expression: '0 14 * * *',
            next_run: calcNextRun('0 14 * * *')
        },
        {
            task_name: 'guest_ranking_evening',
            task_type: 'guest_ranking',
            description: '晚上18点自动执行晚班门迎排序',
            cron_expression: '0 18 * * *',
            next_run: calcNextRun('0 18 * * *')
        },
        {
            task_name: 'guest_ranking_midnight',
            task_type: 'guest_ranking',
            description: '午夜0点清空门迎排序',
            cron_expression: '0 0 * * *',
            next_run: calcNextRun('0 0 * * *')
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
                // 计算乐捐时长（基于预约开始时间，遵守编码规范使用 TimeUtil）
                let hours = 1;
                if (record.scheduled_start_time) {
                    // 使用 TimeUtil.toDate 解析时间（数据库存北京时间，+08:00 时区）
                    const startTime = TimeUtil.toDate(record.scheduled_start_time);
                    const endTime = TimeUtil.toDate(now);
                    
                    if (startTime && endTime) {
                        // 计算总时长（分钟）
                        const diffMs = endTime.getTime() - startTime.getTime();
                        const totalMinutes = Math.floor(diffMs / (60 * 1000));
                        
                        // 计算完整小时数 + 剩余分钟数
                        const baseHours = Math.floor(totalMinutes / 60);
                        const remainingMinutes = totalMinutes % 60;
                        
                        // 剩余分钟 > 10 时额外算一小时
                        const extraHour = remainingMinutes > 10 ? 1 : 0;
                        
                        // 最少算 1 小时
                        hours = Math.max(1, baseHours + extraHour);
                    }
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
                        'UPDATE water_boards SET status = ?, table_no = NULL, clock_in_time = NULL, updated_at = ? WHERE coach_no = ?',
                        ['下班', now, record.coach_no]
                    );

                    // 同步更新打卡表的下班时间（凌晨下班时上班记录可能在昨天）
                    const todayStr = TimeUtil.todayStr();
                    const yesterdayStr = TimeUtil.offsetDateStr(-1);
                    const attendanceRecord = await tx.get(
                        `SELECT id FROM attendance_records
                         WHERE coach_no = ? AND date IN (?, ?) AND clock_out_time IS NULL
                         ORDER BY clock_in_time DESC LIMIT 1`,
                        [record.coach_no, todayStr, yesterdayStr]
                    );

                    if (attendanceRecord) {
                        await tx.run(
                            `UPDATE attendance_records SET clock_out_time = ?, updated_at = ? WHERE id = ?`,
                            [now, now, attendanceRecord.id]
                        );
                        console.log(`[CronScheduler] ${taskName}: ${record.stage_name || record.coach_no} 水牌设为下班，打卡表同步更新`);
                    } else {
                        console.log(`[CronScheduler] ${taskName}: ${record.stage_name || record.coach_no} 水牌设为下班（无上班记录，打卡表跳过）`);
                    }
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
 * 格式化日期为 YYYY-MM-DD
 */
function formatBeijingDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * 任务：中午 12:00 奖罚自动同步（去重逻辑）
 * 同步四种奖罚类型到 reward_penalties 表：
 *   - 未约客罚金：确定日期=约客数据生成日，罚金20元/条
 *   - 漏单罚金：确定日期=上桌单发出日，罚金10元/条
 *   - 漏卡罚金：确定日期=上班卡日期，罚金10元/条
 *   - 助教日常（请假罚金）：确定日期=请假日期，病假-200，事假-300
 * 去重规则：如果已存在（确定日期+奖罚类型+手机号）则跳过
 */
async function taskSyncRewardPenalty() {
    const taskName = 'sync_reward_penalty';
    const taskType = 'sync_reward_penalty';
    const startedAt = TimeUtil.nowDB();

    console.log('[CronScheduler] 开始执行: sync_reward_penalty');

    // 计算昨天和前天的日期字符串
    const today = new Date(TimeUtil.nowDB() + '+08:00');
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const beforeYesterday = new Date(today); beforeYesterday.setDate(beforeYesterday.getDate() - 2);
    const yesterdayStr = formatBeijingDate(yesterday);
    const beforeYesterdayStr = formatBeijingDate(beforeYesterday);
    console.log(`[CronScheduler] 处理日期范围: ${beforeYesterdayStr} ~ ${yesterdayStr}`);

    try {
        const result = await runInTransaction(async (tx) => {
            const now = TimeUtil.nowDB();
            let affected = 0;
            const stats = { guest: 0, missingTable: 0, missingClock: 0, leave: 0 };

            // === 1. 未约客罚金 ===
            // 查找昨天和前天的未约客+无效约客记录
            // 确定日期 = 约客数据生成日（guest_invitation_results.date）
            const guestRecords = await tx.all(`
                SELECT gi.*, c.phone, c.stage_name, c.employee_id
                FROM guest_invitation_results gi
                LEFT JOIN coaches c ON gi.coach_no = c.coach_no
                WHERE gi.result IN ('应约客', '约客无效')
                    AND gi.date IN (?, ?)
                    AND c.phone IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1 FROM reward_penalties rp
                        WHERE rp.confirm_date = gi.date
                        AND rp.type = '未约客罚金'
                        AND rp.phone = c.phone
                    )
            `, [yesterdayStr, beforeYesterdayStr]);

            for (const record of guestRecords) {
                const type = '未约客罚金';
                const confirmDate = record.date;
                const amount = -20; // 一条处罚20块
                const name = record.stage_name || '';

                await tx.run(
                    `INSERT INTO reward_penalties (type, confirm_date, phone, name, amount, remark, exec_status, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, '未执行', ?)
                     ON CONFLICT(confirm_date, type, phone, remark) DO NOTHING`,
                    [type, confirmDate, record.phone, name, amount,
                     `未约客 (${record.shift || ''})`, now]
                );
                stats.guest++;
                affected++;
            }
            console.log(`[CronScheduler] 未约客罚金: ${stats.guest} 条`);

            // === 2. 漏单罚金 ===
            // 查找昨天和前天的上桌单缺失下桌单记录
            // 确定日期 = 上桌单发出日期（table_action_orders.created_at）
            // 修复：排除有取消单的上桌单，不算漏单
            const missingTableOrders = await tx.all(`
                SELECT t_in.*, c.phone, c.stage_name, c.employee_id,
                       DATE(t_in.created_at) AS table_date
                FROM table_action_orders t_in
                LEFT JOIN coaches c ON t_in.coach_no = c.coach_no
                WHERE t_in.order_type = '上桌单'
                    AND DATE(t_in.created_at) IN (?, ?)
                    AND c.phone IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1 FROM table_action_orders t_out
                        WHERE t_out.order_type = '下桌单'
                            AND t_out.coach_no = t_in.coach_no
                            AND t_out.table_no = t_in.table_no
                            AND t_out.stage_name = t_in.stage_name
                            AND t_out.created_at > t_in.created_at
                            AND t_out.created_at <= datetime(t_in.created_at, '+15 hours')
                    )
                    AND NOT EXISTS (
                        SELECT 1 FROM table_action_orders t_cancel
                        WHERE t_cancel.order_type = '取消单'
                            AND t_cancel.coach_no = t_in.coach_no
                            AND t_cancel.table_no = t_in.table_no
                            AND t_cancel.stage_name = t_in.stage_name
                            AND t_cancel.created_at > t_in.created_at
                            AND t_cancel.created_at <= datetime(t_in.created_at, '+15 hours')
                    )
                    AND NOT EXISTS (
                        SELECT 1 FROM reward_penalties rp
                        WHERE rp.confirm_date = DATE(t_in.created_at)
                        AND rp.type = '漏单罚金'
                        AND rp.phone = c.phone
                        AND rp.remark = '漏单 ' || t_in.table_no
                    )
            `, [yesterdayStr, beforeYesterdayStr]);

            for (const record of missingTableOrders) {
                const type = '漏单罚金';
                const confirmDate = record.table_date;
                const amount = -10; // 一条处罚10块
                const name = record.stage_name || '';

                await tx.run(
                    `INSERT INTO reward_penalties (type, confirm_date, phone, name, amount, remark, exec_status, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, '未执行', ?)
                     ON CONFLICT(confirm_date, type, phone, remark) DO NOTHING`,
                    [type, confirmDate, record.phone, name, amount,
                     `漏单 ${record.table_no}`, now]
                );
                stats.missingTable++;
                affected++;
            }
            console.log(`[CronScheduler] 漏单罚金: ${stats.missingTable} 条`);

            // === 3. 漏卡罚金 ===
            // 查找昨天和前天的漏卡记录
            // 漏卡定义：上班打卡后，次日12点前无下班打卡
            // 确定日期 = 上班卡日期（attendance_records.date）
            // 新增：只对水牌状态为「空闲」或「上桌」的助教计算漏卡罚金
            const missingClockRecords = await tx.all(`
                SELECT ar.*, c.phone, c.stage_name, c.employee_id, wb.status as water_status
                FROM attendance_records ar
                INNER JOIN coaches c ON ar.coach_no = c.coach_no
                INNER JOIN water_boards wb ON ar.coach_no = wb.coach_no
                WHERE ar.date IN (?, ?)
                    AND ar.clock_in_time IS NOT NULL
                    AND c.phone IS NOT NULL
                    AND wb.status IN ('早班空闲', '晚班空闲', '早班上桌', '晚班上桌')
                    AND (
                        ar.clock_out_time IS NULL
                        OR (
                            DATE(ar.clock_out_time) = DATE(ar.clock_in_time, '+1 day')
                            AND TIME(ar.clock_out_time) > '12:00:00'
                        )
                    )
                    AND NOT EXISTS (
                        SELECT 1 FROM reward_penalties rp
                        WHERE rp.confirm_date = ar.date
                        AND rp.type = '漏卡罚金'
                        AND rp.phone = c.phone
                        AND rp.remark = '漏卡 (' || ar.date || ')'
                    )
            `, [yesterdayStr, beforeYesterdayStr]);

            for (const record of missingClockRecords) {
                const type = '漏卡罚金';
                const confirmDate = record.date;
                const amount = -10; // 一条处罚10块
                const name = record.stage_name || '';

                await tx.run(
                    `INSERT INTO reward_penalties (type, confirm_date, phone, name, amount, remark, exec_status, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, '未执行', ?)
                     ON CONFLICT(confirm_date, type, phone, remark) DO NOTHING`,
                    [type, confirmDate, record.phone, name, amount,
                     `漏卡 (${record.date})`, now]
                );
                stats.missingClock++;
                affected++;
            }
            console.log(`[CronScheduler] 漏卡罚金: ${stats.missingClock} 条`);

            // === 4. 请假罚金（助教日常）===
            // 查找请假日期在昨天和前天的已审批请假申请
            // 确定日期 = 请假日期（不是申请日期），在 extra_data.leave_date 中
            // 病假-200，事假-300
            const leaveRecords = await tx.all(`
                SELECT a.*, c.phone, c.stage_name, c.employee_id
                FROM applications a
                LEFT JOIN coaches c ON a.applicant_phone = c.phone OR a.applicant_phone = c.employee_id
                WHERE a.status = 1
                    AND a.application_type = '请假申请'
                    AND c.phone IS NOT NULL
                    AND a.extra_data IS NOT NULL
                    AND a.extra_data LIKE '%leave_date%'
            `);

            for (const record of leaveRecords) {
                if (!record.phone) continue;

                try {
                    const extraData = JSON.parse(record.extra_data || '{}');
                    const leaveDate = extraData.leave_date; // 请假日期
                    const leaveType = extraData.leave_type; // 病假/事假

                    // 只处理昨天和前天的请假
                    if (leaveDate !== yesterdayStr && leaveDate !== beforeYesterdayStr) continue;

                    // 检查是否已存在（去重）
                    const existing = await tx.get(
                        'SELECT id FROM reward_penalties WHERE confirm_date = ? AND type = ? AND phone = ?',
                        [leaveDate, '助教日常', record.phone]
                    );
                    if (existing) continue;

                    const type = '助教日常';
                    const confirmDate = leaveDate;
                    const amount = leaveType === '病假' ? -200 : -300;
                    const name = record.stage_name || '';

                    await tx.run(
                        `INSERT INTO reward_penalties (type, confirm_date, phone, name, amount, remark, exec_status, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, '未执行', ?)
                         ON CONFLICT(confirm_date, type, phone) DO NOTHING`,
                        [type, confirmDate, record.phone, name, amount,
                         `请假: ${leaveType} (${leaveDate})`, now]
                    );
                    stats.leave++;
                    affected++;
                } catch (e) {
                    console.error(`[CronScheduler] 解析请假申请 extra_data 失败:`, e, record.extra_data);
                }
            }
            console.log(`[CronScheduler] 请假罚金: ${stats.leave} 条`);

            return { affected, stats };
        });

        const finishedAt = TimeUtil.nowDB();
        const nextRun = calcNextRun('0 12 * * *');

        const details = `未约客:${result.stats.guest} 漏单:${result.stats.missingTable} 漏卡:${result.stats.missingClock} 请假:${result.stats.leave}`;
        await logCron(
            taskName, taskType, 'success', result.affected,
            details,
            null, startedAt, finishedAt
        );

        await updateTaskStatus(taskName, {
            lastRun: finishedAt,
            nextRun: nextRun,
            lastStatus: 'success',
            lastError: null
        });

        console.log(`[CronScheduler] sync_reward_penalty 完成: ${details}`);
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
 * 任务：自动锁定约客应约客人员
 * @param {string} shiftType - 班次类型：'早班' 或 '晚班'
 * 调用内部 API 执行锁定逻辑
 */
async function taskLockGuestInvitation(shiftType) {
    const taskName = shiftType === '早班' ? 'lock_guest_invitation_morning' : 'lock_guest_invitation_evening';
    const taskType = 'lock_guest_invitation';
    const startedAt = TimeUtil.nowDB();

    console.log(`[CronScheduler] 开始执行: ${taskName} (${shiftType})`);

    try {
        const today = TimeUtil.todayStr();

        // 先检查是否已锁定（防止重复执行）
        const existingTask = await get('SELECT last_run, last_status FROM cron_tasks WHERE task_name = ?', [taskName]);
        if (existingTask && existingTask.last_status === 'success' && existingTask.last_run && existingTask.last_run.startsWith(today)) {
            console.log(`[CronScheduler] ${taskName}: 今日已锁定，跳过`);
            const finishedAt = TimeUtil.nowDB();
            const nextRun = calcNextRun(shiftType === '早班' ? '0 16 * * *' : '0 20 * * *');
            await logCron(taskName, taskType, 'skipped', 0, '今日已锁定', null, startedAt, finishedAt);
            // 保持 last_status = 'success'，只更新 next_run
            await updateTaskStatus(taskName, { nextRun });
            return { skipped: true, reason: 'already_locked' };
        }

        // 内部 HTTP 调用
        const postData = JSON.stringify({ date: today, shift: shiftType });

        const options = {
            hostname: '127.0.0.1',
            port: parseInt(process.env.PORT) || (process.env.TGSERVICE_ENV === 'test' ? 8088 : 80),
            path: '/api/guest-invitations/internal/lock',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const result = await new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`解析响应失败: ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });

        const finishedAt = TimeUtil.nowDB();
        const nextRun = calcNextRun(shiftType === '早班' ? '0 16 * * *' : '0 20 * * *');

        if (result.success) {
            const lockedCount = result.data?.locked_count || 0;
            const totalCount = result.data?.total_count || 0;

            await logCron(
                taskName, taskType, 'success', lockedCount,
                `${shiftType} 锁定 ${lockedCount} 名应约客助教，总计 ${totalCount} 人`,
                null, startedAt, finishedAt
            );

            await updateTaskStatus(taskName, {
                lastRun: finishedAt,
                nextRun: nextRun,
                lastStatus: 'success',
                lastError: null
            });

            console.log(`[CronScheduler] ${taskName} 完成: 锁定 ${lockedCount} 人`);
        } else {
            // API 返回失败（如时间未到、已锁定等）
            const errorMsg = result.error || '未知错误';

            await logCron(
                taskName, taskType, 'failed', 0,
                errorMsg,
                errorMsg, startedAt, finishedAt
            );

            await updateTaskStatus(taskName, {
                lastRun: finishedAt,
                nextRun: nextRun,
                lastStatus: 'failed',
                lastError: errorMsg
            });

            console.log(`[CronScheduler] ${taskName} 执行失败: ${errorMsg}`);
        }
    } catch (err) {
        const finishedAt = TimeUtil.nowDB();
        console.error('[CronScheduler] taskLockGuestInvitation 失败:', err);

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
/**
 * 计算下次运行时间（精确解析 cron 表达式）
 * cron 格式: minute hour day-of-month month day-of-week
 * 例如: '0 12 * * *' 表示每天中午12点
 */
const cronParser = require('cron-parser');

function calcNextRun(cronExpression) {
    try {
        // 使用 cron-parser 正确解析 cron 表达式
        const interval = cronParser.parseExpression(cronExpression, {
            currentDate: new Date(TimeUtil.nowDB() + '+08:00'),
            tz: 'Asia/Shanghai'  // 明确指定北京时间
        });
        const next = interval.next().toDate();
        return formatBeijing(next);
    } catch (err) {
        // 解析失败，默认下一小时
        console.error('[CronScheduler] calcNextRun 解析失败:', err.message);
        const now = new Date(TimeUtil.nowDB() + '+08:00');
        const next = new Date(now);
        next.setHours(next.getHours() + 1, 0, 0, 0);
        return formatBeijing(next);
    }
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
 * 任务：门迎批处理排序 / 清空
 * @param {string} shift - '早班' | '晚班' | '全部'
 * @param {number} startRank - 起始序号
 * @param {number} maxRank - 最大序号
 */
async function taskGuestRanking(shift, startRank, maxRank) {
    let taskName, taskType;
    let isClear = false;

    if (shift === '全部') {
        taskName = 'guest_ranking_midnight';
        taskType = 'guest_ranking';
        isClear = true;
    } else if (shift === '早班') {
        taskName = 'guest_ranking_morning';
        taskType = 'guest_ranking';
    } else {
        taskName = 'guest_ranking_evening';
        taskType = 'guest_ranking';
    }

    const startedAt = TimeUtil.nowDB();
    console.log(`[CronScheduler] 开始执行: ${taskName} (${shift})`);

    try {
        const apiPath = isClear
            ? '/api/guest-rankings/internal/clear'
            : '/api/guest-rankings/internal/batch';

        const postData = isClear
            ? '{}'
            : JSON.stringify({ shift, startRank, maxRank });

        const options = {
            hostname: '127.0.0.1',
            port: parseInt(process.env.PORT) || (process.env.TGSERVICE_ENV === 'test' ? 8088 : 80),
            path: apiPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const result = await new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`解析响应失败: ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });

        const finishedAt = TimeUtil.nowDB();

        if (result.success) {
            if (isClear) {
                await logCron(
                    taskName, taskType, 'success', 0,
                    '午夜清空门迎排序完成',
                    null, startedAt, finishedAt
                );
            } else {
                const rankedCount = result.data?.ranked_count || 0;
                await logCron(
                    taskName, taskType, 'success', rankedCount,
                    `${shift} 门迎排序完成，分配 ${rankedCount} 人`,
                    null, startedAt, finishedAt
                );
            }

            const cronExpr = taskName === 'guest_ranking_morning' ? '0 14 * * *'
                : taskName === 'guest_ranking_evening' ? '0 18 * * *'
                : '0 0 * * *';

            await updateTaskStatus(taskName, {
                lastRun: finishedAt,
                nextRun: calcNextRun(cronExpr),
                lastStatus: 'success',
                lastError: null
            });

            console.log(`[CronScheduler] ${taskName} 完成`);
        } else {
            const errorMsg = result.error || '未知错误';
            const cronExpr = taskName === 'guest_ranking_morning' ? '0 14 * * *'
                : taskName === 'guest_ranking_evening' ? '0 18 * * *'
                : '0 0 * * *';

            await logCron(
                taskName, taskType, 'failed', 0,
                errorMsg,
                errorMsg, startedAt, finishedAt
            );

            await updateTaskStatus(taskName, {
                lastRun: finishedAt,
                nextRun: calcNextRun(cronExpr),
                lastStatus: 'failed',
                lastError: errorMsg
            });

            console.log(`[CronScheduler] ${taskName} 执行失败: ${errorMsg}`);
        }
    } catch (err) {
        const finishedAt = TimeUtil.nowDB();
        console.error(`[CronScheduler] ${taskName} 失败:`, err);

        const cronExpr = taskName === 'guest_ranking_morning' ? '0 14 * * *'
            : taskName === 'guest_ranking_evening' ? '0 18 * * *'
            : '0 0 * * *';

        await logCron(
            taskName, taskType, 'failed', 0, null,
            err.message, startedAt, finishedAt
        );

        await updateTaskStatus(taskName, {
            lastRun: finishedAt,
            nextRun: calcNextRun(cronExpr),
            lastStatus: 'failed',
            lastError: err.message
        });
    }
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
                const shiftType = task.task_name === 'end_lejuan_morning' ? '早班' : '晚班';
                await taskEndLejuan(shiftType);
            } else if (task.task_type === 'sync_reward_penalty') {
                await taskSyncRewardPenalty();
            } else if (task.task_type === 'lock_guest_invitation') {
                const shiftType = task.task_name === 'lock_guest_invitation_morning' ? '早班' : '晚班';
                await taskLockGuestInvitation(shiftType);
            } else if (task.task_type === 'guest_ranking') {
                if (task.task_name === 'guest_ranking_midnight') {
                    await taskGuestRanking('全部', 0, 0);
                } else {
                    const shiftType = task.task_name === 'guest_ranking_morning' ? '早班' : '晚班';
                    const startRank = shiftType === '早班' ? 1 : 51;
                    const maxRank = shiftType === '早班' ? 50 : 100;
                    await taskGuestRanking(shiftType, startRank, maxRank);
                }
            }

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
    } else if (task.task_type === 'lock_guest_invitation') {
        // 根据任务名判断班次
        const shiftType = task.task_name === 'lock_guest_invitation_morning' ? '早班' : '晚班';
        await taskLockGuestInvitation(shiftType);
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
    calcNextRun,
    // 内部方法（供测试）
    taskEndLejuan,
    taskSyncRewardPenalty,
    taskLockGuestInvitation,
    ensureTables,
    initDefaultTasks
};
