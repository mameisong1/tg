/**
 * 申请事项 API
 * 路径：/api/applications
 * 功能：加班申请、公休申请、乐捐报备、约客记录提交与审批
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const operationLogService = require('../services/operation-log');

// 权限中间件：需要登录
router.use(auth.required);

/**
 * POST /api/applications
 * 提交申请（加班/公休/乐捐/约客记录）- 助教可提交
 */
router.post('/', requireBackendPermission(['all']), async (req, res) => {
  const transaction = await db.beginTransaction();
  
  try {
    const {
      applicant_phone,
      application_type,
      remark,
      proof_image_url,
      images,
      extra_data
    } = req.body;
    
    // 验证必填字段
    if (!applicant_phone || !application_type) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段'
      });
    }
    
    // 验证申请类型
    const validTypes = [
      '早加班申请',
      '晚加班申请',
      '公休申请',
      '乐捐报备',
      '约客记录'
    ];
    
    if (!validTypes.includes(application_type)) {
      return res.status(400).json({
        success: false,
        error: '无效的申请类型'
      });
    }
    
    // 乐捐报备和约客记录无需审批，直接设为有效状态
    let status = 0; // 待处理
    if (application_type === '乐捐报备') {
      status = 1; // 有效
    }
    
    // 创建申请记录
    const result = await transaction.run(`
      INSERT INTO applications (
        applicant_phone,
        application_type,
        remark,
        images,
        status,
        extra_data
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      applicant_phone,
      application_type,
      remark || null,
      images || null,
      status,
      extra_data ? JSON.stringify(extra_data) : null
    ]);
    
    const applicationId = result.lastID;
    
    // 如果是乐捐报备，自动更新水牌状态为"乐捐"
    if (application_type === '乐捐报备') {
      // 获取助教信息
      const coach = await transaction.get(
        'SELECT coach_no, stage_name FROM coaches WHERE employee_id = ? OR phone = ?',
        [applicant_phone, applicant_phone]
      );
      
      if (coach) {
        // 获取当前水牌状态
        const currentWaterBoard = await transaction.get(
          'SELECT * FROM water_boards WHERE coach_no = ?',
          [coach.coach_no]
        );
        
        if (currentWaterBoard) {
          const oldValue = {
            status: currentWaterBoard.status,
            table_no: currentWaterBoard.table_no
          };
          
          // 更新水牌状态为"乐捐"
          await transaction.run(`
            UPDATE water_boards 
            SET status = '乐捐', updated_at = CURRENT_TIMESTAMP 
            WHERE coach_no = ?
          `, [coach.coach_no]);
          
          const newValue = {
            status: '乐捐',
            table_no: currentWaterBoard.table_no
          };
          
          // 记录操作日志
          const user = req.user;
          await operationLogService.create(transaction, {
            operator_phone: user.username,
            operator_name: user.name,
            operation_type: '乐捐报备',
            target_type: 'water_board',
            target_id: currentWaterBoard.id,
            old_value: JSON.stringify(oldValue),
            new_value: JSON.stringify(newValue),
            remark: `乐捐报备自动更新水牌状态：${oldValue.status} → 乐捐`
          });
        }
      }
    }
    
    // 记录操作日志
    const user = req.user;
    await operationLogService.create(transaction, {
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
    
    await transaction.commit();
    
    res.json({
      success: true,
      data: {
        id: applicationId,
        status: status
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('提交申请失败:', error);
    res.status(500).json({
      success: false,
      error: '提交申请失败'
    });
  }
});

/**
 * GET /api/applications
 * 获取申请列表
 */
router.get('/', requireBackendPermission(['all']), async (req, res) => {
  try {
    const {
      application_type,
      status,
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
      sql += ' AND a.status = ?';
      params.push(status);
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
 * GET /api/applications/lejuan
 * 获取乐捐报备一览
 */
router.get('/lejuan', requireBackendPermission(['all']), async (req, res) => {
  try {
    const { days = 10 } = req.query;
    
    const daysNum = parseInt(days, 10);
    const applications = await db.all(`
      SELECT a.*, c.stage_name
      FROM applications a
      LEFT JOIN coaches c ON a.applicant_phone = c.employee_id OR a.applicant_phone = c.phone
      WHERE a.application_type = '乐捐报备'
        AND a.status = 1
        AND date(a.created_at) >= date('now', ?)
      ORDER BY a.created_at DESC
    `, ['-' + daysNum + ' days']);
    
    // 格式化返回数据
    const formattedData = applications.map(a => ({
      id: a.id,
      applicant_phone: a.applicant_phone,
      stage_name: a.stage_name,
      date: a.created_at ? a.created_at.split(' ')[0] : null,
      hours: a.extra_data ? JSON.parse(a.extra_data).hours : null,
      remark: a.remark,
      created_at: a.created_at
    }));
    
    res.json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error('获取乐捐报备一览失败:', error);
    res.status(500).json({
      success: false,
      error: '获取乐捐报备一览失败'
    });
  }
});

/**
 * PUT /api/applications/:id/approve
 * 审批申请
 */
router.put('/:id/approve', requireBackendPermission(['coachManagement']), async (req, res) => {
  const transaction = await db.beginTransaction();
  
  try {
    const { id } = req.params;
    const { approver_phone, status: approveStatus } = req.body;
    
    // 验证审批状态
    if (approveStatus !== 1 && approveStatus !== 2) {
      return res.status(400).json({
        success: false,
        error: '无效的审批状态'
      });
    }
    
    // 获取申请记录
    const application = await transaction.get(
      'SELECT * FROM applications WHERE id = ?',
      [id]
    );
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: '申请记录不存在'
      });
    }
    
    // 只能审批待处理的申请
    if (application.status !== 0) {
      return res.status(400).json({
        success: false,
        error: '该申请已审批过'
      });
    }
    
    // 更新申请状态
    await transaction.run(`
      UPDATE applications
      SET status = ?,
          approver_phone = ?,
          approve_time = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [approveStatus, approver_phone || req.user.username, id]);
    
    // 如果审批通过，更新水牌状态
    if (approveStatus === 1) {
      // 获取助教信息
      const coach = await transaction.get(
        'SELECT coach_no, stage_name, shift FROM coaches WHERE employee_id = ? OR phone = ?',
        [application.applicant_phone, application.applicant_phone]
      );
      
      if (coach) {
        // 获取当前水牌状态
        const currentWaterBoard = await transaction.get(
          'SELECT * FROM water_boards WHERE coach_no = ?',
          [coach.coach_no]
        );
        
        if (currentWaterBoard) {
          // 状态转换校验：检查当前状态是否允许转换
          const currentStatus = currentWaterBoard.status;
          const isOnTable = currentStatus === '早班上桌' || currentStatus === '晚班上桌';
          
          // 如果助教正在上桌服务，不允许审批通过加班/公休申请
          if (isOnTable) {
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              error: `助教${coach.stage_name}正在上桌服务（${currentStatus}），无法审批通过${application.application_type}`
            });
          }
          
          const oldValue = {
            status: currentWaterBoard.status,
            table_no: currentWaterBoard.table_no
          };
          
          let newStatus = currentWaterBoard.status;
          
          // 根据申请类型设置新状态
          if (application.application_type === '早加班申请') {
            newStatus = '早加班';
          } else if (application.application_type === '晚加班申请') {
            newStatus = '晚加班';
          } else if (application.application_type === '公休申请') {
            newStatus = '公休';
          }
          
          // 更新水牌状态
          await transaction.run(`
            UPDATE water_boards 
            SET status = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE coach_no = ?
          `, [newStatus, coach.coach_no]);
          
          const newValue = {
            status: newStatus,
            table_no: currentWaterBoard.table_no
          };
          
          // 记录操作日志
          const user = req.user;
          await operationLogService.create(transaction, {
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
    
    // 记录操作日志
    const user = req.user;
    await operationLogService.create(transaction, {
      operator_phone: approver_phone || user.username,
      operator_name: user.name,
      operation_type: '申请审批',
      target_type: 'application',
      target_id: parseInt(id, 10),
      old_value: JSON.stringify({ status: '待处理' }),
      new_value: JSON.stringify({ status: approveStatus === 1 ? '同意' : '拒绝' }),
      remark: `审批${application.application_type}：${approveStatus === 1 ? '同意' : '拒绝'}`
    });
    
    await transaction.commit();
    
    res.json({
      success: true,
      data: {
        id: parseInt(id, 10),
        status: approveStatus,
        approver_phone: approver_phone || user.username,
        approve_time: new Date().toISOString()
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('审批申请失败:', error);
    res.status(500).json({
      success: false,
      error: '审批申请失败'
    });
  }
});

module.exports = router;
