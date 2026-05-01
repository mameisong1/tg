/**
 * 数据库模块 - 统一入口
 * 根据环境变量自动切换本地 SQLite 或 Turso 云端数据库
 * 
 * 配置来源优先级：
 * 1. process.env.TURSO_DATABASE_URL 和 process.env.TURSO_AUTH_TOKEN（最高优先级）
 * 2. 配置文件中的 turso 配置（.config 或 .config.prod）
 * 
 * 使用方式：
 * - 本地 SQLite：不配置 Turso 相关项
 * - Turso 云端：在配置文件中添加 turso 配置，或设置环境变量
 */

const path = require('path');
const fs = require('fs');

// 判断环境
const env = process.env.TGSERVICE_ENV || 'test';
const configFileName = env === 'test' ? '.config' : '.config.prod';
const configPath = path.join(__dirname, '../../' + configFileName);

// 读取配置文件
let config = {};
try {
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (e) {
  console.warn('[DB] 配置文件读取失败:', e.message);
}

// 获取 Turso 配置（环境变量优先，配置文件次之）
const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || config.turso?.url;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || config.turso?.authToken;

const USE_TURSO = TURSO_DATABASE_URL && TURSO_AUTH_TOKEN;

if (USE_TURSO) {
  console.log('[DB] 使用 Turso 云端数据库');
  console.log(`[DB] 配置来源: ${configPath}`);
  
  // 设置环境变量供子模块使用
  process.env.TURSO_DATABASE_URL = TURSO_DATABASE_URL;
  process.env.TURSO_AUTH_TOKEN = TURSO_AUTH_TOKEN;
  
  module.exports = require('./index-turso');
} else {
  console.log('[DB] 使用本地 SQLite 数据库');
  console.log(`[DB] 配置来源: ${configPath}`);
  module.exports = require('./index-local');
}