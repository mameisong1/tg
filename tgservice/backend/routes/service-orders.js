/**
 * 服务单 API
 * 路径：/api/service-orders
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const operationLogService = require('../services/operation-log');

/**
 * POST /api/service-orders
 * 创建服务单（助教和所有后台用户均可提交）
 */
router.post('/', auth.required, async (req, res) => {
  let transaction = null;
  try {
    const { table_no, requirement, requester_name, requester_type } = req.body;
    
    // 验证必填字段
    if (!table_no || !table_no.toString().trim()) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段：台桌号'
      });
    }
    if (!requirement || !requirement.toString().trim()) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段：需求内容不能为空'
      });
    }
    if (!requester_name || !requester_name.toString().trim()) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段：请求人姓名'
      });
    }
    
    // 直接执行操作，避免事务嵌套问题
    const result = await db.run(`
      INSERT INTO service_orders (
        table_no,
        requirement,
        requester_name,
        requester_type,
        status
      ) VALUES (?, ?, ?, ?, '待处理')
    `, [table_no, requirement, requester_name, requester_type || '助教']);
    
    // 记录操作日志（异步，不影响主流程）
    const user = req.user;
    try {
      await db.run(`
        INSERT INTO operation_logs (
          operator_phone, operator_name, operation_type, target_type, target_id, old_value, new_value, remark, created_at
        ) VALUES (?, ?, '创建服务单', 'service_order', ?, null, ?, ?, datetime('now', 'localtime'))
      `, [user.username, user.name, result.lastID, JSON.stringify({table_no, requirement, requester_name}), `创建服务单：${table_no} - ${requirement}`]);
    } catch (logErr) {
      console.error('记录操作日志失败:', logErr);
    }
    
    res.json({
      success: true,
      data: {
        id: result.lastID,
        status: '待处理'
      }
    });
  } catch (error) {
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
router.get('/', auth.required, requireBackendPermission(['serviceOrder']), async (req, res) => {
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
router.get('/:id', auth.required, requireBackendPermission(['serviceOrder']), async (req, res) => {
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
router.put('/:id/status', auth.required, requireBackendPermission(['serviceOrder']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // 验证状态枚举值
    const validStatuses = ['待处理', '已完成', '已取消'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: '无效的状态值，应为：待处理、已完成、已取消'
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
    await db.run(`
      UPDATE service_orders 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [status, id]);
    
    // 记录操作日志（异步，不影响主流程）
    const user = req.user;
    try {
      await db.run(`
        INSERT INTO operation_logs (
          operator_phone, operator_name, operation_type, target_type, target_id, old_value, new_value, remark, created_at
        ) VALUES (?, ?, '服务单状态变更', 'service_order', ?, ?, ?, ?, datetime('now', 'localtime'))
      `, [user.username, user.name, id, JSON.stringify({status: oldStatus}), JSON.stringify({status}), `更新服务单状态：${oldStatus} → ${status}`]);
    } catch (logErr) {
      console.error('记录操作日志失败:', logErr);
    }
    
    res.json({
      success: true,
      data: {
        id: parseInt(id),
        status
      }
    });
  } catch (error) {
    console.error('更新服务单状态失败:', error);
    res.status(500).json({
      success: false,
      error: '更新服务单状态失败'
    });
  }
});

module.exports = router;
