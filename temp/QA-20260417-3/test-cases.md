# 乐捐报备时间选择规则 — API测试用例

**QA编号**: QA-20260417-3  
**测试日期**: 2026-04-17  
**测试环境**: 后端API `http://127.0.0.1:8088`  
**测试策略**: 纯 API/curl 测试，操作 SQLite 数据库准备测试数据

---

## 需求描述

乐捐报备开始时间的选择范围改为从当日的14点开始，到次日的1点之间。但不能选过去时间，只能选当前小时或未来小时。

| 当前时段 | 可选择的预约时间 | 说明 |
|----------|------------------|------|
| 00:00-00:59 | 当日 00:00、01:00 | 0点只能选0点和1点 |
| 01:00-01:59 | 当日 01:00 | 1点只能选1点 |
| 02:00-13:59 | 当日 14:00 及以后整点 | 只能选当日14点起 |
| 14:00-23:59 | 当前小时及以后整点 | 不能选过去时间 |

**通用规则**：必须是整点（分钟=00），不能选过去时间。

---

## 前置准备

### P0-0. 获取管理员Token

```bash
# 登录后台获取JWT token
TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | jq -r '.token')

echo "TOKEN=$TOKEN"
```

**预期结果**: 返回 JWT token 字符串  
**失败处理**: 如果登录失败，检查 admin_users 表中是否有 tgadmin 用户

### P0-0b. 确认测试用助教数据

```bash
# 查看现有助教数据
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT coach_no, employee_id, stage_name, phone FROM coaches WHERE status != '离职' LIMIT 5;"
```

**测试用助教**：employee_id=1, stage_name=歪歪, coach_no=10001

---

## 公共参数

| 参数 | 值 | 说明 |
|------|-----|------|
| API_BASE | http://127.0.0.1:8088 | 后端API地址 |
| AUTH_HEADER | `Authorization: Bearer $TOKEN` | 认证头 |
| EMPLOYEE_ID | 1 | 测试助教工号（歪歪） |

---

## 测试用例

### 用例组 A：00:00-00:59 时段（凌晨0点）

> 需求：0点只能选择0点和1点

#### TC-A01: 00:30提交，预约当日00:00 — 应拒绝（过去时间） [P0]

```bash
# 当前时间为00:30，预约00:00已过去
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 00:00:00",
    "remark": "TC-A01: 00:30预约00:00(过去时间)"
  }'
```

**预期结果**: HTTP 400, `{"error": "预约时间不能早于当前时间"}`

#### TC-A02: 00:30提交，预约当日01:00 — 应成功 [P0]

```bash
# 当前时间为00:30，预约01:00（未来，且在允许范围内）
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 01:00:00",
    "remark": "TC-A02: 00:30预约01:00(应成功)"
  }'
```

**预期结果**: HTTP 200, `{"success": true, "data": {"immediate": false}}`

> **注意**: 需在凌晨0:00-0:59之间执行此测试。若非此时段，可通过修改代码临时模拟或改用数据库验证时间校验逻辑。

#### TC-A03: 00:30提交，预约当日02:00 — 应拒绝（0点不能选2点） [P0]

```bash
# 当前时间为00:30，预约02:00（超出0点允许范围）
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 02:00:00",
    "remark": "TC-A03: 00:30预约02:00(超出范围)"
  }'
```

**预期结果**: HTTP 400, 错误信息包含 "请选择有效时段" 或 "乐捐报备时间为每日14:00-次日02:00"

> **关键差异**: 此用例是验证新旧需求的关键区别点。旧实现允许0点选2点（次日），新需求不允许。

#### TC-A04: 00:30提交，预约次日14:00 — 应拒绝（0点不能选次日14点） [P0]

```bash
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-18 14:00:00",
    "remark": "TC-A04: 00:30预约次日14:00(跨天不应允许)"
  }'
```

**预期结果**: HTTP 400, 错误信息包含 "当天" 或 "有效时段" 或 "次日"

