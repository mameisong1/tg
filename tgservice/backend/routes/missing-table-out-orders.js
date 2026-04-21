/**
 * 下桌单缺失统计 API
 * 路径：/api/missing-table-out-orders
 */
const express = require('express');
const router = express.Router();
const { all, get } = require('../db');
const { requireBackendPermission } = require('../middleware/permission');
const auth = require('../middleware/auth');

// ========== 周期计算 ==========
const VALID_PERIODS = ['yesterday', 'beforeYesterday', 'thisMonth', 'lastMonth'];
const PERIOD_LABELS = {
  yesterday: '昨天',
  beforeYesterday: '前天',
  thisMonth: '本月',
  lastMonth: '上月'
};

function getDateRange(period) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  let startDate, endDate;
  switch (period) {
    case 'yesterday': {
      const dt = new Date(now); dt.setDate(d - 1);
      startDate = endDate = formatDate(dt); break;
    }
    case 'beforeYesterday': {
      const dt = new Date(now); dt.setDate(d - 2);
      startDate = endDate = formatDate(dt); break;
    }
    case 'thisMonth': {
      startDate = formatDate(new Date(y, m, 1));
      endDate = formatDate(now); break;
    }
    case 'lastMonth': {
      startDate = formatDate(new Date(y, m - 1, 1));
      endDate = formatDate(new Date(y, m, 0)); break;
    }
  }
  return { date_start: startDate, date_end: endDate };
}

function formatDate(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// ========== 核心 SQL ==========

// 统计 SQL：按教练聚合缺失数量（不返回明细）
// 修复：排除有取消单的上桌单，不算漏单
const MISSING_STATS_SQL = `
  SELECT 
    t_in.coach_no,
    c.employee_id,
    t_in.stage_name,
    COUNT(*) AS missing_count
  FROM table_action_orders t_in
  LEFT JOIN coaches c ON t_in.coach_no = c.coach_no
  WHERE t_in.order_type = '上桌单'
    AND DATE(t_in.created_at) >= ?
    AND DATE(t_in.created_at) <= ?
    AND NOT EXISTS (
      SELECT 1 FROM table_action_orders t_out
      WHERE t_out.order_type = '下桌单'
        AND t_out.coach_no = t_in.coach_no
        AND t_out.table_no = t_in.table_no
        AND t_out.stage_name = t_in.stage_name
        AND t_out.created_at > t_in.created_at
        AND t_out.created_at <= datetime(t_in.created_at, '+15 hours')
    )
    AND NOT EXISTS (
      SELECT 1 FROM table_action_orders t_cancel
      WHERE t_cancel.order_type = '取消单'
        AND t_cancel.coach_no = t_in.coach_no
        AND t_cancel.table_no = t_in.table_no
        AND t_cancel.stage_name = t_in.stage_name
        AND t_cancel.created_at > t_in.created_at
        AND t_cancel.created_at <= datetime(t_in.created_at, '+15 hours')
    )
  GROUP BY t_in.coach_no
  ORDER BY missing_count DESC
`;

// 明细 SQL：按教练编号查询缺失明细（用户点击时才调用）
// 修复：排除有取消单的上桌单，不算漏单
const MISSING_DETAIL_SQL = `
  SELECT 
    t_in.id,
    t_in.table_no,
    t_in.action_category,
    DATE(t_in.created_at) AS table_date,
    TIME(t_in.created_at) AS table_time,
    t_in.created_at
  FROM table_action_orders t_in
  WHERE t_in.order_type = '上桌单'
    AND DATE(t_in.created_at) >= ?
    AND DATE(t_in.created_at) <= ?
    AND t_in.coach_no = ?
    AND NOT EXISTS (
      SELECT 1 FROM table_action_orders t_out
      WHERE t_out.order_type = '下桌单'
        AND t_out.coach_no = t_in.coach_no
        AND t_out.table_no = t_in.table_no
        AND t_out.stage_name = t_in.stage_name
        AND t_out.created_at > t_in.created_at
        AND t_out.created_at <= datetime(t_in.created_at, '+15 hours')
    )
    AND NOT EXISTS (
      SELECT 1 FROM table_action_orders t_cancel
      WHERE t_cancel.order_type = '取消单'
        AND t_cancel.coach_no = t_in.coach_no
        AND t_cancel.table_no = t_in.table_no
        AND t_cancel.stage_name = t_in.stage_name
        AND t_cancel.created_at > t_in.created_at
        AND t_cancel.created_at <= datetime(t_in.created_at, '+15 hours')
    )
`;

// ========== GET /api/missing-table-out-orders/stats ==========
// 只返回聚合结果（工号+艺名+缺失数量），不返回明细
router.get('/stats', auth.required, requireBackendPermission(['missingTableOutStats']), async (req, res) => {
  try {
    const { period } = req.query;
    if (!period || !VALID_PERIODS.includes(period)) {
      return res.status(400).json({
        success: false,
        error: `无效周期参数，应为: ${VALID_PERIODS.join(', ')}`
      });
    }

    const { date_start, date_end } = getDateRange(period);

    const list = await all(MISSING_STATS_SQL, [date_start, date_end]);

    const totalCoaches = list.length;
    const totalMissing = list.reduce((sum, c) => sum + c.missing_count, 0);

    res.json({
      success: true,
      data: {
        period,
        period_label: PERIOD_LABELS[period],
        date_start,
        date_end,
        list,
        total_coaches: totalCoaches,
        total_missing: totalMissing
      }
    });
  } catch (error) {
    console.error('下桌单缺失统计失败:', error);
    res.status(500).json({ success: false, error: '获取下桌单缺失统计失败' });
  }
});

// ========== GET /api/missing-table-out-orders/detail ==========
router.get('/detail', auth.required, requireBackendPermission(['missingTableOutStats']), async (req, res) => {
  try {
    const { period, coach_no } = req.query;

    if (!period || !VALID_PERIODS.includes(period)) {
      return res.status(400).json({
        success: false,
        error: `无效周期参数，应为: ${VALID_PERIODS.join(', ')}`
      });
    }
    if (!coach_no) {
      return res.status(400).json({
        success: false,
        error: '缺少 coach_no 参数'
      });
    }

    const { date_start, date_end } = getDateRange(period);

    const rows = await all(MISSING_DETAIL_SQL, [date_start, date_end, coach_no]);

    // 获取教练基本信息
    const coach = await get(
      'SELECT coach_no, employee_id, stage_name FROM coaches WHERE coach_no = ?',
      [coach_no]
    );

    const details = rows.map(row => ({
      id: row.id,
      table_no: row.table_no,
      table_date: row.table_date,
      table_time: row.table_time,
      action_category: row.action_category || '-',
      created_at: row.created_at
    }));

    res.json({
      success: true,
      data: {
        coach_no: parseInt(coach_no),
        employee_id: coach?.employee_id || '-',
        stage_name: coach?.stage_name || '未知',
        details
      }
    });
  } catch (error) {
    console.error('获取下桌单缺失明细失败:', error);
    res.status(500).json({ success: false, error: '获取明细失败' });
  }
});

module.exports = router;
