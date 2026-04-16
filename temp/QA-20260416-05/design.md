# QA-20260416-05 设计方案：H5 商品页面人气值排序

## 1. 需求概述

**目标**：H5 商品页面按人气值倒序排序，让用户优先看到最受欢迎的商品。

**三项变更**：
1. 数据库 `products` 表新增 `popularity` 字段（INTEGER，默认 0）
2. 用户将商品加入购物车时 `popularity + 1`，从购物车删除时 `popularity - 1`（不低于 0）
3. 前台 H5 商品列表按 `popularity DESC` 排序

---

## 2. 现有代码分析

### 2.1 数据库表结构

**products 表**（当前）：
```sql
CREATE TABLE products (
  name TEXT PRIMARY KEY,
  category TEXT,
  image_url TEXT,
  price REAL DEFAULT 0,
  stock_total INTEGER DEFAULT 0,
  stock_available INTEGER DEFAULT 0,
  status TEXT DEFAULT '上架',
  creator TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**carts 表**（当前）：
```sql
CREATE TABLE carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  table_no TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  options TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 相关后端 API（server.js）

| API | 方法 | 当前行为 | 需要修改？ |
|-----|------|---------|-----------|
| `GET /api/products` | GET | 查询上架商品，无排序 | ✅ 加 `ORDER BY` |
| `POST /api/cart` | POST | 加入购物车（新增或累加 quantity） | ✅ 加 popularity + 1 |
| `PUT /api/cart` | PUT | 更新购物车数量（quantity ≤ 0 时删除） | ✅ 删除时 popularity - 1 |
| `DELETE /api/cart` | DELETE | 删除购物车商品 | ✅ 加 popularity - 1 |

### 2.3 前端相关页面

| 页面 | 文件 | 作用 |
|------|------|------|
| 商品页 | `src/pages/products/products.vue` | 展示商品列表 |
| 购物车页 | `src/pages/cart/cart.vue` | 管理购物车、修改数量、删除商品 |
| API 封装 | `src/utils/api.js` | 前端 HTTP 请求封装 |

---

## 3. 技术方案

### 3.1 数据库变更

#### 3.1.1 新增字段

```sql
ALTER TABLE products ADD COLUMN popularity INTEGER DEFAULT 0;
```

**说明**：
- 字段名：`popularity`
- 类型：`INTEGER`
- 默认值：`0`
- 已有商品自动补 0

#### 3.1.2 迁移脚本

创建文件：`/TG/tgservice/backend/db/v2.1.sql`

```sql
-- =====================================================
-- 天宫国际 V2.1 数据库迁移脚本
-- 日期：2026-04-16
-- 说明：商品表新增人气值字段
-- =====================================================

ALTER TABLE products ADD COLUMN popularity INTEGER DEFAULT 0;

-- 迁移完成
```

#### 3.1.3 迁移执行方式

```bash
cd /TG/tgservice
sqlite3 db/tgservice.db < backend/db/v2.1.sql
```

验证：
```bash
sqlite3 db/tgservice.db "PRAGMA table_info(products);" | grep popularity
# 预期输出：5|popularity|INTEGER|0|0
```

---

### 3.2 后端 API 变更

#### 3.2.1 `GET /api/products` — 增加排序

**文件**：`/TG/tgservice/backend/server.js`（第 548-562 行区域）

**当前代码**：
```javascript
app.get('/api/products', async (req, res) => {
    const { category } = req.query;
    let sql = "SELECT name, category, image_url, price, stock_available, status FROM products WHERE status = '上架'";
    const params = [];
    if (category && category !== '全部') {
        sql += ' AND category = ?';
        params.push(category);
    }
    sql += ' ORDER BY rowid ASC';  // 当前按插入顺序
    const products = await dbAll(sql, params);
    res.json(products);
});
```

**修改为**：
```javascript
app.get('/api/products', async (req, res) => {
    const { category } = req.query;
    let sql = "SELECT name, category, image_url, price, stock_available, status, popularity FROM products WHERE status = '上架'";
    const params = [];
    if (category && category !== '全部') {
        sql += ' AND category = ?';
        params.push(category);
    }
    sql += ' ORDER BY popularity DESC, created_at DESC';  // 人气值降序，同人气按创建时间降序
    const products = await dbAll(sql, params);
    res.json(products);
});
```

**变更点**：
- SELECT 增加 `popularity` 字段
- ORDER BY 改为 `popularity DESC, rowid ASC`

#### 3.2.2 `POST /api/cart` — 加车时 popularity + 1

**文件**：`/TG/tgservice/backend/server.js`（第 584-613 行区域）

