/**
 * 打卡审查 API
 * 路径: /api/attendance-review
 */

const express = require('express');
const router = express.Router();
const { get, run } = require('../db');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const TimeUtil = require('../utils/time');
const errorLogger = require('../utils/error-logger');

/**
 * GET /api/attendance-review
 * 获取打卡审查列表
 *
 * Query params:
 * - date: 日期(YYYY-MM-DD),默认今天
 * - shift: 班次(早班/晚班),可选
 */
router.get('/', auth.required, requireBackendPermission(['店长', '助教管理', '管理员']), async (req, res) => {
  try {
    const { date, shift } = req.query;

    // 使用请求日期或今天
    const targetDate = date || TimeUtil.todayStr();

    // 查询指定日期和班次的打卡记录
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
        c.phone,
        -- 查询当天加班申请的小时数
        (
          SELECT COALESCE(
            CAST(JSON_EXTRACT(extra_data, '$.hours') AS INTEGER), 0
          ) FROM applications
          WHERE applicant_phone = c.phone
            AND (application_type = '早加班申请' OR application_type = '晚加班申请')
            AND status = 1
            AND date(created_at) = ar.date
          LIMIT 1
        ) as overtime_hours
      FROM attendance_records ar
      LEFT JOIN coaches c ON ar.coach_no = c.coach_no
      WHERE ar.date = ?
        AND (? IS NULL OR c.shift = ?)
      ORDER BY ar.clock_in_time DESC
    `;

    const records = await get(sql, [targetDate, shift, shift]);

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
        clock_in_photo: photoList.length > 0 ? photoList[0] : null,
        overtime_hours: r.overtime_hours || 0,
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
 * 获取当天迟到且未审查的人数（用于角标）
 */
router.get('/pending-count', auth.required, requireBackendPermission(['店长', '助教管理', '管理员']), async (req, res) => {
  try {
    const todayStr = TimeUtil.todayStr();
    const result = await get(
      'SELECT COUNT(*) as cnt FROM attendance_records WHERE date = ? AND is_late = 1 AND is_reviewed = 0',
      [todayStr]
    );
    res.json({
      success: true,
      data: { count: result.cnt || 0 }
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
