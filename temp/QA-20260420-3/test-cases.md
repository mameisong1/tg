# QA 测试用例：计时器系统重构

**需求**：重构计时器系统，使 timer-manager 成为唯一管理中心。启动时恢复所有定时器，active-timers API 显示完整列表。

**测试环境**：`http://127.0.0.1:8088`（开发环境 PM2）

**测试策略**：curl + sqlite3，不用浏览器

**前置条件**：PM2 已启动开发环境后端 `tgservice-dev`，数据库 `/TG/tgservice/db/tgservice.db`

---

## 0. 前置：获取认证 Token

所有受保护 API 需要 Bearer Token。

```bash
# 登录后台管理系统，获取 JWT Token
TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' | jq -r '.token')

echo "Token: ${TOKEN:0:20}..."
```

**期望**：返回 `success: true`，包含 `token` 字段。

**验证 Token 有效**：
```bash
curl -s http://127.0.0.1:8088/api/system-report/overview \
  -H "Authorization: Bearer $TOKEN" | jq '.success'
```
应返回 `true`。

---

## 测试场景 1：启动恢复 —— 乐捐定时器

**目标**：创建一条 pending 乐捐记录，重启 PM2，验证定时器被恢复并出现在 active-timers 列表中。

### TC-1.1 创建乐捐预约记录

```bash
# 确认测试助教存在（用歪歪，employee_id=1, phone=16675852676）
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT coach_no, employee_id, stage_name, phone, shift FROM coaches WHERE employee_id = '1';"
# 期望输出: 10001|1|歪歪|16675852676|晚班

# 确认该助教当前水牌状态不是乐捐
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT coach_no, stage_name, status FROM water_boards WHERE coach_no = '10001';"
# 期望: 10001|歪歪|下班 (或 早班空闲/晚班空闲，不能是乐捐/active)

# 清理该助教已有的 pending/active 乐捐记录（避免冲突）
sqlite3 /TG/tgservice/db/tgservice.db \
  "DELETE FROM lejuan_records WHERE coach_no = '10001' AND lejuan_status IN ('pending', 'active');"

# 创建乐捐预约（预约到未来整点，例如 22:00）
# 注意：根据 validateLejuanTime，乐捐报备时间窗口为 14:00~次日01:00
# 需要根据当前时间选择合适的预约时间
LEJUAN_TIME=$(date -d '+2 hours' '+%Y-%m-%d')
CURRENT_HOUR=$(date +%H)
if [ "$CURRENT_HOUR" -ge 14 ] && [ "$CURRENT_HOUR" -le 22 ]; then
  LEJUAN_TIME="${LEJUAN_TIME} 23:00:00"
elif [ "$CURRENT_HOUR" -ge 23 ] || [ "$CURRENT_HOUR" -le 0 ]; then
  LEJUAN_TIME="${LEJUAN_TIME} 00:00:00"
else
  # 2~13 点属于未到窗口，可以预约当天14~23 + 次日0~1
  LEJUAN_TIME="${LEJUAN_TIME} 14:00:00"
fi

LEJUAN_RESULT=$(curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"employee_id\":\"1\",\"scheduled_start_time\":\"${LEJUAN_TIME}\",\"remark\":\"QA测试-启动恢复\"}")

echo "$LEJUAN_RESULT" | jq .
```

**期望输出**：
```json
{
  "success": true,
  "data": {
    "id": <新记录ID>,
    "scheduled_start_time": "<预约时间>",
    "lejuan_status": "pending",
    "immediate": false
  }
}
```

**验证数据库**：
```bash
# 查询刚创建的记录
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT id, coach_no, stage_name, lejuan_status, scheduled, scheduled_start_time FROM lejuan_records WHERE lejuan_status = 'pending' AND coach_no = '10001' ORDER BY id DESC LIMIT 1;"
# 期望: <id>|10001|歪歪|pending|1|<时间>
# scheduled 应为 1（已调度）
```

记录 `LEJUAN_RECORD_ID` 用于后续验证。

### TC-1.2 重启 PM2 并验证恢复

```bash
# 重启 PM2
pm2 restart tgservice-dev
sleep 5

# 查看日志确认恢复
pm2 logs tgservice-dev --lines 30 --nostream 2>&1 | grep -i "恢复\|recover\|乐捐定时器"
```

