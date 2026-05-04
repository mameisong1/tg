/**
 * 认证中间件
 * 验证后台用户登录状态
 */

const db = require('../db');
const redisCache = require('../utils/redis-cache');

// ✅ 添加日志支持
const logger = {
  warn: (msg) => console.log('[WARN] ' + new Date().toISOString() + ' ' + msg),
  error: (msg) => console.error('[ERROR] ' + new Date().toISOString() + ' ' + msg)
};

// 🔴 2026-05-04: 默认阈值（北京时间 2026-05-04 11:40:00）
const DEFAULT_THRESHOLD = 1777866000000;
const THRESHOLD_CACHE_KEY = 'coach_token_expire_threshold';
const THRESHOLD_CACHE_TTL = 3600; // 1小时

/**
 * 获取 coachToken 失效阈值（从 Redis 缓存读取）
 */
async function getCoachTokenThreshold() {
  // 先查 Redis 缓存
  const cached = await redisCache.get(THRESHOLD_CACHE_KEY);
  if (cached !== null && cached !== undefined) {
    return parseInt(cached);
  }
  
  // 再查数据库
  try {
    const row = await db.get('SELECT value FROM system_config WHERE key = ?', [THRESHOLD_CACHE_KEY]);
    if (row && row.value) {
      const threshold = parseInt(row.value);
      // 写入 Redis 缓存
      await redisCache.set(THRESHOLD_CACHE_KEY, threshold, THRESHOLD_CACHE_TTL);
      return threshold;
    }
  } catch (e) {
    // 读不到就用默认值
  }
  
  return DEFAULT_THRESHOLD;
}

/**
 * 验证用户是否已登录
 * 从请求头获取 Authorization，验证用户是否存在
 * 支持 JWT token 格式（后台用户）和 Base64 token 格式（助教）
 */
async function required(req, res, next) {
  try {
    // ✅ 检查鉴权开关（从 global 获取，与 server.js 同步）
    const getAuthEnabledCache = global.getAuthEnabledCache;
    if (getAuthEnabledCache && getAuthEnabledCache() === false) {
      req.user = { username: 'bypass', role: '管理员', userType: 'system' };  
      return next();
    }
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn(`认证失败: 未提供token - ${req.method} ${req.url} - IP: ${req.ip}`);
      return res.status(401).json({
        success: false,
        error: '未授权访问'
      });
    }
    
    const token = authHeader.substring(7); // 移除 'Bearer '
    
    // 尝试 JWT 认证（后台用户）
    const fs = require('fs');
    const path = require('path');
    const env = process.env.TGSERVICE_ENV || 'production';
    const configFileName = env === 'test' ? '.config' : '.config.prod';
    const configPath = path.join(__dirname, '../../' + configFileName);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    const jwt = require('jsonwebtoken');
    let decoded;
    let isJwtToken = false;
    
    try {
      decoded = jwt.verify(token, config.jwt.secret);
      isJwtToken = true;
    } catch (jwtError) {
      // JWT 验证失败，可能是助教的 Base64 token 或 memberToken
    }
    
    if (isJwtToken) {
      // 🔴 2026-05-04: JWT payload 验证增强
      // 后台用户 JWT 必须包含 username 和 role
      // memberToken 只有 memberNo 和 phone，不应该用于后台/助教功能
      
      if (decoded.username && decoded.role) {
        // 后台用户 JWT
        const user = await db.get(
          'SELECT username, name, role FROM admin_users WHERE username = ?',
          [decoded.username]
        );
        
        if (!user) {
          logger.warn(`认证失败: 用户不存在 - ${decoded.username} - ${req.method} ${req.url} - IP: ${req.ip}`);
          return res.status(401).json({
            success: false,
            error: '用户不存在'
          });
        }
        
        req.user = {
          username: user.username,
          name: user.name || '',
          role: user.role,
          userType: 'admin'
        };
        
        return next();
      } else if (decoded.memberNo) {
        // memberToken - 不应该用于需要 authMiddleware 的 API
        logger.warn(`认证失败: memberToken 不适用于此API - ${req.method} ${req.url} - IP: ${req.ip}`);
        return res.status(401).json({
          success: false,
          error: '请使用正确的身份登录',
          code: 'INVALID_TOKEN_TYPE'
        });
      } else {
        // JWT payload 格式无效
        logger.warn(`认证失败: JWT payload 缺少必要字段 - ${req.method} ${req.url} - IP: ${req.ip}`);
        return res.status(401).json({
          success: false,
          error: '无效的令牌格式',
          code: 'INVALID_TOKEN_FORMAT'
        });
      }
    }
    
    // Base64 认证：助教
    // 🔴 2026-05-04: 时间戳阈值从 Redis 缓存读取
    const threshold = await getCoachTokenThreshold();
    
    try {
      const decodedStr = Buffer.from(token, 'base64').toString('utf-8');
      const parts = decodedStr.split(':');
      const coachNo = parts[0];
      const timestamp = parseInt(parts[parts.length - 1]) || 0; // 最后一个字段是时间戳
      
      if (!coachNo) {
        logger.warn(`认证失败: token格式无效 - ${req.method} ${req.url} - IP: ${req.ip}`);
        return res.status(401).json({
          success: false,
          error: '无效的令牌'
        });
      }
      
      // 🔴 2026-05-04: 时间戳阈值验证
      if (timestamp < threshold) {
        logger.warn(`认证失败: token已过期(时间戳阈值) - coachNo=${coachNo}, timestamp=${timestamp}, threshold=${threshold} - ${req.method} ${req.url} - IP: ${req.ip}`);
        return res.status(401).json({
          success: false,
          error: '登录已过期，请重新登录',
          code: 'TOKEN_EXPIRED_BY_THRESHOLD'
        });
      }
      
      const coach = await db.get(
        'SELECT coach_no, employee_id, stage_name, phone, level, shift, status FROM coaches WHERE coach_no = ?',
        [coachNo]
      );
      
      if (!coach) {
        logger.warn(`认证失败: 助教不存在 - ${coachNo} - ${req.method} ${req.url} - IP: ${req.ip}`);
        return res.status(401).json({
          success: false,
          error: '助教不存在'
        });
      }
      
      if (coach.status === '离职') {
        logger.warn(`认证失败: 账号已离职 - ${coachNo} ${coach.stage_name} - ${req.method} ${req.url} - IP: ${req.ip}`);
        return res.status(403).json({
          success: false,
          error: '该账号已离职'
        });
      }
      
      req.user = {
        username: coach.phone || coach.coach_no,
        name: coach.stage_name,
        role: '助教',
        userType: 'coach',
        coachNo: coach.coach_no,
        employeeId: coach.employee_id,
        stageName: coach.stage_name
      };
      
      return next();
    } catch (base64Error) {
      return res.status(401).json({
        success: false,
        error: '无效的令牌'
      });
    }
  } catch (error) {
    logger.error(`认证中间件异常 - ${req.method} ${req.url} - IP: ${req.ip} - 错误: ${error.message}`);
    res.status(500).json({
      success: false,
      error: '认证失败'
    });
  }
}

/**
 * 可选认证：如果提供了 token 则验证，否则继续
 */
async function optional(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  
  // 使用 required 中间件进行验证
  required(req, res, next);
}

module.exports = {
  required,
  optional,
  getCoachTokenThreshold,
  DEFAULT_THRESHOLD,
  THRESHOLD_CACHE_KEY
};