/**
 * 智能开关路由模块
 * 
 * 包含：
 * 1. 设备开关管理 API（后台）
 * 2. 台桌设备关系 API（后台）
 * 3. 开关场景 API（后台）
 * 4. 前台控制 API（H5）
 */

const express = require('express');
const router = express.Router();
const TimeUtil = require('../utils/time');
const { all, get, run, enqueueRun, runInTransaction } = require('../db/index');
const { requireBackendPermission } = require('../middleware/permission');
const { sendBatchCommand, executeScene, controlByLabel, controlByTable } = require('../services/mqtt-switch');
const { executeAutoOffLighting, executeAutoOffTableIndependent } = require('../services/auto-off-lighting');
const operationLogService = require('../services/operation-log');

// ============================================================
// 前台权限中间件 - 仅店长/助教管理/管理员
// ============================================================
const requireSwitchPermission = (req, res, next) => {
  const user = req.user;
  if (!user || !user.role) return res.status(403).json({ error: '未授权' });
  const allowed = ['店长', '助教管理', '管理员'];
  if (!allowed.includes(user.role)) return res.status(403).json({ error: '权限不足' });
  next();
};

// ============================================================
// 1. 设备开关管理 API（后台）
// ============================================================

// 获取开关列表
router.get('/api/admin/switches', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { label, device_type } = req.query;
    let sql = 'SELECT * FROM switch_device ORDER BY switch_label, switch_id, switch_seq';
    const params = [];
    
    if (label && device_type) {
      sql = 'SELECT * FROM switch_device WHERE switch_label = ? AND device_type = ? ORDER BY switch_id, switch_seq';
      params.push(label, device_type);
    } else if (label) {
      sql = 'SELECT * FROM switch_device WHERE switch_label = ? ORDER BY switch_id, switch_seq';
      params.push(label);
    } else if (device_type) {
      sql = 'SELECT * FROM switch_device WHERE device_type = ? ORDER BY switch_label, switch_id, switch_seq';
      params.push(device_type);
    }
    
    const rows = await all(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 新增开关
router.post('/api/admin/switches', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, auto_on_start, auto_on_end, device_type, remark } = req.body;
    if (!switch_id || !switch_seq || !switch_label) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    const now = TimeUtil.nowDB();
    await runInTransaction(async (tx) => {
      await tx.run(
        `INSERT INTO switch_device (switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, auto_on_start, auto_on_end, device_type, remark, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [switch_id, switch_seq, switch_label, auto_off_start || '', auto_off_end || '', auto_on_start || '', auto_on_end || '', device_type || '灯', remark || '', now, now]
      );
    });
    // 记录日志
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '创建设备开关',
      target_type: 'switch_device',
      new_value: JSON.stringify({ switch_id, switch_seq, switch_label, device_type }),
      remark: `新增开关: ${switch_label}#${switch_seq} (${device_type || '灯'})`
    });
    res.json({ success: true });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: '该开关ID+开关序号已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新开关（支持部分更新：只传要改的字段）
router.put('/api/admin/switches/:id', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, auto_on_start, auto_on_end, device_type, remark } = req.body;

    // 动态构建 SET 子句：只更新传入的字段
    const allowedFields = {
      switch_id,
      switch_seq,
      switch_label,
      auto_off_start,
      auto_off_end,
      auto_on_start,
      auto_on_end,
      device_type,
      remark
    };
    const updates = [];
    const params = [];
    for (const [key, value] of Object.entries(allowedFields)) {
      if (value !== undefined) {
        updates.push(`${key} = ?`);
        params.push(value);
      }
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }
    // 校验 NOT NULL 字段：如果传了空值则报错
    if (updates.some(u => u.startsWith('switch_id = ?')) && !switch_id) {
      return res.status(400).json({ error: 'switch_id 不能为空' });
    }
    if (updates.some(u => u.startsWith('switch_seq = ?')) && !switch_seq) {
      return res.status(400).json({ error: 'switch_seq 不能为空' });
    }
    if (updates.some(u => u.startsWith('switch_label = ?')) && !switch_label) {
      return res.status(400).json({ error: 'switch_label 不能为空' });
    }

    const now = TimeUtil.nowDB();
    await runInTransaction(async (tx) => {
      const existing = await tx.get('SELECT id FROM switch_device WHERE id = ?', [req.params.id]);
      if (!existing) {
        throw new Error('NOT_FOUND');
      }
      params.push(now, req.params.id);
      await tx.run(
        `UPDATE switch_device SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`,
        params
      );
    });
    // 记录日志
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '更新设备开关',
      target_type: 'switch_device',
      target_id: req.params.id,
      new_value: JSON.stringify(req.body),
      remark: `更新开关: ID=${req.params.id}`
    });
    res.json({ success: true });
  } catch (err) {
    if (err.message === 'NOT_FOUND') {
      return res.status(404).json({ error: '记录不存在' });
    }
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: '该开关ID+开关序号已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除开关
router.delete('/api/admin/switches/:id', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    // 先获取要删除的记录信息
    const existing = await get('SELECT switch_id, switch_seq, switch_label FROM switch_device WHERE id = ?', [req.params.id]);
    await runInTransaction(async (tx) => {
      await tx.run('DELETE FROM switch_device WHERE id = ?', [req.params.id]);
    });
    // 记录日志
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '删除设备开关',
      target_type: 'switch_device',
      target_id: req.params.id,
      old_value: existing ? JSON.stringify(existing) : null,
      remark: existing ? `删除开关: ${existing.switch_label}#${existing.switch_seq}` : `删除开关 ID=${req.params.id}`
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ============================================================
// 2. 台桌设备关系 API（后台）
// ============================================================

// 获取台桌设备关系列表
router.get('/api/admin/table-devices', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const rows = await all('SELECT * FROM table_device ORDER BY table_name_en, switch_seq, switch_label');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 新增台桌设备关系
router.post('/api/admin/table-devices', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { table_name_en, switch_seq, switch_label } = req.body;
    if (!table_name_en || !switch_seq || !switch_label) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    const now = TimeUtil.nowDB();
    await runInTransaction(async (tx) => {
      await tx.run(
        `INSERT INTO table_device (table_name_en, switch_seq, switch_label, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [table_name_en, switch_seq, switch_label, now, now]
      );
    });
    // 记录日志
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '创建台桌设备关系',
      target_type: 'table_device',
      new_value: JSON.stringify({ table_name_en, switch_seq, switch_label }),
      remark: `新增关系: ${table_name_en} -> ${switch_label}#${switch_seq}`
    });
    res.json({ success: true });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: '该台桌+开关关系已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除台桌设备关系
router.delete('/api/admin/table-devices/:id', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    // 先获取要删除的记录信息
    const existing = await get('SELECT table_name_en, switch_seq, switch_label FROM table_device WHERE id = ?', [req.params.id]);
    await runInTransaction(async (tx) => {
      await tx.run('DELETE FROM table_device WHERE id = ?', [req.params.id]);
    });
    // 记录日志
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '删除台桌设备关系',
      target_type: 'table_device',
      target_id: req.params.id,
      old_value: existing ? JSON.stringify(existing) : null,
      remark: existing ? `删除关系: ${existing.table_name_en} -> ${existing.switch_label}#${existing.switch_seq}` : `删除关系 ID=${req.params.id}`
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ============================================================
// 3. 开关场景 API（后台 CRD，无Update）
// ============================================================

// 获取场景列表
router.get('/api/admin/switch-scenes', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const rows = await all('SELECT * FROM switch_scene ORDER BY sort_order, id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 新增场景
router.post('/api/admin/switch-scenes', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { scene_name, action, switches, sort_order } = req.body;
    if (!scene_name || !action || !switches) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    if (!['ON', 'OFF'].includes(action)) {
      return res.status(400).json({ error: '动作只能是 ON 或 OFF' });
    }
    // 验证 switches 是数组
    const switchesArr = Array.isArray(switches) ? switches : [];
    if (switchesArr.length === 0) {
      return res.status(400).json({ error: '开关数组不能为空' });
    }

    const now = TimeUtil.nowDB();
    await runInTransaction(async (tx) => {
      await tx.run(
        `INSERT INTO switch_scene (scene_name, action, switches, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [scene_name, action, JSON.stringify(switchesArr), sort_order || 0, now, now]
      );
    });
    // 记录日志
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '创建开关场景',
      target_type: 'switch_scene',
      new_value: JSON.stringify({ scene_name, action, switches: switchesArr.length }),
      remark: `新增场景: ${scene_name} (${action})`
    });
    res.json({ success: true });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: '场景名称已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新场景
router.put('/api/admin/switch-scenes/:id', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { scene_name, action, switches, sort_order } = req.body;

    // 先检查记录是否存在
    const existing = await get('SELECT id FROM switch_scene WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '场景不存在' });
    }

    // 构建更新字段
    const updates = [];
    const params = [];

    if (scene_name !== undefined) {
      updates.push('scene_name = ?');
      params.push(scene_name);
    }
    if (action !== undefined) {
      if (!['ON', 'OFF'].includes(action)) {
        return res.status(400).json({ error: '动作只能是 ON 或 OFF' });
      }
      updates.push('action = ?');
      params.push(action);
    }
    if (switches !== undefined) {
      const switchesArr = Array.isArray(switches) ? switches : [];
      if (switchesArr.length === 0) {
        return res.status(400).json({ error: '开关数组不能为空' });
      }
      updates.push('switches = ?');
      params.push(JSON.stringify(switchesArr));
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      params.push(sort_order);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    const now = TimeUtil.nowDB();
    updates.push('updated_at = ?');
    params.push(now, req.params.id);

    await runInTransaction(async (tx) => {
      await tx.run(
        `UPDATE switch_scene SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    });

    // 记录日志
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '更新开关场景',
      target_type: 'switch_scene',
      target_id: req.params.id,
      new_value: JSON.stringify(req.body),
      remark: `更新场景: ID=${req.params.id}`
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除场景
router.delete('/api/admin/switch-scenes/:id', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    // 先获取要删除的记录信息
    const existing = await get('SELECT scene_name, action FROM switch_scene WHERE id = ?', [req.params.id]);
    await runInTransaction(async (tx) => {
      await tx.run('DELETE FROM switch_scene WHERE id = ?', [req.params.id]);
    });
    // 记录日志
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '删除开关场景',
      target_type: 'switch_scene',
      target_id: req.params.id,
      old_value: existing ? JSON.stringify(existing) : null,
      remark: existing ? `删除场景: ${existing.scene_name} (${existing.action})` : `删除场景 ID=${req.params.id}`
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ============================================================
// 4. 前台控制 API（H5用）
// ============================================================

// 获取自动关灯/开灯状态
router.get('/api/switch/auto-status', requireSwitchPermission, async (req, res) => {
  try {
    const offSetting = await get("SELECT value FROM system_settings WHERE key = 'switch_auto_off_enabled'");
    res.json({
      auto_off_enabled: offSetting?.value === '1'
    });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 切换自动关灯启停
router.post('/api/switch/auto-off-toggle', requireSwitchPermission, async (req, res) => {
  try {
    const current = await get("SELECT value FROM system_settings WHERE key = 'switch_auto_off_enabled'");
    const newValue = current?.value === '1' ? '0' : '1';
    const now = TimeUtil.nowDB();
    await enqueueRun(
      `INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('switch_auto_off_enabled', ?, ?)`,
      [newValue, now]
    );
    // 记录日志
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '切换自动关灯',
      target_type: 'system_settings',
      old_value: current?.value || '0',
      new_value: newValue,
      remark: `自动关灯: ${newValue === '1' ? '开启' : '关闭'}`
    });
    res.json({ success: true, enabled: newValue === '1' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 手动执行一次智能省电（自动关灯）
router.post('/api/switch/auto-off-manual', requireSwitchPermission, async (req, res) => {
  try {
    const result = await executeAutoOffLighting();
    const independentResult = await executeAutoOffTableIndependent();
    // 记录日志
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '手动触发自动关灯',
      target_type: 'switch_control',
      new_value: JSON.stringify({ turnedOff: result.turnedOffCount, independent: independentResult?.turnedOffCount || 0 }),
      remark: `手动关灯: ${result.turnedOffCount || 0} + ${independentResult?.turnedOffCount || 0} 个开关`
    });
    res.json({
      success: true,
      turnedOffCount: result.turnedOffCount || 0,
      maybeOffCount: result.maybeOffCount || 0,
      cannotOffCount: result.cannotOffCount || 0,
      independentTurnedOffCount: independentResult?.turnedOffCount || 0
    });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 执行场景
router.post('/api/switch/scene/:id', requireSwitchPermission, async (req, res) => {
  try {
    const scene = await get('SELECT * FROM switch_scene WHERE id = ?', [req.params.id]);
    if (!scene) return res.status(404).json({ error: '场景不存在' });

    let switches;
    try {
      switches = JSON.parse(scene.switches);
    } catch (e) {
      return res.status(400).json({ error: '场景开关数据格式错误' });
    }

    const result = await executeScene(switches, scene.action);
    if (result.totalCount === 0) {
      return res.status(400).json({ error: '场景中没有可执行的开关' });
    }
    if (result.failures.length > 0) {
      const errors = result.failures.map(f => f.error);
      return res.status(502).json({
        error: `MQTT 发送失败：${result.failures.length}/${result.totalCount} 个失败`,
        details: errors
      });
    }
    // 记录日志
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '执行开关场景',
      target_type: 'switch_scene',
      target_id: req.params.id,
      new_value: JSON.stringify({ scene_name: scene.scene_name, action: scene.action, count: result.successCount }),
      remark: `执行场景: ${scene.scene_name} (${scene.action}) - ${result.successCount} 个开关`
    });
    res.json({ success: true, count: result.successCount });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 按标签批量控制
router.post('/api/switch/label-control', requireSwitchPermission, async (req, res) => {
  try {
    const { label, action } = req.body;
    if (!label || !action) return res.status(400).json({ error: '缺少参数' });
    if (!['ON', 'OFF'].includes(action)) return res.status(400).json({ error: '动作只能是 ON 或 OFF' });

    const result = await controlByLabel(label, action);
    if (result.totalCount === 0) {
      return res.status(400).json({ error: `标签 "${label}" 下没有关联开关` });
    }
    if (result.failures.length > 0) {
      const errors = result.failures.map(f => f.error);
      return res.status(502).json({
        error: `MQTT 发送失败：${result.failures.length}/${result.totalCount} 个失败`,
        details: errors
      });
    }
    // 记录日志
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '标签批量控制',
      target_type: 'switch_control',
      new_value: JSON.stringify({ label, action, count: result.successCount }),
      remark: `标签控制: ${label} -> ${action} (${result.successCount} 个开关)`
    });
    res.json({ success: true, count: result.successCount });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取所有开关标签列表
router.get('/api/switch/labels', requireSwitchPermission, async (req, res) => {
  try {
    const rows = await all('SELECT DISTINCT switch_label FROM switch_device WHERE device_type = "灯" AND switch_label != \'\' ORDER BY switch_label');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取场景列表（前台用）
router.get('/api/switch/scenes', requireSwitchPermission, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM switch_scene WHERE device_type = "灯" ORDER BY sort_order, id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取台桌列表及其关联开关（前台用）
router.get('/api/switch/tables', requireSwitchPermission, async (req, res) => {
  try {
    const tableDevices = await all(
      'SELECT td.table_name_en, td.switch_seq, td.switch_label, sd.switch_id, sd.switch_label AS device_label ' +
      'FROM table_device td LEFT JOIN switch_device sd ON td.switch_seq = sd.switch_seq AND td.switch_label = sd.switch_label AND sd.device_type = "灯" ' +
      'ORDER BY td.table_name_en'
    );

    // 中英文台桌名映射
    const nameMap = {
      'boss1': { name: 'BOSS1', area: '包厢区' },
      'boss2': { name: 'BOSS2', area: '包厢区' },
      'boss3': { name: 'BOSS3', area: '包厢区' },
      'vip1': { name: 'VIP1', area: '包厢区' },
      'vip2': { name: 'VIP2', area: '包厢区' },
      'vip3': { name: 'VIP3', area: '包厢区' },
      'vip5': { name: 'VIP5', area: '包厢区' },
      'vip6': { name: 'VIP6', area: '包厢区' },
      'vip7': { name: 'VIP7', area: '包厢区' },
      'vip8': { name: 'VIP8', area: '包厢区' },
      'tvtai': { name: 'TV台', area: 'TV区' },
      'sinuoke30': { name: '斯诺克30', area: '斯诺克区' },
      'sinuoke31': { name: '斯诺克31', area: '斯诺克区' },
      'que1': { name: '雀1', area: '棋牌区' },
      'que2': { name: '雀2', area: '棋牌区' },
    };
    // 普台1-30 映射
    for (let i = 1; i <= 30; i++) {
      nameMap['putai' + i] = { name: '普台' + i, area: '大厅区' };
    }

    // 按台桌分组
    const tableMap = {};
    for (const td of tableDevices) {
      if (!tableMap[td.table_name_en]) {
        tableMap[td.table_name_en] = {
          table_name_en: td.table_name_en,
          switches: []
        };
      }
      if (td.switch_id) {
        tableMap[td.table_name_en].switches.push({
          switch_id: td.switch_id,
          switch_seq: td.switch_seq
        });
      }
    }

    // 合并数据
    const result = [];
    for (const [key, table] of Object.entries(tableMap)) {
      const info = nameMap[key] || { name: key, area: '' };
      result.push({
        table_name_en: key,
        table_name_cn: info.name,
        area: info.area,
        switches: table.switches
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 按台桌控制开关
router.post('/api/switch/table-control', requireSwitchPermission, async (req, res) => {
  try {
    const { table_name_en, action } = req.body;
    if (!table_name_en || !action) return res.status(400).json({ error: '缺少参数' });
    if (!['ON', 'OFF'].includes(action)) return res.status(400).json({ error: '动作只能是 ON 或 OFF' });

    const result = await controlByTable(table_name_en, action);
    if (result.totalCount === 0) {
      return res.status(400).json({ error: `台桌 "${table_name_en}" 下没有关联开关` });
    }
    if (result.failures.length > 0) {
      const errors = result.failures.map(f => f.error);
      return res.status(502).json({
        error: `MQTT 发送失败：${result.failures.length}/${result.totalCount} 个失败`,
        details: errors
      });
    }
    // 记录日志
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '台桌控制开关',
      target_type: 'switch_control',
      new_value: JSON.stringify({ table_name_en, action, count: result.successCount }),
      remark: `台桌控制: ${table_name_en} -> ${action} (${result.successCount} 个开关)`
    });
    res.json({ success: true, count: result.successCount, table_name_en });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ============================================================
// 5. 空调设定 API
// ============================================================

// 获取空调设定配置
router.get('/api/admin/ac-control', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const config = await get('SELECT value FROM system_config WHERE key = "ac_control"');
    if (!config) {
      // 默认配置
      return res.json({ success: true, config: { temp_set: 23, fan_speed_enum: 'middle' } });
    }
    const parsed = JSON.parse(config.value);
    res.json({ success: true, config: parsed });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新空调设定配置
router.put('/api/admin/ac-control', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { temp_set, fan_speed_enum } = req.body;
    
    // 验证温度范围
    if (temp_set !== undefined) {
      if (!Number.isInteger(temp_set) || temp_set < 16 || temp_set > 30) {
        return res.status(400).json({ error: '温度范围: 16-30℃' });
      }
    }
    
    // 验证风速
    if (fan_speed_enum !== undefined) {
      const validSpeeds = ['auto', 'low', 'middle', 'high'];
      if (!validSpeeds.includes(fan_speed_enum)) {
        return res.status(400).json({ error: `风速可选: ${validSpeeds.join(', ')}` });
      }
    }
    
    // 获取现有配置
    const existing = await get('SELECT value FROM system_config WHERE key = "ac_control"');
    let newConfig;
    if (existing) {
      newConfig = JSON.parse(existing.value);
      if (temp_set !== undefined) newConfig.temp_set = temp_set;
      if (fan_speed_enum !== undefined) newConfig.fan_speed_enum = fan_speed_enum;
    } else {
      newConfig = { temp_set: 23, fan_speed_enum: 'middle' };
      if (temp_set !== undefined) newConfig.temp_set = temp_set;
      if (fan_speed_enum !== undefined) newConfig.fan_speed_enum = fan_speed_enum;
    }
    
    const now = TimeUtil.nowDB();
    const valueStr = JSON.stringify(newConfig);
    
    if (existing) {
      await run('UPDATE system_config SET value = ?, updated_at = ? WHERE key = "ac_control"', [valueStr, now]);
    } else {
      await run('INSERT INTO system_config (key, value, description, updated_at) VALUES (?, ?, "空调设定配置", ?)', ['ac_control', valueStr, now]);
    }
    
    // 刷新空调配置缓存（热更新）
    const { refreshACConfig } = require('../services/mqtt-ac');
    refreshACConfig();
    
    // 记录日志
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '更新空调设定',
      target_type: 'system_config',
      new_value: valueStr,
      remark: `空调设定: 温度=${newConfig.temp_set}℃, 风速=${newConfig.fan_speed_enum}`
    });
    
    res.json({ success: true, config: newConfig });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ============================================================
// 6. 自动关灯触发函数（供 sync/tables 调用）
// ============================================================

/**
 * 触发自动关灯（由 sync/tables 接口调用）
 * @param {number} tablesUpdated - tables表更新条数
 * @param {number} vipRoomsUpdated - vip_rooms表更新条数
 */
async function triggerAutoOffIfEligible(tablesUpdated, vipRoomsUpdated) {
  const totalUpdated = tablesUpdated + vipRoomsUpdated;
  if (totalUpdated < 40) {
    return { triggered: false, reason: `更新条数 ${totalUpdated} < 40` };
  }

  try {
    const result = await executeAutoOffLighting();
    // 台桌无关关灯已移到 Cron 定时任务，不再在此触发
    return {
      triggered: true,
      ...result,
      independentTurnedOffCount: 0
    };
  } catch (err) {
    console.error(`[自动关灯触发] 执行失败: ${err.message}`);
    return { triggered: true, status: 'error', error: err.message };
  }
}

module.exports = {
  router,
  triggerAutoOffIfEligible
};