**期望日志输出**（至少一条）：
- `[TimerManager] 恢复乐捐定时器: 找到 N 条待处理记录` （N >= 1）
- `[TimerManager] lejuan_<id> 已调度，延迟 XXX秒 后执行`

### TC-1.3 验证 active-timers API 显示乐捐定时器

```bash
ACTIVE_TIMERS=$(curl -s http://127.0.0.1:8088/api/system-report/active-timers \
  -H "Authorization: Bearer $TOKEN")

echo "$ACTIVE_TIMERS" | jq .
```

**期望输出**：
```json
{
  "success": true,
  "data": [
    {
      "timerId": "active",
      "type": "lejuan",
      "recordId": "<TC-1.1 创建的记录ID>",
      "execTime": "<预约时间>",
      "employee_id": "1",
      "stage_name": "歪歪",
      "coach_no": 10001,
      "application_type": null,
      "remainingSeconds": <正数>
    }
  ],
  "total": <>=1>
}
```

**验证点**：
- ✅ `total >= 1`
- ✅ 存在 `type: "lejuan"` 的定时器
- ✅ `recordId` 等于 TC-1.1 创建的记录 ID
- ✅ `employee_id` 为 "1"
- ✅ `stage_name` 为 "歪歪"
- ✅ `remainingSeconds` 为正数

---

## 测试场景 2：启动恢复 —— 申请定时器

**目标**：创建休息/请假申请并审批通过，重启 PM2，验证定时器被恢复。

### TC-2.1 创建休息申请记录

```bash
# 用歪歪 (employee_id=1, phone=16675852676) 创建休息申请
# extra_data 包含 rest_date
TOMORROW=$(date -d '+1 day' '+%Y-%m-%d')

APP_RESULT=$(curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"applicant_phone\": \"16675852676\",
    \"application_type\": \"休息申请\",
    \"remark\": \"QA测试-申请启动恢复\",
    \"extra_data\": {\"rest_date\": \"${TOMORROW}\"}
  }")

echo "$APP_RESULT" | jq .
```

**期望输出**：
```json
{
  "success": true,
  "data": {
    "id": <新申请ID>
  }
}
```

记录 `APP_RECORD_ID`。

### TC-2.2 审批通过申请

```bash
APPROVE_RESULT=$(curl -s -X PUT http://127.0.0.1:8088/api/applications/${APP_RECORD_ID}/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"status\": 1, \"approver_phone\": \"tgadmin\"}")

echo "$APPROVE_RESULT" | jq .
```

**期望输出**：
```json
{
  "success": true,
  "data": {
    "id": <申请ID>,
    "status": 1,
    "approver_phone": "tgadmin",
    "approve_time": "<时间>"
  }
}
```

### TC-2.3 验证定时器已注册

```bash
# 验证数据库 extra_data
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT id, status, extra_data FROM applications WHERE id = ${APP_RECORD_ID};"
# 期望: extra_data 包含 "timer_set":true 和 "exec_time":"<明天> 12:00:00"

# 查看 active-timers（重启前）
BEFORE_RESTART=$(curl -s http://127.0.0.1:8088/api/system-report/active-timers \
  -H "Authorization: Bearer $TOKEN")

echo "重启前 active-timers:"
echo "$BEFORE_RESTART" | jq '.data[] | select(.type == "application")'
```

**期望**：存在 `type: "application"` 且 `recordId` 为 `APP_RECORD_ID` 的定时器。

### TC-2.4 重启 PM2 并验证申请定时器恢复

```bash
pm2 restart tgservice-dev
sleep 5

# 查看恢复日志
pm2 logs tgservice-dev --lines 30 --nostream 2>&1 | grep -i "恢复\|recover\|申请定时器"
```

**期望日志**：
- `[TimerManager] 恢复申请定时器: 找到 N 条 timer_set=true 记录` （N >= 1）

### TC-2.5 验证 active-timers 显示申请定时器

```bash
AFTER_RESTART=$(curl -s http://127.0.0.1:8088/api/system-report/active-timers \
  -H "Authorization: Bearer $TOKEN")

echo "$AFTER_RESTART" | jq '.data[] | select(.type == "application")'
```

**期望输出**：
```json
{
  "timerId": "active",
  "type": "application",
  "recordId": "<APP_RECORD_ID>",
  "execTime": "<明天> 12:00:00",
  "employee_id": "1",
  "stage_name": "歪歪",
  "coach_no": 10001,
  "application_type": "休息申请",
  "remainingSeconds": <正数>
}
```

