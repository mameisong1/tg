/**
 * 水牌管理 API
 * 路径：/api/water-boards
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { runInTransaction, parseTables, joinTables } = require('../db');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const TimeUtil = require('../utils/time');
const operationLogService = require('../services/operation-log');
const errorLogger = require('../utils/error-logger');

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
    // 新增 table_no_list 字段，方便前端使用
    const parsedData = waterBoards.map(item => ({
      ...item,
      photos: item.photos ? JSON.parse(item.photos) : [],
      table_no_list: parseTables(item.table_no)
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
    
    // 解析 photos 字段，新增 table_no_list 字段
    waterBoard.photos = waterBoard.photos ? JSON.parse(waterBoard.photos) : [];
    waterBoard.table_no_list = parseTables(waterBoard.table_no);
    
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
  try {
    const result = await runInTransaction(async (tx) => {
    const { coach_no } = req.params;
    const { status, table_no } = req.body;
    
    const validStatuses = [
      '早班上桌', '早班空闲', '晚班上桌', '晚班空闲',
      '早加班', '晚加班', '休息', '公休', '请假', '乐捐', '下班'
    ];
    
    if (status && !validStatuses.includes(status)) {
      throw { status: 400, error: '无效的状态值' };
    }
    
    const currentWaterBoard = await db.get(`
      SELECT * FROM water_boards WHERE coach_no = ?
    `, [coach_no]);
    
    if (!currentWaterBoard) {
      throw { status: 404, error: '水牌不存在' };
    }
    
    const oldValue = {
      status: currentWaterBoard.status,
      table_no: currentWaterBoard.table_no
    };
    
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
    
    const workStatuses = ['早班空闲', '晚班空闲', '早班上桌', '晚班上桌', '早加班', '晚加班', '乐捐'];
    const offStatuses = ['下班', '休息', '公休', '请假'];
    if (status && workStatuses.includes(status)) {
      const wasOff = offStatuses.includes(currentWaterBoard.status) || !currentWaterBoard.clock_in_time;
      if (wasOff) {
        updateFields.push('clock_in_time = ?');
        updateParams.push(TimeUtil.nowDB());
      }
    }
    if (status === '下班') {
      updateFields.push('clock_in_time = NULL');
    }
    // 状态变为非工作状态且未显式设置台桌号时，清除台桌号
    if (status && offStatuses.includes(status) && table_no === undefined) {
      updateFields.push('table_no = NULL');
    }
    
    updateFields.push('updated_at = ?');
    updateParams.push(TimeUtil.nowDB());
    updateParams.push(coach_no);
    
    await tx.run(`
      UPDATE water_boards SET ${updateFields.join(', ')} WHERE coach_no = ?
    `, updateParams);
    
    const newValue = {
      status: status || currentWaterBoard.status,
      table_no: (table_no !== undefined) ? table_no : (status && offStatuses.includes(status) ? null : currentWaterBoard.table_no)
    };
    
    // 如果水牌从「乐捐」变为其他状态，自动关闭当前乐捐记录
    if (oldValue.status === '乐捐' && newValue.status !== '乐捐') {
      const activeLejuan = await tx.get(
        `SELECT id, actual_start_time FROM lejuan_records
         WHERE coach_no = ? AND lejuan_status = 'active'
         ORDER BY actual_start_time DESC LIMIT 1`,
        [coach_no]
      );
      
      if (activeLejuan) {
        const nowDB = TimeUtil.nowDB();
        const actualStart = new Date(activeLejuan.actual_start_time + '+08:00');
        const nowTime = new Date(nowDB + '+08:00');
        const diffMs = nowTime.getTime() - actualStart.getTime();
        const baseHours = Math.floor(diffMs / (60 * 60 * 1000));
        const endMinute = nowTime.getMinutes();
        const extraHour = endMinute > 10 ? 1 : 0;
        const lejuanHours = Math.max(1, baseHours + extraHour);
        
        await tx.run(
          `UPDATE lejuan_records
           SET lejuan_status = 'returned',
               return_time = ?,
               lejuan_hours = ?,
               updated_at = ?
           WHERE id = ? AND lejuan_status = 'active'`,
          [nowDB, lejuanHours, nowDB, activeLejuan.id]
        );
        
        console.log(`[水牌状态变更] 自动关闭乐捐记录 ${activeLejuan.id}（${coach_no}）`);
      }
    }
    
    const user = req.user;
    await operationLogService.create(tx, {
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '水牌状态变更',
      target_type: 'water_board',
      target_id: currentWaterBoard.id,
      old_value: JSON.stringify(oldValue),
      new_value: JSON.stringify(newValue),
      remark: `手动更新水牌状态：${oldValue.status} → ${newValue.status}`
    });
    
    return { coach_no, status: newValue.status, table_no: newValue.table_no };
    });
    
    res.json({
      success: true,
      data: {
        coach_no: result.coach_no,
        status: result.status,
        table_no: result.table_no
      }
    });
  } catch (error) {
    errorLogger.logApiRejection(req, error);
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
    console.error('更新水牌状态失败:', error);
    res.status(500).json({
      success: false,
      error: '更新水牌状态失败'
    });
  }
});

module.exports = router;
