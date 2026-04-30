/**
 * 约客管理 API
 * 路径:/api/guest-invitations
 * 功能:约客记录提交、审查、统计
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { runInTransaction } = require('../db');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const operationLogService = require('../services/operation-log');
const TimeUtil = require('../utils/time');
const errorLogger = require('../utils/error-logger');

// 引入 Cron 调度器（用于手动触发锁定）
const cronScheduler = require('../services/cron-scheduler');

/**
 * 执行锁定应约客人员的核心逻辑（统一入口）
 * @param {string} date - 日期 YYYY-MM-DD
 * @param {string} shift - 班次:'早班' 或 '晚班'
 * @param {object} operatorInfo - 操作人信息 { username, name } 或 { system: true }
 * @param {boolean} skipTimeCheck - 是否跳过时间校验(内部 Cron 调用跳过)
 * @returns {object} - { date, shift, locked_count, total_count, coaches }
 */
async function executeLockShouldInvite(date, shift, operatorInfo, skipTimeCheck = false) {
  if (!date || !shift) {
    throw { status: 400, error: '缺少必填字段' };
  }

  if (shift !== '早班' && shift !== '晚班') {
    throw { status: 400, error: '无效的班次' };
  }

  // 时间校验（手动调用时检查，内部 Cron 调用跳过）
  if (!skipTimeCheck) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    if (shift === '早班' && currentTime < 15 * 60) {
      throw { status: 400, error: '早班约客审查需在15:00后开始' };
    }

    if (shift === '晚班' && currentTime < 19 * 60) {
      throw { status: 400, error: '晚班约客审查需在19:00后开始' };
    }
  }

  // 检查 cron_tasks 表，判断当日是否已锁定（防止重复锁定）
  const taskName = shift === '早班' ? 'lock_guest_invitation_morning' : 'lock_guest_invitation_evening';
  // 同一班次每天允许执行多次（15+16 / 19+20），核心逻辑幂等（已有记录不重复插入）
  // 不再阻止重复执行

  return await runInTransaction(async (tx) => {
    const shouldInviteStatus = shift === '早班' ? ['早班空闲'] : ['晚班空闲'];
    const placeholders = shouldInviteStatus.map(() => '?').join(',');

    const shouldInviteCoaches = await tx.all(`
      SELECT wb.coach_no, wb.stage_name
      FROM water_boards wb
      INNER JOIN coaches c ON wb.coach_no = c.coach_no
      WHERE wb.status IN (${placeholders})
        AND c.shift = ?
    `, [...shouldInviteStatus, shift]);

    let insertedCount = 0;
    for (const coach of shouldInviteCoaches) {
      const existing = await tx.get(
        'SELECT id, result FROM guest_invitation_results WHERE date = ? AND shift = ? AND coach_no = ?',
        [date, shift, coach.coach_no]
      );

      if (!existing) {
        await tx.run(`
          INSERT INTO guest_invitation_results (
            date, shift, coach_no, stage_name, invitation_image_url, result, created_at, updated_at
          ) VALUES (?, ?, ?, ?, NULL, '应约客', ?, ?)
        `, [date, shift, coach.coach_no, coach.stage_name, TimeUtil.nowDB(), TimeUtil.nowDB()]);
        insertedCount++;
      }
    }

    // 记录操作日志
    const operatorPhone = operatorInfo.system ? 'cron_system' : operatorInfo.username;
    const operatorName = operatorInfo.system ? '系统自动' : operatorInfo.name;
    await operationLogService.create(tx, {
      operator_phone: operatorPhone,
      operator_name: operatorName,
      operation_type: '开始约客审查',
      target_type: 'guest_invitation',
      target_id: null,
      old_value: null,
      new_value: JSON.stringify({ date, shift, locked_count: insertedCount }),
      remark: `${shift}${date} ${operatorInfo.system ? '系统自动锁定' : '手动锁定'},锁定${insertedCount}名应约客助教`
    });

    const { count } = await tx.get(
      'SELECT COUNT(*) as count FROM guest_invitation_results WHERE date = ? AND shift = ? AND result IN (?, ?, ?, ?)',
      [date, shift, '应约客', '待审查', '约客有效', '约客无效']
    );

    return { date, shift, locked_count: insertedCount, total_count: count, coaches: shouldInviteCoaches, taskName };
  });
}

/**
 * GET /api/guest-invitations/check-lock
 * 检查是否已锁定（查询 cron_tasks 表，基于批处理结果）
 */
