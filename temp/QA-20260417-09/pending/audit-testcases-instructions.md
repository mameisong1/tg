你是QA审计员。请审计以下测试用例。

## 测试用例内容
```
# QA 测试用例：助教和内部员工下单严格化

**需求编号**: QA-20260417-09
**测试日期**: 2026-04-17
**测试人**: 测试员B
**测试策略**: 仅 API/curl 测试 + 数据库直接操作
**后端API**: `http://127.0.0.1:8088`
**数据库**: `/TG/tgservice/db/tgservice.db`

---

## 需求概述

**问题**: 助教经常下错单到错误的台桌号。原因：助教频繁切换台桌，系统记住旧台桌号。

**解决方案**:
1. 助教和内部员工进入购物车/服务下单页面时，自动清空 storage 中的台桌号
2. 下单前必须选择台桌号，否则报错
3. 退出页面后再次进入时再次清空台桌号
4. 特殊情况：助教当前在上桌且水牌里只有一个台桌号时，点台桌号选择框自动选中当前所在台桌号；水牌里有多个台桌号时禁止自动选中

---

## 相关 API 接口清单

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/coach/login` | POST | 助教登录，返回 Base64 token |
| `/api/coaches/:coachNo/water-status` | GET | 查询助教水牌状态（含 table_no_list），**无需认证** |
| `/api/cart` | POST | 添加商品到购物车（参数：sessionId, productName, quantity, tableNo, options） |
| `/api/cart/:sessionId` | GET | 获取购物车 |
| `/api/cart/table` | PUT | 更新购物车台桌号（参数：sessionId, tableNo） |
| `/api/order` | POST | 提交商品订单（参数：sessionId, deviceFingerprint） |
| `/api/service-orders` | POST | 创建服务单（需认证，参数：table_no, requirement, requester_name, requester_type） |
| `/api/table-action-orders` | POST | 提交上下桌单（需认证，参数：table_no, coach_no, order_type, action_category, stage_name） |
| `/api/admin/login` | POST | 后台管理员登录，返回 JWT |
| `/api/tables` | GET | 获取台桌列表 |

**⚠️ 关键参数命名**：购物车 API 使用驼峰命名（`tableNo`, `productName`），服务单/上下桌单 API 使用下划线命名（`table_no`, `coach_no`）

---

## 前置准备：测试数据

### 1. 确认助教测试账号

```bash
cd /TG/tgservice && sqlite3 db/tgservice.db "SELECT coach_no, employee_id, stage_name, phone, status, shift FROM coaches WHERE coach_no IN (10001, 10003, 10011) ORDER BY coach_no;"
```

### 2. 确认台桌数据

```bash
cd /TG/tgservice && sqlite3 db/tgservice.db "SELECT id, area, name FROM tables ORDER BY id LIMIT 15;"
```

### 3. 确认商品数据

```bash
cd /TG/tgservice && sqlite3 db/tgservice.db "SELECT id, name, price FROM products LIMIT 5;"
```

---

## P0 核心用例

---

### TC-P0-01: 助教空闲状态水牌查询 - 无台桌

**目的**: 验证助教空闲状态下，水牌 API 返回的 `table_no_list` 为空，前端应不自动填充台桌号。

**前置条件**: 
- 助教 `10001`（歪歪），当前水牌状态非上桌类（如"乐捐"等），`table_no` 为空

**测试步骤**:

```bash
# 步骤1: 确认数据库中水牌状态
cd /TG/tgservice && sqlite3 db/tgservice.db "SELECT coach_no, stage_name, status, table_no FROM water_boards WHERE coach_no = 10001;"

# 步骤2: 查询助教水牌状态（此接口无需认证）
curl -s http://127.0.0.1:8088/api/coaches/10001/water-status | jq .
```

**预期结果**:
- `success: true`
- `data.table_no` 为空或 null
- `data.table_no_list` 为空数组 `[]`
- 前端应判断为「无台上桌状态」，不自动填充台桌号

---

### TC-P0-02: 助教单台桌上桌状态查询

**目的**: 验证助教当前在上桌且水牌只有一个台桌号时，前端点选台桌号应自动选中。

**前置条件**: 
- 助教 `10011`（十七），当前水牌状态为"晚班上桌"，`table_no` = "VIP3"（单台桌）

**测试步骤**:

```bash
# 步骤1: 确认数据库中水牌状态
cd /TG/tgservice && sqlite3 db/tgservice.db "SELECT coach_no, stage_name, status, table_no FROM water_boards WHERE coach_no = 10011;"

