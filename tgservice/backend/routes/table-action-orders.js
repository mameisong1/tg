/**
 * 上下桌单 API
 * 路径：/api/table-action-orders
 * 
 * 2026-04-15: 支持多桌上桌功能
 * table_no 存逗号分隔字符串 "A1,A3,B2"
 * 上桌：追加到列表；下桌：从列表移除指定台桌号
 * 列表为空 → 状态变空闲
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { runInTransaction, parseTables, joinTables } = require('../db');
const TimeUtil = require('../utils/time');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const operationLogService = require('../services/operation-log');

/**
 * POST /api/table-action-orders
 * 提交上桌单/下桌单/取消单
 */
router.post('/', auth.required, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    const result = await runInTransaction(async (tx) => {
    const { table_no, coach_no, order_type, action_category, stage_name } = req.body;
    
    if (!table_no || !coach_no || !order_type || !stage_name) {
      throw { status: 400, error: '缺少必填字段' };
    }
    
    const validOrderTypes = ['上桌单', '下桌单', '取消单'];
    if (!validOrderTypes.includes(order_type)) {
      throw { status: 400, error: '无效的订单类型' };
    }
    
    if (order_type === '上桌单' && !action_category) {
      throw { status: 400, error: '上桌单需要指定 action_category（普通课/标签课）' };
    }
    
    if (action_category && !['普通课', '标签课'].includes(action_category)) {
      throw { status: 400, error: '无效的 action_category' };
    }
    
    const waterBoard = await db.get(`
      SELECT * FROM water_boards WHERE coach_no = ?
    `, [coach_no]);
    
    if (!waterBoard) {
      throw { status: 404, error: '水牌不存在' };
    }
    
    const oldStatus = waterBoard.status;
    let newStatus = oldStatus;
    let newTableNo = waterBoard.table_no;
    
    if (order_type === '上桌单') {
      // 支持重复上桌：空闲或上桌状态都允许，但不能重复上已有台桌
      const currentTables = parseTables(waterBoard.table_no);
      
      if (currentTables.includes(table_no)) {
        throw { status: 400, error: `已在台桌 ${table_no} 上，不能重复上桌` };
      }
      
      currentTables.push(table_no);
      newTableNo = joinTables(currentTables);
      
      if (['早班空闲', '晚班空闲'].includes(waterBoard.status)) {
        newStatus = waterBoard.status === '早班空闲' ? '早班上桌' : '晚班上桌';
      }
    } else if (order_type === '下桌单' || order_type === '取消单') {
      if (!['早班上桌', '晚班上桌'].includes(waterBoard.status)) {
        throw { status: 400, error: `当前状态（${waterBoard.status}）不允许下桌` };
      }
      
      const currentTables = parseTables(waterBoard.table_no);
      
      const idx = currentTables.indexOf(table_no);
      if (idx === -1) {
        throw { status: 400, error: `当前不在台桌 ${table_no} 上` };
      }
      currentTables.splice(idx, 1);
      newTableNo = joinTables(currentTables);
      
      if (currentTables.length === 0) {
        newStatus = waterBoard.status === '早班上桌' ? '早班空闲' : '晚班空闲';
      }
    }
    
    const currentUpdatedAt = waterBoard.updated_at;
    
    const insertResult = await tx.run(`
      INSERT INTO table_action_orders (
        table_no,
        coach_no,
        order_type,
        action_category,
        stage_name,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, '待处理', ?, ?)
    `, [table_no, coach_no, order_type, action_category || null, stage_name, TimeUtil.nowDB(), TimeUtil.nowDB()]);
    
    const updateResult = await tx.run(`
      UPDATE water_boards 
      SET status = ?, table_no = ?, updated_at = ? 
      WHERE coach_no = ? AND updated_at = ?
    `, [newStatus, newTableNo, TimeUtil.nowDB(), coach_no, currentUpdatedAt]);
    
    if (updateResult.changes === 0) {
      throw { status: 409, error: '数据已被其他请求修改，请重试' };
    }
    
    const user = req.user;
    await operationLogService.create(tx, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '上下桌单处理',
      target_type: 'table_action_order',
      target_id: insertResult.lastID,
      old_value: JSON.stringify({ status: oldStatus, table_no: waterBoard.table_no }),
      new_value: JSON.stringify({ status: newStatus, table_no: newTableNo }),
      remark: `${order_type}: ${waterBoard.stage_name} ${oldStatus} → ${newStatus} ${newTableNo ? '(' + newTableNo + ')' : ''}`
    });
    
    return { id: insertResult.lastID, status: '待处理', water_board_status: newStatus, water_board_table_no: newTableNo };
    });
    
    res.json({
      success: true,
      data: {
        id: result.id,
        status: result.status,
        water_board_status: result.water_board_status
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
    console.error('提交上下桌单失败:', error);
    res.status(500).json({
      success: false,
      error: '提交上下桌单失败'
    });
  }
});

