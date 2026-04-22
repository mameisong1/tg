# 助教门迎排序功能 - API 测试用例

> **测试环境**: `http://127.0.0.1:8088`
> **数据库**: `/TG/tgservice/db/tgservice.db`（测试环境）
> **测试策略**: 纯 API/curl 测试，不依赖浏览器
> **⚠️ 严禁使用 8081/8083 端口！**

---

## 前置：登录获取 Token

所有需要认证的接口均需携带 `Authorization: Bearer <token>` 头。

```bash
# 管理员登录获取 JWT Token
curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' | jq -r '.token'
```

> **后续所有 curl 命令中 `<TOKEN>` 需替换为上述返回的 token 值。**

---

## 一、数据库表结构验证

### TC-DB-001 | 检查 greeting_sort 表是否存在 | P0

```bash
curl -s http://127.0.0.1:8088/api/admin/db/schema/greeting_sort \
  -H "Authorization: Bearer <TOKEN>"
```

**预期结果**:
- 表 `greeting_sort` 存在（或通过 sqlite3 直接验证）
- 字段至少包含：`id`, `coach_no`, `sort_order`, `shift`, `date`, `created_at`

> 备用验证（直接查 sqlite3）：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "PRAGMA table_info(greeting_sort);"
```

---

### TC-DB-002 | 检查 coaches 表是否有免门迎字段 | P0

```bash
sqlite3 /TG/tgservice/db/tgservice.db "PRAGMA table_info(coaches);" | grep -i "skip_welcome\|no_greet\|免门迎\|skip_greet"
```

**预期结果**:
- `coaches` 表存在免门迎相关字段（如 `skip_greeting` 或 `skip_welcome`），类型 INTEGER DEFAULT 0

---

### TC-DB-003 | 检查 coaches 表是否有序号字段（备选方案） | P1

> 如果门迎序号存在 coaches 表而非独立表：

```bash
sqlite3 /TG/tgservice/db/tgservice.db "PRAGMA table_info(coaches);" | grep -i "sort_order\|greet_order\|welcome_order\|door_order"
```

**预期结果**:
- 序号字段存在于 coaches 或 greeting_sort 表中

---

## 二、14点/18点批处理排序

### TC-BATCH-001 | 14点批处理：早班助教排序为1-50 | P0

**场景**: 每天14:00触发定时任务，将所有早班（shift='早班'）且未设置免门迎的助教按序号1-50排序。

```bash
# 手动触发14点批处理排序（假设接口为 /api/greeting-sort/batch/morning）
curl -s -X POST http://127.0.0.1:8088/api/greeting-sort/batch/morning \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"date":"'"$(date +%Y-%m-%d)"'"}' | jq .
```

**预期结果**:
- 返回成功，包含排序的助教数量
- 查询排序结果：

```bash
# 验证早班助教序号在1-50范围内
curl -s http://127.0.0.1:8088/api/greeting-sort?date=$(date +%Y-%m-%d)&shift=早班 \
  -H "Authorization: Bearer <TOKEN>" | jq '.data[] | {coach_no, sort_order, shift}'
```

- 所有早班助教的 `sort_order` 值在 1-50 之间
- 每个早班助教的 `sort_order` 唯一（无重复）
- 免门迎助教不在排序结果中

> 备用验证（直接查 sqlite3）：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT c.stage_name, gs.sort_order, c.shift
  FROM greeting_sort gs
  JOIN coaches c ON gs.coach_no = c.coach_no
  WHERE gs.date = '$(date +%Y-%m-%d)' AND c.shift = '早班'
  ORDER BY gs.sort_order;
"
```

---

### TC-BATCH-002 | 18点批处理：晚班助教排序为51-100 | P0

**场景**: 每天18:00触发定时任务，将所有晚班（shift='晚班'）且未设置免门迎的助教按序号51-100排序。

```bash
# 手动触发18点批处理排序（假设接口为 /api/greeting-sort/batch/evening）
curl -s -X POST http://127.0.0.1:8088/api/greeting-sort/batch/evening \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"date":"'"$(date +%Y-%m-%d)"'"}' | jq .
```

