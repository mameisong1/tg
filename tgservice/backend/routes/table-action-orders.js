/**
 * 上下桌单 API
 * 路径：/api/table-action-orders
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const operationLogService = require('../services/operation-log');

/**
 * POST /api/table-action-orders
 * 提交上桌单/下桌单/取消单
 */
router.post('/', auth.required, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  const transaction = await db.beginTransaction();
  
  try {
    const { table_no, coach_no, order_type, action_category, stage_name } = req.body;
    
    // 验证必填字段
    if (!table_no || !coach_no || !order_type || !stage_name) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段'
      });
    }
    
    // 验证订单类型
    const validOrderTypes = ['上桌单', '下桌单', '取消单'];
    if (!validOrderTypes.includes(order_type)) {
      return res.status(400).json({
        success: false,
        error: '无效的订单类型'
      });
    }
    
    // 上桌单需要 action_category
    if (order_type === '上桌单' && !action_category) {
      return res.status(400).json({
        success: false,
        error: '上桌单需要指定 action_category（普通课/标签课）'
      });
    }
    
    // 验证 action_category
    if (action_category && !['普通课', '标签课'].includes(action_category)) {
      return res.status(400).json({
        success: false,
        error: '无效的 action_category'
      });
    }
    
    // 获取当前水牌状态
    const waterBoard = await db.get(`
      SELECT * FROM water_boards WHERE coach_no = ?
    `, [coach_no]);
    
    if (!waterBoard) {
      return res.status(404).json({
        success: false,
        error: '水牌不存在'
      });
    }
    
    const oldStatus = waterBoard.status;
    let newStatus = oldStatus;
    let newTableNo = waterBoard.table_no;
    
    // 根据订单类型处理状态转换
    if (order_type === '上桌单') {
      // 验证当前状态是否允许上桌
      if (!['早班空闲', '晚班空闲'].includes(waterBoard.status)) {
        return res.status(400).json({
          success: false,
          error: `当前状态（${waterBoard.status}）不允许上桌`
        });
      }
      
      // 设置新状态
      newStatus = waterBoard.status === '早班空闲' ? '早班上桌' : '晚班上桌';
      newTableNo = table_no;
      
    } else if (order_type === '下桌单' || order_type === '取消单') {
      // 验证当前状态是否允许下桌
      if (!['早班上桌', '晚班上桌'].includes(waterBoard.status)) {
        return res.status(400).json({
          success: false,
          error: `当前状态（${waterBoard.status}）不允许下桌`
        });
      }
      
      // 设置新状态
      newStatus = waterBoard.status === '早班上桌' ? '早班空闲' : '晚班空闲';
      newTableNo = null;
    }
    
    // 获取当前 updated_at 用于乐观锁
    const currentUpdatedAt = waterBoard.updated_at;
    
    // 创建上下桌单记录
    const result = await transaction.run(`
      INSERT INTO table_action_orders (
        table_no,
        coach_no,
        order_type,
        action_category,
        stage_name,
        status
      ) VALUES (?, ?, ?, ?, ?, '待处理')
    `, [table_no, coach_no, order_type, action_category || null, stage_name]);
    
    // 更新水牌状态（增加乐观锁检查 updated_at）
    const updateResult = await transaction.run(`
      UPDATE water_boards 
      SET status = ?, table_no = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE coach_no = ? AND updated_at = ?
    `, [newStatus, newTableNo, coach_no, currentUpdatedAt]);
    
    // 检查乐观锁：如果没有更新任何行，说明数据已被其他请求修改
    if (updateResult.changes === 0) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        error: '数据已被其他请求修改，请重试'
      });
    }
    
    // 记录操作日志
    const user = req.user;
    await operationLogService.create(transaction, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '上下桌单处理',
      target_type: 'table_action_order',
      target_id: result.lastID,
      old_value: JSON.stringify({ status: oldStatus, table_no: waterBoard.table_no }),
      new_value: JSON.stringify({ status: newStatus, table_no: newTableNo }),
      remark: `${order_type}: ${waterBoard.stage_name} ${oldStatus} → ${newStatus} ${newTableNo ? '(' + newTableNo + ')' : ''}`
    });
    
    await transaction.commit();
    
    res.json({
      success: true,
      data: {
        id: result.lastID,
        status: '待处理',
        water_board_status: newStatus
      }
    });
  } catch (error) {
    await transaction.rollback();
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
    
    let sql = 'SELECT * FROM table_action_orders WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (order_type) {
      sql += ' AND order_type = ?';
      params.push(order_type);
    }
    
    if (coach_no) {
      sql += ' AND coach_no = ?';
      params.push(coach_no);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ?';
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
  const transaction = await db.beginTransaction();
  
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // 验证状态枚举值
    const validStatuses = ['待处理', '已完成', '已取消'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: '无效的状态值'
      });
    }
    
    // 获取当前上下桌单
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
    
    const oldStatus = tableActionOrder.status;
    
    // 更新状态
    await transaction.run(`
      UPDATE table_action_orders 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [status, id]);
    
    // 记录操作日志
    const user = req.user;
    await operationLogService.create(transaction, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '上下桌单状态变更',
      target_type: 'table_action_order',
      target_id: id,
      old_value: JSON.stringify({ status: oldStatus }),
      new_value: JSON.stringify({ status }),
      remark: `更新上下桌单状态：${oldStatus} → ${status}`
    });
    
    await transaction.commit();
    
    res.json({
      success: true,
      data: {
        id: parseInt(id),
        status
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('更新上下桌单状态失败:', error);
    res.status(500).json({
      success: false,
      error: '更新上下桌单状态失败'
    });
  }
});

module.exports = router;