# 步骤2: 查询助教水牌状态
curl -s http://127.0.0.1:8088/api/coaches/10011/water-status | jq .
```

**预期结果**:
- `data.table_no` = "VIP3"
- `data.table_no_list` = ["VIP3"]（仅一个元素）
- 前端判断逻辑：`table_no_list.length === 1` → 自动选中该台桌号

---

### TC-P0-03: 助教多台桌上桌状态查询

**目的**: 验证助教当前在上桌且水牌有多个台桌号时，前端禁止自动选中台桌号。

**前置条件**: 需要将助教 `10011` 的水牌设为多个台桌

**测试步骤**:

```bash
# 步骤1: 修改水牌为多台桌（直接操作数据库）
cd /TG/tgservice && sqlite3 db/tgservice.db "UPDATE water_boards SET table_no = 'VIP3,A1', status = '晚班上桌' WHERE coach_no = 10011;"

# 步骤2: 确认修改
cd /TG/tgservice && sqlite3 db/tgservice.db "SELECT coach_no, stage_name, status, table_no FROM water_boards WHERE coach_no = 10011;"

# 步骤3: 查询助教水牌状态
curl -s http://127.0.0.1:8088/api/coaches/10011/water-status | jq .

# 步骤4: 恢复水牌单台桌状态
cd /TG/tgservice && sqlite3 db/tgservice.db "UPDATE water_boards SET table_no = 'VIP3', status = '晚班上桌' WHERE coach_no = 10011;"
```

**预期结果**:
- 步骤3: `data.table_no` = "VIP3,A1"
- 步骤3: `data.table_no_list` = ["VIP3", "A1"]（两个元素）
- 前端判断逻辑：`table_no_list.length > 1` → **禁止**自动选中，必须手动选择

---

### TC-P0-04: 商品下单 - 无台桌号时报错（核心防御）

**目的**: 验证购物车中 `table_no` 为空时，`POST /api/order` 返回错误，拒绝下单。

**前置条件**: 
- 创建一条 `table_no` 为空的购物车记录

**测试步骤**:

```bash
# 步骤1: 生成 sessionId
SESSION_ID="test_no_table_$(date +%s)"

# 步骤2: 向购物车添加商品（不设置 tableNo，后端会存为 null）
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"productName\":\"可乐\",\"quantity\":1}" | jq .

# 步骤3: 确认购物车中 table_no 为空
cd /TG/tgservice && sqlite3 db/tgservice.db "SELECT id, session_id, product_name, table_no FROM carts WHERE session_id = '$SESSION_ID';"

# 步骤4: 尝试下单（应该失败）
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\"}" | jq .
```

**预期结果**:
- 步骤4 返回 HTTP 400
- 响应: `{"error":"请扫台桌码进入后再下单"}`

```bash
# 清理测试数据
cd /TG/tgservice && sqlite3 db/tgservice.db "DELETE FROM carts WHERE session_id LIKE 'test_no_table_%';"
```

---

### TC-P0-05: 商品下单 - 有台桌号时正常下单

**目的**: 验证购物车中 `table_no` 有效时，下单成功。

**前置条件**: 
- 创建一条 `table_no` 有效的购物车记录

**测试步骤**:

```bash
# 步骤1: 生成 sessionId
SESSION_ID="test_with_table_$(date +%s)"

# 步骤2: 向购物车添加商品（设置有效台桌号）
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"productName\":\"可乐\",\"quantity\":1,\"tableNo\":\"VIP3\"}" | jq .

# 步骤3: 确认购物车中 table_no 已设置
cd /TG/tgservice && sqlite3 db/tgservice.db "SELECT product_name, table_no FROM carts WHERE session_id = '$SESSION_ID';"