**预期结果**:
- 返回成功，包含排序的助教数量
- 所有晚班助教的 `sort_order` 值在 51-100 之间
- 每个晚班助教的 `sort_order` 唯一

> 备用验证：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT c.stage_name, gs.sort_order, c.shift
  FROM greeting_sort gs
  JOIN coaches c ON gs.coach_no = c.coach_no
  WHERE gs.date = '$(date +%Y-%m-%d)' AND c.shift = '晚班'
  ORDER BY gs.sort_order;
"
```

---

### TC-BATCH-003 | 批处理排序覆盖机制 | P0

**场景**: 同一天14点先跑一次，18点再跑一次，晚班排序不应覆盖早班已有的序号。

```bash
# 先触发14点排序
curl -s -X POST http://127.0.0.1:8088/api/greeting-sort/batch/morning \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"date":"'"$(date +%Y-%m-%d)"'"}' | jq .

# 再触发18点排序
curl -s -X POST http://127.0.0.1:8088/api/greeting-sort/batch/evening \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"date":"'"$(date +%Y-%m-%d)"'"}' | jq .
```

**预期结果**:
- 早班助教序号仍为 1-50，未被覆盖
- 晚班助教序号为 51-100
- 全天序号不冲突

---

### TC-BATCH-004 | 批处理排序 - 早班超过50人的处理 | P1

**场景**: 早班助教人数超过50人时，超出的助教序号处理策略。

```bash
# 查询当前早班助教数量
sqlite3 /TG/tgservice/db/tgservice.db "SELECT COUNT(*) FROM coaches WHERE shift = '早班' AND status = '全职';"
```

**预期结果**:
- 如果早班人数 > 50，超出的助教应：
  - 方案A：序号从51继续分配（与晚班不冲突的前提下）
  - 方案B：排在第50位之后但不参与门迎排序
  - 方案C：返回错误提示
- **需确认具体策略，按设计文档验证**

---

### TC-BATCH-005 | 批处理排序 - 晚班超过50人的处理 | P1

**场景**: 晚班助教人数超过50人时，超出的助教序号处理策略。

**预期结果**:
- 如果晚班人数 > 50，超出的助教应：
  - 方案A：序号从101继续分配
  - 方案B：排在第100位之后但不参与门迎排序
  - 方案C：返回错误提示
- **需确认具体策略**

---

### TC-BATCH-006 | 批处理排序 - 离职/状态异常助教不参与 | P1

**场景**: 排序时应排除 status='离职' 的助教。

```bash
# 触发排序
curl -s -X POST http://127.0.0.1:8088/api/greeting-sort/batch/morning \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"date":"'"$(date +%Y-%m-%d)"'"}' | jq .

# 验证离职助教不在排序结果中
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT c.stage_name, c.status, gs.sort_order
  FROM greeting_sort gs
  JOIN coaches c ON gs.coach_no = c.coach_no
  WHERE gs.date = '$(date +%Y-%m-%d)' AND c.status = '离职';
"
```

**预期结果**:
- 查询结果为空（离职助教不应出现在排序中）

---

## 三、打卡后排序

### TC-CLOCKIN-001 | 14点后早班打卡触发排序 | P0

**场景**: 早班助教在14:00之后打卡上班，打卡完成后自动获得门迎序号。

```bash
# 选择一个早班助教（确保未打卡状态）
# 先查询早班助教列表
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, employee_id, stage_name FROM coaches WHERE shift = '早班' AND status = '全职' LIMIT 1;"

# 假设 coach_no=10002，先重置其水牌状态为下班
curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-in \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

**预期结果**:
- 打卡成功返回
- 该助教在 `greeting_sort` 表中获得对应的门迎序号（1-50范围内）
- 序号不与当日已排序的早班助教重复

> 验证：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT c.stage_name, gs.sort_order
  FROM greeting_sort gs
  JOIN coaches c ON gs.coach_no = c.coach_no
  WHERE gs.date = '$(date +%Y-%m-%d)' AND c.coach_no = 10002;