router.get('/check-lock', auth.required, requireBackendPermission(['invitationReview']), async (req, res) => {
  const { date, shift } = req.query;
  if (!date || !shift) return res.status(400).json({ success: false, error: '缺少参数' });

  const taskName = shift === '早班' ? 'lock_guest_invitation_morning' : 'lock_guest_invitation_evening';
  const task = await db.get('SELECT last_run, last_status FROM cron_tasks WHERE task_name = ?', [taskName]);

  // 判断是否已锁定：last_status = 'success' 且 last_run 是当日
  const isLocked = task && task.last_status === 'success' && task.last_run && task.last_run.startsWith(date);

  if (isLocked) {
    const { count } = await db.get(
      'SELECT COUNT(*) as count FROM guest_invitation_results WHERE date = ? AND shift = ? AND result IN (?, ?, ?, ?)',
      [date, shift, '应约客', '待审查', '约客有效', '约客无效']
    );
    return res.json({ success: true, data: { is_locked: true, count: count || 0, source: 'cron' } });
  }
  res.json({ success: true, data: { is_locked: false, count: 0, source: 'cron' } });
});

/**
 * POST /api/guest-invitations/lock-should-invite
 * 锁定应约客人员（手动触发 Cron 批处理）
 * 需要登录和权限校验
 */
router.post('/lock-should-invite', auth.required, requireBackendPermission(['invitationReview']), async (req, res) => {
  // 手动锁定已永久禁用，统一由 Cron 批处理自动执行
  return res.status(403).json({ success: false, error: '手动锁定已禁用，约客锁定由系统批处理自动执行（15:00/16:00 早班，19:00/20:00 晚班）' });
});

/**
 * POST /api/internal/guest-invitations/lock
 * 内部接口:锁定应约客人员(Cron 自动调用)
 * 无需权限校验,跳过时间检查
 */
