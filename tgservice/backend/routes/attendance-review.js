/**
 * 打卡审查 API
 * 路径: /api/attendance-review
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
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
        ar.employee_id,
        ar.stage_name,
        c.shift,
        ar.clock_in_time,
        ar.clock_out_time,
        ar.clock_in_photo,
        ar.date,
        ar.coach_no,
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

    const records = await db.all(sql, [targetDate, shift, shift]);

    // 处理返回数据
    const parsedRecords = records.map(r => {
      // 计算是否迟到
      let isLate = 0;
      if (r.clock_in_time && r.shift) {
        const clockInTime = r.clock_in_time;
        const overtimeHours = r.overtime_hours || 0;
        
        // 早班应上班时间: 14:00，如有早加班则顺延
        // 晚班应上班时间: 18:00，如有晚加班则顺延
        let expectedTime;
        if (r.shift === '早班') {
          // 早班应上班时间：14:00 - 早加班小时数
          const hour = 14 - overtimeHours;
          expectedTime = `${r.date} ${String(hour).padStart(2, '0')}:00:00`;
        } else if (r.shift === '晚班') {
          // 晚班应上班时间：18:00 - 晚加班小时数
          const hour = 18 - overtimeHours;
          expectedTime = `${r.date} ${String(hour).padStart(2, '0')}:00:00`;
        }
        
        if (expectedTime) {
          // 比较打卡时间和应上班时间
          isLate = clockInTime > expectedTime ? 1 : 0;
        }
      }
      
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
        employee_id: r.employee_id || '未知',
        stage_name: r.stage_name,
        shift: r.shift || '未知',
        clock_in_time: r.clock_in_time,
        clock_out_time: r.clock_out_time,
        clock_in_photo: photoList.length > 0 ? photoList[0] : null,
        overtime_hours: r.overtime_hours || 0,
        is_late: isLate,
        is_late_text: isLate === 1 ? '迟到' : '正常',
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

module.exports = router;