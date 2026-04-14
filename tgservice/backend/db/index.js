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

// ========== Write Queue 监控模块 ==========

const queueStats = {
  data: [],              // 环形缓冲区，最多 360 个点（6小时 × 60分钟）
  maxQueueLen: 0,        // 当前分钟最大队列长度
  maxWaitMs: 0,          // 当前分钟最长等待毫秒
  currentMinute: 0       // 当前分钟桶时间戳
};

const MAX_POINTS = 360;  // 6小时 × 60 分钟

function flushMinuteBucket() {
  const now = Date.now();
  const minuteKey = Math.floor(now / 60000) * 60000;
  if (queueStats.currentMinute !== minuteKey) {
    // 新分钟桶，先保存旧桶数据
    if (queueStats.currentMinute !== 0) {
      queueStats.data.push({
        timestamp: queueStats.currentMinute,
        queueLength: queueStats.maxQueueLen,
        waitMs: queueStats.maxWaitMs
      });
      // 保留最近 MAX_POINTS 个点
      if (queueStats.data.length > MAX_POINTS) {
        queueStats.data.splice(0, queueStats.data.length - MAX_POINTS);
      }
    }
    // 重置当前桶
    queueStats.currentMinute = minuteKey;
    queueStats.maxQueueLen = 0;
    queueStats.maxWaitMs = 0;
  }
}

// 每 60 秒检查并 flush
setInterval(flushMinuteBucket, 60000);

function recordQueueMetrics() {
  flushMinuteBucket();
  // 更新当前分钟的峰值
  const pendingNow = writeQueue.length;
  if (pendingNow > queueStats.maxQueueLen) {
    queueStats.maxQueueLen = pendingNow;
  }
}

const enqueueWrite = (fn) => {
  return new Promise((resolve, reject) => {
    writeQueue.push({ fn, resolve, reject, _queuedAt: Date.now() });
    recordQueueMetrics();
    if (!writeQueueRunning) runWriteQueue();
  });
};

const runWriteQueue = () => {
  if (writeQueue.length === 0) {
    writeQueueRunning = false;
    return;
  }
  writeQueueRunning = true;
  const { fn, resolve, reject, _queuedAt } = writeQueue.shift();
  fn((err, result) => {
    // 记录等待时长
    flushMinuteBucket();
    const waitMs = _queuedAt ? Date.now() - _queuedAt : 0;
    if (waitMs > queueStats.maxWaitMs) {
      queueStats.maxWaitMs = waitMs;
    }
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
      if (err) {
        if (err.message && err.message.includes('cannot start a transaction')) {
          // 有残留事务，先回滚再重试
          db.run('ROLLBACK', () => {
            db.run('BEGIN IMMEDIATE', (err2) => {
              if (err2) return done(err2);
              fn(
                db,
                (err3, result) => {
                  if (err3) {
                    db.run('ROLLBACK', () => done(err3));
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
        } else {
          return done(err);
        }
      } else {
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
      }
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

/**
 * 事务辅助：整个事务生命周期在一个 enqueueWrite 内完成
 * 替代 beginTransaction()，确保不与其他写入冲突
 * @param {Function} callback - async (tx) => { ... }
 * @returns {Promise} callback 的返回值
 */
const runInTransaction = async (callback) => {
  return new Promise((resolve, reject) => {
    enqueueWrite((done) => {
      db.run('BEGIN IMMEDIATE', (err) => {
        if (err) {
          if (err.message && err.message.includes('cannot start a transaction')) {
            // 有残留事务，先回滚再重试
            db.run('ROLLBACK', () => {
              db.run('BEGIN IMMEDIATE', (err2) => {
                if (err2) return done(err2);
                runTxInner(done, callback, resolve, reject);
              });
            });
          } else {
            return done(err);
          }
        } else {
          runTxInner(done, callback, resolve, reject);
        }
      });
    }).then(resolve).catch(reject);
  });
};

function runTxInner(done, callback, resolve, reject) {
  const tx = {
    run: (sql, params = []) => new Promise((res, rej) => {
      db.run(sql, params, function(e) {
        if (e) rej(e);
        else res({ lastID: this.lastID, changes: this.changes });
      });
    }),
    get: (sql, params = []) => new Promise((res, rej) => {
      db.get(sql, params, (e, row) => {
        if (e) rej(e);
        else res(row);
      });
    }),
    all: (sql, params = []) => new Promise((res, rej) => {
      db.all(sql, params, (e, rows) => {
        if (e) rej(e);
        else res(rows);
      });
    }),
    commit: () => new Promise((res, rej) => {
      db.run('COMMIT', (e) => {
        if (e) rej(e);
        else res();
      });
    }),
    rollback: () => new Promise((res) => {
      db.run('ROLLBACK', () => res());
    })
  };

  callback(tx)
    .then(async (result) => {
      try {
        await tx.commit();
        done(null, result);
      } catch (commitErr) {
        await tx.rollback().catch(() => {});
        done(commitErr);
      }
    })
    .catch(async (cbErr) => {
      await tx.rollback().catch(() => {});
      done(cbErr);
    });
}

/**
 * 将单个 db.run 操作加入写队列，替代直接调用 dbRun
 * @param {string} sql
 * @param {Array} params
 * @returns {Promise<{lastID: number, changes: number}>}
 */
const enqueueRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    enqueueWrite((done) => {
      db.run(sql, params, function(err) {
        if (err) {
          done(err);
          reject(err);
        } else {
          const result = { lastID: this.lastID, changes: this.changes };
          done();
          resolve(result);
        }
      });
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
  beginTransaction,   // 保留但标记 deprecated
  dbTx,
  dbTxAsync,
  runInTransaction,   // 新增
  enqueueRun,         // 新增
  // Promise化辅助（server.js 用）
  dbAll: all,
  dbGet: get,
  dbRun: run,
  // 关闭
  close,
  // 监控数据（只读，供 API 导出）
  queueStats,
  writeQueue
};
