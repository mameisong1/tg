/**
 * Turso 云端数据库实现
 * 使用 @tursodatabase/serverless 连接云端 SQLite
 */

const { createClient } = require('@tursodatabase/serverless/compat');
const { preprocessSQL } = require('./preprocess-sql');
const fs = require('fs');
const path = require('path');

// Turso 连接配置（从环境变量读取）
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

console.log('[Turso] 连接云端数据库:', process.env.TURSO_DATABASE_URL);

// ========== SQL 审计：超 300 行查询记录 ==========
const SQL_AUDIT_THRESHOLD = 300;
const SQL_AUDIT_COOLDOWN_MS = 60 * 60 * 1000; // 同一 SQL 每小时最多记录一次
const sqlAuditLogPath = path.join(__dirname, '../../logs/sql-audit.log');
const sqlAuditLastRecorded = new Map(); // normalizedSQL → 上次记录时间戳(ms)

function auditLargeQuery(sql, rowCount) {
  const now = Date.now();
  // 标准化 SQL：去多余空白，用于去重
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
const sqlSlowAuditLastRecorded = new Map(); // normalizedSQL → 上次记录时间戳(ms)

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
}, 30 * 60 * 1000); // 每30分钟清理一次

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

const runWriteQueue = async () => {
  if (writeQueue.length === 0) {
    writeQueueRunning = false;
    return;
  }
  writeQueueRunning = true;
  const { fn, resolve, reject, _queuedAt } = writeQueue.shift();
  
  try {
    const result = await fn();
    flushMinuteBucket();
    const waitMs = _queuedAt ? Date.now() - _queuedAt : 0;
    if (waitMs > queueStats.maxWaitMs) {
      queueStats.maxWaitMs = waitMs;
    }
    resolve(result);
  } catch (err) {
    flushMinuteBucket();
    reject(err);
  }
  
  setTimeout(() => {
    runWriteQueue().catch(err => console.error('[Turso] writeQueue error:', err));
  }, 0);
};

// 【新增】等待队列空闲（用于系统打卡前等待钉钉推送完成）
const waitForIdle = (timeoutMs = 5000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      if (writeQueue.length === 0 && !writeQueueRunning) {
        resolve();
      } else if (Date.now() - startTime > timeoutMs) {
        reject(new Error('waitForIdle timeout'));
      } else {
        setTimeout(check, 50);  // 每50ms检查一次
      }
    };
    
    check();
  });
};

// ========== 内部执行函数（不预处理，供内部调用）==========

