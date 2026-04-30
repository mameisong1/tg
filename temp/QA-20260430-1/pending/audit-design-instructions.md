你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
```
# QA-20260430-1 设计方案 - 订单管理页面

## 1. 需求理解

后台 Admin 前厅菜单目录下增加订单管理页面，管理订单表的 CRUD（增删改查）：
- 订单列表展示（支持分页和筛选）
- 订单详情查看
- 订单状态修改
- 订单删除

## 2. 现状分析

### 2.1 订单表结构（orders）

根据代码分析，`orders` 表字段如下：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| order_no | TEXT | 订单号（TG+yyyyMMddHHmmss+3位序号）|
| table_no | TEXT | 台桌号 |
| items | TEXT | 商品列表（JSON）|
| total_price | REAL | 总价 |
| status | TEXT | 状态：待处理/已完成/已取消 |
| device_fingerprint | TEXT | 设备指纹 |
| member_phone | TEXT | 会员手机号 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

**索引**（已有）：
- idx_orders_member_phone
- idx_orders_member_phone_created_at
- idx_orders_device_fingerprint_created_at

### 2.2 现有订单 API（server.js）

| API | 方法 | 说明 | 状态 |
|------|------|------|------|
| `/api/admin/orders` | GET | 订单列表（筛选状态/日期） | ✅ 已存在 |
| `/api/admin/orders/stats` | GET | 订单统计 | ✅ 已存在 |
| `/api/admin/orders/:id/complete` | POST | 完成订单 | ✅ 已存在 |
| `/api/admin/orders/:id/cancel` | POST | 取消订单 | ✅ 已存在 |
| `/api/admin/orders/:id/cancel-item` | POST | 取消单个商品 | ✅ 已存在 |
| `/api/admin/orders/:id` | GET | 订单详情 | ❌ 需新增 |
| `/api/admin/orders/:id` | DELETE | 删除订单 | ❌ 需新增 |
| `/api/admin/orders/:id/status` | PUT | 更新订单状态 | ❌ 需新增 |

### 2.3 菜单结构（sidebar.js）

前厅分组现有菜单：
- 收银看板（cashier-dashboard.html）
- 商品管理（products.html）
- 包房管理（vip-rooms.html）
- 台桌管理（tables.html）
- 商品分类（categories.html）

**权限控制**（ROLE_ALLOWED）：
- 管理员：all
- 店长：包含 cashier-dashboard.html、products.html 等
- 前厅管理：包含 cashier-dashboard.html、products.html、vip-rooms.html、tables.html、categories.html

## 3. 技术方案

### 3.1 新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `/TG/tgservice/admin/orders.html` | 新增 | 订单管理页面 |
| `/TG/tgservice/admin/sidebar.js` | 修改 | 添加订单管理菜单项 |
| `/TG/tgservice/backend/server.js` | 修改 | 新增订单详情/删除/状态更新 API |

### 3.2 API 变更

#### 3.2.1 新增 API

**1. GET /api/admin/orders/:id - 订单详情**

```javascript
// 位置：server.js，在 app.get('/api/admin/orders') 之后
app.get('/api/admin/orders/:id', authMiddleware, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    
    // 解析 items JSON
    const items = order.items ? JSON.parse(order.items) : [];
    
    // 获取商品图片（可选优化）
    const productMap = await getProductMap();
    const itemsWithDetails = items.map(item => ({
      ...item,
      image_url: productMap[item.name]?.image_url || '',
      category: productMap[item.name]?.category || '其他'
    }));
    
    res.json({
      success: true,
      data: {
        ...order,
        items: itemsWithDetails
      }
    });
  } catch (err) {
    logger.error(`获取订单详情失败: ${err.message}`);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});
```

**2. DELETE /api/admin/orders/:id - 删除订单**

```javascript
// 位置：server.js，在取消订单 API 之后
app.delete('/api/admin/orders/:id', authMiddleware, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    
    // 业务规则：只允许删除已取消或已完成的订单
    if (order.status === '待处理') {
      return res.status(400).json({ success: false, error: '待处理订单不能删除，请先取消' });
    }
    
    await enqueueRun('DELETE FROM orders WHERE id = ?', [req.params.id]);
    operationLog.info(`订单删除: ${req.params.id} (${order.order_no}) by ${req.user.username}`);
    
    res.json({ success: true, message: '订单已删除' });
  } catch (err) {
    logger.error(`删除订单失败: ${err.message}`);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});