**当前代码**（核心逻辑）：
```javascript
await runInTransaction(async (tx) => {
    const existing = await tx.get(
        'SELECT id, quantity FROM carts WHERE session_id = ? AND product_name = ? AND ...',
        [sessionId, productName, options, options]
    );
    if (existing) {
        await tx.run('UPDATE carts SET quantity = quantity + ?, table_no = ? WHERE id = ?',
            [quantity, tableNo || null, existing.id]);
    } else {
        await tx.run('INSERT INTO carts (session_id, table_no, product_name, quantity, options) VALUES (?, ?, ?, ?, ?)',
            [sessionId, tableNo || null, productName, quantity, options]);
    }
});
```

**修改为**：
```javascript
await runInTransaction(async (tx) => {
    const existing = await tx.get(
        'SELECT id, quantity FROM carts WHERE session_id = ? AND product_name = ? AND ...',
        [sessionId, productName, options, options]
    );
    if (existing) {
        await tx.run('UPDATE carts SET quantity = quantity + ?, table_no = ? WHERE id = ?',
            [quantity, tableNo || null, existing.id]);
    } else {
        await tx.run('INSERT INTO carts (session_id, table_no, product_name, quantity, options) VALUES (?, ?, ?, ?, ?)',
            [sessionId, tableNo || null, productName, quantity, options]);
    }
    // 新商品首次加入购物车时，人气值 +1
    if (!existing) {
        await tx.run('UPDATE products SET popularity = popularity + 1 WHERE name = ?', [productName]);
    }
});
```

**设计决策**：只在 `!existing` 时 +1（即首次加入购物车），而非每次加数量都 +1。
**理由**："加入购物车"是动作，不是"增加数量"。用户把同一商品数量从 1 调到 3 不算重新加入购物车。

#### 3.2.3 `PUT /api/cart` — 数量调为 0 时 popularity - 1

**文件**：`/TG/tgservice/backend/server.js`（第 637-653 行区域）

**当前代码**：
```javascript
app.put('/api/cart', async (req, res) => {
    const { sessionId, productName, quantity, options = '' } = req.body;
    if (quantity <= 0) {
        await enqueueRun('DELETE FROM carts WHERE session_id = ? AND product_name = ? AND ...',
            [sessionId, productName, options, options]);
    } else {
        await enqueueRun('UPDATE carts SET quantity = ? WHERE session_id = ? AND product_name = ? AND ...',
            [quantity, sessionId, productName, options, options]);
    }
    res.json({ success: true });
});
```

**修改为**：
```javascript
app.put('/api/cart', async (req, res) => {
    const { sessionId, productName, quantity, options = '' } = req.body;
    if (quantity <= 0) {
        await runInTransaction(async (tx) => {
            // 先确认商品确实在购物车中
            const item = await tx.get(
                'SELECT id FROM carts WHERE session_id = ? AND product_name = ? AND ...',
                [sessionId, productName, options, options]
            );
            if (item) {
                await tx.run('DELETE FROM carts WHERE session_id = ? AND product_name = ? AND ...',
                    [sessionId, productName, options, options]);
                // 从购物车移除，人气值 -1（不低于 0）
                await tx.run('UPDATE products SET popularity = MAX(popularity - 1, 0) WHERE name = ?', [productName]);
            }
        });
    } else {
        await enqueueRun('UPDATE carts SET quantity = ? WHERE session_id = ? AND product_name = ? AND ...',
            [quantity, sessionId, productName, options, options]);
    }
    res.json({ success: true });
});
```

#### 3.2.4 `DELETE /api/cart` — 删除购物车商品时 popularity - 1

**文件**：`/TG/tgservice/backend/server.js`（第 656-667 行区域）

**当前代码**：
```javascript
app.delete('/api/cart', async (req, res) => {
    const { sessionId, productName, options = '' } = req.body;
    await enqueueRun('DELETE FROM carts WHERE session_id = ? AND product_name = ? AND ...',
        [sessionId, productName, options, options]);
    res.json({ success: true });
});
```

**修改为**：
```javascript
app.delete('/api/cart', async (req, res) => {
    const { sessionId, productName, options = '' } = req.body;
    await runInTransaction(async (tx) => {
        const item = await tx.get(
            'SELECT id FROM carts WHERE session_id = ? AND product_name = ? AND ...',
            [sessionId, productName, options, options]
        );
        if (item) {
            await tx.run('DELETE FROM carts WHERE session_id = ? AND product_name = ? AND ...',
                [sessionId, productName, options, options]);
            // 从购物车移除，人气值 -1（不低于 0）
            await tx.run('UPDATE products SET popularity = MAX(popularity - 1, 0) WHERE name = ?', [productName]);
        }
    });
    res.json({ success: true });
});
```

