/**
 * MQTT 智能开关控制模块
 * 
 * 测试环境（TGSERVICE_ENV === 'test'）：只写日志，不发送真实MQTT指令
 * 生产环境：真实发送MQTT指令
 * 
 * 惰性连接，批量发送间隔100ms
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
  console.error('[MQTT] 加载配置文件失败:', err.message);
}

const isTestEnv = (config.env?.name === 'test') || (env === 'test');

let client = null;
let connecting = false;

// ========== 重连保护与日志降级 ==========

const MAX_RECONNECT_ATTEMPTS = 20;        // 连续重连上限
const NOTIFY_COOLDOWN_MS = 30 * 60 * 1000; // 通知冷却期：30分钟
const LOG_COOLDOWN_MS = 60 * 1000;         // 日志冷却期：60秒

let reconnectAttempts = 0;               // 连续重连失败次数
let lastDisconnectNotifyTime = 0;        // 上次断连通知时间
let lastReconnectNotifyTime = 0;         // 上次恢复通知时间
let lastErrorLogTime = 0;                // 上次error日志时间
let lastCloseLogTime = 0;                // 上次close日志时间
let lastReconnectLogTime = 0;            // 上次reconnect日志时间
let hasNotifiedDisconnect = false;        // 是否已发送过断连通知（用于恢复通知判断）

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
    return; // 冷却期内，跳过
  }
  lastDisconnectNotifyTime = now;
  hasNotifiedDisconnect = true;
  
  try {
    const { sendSystemNotificationToAdmins } = require('../routes/notifications');
    await sendSystemNotificationToAdmins(
      'MQTT开关服务断开',
      '智能开关MQTT服务连接已断开，灯光控制暂时不可用。系统将自动尝试重连，连续失败超过上限后会暂停重连直到业务触发。',
      'mqtt_switch_error'
    );
    console.log('[MQTT] 断连通知已发送给管理员');
  } catch (err) {
    console.error('[MQTT] 发送断连通知失败:', err.message);
  }
}

async function _notifyReconnect() {
  if (!hasNotifiedDisconnect) {
    return; // 从未发送过断连通知，不需要发恢复通知
  }
  const now = Date.now();
  if (now - lastReconnectNotifyTime < NOTIFY_COOLDOWN_MS) {
    return; // 冷却期内，跳过
  }
  lastReconnectNotifyTime = now;
  hasNotifiedDisconnect = false; // 恢复后重置
  
  try {
    const { sendSystemNotificationToAdmins } = require('../routes/notifications');
    await sendSystemNotificationToAdmins(
      'MQTT开关服务恢复',
      '智能开关MQTT服务已恢复连接，灯光控制功能正常。',
      'mqtt_switch_error'
    );
    console.log('[MQTT] 恢复通知已发送给管理员');
  } catch (err) {
    console.error('[MQTT] 发送恢复通知失败:', err.message);
  }
}

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

  // 惰性重连：重新触发时重置计数
  _resetState();
  connecting = true;

  return new Promise((resolve, reject) => {
    const url = `${mqttConfig.host}:${mqttConfig.port}`;
    client = mqtt.connect(url, {
      username: mqttConfig.username,
      password: mqttConfig.password,
      clientId: `tgservice_switch_${Date.now()}`,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 5000  // 从默认1秒改为5秒
    });

    client.on('connect', () => {
      connecting = false;
      reconnectAttempts = 0; // 连接成功，重置计数
      console.log('[MQTT] 连接成功');
      // 发送恢复通知
      _notifyReconnect();
      resolve(client);
    });

    client.on('error', (err) => {
      reconnectAttempts++;
      connecting = false;
      
      // 日志降级：前3次每次输出，之后60秒摘要一次
      const now = Date.now();
      if (reconnectAttempts <= 3 || now - lastErrorLogTime > LOG_COOLDOWN_MS) {
        lastErrorLogTime = now;
        console.error(`[MQTT] 连接失败(第${reconnectAttempts}次): ${err.message}`);
      }
      
      // 重连上限保护：超过上限则停止自动重连
      if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
        console.error(`[MQTT] 连续重连失败超过上限(${MAX_RECONNECT_ATTEMPTS}次)，停止自动重连`);
        client.end(true); // 强制断开，停止mqtt.js自动重连
        client = null;
        connecting = false;
        // 发送断连通知
        _notifyDisconnect();
      }
      
      reject(err);
    });

    client.on('close', () => {
      // 日志降级：60秒内只输出一次
      const now = Date.now();
      if (now - lastCloseLogTime > LOG_COOLDOWN_MS || reconnectAttempts <= 3) {
        lastCloseLogTime = now;
        console.log('[MQTT] 连接关闭');
      }
    });

    client.on('reconnect', () => {
      // 日志降级：60秒内只输出一次
      const now = Date.now();
      if (now - lastReconnectLogTime > LOG_COOLDOWN_MS || reconnectAttempts <= 3) {
        lastReconnectLogTime = now;
        console.log(`[MQTT] 尝试重连(第${reconnectAttempts}次)...`);
      }
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

  // 测试环境只写日志，不发送真实指令
  if (isTestEnv) {
    console.log(`[MQTT][测试环境] 跳过真实发送: ${switchId} ${switchSeq} ${action}`);
    return { ok: true, error: null };
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
    'SELECT DISTINCT switch_id, switch_seq FROM switch_device WHERE switch_label = ? AND device_type = "灯"',
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
    'WHERE td.table_name_en = ? AND sd.device_type = "灯"',
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