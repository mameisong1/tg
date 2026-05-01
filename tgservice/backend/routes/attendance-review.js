/**
 * 打卡审查 API
 * 路径: /api/attendance-review
 */

const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const TimeUtil = require('../utils/time');
const errorLogger = require('../utils/error-logger');
const redisCache = require('../utils/redis-cache');

/**
 * GET /api/attendance-review
 * 获取打卡审查列表
 *
 * 【兼容两种参数格式】
 * - date 参数（旧）：按日期查询，如 date=2026-04-25
 * - period 参数（新）：按时间段查询，如 period=today 或 period=yesterday
 *
 * 今日/昨日定义:
 * - 今日 = 今天12:00:00 到 明天11:59:59
 * - 昨日 = 昨天12:00:00 到 今天11:59:59
 *
 * Query params:
 * - date: 日期(YYYY-MM-DD),旧参数格式
 * - period: 时间段(today/yesterday),新参数格式
 * - shift: 班次(早班/晚班),可选
 */
router.get('/', auth.required, requireBackendPermission(['店长', '助教管理', '管理员']), async (req, res) => {
  try {
    const { date, period, shift } = req.query;

    // 计算时间范围
    const todayStr = TimeUtil.todayStr();
    const tomorrowStr = TimeUtil.offsetDateStr(1);
    const yesterdayStr = TimeUtil.offsetDateStr(-1);

    let timeStart, timeEnd, targetDate;

    // 【兼容】优先使用 period 参数（新格式），如果没有则用 date 参数（旧格式）
    if (period) {
      // 新格式：period=today 或 period=yesterday
      timeStart = period === 'today' 
        ? `${todayStr} 12:00:00` 
        : `${yesterdayStr} 12:00:00`;
      timeEnd = period === 'today' 
        ? `${tomorrowStr} 11:59:59` 
        : `${todayStr} 11:59:59`;
      targetDate = period === 'today' ? todayStr : yesterdayStr;
    } else if (date) {
      // 旧格式：date=2026-04-25
      // 将日期转换为时间范围（兼容前端传递 date 参数）
      // date='2026-04-25' → timeStart = 2026-04-25 12:00:00, timeEnd = 2026-04-26 11:59:59
      const nextDate = new Date(date + 'T00:00:00');
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
      timeStart = `${date} 12:00:00`;  // 指定日期12点开始
      timeEnd = `${nextDateStr} 11:59:59`;  // 下一天11:59结束
      targetDate = date;
    } else {
      // 默认：今日
      timeStart = `${todayStr} 12:00:00`;
      timeEnd = `${tomorrowStr} 11:59:59`;
      targetDate = todayStr;
    }

    // 查询指定时间范围和班次的打卡记录
    // 使用 COALESCE(clock_in_time, dingtalk_in_time) 作为时间判断依据
    const sql = `
      SELECT
        ar.id,
        ar.employee_id,
        ar.stage_name,
        c.shift,
        ar.clock_in_time,
        ar.clock_out_time,
        ar.clock_in_photo,
        ar.date,
        ar.coach_no,
        ar.is_late,
        ar.is_reviewed,
        ar.dingtalk_in_time,
        ar.dingtalk_out_time,
        c.phone,
        -- 查询对应日期的加班申请小时数
        (
          SELECT COALESCE(
            CAST(JSON_EXTRACT(extra_data, '$.hours') AS INTEGER), 0
          ) FROM applications
          WHERE applicant_phone = c.phone
            AND (application_type = '早加班申请' OR application_type = '晚加班申请')
            AND status = 1
            AND date(created_at) = ar.date
          LIMIT 1
        ) as overtime_hours,
        -- QA-20260501-18: 查询上班打卡时间之前的乐捐时长
        (
          SELECT COALESCE(SUM(lejuan_hours), 0)
          FROM lejuan_records
          WHERE coach_no = ar.coach_no
            AND date(scheduled_start_time) = ar.date
            AND scheduled_start_time <= COALESCE(ar.clock_in_time, ar.dingtalk_in_time)
            AND lejuan_status IN ('pending', 'active', 'completed')
        ) as lejuan_hours
      FROM attendance_records ar
      LEFT JOIN coaches c ON ar.coach_no = c.coach_no
      WHERE COALESCE(ar.clock_in_time, ar.dingtalk_in_time) >= ?
        AND COALESCE(ar.clock_in_time, ar.dingtalk_in_time) <= ?
        AND (? IS NULL OR c.shift = ?)
      ORDER BY COALESCE(ar.clock_in_time, ar.dingtalk_in_time) DESC
    `;

    const records = await all(sql, [timeStart, timeEnd, shift, shift]);

    // 处理返回数据
    const parsedRecords = records.map(r => {
      // 解析打卡照片
      let photoList = [];
      if (r.clock_in_photo) {
        try {
          const parsed = JSON.parse(r.clock_in_photo);
          photoList = Array.isArray(parsed) ? parsed : [r.clock_in_photo];
        } catch (e) {
          photoList = [r.clock_in_photo];
        }
      }
      
      return {
        id: r.id,
        employee_id: r.employee_id || '未知',
        stage_name: r.stage_name,
        shift: r.shift || '未知',
        clock_in_time: r.clock_in_time,
        clock_out_time: r.clock_out_time,
        dingtalk_in_time: r.dingtalk_in_time,
        dingtalk_out_time: r.dingtalk_out_time,
        clock_in_photo: photoList.length > 0 ? photoList[0] : null,
        overtime_hours: r.overtime_hours || 0,
        lejuan_hours: r.lejuan_hours || 0,  // QA-20260501-18: 乐捐时长
        is_late: r.is_late || 0,
        is_late_text: (r.is_late === 1) ? '迟到' : '正常',
        is_reviewed: r.is_reviewed || 0,
        date: r.date
      };
    });

    res.json({
      success: true,
      data: parsedRecords
    });
  } catch (error) {
    console.error('获取打卡审查列表失败:', error);
    errorLogger.logApiRejection(req, error);
    res.status(500).json({
      success: false,
      error: '获取打卡审查列表失败'
    });
  }
});