"
```

---

### TC-CLOCKIN-002 | 18点后晚班打卡触发排序 | P0

**场景**: 晚班助教在18:00之后打卡上班，打卡完成后自动获得门迎序号。

```bash
# 选择一个晚班助教
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, employee_id, stage_name FROM coaches WHERE shift = '晚班' AND status = '全职' LIMIT 1;"

# 打卡（假设 coach_no=10001）
curl -s -X POST http://127.0.0.1:8088/api/coaches/10001/clock-in \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

**预期结果**:
- 打卡成功
- 该助教在 `greeting_sort` 表中获得门迎序号（51-100范围内）

---

### TC-CLOCKIN-003 | 14点前早班打卡不触发排序 | P1

**场景**: 早班助教在14:00之前打卡（如13:50），不应获得门迎序号，等待14点批处理。

```bash
# 此测试需修改系统时间模拟，或检查代码逻辑中的时间判断
# 检查打卡接口中是否有时间判断逻辑
grep -n "14\|hour\|clock" /TG/tgservice/backend/routes/coaches.js | head -20
```

**预期结果**:
- 14点前打卡不应在 `greeting_sort` 中产生排序记录
- 或排序记录标记为"待生效"，14点批处理时统一激活

---

### TC-CLOCKIN-004 | 18点前晚班打卡不触发排序 | P1

**场景**: 晚班助教在18:00之前打卡，不应获得门迎序号。

**预期结果**:
- 18点前打卡不应在 `greeting_sort` 中产生排序记录
- 或排序记录标记为"待生效"，18点批处理时统一激活

---

### TC-CLOCKIN-005 | 打卡后排序 - 序号递增正确性 | P0

**场景**: 多个助教依次打卡，每个助教的序号应按打卡顺序递增。

```bash
# 获取3个早班助教
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, stage_name FROM coaches WHERE shift = '早班' AND status = '全职' LIMIT 3;"

# 依次打卡（假设 10002, 10008, 10012）
curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-in \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" -d '{}' | jq .

sleep 1

curl -s -X POST http://127.0.0.1:8088/api/coaches/10008/clock-in \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" -d '{}' | jq .

sleep 1

curl -s -X POST http://127.0.0.1:8088/api/coaches/10012/clock-in \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" -d '{}' | jq .

# 验证序号顺序
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT c.stage_name, gs.sort_order
  FROM greeting_sort gs
  JOIN coaches c ON gs.coach_no = c.coach_no
  WHERE gs.date = '$(date +%Y-%m-%d)' AND c.coach_no IN (10002, 10008, 10012)
  ORDER BY gs.sort_order;
"
```

**预期结果**:
- 先打卡的助教序号 < 后打卡的助教序号
- 序号连续或在已有序号基础上递增

---

### TC-CLOCKIN-006 | 重复打卡不重复分配序号 | P1

**场景**: 已打卡的助教再次打卡，不应重新分配序号或产生重复记录。

```bash
# 先打卡
curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-in \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" -d '{}' | jq .

# 再次打卡（应返回"已在班状态"错误）
curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-in \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" -d '{}' | jq .

# 验证排序记录只有一条
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT COUNT(*) FROM greeting_sort
  WHERE date = '$(date +%Y-%m-%d)' AND coach_no = 10002;
"
```

**预期结果**:
- 第二次打卡返回 400 错误（"助教已在班状态,无需重复上班"）
- `greeting_sort` 中该助教只有一条记录

---

## 四、24点清空排序

### TC-MIDNIGHT-001 | 24点定时清空当日排序 | P0

**场景**: 每天24:00触发定时任务，清空当日所有门迎排序数据。

```bash
# 先确保有排序数据（触发批处理）
curl -s -X POST http://127.0.0.1:8088/api/greeting-sort/batch/morning \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"date":"'"$(date +%Y-%m-%d)"'"}' | jq .

# 手动触发24点清空（假设接口为 /api/greeting-sort/clear）
curl -s -X POST http://127.0.0.1:8088/api/greeting-sort/clear \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"date":"'"$(date +%Y-%m-%d)"'"}' | jq .
```

**预期结果**:
- 清空接口返回成功
- 当日排序数据被删除：