---

### 用例组 B：01:00-01:59 时段（凌晨1点）

> 需求：1点只能选择1点

#### TC-B01: 01:30提交，预约当日01:00 — 应拒绝（过去时间） [P0]

```bash
# 当前时间01:30，预约01:00已过去
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 01:00:00",
    "remark": "TC-B01: 01:30预约01:00(过去时间)"
  }'
```

**预期结果**: HTTP 400, `{"error": "预约时间不能早于当前时间"}`

#### TC-B02: 01:00提交，预约当日01:00 — 应成功（当前小时立即生效） [P0]

```bash
# 当前时间恰为01:00，预约01:00（当前小时）
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 01:00:00",
    "remark": "TC-B02: 01:00预约01:00(当前小时)"
  }'
```

**预期结果**: HTTP 200, `{"success": true, "data": {"immediate": true}}`（立即生效）

#### TC-B03: 01:30提交，预约当日02:00 — 应拒绝（1点不能选2点） [P0]

```bash
# 当前时间01:30，预约02:00（超出1点允许范围）
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 02:00:00",
    "remark": "TC-B03: 01:30预约02:00(超出范围)"
  }'
```

**预期结果**: HTTP 400, 错误信息包含 "有效时段"

> **关键差异**: 旧实现允许1点选2点（次日），新需求不允许。

---

### 用例组 C：02:00-13:59 时段（凌晨2点到下午1点59分）

> 需求：只能选当日14点及以后

#### TC-C01: 07:00提交，预约当日14:00 — 应成功 [P0]

```bash
# 当前时间07:00，预约14:00（当日最早可选时间）
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 14:00:00",
    "remark": "TC-C01: 07:00预约14:00(应成功)"
  }'
```

**预期结果**: HTTP 200, `{"success": true, "data": {"immediate": false}}`

#### TC-C02: 07:00提交，预约当日15:00 — 应成功 [P0]

```bash
# 当前时间07:00，预约15:00（未来时间）
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 15:00:00",
    "remark": "TC-C02: 07:00预约15:00(应成功)"
  }'
```

**预期结果**: HTTP 200, `{"success": true, "data": {"immediate": false}}`

#### TC-C03: 07:00提交，预约当日10:00 — 应拒绝（3-13点不在可选范围） [P0]

```bash
# 当前时间07:00，预约10:00（禁止时段）
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 10:00:00",
    "remark": "TC-C03: 07:00预约10:00(禁止时段)"
  }'
```

**预期结果**: HTTP 400, `{"error": "乐捐报备时间为每日14:00-次日02:00，请选择有效时段"}`

#### TC-C04: 07:00提交，预约当日08:00 — 应拒绝（过去时间+禁止时段） [P0]

```bash
# 当前时间07:00，预约08:00（既是过去又是禁止时段）
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 08:00:00",
    "remark": "TC-C04: 07:00预约08:00(过去+禁止)"
  }'
```

**预期结果**: HTTP 400, 错误信息包含 "有效时段" 或 "早于当前"

#### TC-C05: 07:00提交，预约当日00:00 — 应拒绝（当日0点已过） [P0]

```bash
# 当前时间07:00，预约当日00:00（过去时间）
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 00:00:00",
    "remark": "TC-C05: 07:00预约当日00:00(过去)"
  }'
```

**预期结果**: HTTP 400, 错误信息包含 "有效时段"（小时=0但日期不是次日）

#### TC-C06: 07:00提交，预约次日01:00 — 应拒绝（2-13点不能选次日凌晨） [P0]

```bash
# 当前时间07:00，预约次日01:00（2-13点时段不应允许选次日凌晨）
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-18 01:00:00",
    "remark": "TC-C06: 07:00预约次日01:00(不应允许)"
  }'
```

**预期结果**: HTTP 400, 错误信息包含 "当天" 或 "有效时段" 或 "次日"

> **关键差异**: 旧实现允许2-13点选次日0-2点，新需求"只能选当日14点及以后"，不应允许选次日。