router.post('/internal/lock', async (req, res) => {
  try {
    const { date, shift } = req.body;

    // 简单的内部调用校验(检查请求来源)
    const clientIp = req.ip || req.connection.remoteAddress;
    if (!clientIp.includes('127.0.0.1') && !clientIp.includes('::1')) {
      console.warn(`[Internal API] 拒绝非内部调用: ${clientIp}`);
      return res.status(403).json({ success: false, error: '仅允许内部调用' });
    }

    const result = await executeLockShouldInvite(date, shift, { system: true }, true);

    // 内部锁定成功后，更新 cron_tasks 表（保持状态一致性）
    // 注意：cronScheduler.taskLockGuestInvitation 会自己更新 cron_tasks，
    // 但直接调用 /internal/lock 时需要更新
    const finishedAt = TimeUtil.nowDB();
    const nextRun = cronScheduler.calcNextRun(shift === '早班' ? '0 15,16 * * *' : '0 19,20 * * *');
    await db.enqueueRun(
      'UPDATE cron_tasks SET last_status = ?, last_run = ?, next_run = ?, last_error = NULL WHERE task_name = ?',
      ['success', finishedAt, nextRun, result.taskName]
    );

    res.json({
      success: true,
      data: {
        date: result.date,
        shift: result.shift,
        locked_count: result.locked_count,
        total_count: result.total_count,
        coaches: result.coaches
      }
    });
  } catch (error) {
    console.error('[Internal API] 自动锁定应约客人员失败:', error);
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
    res.status(500).json({ success: false, error: '自动锁定失败' });
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

    // 获取应约客人员(result='应约客')
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
  try {
    const result = await runInTransaction(async (tx) => {
    const {
      coach_no,
      date,
      shift,
      invitation_image_url,
      images
    } = req.body;

    if (!coach_no || !date || !shift) {
      throw { status: 400, error: '缺少必填字段' };
    }

    if (shift !== '早班' && shift !== '晚班') {
      throw { status: 400, error: '无效的班次' };
    }

    const isTestEnv = process.env.TGSERVICE_ENV === 'test';
    if (!isTestEnv) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = currentHour * 60 + currentMinute;

      if (shift === '早班') {
        if (currentTime < 14 * 60 || currentTime > 18 * 60) {
          throw { status: 400, error: '早班约客记录提交时间为14:00-18:00' };
        }
      }

      if (shift === '晚班') {
        if (currentTime < 18 * 60 || currentTime > 22 * 60) {
          throw { status: 400, error: '晚班约客记录提交时间为18:00-22:00' };
        }
      }
    }

    const coach = await db.get(
      'SELECT coach_no, stage_name FROM coaches WHERE coach_no = ?',
      [coach_no]
    );

    if (!coach) {
      throw { status: 404, error: '助教不存在' };
    }

    const existing = await db.get(
      'SELECT * FROM guest_invitation_results WHERE date = ? AND shift = ? AND coach_no = ?',
      [date, shift, coach_no]
    );

    let txResult;

    if (existing) {
      const nowDB = TimeUtil.nowDB();
      txResult = await tx.run(`
        UPDATE guest_invitation_results
        SET images = ?,
            result = '待审查',
            reviewed_at = NULL,
            reviewer_phone = NULL,
            updated_at = ?
        WHERE date = ? AND shift = ? AND coach_no = ?
      `, [images || null, nowDB, date, shift, coach_no]);
    } else {
      txResult = await tx.run(`
        INSERT INTO guest_invitation_results (
          date,
          shift,
          coach_no,
          stage_name,
          images,
          result,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, '待审查', ?, ?)
      `, [date, shift, coach_no, coach.stage_name, images || null, TimeUtil.nowDB(), TimeUtil.nowDB()]);
    }

    const user = req.user;
    await operationLogService.create(tx, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '提交约客记录',
      target_type: 'guest_invitation',
      target_id: existing ? existing.id : txResult.lastID,
      old_value: existing ? JSON.stringify({ result: existing.result }) : null,
      new_value: JSON.stringify({ result: '待审查' }),
      remark: `${shift}${date} 约客记录${existing ? '重新上传' : '提交'}`
    });

    return { id: existing ? existing.id : txResult.lastID, result: '待审查' };
    });

    res.json({
      success: true,
      data: {
        id: result.id,
        result: result.result
      }
    });
  } catch (error) {
    errorLogger.logApiRejection(req, error);
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
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
      result,
      limit = 100
    } = req.query;

    let sql = `
      SELECT gir.*, c.employee_id
      FROM guest_invitation_results gir
      LEFT JOIN coaches c ON gir.coach_no = c.coach_no
      WHERE 1=1
    `;
    const params = [];

    // 强制3天日期过滤：无 date 参数时默认近3天
    if (date) {
      sql += ' AND date = ?';
      params.push(date);
    } else {
      const threeDaysAgo = TimeUtil.offsetDB(-72).split(' ')[0];
      sql += ' AND date >= ?';
      params.push(threeDaysAgo);
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

    sql += ' ORDER BY coach_no, created_at LIMIT ?';
    params.push(parseInt(limit));

    const invitations = await db.all(sql, params);

    // 将 coach_no 替换为 employee_id 用于前端显示
    const formattedData = invitations.map(inv => ({
      ...inv,
      coach_no: inv.employee_id || inv.coach_no // 优先显示工号,无工号则显示编号
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
  try {
    const result = await runInTransaction(async (tx) => {
    const { id } = req.params;
    const { result, reviewer_phone } = req.body;

    if (result !== '约客有效' && result !== '约客无效') {
      throw { status: 400, error: '无效的审查结果' };
    }

    const invitation = await tx.get(
      'SELECT * FROM guest_invitation_results WHERE id = ?',
      [id]
    );

    if (!invitation) {
      throw { status: 404, error: '约客记录不存在' };
    }

    const now = new Date();
    const today = TimeUtil.todayStr();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    if (invitation.date === today) {
      if (invitation.shift === '早班' && currentTime < 16 * 60) {
        throw { status: 400, error: '早班约客审查需在16:00后开始' };
      }

      if (invitation.shift === '晚班' && currentTime < 20 * 60) {
        throw { status: 400, error: '晚班约客审查需在20:00后开始' };
      }
    }

    const nowDB = TimeUtil.nowDB();
    await tx.run(`
      UPDATE guest_invitation_results
      SET result = ?,
          reviewed_at = ?,
          reviewer_phone = ?,
          updated_at = ?
      WHERE id = ?
    `, [result, nowDB, reviewer_phone || req.user.username, nowDB, id]);

    const user = req.user;
    await operationLogService.create(tx, {
      operator_phone: reviewer_phone || user.username,
      operator_name: user.name,
      operation_type: '约客审查',
      target_type: 'guest_invitation',
      target_id: parseInt(id, 10),
      old_value: JSON.stringify({ result: invitation.result }),
      new_value: JSON.stringify({ result }),
      remark: `审查${invitation.shift}${invitation.date}${invitation.stage_name}约客:${invitation.result} → ${result}`
    });

    return {
      id: parseInt(id, 10),
      result,
      reviewed_at: TimeUtil.nowDB(),
      reviewer_phone: reviewer_phone || user.username
    };
    });

    res.json({
      success: true,
      data: {
        id: result.id,
        result: result.result,
        reviewed_at: result.reviewed_at,
        reviewer_phone: result.reviewer_phone
      }
    });
  } catch (error) {
    errorLogger.logApiRejection(req, error);
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
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
  try {
    const result = await runInTransaction(async (tx) => {
    const { date, shift } = req.body;

    if (!date || !shift) {
      throw { status: 400, error: '缺少必填字段' };
    }

    if (shift !== '早班' && shift !== '晚班') {
      throw { status: 400, error: '无效的班次' };
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    if (shift === '早班' && currentTime < 16 * 60) {
      throw { status: 400, error: '早班约客统计需在 16:00 后生成' };
    }

    if (shift === '晚班' && currentTime < 20 * 60) {
      throw { status: 400, error: '晚班约客统计需在 20:00 后生成' };
    }

    const allInvitations = await tx.all(`
      SELECT result FROM guest_invitation_results
      WHERE date = ? AND shift = ?
    `, [date, shift]);

    const hasUnreviewed = allInvitations.some(inv => inv.result === '待审查');
    if (hasUnreviewed) {
      throw { status: 400, error: '尚有约客记录未审查完毕,无法生成统计' };
    }

    const allInvitationsWithDetails = await tx.all(`
      SELECT coach_no, stage_name, result, invitation_image_url
      FROM guest_invitation_results
      WHERE date = ? AND shift = ?
    `, [date, shift]);

    const shouldInviteCount = allInvitationsWithDetails.filter(inv =>
      ['应约客', '待审查', '约客有效', '约客无效'].includes(inv.result)
    ).length;

    const invitedCount = allInvitationsWithDetails.filter(inv =>
      ['待审查', '约客有效', '约客无效'].includes(inv.result)
    ).length;

    const missingList = allInvitationsWithDetails.filter(inv =>
      inv.result === '应约客' && !inv.invitation_image_url
    ).map(inv => ({
      coach_no: inv.coach_no,
      stage_name: inv.stage_name
    }));

    const invalidList = allInvitationsWithDetails.filter(inv =>
      inv.result === '约客无效'
    ).map(inv => ({
      coach_no: inv.coach_no,
      stage_name: inv.stage_name
    }));

    const user = req.user;
    await operationLogService.create(tx, {
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
      remark: `生成${shift}${date}约客统计:应约客${shouldInviteCount}人,已约客${invitedCount}人`
    });

    return {
      date,
      shift,
      should_invite_count: shouldInviteCount,
      invited_count: invitedCount,
      invalid_list: invalidList,
      missing_list: missingList,
      generated_at: TimeUtil.nowDB()
    };
    });

    res.json({
      success: true,
      data: {
        date: result.date,
        shift: result.shift,
        should_invite_count: result.should_invite_count,
        invited_count: result.invited_count,
        invalid_list: result.invalid_list,
        missing_list: result.missing_list,
        generated_at: result.generated_at
      }
    });
  } catch (error) {
    errorLogger.logApiRejection(req, error);
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
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

    // 统计规则(最终版):
    // 应约客人数 = result IN ('应约客', '待审查', '约客有效', '约客无效')
    // 已约客人数 = result IN ('待审查', '约客有效', '约客无效')
    // 未约客助教 = result='应约客' AND 无截图

    // 获取所有约客记录
    const allInvitations = await db.all(`
      SELECT coach_no, stage_name, result, invitation_image_url
      FROM guest_invitation_results
      WHERE date = ? AND shift = ?
    `, [date, shift]);

    // 应约客人数:所有参与约客流程的助教
    const shouldInviteCount = allInvitations.filter(inv =>
      ['应约客', '待审查', '约客有效', '约客无效'].includes(inv.result)
    ).length;

    // 已约客人数:提交了截图的(有截图就算已约客)
    const invitedCount = allInvitations.filter(inv =>
      ['待审查', '约客有效', '约客无效'].includes(inv.result)
    ).length;

    // 未约客助教:result='应约客' 且无截图
    const missingList = allInvitations.filter(inv =>
      inv.result === '应约客' && !inv.invitation_image_url
    ).map(inv => ({
      coach_no: inv.coach_no,
      stage_name: inv.stage_name
    }));

    // 无效约客列表:result='约客无效'
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

/**
 * GET /api/guest-invitations/period-stats
 * 按时间周期统计约客情况(新规约客统计页面)
 * 参数: period = yesterday | day-before-yesterday | this-month | last-month
 */
router.get('/period-stats', auth.required, requireBackendPermission(['invitationStats']), async (req, res) => {
  try {
    const { period } = req.query;
    if (!period) {
      return res.status(400).json({ success: false, error: '缺少 period 参数' });
    }

    const validPeriods = ['yesterday', 'day-before-yesterday', 'this-month', 'last-month'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ success: false, error: '无效的 period 参数' });
    }

    // 计算日期范围
    const { dateStart, dateEnd, periodLabel } = getDateRange(period);

    // 1. 统计各状态人数
    const stats = await db.all(`
      SELECT
        SUM(CASE WHEN result = '应约客' THEN 1 ELSE 0 END) as not_invited,
        SUM(CASE WHEN result = '约客有效' THEN 1 ELSE 0 END) as valid,
        SUM(CASE WHEN result = '约客无效' THEN 1 ELSE 0 END) as invalid,
        SUM(CASE WHEN result = '待审查' THEN 1 ELSE 0 END) as pending
      FROM guest_invitation_results
      WHERE date >= ? AND date <= ?
    `, [dateStart, dateEnd]);

    const notInvited = stats[0]?.not_invited || 0;
    const valid = stats[0]?.valid || 0;
    const invalid = stats[0]?.invalid || 0;
    const pending = stats[0]?.pending || 0;
    const totalShould = notInvited + invalid + valid;
    const inviteRate = totalShould > 0 ? ((valid / totalShould) * 100).toFixed(1) + '%' : '0.0%';

    // 2. 漏约助教一览(按助教聚合,按漏约次数倒序)
    const missedCoaches = await db.all(`
      SELECT
        gir.coach_no,
        c.employee_id,
        gir.stage_name,
        c.photos,
        COUNT(*) as missed_count
      FROM guest_invitation_results gir
      INNER JOIN coaches c ON gir.coach_no = c.coach_no
      WHERE gir.date >= ? AND gir.date <= ?
        AND gir.result IN ('应约客', '约客无效')
      GROUP BY gir.coach_no
      ORDER BY missed_count DESC, gir.coach_no ASC
    `, [dateStart, dateEnd]);

    // 处理头像 URL
    const formattedCoaches = missedCoaches.map(c => {
      let photoUrl = '/static/avatar-default.png';
      try {
        const photos = typeof c.photos === 'string' ? JSON.parse(c.photos) : c.photos;
        if (photos && photos.length > 0) {
          photoUrl = photos[0].startsWith('http') ? photos[0] : 'http://47.238.80.12:8081' + photos[0];
        }
      } catch (e) {}
      return {
        coach_no: c.coach_no,
        employee_id: c.employee_id || `#${c.coach_no}`,
        stage_name: c.stage_name,
        photo_url: photoUrl,
        missed_count: c.missed_count
      };
    });

    const dateRange = dateStart === dateEnd ? dateStart : `${dateStart} ~ ${dateEnd}`;

    res.json({
      success: true,
      data: {
        period,
        period_label: periodLabel,
        date_range: dateRange,
        summary: {
          not_invited: notInvited,
          valid,
          invalid,
          pending,
          total_should: totalShould,
          invite_rate: inviteRate
        },
        missed_coaches: formattedCoaches
      }
    });
  } catch (error) {
    console.error('周期约客统计失败:', error);
    res.status(500).json({ success: false, error: '获取统计数据失败' });
  }
});

/**
 * 根据 period 参数计算日期范围
 * 服务器时区已设为 Asia/Shanghai,直接使用 Date 对象
 */
function getDateRange(period) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  const day = now.getDate();

  switch (period) {
    case 'yesterday': {
      const yesterday = new Date(year, month, day - 1);
      const dateStr = formatDateStr(yesterday);
      return { dateStart: dateStr, dateEnd: dateStr, periodLabel: '昨天' };
    }
    case 'day-before-yesterday': {
      const dayBefore = new Date(year, month, day - 2);
      const dateStr = formatDateStr(dayBefore);
      return { dateStart: dateStr, dateEnd: dateStr, periodLabel: '前天' };
    }
    case 'this-month': {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month, day);
      return {
        dateStart: formatDateStr(monthStart),
        dateEnd: formatDateStr(monthEnd),
        periodLabel: '本月'
      };
    }
    case 'last-month': {
      const lastMonthStart = new Date(year, month - 1, 1);
      const lastMonthEnd = new Date(year, month, 0); // 上月最后一天
      return {
        dateStart: formatDateStr(lastMonthStart),
        dateEnd: formatDateStr(lastMonthEnd),
        periodLabel: '上月'
      };
    }
  }
}

function formatDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = router;
