/**
 * Turso 云端数据库实现
 * 使用 @tursodatabase/serverless 连接云端 SQLite
 */

const { createClient } = require('@tursodatabase/serverless/compat');

// Turso 连接配置（从环境变量读取）
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

console.log('[Turso] 连接云端数据库:', process.env.TURSO_DATABASE_URL);

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
  
  setTimeout(runWriteQueue, 0);
};

// ========== 基础查询方法 ==========

/**
 * 查询所有行
 * Turso execute 返回 { columns, rows, rowsAffected, lastInsertRowid }
 * rows 是数组，每个元素是数组 [col1, col2, ...]，需要转换为对象
 */
const all = async (sql, params = []) => {
  const result = await client.execute({ sql, args: params });
  // 将数组格式转换为对象格式
  return result.rows.map(row => {
    const obj = {};
    result.columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
};

/**
 * 查询单行
 */
const get = async (sql, params = []) => {
  const result = await client.execute({ sql, args: params });
  if (result.rows.length === 0) return undefined;
  // 将数组格式转换为对象格式
  const obj = {};
  result.columns.forEach((col, i) => {
    obj[col] = result.rows[0][i];
  });
  return obj;
};

/**
 * 执行写入操作
 */
const run = async (sql, params = []) => {
  const result = await client.execute({ sql, args: params });
  return {
    lastID: result.lastInsertRowid || 0,
    changes: result.rowsAffected || 0
  };
};

// ========== 事务方法 ==========

/**
 * Turso 事务：使用 batch() 执行多条语句
 * 注意：Turso 不支持 BEGIN IMMEDIATE，使用 batch 自动事务
 */

const dbTx = (fn) => {
  return enqueueWrite(async () => {
    // Turso 使用 transaction() 方法
    // 但为了兼容现有代码，我们需要模拟事务行为
    // 暂时直接执行 fn，不使用 Turso 事务 API
    // 因为现有代码的 fn 是 callback 形式
    
    return new Promise((resolve, reject) => {
      // 模拟 db 对象，提供 run/get/all 方法
      const mockDb = {
        run: (sql, params, callback) => {
          client.execute({ sql, args: params })
            .then(result => {
              if (callback) callback(null, { lastID: result.lastInsertRowid || 0, changes: result.rowsAffected || 0 });
            })
            .catch(err => {
              if (callback) callback(err);
            });
        },
        get: (sql, params, callback) => {
          client.execute({ sql, args: params })
            .then(result => {
              if (callback) {
                if (result.rows.length === 0) callback(null, undefined);
                else {
                  const obj = {};
                  result.columns.forEach((col, i) => {
                    obj[col] = result.rows[0][i];
                  });
                  callback(null, obj);
                }
              }
            })
            .catch(err => {
              if (callback) callback(err);
            });
        },
        all: (sql, params, callback) => {
          client.execute({ sql, args: params })
            .then(result => {
              if (callback) {
                const rows = result.rows.map(row => {
                  const obj = {};
                  result.columns.forEach((col, i) => {
                    obj[col] = row[i];
                  });
                  return obj;
                });
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

/**
 * beginTransaction: Turso 不支持手动事务控制
 * 返回一个模拟的 transaction 对象，实际操作不真正开事务
 */
const beginTransaction = async () => {
  // Turso 不支持手动 BEGIN/COMMIT
  // 返回模拟对象，直接执行 SQL
  const transaction = {
    run: async (sql, params = []) => {
      return run(sql, params);
    },
    get: async (sql, params = []) => {
      return get(sql, params);
    },
    all: async (sql, params = []) => {
      return all(sql, params);
    },
    commit: async () => {
      // Turso 自动提交，无需手动 commit
      return;
    },
    rollback: async () => {
      // Turso 不支持 rollback
      return;
    }
  };
  return transaction;
};

/**
 * runInTransaction: Turso 版本
 * 使用 Turso 的 transaction() API（如果有）
 * 暂时简化实现，直接执行 callback
 */
const runInTransaction = async (callback) => {
  return enqueueWrite(async () => {
    const tx = {
      run: async (sql, params = []) => run(sql, params),
      get: async (sql, params = []) => get(sql, params),
      all: async (sql, params = []) => all(sql, params),
      commit: async () => {},
      rollback: async () => {}
    };
    
    try {
      const result = await callback(tx);
      return result;
    } catch (err) {
      throw err;
    }
  });
};

/**
 * enqueueRun: 将写入加入队列
 */
const enqueueRun = async (sql, params = []) => {
  return enqueueWrite(async () => {
    return run(sql, params);
  });
};

/**
 * close: Turso 无需显式关闭
 */
const close = async () => {
  // Turso HTTP 连接无需显式关闭
  return;
};

/**
 * 解析 table_no 字符串 → 数组
 */
const parseTables = (tableNoStr) => {
  if (!tableNoStr || tableNoStr.trim() === '') return [];
  return tableNoStr.split(',').map(t => t.trim()).filter(t => t);
};

/**
 * 数组 → table_no 字符串
 */
const joinTables = (tableArr) => {
  if (!tableArr || tableArr.length === 0) return null;
  return tableArr.join(',');
};

// ========== db 对象（兼容 server.js）==========
// Turso 没有 db 实例，但 server.js 可能需要 db.run 等方法
// 创建兼容对象

const db = {
  run: (sql, params, callback) => {
    client.execute({ sql, args: params })
      .then(result => {
        if (callback) callback(null, { lastID: result.lastInsertRowid || 0, changes: result.rowsAffected || 0 });
      })
      .catch(err => {
        if (callback) callback(err);
      });
  },
  get: (sql, params, callback) => {
    client.execute({ sql, args: params })
      .then(result => {
        if (callback) {
          if (result.rows.length === 0) callback(null, undefined);
          else {
            const obj = {};
            result.columns.forEach((col, i) => {
              obj[col] = result.rows[0][i];
            });
            callback(null, obj);
          }
        }
      })
      .catch(err => {
        if (callback) callback(err);
      });
  },
  all: (sql, params, callback) => {
    client.execute({ sql, args: params })
      .then(result => {
        if (callback) {
          const rows = result.rows.map(row => {
            const obj = {};
            result.columns.forEach((col, i) => {
              obj[col] = row[i];
            });
            return obj;
          });
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
  parseTables,
  joinTables
};