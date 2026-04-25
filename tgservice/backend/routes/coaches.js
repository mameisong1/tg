/**
 * 助教管理 API
 * 路径:/api/coaches
 */

const express = require('express');
const router = express.Router();
const { runInTransaction } = require('../db');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const TimeUtil = require('../utils/time');
const operationLogService = require('../services/operation-log');
const dingtalkService = require('../services/dingtalk-service');
const errorLogger = require('../utils/error-logger');
const http = require('http');

/**
 * 计算是否迟到
 * @param {string} clockInTime - 打卡时间 "YYYY-MM-DD HH:MM:SS"
 * @param {string} shift - 班次 "早班" 或 "晚班"
 * @param {number} coachNo - 助教工号
 * @param {string} date - 日期 "YYYY-MM-DD"
 * @param {object} tx - 数据库事务对象
 * @returns {number} 0=正常, 1=迟到
 */
async function calculateIsLate(clockInTime, shift, coachNo, date, tx) {
  if (!shift) return 0;

  // 查询助教手机号
  const coach = await tx.get(
    'SELECT phone FROM coaches WHERE coach_no = ?',
    [coachNo]
  );
  if (!coach || !coach.phone) return 0;

  // 查询当天已审批的加班申请小时数
  const app = await tx.get(`
    SELECT COALESCE(CAST(JSON_EXTRACT(extra_data, '$.hours') AS INTEGER), 0) as hours
    FROM applications
    WHERE applicant_phone = ?
      AND application_type IN ('早加班申请', '晚加班申请')
      AND status = 1
      AND date(created_at) = ?
    LIMIT 1
  `, [coach.phone, date]);

  const overtimeHours = app ? app.hours : 0;

  // 计算应上班时间
  let baseHour;
  if (shift === '早班') {
    baseHour = 14;
  } else if (shift === '晚班') {
    baseHour = 18;
  } else {
    return 0;
  }

  const baseHourStr = `${String(baseHour).padStart(2, '0')}:00:00`;
  const expectedBaseTime = `${date} ${baseHourStr}`;

  // 查询上班时间立刻乐捐记录
  // 如果在上班时间点（14:00/18:00）立刻预约乐捐 → 不迟到
  const lejuanRecord = await tx.get(`
    SELECT id FROM lejuan_records
    WHERE coach_no = ?
      AND scheduled_start_time = ?
    LIMIT 1
  `, [coachNo, expectedBaseTime]);

  if (lejuanRecord) {
    return 0;  // 上班时间立刻乐捐 → 不迟到
  }

  // 加班 = 可以晚到，应上班时间延后
  // 早加班/晚加班 → 应上班时间 = 正常时间 + 加班小时数
  const expectedHour = Math.min(24, baseHour + overtimeHours);
  const expectedTime = `${date} ${String(expectedHour).padStart(2, '0')}:00:00`;

  // 字符串比较（"YYYY-MM-DD HH:MM:SS" 格式可直接比较）
  return clockInTime > expectedTime ? 1 : 0;
}

/**
 * POST /api/coaches/:coach_no/clock-in
 * 助教上班(助教只能打自己的卡)
 */
