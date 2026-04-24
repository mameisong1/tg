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
 * @param {string} encrypt 加密数据
 * @param {string} signature 签名
 * @returns {boolean}
 */
function verifySignature(timestamp, nonce, encrypt, signature) {
  const token = dingtalkConfig.callbackToken;
  if (!token) {
    dingtalkLog.write('警告: callbackToken 未配置');
    return false;
  }

  // 钉钉签名算法: sha1(sort([timestamp, token, nonce, encrypt]))
  // 注意：POST 请求必须包含 encrypt 参数
  const arr = [timestamp, token, nonce, encrypt].sort();
  const joined = arr.join('');
  const sha1 = crypto.createHash('sha1').update(joined).digest('hex');
  
  // 调试日志
  dingtalkLog.write(`签名验证: timestamp=${timestamp}, nonce=${nonce}, encrypt=${encrypt ? '有' : '无'}`);
  dingtalkLog.write(`计算签名: ${sha1}, 钉钉签名: ${signature}`);

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
  
  // ⚠️ 关键：IV 是密钥的前 16 字节，不是密文的前 16 字节！
  const iv = key.slice(0, 16);
  
  // Base64 解码密文
  const encryptedBuffer = Buffer.from(encrypt, 'base64');
  
  // ⚠️ 关键：必须用 setAutoPadding(false)，然后手动去 PKCS7 padding
  // Node.js 的 setAutoPadding(true) 和钉钉的 padding 不兼容
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  decipher.setAutoPadding(false);
  
  let decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  
  // 手动去 PKCS7 padding
  const padLen = decrypted[decrypted.length - 1];
  if (padLen > 0 && padLen <= 32) {
    decrypted = decrypted.slice(0, decrypted.length - padLen);
  }
  
  // 钉钉格式：16 字节随机串 + 4 字节消息长度 + 消息内容 + corpid
  const msgLen = decrypted.readUInt32BE(16);
  const content = decrypted.slice(20, 20 + msgLen).toString('utf8');
  
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
  
  // ⚠️ 关键：IV 是密钥的前 16 字节
  const iv = key.slice(0, 16);

  // 钉钉加密格式：16 字节随机串 + 4 字节消息长度 + 消息内容 + corpid
  const randomBytes = crypto.randomBytes(16);
  const msgBuffer = Buffer.from(message, 'utf8');
  const lenBuffer = Buffer.alloc(4);
  lenBuffer.writeUInt32BE(msgBuffer.length, 0);
  
  // corpid（appKey）
  const corpId = Buffer.from(dingtalkConfig.appKey || '', 'utf8');
  const plainText = Buffer.concat([randomBytes, lenBuffer, msgBuffer, corpId]);
  
  // 手动 PKCS7 padding
  const blockSize = 32; // AES-256 block size
  const padLen = blockSize - (plainText.length % blockSize);
  const padding = Buffer.alloc(padLen, padLen);
  const paddedText = Buffer.concat([plainText, padding]);
  
  // AES-256-CBC 加密（不用 autoPadding，因为我们手动处理了 padding）
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  cipher.setAutoPadding(false);
  
  const encrypted = Buffer.concat([cipher.update(paddedText), cipher.final()]);
  
  return encrypted.toString('base64');
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
 * 获取钉钉打卡记录（使用旧版API）
 * @param {string} userid 钉钉用户ID
 * @param {string} dateFrom 开始日期 YYYY-MM-DD
 * @param {string} dateTo 结束日期 YYYY-MM-DD
 * @returns {Promise<object[]>}
 */
async function getAttendanceList(userid, dateFrom, dateTo) {
  const accessToken = await getAccessToken();
  
  // 使用旧版API: https://oapi.dingtalk.com/attendance/list
  const url = `https://oapi.dingtalk.com/attendance/list?access_token=${accessToken}`;
  
  const body = JSON.stringify({
    workDateFrom: `${dateFrom} 00:00:00`,
    workDateTo: `${dateTo} 23:59:59`,
    userIdList: [userid],
    offset: 0,
    limit: 50
  });
  
  dingtalkLog.write(`请求考勤数据: userid=${userid}, dateFrom=${dateFrom}, dateTo=${dateTo}`);
  
  const result = await httpRequest(url, 'POST', body);
  
  dingtalkLog.write(`考勤API响应: errcode=${result.errcode}, errmsg=${result.errmsg}`);
  
  if (result.errcode !== 0) {
    dingtalkLog.write(`获取打卡记录失败: ${result.errmsg}`);
    return []; 
  }
  
  return result.recordresult || [];
}

/**
 * 上班/下班打卡后：查询最近5分钟内的钉钉打卡记录并写入数据库
 * @param {string} dingtalkUserId 钉钉用户ID
 * @param {string} coachNo 助教工号
 * @param {string} clockType 'in' 或 'out'
 * @param {object} db 数据库连接
 * @returns {Promise<string|null>} 提示信息（如果未查到）
 */
async function queryRecentAttendance(dingtalkUserId, coachNo, clockType, db) {
  const { get, all, enqueueRun } = db;
  
  if (!dingtalkUserId) return null;
  
  // 检查是否已有推送的钉钉打卡时间
  const todayStr = TimeUtil.todayStr();
  const yesterdayStr = TimeUtil.offsetDateStr(-1);
  
  if (clockType === 'in') {
    const attendance = await get(
      'SELECT id, dingtalk_in_time FROM attendance_records WHERE coach_no = ? AND date = ?',
      [coachNo, todayStr]
    );
    if (attendance && attendance.dingtalk_in_time) return null; // 已有推送数据，跳过
  } else if (clockType === 'out') {
    const attendance = await get(
      `SELECT id, dingtalk_out_time FROM attendance_records
       WHERE coach_no = ? AND date IN (?, ?) AND clock_out_time IS NOT NULL
       ORDER BY clock_in_time DESC LIMIT 1`,
      [coachNo, todayStr, yesterdayStr]
    );
    if (attendance && attendance.dingtalk_out_time) return null; // 已有推送数据，跳过
  }
  
  try {
    const records = await getAttendanceList(dingtalkUserId, yesterdayStr, todayStr);
    
    if (!records || records.length === 0) {
      dingtalkLog.write(`${coachNo} 钉钉考勤API无记录`);
      return '尚未获取到钉钉打卡时间，请尽快打卡';
    }
    
    // 筛选5分钟内的打卡记录
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    const recentRecords = records.filter(r => {
      const checkTime = r.userCheckTime || r.checkTime;
      return checkTime && checkTime >= fiveMinutesAgo;
    });
    
    if (recentRecords.length === 0) {
      dingtalkLog.write(`${coachNo} 5分钟内无钉钉打卡记录`);
      return '尚未获取到钉钉打卡时间，请尽快打卡';
    }
    
    dingtalkLog.write(`${coachNo} 查到 ${recentRecords.length} 条5分钟内钉钉打卡记录`);
    
    // 处理每条最近的打卡记录
    for (const record of recentRecords) {
      const checkTime = record.userCheckTime || record.checkTime;
      const checkTimeStr = TimeUtil.formatTimestamp(checkTime);
      
      if (clockType === 'in') {
        const attendance = await get(
          'SELECT id FROM attendance_records WHERE coach_no = ? AND date = ?',
          [coachNo, todayStr]
        );
        
        if (!attendance) {
          await enqueueRun(
            `INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, dingtalk_in_time, created_at, updated_at)
             VALUES (?, ?, '', '', ?, ?, ?)`,
            [todayStr, coachNo, checkTimeStr, TimeUtil.nowDB(), TimeUtil.nowDB()]
          );
          dingtalkLog.write(`${coachNo} 创建打卡记录 dingtalk_in_time = ${checkTimeStr}`);
        } else {
          await enqueueRun(
            `UPDATE attendance_records SET dingtalk_in_time = ?, updated_at = ? WHERE id = ?`,
            [checkTimeStr, TimeUtil.nowDB(), attendance.id]
          );
          dingtalkLog.write(`${coachNo} 更新 dingtalk_in_time = ${checkTimeStr}`);
        }
      } else if (clockType === 'out') {
        const attendance = await get(
          `SELECT id FROM attendance_records
           WHERE coach_no = ? AND date IN (?, ?) AND clock_out_time IS NOT NULL
           ORDER BY clock_in_time DESC LIMIT 1`,
          [coachNo, todayStr, yesterdayStr]
        );
        
        if (attendance) {
          await enqueueRun(
            `UPDATE attendance_records SET dingtalk_out_time = ?, updated_at = ? WHERE id = ?`,
            [checkTimeStr, TimeUtil.nowDB(), attendance.id]
          );
          dingtalkLog.write(`${coachNo} 更新 dingtalk_out_time = ${checkTimeStr}`);
        }
      }
    }
    
    return null; // 成功查到并写入，无提示
    
  } catch (err) {
    dingtalkLog.write(`${coachNo} 查询钉钉考勤异常: ${err.message}`);
    return null; // 异常不提示用户
  }
}

/**
 * 乐捐归来打卡后：查询最近5分钟内的钉钉打卡记录并写入 dingtalk_return_time
 * @param {string} dingtalkUserId 钉钉用户ID
 * @param {string} coachNo 助教工号
 * @param {number} lejuanId 乐捐记录ID
 * @param {object} db 数据库连接
 * @returns {Promise<string|null>}
 */
async function queryLejuanReturnAttendance(dingtalkUserId, coachNo, lejuanId, db) {
  const { get, all, enqueueRun } = db;
  
  if (!dingtalkUserId) return null;
  
  // 检查乐捐表是否已有推送的 dingtalk_return_time
  const lejuan = await get('SELECT id, dingtalk_return_time FROM lejuan_records WHERE id = ?', [lejuanId]);
  if (lejuan && lejuan.dingtalk_return_time) return null; // 已有推送数据，跳过
  
  try {
    const todayStr = TimeUtil.todayStr();
    const yesterdayStr = TimeUtil.offsetDateStr(-1);
    
    const records = await getAttendanceList(dingtalkUserId, yesterdayStr, todayStr);
    
    if (!records || records.length === 0) {
      return '尚未获取到钉钉打卡时间，请尽快打卡';
    }
    
    // 筛选5分钟内的打卡记录
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    const recentRecords = records.filter(r => {
      const checkTime = r.userCheckTime || r.checkTime;
      return checkTime && checkTime >= fiveMinutesAgo;
    });
    
    if (recentRecords.length === 0) {
      return '尚未获取到钉钉打卡时间，请尽快打卡';
    }
    
    // 取第一条打卡时间写入乐捐归来时间
    const record = recentRecords[0];
    const checkTime = record.userCheckTime || record.checkTime;
    const checkTimeStr = TimeUtil.formatTimestamp(checkTime);
    
    await enqueueRun(
      `UPDATE lejuan_records SET dingtalk_return_time = ?, updated_at = ? WHERE id = ?`,
      [checkTimeStr, TimeUtil.nowDB(), lejuanId]
    );
    
    dingtalkLog.write(`${coachNo} 乐捐归来 dingtalk_return_time = ${checkTimeStr}`);
    
    return null;
  } catch (err) {
    dingtalkLog.write(`${coachNo} 查询乐捐归来打卡异常: ${err.message}`);
    return null;
  }
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
function isTimeClose(time1, time2, thresholdMinutes = 20) {
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
  
  // 处理新格式：DataList 数组
  if (event.DataList && Array.isArray(event.DataList)) {
    dingtalkLog.write(`收到打卡事件(DataList): ${JSON.stringify(event)}`);
    
    // 遍历处理每条打卡记录
    for (const data of event.DataList) {
      await handleSingleAttendanceRecord(data, db);
    }
    return;
  }
  
  // 处理旧格式：单条记录
  await handleSingleAttendanceRecord(event, db);
}

/**
 * 处理单条打卡记录
 */
async function handleSingleAttendanceRecord(record, db) {
  const { get, all, enqueueRun } = db;
  
  // 提取关键信息（兼容新旧字段名）
  const userid = record.userid || record.userId;
  const checkTime = record.checkTime || record.userCheckTime || record.time; // 格式可能是毫秒时间戳或 "YYYY-MM-DD HH:MM:SS"
  const deviceId = record.deviceId || record.deviceUUID || record.deviceSN || record.deviceName || 'unknown';
  const checkType = record.checkType || record.userCheckType; // OnDuty=上班, OffDuty=下班
  const locationResult = record.locationResult || record.userLocationResult; // Normal=范围内, Outside=范围外
  
  // 记录日志
  dingtalkLog.write(`解析单条记录: userid=${userid}, checkTime=${checkTime}, deviceId=${deviceId}, checkType=${checkType}, locationResult=${locationResult}`);
  
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
  
  // 查询上一个12点以后的未下班上班记录（凌晨下班时上班记录可能在昨天）
  const checkHour = parseInt(checkTimeStr.substring(11, 13), 10);
  const searchStart = checkHour >= 12 
    ? `${todayStr} 12:00:00`
    : `${TimeUtil.offsetDateStr(-1)} 12:00:00`;
  const attendance = await get(
    `SELECT id, clock_in_time, clock_out_time, dingtalk_in_time FROM attendance_records 
     WHERE coach_no = ? AND clock_in_time >= ? AND clock_out_time IS NULL
     ORDER BY clock_in_time DESC LIMIT 1`,
    [coach.coach_no, searchStart]
  );
  
  // 查询活跃或预约的乐捐记录（获取乐捐归来时间、实际开始时间、预约开始时间）
  const lejuan = await get(
    `SELECT id, return_time, actual_start_time, scheduled_start_time, lejuan_status 
     FROM lejuan_records 
     WHERE coach_no = ? AND lejuan_status IN ('active', 'pending')
     ORDER BY scheduled_start_time DESC LIMIT 1`,
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
    // 3. 检查是否是预约乐捐外出打卡（预约开始时间接近 + pending状态）
    else if (lejuan && lejuan.lejuan_status === 'pending' && lejuan.scheduled_start_time && isTimeClose(checkTimeStr, lejuan.scheduled_start_time)) {
      punchType = 'lejuan_out';
      reason = `水牌空闲 + 预约乐捐开始时间(${lejuan.scheduled_start_time})接近`;
    }
    // 4. 否则是下班打卡（场景二：先钉钉打卡，后系统打卡）
    else {
      punchType = 'out';
      reason = `水牌空闲 + 无接近的系统时间`;
    }
  } else if (currentStatus === '乐捐') {
    // 检查钉钉打卡是否在乐捐开始后15分钟内（可能是外出打卡）
    if (lejuan && lejuan.actual_start_time) {
      const startTime = new Date(lejuan.actual_start_time + '+08:00');
      const checkTime = new Date(checkTimeStr + '+08:00');
      const diffMinutes = (checkTime - startTime) / (1000 * 60);
      
      if (diffMinutes <= 15) {
        dingtalkLog.write(`${coach.stage_name} 钉钉打卡在乐捐开始后15分钟内，跳过`);
        return;
      }
    }
    
    // ========== 新增：双重场景判断（修复后）==========
    // 场景一：没有打卡记录
    const noAttendance = !attendance;
    
    // 场景二：有打卡记录 + clock_in_time 与钉钉打卡时间相差 <= 15分钟
    const clockInTimeClose = attendance && attendance.clock_in_time && 
      isTimeClose(checkTimeStr, attendance.clock_in_time, 15);
    
    if (noAttendance || clockInTimeClose) {
      // 双重场景：乐捐归来 + 上班打卡
      punchType = 'return_and_in';
      if (noAttendance) {
        reason = `水牌乐捐状态 + 无打卡记录（双重场景）`;
      } else {
        reason = `水牌乐捐状态 + 系统打卡时间(${attendance.clock_in_time})接近（双重场景）`;
      }
      dingtalkLog.write(`${coach.stage_name} 双重场景: 乐捐归来 + 上班打卡`);
    } else {
      // 单一场景：乐捐归来
      punchType = 'return';
      reason = `水牌乐捐状态`;
    }
  } else if (currentStatus === '服务中') {
    // 服务中状态不处理
    dingtalkLog.write(`${coach.stage_name} 当前服务中，忽略打卡`);
    return;
  } else if (['早加班', '晚加班', '休息', '请假', '公休'].includes(currentStatus)) {
    // 加班/休息/请假/公休状态 → 判断为上班打卡
    punchType = 'in';
    reason = `状态${currentStatus} → 上班打卡`;
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
    // 乐捐归来打卡 → 只写入 dingtalk_return_time
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
  } else if (punchType === 'return_and_in') {
    // 双重场景：乐捐归来 + 上班打卡 → 写入两个表
    dingtalkLog.write(`${coach.stage_name} 钉钉乐捐归来+上班打卡: ${checkTimeStr}`);
    
    // 1. 写入乐捐表
    if (lejuan) {
      await enqueueRun(
        `UPDATE lejuan_records SET dingtalk_return_time = ?, updated_at = ? WHERE id = ?`,
        [checkTimeStr, TimeUtil.nowDB(), lejuan.id]
      );
      dingtalkLog.write(`更新乐捐记录: ${coach.stage_name} dingtalk_return_time = ${checkTimeStr}`);
    } else {
      dingtalkLog.write(`警告: ${coach.stage_name} 乐捐打卡但无 active 乐捐记录`);
    }
    
    // 2. 写入打卡表
    if (!attendance) {
      // 创建新记录
      await enqueueRun(
        `INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, dingtalk_in_time, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [todayStr, coach.coach_no, coach.employee_id, coach.stage_name, checkTimeStr, TimeUtil.nowDB(), TimeUtil.nowDB()]
      );
      dingtalkLog.write(`创建打卡记录: ${coach.stage_name} dingtalk_in_time = ${checkTimeStr}`);
    } else {
      // 更新钉钉上班时间
      await enqueueRun(
        `UPDATE attendance_records SET dingtalk_in_time = ?, updated_at = ? WHERE id = ?`,
        [checkTimeStr, TimeUtil.nowDB(), attendance.id]
      );
      dingtalkLog.write(`更新打卡记录: ${coach.stage_name} dingtalk_in_time = ${checkTimeStr}`);
    }
  } else if (punchType === 'lejuan_out') {
    // 预约乐捐外出打卡 → 写入 dingtalk_out_time
    dingtalkLog.write(`${coach.stage_name} 钉钉乐捐外出打卡: ${checkTimeStr}`);
    
    if (lejuan) {
      await enqueueRun(
        `UPDATE lejuan_records SET dingtalk_out_time = ?, updated_at = ? WHERE id = ?`,
        [checkTimeStr, TimeUtil.nowDB(), lejuan.id]
      );
      dingtalkLog.write(`更新乐捐记录: ${coach.stage_name} dingtalk_out_time = ${checkTimeStr}`);
    } else {
      dingtalkLog.write(`警告: ${coach.stage_name} 乐捐外出打卡但无预约乐捐记录`);
    }
  }
}

module.exports = {
  getAccessToken,
  getUserIdByMobile,
  getAttendanceList,
  queryRecentAttendance,
  queryLejuanReturnAttendance,
  verifySignature,
  decryptMessage,
  encryptMessage,
  calculateSignature,
  handleAttendanceEvent,
  dingtalkLog,
  dingtalkConfig
};