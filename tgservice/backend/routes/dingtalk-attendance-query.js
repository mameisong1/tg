/**
 * 钉钉打卡查询 API
 * 路径: /api/dingtalk-attendance
 * 功能: 查询钉钉打卡时间，供前端上班打卡使用
 * 
 * 轮询机制：由前端发起轮询（每10秒），后端只做实时查询
 * 前端退出页面即停止轮询，后端无残留状态
 */

const express = require('express');
const router = express.Router();
const dingtalkService = require('../services/dingtalk-service');
const { get, enqueueRun } = require('../db');
const TimeUtil = require('../utils/time');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');

/**
 * POST /api/dingtalk-attendance/query
 * 一次性查询钉钉打卡时间（不启动后台轮询）
 * 
 * 请求参数:
 * - coach_no: 助教工号
 * - clock_type: 'in' 或 'return'
 * - lejuan_id: 乐捐记录ID（仅 clock_type=return 时需要）
 * 
 * 响应:
 * - found: 已有打卡时间（DB推送或API查到）
 * - not_found: 未找到打卡记录，前端需启动轮询
 * - error: 配置错误（未绑定钉钉等）
 */
router.post('/query', auth.required, requireBackendPermission(['coachManagement'], { coachSelfOnly: true }), async (req, res) => {
  try {
    const { coach_no, clock_type = 'in', lejuan_id } = req.body;
    
    if (!coach_no) {
      return res.status(400).json({ success: false, error: '缺少 coach_no 参数' });
    }
    
    // 1. 检查数据库是否已有钉钉打卡时间（推送）
    const todayStr = TimeUtil.todayStr();
    let dingtalkTime;
    
    if (clock_type === 'in') {
      const attendance = await get(
        'SELECT id, dingtalk_in_time FROM attendance_records WHERE coach_no = ? AND date = ?',
        [coach_no, todayStr]
      );
      dingtalkTime = attendance?.dingtalk_in_time;
    } else if (clock_type === 'return') {
      if (!lejuan_id) {
        return res.status(400).json({ success: false, error: '乐捐归来缺少 lejuan_id 参数' });
      }
      const lejuan = await get(
        'SELECT id, dingtalk_return_time FROM lejuan_records WHERE id = ?',
        [lejuan_id]
      );
      dingtalkTime = lejuan?.dingtalk_return_time;
    }
    
    if (dingtalkTime) {
      dingtalkService.dingtalkLog.write(`钉钉打卡查询: ${coach_no} 已有推送数据 ${dingtalkTime}`);
      return res.json({
        success: true,
        data: { status: 'found', dingtalk_time: dingtalkTime }
      });
    }
    
    // 2. 查询助教的钉钉用户ID
    const coach = await get('SELECT dingtalk_user_id FROM coaches WHERE coach_no = ?', [coach_no]);
    if (!coach || !coach.dingtalk_user_id) {
      return res.json({
        success: true,
        data: { status: 'error', message: '助教未绑定钉钉用户ID，请联系管理员配置' }
      });
    }
    
    // 3. 查询钉钉API打卡记录
    const yesterdayStr = TimeUtil.offsetDateStr(-1);
    const records = await dingtalkService.getAttendanceList(
      coach.dingtalk_user_id,
      yesterdayStr,
      todayStr
    );
    
    if (!records || records.length === 0) {
      dingtalkService.dingtalkLog.write(`钉钉打卡查询: ${coach_no} 钉钉API无记录`);
      return res.json({
        success: true,
        data: { status: 'not_found', message: '正在获取钉钉打卡数据...' }
      });
    }
    
    // 4. 筛选10分钟内的打卡记录
    const now = Date.now();
    const tenMinutesAgo = now - 10 * 60 * 1000;
    
    const recentRecords = records.filter(r => {
      const checkTime = r.userCheckTime || r.checkTime;
      return checkTime && checkTime >= tenMinutesAgo;
    });
    
    if (recentRecords.length > 0) {
      const lastRecord = recentRecords[recentRecords.length - 1];
      const checkTime = lastRecord.userCheckTime || lastRecord.checkTime;
      const checkTimeStr = TimeUtil.formatTimestamp(checkTime);
      
      dingtalkService.dingtalkLog.write(`钉钉打卡查询: ${coach_no} 查到10分钟内打卡 ${checkTimeStr}`);
      
      // 写入数据库
      if (clock_type === 'in') {
        const existingRecord = await get(
          'SELECT id FROM attendance_records WHERE coach_no = ? AND date = ?',
          [coach_no, todayStr]
        );
        if (existingRecord) {
          await enqueueRun(
            'UPDATE attendance_records SET dingtalk_in_time = ?, updated_at = ? WHERE id = ?',
            [checkTimeStr, TimeUtil.nowDB(), existingRecord.id]
          );
        } else {
          await enqueueRun(
            `INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, dingtalk_in_time, created_at, updated_at)
             VALUES (?, ?, '', '', ?, ?, ?)`,
            [todayStr, coach_no, checkTimeStr, TimeUtil.nowDB(), TimeUtil.nowDB()]
          );
        }
      } else if (clock_type === 'return') {
        await enqueueRun(
          'UPDATE lejuan_records SET dingtalk_return_time = ?, updated_at = ? WHERE id = ?',
          [checkTimeStr, TimeUtil.nowDB(), lejuan_id]
        );
      }
      
      return res.json({
        success: true,
        data: { status: 'found', dingtalk_time: checkTimeStr }
      });
    }
    
    // 5. 未找到10分钟内的记录 → 前端启动轮询
    dingtalkService.dingtalkLog.write(`钉钉打卡查询: ${coach_no} 10分钟内无记录，前端将启动轮询`);
    return res.json({
      success: true,
      data: { status: 'not_found', message: '正在获取钉钉打卡数据...' }
    });
    
  } catch (err) {
    dingtalkService.dingtalkLog.write(`钉钉打卡查询异常: ${err.message}`);
    res.status(500).json({ success: false, error: '查询失败' });
  }
});

