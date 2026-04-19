你是QA审计员。请审计以下测试用例。

## 测试用例内容
```
# QA 测试用例：上下班打卡时间记录功能

**需求编号**: QA-20260419-02  
**测试日期**: 2026-04-19  
**测试地址**: http://127.0.0.1:8088  
**测试策略**: 纯 API/curl 测试 + sqlite3 数据库操作  

---

## 0. 前置准备

### 0.1 获取认证 Token

**说明**：打卡 API 需要认证。以下两种方式任选其一：

#### 方式A：助教登录获取 Token（推荐，用于助教自己打卡）

```bash
# 助教登录（使用已有助教数据：employee_id=2, stage_name=陆飞, id_card_last6=任意6位）
curl -s -X POST http://127.0.0.1:8088/api/coach/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"2","stageName":"陆飞","idCardLast6":"000000"}'
```

**预期结果**：
```json
{
  "success": true,
  "token": "MTAwMDI6MTcx...",
  "coach": {
    "coachNo": 10002,
    "employeeId": "2",
    "stageName": "陆飞",
    "shift": "早班"
  }
}
```

> 将返回的 `token` 保存为变量 `$TOKEN`，后续请求使用 `Authorization: Bearer $TOKEN`。
> **注意**：助教 token 是 base64 格式，权限校验中 `coachSelfOnly: true` 只允许助教打自己的卡。

#### 方式B：管理员登录获取 Token（用于管理操作，如查询打卡记录）

```bash
# 管理员登录（tgadmin / mms633268）
curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}'
```

**预期结果**：
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "role": "管理员",
  "permissions": {"backend": {...}}
}
```

---

### 0.2 测试用助教数据准备

**查看现有助教**：
```bash
sqlite3 /TG/run/db/tgservice.db "SELECT coach_no, employee_id, stage_name, status, shift FROM coaches WHERE status != '离职' LIMIT 10;"
```

**预期结果**：应返回多条在职助教记录，例如：
```
10002|2|陆飞|全职|早班
10003|3|六六|全职|晚班
10005|5|芝芝|全职|晚班
...
```

**如需创建测试专用助教**：
```bash
sqlite3 /TG/run/db/tgservice.db "INSERT INTO coaches (employee_id, stage_name, status, shift) VALUES ('TEST01', '测试助教A', '全职', '早班');"
sqlite3 /TG/run/db/tgservice.db "INSERT INTO coaches (employee_id, stage_name, status, shift) VALUES ('TEST02', '测试助教B', '全职', '晚班');"
```

> 测试用助教数据在测试结束后清理。

### 0.3 清理历史测试数据

```bash
# 清空打卡表（如果已有测试数据）
sqlite3 /TG/run/db/tgservice.db "DELETE FROM attendance_records;"
```

---

## 1. P0 核心功能：打卡表结构验证

### TC-001 打卡表存在且字段完整

**优先级**: P0  
**目的**: 验证新增的 `attendance_records` 表结构正确  

**步骤**：
```bash
sqlite3 /TG/run/db/tgservice.db ".schema attendance_records"
```

**预期结果**：表结构应包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PRIMARY KEY | 自增主键 |
| `date` | TEXT | 打卡日期 YYYY-MM-DD |
| `employee_id` | TEXT | 工号 |
| `stage_name` | TEXT | 艺名 |
| `clock_in_time` | TEXT | 上班时间 YYYY-MM-DD HH:MM:SS（可为空） |
| `clock_out_time` | TEXT | 下班时间 YYYY-MM-DD HH:MM:SS（可为空） |
| `created_at` | DATETIME | 创建时间 |
| `updated_at` | DATETIME | 更新时间 |

