/**
 * 服务单 API
 * 路径：/api/service-orders
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const operationLogService = require('../services/operation-log');

/**
 * POST /api/service-orders
 * 创建服务单
 */
router.post('/', auth.required, async (req, res) => {
  const transaction = await db.beginTransaction();
  
  try {
    const { table_no, requirement, requester_name, requester_type } = req.body;
    
    // 验证必填字段
    if (!table_no || !requirement || !requester_name) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段'
      });
    }
    
    // 创建服务单
    const result = await transaction.run(`
      INSERT INTO service_orders (
        table_no,
        requirement,
        requester_name,
        requester_type,
        status
      ) VALUES (?, ?, ?, ?, '待处理')
    `, [table_no, requirement, requester_name, requester_type || '助教']);
    
    // 记录操作日志
    const user = req.user;
    await operationLogService.create(transaction, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '创建服务单',
      target_type: 'service_order',
      target_id: result.lastID,
      old_value: null,
      new_value: JSON.stringify({
        table_no,
        requirement,
        requester_name,
        requester_type: requester_type || '助教',
        status: '待处理'
      }),
      remark: `创建服务单：${table_no} - ${requirement}`
    });
    
    await transaction.commit();
    
    res.json({
      success: true,
      data: {
        id: result.lastID,
        status: '待处理'
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('创建服务单失败:', error);
    res.status(500).json({
      success: false,
      error: '创建服务单失败'
    });
  }
});

/**
 * GET /api/service-orders
 * 获取服务单列表
 */
router.get('/', auth.required, async (req, res) => {
  try {
    const { status, table_no, limit = 50 } = req.query;
    
    let sql = 'SELECT * FROM service_orders WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (table_no) {
      sql += ' AND table_no = ?';
      params.push(table_no);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const serviceOrders = await db.all(sql, params);
    
    res.json({
      success: true,
      data: serviceOrders
    });
  } catch (error) {
    console.error('获取服务单列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取服务单列表失败'
    });
  }
});

/**
 * GET /api/service-orders/:id
 * 获取单个服务单
 */
router.get('/:id', auth.required, async (req, res) => {
  try {
    const { id } = req.params;
    
    const serviceOrder = await db.get(
      'SELECT * FROM service_orders WHERE id = ?',
      [id]
    );
    
    if (!serviceOrder) {
      return res.status(404).json({
        success: false,
        error: '服务单不存在'
      });
    }
    
    res.json({
      success: true,
      data: serviceOrder
    });
  } catch (error) {
    console.error('获取服务单失败:', error);
    res.status(500).json({
      success: false,
      error: '获取服务单失败'
    });
  }
});

/**
 * PUT /api/service-orders/:id/status
 * 更新服务单状态
 */
router.put('/:id/status', auth.required, async (req, res) => {
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
    
    // 获取当前服务单
    const serviceOrder = await db.get(
      'SELECT * FROM service_orders WHERE id = ?',
      [id]
    );
    
    if (!serviceOrder) {
      return res.status(404).json({
        success: false,
        error: '服务单不存在'
      });
    }
    
    const oldStatus = serviceOrder.status;
    
    // 更新状态
    await transaction.run(`
      UPDATE service_orders 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [status, id]);
    
    // 记录操作日志
    const user = req.user;
    await operationLogService.create(transaction, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '服务单状态变更',
      target_type: 'service_order',
      target_id: id,
      old_value: JSON.stringify({ status: oldStatus }),
      new_value: JSON.stringify({ status }),
      remark: `更新服务单状态：${oldStatus} → ${status}`
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
    console.error('更新服务单状态失败:', error);
    res.status(500).json({
      success: false,
      error: '更新服务单状态失败'
    });
  }
});

module.exports = router;
