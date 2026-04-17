/**
 * 申请事项 API
 * 路径：/api/applications
 * 功能：加班申请、公休申请、约客记录提交与审批
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { runInTransaction } = require('../db');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const operationLogService = require('../services/operation-log');
const TimeUtil = require('../utils/time');

// 权限中间件：需要登录
router.use(auth.required);

/**
 * POST /api/applications
 * 提交申请（加班/公休/乐捐/约客记录）- 助教可提交
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
      '约客记录'
    ];
    
    if (!validTypes.includes(application_type)) {
      throw { status: 400, error: '无效的申请类型' };
    }
    
    const status = 0; // 新申请状态为待处理
    
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
 * 获取近N天内已审批（同意/拒绝）的申请记录
 * 参数：
 *   - application_types: 逗号分隔的申请类型，如 "早加班申请,晚加班申请"
 *   - days: 天数，默认2
 *   - status: 1=已同意, 2=已拒绝
 */
router.get('/approved-recent', requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { application_types, days = 2, status } = req.query;
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
    
    // 格式化返回：提取小时数
    const formatted = records.map(r => {
      let hours = null;
      if (r.extra_data) {
        try {
          const extra = JSON.parse(r.extra_data);
          hours = extra.hours || null;
        } catch (e) {}
      }
      // 如果 extra_data 没有，尝试从 remark 解析
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
 * 获取申请列表（支持 since 参数和 status 多值）
 */
router.get('/', requireBackendPermission(['all']), async (req, res) => {
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
      SELECT a.*, c.stage_name
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
      // 支持逗号分隔的多状态，如 "1,2"
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
    
    await tx.run(`
      UPDATE applications
      SET status = ?,
          approver_phone = ?,
          approve_time = ?,
          updated_at = ?
      WHERE id = ?
    `, [approveStatus, approver_phone || req.user.username, TimeUtil.nowDB(), TimeUtil.nowDB(), id]);
    
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
          const isOnTable = currentStatus === '早班上桌' || currentStatus === '晚班上桌';
          
          if (isOnTable) {
            throw { status: 400, error: `助教${coach.stage_name}正在上桌服务（${currentStatus}），无法审批通过${application.application_type}` };
          }
          
          const oldValue = {
            status: currentWaterBoard.status,
            table_no: currentWaterBoard.table_no
          };
          
          let newStatus = currentWaterBoard.status;
          
          if (application.application_type === '早加班申请') {
            newStatus = '早加班';
          } else if (application.application_type === '晚加班申请') {
            newStatus = '晚加班';
          } else if (application.application_type === '公休申请') {
            newStatus = '公休';
          }
          
          await tx.run(`
            UPDATE water_boards 
            SET status = ?, table_no = NULL, clock_in_time = NULL, updated_at = ? 
            WHERE coach_no = ?
          `, [newStatus, TimeUtil.nowDB(), coach.coach_no]);
          
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
            remark: `${application.application_type}审批通过，水牌状态：${oldValue.status} → ${newStatus}`
          });
        }
      }
    }
    
    const user = req.user;
    await operationLogService.create(tx, {
      operator_phone: approver_phone || user.username,
      operator_name: user.name,
      operation_type: '申请审批',
      target_type: 'application',
      target_id: parseInt(id, 10),
      old_value: JSON.stringify({ status: '待处理' }),
      new_value: JSON.stringify({ status: approveStatus === 1 ? '同意' : '拒绝' }),
      remark: `审批${application.application_type}：${approveStatus === 1 ? '同意' : '拒绝'}`
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
 * GET /api/applications/today-approved-overtime
 * 获取当天所有已同意的加班申请的小时数（批量接口）
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
        // 使用 employee_id 作为 key（前端 waterBoards 返回的 employee_id 匹配）
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

module.exports = router;
