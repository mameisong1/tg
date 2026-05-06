/**
 * MQTT 智能空调控制模块
 * 
 * 测试环境（TGSERVICE_ENV === 'test'）：只写日志，不发送真实MQTT指令
 * 生产环境：真实发送MQTT指令
 * 
 * 惰性连接，批量发送间隔100ms
 * 
 * 空调MQTT指令格式：
 * 关空调: {dev_id, node_id, switch: false}
 * 开空调: {dev_id, node_id, switch: true, temp_set, mode: "cold", fan_speed_enum}
 * 重置温度风速: {dev_id, node_id, temp_set, mode: "cold", fan_speed_enum}（不含 switch 参数）
 * Topic: tiangongguojikongtiao
 * 
 * 2026-05-06 优化：
 * - 重连上限：连续失败20次后停止自动重连，防止日志风暴拖垮主服务
 * - 日志降级：同类事件60秒内只输出一次，前3次每次都输出
 * - 管理员通知：断连/恢复各通知一次，30分钟去重
 */

const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');

// 加载配置文件
const env = process.env.TGSERVICE_ENV || 'production';
const configFileName = env === 'test' ? '.config' : '.config.prod';
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

// 空调配置内存缓存
let cachedACConfig = null;

// ========== 重连保护与日志降级 ==========

const MAX_RECONNECT_ATTEMPTS = 20;        // 连续重连上限
const NOTIFY_COOLDOWN_MS = 30 * 60 * 1000; // 通知冷却期：30分钟
const LOG_COOLDOWN_MS = 60 * 1000;         // 日志冷却期：60秒

let reconnectAttempts = 0;
let lastDisconnectNotifyTime = 0;
let lastReconnectNotifyTime = 0;
let lastErrorLogTime = 0;
let lastCloseLogTime = 0;
let lastReconnectLogTime = 0;
let hasNotifiedDisconnect = false;

/**
 * 重置内部状态（用于模块重载或惰性重连时）
 */
function _resetState() {
  reconnectAttempts = 0;
  lastDisconnectNotifyTime = 0;
  lastReconnectNotifyTime = 0;
  lastErrorLogTime = 0;
  lastCloseLogTime = 0;
  lastReconnectLogTime = 0;
  hasNotifiedDisconnect = false;
}

/**
 * 发送管理员通知（带冷却去重）
 */
async function _notifyDisconnect() {
  const now = Date.now();
  if (now - lastDisconnectNotifyTime < NOTIFY_COOLDOWN_MS) {
    return;
  }
  lastDisconnectNotifyTime = now;
  hasNotifiedDisconnect = true;
  
  try {
    const { sendSystemNotificationToAdmins } = require('../routes/notifications');
    await sendSystemNotificationToAdmins(
      'MQTT空调服务断开',
      '智能空调MQTT服务连接已断开，空调控制暂时不可用。系统将自动尝试重连，连续失败超过上限后会暂停重连直到业务触发。',
      'mqtt_ac_error'
    );
    console.log('[MQTT-AC] 断连通知已发送给管理员');
  } catch (err) {
    console.error('[MQTT-AC] 发送断连通知失败:', err.message);
  }
}

async function _notifyReconnect() {
  if (!hasNotifiedDisconnect) {
    return;
  }
  const now = Date.now();
  if (now - lastReconnectNotifyTime < NOTIFY_COOLDOWN_MS) {
    return;
  }
  lastReconnectNotifyTime = now;
  hasNotifiedDisconnect = false;
  
  try {
    const { sendSystemNotificationToAdmins } = require('../routes/notifications');
    await sendSystemNotificationToAdmins(
      'MQTT空调服务恢复',
      '智能空调MQTT服务已恢复连接，空调控制功能正常。',
      'mqtt_ac_error'
    );
    console.log('[MQTT-AC] 恢复通知已发送给管理员');
  } catch (err) {
    console.error('[MQTT-AC] 发送恢复通知失败:', err.message);
  }
}

/**
 * 获取空调MQTT客户端（惰性初始化）
 */
