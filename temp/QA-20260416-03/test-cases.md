# QA-20260416-03 测试用例：同步水牌增加离店助教台桌号清理功能

## 需求概述

后台Admin助教管理页面的**同步水牌**按钮，增加一个功能：

当水牌状态在**离店**（休息、公休、请假、下班）时，如果助教的水牌里还有台桌号，那么列举出来给用户，确认要不要删除台桌号。

**注意**：
1. 只是删除水牌的台桌号，不要删掉水牌的助教数据
2. 用户确认后执行删除
3. 需要给用户一个确认的交互界面

---

## 测试数据准备

### 前置：查看现有离店但有台桌号的数据

```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, stage_name, status, table_no FROM water_boards WHERE status IN ('休息','公休','请假','下班') AND table_no IS NOT NULL AND table_no != '';"
```

如果查询结果为空，需要INSERT创建测试数据：

```bash
# 插入离店但有台桌号的测试数据（用于测试检测功能）
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT OR REPLACE INTO water_boards (coach_no, stage_name, status, table_no, updated_at, created_at)
VALUES 
  ('99001', '测试离店A', '休息', 'VIP1', datetime('now')),
  ('99002', '测试离店B', '公休', 'BOSS3', datetime('now')),
  ('99003', '测试离店C', '请假', 'VIP2', datetime('now')),
  ('99004', '测试离店D', '下班', '普台99', datetime('now')),
  ('99005', '测试离店E', '休息', 'VIP3,BOSS1', datetime('now'));
"

# 确保coaches表中有对应记录（避免被识别为孤儿数据）
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT OR IGNORE INTO coaches (coach_no, employee_id, stage_name, status, shift)
VALUES 
  (99001, 'TEST001', '测试离店A', '全职', '晚班'),
  (99002, 'TEST002', '测试离店B', '全职', '早班'),
  (99003, 'TEST003', '测试离店C', '全职', '晚班'),
  (99004, 'TEST004', '测试离店D', '全职', '早班'),
  (99005, 'TEST005', '测试离店E', '全职', '晚班');
"

# 插入离店且无台桌号的正常数据（用于对比，不应被检测出来）
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT OR REPLACE INTO water_boards (coach_no, stage_name, status, table_no, updated_at, created_at)
VALUES ('99006', '测试离店F', '休息', NULL, datetime('now'), datetime('now'));
"
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT OR IGNORE INTO coaches (coach_no, employee_id, stage_name, status, shift)
VALUES (99006, 'TEST006', '测试离店F', '全职', '早班');
"

# 插入上班状态有台桌号的数据（用于对比，不应被检测出来）
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT OR REPLACE INTO water_boards (coach_no, stage_name, status, table_no, updated_at, created_at)
VALUES ('99007', '测试上班A', '晚班上桌', '普台88', datetime('now'), datetime('now'));
"
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT OR IGNORE INTO coaches (coach_no, employee_id, stage_name, status, shift)
VALUES (99007, 'TEST007', '测试上班A', '全职', '晚班');
"
```

### 清理测试数据（测试结束后）

```bash
sqlite3 /TG/tgservice/db/tgservice.db "
DELETE FROM water_boards WHERE coach_no IN ('99001','99002','99003','99004','99005','99006','99007');
DELETE FROM coaches WHERE coach_no IN (99001,99002,99003,99004,99005,99006,99007);
"
```

---

## 测试用例

### 一、核心API接口测试

#### TC-01: [P0] 预览同步水牌 - 新增返回离店有台桌号数据

**目的**：验证 preview API 能正确检测并返回离店状态但有台桌号的助教数据。

**前置条件**：
- 已登录后台，获取有效 token
- 已准备好测试数据（99001-99007）

**测试步骤**：

```bash
# 调用预览接口
curl -s -X GET "http://127.0.0.1:8088/api/admin/coaches/sync-water-boards/preview" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" | python3 -m json.tool
```