**验证点**：
- ✅ `type` 为 `"application"`
- ✅ `recordId` 等于 `APP_RECORD_ID`
- ✅ `employee_id` 为 "1"
- ✅ `stage_name` 为 "歪歪"
- ✅ `application_type` 为 "休息申请"

---

## 测试场景 3：正常流程创建定时器

**目标**：在系统正常运行时创建定时器（不重启），验证立即出现在 active-timers 列表中。

### TC-3.1 创建乐捐记录并验证立即出现在列表

```bash
# 先确认助教 陆飞 (employee_id=2, phone=18775703862) 没有 pending 记录
sqlite3 /TG/tgservice/db/tgservice.db \
  "DELETE FROM lejuan_records WHERE coach_no = '10002' AND lejuan_status IN ('pending', 'active');"

# 创建乐捐预约（23:00）
LEJUAN_TIME2="23:00:00"
TODAY=$(date '+%Y-%m-%d')
LEJUAN_FULL="${TODAY} ${LEJUAN_TIME2}"

# 如果当前小时 >= 23，则用次日
CURRENT_HOUR=$(date +%H)
if [ "$CURRENT_HOUR" -ge 23 ]; then
  LEJUAN_FULL=$(date -d '+1 day' '+%Y-%m-%d') " 23:00:00"
fi

LEJUAN_RESULT2=$(curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"employee_id\":\"2\",\"scheduled_start_time\":\"${LEJUAN_FULL}\",\"remark\":\"QA测试-正常创建\"}")

echo "$LEJUAN_RESULT2" | jq .
```

**期望**：`success: true`，`lejuan_status: "pending"`，`immediate: false`

### TC-3.2 验证立即出现在 active-timers

```bash
TIMERS_NOW=$(curl -s http://127.0.0.1:8088/api/system-report/active-timers \
  -H "Authorization: Bearer $TOKEN")

echo "$TIMERS_NOW" | jq '.data[] | select(.stage_name == "陆飞")'
```

**期望输出**：
```json
{
  "timerId": "active",
  "type": "lejuan",
  "recordId": "<新记录ID>",
  "execTime": "<时间>",
  "employee_id": "2",
  "stage_name": "陆飞",
  "coach_no": 10002,
  "application_type": null,
  "remainingSeconds": <正数>
}
```

**验证点**：
- ✅ 无需重启即出现在列表中
- ✅ `employee_id` 为 "2"
- ✅ `stage_name` 为 "陆飞"

### TC-3.3 创建请假申请并验证

```bash
# 用六六 (employee_id=3, phone=19814455887) 创建请假申请
TOMORROW2=$(date -d '+2 day' '+%Y-%m-%d')

APP_RESULT2=$(curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"applicant_phone\": \"19814455887\",
    \"application_type\": \"请假申请\",
    \"remark\": \"QA测试-正常创建请假\",
    \"extra_data\": {\"leave_date\": \"${TOMORROW2}\"}
  }")

APP_ID2=$(echo "$APP_RESULT2" | jq -r '.data.id')
echo "请假申请ID: $APP_ID2"

# 审批通过
curl -s -X PUT http://127.0.0.1:8088/api/applications/${APP_ID2}/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"status\": 1}" | jq .

# 验证出现在列表
TIMERS_NOW2=$(curl -s http://127.0.0.1:8088/api/system-report/active-timers \
  -H "Authorization: Bearer $TOKEN")

echo "$TIMERS_NOW2" | jq '.data[] | select(.stage_name == "六六")'
```

**期望**：出现 `type: "application"`, `application_type: "请假申请"`, `stage_name: "六六"` 的定时器。

---

## 测试场景 4：取消定时器

**目标**：取消一个定时器，验证其从 active-timers 列表中移除。

### TC-4.1 取消乐捐定时器