async function getClient() {
  if (client && client.connected) return client;
  if (connecting) {
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (!connecting) {
          clearInterval(check);
          if (client && client.connected) resolve(client);
          else reject(new Error('MQTT-AC连接失败'));
        }
      }, 100);
      setTimeout(() => { clearInterval(check); reject(new Error('MQTT-AC连接超时')); }, 10000);
    });
  }

  const mqttConfig = config.mqtt_ac;
  if (!mqttConfig) {
    console.warn('[MQTT-AC] 未配置 MQTT 空调，跳过初始化');
    return null;
  }

  // 惰性重连：重新触发时重置计数
  _resetState();
  connecting = true;

  return new Promise((resolve, reject) => {
    const url = `${mqttConfig.host}:${mqttConfig.port}`;
    client = mqtt.connect(url, {
      username: mqttConfig.username,
      password: mqttConfig.password,
      clientId: `tgservice_ac_${Date.now()}`,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 5000  // 从默认1秒改为5秒
    });

    client.on('connect', () => {
      connecting = false;
      reconnectAttempts = 0;
      console.log('[MQTT-AC] 连接成功');
      _notifyReconnect();
      resolve(client);
    });

    client.on('error', (err) => {
      reconnectAttempts++;
      connecting = false;
      
      const now = Date.now();
      if (reconnectAttempts <= 3 || now - lastErrorLogTime > LOG_COOLDOWN_MS) {
        lastErrorLogTime = now;
        console.error(`[MQTT-AC] 连接失败(第${reconnectAttempts}次): ${err.message}`);
      }
      
      if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
        console.error(`[MQTT-AC] 连续重连失败超过上限(${MAX_RECONNECT_ATTEMPTS}次)，停止自动重连`);
        client.end(true);
        client = null;
        connecting = false;
        _notifyDisconnect();
      }
      
      reject(err);
    });

    client.on('close', () => {
      const now = Date.now();
      if (now - lastCloseLogTime > LOG_COOLDOWN_MS || reconnectAttempts <= 3) {
        lastCloseLogTime = now;
        console.log('[MQTT-AC] 连接关闭');
      }
    });

    client.on('reconnect', () => {
      const now = Date.now();
      if (now - lastReconnectLogTime > LOG_COOLDOWN_MS || reconnectAttempts <= 3) {
        lastReconnectLogTime = now;
        console.log(`[MQTT-AC] 尝试重连(第${reconnectAttempts}次)...`);
      }
    });

    setTimeout(() => {
      if (connecting) {
        connecting = false;
        reject(new Error('MQTT-AC连接超时'));
      }
    }, 15000);
  });
}

/**
 * 获取空调设定配置
 * @returns {Object} { temp_set, fan_speed_enum }
 */
async function getACConfig() {
  // 优先使用内存缓存
  if (cachedACConfig) return cachedACConfig;
  
  const { get } = require('../db/index');
  const row = await get('SELECT value FROM system_config WHERE key = "ac_control"');
  if (!row) {
    cachedACConfig = { temp_set: 23, fan_speed_enum: 'auto' };
    return cachedACConfig;
  }
  try {
    cachedACConfig = JSON.parse(row.value);
    return cachedACConfig;
  } catch (e) {
    cachedACConfig = { temp_set: 23, fan_speed_enum: 'auto' };
    return cachedACConfig;
  }
}

/**
 * 刷新空调配置缓存（配置更新时调用）
 */
function refreshACConfig() {
  cachedACConfig = null;
  console.log('[MQTT-AC] 空调配置缓存已刷新');
}

/**
 * 发送单个空调开启指令
 * @param {string} dev_id - 设备ID
 * @param {string} node_id - 节点ID
 * @param {Object} acConfig - 空调设定 { temp_set, fan_speed_enum }
 * @returns {Object} { ok: boolean, error?: string }
 */
async function sendACOnCommand(dev_id, node_id, acConfig) {
  const mqttConfig = config.mqtt_ac;
  if (!mqttConfig) {
    console.warn(`[MQTT-AC] 未配置 MQTT 空调，跳过指令: ${dev_id} ${node_id} ON`);
    return { ok: true, error: null };
  }

  // ⚠️ 测试环境只写日志，不发送真实指令
  if (isTestEnv) {
    console.log(`[MQTT-AC][测试环境] 跳过真实发送: ${dev_id} ${node_id} ON, temp=${acConfig.temp_set}, fan=${acConfig.fan_speed_enum}`);
    return { ok: true, error: null };
  }

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
      return { ok: false, error: 'MQTT-AC 客户端不可用' };
    }
    mqttClient.publish(mqttConfig.topic, payload, { qos: 1 });
    console.log(`[MQTT-AC] 开空调指令已发送: ${dev_id} ${node_id} ON`);
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * 发送空调重置温度风速指令（不改变开关状态）
 * @param {string} dev_id - 设备ID
 * @param {string} node_id - 节点ID
 * @param {Object} acConfig - 空调设定 { temp_set, fan_speed_enum }
 * @returns {Object} { ok: boolean, error?: string }
 */