```sql
-- 验证结果应类似：
CREATE TABLE attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    stage_name TEXT NOT NULL,
    clock_in_time TEXT,
    clock_out_time TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**通过标准**：
- ✅ 表存在
- ✅ 所有必填字段存在且类型正确
- ✅ date、employee_id、stage_name 为 NOT NULL
- ✅ clock_in_time、clock_out_time 允许为 NULL

---

## 2. P0 核心功能：上班打卡正常记录

### TC-010 正常上班打卡 — 创建打卡记录

**优先级**: P0  
**目的**: 验证上班打卡时正常创建 attendance_records 记录  

**前置条件**：
1. 助教 `10002`（陆飞, employee_id=2）存在
2. 水牌状态为「下班」或其他可上班状态
3. 今日（2026-04-19）该助教在 attendance_records 中无记录

**步骤**：
```bash
# 1. 助教登录获取 token
TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/coach/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"2","stageName":"陆飞","idCardLast6":"000000"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 2. 上班打卡
curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**预期结果**：
```json
{
  "success": true,
  "data": {
    "coach_no": 10002,
    "stage_name": "陆飞",
    "status": "早班空闲"
  }
}
```

**验证数据库**：
```bash
# 查询今日打卡记录
sqlite3 /TG/run/db/tgservice.db "SELECT * FROM attendance_records WHERE employee_id='2' AND date='$(date +%Y-%m-%d)';"
```

**预期数据库结果**：
```
1|2026-04-19|2|陆飞|2026-04-19 10:30:00||2026-04-19 10:30:00|2026-04-19 10:30:00
```
- `date` = 今日日期
- `employee_id` = 2
- `stage_name` = 陆飞
- `clock_in_time` = 当前时间（格式 YYYY-MM-DD HH:MM:SS）
- `clock_out_time` = NULL

**通过标准**：
- ✅ API 返回 success: true
- ✅ attendance_records 中新增一条记录
- ✅ date 字段为今日日期
- ✅ clock_in_time 有值，clock_out_time 为 NULL

### TC-011 上班打卡 — 重复打卡处理

**优先级**: P0  
**目的**: 验证同一助教同一天第二次上班打卡时的行为  

**前置条件**：
1. TC-010 已执行，助教 10002 今日已有上班记录

**步骤**：
```bash
# 再次上班打卡
curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**预期结果**（两种可能实现，由开发确认）：

- **方案A（推荐）**：返回错误提示
  ```json
  { "success": false, "error": "今日已上班，请勿重复打卡" }
  ```
- **方案B**：更新已有记录的 clock_in_time 为最新时间

**验证数据库**：
```bash
sqlite3 /TG/run/db/tgservice.db "SELECT count(*) FROM attendance_records WHERE employee_id='2' AND date='$(date +%Y-%m-%d)';"
```

**通过标准**：
- ✅ 不会产生重复的打卡记录（方案A）或更新了已有记录（方案B）
- ✅ 今日该助教最多只有一条 attendance_records 记录

### TC-012 上班打卡 — 水牌状态同步验证

**优先级**: P0  
**目的**: 验证上班打卡后 water_boards 的 clock_in_time 也被更新  

**前置条件**：TC-010 已执行

**步骤**：
```bash
# 查询水牌状态
sqlite3 /TG/run/db/tgservice.db "SELECT coach_no, stage_name, status, clock_in_time FROM water_boards WHERE coach_no='10002';"
```

**预期结果**：
```
10002|陆飞|早班空闲|2026-04-19 10:30:00
```

**通过标准**：
- ✅ water_boards.status = 对应班次的空闲状态
- ✅ water_boards.clock_in_time 有值（与 attendance_records.clock_in_time 一致）

---

## 3. P0 核心功能：下班打卡关联上班记录

### TC-020 正常下班打卡 — 正确关联上班记录并记录下班时间

**优先级**: P0  
**目的**: 验证下班打卡时能找到对应的上班记录并更新 clock_out_time  

**前置条件**：
1. TC-010 已执行，助教 10002 今日有上班记录（clock_out_time = NULL）
2. 水牌状态为「早班空闲」或其他可下班状态

**步骤**：
```bash
# 下班打卡
curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-out \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**预期结果**：
```json
{
  "success": true,
  "data": {
    "coach_no": 10002,
    "status": "下班"
  }
}
```

**验证数据库**：
```bash
# 1. 查询打卡记录
sqlite3 /TG/run/db/tgservice.db "SELECT id, date, employee_id, stage_name, clock_in_time, clock_out_time FROM attendance_records WHERE employee_id='2' AND date='$(date +%Y-%m-%d)';"

# 2. 查询水牌状态
sqlite3 /TG/run/db/tgservice.db "SELECT coach_no, status, clock_in_time FROM water_boards WHERE coach_no='10002';"
```

