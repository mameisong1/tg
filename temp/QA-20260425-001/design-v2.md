# 天宫QA项目技术方案设计 V2

## 项目背景

空调控制功能适配，基于现有灯控制系统进行扩展。

## 现有问题分析（已修复）

| 问题编号 | 问题描述 | 状态 |
|---------|---------|------|
| ❌ P1 | 遗漏前台H5会员中心智能空调入口 | ✅ 已修复 |
| ❌ P2 | API数量不足，缺少场景列表、标签列表、台桌关联列表等查询API | ✅ 已修复 |
| ❌ P3 | 未提到 server.js 修改 | ✅ 已修复 |
| ❌ P4 | 未提到 pages.json 修改 | ✅ 已修复 |

---

## 一、数据库设计

### 1.1 switch_device 表（扩展字段）

**已有表结构**：
```sql
CREATE TABLE switch_device (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  switch_id TEXT NOT NULL,           -- MQTT设备ID
  switch_seq TEXT NOT NULL,          -- 开关序号（如1,2,3）
  switch_label TEXT NOT NULL,        -- 开关标签（如普台、VIP、BOSS）
  auto_off_start TEXT DEFAULT '',    -- 自动关灯开始时间（HH:MM）
  auto_off_end TEXT DEFAULT '',      -- 自动关灯结束时间（HH:MM）
  auto_on_start TEXT DEFAULT '',     -- 自动开灯开始时间（预留）
  auto_on_end TEXT DEFAULT '',       -- 自动开灯结束时间（预留）
  device_type TEXT DEFAULT '灯',     -- ✅ 设备类型（灯/空调）
  remark TEXT DEFAULT '',            -- 备注
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(switch_id, switch_seq)
);
```

**字段说明**：
- `device_type` 字段已存在，支持 "灯" 和 "空调"
- 自动关灯时间段字段适用于空调（自动关空调时段）

### 1.2 table_device 表（无变更）

**已有表结构**：
```sql
CREATE TABLE table_device (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name_en TEXT NOT NULL,       -- 台桌英文名（putai1, vip1, boss1）
  switch_seq TEXT NOT NULL,          -- 开关序号
  switch_label TEXT NOT NULL,        -- 开关标签
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**说明**：
- 该表关联台桌与开关设备（灯/空调）
- 一个台桌可关联多个开关设备（灯+空调）

### 1.3 system_config 表（新增空调设定）

**已有表结构**：
```sql
CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,               -- JSON格式配置
  description TEXT,
  updated_at TEXT NOT NULL
);
```

**新增配置项**：
```json
{
  "key": "ac_control",
  "value": "{\"temp_set\":23,\"fan_speed_enum\":\"auto\"}",
  "description": "空调设定配置"
}
```

---

## 二、后端设计

### 2.1 server.js 修改

**修改位置**：`/TG/tgservice/backend/server.js` 第 39-40 行

**修改内容**：
```javascript
// 智能开关路由模块（已有）
const { router: switchRouter, triggerAutoOffIfEligible } = require('./routes/switch-routes');

// ✅ 新增：智能空调路由模块
const { router: acRouter, triggerAutoOffACIfEligible } = require('./routes/ac-routes');
```

**挂载路由**（约第 200 行）：
```javascript
// 智能开关路由（已有）
app.use('/api', switchRouter);

// ✅ 新增：智能空调路由
app.use('/api', acRouter);
```

---

### 2.2 新增服务：backend/services/auto-off-ac.js

**文件路径**：`/TG/tgservice/backend/services/auto-off-ac.js`

**核心逻辑**：

```javascript
/**
 * 自动关空调服务
 * 
 * 逻辑：可能要关的空调 - 不能关的空调 = 要关的空调
 * 支持跨午夜时间判断（如 22:00~06:00）
 */

const TimeUtil = require('../utils/time');
const { all, get } = require('../db/index');
const { sendACCommand, sendACOffCommand } = require('./mqtt-ac');

/**
 * 执行自动关空调（台桌相关）
 * @returns {Object} { status, maybeOffCount, cannotOffCount, turnedOffCount }
 */
