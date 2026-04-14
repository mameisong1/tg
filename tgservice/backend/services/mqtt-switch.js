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
 */
async function sendSwitchCommand(switchId, switchSeq, action) {
  const mqttConfig = config.mqtt;
  if (!mqttConfig) {
    console.warn(`[MQTT] 未配置 MQTT，跳过指令: ${switchId} ${switchSeq} ${action}`);
    return false;
  }

  const payload = JSON.stringify({
    id: switchId,
    [switchSeq]: action
  });

  // 测试环境：只写日志，不真实发送
  if (isTestEnv) {
    console.log(`[MQTT-TEST] 模拟发送指令: topic=${mqttConfig.topic}, payload=${payload}`);
    return true;
  }

  // 生产环境：真实发送
  try {
    const mqttClient = await getClient();
    if (!mqttClient) return false;

    mqttClient.publish(mqttConfig.topic, payload, { qos: 1 });
    console.log(`[MQTT] 指令已发送: ${switchId} ${switchSeq} ${action}`);
    return true;
  } catch (err) {
    console.error(`[MQTT] 发送失败 (${switchId} ${switchSeq} ${action}): ${err.message}`);
    return false;
  }
}

/**
 * 批量发送指令（带100ms间隔）
 * @param {Array} switches - [{switch_id, switch_seq}]
 * @param {string} action - 'ON' 或 'OFF'
 */
async function sendBatchCommand(switches, action) {
  let successCount = 0;
  for (const sw of switches) {
    const ok = await sendSwitchCommand(sw.switch_id, sw.switch_seq, action);
    if (ok) successCount++;
    // 每个指令间隔 100ms，避免 MQTT broker 过载
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`[MQTT] 批量发送完成: ${successCount}/${switches.length} 成功, action=${action}`);
  return successCount;
}

/**
 * 根据场景执行开关操作
 * @param {Array} switches - [{switch_id, switch_seq}]
 * @param {string} action - 'ON' 或 'OFF'
 */
async function executeScene(switches, action) {
  if (!switches || switches.length === 0) {
    console.warn('[MQTT] 场景开关列表为空');
    return 0;
  }
  return sendBatchCommand(switches, action);
}

/**
 * 按标签批量控制开关
 * @param {string} label - 开关标签
 * @param {string} action - 'ON' 或 'OFF'
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
    return 0;
  }

  return sendBatchCommand(devices, action);
}

module.exports = {
  getClient,
  sendSwitchCommand,
  sendBatchCommand,
  executeScene,
  controlByLabel,
  isTestEnv
};
