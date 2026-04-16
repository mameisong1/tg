# 乐捐报备时间选择范围 QA 测试用例

> 需求：乐捐报备开始时间的选择范围改为从当日的14点开始，到次日的1点之间。不能选过去时间，只能选当前小时或未来小时。
> 
> 验收重点：14:00-次日01:00可选，过去时间不可选，不同当前时间段的选择限制正确
>
> 测试环境：http://127.0.0.1:8088
> 
> 数据库：/TG/tgservice/db/tgservice.db

---

## 需求解析

### 时间窗口规则

| 当前时间段 | 可选时间范围 | 说明 |
|---|---|---|
| 00:00~00:59 | 00:00、01:00 | 窗口末尾，只能选0点和1点 |
| 01:00~01:59 | 01:00 | 窗口末尾，只能选1点 |
| 02:00~13:59 | 14:00~23:00 + 次日00:00、01:00 | 窗口未到，可提前预约14点以后 |
| 14:00~23:59 | 当前整点~23:00 + 次日00:00、01:00 | 窗口进行中，从当前小时开始 |

### 核心原则
- 可选范围：**14:00 ~ 次日01:00**（12小时窗口）
- 过去时间不可选，只能选当前小时或未来小时
- 2点和3点~13点**不可选**（窗口关闭时段）

### 后端 API

| 接口 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 创建乐捐报备 | POST | /api/lejuan-records | 提交乐捐预约 |
| 我的乐捐记录 | GET | /api/lejuan-records/my | 查询近2天记录 |
| 乐捐一览 | GET | /api/lejuan-records/list | 店长/助教管理 |
| 乐捐归来 | POST | /api/lejuan-records/:id/return | 结束乐捐 |
| 修改付款截图 | PUT | /api/lejuan-records/:id/proof | 上传截图 |
| 删除预约 | DELETE | /api/lejuan-records/:id | 仅pending状态可删 |

### 测试用助教数据

| coach_no | employee_id | stage_name |
|---|---|---|
| 10125 | (空) | 测试小A |
| 10126 | (空) | 测试小B |
| 10001 | 1 | 歪歪 |

> 如测试需要 employee_id，可通过 `UPDATE coaches SET employee_id='10125' WHERE coach_no='10125'` 设置。

### 认证 Token

测试需要先获取 admin token：

```bash
# 登录获取 token（使用后台管理凭证）
curl -s -X POST http://127.0.0.1:8088/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' | python3 -m json.tool
```

---

## 测试用例

### 一、前端时间选项逻辑验证（hourOptions）

> 前端代码位于 `tgservice-uniapp/src/pages/internal/lejuan.vue`，hourOptions 为 computed 属性。
> 由于只用 API/curl 测试，此处通过**后端接口间接验证**前端传递的时间参数是否合法。

---

### 二、后端时间窗口校验测试

> 后端代码位于 `tgservice/backend/routes/lejuan-records.js`，`validateLejuanTime()` 函数负责校验。

---

#### TC-001 [P0] 创建乐捐报备 — 成功（当前小时，14:00~23:59时段）

**前置条件**：当前时间为 14:00~23:59

**测试目的**：验证当前小时提交乐捐报备，立即生效（immediate=true）

**测试步骤**：
```bash
# 1. 获取当前北京时间的整点（如 15:00:00）
CURRENT_HOUR=$(TZ='Asia/Shanghai' date +%H)
CURRENT_DATE=$(TZ='Asia/Shanghai' date +%Y-%m-%d)
SCHEDULED_TIME="${CURRENT_DATE} ${CURRENT_HOUR}:00:00"
echo "scheduled_start_time: $SCHEDULED_TIME"

# 2. 提交乐捐报备
TOKEN="<admin_token>"
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"${SCHEDULED_TIME}\",
    \"remark\": \"QA测试-当前小时提交\"
  }" | python3 -m json.tool
```

**预期结果**：
- 返回 200
- `success: true`
- `data.immediate: true`（当前小时立即激活）
- `data.lejuan_status: "active"`

---

#### TC-002 [P0] 创建乐捐报备 — 成功（预约未来小时，14:00~23:59时段）

