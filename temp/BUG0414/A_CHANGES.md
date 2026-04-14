# BUG-0414 修复变更记录 — Subagent A

## 修改日期
2026-04-14

## 修改摘要

统一所有数据库写入操作通过 `writeQueue` 串行化，消除三套事务机制的竞争冲突。

---

## 1. `db/index.js` — 核心模块（3项新增）

### 1.1 新增 `runInTransaction(callback)`
- 事务生命周期在一个 `enqueueWrite` 内完成（BEGIN → 回调 → COMMIT/ROLLBACK）
- 替代 `beginTransaction()`，确保不与其他写入冲突
- 提供 `tx.run()`, `tx.get()`, `tx.all()`, `tx.commit()`, `tx.rollback()` 方法
- 自动处理 commit/rollback，callback 抛异常自动回滚
- 包含事务恢复逻辑：catch "cannot start a transaction" 后先 ROLLBACK 再重试

### 1.2 新增 `enqueueRun(sql, params)`
- 将单个 db.run 操作加入写队列
- 替代直接调用 `dbRun()`，确保所有非事务写入也串行化
- 返回 `{ lastID, changes }` 结果

### 1.3 `dbTx` 增加事务恢复逻辑
- catch "cannot start a transaction" 后先执行 ROLLBACK 再重试 BEGIN IMMEDIATE
- 与 `beginTransaction()` 已有的恢复逻辑保持一致

### 1.4 导出更新
- 新增导出：`runInTransaction`, `enqueueRun`
- `beginTransaction` 保留但标记 deprecated

---

## 2. `server.js` — 主服务文件

### 2.1 import 更新
- 第339行：新增引入 `runInTransaction`, `enqueueRun`

### 2.2 教练创建路由改造（第2678行附近）
**改前**：裸 `dbRun('BEGIN TRANSACTION')` + 手动 COMMIT/ROLLBACK
**改后**：`runInTransaction(async (tx) => { tx.run(...) })`
- INSERT coaches + INSERT water_boards 在一个事务内完成
- 验证失败改为 `throw Error` 自动回滚（替代手动 ROLLBACK + res.json）

### 2.3 `dbRun()` → `enqueueRun()` 改写（约54处）

按模块分类：

**购物车**（6处）：
- PUT /api/cart — DELETE/UPDATE carts
- DELETE /api/cart — DELETE carts
- DELETE /api/cart/:sessionId — DELETE carts
- PUT /api/cart/table — UPDATE carts
- POST /api/order — INSERT orders, ALTER TABLE, DELETE carts

**教练/人气**（4处）：
- 人气值更新 — UPDATE coaches SET popularity
- 助教登录后更新身份证 — UPDATE coaches SET id_card_last6
- 助教更新资料 — UPDATE coaches
- 助教头像设置 — UPDATE coaches SET photos

**会员**（5处）：
- 短信登录 INSERT members
- 微信登录 INSERT members + UPDATE openid
- 更新会员资料 — UPDATE members
- 会员退出 — UPDATE members SET openid = NULL

**订单**（4处）：
- 完成订单 — UPDATE orders SET status = '已完成'
- 取消订单 — UPDATE orders SET status = '已取消'
- 取消单个商品 — UPDATE orders（2处：空订单取消 + 部分取消）

**管理员用户**（4处）：
- 创建用户 — INSERT admin_users
- 更新用户 — UPDATE admin_users（密码/无密码 2处）
- 删除用户 — DELETE admin_users

**商品分类**（3处）：
- 创建分类 — INSERT product_categories
- 更新排序 — UPDATE product_categories
- 删除分类 — DELETE product_categories

**商品**（3处）：
- 创建商品 — INSERT products
- 更新商品 — UPDATE products
- 删除商品 — DELETE products

**会员管理**（2处）：
- 新增会员 — INSERT members
- 修改会员 — UPDATE members

**短信配置**（1处）：
- 切换服务商 — INSERT OR REPLACE system_config

**设备黑名单**（3处）：
- 添加黑名单 — INSERT device_blacklist
- 删除黑名单 — DELETE device_blacklist

**台桌**（3处）：
- 新增台桌 — INSERT tables
- 更新台桌 — UPDATE tables
- 删除台桌 — DELETE tables

**包房**（9处）：
- 新增包房 — INSERT vip_rooms
- 更新包房 — UPDATE vip_rooms
- 删除包房 — DELETE vip_rooms
- 删除照片 — UPDATE vip_rooms SET photos
- 删除视频 — UPDATE vip_rooms SET videos
- 设置头像 — UPDATE vip_rooms SET photos（2处）

