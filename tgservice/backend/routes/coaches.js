/**
 * 助教管理 API
 * 路径：/api/coaches
 */

const express = require('express');
const router = express.Router();
const { runInTransaction } = require('../db');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const TimeUtil = require('../utils/time');
const operationLogService = require('../services/operation-log');

/**
 * POST /api/coaches/:coach_no/clock-in
 * 助教上班（助教只能打自己的卡）
 */
router.post('/:coach_no/clock-in', auth.required, requireBackendPermission(['coachManagement'], { coachSelfOnly: true }), async (req, res) => {
  try {
    const result = await runInTransaction(async (tx) => {
    const { coach_no } = req.params;
    
    // 获取助教信息（包括班次）
    const coach = await tx.get(`
      SELECT coach_no, stage_name, shift FROM coaches WHERE coach_no = ?
    `, [coach_no]);
    
    if (!coach) {
      throw { status: 404, error: '助教不存在' };
    }
    
    // 获取当前水牌状态
    const waterBoard = await tx.get(`
      SELECT * FROM water_boards WHERE coach_no = ?
    `, [coach_no]);
    
    if (!waterBoard) {
      throw { status: 404, error: '水牌不存在' };
    }
    
    const oldStatus = waterBoard.status;
    
    // 根据班次和当前状态确定新状态
    let newStatus;
    if (waterBoard.status === '乐捐') {
      throw { status: 400, error: '乐捐状态无法自行上班，请联系助教管理或店长' };
    } else if (['早加班', '休息', '公休', '请假', '下班'].includes(waterBoard.status)) {
      newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
    } else if (waterBoard.status === '早班空闲' || waterBoard.status === '晚班空闲') {
      throw { status: 400, error: '助教已在班状态，无需重复上班' };
    } else {
      if (waterBoard.status === '早班上桌' || waterBoard.status === '晚班上桌') {
        throw { status: 400, error: '上桌状态不能点上班' };
      }
      newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
    }
    
    // 更新水牌状态
    const nowDB = TimeUtil.nowDB();
    await tx.run(`
      UPDATE water_boards 
      SET status = ?, table_no = NULL, clock_in_time = ?, updated_at = ?
      WHERE coach_no = ?
    `, [newStatus, nowDB, nowDB, coach_no]);
    
    // 记录操作日志
    const user = req.user;
    await operationLogService.create(tx, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '水牌状态变更',
      target_type: 'water_board',
      target_id: waterBoard.id,
      old_value: JSON.stringify({ status: oldStatus, table_no: waterBoard.table_no }),
      new_value: JSON.stringify({ status: newStatus, table_no: null }),
      remark: `上班：${oldStatus} → ${newStatus}`
    });
    
    return { coach_no, stage_name: coach.stage_name, status: newStatus };
    });
    
    res.json({
      success: true,
      data: {
        coach_no: result.coach_no,
        stage_name: result.stage_name,
        status: result.status
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
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
  try {
    const result = await runInTransaction(async (tx) => {
    const { coach_no } = req.params;
    
    // 获取当前水牌状态
    const waterBoard = await tx.get(`
      SELECT * FROM water_boards WHERE coach_no = ?
    `, [coach_no]);
    
    if (!waterBoard) {
      throw { status: 404, error: '水牌不存在' };
    }
    
    const oldStatus = waterBoard.status;
    
    const canClockOut = [
      '早班空闲', '晚班空闲',
      '早班上桌', '晚班上桌',
      '乐捐'
    ].includes(waterBoard.status);
    
    if (!canClockOut) {
      throw { status: 400, error: `当前状态（${waterBoard.status}）不允许下班` };
    }
    
    const newStatus = '下班';
    
    const nowDB = TimeUtil.nowDB();
    await tx.run(`
      UPDATE water_boards 
      SET status = ?, table_no = NULL, clock_in_time = NULL, updated_at = ?
      WHERE coach_no = ?
    `, [newStatus, nowDB, coach_no]);
    
    const user = req.user;
    await operationLogService.create(tx, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '水牌状态变更',
      target_type: 'water_board',
      target_id: waterBoard.id,
      old_value: JSON.stringify({ status: oldStatus, table_no: waterBoard.table_no }),
      new_value: JSON.stringify({ status: newStatus, table_no: null }),
      remark: `下班：${oldStatus} → ${newStatus}`
    });
    
    return { coach_no, status: newStatus };
    });
    
    res.json({
      success: true,
      data: {
        coach_no: result.coach_no,
        status: result.status
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
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
  try {
    const result = await runInTransaction(async (tx) => {
    const { coach_no_list, shift } = req.body;
    
    if (!['早班', '晚班'].includes(shift)) {
      throw { status: 400, error: '无效的班次值' };
    }
    
    if (!Array.isArray(coach_no_list) || coach_no_list.length === 0) {
      throw { status: 400, error: '助教列表不能为空' };
    }
    
    const statusMap = {
      '早班空闲': '晚班空闲',
      '晚班空闲': '早班空闲',
      '早班上桌': '晚班上桌',
      '晚班上桌': '早班上桌',
      '早加班': '晚加班',
      '晚加班': '早加班'
    };
    
    const placeholders = coach_no_list.map(() => '?').join(',');
    const coaches = await tx.all(`
      SELECT coach_no, stage_name, shift FROM coaches WHERE coach_no IN (${placeholders})
    `, coach_no_list);
    
    const waterBoards = await tx.all(`
      SELECT coach_no, id, status, table_no FROM water_boards WHERE coach_no IN (${placeholders})
    `, coach_no_list);
    
    const waterBoardMap = {};
    waterBoards.forEach(wb => { waterBoardMap[wb.coach_no] = wb; });
    
    const coachMap = {};
    coaches.forEach(c => { coachMap[c.coach_no] = c; });
    
    const changeDetails = [];
    
    const nowDB = TimeUtil.nowDB();
    await tx.run(`
      UPDATE coaches SET shift = ?, updated_at = ? 
      WHERE coach_no IN (${placeholders})
    `, [shift, nowDB, ...coach_no_list]);
    
    for (const coachNo of coach_no_list) {
      const coach = coachMap[coachNo];
      const waterBoard = waterBoardMap[coachNo];
      
      if (!coach) continue;
      
      const oldShift = coach.shift;
      let waterBoardStatusChanged = false;
      
      if (waterBoard && statusMap[waterBoard.status]) {
        const oldStatus = waterBoard.status;
        const newStatus = statusMap[oldStatus];
        
        await tx.run(
          'UPDATE water_boards SET status = ?, updated_at = ? WHERE coach_no = ?',
          [newStatus, nowDB, coachNo]
        );
        
        waterBoardStatusChanged = true;
        
        await operationLogService.create(tx, {
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
    
    const user = req.user;
    await operationLogService.create(tx, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '批量修改班次',
      target_type: 'coaches',
      old_value: JSON.stringify(changeDetails.map(d => ({ coach_no: d.coach_no, stage_name: d.stage_name, shift: d.old_shift, water_board_changed: d.water_board_changed }))),
      new_value: JSON.stringify({ shift, count: coach_no_list.length }),
      remark: `批量修改${coach_no_list.length}名助教班次为${shift}，详情：${changeDetails.map(d => `${d.stage_name}(${d.coach_no}): ${d.old_shift}→${d.shift}${d.water_board_changed ? ' [水牌已联动]' : ''}`).join('；')}`
    });
    
    return { updated_count: coach_no_list.length, details: changeDetails };
    });
    
    res.json({
      success: true,
      data: {
        updated_count: result.updated_count,
        details: result.details
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
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
  try {
    const result = await runInTransaction(async (tx) => {
    const { coach_no } = req.params;
    const { shift } = req.body;
    
    if (!['早班', '晚班'].includes(shift)) {
      throw { status: 400, error: '无效的班次值，应为早班或晚班' };
    }
    
    const coach = await tx.get(
      'SELECT coach_no, stage_name, shift FROM coaches WHERE coach_no = ?',
      [coach_no]
    );
    
    if (!coach) {
      throw { status: 404, error: '助教不存在' };
    }
    
    const oldShift = coach.shift;
    
    const nowDB = TimeUtil.nowDB();
    await tx.run(
      'UPDATE coaches SET shift = ?, updated_at = ? WHERE coach_no = ?',
      [shift, nowDB, coach_no]
    );
    
    const waterBoard = await tx.get(
      'SELECT * FROM water_boards WHERE coach_no = ?',
      [coach_no]
    );
    
    if (waterBoard) {
      const oldStatus = waterBoard.status;
      let newStatus = oldStatus;
      
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
        await tx.run(
          'UPDATE water_boards SET status = ?, updated_at = ? WHERE coach_no = ?',
          [newStatus, nowDB, coach_no]
        );
        
        const user = req.user;
        await operationLogService.create(tx, {
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
    
    const user = req.user;
    await operationLogService.create(tx, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '修改班次',
      target_type: 'coaches',
      old_value: JSON.stringify({ coach_no, shift: oldShift }),
      new_value: JSON.stringify({ coach_no, shift }),
      remark: `修改助教${coach.stage_name}班次：${oldShift}→${shift}`
    });
    
    return { coach_no, shift, old_shift: oldShift };
    });
    
    res.json({
      success: true,
      data: {
        coach_no: result.coach_no,
        shift: result.shift,
        old_shift: result.old_shift
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
    console.error('修改班次失败:', error);
    res.status(500).json({
      success: false,
      error: '修改班次失败'
    });
  }
});

module.exports = router;