**预期结果**：
- HTTP 200
- 响应中包含新增字段 `offDutyWithTables`，包含：
  - `99001` (测试离店A, 休息, VIP1)
  - `99002` (测试离店B, 公休, BOSS3)
  - `99003` (测试离店C, 请假, VIP2)
  - `99004` (测试离店D, 下班, 普台99)
  - `99005` (测试离店E, 休息, VIP3,BOSS1)
- **不包含** `99006`（休息但无台桌号）
- **不包含** `99007`（晚班上桌状态，非离店）
- 原有 `orphanRecords` 和 `missingRecords` 字段仍存在
- 返回格式示例：
  ```json
  {
    "orphanRecords": [],
    "missingRecords": [],
    "offDutyWithTables": [
      {"coach_no": "99001", "stage_name": "测试离店A", "status": "休息", "table_no": "VIP1"},
      ...
    ],
    "summary": {"orphanCount": 0, "missingCount": 0, "offDutyWithTablesCount": 5}
  }
  ```

---

#### TC-02: [P0] 执行清理台桌号 - 单个助教

**目的**：验证 execute API 通过 `clearTableCoachNos` 参数能正确删除单个助教的台桌号，但不删除水牌记录。

**前置条件**：
- 已获取有效 token
- 测试数据已就绪

**测试步骤**：

```bash
# 调用执行接口，通过 clearTableCoachNos 参数清理单个助教台桌号
curl -s -X POST "http://127.0.0.1:8088/api/admin/coaches/sync-water-boards/execute" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"deleteOrphanIds": [], "addMissingIds": [], "clearTableCoachNos": ["99001"]}' | python3 -m json.tool

# 验证数据库：台桌号应为空，但水牌记录仍存在
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, stage_name, status, table_no FROM water_boards WHERE coach_no = '99001';"
```

**预期结果**：
- HTTP 200，返回 `{ "success": true, "deleted": 0, "added": 0, "cleared": 1, "errors": [] }`
- 数据库查询结果：
  - `coach_no = '99001'`
  - `table_no` 为 NULL 或空字符串
  - `status` 仍为 `休息`（状态不变）
  - 水牌记录仍存在（未被删除）

---

#### TC-03: [P0] 执行清理台桌号 - 批量多个助教

**目的**：验证 execute API 通过 `clearTableCoachNos` 参数支持批量操作。

**前置条件**：
- 已获取有效 token
- 测试数据 99001-99005 的台桌号仍存在

**测试步骤**：

```bash
# 调用执行接口，通过 clearTableCoachNos 参数批量清理
curl -s -X POST "http://127.0.0.1:8088/api/admin/coaches/sync-water-boards/execute" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"deleteOrphanIds": [], "addMissingIds": [], "clearTableCoachNos": ["99002", "99003", "99004", "99005"]}' | python3 -m json.tool

# 验证数据库：所有指定助教的台桌号应为空
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, stage_name, status, table_no FROM water_boards WHERE coach_no IN ('99002','99003','99004','99005');"
```

**预期结果**：
- HTTP 200，返回 `{ "success": true, "deleted": 0, "added": 0, "cleared": 4, "errors": [] }`
- 所有指定助教的 `table_no` 均为 NULL 或空
- 所有水牌记录仍存在
- 状态字段均不变

---

#### TC-04: [P0] 预览中离店有台桌号数据与原有同步功能并存

**目的**：验证新增的检测不影响原有的孤儿数据检测和缺失数据检测。

**前置条件**：
- 已获取有效 token
- 测试数据就绪
- 创建一个孤儿数据（coaches表不存在的水牌记录）

**测试步骤**：

```bash
# 先创建孤儿数据
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT OR REPLACE INTO water_boards (coach_no, stage_name, status, table_no, updated_at, created_at)
VALUES ('99999', '孤儿数据', '下班', 'VIP8', datetime('now'), datetime('now'));
"

# 调用预览接口
curl -s -X GET "http://127.0.0.1:8088/api/admin/coaches/sync-water-boards/preview" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" | python3 -m json.tool
```