# 步骤4: 尝试下单（应该成功）
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\"}" | jq .
```

**预期结果**:
- 步骤4 返回 HTTP 200
- 响应: `{"success":true,"orderNo":"TG...","message":"下单成功!请等待服务员送餐。"}`

```bash
# 清理购物车（订单保留用于验证）
cd /TG/tgservice && sqlite3 db/tgservice.db "DELETE FROM carts WHERE session_id LIKE 'test_with_table_%';"
```

---

### TC-P0-06: 服务单创建 - 无台桌号时报错

**目的**: 验证创建服务单时 `table_no` 为空，返回错误。

**前置条件**: 助教已登录

**测试步骤**:

```bash
# 步骤1: 助教登录
COACH_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/coach/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"12","stageName":"十七","idCardLast6":""}' | jq -r '.token // empty')
echo "Coach Token: $COACH_TOKEN"

# 步骤2: 创建服务单 - 不传 table_no（应该失败）
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://127.0.0.1:8088/api/service-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COACH_TOKEN" \
  -d '{"requirement":"需要毛巾","requester_name":"十七","requester_type":"助教"}' | jq .

# 步骤3: 创建服务单 - table_no 为空字符串（应该失败）
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://127.0.0.1:8088/api/service-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COACH_TOKEN" \
  -d '{"table_no":"","requirement":"需要毛巾","requester_name":"十七","requester_type":"助教"}' | jq .
```

**预期结果**:
- 步骤2 返回 HTTP 400，`{"success":false,"error":"缺少必填字段：台桌号"}`
- 步骤3 返回 HTTP 400，`{"success":false,"error":"缺少必填字段：台桌号"}`

---

### TC-P0-07: 服务单创建 - 有台桌号时正常创建

**目的**: 验证 `table_no` 有效时，服务单创建成功。

**测试步骤**:

```bash
# 步骤1: 助教登录
COACH_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/coach/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"12","stageName":"十七","idCardLast6":""}' | jq -r '.token // empty')

# 步骤2: 创建服务单 - 传入有效台桌号
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://127.0.0.1:8088/api/service-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COACH_TOKEN" \
  -d '{"table_no":"VIP3","requirement":"需要毛巾","requester_name":"十七","requester_type":"助教"}' | jq .
```

**预期结果**:
- 返回 HTTP 200
- 响应: `{"success":true,"data":{"id":数字,"status":"待处理"}}`

---

## P1 重要用例

---

### TC-P1-01: 商品下单 - 台桌号不存在时报错

**目的**: 验证 `table_no` 不在 `tables` 表中时，下单失败。

**测试步骤**:

```bash
# 步骤1: 生成 sessionId
SESSION_ID="test_fake_table_$(date +%s)"

# 步骤2: 向购物车添加商品（台桌号不存在）
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"productName\":\"可乐\",\"quantity\":1,\"tableNo\":\"不存在的台桌\"}" | jq .

# 步骤3: 尝试下单（应该失败 - 后端会校验台桌是否存在）
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\"}" | jq .
```

**预期结果**:
- 返回 HTTP 400
- 响应: `{"error":"台桌不存在,请重新扫码"}`

```bash
# 清理
cd /TG/tgservice && sqlite3 db/tgservice.db "DELETE FROM carts WHERE session_id LIKE 'test_fake_table_%';"
```

---

### TC-P1-02: 商品下单 - 购物车中有多个不同台桌号时报错

**目的**: 验证同一购物车中存在多个不同台桌号时，下单失败。

**测试步骤**:

```bash
# 步骤1: 生成 sessionId
SESSION_ID="test_multi_table_$(date +%s)"

# 步骤2: 添加第一个商品（台桌 A1）
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"productName\":\"可乐\",\"quantity\":1,\"tableNo\":\"A1\"}" | jq .

# 步骤3: 添加第二个商品（台桌 A2，不同台桌）
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"productName\":\"雪碧\",\"quantity\":1,\"tableNo\":\"A2\"}" | jq .

