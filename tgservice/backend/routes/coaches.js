/**
 * 助教管理 API
 * 路径:/api/coaches
 */

const express = require('express');
const router = express.Router();
const { runInTransaction, waitForIdle, get, all, enqueueRun } = require('../db');
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

  // 加班 = 可以晚到，应上班时间延后
  // 早加班/晚加班 → 应上班时间 = 正常时间 + 加班小时数
  const expectedHour = Math.min(24, baseHour + overtimeHours);
  const expectedTime = `${date} ${String(expectedHour).padStart(2, '0')}:00:00`;

  // 查询应上班时间是否有乐捐预约
  // 如果在应上班时间点立刻预约乐捐 → 不迟到
  // QA-20260501-18: 修复加班后上班时间的乐捐判断
  const lejuanRecord = await tx.get(`
    SELECT id FROM lejuan_records
    WHERE coach_no = ?
      AND scheduled_start_time = ?
      AND lejuan_status IN ('pending', 'active', 'completed')
    LIMIT 1
  `, [coachNo, expectedTime]);

  if (lejuanRecord) {
    return 0;  // 应上班时间有乐捐预约 → 不迟到
  }

  // 字符串比较（"YYYY-MM-DD HH:MM:SS" 格式可直接比较）
  return clockInTime > expectedTime ? 1 : 0;
}

// ========== 打卡时间段判断辅助函数 ==========

/**
 * 是否在加班时间段（按班次区分）
 * 早班：23:00 ~ 次日11:00
 * 晚班：次日2:00 ~ 次日11:00
 */
function isOvertimeTime(hour, shift) {
  if (shift === '早班') {
    return hour >= 23 || hour < 11;
  } else {
    return hour >= 2 && hour < 11;
  }
}

/**
 * 是否在无效时间段（11:00 ~ 13:00）
 */
function isInvalidTime(hour) {
  return hour >= 11 && hour < 13;
}

/**
 * 是否在上班时间段内（按班次区分）
 * 早班：13:00 ~ 23:00
 * 晚班：13:00 ~ 次日2:00
 */
function isInWorkTime(hour, shift) {
  if (shift === '早班') {
    return hour >= 13 && hour < 23;
  } else {
    return hour >= 13 || hour < 2;
  }
}

/**
 * 加班打卡查找记录的日期
 * 0点~11点 → 前一日
 * 23点~24点 → 当日
 */
function getOvertimeTargetDate(checkHour, todayStr) {
  if (checkHour >= 0 && checkHour < 11) {
    // 0点~11点：跨日，找前一日（字符串运算，避免时区问题）
    const parts = todayStr.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]) - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } else {
    return todayStr;
  }
}

/**
 * POST /api/coaches/:coach_no/clock-in
 * 助教上班(助教只能打自己的卡)
 * QA-20260501-1: 强制使用钉钉打卡时间
 */