```

**3. PUT /api/admin/orders/:id/status - 更新订单状态**

```javascript
// 位置：server.js，在取消订单 API 之后
app.put('/api/admin/orders/:id/status', authMiddleware, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['待处理', '已完成', '已取消'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: '无效的状态值' });
    }
    
    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    
    await enqueueRun('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', [status, TimeUtil.nowDB(), req.params.id]);
    operationLog.info(`订单状态更新: ${req.params.id} → ${status} by ${req.user.username}`);
    
    res.json({ success: true, message: '状态已更新' });
  } catch (err) {
    logger.error(`更新订单状态失败: ${err.message}`);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});
```

#### 3.2.2 API 文档更新（API_ADMIN.md）

在"订单管理"部分添加：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/orders/:id` | 订单详情 |
| DELETE | `/api/admin/orders/:id` | 删除订单（仅已取消/已完成）|
| PUT | `/api/admin/orders/:id/status` | 更新订单状态 |

### 3.3 前端页面设计（orders.html）

#### 3.3.1 页面结构

```
订单管理页面
├── 页面标题 + 统计栏（总数、待处理、已完成、已取消）
├── 工具栏
│   ├── 搜索框（订单号/台桌号/会员手机）
│   ├── 状态筛选（全部/待处理/已完成/已取消）
│   ├── 日期筛选（今天/昨天/本周/自定义）
├── 订单列表表格
│   ├── 列：订单号、台桌号、商品数、总价、状态、会员、创建时间、操作
│   ├── 操作按钮：查看详情、完成、取消、删除
├── 订单详情弹窗
│   ├── 基本信息（订单号、台桌号、状态、时间）
│   ├── 商品列表（名称、数量、单价、小计、图片）
│   ├── 状态修改按钮
```

#### 3.3.2 核心 JS 功能

```javascript
// 1. 加载订单列表（分页 + 筛选）
async function loadOrders(page = 1, pageSize = 20) {
  const { status, date, search } = currentFilters;
  const params = new URLSearchParams({ status, date, search, page, pageSize });
  const res = await api(`/api/admin/orders?${params}`);
  orders = res.data || res; // 兼容不同返回格式
  renderOrders();
  renderStats();
}

// 2. 查看订单详情
async function showOrderDetail(id) {
  const res = await api(`/api/admin/orders/${id}`);
  currentOrder = res.data;
  renderOrderDetail();
  document.getElementById('detailModal').classList.add('show');
}

// 3. 更新订单状态
async function updateOrderStatus(id, status) {
  await api(`/api/admin/orders/${id}/status`, { 
    method: 'PUT', 
    body: JSON.stringify({ status }) 
  });
  showToast('状态已更新');
  loadOrders();
}

// 4. 删除订单
async function deleteOrder(id) {
  if (!confirm('确定删除该订单？此操作不可恢复')) return;
  await api(`/api/admin/orders/${id}`, { method: 'DELETE' });
  showToast('订单已删除');
  loadOrders();
}

// 5. 时间格式化（遵守编码规范：使用 TimeUtil 格式化）
function formatTime(timeStr) {
  // 前端无 TimeUtil，使用标准格式化
  if (!timeStr) return '-';
  const d = new Date(timeStr);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
```

#### 3.3.3 状态显示样式

```css
.badge-pending { background: rgba(241,196,15,0.2); color: #f1c40f; }
.badge-completed { background: rgba(46,204,113,0.2); color: #2ecc71; }
.badge-cancelled { background: rgba(231,76,60,0.2); color: #e74c3c; }
```

### 3.4 菜单配置更新（sidebar.js）

在 MENU_CONFIG 的前厅分组中添加：

```javascript
// 【前厅】分组
{ label: '订单管理', icon: '📋', href: 'orders.html', group: '前厅' },
```

在 ROLE_ALLOWED 中为店长和前厅管理添加权限：

```javascript
'店长': ['...', 'orders.html'], // 添加 orders.html
'前厅管理': ['...', 'orders.html'], // 添加 orders.html
```

### 3.5 数据库变更

**无需新增表或字段**。orders 表结构已满足需求。

可选优化（不影响功能）：
- 添加 `idx_orders_status_created_at` 索引（加速状态筛选）

```sql
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at DESC);
```

### 3.6 前后端交互流程

```
用户操作                前端                     后端
────────────────────────────────────────────────────────────
进入订单管理页面    →   loadOrders()         →   GET /api/admin/orders
                    ←   渲染订单列表         ←   返回订单数据 + 商品详情

点击筛选/搜索       →   loadOrders(筛选条件) →   GET /api/admin/orders?status=...
                    ←   更新列表             ←   返回筛选结果

点击查看详情        →   showOrderDetail(id)  →   GET /api/admin/orders/:id
                    ←   弹窗显示详情         ←   返回订单详情 + 商品图片

点击完成/取消       →   updateOrderStatus()  →   PUT /api/admin/orders/:id/status
                    ←   更新列表/弹窗        ←   返回成功

点击删除            →   deleteOrder(id)      →   DELETE /api/admin/orders/:id
                    ←   更新列表             ←   返回成功
```