# 步骤4: 确认购物车中有两个不同台桌
cd /TG/tgservice && sqlite3 db/tgservice.db "SELECT product_name, table_no FROM carts WHERE session_id = '$SESSION_ID';"

# 步骤5: 尝试下单（应该失败）
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\"}" | jq .
```

**预期结果**:
- 返回 HTTP 400
- 响应: `{"error":"购物车存在多个台桌商品,请清空后重新下单"}`

```bash
# 清理
cd /TG/tgservice && sqlite3 db/tgservice.db "DELETE FROM carts WHERE session_id LIKE 'test_multi_table_%';"
```

---

### TC-P1-03: 上下桌单 - 无台桌号时报错

**目的**: 验证提交上下桌单时 `table_no` 为空，返回错误。

**前置条件**: 后台用户登录

**测试步骤**:

```bash
# 步骤1: 后台管理员登录获取 JWT
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' | jq -r '.token // empty')
echo "Admin Token: $ADMIN_TOKEN"

# 步骤2: 提交上下桌单 - 不传 table_no（应该失败）
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://127.0.0.1:8088/api/table-action-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"coach_no":"10011","order_type":"上桌单","action_category":"普通课","stage_name":"十七"}' | jq .

# 步骤3: 提交上下桌单 - table_no 为空字符串（应该失败）
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://127.0.0.1:8088/api/table-action-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"table_no":"","coach_no":"10011","order_type":"上桌单","action_category":"普通课","stage_name":"十七"}' | jq .
```

**预期结果**:
- 步骤2 返回 HTTP 400，`{"success":false,"error":"缺少必填字段"}`
- 步骤3 返回 HTTP 400，`{"success":false,"error":"缺少必填字段"}`

---

### TC-P1-04: 上下桌单 - 有台桌号时正常提交（上桌单）

**目的**: 验证有效台桌号时，上桌单提交成功。

**测试步骤**:

```bash
# 步骤1: 后台管理员登录
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' | jq -r '.token // empty')

# 步骤2: 提交上桌单（应该成功）
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://127.0.0.1:8088/api/table-action-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"table_no":"A1","coach_no":"10011","order_type":"上桌单","action_category":"普通课","stage_name":"十七"}' | jq .
```

**预期结果**:
- 返回 HTTP 200
- 响应: `{"success":true,"data":{"id":数字,"status":"待处理","water_board_status":"晚班上桌"}}`

---

### TC-P1-05: 购物车台桌号更新 API 验证

**目的**: 验证 `PUT /api/cart/table` 可以更新购物车台桌号，用于模拟「进入页面后选择台桌」的流程。

**测试步骤**:

```bash
# 步骤1: 生成 sessionId，添加商品（无台桌）
SESSION_ID="test_update_table_$(date +%s)"
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"productName\":\"可乐\",\"quantity\":1}" | jq .

# 步骤2: 确认初始 table_no 为空
cd /TG/tgservice && sqlite3 db/tgservice.db "SELECT product_name, table_no FROM carts WHERE session_id = '$SESSION_ID';"

# 步骤3: 更新购物车台桌号
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X PUT http://127.0.0.1:8088/api/cart/table \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"tableNo\":\"VIP3\"}" | jq .

# 步骤4: 确认台桌号已更新
cd /TG/tgservice && sqlite3 db/tgservice.db "SELECT product_name, table_no FROM carts WHERE session_id = '$SESSION_ID';"

# 步骤5: 此时下单应该成功
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\"}" | jq .
```

**预期结果**:
- 步骤3 返回 HTTP 200，`{"success":true}`
- 步骤4 显示 `table_no` = "VIP3"
- 步骤5 下单成功

```bash
# 清理
cd /TG/tgservice && sqlite3 db/tgservice.db "DELETE FROM carts WHERE session_id LIKE 'test_update_table_%';"
```

---

### TC-P1-06: 获取台桌列表 API 验证

**目的**: 验证前端可以通过 API 获取台桌列表，用于台桌选择器。

**测试步骤**:

```bash
# 获取台桌列表
curl -s http://127.0.0.1:8088/api/tables | jq .
```

**预期结果**:
- 返回 HTTP 200
- 返回台桌列表，包含 `area` 和 `name` 字段

---

### TC-P1-07: 助教离店/休息状态水牌查询 - 无台桌

**目的**: 验证助教离店/下班状态时，水牌无台桌信息。

**测试步骤**:

```bash
# 步骤1: 确认数据库中水牌状态（10009 momo 是休息状态）
cd /TG/tgservice && sqlite3 db/tgservice.db "SELECT coach_no, stage_name, status, table_no FROM water_boards WHERE coach_no = 10009;"