```bash
# 获取 TC-3.1 创建的乐捐记录ID
LEJUAN_ID=$(sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT id FROM lejuan_records WHERE coach_no = '10002' AND lejuan_status = 'pending' ORDER BY id DESC LIMIT 1;")

echo "乐捐记录ID: $LEJUAN_ID"

# 先确认在列表中
BEFORE_CANCEL=$(curl -s http://127.0.0.1:8088/api/system-report/active-timers \
  -H "Authorization: Bearer $TOKEN")

echo "取消前 - 陆飞的定时器:"
echo "$BEFORE_CANCEL" | jq ".data[] | select(.recordId == ${LEJUAN_ID})"

# 取消乐捐记录（PUT /api/lejuan-records/:id/proof 或其他方式取消）
# 注意：乐捐没有直接的取消 API，需要通过将状态改为 cancelled 或其他方式
# 查看实际代码中的取消方式

# 方案A：通过乐捐记录返回接口取消
# 方案B：直接通过 timer-manager 的 cancelTimer 方法

# 实际上，乐捐取消需要将 lejuan_status 改为 'cancelled' 或 'returned'
# 检查是否有直接取消 API
curl -s -X PUT http://127.0.0.1:8088/api/lejuan-records/${LEJUAN_ID}/proof \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"proof_image_url":"test_cancel"}' | jq .
```

**注意**：乐捐记录的取消可能没有直接的 API。根据代码分析，乐捐有 `/api/lejuan-records/:id/return` 接口用于返回。如果测试需要取消定时器，可以直接修改数据库状态并验证：

```bash
# 模拟取消：将乐捐状态改为 cancelled（模拟助教取消预约）
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE lejuan_records SET lejuan_status = 'cancelled' WHERE id = ${LEJUAN_ID} AND lejuan_status = 'pending';"

# 等待系统轮询处理或调用取消逻辑
# 验证定时器已从列表中移除
sleep 2
AFTER_CANCEL=$(curl -s http://127.0.0.1:8088/api/system-report/active-timers \
  -H "Authorization: Bearer $TOKEN")

echo "取消后 - 检查列表中是否还有该记录:"
echo "$AFTER_CANCEL" | jq ".data[] | select(.recordId == ${LEJUAN_ID})"
```

**期望**：该记录不再出现在 active-timers 列表中（或 `total` 减少）。

### TC-4.2 取消申请定时器

```bash
# 获取 TC-3.3 创建的请假申请ID
APP_ID3=$(sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT id FROM applications WHERE applicant_phone = '19814455887' AND status = 1 AND extra_data LIKE '%timer_set%' ORDER BY id DESC LIMIT 1;")

echo "申请记录ID: $APP_ID3"

# 先确认在列表中
BEFORE_CANCEL_APP=$(curl -s http://127.0.0.1:8088/api/system-report/active-timers \
  -H "Authorization: Bearer $TOKEN")

echo "取消前 - 六六的定时器:"
echo "$BEFORE_CANCEL_APP" | jq ".data[] | select(.recordId == ${APP_ID3})"

# 通过 API 取消申请（将状态改为 2 = 拒绝/无效）
# 或者修改 extra_data 移除 timer_set 标记
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE applications SET status = 2 WHERE id = ${APP_ID3} AND status = 1;"

# 等待轮询或系统处理
sleep 2

AFTER_CANCEL_APP=$(curl -s http://127.0.0.1:8088/api/system-report/active-timers \
  -H "Authorization: Bearer $TOKEN")

echo "取消后 - 检查列表:"
echo "$AFTER_CANCEL_APP" | jq ".data[] | select(.recordId == ${APP_ID3})"
```

**期望**：该记录不再出现在 active-timers 列表中。

---

## 测试场景 5：执行后移除

**目标**：验证定时器执行后从 active-timers 列表中自动消失。

### TC-5.1 创建近时乐捐记录，等待执行

```bash
# 创建预约到当前小时的乐捐记录（会立即激活）
CURRENT_TIME=$(date '+%Y-%m-%d %H:00:00')

# 确认助教 芝芝 (employee_id=5, phone=17520240130) 没有 pending 记录
sqlite3 /TG/tgservice/db/tgservice.db \
  "DELETE FROM lejuan_records WHERE coach_no = '10005' AND lejuan_status IN ('pending', 'active');"

LEJUAN_NOW=$(curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"employee_id\":\"5\",\"scheduled_start_time\":\"${CURRENT_TIME}\",\"remark\":\"QA测试-立即执行\"}")

echo "$LEJUAN_NOW" | jq .
```

**期望**：如果 `immediate: true`（当前小时），则直接激活，不会创建定时器。
**期望**：如果 `immediate: false`，则创建定时器后很快执行。