/**
 * GET /api/dingtalk-attendance/status
 * 实时查询钉钉打卡状态（前端轮询调用，每10秒一次）
 * 每次调用都会实时查询钉钉API，不依赖后端缓存
 * 前端超时后停止调用此接口
 */
router.get('/status', auth.required, requireBackendPermission(['coachManagement'], { coachSelfOnly: true }), async (req, res) => {
  try {
    const { coach_no, clock_type, lejuan_id } = req.query;
    
    // 1. 优先检查数据库是否有钉钉推送数据
    const todayStr = TimeUtil.todayStr();
    let dingtalkTime;
    
    if (clock_type === 'in') {
      const attendance = await get(
        'SELECT dingtalk_in_time FROM attendance_records WHERE coach_no = ? AND date = ?',
        [coach_no, todayStr]
      );
      dingtalkTime = attendance?.dingtalk_in_time;
    } else if (clock_type === 'return') {
      if (lejuan_id) {
        const lejuan = await get(
          'SELECT dingtalk_return_time FROM lejuan_records WHERE id = ?',
          [lejuan_id]
        );
        dingtalkTime = lejuan?.dingtalk_return_time;
      }
    }
    
    if (dingtalkTime) {
      dingtalkService.dingtalkLog.write(`轮询查询: ${coach_no} 数据库已有推送 ${dingtalkTime}`);
      return res.json({
        success: true,
        data: { status: 'found', dingtalk_time: dingtalkTime }
      });
    }
    
    // 2. 数据库没有 → 实时查询钉钉API
    const coach = await get('SELECT dingtalk_user_id FROM coaches WHERE coach_no = ?', [coach_no]);
    if (!coach || !coach.dingtalk_user_id) {
      return res.json({
        success: true,
        data: { status: 'error', message: '助教未绑定钉钉用户ID' }
      });
    }
    
    const yesterdayStr = TimeUtil.offsetDateStr(-1);
    const records = await dingtalkService.getAttendanceList(
      coach.dingtalk_user_id,
      yesterdayStr,
      todayStr
    );
    
    if (!records || records.length === 0) {
      return res.json({ success: true, data: { status: 'pending' } });
    }
    
    // 筛选5分钟内的打卡记录（轮询时窗口缩小到5分钟）
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    const recentRecords = records.filter(r => {
      const checkTime = r.userCheckTime || r.checkTime;
      return checkTime && checkTime >= fiveMinutesAgo;
    });
    
    if (recentRecords.length > 0) {
      const lastRecord = recentRecords[recentRecords.length - 1];
      const checkTime = lastRecord.userCheckTime || lastRecord.checkTime;
      const checkTimeStr = TimeUtil.formatTimestamp(checkTime);
      
      dingtalkService.dingtalkLog.write(`轮询成功: ${coach_no} ${checkTimeStr}`);
      
      // 写入数据库
      if (clock_type === 'in') {
        const existingRecord = await get(
          'SELECT id FROM attendance_records WHERE coach_no = ? AND date = ?',
          [coach_no, todayStr]
        );
        if (existingRecord) {
          await enqueueRun(
            'UPDATE attendance_records SET dingtalk_in_time = ?, updated_at = ? WHERE id = ?',
            [checkTimeStr, TimeUtil.nowDB(), existingRecord.id]
          );
        } else {
          await enqueueRun(
            `INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, dingtalk_in_time, created_at, updated_at)
             VALUES (?, ?, '', '', ?, ?, ?)`,
            [todayStr, coach_no, checkTimeStr, TimeUtil.nowDB(), TimeUtil.nowDB()]
          );
        }
      } else if (clock_type === 'return') {
        await enqueueRun(
          'UPDATE lejuan_records SET dingtalk_return_time = ?, updated_at = ? WHERE id = ?',
          [checkTimeStr, TimeUtil.nowDB(), lejuan_id]
        );
      }
      
      return res.json({
        success: true,
        data: { status: 'found', dingtalk_time: checkTimeStr }
      });
    }
    
    // 没找到 → pending，前端继续轮询
    return res.json({ success: true, data: { status: 'pending' } });
    
  } catch (err) {
    res.status(500).json({ success: false, error: '查询失败' });
  }
});

module.exports = router;
