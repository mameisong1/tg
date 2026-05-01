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

  connecting = true;

  return new Promise((resolve, reject) => {
    const url = `${mqttConfig.host}:${mqttConfig.port}`;
    client = mqtt.connect(url, {
      username: mqttConfig.username,
      password: mqttConfig.password,
      clientId: `tgservice_ac_${Date.now()}`,
      clean: true,
      connectTimeout: 10000
    });

    client.on('connect', () => {
      connecting = false;
      console.log('[MQTT-AC] 连接成功');
      resolve(client);
    });

    client.on('error', (err) => {
      connecting = false;
      console.error(`[MQTT-AC] 连接失败: ${err.message}`);
      reject(err);
    });

    client.on('close', () => {
      console.log('[MQTT-AC] 连接关闭');
    });

    client.on('reconnect', () => {
      console.log('[MQTT-AC] 尝试重连...');
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
    console.log(`[MQTT-AC][测试环境] 跳过真实发送: ${dev_id} ${node_id} OFF`);
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
  isTestEnv
};