```bash
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT COUNT(*) FROM greeting_sort WHERE date = '$(date +%Y-%m-%d)';
"
```

- 查询结果为 0

---

### TC-MIDNIGHT-002 | 24点清空不影响次日排序 | P1

**场景**: 24点清空的是当日数据，不影响次日新数据。

```bash
# 清空当日
curl -s -X POST http://127.0.0.1:8088/api/greeting-sort/clear \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"date":"'"$(date +%Y-%m-%d)"'"}' | jq .

# 触发次日排序
curl -s -X POST http://127.0.0.1:8088/api/greeting-sort/batch/morning \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"date":"'"$(date -d '+1 day' +%Y-%m-%d)"'"}' | jq .

# 验证当日无数据，次日有数据
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT date, COUNT(*) as cnt
  FROM greeting_sort
  WHERE date IN ('$(date +%Y-%m-%d)', '$(date -d '+1 day' +%Y-%m-%d)')
  GROUP BY date;
"
```

**预期结果**:
- 当日（date = 今天）count = 0
- 次日（date = 明天）count > 0

---

### TC-MIDNIGHT-003 | cron任务配置验证 | P1

**场景**: 验证cron任务表中是否有24点清空的定时任务配置。

```bash
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT * FROM cron_tasks WHERE task_name LIKE '%greet%' OR task_name LIKE '%sort%' OR task_name LIKE '%门迎%' OR task_name LIKE '%clear%';
"
```

**预期结果**:
- 存在 cron 任务，cron表达式为 `0 0 * * *`（每天0点执行）
- 任务描述包含"清空门迎排序"或类似描述

---

## 五、免门迎助教设定

### TC-SKIP-001 | 设置助教为免门迎 | P0

**场景**: 将某个助教设置为免门迎状态。

```bash
# 查询当前免门迎状态
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT coach_no, stage_name, skip_greeting
  FROM coaches WHERE coach_no = 10001;
"

# 设置免门迎（假设接口为 /api/coaches/:coach_no/skip-greeting）
curl -s -X PUT http://127.0.0.1:8088/api/coaches/10001/skip-greeting \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"skip_greeting": true}' | jq .
```

**预期结果**:
- 设置成功
- 数据库中该助教 `skip_greeting = 1`

---

### TC-SKIP-002 | 取消免门迎 | P0

**场景**: 将免门迎助教恢复为正常门迎状态。

```bash
curl -s -X PUT http://127.0.0.1:8088/api/coaches/10001/skip-greeting \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"skip_greeting": false}' | jq .

# 验证
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT coach_no, stage_name, skip_greeting
  FROM coaches WHERE coach_no = 10001;
"
```

**预期结果**:
- `skip_greeting = 0`

---

### TC-SKIP-003 | 免门迎助教不参与批处理排序 | P0

**场景**: 设置免门迎后，触发批处理排序，该助教不应出现在排序结果中。

```bash
# 先设置免门迎
curl -s -X PUT http://127.0.0.1:8088/api/coaches/10001/skip-greeting \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"skip_greeting": true}' | jq .

# 触发排序
curl -s -X POST http://127.0.0.1:8088/api/greeting-sort/batch/morning \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"date":"'"$(date +%Y-%m-%d)"'"}' | jq .

# 验证该助教不在排序中
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT COUNT(*) FROM greeting_sort
  WHERE date = '$(date +%Y-%m-%d)' AND coach_no = 10001;
"
```

**预期结果**:
- count = 0（免门迎助教不在排序结果中）

---

### TC-SKIP-004 | 免门迎助教不参与打卡后排序 | P0

**场景**: 免门迎助教打卡后，不应自动获得门迎序号。

```bash
# 设置免门迎（假设 coach_no=10002 是早班）
curl -s -X PUT http://127.0.0.1:8088/api/coaches/10002/skip-greeting \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"skip_greeting": true}' | jq .

# 打卡
curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-in \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .

# 验证无排序记录
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT COUNT(*) FROM greeting_sort
  WHERE date = '$(date +%Y-%m-%d)' AND coach_no = 10002;
"
```

**预期结果**:
- count = 0

---