**预期数据库结果**：
```
-- attendance_records:
1|2026-04-19|2|陆飞|2026-04-19 10:30:00|2026-04-19 17:30:00

-- water_boards:
10002|下班|NULL
```

**通过标准**：
- ✅ API 返回 success: true
- ✅ attendance_records 中 clock_out_time 已被写入下班时间
- ✅ clock_in_time 保持不变
- ✅ water_boards.status = '下班'
- ✅ water_boards.clock_in_time = NULL（下班后清空）

### TC-021 下班打卡 — 关联逻辑正确性（多条上班记录时取最新）

**优先级**: P0  
**目的**: 验证当同一助教同一天有多条上班记录（异常数据）时，下班打卡关联最新的一条  

**前置条件**：手动模拟异常数据

**步骤**：
```bash
# 1. 清理现有数据
sqlite3 /TG/run/db/tgservice.db "DELETE FROM attendance_records WHERE employee_id='2';"

# 2. 插入两条上班记录（模拟异常）
sqlite3 /TG/run/db/tgservice.db "INSERT INTO attendance_records (date, employee_id, stage_name, clock_in_time) VALUES ('$(date +%Y-%m-%d)', '2', '陆飞', '2026-04-19 06:00:00');"
sqlite3 /TG/run/db/tgservice.db "INSERT INTO attendance_records (date, employee_id, stage_name, clock_in_time) VALUES ('$(date +%Y-%m-%d)', '2', '陆飞', '2026-04-19 08:00:00');"

# 3. 确认助教已处于可下班状态（先上班再下班）
# 注意：如果当前水牌状态不可下班，需要先执行上班再下班流程

# 4. 下班打卡
curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-out \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# 5. 查询打卡记录
sqlite3 /TG/run/db/tgservice.db "SELECT id, date, employee_id, clock_in_time, clock_out_time FROM attendance_records WHERE employee_id='2' AND date='$(date +%Y-%m-%d)' ORDER BY clock_in_time DESC;"
```

**预期结果**：
```
1|2026-04-19|2|2026-04-19 06:00:00|
2|2026-04-19|2|2026-04-19 08:00:00|2026-04-19 17:30:00
```

**通过标准**：
- ✅ 下班时间只写入了最新的一条上班记录（clock_in_time = 08:00:00）
- ✅ 较旧的上班记录（clock_in_time = 06:00:00）clock_out_time 保持 NULL
- ✅ 仅一条记录的 clock_out_time 被更新

---

## 4. P0 核心功能：无上班记录时下班打卡被丢弃

### TC-030 无上班记录时下班打卡 — 丢弃数据

**优先级**: P0  
**目的**: 验证没有对应上班卡时，下班打卡数据被丢弃，不创建打卡记录  

**前置条件**：
1. 清理助教 10002 的今日打卡记录
2. 确保水牌状态为「下班」（无可下班状态）

**步骤**：
```bash
# 1. 清理数据
sqlite3 /TG/run/db/tgservice.db "DELETE FROM attendance_records WHERE employee_id='2';"

# 2. 强制将水牌状态设为可下班状态（模拟异常场景）
sqlite3 /TG/run/db/tgservice.db "UPDATE water_boards SET status='早班空闲', clock_in_time='2026-04-19 08:00:00' WHERE coach_no='10002';"

# 注意：如果系统校验了 water_boards.clock_in_time 与 attendance_records 的一致性
# 可能需要不同的前置条件。以下测试假设仅检查 attendance_records 中是否有记录

# 3. 先删除 attendance_records 中该助教今日的记录（保持 water_boards 状态可下班）
sqlite3 /TG/run/db/tgservice.db "DELETE FROM attendance_records WHERE employee_id='2';"

# 4. 下班打卡
curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-out \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# 5. 查询打卡记录
sqlite3 /TG/run/db/tgservice.db "SELECT * FROM attendance_records WHERE employee_id='2' AND date='$(date +%Y-%m-%d)';"
```

**预期结果**：

