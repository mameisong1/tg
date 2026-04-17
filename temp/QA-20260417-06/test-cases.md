# 测试用例：数据概览统计接口（3 个 API）

> **QA需求**：为 admin/index.html 数据概览页面新增 3 个专用统计 API
> **验收重点**：所有统计数据都从接口直接获取，前端不做遍历统计。3 个 API 返回的统计值与数据库实际数据一致。
> **测试地址**：http://127.0.0.1:8088
> **测试时间**：2026-04-17

---

## 前置准备

### 获取认证 Token

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
```

### 测试数据说明

使用现有数据（2026-04-13 ~ 2026-04-17），无需手动插入数据。

---

## 一、GET /api/admin/orders/stats 测试

### TC-001: 查询本周订单统计（P0）

```bash
curl -s "http://127.0.0.1:8088/api/admin/orders/stats?date_start=2026-04-13&date_end=2026-04-17&status=已完成" \
  -H "Authorization: Bearer $TOKEN"
```

**预期**：返回 `{ count: 97, totalRevenue: 2319 }`

**验证**：
```bash
sqlite3 /TG/run/db/tgservice.db "SELECT COUNT(*), COALESCE(SUM(total_price),0) FROM orders WHERE DATE(created_at) >= '2026-04-13' AND DATE(created_at) <= '2026-04-17' AND status='已完成';"
```

### TC-002: 查询昨日订单统计（P0）

```bash
curl -s "http://127.0.0.1:8088/api/admin/orders/stats?date=2026-04-16&status=已完成" \
  -H "Authorization: Bearer $TOKEN"
```

**预期**：返回 `{ count: N, totalRevenue: M }`，与数据库一致

### TC-003: 无数据日期（P0）

```bash
curl -s "http://127.0.0.1:8088/api/admin/orders/stats?date=2099-01-01" \
  -H "Authorization: Bearer $TOKEN"
```

**预期**：`{ count: 0, totalRevenue: 0 }`

### TC-004: 无认证（P0）

```bash
curl -s "http://127.0.0.1:8088/api/admin/orders/stats?date=2026-04-17"
```

**预期**：401 错误

---

## 二、GET /api/service-orders/stats 测试

### TC-005: 查询本周服务单统计（P0）

```bash
curl -s "http://127.0.0.1:8088/api/service-orders/stats?date_start=2026-04-13&date_end=2026-04-17&status=已完成" \
  -H "Authorization: Bearer $TOKEN"
```

**预期**：返回 `{ count: 24 }`

**验证**：
```bash
sqlite3 /TG/run/db/tgservice.db "SELECT COUNT(*) FROM service_orders WHERE DATE(created_at) >= '2026-04-13' AND DATE(created_at) <= '2026-04-17' AND status='已完成';"
```

### TC-006: 无数据日期（P0）

```bash
curl -s "http://127.0.0.1:8088/api/service-orders/stats?date=2099-01-01" \
  -H "Authorization: Bearer $TOKEN"
```

**预期**：`{ count: 0 }`

### TC-007: 无认证（P0）

```bash
curl -s "http://127.0.0.1:8088/api/service-orders/stats?date=2026-04-17"
```

**预期**：401 错误

---

## 三、GET /api/table-action-orders/stats 测试

### TC-008: 查询本周上下桌单统计（P0）

```bash
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-04-13&date_end=2026-04-17" \
  -H "Authorization: Bearer $TOKEN"
```

**预期**：返回 `{ table_in_count: 165, table_out_count: 81, cancel_count: 19, total_count: 265 }`

**验证**：
```bash
sqlite3 /TG/run/db/tgservice.db "SELECT order_type, COUNT(*) FROM table_action_orders WHERE DATE(created_at) >= '2026-04-13' AND DATE(created_at) <= '2026-04-17' GROUP BY order_type;"
```

### TC-009: 无数据日期（P0）

```bash
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2099-01-01&date_end=2099-12-31" \
  -H "Authorization: Bearer $TOKEN"
```

**预期**：`{ table_in_count: 0, table_out_count: 0, cancel_count: 0, total_count: 0 }`

### TC-010: 缺少参数（P1）

```bash
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-04-13" \
  -H "Authorization: Bearer $TOKEN"
```

**预期**：400 错误

### TC-011: 日期格式错误（P2）

```bash
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=invalid&date_end=2026-04-17" \
  -H "Authorization: Bearer $TOKEN"
```

**预期**：400 错误

---

## 四、admin/index.html 前端验证

### TC-012: 数据概览页面今日统计（P0）

**目标**：验证前端使用 stats API 后，今日数据正确显示

**步骤**：
1. 访问 `http://127.0.0.1:8089/admin/index.html`
2. 登录（tgadmin / mms633268）
3. 查看"今日"标签下的统计数据
4. 与 curl 直接调用 stats API 对比

```bash
# 获取今日 stats
curl -s "http://127.0.0.1:8088/api/admin/orders/stats?date=2026-04-17&status=已完成" \
  -H "Authorization: Bearer $TOKEN"
curl -s "http://127.0.0.1:8088/api/service-orders/stats?date=2026-04-17&status=已完成" \
  -H "Authorization: Bearer $TOKEN"
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-04-17&date_end=2026-04-17" \
  -H "Authorization: Bearer $TOKEN"
```

### TC-013: 数据概览页面本周统计（P0）

**目标**：验证"本周"标签下的统计数据正确

**步骤**：
1. 点击"本周"标签
2. 验证：
   - 今日订单 = orders.stats 返回的 count
   - 今日销售额 = orders.stats 返回的 totalRevenue
   - 今日服务单 = service-orders.stats 返回的 count
   - 今日上下桌单 = table-action-orders.stats 返回的 table_in_count:table_out_count

### TC-014: 验证上周 > 昨日的逻辑正确性（P0）

**目标**：验证之前的 BUG 已修复（昨日数据 ≤ 本周数据）

```bash
# 昨日
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-04-16&date_end=2026-04-16" \
  -H "Authorization: Bearer $TOKEN"

# 本周
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-04-13&date_end=2026-04-17" \
  -H "Authorization: Bearer $TOKEN"
```

**预期**：本周上桌单 ≥ 昨日上桌单