### TC-SKIP-005 | 免门迎助教批量设置 | P1

**场景**: 支持批量设置多个助教为免门迎。

```bash
curl -s -X PUT http://127.0.0.1:8088/api/coaches/batch-skip-greeting \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"coach_no_list": [10001, 10003, 10005], "skip_greeting": true}' | jq .
```

**预期结果**:
- 返回成功，包含设置的助教数量
- 验证：

```bash
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT coach_no, stage_name, skip_greeting
  FROM coaches WHERE coach_no IN (10001, 10003, 10005);
"
```

- 所有指定助教 `skip_greeting = 1`

---

### TC-SKIP-006 | 免门迎列表查询 | P2

**场景**: 查询当前所有免门迎助教列表。

```bash
curl -s http://127.0.0.1:8088/api/coaches?skip_greeting=true \
  -H "Authorization: Bearer <TOKEN>" | jq '.[] | select(.skip_greeting == 1)'
```

**预期结果**:
- 返回所有 `skip_greeting = 1` 的助教信息

---

## 六、水牌页面显示序号

### TC-WATER-001 | 水牌API返回排序序号 | P0

**场景**: 查询水牌列表时，返回结果中包含门迎排序序号。

```bash
curl -s http://127.0.0.1:8088/api/coaches \
  -H "Authorization: Bearer <TOKEN>" | jq '.[0]'
```

**预期结果**:
- 返回的每个助教对象包含 `greeting_sort_order` 或 `sort_order` 字段
- 字段值为该助教当前的门迎序号

---

### TC-WATER-002 | 水牌API按排序序号排序 | P0

**场景**: 水牌列表按门迎排序序号升序排列。

```bash
# 先触发排序
curl -s -X POST http://127.0.0.1:8088/api/greeting-sort/batch/morning \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"date":"'"$(date +%Y-%m-%d)"'"}' | jq .

# 查询水牌列表
curl -s "http://127.0.0.1:8088/api/coaches" \
  -H "Authorization: Bearer <TOKEN>" | jq '.[0:5] | .[] | {stage_name, greeting_sort_order, shift}'
```

**预期结果**:
- 返回列表按 `greeting_sort_order` 升序排列
- 序号小的在前

---

### TC-WATER-003 | 水牌API - 无排序序号的处理 | P1

**场景**: 未参与排序的助教（免门迎、非当前班次、未打卡），排序序号应如何处理。

```bash
curl -s "http://127.0.0.1:8088/api/coaches" \
  -H "Authorization: Bearer <TOKEN>" | jq '.[] | {stage_name, shift, greeting_sort_order}' | head -40
```

**预期结果**:
- 未排序的助教 `greeting_sort_order` 为 `null` 或 `0`
- 或排在所有有序号助教之后

---

### TC-WATER-004 | 水牌API - 下班状态助教不显示序号 | P1

**场景**: 水牌状态为"下班"的助教不应显示门迎序号。

```bash
curl -s "http://127.0.0.1:8088/api/coaches" \
  -H "Authorization: Bearer <TOKEN>" | jq '.[] | select(.status == "下班") | {stage_name, greeting_sort_order}'
```

**预期结果**:
- 下班状态助教的 `greeting_sort_order` 为 `null` 或不显示

---

### TC-WATER-005 | 水牌API - 水牌状态变更联动 | P2

**场景**: 助教从空闲变为上桌，排序序号不应变化。

```bash
# 先获取序号
curl -s "http://127.0.0.1:8088/api/coaches/10002" \
  -H "Authorization: Bearer <TOKEN>" | jq '{stage_name, greeting_sort_order, water_board_status}'

# 修改水牌状态（假设为上桌）
# ... 通过桌台API设置

# 再次查询序号，应不变
curl -s "http://127.0.0.1:8088/api/coaches/10002" \
  -H "Authorization: Bearer <TOKEN>" | jq '{stage_name, greeting_sort_order, water_board_status}'
```

**预期结果**:
- 水牌状态变更后，`greeting_sort_order` 不变

---

## 七、边界与异常场景

### TC-EDGE-001 | 无助教时的批处理排序 | P2