**预期结果**：
- `orphanRecords` 中包含 `99999`（孤儿数据）
- `offDutyWithTables` 中包含离店有台桌号的记录（99001-99005）
- 三者（orphan / missing / offDutyWithTables）互不干扰
- `summary` 中包含各类型的计数

**清理**：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM water_boards WHERE coach_no = '99999';"
```

---

#### TC-05: [P1] 执行原有同步水牌不影响离店有台桌号数据

**目的**：验证执行原有的同步（删除孤儿+添加缺失）不会误操作离店有台桌号的数据。

**前置条件**：
- 已获取有效 token
- 测试数据 99001-99005 台桌号仍存在
- 创建一个孤儿数据

**测试步骤**：

```bash
# 创建孤儿数据
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT OR REPLACE INTO water_boards (coach_no, stage_name, status, table_no, updated_at, created_at)
VALUES ('99998', '孤儿数据2', '休息', 'VIP9', datetime('now'), datetime('now'));
"

# 执行同步（只操作孤儿数据，不操作离店有台桌号数据）
curl -s -X POST "http://127.0.0.1:8088/api/admin/coaches/sync-water-boards/execute" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"deleteOrphanIds": ["99998"], "addMissingIds": []}' | python3 -m json.tool

# 验证：离店有台桌号的数据不受影响
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, stage_name, status, table_no FROM water_boards WHERE coach_no IN ('99001','99002') AND table_no IS NOT NULL AND table_no != '';"
```

**预期结果**：
- `execute` 接口正常删除孤儿数据 99998
- 99001 和 99002 的 `table_no` 仍保留（未被清理）
- 证明原有同步逻辑和新增清理逻辑是独立的

**清理**：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM water_boards WHERE coach_no = '99998';"
```

---

### 二、异常流程测试

#### TC-06: [P1] 清理台桌号 - 清理不存在的助教

**目的**：验证 execute API 处理不存在教练编号的情况。

**测试步骤**：

```bash
curl -s -X POST "http://127.0.0.1:8088/api/admin/coaches/sync-water-boards/execute" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"deleteOrphanIds": [], "addMissingIds": [], "clearTableCoachNos": ["999999"]}' | python3 -m json.tool
```

**预期结果**：
- HTTP 200，返回 `{ "success": true, "deleted": 0, "added": 0, "cleared": 0, "errors": [] }`
- `cleared` 为 0（该教练不存在于 water_boards）
- 不影响其他正常数据

---

#### TC-07: [P1] 清理台桌号 - 清理上班状态的助教（带台桌号）

**目的**：验证 execute API 的 `clearTableCoachNos` 对上班状态（非离店）助教的处理。

**前置条件**：
- 99007 为上班状态且有台桌号

**测试步骤**：

```bash
# 先确认状态
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, status, table_no FROM water_boards WHERE coach_no = '99007';"

# 通过 execute API 尝试清理上班状态的助教
curl -s -X POST "http://127.0.0.1:8088/api/admin/coaches/sync-water-boards/execute" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"deleteOrphanIds": [], "addMissingIds": [], "clearTableCoachNos": ["99007"]}' | python3 -m json.tool

# 验证结果
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, status, table_no FROM water_boards WHERE coach_no = '99007';"
```

**预期结果**：
- HTTP 200，返回 `{ "success": true, "deleted": 0, "added": 0, "cleared": 1, "errors": [] }`
- 99007 的 `table_no` 被清空（后端只按 coach_no 更新，不校验状态）

> **说明**：清理逻辑在 execute API 的 `clearTableCoachNos` 中执行，后端不校验助教状态（因为用户在前端手动勾选确认）。但前端在 preview 返回的 `offDutyWithTables` 中不会包含上班状态的助教，所以正常情况下不会发生用户勾选上班状态助教的情况。

