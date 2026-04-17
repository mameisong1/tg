# QA-20260417-06 设计方案：table-action-orders 统计接口

## 一、需求理解

### 问题现状
当前收银看板页面（`admin/cashier-dashboard.html` 和 `cashier-dashboard.vue`）通过调用 `GET /api/table-action-orders` 获取数据列表，但该接口默认 `limit=50`，导致：
- 前端基于列表长度计算统计数量时，最多只能拿到 50 条记录
- 当数据库中记录超过 50 条时，统计数据严重偏小
- 前端需要的是"统计值"而非"明细列表"

### 解决方案
新增专用统计接口 `GET /api/table-action-orders/stats`，使用 SQL `COUNT()` 聚合查询直接返回统计数值，不返回明细列表。

---

## 二、API 设计

### 新增接口：`GET /api/table-action-orders/stats`

**认证**：需要 `auth.required` + `requireBackendPermission(['cashierDashboard'])`

**请求参数（Query）**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `date_start` | string | 是 | 无 | 起始日期，格式 `YYYY-MM-DD` |
| `date_end` | string | 是 | 无 | 结束日期，格式 `YYYY-MM-DD` |

**返回值**：

```json
{
  "success": true,
  "data": {
    "date_start": "2026-04-15",
    "date_end": "2026-04-17",
    "table_in_count": 25,
    "table_out_count": 18,
    "cancel_count": 7,
    "total_count": 50
  }
}
```

| 字段 | 说明 |
|------|------|
| `table_in_count` | 上桌单数量（order_type = '上桌单'） |
| `table_out_count` | 下桌单数量（order_type = '下桌单'） |
| `cancel_count` | 取消单数量（order_type = '取消单'） |
| `total_count` | 总数量 |

**错误返回**：

| HTTP 状态码 | 说明 |
|-------------|------|
| 400 | 缺少 date_start 或 date_end 参数 |
| 400 | 日期格式错误 |
| 400 | date_start 晚于 date_end |
| 500 | 服务器内部错误 |

### 查询逻辑

```sql
SELECT 
  SUM(CASE WHEN order_type = '上桌单' THEN 1 ELSE 0 END) as table_in_count,
  SUM(CASE WHEN order_type = '下桌单' THEN 1 ELSE 0 END) as table_out_count,
  SUM(CASE WHEN order_type = '取消单' THEN 1 ELSE 0 END) as cancel_count,
  COUNT(*) as total_count
FROM table_action_orders
WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
```

使用 `created_at` 字段做日期范围过滤，该字段已有索引 `idx_table_action_orders_created_at`。

---

## 三、文件变更清单

### 新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `/TG/tgservice/backend/routes/table-action-orders.js` | **修改** | 新增 `GET /stats` 路由 |
| `/TG/tgservice-uniapp/src/utils/api-v2.js` | **修改** | 新增 `tableActionOrders.getStats()` API 方法 |
| `/TG/tgservice/admin/cashier-dashboard.html` | **修改** | 全量刷新 + 增量轮询中增加 stats 接口调用（可选，待讨论） |

### 数据库变更

**无需数据库变更**。`table_action_orders` 表已有 `created_at` 索引和 `order_type` 索引，可直接用于聚合查询。

---

## 四、代码实现细节

### 4.1 后端路由（table-action-orders.js）