**场景**: 当天没有早班/晚班助教时触发排序。

```bash
# 触发排序（假设已临时修改所有助教为免门迎或离职）
curl -s -X POST http://127.0.0.1:8088/api/greeting-sort/batch/morning \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"date":"'"$(date +%Y-%m-%d)"'"}' | jq .
```

**预期结果**:
- 返回成功（0条记录排序）
- 不报错

---

### TC-EDGE-002 | 非管理员访问门迎排序API | P1

**场景**: 无权限用户访问门迎排序管理接口。

```bash
# 使用无效token
curl -s -X POST http://127.0.0.1:8088/api/greeting-sort/batch/morning \
  -H "Authorization: Bearer invalid_token" \
  -H "Content-Type: application/json" \
  -d '{"date":"'"$(date +%Y-%m-%d)"'"}' | jq .

# 不带token
curl -s -X POST http://127.0.0.1:8088/api/greeting-sort/batch/morning \
  -H "Content-Type: application/json" \
  -d '{"date":"'"$(date +%Y-%m-%d)"'"}' | jq .
```

**预期结果**:
- 返回 401 未授权

---

### TC-EDGE-003 | 跨天切换时排序数据隔离 | P1

**场景**: 23:59触发排序，数据归属当日；00:01后触发，数据归属次日。

```bash
# 此测试需在特定时间点执行，或通过修改 date 参数模拟
curl -s -X POST http://127.0.0.1:8088/api/greeting-sort/batch/morning \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-04-21"}' | jq .

# 验证数据归属
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT date, COUNT(*) FROM greeting_sort WHERE date = '2026-04-21' GROUP BY date;
"
```

**预期结果**:
- 数据正确归属指定日期

---

### TC-EDGE-004 | 班次变更联动排序序号 | P2

**场景**: 助教从早班改为晚班后，排序序号应从早班范围移至晚班范围。

```bash
# 将早班助教改为晚班
curl -s -X PUT http://127.0.0.1:8088/api/coaches/v2/10002/shift \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"shift": "晚班"}' | jq .

# 重新触发排序
curl -s -X POST http://127.0.0.1:8088/api/greeting-sort/batch/evening \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"date":"'"$(date +%Y-%m-%d)"'"}' | jq .

# 验证序号在晚班范围
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT c.stage_name, gs.sort_order, c.shift
  FROM greeting_sort gs
  JOIN coaches c ON gs.coach_no = c.coach_no
  WHERE gs.date = '$(date +%Y-%m-%d)' AND c.coach_no = 10002;
"
```

**预期结果**:
- `sort_order` 在 51-100 范围内（晚班）

---

### TC-EDGE-005 | 24点清空后，仍在班助教的处理 | P2

**场景**: 24点清空排序后，助教仍处于"在班"状态（如乐捐中），次日打卡后应重新获得序号。

```bash
# 清空排序
curl -s -X POST http://127.0.0.1:8088/api/greeting-sort/clear \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"date":"'"$(date +%Y-%m-%d)"'"}' | jq .

# 验证助教仍在班
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT stage_name, status FROM water_boards WHERE coach_no = 10001;
"

# 次日重新触发排序
curl -s -X POST http://127.0.0.1:8088/api/greeting-sort/batch/evening \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"date":"'"$(date -d '+1 day' +%Y-%m-%d)"'"}' | jq .
```

**预期结果**:
- 仍在班的助教在新日期有排序序号

---

## 八、API接口契约验证

### TC-API-001 | 门迎排序列表API | P0

```bash
curl -s "http://127.0.0.1:8088/api/greeting-sort?date=$(date +%Y-%m-%d)" \
  -H "Authorization: Bearer <TOKEN>" | jq .
```

**预期结果**:
- 返回格式：
```json
{
  "success": true,
  "data": [
    {
      "coach_no": 10002,
      "employee_id": "2",
      "stage_name": "陆飞",
      "shift": "早班",
      "sort_order": 1,
      "water_board_status": "早班空闲"
    }
  ],
  "date": "2026-04-22"
}
```

---

### TC-API-002 | 门迎排序查询 - 按班次筛选 | P1

