/**
 * 数据库模块 - 唯一数据库连接中心
 * 所有路由和 server.js 都从这里获取 db 实例，确保单连接
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../db/tgservice.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(`数据库连接失败: ${err.message}`);
    return;
  }
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA synchronous = NORMAL');
  db.run('PRAGMA busy_timeout = 3000');
});

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

// ========== Write Queue: 所有写操作串行化 ==========

const writeQueue = [];
let writeQueueRunning = false;

const enqueueWrite = (fn) => {
  return new Promise((resolve, reject) => {
    writeQueue.push({ fn, resolve, reject });
    if (!writeQueueRunning) runWriteQueue();
  });
};

const runWriteQueue = () => {
  if (writeQueue.length === 0) {
    writeQueueRunning = false;
    return;
  }
  writeQueueRunning = true;
  const { fn, resolve, reject } = writeQueue.shift();
  fn((err, result) => {
    if (err) reject(err);
    else resolve(result);
    setTimeout(runWriteQueue, 0);
  });
};

/**
 * 事务辅助: 在 BEGIN IMMEDIATE 事务中串行执行读写操作
 * 通过 writeQueue 确保同时只有一个写事务在执行
 */
const dbTx = (fn) => {
  return enqueueWrite((done) => {
    db.run('BEGIN IMMEDIATE', (err) => {
      if (err) return done(err);
      fn(
        db,
        (err, result) => {
          if (err) {
            db.run('ROLLBACK', () => done(err));
          } else {
            db.run('COMMIT', (commitErr) => {
              if (commitErr) done(commitErr);
              else done(null, result);
            });
          }
        }
      );
    });
  });
};

/**
 * 事务辅助 async/await 版本
 */
const dbTxAsync = async (fn) => {
  return new Promise((resolve, reject) => {
    dbTx((db, done) => {
      fn(db).then(result => done(null, result)).catch(err => done(err));
    }).then(result => resolve(result)).catch(err => reject(err));
  });
};

/**
 * 开始事务 (async/await 版本，供路由使用)
 * 单连接 + WAL 模式下，SQLite 自动串行化
 * busy_timeout=3000 确保冲突时自动重试
 * 如果当前已有活跃事务（异常退出未清理），先回滚再开始
 */
const beginTransaction = async () => {
  try {
    await new Promise((resolve, reject) => {
      db.run('BEGIN IMMEDIATE', function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (err) {
    if (err.message && err.message.includes('cannot start a transaction')) {
      // 有未清理的旧事务，先强制回滚
      try {
        await new Promise((resolve) => db.run('ROLLBACK', () => resolve()));
      } catch (_) {}
      await new Promise((resolve, reject) => {
        db.run('BEGIN IMMEDIATE', function(err) {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      throw err;
    }
  }

  const transaction = {
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
    commit: () => {
      return run('COMMIT');
    },
    rollback: () => {
      return run('ROLLBACK').catch(() => {});
    }
  };
  return transaction;
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
  // 数据库实例（server.js 需要）
  db,
  // 查询方法（路由文件用）
  all,
  get,
  run,
  // 事务方法
  beginTransaction,
  dbTx,
  dbTxAsync,
  // Promise化辅助（server.js 用）
  dbAll: all,
  dbGet: get,
  dbRun: run,
  // 关闭
  close
};
