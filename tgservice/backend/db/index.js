/**
 * 数据库模块 - 统一入口
 * 根据环境变量自动切换本地 SQLite 或 Turso 云端数据库
 * 
 * 使用方式：
 * - 本地 SQLite（生产环境）：不设置 TURSO_DATABASE_URL 和 TURSO_AUTH_TOKEN
 * - Turso 云端（开发环境）：设置 TURSO_DATABASE_URL 和 TURSO_AUTH_TOKEN
 * 
 * 对外暴露相同 API，调用方无需修改代码
 */

const USE_TURSO = process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN;

if (USE_TURSO) {
  console.log('[DB] 使用 Turso 云端数据库');
  module.exports = require('./index-turso');
} else {
  console.log('[DB] 使用本地 SQLite 数据库');
  module.exports = require('./index-local');
}