```bash
# 等待一段时间（如果非立即激活，最多等待预约时间）
sleep 10

# 验证记录已从 active-timers 移除
FINAL_TIMERS=$(curl -s http://127.0.0.1:8088/api/system-report/active-timers \
  -H "Authorization: Bearer $TOKEN")

echo "芝芝的定时器（应为空）:"
echo "$FINAL_TIMERS" | jq '.data[] | select(.stage_name == "芝芝")'

# 验证乐捐记录已变为 active 状态
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT id, lejuan_status, actual_start_time FROM lejuan_records WHERE coach_no = '10005' ORDER BY id DESC LIMIT 1;"
# 期望: lejuan_status = 'active'，actual_start_time 有值
```

### TC-5.2 验证 timer_log 记录

```bash
# 查看 timer_log 确认执行记录
TIMER_LOGS=$(curl -s "http://127.0.0.1:8088/api/system-report/timer-logs?type=lejuan&action=execute&limit=10" \
  -H "Authorization: Bearer $TOKEN")

echo "$TIMER_LOGS" | jq '.logs[] | select(.timer_id | contains("lejuan"))' | head -30
```

**期望**：存在 `action: "execute"`, `status: "success"` 的日志记录。

---

## 测试场景 6：active-timers API 完整性

**目标**：验证 active-timers API 返回完整、正确格式的助教信息。

### TC-6.1 验证响应结构

```bash
RESPONSE=$(curl -s http://127.0.0.1:8088/api/system-report/active-timers \
  -H "Authorization: Bearer $TOKEN")

# 验证顶层结构
echo "顶层结构:"
echo "$RESPONSE" | jq '{success: .success, total: .total, data_type: (.data | type)}'
```

**期望**：
```json
{
  "success": true,
  "total": <number>,
  "data_type": "array"
}
```

### TC-6.2 验证每个定时器包含完整字段

```bash
echo "字段检查:"
echo "$RESPONSE" | jq '.data[] | keys'
```

**期望每个定时器对象包含**：
- `timerId`
- `type` (lejuan 或 application)
- `recordId`
- `execTime`
- `employee_id`
- `stage_name`
- `coach_no`
- `application_type` (lejuan 为 null，application 有值)
- `remainingSeconds`

### TC-6.3 验证助教信息准确性

```bash
# 对每个定时器，验证 employee_id 和 stage_name 与数据库一致
echo "$RESPONSE" | jq -r '.data[] | "\(.recordId)|\(.type)|\(.employee_id)|\(.stage_name)|\(.coach_no)"' | while IFS='|' read RECORD_ID TYPE EMP_ID STAGE_NAME COACH_NO; do
  if [ "$TYPE" = "lejuan" ]; then
    DB_INFO=$(sqlite3 /TG/tgservice/db/tgservice.db \
      "SELECT c.employee_id, c.stage_name, lr.coach_no FROM lejuan_records lr LEFT JOIN coaches c ON lr.coach_no = c.coach_no WHERE lr.id = ${RECORD_ID};")
  else
    DB_INFO=$(sqlite3 /TG/tgservice/db/tgservice.db \
      "SELECT c.employee_id, c.stage_name, c.coach_no FROM applications a LEFT JOIN coaches c ON a.applicant_phone = c.employee_id OR a.applicant_phone = c.phone WHERE a.id = ${RECORD_ID} LIMIT 1;")
  fi
  
  echo "记录 ${RECORD_ID} (${TYPE}): API=${EMP_ID}/${STAGE_NAME} | DB=${DB_INFO}"
  
  # 对比
  DB_EMP=$(echo "$DB_INFO" | cut -d'|' -f1)
  DB_STAGE=$(echo "$DB_INFO" | cut -d'|' -f2)
  
  if [ "$EMP_ID" = "$DB_EMP" ] && [ "$STAGE_NAME" = "$DB_STAGE" ]; then
    echo "  ✅ 信息一致"
  else
    echo "  ❌ 信息不一致！"
  fi
done
```

---

## 测试场景 7：混合定时器完整列表

**目标**：同时存在乐捐和申请定时器时，active-timers API 返回全部。

### TC-7.1 创建混合定时器环境