router.post('/:coach_no/clock-in', auth.required, requireBackendPermission(['coachManagement'], { coachSelfOnly: true }), async (req, res) => {
  try {
    const result = await runInTransaction(async (tx) => {
    const { coach_no } = req.params;
    const { clock_in_photo } = req.body; // 新增：打卡截图参数

    // 获取助教信息(包括班次和工号)
    const coach = await tx.get(`
      SELECT coach_no, stage_name, shift, employee_id FROM coaches WHERE coach_no = ?
    `, [coach_no]);

    if (!coach) {
      throw { status: 404, error: '助教不存在' };
    }

    // 获取当前水牌状态
    const waterBoard = await tx.get(`
      SELECT * FROM water_boards WHERE coach_no = ?
    `, [coach_no]);

    if (!waterBoard) {
      throw { status: 404, error: '水牌不存在' };
    }

    const oldStatus = waterBoard.status;

    // 根据班次和当前状态确定新状态
    let newStatus;
    let lejuanEnded = false;
    if (waterBoard.status === '乐捐') {
      // 自动结束乐捐,然后进入空闲
      const activeLejuan = await tx.get(
        `SELECT id, scheduled_start_time FROM lejuan_records
         WHERE coach_no = ? AND lejuan_status = 'active'
         ORDER BY scheduled_start_time DESC LIMIT 1`,
        [coach_no]
      );

      if (activeLejuan) {
        const nowDB = TimeUtil.nowDB();
        const { calculateLejuanHours } = require('../utils/lejuan-hours');
        const lejuanHours = calculateLejuanHours(activeLejuan.scheduled_start_time, nowDB);

        await tx.run(
          `UPDATE lejuan_records
           SET lejuan_status = 'returned',
               return_time = ?,
               lejuan_hours = ?,
               returned_by = ?,
               updated_at = ?
           WHERE id = ? AND lejuan_status = 'active'`,
          [nowDB, lejuanHours, req.user.username || 'system', nowDB, activeLejuan.id]
        );
        lejuanEnded = true;
      }
      newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
    } else if (['早加班', '休息', '公休', '请假', '下班'].includes(waterBoard.status)) {
      newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
    } else if (waterBoard.status === '早班空闲' || waterBoard.status === '晚班空闲') {
      throw { status: 400, error: '助教已在班状态,无需重复上班' };
    } else {
      if (waterBoard.status === '早班上桌' || waterBoard.status === '晚班上桌') {
        throw { status: 400, error: '上桌状态不能点上班' };
      }
      newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
    }

    // 更新水牌状态
    const nowDB = TimeUtil.nowDB();
    await tx.run(`
      UPDATE water_boards
      SET status = ?, table_no = NULL, clock_in_time = ?, updated_at = ?
      WHERE coach_no = ?
    `, [newStatus, nowDB, nowDB, coach_no]);

    // 新增:写入打卡记录（含打卡截图 + 迟到计算）
    const todayStr = TimeUtil.todayStr();
    const isLate = await calculateIsLate(nowDB, coach.shift, coach_no, todayStr, tx);
    
    // 先查询今天是否已有记录（包括只有钉钉时间的）
    const existingRecord = await tx.get(`
      SELECT id, clock_in_time FROM attendance_records
      WHERE coach_no = ? AND date = ?
      ORDER BY created_at DESC LIMIT 1
    `, [coach_no, todayStr]);
    
    if (existingRecord && !existingRecord.clock_in_time) {
      // 有记录但没有 clock_in_time → UPDATE（钉钉先打卡，系统后打卡）
      await tx.run(`
        UPDATE attendance_records
        SET clock_in_time = ?, clock_in_photo = ?, is_late = ?, updated_at = ?
        WHERE id = ?
      `, [nowDB, clock_in_photo || null, isLate, nowDB, existingRecord.id]);
    } else if (!existingRecord) {
      // 没有记录 → INSERT
      await tx.run(`
        INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, clock_out_time, clock_in_photo, is_late, is_reviewed, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 0, ?, ?)
      `, [todayStr, coach_no, coach.employee_id, coach.stage_name, nowDB, clock_in_photo || null, isLate, nowDB, nowDB]);
    }

    // 记录操作日志
    const user = req.user;
    await operationLogService.create(tx, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '水牌状态变更',
      target_type: 'water_board',
      target_id: waterBoard.id,
      old_value: JSON.stringify({ status: oldStatus, table_no: waterBoard.table_no }),
      new_value: JSON.stringify({ status: newStatus, table_no: null }),
      remark: `上班:${oldStatus} → ${newStatus}`
    });

    return { coach_no, stage_name: coach.stage_name, status: newStatus, shift: coach.shift, oldStatus };
    });

    res.json({
      success: true,
      data: {
        coach_no: result.coach_no,
        stage_name: result.stage_name,
        status: result.status
      }
    });

    // 钉钉打卡时间查询（非阻塞）
    const { get, all, enqueueRun } = require('../db');
    const coachInfo = await get('SELECT dingtalk_user_id FROM coaches WHERE coach_no = ?', [result.coach_no]);
    if (coachInfo && coachInfo.dingtalk_user_id) {
      // 判断打卡类型：乐捐归来 vs 上班打卡
      const isLejuanReturn = result.oldStatus === '乐捐';
      const clockType = 'in';
      const dbCtx = { get, all, enqueueRun };
      const queryFn = isLejuanReturn
        ? dingtalkService.queryLejuanReturnAttendance.bind(dingtalkService)
        : dingtalkService.queryRecentAttendance.bind(dingtalkService);
      
      if (isLejuanReturn) {
        // 乐捐归来：需要查乐捐记录ID
        const lejuanRecord = await get(
          `SELECT id FROM lejuan_records WHERE coach_no = ? AND lejuan_status = 'returned'
           ORDER BY updated_at DESC LIMIT 1`,
          [result.coach_no]
        );
        if (lejuanRecord) {
          queryFn(coachInfo.dingtalk_user_id, result.coach_no, lejuanRecord.id, dbCtx)
            .then(tip => {
              if (tip) dingtalkService.dingtalkLog.write(`乐捐归来 ${result.coach_no}: ${tip}`);
            })
            .catch(err => dingtalkService.dingtalkLog.write(`乐捐归来钉钉查询异常: ${err.message}`));
        }
      } else {
        // 上班打卡
        queryFn(coachInfo.dingtalk_user_id, result.coach_no, clockType, dbCtx)
          .then(tip => {
            if (tip) dingtalkService.dingtalkLog.write(`上班 ${result.coach_no}: ${tip}`);
          })
          .catch(err => dingtalkService.dingtalkLog.write(`上班钉钉查询异常: ${err.message}`));
      }
    }

    // 触发门迎排序（非阻塞，不等待结果）
    try {
      const currentHour = new Date(TimeUtil.nowDB() + '+08:00').getHours();
      if ((result.status === '早班空闲' && currentHour >= 14) ||
          (result.status === '晚班空闲' && currentHour >= 18)) {
        const postData = JSON.stringify({ coachNo: result.coach_no, shift: result.shift });
        const options = {
          hostname: '127.0.0.1',
          port: parseInt(process.env.PORT) || (process.env.TGSERVICE_ENV === 'test' ? 8088 : 80),
          path: '/api/guest-rankings/internal/after-clock',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };
        const triggerReq = http.request(options, (resp) => {
          console.log(`[GuestRanking] 打卡后排序触发成功: coach_no=${result.coach_no}, shift=${result.shift}`);
        });
        triggerReq.on('error', (err) => {
          console.error(`[GuestRanking] 打卡后排序触发失败: coach_no=${result.coach_no}, error=${err.message}`);
        });
        triggerReq.write(postData);
        triggerReq.end();
      }
    } catch (e) {
      console.error('[GuestRanking] 打卡后排序触发异常:', e.message);
    }
  } catch (error) {
    errorLogger.logApiRejection(req, error);
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
    console.error('上班失败:', error);
    res.status(500).json({
      success: false,
      error: '上班失败'
    });
  }
});

