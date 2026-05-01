/**
 * 钉钉打卡查询 API
 * 路径: /api/dingtalk-attendance
 * 功能: 查询/轮询钉钉打卡时间，供前端上班打卡使用
 */

const express = require('express');
const router = express.Router();
const dingtalkService = require('../services/dingtalk-service');
const { get, all, enqueueRun } = require('../db');
const TimeUtil = require('../utils/time');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');

// 轮询状态缓存（内存存储，5分钟过期）
const pollStatusCache = new Map();

/**
 * POST /api/dingtalk-attendance/query
 * 查询/轮询钉钉打卡时间
 * 
 * 请求参数:
 * - coach_no: 助教工号
 * - clock_type: 'in' 或 'return'
 * - lejuan_id: 乐捐记录ID（仅 clock_type=return 时需要）
 * - timeout_seconds: 超时时间，默认300秒（5分钟）
 * 
 * 响应格式:
 * - status: 'found' | 'pending' | 'timeout' | 'error'
 * - dingtalk_time: 钉钉打卡时间（status=found 时）
 * - message: 提示信息
 */
router.post('/query', auth.required, requireBackendPermission(['coachManagement'], { coachSelfOnly: true }), async (req, res) => {
  try {
    const { coach_no, clock_type = 'in', lejuan_id, timeout_seconds = 300 } = req.body;
    
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
      // 已有推送数据 → 直接返回
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
    
    // 3. 主动查询最近10分钟内的钉钉打卡记录
    const yesterdayStr = TimeUtil.offsetDateStr(-1);
    const records = await dingtalkService.getAttendanceList(
      coach.dingtalk_user_id,
      yesterdayStr,
      todayStr
    );
    
    if (!records || records.length === 0) {
      dingtalkService.dingtalkLog.write(`钉钉打卡查询: ${coach_no} 钉钉API无记录`);
      // 无记录 → 启动后台轮询
      return await startPolling(coach_no, clock_type, lejuan_id, coach.dingtalk_user_id, timeout_seconds, res);
    }
    
    // 筛选10分钟内的打卡记录
    const now = Date.now();
    const tenMinutesAgo = now - 10 * 60 * 1000;
    
    const recentRecords = records.filter(r => {
      const checkTime = r.userCheckTime || r.checkTime;
      return checkTime && checkTime >= tenMinutesAgo;
    });
    
    if (recentRecords.length > 0) {
      // 找到10分钟内的打卡记录
      const lastRecord = recentRecords[recentRecords.length - 1];
      const checkTime = lastRecord.userCheckTime || lastRecord.checkTime;
      const checkTimeStr = TimeUtil.formatTimestamp(checkTime);
      
      dingtalkService.dingtalkLog.write(`钉钉打卡查询: ${coach_no} 查到10分钟内打卡 ${checkTimeStr}`);
      
      // 写入数据库
      if (clock_type === 'in') {
        // 先检查是否有当天记录
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
    
    // 4. 未找到10分钟内的记录 → 启动后台轮询
    dingtalkService.dingtalkLog.write(`钉钉打卡查询: ${coach_no} 10分钟内无记录，启动轮询`);
    return await startPolling(coach_no, clock_type, lejuan_id, coach.dingtalk_user_id, timeout_seconds, res);
    
  } catch (err) {
    dingtalkService.dingtalkLog.write(`钉钉打卡查询异常: ${err.message}`);
    res.status(500).json({ success: false, error: '查询失败' });
  }
});

/**
 * GET /api/dingtalk-attendance/status
 * 查询轮询状态（前端沙漏弹框轮询调用）
 */
router.get('/status', auth.required, requireBackendPermission(['coachManagement'], { coachSelfOnly: true }), async (req, res) => {
  try {
    const { coach_no, clock_type, lejuan_id } = req.query;
    const pollKey = `${coach_no}_${clock_type}_${lejuan_id || ''}`;
    
    const status = pollStatusCache.get(pollKey);
    
    // ★ 优先检查数据库是否有钉钉推送数据
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
      // 数据库已有推送数据 → 更新缓存并返回 found
      if (status) {
        status.status = 'found';
        status.dingtalk_time = dingtalkTime;
        pollStatusCache.set(pollKey, status);
      }
      dingtalkService.dingtalkLog.write(`轮询查询: ${coach_no} 数据库已有推送 ${dingtalkTime}`);
      return res.json({
        success: true,
        data: { status: 'found', dingtalk_time: dingtalkTime }
      });
    }
    
    if (!status) {
      return res.json({ success: true, data: { status: 'unknown' } });
    }
    
    res.json({ success: true, data: status });
    
  } catch (err) {
    res.status(500).json({ success: false, error: '查询失败' });
  }
});

/**
 * 启动后台轮询任务
 */
async function startPolling(coach_no, clock_type, lejuan_id, dingtalk_user_id, timeout_seconds, res) {
  const pollKey = `${coach_no}_${clock_type}_${lejuan_id || ''}`;
  
  // 检查是否已有轮询任务
  if (pollStatusCache.has(pollKey)) {
    const existingStatus = pollStatusCache.get(pollKey);
    // 如果已有轮询且状态是 pending，直接返回
    if (existingStatus.status === 'pending') {
      return res.json({
        success: true,
        data: { status: 'pending', message: '正在获取钉钉打卡数据...' }
      });
    }
  }
  
  // 创建轮询状态
  pollStatusCache.set(pollKey, {
    status: 'pending',
    startTime: Date.now(),
    timeoutSeconds: timeout_seconds,
    coach_no,
    clock_type,
    lejuan_id,
    dingtalk_user_id
  });
  
  // 启动后台轮询任务（非阻塞）
  startBackgroundPolling(pollKey);
  
  return res.json({
    success: true,
    data: { status: 'pending', message: '正在获取钉钉打卡数据...' }
  });
}

/**
 * 后台轮询任务（每10秒查询一次）
 */
function startBackgroundPolling(pollKey) {
  const status = pollStatusCache.get(pollKey);
  if (!status) return;
  
  const interval = setInterval(async () => {
    try {
      const elapsed = (Date.now() - status.startTime) / 1000;
      
      // 检查超时
      if (elapsed >= status.timeoutSeconds) {
        status.status = 'timeout';
        status.message = '5分钟超时，未获取到钉钉打卡时间';
        pollStatusCache.set(pollKey, status);
        clearInterval(interval);
        dingtalkService.dingtalkLog.write(`轮询超时: ${status.coach_no}`);
        return;
      }
      
      // 查询钉钉打卡记录
      const todayStr = TimeUtil.todayStr();
      const yesterdayStr = TimeUtil.offsetDateStr(-1);
      const records = await dingtalkService.getAttendanceList(
        status.dingtalk_user_id,
        yesterdayStr,
        todayStr
      );
      
      if (!records || records.length === 0) {
        // 继续轮询
        return;
      }
      
      // 筛选轮询开始后5分钟内的打卡记录（避免获取太早的记录）
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      
      const recentRecords = records.filter(r => {
        const checkTime = r.userCheckTime || r.checkTime;
        return checkTime && checkTime >= fiveMinutesAgo;
      });
      
      if (recentRecords.length > 0) {
        // 找到打卡记录
        const lastRecord = recentRecords[recentRecords.length - 1];
        const checkTime = lastRecord.userCheckTime || lastRecord.checkTime;
        const checkTimeStr = TimeUtil.formatTimestamp(checkTime);
        
        dingtalkService.dingtalkLog.write(`轮询成功: ${status.coach_no} ${checkTimeStr}`);
        
        // 写入数据库
        if (status.clock_type === 'in') {
          const existingRecord = await get(
            'SELECT id FROM attendance_records WHERE coach_no = ? AND date = ?',
            [status.coach_no, todayStr]
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
              [todayStr, status.coach_no, checkTimeStr, TimeUtil.nowDB(), TimeUtil.nowDB()]
            );
          }
        } else if (status.clock_type === 'return') {
          await enqueueRun(
            'UPDATE lejuan_records SET dingtalk_return_time = ?, updated_at = ? WHERE id = ?',
            [checkTimeStr, TimeUtil.nowDB(), status.lejuan_id]
          );
        }
        
        status.status = 'found';
        status.dingtalk_time = checkTimeStr;
        pollStatusCache.set(pollKey, status);
        clearInterval(interval);
      }
      
    } catch (err) {
      dingtalkService.dingtalkLog.write(`轮询异常: ${err.message}`);
    }
  }, 10000); // 每10秒查询一次
  
  // 5分钟后自动清理缓存
  setTimeout(() => {
    pollStatusCache.delete(pollKey);
    clearInterval(interval);
  }, status.timeoutSeconds * 1000 + 1000);
}

module.exports = router;