/**
 * 认证中间件
 * 验证后台用户登录状态
 */

const db = require('../db');

/**
 * 验证用户是否已登录
 * 从请求头获取 Authorization，验证用户是否存在
 * 支持 JWT token 格式（后台用户）和 Base64 token 格式（助教）
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
    
    // 尝试 JWT 认证（后台用户）
    const fs = require('fs');
    const path = require('path');
    const env = process.env.TGSERVICE_ENV || 'production';
    const configFileName = env === 'test' ? '.config.env' : '.config';
    const configPath = path.join(__dirname, '../../' + configFileName);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    const jwt = require('jsonwebtoken');
    let decoded;
    let isJwtToken = false;
    
    try {
      decoded = jwt.verify(token, config.jwt.secret);
      isJwtToken = true;
    } catch (jwtError) {
      // JWT 验证失败，可能是助教的 Base64 token
    }
    
    if (isJwtToken) {
      // JWT 认证：后台用户
      const username = decoded.username;
      
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
      
      req.user = {
        username: user.username,
        name: user.name || '',
        role: user.role,
        userType: 'admin'
      };
      
      return next();
    }
    
    // Base64 认证：助教
    try {
      const decodedStr = Buffer.from(token, 'base64').toString('utf-8');
      const [coachNo, timestamp] = decodedStr.split(':');
      
      if (!coachNo) {
        return res.status(401).json({
          success: false,
          error: '无效的令牌'
        });
      }
      
      const coach = await db.get(
        'SELECT coach_no, employee_id, stage_name, phone, level, shift, status FROM coaches WHERE coach_no = ?',
        [coachNo]
      );
      
      if (!coach) {
        return res.status(401).json({
          success: false,
          error: '助教不存在'
        });
      }
      
      if (coach.status === '离职') {
        return res.status(403).json({
          success: false,
          error: '该账号已离职'
        });
      }
      
      req.user = {
        username: coach.phone || coach.coach_no,
        name: coach.stage_name,
        role: coach.level || '助教',
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
    console.error('认证中间件错误:', error);
    res.status(500).json({
      success: false,
      error: '认证失败'
    });
  }
}
    
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
