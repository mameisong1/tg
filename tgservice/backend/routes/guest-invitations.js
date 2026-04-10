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

// 锁定状态标记（内存变量，重启后丢失）
const lockFlags = new Set(); // 'YYYY-MM-DD-早班' / 'YYYY-MM-DD-晚班'

/**
 * GET /api/guest-invitations/check-lock
 * 检查是否已锁定（从内存变量读取）
 */
router.get('/check-lock', auth.required, requireBackendPermission(['invitationReview']), async (req, res) => {
  const { date, shift } = req.query;
  if (!date || !shift) return res.status(400).json({ success: false, error: '缺少参数' });
  const key = `${date}-${shift}`;
  const isLocked = lockFlags.has(key);
  if (isLocked) {
    const { count } = await db.get(
      'SELECT COUNT(*) as count FROM guest_invitation_results WHERE date = ? AND shift = ? AND result IN (?, ?, ?, ?)',
      [date, shift, '应约客', '待审查', '约客有效', '约客无效']
    );
    return res.json({ success: true, data: { is_locked: true, count: count || 0 } });
  }
  res.json({ success: true, data: { is_locked: false, count: 0 } });
});

/**
 * POST /api/guest-invitations/lock-should-invite
 * 锁定应约客人员（开始审查时写入当前空闲助教）
 */
