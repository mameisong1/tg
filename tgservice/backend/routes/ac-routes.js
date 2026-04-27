/**
 * 智能空调路由模块
 * 
 * 包含：
 * 1. 空调设备管理 API（后台）
 * 2. 空调场景 API（后台）
 * 3. 前台控制 API（H5用）
 * 4. 自动关空调触发函数（供 sync/tables 调用）
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const TimeUtil = require('../utils/time');
const { all, get, run, enqueueRun, runInTransaction } = require('../db/index');
const { requireBackendPermission } = require('../middleware/permission');
const { executeAutoOffAC, executeAutoOffACTableIndependent } = require('../services/auto-off-ac');
const { getAutoOffSettings, setAutoOffSettings } = require('../utils/config-helper');
const operationLogService = require('../services/operation-log');
const { controlACByLabel, controlACByTable } = require('../services/mqtt-ac');

// 路径过滤认证中间件（仅对相关路径应用）
router.use((req, res, next) => {
  const path = req.path;
  // 只对 /api/ac 和 /api/admin/ac 等相关路径应用认证
  if (path.startsWith('/api/ac') || path.startsWith('/api/admin/ac')) {
    return auth.required(req, res, next);
  }
  next();
});

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
// 1. 空调设备管理 API（后台）
// ============================================================

// 获取空调设备列表
router.get('/api/admin/ac-devices', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { label } = req.query;
    let sql = 'SELECT * FROM switch_device WHERE device_type = "空调" ORDER BY switch_label, switch_id, switch_seq';
    const params = [];
    
    if (label) {
      sql = 'SELECT * FROM switch_device WHERE device_type = "空调" AND switch_label = ? ORDER BY switch_id, switch_seq';
      params.push(label);
    }
    
    const rows = await all(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 新增空调设备
router.post('/api/admin/ac-devices', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, auto_on_start, auto_on_end, remark } = req.body;
    if (!switch_id || !switch_seq || !switch_label) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    const now = TimeUtil.nowDB();
    await runInTransaction(async (tx) => {
      await tx.run(
        `INSERT INTO switch_device (switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, auto_on_start, auto_on_end, device_type, remark, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, '空调', ?, ?, ?)`,
        [switch_id, switch_seq, switch_label, auto_off_start || '', auto_off_end || '', auto_on_start || '', auto_on_end || '', remark || '', now, now]
      );
    });
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '创建空调设备',
      target_type: 'switch_device',
      new_value: JSON.stringify({ switch_id, switch_seq, switch_label, device_type: '空调' }),
      remark: `新增空调: ${switch_label}#${switch_seq}`
    });
    res.json({ success: true });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: '该空调ID+开关序号已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新空调设备
router.put('/api/admin/ac-devices/:id', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, auto_on_start, auto_on_end, remark } = req.body;

    const allowedFields = {
      switch_id,
      switch_seq,
      switch_label,
      auto_off_start,
      auto_off_end,
      auto_on_start,
      auto_on_end,
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

    const now = TimeUtil.nowDB();
    await runInTransaction(async (tx) => {
      const existing = await tx.get('SELECT id FROM switch_device WHERE id = ? AND device_type = "空调"', [req.params.id]);
      if (!existing) {
        throw new Error('NOT_FOUND');
      }
      params.push(now, req.params.id);
      await tx.run(
        `UPDATE switch_device SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`,
        params
      );
    });
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '更新空调设备',
      target_type: 'switch_device',
      target_id: req.params.id,
      new_value: JSON.stringify(req.body),
      remark: `更新空调: ID=${req.params.id}`
    });
    res.json({ success: true });
  } catch (err) {
    if (err.message === 'NOT_FOUND') {
      return res.status(404).json({ error: '记录不存在' });
    }
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: '该空调ID+开关序号已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除空调设备
router.delete('/api/admin/ac-devices/:id', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const existing = await get('SELECT switch_id, switch_seq, switch_label FROM switch_device WHERE id = ? AND device_type = "空调"', [req.params.id]);
    await runInTransaction(async (tx) => {
      await tx.run('DELETE FROM switch_device WHERE id = ? AND device_type = "空调"', [req.params.id]);
    });
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '删除空调设备',
      target_type: 'switch_device',
      target_id: req.params.id,
      old_value: existing ? JSON.stringify(existing) : null,
      remark: existing ? `删除空调: ${existing.switch_label}#${existing.switch_seq}` : `删除空调 ID=${req.params.id}`
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ============================================================
// 2. 空调场景 API（后台）
// ============================================================

// 获取空调场景列表
router.get('/api/admin/ac-scenes', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const rows = await all('SELECT * FROM switch_scene WHERE device_type = "空调" ORDER BY sort_order, id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 新增空调场景
router.post('/api/admin/ac-scenes', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { scene_name, action, switches, sort_order } = req.body;
    if (!scene_name || !action || !switches) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    if (!['ON', 'OFF'].includes(action)) {
      return res.status(400).json({ error: '动作只能是 ON 或 OFF' });
    }
    const switchesArr = Array.isArray(switches) ? switches : [];
    if (switchesArr.length === 0) {
      return res.status(400).json({ error: '开关数组不能为空' });
    }

    const now = TimeUtil.nowDB();
    await runInTransaction(async (tx) => {
      await tx.run(
        `INSERT INTO switch_scene (scene_name, action, switches, sort_order, device_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, '空调', ?, ?)`,
        [scene_name, action, JSON.stringify(switchesArr), sort_order || 0, now, now]
      );
    });
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '创建空调场景',
      target_type: 'switch_scene',
      new_value: JSON.stringify({ scene_name, action, switches: switchesArr.length }),
      remark: `新增空调场景: ${scene_name} (${action})`
    });
    res.json({ success: true });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: '场景名称已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新空调场景
router.put('/api/admin/ac-scenes/:id', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { scene_name, action, switches, sort_order } = req.body;

    const existing = await get('SELECT id FROM switch_scene WHERE id = ? AND device_type = "空调"', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '场景不存在' });
    }

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

    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '更新空调场景',
      target_type: 'switch_scene',
      target_id: req.params.id,
      new_value: JSON.stringify(req.body),
      remark: `更新空调场景: ID=${req.params.id}`
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除空调场景
router.delete('/api/admin/ac-scenes/:id', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const existing = await get('SELECT scene_name, action FROM switch_scene WHERE id = ? AND device_type = "空调"', [req.params.id]);
    await runInTransaction(async (tx) => {
      await tx.run('DELETE FROM switch_scene WHERE id = ? AND device_type = "空调"', [req.params.id]);
    });
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '删除空调场景',
      target_type: 'switch_scene',
      target_id: req.params.id,
      old_value: existing ? JSON.stringify(existing) : null,
      remark: existing ? `删除空调场景: ${existing.scene_name} (${existing.action})` : `删除空调场景 ID=${req.params.id}`
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ============================================================
// 3. 前台控制 API（H5用）
// ============================================================

// 获取自动关空调状态
router.get('/api/ac/auto-status', requireSwitchPermission, async (req, res) => {
  try {
    const settings = await getAutoOffSettings();
    res.json({
      auto_off_enabled: settings.ac_auto_off
    });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 切换自动关空调启停
router.post('/api/ac/auto-off-toggle', requireSwitchPermission, async (req, res) => {
  try {
    const settings = await getAutoOffSettings();
    const newValue = !settings.ac_auto_off;
    await setAutoOffSettings({ ...settings, ac_auto_off: newValue });
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '切换自动关空调',
      target_type: 'system_config',
      old_value: String(settings.ac_auto_off),
      new_value: String(newValue),
      remark: `自动关空调: ${newValue ? '开启' : '关闭'}`
    });
    res.json({ success: true, enabled: newValue });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 手动执行一次智能省电（自动关空调）
router.post('/api/ac/auto-off-manual', requireSwitchPermission, async (req, res) => {
  try {
    const result = await executeAutoOffAC();
    const independentResult = await executeAutoOffACTableIndependent();
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '手动触发自动关空调',
      target_type: 'ac_control',
      new_value: JSON.stringify({ turnedOff: result.turnedOffCount, independent: independentResult?.turnedOffCount || 0 }),
      remark: `手动关空调: ${result.turnedOffCount || 0} + ${independentResult?.turnedOffCount || 0} 个空调`
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

// 执行空调场景
router.post('/api/ac/scene/:id', requireSwitchPermission, async (req, res) => {
  try {
    const scene = await get('SELECT * FROM switch_scene WHERE id = ? AND device_type = "空调"', [req.params.id]);
    if (!scene) return res.status(404).json({ error: '场景不存在' });

    let switches;
    try {
      switches = JSON.parse(scene.switches);
    } catch (e) {
      return res.status(400).json({ error: '场景开关数据格式错误' });
    }

    const acConfig = await require('../services/mqtt-ac').getACConfig();
    const failures = [];
    let successCount = 0;

    for (const sw of switches) {
      let result;
      if (scene.action === 'ON') {
        result = await require('../services/mqtt-ac').sendACOnCommand(sw.switch_id, sw.switch_seq, acConfig);
      } else {
        result = await require('../services/mqtt-ac').sendACOffCommand(sw.switch_id, sw.switch_seq);
      }
      if (result.ok) successCount++;
      else failures.push({ ...sw, error: result.error });
      await new Promise(r => setTimeout(r, 100));
    }

    if (failures.length > 0) {
      return res.status(502).json({
        error: `MQTT 发送失败：${failures.length}/${switches.length} 个失败`,
        details: failures.map(f => f.error)
      });
    }

    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '执行空调场景',
      target_type: 'switch_scene',
      target_id: req.params.id,
      new_value: JSON.stringify({ scene_name: scene.scene_name, action: scene.action, count: successCount }),
      remark: `执行空调场景: ${scene.scene_name} (${scene.action}) - ${successCount} 个空调`
    });
    res.json({ success: true, count: successCount });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 按标签批量控制空调
router.post('/api/ac/label-control', requireSwitchPermission, async (req, res) => {
  try {
    const { label, action } = req.body;
    if (!label || !action) return res.status(400).json({ error: '缺少参数' });
    if (!['ON', 'OFF'].includes(action)) return res.status(400).json({ error: '动作只能是 ON 或 OFF' });

    const result = await controlACByLabel(label, action);
    if (result.totalCount === 0) {
      return res.status(400).json({ error: `标签 "${label}" 下没有关联空调` });
    }
    if (result.failures.length > 0) {
      return res.status(502).json({
        error: `MQTT 发送失败：${result.failures.length}/${result.totalCount} 个失败`,
        details: result.failures.map(f => f.error)
      });
    }
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '标签批量控制空调',
      target_type: 'ac_control',
      new_value: JSON.stringify({ label, action, count: result.successCount }),
      remark: `标签控制空调: ${label} -> ${action} (${result.successCount} 个空调)`
    });
    res.json({ success: true, count: result.successCount });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取空调标签列表
router.get('/api/ac/labels', requireSwitchPermission, async (req, res) => {
  try {
    const rows = await all('SELECT DISTINCT switch_label FROM switch_device WHERE device_type = "空调" AND switch_label != "" ORDER BY switch_label');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取空调场景列表（前台用）
router.get('/api/ac/scenes', requireSwitchPermission, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM switch_scene WHERE device_type = "空调" ORDER BY sort_order, id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取台桌列表及其关联空调（前台用）
router.get('/api/ac/tables', requireSwitchPermission, async (req, res) => {
  try {
    const tableDevices = await all(
      'SELECT td.table_name_en, td.switch_seq, td.switch_label, sd.switch_id ' +
      'FROM table_device td INNER JOIN switch_device sd ON td.switch_seq = sd.switch_seq AND td.switch_label = sd.switch_label AND sd.device_type = "空调" ' +
      'ORDER BY td.table_name_en'
    );

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
    for (let i = 1; i <= 30; i++) {
      nameMap['putai' + i] = { name: '普台' + i, area: '大厅区' };
    }

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

    const result = [];
    for (const [key, table] of Object.entries(tableMap)) {
      const info = nameMap[key.toLowerCase()] || { name: key, area: '' };
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

// 按台桌控制空调
router.post('/api/ac/table-control', requireSwitchPermission, async (req, res) => {
  try {
    const { table_name_en, action } = req.body;
    if (!table_name_en || !action) return res.status(400).json({ error: '缺少参数' });
    if (!['ON', 'OFF'].includes(action)) return res.status(400).json({ error: '动作只能是 ON 或 OFF' });

    const result = await controlACByTable(table_name_en, action);
    if (result.totalCount === 0) {
      return res.status(400).json({ error: `台桌 "${table_name_en}" 下没有关联空调` });
    }
    if (result.failures.length > 0) {
      return res.status(502).json({
        error: `MQTT 发送失败：${result.failures.length}/${result.totalCount} 个失败`,
        details: result.failures.map(f => f.error)
      });
    }
    const user = req.user;
    operationLogService.logToFile({
      operator_phone: user.username,
      operator_name: user.name,
      operation_type: '台桌控制空调',
      target_type: 'ac_control',
      new_value: JSON.stringify({ table_name_en, action, count: result.successCount }),
      remark: `台桌控制空调: ${table_name_en} -> ${action} (${result.successCount} 个空调)`
    });
    res.json({ success: true, count: result.successCount, table_name_en });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ============================================================
// 4. 自动关空调触发函数（供 sync/tables 调用）
// ============================================================

async function triggerAutoOffACIfEligible(tablesUpdated, vipRoomsUpdated) {
  const totalUpdated = tablesUpdated + vipRoomsUpdated;
  if (totalUpdated < 40) {
    return { triggered: false, reason: `更新条数 ${totalUpdated} < 40` };
  }

  try {
    const result = await executeAutoOffAC();
    // 台桌无关关空调已移到 Cron 定时任务，不再在此触发
    return {
      triggered: true,
      ...result,
      independentTurnedOffCount: 0
    };
  } catch (err) {
    console.error(`[自动关空调触发] 执行失败: ${err.message}`);
    return { triggered: true, status: 'error', error: err.message };
  }
}

module.exports = { router, triggerAutoOffACIfEligible };