- **如果水牌状态允许下班但 attendance_records 中无对应上班记录**：
  - 水牌状态更新为「下班」（water_boards 正常更新）
  - attendance_records 中**不创建**任何打卡记录
  - 或返回错误提示：`{ "success": false, "error": "无上班记录，无法下班打卡" }`

**通过标准**：
- ✅ attendance_records 中没有为该助教创建 clock_out_time 记录（或创建了一条被标记为无效的记录）
- ✅ 不会凭空产生一条只有 clock_out_time 没有 clock_in_time 的打卡记录

---

## 5. P1 重要功能：不同助教独立打卡

### TC-040 多助教各自打卡互不影响

**优先级**: P1  
**目的**: 验证不同助教的打卡记录相互独立  

**前置条件**：
1. 助教 10002（陆飞）和 10003（六六）都存在

**步骤**：
```bash
# 1. 助教A（陆飞）上班
TOKEN_A=$(curl -s -X POST http://127.0.0.1:8088/api/coach/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"2","stageName":"陆飞","idCardLast6":"000000"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-in \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json"

# 2. 助教B（六六）上班
TOKEN_B=$(curl -s -X POST http://127.0.0.1:8088/api/coach/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"3","stageName":"六六","idCardLast6":"000000"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -s -X POST http://127.0.0.1:8088/api/coaches/10003/clock-in \
  -H "Authorization: Bearer $TOKEN_B" \
  -H "Content-Type: application/json"

# 3. 查询两人的打卡记录
sqlite3 /TG/run/db/tgservice.db "SELECT employee_id, stage_name, clock_in_time, clock_out_time FROM attendance_records WHERE date='$(date +%Y-%m-%d)' ORDER BY employee_id;"
```

**预期结果**：
```
2|陆飞|2026-04-19 10:30:00|
3|六六|2026-04-19 10:31:00|
```

**通过标准**：
- ✅ 两位助教各有独立的打卡记录
- ✅ employee_id、stage_name 正确对应
- ✅ clock_in_time 各自独立记录

### TC-041 助教A下班不影响助教B

**优先级**: P1  
**目的**: 验证一个助教下班不会影响另一个助教的打卡记录  

**前置条件**：TC-040 已执行

**步骤**：
```bash
# 助教A下班
curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-out \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json"

# 查询两人记录
sqlite3 /TG/run/db/tgservice.db "SELECT employee_id, stage_name, clock_in_time, clock_out_time FROM attendance_records WHERE date='$(date +%Y-%m-%d)' ORDER BY employee_id;"
```

**预期结果**：
```
2|陆飞|2026-04-19 10:30:00|2026-04-19 11:00:00
3|六六|2026-04-19 10:31:00|
```

**通过标准**：
- ✅ 助教A的 clock_out_time 已填写
- ✅ 助教B的 clock_out_time 仍为 NULL（未受影响）

---

## 6. P1 重要功能：打卡记录查询

### TC-050 查询今日打卡记录

**优先级**: P1  
**目的**: 验证能查询今日的打卡记录列表  

**步骤**：
```bash
# 管理员登录
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 查询今日打卡记录
curl -s "http://127.0.0.1:8088/api/admin/attendance-records?date=$(date +%Y-%m-%d)" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

> **注意**：此 API 路径为预期路径，实际路径可能不同（如 `/api/attendance/today` 等），请以开发实现为准。

**预期结果**：
```json
{
  "success": true,
  "data": [
    { "id": 1, "date": "2026-04-19", "employee_id": "2", "stage_name": "陆飞", "clock_in_time": "2026-04-19 10:30:00", "clock_out_time": "2026-04-19 11:00:00" },
    { "id": 2, "date": "2026-04-19", "employee_id": "3", "stage_name": "六六", "clock_in_time": "2026-04-19 10:31:00", "clock_out_time": null }
  ]
}
```

**通过标准**：
- ✅ 返回今日所有打卡记录
- ✅ 每条记录包含完整的打卡时间信息

### TC-051 查询指定日期打卡记录

**优先级**: P1  
**目的**: 验证能查询历史日期的打卡记录  

**步骤**：
```bash
curl -s "http://127.0.0.1:8088/api/admin/attendance-records?date=2026-04-18" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**预期结果**：
```json
{
  "success": true,
  "data": []
}
```
（如果 2026-04-18 无打卡记录，返回空数组）

