/**
 * 操作日志服务
 */

const db = require('../db');

// 操作日志数据库写入开关
// 默认关闭（不设置环境变量时不写入DB），减少SQLite锁竞争
// 需要开启时设置 ENABLE_OPERATION_LOG=true
const ENABLE_OPERATION_LOG = process.env.ENABLE_OPERATION_LOG === 'true';

/**
 * 创建操作日志记录
 * @param {Object} transaction - 数据库事务对象
 * @param {Object} logData - 日志数据
 * @returns {Promise<Object>} 创建的日志记录
 */
async function create(transaction, logData) {
  if (!ENABLE_OPERATION_LOG) {
    return { id: null, skipped: true };
  }
  
  const {
    operator_phone,
    operator_name,
    operation_type,
    target_type,
    target_id,
    old_value,
    new_value,
    remark
  } = logData;
  
  const result = await transaction.run(`
    INSERT INTO operation_logs (
      operator_phone,
      operator_name,
      operation_type,
      target_type,
      target_id,
      old_value,
      new_value,
      remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    operator_phone,
    operator_name,
    operation_type,
    target_type || null,
    target_id || null,
    old_value || null,
    new_value || null,
    remark || null
  ]);
  
  return { id: result.lastID };
}

/**
 * 查询操作日志列表
 * @param {Object} options - 查询选项
 * @returns {Promise<Array>} 日志列表
 */
async function list(options = {}) {
  const {
    operator_phone,
    operation_type,
    target_type,
    target_id,
    start_date,
    end_date,
    limit = 50,
    offset = 0
  } = options;
  
  let sql = 'SELECT * FROM operation_logs WHERE 1=1';
  const params = [];
  
  if (operator_phone) {
    sql += ' AND operator_phone = ?';
    params.push(operator_phone);
  }
  
  if (operation_type) {
    sql += ' AND operation_type = ?';
    params.push(operation_type);
  }
  
  if (target_type) {
    sql += ' AND target_type = ?';
    params.push(target_type);
  }
  
  if (target_id) {
    sql += ' AND target_id = ?';
    params.push(target_id);
  }
  
  if (start_date) {
    sql += ' AND created_at >= ?';
    params.push(start_date);
  }
  
  if (end_date) {
    sql += ' AND created_at <= ?';
    params.push(end_date);
  }
  
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  return await db.all(sql, params);
}

module.exports = {
  create,
  list
};