async function executeAutoOffAC() {
  // 1. 检查自动关空调功能是否开启
  const setting = await get("SELECT value FROM system_settings WHERE key = 'ac_auto_off_enabled'");
  if (!setting || setting.value !== '1') {
    console.log('[自动关空调] 功能未开启，跳过');
    return { status: 'disabled' };
  }

  const now = TimeUtil.nowDB();

  // 2. 查询"可能要关的空调"：空闲台桌 + 在自动关空调时段内
  const maybeOff = await all(`
    SELECT DISTINCT sd.switch_id, sd.switch_seq
    FROM tables t
    JOIN table_device td ON LOWER(td.table_name_en) = LOWER(t.name_pinyin)
    JOIN switch_device sd ON sd.switch_seq = td.switch_seq AND sd.switch_label = td.switch_label
    WHERE t.status = '空闲'
      AND sd.device_type = '空调'
      AND sd.auto_off_start != ''
      AND sd.auto_off_end != ''
      AND (
        CASE
          WHEN sd.auto_off_start <= sd.auto_off_end THEN
            (TIME(?) >= TIME(sd.auto_off_start) AND TIME(?) <= TIME(sd.auto_off_end))
          ELSE
            (TIME(?) >= TIME(sd.auto_off_start) OR TIME(?) <= TIME(sd.auto_off_end))
        END
      )
  `, [now, now, now, now]);

  if (maybeOff.length === 0) {
    console.log('[自动关空调] 无需要关的空调');
    return { status: 'ok', maybeOffCount: 0, cannotOffCount: 0, turnedOffCount: 0 };
  }

  // 3. 查询"不能关的空调"：非空闲台桌 + 在自动关空调时段内
  const cannotOff = await all(`
    SELECT DISTINCT sd.switch_id, sd.switch_seq
    FROM tables t
    JOIN table_device td ON LOWER(td.table_name_en) = LOWER(t.name_pinyin)
    JOIN switch_device sd ON sd.switch_seq = td.switch_seq AND sd.switch_label = td.switch_label
    WHERE t.status != '空闲'
      AND sd.device_type = '空调'
      AND sd.auto_off_start != ''
      AND sd.auto_off_end != ''
      AND (
        CASE
          WHEN sd.auto_off_start <= sd.auto_off_end THEN
            (TIME(?) >= TIME(sd.auto_off_start) AND TIME(?) <= TIME(sd.auto_off_end))
          ELSE
            (TIME(?) >= TIME(sd.auto_off_start) OR TIME(?) <= TIME(sd.auto_off_end))
        END
      )
  `, [now, now, now, now]);

  // 4. 集合差集：可能要关 - 不能关 = 要关
  const maybeOffSet = new Set(maybeOff.map(s => `${s.switch_id}|${s.switch_seq}`));
  const cannotOffSet = new Set(cannotOff.map(s => `${s.switch_id}|${s.switch_seq}`));

  const toTurnOff = [...maybeOffSet]
    .filter(key => !cannotOffSet.has(key))
    .map(key => {
      const [switch_id, switch_seq] = key.split('|');
      return { switch_id, switch_seq };
    });

  console.log(`[自动关空调] 可能要关 ${maybeOff.length} 个, 不能关 ${cannotOff.length} 个, 实际要关 ${toTurnOff.length} 个`);

  if (toTurnOff.length === 0) {
    return { status: 'ok', maybeOffCount: maybeOff.length, cannotOffCount: cannotOff.length, turnedOffCount: 0 };
  }

  // 5. 发送 MQTT 关空调指令（⚠️ 开发时只写日志，不执行真实指令）
  const sendResult = await sendACOffCommand(toTurnOff);
  const turnedOffCount = sendResult?.successCount ?? sendResult ?? 0;

  return {
    status: 'ok',
    maybeOffCount: maybeOff.length,
    cannotOffCount: cannotOff.length,
    turnedOffCount
  };
}

/**
 * 执行台桌无关自动关空调
 * @returns {Object} { status, turnedOffCount }
 */
async function executeAutoOffACTableIndependent() {
  // 1. 检查自动关空调功能是否开启
  const setting = await get("SELECT value FROM system_settings WHERE key = 'ac_auto_off_enabled'");
  if (!setting || setting.value !== '1') {
    console.log('[自动关空调-台桌无关] 功能未开启，跳过');
    return { status: 'disabled', turnedOffCount: 0 };
  }

  const now = TimeUtil.nowDB();

  // 2. 查询台桌无关的空调设备
  const switches = await all(`
    SELECT DISTINCT sd.switch_id, sd.switch_seq
    FROM switch_device sd
    LEFT JOIN table_device td 
      ON LOWER(sd.switch_label) = LOWER(td.switch_label) 
      AND LOWER(sd.switch_seq) = LOWER(td.switch_seq)
    WHERE td.table_name_en IS NULL
      AND sd.device_type = '空调'
      AND sd.auto_off_start != ''
      AND sd.auto_off_end != ''
      AND (
        CASE
          WHEN sd.auto_off_start <= sd.auto_off_end THEN
            (TIME(?) >= TIME(sd.auto_off_start) AND TIME(?) <= TIME(sd.auto_off_end))
          ELSE
            (TIME(?) >= TIME(sd.auto_off_start) OR TIME(?) <= TIME(sd.auto_off_end))
        END
      )
  `, [now, now, now, now]);

  if (switches.length === 0) {
    console.log('[自动关空调-台桌无关] 无需要关的空调');
    return { status: 'ok', turnedOffCount: 0 };
  }

  console.log(`[自动关空调-台桌无关] 查询到 ${switches.length} 个台桌无关空调`);

  // 3. 发送 MQTT 关空调指令
  const sendResult = await sendACOffCommand(switches);
  const turnedOffCount = sendResult?.successCount ?? sendResult ?? 0;

  return { status: 'ok', turnedOffCount };
}

module.exports = { executeAutoOffAC, executeAutoOffACTableIndependent };
```

---

### 2.3 新增服务：backend/services/mqtt-ac.js

**文件路径**：`/TG/tgservice/backend/services/mqtt-ac.js`

**核心逻辑**：

```javascript
/**
 * MQTT 智能空调控制模块
 * 
 * 测试环境（TGSERVICE_ENV === 'test'）：只写日志，不发送真实MQTT指令
 * 生产环境：真实发送MQTT指令
 */

const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');

// 加载配置文件
const env = process.env.TGSERVICE_ENV || 'production';
const configFileName = env === 'test' ? '.config.env' : '.config';
const configPath = path.join(__dirname, '../../' + configFileName);
let config = {};
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (err) {
  console.error('[MQTT-AC] 加载配置文件失败:', err.message);
}

const isTestEnv = (config.env?.name === 'test') || (env === 'test');

let client = null;
let connecting = false;

/**
 * 获取空调设定配置
 */
async function getACConfig() {
  const { get } = require('../db/index');
  const row = await get('SELECT value FROM system_config WHERE key = "ac_control"');
  if (!row) {
    return { temp_set: 23, fan_speed_enum: 'auto' };
  }
  return JSON.parse(row.value);
}

/**
 * 发送空调开启指令
 * @param {string} dev_id - 设备ID
 * @param {string} node_id - 节点ID
 * @param {Object} acConfig - 空调设定 { temp_set, fan_speed_enum }
 * @returns {Object} { ok: boolean, error?: string }
 */
