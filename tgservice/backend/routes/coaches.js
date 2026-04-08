/**
 * 助教管理 API
 * 路径：/api/coaches
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const operationLogService = require('../services/operation-log');

/**
 * POST /api/coaches/:coach_no/clock-in
 * 助教上班
 */
router.post('/:coach_no/clock-in', auth.required, async (req, res) => {
  const transaction = await db.beginTransaction();
  
  try {
    const { coach_no } = req.params;
    
    // 获取助教信息（包括班次）
    const coach = await db.get(`
      SELECT coach_no, stage_name, shift FROM coaches WHERE coach_no = ?
    `, [coach_no]);
    
    if (!coach) {
      return res.status(404).json({
        success: false,
        error: '助教不存在'
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
    
    // 根据班次和当前状态确定新状态
    let newStatus;
    if (['早加班', '休息', '公休', '请假', '乐捐', '下班'].includes(waterBoard.status)) {
      // 从非在班状态进入在班状态，根据班次决定
      newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
    } else if (waterBoard.status === '早班空闲' || waterBoard.status === '晚班空闲') {
      // 已在班状态，返回 400 错误
      return res.status(400).json({
        error: '助教已在班状态，无需重复上班'
      });
    } else {
      // 其他状态（如早班上桌等），根据班次决定
      newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
    }
    
    // 更新水牌状态
    await transaction.run(`
      UPDATE water_boards 
      SET status = ?, table_no = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE coach_no = ?
    `, [newStatus, coach_no]);
    
    // 记录操作日志
    const user = req.user;
    await operationLogService.create(transaction, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '水牌状态变更',
      target_type: 'water_board',
      target_id: waterBoard.id,
      old_value: JSON.stringify({ status: oldStatus, table_no: waterBoard.table_no }),
      new_value: JSON.stringify({ status: newStatus, table_no: null }),
      remark: `上班：${oldStatus} → ${newStatus}`
    });
    
    await transaction.commit();
    
    res.json({
      success: true,
      data: {
        coach_no,
        stage_name: coach.stage_name,
        status: newStatus
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('上班失败:', error);
    res.status(500).json({
      success: false,
      error: '上班失败'
    });
  }
});

/**
 * POST /api/coaches/:coach_no/clock-out
 * 助教下班
 */
router.post('/:coach_no/clock-out', auth.required, async (req, res) => {
  const transaction = await db.beginTransaction();
  
  try {
    const { coach_no } = req.params;
    
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
    
    // 检查是否允许下班
    const canClockOut = [
      '早班空闲', '晚班空闲',
      '早班上桌', '晚班上桌',
      '早加班', '晚加班'
    ].includes(waterBoard.status);
    
    if (!canClockOut) {
      return res.status(400).json({
        success: false,
        error: `当前状态（${waterBoard.status}）不允许下班`
      });
    }
    
    const newStatus = '下班';
    
    // 更新水牌状态
    await transaction.run(`
      UPDATE water_boards 
      SET status = ?, table_no = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE coach_no = ?
    `, [newStatus, coach_no]);
    
    // 记录操作日志
    const user = req.user;
    await operationLogService.create(transaction, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '水牌状态变更',
      target_type: 'water_board',
      target_id: waterBoard.id,
      old_value: JSON.stringify({ status: oldStatus, table_no: waterBoard.table_no }),
      new_value: JSON.stringify({ status: newStatus, table_no: null }),
      remark: `下班：${oldStatus} → ${newStatus}`
    });
    
    await transaction.commit();
    
    res.json({
      success: true,
      data: {
        coach_no,
        status: newStatus
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('下班失败:', error);
    res.status(500).json({
      success: false,
      error: '下班失败'
    });
  }
});

/**
 * PUT /api/coaches/batch-shift
 * 批量修改班次
 */
router.put('/batch-shift', auth.required, async (req, res) => {
  const transaction = await db.beginTransaction();
  
  try {
    const { coach_no_list, shift } = req.body;
    
    // 验证班次枚举值
    if (!['早班', '晚班'].includes(shift)) {
      return res.status(400).json({
        success: false,
        error: '无效的班次值'
      });
    }
    
    if (!Array.isArray(coach_no_list) || coach_no_list.length === 0) {
      return res.status(400).json({
        success: false,
        error: '助教列表不能为空'
      });
    }
    
    // 批量更新班次
    const placeholders = coach_no_list.map(() => '?').join(',');
    await transaction.run(`
      UPDATE coaches SET shift = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE coach_no IN (${placeholders})
    `, [shift, ...coach_no_list]);
    
    // 记录操作日志
    const user = req.user;
    await operationLogService.create(transaction, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '批量修改班次',
      target_type: 'coaches',
      old_value: JSON.stringify({ coach_no_list, shift: '原班次' }),
      new_value: JSON.stringify({ coach_no_list, shift }),
      remark: `批量修改${coach_no_list.length}名助教班次为${shift}`
    });
    
    await transaction.commit();
    
    res.json({
      success: true,
      data: {
        updated_count: coach_no_list.length
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('批量修改班次失败:', error);
    res.status(500).json({
      success: false,
      error: '批量修改班次失败'
    });
  }
});

module.exports = router;
