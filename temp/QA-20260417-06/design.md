# QA-20260417-06 设计方案：数据概览统计接口（全面改造）

## 一、需求理解

### 问题现状
`admin/index.html` 数据概览页面通过调用列表 API 获取原始数据，在前端遍历统计：
- `GET /api/admin/orders` → 返回订单列表 → 前端 `orders.length` 和 `reduce()` 计算
- `GET /api/service-orders` → 返回服务单列表 → 前端 `services.length` 计算
- `GET /api/table-action-orders` → 返回列表（默认 limit=50） → 前端遍历计算

**问题：**
1. 传输大量无用数据（每个记录包含所有字段）
2. 前端统计容易出错（如 limit=50 截断问题）
3. 性能浪费（数据库查询 → 序列化 → 网络传输 → 前端解析）

### 解决方案
为 3 个统计项新增专用统计 API，直接返回统计值：

| 前端显示 | 新增 API | 返回值 |
|----------|----------|--------|
| 今日/昨日/本周/上周订单 | `GET /api/admin/orders/stats` | `{ count, totalRevenue }` |
| 今日/昨日/本周/上周服务单 | `GET /api/service-orders/stats` | `{ count }` |
| 今日/昨日/本周/上周上下桌单 | `GET /api/table-action-orders/stats` | `{ upCount, downCount, cancelCount }` |

---

## 二、API 设计

### 2.1 `GET /api/admin/orders/stats`

**认证**：需要 `auth.required`

**请求参数（Query）**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `date` | string | 条件必填 | 单日查询，格式 `YYYY-MM-DD` |
| `date_start` | string | 条件必填 | 范围查询起始 |
| `date_end` | string | 条件必填 | 范围查询结束 |
| `status` | string | 否 | 订单状态过滤（如"已完成"） |

> 注：`date` 和 `date_start+date_end` 二选一，都不传则统计全部。

**返回值**：

```json
{
  "success": true,
  "data": {
    "count": 123,
    "totalRevenue": 45678
  }
}
```

**SQL 查询**：
```sql
SELECT 
  COUNT(*) as count,
  COALESCE(SUM(total_price), 0) as totalRevenue
FROM orders
WHERE DATE(created_at) = ? AND status = ?
```

---

### 2.2 `GET /api/service-orders/stats`

**认证**：需要 `auth.required` + `requireBackendPermission(['cashierDashboard'])`

**请求参数**：同 2.1

**返回值**：

```json
{
  "success": true,
  "data": {
    "count": 456
  }
}
```

---

### 2.3 `GET /api/table-action-orders/stats` ✅ 已实现

**认证**：需要 `auth.required` + `requireBackendPermission(['cashierDashboard'])`

**请求参数**：`date_start`（必填）、`date_end`（必填）

**返回值**：

```json
{
  "success": true,
  "data": {
    "date_start": "2026-04-13",
    "date_end": "2026-04-17",
    "table_in_count": 265,
    "table_out_count": 197,
    "cancel_count": 11,
    "total_count": 473
  }
}
```

---

## 三、文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `/TG/tgservice/backend/routes/table-action-orders.js` | **已修改** | 新增 `GET /stats` 路由（程序员A已完成） |
| `/TG/tgservice/backend/server.js` | **修改** | 新增 `/api/admin/orders/stats` 路由 |
| `/TG/tgservice/backend/routes/service-orders.js` | **修改** | 新增 `GET /stats` 路由 |
| `/TG/tgservice/admin/index.html` | **修改** | 改用 3 个 stats API，移除前端统计逻辑 |

---

## 四、代码实现细节

### 4.1 /api/admin/orders/stats（server.js 新增）

在 `server.js` 中现有的 `GET /api/admin/orders` 路由下方新增：