router.post('/:coach_no/clock-in', auth.required, requireBackendPermission(['coachManagement'], { coachSelfOnly: true }), async (req, res) => {
  try {
    // 【方案A】等待异步队列完成，避免竞态导致的重复记录
    try {
      await waitForIdle(5000);  // 最长等待5秒
    } catch (e) {
      console.log('[clock-in] waitForIdle timeout, continue anyway');
    }

    const { coach_no } = req.params;
    const { clock_in_photo, force_dingtalk = true } = req.body;

    // QA-20260501-1: 强制钉钉打卡逻辑
    const todayStr = TimeUtil.todayStr();
    let dingtalkTime = null;

    if (force_dingtalk) {
      // 查询钉钉打卡时间
      const attendance = await get(
        'SELECT id, dingtalk_in_time FROM attendance_records WHERE coach_no = ? AND date = ?',
        [coach_no, todayStr]
      );
      dingtalkTime = attendance?.dingtalk_in_time;

      if (!dingtalkTime) {
        // 未找到钉钉打卡时间 → 返回错误码
        dingtalkService.dingtalkLog.write(`clock-in 失败: ${coach_no} 无钉钉打卡时间`);
        return res.json({
          success: false,
          error: 'DINGTALK_NOT_FOUND',
          message: '未获取到钉钉打卡时间，请先在钉钉打卡'
        });
      }
    }

    const result = await runInTransaction(async (tx) => {
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
    const checkHour = parseInt(dingtalkTime.substring(11, 13), 10);
    const nowDB = TimeUtil.nowDB();

    // 根据班次和当前状态确定处理逻辑
    let newStatus;
    let lejuanEnded = false;
    let lejuanId = null;
    let isOvertimeClock = false;
    let overtimeRecordDate = null;
    let overtimeRecordFound = false;
    let attendanceUpdatePerformed = false; // 标记是否已处理打卡记录

    if (waterBoard.status === '乐捐') {
      // 乐捐状态下做上班打卡判定 → 乐捐归来
      // ✅ 新增：乐捐归来必须在上班时间段内
      if (!isInWorkTime(checkHour, coach.shift)) {
        throw { status: 400, error: 'TIME_NOT_ALLOWED', message: '当前时间段不允许乐捐归来，必须在上班时间段内（早班13:00~23:00，晚班13:00~次日2:00）' };
      }

      // 自动结束乐捐,然后进入空闲
      const activeLejuan = await tx.get(
        `SELECT id, scheduled_start_time FROM lejuan_records
         WHERE coach_no = ? AND lejuan_status = 'active'
         ORDER BY scheduled_start_time DESC LIMIT 1`,
        [coach_no]
      );

      if (activeLejuan) {
        lejuanId = activeLejuan.id;
        const returnTime = dingtalkTime || TimeUtil.nowDB();
        const { calculateLejuanHours } = require('../utils/lejuan-hours');
        const lejuanHours = calculateLejuanHours(activeLejuan.scheduled_start_time, returnTime);

        await tx.run(
          `UPDATE lejuan_records
           SET lejuan_status = 'returned',
               return_time = ?,
               dingtalk_return_time = ?,
               lejuan_hours = ?,
               returned_by = ?,
               updated_at = ?
           WHERE id = ? AND lejuan_status = 'active'`,
          [returnTime, dingtalkTime || null, lejuanHours, req.user.username || 'system', TimeUtil.nowDB(), activeLejuan.id]
        );
        lejuanEnded = true;
        dingtalkService.dingtalkLog.write(`乐捐归来: ${coach_no} return_time=${returnTime}, dingtalk_return_time=${dingtalkTime || 'null'}`);
      }
      newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';

    } else if (waterBoard.status === '下班') {
      // 下班状态 → 判断是加班打卡、无效时间段、还是正常上班

      if (isOvertimeTime(checkHour, coach.shift)) {
        // ✅ 加班打卡场景
        isOvertimeClock = true;
        overtimeRecordDate = getOvertimeTargetDate(checkHour, todayStr);

        // a. 查找上班记录
        const record = await tx.get(
          `SELECT id FROM attendance_records WHERE coach_no = ? AND date = ?`,
          [coach_no, overtimeRecordDate]
        );

        if (record) {
          // 找到 → 只清空系统和钉钉下班时间，不改上班时间
          await tx.run(
            `UPDATE attendance_records
             SET clock_out_time = NULL,
                 dingtalk_out_time = NULL,
                 updated_at = ?
             WHERE id = ?`,
            [nowDB, record.id]
          );
          overtimeRecordFound = true;
          attendanceUpdatePerformed = true;
          dingtalkService.dingtalkLog.write(`加班打卡: ${coach_no} 找到记录(${overtimeRecordDate})，清空下班时间`);
        } else {
          // 找不到 → 新增一条上班记录
          const clockInTime = dingtalkTime;
          const isLate = await calculateIsLate(clockInTime, coach.shift, coach_no, overtimeRecordDate, tx);
          await tx.run(
            `INSERT INTO attendance_records
             (date, coach_no, employee_id, stage_name, clock_in_time, clock_out_time,
              clock_in_photo, dingtalk_in_time, dingtalk_out_time, is_late, is_reviewed, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, NULL, 0, 0, ?, ?)`,
            [overtimeRecordDate, coach_no, coach.employee_id, coach.stage_name,
             clockInTime, clockInTime, nowDB, nowDB]
          );
          overtimeRecordFound = false;
          attendanceUpdatePerformed = true;
          dingtalkService.dingtalkLog.write(`加班打卡: ${coach_no} 未找到记录(${overtimeRecordDate})，新增上班记录`);
        }

        // b. 水牌改为空闲
        newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';

      } else if (isInvalidTime(checkHour)) {
        // 无效时间段（11:00~13:00）→ 拒绝
        throw { status: 400, error: 'TIME_NOT_ALLOWED', message: '当前时间段不允许打卡（11:00~13:00）' };

      } else if (isInWorkTime(checkHour, coach.shift)) {
        // 正常上班
        newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';

      } else {
        // 其他情况（如晚班的11:00~13:00已拒绝，2:00~13:00中不属于加班/上班的）
        throw { status: 400, error: 'TIME_NOT_ALLOWED', message: '当前时间段不允许打卡' };
      }

    } else if (['早加班', '休息', '公休', '请假'].includes(waterBoard.status)) {
      newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
    } else if (waterBoard.status === '早班空闲' || waterBoard.status === '晚班空闲') {
      throw { status: 400, error: '助教已在班状态,无需重复上班' };
    } else {
      if (waterBoard.status === '早班上桌' || waterBoard.status === '晚班上桌') {
        throw { status: 400, error: '上桌状态不能点上班' };
      }
      newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
    }

    // 加班打卡已处理了考勤记录，跳过后续正常流程
    if (!isOvertimeClock) {
      // 更新水牌状态，clock_in_time 使用钉钉打卡时间
      const clockInTime = dingtalkTime || TimeUtil.nowDB();
      await tx.run(`
        UPDATE water_boards
        SET status = ?, table_no = NULL, clock_in_time = ?, updated_at = ?
        WHERE coach_no = ?
      `, [newStatus, clockInTime, nowDB, coach_no]);

      dingtalkService.dingtalkLog.write(`上班打卡: ${coach_no} clock_in_time=${clockInTime}, dingtalk_in_time=${dingtalkTime || 'null'}`);

      // 写入打卡记录，clock_in_time 使用钉钉打卡时间
      const isLate = await calculateIsLate(clockInTime, coach.shift, coach_no, todayStr, tx);

      const existingRecord = await tx.get(`
        SELECT id, clock_in_time FROM attendance_records
        WHERE coach_no = ? AND date = ?
        ORDER BY created_at DESC LIMIT 1
      `, [coach_no, todayStr]);

      if (existingRecord && !existingRecord.clock_in_time) {
        await tx.run(`
          UPDATE attendance_records
          SET clock_in_time = ?, clock_in_photo = ?, is_late = ?, updated_at = ?
          WHERE id = ?
        `, [clockInTime, clock_in_photo || null, isLate, nowDB, existingRecord.id]);
      } else if (!existingRecord) {
        await tx.run(`
          INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, clock_out_time, clock_in_photo, is_late, is_reviewed, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 0, ?, ?)
        `, [todayStr, coach_no, coach.employee_id, coach.stage_name, clockInTime, clock_in_photo || null, isLate, nowDB, nowDB]);
      }

    } else {
      // 加班打卡：更新水牌为空闲（不写 clock_in_time，因为不是正常上班）
      await tx.run(`
        UPDATE water_boards
        SET status = ?, table_no = NULL, updated_at = ?
        WHERE coach_no = ?
      `, [newStatus, nowDB, coach_no]);

      dingtalkService.dingtalkLog.write(`加班打卡: ${coach_no} 水牌 → ${newStatus}, 记录日期=${overtimeRecordDate}, 找到记录=${overtimeRecordFound}`);
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
    
    // 【方案C】合并重复记录：删除只有 dingtalk_in_time 但没有 clock_in_time 的记录
    // 保留有 clock_in_time 的记录（刚创建或刚更新的）
    const duplicateRecords = await tx.all(
      `SELECT id FROM attendance_records 
       WHERE coach_no = ? AND date = ? AND clock_in_time IS NULL AND dingtalk_in_time IS NOT NULL`,
      [coach_no, todayStr]
    );
    if (duplicateRecords.length > 0) {
      const ids = duplicateRecords.map(r => r.id);
      await tx.run(
        `DELETE FROM attendance_records WHERE id IN (${ids.join(',')})`
      );
      console.log(`[clock-in] 合并重复记录: coach_no=${coach_no}, 删除 ${ids.length} 条`);
    }

    return { coach_no, stage_name: coach.stage_name, status: newStatus, shift: coach.shift, oldStatus, clock_in_time: clockInTime, lejuanId };
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
        const isLejuanReturn = result.oldStatus === '乐捐';
        const postData = JSON.stringify({ coachNo: result.coach_no, shift: result.shift, isLejuanReturn });
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