**通过标准**：
- ✅ 按日期过滤正确
- ✅ 无数据时返回空数组而非错误

### TC-052 查询指定助教打卡记录

**优先级**: P1  
**目的**: 验证能查询指定助教的打卡记录  

**步骤**：
```bash
curl -s "http://127.0.0.1:8088/api/admin/attendance-records?employee_id=2&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**预期结果**：
```json
{
  "success": true,
  "data": [
    { "id": 1, "date": "2026-04-19", "employee_id": "2", "stage_name": "陆飞", "clock_in_time": "2026-04-19 10:30:00", "clock_out_time": "2026-04-19 11:00:00" }
  ],
  "total": 1
}
```

**通过标准**：
- ✅ 只返回指定助教的记录
- ✅ 支持分页（limit/offset 或 page/size）

---

## 7. P1 重要功能：权限控制

### TC-060 助教只能打自己的卡

**优先级**: P1  
**目的**: 验证助教A不能代替助教B打卡  

**前置条件**：助教A（陆飞）已登录

**步骤**：
```bash
# 助教A尝试给助教B打卡
curl -s -X POST http://127.0.0.1:8088/api/coaches/10003/clock-in \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json"
```

**预期结果**：
```json
{ "success": false, "error": "无权限" }
```
或 HTTP 403 状态码

**通过标准**：
- ✅ 返回权限错误
- ✅ 助教B的打卡记录不受影响

### TC-061 未登录不能打卡

**优先级**: P1  
**目的**: 验证无 token 时无法打卡  

**步骤**：
```bash
curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-in \
  -H "Content-Type: application/json"
```

**预期结果**：
```json
{ "error": "未登录" }
```
HTTP 状态码 401

**通过标准**：
- ✅ 返回 401 未登录错误

---

## 8. P2 次要功能：边界场景

### TC-070 跨天场景 — 晚班跨午夜

**优先级**: P2  
**目的**: 验证晚班助教跨越午夜的打卡记录正确处理  

**场景描述**：晚班助教 23:00 上班，次日 02:00 下班

**步骤**：
```bash
# 1. 设置水牌状态为晚班空闲，模拟 23:00 上班
sqlite3 /TG/run/db/tgservice.db "DELETE FROM attendance_records WHERE employee_id='3';"
sqlite3 /TG/run/db/tgservice.db "UPDATE water_boards SET status='晚班空闲', clock_in_time=NULL WHERE coach_no='10003';"

# 2. 上班打卡（记录 date 为当天）
curl -s -X POST http://127.0.0.1:8088/api/coaches/10003/clock-in \
  -H "Authorization: Bearer $TOKEN_B" \
  -H "Content-Type: application/json"

# 3. 验证 date 字段
sqlite3 /TG/run/db/tgservice.db "SELECT date, clock_in_time FROM attendance_records WHERE employee_id='3' ORDER BY id DESC LIMIT 1;"
```

**预期结果**：
```
2026-04-19|2026-04-19 23:00:00
```

**通过标准**：
- ✅ date 字段为上班当天日期
- ✅ clock_in_time 正确记录

> **注意**：下班打卡时，如果跨天了，下班打卡的 date 仍应为上班当天的 date（同一条记录）。

### TC-071 早班和晚班助教同时打卡

**优先级**: P2  
**目的**: 验证不同班次助教同时打卡时记录正确  

**步骤**：
```bash
# 早班助教上班
curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-in \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json"

# 晚班助教上班
curl -s -X POST http://127.0.0.1:8088/api/coaches/10003/clock-in \
  -H "Authorization: Bearer $TOKEN_B" \
  -H "Content-Type: application/json"

