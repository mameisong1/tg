/**
 * 申请定时器服务
 * 休息/请假审批通过后，到指定日期12:00自动恢复水牌状态
 */

const { all, get, enqueueRun, runInTransaction } = require('../db');
const TimeUtil = require('../utils/time');
const operationLogService = require('./operation-log');

// 内存中的定时器 Map<application_id, Timer对象>
const applicationTimers = {};

/**
 * 定时执行：恢复水牌状态为班次空闲
 */
async function executeRecovery(applicationId) {
    try {
        await runInTransaction(async (tx) => {
            const application = await tx.get(
                'SELECT * FROM applications WHERE id = ? AND status = 1',
                [applicationId]
            );
            if (!application) {
                console.log(`[申请定时器] 记录 ${applicationId} 已无效，跳过`);
                return;
            }
            
            const coach = await tx.get(
                'SELECT coach_no, stage_name, shift FROM coaches WHERE employee_id = ? OR phone = ?',
                [application.applicant_phone, application.applicant_phone]
            );
            if (!coach) {
                console.log(`[申请定时器] 记录 ${applicationId} 的教练不存在，跳过`);
                return;
            }
            
            const waterBoard = await tx.get(
                'SELECT * FROM water_boards WHERE coach_no = ?',
                [coach.coach_no]
            );
            if (!waterBoard) {
                console.log(`[申请定时器] 记录 ${applicationId} 的水牌不存在，跳过`);
                return;
            }
            
            // 恢复为对应班次的空闲状态
            const newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
            const now = TimeUtil.nowDB();
            
            await tx.run(
                'UPDATE water_boards SET status = ?, updated_at = ? WHERE coach_no = ?',
                [newStatus, now, coach.coach_no]
            );
            
            await operationLogService.create(tx, {
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
        
        delete applicationTimers[applicationId];
        console.log(`[申请定时器] 记录 ${applicationId} 已执行恢复`);
    } catch (err) {
        console.error(`[申请定时器] 执行恢复 ${applicationId} 失败:`, err);
    }
}

/**
 * 调度单个定时器
 */
function scheduleRecord(record) {
    if (!record.exec_time) {
        console.log(`[申请定时器] 记录 ${record.id} 没有 exec_time，跳过`);
        return;
    }
    
    const now = new Date(TimeUtil.nowDB() + '+08:00');
    const execTime = new Date(record.exec_time + '+08:00');
    const delay = execTime.getTime() - now.getTime();
    
    if (delay <= 0) {
        // 时间已到或已过，立即执行
        executeRecovery(record.id);
        return;
    }
    
    const timerId = setTimeout(() => {
        executeRecovery(record.id);
    }, delay);
    
    applicationTimers[record.id] = timerId;
    console.log(`[申请定时器] 记录 ${record.id} 已调度，延迟 ${Math.round(delay / 1000)}秒 后恢复 (${record.stage_name || ''})`);
}

/**
 * 恢复所有待调度定时器（服务启动时调用）
 */
async function recoverTimers() {
    try {
        const now = TimeUtil.nowDB();
        // 查询未来7天内的 timer_set=true 且 status=1 的休息/请假记录
        const pendingRecords = await all(`
            SELECT a.*, c.coach_no, c.stage_name, c.shift
            FROM applications a
            LEFT JOIN coaches c ON a.applicant_phone = c.employee_id OR a.applicant_phone = c.phone
            WHERE a.application_type IN ('休息申请', '请假申请')
                AND a.status = 1
                AND a.extra_data LIKE '%"timer_set":true%'
            ORDER BY a.extra_data
        `, []);
        
        console.log(`[申请定时器] 恢复定时器: 找到 ${pendingRecords.length} 条待处理记录`);
        
        for (const record of pendingRecords) {
            try {
                const extraData = JSON.parse(record.extra_data);
                if (extraData.exec_time) {
                    scheduleRecord({
                        id: record.id,
                        application_type: record.application_type,
                        applicant_phone: record.applicant_phone,
                        coach_no: record.coach_no,
                        stage_name: record.stage_name,
                        exec_time: extraData.exec_time,
                        current_shift: record.shift
                    });
                }
            } catch (e) {
                console.error(`[申请定时器] 解析 extra_data 失败 record ${record.id}:`, e);
            }
        }
    } catch (err) {
        console.error('[申请定时器] 恢复定时器失败:', err);
    }
}

/**
 * 轮询检查：每分钟执行，兜底处理遗漏的定时器
 */
async function pollCheck() {
    try {
        const now = TimeUtil.nowDB();
        
        const records = await all(`
            SELECT a.*, c.coach_no, c.stage_name, c.shift
            FROM applications a
            LEFT JOIN coaches c ON a.applicant_phone = c.employee_id OR a.applicant_phone = c.phone
            WHERE a.application_type IN ('休息申请', '请假申请')
                AND a.status = 1
                AND a.extra_data LIKE '%"timer_set":true%'
                AND a.extra_data NOT LIKE '%"scheduled":1%'
        `, []);
        
        for (const record of records) {
            try {
                const extraData = JSON.parse(record.extra_data);
                if (extraData.exec_time) {
                    console.log(`[申请定时器] 轮询发现待处理记录 ${record.id} (${record.stage_name || ''})`);
                    scheduleRecord({
                        id: record.id,
                        application_type: record.application_type,
                        applicant_phone: record.applicant_phone,
                        coach_no: record.coach_no,
                        stage_name: record.stage_name,
                        exec_time: extraData.exec_time,
                        current_shift: record.shift
                    });
                    // 标记为已调度
                    const updatedExtraData = JSON.stringify({ ...extraData, scheduled: 1 });
                    await enqueueRun(
                        'UPDATE applications SET extra_data = ?, updated_at = ? WHERE id = ?',
                        [updatedExtraData, now, record.id]
                    );
                }
            } catch (e) {
                console.error(`[申请定时器] 轮询处理 record ${record.id} 失败:`, e);
            }
        }
    } catch (err) {
        console.error('[申请定时器] 轮询检查失败:', err);
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
    
    console.log('[申请定时器] 已初始化');
}

/**
 * 新增记录时调用（从 API 路由调用）
 */
function addNewRecord(record) {
    scheduleRecord(record);
    // 标记为已调度
    enqueueRun(
        'UPDATE applications SET extra_data = ? WHERE id = ?',
        [JSON.stringify({}), record.id] // extra_data 已在调用方更新过
    );
}

/**
 * 取消定时器（如果助教需要取消申请）
 */
function cancelRecord(applicationId) {
    if (applicationTimers[applicationId]) {
        clearTimeout(applicationTimers[applicationId]);
        delete applicationTimers[applicationId];
        console.log(`[申请定时器] 记录 ${applicationId} 定时器已取消`);
    }
}

module.exports = {
    init,
    addNewRecord,
    cancelRecord,
    executeRecovery,
    // 供测试/调试
    getTimers: () => Object.keys(applicationTimers).length
};