#### TC-C07: 13:59提交，预约当日14:00 — 应成功（边界：13点最后一分钟预约14点） [P1]

```bash
# 需在13:59执行，或修改代码模拟
# 预约14:00（仅差1分钟，当日最早可选）
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 14:00:00",
    "remark": "TC-C07: 13:59预约14:00(边界)"
  }'
```

**预期结果**: HTTP 200, `{"success": true, "data": {"immediate": false}}`

---

### 用例组 D：14:00-23:59 时段（下午2点到晚上11点59分）

> 需求：只能选当前小时及以后

#### TC-D01: 14:00提交，预约当日14:00 — 应成功（当前小时立即生效） [P0]

```bash
# 当前时间14:00，预约14:00（当前小时）
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 14:00:00",
    "remark": "TC-D01: 14:00预约14:00(当前小时)"
  }'
```

**预期结果**: HTTP 200, `{"success": true, "data": {"immediate": true}}`

#### TC-D02: 14:30提交，预约当日14:00 — 应成功（当前小时允许） [P0]

```bash
# 当前时间14:30，预约14:00（同一小时，应允许）
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 14:00:00",
    "remark": "TC-D02: 14:30预约14:00(当前小时)"
  }'
```

**预期结果**: HTTP 200, `{"success": true, "data": {"immediate": true}}`

#### TC-D03: 14:30提交，预约当日15:00 — 应成功 [P0]

```bash
# 当前时间14:30，预约15:00（下一小时）
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 15:00:00",
    "remark": "TC-D03: 14:30预约15:00(应成功)"
  }'
```

**预期结果**: HTTP 200, `{"success": true, "data": {"immediate": false}}`

#### TC-D04: 15:00提交，预约当日14:00 — 应拒绝（过去时间） [P0]

```bash
# 当前时间15:00，预约14:00（过去小时）
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 14:00:00",
    "remark": "TC-D04: 15:00预约14:00(过去)"
  }'
```

**预期结果**: HTTP 400, `{"error": "预约时间不能早于当前时间"}`

#### TC-D05: 23:00提交，预约当日23:00 — 应成功 [P0]

```bash
# 当前时间23:00，预约23:00（当前小时）
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 23:00:00",
    "remark": "TC-D05: 23:00预约23:00(当前小时)"
  }'
```

**预期结果**: HTTP 200, `{"success": true, "data": {"immediate": true}}`

#### TC-D06: 23:00提交，预约次日00:00 — 应拒绝（23点不能选0点） [P0]

```bash
# 当前时间23:00，预约次日00:00（超出14-23点可选范围）
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-18 00:00:00",
    "remark": "TC-D06: 23:00预约次日00:00(不应允许)"
  }'
```

**预期结果**: HTTP 400, 错误信息包含 "当天" 或 "有效时段"

#### TC-D07: 23:00提交，预约次日01:00 — 应拒绝 [P0]

```bash
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-18 01:00:00",
    "remark": "TC-D07: 23:00预约次日01:00(不应允许)"
  }'
```

**预期结果**: HTTP 400, 错误信息包含 "当天" 或 "有效时段"

---

### 用例组 E：通用校验（不依赖具体时段）

> 需求：必须整点、格式正确、助教存在

#### TC-E01: 非整点时间（分钟!=00）— 应拒绝 [P0]

```bash
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 15:30:00",
    "remark": "TC-E01: 非整点(15:30)"
  }'
```

**预期结果**: HTTP 400, `{"error": "预约时间必须是整点（分钟=00）"}`

#### TC-E02: 非整点时间（分钟=15）— 应拒绝 [P1]

```bash
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 15:15:00",
    "remark": "TC-E02: 非整点(15:15)"
  }'
```

**预期结果**: HTTP 400, `{"error": "预约时间必须是整点（分钟=00）"}`

#### TC-E03: 时间格式错误 — 应拒绝 [P1]