# 步骤2: 查询水牌状态（此接口无需认证）
curl -s http://127.0.0.1:8088/api/coaches/10009/water-status | jq .
```

**预期结果**:
- `data.table_no` 为空
- `data.table_no_list` 为空数组 `[]`
- 前端不应自动填充任何台桌号

---

## P2 次要用例

---

### TC-P2-01: 商品下单 - 台桌号为 "null" 字符串时报错

**目的**: 验证前端错误地将 "null" 字符串写入 `table_no` 时，后端能正确拦截。

**测试步骤**:

```bash
# 步骤1: 生成 sessionId
SESSION_ID="test_null_string_$(date +%s)"

# 步骤2: 向购物车添加商品（tableNo 为 "null" 字符串）
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"productName\":\"可乐\",\"quantity\":1,\"tableNo\":\"null\"}" | jq .

# 步骤3: 确认数据库中 table_no 的值
cd /TG/tgservice && sqlite3 db/tgservice.db "SELECT table_no, typeof(table_no) FROM carts WHERE session_id = '$SESSION_ID';"

# 步骤4: 尝试下单（应该失败）
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\"}" | jq .
```

**预期结果**:
- 返回 HTTP 400
- 响应: `{"error":"请扫台桌码进入后再下单"}`
  - 注：后端代码已处理 `table_no === 'null'` 的情况（server.js 第 763 行）

```bash
# 清理
cd /TG/tgservice && sqlite3 db/tgservice.db "DELETE FROM carts WHERE session_id LIKE 'test_null_string_%';"
```

---

### TC-P2-02: 商品下单 - 台桌号为 "undefined" 字符串时报错

**目的**: 验证前端错误地将 "undefined" 字符串写入 `table_no` 时，后端能正确拦截。

**测试步骤**:

```bash
# 步骤1: 生成 sessionId
SESSION_ID="test_undef_string_$(date +%s)"

# 步骤2: 向购物车添加商品（tableNo 为 "undefined" 字符串）
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"productName\":\"可乐\",\"quantity\":1,\"tableNo\":\"undefined\"}" | jq .

# 步骤3: 尝试下单（应该失败）
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\"}" | jq .
```

**预期结果**:
- 返回 HTTP 400
- 响应: `{"error":"请扫台桌码进入后再下单"}`
  - 注：后端代码已处理 `table_no === 'undefined'` 的情况（server.js 第 763 行）

```bash
# 清理
cd /TG/tgservice && sqlite3 db/tgservice.db "DELETE FROM carts WHERE session_id LIKE 'test_undef_string_%';"
```

---

### TC-P2-03: 商品下单 - 台桌号为空字符串时报错

**目的**: 验证 `table_no` 为空字符串时，后端能正确拦截。

**测试步骤**:

```bash
# 步骤1: 生成 sessionId
SESSION_ID="test_empty_string_$(date +%s)"

# 步骤2: 向购物车添加商品（tableNo 为空字符串）
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"productName\":\"可乐\",\"quantity\":1,\"tableNo\":\"\"}" | jq .

# 步骤3: 尝试下单（应该失败）
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\"}" | jq .
```

**预期结果**:
- 返回 HTTP 400
- 响应: `{"error":"请扫台桌码进入后再下单"}`
  - 注：后端代码已处理 `table_no.trim() === ''` 的情况（server.js 第 763 行）

```bash
# 清理
cd /TG/tgservice && sqlite3 db/tgservice.db "DELETE FROM carts WHERE session_id LIKE 'test_empty_string_%';"
```

---

### TC-P2-04: 内部员工（后台用户）服务单 - 无台桌号时报错

**目的**: 验证后台用户创建服务单时，无台桌号同样报错。

**测试步骤**:

```bash
# 步骤1: 后台管理员登录
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' | jq -r '.token // empty')

