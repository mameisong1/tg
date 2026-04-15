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
const lejuanTimer = require('../services/lejuan-timer');

// 所有接口需要认证
router.use(auth.required);

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
        if (timeMatch[3] !== '00' || timeMatch[4] !== '00') {
            return res.status(400).json({ error: '预约时间必须是整点（分钟=00）' });
        }

        // 校验：必须在未来（当天的小时允许）
        const now = TimeUtil.nowDB();
        const nowDate = now.split(' ')[0];
        const scheduledDate = scheduled_start_time.split(' ')[0];
        const isToday = scheduledDate === nowDate;
        const isCurrentHour = isToday && scheduled_start_time.substring(11, 13) === now.substring(11, 13);
        
        if (!isCurrentHour && scheduled_start_time < now) {
            return res.status(400).json({ error: '预约时间必须在未来或为当前小时' });
        }

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
                    lejuan_status, scheduled, actual_start_time, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [coach.coach_no, employee_id, coach.stage_name, scheduled_start_time, extra_hours || null, remark || null, initialStatus, scheduled, actualStartTime, req.user.username || employee_id]
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
            lejuanTimer.addNewRecord(result);
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
            ORDER BY scheduled_start_time DESC
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
 * POST /api/lejuan-records/:id/return — 乐捐归来（助教管理/店长）
 */
router.post('/:id/return', requireBackendPermission(['coachManagement']), async (req, res) => {
    try {
        const recordId = parseInt(req.params.id);
        const { operator } = req.body;

        if (!operator) {
            return res.status(400).json({ error: '缺少 operator 参数' });
        }

        const result = await runInTransaction(async (tx) => {
            // 获取记录
            const record = await tx.get(
                'SELECT * FROM lejuan_records WHERE id = ? AND lejuan_status = ?',
                [recordId, 'active']
            );
            if (!record) {
                throw { status: 400, error: '记录不存在或不是乐捐中状态' };
            }

            const now = TimeUtil.nowDB();

            // 计算外出小时数（向上取整，最小1小时）
            const actualStart = new Date(record.actual_start_time + '+08:00');
            const returnTime = new Date(now + '+08:00');
            const diffMs = returnTime.getTime() - actualStart.getTime();
            const lejuanHours = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)));

            // 更新乐捐记录
            await tx.run(
                `UPDATE lejuan_records 
                 SET lejuan_status = 'returned',
                     return_time = ?,
                     lejuan_hours = ?,
                     returned_by = ?,
                     updated_at = ?
                 WHERE id = ? AND lejuan_status = 'active'`,
                [now, lejuanHours, operator, now, recordId]
            );

            // 更新水牌状态
            const coach = await tx.get('SELECT shift FROM coaches WHERE coach_no = ?', [record.coach_no]);
            const newWaterStatus = coach?.shift === '早班' ? '早班空闲' : '晚班空闲';

            const waterBoard = await tx.get(
                'SELECT * FROM water_boards WHERE coach_no = ?',
                [record.coach_no]
            );
            if (waterBoard) {
                await tx.run(
                    `UPDATE water_boards 
                     SET status = ?, updated_at = ?
                     WHERE coach_no = ?`,
                    [newWaterStatus, now, record.coach_no]
                );

                // 操作日志
                await operationLogService.create(tx, {
                    operator_phone: operator,
                    operator_name: operator,
                    operation_type: '乐捐归来',
                    target_type: 'water_board',
                    target_id: waterBoard.id,
                    old_value: JSON.stringify({ status: '乐捐' }),
                    new_value: JSON.stringify({ status: newWaterStatus }),
                    remark: `${record.stage_name} 乐捐归来，外出 ${lejuanHours} 小时`
                });
            }

            return {
                id: recordId,
                lejuan_hours: lejuanHours,
                return_time: now,
                stage_name: record.stage_name
            };
        });

        res.json({ success: true, data: result });
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
        lejuanTimer.cancelRecord(recordId);

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
                AND scheduled_start_time <= datetime(?, '+1 hours')
            ORDER BY scheduled_start_time
        `, [now]);

        res.json({ success: true, data: records });
    } catch (err) {
        console.error('查询待调度定时器失败:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

module.exports = router;
