/**
 * API 错误日志记录器
 * 统一记录 API 拒绝（400/403/404 等）的详细日志
 */

const TimeUtil = require('./time');

/**
 * 敏感字段列表（需要脱敏）
 */
const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'token',
  'accessToken',
  'refreshToken',
  'access_token',
  'refresh_token',
  'auth',
  'authorization'
];

/**
 * 脱敏处理对象中的敏感字段
 * @param {Object} obj - 原始对象
 * @returns {Object} 脱敏后的对象
 */
function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = Array.isArray(obj) ? [] : {};
  
  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELDS.some(f => lowerKey.includes(f.toLowerCase()));
    
    if (isSensitive) {
      result[key] = '***REDACTED***';
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      result[key] = sanitize(obj[key]);
    } else {
      result[key] = obj[key];
    }
  }
  
  return result;
}

/**
 * 记录 API 拒绝日志
 * @param {Object} req - Express 请求对象
 * @param {Object} error - 错误对象 { status, error } 或 Error 实例
 */
function logApiRejection(req, error) {
  // 只记录明确的业务拒绝（有 status 的错误）
  // 不记录 500 错误（系统异常）
  const status = error?.status;
  if (!status || status >= 500) return;
  
  // 提取操作人信息
  const operator = req?.user?.username || req?.user?.name || req?.user?.phone || '匿名';
  
  // 提取目标（HTTP 方法 + 路径）
  const method = req?.method || 'UNKNOWN';
  const path = req?.originalUrl || req?.url || 'UNKNOWN';
  const target = `${method} ${path}`;
  
  // 提取原因
  const reason = error?.error || error?.message || '未知错误';
  
  // 脱敏请求体
  const sanitizedBody = sanitize(req?.body);
  const bodyStr = Object.keys(sanitizedBody).length > 0 
    ? JSON.stringify(sanitizedBody) 
    : '{}';
  
  // 时间戳
  const timestamp = TimeUtil.nowDB();
  
  // 输出日志
  console.log(`[${timestamp}] [API拒绝] 操作人:${operator} 目标:${target} 状态码:${status} 原因:${reason} 请求体:${bodyStr}`);
}

module.exports = {
  logApiRejection,
  sanitize
};