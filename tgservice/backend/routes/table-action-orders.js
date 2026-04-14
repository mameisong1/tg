/**
 * 上下桌单 API
 * 路径：/api/table-action-orders
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { runInTransaction } = require('../db');
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
      if (!['早班空闲', '晚班空闲'].includes(waterBoard.status)) {
        throw { status: 400, error: `当前状态（${waterBoard.status}）不允许上桌` };
      }
      newStatus = waterBoard.status === '早班空闲' ? '早班上桌' : '晚班上桌';
      newTableNo = table_no;
    } else if (order_type === '下桌单' || order_type === '取消单') {
      if (!['早班上桌', '晚班上桌'].includes(waterBoard.status)) {
        throw { status: 400, error: `当前状态（${waterBoard.status}）不允许下桌` };
      }
      newStatus = waterBoard.status === '早班上桌' ? '早班空闲' : '晚班空闲';
      newTableNo = null;
    }
    
    const currentUpdatedAt = waterBoard.updated_at;
    
    const insertResult = await tx.run(`
      INSERT INTO table_action_orders (
        table_no,
        coach_no,
        order_type,
        action_category,
        stage_name,
        status
      ) VALUES (?, ?, ?, ?, ?, '待处理')
    `, [table_no, coach_no, order_type, action_category || null, stage_name]);
    
    const updateResult = await tx.run(`
      UPDATE water_boards 
      SET status = ?, table_no = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE coach_no = ? AND updated_at = ?
    `, [newStatus, newTableNo, coach_no, currentUpdatedAt]);
    
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
    
    return { id: insertResult.lastID, status: '待处理', water_board_status: newStatus };
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
 * GET /api/table-action-orders
 * 获取上下桌单列表
 */
router.get('/', auth.required, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    const { status, order_type, coach_no, limit = 50 } = req.query;
    
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
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [status, id]);
    
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