---

#### TC-08: [P1] 清理台桌号 - 空参数

**目的**：验证空 `clearTableCoachNos` 参数的处理。

**测试步骤**：

```bash
curl -s -X POST "http://127.0.0.1:8088/api/admin/coaches/sync-water-boards/execute" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"deleteOrphanIds": [], "addMissingIds": [], "clearTableCoachNos": []}' | python3 -m json.tool
```

**预期结果**：
- HTTP 200
- 返回 `{ "success": true, "deleted": 0, "added": 0, "cleared": 0, "errors": [] }`

---

#### TC-09: [P1] 清理台桌号 - 缺少请求体参数

**目的**：验证缺少必要参数时的处理。

**测试步骤**：

```bash
curl -s -X POST "http://127.0.0.1:8088/api/admin/coaches/sync-water-boards/execute" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool
```

**预期结果**：
- HTTP 400
- 返回 `{ "error": "参数格式错误" }` 或类似提示（缺少必要的请求体字段）

---

#### TC-10: [P1] 清理台桌号 - 教练无权限

**目的**：验证无权限用户不能调用 execute 接口。

**测试步骤**：

```bash
# 使用无权限token或无token
curl -s -X POST "http://127.0.0.1:8088/api/admin/coaches/sync-water-boards/execute" \
  -H "Content-Type: application/json" \
  -d '{"deleteOrphanIds": [], "addMissingIds": [], "clearTableCoachNos": ["99001"]}' | python3 -m json.tool
```

**预期结果**：
- HTTP 401 或 403
- 返回权限错误

---

#### TC-11: [P2] 清理台桌号 - 台桌号已为空的离店助教

**目的**：验证对台桌号已为空的离店助教执行清理操作。

**前置条件**：
- 99006 为休息状态且 table_no 为 NULL

**测试步骤**：

```bash
# 先确认
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, status, table_no FROM water_boards WHERE coach_no = '99006';"

# 通过 execute API 执行清理
curl -s -X POST "http://127.0.0.1:8088/api/admin/coaches/sync-water-boards/execute" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"deleteOrphanIds": [], "addMissingIds": [], "clearTableCoachNos": ["99006"]}' | python3 -m json.tool
```

**预期结果**：
- HTTP 200，返回 `{ "success": true, "deleted": 0, "added": 0, "cleared": 0, "errors": [] }`
- `cleared` 为 0（该助教台桌号已为空，无需清理）
- 不影响数据完整性

---

#### TC-12: [P2] 清理台桌号 - 多张台桌号的情况

**目的**：验证清除多张台桌号（逗号分隔）的情况。

**前置条件**：
- 99005 的 table_no 为 `VIP3,BOSS1`

**测试步骤**：

```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, table_no FROM water_boards WHERE coach_no = '99005';"

curl -s -X POST "http://127.0.0.1:8088/api/admin/coaches/sync-water-boards/execute" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"deleteOrphanIds": [], "addMissingIds": [], "clearTableCoachNos": ["99005"]}' | python3 -m json.tool

sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, table_no FROM water_boards WHERE coach_no = '99005';"
```

**预期结果**：
- `table_no` 完全清空（NULL 或空字符串）
- 状态不变

---

### 三、数据完整性测试

#### TC-13: [P1] 清理台桌号后 water_boards 记录仍存在

**目的**：验证清理操作只删除 table_no，不删除水牌记录本身。

**测试步骤**：

```bash
# 重新插入测试数据
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT OR REPLACE INTO water_boards (coach_no, stage_name, status, table_no, updated_at, created_at)
VALUES ('99010', '完整性测试', '休息', 'VIP6', datetime('now'), datetime('now'));
"

# 通过 execute API 执行清理
curl -s -X POST "http://127.0.0.1:8088/api/admin/coaches/sync-water-boards/execute" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"deleteOrphanIds": [], "addMissingIds": [], "clearTableCoachNos": ["99010"]}' | python3 -m json.tool

# 验证水牌记录仍存在
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, stage_name, status, table_no FROM water_boards WHERE coach_no = '99010';"
```