const _executeAll = async (sql, args, auditOriginalSql) => {
  const startMs = Date.now();
  const result = await client.execute({ sql, args });
  const durationMs = Date.now() - startMs;
  const rows = result.rows.map(row => {
    const obj = {};
    result.columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
  // 审计：超阈值查询记录（统一入口，覆盖所有 all() 路径）
  if (rows.length >= SQL_AUDIT_THRESHOLD) {
    auditLargeQuery(auditOriginalSql || sql, rows.length);
  }
  // 审计：慢查询记录
  if (durationMs >= SQL_SLOW_THRESHOLD_MS) {
    auditSlowQuery(auditOriginalSql || sql, durationMs);
  }
  return rows;
};

const _executeGet = async (sql, args, auditOriginalSql) => {
  const startMs = Date.now();
  const result = await client.execute({ sql, args });
  const durationMs = Date.now() - startMs;
  if (result.rows.length === 0) return undefined;
  const obj = {};
  result.columns.forEach((col, i) => {
    obj[col] = result.rows[0][i];
  });
  // 审计：慢查询记录（get 不可能超 300 行，只审计慢查询）
  if (durationMs >= SQL_SLOW_THRESHOLD_MS) {
    auditSlowQuery(auditOriginalSql || sql, durationMs);
  }
  return obj;
};

const _executeRun = async (sql, args) => {
  const result = await client.execute({ sql, args });
  // BigInt 转 Number（lastInsertRowid 可能是 BigInt）
  const lastID = result.lastInsertRowid ? Number(result.lastInsertRowid) : 0;
  const changes = result.rowsAffected ? Number(result.rowsAffected) : 0;
  return { lastID, changes };
};

// ========== 基础查询方法（对外，带预处理）==========

const all = async (sql, params = []) => {
  const processed = preprocessSQL(sql, params);
  // 审计已由 _executeAll 统一处理，传入原始 sql 用于审计日志的可读性
  const rows = await _executeAll(processed.sql, processed.args, sql);
  return rows;
};

const get = async (sql, params = []) => {
  const processed = preprocessSQL(sql, params);
  return _executeGet(processed.sql, processed.args, sql);
};

const run = async (sql, params = []) => {
  const processed = preprocessSQL(sql, params);
  return _executeRun(processed.sql, processed.args);
};

// ========== 事务方法 ==========

const dbTx = (fn) => {
  return enqueueWrite(async () => {
    return new Promise((resolve, reject) => {
      const mockDb = {
        run: (sql, params, callback) => {
          const processed = preprocessSQL(sql, params);
          client.execute({ sql: processed.sql, args: processed.args })
            .then(result => {
              const lastID = result.lastInsertRowid ? Number(result.lastInsertRowid) : 0;
              const changes = result.rowsAffected ? Number(result.rowsAffected) : 0;
              if (callback) callback(null, { lastID, changes });
            })
            .catch(err => {
              if (callback) callback(err);
            });
        },
        get: (sql, params, callback) => {
          const processed = preprocessSQL(sql, params);
          const startMs = Date.now();
          client.execute({ sql: processed.sql, args: processed.args })
            .then(result => {
              const durationMs = Date.now() - startMs;
              if (callback) {
                if (result.rows.length === 0) callback(null, undefined);
                else {
                  const obj = {};
                  result.columns.forEach((col, i) => {
                    obj[col] = result.rows[0][i];
                  });
                  if (durationMs >= SQL_SLOW_THRESHOLD_MS) auditSlowQuery(sql, durationMs);
                  callback(null, obj);
                }
              }
            })
            .catch(err => {
              if (callback) callback(err);
            });
        },
        all: (sql, params, callback) => {
          const processed = preprocessSQL(sql, params);
          const startMs = Date.now();
          client.execute({ sql: processed.sql, args: processed.args })
            .then(result => {
              const durationMs = Date.now() - startMs;
              if (callback) {
                const rows = result.rows.map(row => {
                  const obj = {};
                  result.columns.forEach((col, i) => {
                    obj[col] = row[i];
                  });
                  return obj;
                });
                if (rows.length >= SQL_AUDIT_THRESHOLD) auditLargeQuery(sql, rows.length);
                if (durationMs >= SQL_SLOW_THRESHOLD_MS) auditSlowQuery(sql, durationMs);
                callback(null, rows);
              }
            })
            .catch(err => {
              if (callback) callback(err);
            });
        }
      };
      
      fn(mockDb, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
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

// 🟡 文档说明：Turso 事务不保证原子性（commit/rollback 是空操作）
// 🔴 修复：直接调用内部函数，避免双重预处理
const beginTransaction = async () => {
  const transaction = {
    run: async (sql, params = []) => {
      const processed = preprocessSQL(sql, params);
      return _executeRun(processed.sql, processed.args);
    },
    get: async (sql, params = []) => {
      const processed = preprocessSQL(sql, params);
      return _executeGet(processed.sql, processed.args, sql);
    },
    all: async (sql, params = []) => {
      const processed = preprocessSQL(sql, params);
      // 传入原始 sql 用于审计日志可读性
      return _executeAll(processed.sql, processed.args, sql);
    },
    commit: async () => {
      // Turso 自动提交，无需手动 commit
      return;
    },
    rollback: async () => {
      // Turso 不支持 rollback，此操作为空
      console.warn('[Turso] rollback() 被调用，但 Turso 不支持回滚');
      return;
    }
  };
  return transaction;
};

// 🔴 修复：直接调用内部函数，避免双重预处理
const runInTransaction = async (callback) => {
  return enqueueWrite(async () => {
    const tx = {
      run: async (sql, params = []) => {
        const processed = preprocessSQL(sql, params);
        return _executeRun(processed.sql, processed.args);
      },
      get: async (sql, params = []) => {
        const processed = preprocessSQL(sql, params);
        return _executeGet(processed.sql, processed.args, sql);
      },
      all: async (sql, params = []) => {
        const processed = preprocessSQL(sql, params);
        return _executeAll(processed.sql, processed.args, sql);
      },
      commit: async () => {},
      rollback: async () => {
        console.warn('[Turso] rollback() 被调用，但 Turso 不支持回滚');
      }
    };
    
    try {
      const result = await callback(tx);
      return result;
    } catch (err) {
      throw err;
    }
  });
};

// 🔴 修复：直接调用内部函数，避免双重预处理
const enqueueRun = async (sql, params = []) => {
  return enqueueWrite(async () => {
    const processed = preprocessSQL(sql, params);
    return _executeRun(processed.sql, processed.args);
  });
};

const close = async () => {
  // Turso HTTP 连接无需显式关闭
  return;
};

const parseTables = (tableNoStr) => {
  if (!tableNoStr || tableNoStr.trim() === '') return [];
  return tableNoStr.split(',').map(t => t.trim()).filter(t => t);
};

const joinTables = (tableArr) => {
  if (!tableArr || tableArr.length === 0) return null;
  return tableArr.join(',');
};

// ========== db 对象（兼容 server.js）==========

const db = {
  run: (sql, params, callback) => {
    const processed = preprocessSQL(sql, params);
    client.execute({ sql: processed.sql, args: processed.args })
      .then(result => {
        const lastID = result.lastInsertRowid ? Number(result.lastInsertRowid) : 0;
        const changes = result.rowsAffected ? Number(result.rowsAffected) : 0;
        if (callback) callback(null, { lastID, changes });
      })
      .catch(err => {
        if (callback) callback(err);
      });
  },
  get: (sql, params, callback) => {
    const processed = preprocessSQL(sql, params);
    const startMs = Date.now();
    client.execute({ sql: processed.sql, args: processed.args })
      .then(result => {
        const durationMs = Date.now() - startMs;
        if (callback) {
          if (result.rows.length === 0) callback(null, undefined);
          else {
            const obj = {};
            result.columns.forEach((col, i) => {
              obj[col] = result.rows[0][i];
            });
            if (durationMs >= SQL_SLOW_THRESHOLD_MS) auditSlowQuery(sql, durationMs);
            callback(null, obj);
          }
        }
      })
      .catch(err => {
        if (callback) callback(err);
      });
  },
  all: (sql, params, callback) => {
    const processed = preprocessSQL(sql, params);
    const startMs = Date.now();
    client.execute({ sql: processed.sql, args: processed.args })
      .then(result => {
        const durationMs = Date.now() - startMs;
        if (callback) {
          const rows = result.rows.map(row => {
            const obj = {};
            result.columns.forEach((col, i) => {
              obj[col] = row[i];
            });
            return obj;
          });
          if (rows.length >= SQL_AUDIT_THRESHOLD) auditLargeQuery(sql, rows.length);
          if (durationMs >= SQL_SLOW_THRESHOLD_MS) auditSlowQuery(sql, durationMs);
          callback(null, rows);
        }
      })
      .catch(err => {
        if (callback) callback(err);
      });
  },
  close: (callback) => {
    if (callback) callback(null);
  }
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
  waitForIdle,
  parseTables,
  joinTables,
  preprocessSQL
};