# 查询记录
sqlite3 /TG/run/db/tgservice.db "SELECT e.employee_id, e.stage_name, e.date, e.clock_in_time FROM attendance_records e JOIN coaches c ON e.employee_id = c.employee_id WHERE e.date='$(date +%Y-%m-%d)';"
```

**通过标准**：
- ✅ 两人的打卡记录各自独立且正确
- ✅ stage_name 与 employee_id 对应正确

### TC-072 助教不存在时打卡

**优先级**: P2  
**目的**: 验证不存在的助教打卡返回错误  

**步骤**：
```bash
# 管理员使用 adminToken 尝试给不存在的助教打卡
curl -s -X POST http://127.0.0.1:8088/api/coaches/99999/clock-in \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**预期结果**：
```json
{ "success": false, "error": "助教不存在" }
```
HTTP 状态码 404

**通过标准**：
- ✅ 返回 404 错误
- ✅ 不创建打卡记录

### TC-073 离职助教打卡

**优先级**: P2  
**目的**: 验证离职助教不能打卡  

**步骤**：
```bash
# 1. 创建一个离职助教
sqlite3 /TG/run/db/tgservice.db "INSERT INTO coaches (employee_id, stage_name, status, shift) VALUES ('TEST03', '离职助教', '离职', '早班');"

# 2. 尝试登录
curl -s -X POST http://127.0.0.1:8088/api/coach/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"TEST03","stageName":"离职助教","idCardLast6":"000000"}'
```

**预期结果**：
```json
{ "error": "该账号已离职" }
```
HTTP 状态码 403

**通过标准**：
- ✅ 离职助教无法登录
- ✅ 无法获取 token，后续打卡自然无法执行

### TC-074 水牌不存在时打卡

**优先级**: P2  
**目的**: 验证助教存在但水牌不存在时打卡返回错误  

**步骤**：
```bash
# 1. 创建助教但不创建水牌
sqlite3 /TG/run/db/tgservice.db "INSERT INTO coaches (employee_id, stage_name, status, shift) VALUES ('TEST04', '无水牌助教', '全职', '晚班');"

# 2. 获取 token
TOKEN_TEST04=$(curl -s -X POST http://127.0.0.1:8088/api/coach/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"TEST04","stageName":"无水牌助教","idCardLast6":"000000"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))")

# 3. 获取 coach_no
COACH_NO=$(sqlite3 /TG/run/db/tgservice.db "SELECT coach_no FROM coaches WHERE employee_id='TEST04';")

# 4. 尝试上班打卡
curl -s -X POST http://127.0.0.1:8088/api/coaches/$COACH_NO/clock-in \
  -H "Authorization: Bearer $TOKEN_TEST04" \
  -H "Content-Type: application/json"
```

**预期结果**：
```json
{ "success": false, "error": "水牌不存在" }
```
HTTP 状态码 404

**通过标准**：
- ✅ 返回 404 错误
- ✅ 不创建打卡记录

---

## 9. P2 次要功能：数据一致性

### TC-080 打卡记录与水牌状态一致性

**优先级**: P2  
**目的**: 验证打卡记录与 water_boards 的状态一致性  

**场景**：上班打卡 → 下班打卡 → 再次上班打卡 → 再次下班打卡

**步骤**：
```bash
# 1. 清理
sqlite3 /TG/run/db/tgservice.db "DELETE FROM attendance_records WHERE employee_id='2';"

# 2. 第一次上班
curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-in \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json"

# 3. 第一次下班
curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-out \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json"

# 4. 再次上班
curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-in \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json"

# 5. 再次下班
curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-out \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json"

# 6. 查询所有打卡记录
sqlite3 /TG/run/db/tgservice.db "SELECT id, clock_in_time, clock_out_time FROM attendance_records WHERE employee_id='2' ORDER BY id;"
```

**预期结果**：
```
1|2026-04-19 10:00:00|2026-04-19 12:00:00
2|2026-04-19 14:00:00|2026-04-19 18:00:00
```

**通过标准**：
- ✅ 每次上下班形成一对完整记录
- ✅ clock_in_time 和 clock_out_time 时间顺序正确
- ✅ 不会出现 clock_out_time < clock_in_time 的记录

### TC-081 时间格式验证

**优先级**: P2  
**目的**: 验证打卡时间格式为 `YYYY-MM-DD HH:MM:SS`（北京时间，无时区标记）