---

### 3.3 前端变更

#### 3.3.1 商品页面 — 无需修改

**文件**：`/TG/tgservice-uniapp/src/pages/products/products.vue`

**原因**：后端返回的商品列表已经按 `popularity DESC` 排序，前端直接渲染即可。`products.vue` 的 `filteredProducts` computed 只是对 `products.value` 做前端过滤（搜索关键词），不改变顺序。

#### 3.3.2 购物车页面 — 无需修改

**文件**：`/TG/tgservice-uniapp/src/pages/cart/cart.vue`

**原因**：购物车加减人气值逻辑在后端执行，前端只需正常调用现有 API（`api.addCart`、`api.updateCart`、`api.deleteCartItem`），无需额外改动。

#### 3.3.3 API 封装 — 无需修改

**文件**：`/TG/tgservice-uniapp/src/utils/api.js`

**原因**：API 接口路径和参数均未变化，只是后端返回值多了一个 `popularity` 字段。

---

### 3.4 后台管理页面变更（可选）

**文件**：`/TG/tgservice/admin/products.html`

建议在商品管理后台增加人气值列，方便运营查看：

| 变更位置 | 内容 |
|----------|------|
| 表头第 171 行 | 在"状态"列后增加 `<th>人气</th>` |
| 渲染行 304-310 | 在状态列后增加 `<td>${p.popularity || 0}</td>` |
| colspan | 从 `colspan="7"` 改为 `colspan="8"` |

---

## 4. 完整 API 变更汇总

| API | 方法 | 变更类型 | 详情 |
|-----|------|---------|------|
| `GET /api/products` | GET | 修改 | SELECT 增加 `popularity`；ORDER BY 改为 `popularity DESC, rowid ASC` |
| `POST /api/cart` | POST | 修改 | `!existing` 时 `popularity + 1` |
| `PUT /api/cart` | PUT | 修改 | `quantity <= 0` 时（删除），`popularity - 1`（不低于 0） |
| `DELETE /api/cart` | DELETE | 修改 | 删除时 `popularity - 1`（不低于 0） |
| `DELETE /api/cart/:sessionId` | DELETE | **不修改** | 清空整个购物车时不影响 popularity（用户主动清空 ≠ 删除单个商品） |

---

## 5. 边界情况和异常处理

### 5.1 人气值不会出现负数

- 所有 `-1` 操作使用 `MAX(popularity - 1, 0)` 确保不低于 0
- 删除前先检查购物车中是否确实存在该商品

### 5.2 并发安全

- `POST /api/cart` 的 `+1` 操作在 `runInTransaction` 事务内执行
- `PUT /api/cart` 和 `DELETE /api/cart` 的 `-1` 操作也在 `runInTransaction` 事务内执行
- 事务通过 `writeQueue` 串行化，不会发生并发写冲突

### 5.3 重复加入购物车

- 同一 session 中同一商品（含相同 options）第二次加购时 `existing` 不为空，**不重复 +1**
- 用户先删除（-1）再加回来（+1），逻辑正确

### 5.4 清空购物车

- `DELETE /api/cart/:sessionId`（清空整个购物车）**不修改** popularity
- **理由**：用户已确认，清空购物车不影响人气值；只有明确删除单个商品才影响人气值

### 5.5 商品下架/删除

- 商品下架后人气值保留，重新上架后仍按原人气值排序
- 如商品从数据库删除，人气值自然消失（无需额外处理）

### 5.6 已有商品

- 迁移脚本 `ALTER TABLE ... ADD COLUMN` 会自动为所有已有商品填充 `popularity = 0`
- 上线后用户操作自然积累人气值

---

## 6. 文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `/TG/tgservice/backend/db/v2.1.sql` | 数据库迁移脚本（新增 popularity 字段） |

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `/TG/tgservice/backend/server.js` | 1) `/api/products` 排序 2) `/api/cart` POST +1 3) `/api/cart` PUT -1 4) `/api/cart` DELETE -1 |
| `/TG/tgservice/admin/products.html`（可选） | 表格增加人气值列 |

### 不修改文件

| 文件 | 原因 |
|------|------|
| `/TG/tgservice-uniapp/src/pages/products/products.vue` | 后端已排序，前端无需改动 |
| `/TG/tgservice-uniapp/src/pages/cart/cart.vue` | 人气值变更在后端，前端无需改动 |
| `/TG/tgservice-uniapp/src/utils/api.js` | API 接口未变化 |