async function sendACOnCommand(dev_id, node_id, acConfig) {
  const mqttConfig = config.mqtt_ac;
  if (!mqttConfig) {
    console.warn('[MQTT-AC] 未配置 MQTT 空调，跳过指令');
    return { ok: true, error: null };
  }

  // ⚠️ 开发时只写日志，不执行真实指令
  if (isTestEnv) {
    console.log(`[MQTT-AC][测试环境] 跳过真实发送: ${dev_id} ${node_id} ON, temp=${acConfig.temp_set}, fan=${acConfig.fan_speed_enum}`);
    return { ok: true, error: null };
  }

  // 空调开启指令格式
  const payload = JSON.stringify({
    dev_id,
    node_id,
    switch: true,
    temp_set: acConfig.temp_set,
    mode: "cold",
    fan_speed_enum: acConfig.fan_speed_enum
  });

  try {
    const mqttClient = await getClient();
    if (!mqttClient) {
      return { ok: false, error: 'MQTT 客户端不可用' };
    }
    mqttClient.publish(mqttConfig.topic, payload, { qos: 1 });
    console.log(`[MQTT-AC] 开空调指令已发送: ${dev_id} ${node_id} ON`);
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * 发送空调关闭指令
 * @param {string} dev_id - 设备ID
 * @param {string} node_id - 节点ID
 * @returns {Object} { ok: boolean, error?: string }
 */
async function sendACOffCommand(dev_id, node_id) {
  const mqttConfig = config.mqtt_ac;
  if (!mqttConfig) {
    console.warn('[MQTT-AC] 未配置 MQTT 空调，跳过指令');
    return { ok: true, error: null };
  }

  // ⚠️ 开发时只写日志，不执行真实指令
  if (isTestEnv) {
    console.log(`[MQTT-AC][测试环境] 跳过真实发送: ${dev_id} ${node_id} OFF`);
    return { ok: true, error: null };
  }

  // 空调关闭指令格式
  const payload = JSON.stringify({
    dev_id,
    node_id,
    switch: false
  });

  try {
    const mqttClient = await getClient();
    if (!mqttClient) {
      return { ok: false, error: 'MQTT 客户端不可用' };
    }
    mqttClient.publish(mqttConfig.topic, payload, { qos: 1 });
    console.log(`[MQTT-AC] 关空调指令已发送: ${dev_id} ${node_id} OFF`);
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * 批量发送空调关闭指令
 * @param {Array} switches - [{switch_id, switch_seq}]
 * @returns {Object} { successCount, totalCount, failures }
 */
async function sendACOffBatch(switches) {
  const failures = [];
  let successCount = 0;
  
  for (const sw of switches) {
    const result = await sendACOffCommand(sw.switch_id, sw.switch_seq);
    if (result.ok) {
      successCount++;
    } else {
      failures.push({ switch_id: sw.switch_id, switch_seq: sw.switch_seq, error: result.error });
    }
    await new Promise(r => setTimeout(r, 100));
  }
  
  return { successCount, totalCount: switches.length, failures };
}

/**
 * 按标签批量控制空调
 */
async function controlACByLabel(label, action) {
  const { all } = require('../db/index');
  const acConfig = await getACConfig();

  const devices = await all(
    'SELECT DISTINCT switch_id, switch_seq FROM switch_device WHERE switch_label = ? AND device_type = "空调"',
    [label]
  );

  if (devices.length === 0) {
    return { successCount: 0, totalCount: 0, failures: [] };
  }

  const failures = [];
  let successCount = 0;

  for (const dev of devices) {
    if (action === 'ON') {
      const result = await sendACOnCommand(dev.switch_id, dev.switch_seq, acConfig);
      if (result.ok) successCount++;
      else failures.push({ ...dev, error: result.error });
    } else {
      const result = await sendACOffCommand(dev.switch_id, dev.switch_seq);
      if (result.ok) successCount++;
      else failures.push({ ...dev, error: result.error });
    }
    await new Promise(r => setTimeout(r, 100));
  }

  return { successCount, totalCount: devices.length, failures };
}

/**
 * 按台桌批量控制空调
 */
async function controlACByTable(tableNameEn, action) {
  const { all } = require('../db/index');
  const acConfig = await getACConfig();

  const devices = await all(
    'SELECT DISTINCT sd.switch_id, sd.switch_seq ' +
    'FROM table_device td ' +
    'JOIN switch_device sd ON td.switch_seq = sd.switch_seq AND td.switch_label = sd.switch_label ' +
    'WHERE td.table_name_en = ? AND sd.device_type = "空调"',
    [tableNameEn]
  );

  if (devices.length === 0) {
    return { successCount: 0, totalCount: 0, failures: [] };
  }

  const failures = [];
  let successCount = 0;

  for (const dev of devices) {
    if (action === 'ON') {
      const result = await sendACOnCommand(dev.switch_id, dev.switch_seq, acConfig);
      if (result.ok) successCount++;
      else failures.push({ ...dev, error: result.error });
    } else {
      const result = await sendACOffCommand(dev.switch_id, dev.switch_seq);
      if (result.ok) successCount++;
      else failures.push({ ...dev, error: result.error });
    }
    await new Promise(r => setTimeout(r, 100));
  }

  return { successCount, totalCount: devices.length, failures };
}

module.exports = {
  getClient,
  getACConfig,
  sendACOnCommand,
  sendACOffCommand,
  sendACOffBatch,
  controlACByLabel,
  controlACByTable,
  isTestEnv
};
```

---

### 2.4 新增路由：backend/routes/ac-routes.js

**文件路径**：`/TG/tgservice/backend/routes/ac-routes.js`

**完整 API 列表**：

| API | 方法 | 用途 | 权限 |
|-----|------|------|------|
| `/api/admin/ac-devices` | GET | 获取空调设备列表 | 后台 vipRoomManagement |
| `/api/admin/ac-devices` | POST | 新增空调设备 | 后台 vipRoomManagement |
| `/api/admin/ac-devices/:id` | PUT | 更新空调设备 | 后台 vipRoomManagement |
| `/api/admin/ac-devices/:id` | DELETE | 删除空调设备 | 后台 vipRoomManagement |
| `/api/admin/ac-control` | GET | 获取空调设定配置 | 后台 vipRoomManagement |
| `/api/admin/ac-control` | PUT | 更新空调设定配置 | 后台 vipRoomManagement |
| `/api/admin/ac-scenes` | GET | 获取空调场景列表 | 后台 vipRoomManagement |
| `/api/admin/ac-scenes` | POST | 新增空调场景 | 后台 vipRoomManagement |
| `/api/admin/ac-scenes/:id` | PUT | 更新空调场景 | 后台 vipRoomManagement |
| `/api/admin/ac-scenes/:id` | DELETE | 删除空调场景 | 后台 vipRoomManagement |
| `/api/ac/auto-status` | GET | 获取自动关空调状态 | 前台 requireSwitchPermission |
| `/api/ac/auto-off-toggle` | POST | 切换自动关空调启停 | 前台 requireSwitchPermission |
| `/api/ac/auto-off-manual` | POST | 手动执行一次自动关空调 | 前台 requireSwitchPermission |
| `/api/ac/scene/:id` | POST | 执行空调场景 | 前台 requireSwitchPermission |
| `/api/ac/label-control` | POST | 按标签批量控制空调 | 前台 requireSwitchPermission |
| `/api/ac/labels` | GET | 获取空调标签列表 | 前台 requireSwitchPermission |
| `/api/ac/scenes` | GET | 获取空调场景列表 | 前台 requireSwitchPermission |
| `/api/ac/tables` | GET | 获取台桌列表及关联空调 | 前台 requireSwitchPermission |
| `/api/ac/table-control` | POST | 按台桌控制空调 | 前台 requireSwitchPermission |

**核心代码框架**：

```javascript
const express = require('express');
const router = express.Router();
const TimeUtil = require('../utils/time');
const { all, get, run, enqueueRun, runInTransaction } = require('../db/index');
const { requireBackendPermission } = require('../middleware/permission');
const operationLogService = require('../services/operation-log');
const { executeAutoOffAC, executeAutoOffACTableIndependent } = require('../services/auto-off-ac');
const { controlACByLabel, controlACByTable } = require('../services/mqtt-ac');

// 前台权限中间件
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

// ... 其他 API 实现（完整代码略）

// ============================================================
// 2. 空调场景 API（后台）
// ============================================================

// 使用 switch_scene 表，但筛选空调相关场景
// scene 表增加 device_type 字段

// ============================================================
// 3. 前台控制 API（H5用）
// ============================================================

router.get('/api/ac/auto-status', requireSwitchPermission, async (req, res) => {
  try {
    const setting = await get("SELECT value FROM system_settings WHERE key = 'ac_auto_off_enabled'");
    res.json({
      auto_off_enabled: setting?.value === '1'
    });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/api/ac/auto-off-toggle', requireSwitchPermission, async (req, res) => {
  try {
    const current = await get("SELECT value FROM system_settings WHERE key = 'ac_auto_off_enabled'");
    const newValue = current?.value === '1' ? '0' : '1';
    const now = TimeUtil.nowDB();
    await enqueueRun(
      `INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('ac_auto_off_enabled', ?, ?)`,
      [newValue, now]
    );
    res.json({ success: true, enabled: newValue === '1' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/api/ac/auto-off-manual', requireSwitchPermission, async (req, res) => {
  try {
    const result = await executeAutoOffAC();
    const independentResult = await executeAutoOffACTableIndependent();
    res.json({
      success: true,
      turnedOffCount: result.turnedOffCount || 0,
      independentTurnedOffCount: independentResult?.turnedOffCount || 0
    });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/api/ac/labels', requireSwitchPermission, async (req, res) => {
  try {
    const rows = await all('SELECT DISTINCT switch_label FROM switch_device WHERE device_type = "空调" AND switch_label != "" ORDER BY switch_label');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/api/ac/scenes', requireSwitchPermission, async (req, res) => {
  try {
    // 使用 switch_scene 表，筛选空调场景
    const rows = await all('SELECT * FROM switch_scene WHERE device_type = "空调" ORDER BY sort_order, id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/api/ac/tables', requireSwitchPermission, async (req, res) => {
  try {
    const tableDevices = await all(
      'SELECT td.table_name_en, td.switch_seq, td.switch_label, sd.switch_id ' +
      'FROM table_device td LEFT JOIN switch_device sd ON td.switch_seq = sd.switch_seq AND td.switch_label = sd.switch_label AND sd.device_type = "空调" ' +
      'ORDER BY td.table_name_en'
    );

    // 按台桌分组（同 switch-routes.js 逻辑）
    const tableMap = {};
    for (const td of tableDevices) {
      if (!tableMap[td.table_name_en]) {
        tableMap[td.table_name_en] = { table_name_en: td.table_name_en, switches: [] };
      }
      if (td.switch_id) {
        tableMap[td.table_name_en].switches.push({
          switch_id: td.switch_id,
          switch_seq: td.switch_seq
        });
      }
    }

    // 合并中文名称（同 switch-routes.js）
    const result = [];
    for (const [key, table] of Object.entries(tableMap)) {
      const nameMap = { /* 同 switch-routes.js */ };
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

router.post('/api/ac/label-control', requireSwitchPermission, async (req, res) => {
  try {
    const { label, action } = req.body;
    if (!label || !action) return res.status(400).json({ error: '缺少参数' });
    
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
    
    res.json({ success: true, count: result.successCount });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/api/ac/table-control', requireSwitchPermission, async (req, res) => {
  try {
    const { table_name_en, action } = req.body;
    if (!table_name_en || !action) return res.status(400).json({ error: '缺少参数' });
    
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
    const independentResult = await executeAutoOffACTableIndependent();
    return {
      triggered: true,
      ...result,
      independentTurnedOffCount: independentResult?.turnedOffCount || 0
    };
  } catch (err) {
    console.error(`[自动关空调触发] 执行失败: ${err.message}`);
    return { triggered: true, status: 'error', error: err.message };
  }
}

module.exports = { router, triggerAutoOffACIfEligible };
```

---

### 2.5 现有路由修改：backend/routes/switch-routes.js

**修改位置1**：`/api/admin/switches` GET 接口（增加设备类型筛选）

**修改内容**：
```javascript
// 原代码（第 34-38 行）
router.get('/api/admin/switches', requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const rows = await all('SELECT * FROM switch_device ORDER BY switch_label, switch_id, switch_seq');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ✅ 修改后（增加 device_type 筛选）
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
```

**修改位置2**：`/api/admin/switches` POST 接口（增加 device_type 字段）

**修改内容**：
```javascript
// 原代码（第 47-55 行）
await runInTransaction(async (tx) => {
  await tx.run(
    `INSERT INTO switch_device (switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, remark, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [switch_id, switch_seq, switch_label, auto_off_start || '', auto_off_end || '', remark || '', now, now]
  );
});

// ✅ 修改后（增加 device_type）
await runInTransaction(async (tx) => {
  await tx.run(
    `INSERT INTO switch_device (switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, auto_on_start, auto_on_end, device_type, remark, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [switch_id, switch_seq, switch_label, auto_off_start || '', auto_off_end || '', auto_on_start || '', auto_on_end || '', device_type || '灯', remark || '', now, now]
  );
});
```

---

### 2.6 现有服务修改：backend/services/auto-off-lighting.js

**修改位置**：所有查询 SQL 增加 `device_type = "灯"` 筛选

**修改内容**：
```javascript
// 原代码（第 20-32 行）
const maybeOff = await all(`
  SELECT DISTINCT sd.switch_id, sd.switch_seq
  FROM tables t
  JOIN table_device td ON LOWER(td.table_name_en) = LOWER(t.name_pinyin)
  JOIN switch_device sd ON sd.switch_seq = td.switch_seq AND sd.switch_label = td.switch_label
  WHERE t.status = '空闲'
    AND sd.auto_off_start != ''
    AND sd.auto_off_end != ''
    AND (...)
`, [now, now, now, now]);

// ✅ 修改后（增加 device_type 筛选）
const maybeOff = await all(`
  SELECT DISTINCT sd.switch_id, sd.switch_seq
  FROM tables t
  JOIN table_device td ON LOWER(td.table_name_en) = LOWER(t.name_pinyin)
  JOIN switch_device sd ON sd.switch_seq = td.switch_seq AND sd.switch_label = td.switch_label
  WHERE t.status = '空闲'
    AND sd.device_type = '灯'
    AND sd.auto_off_start != ''
    AND sd.auto_off_end != ''
    AND (...)
`, [now, now, now, now]);
```

---

## 三、前端H5设计

### 3.1 pages.json 修改

**新增页面**：
```json
{
  "path": "pages/internal/ac-control",
  "style": {
    "navigationBarTitleText": "智能空调管理",
    "navigationBarBackgroundColor": "#0a0a0f",
    "navigationBarTextStyle": "white",
    "navigationStyle": "custom"
  }
}
```

**插入位置**：在 `pages/internal/switch-control` 之后（约第 18 行）

---

### 3.2 member.vue 修改（管理功能板块）

**修改位置**：管理功能板块（约第 140 行）

**修改内容**：
```vue
<!-- 组1: 管理（含智能开关+智能空调） -->
<view class="group-section">
  <view class="section-header">
    <text class="section-title">📋 管理</text>
  </view>
  <view class="internal-btns">
    <view class="internal-btn" @click="navigateTo('/pages/internal/water-board')">
      <text class="internal-btn-icon">📋</text>
      <text class="internal-btn-text">水牌管理</text>
    </view>
    <view class="internal-btn" @click="navigateTo('/pages/internal/leave-calendar')">
      <text class="internal-btn-icon">📅</text>
      <text class="internal-btn-text">助教日历</text>
    </view>
    <view class="internal-btn" @click="navigateTo('/pages/internal/reward-penalty-set?type=服务奖罚')">
      <text class="internal-btn-icon">🏆</text>
      <text class="internal-btn-text">服务奖罚</text>
    </view>
    <view class="internal-btn" @click="navigateTo('/pages/internal/reward-penalty-set?type=助教奖罚')">
      <text class="internal-btn-icon">⚠️</text>
      <text class="internal-btn-text">助教奖罚</text>
    </view>
    <!-- ✅ 智能开关（已有） -->
    <view class="internal-btn" @click="navigateTo('/pages/internal/switch-control')">
      <text class="internal-btn-icon">💡</text>
      <text class="internal-btn-text">智能开关</text>
    </view>
    <!-- ✅ 新增：智能空调 -->
    <view class="internal-btn" @click="navigateTo('/pages/internal/ac-control')">
      <text class="internal-btn-icon">❄️</text>
      <text class="internal-btn-text">智能空调</text>
    </view>
  </view>
</view>
```

---

### 3.3 新增页面：pages/internal/ac-control.vue

**文件路径**：`/TG/tgservice-uniapp/src/pages/internal/ac-control.vue`

**页面结构**（基于 switch-control.vue 复制修改）：

```vue
<template>
  <view class="page">
    <!-- 固定顶部导航 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">智能空调管理</text>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <scroll-view class="content" scroll-y>
      <!-- 快捷场景卡片 -->
      <view class="card scene-card scene-card-top" v-if="topScenes.length > 0">
        <view class="card-header">
          <text class="card-icon">🎬</text>
          <text class="card-title">快捷场景</text>
        </view>
        <view class="card-body">
          <view class="scene-grid scene-grid-top">
            <view class="scene-btn scene-btn-top"
                  v-for="scene in topScenes"
                  :key="scene.id"
                  :class="scene.action === 'ON' ? 'scene-on' : 'scene-off'"
                  @click="executeScene(scene)">
              <text class="scene-btn-icon scene-btn-icon-top">{{ scene.action === 'ON' ? '❄️' : '🌙' }}</text>
              <text class="scene-btn-text scene-btn-text-top">{{ scene.scene_name }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 智能省电-自动（空调版） -->
      <view class="card auto-off-card">
        <view class="card-header">
          <text class="card-icon">❄️</text>
          <text class="card-title">智能省电-自动</text>
        </view>
        <view class="card-body">
          <view class="toggle-row" @click="toggleAutoOff">
            <text class="toggle-status" :class="autoOffEnabled ? 'on' : 'off'">
              {{ autoOffEnabled ? '已开启' : '已关闭' }}
            </text>
            <view class="toggle-switch" :class="{ active: autoOffEnabled }">
              <view class="toggle-thumb"></view>
            </view>
          </view>
          <text class="toggle-desc">开启后，台桌空闲且处于自动关空调时段时将自动关闭空调（支持跨午夜时段）</text>
          <!-- 手动省电按钮 -->
          <view class="manual-btn" @click="executeManualOff">
            <text class="manual-btn-icon">❄️</text>
            <text class="manual-btn-text">智能省电-手动（测试专用）</text>
          </view>
        </view>
      </view>

      <!-- 台桌控制卡片 -->
      <view class="card table-card">
        <view class="card-header">
          <text class="card-icon">🎱</text>
          <text class="card-title">台桌控制</text>
        </view>
        <view class="card-body">
          <!-- 区域筛选 -->
          <view class="area-btns area-btns-wrap">
            <view class="area-btn" v-for="area in areas" :key="area" :class="{ active: selectedArea === area }" @click="selectArea(area)">
              <text>{{ area }}</text>
            </view>
          </view>
          <!-- 台桌网格 -->
          <view class="table-grid">
            <view class="table-btn" v-for="t in filteredTables" :key="t.table_name_en" @click="selectTable(t)">
              <text class="table-btn-text">{{ t.table_name_cn }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 标签控制卡片 -->
      <view class="card label-card">
        <view class="card-header">
          <text class="card-icon">🔌</text>
          <text class="card-title">标签控制</text>
        </view>
        <view class="card-body">
          <picker mode="selector" :range="labelNames" :value="selectedLabelIndex" @change="onLabelChange">
            <view class="label-picker">
              <text class="label-picker-text">{{ selectedLabel || '选择空调标签' }}</text>
              <text class="label-picker-arrow">▼</text>
            </view>
          </picker>
          <view class="label-actions" v-if="selectedLabel">
            <view class="action-btn btn-on" @click="labelControl('ON')">
              <text>❄️ 开空调</text>
            </view>
            <view class="action-btn btn-off" @click="labelControl('OFF')">
              <text>🌙 关空调</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 全部开空调/全部关空调 -->
      <view class="card scene-card scene-card-bottom" v-if="bottomScenes.length > 0">
        <view class="card-body">
          <view class="scene-grid scene-grid-bottom">
            <view class="scene-btn scene-btn-bottom"
                  v-for="scene in bottomScenes"
                  :key="scene.id"
                  :class="scene.action === 'ON' ? 'scene-on' : 'scene-off'"
                  @click="executeScene(scene)">
              <text class="scene-btn-icon scene-btn-icon-small">{{ scene.action === 'ON' ? '❄️' : '🌙' }}</text>
              <text class="scene-btn-text scene-btn-text-small">{{ scene.scene_name }}</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 操作确认弹窗 -->
    <view class="confirm-overlay" v-if="showConfirm" @click="closeConfirm">
      <view class="confirm-box" @click.stop>
        <text class="confirm-title">确认操作</text>
        <text class="confirm-text">{{ confirmText }}</text>
        <view class="confirm-buttons">
          <view class="confirm-btn cancel" @click="closeConfirm"><text>取消</text></view>
          <view class="confirm-btn ok" @click="confirmAction"><text>确认</text></view>
        </view>
      </view>
    </view>

    <!-- 台桌控制弹窗 -->
    <view class="confirm-overlay" v-if="showTableConfirm" @click="closeTableConfirm">
      <view class="confirm-box table-confirm" @click.stop>
        <text class="confirm-title">{{ selectedTable?.table_name_cn || '' }}</text>
        <text class="confirm-text">选择操作</text>
        <view class="confirm-buttons">
          <view class="confirm-btn cancel" @click="closeTableConfirm"><text>取消</text></view>
          <view class="confirm-btn ok btn-on-action" @click="tableControlAction('ON')"><text>❄️ 开空调</text></view>
          <view class="confirm-btn cancel btn-off-action" @click="tableControlAction('OFF')"><text>🌙 关空调</text></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import errorReporter from '@/utils/error-reporter.js'

const statusBarHeight = ref(20)
const autoOffEnabled = ref(false)
const scenes = ref([])
const labels = ref([])
const labelNames = computed(() => labels.value.map(l => l.switch_label))
const selectedLabelIndex = ref(-1)
const selectedLabel = ref('')
const showConfirm = ref(false)
const confirmText = ref('')
let pendingAction = null

// 台桌控制
const tables = ref([])
const areas = computed(() => [...new Set(tables.value.map(t => t.area).filter(Boolean))])
const selectedArea = ref('')
const filteredTables = computed(() => {
  if (!selectedArea.value) return tables.value
  return tables.value.filter(t => t.area === selectedArea.value)
})
const showTableConfirm = ref(false)
const selectedTable = ref(null)

// 场景分组
const topScenes = computed(() => scenes.value.filter(s => !['全部开空调', '全部关空调'].includes(s.scene_name)))
const bottomScenes = computed(() => scenes.value.filter(s => ['全部开空调', '全部关空调'].includes(s.scene_name)))

onLoad(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  checkPermission()
  loadAllData()
})

async function checkPermission() {
  const adminInfo = uni.getStorageSync('adminInfo') || {}
  const role = adminInfo.role
  const allowed = ['店长', '助教管理', '管理员']
  if (!allowed.includes(role)) {
    uni.showToast({ title: '权限不足，仅店长/助教管理/管理员可用', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 1500)
  }
}

async function apiRequest(url, method = 'GET', data = null) {
  const adminToken = uni.getStorageSync('adminToken')
  const coachToken = uni.getStorageSync('coachToken')
  const token = adminToken || coachToken
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://tiangong.club/api'

  return new Promise((resolve, reject) => {
    uni.request({
      url: baseUrl + url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        if (res.statusCode === 200) resolve(res.data)
        else if (res.statusCode === 401) {
          uni.showToast({ title: '请先登录', icon: 'none' })
          reject(new Error('未授权'))
        } else reject(new Error(res.data?.error || '请求失败'))
      },
      fail: (err) => {
        errorReporter.track('api_request_fail', { url, method, error: err?.message || String(err) })
        uni.showToast({ title: '网络请求失败', icon: 'none' })
        reject(err)
      }
    })
  })
}

async function loadAllData() {
  await Promise.all([loadAutoStatus(), loadScenes(), loadLabels(), loadTables()])
}

async function loadAutoStatus() {
  try {
    const res = await apiRequest('/ac/auto-status')
    autoOffEnabled.value = res?.auto_off_enabled === true
  } catch (e) { /* ignore */ }
}

async function loadScenes() {
  try {
    const res = await apiRequest('/ac/scenes')
    scenes.value = res || []
  } catch (e) { /* ignore */ }
}

async function loadLabels() {
  try {
    const res = await apiRequest('/ac/labels')
    labels.value = res || []
  } catch (e) { /* ignore */ }
}

async function loadTables() {
  try {
    const res = await apiRequest('/ac/tables')
    tables.value = res || []
    if (areas.value.length > 0 && !selectedArea.value) {
      selectedArea.value = areas.value[0]
    }
  } catch (e) { console.error('[台桌列表] 加载失败', e) }
}

// 其他函数实现（同 switch-control.vue，略）

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/member/member' })
  }
}
</script>

<style scoped>
/* 样式同 switch-control.vue，略 */
</style>
```

---

## 四、MQTT指令格式适配

### 4.1 灯控制 MQTT 指令（已有）

**Topic**: `tiangongguojidengguang`

**指令格式**：
```json
{
  "id": "switch_id",
  "seq": "ON" 或 "OFF"
}
```

---

### 4.2 空调控制 MQTT 指令（新增）

**Topic**: `tiangongguojikongtiao`

**关空调指令**：
```json
{
  "dev_id": "6cedfa65e9e0d2f95bv8dw",
  "node_id": "3",
  "switch": false
}
```

**开空调指令**：
```json
{
  "dev_id": "6cedfa65e9e0d2f95bv8dw",
  "node_id": "3",
  "switch": true,
  "temp_set": 23,
  "mode": "cold",
  "fan_speed_enum": "auto"
}
```

**字段说明**：
- `dev_id`: MQTT设备ID（对应 switch_id）
- `node_id`: 节点ID（对应 switch_seq）
- `switch`: 开关状态（true=开，false=关）
- `temp_set`: 设定温度（16-30℃）
- `mode`: 运行模式（cold=制冷）
- `fan_speed_enum`: 风速（auto/low/middle/high）

---

### 4.3 配置文件修改

**文件路径**: `/TG/tgservice/.config` 或 `.config.env`

**新增配置**：
```json
{
  "mqtt": {
    "host": "mqtt://xxx",
    "port": 1883,
    "username": "xxx",
    "password": "xxx",
    "topic": "tiangongguojidengguang"
  },
  "mqtt_ac": {
    "host": "mqtt://xxx",
    "port": 1883,
    "username": "xxx",
    "password": "xxx",
    "topic": "tiangongguojikongtiao"
  }
}
```

---

## 五、开发约束

### 5.1 MQTT指令约束

⚠️ **开发时禁止执行真实MQTT开关指令，只能把开关指令写日志！**

**实现方式**：
```javascript
// mqtt-ac.js 和 mqtt-switch.js 中
if (isTestEnv) {
  console.log(`[MQTT][测试环境] 跳过真实发送: ${指令详情}`);
  return { ok: true, error: null };
}
```

---

### 5.2 编码规范

**时间处理**：
```javascript
const TimeUtil = require('../utils/time');
TimeUtil.nowDB()        // 当前北京时间
TimeUtil.offsetDB(-5)   // 5小时前
```

**数据库连接**：
```javascript
const { all, get, run, runInTransaction, enqueueRun } = require('../db/index');
```

**写入操作**：
```javascript
// 使用事务或队列
await runInTransaction(async (tx) => { await tx.run(...); });
await enqueueRun(...);
```

---

## 六、验收重点

### 6.1 设备类型筛选

✅ **灯控制**：所有 SQL 查询增加 `device_type = "灯"` 筛选
✅ **空调控制**：所有 SQL 查询增加 `device_type = "空调"` 筛选

---

### 6.2 空调MQTT指令格式

✅ **关空调**：`{dev_id, node_id, switch: false}`
✅ **开空调**：`{dev_id, node_id, switch: true, temp_set, mode, fan_speed_enum}`

---

### 6.3 系统配置加载

✅ **空调设定配置**：从 `system_config` 表加载 `ac_control` 键
✅ **温度/风速**：`temp_set` (16-30℃), `fan_speed_enum` (auto/low/middle/high)

---

## 七、文件修改清单

| 文件 | 操作 | 修改内容 |
|------|------|---------|
| `/TG/tgservice/backend/server.js` | 修改 | 新增 acRouter 挂载 |
| `/TG/tgservice/backend/routes/switch-routes.js` | 修改 | 增加 device_type 筛选 |
| `/TG/tgservice/backend/services/auto-off-lighting.js` | 修改 | 增加 device_type = "灯" 筛选 |
| `/TG/tgservice/backend/routes/ac-routes.js` | 新增 | 空调控制路由模块 |
| `/TG/tgservice/backend/services/auto-off-ac.js` | 新增 | 自动关空调服务 |
| `/TG/tgservice/backend/services/mqtt-ac.js` | 新增 | 空调MQTT控制模块 |
| `/TG/tgservice/.config` 或 `.config.env` | 修改 | 新增 mqtt_ac 配置 |
| `/TG/tgservice-uniapp/src/pages.json` | 修改 | 新增 ac-control 页面 |
| `/TG/tgservice-uniapp/src/pages/member/member.vue` | 修改 | 新增智能空调入口 |
| `/TG/tgservice-uniapp/src/pages/internal/ac-control.vue` | 新增 | 智能空调管理页面 |

---

## 八、API清单总结

### 8.1 灯控制API（已有，修改后）

| API | 方法 | 用途 | 筛选字段 |
|-----|------|------|---------|
| `/api/admin/switches` | GET | 获取开关列表 | ✅ 增加 device_type 筛选 |
| `/api/admin/switches` | POST | 新增开关 | ✅ 增加 device_type 字段 |

### 8.2 空调控制API（新增）

| API | 方法 | 用途 | 权限 |
|-----|------|------|------|
| `/api/admin/ac-devices` | GET | 获取空调设备列表 | 后台 |
| `/api/admin/ac-devices` | POST | 新增空调设备 | 后台 |
| `/api/admin/ac-devices/:id` | PUT | 更新空调设备 | 后台 |
| `/api/admin/ac-devices/:id` | DELETE | 删除空调设备 | 后台 |
| `/api/admin/ac-control` | GET | 获取空调设定配置 | 后台 |
| `/api/admin/ac-control` | PUT | 更新空调设定配置 | 后台 |
| `/api/admin/ac-scenes` | GET | 获取空调场景列表 | 后台 |
| `/api/admin/ac-scenes` | POST | 新增空调场景 | 后台 |
| `/api/admin/ac-scenes/:id` | PUT | 更新空调场景 | 后台 |
| `/api/admin/ac-scenes/:id` | DELETE | 删除空调场景 | 后台 |
| `/api/ac/auto-status` | GET | 获取自动关空调状态 | 前台 |
| `/api/ac/auto-off-toggle` | POST | 切换自动关空调启停 | 前台 |
| `/api/ac/auto-off-manual` | POST | 手动执行一次自动关空调 | 前台 |
| `/api/ac/scene/:id` | POST | 执行空调场景 | 前台 |
| `/api/ac/label-control` | POST | 按标签批量控制空调 | 前台 |
| `/api/ac/labels` | GET | 获取空调标签列表 | 前台 |
| `/api/ac/scenes` | GET | 获取空调场景列表 | 前台 |
| `/api/ac/tables` | GET | 获取台桌列表及关联空调 | 前台 |
| `/api/ac/table-control` | POST | 按台桌控制空调 | 前台 |

---

## 九、测试计划

### 9.1 后端测试（curl）

```bash
# 1. 获取空调设备列表
curl -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8088/api/admin/ac-devices"

# 2. 新增空调设备
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"switch_id":"6cedfa65e9e0d2f95bv8dw","switch_seq":"3","switch_label":"VIP","device_type":"空调"}' \
  "http://127.0.0.1:8088/api/admin/ac-devices"

# 3. 获取空调标签列表
curl -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8088/api/ac/labels"

# 4. 按标签控制空调（测试环境只写日志）
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"VIP","action":"OFF"}' \
  "http://127.0.0.1:8088/api/ac/label-control"
```

### 9.2 前端测试（浏览器）

1. 登录管理员账号（店长/助教管理/管理员）
2. 进入「会员中心」→「管理功能」
3. 点击「智能空调」按钮
4. 验证页面显示：快捷场景、自动省电、台桌控制、标签控制
5. 测试手动省电功能（仅管理员可用）

---

## 十、交付物

1. ✅ 本设计文档：`/TG/temp/QA-20260425-001/design-v2.md`
2. ⏳ 后端代码实现（待程序员A开发）
3. ⏳ 前端代码实现（待程序员A开发）
4. ⏳ API测试报告（待测试员B测试）

---

**设计完成时间**: 2026-04-25 22:15 GMT+8
**设计师**: 程序员A（QA-programmer-A-redesign subagent）