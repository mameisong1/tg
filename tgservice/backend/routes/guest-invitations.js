/**
 * 约客管理 API
 * 路径：/api/guest-invitations
 * 功能：约客记录提交、审查、统计
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const operationLogService = require('../services/operation-log');

/**
 * POST /api/guest-invitations
 * 提交约客记录
 */
router.post('/', auth.required, requireBackendPermission(['all']), async (req, res) => {
  const transaction = await db.beginTransaction();
  
  try {
    const {
      coach_no,
      date,
      shift,
      invitation_image_url
    } = req.body;
    
    // 验证必填字段
    if (!coach_no || !date || !shift) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段'
      });
    }
    
    // 验证班次
    if (shift !== '早班' && shift !== '晚班') {
      return res.status(400).json({
        success: false,
        error: '无效的班次'
      });
    }
    
    // 时间校验：早班 16:00 前，晚班 20:00 前
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    
    if (shift === '早班' && currentTime > 16 * 60) {
      return res.status(400).json({
        success: false,
        error: '早班约客记录已超过提交截止时间（16:00）'
      });
    }
    
    if (shift === '晚班' && currentTime > 20 * 60) {
      return res.status(400).json({
        success: false,
        error: '晚班约客记录已超过提交截止时间（20:00）'
      });
    }
    
    // 获取助教信息
    const coach = await db.get(
      'SELECT coach_no, stage_name FROM coaches WHERE coach_no = ?',
      [coach_no]
    );
    
    if (!coach) {
      return res.status(404).json({
        success: false,
        error: '助教不存在'
      });
    }
    
    // 检查是否已存在记录（每天每班每个助教只有一条）
    const existing = await db.get(
      'SELECT * FROM guest_invitation_results WHERE date = ? AND shift = ? AND coach_no = ?',
      [date, shift, coach_no]
    );
    
    let result;
    
    if (existing) {
      // 更新现有记录（允许重新上传覆盖）
      result = await transaction.run(`
        UPDATE guest_invitation_results
        SET invitation_image_url = ?,
            result = '待审查',
            reviewed_at = NULL,
            reviewer_phone = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE date = ? AND shift = ? AND coach_no = ?
      `, [invitation_image_url, date, shift, coach_no]);
    } else {
      // 创建新记录
      result = await transaction.run(`
        INSERT INTO guest_invitation_results (
          date,
          shift,
          coach_no,
          stage_name,
          invitation_image_url,
          result
        ) VALUES (?, ?, ?, ?, ?, '待审查')
      `, [date, shift, coach_no, coach.stage_name, invitation_image_url]);
    }
    
    // 记录操作日志
    const user = req.user;
    await operationLogService.create(transaction, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '提交约客记录',
      target_type: 'guest_invitation',
      target_id: existing ? existing.id : result.lastID,
      old_value: existing ? JSON.stringify({ result: existing.result }) : null,
      new_value: JSON.stringify({ result: '待审查' }),
      remark: `${shift}${date} 约客记录${existing ? '重新上传' : '提交'}`
    });
    
    await transaction.commit();
    
    res.json({
      success: true,
      data: {
        id: existing ? existing.id : result.lastID,
        result: '待审查'
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('提交约客记录失败:', error);
    res.status(500).json({
      success: false,
      error: '提交约客记录失败'
    });
  }
});

/**
 * GET /api/guest-invitations
 * 获取约客记录列表
 */
router.get('/', auth.required, requireBackendPermission(['invitationReview']), async (req, res) => {
  try {
    const {
      date,
      shift,
      coach_no,
      result
    } = req.query;
    
    let sql = `
      SELECT gir.*, c.employee_id
      FROM guest_invitation_results gir
      LEFT JOIN coaches c ON gir.coach_no = c.coach_no
      WHERE 1=1
    `;
    const params = [];
    
    if (date) {
      sql += ' AND date = ?';
      params.push(date);
    }
    
    if (shift) {
      sql += ' AND gir.shift = ?';
      params.push(shift);
    }
    
    if (coach_no) {
      sql += ' AND coach_no = ?';
      params.push(coach_no);
    }
    
    if (result) {
      sql += ' AND result = ?';
      params.push(result);
    }
    
    sql += ' ORDER BY coach_no, created_at';
    
    const invitations = await db.all(sql, params);
    
    // 将 coach_no 替换为 employee_id 用于前端显示
    const formattedData = invitations.map(inv => ({
      ...inv,
      coach_no: inv.employee_id || inv.coach_no // 优先显示工号，无工号则显示编号
    }));
    
    res.json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error('获取约客记录列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取约客记录列表失败'
    });
  }
});