**预期结果**：
- 记录仍存在
- `status` 仍为 `休息`
- `table_no` 为空
- `updated_at` 有更新

**清理**：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM water_boards WHERE coach_no = '99010';"
```

---

#### TC-14: [P2] 清理台桌号后 coaches 记录不受影响

**目的**：验证清理操作不影响 coaches 表数据。

**测试步骤**：

```bash
# 清理前查看 coaches 数据
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, stage_name, status, shift FROM coaches WHERE coach_no = 99001;"

# 通过 execute API 执行清理
curl -s -X POST "http://127.0.0.1:8088/api/admin/coaches/sync-water-boards/execute" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"deleteOrphanIds": [], "addMissingIds": [], "clearTableCoachNos": ["99001"]}' | python3 -m json.tool

# 清理后再次查看 coaches 数据
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, stage_name, status, shift FROM coaches WHERE coach_no = 99001;"
```

**预期结果**：
- coaches 表数据完全不变

---

### 四、完整业务流程测试

#### TC-15: [P0] 完整业务流程：预览 → 确认 → 清理 → 验证

**目的**：模拟用户完整操作流程。

**前置条件**：
- 重置测试数据

**测试步骤**：

```bash
# Step 1: 重置测试数据
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT OR REPLACE INTO water_boards (coach_no, stage_name, status, table_no, updated_at, created_at)
VALUES 
  ('99001', '测试离店A', '休息', 'VIP1', datetime('now')),
  ('99002', '测试离店B', '公休', 'BOSS3', datetime('now')),
  ('99003', '测试离店C', '请假', 'VIP2', datetime('now'));
"

# Step 2: 用户点击同步水牌按钮，触发预览接口
curl -s -X GET "http://127.0.0.1:8088/api/admin/coaches/sync-water-boards/preview" \
  -H "Authorization: Bearer <TOKEN>" | python3 -c "
import json, sys
data = json.load(sys.stdin)
# 检查是否有离店有台桌号的数据
off_duty = data.get('offDutyWithTables', [])
print(f'检测到离店有台桌号: {len(off_duty)} 条')
for item in off_duty:
    print(f'  {item[\"coach_no\"]} {item[\"stage_name\"]} 状态:{item[\"status\"]} 台桌:{item[\"table_no\"]}')
"

# Step 3: 用户在前端确认清理，调用 execute 接口
curl -s -X POST "http://127.0.0.1:8088/api/admin/coaches/sync-water-boards/execute" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"deleteOrphanIds": [], "addMissingIds": [], "clearTableCoachNos": ["99001", "99002", "99003"]}' | python3 -m json.tool

# Step 4: 验证清理结果
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, stage_name, status, table_no FROM water_boards WHERE coach_no IN ('99001','99002','99003');"

# Step 5: 再次预览，确认不再有离店有台桌号的数据
curl -s -X GET "http://127.0.0.1:8088/api/admin/coaches/sync-water-boards/preview" \
  -H "Authorization: Bearer <TOKEN>" | python3 -c "