**前置条件**：当前时间为 14:00~23:00

**测试目的**：验证预约未来小时，状态为 pending，不立即生效

**测试步骤**：
```bash
# 1. 计算下一个整点
NEXT_HOUR=$(( $(TZ='Asia/Shanghai' date +%-H) + 1 ))
if [ $NEXT_HOUR -gt 23 ]; then
  NEXT_HOUR=0
  NEXT_DATE=$(TZ='Asia/Shanghai' date -d 'tomorrow' +%Y-%m-%d)
else
  NEXT_DATE=$(TZ='Asia/Shanghai' date +%Y-%m-%d)
fi
NEXT_HOUR_PADDED=$(printf "%02d" $NEXT_HOUR)
SCHEDULED_TIME="${NEXT_DATE} ${NEXT_HOUR_PADDED}:00:00"
echo "scheduled_start_time: $SCHEDULED_TIME"

# 2. 提交乐捐报备
TOKEN="<admin_token>"
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"${SCHEDULED_TIME}\",
    \"remark\": \"QA测试-预约未来小时\"
  }" | python3 -m json.tool
```

**预期结果**：
- 返回 200
- `success: true`
- `data.immediate: false`
- `data.lejuan_status: "pending"`

---

#### TC-003 [P0] 创建乐捐报备 — 成功（次日00:00，23:00~23:59时段提交）

**前置条件**：当前时间为 23:00~23:59

**测试目的**：验证可以预约次日00:00的乐捐

**测试步骤**：
```bash
# 1. 计算次日日期
NEXT_DATE=$(TZ='Asia/Shanghai' date -d 'tomorrow' +%Y-%m-%d)
SCHEDULED_TIME="${NEXT_DATE} 00:00:00"
echo "scheduled_start_time: $SCHEDULED_TIME"

# 2. 提交乐捐报备
TOKEN="<admin_token>"
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"${SCHEDULED_TIME}\",
    \"remark\": \"QA测试-次日00:00\"
  }" | python3 -m json.tool
```

**预期结果**：
- 返回 200
- `success: true`
- `data.lejuan_status: "pending"`

---

#### TC-004 [P0] 创建乐捐报备 — 成功（次日01:00，23:00~23:59时段提交）

**前置条件**：当前时间为 23:00~23:59

**测试目的**：验证可以预约次日01:00的乐捐（窗口最晚时间）

**测试步骤**：
```bash
NEXT_DATE=$(TZ='Asia/Shanghai' date -d 'tomorrow' +%Y-%m-%d)
SCHEDULED_TIME="${NEXT_DATE} 01:00:00"

TOKEN="<admin_token>"
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"${SCHEDULED_TIME}\",
    \"remark\": \"QA测试-次日01:00\"
  }" | python3 -m json.tool
```

**预期结果**：
- 返回 200
- `success: true`
- `data.lejuan_status: "pending"`

---

#### TC-005 [P1] 创建乐捐报备 — 成功（次日00:00，00:00~00:59时段提交）

**前置条件**：当前时间为 00:00~00:59

**测试目的**：验证0点时可以选择00:00（当前小时）

**测试步骤**：
```bash
CURRENT_DATE=$(TZ='Asia/Shanghai' date +%Y-%m-%d)
SCHEDULED_TIME="${CURRENT_DATE} 00:00:00"

TOKEN="<admin_token>"
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"${SCHEDULED_TIME}\",
    \"remark\": \"QA测试-00:00时段选00:00\"
  }" | python3 -m json.tool
```

**预期结果**：
- 返回 200
- `success: true`
- `data.immediate: true`（当前小时立即生效）

---

#### TC-006 [P1] 创建乐捐报备 — 成功（次日01:00，00:00~00:59时段提交）

**前置条件**：当前时间为 00:00~00:59

**测试目的**：验证0点时可以选择01:00（未来小时）

