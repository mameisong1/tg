# 测试用例：/api/table-action-orders/stats 统计接口

> **QA需求**：为 table-action-orders API 新增专用统计接口，返回指定日期范围内的上桌单、下桌单、取消单统计数量。
> **验收重点**：API 返回统计值是否正确，日期范围查询是否准确
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

| 日期范围 | 数据来源 | 预期 table_in | 预期 table_out | 预期 cancel | 合计 |
|----------|---------|-----------|-----------|-----------|------|
| 2026-05-01（单日） | 手动插入 | 3 | 2 | 1 | 6 |
| 2026-04-14 ~ 2026-04-17 | 现有数据 | 133 | 64 | 16 | 213 |
| 2026-04-15（单日） | 现有数据 | 76 | 24 | 16 | 116 |
| 2099-01-01 ~ 2099-12-31 | 无数据 | 0 | 0 | 0 | 0 |

---

## 测试用例列表

### P0 - 核心功能

---

#### TC-001: 统计指定日期范围内三种订单数量（含全部类型）

**优先级**：P0
**目标**：验证 stats 接口能正确返回指定日期范围内上桌单、下桌单、取消单的统计数量

**步骤**：
```bash
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-05-01&date_end=2026-05-01" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
```json
{
  "success": true,
  "data": {
    "date_start": "2026-05-01",
    "date_end": "2026-05-01",
    "table_in_count": 3,
    "table_out_count": 2,
    "cancel_count": 1,
    "total_count": 6
  }
}
```

---

#### TC-002: 统计多日期范围内三种订单数量

**优先级**：P0
**目标**：验证跨多天的日期范围统计准确性

**步骤**：
```bash
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-04-14&date_end=2026-04-17" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
```json
{
  "success": true,
  "data": {
    "date_start": "2026-04-14",
    "date_end": "2026-04-17",
    "table_in_count": 133,
    "table_out_count": 64,
    "cancel_count": 16,
    "total_count": 213
  }
}
```

**验证方式**：用 sqlite3 交叉验证
```bash
sqlite3 /TG/run/db/tgservice.db "SELECT order_type, COUNT(*) FROM table_action_orders WHERE DATE(created_at) >= '2026-04-14' AND DATE(created_at) <= '2026-04-17' GROUP BY order_type;"
```

---

#### TC-003: 无数据日期范围统计

**优先级**：P0
**目标**：验证在无数据的日期范围内，返回全零统计

**步骤**：
```bash
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2099-01-01&date_end=2099-12-31" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
```json
{
  "success": true,
  "data": {
    "date_start": "2099-01-01",
    "date_end": "2099-12-31",
    "table_in_count": 0,
    "table_out_count": 0,
    "cancel_count": 0,
    "total_count": 0
  }
}
```

---

#### TC-004: 未提供认证 Token

**优先级**：P0
**目标**：验证未登录时返回 401 未授权

**步骤**：
```bash
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-04-17&date_end=2026-04-17"
```

**预期结果**：
```json
{
  "success": false,
  "error": "未授权访问"
}
```
HTTP 状态码：401

---

### P1 - 重要功能

---

#### TC-005: 仅提供 date_start 参数（不指定 date_end）

**优先级**：P1
**目标**：验证只给起始日期时，统计从该日期起至今的所有数据

**步骤**：
```bash
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-05-01" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- `success: false`
- 错误信息："缺少必填参数：date_start 和 date_end"
- HTTP 状态码：400

---

#### TC-006: 仅提供 date_end 参数（不指定 date_start）

**优先级**：P1
**目标**：验证只给结束日期时，统计从有数据起至该日期的所有数据

**步骤**：
```bash
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_end=2026-04-13" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- `success: false`
- 错误信息："缺少必填参数：date_start 和 date_end"
- HTTP 状态码：400

---

#### TC-007: 不提供任何日期参数（统计全部数据）

**优先级**：P1
**目标**：验证不传日期参数时，统计表中所有记录

**步骤**：
```bash
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- `success: false`
- 错误信息："缺少必填参数：date_start 和 date_end"
- HTTP 状态码：400
- ⚠️ 接口设计为 date_start 和 date_end 均为必填，不允许不传

**验证方式**：
```bash
sqlite3 /TG/run/db/tgservice.db "SELECT order_type, COUNT(*) FROM table_action_orders GROUP BY order_type;"
```

---

#### TC-008: 响应格式正确性验证

**优先级**：P1
**目标**：验证响应包含所有必要字段且格式正确

**步骤**：
```bash
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-05-01&date_end=2026-05-01" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
assert data['success'] == True, 'success 应为 true'
d = data['data']
assert 'date_start' in d, '缺少 date_start'
assert 'date_end' in d, '缺少 date_end'
assert 'table_in_count' in d, '缺少 table_in_count'
assert 'table_out_count' in d, '缺少 table_out_count'
assert 'cancel_count' in d, '缺少 cancel_count'
assert 'total_count' in d, '缺少 total_count'
assert isinstance(d['table_in_count'], int), 'table_in_count应为整数'
assert isinstance(d['table_out_count'], int), 'table_out_count应为整数'
assert isinstance(d['cancel_count'], int), 'cancel_count应为整数'
assert isinstance(d['total_count'], int), 'total_count应为整数'
assert d['total_count'] == d['table_in_count'] + d['table_out_count'] + d['cancel_count'], 'total_count 应等于三者之和'
print('✅ 响应格式验证通过')
"
```

**预期结果**：输出 `✅ 响应格式验证通过`，无 AssertionError

---