```bash
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026/04/17 14:00:00",
    "remark": "TC-E03: 时间格式错误"
  }'
```

**预期结果**: HTTP 400, `{"error": "时间格式错误，必须是 YYYY-MM-DD HH:MM:SS"}`

#### TC-E04: 缺少必填字段 — 应拒绝 [P1]

```bash
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1"
  }'
```

**预期结果**: HTTP 400, `{"error": "缺少必填字段: employee_id, scheduled_start_time"}`

#### TC-E05: 不存在的助教 — 应拒绝 [P1]

```bash
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "99999",
    "scheduled_start_time": "2026-04-17 14:00:00",
    "remark": "TC-E05: 不存在的助教"
  }'
```

**预期结果**: HTTP 404, `{"error": "找不到该工号对应的助教"}`

#### TC-E06: 重复报备（已有pending记录）— 应拒绝 [P1]

```bash
# 先插入一条 pending 记录到数据库
sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT INTO lejuan_records (coach_no, employee_id, stage_name, scheduled_start_time, lejuan_status, scheduled, created_at, updated_at) VALUES (10001, 1, '歪歪', '2026-04-17 14:00:00', 'pending', 0, datetime('now'), datetime('now'));"

# 再提交报备
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 15:00:00",
    "remark": "TC-E06: 重复报备"
  }'
```

**预期结果**: HTTP 400, `{"error": "已有一条待出发的乐捐记录，请先处理"}`

#### TC-E07: 未认证访问 — 应拒绝 [P1]

```bash
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 14:00:00",
    "remark": "TC-E07: 未认证"
  }'
```

**预期结果**: HTTP 401

---

### 用例组 F：数据库验证

> 验证成功创建后数据库记录正确

#### TC-F01: 预约记录写入数据库 [P0]

```bash
# 先清理可能存在的冲突记录
sqlite3 /TG/tgservice/db/tgservice.db \
  "DELETE FROM lejuan_records WHERE employee_id = 1 AND lejuan_status IN ('pending', 'active') AND scheduled_start_time >= '2026-04-17 14:00:00';"

# 提交预约
RESPONSE=$(curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "employee_id": "1",
    "scheduled_start_time": "2026-04-17 14:00:00",
    "remark": "TC-F01: 预约记录验证"
  }')

echo "API响应: $RESPONSE"

# 验证数据库记录
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT id, scheduled_start_time, lejuan_status, scheduled, remark FROM lejuan_records WHERE employee_id = 1 AND scheduled_start_time = '2026-04-17 14:00:00' AND remark LIKE 'TC-F01%' ORDER BY id DESC LIMIT 1;"
```

**预期结果**: 
- API 返回 `{"success": true}`
- 数据库 `lejuan_status` = `pending`（若当前时间<14:00）或 `active`（若当前时间>=14:00）
- 数据库 `scheduled` = `0`（pending）或 `1`（active）

---

## 测试用例汇总