```javascript
// GET /api/admin/orders/stats
app.get('/api/admin/orders/stats', auth.required, async (req, res) => {
  try {
    const { date, date_start, date_end, status } = req.query;
    
    let sql = 'SELECT COUNT(*) as count, COALESCE(SUM(total_price), 0) as totalRevenue FROM orders WHERE 1=1';
    const params = [];
    
    if (date) {
      sql += ' AND DATE(created_at) = ?';
      params.push(date);
    }
    if (date_start) {
      sql += ' AND DATE(created_at) >= ?';
      params.push(date_start);
    }
    if (date_end) {
      sql += ' AND DATE(created_at) <= ?';
      params.push(date_end);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    const row = await db.get(sql, params);
    
    res.json({
      success: true,
      data: {
        count: row.count,
        totalRevenue: row.totalRevenue
      }
    });
  } catch (error) {
    console.error('获取订单统计失败:', error);
    res.status(500).json({ success: false, error: '获取订单统计失败' });
  }
});
```

### 4.2 /api/service-orders/stats（service-orders.js 新增）

```javascript
// GET /api/service-orders/stats
router.get('/stats', auth.required, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    const { date, date_start, date_end, status } = req.query;
    
    let sql = 'SELECT COUNT(*) as count FROM service_orders WHERE 1=1';
    const params = [];
    
    if (date) {
      sql += ' AND DATE(created_at) = ?';
      params.push(date);
    }
    if (date_start) {
      sql += ' AND DATE(created_at) >= ?';
      params.push(date_start);
    }
    if (date_end) {
      sql += ' AND DATE(created_at) <= ?';
      params.push(date_end);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    const row = await db.get(sql, params);
    
    res.json({
      success: true,
      data: {
        count: row.count
      }
    });
  } catch (error) {
    console.error('获取服务单统计失败:', error);
    res.status(500).json({ success: false, error: '获取服务单统计失败' });
  }
});
```

### 4.3 admin/index.html 前端改造

```javascript
async function loadAllStats() {
  const param = getDateParam(currentRange);

  // 商品数、助教数（不受日期影响）
  const products = await api('/api/admin/products');
  const coaches = await api('/api/admin/coaches');
  document.getElementById('statProducts').textContent = products.length || 0;
  document.getElementById('statCoaches').textContent = coaches.length || 0;

  // 构建日期查询参数
  let dateParam;
  if (currentRange === 'today' || currentRange === 'yesterday') {
    dateParam = `date=${param}`;
  } else {
    dateParam = `date_start=${param.start}&date_end=${param.end}`;
  }

  try {
    // 并行查询 3 个 stats API
    const [ordersStats, servicesStats, tableStats] = await Promise.all([
      api(`/api/admin/orders/stats?${dateParam}&status=已完成`),
      api(`/api/service-orders/stats?${dateParam}&status=已完成`),
      api(`/api/table-action-orders/stats?${dateParam}`),
    ]);

    // 直接使用 API 返回的统计值
    document.getElementById('statOrders').textContent = ordersStats.data?.count || 0;
    document.getElementById('statRevenue').textContent = '¥' + (ordersStats.data?.totalRevenue || 0).toFixed(0);
    document.getElementById('statServiceOrders').textContent = servicesStats.data?.count || 0;
    document.getElementById('statTableActions').textContent = 
      `${tableStats.data?.table_in_count || 0}:${tableStats.data?.table_out_count || 0}`;

    // 更新标签文本
    const rangeLabels = {
      today: '今日', yesterday: '昨日', thisWeek: '本周', lastWeek: '上周'
    };
    const label = rangeLabels[currentRange];
    document.querySelector('#statOrders').closest('.stat-card').querySelector('.stat-label').textContent = `${label}订单`;
    document.querySelector('#statRevenue').closest('.stat-card').querySelector('.stat-label').textContent = `${label}销售额`;
    document.querySelector('#statServiceOrders').closest('.stat-card').querySelector('.stat-label').textContent = `${label}服务单`;
    document.querySelector('#statTableActions').closest('.stat-card').querySelector('.stat-label').textContent = `${label}上下桌单`;
  } catch (e) {
    document.getElementById('statOrders').textContent = '0';
    document.getElementById('statRevenue').textContent = '¥0';
    document.getElementById('statServiceOrders').textContent = '0';
    document.getElementById('statTableActions').textContent = '0:0';
  }
}
```

---

## 五、边界情况与异常处理

| 场景 | 处理 |
|------|------|
| 未传日期参数 | 统计全部数据 |
| 日期格式错误 | 返回 400 |
| 日期范围无数据 | 返回 count=0 |
| 无认证 token | 返回 401 |
| 无权限 | 返回 403 |