**步骤**：
```bash
sqlite3 /TG/run/db/tgservice.db "SELECT clock_in_time, clock_out_time FROM attendance_records WHERE employee_id='2' AND clock_in_time IS NOT NULL LIMIT 1;"
```

**预期结果**：
```
2026-04-19 10:30:00|2026-04-19 17:30:00
```

**通过标准**：
- ✅ 时间格式为 `YYYY-MM-DD HH:MM:SS`
- ✅ 无时区标记（无 +08:00、无 Z）
- ✅ 使用 TimeUtil.nowDB() 生成时间

---

## 10. 测试数据清理

测试完成后，清理测试数据：

```bash
# 清理测试用助教
sqlite3 /TG/run/db/tgservice.db "DELETE FROM coaches WHERE employee_id IN ('TEST01','TEST02','TEST03','TEST04');"

# 清理测试用水牌
sqlite3 /TG/run/db/tgservice.db "DELETE FROM water_boards WHERE coach_no NOT IN (SELECT coach_no FROM coaches);"

# 清理测试用打卡记录（或保留供验收）
# sqlite3 /TG/run/db/tgservice.db "DELETE FROM attendance_records WHERE employee_id IN ('TEST01','TEST02','TEST03','TEST04');"
```

---

## 测试用例汇总

| 编号 | 优先级 | 测试点 | 验收对应 |
|------|--------|--------|----------|
| TC-001 | P0 | 打卡表结构验证 | 验收重点1 |
| TC-010 | P0 | 正常上班打卡创建记录 | 验收重点2 |
| TC-011 | P0 | 重复上班打卡处理 | 验收重点2 |
| TC-012 | P0 | 水牌状态同步验证 | 验收重点2 |
| TC-020 | P0 | 正常下班打卡关联上班记录 | 验收重点3 |
| TC-021 | P0 | 多条上班记录时关联最新的 | 验收重点3 |
| TC-030 | P0 | 无上班记录时下班打卡被丢弃 | 验收重点4 |
| TC-040 | P1 | 多助教各自打卡互不影响 | — |
| TC-041 | P1 | 助教A下班不影响助教B | — |
| TC-050 | P1 | 查询今日打卡记录 | — |
| TC-051 | P1 | 查询指定日期打卡记录 | — |
| TC-052 | P1 | 查询指定助教打卡记录 | — |
| TC-060 | P1 | 助教只能打自己的卡 | — |
| TC-061 | P1 | 未登录不能打卡 | — |
| TC-070 | P2 | 跨天场景（晚班跨午夜） | — |
| TC-071 | P2 | 早班晚班同时打卡 | — |
| TC-072 | P2 | 助教不存在时打卡 | — |
| TC-073 | P2 | 离职助教打卡 | — |
| TC-074 | P2 | 水牌不存在时打卡 | — |
| TC-080 | P2 | 多次上下班数据一致性 | — |
| TC-081 | P2 | 时间格式验证 | — |

**总计**：21 个测试用例  
- P0（核心）：7 个  
- P1（重要）：7 个  
- P2（次要）：7 个  

---

## 备注

1. **API 路径说明**：测试用例中查询打卡记录的 API 路径（如 `/api/admin/attendance-records`）为预期路径，实际路径以开发实现为准。
2. **Token 说明**：打卡 API 使用助教登录后获得的 base64 token，权限校验通过 `coachSelfOnly: true` 确保助教只能打自己的卡。
3. **时间说明**：所有时间使用北京时间 `YYYY-MM-DD HH:MM:SS` 格式，通过 `TimeUtil.nowDB()` 生成。
4. **数据库路径**：测试环境数据库路径为 `/TG/run/db/tgservice.db`。
5. **现有打卡 API**：`POST /api/coaches/:coach_no/clock-in` 和 `POST /api/coaches/:coach_no/clock-out` 已存在，本次功能需在此基础上增加 attendance_records 表的读写逻辑。

```

## 审计要点
1. 是否覆盖QA需求的所有功能点
2. 是否包含API接口真实测试操作（curl测试）
3. 测试步骤是否可执行
4. 是否有明确的预期结果
5. 是否区分了正常流程和异常流程

这是第 2/3 次审计。

## 输出要求
1. 审计结果：通过/不通过
2. 如不通过，列出具体问题