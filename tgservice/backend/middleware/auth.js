/**
 * 认证中间件
 * 验证后台用户登录状态
 */

const db = require('../db');

/**
 * 验证用户是否已登录
 * 从请求头获取 Authorization，验证用户是否存在
 */
async function required(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: '未授权访问'
      });
    }
    
    const token = authHeader.substring(7); // 移除 'Bearer '
    
    // 从 admin_users 表验证用户
    // token 格式：username:timestamp:signature
    const parts = token.split(':');
    if (parts.length !== 3) {
      return res.status(401).json({
        success: false,
        error: '无效的令牌格式'
      });
    }
    
    const [username, timestamp, signature] = parts;
    
    // 验证用户是否存在
    const user = await db.get(
      'SELECT username, name, role FROM admin_users WHERE username = ?',
      [username]
    );
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: '用户不存在'
      });
    }
    
    // 简单验证：检查 token 是否在 24 小时内
    const now = Date.now();
    const tokenTime = parseInt(timestamp, 10);
    const TOKEN_EXPIRE_MS = 24 * 60 * 60 * 1000; // 24 小时
    
    if (now - tokenTime > TOKEN_EXPIRE_MS) {
      return res.status(401).json({
        success: false,
        error: '令牌已过期'
      });
    }
    
    // 验证签名（简单实现：username + timestamp 的 MD5）
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHash('md5')
      .update(username + timestamp + 'tgservice-secret-key')
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(401).json({
        success: false,
        error: '无效的令牌签名'
      });
    }
    
    // 附加用户信息到请求对象
    req.user = {
      username: user.username,
      name: user.name,
      role: user.role
    };
    
    next();
  } catch (error) {
    console.error('认证中间件错误:', error);
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
  optional
};
