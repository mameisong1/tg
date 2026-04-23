/**
 * 乐捐记录 API
 * 路径: /api/lejuan-records
 */

const express = require('express');
const router = express.Router();
const { all, get, runInTransaction, enqueueRun } = require('../db');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const operationLogService = require('../services/operation-log');
const TimeUtil = require('../utils/time');
const timerManager = require('../services/timer-manager');
const dingtalkService = require('../services/dingtalk-service');

// 所有接口需要认证
router.use(auth.required);

/**
 * 校验乐捐预约时间窗口（当日14:00 ~ 次日01:00）
 */
function validateLejuanTime(scheduledStartTime) {
    const now = TimeUtil.nowDB();
    const nowHour = parseInt(now.substring(11, 13));
    const nowDate = now.substring(0, 10);

    const schedHour = parseInt(scheduledStartTime.substring(11, 13));
    const schedDate = scheduledStartTime.substring(0, 10);

    // 校验1: 必须是整点
    const min = scheduledStartTime.substring(14, 16);
    const sec = scheduledStartTime.substring(17, 19);
    if (min !== '00' || sec !== '00') {
        return { valid: false, error: '预约时间必须是整点（分钟=00）' };
    }

    // 校验2: 小时必须在窗口内 (14~23 或 0~1)
    if (schedHour >= 2 && schedHour <= 13) {
        return { valid: false, error: '乐捐报备时间为每日14:00-次日01:00，请选择有效时段' };
    }

    // 校验3: 日期与小时匹配性
    // 分三种当前时段：
    //   A. 凌晨窗口(0~1点): 只能选当天0~1点
    //   B. 白天窗口(14~23点): 可选当天14~23 + 次日0~1
    //   C. 窗口未到(2~13点): 可提前预约当天14~23 + 次日0~1
    if (nowHour <= 1) {
        // A. 凌晨窗口：只能选当天0~1点，禁止选14~23
        if (schedHour >= 14) {
            return { valid: false, error: '凌晨时段只能预约00:00或01:00' };
        }
        if (schedDate !== nowDate) {
            return { valid: false, error: '凌晨时段应在当天预约' };
        }
    } else if (nowHour >= 14) {
        // B. 白天窗口进行中
        if (schedHour >= 14) {
            if (schedDate !== nowDate) {
                return { valid: false, error: '当天时段应在当天预约' };
            }
        } else {
            const tomorrow = new Date(nowDate + 'T00:00:00+08:00');
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
            if (schedDate !== tomorrowStr) {
                return { valid: false, error: '凌晨时段应在次日预约' };
            }
        }
    } else {
        // C. 窗口未到（2~13点）：提前预约
        if (schedHour >= 14) {
            if (schedDate !== nowDate) {
                return { valid: false, error: '当天时段应在当天预约' };
            }
        } else {
            const tomorrow = new Date(nowDate + 'T00:00:00+08:00');
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
            if (schedDate !== tomorrowStr) {
                return { valid: false, error: '凌晨时段应在次日预约' };
            }
        }
    }

    // 校验4: 不能早于当前时间（允许当前小时）
    const nowCal = nowDate + String(nowHour).padStart(2, '0');
    const schedCal = schedDate + String(schedHour).padStart(2, '0');
    const isCurrentHour = schedCal === nowCal;
    if (!isCurrentHour && schedCal < nowCal) {
        return { valid: false, error: '预约时间不能早于当前时间' };
    }

    return { valid: true, isCurrentHour };
}

/**
 * POST /api/lejuan-records — 提交乐捐报备（助教）
 */