**测试步骤**：
```bash
CURRENT_DATE=$(TZ='Asia/Shanghai' date +%Y-%m-%d)
SCHEDULED_TIME="${CURRENT_DATE} 01:00:00"

TOKEN="<admin_token>"
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"${SCHEDULED_TIME}\",
    \"remark\": \"QA测试-00:00时段选01:00\"
  }" | python3 -m json.tool
```

**预期结果**：
- 返回 200
- `success: true`
- `data.lejuan_status: "pending"`

---

#### TC-007 [P0] 创建乐捐报备 — 成功（01:00，只能选01:00）

**前置条件**：当前时间为 01:00~01:59

**测试目的**：验证1点时可以选择01:00（当前小时）

**测试步骤**：
```bash
CURRENT_DATE=$(TZ='Asia/Shanghai' date +%Y-%m-%d)
SCHEDULED_TIME="${CURRENT_DATE} 01:00:00"

TOKEN="<admin_token>"
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"${SCHEDULED_TIME}\",
    \"remark\": \"QA测试-01:00时段选01:00\"
  }" | python3 -m json.tool
```

**预期结果**：
- 返回 200
- `success: true`
- `data.immediate: true`

---

#### TC-008 [P1] 创建乐捐报备 — 成功（提前预约，02:00~13:59时段）

**前置条件**：当前时间为 02:00~13:59

**测试目的**：验证在2~13点时段，可以提前预约当天14:00的乐捐

**测试步骤**：
```bash
CURRENT_DATE=$(TZ='Asia/Shanghai' date +%Y-%m-%d)
SCHEDULED_TIME="${CURRENT_DATE} 14:00:00"

TOKEN="<admin_token>"
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"${SCHEDULED_TIME}\",
    \"remark\": \"QA测试-提前预约14:00\"
  }" | python3 -m json.tool
```

**预期结果**：
- 返回 200
- `success: true`
- `data.lejuan_status: "pending"`

---

#### TC-009 [P0] 创建乐捐报备 — 失败（选择过去时间）

**测试目的**：验证不能选择过去的小时

**测试步骤**：
```bash
# 计算过去的小时（当前小时 - 2）
CURRENT_HOUR=$(TZ='Asia/Shanghai' date +%-H)
PAST_HOUR=$(( CURRENT_HOUR - 2 ))
if [ $PAST_HOUR -lt 0 ]; then
  PAST_HOUR=$(( PAST_HOUR + 24 ))
fi
PAST_HOUR_PADDED=$(printf "%02d" $PAST_HOUR)
CURRENT_DATE=$(TZ='Asia/Shanghai' date +%Y-%m-%d)
SCHEDULED_TIME="${CURRENT_DATE} ${PAST_HOUR_PADDED}:00:00"
echo "scheduled_start_time: $SCHEDULED_TIME"

TOKEN="<admin_token>"
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"${SCHEDULED_TIME}\",
    \"remark\": \"QA测试-过去时间应该被拒绝\"
  }" | python3 -m json.tool
```

**预期结果**：
- 返回 400
- `error` 包含 "早于" 或 "有效时段" 或 "不能早于"

---

#### TC-010 [P0] 创建乐捐报备 — 失败（选择窗口关闭时段：2点~13点）

**测试目的**：验证不能选择 02:00~13:00 的乐捐（窗口关闭时段）

**测试步骤**：
```bash
# 测试 02:00
CURRENT_DATE=$(TZ='Asia/Shanghai' date +%Y-%m-%d)
NEXT_DATE=$(TZ='Asia/Shanghai' date -d 'tomorrow' +%Y-%m-%d)

TOKEN="<admin_token>"

# 2a. 测试 02:00（今天）
curl -s -o /dev/null -w "HTTP %{http_code}: " -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"${NEXT_DATE} 02:00:00\",
    \"remark\": \"QA测试-02:00应被拒绝\"
  }"

# 2b. 测试 10:00（今天）
curl -s -o /dev/null -w "HTTP %{http_code}: " -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"${NEXT_DATE} 10:00:00\",
    \"remark\": \"QA测试-10:00应被拒绝\"
  }"

# 2c. 测试 13:00（今天）
curl -s -o /dev/null -w "HTTP %{http_code}: " -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"${NEXT_DATE} 13:00:00\",
    \"remark\": \"QA测试-13:00应被拒绝\"
  }"
```