/**
 * GET /api/table-action-orders/stats
 * 统计指定日期范围内的上桌单/下桌单/取消单数量
 */
router.get('/stats', auth.required, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    const { date_start, date_end } = req.query;
    
    if (!date_start || !date_end) {
      return res.status(400).json({ success: false, error: '缺少必填参数：date_start 和 date_end' });
    }
    
    // 验证日期格式 YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date_start) || !dateRegex.test(date_end)) {
      return res.status(400).json({ success: false, error: '日期格式错误，应为 YYYY-MM-DD' });
    }
    
    if (date_start > date_end) {
      return res.status(400).json({ success: false, error: 'date_start 不能晚于 date_end' });
    }
    
    const row = await db.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN order_type = '上桌单' THEN 1 ELSE 0 END), 0) as table_in_count,
        COALESCE(SUM(CASE WHEN order_type = '下桌单' THEN 1 ELSE 0 END), 0) as table_out_count,
        COALESCE(SUM(CASE WHEN order_type = '取消单' THEN 1 ELSE 0 END), 0) as cancel_count,
        COUNT(*) as total_count
      FROM table_action_orders
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
    `, [date_start, date_end]);
    
    res.json({
      success: true,
      data: {
        date_start,
        date_end,
        table_in_count: row.table_in_count,
        table_out_count: row.table_out_count,
        cancel_count: row.cancel_count,
        total_count: row.total_count
      }
    });
  } catch (error) {
    console.error('获取上下桌单统计失败:', error);
    res.status(500).json({
      success: false,
      error: '获取上下桌单统计失败'
    });
  }
});

/**
 * GET /api/table-action-orders
 * 获取上下桌单列表
 */
router.get('/', auth.required, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    const { status, order_type, coach_no, date, date_start, date_end, limit = 50 } = req.query;
    
    let sql = `SELECT t.*, c.employee_id FROM table_action_orders t LEFT JOIN coaches c ON t.coach_no = c.coach_no WHERE 1=1`;
    const params = [];
    
    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }
    
    if (order_type) {
      sql += ' AND t.order_type = ?';
      params.push(order_type);
    }
    
    if (coach_no) {
      sql += ' AND t.coach_no = ?';
      params.push(coach_no);
    }
    
    if (date) {
      sql += ' AND DATE(t.created_at) = ?';
      params.push(date);
    }
    if (date_start) {
      sql += ' AND DATE(t.created_at) >= ?';
      params.push(date_start);
    }
    if (date_end) {
      sql += ' AND DATE(t.created_at) <= ?';
      params.push(date_end);
    }
    
    sql += ' ORDER BY t.created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const tableActionOrders = await db.all(sql, params);
    
    res.json({
      success: true,
      data: tableActionOrders
    });
  } catch (error) {
    console.error('获取上下桌单列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取上下桌单列表失败'
    });
  }
});

/**
 * GET /api/table-action-orders/:id
 * 获取单个上下桌单
 */
router.get('/:id', auth.required, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const tableActionOrder = await db.get(
      'SELECT * FROM table_action_orders WHERE id = ?',
      [id]
    );
    
    if (!tableActionOrder) {
      return res.status(404).json({
        success: false,
        error: '上下桌单不存在'
      });
    }
    
    res.json({
      success: true,
      data: tableActionOrder
    });
  } catch (error) {
    console.error('获取上下桌单失败:', error);
    res.status(500).json({
      success: false,
      error: '获取上下桌单失败'
    });
  }
});

/**
 * PUT /api/table-action-orders/:id/status
 * 更新上下桌单状态
 */
router.put('/:id/status', auth.required, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    const result = await runInTransaction(async (tx) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['待处理', '已完成', '已取消'];
    if (status && !validStatuses.includes(status)) {
      throw { status: 400, error: '无效的状态值' };
    }
    
    const tableActionOrder = await db.get(
      'SELECT * FROM table_action_orders WHERE id = ?',
      [id]
    );
    
    if (!tableActionOrder) {
      throw { status: 404, error: '上下桌单不存在' };
    }
    
    const oldStatus = tableActionOrder.status;
    
    await tx.run(`
      UPDATE table_action_orders 
      SET status = ?, updated_at = ? 
      WHERE id = ?
    `, [status, TimeUtil.nowDB(), id]);
    
    const user = req.user;
    await operationLogService.create(tx, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '上下桌单状态变更',
      target_type: 'table_action_order',
      target_id: id,
      old_value: JSON.stringify({ status: oldStatus }),
      new_value: JSON.stringify({ status }),
      remark: `更新上下桌单状态：${oldStatus} → ${status}`
    });
    
    return { id: parseInt(id), status };
    });
    
    res.json({
      success: true,
      data: {
        id: result.id,
        status: result.status
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
    console.error('更新上下桌单状态失败:', error);
    res.status(500).json({
      success: false,
      error: '更新上下桌单状态失败'
    });
  }
});

module.exports = router;
