/**
 * 水牌管理 API
 * 路径：/api/water-boards
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const TimeUtil = require('../utils/time');
const operationLogService = require('../services/operation-log');

/**
 * GET /api/water-boards
 * 获取所有水牌状态
 */
router.get('/', auth.required, requireBackendPermission(['waterBoardManagement']), async (req, res) => {
  try {
    const { status, shift } = req.query;
    
    let sql = `
      SELECT wb.coach_no, wb.stage_name, wb.status, wb.table_no, wb.updated_at, wb.clock_in_time, c.shift, c.photos, c.employee_id
      FROM water_boards wb
      LEFT JOIN coaches c ON wb.coach_no = c.coach_no
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      sql += ' AND wb.status = ?';
      params.push(status);
    }
    
    if (shift) {
      sql += ' AND c.shift = ?';
      params.push(shift);
    }
    
    sql += ' ORDER BY wb.coach_no';
    
    const waterBoards = await db.all(sql, params);
    
    // 解析 photos 字段（从 JSON 字符串转为数组）
    const parsedData = waterBoards.map(item => ({
      ...item,
      photos: item.photos ? JSON.parse(item.photos) : []
    }));
    
    res.json({
      success: true,
      data: parsedData
    });
  } catch (error) {
    console.error('获取水牌列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取水牌列表失败'
    });
  }
});

/**
 * GET /api/water-boards/:coach_no
 * 获取单个助教水牌
 */
router.get('/:coach_no', auth.required, requireBackendPermission(['waterBoardManagement']), async (req, res) => {
  try {
    const { coach_no } = req.params;
    
    const waterBoard = await db.get(`
      SELECT wb.coach_no, wb.stage_name, wb.status, wb.table_no, wb.updated_at, wb.clock_in_time, c.shift, c.photos, c.employee_id
      FROM water_boards wb
      LEFT JOIN coaches c ON wb.coach_no = c.coach_no
      WHERE wb.coach_no = ?
    `, [coach_no]);
    
    if (!waterBoard) {
      return res.status(404).json({
        success: false,
        error: '水牌不存在'
      });
    }
    
    // 解析 photos 字段
    waterBoard.photos = waterBoard.photos ? JSON.parse(waterBoard.photos) : [];
    
    res.json({
      success: true,
      data: waterBoard
    });
  } catch (error) {
    console.error('获取水牌失败:', error);
    res.status(500).json({
      success: false,
      error: '获取水牌失败'
    });
  }
});

/**
 * PUT /api/water-boards/:coach_no/status
 * 更新水牌状态
 */
router.put('/:coach_no/status', auth.required, requireBackendPermission(['waterBoardManagement']), async (req, res) => {
  const transaction = await db.beginTransaction();
  
  try {
    const { coach_no } = req.params;
    const { status, table_no } = req.body;
    
    // 验证状态枚举值
    const validStatuses = [
      '早班上桌', '早班空闲', '晚班上桌', '晚班空闲',
      '早加班', '晚加班', '休息', '公休', '请假', '乐捐', '下班'
    ];
    
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: '无效的状态值'
      });
    }
    
    // 获取当前水牌状态
    const currentWaterBoard = await db.get(`
      SELECT * FROM water_boards WHERE coach_no = ?
    `, [coach_no]);
    
    if (!currentWaterBoard) {
      return res.status(404).json({
        success: false,
        error: '水牌不存在'
      });
    }
    
    const oldValue = {
      status: currentWaterBoard.status,
      table_no: currentWaterBoard.table_no
    };
    
    // 更新水牌状态
    const updateFields = [];
    const updateParams = [];
    
    if (status) {
      updateFields.push('status = ?');
      updateParams.push(status);
    }
    
    if (table_no !== undefined) {
      updateFields.push('table_no = ?');
      updateParams.push(table_no);
    }
    
    // 状态变为工作状态（非下班）时，写入 clock_in_time
    const workStatuses = ['早班空闲', '晚班空闲', '早班上桌', '晚班上桌', '早加班', '晚加班', '乐捐'];
    const offStatuses = ['下班', '休息', '公休', '请假'];
    if (status && workStatuses.includes(status)) {
      // 从下班状态变为工作状态，写入上班时间
      const wasOff = offStatuses.includes(currentWaterBoard.status) || !currentWaterBoard.clock_in_time;
      if (wasOff) {
        updateFields.push('clock_in_time = ?');
        updateParams.push(TimeUtil.nowDB());
      }
    }
    // 状态变为下班时，清空 clock_in_time
    if (status === '下班') {
      updateFields.push('clock_in_time = NULL');
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateParams.push(coach_no);
    
    await transaction.run(`
      UPDATE water_boards SET ${updateFields.join(', ')} WHERE coach_no = ?
    `, updateParams);
    
    const newValue = {
      status: status || currentWaterBoard.status,
      table_no: table_no !== undefined ? table_no : currentWaterBoard.table_no
    };
    
    // 记录操作日志
    const user = req.user;
    await operationLogService.create(transaction, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '水牌状态变更',
      target_type: 'water_board',
      target_id: currentWaterBoard.id,
      old_value: JSON.stringify(oldValue),
      new_value: JSON.stringify(newValue),
      remark: `手动更新水牌状态：${oldValue.status} → ${newValue.status}`
    });
    
    await transaction.commit();
    
    res.json({
      success: true,
      data: {
        coach_no,
        status: newValue.status,
        table_no: newValue.table_no
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('更新水牌状态失败:', error);
    res.status(500).json({
      success: false,
      error: '更新水牌状态失败'
    });
  }
});

module.exports = router;