/**
 * POST /api/coaches/:coach_no/clock-out
 * 助教下班(助教只能打自己的卡)
 */
router.post('/:coach_no/clock-out', auth.required, requireBackendPermission(['coachManagement'], { coachSelfOnly: true }), async (req, res) => {
  try {
    const result = await runInTransaction(async (tx) => {
    const { coach_no } = req.params;

    // 获取当前水牌状态
    const waterBoard = await tx.get(`
      SELECT * FROM water_boards WHERE coach_no = ?
    `, [coach_no]);

    if (!waterBoard) {
      throw { status: 404, error: '水牌不存在' };
    }

    const oldStatus = waterBoard.status;

    // 只允许从空闲状态下班，其他状态需先回到空闲
    const canClockOut = ['早班空闲', '晚班空闲'].includes(waterBoard.status);

    if (!canClockOut) {
      throw { status: 400, error: `当前状态(${waterBoard.status})不允许下班` };
    }

    const newStatus = '下班';

    const nowDB = TimeUtil.nowDB();
    await tx.run(`
      UPDATE water_boards 
      SET status = ?, table_no = NULL, clock_in_time = NULL, updated_at = ?
      WHERE coach_no = ?
    `, [newStatus, nowDB, coach_no]);

    // 查找上一个12点以后的未下班上班记录（凌晨下班时上班记录可能在昨天）
    const attendanceRecord = await dingtalkService.findActiveAttendanceRecord(tx.get, coach_no, nowDB);

    if (attendanceRecord) {
      await tx.run(`
        UPDATE attendance_records
        SET clock_out_time = ?, updated_at = ?
        WHERE id = ?
      `, [nowDB, nowDB, attendanceRecord.id]);
    } else {
      console.log(`[attendance] 下班打卡丢弃：coach_no=${coach_no}, 当天无上班记录`);
    }

    const user = req.user;
    await operationLogService.create(tx, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '水牌状态变更',
      target_type: 'water_board',
      target_id: waterBoard.id,
      old_value: JSON.stringify({ status: oldStatus, table_no: waterBoard.table_no }),
      new_value: JSON.stringify({ status: newStatus, table_no: null }),
      remark: `下班：${oldStatus} → ${newStatus}`
    });
    
    return { coach_no, status: newStatus };
    });

    res.json({
      success: true,
      data: {
        coach_no: result.coach_no,
        status: result.status
      }
    });

    // 钉钉打卡时间查询（非阻塞）
    const { get, all, enqueueRun } = require('../db');
    const coachInfo = await get('SELECT dingtalk_user_id FROM coaches WHERE coach_no = ?', [result.coach_no]);
    if (coachInfo && coachInfo.dingtalk_user_id) {
      dingtalkService.queryRecentAttendance(coachInfo.dingtalk_user_id, result.coach_no, 'out', { get, all, enqueueRun })
        .then(tip => {
          if (tip) dingtalkService.dingtalkLog.write(`下班 ${result.coach_no}: ${tip}`);
        })
        .catch(err => dingtalkService.dingtalkLog.write(`下班钉钉查询异常: ${err.message}`));
    }
  } catch (error) {
    errorLogger.logApiRejection(req, error);
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
    console.error('下班失败:', error);
    res.status(500).json({
      success: false,
      error: '下班失败'
    });
  }
});

