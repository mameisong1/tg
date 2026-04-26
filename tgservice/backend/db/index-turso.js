/**
 * Turso 云端数据库实现
 * 使用 @tursodatabase/serverless 连接云端 SQLite
 * 
 * 重要：Turso 不支持 SQL 中直接使用中文字符串常量
 * 例如 WHERE device_type = "灯" 会报错
 * 解决方案：预处理 SQL，将中文字符串常量转换为参数化查询
 */

const { createClient } = require('@tursodatabase/serverless/compat');

// Turso 连接配置（从环境变量读取）
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

console.log('[Turso] 连接云端数据库:', process.env.TURSO_DATABASE_URL);

// ========== SQL 预处理器：处理中文字符串常量 ==========

/**
 * 预处理 SQL：将中文字符串常量转换为参数化查询
 * 
 * Turso 不支持在 SQL 中直接使用中文字符串常量：
 * - ❌ WHERE device_type = "灯"  → 报错: no such column: 灯
 * - ✅ WHERE device_type = ?     → 正确，参数: ['灯']
 * 
 * 此函数自动检测并转换：
 * 输入: 'SELECT * FROM switch_device WHERE device_type = "灯" AND status = "空闲"'
 * 输出: { sql: 'SELECT * FROM switch_device WHERE device_type = ? AND status = ?', args: ['灯', '空闲'] }
 * 
 * @param {string} sql - 原始 SQL
 * @param {Array} params - 原有参数
 * @returns {Object} { sql, args } - 处理后的 SQL 和参数
 */
function preprocessSQLForTurso(sql, params = []) {
  // Turso 不支持 SQL 中直接使用字符串常量（包括中文、空字符串、普通字符串）
  // 解决方案：将 WHERE/VALUES/SET 等位置的字符串常量转换为参数化查询
  // 注意：需要排除 DEFAULT 'xxx' 或 DEFAULT "xxx"（列定义默认值）
  
  // 正则匹配单引号或双引号包裹的字符串（包括空字符串）
  const stringRegex = /(["'])([^"']*)\1/g;
  
  const extractedStrings = [];
  
  // 替换字符串常量为 ?
  const processedSQL = sql.replace(stringRegex, (match, quote, content, offset) => {
    // 检查前面的内容，排除 DEFAULT 值
    const before = sql.substring(Math.max(0, offset - 30), offset).toUpperCase().trim();
    
    // 如果紧前面是 DEFAULT 或 AS，不处理（保持原样）
    if (before.endsWith('DEFAULT') || before.endsWith('AS')) {
      return match;
    }
    
    // 如果在 CREATE TABLE 语句中的类型定义位置，不处理
    const fullBefore = sql.substring(0, offset).toUpperCase();
    if (fullBefore.includes('CREATE TABLE') && 
        (fullBefore.includes('TEXT') || fullBefore.includes('INTEGER') || fullBefore.includes('DATETIME') || fullBefore.includes('REAL'))) {
      // 检查是否是列定义的默认值
      const lastPart = fullBefore.substring(fullBefore.lastIndexOf('CREATE TABLE'));
      if (lastPart.match(/(TEXT|INTEGER|DATETIME|REAL)\s+(DEFAULT|NOT\s+NULL)/i)) {
        return match;
      }
    }
    
    extractedStrings.push(content);
    return '?';
  });
  
  // 如果没有提取到字符串，直接返回原 SQL
  if (extractedStrings.length === 0) {
    return { sql, args: params };
  }
  
  // 合并参数：原有参数 + 提取的字符串
  const finalArgs = [...params, ...extractedStrings];
  
  if (extractedStrings.some(s => s === '' || /[\u4e00-\u9fa5]/.test(s))) {
    console.log('[Turso] SQL预处理:', sql.substring(0, 60), '→ 提取:', extractedStrings.filter(s => s === '' || /[\u4e00-\u9fa5]/.test(s)));
  }
  
  return { sql: processedSQL, args: finalArgs };
}

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
 * 
 * 重要：自动预处理 SQL，处理中文字符串常量
 */
const all = async (sql, params = []) => {
  // 预处理 SQL
  const processed = preprocessSQLForTurso(sql, params);
  
  const result = await client.execute({ sql: processed.sql, args: processed.args });
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
 * 重要：自动预处理 SQL，处理中文字符串常量
 */
const get = async (sql, params = []) => {
  // 预处理 SQL
  const processed = preprocessSQLForTurso(sql, params);
  
  const result = await client.execute({ sql: processed.sql, args: processed.args });
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
 * 重要：自动预处理 SQL，处理中文字符串常量
 */
const run = async (sql, params = []) => {
  // 预处理 SQL
  const processed = preprocessSQLForTurso(sql, params);
  
  const result = await client.execute({ sql: processed.sql, args: processed.args });
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
    return new Promise((resolve, reject) => {
      // 模拟 db 对象，提供 run/get/all 方法（带预处理）
      const mockDb = {
        run: (sql, params, callback) => {
          const processed = preprocessSQLForTurso(sql, params);
          client.execute({ sql: processed.sql, args: processed.args })
            .then(result => {
              if (callback) callback(null, { lastID: result.lastInsertRowid || 0, changes: result.rowsAffected || 0 });
            })
            .catch(err => {
              if (callback) callback(err);
            });
        },
        get: (sql, params, callback) => {
          const processed = preprocessSQLForTurso(sql, params);
          client.execute({ sql: processed.sql, args: processed.args })
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
          const processed = preprocessSQLForTurso(sql, params);
          client.execute({ sql: processed.sql, args: processed.args })
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
      return;
    },
    rollback: async () => {
      return;
    }
  };
  return transaction;
};

/**
 * runInTransaction: Turso 版本
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
// 创建兼容对象（带预处理）

const db = {
  run: (sql, params, callback) => {
    const processed = preprocessSQLForTurso(sql, params);
    client.execute({ sql: processed.sql, args: processed.args })
      .then(result => {
        if (callback) callback(null, { lastID: result.lastInsertRowid || 0, changes: result.rowsAffected || 0 });
      })
      .catch(err => {
        if (callback) callback(err);
      });
  },
  get: (sql, params, callback) => {
    const processed = preprocessSQLForTurso(sql, params);
    client.execute({ sql: processed.sql, args: processed.args })
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
    const processed = preprocessSQLForTurso(sql, params);
    client.execute({ sql: processed.sql, args: processed.args })
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
  joinTables,
  // 导出预处理函数供测试
  preprocessSQLForTurso
};