```javascript
/**
 * GET /api/table-action-orders/stats
 * 统计指定日期范围内的上桌单/下桌单/取消单数量
 */
router.get('/stats', auth.required, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    const { date_start, date_end } = req.query;
    
    if (!date_start || !date_end) {
      return res.status(400).json({ success: false, error: '缺少必填参数：date_start 和 date_end' });
    }
    
    // 验证日期格式 YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date_start) || !dateRegex.test(date_end)) {
      return res.status(400).json({ success: false, error: '日期格式错误，应为 YYYY-MM-DD' });
    }
    
    if (date_start > date_end) {
      return res.status(400).json({ success: false, error: 'date_start 不能晚于 date_end' });
    }
    
    const row = await db.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN order_type = '上桌单' THEN 1 ELSE 0 END), 0) as table_in_count,
        COALESCE(SUM(CASE WHEN order_type = '下桌单' THEN 1 ELSE 0 END), 0) as table_out_count,
        COALESCE(SUM(CASE WHEN order_type = '取消单' THEN 1 ELSE 0 END), 0) as cancel_count,
        COUNT(*) as total_count
      FROM table_action_orders
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
    `, [date_start, date_end]);
    
    res.json({
      success: true,
      data: {
        date_start,
        date_end,
        table_in_count: row.table_in_count,
        table_out_count: row.table_out_count,
        cancel_count: row.cancel_count,
        total_count: row.total_count
      }
    });
  } catch (error) {
    console.error('获取上下桌单统计失败:', error);
    res.status(500).json({
      success: false,
      error: '获取上下桌单统计失败'
    });
  }
});
```

### 4.2 前端 API 封装（api-v2.js）

在 `tableActionOrders` 对象中新增：

```javascript
getStats: (params = {}) => apiGet('/api/table-action-orders/stats', params),
```

### 4.3 前端收银看板集成（可选）

admin/cashier-dashboard.html 中 `fullRefresh()` 和 `pollNewOrders()` 可考虑用 stats 接口替代或补充当前的列表调用，获取准确的总数。

---

## 五、边界情况与异常处理

### 5.1 参数校验

| 场景 | 处理 |
|------|------|
| 未传 `date_start` | 返回 400，提示缺少参数 |
| 未传 `date_end` | 返回 400，提示缺少参数 |
| 日期格式非 `YYYY-MM-DD` | 返回 400，提示格式错误 |
| `date_start` > `date_end` | 返回 400，提示逻辑错误 |
| 日期范围无数据 | 正常返回，所有计数为 0 |

### 5.2 数据边界

| 场景 | 处理 |
|------|------|
| 表为空 | `COALESCE` 确保返回 0 而非 NULL |
| 存在未知 `order_type` | `COUNT(*)` 计入 total，但不计入三个分类计数 |
| 跨天数据 | 使用 `DATE(created_at)` 做日期截断，正确匹配 |

### 5.3 并发安全

- 本接口为**只读查询**，不涉及写操作，无需事务或写队列
- 使用 `db.get()` 而非 `dbAll()`，仅返回单行结果

---

## 六、测试用例

| # | 测试场景 | 输入 | 预期输出 |
|---|---------|------|---------|
| 1 | 正常查询单日 | `date_start=2026-04-17`, `date_end=2026-04-17` | 返回该日各类型计数 |
| 2 | 正常查询多日 | `date_start=2026-04-15`, `date_end=2026-04-17` | 返回3天各类型合计 |
| 3 | 缺少 date_start | `date_end=2026-04-17` | 400 错误 |
| 4 | 缺少 date_end | `date_start=2026-04-15` | 400 错误 |
| 5 | 日期格式错误 | `date_start=2026/04/15` | 400 错误 |
| 6 | 起始晚于结束 | `date_start=2026-04-20`, `date_end=2026-04-15` | 400 错误 |
| 7 | 日期范围无数据 | `date_start=2020-01-01`, `date_end=2020-01-02` | 所有计数为 0 |
| 8 | 无认证 token | 无 Authorization header | 401 错误 |
| 9 | 无权限 | 有 token 但无 cashierDashboard 权限 | 403 错误 |
| 10 | 跨天边界数据 | 数据在 00:00:00 附近 | DATE() 正确归属日期 |

---

## 七、与现有代码的一致性

### 时间处理
- ✅ 本接口不涉及时间生成，仅接收客户端传入的日期字符串
- ✅ 使用 `DATE(created_at)` 做查询，与现有 `/api/table-action-orders` 列表接口风格一致

### 数据库连接
- ✅ 使用 `db.get()` 来自 `require('../db')`，与现有代码一致
- ✅ 只读查询，不涉及写入操作

### 认证与权限
- ✅ 使用 `auth.required` + `requireBackendPermission(['cashierDashboard'])`，与现有路由一致

---

## 八、后续优化建议（非本次 QA 范围）

1. **admin/cashier-dashboard.html 接入**：将 `fullRefresh()` 中的 `/api/table-action-orders` 列表调用替换为 `/api/table-action-orders/stats` 获取准确的 tab 计数
2. **移动端 cashier-dashboard.vue 接入**：同理，tab 上的 `pendingCount` 可改用 stats 接口
3. **增加教练维度**：可选支持 `coach_no` 参数，按教练筛选统计
