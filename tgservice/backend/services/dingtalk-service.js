/**
 * 钉钉开放平台服务
 * 功能：获取 access_token、签名验证、数据解密、用户查询
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const TimeUtil = require('../utils/time');

// 加载配置
const configPath = process.env.TGSERVICE_ENV === 'test' 
  ? path.join(__dirname, '../../.config.env')
  : path.join(__dirname, '../../.config');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const dingtalkConfig = config.dingtalkPlatform || {};

// 日志文件
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const dingtalkLogPath = path.join(logDir, 'dingtalk-callback.log');
const dingtalkLog = {
  write: (message) => {
    const timestamp = TimeUtil.nowDB();
    const logLine = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(dingtalkLogPath, logLine);
    console.log(`[Dingtalk] ${message}`);
  }
};

// access_token 缓存
let accessTokenCache = {
  token: null,
  expireAt: 0
};

/**
 * 获取钉钉 access_token
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  // 检查缓存是否有效
  const now = Date.now();
  if (accessTokenCache.token && accessTokenCache.expireAt > now) {
    return accessTokenCache.token;
  }

  const appKey = dingtalkConfig.appKey;
  const appSecret = dingtalkConfig.appSecret;

  if (!appKey || !appSecret) {
    throw new Error('钉钉开放平台配置缺失: appKey 或 appSecret');
  }

  // 调用钉钉 API
  const url = `https://oapi.dingtalk.com/gettoken?appkey=${appKey}&appsecret=${appSecret}`;
  
  const result = await httpRequest(url, 'GET');
  
  if (result.errcode !== 0) {
    throw new Error(`获取 access_token 失败: ${result.errmsg}`);
  }

  // 缓存 token（提前5分钟过期）
  accessTokenCache.token = result.access_token;
  accessTokenCache.expireAt = now + (result.expires_in - 300) * 1000;

  dingtalkLog.write(`获取 access_token 成功，有效期 ${result.expires_in} 秒`);

  return result.access_token;
}

/**
 * 通过手机号获取钉钉用户ID
 * @param {string} mobile 手机号
 * @returns {Promise<string|null>} userid 或 null
 */
async function getUserIdByMobile(mobile) {
  const accessToken = await getAccessToken();
  
  const url = `https://oapi.dingtalk.com/topapi/v2/user/getbymobile?access_token=${accessToken}`;
  
  const body = JSON.stringify({ mobile });
  
  const result = await httpRequest(url, 'POST', body);
  
  if (result.errcode !== 0) {
    dingtalkLog.write(`通过手机号查询用户失败: ${mobile}, ${result.errmsg}`);
    return null;
  }

  return result.result?.userid || null;
}

/**
 * 验证钉钉回调签名
 * @param {string} timestamp 时间戳
 * @param {string} nonce 随机字符串
 * @param {string} signature 签名
 * @returns {boolean}
 */
function verifySignature(timestamp, nonce, signature) {
  const token = dingtalkConfig.callbackToken;
  if (!token) {
    dingtalkLog.write('警告: callbackToken 未配置');
    return false;
  }

  // 签名算法: sha1(timestamp + token + nonce)
  const arr = [timestamp, token, nonce].sort();
  const sha1 = crypto.createHash('sha1').update(arr.join('')).digest('hex');

  return sha1 === signature;
}

/**
 * AES-256-CBC 解密钉钉推送数据
 * @param {string} encrypt 加密数据（Base64）
 * @returns {object} 解密后的 JSON 对象
 */
function decryptMessage(encrypt) {
  const aesKey = dingtalkConfig.callbackAESKey;
  if (!aesKey) {
    throw new Error('callbackAESKey 未配置');
  }

  // AESKey 需要 43 位，补齐到 44 位（Base64 解码后 32 字节）
  const aesKeyBase64 = aesKey + '=';
  const key = Buffer.from(aesKeyBase64, 'base64');

  // 钉钉解密：去掉前 16 字节随机 IV，然后去掉补齐
  const encryptedBuffer = Buffer.from(encrypt, 'base64');
  
  const iv = encryptedBuffer.slice(0, 16);
  const encryptedData = encryptedBuffer.slice(16);
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  decipher.setAutoPadding(true);
  
  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  // 去掉钉钉格式：前 4 字节是长度，然后是内容，最后是 corpid
  const len = decrypted.readUInt32BE(0);
  const content = decrypted.slice(4, 4 + len).toString('utf8');
  
  try {
    return JSON.parse(content);
  } catch (e) {
    dingtalkLog.write(`解密数据解析失败: ${content}`);
    throw new Error('解密数据 JSON 解析失败');
  }
}