**预期结果**：
- 每个请求均返回 400
- `error` 包含 "有效时段" 或 "14:00"

---

#### TC-011 [P0] 创建乐捐报备 — 失败（非整点时间）

**测试目的**：验证必须为整点（分钟=00，秒=00）

**测试步骤**：
```bash
CURRENT_DATE=$(TZ='Asia/Shanghai' date +%Y-%m-%d)
CURRENT_HOUR=$(TZ='Asia/Shanghai' date +%H)

TOKEN="<admin_token>"

# 3a. 分钟不为00
curl -s -o /dev/null -w "HTTP %{http_code}: " -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"${CURRENT_DATE} ${CURRENT_HOUR}:30:00\",
    \"remark\": \"QA测试-非整点\"
  }"

# 3b. 秒不为00
curl -s -o /dev/null -w "HTTP %{http_code}: " -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"${CURRENT_DATE} ${CURRENT_HOUR}:00:30\",
    \"remark\": \"QA测试-秒不为00\"
  }"
```

**预期结果**：
- 返回 400
- `error` 包含 "整点" 或 "分钟"

---

#### TC-012 [P1] 创建乐捐报备 — 失败（日期与小时不匹配：当天选次日凌晨）

**测试目的**：验证14~23点时段不能用"今天日期 + 00:00/01:00"

**测试步骤**：
```bash
# 当前时间14~23点，用今天的日期 + 00:00（应该用明天的日期）
CURRENT_DATE=$(TZ='Asia/Shanghai' date +%Y-%m-%d)

TOKEN="<admin_token>"
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"${CURRENT_DATE} 00:00:00\",
    \"remark\": \"QA测试-当天日期+00:00应被拒绝\"
  }" | python3 -m json.tool
```

**预期结果**：
- 返回 400
- `error` 包含 "凌晨" 或 "次日"

---

#### TC-013 [P1] 创建乐捐报备 — 失败（日期与小时不匹配：凌晨选当天14点）

**测试目的**：验证0~1点时段不能用"今天日期 + 14:00"

**测试步骤**：
```bash
CURRENT_DATE=$(TZ='Asia/Shanghai' date +%Y-%m-%d)

TOKEN="<admin_token>"
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"${CURRENT_DATE} 14:00:00\",
    \"remark\": \"QA测试-凌晨用当天日期+14:00应被拒绝\"
  }" | python3 -m json.tool
```

**预期结果**：
- 返回 400
- `error` 包含 "当天" 或 "凌晨"

---

#### TC-014 [P0] 创建乐捐报备 — 失败（缺少必填字段）

**测试目的**：验证缺少 employee_id 或 scheduled_start_time 时报错

**测试步骤**：
```bash
TOKEN="<admin_token>"

# 4a. 缺少 employee_id
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "scheduled_start_time": "2026-04-17 15:00:00",
    "remark": "测试"
  }' | python3 -m json.tool

# 4b. 缺少 scheduled_start_time
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "employee_id": "1",
    "remark": "测试"
  }' | python3 -m json.tool
```

**预期结果**：
- 返回 400
- `error` 包含 "必填"

---

#### TC-015 [P1] 创建乐捐报备 — 失败（助教不存在）

**测试目的**：验证不存在的 employee_id 报错

**测试步骤**：
```bash
TOKEN="<admin_token>"
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"999999\",
    \"scheduled_start_time\": \"$(TZ='Asia/Shanghai' date +%Y-%m-%d) $(TZ='Asia/Shanghai' date +%H):00:00\",
    \"remark\": \"QA测试-不存在的助教\"
  }" | python3 -m json.tool
```

**预期结果**：
- 返回 404
- `error` 包含 "找不到"

---

#### TC-016 [P1] 创建乐捐报备 — 失败（已有 pending/active 记录）

**测试目的**：验证同一助教已有 pending 或 active 记录时不能重复提交