# 步骤2: 创建服务单 - 无台桌号（应该失败）
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://127.0.0.1:8088/api/service-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"requirement":"需要充电宝","requester_name":"tgadmin","requester_type":"后台用户"}' | jq .
```

**预期结果**:
- 返回 HTTP 400
- 响应: `{"success":false,"error":"缺少必填字段：台桌号"}`

---

### TC-P2-05: 商品下单 - 购物车为空时报错

**目的**: 验证空购物车下单时返回错误。

**测试步骤**:

```bash
# 尝试用不存在的 sessionId 下单
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"nonexistent_session_123"}' | jq .
```

**预期结果**:
- 返回 HTTP 400
- 响应: `{"error":"购物车为空"}`

---

### TC-P2-06: 助教身份验证 - 离职助教无法登录

**目的**: 验证离职助教无法获取 token，从源头阻断下单。

**测试步骤**:

```bash
# 步骤1: 确认 10010 为离职状态
cd /TG/tgservice && sqlite3 db/tgservice.db "SELECT coach_no, stage_name, status FROM coaches WHERE coach_no = 10010;"

# 步骤2: 尝试登录（应该失败）
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://127.0.0.1:8088/api/coach/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"11","stageName":"小怡","idCardLast6":""}' | jq .
```

**预期结果**:
- 返回 HTTP 403
- 响应: `{"error":"该账号已离职"}`

---

## 前端功能测试说明（无法通过 API 直接测试）

以下功能点主要在前端实现，需要通过浏览器测试或前端单元测试验证。此处列出供 QA 参考：

### 前端功能点 F1: 进入页面清空台桌号

- **对应需求**: (1) 助教和内部员工进入购物车/服务下单页面时，清空 storage 中的台桌号
- **测试方法**: 浏览器测试
- **验证步骤**:
  1. 以助教身份登录 H5
  2. 进入购物车页面前，通过浏览器 DevTools 在 localStorage 写入一个旧台桌号（模拟历史残留）
  3. 进入购物车页面
  4. 检查 localStorage 中台桌号是否已被清空
  5. 进入服务下单页面，重复步骤 2-4

### 前端功能点 F2: 退出页面再进入时再次清空

- **对应需求**: (3) 退出页面后再次进入时再次清空台桌号
- **测试方法**: 浏览器测试
- **验证步骤**:
  1. 进入页面 → 选择台桌号 → 写入 storage
  2. 退出页面（返回上一页）
  3. 再次进入页面
  4. 检查 storage 中的台桌号是否被清空

### 前端功能点 F3: 单台桌自动选中

- **对应需求**: (4a) 助教上桌且水牌只有单台桌时，点台桌号选择框自动选中当前台桌号
- **测试方法**: 浏览器测试
- **验证步骤**:
  1. 确保助教水牌状态为"上桌"，且只有一个台桌号
  2. 助教进入下单页面
  3. 点击台桌号选择框
  4. 验证是否自动选中当前所在台桌号

### 前端功能点 F4: 多台桌禁止自动选中

- **对应需求**: (4b) 水牌有多个台桌号时，禁止自动选中
- **测试方法**: 浏览器测试
- **验证步骤**:
  1. 确保助教水牌状态为"上桌"，且有多个台桌号
  2. 助教进入下单页面
  3. 点击台桌号选择框
  4. 验证是否**没有**自动选中任何台桌号

---

## 测试用例汇总

| 编号 | 优先级 | 测试点 | 预期结果 | 状态 |
|------|--------|--------|----------|------|
| TC-P0-01 | P0 | 助教空闲状态水牌查询 - 无台桌 | table_no_list 为空 | ⬜ |
| TC-P0-02 | P0 | 助教单台桌上桌状态查询 | table_no_list 只有一个元素 | ⬜ |
| TC-P0-03 | P0 | 助教多台桌上桌状态查询 | table_no_list 有多个元素 | ⬜ |
| TC-P0-04 | P0 | 商品下单 - 无台桌号 | 返回 400 "请扫台桌码进入后再下单" | ⬜ |
| TC-P0-05 | P0 | 商品下单 - 有台桌号 | 下单成功 | ⬜ |
| TC-P0-06 | P0 | 服务单创建 - 无台桌号 | 返回 400 "缺少必填字段：台桌号" | ⬜ |
| TC-P0-07 | P0 | 服务单创建 - 有台桌号 | 创建成功 | ⬜ |
| TC-P1-01 | P1 | 商品下单 - 台桌号不存在 | 返回 400 "台桌不存在" | ⬜ |
| TC-P1-02 | P1 | 商品下单 - 多台桌号混合 | 返回 400 "购物车存在多个台桌商品" | ⬜ |
| TC-P1-03 | P1 | 上下桌单 - 无台桌号 | 返回 400 "缺少必填字段" | ⬜ |
| TC-P1-04 | P1 | 上下桌单 - 有效台桌号 | 上桌成功 | ⬜ |
| TC-P1-05 | P1 | 购物车台桌号更新 | 更新后下单成功 | ⬜ |
| TC-P1-06 | P1 | 获取台桌列表 | 返回台桌列表 | ⬜ |
| TC-P1-07 | P1 | 助教离店状态水牌查询 | table_no_list 为空 | ⬜ |
| TC-P2-01 | P2 | 商品下单 - tableNo="null" | 返回 400 拦截 | ⬜ |
| TC-P2-02 | P2 | 商品下单 - tableNo="undefined" | 返回 400 拦截 | ⬜ |
| TC-P2-03 | P2 | 商品下单 - tableNo="" | 返回 400 拦截 | ⬜ |
| TC-P2-04 | P2 | 内部员工服务单 - 无台桌号 | 返回 400 拦截 | ⬜ |
| TC-P2-05 | P2 | 商品下单 - 空购物车 | 返回 400 "购物车为空" | ⬜ |
| TC-P2-06 | P2 | 离职助教登录 | 返回 403 "该账号已离职" | ⬜ |
| F1 | P0 | 前端: 进入页面清空台桌号 | 浏览器测试 | ⬜ |
| F2 | P0 | 前端: 退出再进入清空台桌号 | 浏览器测试 | ⬜ |
| F3 | P0 | 前端: 单台桌自动选中 | 浏览器测试 | ⬜ |
| F4 | P0 | 前端: 多台桌禁止自动选中 | 浏览器测试 | ⬜ |

**共计**: 24 个测试用例（20 个 API 测试 + 4 个前端测试）

---

## 测试执行顺序建议

1. **先执行 P0 用例** → 验证核心功能正常
2. **再执行 P1 用例** → 验证边界情况
3. **最后执行 P2 用例** → 验证异常处理
4. **前端测试** → 需配合浏览器，验证 storage 清空和自动选中逻辑

## 注意事项

1. **测试数据隔离**: 每个用例使用独立的 sessionId（带时间戳），避免互相影响
2. **数据清理**: 每个用例执行后清理 carts 中的测试数据（使用 LIKE 模糊匹配）
3. **水牌状态恢复**: TC-P0-03 修改了水牌状态，测试完成后已自动恢复
4. **时间控制**: Base64 token 无过期时间，JWT 默认有效期较长，无需担心 token 过期
5. **数据库操作**: 优先使用 sqlite3 直接查询/写入，减少 API 调用次数
6. **参数命名差异**: 购物车 API 使用驼峰命名（`tableNo`, `productName`），服务单 API 使用下划线命名（`table_no`）

```

## 审计要点
1. 是否覆盖QA需求的所有功能点
2. 是否包含API接口真实测试操作（curl测试）
3. 测试步骤是否可执行
4. 是否有明确的预期结果
5. 是否区分了正常流程和异常流程

这是第 1/3 次审计。

## 输出要求
1. 审计结果：通过/不通过
2. 如不通过，列出具体问题