---

## 7. 测试用例

### 7.1 数据库迁移

| 编号 | 测试步骤 | 预期结果 |
|------|---------|---------|
| DB-01 | 执行 v2.1.sql 迁移脚本 | 无报错 |
| DB-02 | 查询 products 表结构 | 包含 `popularity` 字段，默认值 0 |
| DB-03 | 查询已有商品 | 所有商品 `popularity = 0` |

### 7.2 加入购物车人气值 +1

| 编号 | 测试步骤 | 预期结果 |
|------|---------|---------|
| CART-01 | 新商品首次加入购物车 | `popularity = 1` |
| CART-02 | 同一商品再次加入购物车（同 options） | `popularity = 1`（不变） |
| CART-03 | 不同 options 的同名商品加入购物车 | `popularity = 2`（视为新条目） |
| CART-04 | 两个不同 session 加入同一商品 | `popularity = 2` |

### 7.3 从购物车删除人气值 -1

| 编号 | 测试步骤 | 预期结果 |
|------|---------|---------|
| DEL-01 | 删除购物车中唯一一件商品 | `popularity = 0`（1-1=0） |
| DEL-02 | 删除后人气值不会为负 | `popularity >= 0` |
| DEL-03 | 删除不存在的商品 | `popularity` 不变 |
| DEL-04 | PUT 接口 quantity 调为 0 | `popularity - 1` |
| DEL-05 | DELETE 接口删除商品 | `popularity - 1` |

### 7.4 商品列表排序

| 编号 | 测试步骤 | 预期结果 |
|------|---------|---------|
| SORT-01 | 3 个商品人气值分别为 5, 0, 3 | 返回顺序：5 → 3 → 0 |
| SORT-02 | 2 个商品人气值相同 | 按插入顺序排列（rowid ASC） |
| SORT-03 | 按分类筛选后排序 | 该分类内按人气值降序 |
| SORT-04 | 搜索后排序 | 搜索结果按人气值降序 |

### 7.5 边界情况

| 编号 | 测试步骤 | 预期结果 |
|------|---------|---------|
| EDGE-01 | 清空整个购物车 | `popularity` 不变 |
| EDGE-02 | 商品下架后仍有人气值 | `popularity` 保留 |
| EDGE-03 | 并发加入购物车 | 无 SQLITE_BUSY 错误 |

---

## 8. 编码规范检查

### ✅ 时间处理
- 本次改动**不涉及**时间处理，无需 TimeUtil

### ✅ 数据库连接
- 全部使用 `runInTransaction` 和 `enqueueRun`，底层复用 `db/index.js` 唯一连接
- 不创建新的 `sqlite3.Database` 实例

### ✅ 数据库写入
- 写入操作使用 `runInTransaction(async (tx) => { ... })` 或 `enqueueRun(...)`
- 不使用 `db.run('BEGIN TRANSACTION')` 或裸开事务

---

## 9. 部署步骤

### 9.1 数据库迁移

```bash
# 备份数据库
cp /TG/tgservice/db/tgservice.db /TG/tgservice/db/tgservice.db.bak.$(date +%Y%m%d)

# 执行迁移
cd /TG/tgservice
sqlite3 db/tgservice.db < backend/db/v2.1.sql

# 验证
sqlite3 db/tgservice.db "SELECT name, popularity FROM products LIMIT 5;"
```

### 9.2 后端部署

1. 提交代码到 Git
2. 重启测试环境 PM2：`pm2 restart tgservice-dev`
3. 验证 API 返回包含 `popularity` 字段
4. 用户确认后重启生产环境 Docker：`docker restart tgservice`

### 9.3 前端部署

- 前端代码**无需修改**，无需部署

---

## 10. 回滚方案

如果出现问题，可快速回滚：

```sql
-- 回滚：删除 popularity 字段（SQLite 不支持 DROP COLUMN 旧版本）
-- 方案：重建表（谨慎操作）
-- 1. 备份数据
CREATE TABLE products_backup AS SELECT * FROM products;
-- 2. 删除 popularity 列需要重建表，建议直接恢复备份数据库文件
```

**建议回滚方式**：用备份的 `tgservice.db` 文件替换当前数据库文件。

---

## 11. 后续优化建议（不在此次需求范围）

1. **人气值衰减**：可考虑加入时间衰减因子（如每天衰减 10%），让近期热门商品优先
2. **后台管理**：在 admin/products.html 增加人气值列和重置按钮
3. **人气值排行榜**：可基于 popularity 生成"人气商品 TOP 10"
4. **防刷机制**：同一 session 对同一商品短时间内重复加/删可加限流