/**
 * PUT /api/coaches/batch-shift
 * 批量修改班次
 */
router.put('/batch-shift', auth.required, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const result = await runInTransaction(async (tx) => {
    const { coach_no_list, shift } = req.body;

    if (!['早班', '晚班'].includes(shift)) {
      throw { status: 400, error: '无效的班次值' };
    }

    if (!Array.isArray(coach_no_list) || coach_no_list.length === 0) {
      throw { status: 400, error: '助教列表不能为空' };
    }

    const statusMap = {
      '早班空闲': '晚班空闲',
      '晚班空闲': '早班空闲',
      '早班上桌': '晚班上桌',
      '晚班上桌': '早班上桌',
      '早加班': '晚加班',
      '晚加班': '早加班'
    };

    const placeholders = coach_no_list.map(() => '?').join(',');
    const coaches = await tx.all(`
      SELECT coach_no, stage_name, shift FROM coaches WHERE coach_no IN (${placeholders})
    `, coach_no_list);

    const waterBoards = await tx.all(`
      SELECT coach_no, id, status, table_no FROM water_boards WHERE coach_no IN (${placeholders})
    `, coach_no_list);

    const waterBoardMap = {};
    waterBoards.forEach(wb => { waterBoardMap[wb.coach_no] = wb; });

    const coachMap = {};
    coaches.forEach(c => { coachMap[c.coach_no] = c; });

    const changeDetails = [];

    const nowDB = TimeUtil.nowDB();
    await tx.run(`
      UPDATE coaches SET shift = ?, updated_at = ?
      WHERE coach_no IN (${placeholders})
    `, [shift, nowDB, ...coach_no_list]);

    for (const coachNo of coach_no_list) {
      const coach = coachMap[coachNo];
      const waterBoard = waterBoardMap[coachNo];

      if (!coach) continue;

      const oldShift = coach.shift;
      let waterBoardStatusChanged = false;

      if (waterBoard && statusMap[waterBoard.status]) {
        const oldStatus = waterBoard.status;
        const newStatus = statusMap[oldStatus];

        await tx.run(
          'UPDATE water_boards SET status = ?, updated_at = ? WHERE coach_no = ?',
          [newStatus, nowDB, coachNo]
        );

        waterBoardStatusChanged = true;

        await operationLogService.create(tx, {
          operator_phone: req.user.username,
          operator_name: req.user.name,
          operation_type: '水牌状态变更',
          target_type: 'water_board',
          target_id: waterBoard.id,
          old_value: JSON.stringify({ status: oldStatus, table_no: waterBoard.table_no }),
          new_value: JSON.stringify({ status: newStatus, table_no: waterBoard.table_no }),
          remark: `批量班次变更联动:${oldShift}→${shift},水牌 ${oldStatus}→${newStatus}`
        });
      }

      changeDetails.push({
        coach_no: coachNo,
        stage_name: coach.stage_name,
        old_shift: oldShift,
        new_shift: shift,
        water_board_changed: waterBoardStatusChanged
      });
    }

    const user = req.user;
    await operationLogService.create(tx, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '批量修改班次',
      target_type: 'coaches',
      old_value: JSON.stringify(changeDetails.map(d => ({ coach_no: d.coach_no, stage_name: d.stage_name, shift: d.old_shift, water_board_changed: d.water_board_changed }))),
      new_value: JSON.stringify({ shift, count: coach_no_list.length }),
      remark: `批量修改${coach_no_list.length}名助教班次为${shift},详情:${changeDetails.map(d => `${d.stage_name}(${d.coach_no}): ${d.old_shift}→${d.shift}${d.water_board_changed ? ' [水牌已联动]' : ''}`).join(';')}`
    });

    return { updated_count: coach_no_list.length, details: changeDetails };
    });

    res.json({
      success: true,
      data: {
        updated_count: result.updated_count,
        details: result.details
      }
    });
  } catch (error) {
    errorLogger.logApiRejection(req, error);
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
    console.error('批量修改班次失败:', error);
    res.status(500).json({
      success: false,
      error: '批量修改班次失败'
    });
  }
});