router.post('/lock-should-invite', auth.required, requireBackendPermission(['invitationReview']), async (req, res) => {
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
    
    // 时间校验：早班 16:00 后，晚班 20:00 后才能开始审查
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    
    if (shift === '早班' && currentTime < 16 * 60) {
      return res.status(400).json({
        success: false,
        error: '早班约客审查需在16:00后开始'
      });
    }
    
    if (shift === '晚班' && currentTime < 20 * 60) {
      return res.status(400).json({
        success: false,
        error: '晚班约客审查需在20:00后开始'
      });
    }
    
    // 检查是否已锁定（内存变量）
    const lockKey = `${date}-${shift}`;
    if (lockFlags.has(lockKey)) {
      return res.status(400).json({
        success: false,
        error: '今日已开始审查，无需重复锁定'
      });
    }
    
    // 获取当前水牌空闲状态的助教（早班空闲/晚班空闲）
    const shouldInviteStatus = shift === '早班' ? ['早班空闲'] : ['晚班空闲'];
    const placeholders = shouldInviteStatus.map(() => '?').join(',');
    
    const shouldInviteCoaches = await transaction.all(`
      SELECT wb.coach_no, wb.stage_name
      FROM water_boards wb
      INNER JOIN coaches c ON wb.coach_no = c.coach_no
      WHERE wb.status IN (${placeholders})
        AND c.shift = ?
    `, [...shouldInviteStatus, shift]);
    
    // 写入应约客记录（result='应约客'，无截图）
    // 只插入没有约客记录的助教（避免覆盖已上传截图的记录）
    let insertedCount = 0;
    for (const coach of shouldInviteCoaches) {
      // 检查是否已有任何约客记录（包括：应约客、待审查、约客有效、约客无效）
      // 如果已有记录，说明助教已上传截图或已被标记，不应覆盖
      const existing = await transaction.get(
        'SELECT id, result FROM guest_invitation_results WHERE date = ? AND shift = ? AND coach_no = ?',
        [date, shift, coach.coach_no]
      );
      
      // 只在完全没有记录时才插入（确保不覆盖已上传的约客记录）
      if (!existing) {
        // 新增应约客记录
        await transaction.run(`
          INSERT INTO guest_invitation_results (
            date, shift, coach_no, stage_name, invitation_image_url, result
          ) VALUES (?, ?, ?, ?, NULL, '应约客')
        `, [date, shift, coach.coach_no, coach.stage_name]);
        insertedCount++;
      }
      // 如果已有记录（无论是什么状态），都不覆盖
      // - result='待审查'：助教已上传截图，等待审查
      // - result='约客有效'：已审查通过
      // - result='约客无效'：已审查拒绝
      // - result='应约客'：之前已锁定但未上传截图
    }
    
    // 记录操作日志
    const user = req.user;
    await operationLogService.create(transaction, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '开始约客审查',
      target_type: 'guest_invitation',
      target_id: null,
      old_value: null,
      new_value: JSON.stringify({ date, shift, locked_count: insertedCount }),
      remark: `${shift}${date} 开始审查，锁定${insertedCount}名应约客助教`
    });
    
    // 设置内存锁定标记
    lockFlags.add(lockKey);
    
    // 查询已锁定的人数（result IN ('应约客','待审查','约客有效','约客无效') 的总人数）
    const { count } = await transaction.get(
      'SELECT COUNT(*) as count FROM guest_invitation_results WHERE date = ? AND shift = ? AND result IN (?, ?, ?, ?)',
      [date, shift, '应约客', '待审查', '约客有效', '约客无效']
    );
    
    res.json({
      success: true,
      data: {
        date,
        shift,
        locked_count: insertedCount,
        total_count: count,
        coaches: shouldInviteCoaches
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('锁定应约客人员失败:', error);
    res.status(500).json({
      success: false,
      error: '锁定应约客人员失败'
    });
  }
});

/**
 * GET /api/guest-invitations/should-invite
 * 获取应约客人员列表
 */
router.get('/should-invite', auth.required, requireBackendPermission(['invitationReview']), async (req, res) => {
  try {
    const { date, shift } = req.query;
    
    if (!date || !shift) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段'
      });
    }
    
    // 获取应约客人员（result='应约客'）
    const shouldInviteList = await db.all(
      'SELECT * FROM guest_invitation_results WHERE date = ? AND shift = ? AND result = ?',
      [date, shift, '应约客']
    );
    
    res.json({
      success: true,
      data: shouldInviteList
    });
  } catch (error) {
    console.error('获取应约客人员列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取应约客人员列表失败'
    });
  }
});

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
    
    // 时间校验：早班 14:00-18:00，晚班 18:00-22:00（前后2小时）
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    
    if (shift === '早班') {
      if (currentTime < 14 * 60 || currentTime > 18 * 60) {
        return res.status(400).json({
          success: false,
          error: '早班约客记录提交时间为14:00-18:00'
        });
      }
    }
    
    if (shift === '晚班') {
      if (currentTime < 18 * 60 || currentTime > 22 * 60) {
        return res.status(400).json({
          success: false,
          error: '晚班约客记录提交时间为18:00-22:00'
        });
      }
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
    
    // 时间校验：审查当日数据时，早班16:00前、晚班20:00前报错
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    
    if (invitation.date === today) {
      if (invitation.shift === '早班' && currentTime < 16 * 60) {
        return res.status(400).json({
          success: false,
          error: '早班约客审查需在16:00后开始'
        });
      }
      
      if (invitation.shift === '晚班' && currentTime < 20 * 60) {
        return res.status(400).json({
          success: false,
          error: '晚班约客审查需在20:00后开始'
        });
      }
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
    
    // 统计规则（最终版）：
    // 应约客人数 = result IN ('应约客', '待审查', '约客有效', '约客无效')
    // 已约客人数 = result IN ('待审查', '约客有效', '约客无效')
    // 未约客助教 = result='应约客' AND 无截图
    
    // 获取所有约客记录（含详细信息）
    const allInvitationsWithDetails = await transaction.all(`
      SELECT coach_no, stage_name, result, invitation_image_url
      FROM guest_invitation_results
      WHERE date = ? AND shift = ?
    `, [date, shift]);
    
    // 应约客人数：所有参与约客流程的助教
    const shouldInviteCount = allInvitationsWithDetails.filter(inv => 
      ['应约客', '待审查', '约客有效', '约客无效'].includes(inv.result)
    ).length;
    
    // 已约客人数：提交了截图的（有截图就算已约客）
    const invitedCount = allInvitationsWithDetails.filter(inv => 
      ['待审查', '约客有效', '约客无效'].includes(inv.result)
    ).length;
    
    // 未约客助教：result='应约客' 且无截图
    const missingList = allInvitationsWithDetails.filter(inv => 
      inv.result === '应约客' && !inv.invitation_image_url
    ).map(inv => ({
      coach_no: inv.coach_no,
      stage_name: inv.stage_name
    }));
    
    // 无效约客列表：result='约客无效'
    const invalidList = allInvitationsWithDetails.filter(inv => 
      inv.result === '约客无效'
    ).map(inv => ({
      coach_no: inv.coach_no,
      stage_name: inv.stage_name
    }));
    
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
    
    // 统计规则（最终版）：
    // 应约客人数 = result IN ('应约客', '待审查', '约客有效', '约客无效')
    // 已约客人数 = result IN ('待审查', '约客有效', '约客无效')
    // 未约客助教 = result='应约客' AND 无截图
    
    // 获取所有约客记录
    const allInvitations = await db.all(`
      SELECT coach_no, stage_name, result, invitation_image_url
      FROM guest_invitation_results
      WHERE date = ? AND shift = ?
    `, [date, shift]);
    
    // 应约客人数：所有参与约客流程的助教
    const shouldInviteCount = allInvitations.filter(inv => 
      ['应约客', '待审查', '约客有效', '约客无效'].includes(inv.result)
    ).length;
    
    // 已约客人数：提交了截图的（有截图就算已约客）
    const invitedCount = allInvitations.filter(inv => 
      ['待审查', '约客有效', '约客无效'].includes(inv.result)
    ).length;
    
    // 未约客助教：result='应约客' 且无截图
    const missingList = allInvitations.filter(inv => 
      inv.result === '应约客' && !inv.invitation_image_url
    ).map(inv => ({
      coach_no: inv.coach_no,
      stage_name: inv.stage_name
    }));
    
    // 无效约客列表：result='约客无效'
    const invalidList = allInvitations.filter(inv => 
      inv.result === '约客无效'
    ).map(inv => ({
      coach_no: inv.coach_no,
      stage_name: inv.stage_name
    }));
    
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