/**
 * AES-256-CBC 加密响应数据
 * @param {string} message 要加密的消息
 * @returns {string} 加密后的 Base64 字符串
 */
function encryptMessage(message) {
  const aesKey = dingtalkConfig.callbackAESKey;
  const token = dingtalkConfig.callbackToken;
  
  if (!aesKey || !token) {
    throw new Error('callbackAESKey 或 callbackToken 未配置');
  }

  const aesKeyBase64 = aesKey + '=';
  const key = Buffer.from(aesKeyBase64, 'base64');

  // 钉钉加密格式：随机 16 字节 + 4 字节长度 + 内容 + corpid
  const randomBytes = crypto.randomBytes(16);
  const msgBuffer = Buffer.from(message, 'utf8');
  const lenBuffer = Buffer.alloc(4);
  lenBuffer.writeUInt32BE(msgBuffer.length, 0);
  
  // 拼接数据（这里 corpid 暂时省略，钉钉可能不强制检查）
  const dataToEncrypt = Buffer.concat([randomBytes, lenBuffer, msgBuffer]);
  
  // AES-256-CBC 加密
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  cipher.setAutoPadding(true);
  
  let encrypted = cipher.update(dataToEncrypt);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  // 最终格式：iv + encrypted
  const finalBuffer = Buffer.concat([iv, encrypted]);
  
  return finalBuffer.toString('base64');
}

/**
 * 计算签名用于响应
 * @param {string} timestamp 时间戳
 * @param {string} nonce 随机字符串
 * @param {string} encrypt 加密数据
 * @returns {string} 签名
 */
function calculateSignature(timestamp, nonce, encrypt) {
  const token = dingtalkConfig.callbackToken;
  const arr = [timestamp, token, nonce, encrypt].sort();
  return crypto.createHash('sha1').update(arr.join('')).digest('hex');
}

/**
 * 获取钉钉打卡记录
 * @param {string} userid 钉钉用户ID
 * @param {string} dateFrom 开始日期 YYYY-MM-DD
 * @param {string} dateTo 结束日期 YYYY-MM-DD
 * @returns {Promise<object[]>}
 */
async function getAttendanceList(userid, dateFrom, dateTo) {
  const accessToken = await getAccessToken();
  
  const url = `https://oapi.dingtalk.com/topapi/attendance/list?access_token=${accessToken}`;
  
  const body = JSON.stringify({
    workDateFrom: `${dateFrom} 00:00:00`,
    workDateTo: `${dateTo} 23:59:59`,
    userIdList: [userid],
    offset: 0,
    limit: 50
  });
  
  const result = await httpRequest(url, 'POST', body);
  
  if (result.errcode !== 0) {
    dingtalkLog.write(`获取打卡记录失败: ${result.errmsg}`);
    return []; 
  }
  
  return result.recordresult || [];
}

/**
 * HTTP 请求封装
 * @param {string} url 请求地址
 * @param {string} method GET 或 POST
 * @param {string} body POST 请求体
 * @returns {Promise<object>}
 */
async function httpRequest(url, method, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('响应 JSON 解析失败'));
        }
      });
    });

    req.on('error', (e) => reject(e));
    
    if (body) {
      req.write(body);
    }
    
    req.end();
  });
}

/**
 * 检查两个时间是否接近（相差5分钟以内）
 * @param {string} time1 "YYYY-MM-DD HH:MM:SS"
 * @param {string} time2 "YYYY-MM-DD HH:MM:SS"
 * @param {number} thresholdMinutes 阈值分钟数，默认5
 * @returns {boolean}
 */
function isTimeClose(time1, time2, thresholdMinutes = 5) {
  if (!time1 || !time2) return false;
  
  try {
    const d1 = new Date(time1 + '+08:00');
    const d2 = new Date(time2 + '+08:00');
    const diffMs = Math.abs(d1 - d2);
    const diffMinutes = diffMs / (60 * 1000);
    return diffMinutes <= thresholdMinutes;
  } catch (e) {
    return false;
  }
}