/**
 * PUT /api/coaches/v2/:coach_no/shift
 * 单个修改助教班次(第 3 轮修订新增)
 */
router.put('/:coach_no/shift', auth.required, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const result = await runInTransaction(async (tx) => {
    const { coach_no } = req.params;
    const { shift } = req.body;

    if (!['早班', '晚班'].includes(shift)) {
      throw { status: 400, error: '无效的班次值,应为早班或晚班' };
    }

    const coach = await tx.get(
      'SELECT coach_no, stage_name, shift FROM coaches WHERE coach_no = ?',
      [coach_no]
    );

    if (!coach) {
      throw { status: 404, error: '助教不存在' };
    }

    const oldShift = coach.shift;

    const nowDB = TimeUtil.nowDB();
    await tx.run(
      'UPDATE coaches SET shift = ?, updated_at = ? WHERE coach_no = ?',
      [shift, nowDB, coach_no]
    );

    const waterBoard = await tx.get(
      'SELECT * FROM water_boards WHERE coach_no = ?',
      [coach_no]
    );

    if (waterBoard) {
      const oldStatus = waterBoard.status;
      let newStatus = oldStatus;

      const statusMap = {
        '早班空闲': '晚班空闲',
        '晚班空闲': '早班空闲',
        '早班上桌': '晚班上桌',
        '晚班上桌': '早班上桌',
        '早加班': '晚加班',
        '晚加班': '早加班'
      };

      if (statusMap[oldStatus]) {
        newStatus = statusMap[oldStatus];
        await tx.run(
          'UPDATE water_boards SET status = ?, updated_at = ? WHERE coach_no = ?',
          [newStatus, nowDB, coach_no]
        );

        const user = req.user;
        await operationLogService.create(tx, {
          operator_phone: user.username,
          operator_name: user.name,
          operation_type: '水牌状态变更',
          target_type: 'water_board',
          target_id: waterBoard.id,
          old_value: JSON.stringify({ status: oldStatus, table_no: waterBoard.table_no }),
          new_value: JSON.stringify({ status: newStatus, table_no: waterBoard.table_no }),
          remark: `班次变更联动:${oldShift}→${shift},水牌 ${oldStatus}→${newStatus}`
        });
      }
    }

    const user = req.user;
    await operationLogService.create(tx, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '修改班次',
      target_type: 'coaches',
      old_value: JSON.stringify({ coach_no, shift: oldShift }),
      new_value: JSON.stringify({ coach_no, shift }),
      remark: `修改助教${coach.stage_name}班次:${oldShift}→${shift}`
    });

    return { coach_no, shift, old_shift: oldShift };
    });

    res.json({
      success: true,
      data: {
        coach_no: result.coach_no,
        shift: result.shift,
        old_shift: result.old_shift
      }
    });
  } catch (error) {
    errorLogger.logApiRejection(req, error);
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
    console.error('修改班次失败:', error);
    res.status(500).json({
      success: false,
      error: '修改班次失败'
    });
  }
});

module.exports = router;