| 用例编号 | 优先级 | 测试时段 | 预约时间 | 预期结果 | 状态 |
|---------|--------|---------|---------|---------|------|
| TC-A01 | P0 | 00:30 | 当日00:00 | ❌ 拒绝（过去） | ⏳ |
| TC-A02 | P0 | 00:30 | 当日01:00 | ✅ 成功 | ⏳ |
| TC-A03 | P0 | 00:30 | 当日02:00 | ❌ 拒绝（超出范围） | ⏳ |
| TC-A04 | P0 | 00:30 | 次日14:00 | ❌ 拒绝（跨天） | ⏳ |
| TC-B01 | P0 | 01:30 | 当日01:00 | ❌ 拒绝（过去） | ⏳ |
| TC-B02 | P0 | 01:00 | 当日01:00 | ✅ 成功（立即生效） | ⏳ |
| TC-B03 | P0 | 01:30 | 当日02:00 | ❌ 拒绝（超出范围） | ⏳ |
| TC-C01 | P0 | 07:00 | 当日14:00 | ✅ 成功 | ⏳ |
| TC-C02 | P0 | 07:00 | 当日15:00 | ✅ 成功 | ⏳ |
| TC-C03 | P0 | 07:00 | 当日10:00 | ❌ 拒绝（禁止时段） | ⏳ |
| TC-C04 | P0 | 07:00 | 当日08:00 | ❌ 拒绝（过去+禁止） | ⏳ |
| TC-C05 | P0 | 07:00 | 当日00:00 | ❌ 拒绝（过去） | ⏳ |
| TC-C06 | P0 | 07:00 | 次日01:00 | ❌ 拒绝（跨天） | ⏳ |
| TC-C07 | P1 | 13:59 | 当日14:00 | ✅ 成功 | ⏳ |
| TC-D01 | P0 | 14:00 | 当日14:00 | ✅ 成功（立即生效） | ⏳ |
| TC-D02 | P0 | 14:30 | 当日14:00 | ✅ 成功（当前小时） | ⏳ |
| TC-D03 | P0 | 14:30 | 当日15:00 | ✅ 成功 | ⏳ |
| TC-D04 | P0 | 15:00 | 当日14:00 | ❌ 拒绝（过去） | ⏳ |
| TC-D05 | P0 | 23:00 | 当日23:00 | ✅ 成功（立即生效） | ⏳ |
| TC-D06 | P0 | 23:00 | 次日00:00 | ❌ 拒绝（跨天） | ⏳ |
| TC-D07 | P0 | 23:00 | 次日01:00 | ❌ 拒绝（跨天） | ⏳ |
| TC-E01 | P0 | 任意 | 15:30 | ❌ 拒绝（非整点） | ⏳ |
| TC-E02 | P1 | 任意 | 15:15 | ❌ 拒绝（非整点） | ⏳ |
| TC-E03 | P1 | 任意 | 格式错误 | ❌ 拒绝（格式） | ⏳ |
| TC-E04 | P1 | 任意 | 缺字段 | ❌ 拒绝（必填） | ⏳ |
| TC-E05 | P1 | 任意 | 不存在助教 | ❌ 404 | ⏳ |
| TC-E06 | P1 | 任意 | 重复报备 | ❌ 拒绝（重复） | ⏳ |
| TC-E07 | P1 | 任意 | 无token | ❌ 401 | ⏳ |
| TC-F01 | P0 | 当前 | 未来整点 | ✅ 数据库验证 | ⏳ |

**总计**: 28 个用例，其中 P0: 21 个，P1: 7 个

---

## 执行说明

### 时段依赖用例

以下用例依赖特定系统时间执行，建议在不同时段分别执行：

| 用例组 | 需执行时段 | 建议执行时间 |
|--------|-----------|-------------|
| A组（0点时段） | 00:00-00:59 | 凌晨执行或代码模拟 |
| B组（1点时段） | 01:00-01:59 | 凌晨执行或代码模拟 |
| C组（2-13点时段） | 02:00-13:59 | 上午执行（如07:00-13:00） |
| D组（14-23点时段） | 14:00-23:59 | 下午/晚上执行 |
| E组（通用） | 任意时段 | 随时执行 |

### 代码模拟方案

若无法在特定时段执行测试，可通过以下方式模拟：

1. **方法一**：直接修改 `validateLejuanTime` 函数，添加测试模式参数
2. **方法二**：使用 `timekeeper` 等时间模拟库（需修改代码）
3. **方法三**：临时修改服务器系统时间（不推荐，影响大）

推荐方法一：在 `lejuan-records.js` 中添加测试入口，接受可选的 `mockNowTime` 参数来模拟当前时间。

### 环境清理

每个用例组执行前，清理测试产生的 pending 记录：

```bash
sqlite3 /TG/tgservice/db/tgservice.db \
  "DELETE FROM lejuan_records WHERE remark LIKE 'TC-%' AND lejuan_status = 'pending';"
```
