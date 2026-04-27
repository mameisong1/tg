/**
 * 申请事项 API
 * 路径:/api/applications
 * 功能:加班申请、公休申请、约客记录提交与审批
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { runInTransaction } = require('../db');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const operationLogService = require('../services/operation-log');
const timerManager = require('../services/timer-manager');
const TimeUtil = require('../utils/time');
const errorLogger = require('../utils/error-logger');
const redisCache = require('../utils/redis-cache');

// 权限中间件:需要登录
router.use(auth.required);

/**
 * POST /api/applications
 * 提交申请(加班/公休/乐捐/约客记录)- 助教可提交
 */
router.post('/', requireBackendPermission(['all']), async (req, res) => {
  try {
    const result = await runInTransaction(async (tx) => {
    const {
      applicant_phone,
      application_type,
      remark,
      proof_image_url,
      images,
      extra_data
    } = req.body;

    if (!applicant_phone || !application_type) {
      throw { status: 400, error: '缺少必填字段' };
    }

    const validTypes = [
      '早加班申请',
      '晚加班申请',
      '公休申请',
      '约客记录',
      '班次切换申请',
      '请假申请',
      '休息申请'
    ];

    if (!validTypes.includes(application_type)) {
      throw { status: 400, error: '无效的申请类型' };
    }

    const status = 0; // 新申请状态为待处理

    // === 新增申请类型校验 ===

    // === QA-20260420-4:时间段校验和水牌状态校验 ===

    // 时间段校验函数
    const validateTimeWindow = (nowHour, startHour, endHour, errorMsg) => {
      if (nowHour < startHour || nowHour >= endHour) {
        throw { status: 400, error: errorMsg };
      }
      return true;
    };

    const nowHour = new Date(TimeUtil.nowDB()).getHours();

    // 加班/公休申请时间校验:0:00 - 14:00
    if (['早加班申请', '晚加班申请', '公休申请'].includes(application_type)) {
      validateTimeWindow(nowHour, 0, 14, '加班/公休申请时间已截止(仅限 0:00 - 14:00),请明天再申请');

      // 水牌状态校验:必须是「下班」状态
      const coach = await tx.get(
        'SELECT coach_no, stage_name FROM coaches WHERE employee_id = ? OR phone = ?',
        [applicant_phone, applicant_phone]
      );
      if (coach) {
        const waterBoard = await tx.get(
          'SELECT status FROM water_boards WHERE coach_no = ?',
          [coach.coach_no]
        );
        if (waterBoard && waterBoard.status !== '下班') {
          throw { status: 400, error: `当前水牌状态为「${waterBoard.status}」,只能从「下班」状态申请加班/公休` };
        }
      }
    }

    // 班次切换:校验每月2次限制
    if (application_type === '班次切换申请') {
      const todayStr = TimeUtil.todayStr();
      const monthStart = todayStr.substring(0, 7) + '-01 00:00:00';
      const monthEnd = todayStr.substring(0, 7) + '-31 23:59:59';
      const count = await tx.get(
        `SELECT COUNT(*) as cnt FROM applications
         WHERE applicant_phone = ? AND application_type = ? AND status = 1
         AND created_at >= ? AND created_at <= ?`,
        [applicant_phone, '班次切换申请', monthStart, monthEnd]
      );
      if (count.cnt >= 2) {
        throw { status: 400, error: '本月班次切换次数已达上限(2次/月)' };
      }
      if (!extra_data || !extra_data.target_shift || !['早班', '晚班'].includes(extra_data.target_shift)) {
        throw { status: 400, error: '请选择目标班次(早班/晚班)' };
      }
    }

    // 休息申请:校验每月4天限制（按休息日所在月份）+ 日期范围
    if (application_type === '休息申请') {
      if (!extra_data || !extra_data.rest_date) {
        throw { status: 400, error: '请选择休息日期' };
      }
      const todayStr = TimeUtil.todayStr();
      const restDate = extra_data.rest_date;
      if (restDate < todayStr) {
        throw { status: 400, error: '不能选择过去的日期' };
      }
      const maxDate = TimeUtil.offsetDB(30 * 24).substring(0, 10);
      if (restDate > maxDate) {
        throw { status: 400, error: '只能选择今天起未来30天内的日期' };
      }
      // 检查是否已有该日期的休息/请假申请
      const existing = await tx.get(
        `SELECT id FROM applications
         WHERE applicant_phone = ? AND application_type IN ('休息申请', '请假申请')
         AND status = 1 AND extra_data LIKE ?`,
        [applicant_phone, `\'%"rest_date":"${restDate}"%\'`]
      );
      // 如果 LIKE 匹配不到,用 JSON.parse 方式再查
      if (!existing) {
        const existing2 = await tx.get(
          `SELECT id FROM applications
           WHERE applicant_phone = ? AND application_type IN ('休息申请', '请假申请')
           AND status = 1 AND extra_data LIKE ?`,
          [applicant_phone, `\'%"${restDate}"%\'`]
        );
        if (existing2) {
          throw { status: 400, error: '该日期已有审批通过的休息/请假申请' };
        }
      } else {
        throw { status: 400, error: '该日期已有审批通过的休息/请假申请' };
      }
      // 月度4天限制
      const monthStart = todayStr.substring(0, 7) + '-01 00:00:00';
      const monthEnd = todayStr.substring(0, 7) + '-31 23:59:59';
      const restRecords = await tx.all(
        `SELECT extra_data FROM applications
         WHERE applicant_phone = ? AND application_type IN ('休息申请', '请假申请')
         AND status = 1 AND created_at >= ? AND created_at <= ?`,
        [applicant_phone, monthStart, monthEnd]
      );
      const restDays = new Set();
      for (const r of restRecords) {
        try {
          const ed = JSON.parse(r.extra_data);
          if (ed.rest_date) restDays.add(ed.rest_date);
          if (ed.leave_date) restDays.add(ed.leave_date);
        } catch(e) {}
      }
      if (restDays.size >= 4) {
        throw { status: 400, error: '本月休息日已达上限(4天/月)' };
      }
    }

    // 请假申请:校验必填字段
    if (application_type === '请假申请') {
      if (!extra_data || !extra_data.leave_type || !['事假', '病假'].includes(extra_data.leave_type)) {
        throw { status: 400, error: '请选择请假类型(事假/病假)' };
      }
      if (!extra_data || !extra_data.leave_date) {
        throw { status: 400, error: '请选择请假日期' };
      }
      if (!remark || remark.trim() === '') {
        throw { status: 400, error: '请假必须输入理由' };
      }
      const todayStr = TimeUtil.todayStr();
      const leaveDate = extra_data.leave_date;
      if (leaveDate < todayStr) {
        throw { status: 400, error: '不能选择过去的日期' };
      }
      const maxDate = TimeUtil.offsetDB(30 * 24).substring(0, 10);
      if (leaveDate > maxDate) {
        throw { status: 400, error: '只能选择今天起未来30天内的日期' };
      }
      // 检查日期重复
      const existing = await tx.get(
        `SELECT id FROM applications
         WHERE applicant_phone = ? AND application_type IN ('休息申请', '请假申请')
         AND status = 1 AND extra_data LIKE ?`,
        [applicant_phone, `\'%"${leaveDate}"%\'`]
      );
      if (existing) {
        throw { status: 400, error: '该日期已有审批通过的休息/请假申请' };
      }
      // 月度4天限制(复用逻辑)
      const monthStart = todayStr.substring(0, 7) + '-01 00:00:00';
      const monthEnd = todayStr.substring(0, 7) + '-31 23:59:59';
      const restRecords = await tx.all(
        `SELECT extra_data FROM applications
         WHERE applicant_phone = ? AND application_type IN ('休息申请', '请假申请')
         AND status = 1 AND created_at >= ? AND created_at <= ?`,
        [applicant_phone, monthStart, monthEnd]
      );
      const restDays = new Set();
      for (const r of restRecords) {
        try {
          const ed = JSON.parse(r.extra_data);
          if (ed.rest_date) restDays.add(ed.rest_date);
          if (ed.leave_date) restDays.add(ed.leave_date);
        } catch(e) {}
      }
      if (restDays.size >= 4) {
        throw { status: 400, error: '本月休息日已达上限(4天/月)' };
      }
    }

    const insertResult = await tx.run(`
      INSERT INTO applications (
        applicant_phone,
        application_type,
        remark,
        images,
        status,
        extra_data,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      applicant_phone,
      application_type,
      remark || null,
      images || null,
      status,
      extra_data ? JSON.stringify(extra_data) : null,
      TimeUtil.nowDB(),
      TimeUtil.nowDB()
    ]);

    const applicationId = insertResult.lastID;

    const user = req.user;
    await operationLogService.create(tx, {
      operator_phone: applicant_phone,
      operator_name: req.user.name,
      operation_type: '提交申请',
      target_type: 'application',
      target_id: applicationId,
      old_value: null,
      new_value: JSON.stringify({
        application_type,
        status: status === 0 ? '待处理' : '有效'
      }),
      remark: `提交${application_type}`
    });

    return { id: applicationId, status };
    });

    res.json({
      success: true,
      data: {
        id: result.id,
        status: result.status
      }
    });
  } catch (error) {
    errorLogger.logApiRejection(req, error);
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
    console.error('提交申请失败:', error);
    res.status(500).json({
      success: false,
      error: '提交申请失败'
    });
  }
});

/**
 * GET /api/applications/approved-recent
 * 获取近N天内已审批(同意/拒绝)的申请记录
 * 参数:
 *   - application_types: 逗号分隔的申请类型,如 "早加班申请,晚加班申请"
 *   - days: 天数,默认2
 *   - status: 1=已同意, 2=已拒绝
 *   - future_only: true=只返回日期>=今天且已同意的记录(按日期升序)
 */
router.get('/approved-recent', requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { application_types, days = 2, status, future_only } = req.query;
    const isFutureOnly = future_only === 'true';

    if (isFutureOnly) {
      // 未来模式：查询所有已同意的记录，按 extra_data 中的日期过滤和排序
      const typeStr = application_types ? application_types.split(',').map(t => `'${t.trim()}'`).join(',') : null;
      let sql = `
        SELECT a.id, a.applicant_phone, a.application_type, a.remark,
               a.status, a.approver_phone, a.approve_time, a.extra_data, a.created_at,
               c.stage_name, c.coach_no, c.employee_id, c.shift
        FROM applications a
        LEFT JOIN coaches c ON a.applicant_phone = c.employee_id OR a.applicant_phone = c.phone
        WHERE a.status = 1
      `;
      if (typeStr) {
        sql += ` AND a.application_type IN (${typeStr})`;
      }
      sql += ' ORDER BY a.approve_time DESC';

      const records = await db.all(sql);
      const today = TimeUtil.todayStr();

      // JS 层过滤：日期 >= 今天，并按日期升序排序
      const dateFields = ['rest_date', 'leave_date', 'date', 'start_date'];
      const filtered = [];
      for (const r of records) {
        if (!r.extra_data) continue;
        try {
          const extra = JSON.parse(r.extra_data);
          let recordDate = null;
          for (const field of dateFields) {
            if (extra[field]) { recordDate = extra[field]; break; }
          }
          if (recordDate && recordDate >= today) {
            let hours = extra.hours || null;
            if (hours === null && r.remark) {
              const match = r.remark.match(/(\d+)小时/);
              if (match) hours = parseInt(match[1], 10);
            }
            filtered.push({
              id: r.id,
              applicant_phone: r.applicant_phone,
              employee_id: r.employee_id || '-',
              coach_no: r.coach_no || '-',
              stage_name: r.stage_name || '未知',
              shift: r.shift || '-',
              application_type: r.application_type,
              hours: hours,
              extra_data: r.extra_data,
              _sortDate: recordDate,
              status: r.status,
              approve_time: r.approve_time,
              created_at: r.created_at
            });
          }
        } catch (e) {}
      }
      // 按日期升序（早的优先）
      filtered.sort((a, b) => a._sortDate.localeCompare(b._sortDate));
      // 清理内部字段
      const formatted = filtered.map(({ _sortDate, ...rest }) => rest);
      return res.json({ success: true, data: formatted });
    }

    // 原有逻辑：近N天模式
    const daysNum = parseInt(days, 10);
    const sinceTime = TimeUtil.offsetDB(-daysNum * 24);

    let sql = `
      SELECT a.id, a.applicant_phone, a.application_type, a.remark,
             a.status, a.approver_phone, a.approve_time, a.extra_data, a.created_at,
             c.stage_name, c.coach_no, c.employee_id, c.shift
      FROM applications a
      LEFT JOIN coaches c ON a.applicant_phone = c.employee_id OR a.applicant_phone = c.phone
      WHERE a.status IN (1, 2)
        AND a.created_at >= ?
    `;
    const params = [sinceTime];

    if (application_types) {
      const types = application_types.split(',').map(t => t.trim());
      sql += ' AND a.application_type IN (' + types.map(() => '?').join(',') + ')';
      params.push(...types);
    }

    if (status !== undefined) {
      sql += ' AND a.status = ?';
      params.push(parseInt(status, 10));
    }

    sql += ' ORDER BY a.approve_time DESC';

    const records = await db.all(sql, params);

    // 格式化返回:提取小时数
    const formatted = records.map(r => {
      let hours = null;
      if (r.extra_data) {
        try {
          const extra = JSON.parse(r.extra_data);
          hours = extra.hours || null;
        } catch (e) {}
      }
      // 如果 extra_data 没有,尝试从 remark 解析
      if (hours === null && r.remark) {
        const match = r.remark.match(/(\d+)小时/);
        if (match) hours = parseInt(match[1], 10);
      }

      return {
        id: r.id,
        applicant_phone: r.applicant_phone,
        employee_id: r.employee_id || '-',
        coach_no: r.coach_no || '-',
        stage_name: r.stage_name || '未知',
        shift: r.shift || '-',
        application_type: r.application_type,
        hours: hours,
        extra_data: r.extra_data,  // 返回 extra_data，用于解析请假/休息日期
        status: r.status,
        approve_time: r.approve_time,
        created_at: r.created_at
      };
    });

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('获取近期审批记录失败:', error);
    res.status(500).json({ success: false, error: '获取近期审批记录失败' });
  }
});

/**
 * GET /api/applications
 * 获取申请列表(支持 since 参数和 status 多值)
 */
router.get('/', requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const {
      application_type,
      status,
      since,
      applicant_phone,
      approver_phone,
      limit = 50
    } = req.query;

    let sql = `
      SELECT a.*, c.stage_name, c.employee_id, c.coach_no
      FROM applications a
      LEFT JOIN coaches c ON a.applicant_phone = c.employee_id OR a.applicant_phone = c.phone
      WHERE 1=1
    `;
    const params = [];

    if (application_type) {
      sql += ' AND a.application_type = ?';
      params.push(application_type);
    }

    if (status !== undefined) {
      // 支持逗号分隔的多状态,如 "1,2"
      const statusList = String(status).split(',').map(s => parseInt(s.trim()));
      if (statusList.length > 1) {
        sql += ' AND a.status IN (' + statusList.map(() => '?').join(',') + ')';
        params.push(...statusList);
      } else {
        sql += ' AND a.status = ?';
        params.push(statusList[0]);
      }
    }

    if (since) {
      sql += ' AND a.created_at >= ?';
      params.push(since);
    }

    if (applicant_phone) {
      sql += ' AND a.applicant_phone = ?';
      params.push(applicant_phone);
    }

    if (approver_phone) {
      sql += ' AND a.approver_phone = ?';
      params.push(approver_phone);
    }

    sql += ' ORDER BY a.created_at DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const applications = await db.all(sql, params);

    res.json({
      success: true,
      data: applications
    });
  } catch (error) {
    console.error('获取申请列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取申请列表失败'
    });
  }
});

/**
 * PUT /api/applications/:id/approve
 * 审批申请
 */
router.put('/:id/approve', requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const result = await runInTransaction(async (tx) => {
    const { id } = req.params;
    const { approver_phone, status: approveStatus } = req.body;

    if (approveStatus !== 1 && approveStatus !== 2) {
      throw { status: 400, error: '无效的审批状态' };
    }

    const application = await tx.get(
      'SELECT * FROM applications WHERE id = ?',
      [id]
    );

    if (!application) {
      throw { status: 404, error: '申请记录不存在' };
    }

    if (application.status !== 0) {
      throw { status: 400, error: '该申请已审批过' };
    }

    // === QA-20260420-4:时间段校验和过期申请校验 ===

    const nowDB = TimeUtil.nowDB();
    const nowHour = new Date(nowDB).getHours();
    const todayStr = TimeUtil.todayStr();

    // 审批时间校验:12:00 - 18:00
    if (nowHour < 12 || nowHour >= 18) {
      throw { status: 400, error: '审批时间仅限 12:00 - 18:00' };
    }

    // 过期申请校验:加班/公休只能审批当天提交的申请
    if (approveStatus === 1 && ['早加班申请', '晚加班申请', '公休申请'].includes(application.application_type)) {
      const applyDate = application.created_at.substring(0, 10);
      if (applyDate !== todayStr) {
        throw { status: 400, error: '只能审批当天提交的加班/公休申请,过期申请只能拒绝' };
      }
    }

    // 更新申请状态(审批永远成功)
    await tx.run(`
      UPDATE applications
      SET status = ?,
          approver_phone = ?,
          approve_time = ?,
          updated_at = ?
      WHERE id = ?
    `, [approveStatus, approver_phone || req.user.username, nowDB, nowDB, id]);
    
    // === 审批同意:处理水牌状态 ===
    if (approveStatus === 1) {
      const coach = await tx.get(
        'SELECT coach_no, stage_name, shift FROM coaches WHERE employee_id = ? OR phone = ?',
        [application.applicant_phone, application.applicant_phone]
      );

      if (coach) {
        const currentWaterBoard = await tx.get(
          'SELECT * FROM water_boards WHERE coach_no = ?',
          [coach.coach_no]
        );

        if (currentWaterBoard) {
          const currentStatus = currentWaterBoard.status;
          // QA-20260420-4:上桌状态仍拒绝审批(安全考虑)
          const isOnTable = currentStatus === '早班上桌' || currentStatus === '晚班上桌';
          if (isOnTable) {
            throw { status: 400, error: `助教${coach.stage_name}正在上桌服务(${currentStatus}),无法审批通过${application.application_type}` };
          }

          const oldValue = {
            status: currentWaterBoard.status,
            table_no: currentWaterBoard.table_no
          };

          let newStatus = currentWaterBoard.status;
          let shouldChangeWaterBoard = false; // 是否立即修改水牌
          let needTimer = false; // 是否需要设置Timer

          // === 加班/公休审批:水牌状态检查 ===
          if (['早加班申请', '晚加班申请', '公休申请'].includes(application.application_type)) {
            if (currentStatus === '下班') {
              // 水牌为下班状态,立即修改
              if (application.application_type === '早加班申请') newStatus = '早加班';
              else if (application.application_type === '晚加班申请') newStatus = '晚加班';
              else if (application.application_type === '公休申请') newStatus = '公休';
              shouldChangeWaterBoard = true;
            } else {
              // 水牌非下班状态,不修改水牌(但审批仍成功)
              console.log(`[QA-20260420-4] 加班审批同意,但水牌状态为「${currentStatus}」非下班,不修改水牌`);
              shouldChangeWaterBoard = false;
              // 记录extra_data
              const updatedExtraData = JSON.stringify({
                ...JSON.parse(application.extra_data || '{}'),
                water_board_skipped: true,
                water_board_skipped_reason: `水牌状态为「${currentStatus}」,不满足立即变更条件`
              });
              await tx.run(
                'UPDATE applications SET extra_data = ?, updated_at = ? WHERE id = ?',
                [updatedExtraData, nowDB, id]
              );
            }
          }

          // === 班次切换审批 ===
          if (application.application_type === '班次切换申请') {
            const targetShift = JSON.parse(application.extra_data).target_shift;
            await tx.run(
              'UPDATE coaches SET shift = ?, updated_at = ? WHERE coach_no = ?',
              [targetShift, nowDB, coach.coach_no]
            );

            // 只有上桌/空闲/加班状态才能修改水牌
            const allowedStatuses = ['早班上桌', '晚班上桌', '早班空闲', '晚班空闲', '早加班', '晚加班'];
            if (allowedStatuses.includes(currentStatus)) {
              // 状态映射：早班→晚班,晚班→早班
              const statusMap = {
                '早班上桌': '晚班上桌',
                '晚班上桌': '早班上桌',
                '早班空闲': '晚班空闲',
                '晚班空闲': '早班空闲',
                '早加班': '晚加班',
                '晚加班': '早加班'
              };
              newStatus = statusMap[currentStatus];
              shouldChangeWaterBoard = true;
            } else {
              // 非上桌/空闲/加班状态，禁止修改水牌
              console.log(`[班次切换] 水牌状态为「${currentStatus}」非上桌/空闲/加班状态,禁止修改水牌`);
              shouldChangeWaterBoard = false;
              const updatedExtraData = JSON.stringify({
                ...JSON.parse(application.extra_data || '{}'),
                water_board_skipped: true,
                water_board_skipped_reason: `水牌状态为「${currentStatus}」非上桌/空闲/加班状态`
              });
              await tx.run(
                'UPDATE applications SET extra_data = ?, updated_at = ? WHERE id = ?',
                [updatedExtraData, nowDB, id]
              );
            }
          }

          // === 休息申请审批:当天+已过12点不设Timer ===
          if (application.application_type === '休息申请') {
            const restDate = JSON.parse(application.extra_data).rest_date;
            const execTime = restDate + ' 12:00:00'; // Timer执行时间

            // 检查是否是当天 + 审批时间已过Timer时间
            if (restDate === todayStr && nowDB >= execTime) {
              // 当天 + 已过12点:不设Timer,直接修改水牌(如果水牌是离店状态)
              const offStatuses = ['下班', '公休', '请假', '休息'];
              if (offStatuses.includes(currentStatus)) {
                newStatus = '休息';
                shouldChangeWaterBoard = true;
                console.log(`[QA-20260420-4] 休息审批当天+已过12点,直接修改水牌`);
              } else {
                // 非离店状态,不修改水牌
                console.log(`[QA-20260420-4] 休息审批当天+已过12点,但水牌非离店状态「${currentStatus}」,不修改水牌`);
                shouldChangeWaterBoard = false;
                const updatedExtraData = JSON.stringify({
                  ...JSON.parse(application.extra_data || '{}'),
                  water_board_skipped: true,
                  water_board_skipped_reason: `水牌状态为「${currentStatus}」非离店状态`
                });
                await tx.run(
                  'UPDATE applications SET extra_data = ?, updated_at = ? WHERE id = ?',
                  [updatedExtraData, nowDB, id]
                );
              }
              needTimer = false; // 当天已过12点,不设Timer
            } else {
              // 未来日期或当天未过12点:只挂Timer,不立即修改水牌
              console.log(`[QA-20260422] 休息审批:未满足立即修改条件,只挂Timer`);
              shouldChangeWaterBoard = false;
              needTimer = true;
              const timerExtraData = JSON.stringify({
                ...JSON.parse(application.extra_data),
                scheduled: 1,
                timer_set: true,
                exec_time: execTime
              });
              await tx.run(
                'UPDATE applications SET extra_data = ?, updated_at = ? WHERE id = ?',
                [timerExtraData, nowDB, id]
              );
              timerManager.scheduleApplicationTimer(
                { id: parseInt(id), exec_time: execTime, application_type: '休息申请' },
                { coach_no: coach.coach_no, employee_id: coach.employee_id || '-', stage_name: coach.stage_name, application_type: '休息申请' }
              );
            }
          }

          // === 请假申请审批:当天+已过12点不设Timer ===
          if (application.application_type === '请假申请') {
            const leaveDate = JSON.parse(application.extra_data).leave_date;
            const execTime = leaveDate + ' 12:00:00'; // Timer执行时间

            // 检查是否是当天 + 审批时间已过Timer时间
            if (leaveDate === todayStr && nowDB >= execTime) {
              // 当天 + 已过12点:不设Timer,直接修改水牌(如果水牌是离店状态)
              const offStatuses = ['下班', '公休', '请假', '休息'];
              if (offStatuses.includes(currentStatus)) {
                newStatus = '请假';
                shouldChangeWaterBoard = true;
                console.log(`[QA-20260420-4] 请假审批当天+已过12点,直接修改水牌`);
              } else {
                // 非离店状态,不修改水牌
                console.log(`[QA-20260420-4] 请假审批当天+已过12点,但水牌非离店状态「${currentStatus}」,不修改水牌`);
                shouldChangeWaterBoard = false;
                const updatedExtraData = JSON.stringify({
                  ...JSON.parse(application.extra_data || '{}'),
                  water_board_skipped: true,
                  water_board_skipped_reason: `水牌状态为「${currentStatus}」非离店状态`
                });
                await tx.run(
                  'UPDATE applications SET extra_data = ?, updated_at = ? WHERE id = ?',
                  [updatedExtraData, nowDB, id]
                );
              }
              needTimer = false; // 当天已过12点,不设Timer
            } else {
              // 未来日期或当天未过12点:只挂Timer,不立即修改水牌
              console.log(`[QA-20260422] 请假审批:未满足立即修改条件,只挂Timer`);
              shouldChangeWaterBoard = false;
              needTimer = true;
              const timerExtraData = JSON.stringify({
                ...JSON.parse(application.extra_data),
                scheduled: 1,
                timer_set: true,
                exec_time: execTime
              });
              await tx.run(
                'UPDATE applications SET extra_data = ?, updated_at = ? WHERE id = ?',
                [timerExtraData, nowDB, id]
              );
              timerManager.scheduleApplicationTimer(
                { id: parseInt(id), exec_time: execTime, application_type: '请假申请' },
                { coach_no: coach.coach_no, employee_id: coach.employee_id || '-', stage_name: coach.stage_name, application_type: '请假申请' }
              );
            }
          }

          // === 执行水牌修改 ===
          if (shouldChangeWaterBoard) {
            await tx.run(`
              UPDATE water_boards
              SET status = ?, table_no = NULL, clock_in_time = NULL, updated_at = ?
              WHERE coach_no = ?
            `, [newStatus, nowDB, coach.coach_no]);

          const newValue = {
            status: newStatus,
            table_no: null
          };

          const user = req.user;
          await operationLogService.create(tx, {
            operator_phone: user.username,
            operator_name: user.name,
            operation_type: '申请审批',
            target_type: 'water_board',
            target_id: currentWaterBoard.id,
            old_value: JSON.stringify(oldValue),
            new_value: JSON.stringify(newValue),
            remark: `${application.application_type}审批通过,水牌状态:${oldValue.status} → ${newStatus}`
          });
          } // 结束 if (shouldChangeWaterBoard)
        } // 结束 if (currentWaterBoard)
      } // 结束 if (coach)
    } // 结束 if (approveStatus === 1)

    const user = req.user;
    await operationLogService.create(tx, {
      operator_phone: approver_phone || user.username,
      operator_name: user.name,
      operation_type: '申请审批',
      target_type: 'application',
      target_id: parseInt(id, 10),
      old_value: JSON.stringify({ status: '待处理' }),
      new_value: JSON.stringify({ status: approveStatus === 1 ? '同意' : '拒绝' }),
      remark: `审批${application.application_type}:${approveStatus === 1 ? '同意' : '拒绝'}`
    });

    return {
      id: parseInt(id, 10),
      status: approveStatus,
      approver_phone: approver_phone || req.user.username,
      approve_time: TimeUtil.nowDB()
    };
    });

    res.json({
      success: true,
      data: {
        id: result.id,
        status: result.status,
        approver_phone: result.approver_phone,
        approve_time: result.approve_time
      }
    });
  } catch (error) {
    errorLogger.logApiRejection(req, error);
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
    console.error('审批申请失败:', error);
    res.status(500).json({
      success: false,
      error: '审批申请失败'
    });
  }
});

/**
 * POST /api/applications/:id/cancel-approved
 * 撤销已同意的请假/休息预约申请
 * 条件：当前时间 < 请假/休息日期 12:00
 * 操作：取消Timer + 更新状态为已撤销(status=3)
 */
router.post('/:id/cancel-approved', requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await runInTransaction(async (tx) => {
      // 1. 查询申请记录
      const application = await tx.get('SELECT * FROM applications WHERE id = ?', [id]);
      if (!application) throw { status: 404, error: '申请记录不存在' };

      // 2. 校验类型和状态
      if (!['请假申请', '休息申请'].includes(application.application_type)) {
        throw { status: 400, error: '只能撤销请假/休息申请' };
      }
      if (application.status !== 1) throw { status: 400, error: '只能撤销已同意的申请' };

      // 3. 解析预约日期
      const extraData = JSON.parse(application.extra_data || '{}');
      const targetDate = extraData.rest_date || extraData.leave_date;
      if (!targetDate) throw { status: 400, error: '申请记录缺少日期信息' };

      // 4. 时间校验：当前 < 预约日期 12:00
      const nowDB = TimeUtil.nowDB();
      const nowTime = new Date(nowDB + '+08:00');
      const deadlineTime = new Date(targetDate + ' 12:00:00+08:00');
      if (nowTime >= deadlineTime) throw { status: 400, error: '撤销时间已截止（预约当日12:00前）' };

      // 5. 查询助教信息
      const coach = await tx.get(
        'SELECT coach_no, stage_name FROM coaches WHERE employee_id = ? OR phone = ?',
        [application.applicant_phone, application.applicant_phone]
      );

      // 6. 取消 Timer
      const timerId = `application_${id}`;
      timerManager.cancelTimer(timerId);

      // 7. 更新状态为已撤销(status=3)
      await tx.run(`
        UPDATE applications
        SET status = 3, updated_at = ?
        WHERE id = ?
      `, [nowDB, id]);

      // 8. 记录操作日志
      await operationLogService.create(tx, {
        operator_phone: req.user.username,
        operator_name: req.user.name,
        operation_type: '撤销申请',
        target_type: 'application',
        target_id: parseInt(id, 10),
        old_value: JSON.stringify({ status: 1 }),
        new_value: JSON.stringify({ status: 3, cancelled_by: req.user.username }),
        remark: `撤销预约申请（${targetDate}）`
      });

      return { success: true, target_date: targetDate, new_status: 3 };
    });

    res.json(result);

  } catch (error) {
    errorLogger.logApiRejection(req, error);
    if (error.status) return res.status(error.status).json({ success: false, error: error.error });
    console.error('撤销申请失败:', error);
    res.status(500).json({ success: false, error: '撤销申请失败' });
  }
});

/**
 * GET /api/applications/today-approved-overtime
 * 获取当天所有已同意的加班申请的小时数(批量接口)
 */
router.get('/today-approved-overtime', auth.required, requireBackendPermission(['waterBoardManagement']), async (req, res) => {
  try {
    const todayStr = TimeUtil.todayStr(); // "YYYY-MM-DD"

    const records = await db.all(`
      SELECT a.applicant_phone, a.extra_data, a.remark,
             c.coach_no, c.shift, c.employee_id
      FROM applications a
      LEFT JOIN coaches c ON a.applicant_phone = c.employee_id OR a.applicant_phone = c.phone
      WHERE a.status = 1
        AND a.application_type IN ('早加班申请', '晚加班申请')
        AND date(a.created_at) = ?
    `, [todayStr]);

    const result = {};
    for (const r of records) {
      let hours = null;
      if (r.extra_data) {
        try {
          const extra = JSON.parse(r.extra_data);
          hours = extra.hours || null;
        } catch (e) {}
      }
      if (hours === null && r.remark) {
        const match = r.remark.match(/(\d+)小时/);
        if (match) hours = parseInt(match[1], 10);
      }
      if (hours !== null) {
        // 使用 employee_id 作为 key(前端 waterBoards 返回的 employee_id 匹配)
        const key = r.employee_id || r.applicant_phone;
        result[key] = {
          hours,
          coach_no: r.coach_no || '-',
          shift: r.shift || '-'
        };
      }
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取当天加班小时数失败:', error);
    res.status(500).json({ success: false, error: '获取当天加班小时数失败' });
  }
});

/**
 * GET /api/applications/pending-count
 * 获取待审批数字指示器（带 Redis 缓存）
 */
router.get('/pending-count', auth.required, requireBackendPermission(['店长', '助教管理', '管理员']), async (req, res) => {
  try {
    const cacheKey = 'pending_count';
    
    // 先查 Redis 缓存（1分钟）
    const cached = await redisCache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }
    
    const [shiftChange, leaveReq, restReq, overtime, publicLeave, lejuan] = await Promise.all([
      db.get('SELECT COUNT(*) as cnt FROM applications WHERE application_type = ? AND status = 0', ['班次切换申请']),
      db.get('SELECT COUNT(*) as cnt FROM applications WHERE application_type = ? AND status = 0', ['请假申请']),
      db.get('SELECT COUNT(*) as cnt FROM applications WHERE application_type = ? AND status = 0', ['休息申请']),
      db.get("SELECT COUNT(*) as cnt FROM applications WHERE application_type IN ('早加班申请','晚加班申请') AND status = 0", []),
      db.get("SELECT COUNT(*) as cnt FROM applications WHERE application_type = '公休申请' AND status = 0", []),
      db.get("SELECT COUNT(*) as cnt FROM lejuan_records WHERE lejuan_status IN ('pending', 'active')", [])
    ]);
    
    const data = {
      shift_change: shiftChange.cnt,
      leave: leaveReq.cnt,
      rest: restReq.cnt,
      total: shiftChange.cnt + leaveReq.cnt + restReq.cnt,
      overtime: overtime.cnt,
      public_leave: publicLeave.cnt,
      lejuan: lejuan.cnt
    };
    
    // 写入 Redis 缓存（1分钟 = 60秒）
    await redisCache.set(cacheKey, data, 60);
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('获取待审批数量失败:', error);
    res.status(500).json({ success: false, error: '获取待审批数量失败' });
  }
});

/**
 * GET /api/applications/shift-stats
 * 获取当前早晚班人数
 */
router.get('/shift-stats', requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    // 分别统计早班全职、晚班全职、兼职（避免重复计算）
    const [earlyFullTime, lateFullTime, partTime] = await Promise.all([
      db.get("SELECT COUNT(*) as cnt FROM coaches WHERE shift = '早班' AND status = '全职'"),
      db.get("SELECT COUNT(*) as cnt FROM coaches WHERE shift = '晚班' AND status = '全职'"),
      db.get("SELECT COUNT(*) as cnt FROM coaches WHERE status = '兼职'")
    ]);
    
    res.json({
      success: true,
      data: {
        early_shift: earlyFullTime.cnt,
        late_shift: lateFullTime.cnt,
        part_time: partTime.cnt,
        total: earlyFullTime.cnt + lateFullTime.cnt + partTime.cnt
      }
    });
  } catch (error) {
    console.error('获取班次统计失败:', error);
    res.status(500).json({ success: false, error: '获取班次统计失败' });
  }
});

/**
 * DELETE /api/applications/:id
 * 助教取消自己的待审批申请
 */
router.delete('/:id', requireBackendPermission(['all']), async (req, res) => {
  try {
    const { id } = req.params;
    const { applicant_phone } = req.query;

    if (!applicant_phone) {
      throw { status: 400, error: '缺少 applicant_phone 参数' };
    }

    const application = await db.get(
      'SELECT * FROM applications WHERE id = ? AND applicant_phone = ?',
      [id, applicant_phone]
    );
    if (!application) {
      throw { status: 404, error: '申请记录不存在或不是您的申请' };
    }
    if (application.status !== 0) {
      throw { status: 400, error: '只能取消待处理状态的申请' };
    }

    // 如果是休息/请假且已设置定时器,取消定时器
    if (['休息申请', '请假申请'].includes(application.application_type)) {
      timerManager.cancelApplicationTimer(parseInt(id));
    }

    await runInTransaction(async (tx) => {
      await tx.run('DELETE FROM applications WHERE id = ?', [id]);
    });

    res.json({ success: true, message: '申请已取消' });
  } catch (error) {
    errorLogger.logApiRejection(req, error);
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
    console.error('取消申请失败:', error);
    res.status(500).json({ success: false, error: '取消申请失败' });
  }
});

/**
 * GET /api/applications/my-month-count
 * 我的本月申请次数
 */
router.get('/my-month-count', requireBackendPermission(['all']), async (req, res) => {
  try {
    const { applicant_phone, application_type, month } = req.query;

    if (!applicant_phone || !application_type) {
      throw { status: 400, error: '缺少必要参数' };
    }

    const todayStr = TimeUtil.todayStr();
    let count = 0;
    let limit = 0;
    let targetMonth = '';

    if (application_type === '班次切换申请') {
      // 班次切换：按申请提交月份计算，每月2次
      const monthStart = todayStr.substring(0, 7) + '-01 00:00:00';
      const monthEnd = todayStr.substring(0, 7) + '-31 23:59:59';
      const result = await db.get(
        `SELECT COUNT(*) as cnt FROM applications
         WHERE applicant_phone = ? AND application_type = ? AND status = 1
         AND created_at >= ? AND created_at <= ?`,
        [applicant_phone, '班次切换申请', monthStart, monthEnd]
      );
      count = result.cnt;
      limit = 2;
      targetMonth = todayStr.substring(0, 7);
    } else if (application_type === '休息申请') {
      // 休息申请：按休息日所在月份计算，每月4天
      targetMonth = month || todayStr.substring(0, 7);
      const monthStart = targetMonth + '-01 00:00:00';
      const monthEnd = targetMonth + '-31 23:59:59';
      
      // 只统计休息申请，不统计请假申请
      const records = await db.all(
        `SELECT extra_data FROM applications
         WHERE applicant_phone = ? AND application_type = '休息申请'
         AND status = 1 AND created_at >= ? AND created_at <= ?`,
        [applicant_phone, monthStart, monthEnd]
      );
      
      const restDays = new Set();
      for (const r of records) {
        try {
          const ed = JSON.parse(r.extra_data);
          if (ed.rest_date && ed.rest_date.startsWith(targetMonth)) {
            restDays.add(ed.rest_date);
          }
        } catch(e) {}
      }
      count = restDays.size;
      limit = 4;
    } else if (application_type === '请假申请') {
      // 请假申请：没有每月天数限制
      count = 0;
      limit = 999; // 表示无限制
      targetMonth = month || todayStr.substring(0, 7);
    }

    res.json({
      success: true,
      data: {
        count,
        limit,
        remaining: limit === 999 ? '无限制' : Math.max(0, limit - count),
        month: targetMonth
      }
    });
  } catch (error) {
    errorLogger.logApiRejection(req, error);
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
    console.error('获取月度次数失败:', error);
    res.status(500).json({ success: false, error: '获取月度次数失败' });
  }
});

module.exports = router;