/**
 * PUT /api/guest-invitations/:id/review
 * 审查约客记录
 */
router.put('/:id/review', auth.required, requireBackendPermission(['invitationReview']), async (req, res) => {
  const transaction = await db.beginTransaction();
  
  try {
    const { id } = req.params;
    const { result, reviewer_phone } = req.body;
    
    // 验证审查结果
    if (result !== '约客有效' && result !== '约客无效') {
      return res.status(400).json({
        success: false,
        error: '无效的审查结果'
      });
    }
    
    // 获取约客记录
    const invitation = await transaction.get(
      'SELECT * FROM guest_invitation_results WHERE id = ?',
      [id]
    );
    
    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: '约客记录不存在'
      });
    }
    
    // 更新审查结果
    await transaction.run(`
      UPDATE guest_invitation_results
      SET result = ?,
          reviewed_at = CURRENT_TIMESTAMP,
          reviewer_phone = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [result, reviewer_phone || req.user.username, id]);
    
    // 记录操作日志
    const user = req.user;
    await operationLogService.create(transaction, {
      operator_phone: reviewer_phone || user.username,
      operator_name: user.name,
      operation_type: '约客审查',
      target_type: 'guest_invitation',
      target_id: parseInt(id, 10),
      old_value: JSON.stringify({ result: invitation.result }),
      new_value: JSON.stringify({ result }),
      remark: `审查${invitation.shift}${invitation.date}${invitation.stage_name}约客：${invitation.result} → ${result}`
    });
    
    await transaction.commit();
    
    res.json({
      success: true,
      data: {
        id: parseInt(id, 10),
        result,
        reviewed_at: new Date().toISOString(),
        reviewer_phone: reviewer_phone || user.username
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('审查约客记录失败:', error);
    res.status(500).json({
      success: false,
      error: '审查约客记录失败'
    });
  }
});

/**
 * POST /api/guest-invitations/statistics
 * 生成约客统计
 */
router.post('/statistics', auth.required, requireBackendPermission(['invitationStats']), async (req, res) => {
  const transaction = await db.beginTransaction();
  
  try {
    const { date, shift } = req.body;
    
    // 验证必填字段
    if (!date || !shift) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段'
      });
    }
    
    // 验证班次
    if (shift !== '早班' && shift !== '晚班') {
      return res.status(400).json({
        success: false,
        error: '无效的班次'
      });
    }
    
    // 时间校验：早班 16:00 后，晚班 20:00 后
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    
    if (shift === '早班' && currentTime < 16 * 60) {
      return res.status(400).json({
        success: false,
        error: '早班约客统计需在 16:00 后生成'
      });
    }
    
    if (shift === '晚班' && currentTime < 20 * 60) {
      return res.status(400).json({
        success: false,
        error: '晚班约客统计需在 20:00 后生成'
      });
    }
    
    // 校验所有记录是否审查完毕
    // 检查所有已提交的约客记录是否都已审查
    const allInvitations = await transaction.all(`
      SELECT result FROM guest_invitation_results
      WHERE date = ? AND shift = ?
    `, [date, shift]);
    
    const hasUnreviewed = allInvitations.some(inv => inv.result === '待审查');
    if (hasUnreviewed) {
      return res.status(400).json({
        success: false,
        error: '尚有约客记录未审查完毕，无法生成统计'
      });
    }
    
    // 【第 3 轮修订】应约客状态定义：只算空闲，不算上桌
    const shouldInviteStatus = shift === '早班'
      ? ['早班空闲']
      : ['晚班空闲'];
    
    // 获取应约客助教列表（首次生成时取当前水牌状态）
    const placeholders2 = shouldInviteStatus.map(() => '?').join(',');
    const shouldInviteCoaches = await transaction.all(`
      SELECT wb.coach_no, wb.stage_name, wb.status
      FROM water_boards wb
      INNER JOIN coaches c ON wb.coach_no = c.coach_no
      WHERE wb.status IN (${placeholders2})
        AND c.shift = ?
    `, [...shouldInviteStatus, shift]);
    
    const shouldInviteCount = shouldInviteCoaches.length;
    
    // 获取已提交约客记录的助教
    const invitedCoaches = await transaction.all(`
      SELECT coach_no, result
      FROM guest_invitation_results
      WHERE date = ? AND shift = ?
    `, [date, shift]);
    
    const invitedCount = invitedCoaches.length;
    
    // 构建教练映射
    const shouldInviteMap = {};
    shouldInviteCoaches.forEach(c => {
      shouldInviteMap[c.coach_no] = c;
    });
    
    const invitedMap = {};
    invitedCoaches.forEach(c => {
      invitedMap[c.coach_no] = c.result;
    });
    
    // 无效约客列表：已提交但审查结果为"约客无效"
    const invalidList = [];
    invitedCoaches.forEach(c => {
      if (c.result === '约客无效') {
        invalidList.push({
          coach_no: c.coach_no,
          stage_name: shouldInviteMap[c.coach_no]?.stage_name || '未知'
        });
      }
    });
    
    // 未约客助教一览：应约客但未提交记录
    const missingList = [];
    shouldInviteCoaches.forEach(c => {
      if (!invitedMap[c.coach_no]) {
        missingList.push({
          coach_no: c.coach_no,
          stage_name: c.stage_name
        });
      }
    });
    
    // 记录操作日志
    const user = req.user;
    await operationLogService.create(transaction, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '生成约客统计',
      target_type: 'guest_invitation_stats',
      target_id: null,
      old_value: null,
      new_value: JSON.stringify({
        date,
        shift,
        shouldInviteCount,
        invitedCount
      }),
      remark: `生成${shift}${date}约客统计：应约客${shouldInviteCount}人，已约客${invitedCount}人`
    });
    
    await transaction.commit();
    
    res.json({
      success: true,
      data: {
        date,
        shift,
        should_invite_count: shouldInviteCount,
        invited_count: invitedCount,
        invalid_list: invalidList,
        missing_list: missingList,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('生成约客统计失败:', error);
    res.status(500).json({
      success: false,
      error: '生成约客统计失败'
    });
  }
});

/**
 * GET /api/guest-invitations/statistics/:date/:shift
 * 获取约客统计结果
 */
router.get('/statistics/:date/:shift', auth.required, requireBackendPermission(['invitationStats']), async (req, res) => {
  try {
    const { date, shift } = req.params;
    
    // 验证班次
    if (shift !== '早班' && shift !== '晚班') {
      return res.status(400).json({
        success: false,
        error: '无效的班次'
      });
    }
    
    // 【第 3 轮修订】应约客状态定义：只算空闲，不算上桌
    const shouldInviteStatus = shift === '早班'
      ? ['早班空闲']
      : ['晚班空闲'];
    
    // 获取应约客助教列表
    const placeholders = shouldInviteStatus.map(() => '?').join(',');
    const shouldInviteCoaches = await db.all(`
      SELECT wb.coach_no, wb.stage_name, wb.status
      FROM water_boards wb
      INNER JOIN coaches c ON wb.coach_no = c.coach_no
      WHERE wb.status IN (${placeholders})
        AND c.shift = ?
    `, [...shouldInviteStatus, shift]);
    
    const shouldInviteCount = shouldInviteCoaches.length;
    
    // 获取已提交约客记录的助教
    const invitedCoaches = await db.all(`
      SELECT coach_no, result
      FROM guest_invitation_results
      WHERE date = ? AND shift = ?
    `, [date, shift]);
    
    const invitedCount = invitedCoaches.length;
    
    // 构建教练映射
    const shouldInviteMap = {};
    shouldInviteCoaches.forEach(c => {
      shouldInviteMap[c.coach_no] = c;
    });
    
    const invitedMap = {};
    invitedCoaches.forEach(c => {
      invitedMap[c.coach_no] = c.result;
    });
    
    // 无效约客列表
    const invalidList = [];
    invitedCoaches.forEach(c => {
      if (c.result === '约客无效') {
        invalidList.push({
          coach_no: c.coach_no,
          stage_name: shouldInviteMap[c.coach_no]?.stage_name || '未知'
        });
      }
    });
    
    // 未约客助教一览
    const missingList = [];
    shouldInviteCoaches.forEach(c => {
      if (!invitedMap[c.coach_no]) {
        missingList.push({
          coach_no: c.coach_no,
          stage_name: c.stage_name
        });
      }
    });
    
    res.json({
      success: true,
      data: {
        date,
        shift,
        should_invite_count: shouldInviteCount,
        invited_count: invitedCount,
        invalid_list: invalidList,
        missing_list: missingList
      }
    });
  } catch (error) {
    console.error('获取约客统计结果失败:', error);
    res.status(500).json({
      success: false,
      error: '获取约客统计结果失败'
    });
  }
});

module.exports = router;
