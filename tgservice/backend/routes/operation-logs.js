/**
 * 操作日志 API
 * 路径：/api/operation-logs
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

/**
 * GET /api/operation-logs
 * 获取操作日志列表
 */
router.get('/', auth.required, async (req, res) => {
  try {
    const {
      operator_phone,
      operation_type,
      target_type,
      target_id,
      start_date,
      end_date,
      limit = 50
    } = req.query;
    
    let sql = 'SELECT * FROM operation_logs WHERE 1=1';
    const params = [];
    
    if (operator_phone) {
      sql += ' AND operator_phone = ?';
      params.push(operator_phone);
    }
    
    if (operation_type) {
      sql += ' AND operation_type = ?';
      params.push(operation_type);
    }
    
    if (target_type) {
      sql += ' AND target_type = ?';
      params.push(target_type);
    }
    
    if (target_id) {
      sql += ' AND target_id = ?';
      params.push(target_id);
    }
    
    if (start_date) {
      sql += ' AND created_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND created_at <= ?';
      params.push(end_date);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const operationLogs = await db.all(sql, params);
    
    res.json({
      success: true,
      data: operationLogs
    });
  } catch (error) {
    console.error('获取操作日志列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取操作日志列表失败'
    });
  }
});

/**
 * GET /api/operation-logs/:id
 * 获取单个操作日志
 */
router.get('/:id', auth.required, async (req, res) => {
  try {
    const { id } = req.params;
    
    const operationLog = await db.get(
      'SELECT * FROM operation_logs WHERE id = ?',
      [id]
    );
    
    if (!operationLog) {
      return res.status(404).json({
        success: false,
        error: '操作日志不存在'
      });
    }
    
    res.json({
      success: true,
      data: operationLog
    });
  } catch (error) {
    console.error('获取操作日志失败:', error);
    res.status(500).json({
      success: false,
      error: '获取操作日志失败'
    });
  }
});

module.exports = router;