/**
 * 处理打卡事件
 * @param {object} event 打卡事件数据
 * @param {object} db 数据库连接
 * @returns {Promise<void>}
 */
async function handleAttendanceEvent(event, db) {
  const { get, all, enqueueRun } = db;
  
  // 提取关键信息（钉钉回调数据结构）
  const userid = event.userid || event.userId;
  const checkTime = event.checkTime || event.userCheckTime || event.time; // 格式可能是毫秒时间戳或 "YYYY-MM-DD HH:MM:SS"
  const deviceId = event.deviceId || event.deviceUUID || event.deviceName || 'unknown';
  const checkType = event.checkType || event.userCheckType; // OnDuty=上班, OffDuty=下班
  const locationResult = event.locationResult || event.userLocationResult; // Normal=范围内, Outside=范围外
  
  // 记录日志（完整记录回调数据）
  dingtalkLog.write(`收到打卡事件: ${JSON.stringify(event)}`);
  dingtalkLog.write(`解析: userid=${userid}, checkTime=${checkTime}, deviceId=${deviceId}, checkType=${checkType}, locationResult=${locationResult}`);
  
  // 查询助教
  const coach = await get(
    'SELECT coach_no, employee_id, stage_name, shift FROM coaches WHERE dingtalk_user_id = ?',
    [userid]
  );
  
  if (!coach) {
    dingtalkLog.write(`未找到钉钉用户ID对应的助教: ${userid}`);
    return;
  }
  
  dingtalkLog.write(`找到助教: ${coach.stage_name} (${coach.employee_id})`);
  
  // 获取今天日期
  const todayStr = TimeUtil.todayStr();
  
  // 解析打卡时间
  let checkTimeStr;
  if (typeof checkTime === 'number' || /^\d+$/.test(checkTime)) {
    // 毫秒时间戳转北京时间
    const ts = parseInt(checkTime);
    checkTimeStr = TimeUtil.formatTimestamp(ts);
  } else {
    checkTimeStr = checkTime;
  }
  
  dingtalkLog.write(`钉钉打卡时间: ${checkTimeStr}`);
  
  // 如果有 locationResult 且不在范围内，忽略
  if (locationResult && locationResult !== 'Normal' && locationResult !== 'Inside') {
    dingtalkLog.write(`打卡地点超出范围: ${locationResult}，忽略`);
    return;
  }
  
  // 查询水牌状态
  const waterBoard = await get(
    'SELECT status FROM water_boards WHERE coach_no = ?',
    [coach.coach_no]
  );
  
  const currentStatus = waterBoard?.status || '下班';
  dingtalkLog.write(`当前水牌状态: ${currentStatus}`);
  
  // 查询今日打卡记录（获取系统已有的打卡时间）
  const attendance = await get(
    'SELECT id, clock_in_time, clock_out_time FROM attendance_records WHERE date = ? AND coach_no = ?',
    [todayStr, coach.coach_no]
  );
  
  // 查询活跃的乐捐记录（获取乐捐归来时间）
  const lejuan = await get(
    `SELECT id, return_time FROM lejuan_records WHERE coach_no = ? AND lejuan_status = 'active'`,
    [coach.coach_no]
  );
  
  // ========== 打卡类型判断逻辑（场景一 + 场景二）==========
  
  let punchType = null; // 'in', 'out', 'return'
  let reason = ''; // 判断原因，用于日志
  
  if (currentStatus === '下班') {
    // 水牌下班状态
    // 场景一：先系统下班打卡，后钉钉打卡 → 检查 clock_out_time 是否接近
    if (attendance && attendance.clock_out_time && isTimeClose(checkTimeStr, attendance.clock_out_time)) {
      punchType = 'out';
      reason = `水牌下班 + 系统下班时间(${attendance.clock_out_time})接近`;
    } else {
      // 场景二：先钉钉打卡，后系统打卡 → 钉钉打卡是上班打卡
      punchType = 'in';
      reason = `水牌下班 + 无接近的系统时间`; 
    }
  } else if (currentStatus === '空闲' || currentStatus.includes('空闲')) {
    // 水牌空闲状态
    // 场景一：先系统打卡，后钉钉打卡 → 需要对比时间
    
    // 1. 检查是否是上班打卡（系统上班时间接近）
    if (attendance && attendance.clock_in_time && isTimeClose(checkTimeStr, attendance.clock_in_time)) {
      punchType = 'in';
      reason = `水牌空闲 + 系统上班时间(${attendance.clock_in_time})接近`;
    }
    // 2. 检查是否是乐捐归来打卡（乐捐归来时间接近）
    else if (lejuan && lejuan.return_time && isTimeClose(checkTimeStr, lejuan.return_time)) {
      punchType = 'return';
      reason = `水牌空闲 + 乐捐归来时间(${lejuan.return_time})接近`;
    }
    // 3. 否则是下班打卡（场景二：先钉钉打卡，后系统打卡）
    else {
      punchType = 'out';
      reason = `水牌空闲 + 无接近的系统时间`;
    }
  } else if (currentStatus === '乐捐') {
    // 水牌乐捐状态：钉钉打卡只能是乐捐归来打卡
    // （乐捐状态下还没有 return_time，无需判断时间接近）
    punchType = 'return';
    reason = `水牌乐捐状态`;
  } else if (currentStatus === '服务中') {
    // 服务中状态不处理
    dingtalkLog.write(`${coach.stage_name} 当前服务中，忽略打卡`);
    return;
  } else {
    dingtalkLog.write(`${coach.stage_name} 未知状态: ${currentStatus}，忽略打卡`);
    return;
  }
  
  dingtalkLog.write(`${coach.stage_name} 打卡类型: ${punchType}, 原因: ${reason}`);
  
  // ========== 写入钉钉打卡时间 ==========
  
  if (punchType === 'in') {
    // 上班打卡 → 写入 dingtalk_in_time
    dingtalkLog.write(`${coach.stage_name} 钉钉上班打卡: ${checkTimeStr}`);
    
    if (!attendance) {
      // 创建新记录
      await enqueueRun(
        `INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, dingtalk_in_time, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [todayStr, coach.coach_no, coach.employee_id, coach.stage_name, checkTimeStr, TimeUtil.nowDB(), TimeUtil.nowDB()]
      );
      dingtalkLog.write(`创建打卡记录: ${coach.stage_name}`);
    } else {
      // 更新钉钉上班时间
      await enqueueRun(
        `UPDATE attendance_records SET dingtalk_in_time = ?, updated_at = ? WHERE id = ?`,
        [checkTimeStr, TimeUtil.nowDB(), attendance.id]
      );
      dingtalkLog.write(`更新打卡记录: ${coach.stage_name} dingtalk_in_time = ${checkTimeStr}`);
    }
  } else if (punchType === 'out') {
    // 下班打卡 → 写入 dingtalk_out_time
    dingtalkLog.write(`${coach.stage_name} 钉钉下班打卡: ${checkTimeStr}`);
    
    if (attendance) {
      await enqueueRun(
        `UPDATE attendance_records SET dingtalk_out_time = ?, updated_at = ? WHERE id = ?`,
        [checkTimeStr, TimeUtil.nowDB(), attendance.id]
      );
      dingtalkLog.write(`更新打卡记录: ${coach.stage_name} dingtalk_out_time = ${checkTimeStr}`);
    } else {
      dingtalkLog.write(`警告: ${coach.stage_name} 下班打卡但无今日打卡记录`);
    }
  } else if (punchType === 'return') {
    // 乐捐归来打卡 → 写入 dingtalk_return_time
    dingtalkLog.write(`${coach.stage_name} 钉钉乐捐归来打卡: ${checkTimeStr}`);
    
    if (lejuan) {
      await enqueueRun(
        `UPDATE lejuan_records SET dingtalk_return_time = ?, updated_at = ? WHERE id = ?`,
        [checkTimeStr, TimeUtil.nowDB(), lejuan.id]
      );
      dingtalkLog.write(`更新乐捐记录: ${coach.stage_name} dingtalk_return_time = ${checkTimeStr}`);
    } else {
      dingtalkLog.write(`警告: ${coach.stage_name} 乐捐打卡但无 active 乐捐记录`);
    }
  }
}

module.exports = {
  getAccessToken,
  getUserIdByMobile,
  getAttendanceList,
  verifySignature,
  decryptMessage,
  encryptMessage,
  calculateSignature,
  handleAttendanceEvent,
  dingtalkLog,
  dingtalkConfig
};