**测试步骤**：
```bash
# 1. 先插入一条 pending 记录
CURRENT_DATE=$(TZ='Asia/Shanghai' date +%Y-%m-%d)
NEXT_DATE=$(TZ='Asia/Shanghai' date -d 'tomorrow' +%Y-%m-%d)

sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO lejuan_records (coach_no, employee_id, stage_name, scheduled_start_time, lejuan_status, created_at, updated_at) VALUES ('10125', '10125', '测试小A', '${NEXT_DATE} 14:00:00', 'pending', datetime('now'), datetime('now'));"

# 2. 尝试再次提交
NEXT_HOUR=$(( $(TZ='Asia/Shanghai' date +%-H) + 2 ))
if [ $NEXT_HOUR -gt 23 ]; then NEXT_HOUR=23; fi
NEXT_HOUR_PADDED=$(printf "%02d" $NEXT_HOUR)
SCHEDULED_TIME="${CURRENT_DATE} ${NEXT_HOUR_PADDED}:00:00"

TOKEN="<admin_token>"
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"10125\",
    \"scheduled_start_time\": \"${SCHEDULED_TIME}\",
    \"remark\": \"QA测试-重复提交应被拒绝\"
  }" | python3 -m json.tool

# 3. 清理测试数据
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM lejuan_records WHERE employee_id='10125' AND stage_name='测试小A';"
```

**预期结果**：
- 返回 400
- `error` 包含 "待出发" 或 "乐捐中"

---

#### TC-017 [P1] 前端时间选项验证（代码审查）

**测试目的**：验证前端 `hourOptions` computed 属性符合需求

**测试方法**：代码审查 `lejuan.vue` 中 `hourOptions` 逻辑

**当前代码**（lejuan.vue 约第110-126行）：
```javascript
const hourOptions = computed(() => {
  const h = getCurrentHour()

  // 00:00: 窗口末尾，可选 00 和 01
  if (h === 0) {
    return [0, 1]
  }

  // 01:00: 窗口末尾，只能选 01
  if (h === 1) {
    return [1]
  }

  // 02:00 ~ 13:59: 窗口未到/已过，显示全部12个选项（允许提前预约）
  if (h >= 2 && h < 14) {
    return [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1]
  }

  // 14:00 ~ 23:59: 从当前小时到次日 01:00
  const opts = []
  for (let i = h; i <= 23; i++) opts.push(i)
  opts.push(0, 1) // 次日00:00, 01:00
  return opts
})
```

**对照需求逐项验证**：

| 需求 | 代码实现 | 验证结果 |
|---|---|---|
| 0点只能选0和1 | `if (h === 0) return [0, 1]` | ✅ 符合 |
| 1点只能选1 | `if (h === 1) return [1]` | ✅ 符合 |
| 2~13点可提前预约14点以后 | `if (h >= 2 && h < 14) return [14..23, 0, 1]` | ✅ 符合 |
| 14点~23点从当前小时到次日01:00 | `for (let i = h; i <= 23; i++) opts.push(i); opts.push(0, 1)` | ✅ 符合 |
| 不能选过去时间（2~13点） | 前端允许选全部12个选项，后端通过 `validateLejuanTime` 校验日期匹配 | ⚠️ 需确认后端校验是否覆盖 |

---

#### TC-018 [P0] 后端 validateLejuanTime 窗口校验 — 2点应被拒绝

**测试目的**：验证后端不接收 02:00 的乐捐报备（需求规定窗口为14:00~次日01:00）

**测试步骤**：
```bash
NEXT_DATE=$(TZ='Asia/Shanghai' date -d 'tomorrow' +%Y-%m-%d)

TOKEN="<admin_token>"
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"${NEXT_DATE} 02:00:00\",
    \"remark\": \"QA测试-02:00应被拒绝\"
  }" | python3 -m json.tool
```

**预期结果**：
- 返回 400
- `error` 包含 "有效时段"

> ⚠️ **注意**：当前后端代码 `validateLejuanTime` 中 `schedHour >= 3 && schedHour <= 13` 才拒绝，
> 意味着 02:00 目前**不会被拒绝**。此为 **BUG**，需要将条件改为 `schedHour >= 2 && schedHour <= 13`。