```bash
curl -s "http://127.0.0.1:8088/api/greeting-sort?date=$(date +%Y-%m-%d)&shift=早班" \
  -H "Authorization: Bearer <TOKEN>" | jq .
```

**预期结果**:
- 只返回早班助教的排序数据

---

### TC-API-003 | 操作日志记录 | P1

**场景**: 批处理排序、免门迎设置等操作应记录操作日志。

```bash
curl -s "http://127.0.0.1:8088/api/operation-logs?operation_type=门迎排序" \
  -H "Authorization: Bearer <TOKEN>" | jq '.[0:3]'
```

**预期结果**:
- 操作日志中包含门迎排序相关记录
- 记录包含操作人、操作时间、操作内容

---

## 九、Cron定时任务验证

### TC-CRON-001 | 14点批处理cron配置 | P0

```bash
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT * FROM cron_tasks
  WHERE cron_expr = '0 14 * * *'
    AND (task_name LIKE '%greet%' OR task_name LIKE '%sort%' OR task_name LIKE '%门迎%');
"
```

**预期结果**:
- 存在 cron 任务，cron表达式为 `0 14 * * *`
- 任务状态正常（enabled = 1）

---

### TC-CRON-002 | 18点批处理cron配置 | P0

```bash
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT * FROM cron_tasks
  WHERE cron_expr = '0 18 * * *'
    AND (task_name LIKE '%greet%' OR task_name LIKE '%sort%' OR task_name LIKE '%门迎%');
"
```

**预期结果**:
- 存在 cron 任务，cron表达式为 `0 18 * * *`
- 任务状态正常

---

### TC-CRON-003 | 24点清空cron配置 | P0

```bash
sqlite3 /TG/tgservice/db/tgservice.db "
  SELECT * FROM cron_tasks
  WHERE cron_expr = '0 0 * * *'
    AND (task_name LIKE '%clear%' OR task_name LIKE '%门迎%' OR task_name LIKE '%greet%');
"
```

**预期结果**:
- 存在 cron 任务，cron表达式为 `0 0 * * *`
- 任务状态正常

---

## 测试用例统计

| 优先级 | 数量 | 列表 |
|--------|------|------|
| P0 (阻塞) | 15 | TC-BATCH-001, TC-BATCH-002, TC-BATCH-003, TC-BATCH-006, TC-CLOCKIN-001, TC-CLOCKIN-002, TC-CLOCKIN-005, TC-MIDNIGHT-001, TC-SKIP-001, TC-SKIP-002, TC-SKIP-003, TC-SKIP-004, TC-WATER-001, TC-WATER-002, TC-API-001 |
| P1 (重要) | 14 | TC-DB-003, TC-BATCH-004, TC-BATCH-005, TC-CLOCKIN-003, TC-CLOCKIN-004, TC-CLOCKIN-006, TC-MIDNIGHT-002, TC-MIDNIGHT-003, TC-SKIP-005, TC-WATER-003, TC-WATER-004, TC-EDGE-002, TC-EDGE-003, TC-API-002 |
| P2 (次要) | 6 | TC-DB-001, TC-DB-002, TC-EDGE-001, TC-EDGE-004, TC-EDGE-005, TC-API-003 |
| Cron验证 | 3 | TC-CRON-001, TC-CRON-002, TC-CRON-003 |
| **总计** | **38** | |

---

## 备注

1. **接口路径需根据实际实现调整**：本文档中假设的 API 路径（如 `/api/greeting-sort/...`、`/api/coaches/:coach_no/skip-greeting`）需以实际开发实现为准。
2. **数据库字段名需确认**：`skip_greeting`、`greeting_sort` 表名等为假设名称，需与实际实现一致。
3. **免门迎实现方式**：可能是 `coaches.skip_greeting` 字段，也可能是独立表 `greeting_skip_list`，需按实际方案验证。
4. **序号分配策略**：1-50 和 51-100 是需求描述，实际实现可能使用不同范围，需确认。
5. **⚠️ 所有数据库操作仅在测试环境数据库 `/TG/tgservice/db/tgservice.db` 执行，严禁操作生产环境。**
