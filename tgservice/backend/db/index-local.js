/**
 * 本地 SQLite 数据库实现
 * 从 index.js 原代码迁移，保持原有逻辑
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { preprocessSQL } = require('./preprocess-sql');

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

console.log('[SQLite] 连接本地数据库:', dbPath);

// ========== SQL 审计：超 300 行查询记录 ==========
const SQL_AUDIT_THRESHOLD = 300;
const SQL_AUDIT_COOLDOWN_MS = 60 * 60 * 1000;
const sqlAuditLogPath = path.join(__dirname, '../../logs/sql-audit.log');
const sqlAuditLastRecorded = new Map();

function auditLargeQuery(sql, rowCount) {
  const now = Date.now();
  const normalizedSQL = sql.replace(/\s+/g, ' ').trim();
  const lastTime = sqlAuditLastRecorded.get(normalizedSQL);
  if (lastTime && (now - lastTime) < SQL_AUDIT_COOLDOWN_MS) return;
  sqlAuditLastRecorded.set(normalizedSQL, now);
  const timestamp = new Date(now).toISOString();
  const line = JSON.stringify({ time: timestamp, type: 'large', rows: rowCount, sql: normalizedSQL }) + '\n';
  try {
    fs.appendFileSync(sqlAuditLogPath, line, 'utf-8');
  } catch (e) {
    console.error('[SQL审计] 写日志失败:', e.message);
  }
}

// ========== SQL 审计：慢查询（SELECT 超过 500ms）==========
const SQL_SLOW_THRESHOLD_MS = 500;
const sqlSlowAuditLogPath = path.join(__dirname, '../../logs/sql-slow-audit.log');
const sqlSlowAuditLastRecorded = new Map();

function auditSlowQuery(sql, durationMs) {
  const now = Date.now();
  const normalizedSQL = sql.replace(/\s+/g, ' ').trim();
  const lastTime = sqlSlowAuditLastRecorded.get(normalizedSQL);
  if (lastTime && (now - lastTime) < SQL_AUDIT_COOLDOWN_MS) return;
  sqlSlowAuditLastRecorded.set(normalizedSQL, now);
  const timestamp = new Date(now).toISOString();
  const line = JSON.stringify({ time: timestamp, type: 'slow', durationMs, sql: normalizedSQL }) + '\n';
  try {
    fs.appendFileSync(sqlSlowAuditLogPath, line, 'utf-8');
  } catch (e) {
    console.error('[SQL慢查询审计] 写日志失败:', e.message);
  }
}

// 定期清理过期条目，防止 Map 无限增长
setInterval(() => {
  const now = Date.now();
  for (const [key, lastTime] of sqlAuditLastRecorded) {
    if (now - lastTime >= SQL_AUDIT_COOLDOWN_MS * 2) {
      sqlAuditLastRecorded.delete(key);
    }
  }
  for (const [key, lastTime] of sqlSlowAuditLastRecorded) {
    if (now - lastTime >= SQL_AUDIT_COOLDOWN_MS * 2) {
      sqlSlowAuditLastRecorded.delete(key);
    }
  }
}, 30 * 60 * 1000);

// ========== Write Queue: 所有写操作串行化 ==========

const writeQueue = [];
let writeQueueRunning = false;

// ========== Write Queue 监控模块 ==========

const queueStats = {
  data: [],
  maxQueueLen: 0,
  maxWaitMs: 0,
  currentMinute: 0
};

const MAX_POINTS = 360;

function flushMinuteBucket() {
  const now = Date.now();
  const minuteKey = Math.floor(now / 60000) * 60000;
  if (queueStats.currentMinute !== minuteKey) {
    if (queueStats.currentMinute !== 0) {
      queueStats.data.push({
        timestamp: queueStats.currentMinute,
        queueLength: queueStats.maxQueueLen,
        waitMs: queueStats.maxWaitMs
      });
      if (queueStats.data.length > MAX_POINTS) {
        queueStats.data.splice(0, queueStats.data.length - MAX_POINTS);
      }
    }
    queueStats.currentMinute = minuteKey;
    queueStats.maxQueueLen = 0;
    queueStats.maxWaitMs = 0;
  }
}

setInterval(flushMinuteBucket, 60000);

function recordQueueMetrics() {
  flushMinuteBucket();
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

// ========== 基础查询方法 ==========

const all = (sql, params = []) => {
  const processed = preprocessSQL(sql, params);
  return new Promise((resolve, reject) => {
    const startMs = Date.now();
    db.all(processed.sql, processed.args, (err, rows) => {
      if (err) reject(err);
      else {
        const durationMs = Date.now() - startMs;
        if (rows && rows.length >= SQL_AUDIT_THRESHOLD) auditLargeQuery(sql, rows.length);
        if (durationMs >= SQL_SLOW_THRESHOLD_MS) auditSlowQuery(sql, durationMs);
        resolve(rows);
      }
    });
  });
};

const get = (sql, params = []) => {
  const processed = preprocessSQL(sql, params);
  return new Promise((resolve, reject) => {
    const startMs = Date.now();
    db.get(processed.sql, processed.args, (err, row) => {
      if (err) reject(err);
      else {
        const durationMs = Date.now() - startMs;
        if (durationMs >= SQL_SLOW_THRESHOLD_MS) auditSlowQuery(sql, durationMs);
        resolve(row);
      }
    });
  });
};

const run = (sql, params = []) => {
  const processed = preprocessSQL(sql, params);
  return new Promise((resolve, reject) => {
    db.run(processed.sql, processed.args, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

// ========== 事务方法 ==========

const dbTx = (fn) => {
  return enqueueWrite((done) => {
    db.run('BEGIN IMMEDIATE', (err) => {
      if (err) {
        if (err.message && err.message.includes('cannot start a transaction')) {
          db.run('ROLLBACK', () => {
            db.run('BEGIN IMMEDIATE', (err2) => {
              if (err2) return done(err2);
              fn(db, (err3, result) => {
                if (err3) {
                  db.run('ROLLBACK', () => done(err3));
                } else {
                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) done(commitErr);
                    else done(null, result);
                  });
                }
              });
            });
          });
        } else {
          return done(err);
        }
      } else {
        fn(db, (err, result) => {
          if (err) {
            db.run('ROLLBACK', () => done(err));
          } else {
            db.run('COMMIT', (commitErr) => {
              if (commitErr) done(commitErr);
              else done(null, result);
            });
          }
        });
      }
    });
  });
};

const dbTxAsync = async (fn) => {
  return new Promise((resolve, reject) => {
    dbTx((db, done) => {
      fn(db).then(result => done(null, result)).catch(err => done(err));
    }).then(resolve).catch(reject);
  });
};

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

  // 🔴 修复：transaction 方法使用预处理
  const transaction = {
    run: (sql, params = []) => {
      const processed = preprocessSQL(sql, params);
      return new Promise((resolve, reject) => {
        db.run(processed.sql, processed.args, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    get: (sql, params = []) => {
      const processed = preprocessSQL(sql, params);
      return new Promise((resolve, reject) => {
        const startMs = Date.now();
        db.get(processed.sql, processed.args, (err, row) => {
          if (err) reject(err);
          else {
            const durationMs = Date.now() - startMs;
            if (durationMs >= SQL_SLOW_THRESHOLD_MS) auditSlowQuery(sql, durationMs);
            resolve(row);
          }
        });
      });
    },
    all: (sql, params = []) => {
      const processed = preprocessSQL(sql, params);
      return new Promise((resolve, reject) => {
        const startMs = Date.now();
        db.all(processed.sql, processed.args, (err, rows) => {
          if (err) reject(err);
          else {
            const durationMs = Date.now() - startMs;
            if (rows && rows.length >= SQL_AUDIT_THRESHOLD) auditLargeQuery(sql, rows.length);
            if (durationMs >= SQL_SLOW_THRESHOLD_MS) auditSlowQuery(sql, durationMs);
            resolve(rows);
          }
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

// 🔴 修复：runInTransaction 的 tx 方法使用预处理
function runTxInnerLocal(done, callback, resolve, reject) {
  const tx = {
    run: (sql, params = []) => new Promise((res, rej) => {
      const processed = preprocessSQL(sql, params);
      db.run(processed.sql, processed.args, function(e) {
        if (e) rej(e);
        else res({ lastID: this.lastID, changes: this.changes });
      });
    }),
    get: (sql, params = []) => new Promise((res, rej) => {
      const processed = preprocessSQL(sql, params);
      const startMs = Date.now();
      db.get(processed.sql, processed.args, (e, row) => {
        if (e) rej(e);
        else {
          const durationMs = Date.now() - startMs;
          if (durationMs >= SQL_SLOW_THRESHOLD_MS) auditSlowQuery(sql, durationMs);
          res(row);
        }
      });
    }),
    all: (sql, params = []) => new Promise((res, rej) => {
      const processed = preprocessSQL(sql, params);
      const startMs = Date.now();
      db.all(processed.sql, processed.args, (e, rows) => {
        if (e) rej(e);
        else {
          const durationMs = Date.now() - startMs;
          if (rows && rows.length >= SQL_AUDIT_THRESHOLD) auditLargeQuery(sql, rows.length);
          if (durationMs >= SQL_SLOW_THRESHOLD_MS) auditSlowQuery(sql, durationMs);
          res(rows);
        }
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

const runInTransaction = async (callback) => {
  return new Promise((resolve, reject) => {
    enqueueWrite((done) => {
      db.run('BEGIN IMMEDIATE', (err) => {
        if (err) {
          if (err.message && err.message.includes('cannot start a transaction')) {
            db.run('ROLLBACK', () => {
              db.run('BEGIN IMMEDIATE', (err2) => {
                if (err2) return done(err2);
                runTxInnerLocal(done, callback, resolve, reject);
              });
            });
          } else {
            return done(err);
          }
        } else {
          runTxInnerLocal(done, callback, resolve, reject);
        }
      });
    }).then(resolve).catch(reject);
  });
};

// 🔴 修复：使用预处理
const enqueueRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    enqueueWrite((done) => {
      const processed = preprocessSQL(sql, params);
      db.run(processed.sql, processed.args, function(err) {
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

const close = () => {
  return new Promise((resolve, reject) => {
    db.close(err => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const parseTables = (tableNoStr) => {
  if (!tableNoStr || tableNoStr.trim() === '') return [];
  return tableNoStr.split(',').map(t => t.trim()).filter(t => t);
};

const joinTables = (tableArr) => {
  if (!tableArr || tableArr.length === 0) return null;
  return tableArr.join(',');
};

module.exports = {
  db,
  all,
  get,
  run,
  beginTransaction,
  dbTx,
  dbTxAsync,
  runInTransaction,
  enqueueRun,
  dbAll: all,
  dbGet: get,
  dbRun: run,
  close,
  queueStats,
  writeQueue,
  parseTables,
  joinTables,
  preprocessSQL
};