---

#### TC-019 [P1] 我的乐捐记录查询

**测试目的**：验证可以查询近2天的乐捐记录

**测试步骤**：
```bash
TOKEN="<admin_token>"
curl -s "http://127.0.0.1:8088/api/lejuan-records/my?employee_id=1" \
  -H "Authorization: Bearer ${TOKEN}" | python3 -m json.tool
```

**预期结果**：
- 返回 200
- `success: true`
- `data` 为数组

---

#### TC-020 [P2] 乐捐一览查询

**测试目的**：验证可以查询乐捐一览（店长权限）

**测试步骤**：
```bash
TOKEN="<admin_token>"
curl -s "http://127.0.0.1:8088/api/lejuan-records/list?status=all&days=3" \
  -H "Authorization: Bearer ${TOKEN}" | python3 -m json.tool
```

**预期结果**：
- 返回 200
- `success: true`
- `data` 为数组

---

## 测试用例汇总表

| 编号 | 优先级 | 测试场景 | 预期HTTP状态 | 关键验证点 |
|---|---|---|---|---|
| TC-001 | P0 | 当前小时提交（14~23点） | 200 | immediate=true, 立即激活 |
| TC-002 | P0 | 预约未来小时（14~23点） | 200 | immediate=false, pending |
| TC-003 | P0 | 预约次日00:00 | 200 | 日期匹配次日 |
| TC-004 | P0 | 预约次日01:00 | 200 | 窗口最晚时间 |
| TC-005 | P1 | 00:00时段选00:00 | 200 | immediate=true |
| TC-006 | P1 | 00:00时段选01:00 | 200 | pending |
| TC-007 | P0 | 01:00时段选01:00 | 200 | immediate=true |
| TC-008 | P1 | 2~13点提前预约14:00 | 200 | pending |
| TC-009 | P0 | 选择过去时间 | 400 | 拒绝 |
| TC-010 | P0 | 选择窗口关闭时段(2~13点) | 400 | 拒绝 |
| TC-011 | P0 | 非整点时间 | 400 | 拒绝 |
| TC-012 | P1 | 日期与小时不匹配（当天选凌晨） | 400 | 拒绝 |
| TC-013 | P1 | 日期与小时不匹配（凌晨选当天14点） | 400 | 拒绝 |
| TC-014 | P0 | 缺少必填字段 | 400 | 拒绝 |
| TC-015 | P1 | 助教不存在 | 404 | 拒绝 |
| TC-016 | P1 | 已有pending/active记录 | 400 | 拒绝重复 |
| TC-017 | P1 | 前端hourOptions代码审查 | N/A | 逻辑符合需求 |
| TC-018 | P0 | 后端02:00校验 | 400 | **发现BUG** |
| TC-019 | P1 | 我的乐捐记录查询 | 200 | 正常返回 |
| TC-020 | P2 | 乐捐一览查询 | 200 | 正常返回 |

---

## 已知问题

### BUG-001 [P0] 后端窗口校验未排除02:00

**位置**：`lejuan-records.js` 第 32 行

**当前代码**：
```javascript
if (schedHour >= 3 && schedHour <= 13) {
    return { valid: false, error: '乐捐报备时间为每日14:00-次日02:00，请选择有效时段' };
}
```

**问题**：`schedHour >= 3` 应为 `schedHour >= 2`，否则 02:00 不会被拒绝。
同时错误提示信息 "次日02:00" 也应改为 "次日01:00"。

**修复建议**：
```javascript
if (schedHour >= 2 && schedHour <= 13) {
    return { valid: false, error: '乐捐报备时间为每日14:00-次日01:00，请选择有效时段' };
}
```

---

## 测试执行说明

1. **获取 Token**：所有测试需先执行登录接口获取 admin token
2. **测试顺序**：建议按优先级 P0 → P1 → P2 执行
3. **数据清理**：每个用例执行后清理插入的测试数据，避免影响后续用例
4. **时间依赖用例**：TC-001~TC-004、TC-005~TC-007、TC-008 依赖当前时间段，需在实际对应时段执行
