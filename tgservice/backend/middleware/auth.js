/**
 * 认证中间件
 * 验证后台用户登录状态
 */

const db = require('../db');

/**
 * 验证用户是否已登录
 * 从请求头获取 Authorization，验证用户是否存在
 * 支持 JWT token 格式
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
    
    // 加载配置获取 JWT secret
    const fs = require('fs');
    const path = require('path');
    const env = process.env.TGSERVICE_ENV || 'production';
    const configFileName = env === 'test' ? '.config.env' : '.config';
    const configPath = path.join(__dirname, '../../' + configFileName);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    // 验证 JWT token
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: '无效的令牌'
      });
    }
    
    const username = decoded.username;
    
    // 验证用户是否存在
    const user = await db.get(
      'SELECT username, role FROM admin_users WHERE username = ?',
      [username]
    );
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: '用户不存在'
      });
    }
    
    // 附加用户信息到请求对象
    req.user = {
      username: user.username,
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