/**
 * GET /api/attendance-review/pending-count
 * 获取今日迟到且未审查的人数（用于角标，带 Redis 缓存）
 *
 * 【修改4】今日定义：今天12:00:00 到 明天11:59:59
 */
router.get('/pending-count', auth.required, requireBackendPermission(['店长', '助教管理', '管理员']), async (req, res) => {
  try {
    const cacheKey = 'attendance_pending';
    
    // 先查 Redis 缓存（1分钟）
    const cached = await redisCache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: { count: cached } });
    }
    
    const todayStr = TimeUtil.todayStr();
    const tomorrowStr = TimeUtil.offsetDateStr(1);
    const timeStart = `${todayStr} 12:00:00`;
    const timeEnd = `${tomorrowStr} 11:59:59`;
    
    const result = await get(
      `SELECT COUNT(*) as cnt FROM attendance_records 
       WHERE COALESCE(clock_in_time, dingtalk_in_time) >= ? 
       AND COALESCE(clock_in_time, dingtalk_in_time) <= ? 
       AND is_late = 1 AND is_reviewed = 0`,
      [timeStart, timeEnd]
    );
    
    const count = result.cnt || 0;
    
    // 写入 Redis 缓存（1分钟 = 60秒）
    await redisCache.set(cacheKey, count, 60);
    
    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('获取打卡审查待审数量失败:', error);
    errorLogger.logApiRejection(req, error);
    res.status(500).json({ success: false, error: '获取打卡审查待审数量失败' });
  }
});

/**
 * PUT /api/attendance-review/:id/review
 * 标记单条打卡记录为已审查
 * 
 * 参数：
 * - id: attendance_records 表的主键 ID
 */
router.put('/:id/review', auth.required, requireBackendPermission(['店长', '助教管理', '管理员']), async (req, res) => {
  try {
    const { id } = req.params;
    const nowDB = TimeUtil.nowDB();

    const result = await run(
      'UPDATE attendance_records SET is_reviewed = 1, updated_at = ? WHERE id = ?',
      [nowDB, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '打卡记录不存在' });
    }

    res.json({ success: true, data: { id: parseInt(id) } });
  } catch (error) {
    console.error('标记审查完毕失败:', error);
    errorLogger.logApiRejection(req, error);
    res.status(500).json({ success: false, error: '标记审查完毕失败' });
  }
});

module.exports = router;
