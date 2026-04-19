/**
 * 申请定时器服务
 * 休息/请假审批通过后，到指定日期12:00自动恢复水牌状态
 * 
 * 重启恢复机制：
 *   - 服务启动时从数据库查询所有 timer_set=true 且状态仍为"休息/请假"的记录
 *   - exec_time 已过 → 立即执行恢复
 *   - exec_time 未到 → 重新注册 setTimeout
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
            
            // 检查水牌当前状态是否仍为休息/请假（防止中途已被手动修改）
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
            
            // 标记 extra_data 中 executed=1（避免重复执行）
            try {
                const extraData = JSON.parse(application.extra_data || '{}');
                extraData.executed = 1;
                await tx.run(
                    'UPDATE applications SET extra_data = ?, updated_at = ? WHERE id = ?',
                    [JSON.stringify(extraData), now, applicationId]
                );
            } catch (e) {
                console.error(`[申请定时器] 更新 extra_data executed 失败:`, e);
            }
            
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
        console.log(`[申请定时器] 记录 ${record.id} exec_time 已过，立即执行恢复 (${record.stage_name || ''})`);
        executeRecovery(record.id);
        return;
    }
    
    // 防止重复注册同一个 ID
    if (applicationTimers[record.id]) {
        console.log(`[申请定时器] 记录 ${record.id} 已有定时器，跳过重复注册`);
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
 * 
 * 逻辑：
 *   1. 查询所有 timer_set=true 的休息/请假记录（status=1）
 *   2. 过滤掉已经 executed=1 的记录（已执行过恢复）
 *   3. 检查水牌当前状态：如果已经不是"休息"/"请假"，说明已手动恢复过，跳过
 *   4. exec_time 已过 → 立即执行恢复
 *   5. exec_time 未到 → 注册 setTimeout
 */
async function recoverTimers() {
    try {
        // 查询所有 timer_set=true 且 status=1 的休息/请假记录
        const pendingRecords = await all(`
            SELECT a.*, c.coach_no, c.stage_name, c.shift, w.status as water_status
            FROM applications a
            LEFT JOIN coaches c ON a.applicant_phone = c.employee_id OR a.applicant_phone = c.phone
            LEFT JOIN water_boards w ON c.coach_no = w.coach_no
            WHERE a.application_type IN ('休息申请', '请假申请')
                AND a.status = 1
                AND a.extra_data LIKE '%"timer_set":true%'
        `, []);
        
        console.log(`[申请定时器] 恢复定时器: 找到 ${pendingRecords.length} 条 timer_set=true 记录`);
        
        let scheduled = 0;
        let executed = 0;
        let skipped = 0;
        
        for (const record of pendingRecords) {
            try {
                const extraData = JSON.parse(record.extra_data || '{}');
                
                // 已执行过恢复，跳过
                if (extraData.executed === 1) {
                    skipped++;
                    continue;
                }
                
                if (!extraData.exec_time) {
                    console.log(`[申请定时器] 记录 ${record.id} 没有 exec_time，跳过`);
                    skipped++;
                    continue;
                }
                
                // 水牌已经不是休息/请假状态，说明已手动恢复过
                if (record.water_status && record.water_status !== '休息' && record.water_status !== '请假') {
                    console.log(`[申请定时器] 记录 ${record.id} 水牌状态已是"${record.water_status}"，跳过恢复`);
                    // 标记为已执行
                    extraData.executed = 1;
                    await enqueueRun(
                        'UPDATE applications SET extra_data = ? WHERE id = ?',
                        [JSON.stringify(extraData), record.id]
                    );
                    skipped++;
                    continue;
                }
                
                const now = new Date(TimeUtil.nowDB() + '+08:00');
                const execTime = new Date(extraData.exec_time + '+08:00');
                const delay = execTime.getTime() - now.getTime();
                
                if (delay <= 0) {
                    // exec_time 已过，立即恢复
                    console.log(`[申请定时器] 恢复: 记录 ${record.id} exec_time 已过，立即执行 (${record.stage_name || ''})`);
                    executeRecovery(record.id);
                    executed++;
                } else {
                    // exec_time 未到，重新注册定时器
                    scheduleRecord({
                        id: record.id,
                        application_type: record.application_type,
                        applicant_phone: record.applicant_phone,
                        coach_no: record.coach_no,
                        stage_name: record.stage_name,
                        exec_time: extraData.exec_time,
                        current_shift: record.shift
                    });
                    scheduled++;
                }
            } catch (e) {
                console.error(`[申请定时器] 恢复处理 record ${record.id} 失败:`, e);
            }
        }
        
        console.log(`[申请定时器] 恢复完成: 调度 ${scheduled} 个, 立即执行 ${executed} 个, 跳过 ${skipped} 个`);
    } catch (err) {
        console.error('[申请定时器] 恢复定时器失败:', err);
    }
}

/**
 * 轮询检查：每分钟执行，兜底处理遗漏的定时器
 */
async function pollCheck() {
    try {
        // 查找 timer_set=true 但还没有 executed 标记的记录
        const records = await all(`
            SELECT a.*, c.coach_no, c.stage_name, c.shift, w.status as water_status
            FROM applications a
            LEFT JOIN coaches c ON a.applicant_phone = c.employee_id OR a.applicant_phone = c.phone
            LEFT JOIN water_boards w ON c.coach_no = w.coach_no
            WHERE a.application_type IN ('休息申请', '请假申请')
                AND a.status = 1
                AND a.extra_data LIKE '%"timer_set":true%'
        `, []);
        
        const now = TimeUtil.nowDB();
        
        for (const record of records) {
            try {
                const extraData = JSON.parse(record.extra_data || '{}');
                
                // 已执行过，跳过
                if (extraData.executed === 1) continue;
                // 还没有 exec_time，跳过
                if (!extraData.exec_time) continue;
                // 内存中已有定时器，跳过
                if (applicationTimers[record.id]) continue;
                
                const nowDate = new Date(now + '+08:00');
                const execTime = new Date(extraData.exec_time + '+08:00');
                const delay = execTime.getTime() - nowDate.getTime();
                
                if (delay <= 0) {
                    // exec_time 已过，立即执行
                    console.log(`[申请定时器] 轮询: 记录 ${record.id} exec_time 已过，立即执行 (${record.stage_name || ''})`);
                    executeRecovery(record.id);
                } else {
                    // 重新注册定时器
                    console.log(`[申请定时器] 轮询: 重新调度记录 ${record.id} (${record.stage_name || ''})`);
                    scheduleRecord({
                        id: record.id,
                        application_type: record.application_type,
                        applicant_phone: record.applicant_phone,
                        coach_no: record.coach_no,
                        stage_name: record.stage_name,
                        exec_time: extraData.exec_time,
                        current_shift: record.shift
                    });
                    // 标记 scheduled
                    extraData.scheduled = 1;
                    await enqueueRun(
                        'UPDATE applications SET extra_data = ?, updated_at = ? WHERE id = ?',
                        [JSON.stringify(extraData), now, record.id]
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
    // 1. 恢复已持久化的定时器（从数据库重新注册）
    recoverTimers();
    
    // 2. 启动轮询（每分钟），兜底处理遗漏
    setInterval(pollCheck, 60 * 1000);
    
    console.log('[申请定时器] 已初始化');
}

/**
 * 新增记录时调用（从 API 路由调用）
 * 注意：extra_data 的 scheduled/timer_set/exec_time 标记由调用方在事务中完成
 */
function addNewRecord(record) {
    scheduleRecord(record);
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
