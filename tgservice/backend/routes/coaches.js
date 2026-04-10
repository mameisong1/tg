/**
 * 助教管理 API
 * 路径：/api/coaches
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const operationLogService = require('../services/operation-log');

/**
 * POST /api/coaches/:coach_no/clock-in
 * 助教上班（助教只能打自己的卡）
 */
router.post('/:coach_no/clock-in', auth.required, requireBackendPermission(['coachManagement'], { coachSelfOnly: true }), async (req, res) => {
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
      // 其他状态需要检查是否为上桌状态
      if (waterBoard.status === '早班上桌' || waterBoard.status === '晚班上桌') {
        return res.status(400).json({ error: '上桌状态不能点上班' });
      }
      // 其他状态，根据班次决定
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
 * 助教下班（助教只能打自己的卡）
 */
router.post('/:coach_no/clock-out', auth.required, requireBackendPermission(['coachManagement'], { coachSelfOnly: true }), async (req, res) => {
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
    // 上桌、空闲、乐捐状态允许下班（这些是工作状态）
    // 加班、休息、公休、请假、下班是未上班状态，禁止下班
    const canClockOut = [
      '早班空闲', '晚班空闲',
      '早班上桌', '晚班上桌',
      '乐捐'
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
router.put('/batch-shift', auth.required, requireBackendPermission(['coachManagement']), async (req, res) => {
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
    
    // 水牌状态映射：根据班次切换映射水牌状态
    const statusMap = {
      '早班空闲': '晚班空闲',
      '晚班空闲': '早班空闲',
      '早班上桌': '晚班上桌',
      '晚班上桌': '早班上桌',
      '早加班': '晚加班',
      '晚加班': '早加班'
    };
    
    // 查询每个助教的原始班次和水牌状态
    const placeholders = coach_no_list.map(() => '?').join(',');
    const coaches = await transaction.all(`
      SELECT coach_no, stage_name, shift FROM coaches WHERE coach_no IN (${placeholders})
    `, coach_no_list);
    
    const waterBoards = await transaction.all(`
      SELECT coach_no, id, status, table_no FROM water_boards WHERE coach_no IN (${placeholders})
    `, coach_no_list);
    
    const waterBoardMap = {};
    waterBoards.forEach(wb => { waterBoardMap[wb.coach_no] = wb; });
    
    const coachMap = {};
    coaches.forEach(c => { coachMap[c.coach_no] = c; });
    
    // 记录每个助教的变更详情
    const changeDetails = [];
    
    // 批量更新班次
    await transaction.run(`
      UPDATE coaches SET shift = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE coach_no IN (${placeholders})
    `, [shift, ...coach_no_list]);
    
    // 联动更新水牌状态
    for (const coachNo of coach_no_list) {
      const coach = coachMap[coachNo];
      const waterBoard = waterBoardMap[coachNo];
      
      if (!coach) continue;
      
      const oldShift = coach.shift;
      let waterBoardStatusChanged = false;
      
      if (waterBoard && statusMap[waterBoard.status]) {
        const oldStatus = waterBoard.status;
        const newStatus = statusMap[oldStatus];
        
        await transaction.run(
          'UPDATE water_boards SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE coach_no = ?',
          [newStatus, coachNo]
        );
        
        waterBoardStatusChanged = true;
        
        // 记录水牌状态变更日志
        await operationLogService.create(transaction, {
          operator_phone: req.user.username,
          operator_name: req.user.name,
          operation_type: '水牌状态变更',
          target_type: 'water_board',
          target_id: waterBoard.id,
          old_value: JSON.stringify({ status: oldStatus, table_no: waterBoard.table_no }),
          new_value: JSON.stringify({ status: newStatus, table_no: waterBoard.table_no }),
          remark: `批量班次变更联动：${oldShift}→${shift}，水牌 ${oldStatus}→${newStatus}`
        });
      }
      
      changeDetails.push({
        coach_no: coachNo,
        stage_name: coach.stage_name,
        old_shift: oldShift,
        new_shift: shift,
        water_board_changed: waterBoardStatusChanged
      });
    }
    
    // 记录汇总操作日志（包含每个助教的详细变更）
    const user = req.user;
    await operationLogService.create(transaction, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '批量修改班次',
      target_type: 'coaches',
      old_value: JSON.stringify(changeDetails.map(d => ({ coach_no: d.coach_no, stage_name: d.stage_name, shift: d.old_shift, water_board_changed: d.water_board_changed }))),
      new_value: JSON.stringify({ shift, count: coach_no_list.length }),
      remark: `批量修改${coach_no_list.length}名助教班次为${shift}，详情：${changeDetails.map(d => `${d.stage_name}(${d.coach_no}): ${d.old_shift}→${d.shift}${d.water_board_changed ? ' [水牌已联动]' : ''}`).join('；')}`
    });
    
    await transaction.commit();
    
    res.json({
      success: true,
      data: {
        updated_count: coach_no_list.length,
        details: changeDetails
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

/**
 * PUT /api/coaches/v2/:coach_no/shift
 * 单个修改助教班次（第 3 轮修订新增）
 */
router.put('/:coach_no/shift', auth.required, requireBackendPermission(['coachManagement']), async (req, res) => {
  const transaction = await db.beginTransaction();
  
  try {
    const { coach_no } = req.params;
    const { shift } = req.body;
    
    // 验证班次枚举值
    if (!['早班', '晚班'].includes(shift)) {
      return res.status(400).json({
        success: false,
        error: '无效的班次值，应为早班或晚班'
      });
    }
    
    // 获取助教信息
    const coach = await transaction.get(
      'SELECT coach_no, stage_name, shift FROM coaches WHERE coach_no = ?',
      [coach_no]
    );
    
    if (!coach) {
      return res.status(404).json({
        success: false,
        error: '助教不存在'
      });
    }
    
    const oldShift = coach.shift;
    
    // 更新班次
    await transaction.run(
      'UPDATE coaches SET shift = ?, updated_at = CURRENT_TIMESTAMP WHERE coach_no = ?',
      [shift, coach_no]
    );
    
    // 联动更新水牌状态：如果水牌状态是早班相关的，改为晚班相关的（反之亦然）
    const waterBoard = await transaction.get(
      'SELECT * FROM water_boards WHERE coach_no = ?',
      [coach_no]
    );
    
    if (waterBoard) {
      const oldStatus = waterBoard.status;
      let newStatus = oldStatus;
      
      // 状态映射
      const statusMap = {
        '早班空闲': '晚班空闲',
        '晚班空闲': '早班空闲',
        '早班上桌': '晚班上桌',
        '晚班上桌': '早班上桌',
        '早加班': '晚加班',
        '晚加班': '早加班'
      };
      
      if (statusMap[oldStatus]) {
        newStatus = statusMap[oldStatus];
        await transaction.run(
          'UPDATE water_boards SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE coach_no = ?',
          [newStatus, coach_no]
        );
        
        // 记录操作日志
        const user = req.user;
        await operationLogService.create(transaction, {
          operator_phone: user.username,
          operator_name: user.name,
          operation_type: '水牌状态变更',
          target_type: 'water_board',
          target_id: waterBoard.id,
          old_value: JSON.stringify({ status: oldStatus, table_no: waterBoard.table_no }),
          new_value: JSON.stringify({ status: newStatus, table_no: waterBoard.table_no }),
          remark: `班次变更联动：${oldShift}→${shift}，水牌 ${oldStatus}→${newStatus}`
        });
      }
    }
    
    // 记录操作日志
    const user = req.user;
    await operationLogService.create(transaction, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '修改班次',
      target_type: 'coaches',
      old_value: JSON.stringify({ coach_no, shift: oldShift }),
      new_value: JSON.stringify({ coach_no, shift }),
      remark: `修改助教${coach.stage_name}班次：${oldShift}→${shift}`
    });
    
    await transaction.commit();
    
    res.json({
      success: true,
      data: {
        coach_no,
        shift,
        old_shift: oldShift
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('修改班次失败:', error);
    res.status(500).json({
      success: false,
      error: '修改班次失败'
    });
  }
});

module.exports = router;