async function sendACResetCommand(dev_id, node_id, acConfig) {
  const mqttConfig = config.mqtt_ac;
  if (!mqttConfig) {
    console.warn(`[MQTT-AC] 未配置 MQTT 空调，跳过指令: ${dev_id} ${node_id} RESET`);
    return { ok: true, error: null };
  }

  // ⚠️ 测试环境只写日志，不发送真实指令
  if (isTestEnv) {
    console.log(`[MQTT-AC][测试环境] 跳过真实发送: ${dev_id} ${node_id} RESET, temp=${acConfig.temp_set}, fan=${acConfig.fan_speed_enum}`);
    return { ok: true, error: null };
  }

  const payload = JSON.stringify({
    dev_id,
    node_id,
    temp_set: acConfig.temp_set,
    mode: "cold",
    fan_speed_enum: acConfig.fan_speed_enum
  });

  try {
    const mqttClient = await getClient();
    if (!mqttClient) {
      return { ok: false, error: 'MQTT-AC 客户端不可用' };
    }
    mqttClient.publish(mqttConfig.topic, payload, { qos: 1 });
    console.log(`[MQTT-AC] 重置温度风速指令已发送: ${dev_id} ${node_id} RESET`);
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * 发送单个空调关闭指令
 * @param {string} dev_id - 设备ID
 * @param {string} node_id - 节点ID
 * @returns {Object} { ok: boolean, error?: string }
 */
async function sendACOffCommand(dev_id, node_id) {
  const mqttConfig = config.mqtt_ac;
  if (!mqttConfig) {
    console.warn(`[MQTT-AC] 未配置 MQTT 空调，跳过指令: ${dev_id} ${node_id} OFF`);
    return { ok: true, error: null };
  }

  // ⚠️ 测试环境只写日志，不发送真实指令
  if (isTestEnv) {
    console.log(`[MQTT-AC][测试环境] 跽过真实发送: ${dev_id} ${node_id} OFF`);
    return { ok: true, error: null };
  }

  const payload = JSON.stringify({
    dev_id,
    node_id,
    switch: false
  });

  try {
    const mqttClient = await getClient();
    if (!mqttClient) {
      return { ok: false, error: 'MQTT-AC 客户端不可用' };
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
  
  console.log(`[MQTT-AC] 批量关闭完成: ${successCount}/${switches.length} 成功`);
  if (failures.length > 0) {
    console.error(`[MQTT-AC] 失败 ${failures.length} 个:`, failures.map(f => f.error).join('; '));
  }
  return { successCount, totalCount: switches.length, failures };
}

/**
 * 批量发送空调重置温度风速指令
 * @param {Array} switches - [{switch_id, switch_seq}]
 * @returns {Object} { successCount, totalCount, failures }
 */
async function sendACResetBatch(switches) {
  const acConfig = await getACConfig();
  const failures = [];
  let successCount = 0;
  
  for (const sw of switches) {
    const result = await sendACResetCommand(sw.switch_id, sw.switch_seq, acConfig);
    if (result.ok) {
      successCount++;
    } else {
      failures.push({ switch_id: sw.switch_id, switch_seq: sw.switch_seq, error: result.error });
    }
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`[MQTT-AC] 大厅区空调重置完成: ${successCount}/${switches.length} 成功`);
  return { successCount, totalCount: switches.length, failures };
}

/**
 * 按标签批量控制空调
 * @param {string} label - 标签
 * @param {string} action - 'ON' 或 'OFF'
 * @returns {Object} { successCount, totalCount, failures }
 */
async function controlACByLabel(label, action) {
  const { all } = require('../db/index');
  const acConfig = await getACConfig();

  const devices = await all(
    'SELECT DISTINCT switch_id, switch_seq FROM switch_device WHERE switch_label = ? AND device_type = "空调"',
    [label]
  );

  if (devices.length === 0) {
    console.warn(`[MQTT-AC] 标签 "${label}" 下没有空调设备`);
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

  console.log(`[MQTT-AC] 标签控制: ${label} ${action}, ${successCount}/${devices.length} 成功`);
  return { successCount, totalCount: devices.length, failures };
}

/**
 * 按台桌批量控制空调
 * @param {string} tableNameEn - 台桌英文名
 * @param {string} action - 'ON' 或 'OFF'
 * @returns {Object} { successCount, totalCount, failures }
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
    console.warn(`[MQTT-AC] 台桌 "${tableNameEn}" 下没有关联空调`);
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

  console.log(`[MQTT-AC] 台桌控制: ${tableNameEn} ${action}, ${successCount}/${devices.length} 成功`);
  return { successCount, totalCount: devices.length, failures };
}

module.exports = {
  getClient,
  getACConfig,
  refreshACConfig,
  sendACOnCommand,
  sendACResetCommand,
  sendACOffCommand,
  sendACOffBatch,
  sendACResetBatch,
  controlACByLabel,
  controlACByTable,
  isTestEnv,
  // 测试用：导出内部状态用于验证
  _resetState,
  _getState: () => ({
    reconnectAttempts,
    lastDisconnectNotifyTime,
    lastReconnectNotifyTime,
    hasNotifiedDisconnect,
    client,
    connecting
  })
};