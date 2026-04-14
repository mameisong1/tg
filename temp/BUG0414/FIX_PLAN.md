# BUG-0414 修复方案

## Bug 描述

购物车添加商品时报错 `SQLITE_ERROR: cannot start a transaction within a transaction`

## 根因

项目中有**三套互相冲突的事务机制**共用同一个 SQLite 数据库连接（`db/index.js` 中的单例 `db`）：

| 机制 | 函数 | 走写队列 | 使用位置 |
|------|------|----------|----------|
| **A** | `dbTx()` / `dbTxAsync()` | ✅ 是 | `server.js` 购物车、商品同步、台桌状态同步 |
| **B** | `beginTransaction()` | ❌ 否 | 5个路由文件，13处调用 |
| **C** | 裸 `dbRun('BEGIN TRANSACTION')` | ❌ 否 | `server.js` 第2678行（教练创建） |

**故障链**：
1. B/C 直接调 `db.run('BEGIN IMMEDIATE')` 开始事务（不排队）
2. 如果该事务异常退出未清理，连接上残留活跃事务
3. A 调 `dbTx()` 也发 `BEGIN IMMEDIATE`，冲突报错
4. 后续所有 `dbTx()` 持续失败

## 修复方案

### 核心思路

**所有数据库写入操作都通过 `writeQueue` 串行化**，消除竞争。

### 改动清单

#### 1. `db/index.js` — 核心修改

##### 1.1 新增 `runInTransaction(callback)` — 替代 `beginTransaction()`

```javascript
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
        if (err) return done(err);

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
      });
    }).then(resolve).catch(reject);
  });
};
```

##### 1.2 新增 `enqueueRun(sql, params)` — 非事务写入排队

```javascript
/**
 * 将单个 db.run 操作加入写队列，替代直接调用 dbRun
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
```

##### 1.3 `dbTx` 增加事务恢复逻辑

在 `db.run('BEGIN IMMEDIATE')` 的 catch 中加入恢复逻辑（同 `beginTransaction` 已有的恢复逻辑）：

```javascript
const dbTx = (fn) => {
  return enqueueWrite((done) => {
    db.run('BEGIN IMMEDIATE', (err) => {
      if (err) {
        if (err.message && err.message.includes('cannot start a transaction')) {
          // 有残留事务，先回滚再重试
          db.run('ROLLBACK', () => {
            db.run('BEGIN IMMEDIATE', (err2) => {
              if (err2) return done(err2);
              // ... 正常流程
            });
          });
        } else {
          return done(err);
        }
      } else {
        // 正常流程
        fn(db, (err, result) => { ... });
      }
    });
  });
};
```

##### 1.4 导出新函数

```javascript
module.exports = {
  db, all, get, run,
  beginTransaction,   // 保留但标记 deprecated
  dbTx, dbTxAsync,
  runInTransaction,   // 新增
  enqueueRun,         // 新增
  close,
  queueStats, writeQueue
};
```

---

#### 2. `server.js` — 修改教练创建路由（第2678行附近）

**改前**：
```javascript
await dbRun('BEGIN TRANSACTION');
try {
  const result = await dbRun('INSERT INTO coaches ...');
  await dbRun('INSERT INTO water_boards ...');
  await dbRun('COMMIT');
} catch (err) {
  await dbRun('ROLLBACK');
  throw err;
}
```

**改后**：
```javascript
const { runInTransaction } = require('./db');
await runInTransaction(async (tx) => {
  const result = await tx.run('INSERT INTO coaches ...');
  await tx.run('INSERT INTO water_boards ...');
  return { lastID: result.lastID };
});
```

---

#### 3. `server.js` — 所有 `dbRun()` 写操作改为 `enqueueRun()`

约 30 处，包括：
- 购物车增删改 (PUT/DELETE)
- 订单创建 `dbRun('INSERT INTO orders...')`
- 教练人气更新
- 会员绑定
- 管理员 CRUD
- 分类 CRUD
- 等等

**注意**：`dbTx()` 内部的 `db.run()` 不需要改（已经通过 dbTx 串行化）

---

#### 4. `routes/coaches.js` — 4处 `beginTransaction()` → `runInTransaction()`

- 第19行：创建教练
- 第115行：更新教练
- 第197行：删除教练
- 第331行：批量更新教练

---

#### 5. `routes/applications.js` — 2处 `beginTransaction()` → `runInTransaction()`

- 第23行：创建申请
- 第279行：更新申请

---

#### 6. `routes/guest-invitations.js` — 4处 `beginTransaction()` → `runInTransaction()`

- 第42行：创建邀请
- 第216行：接受邀请
- 第418行：取消邀请
- 第517行：完成邀请

---

#### 7. `routes/water-boards.js` — 1处 `beginTransaction()` → `runInTransaction()`

- 第106行：更新水牌

---

#### 8. `routes/table-action-orders.js` — 2处 `beginTransaction()` → `runInTransaction()`

- 第18行：创建订单
- 第246行：更新订单

---

#### 9. `routes/service-orders.js` — 4处 `db.run()` → `enqueueRun()`

- 第43行：创建服务订单
- 第56行：更新状态
- 第187行：更新状态
- 第196行：删除

---

## 预期效果

所有数据库写入（事务和非事务）都通过 `enqueueWrite` 串行执行，不存在多条路径竞争同一个 db 连接的情况。购物车不会再出现 "cannot start a transaction within a transaction" 错误。

## 测试重点

1. 购物车添加商品（POST /api/cart）
2. 购物车更新/删除（PUT/DELETE /api/cart）
3. 教练创建/更新/删除（routes/coaches.js）
4. 申请创建/更新（routes/applications.js）
5. 邀请 CRUD（routes/guest-invitations.js）
6. 水牌更新（routes/water-boards.js）
7. 台桌操作订单（routes/table-action-orders.js）
8. 服务订单（routes/service-orders.js）
9. 订单创建（server.js POST /api/order）
10. 并发场景：同时多个写入操作