### 3.7 边界情况和异常处理

| 场景 | 处理方式 |
|------|----------|
| 订单不存在 | 返回 404，提示"订单不存在" |
| 删除待处理订单 | 返回 400，提示"待处理订单不能删除，请先取消" |
| 无效状态值 | 返回 400，提示"无效的状态值" |
| 无权限操作 | authMiddleware 拦截，返回 401 |
| 数据库错误 | 返回 500，日志记录错误详情 |
| items JSON 解析失败 | 返回空数组，不中断流程 |
| 商品图片获取失败 | 显示空图片占位符 |

### 3.8 编码规范遵守

| 规范 | 实现 |
|------|------|
| 时间处理 | 后端使用 `TimeUtil.nowDB()`；前端使用 `formatTime()` 函数（标准 Date 解析）|
| DB 连接 | 使用 `const { dbGet, dbAll, enqueueRun } = require('./db/index')` |
| DB 写入 | 使用 `enqueueRun('UPDATE/DELETE ...', [...])` |
| 不显示 coach_no | orders 表无 coach_no 字段，不存在此问题 |

## 4. 实现优先级

1. **P0 - 必须**
   - orders.html 页面（列表、详情弹窗）
   - sidebar.js 菜单添加
   - GET /api/admin/orders/:id API
   - DELETE /api/admin/orders/:id API

2. **P1 - 重要**
   - PUT /api/admin/orders/:id/status API
   - 状态筛选、日期筛选
   - 搜索功能（订单号/台桌号）

3. **P2 - 可选**
   - 分页功能（现有 API 已有 LIMIT）
   - 订单统计栏（复用 /api/admin/orders/stats）
   - 导出功能

## 5. 测试要点

| 测试项 | 验证方式 |
|------|----------|
| 菜单显示 | 登录后台 → 前厅分组 → 显示"订单管理" |
| 权限控制 | 店长/前厅管理可访问，教练/服务员不可 |
| 列表加载 | 显示订单列表，商品图片正确 |
| 状态筛选 | 筛选"待处理"只显示待处理订单 |
| 详情查看 | 弹窗显示订单详情和商品列表 |
| 状态更新 | 点击"完成"，状态变为"已完成" |
| 删除限制 | 待处理订单删除失败，已取消订单可删除 |
| 时间显示 | 创建时间显示为北京时间格式 |

## 6. 文件清单

| 文件路径 | 操作 | 预估行数 |
|------|------|----------|
| `/TG/tgservice/admin/orders.html` | 新增 | ~250 行 |
| `/TG/tgservice/admin/sidebar.js` | 修改 | ~5 行 |
| `/TG/tgservice/backend/server.js` | 修改 | ~60 行 |
| `/TG/docs/API_ADMIN.md` | 修改 | ~5 行 |

---

**设计完成时间**: 2026-04-30
**设计师**: 程序员A
```

## 审计检查清单
# 代码审计检查清单

## 编码规范检查（自动化）

运行 `check-style.js` 脚本，检查：

| 规则ID | 检查项 | 禁止 | 必须 |
|--------|--------|------|------|
| TIME | 时间处理 | `datetime('now')`、手动时区偏移 | `TimeUtil` |
| DB_CONN | 数据库连接 | `new sqlite3.Database()` | `db/index.js`（连接 Turso 云端 DB） |
| DB_WRITE | 数据库写入 | 裸开事务 | `writeQueue` |

## 人工审计检查项

### 逻辑正确性

- [ ] API路径、方法、参数与设计方案一致
- [ ] 数据库字段名、类型与设计一致
- [ ] 业务逻辑分支完整（if/else覆盖所有情况）
- [ ] 边界值处理（空值、最大值、最小值）

### 安全性

- [ ] 输入验证（参数类型、长度、范围）
- [ ] SQL注入防护（参数化查询）
- [ ] 权限校验（用户身份验证）

### 错误处理

- [ ] API错误有明确的错误码和消息
- [ ] 数据库操作有try/catch
- [ ] 异常情况有fallback处理

### 代码质量

- [ ] 变量命名清晰
- [ ] 函数单一职责
- [ ] 无死代码（未使用的变量/函数）
- [ ] Git提交信息描述清晰

### 前后端一致性

- [ ] API请求/响应格式前后端匹配
- [ ] 前端字段名与后端返回一致
- [ ] 错误处理前后端对齐


## 输出要求
1. 审计结果：通过/不通过
2. 如不通过，列出具体问题（对应检查清单的哪些项）
3. 如果通过，提取设计摘要（改了什么文件、新增什么API、数据表变更等）

这是第 1/3 次审计。