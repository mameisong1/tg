/**
 * 数据库模块
 * 导出数据库辅助函数供路由使用
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../db/tgservice.db');
const db = new sqlite3.Database(dbPath);

/**
 * 执行查询，返回所有行
 */
const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

/**
 * 执行查询，返回单行
 */
const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

/**
 * 执行插入/更新/删除操作
 */
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

/**
 * 开始事务
 * 如果当前已有活跃事务（可能是前一个请求异常退出未清理），先回滚再开始新事务
 */
const beginTransaction = async () => {
  // 尝试开始事务，如果失败说明可能有未清理的旧事务
  try {
    await run('BEGIN IMMEDIATE TRANSACTION');
  } catch (err) {
    if (err.message && err.message.includes('cannot start a transaction within a transaction')) {
      // 有未清理的旧事务，先强制回滚
      console.warn('检测到未清理的旧事务，尝试回滚...');
      try {
        await run('ROLLBACK');
      } catch (rollbackErr) {
        // 回滚失败也继续尝试开始新事务
        console.warn('回滚旧事务失败:', rollbackErr.message);
      }
      // 重试开始事务
      await run('BEGIN IMMEDIATE TRANSACTION');
    } else {
      throw err;
    }
  }
  
  return {
    run: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    get: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    },
    all: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    },
    commit: async () => {
      await run('COMMIT');
    },
    rollback: async () => {
      await run('ROLLBACK');
    }
  };
};

/**
 * 关闭数据库连接
 */
const close = () => {
  return new Promise((resolve, reject) => {
    db.close(err => {
      if (err) reject(err);
      else resolve();
    });
  });
};

module.exports = {
  all,
  get,
  run,
  beginTransaction,
  close
};