**设备访问统计**（2处）：
- 记录访问 — INSERT device_visits
- 定时清理 — DELETE device_visits

**其他**（3处）：
- 首页配置 — ALTER TABLE home_config + UPDATE home_config
- 系统配置初始化 — INSERT system_config（1处保留为 dbRun，因为是启动时 DDL）

**保留为 `dbRun`（无需改）**：
- 2处 DDL：`CREATE TABLE IF NOT EXISTS`（启动时执行，非请求处理路径）

---

## 3. 路由文件修改

### 3.1 `routes/coaches.js` — 4处 `beginTransaction()` → `runInTransaction()`

| 行号 | 路由 | 改动 |
|------|------|------|
| ~20 | POST /:coach_no/clock-in | beginTransaction → runInTransaction |
| ~106 | POST /:coach_no/clock-out | beginTransaction → runInTransaction |
| ~179 | PUT /batch-shift | beginTransaction → runInTransaction |
| ~301 | PUT /:coach_no/shift | beginTransaction → runInTransaction |

- 移除 `const db = require('../db')`（不再需要）
- `db.get`/`db.all` → `tx.get`/`tx.all`（事务内读取）
- `transaction.run` → `tx.run`
- 提前返回改为 `throw { status, error }` 让 runInTransaction 自动回滚

### 3.2 `routes/applications.js` — 2处 `beginTransaction()` → `runInTransaction()`

| 行号 | 路由 | 改动 |
|------|------|------|
| ~25 | POST / | beginTransaction → runInTransaction |
| ~267 | PUT /:id/approve | beginTransaction → runInTransaction |

- `transaction.run/get/all` → `tx.run/get/all`
- `transaction.commit()` → 自动提交（runInTransaction 内部处理）
- `transaction.rollback()` → 自动回滚（异常时）

### 3.3 `routes/guest-invitations.js` — 4处 `beginTransaction()` → `runInTransaction()`

| 行号 | 路由 | 改动 |
|------|------|------|
| ~44 | POST /lock-should-invite | beginTransaction → runInTransaction |
| ~185 | POST / | beginTransaction → runInTransaction |
| ~365 | PUT /:id/review | beginTransaction → runInTransaction |
| ~454 | POST /statistics | beginTransaction → runInTransaction |

- 同 coaches.js 改造模式
- 保留 `db.get`/`db.all` 用于事务外读取

### 3.4 `routes/water-boards.js` — 1处 `beginTransaction()` → `runInTransaction()`

| 行号 | 路由 | 改动 |
|------|------|------|
| ~108 | PUT /:coach_no/status | beginTransaction → runInTransaction |

### 3.5 `routes/table-action-orders.js` — 2处 `beginTransaction()` → `runInTransaction()`

| 行号 | 路由 | 改动 |
|------|------|------|
| ~20 | POST / | beginTransaction → runInTransaction |
| ~207 | PUT /:id/status | beginTransaction → runInTransaction |

- 乐观锁检查（updateResult.changes === 0）改为 `throw { status: 409 }` 自动回滚

### 3.6 `routes/service-orders.js` — 4处 `db.run()` → `enqueueRun()`

| 行号 | 操作 | 改动 |
|------|------|------|
| ~44 | INSERT service_orders | db.run → enqueueRun |
| ~57 | INSERT operation_logs（创建日志） | db.run → enqueueRun |
| ~188 | UPDATE service_orders（状态更新） | db.run → enqueueRun |
| ~197 | INSERT operation_logs（状态变更日志） | db.run → enqueueRun |

---

## 统计

| 指标 | 数量 |
|------|------|
| 修改文件 | 8 |
| runInTransaction 替换 | 14处（server.js 1 + 路由13） |
| dbRun → enqueueRun 替换 | ~58处（server.js 54 + service-orders.js 4） |
| beginTransaction → runInTransaction | 13处 |
| 新增函数 | 2（runInTransaction, enqueueRun） |
| 语法检查 | 8/8 通过 |

---

## 验证要点

1. ✅ 所有文件 `node -c` 语法检查通过
2. ✅ 路由文件中无剩余 `beginTransaction` 调用
3. ✅ 路由文件中无剩余 `db.run` 调用
4. ✅ server.js 中仅剩2处 DDL（CREATE TABLE），不在请求处理路径
5. ✅ 所有写操作均通过 writeQueue 串行化