```bash
# 确保有以下定时器：
# 1. TC-1.1 创建的乐捐定时器（歪歪）
# 2. TC-2.1 创建的应用定时器（歪歪-休息申请）
# 3. TC-3.1 创建的乐捐定时器（陆飞）
# 4. TC-3.3 创建的应用定时器（六六-请假申请）

FULL_LIST=$(curl -s http://127.0.0.1:8088/api/system-report/active-timers \
  -H "Authorization: Bearer $TOKEN")

echo "=== 完整定时器列表 ==="
echo "$FULL_LIST" | jq -r '.data[] | "[\(.type)] \(.stage_name) - \(.application_type // "乐捐") - 剩余 \(.remainingSeconds)s"'

echo ""
echo "总数: $(echo "$FULL_LIST" | jq '.total')"
echo "乐捐: $(echo "$FULL_LIST" | jq '[.data[] | select(.type == "lejuan")] | length')"
echo "申请: $(echo "$FULL_LIST" | jq '[.data[] | select(.type == "application")] | length')"
```

**期望**：
- `total >= 2`（至少有歪歪的乐捐和歪歪的申请）
- 包含 `lejuan` 和 `application` 两种类型
- 每个定时器都有完整的助教信息

---

## 测试场景 8：系统运行概览

**目标**：验证 overview API 返回正确的定时器统计。

### TC-8.1 验证概览统计

```bash
OVERVIEW=$(curl -s http://127.0.0.1:8088/api/system-report/overview \
  -H "Authorization: Bearer $TOKEN")

echo "系统概览:"
echo "$OVERVIEW" | jq '.timerStats'
```

**期望**：
```json
{
  "total": <与 active-timers 的 total 一致>,
  "lejuan": <乐捐定时器数量>,
  "application": <申请定时器数量>
}
```

**验证**：`total == lejuan + application`

---

## 测试场景 9：边界情况

### TC-9.1 无定时器时的响应

```bash
# 取消/执行所有定时器后
EMPTY_TIMERS=$(curl -s http://127.0.0.1:8088/api/system-report/active-timers \
  -H "Authorization: Bearer $TOKEN")

echo "空列表响应:"
echo "$EMPTY_TIMERS" | jq .
```

**期望**：
```json
{
  "success": true,
  "data": [],
  "total": 0
}
```

### TC-9.2 重复创建同一条记录的定时器

```bash
# 尝试为同一条记录创建两次定时器
# 通过 timer_log 验证是否记录了重复注册跳过
REPEAT_LOG=$(curl -s "http://127.0.0.1:8088/api/system-report/timer-logs?action=create&limit=20" \
  -H "Authorization: Bearer $TOKEN")

echo "$REPEAT_LOG" | jq '.logs[] | select(.action == "create")' | head -20
```

**期望**：不应有同一 `timer_id` 的重复 `create` 记录。

---

## 测试总结检查表

| 场景 | 测试用例 | 状态 | 备注 |
|------|---------|------|------|
| 1. 启动恢复-乐捐 | TC-1.1 ~ TC-1.3 | ⬜ | |
| 2. 启动恢复-申请 | TC-2.1 ~ TC-2.5 | ⬜ | |
| 3. 正常流程创建 | TC-3.1 ~ TC-3.3 | ⬜ | |
| 4. 取消定时器 | TC-4.1 ~ TC-4.2 | ⬜ | |
| 5. 执行后移除 | TC-5.1 ~ TC-5.2 | ⬜ | |
| 6. API完整性 | TC-6.1 ~ TC-6.3 | ⬜ | |
| 7. 混合列表 | TC-7.1 | ⬜ | |
| 8. 概览统计 | TC-8.1 | ⬜ | |
| 9. 边界情况 | TC-9.1 ~ TC-9.2 | ⬜ | |

---

## 测试数据清理脚本

```bash
# 测试完成后清理测试数据
sqlite3 /TG/tgservice/db/tgservice.db <<'SQL'
-- 清理测试用乐捐记录
DELETE FROM lejuan_records WHERE remark LIKE 'QA测试%';

-- 清理测试用申请记录
DELETE FROM applications WHERE remark LIKE 'QA测试%';

-- 清理测试用 timer_log（可选）
DELETE FROM timer_log WHERE timer_id LIKE 'lejuan_%' AND actual_time > datetime('now', '-1 hour');
DELETE FROM timer_log WHERE timer_id LIKE 'application_%' AND actual_time > datetime('now', '-1 hour');
SQL

echo "测试数据已清理"
```
