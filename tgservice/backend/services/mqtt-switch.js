/**
 * MQTT 智能开关控制模块
 * 
 * 测试环境（TGSERVICE_ENV === 'test'）：只写日志，不发送真实MQTT指令
 * 生产环境：真实发送MQTT指令
 * 
 * 惰性连接，批量发送间隔100ms
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
  console.error('[MQTT] 加载配置文件失败:', err.message);
}

const isTestEnv = (config.env?.name === 'test') || (env === 'test');

let client = null;
let connecting = false;

/**
 * 初始化 MQTT 连接（惰性初始化）
 */
async function getClient() {
  if (client && client.connected) return client;
  if (connecting) {
    // 等待已有连接完成
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (!connecting) {
          clearInterval(check);
          if (client && client.connected) resolve(client);
          else reject(new Error('MQTT连接失败'));
        }
      }, 100);
      setTimeout(() => { clearInterval(check); reject(new Error('MQTT连接超时')); }, 10000);
    });
  }

  const mqttConfig = config.mqtt;
  if (!mqttConfig) {
    console.warn('[MQTT] 未配置 MQTT，跳过初始化');
    return null;
  }

  connecting = true;

  return new Promise((resolve, reject) => {
    const url = `${mqttConfig.host}:${mqttConfig.port}`;
    client = mqtt.connect(url, {
      username: mqttConfig.username,
      password: mqttConfig.password,
      clientId: `tgservice_switch_${Date.now()}`,
      clean: true,
      connectTimeout: 10000
    });

    client.on('connect', () => {
      connecting = false;
      console.log('[MQTT] 连接成功');
      resolve(client);
    });

    client.on('error', (err) => {
      connecting = false;
      console.error(`[MQTT] 连接失败: ${err.message}`);
      reject(err);
    });

    client.on('close', () => {
      console.log('[MQTT] 连接关闭');
    });

    client.on('reconnect', () => {
      console.log('[MQTT] 尝试重连...');
    });

    // 超时保护
    setTimeout(() => {
      if (connecting) {
        connecting = false;
        reject(new Error('MQTT连接超时'));
      }
    }, 15000);
  });
}

/**
 * 发送单个开关指令
 * @param {string} switchId - 开关ID
 * @param {string} switchSeq - 开关序号
 * @param {string} action - 'ON' 或 'OFF'
 * @returns {Object} { ok: boolean, error?: string }
 */
async function sendSwitchCommand(switchId, switchSeq, action) {
  const mqttConfig = config.mqtt;
  if (!mqttConfig) {
    const msg = `未配置 MQTT，跳过指令: ${switchId} ${switchSeq} ${action}`;
    console.warn(`[MQTT] ${msg}`);
    return { ok: true, error: null }; // 测试/未配置环境不算失败
  }

  const payload = JSON.stringify({
    id: switchId,
    [switchSeq]: action
  });

  // 真实发送（测试/生产环境统一）
  try {
    const mqttClient = await getClient();
    if (!mqttClient) {
      const msg = `MQTT 客户端不可用 (${switchId} ${switchSeq} ${action})`;
      console.error(`[MQTT] ${msg}`);
      return { ok: false, error: msg };
    }
    mqttClient.publish(mqttConfig.topic, payload, { qos: 1 });
    console.log(`[MQTT] 指令已发送: ${switchId} ${switchSeq} ${action}`);
    return { ok: true, error: null };
  } catch (err) {
    const msg = `MQTT 发送失败 (${switchId} ${switchSeq} ${action}): ${err.message}`;
    console.error(`[MQTT] ${msg}`);
    return { ok: false, error: msg };
  }
}

/**
 * 批量发送指令（带100ms间隔）
 * @param {Array} switches - [{switch_id, switch_seq}]
 * @param {string} action - 'ON' 或 'OFF'
 * @returns {Object} { successCount, totalCount, failures: [{ switch_id, switch_seq, error }] }
 */
async function sendBatchCommand(switches, action) {
  const failures = [];
  let successCount = 0;
  for (const sw of switches) {
    const result = await sendSwitchCommand(sw.switch_id, sw.switch_seq, action);
    if (result.ok) {
      successCount++;
    } else {
      failures.push({ switch_id: sw.switch_id, switch_seq: sw.switch_seq, error: result.error });
    }
    // 每个指令间隔 100ms，避免 MQTT broker 过载
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`[MQTT] 批量发送完成: ${successCount}/${switches.length} 成功, action=${action}`);
  if (failures.length > 0) {
    console.error(`[MQTT] 失败 ${failures.length} 个:`, failures.map(f => f.error).join('; '));
  }
  return { successCount, totalCount: switches.length, failures };
}

/**
 * 根据场景执行开关操作
 * @param {Array} switches - [{switch_id, switch_seq}]
 * @param {string} action - 'ON' 或 'OFF'
 * @returns {Object} { successCount, totalCount, failures }
 */
async function executeScene(switches, action) {
  if (!switches || switches.length === 0) {
    console.warn('[MQTT] 场景开关列表为空');
    return { successCount: 0, totalCount: 0, failures: [] };
  }
  return sendBatchCommand(switches, action);
}

/**
 * 按标签批量控制开关
 * @param {string} label - 开关标签
 * @param {string} action - 'ON' 或 'OFF'
 * @returns {Object} { successCount, totalCount, failures }
 */
async function controlByLabel(label, action) {
  const { all } = require('../db/index');

  // 查询该标签下的所有开关
  const devices = await all(
    'SELECT DISTINCT switch_id, switch_seq FROM switch_device WHERE switch_label = ?',
    [label]
  );

  if (devices.length === 0) {
    console.warn(`[MQTT] 标签 "${label}" 下没有开关`);
    return { successCount: 0, totalCount: 0, failures: [] };
  }

  return sendBatchCommand(devices, action);
}

/**
 * 按台桌批量控制开关
 * @param {string} tableNameEn - 台桌英文名（如 putai1, vip1, boss1）
 * @param {string} action - 'ON' 或 'OFF'
 * @returns {Object} { successCount, totalCount, failures }
 */
async function controlByTable(tableNameEn, action) {
  const { all } = require('../db/index');

  // 查询该台桌关联的所有开关
  const devices = await all(
    'SELECT DISTINCT sd.switch_id, sd.switch_seq ' +
    'FROM table_device td ' +
    'JOIN switch_device sd ON td.switch_seq = sd.switch_seq AND td.switch_label = sd.switch_label ' +
    'WHERE td.table_name_en = ?',
    [tableNameEn]
  );

  if (devices.length === 0) {
    console.warn(`[MQTT] 台桌 "${tableNameEn}" 下没有关联开关`);
    return { successCount: 0, totalCount: 0, failures: [] };
  }

  console.log(`[MQTT] 台桌控制: ${tableNameEn}, 找到 ${devices.length} 个开关, action=${action}`);
  return sendBatchCommand(devices, action);
}

module.exports = {
  getClient,
  sendSwitchCommand,
  sendBatchCommand,
  executeScene,
  controlByLabel,
  controlByTable,
  isTestEnv
};