#### TC-009: 与旧版列表接口的统计数据对比

**优先级**：P1
**目标**：验证新 stats 接口比旧 limit=50 列表方式更准确

**步骤**：
```bash
# 1. 获取新 stats 接口数据
STATS=$(curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-04-14&date_end=2026-04-17" \
  -H "Authorization: Bearer $TOKEN")

# 2. 获取旧列表接口数据（limit=50）
LIST=$(curl -s "http://127.0.0.1:8088/api/table-action-orders?date_start=2026-04-14&date_end=2026-04-17&limit=50" \
  -H "Authorization: Bearer $TOKEN")

# 3. 对比
python3 -c "
import json
stats = json.loads('$STATS')['data']
lst = json.loads('$LIST')['data']

# 统计列表接口前50条
list_counts = {'上桌单': 0, '下桌单': 0, '取消单': 0}
for r in lst:
    if r['order_type'] in list_counts:
        list_counts[r['order_type']] += 1

print('新 stats 接口:', {'上桌单': stats['table_in_count'], '下桌单': stats['table_out_count'], '取消单': stats['cancel_count']})
print('旧列表接口(前50条):', list_counts)
print('差异: 新接口多统计了 %d 条记录' % (stats['total_count'] - sum(list_counts.values())))
print('✅ stats 接口解决了 limit=50 导致的数据不全问题' if stats['total_count'] > sum(list_counts.values()) else '⚠️ 数据量较小，差异不明显')
"
```

**预期结果**：
- stats 接口的 total 明显大于旧列表接口统计的 50 条上限
- 证明新接口解决了 limit=50 的统计不准确问题

---

### P2 - 异常流程 & 边界情况

---

#### TC-010: 无效的日期格式

**优先级**：P2
**目标**：验证传入无效日期格式时的处理

**步骤**：
```bash
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=invalid-date&date_end=2026-05-01" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- `success: false`
- 错误信息："日期格式错误，应为 YYYY-MM-DD"
- HTTP 状态码：400

---

#### TC-011: date_start > date_end（日期范围颠倒）

**优先级**：P2
**目标**：验证起始日期大于结束日期时的处理

**步骤**：
```bash
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-05-01&date_end=2026-04-01" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- `success: false`
- 错误信息："date_start 不能晚于 date_end"
- HTTP 状态码：400

---

#### TC-012: date_start = date_end（单日统计）

**优先级**：P2
**目标**：验证起始和结束日期相同时的正确性

**步骤**：
```bash
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-04-15&date_end=2026-04-15" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
```json
{
  "success": true,
  "data": {
    "date_start": "2026-04-15",
    "date_end": "2026-04-15",
    "table_in_count": 76,
    "table_out_count": 24,
    "cancel_count": 16,
    "total_count": 116
  }
}
```

---

#### TC-013: 无效的认证 Token

**优先级**：P2
**目标**：验证使用过期/伪造的 Token 时的处理

**步骤**：
```bash
curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-05-01&date_end=2026-05-01" \
  -H "Authorization: Bearer invalid_token_here"
```

**预期结果**：
- `success: false`
- HTTP 状态码：401
- 错误信息提示令牌无效

---

#### TC-014: 助教角色调用（权限隔离）

**优先级**：P2
**目标**：验证助教调用时的数据隔离（只能看到自己的数据）

**步骤**：
```bash
# 获取助教 token（以 10002 为例）
COACH_TOKEN=$(echo -n "10002:$(date +%s)" | base64)

curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-05-01&date_end=2026-05-01" \
  -H "Authorization: Bearer $COACH_TOKEN"
```

**预期结果**（取决于实现方式）：
- 方案A：返回该助教自己的数据（coach_no = 10002 的订单）
- 方案B：返回 403 权限不足（如果 stats 接口仅限后台角色）
- **不应返回 500 服务器错误**

---

#### TC-015: 数据库一致性验证

**优先级**：P2
**目标**：通过 sqlite3 直接查询验证 API 返回的数据与数据库完全一致

**步骤**：
```bash
# 获取 API 返回
API_RESULT=$(curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-04-16&date_end=2026-04-17" \
  -H "Authorization: Bearer $TOKEN")

# 数据库查询
DB_RESULT=$(sqlite3 /TG/run/db/tgservice.db "SELECT order_type, COUNT(*) FROM table_action_orders WHERE DATE(created_at) >= '2026-04-16' AND DATE(created_at) <= '2026-04-17' GROUP BY order_type;")

# 对比验证
python3 -c "
import json
api = json.loads('$API_RESULT')['data']
print('API 返回:', api)
print('DB 查询结果:')
print('$DB_RESULT')
# 人工对比验证
"
```

**预期结果**：
- API 返回的 table_in_count=133, table_out_count=64, cancel_count=16, total_count=213
- 与数据库查询结果完全一致

---

## 测试执行顺序建议

```
1. TC-004 (P0)  → 未授权访问验证（最快排除基础问题）
2. TC-001 (P0)  → 单日核心功能验证
3. TC-002 (P0)  → 多日期范围验证
4. TC-003 (P0)  → 无数据场景验证
5. TC-008 (P1)  → 响应格式自动化验证
6. TC-009 (P1)  → 新旧接口对比验证
7. TC-005~007 (P1) → 参数边界验证
8. TC-010~015 (P2) → 异常和边界验证
```

---

## 测试数据清理

测试完成后清理手动插入的测试数据：

```bash
sqlite3 /TG/run/db/tgservice.db "DELETE FROM table_action_orders WHERE DATE(created_at) = '2026-05-01';"
```
