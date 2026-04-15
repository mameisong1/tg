/**
 * 乐捐定时器服务
 * 内存定时器 + 数据库持久化 + 启动恢复
 */

const { all, get, enqueueRun, runInTransaction } = require('../db');
const TimeUtil = require('../utils/time');
const operationLogService = require('./operation-log');

// 内存中的定时器 Map<record_id, Timer对象>
const lejuanTimers = {};

/**
 * 激活乐捐：到时间后自动设为乐捐状态
 */
async function activateLejuan(recordId) {
    let stageName = '未知';
    try {
        await runInTransaction(async (tx) => {
            const record = await tx.get(
                'SELECT * FROM lejuan_records WHERE id = ? AND lejuan_status = ?',
                [recordId, 'pending']
            );
            if (!record) {
                console.log(`[乐捐定时器] 记录 ${recordId} 已不是 pending，跳过激活`);
                return;
            }

            stageName = record.stage_name || '未知';

            const now = TimeUtil.nowDB();

            // 更新乐捐记录状态
            await tx.run(
                `UPDATE lejuan_records 
                 SET lejuan_status = 'active', 
                     actual_start_time = ?, 
                     scheduled = 1,
                     updated_at = ?
                 WHERE id = ?`,
                [now, now, recordId]
            );

            // 更新水牌状态为「乐捐」
            const currentWaterBoard = await tx.get(
                'SELECT * FROM water_boards WHERE coach_no = ?',
                [record.coach_no]
            );

            if (currentWaterBoard) {
                await tx.run(
                    `UPDATE water_boards 
                     SET status = '乐捐', updated_at = ? 
                     WHERE coach_no = ?`,
                    [now, record.coach_no]
                );

                // 操作日志
                await operationLogService.create(tx, {
                    operator_phone: 'system',
                    operator_name: '系统定时任务',
                    operation_type: '乐捐自动生效',
                    target_type: 'water_board',
                    target_id: currentWaterBoard.id,
                    old_value: JSON.stringify({ status: currentWaterBoard.status }),
                    new_value: JSON.stringify({ status: '乐捐' }),
                    remark: `乐捐报备自动生效（预约时间: ${record.scheduled_start_time}）`
                });
            }
        });

        delete lejuanTimers[recordId];
        console.log(`[乐捐定时器] 记录 ${recordId} 已激活: ${stageName}`);
    } catch (err) {
        console.error(`[乐捐定时器] 激活记录 ${recordId} 失败:`, err);
    }
}

/**
 * 调度单个定时器
 */
function scheduleRecord(record) {
    const now = new Date(TimeUtil.nowDB() + '+08:00');
    const startTime = new Date(record.scheduled_start_time + '+08:00');
    const delay = startTime.getTime() - now.getTime();

    if (delay <= 0) {
        // 时间已到或已过，立即激活
        activateLejuan(record.id);
        return;
    }

    const timerId = setTimeout(() => {
        activateLejuan(record.id);
    }, delay);

    lejuanTimers[record.id] = timerId;
    console.log(`[乐捐定时器] 记录 ${record.id} 已调度，延迟 ${Math.round(delay / 1000)}秒 后激活 (${record.stage_name || ''})`);
}

/**
 * 恢复所有待调度定时器（服务启动时调用）
 */
async function recoverTimers() {
    try {
        const now = TimeUtil.nowDB();
        // 查询未来1小时内的 pending 记录（含已过期的）
        const pendingRecords = await all(`
            SELECT * FROM lejuan_records 
            WHERE lejuan_status = 'pending' 
                AND scheduled_start_time <= datetime(?, '+1 hours')
            ORDER BY scheduled_start_time
        `, [now]);

        console.log(`[乐捐定时器] 恢复定时器: 找到 ${pendingRecords.length} 条待处理记录`);

        for (const record of pendingRecords) {
            scheduleRecord(record);
            // 标记为已调度（防止重复恢复）
            await enqueueRun(
                'UPDATE lejuan_records SET scheduled = 1 WHERE id = ?',
                [record.id]
            );
        }
    } catch (err) {
        console.error('[乐捐定时器] 恢复定时器失败:', err);
    }
}

/**
 * 轮询检查：每分钟执行，兜底处理遗漏的定时器
 */
async function pollCheck() {
    try {
        const now = TimeUtil.nowDB();

        // 查找 scheduled=0 且时间已到或接近的 pending 记录
        const missedRecords = await all(`
            SELECT * FROM lejuan_records 
            WHERE lejuan_status = 'pending' 
                AND scheduled = 0
                AND scheduled_start_time <= datetime(?, '+1 minutes')
            ORDER BY scheduled_start_time
        `, [now]);

        for (const record of missedRecords) {
            console.log(`[乐捐定时器] 轮询发现待处理记录 ${record.id} (${record.stage_name || ''})`);
            scheduleRecord(record);
            await enqueueRun(
                'UPDATE lejuan_records SET scheduled = 1 WHERE id = ?',
                [record.id]
            );
        }
    } catch (err) {
        console.error('[乐捐定时器] 轮询检查失败:', err);
    }
}

/**
 * 初始化：启动恢复 + 轮询
 */
function init() {
    // 1. 恢复已持久化的定时器
    recoverTimers();

    // 2. 启动轮询（每分钟）
    setInterval(pollCheck, 60 * 1000);

    console.log('[乐捐定时器] 已初始化');
}

/**
 * 新增记录时调用（从 API 路由调用）
 */
function addNewRecord(record) {
    scheduleRecord(record);
    // 标记为已调度
    enqueueRun('UPDATE lejuan_records SET scheduled = 1 WHERE id = ?', [record.id]);
}

/**
 * 取消定时器（如果助教需要取消预约）
 */
function cancelRecord(recordId) {
    if (lejuanTimers[recordId]) {
        clearTimeout(lejuanTimers[recordId]);
        delete lejuanTimers[recordId];
        console.log(`[乐捐定时器] 记录 ${recordId} 定时器已取消`);
    }
}

module.exports = {
    init,
    addNewRecord,
    cancelRecord,
    activateLejuan,
    // 供测试/调试
    getTimers: () => Object.keys(lejuanTimers).length
};