router.post('/', requireBackendPermission(['all']), async (req, res) => {
    try {
        const { employee_id, scheduled_start_time, extra_hours, remark } = req.body;

        if (!employee_id || !scheduled_start_time) {
            return res.status(400).json({ error: '缺少必填字段: employee_id, scheduled_start_time' });
        }

        // 校验：必须是整点
        const timeMatch = scheduled_start_time.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
        if (!timeMatch) {
            return res.status(400).json({ error: '时间格式错误，必须是 YYYY-MM-DD HH:MM:SS' });
        }

        // 校验时间窗口
        const timeValidation = validateLejuanTime(scheduled_start_time);
        if (!timeValidation.valid) {
            return res.status(400).json({ error: timeValidation.error });
        }
        const isCurrentHour = timeValidation.isCurrentHour;

        // 查询助教信息
        const coach = await get(
            'SELECT coach_no, employee_id, stage_name FROM coaches WHERE employee_id = ?',
            [employee_id]
        );
        if (!coach) {
            return res.status(404).json({ error: '找不到该工号对应的助教' });
        }

        // 检查该助教是否已有 pending 或 active 的乐捐记录
        const existing = await get(
            `SELECT id, lejuan_status FROM lejuan_records 
             WHERE coach_no = ? AND lejuan_status IN ('pending', 'active')`,
            [coach.coach_no]
        );
        if (existing) {
            const statusText = existing.lejuan_status === 'pending' ? '待出发' : '乐捐中';
            return res.status(400).json({ error: `已有一条${statusText}的乐捐记录，请先处理` });
        }

        // 创建记录
        const result = await runInTransaction(async (tx) => {
            // 如果是当前小时，直接激活
            const shouldActivateNow = isCurrentHour;
            const initialStatus = shouldActivateNow ? 'active' : 'pending';
            const actualStartTime = shouldActivateNow ? TimeUtil.nowDB() : null;
            const scheduled = shouldActivateNow ? 1 : 0;

            const insertResult = await tx.run(
                `INSERT INTO lejuan_records (
                    coach_no, employee_id, stage_name,
                    scheduled_start_time, extra_hours, remark,
                    lejuan_status, scheduled, actual_start_time, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [coach.coach_no, employee_id, coach.stage_name, scheduled_start_time, extra_hours || null, remark || null, initialStatus, scheduled, actualStartTime, req.user.username || employee_id, TimeUtil.nowDB(), TimeUtil.nowDB()]
            );

            const recordId = insertResult.lastID;

            // 如果立即激活，更新水牌状态
            if (shouldActivateNow) {
                const waterBoard = await tx.get(
                    'SELECT * FROM water_boards WHERE coach_no = ?',
                    [coach.coach_no]
                );
                if (waterBoard) {
                    await tx.run(
                        `UPDATE water_boards SET status = '乐捐', updated_at = ? WHERE coach_no = ?`,
                        [TimeUtil.nowDB(), coach.coach_no]
                    );
                    await operationLogService.create(tx, {
                        operator_phone: req.user.username || employee_id,
                        operator_name: req.user.username || employee_id,
                        operation_type: '乐捐立即生效',
                        target_type: 'water_board',
                        target_id: waterBoard.id,
                        old_value: JSON.stringify({ status: waterBoard.status }),
                        new_value: JSON.stringify({ status: '乐捐' }),
                        remark: `${coach.stage_name} 提交乐捐，当前小时立即生效`
                    });
                }
            }

            // 获取刚创建的记录
            const newRecord = await tx.get('SELECT * FROM lejuan_records WHERE id = ?', [recordId]);

            return { ...newRecord, shouldActivateNow };
        });

        // 调度定时器（仅对非立即激活的记录）
        if (!result.shouldActivateNow) {
            // result 包含 coach_no, stage_name 等字段，需查 employee_id
            const coachInfo = await get('SELECT employee_id FROM coaches WHERE coach_no = ?', [result.coach_no]);
            timerManager.scheduleLejuanTimer(result, {
                coach_no: result.coach_no,
                employee_id: coachInfo ? (coachInfo.employee_id || '-') : '-',
                stage_name: result.stage_name
            });
        }

        res.json({
            success: true,
            data: {
                id: result.id,
                scheduled_start_time: result.scheduled_start_time,
                lejuan_status: result.lejuan_status,
                immediate: result.shouldActivateNow
            }
        });
    } catch (err) {
        console.error('创建乐捐记录失败:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

/**
 * GET /api/lejuan-records/my — 我的乐捐记录（助教，近2天）
 */
router.get('/my', requireBackendPermission(['all']), async (req, res) => {
    try {
        const user = req.user;
        let employeeId;

        if (user.userType === 'coach') {
            // 助教：用 coachNo 查 employee_id
            const coach = await get('SELECT employee_id FROM coaches WHERE coach_no = ?', [user.coachNo]);
            employeeId = coach?.employee_id;
        } else {
            employeeId = req.query.employee_id;
        }

        if (!employeeId) {
            return res.status(400).json({ error: '缺少 employee_id 参数' });
        }

        // 计算北京时间2天前的日期字符串
        const twoDaysAgo = TimeUtil.offsetDB(-48).split(' ')[0]; // YYYY-MM-DD

        const records = await all(`
            SELECT * FROM lejuan_records
            WHERE employee_id = ?
                AND date(created_at) >= ?
            ORDER BY
                CASE lejuan_status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                scheduled_start_time DESC
        `, [employeeId, twoDaysAgo]);

        res.json({ success: true, data: records });
    } catch (err) {
        console.error('查询我的乐捐记录失败:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

/**
 * GET /api/lejuan-records/list — 乐捐一览（助教管理/店长）
 */
router.get('/list', requireBackendPermission(['coachManagement']), async (req, res) => {
    try {
        const { status, days } = req.query;
        const daysNum = parseInt(days) || 3;

        let statusFilter;
        if (!status || status === 'all') {
            statusFilter = ['pending', 'active', 'returned'];
        } else {
            statusFilter = [status];
        }

        const placeholders = statusFilter.map(() => '?').join(',');

        const dateFrom = TimeUtil.offsetDB(-24 * daysNum).split(' ')[0];

        const records = await all(`
            SELECT lr.*, c.shift 
            FROM lejuan_records lr
            LEFT JOIN coaches c ON lr.coach_no = c.coach_no
            WHERE lr.lejuan_status IN (${placeholders})
                AND date(lr.created_at) >= ?
            ORDER BY 
                CASE lr.lejuan_status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                lr.scheduled_start_time DESC
        `, [...statusFilter, dateFrom]);

        res.json({ success: true, data: records });
    } catch (err) {
        console.error('查询乐捐一览失败:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

/**
 * POST /api/lejuan-records/:id/return — 乐捐归来（助教管理/店长/管理员/教练）
 * 
 * 计算逻辑：
 * 1. 根据助教班次确定下班时间：早班 23:00，晚班次日 02:00
 * 2. 对比当前时间和下班时间：
 *    - 当前时间 >= 下班时间：按下班时间计算时长，水牌设为“下班”
 *    - 当前时间 < 下班时间：按当前时间计算时长，水牌设为“空闲”
 * 3. 乐捐时长计算：结束分钟 > 10 算一小时，否则不算
 * 4. 只有水牌当前状态为“乐捐”时才更新水牌状态
 */
router.post('/:id/return', requireBackendPermission(['coachManagement']), async (req, res) => {
    try {
        const recordId = parseInt(req.params.id);
        const { operator } = req.body;

        if (!operator) {
            return res.status(400).json({ error: '缺少操作人信息' });
        }

        const result = await runInTransaction(async (tx) => {
            // 获取乐捐记录
            const record = await tx.get(
                'SELECT * FROM lejuan_records WHERE id = ? AND lejuan_status = ?',
                [recordId, 'active']
            );
            if (!record) {
                throw { status: 400, error: '记录不存在或不是乐捐中状态' };
            }

            // 获取助教班次
            const coach = await tx.get(
                'SELECT shift, stage_name FROM coaches WHERE coach_no = ?',
                [record.coach_no]
            );
            if (!coach) {
                throw { status: 400, error: '找不到助教信息' };
            }

            const now = TimeUtil.nowDB();
            const nowDate = new Date(now + '+08:00');

            // 计算下班时间（北京时间）
            let offWorkTime;
            if (coach.shift === '早班') {
                // 早班：当天 23:00
                const todayStr = TimeUtil.todayStr();
                offWorkTime = new Date(`${todayStr} 23:00:00+08:00`);
            } else {
                // 晚班：次日 02:00
                const tomorrow = new Date(nowDate);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
                offWorkTime = new Date(`${tomorrowStr} 02:00:00+08:00`);
            }

            // 确定计算时间和水牌状态
            let calculateTime;
            let waterStatus;
            if (nowDate.getTime() >= offWorkTime.getTime()) {
                // 已过下班时间：按下班时间计算，水牌设为下班
                calculateTime = offWorkTime;
                waterStatus = '下班';
            } else {
                // 未到下班时间：按当前时间计算，水牌设为空闲
                calculateTime = nowDate;
                waterStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
            }

            // 计算乐捐时长（分钟>10算一小时）
            const actualStart = new Date(record.actual_start_time + '+08:00');
            const diffMs = calculateTime.getTime() - actualStart.getTime();
            const baseHours = Math.floor(diffMs / (60 * 60 * 1000));
            const endMinute = calculateTime.getMinutes();
            const extraHour = endMinute > 10 ? 1 : 0;
            const lejuanHours = Math.max(1, baseHours + extraHour);

            // 格式化归来时间（用于存储）
            const returnTimeStr = TimeUtil.format(calculateTime).replace(/\//g, '-').replace(' ', ' ') + ':00';

            // 更新乐捐记录
            await tx.run(
                `UPDATE lejuan_records 
                 SET lejuan_status = 'returned',
                     return_time = ?,
                     lejuan_hours = ?,
                     returned_by = ?,
                     updated_at = ?
                 WHERE id = ? AND lejuan_status = 'active'`,
                [returnTimeStr, lejuanHours, operator, now, recordId]
            );

            // 检查并更新水牌状态（只有当前状态为“乐捐”时才更新）
            const waterBoard = await tx.get(
                'SELECT * FROM water_boards WHERE coach_no = ?',
                [record.coach_no]
            );
            
            if (waterBoard && waterBoard.status === '乐捐') {
                await tx.run(
                    `UPDATE water_boards 
                     SET status = ?, table_no = NULL, clock_in_time = NULL, updated_at = ?
                     WHERE coach_no = ?`,
                    [waterStatus, now, record.coach_no]
                );

                // 如果水牌设为下班，同步更新打卡表（凌晨下班时上班记录可能在昨天）
                if (waterStatus === '下班') {
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
                    }
                }

                // 操作日志
                await operationLogService.create(tx, {
                    operator_phone: operator,
                    operator_name: operator,
                    operation_type: '乐捐归来',
                    target_type: 'water_board',
                    target_id: waterBoard.id,
                    old_value: JSON.stringify({ status: '乐捐' }),
                    new_value: JSON.stringify({ status: waterStatus }),
                    remark: `${coach.stage_name} 乐捐归来，外出 ${lejuanHours} 小时（${waterStatus === '下班' ? '已过下班时间' : '正常归来'}）`
                });
            } else if (waterBoard && waterBoard.status !== '乐捐') {
                // 水牌状态不是乐捐，只记录日志，不修改水牌
                await operationLogService.create(tx, {
                    operator_phone: operator,
                    operator_name: operator,
                    operation_type: '乐捐归来',
                    target_type: 'lejuan_record',
                    target_id: recordId,
                    old_value: JSON.stringify({ lejuan_status: 'active' }),
                    new_value: JSON.stringify({ lejuan_status: 'returned', lejuan_hours: lejuanHours }),
                    remark: `${coach.stage_name} 乐捐归来，外出 ${lejuanHours} 小时（水牌当前状态: ${waterBoard.status}，未修改水牌）`
                });
            }

            return {
                id: recordId,
                coach_no: record.coach_no,
                lejuan_hours: lejuanHours,
                return_time: returnTimeStr,
                stage_name: coach.stage_name,
                water_status: waterBoard?.status === '乐捐' ? waterStatus : waterBoard?.status || null,
                water_updated: waterBoard?.status === '乐捐'
            };
        });

        res.json({ success: true, data: result });

        // 钉钉打卡时间查询（非阻塞）
        if (result.coach_no) {
            const coachInfo = await get('SELECT dingtalk_user_id FROM coaches WHERE coach_no = ?', [result.coach_no]);
            if (coachInfo && coachInfo.dingtalk_user_id) {
                dingtalkService.queryLejuanReturnAttendance(coachInfo.dingtalk_user_id, result.coach_no, recordId, { get, all, enqueueRun })
                    .then(tip => {
                        if (tip) {
                            dingtalkService.dingtalkLog.write(`乐捐归来 ${result.coach_no}: ${tip}`);
                        }
                    })
                    .catch(err => dingtalkService.dingtalkLog.write(`乐捐归来钉钉查询异常: ${err.message}`));
            }
        }
    } catch (err) {
        if (err.status) {
            return res.status(err.status).json({ error: err.error });
        }
        console.error('乐捐归来失败:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

/**
 * PUT /api/lejuan-records/:id/proof — 提交/修改付款截图（助教，近2天）
 */
router.put('/:id/proof', requireBackendPermission(['all']), async (req, res) => {
    try {
        const recordId = parseInt(req.params.id);
        const { proof_image_url } = req.body;

        if (!proof_image_url) {
            return res.status(400).json({ error: '缺少 proof_image_url 参数' });
        }

        const user = req.user;
        let employeeId;

        if (user.userType === 'coach') {
            const coach = await get('SELECT employee_id FROM coaches WHERE coach_no = ?', [user.coachNo]);
            employeeId = coach?.employee_id;
        } else {
            employeeId = req.body.employee_id;
            // 兜底：如果用户同时是助教，用手机号查 coaches 表
            // 支持 memberToken(user.phone) 和 adminToken(user.username=手机号)
            const phone = user.phone || user.username;
            if (!employeeId && phone) {
                const coach = await get('SELECT employee_id FROM coaches WHERE phone = ? AND status != ?', [phone, '离职']);
                employeeId = coach?.employee_id;
            }
        }

        if (!employeeId) {
            return res.status(400).json({ error: '无法确定操作人身份' });
        }

        // 获取记录
        const record = await get(
            'SELECT * FROM lejuan_records WHERE id = ? AND employee_id = ?',
            [recordId, employeeId]
        );
        if (!record) {
            return res.status(404).json({ error: '记录不存在或不是您的记录' });
        }

        // 校验：近2天内
        const twoDaysAgo = TimeUtil.offsetDB(-48).split(' ')[0];
        const createdDate = record.created_at.split(' ')[0];
        if (createdDate < twoDaysAgo) {
            return res.status(400).json({ error: '只能修改近2天内的乐捐记录截图' });
        }

        const now = TimeUtil.nowDB();

        await enqueueRun(
            `UPDATE lejuan_records 
             SET proof_image_url = ?, proof_image_updated_at = ?, updated_at = ?
             WHERE id = ?`,
            [proof_image_url, now, now, recordId]
        );

        res.json({ success: true, data: { id: recordId, proof_image_url } });
    } catch (err) {
        console.error('更新付款截图失败:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

/**
 * DELETE /api/lejuan-records/:id — 删除乐捐预约（助教，仅pending状态）
 */
router.delete('/:id', requireBackendPermission(['all']), async (req, res) => {
    try {
        const recordId = parseInt(req.params.id);
        const user = req.user;
        let employeeId;

        if (user.userType === 'coach') {
            const coach = await get('SELECT employee_id FROM coaches WHERE coach_no = ?', [user.coachNo]);
            employeeId = coach?.employee_id;
        } else {
            employeeId = req.query.employee_id;
        }

        if (!employeeId) {
            return res.status(400).json({ error: '无法确定操作人身份' });
        }

        const record = await get(
            'SELECT * FROM lejuan_records WHERE id = ? AND employee_id = ?',
            [recordId, employeeId]
        );
        if (!record) {
            return res.status(404).json({ error: '记录不存在或不是您的记录' });
        }

        if (record.lejuan_status !== 'pending') {
            return res.status(400).json({ error: '只能删除待出发状态的乐捐记录' });
        }

        // 取消定时器
        timerManager.cancelLejuanTimer(recordId);

        // 删除记录
        await runInTransaction(async (tx) => {
            await tx.run('DELETE FROM lejuan_records WHERE id = ?', [recordId]);
        });

        res.json({ success: true, message: '乐捐预约已删除' });
    } catch (err) {
        console.error('删除乐捐记录失败:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

/**
 * GET /api/lejuan-records/pending-timers — 获取待调度定时器（内部）
 */
router.get('/pending-timers', requireBackendPermission(['coachManagement']), async (req, res) => {
    try {
        const now = TimeUtil.nowDB();
        const records = await all(`
            SELECT * FROM lejuan_records 
            WHERE lejuan_status = 'pending'
                AND scheduled_start_time <= datetime(?, '+13 hours')
            ORDER BY scheduled_start_time
        `, [now]);

        res.json({ success: true, data: records });
    } catch (err) {
        console.error('查询待调度定时器失败:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

module.exports = router;