import json, sys
data = json.load(sys.stdin)
off_duty = data.get('offDutyWithTables', [])
print(f'清理后检测: {len(off_duty)} 条')
"
```

**预期结果**：
1. Step 2 检测到 3 条离店有台桌号数据
2. Step 3 清理成功，返回 `{ "success": true, "deleted": 0, "added": 0, "cleared": 3, "errors": [] }`
3. Step 4 验证：
   - 3 条记录的 `table_no` 均为空
   - 3 条记录的 `status` 不变（休息/公休/请假）
   - 水牌记录均存在
4. Step 5 检测：离店有台桌号数量为 0

---

## API接口定义（供开发参考）

### 1. 预览接口扩展

**现有** `GET /api/admin/coaches/sync-water-boards/preview` 响应中增加字段：

```json
{
  "orphanRecords": [...],
  "missingRecords": [...],
  "offDutyWithTables": [
    {
      "coach_no": "10009",
      "stage_name": "momo",
      "status": "休息",
      "table_no": "VIP1"
    }
  ],
  "summary": {
    "orphanCount": 0,
    "missingCount": 0,
    "offDutyWithTablesCount": 1
  }
}
```

**SQL 查询**（建议）：
```sql
SELECT coach_no, stage_name, status, table_no 
FROM water_boards 
WHERE status IN ('休息', '公休', '请假', '下班')
  AND table_no IS NOT NULL 
  AND table_no != ''
ORDER BY CAST(coach_no AS INTEGER)
```

### 2. 执行接口新增参数：clearTableCoachNos

**复用现有** `POST /api/admin/coaches/sync-water-boards/execute` 接口，新增 `clearTableCoachNos` 参数。

**请求体**：
```json
{
  "deleteOrphanIds": ["99999"],
  "addMissingIds": ["10020"],
  "clearTableCoachNos": ["10009", "10013"]
}
```

> 三种操作可组合使用，也可单独使用（传空数组表示不执行该操作）。

**响应**：
```json
{
  "success": true,
  "deleted": 1,
  "added": 1,
  "cleared": 2,
  "errors": []
}
```

**数据库操作（清理台桌号部分）**：
```sql
UPDATE water_boards SET table_no = NULL, updated_at = datetime('now')
WHERE coach_no IN ('10009', '10013')
```

---

## 测试用例汇总

| 编号 | 优先级 | 类型 | 描述 | 状态 |
|------|--------|------|------|------|
| TC-01 | P0 | 核心 | 预览API返回离店有台桌号数据 | ⬜ 待测 |
| TC-02 | P0 | 核心 | 通过execute API清理单个助教台桌号 | ⬜ 待测 |
| TC-03 | P0 | 核心 | 通过execute API批量清理多个助教台桌号 | ⬜ 待测 |
| TC-04 | P0 | 核心 | 新增检测与原有同步功能并存 | ⬜ 待测 |
| TC-05 | P1 | 重要 | 原有同步不影响离店有台桌号数据 | ⬜ 待测 |
| TC-06 | P1 | 异常 | 清理不存在的助教 | ⬜ 待测 |
| TC-07 | P1 | 异常 | 清理上班状态的助教 | ⬜ 待测 |
| TC-08 | P1 | 异常 | 空参数 | ⬜ 待测 |
| TC-09 | P1 | 异常 | 缺少必要参数 | ⬜ 待测 |
| TC-10 | P1 | 异常 | 无权限访问 | ⬜ 待测 |
| TC-11 | P2 | 次要 | 清理台桌号已为空的离店助教 | ⬜ 待测 |
| TC-12 | P2 | 次要 | 多张台桌号的情况 | ⬜ 待测 |
| TC-13 | P1 | 完整性 | 清理后 water_boards 记录仍存在 | ⬜ 待测 |
| TC-14 | P2 | 完整性 | 清理后 coaches 记录不受影响 | ⬜ 待测 |
| TC-15 | P0 | 流程 | 完整业务流程 | ⬜ 待测 |

**总计**：15 个测试用例
- P0 核心：5 个
- P1 重要：7 个  
- P2 次要：3 个

---

> **测试环境**：后端API http://127.0.0.1:8088
> **数据库**：/TG/tgservice/db/tgservice.db
> **离店状态集合**：`['休息', '公休', '请假', '下班']`
> **清理规则**：只清空 `table_no` 字段，不删除水牌记录
> **API设计**：不创建新API，复用 `POST /api/admin/coaches/sync-water-boards/execute`，新增 `clearTableCoachNos` 参数
