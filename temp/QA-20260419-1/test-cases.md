# QA 测试用例：新增助教申请事项

**需求编号**: QA-20260419-1  
**测试员**: B  
**测试类型**: API/curl 接口测试  
**后端地址**: `http://127.0.0.1:8088`  
**数据库路径**: `/TG/tgservice/db/tgservice.db`  
**测试日期**: 2026-04-19

---

## 环境准备

### 1. 获取认证 Token

```bash
# 管理员 token（用于审批操作）
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' | jq -r '.token')

# 助教管理 token（助教管理角色，用于审批）
COACH_MGR_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"13760517760","password":"对应密码"}' | jq -r '.token')

# 店长 token（用于审批）
STORE_MGR_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"18680174119","password":"对应密码"}' | jq -r '.token')
```

### 2. 测试数据准备

```bash
# 查看现有助教数据
sqlite3 /TG/tgservice/db/tgservice.db "SELECT employee_id, stage_name, shift, phone FROM coaches WHERE employee_id IS NOT NULL LIMIT 5;"

# 确保 water_boards 表有对应记录
sqlite3 /TG/tgservice/db/tgservice.db "SELECT wb.coach_no, wb.status, c.stage_name, c.shift, c.employee_id FROM water_boards wb LEFT JOIN coaches c ON wb.coach_no = c.coach_no LIMIT 5;"
```

### 3. 通用请求头

```bash
# 所有 API 请求需要携带 token
AUTH_HEADER="Authorization: Bearer $ADMIN_TOKEN"
```

---

## 测试用例

### 一、申请类型修改（P0）

#### TC-001: 验证新申请类型可提交 - 班次切换申请
- **优先级**: P0
- **前置条件**: 已登录助教账号，获取 token
- **测试步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "applicant_phone": "16675852676",
    "application_type": "班次切换申请",
    "remark": "申请从早班切换到晚班",
    "extra_data": {"target_shift": "晚班"}
  }'
```
- **预期结果**:
  - 返回 `{"success": true, "data": {"id": <数字>, "status": 0}}`
  - 数据库中新插入一条记录，`application_type = '班次切换申请'`，`status = 0`
- **数据库验证**:
```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT id, application_type, status, extra_data FROM applications ORDER BY id DESC LIMIT 1;"
```

#### TC-002: 验证新申请类型可提交 - 请假申请
- **优先级**: P0
- **测试步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "applicant_phone": "16675852676",
    "application_type": "请假申请",
    "remark": "事假：家中有事",
    "extra_data": {"leave_type": "事假", "leave_date": "2026-04-20"},
    "images": "[]\"https://example.com/proof1.jpg"\"
  }'
```
- **预期结果**: 返回成功，`status = 0`，`application_type = '请假申请'`

#### TC-003: 验证新申请类型可提交 - 休息申请
- **优先级**: P0
- **测试步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "applicant_phone": "16675852676",
    "application_type": "休息申请",
    "remark": "申请休息一天",
    "extra_data": {"rest_date": "2026-04-22"}
  }'
```
- **预期结果**: 返回成功，`status = 0`，`application_type = '休息申请'`

#### TC-004: 验证旧申请类型"乐捐报备"已被删除
- **优先级**: P0
- **测试步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "applicant_phone": "16675852676",
    "application_type": "乐捐报备",
    "remark": "测试"
  }'
```
- **预期结果**: 返回 `{"success": false, "error": "无效的申请类型"}`，HTTP 状态码 400

#### TC-005: 验证保留的申请类型仍可正常使用
- **优先级**: P0
- **测试步骤**: 分别提交 `早加班申请`、`晚加班申请`、`公休申请`、`约客记录`
- **预期结果**: 四种类型均能正常提交成功

---

### 二、班次切换申请（P0）

#### TC-010: 助教提交班次切换申请（早→晚）
- **优先级**: P0
- **前置条件**: 助教"歪歪"当前为早班（`shift = '早班'`）
- **测试步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "applicant_phone": "16675852676",
    "application_type": "班次切换申请",
    "remark": "申请从早班切换到晚班",
    "extra_data": {"current_shift": "早班", "target_shift": "晚班"}
  }'
```
- **预期结果**: 提交成功，返回申请 id，`status = 0`

#### TC-011: 助教提交班次切换申请（晚→早）
- **优先级**: P0
- **前置条件**: 助教"六六"当前为晚班
- **测试步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "applicant_phone": "19814455887",
    "application_type": "班次切换申请",
    "remark": "申请从晚班切换到早班",
    "extra_data": {"current_shift": "晚班", "target_shift": "早班"}
  }'
```
- **预期结果**: 提交成功

#### TC-012: 审批通过班次切换申请 - 验证自动切换班次
- **优先级**: P0
- **前置条件**: TC-010 已提交申请，记录申请 id = `<APP_ID>`
- **审批前验证**:
```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT shift FROM coaches WHERE employee_id = '1' OR phone = '16675852676' LIMIT 1;"
# 预期：早班
```
- **测试步骤**:
```bash
curl -s -X PUT http://127.0.0.1:8088/api/applications/<APP_ID>/approve \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "approver_phone": "tgadmin",
    "status": 1
  }'
```
- **预期结果**:
  - 返回 `{"success": true, "data": {"id": <APP_ID>, "status": 1, ...}}`
  - 数据库中该助教的 `shift` 从"早班"变为"晚班"
- **数据库验证**:
```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT shift FROM coaches WHERE employee_id = '1' OR phone = '16675852676' LIMIT 1;"
# 预期：晚班

sqlite3 /TG/tgservice/db/tgservice.db "SELECT status FROM applications WHERE id = <APP_ID>;"
# 预期：1（已同意）
```

#### TC-013: 审批拒绝班次切换申请 - 班次不变
- **优先级**: P0
- **前置条件**: 提交一条新班次切换申请
- **测试步骤**: 审批时传 `"status": 2`
- **预期结果**:
  - 申请 `status = 2`（已拒绝）
  - 助教 `shift` 字段不变

#### TC-014: 每人每月班次切换次数限制（2次）
- **优先级**: P0
- **测试步骤**:
  1. 当月第 1 次提交班次切换申请 → 预期成功
  2. 当月第 2 次提交班次切换申请 → 预期成功
  3. 当月第 3 次提交班次切换申请 → **预期失败**，返回错误提示"本月班次切换次数已达上限（2次）"
- **实现验证**: 提交申请时后端需检查 `applications` 表中该 `applicant_phone` 在当月 `created_at` 范围内 `application_type = '班次切换申请'` 的记录数
- **SQL 验证**:
```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT COUNT(*) FROM applications WHERE applicant_phone = '16675852676' AND application_type = '班次切换申请' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now');"
```

#### TC-015: 审批页面显示当前早晚班助教人数
- **优先级**: P1
- **测试步骤**:
```bash
curl -s "http://127.0.0.1:8088/api/coaches/shift-stats" \
  -H "$AUTH_HEADER"
```
（注：具体接口路径需根据实际实现确认，可能为 `/api/applications/shift-stats` 或在审批列表接口中返回）
- **预期结果**: 返回当前早班人数和晚班人数，如 `{"early_shift_count": 30, "late_shift_count": 30}`
- **数据库验证**:
```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT shift, COUNT(*) FROM coaches GROUP BY shift;"
```

#### TC-016: 已审批通过的申请不可再次审批
- **优先级**: P1
- **前置条件**: TC-012 已审批通过
- **测试步骤**: 再次对同一申请 id 执行审批
- **预期结果**: 返回 `{"success": false, "error": "该申请已审批过"}`，HTTP 400

---

### 三、休息申请（P0）

#### TC-020: 助教提交休息申请 - 当天
- **优先级**: P0
- **测试步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "applicant_phone": "16675852676",
    "application_type": "休息申请",
    "remark": "申请今天休息",
    "extra_data": {"rest_date": "2026-04-19"}
  }'
```
- **预期结果**: 提交成功

#### TC-021: 助教提交休息申请 - 未来30天内
- **优先级**: P0
- **测试步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "applicant_phone": "16675852676",
    "application_type": "休息申请",
    "remark": "申请5天后休息",
    "extra_data": {"rest_date": "2026-04-24"}
  }'
```
- **预期结果**: 提交成功

#### TC-022: 休息申请日期超过30天 - 应被拒绝
- **优先级**: P1
- **测试步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "applicant_phone": "16675852676",
    "application_type": "休息申请",
    "extra_data": {"rest_date": "2026-06-01"}
  }'
```
- **预期结果**: 返回错误，提示"休息日期必须在30天内"

#### TC-023: 每人每月休息次数限制（4天）
- **优先级**: P0
- **测试步骤**:
  1. 当月第 1~4 次提交休息申请 → 均预期成功
  2. 当月第 5 次提交休息申请 → **预期失败**，返回"本月休息天数已达上限（4天）"
- **实现验证**: 提交申请时后端需检查当月已审批通过（`status = 1`）的休息申请天数
- **SQL 验证**:
```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT COUNT(*) FROM applications WHERE applicant_phone = '16675852676' AND application_type = '休息申请' AND status = 1 AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now');"
```

#### TC-024: 休息申请审批通过 - 水牌状态变更为"休息"
- **优先级**: P0
- **前置条件**: 提交一条休息申请，记录 id = `<REST_APP_ID>`
- **测试步骤**:
```bash
curl -s -X PUT http://127.0.0.1:8088/api/applications/<REST_APP_ID>/approve \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"approver_phone": "tgadmin", "status": 1}'
```
- **预期结果**:
  - 审批成功，`status = 1`
  - 水牌状态变为"休息"
- **数据库验证**:
```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT wb.status FROM water_boards wb JOIN coaches c ON wb.coach_no = c.coach_no WHERE c.phone = '16675852676' OR c.employee_id = '1';"
# 预期：休息
```

#### TC-025: 休息申请审批通过 - 定时器预约到休息日12点执行
- **优先级**: P0
- **前置条件**: 提交的休息申请 `extra_data.rest_date` 为未来日期（如 2026-04-22）
- **测试步骤**:
  1. 提交休息申请，rest_date 为未来某天
  2. 审批通过
  3. 检查定时器服务中是否注册了定时任务
- **预期结果**:
  - 审批通过后，系统创建定时器，在 `rest_date 12:00:00` 时自动将水牌状态变更为"休息"
  - 如果是当天休息，立即变更水牌状态
  - 如果是未来日期，水牌状态暂不变，到休息日12点才变更
- **实现验证**: 参考 `lejuan-timer.js` 模式，新建一个 timer 服务管理休息/请假的定时执行
- **数据库验证**（假设使用定时器表）:
```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT * FROM application_timers WHERE application_id = <REST_APP_ID>;"
```

#### TC-026: 休息申请审批拒绝 - 水牌状态不变
- **优先级**: P1
- **测试步骤**: 提交休息申请后审批拒绝（`status = 2`）
- **预期结果**: 水牌状态不变，定时器未创建

---

### 四、请假申请（P0）

#### TC-030: 助教提交事假申请
- **优先级**: P0
- **测试步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "applicant_phone": "16675852676",
    "application_type": "请假申请",
    "remark": "家中有急事需要处理",
    "extra_data": {"leave_type": "事假", "leave_date": "2026-04-20"},
    "images": "[\"https://example.com/proof1.jpg\"]"
  }'
```
- **预期结果**: 提交成功

#### TC-031: 助教提交病假申请
- **优先级**: P0
- **测试步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "applicant_phone": "16675852676",
    "application_type": "请假申请",
    "remark": "发烧需要去医院",
    "extra_data": {"leave_type": "病假", "leave_date": "2026-04-21"},
    "images": "[\"https://example.com/hospital.jpg\", \"https://example.com/medicine.jpg\"]"
  }'
```
- **预期结果**: 提交成功

#### TC-032: 请假申请不输入理由 - 应被拒绝
- **优先级**: P1
- **测试步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "applicant_phone": "16675852676",
    "application_type": "请假申请",
    "remark": "",
    "extra_data": {"leave_type": "事假", "leave_date": "2026-04-20"}
  }'
```
- **预期结果**: 返回 `{"success": false, "error": "请输入请假理由"}`，HTTP 400

#### TC-033: 请假申请不选择请假类型 - 应被拒绝
- **优先级**: P1
- **测试步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "applicant_phone": "16675852676",
    "application_type": "请假申请",
    "remark": "有事请假",
    "extra_data": {"leave_date": "2026-04-20"}
  }'
```
- **预期结果**: 返回错误，提示"请选择请假类型（事假/病假）"

#### TC-034: 请假申请图片超过3张 - 应被拒绝
- **优先级**: P2
- **测试步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "applicant_phone": "16675852676",
    "application_type": "请假申请",
    "remark": "有事",
    "extra_data": {"leave_type": "事假", "leave_date": "2026-04-20"},
    "images": "[\"url1\",\"url2\",\"url3\",\"url4\"]"
  }'
```
- **预期结果**: 返回错误，提示"最多上传3张图片"

#### TC-035: 请假申请一次申请一天
- **优先级**: P1
- **测试步骤**: 提交请假申请，检查 `extra_data` 中只包含单个日期
- **预期结果**: 后端验证 `leave_date` 为单个日期字符串，不接受日期范围

#### TC-036: 请假申请审批通过 - 水牌状态变更
- **优先级**: P0
- **前置条件**: 提交一条请假申请，记录 id = `<LEAVE_APP_ID>`
- **测试步骤**:
```bash
curl -s -X PUT http://127.0.0.1:8088/api/applications/<LEAVE_APP_ID>/approve \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"approver_phone": "tgadmin", "status": 1}'
```
- **预期结果**:
  - 审批成功
  - 水牌状态变更（如变为"请假"）
  - 定时器预约到请假日执行（如果是未来日期）

#### TC-037: 请假申请审批通过 - 定时器预约执行
- **优先级**: P0
- **前置条件**: 请假日期为未来某天
- **预期结果**: 定时器在请假日开始时自动将水牌状态变更为"请假"

---

### 五、审批流程通用（P0）

#### TC-040: 查询待审批申请列表
- **优先级**: P0
- **测试步骤**:
```bash
# 查询班次切换待审批
curl -s "http://127.0.0.1:8088/api/applications?application_type=班次切换申请&status=0" \
  -H "$AUTH_HEADER"

# 查询请假待审批
curl -s "http://127.0.0.1:8088/api/applications?application_type=请假申请&status=0" \
  -H "$AUTH_HEADER"

# 查询休息待审批
curl -s "http://127.0.0.1:8088/api/applications?application_type=休息申请&status=0" \
  -H "$AUTH_HEADER"
```
- **预期结果**: 返回对应类型的待审批记录列表，包含 `stage_name`、`applicant_phone`、`created_at` 等字段

#### TC-041: 查询已审批（同意）列表
- **优先级**: P0
- **测试步骤**:
```bash
curl -s "http://127.0.0.1:8088/api/applications?application_type=班次切换申请&status=1" \
  -H "$AUTH_HEADER"
```
- **预期结果**: 返回已同意的班次切换申请列表

#### TC-042: 查询已审批（拒绝）列表
- **优先级**: P1
- **测试步骤**:
```bash
curl -s "http://127.0.0.1:8088/api/applications?application_type=班次切换申请&status=2" \
  -H "$AUTH_HEADER"
```
- **预期结果**: 返回已拒绝的申请列表

#### TC-043: 审批权限验证 - 非管理员不可审批
- **优先级**: P1
- **前置条件**: 使用普通助教 token（非助教管理/店长/管理员角色）
- **测试步骤**: 用助教 token 执行审批请求
- **预期结果**: 返回 403 权限不足

---

### 六、待审批数字指示器（P0）

#### TC-050: 新增待审批数量查询 API
- **优先级**: P0
- **测试步骤**:
```bash
curl -s "http://127.0.0.1:8088/api/applications/pending-counts" \
  -H "$AUTH_HEADER"
```
- **预期结果**: 返回各类型待审批数量，如：
```json
{
  "success": true,
  "data": {
    "shift_switch": 2,
    "leave": 1,
    "rest": 0,
    "overtime": 0,
    "public_leave": 0
  }
}
```
- **数据库验证**:
```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT application_type, COUNT(*) FROM applications WHERE status = 0 GROUP BY application_type;"
```

#### TC-051: 待审批数量为0时正确返回
- **优先级**: P1
- **前置条件**: 所有申请均已审批完成
- **测试步骤**: 调用待审批数量 API
- **预期结果**: 所有类型的数量均为 0

#### TC-052: 提交新申请后待审批数量增加
- **优先级**: P1
- **测试步骤**:
  1. 调用待审批数量 API，记录班次切换数量 = N
  2. 提交一条班次切换申请
  3. 再次调用待审批数量 API
  4. 预期班次切换数量 = N+1

#### TC-053: 审批通过后待审批数量减少
- **优先级**: P1
- **测试步骤**:
  1. 记录当前班次切换待审批数量 = N
  2. 审批通过一条班次切换申请
  3. 再次调用待审批数量 API
  4. 预期数量 = N-1

---

### 七、申请取消功能（P1）

#### TC-060: 助教取消自己待审批的申请
- **优先级**: P1
- **前置条件**: 助教提交了一条申请，状态为待审批（`status = 0`）
- **测试步骤**:
```bash
curl -s -X DELETE http://127.0.0.1:8088/api/applications/<APP_ID> \
  -H "$AUTH_HEADER"
```
- **预期结果**:
  - 返回 `{"success": true}`
  - 数据库中该记录被删除或标记为已取消（如 `status = 3`）
- **数据库验证**:
```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT status FROM applications WHERE id = <APP_ID>;"
# 预期：已删除或 status = 3（已取消）
```

#### TC-061: 已审批通过的申请不可取消
- **优先级**: P1
- **前置条件**: 申请已审批通过（`status = 1`）
- **测试步骤**: 对该申请执行取消操作
- **预期结果**: 返回错误，提示"该申请已审批，无法取消"

#### TC-062: 已审批拒绝的申请不可取消
- **优先级**: P2
- **前置条件**: 申请已审批拒绝（`status = 2`）
- **测试步骤**: 对该申请执行取消操作
- **预期结果**: 返回错误，提示"该申请已审批，无法取消"

#### TC-063: 只能取消自己的申请
- **优先级**: P1
- **前置条件**: 助教A提交申请，助教B尝试取消
- **测试步骤**: 用助教B的 token 取消助教A的申请
- **预期结果**: 返回 403 或错误提示"无权取消他人的申请"

---

### 八、权限验证（P1）

#### TC-070: 助教可访问三个申请页面
- **优先级**: P1
- **前置条件**: 使用助教 token
- **测试步骤**: 分别调用三个申请页面的数据接口
- **预期结果**: 助教权限下可正常访问班次切换申请、请假申请、休息申请页面

#### TC-071: 助教管理可访问三个审批页面
- **优先级**: P1
- **前置条件**: 使用助教管理角色 token
- **测试步骤**: 分别调用三个审批页面的数据接口
- **预期结果**: 助教管理权限下可正常访问班次切换审批、请假审批、休息审批页面

#### TC-072: 店长可访问三个审批页面
- **优先级**: P1
- **前置条件**: 使用店长角色 token
- **测试步骤**: 分别调用三个审批页面的数据接口
- **预期结果**: 店长权限下可正常访问三个审批页面

#### TC-073: 管理员可访问三个审批页面
- **优先级**: P1
- **前置条件**: 使用管理员角色 token
- **预期结果**: 管理员权限下可正常访问三个审批页面

#### TC-074: 普通助教不可访问审批页面
- **优先级**: P1
- **前置条件**: 使用普通助教 token（无助教管理/店长/管理员权限）
- **测试步骤**: 尝试调用审批相关接口
- **预期结果**: 返回 403 权限不足

---

### 九、边界和异常场景（P1/P2）

#### TC-080: 申请类型字段为空
- **优先级**: P1
- **测试步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"applicant_phone": "16675852676"}'
```
- **预期结果**: 返回 `{"success": false, "error": "缺少必填字段"}`

#### TC-081: 申请人手机号为空
- **优先级**: P1
- **测试步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"application_type": "班次切换申请"}'
```
- **预期结果**: 返回 `{"success": false, "error": "缺少必填字段"}`

#### TC-082: 申请不存在的手机号
- **优先级**: P2
- **测试步骤**: 用一个不在 coaches 表中的手机号提交申请
- **预期结果**: 申请提交成功（不强制校验手机号存在性），但审批时关联不到教练信息

#### TC-083: 审批不存在的申请
- **优先级**: P1
- **测试步骤**:
```bash
curl -s -X PUT http://127.0.0.1:8088/api/applications/99999/approve \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"approver_phone": "tgadmin", "status": 1}'
```
- **预期结果**: 返回 `{"success": false, "error": "申请记录不存在"}`，HTTP 404

#### TC-084: 审批状态值非法
- **优先级**: P2
- **测试步骤**:
```bash
curl -s -X PUT http://127.0.0.1:8088/api/applications/<APP_ID>/approve \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"approver_phone": "tgadmin", "status": 3}'
```
- **预期结果**: 返回 `{"success": false, "error": "无效的审批状态"}`

#### TC-085: 跨月次数限制重置
- **优先级**: P2
- **测试步骤**: 月末提交班次切换申请（达到2次上限），次月初再次提交
- **预期结果**: 次月初可正常提交（次数按自然月重置）

---

### 十、定时器相关（P0）

#### TC-090: 休息申请定时器 - 当天立即执行
- **优先级**: P0
- **前置条件**: 提交休息申请，`rest_date` 为当天
- **测试步骤**: 审批通过
- **预期结果**: 水牌状态立即变为"休息"

#### TC-091: 休息申请定时器 - 未来日期延时执行
- **优先级**: P0
- **前置条件**: 提交休息申请，`rest_date` 为未来某天
- **测试步骤**:
  1. 审批通过
  2. 确认水牌状态暂未变更
  3. 等待到 `rest_date 12:00`（或修改系统时间模拟）
- **预期结果**: 到休息日12点时，水牌状态自动变为"休息"

#### TC-092: 请假申请定时器 - 当天立即执行
- **优先级**: P0
- **前置条件**: 提交请假申请，`leave_date` 为当天
- **测试步骤**: 审批通过
- **预期结果**: 水牌状态立即变更为"请假"

#### TC-093: 请假申请定时器 - 未来日期延时执行
- **优先级**: P0
- **前置条件**: 提交请假申请，`leave_date` 为未来某天
- **测试步骤**: 审批通过后等待到请假日
- **预期结果**: 到请假日时水牌状态自动变更为"请假"

#### TC-094: 定时器服务启动恢复（重启后自动恢复）⭐ 用户特别要求
- **优先级**: P0
- **前置条件**: 有一个已审批通过的休息/请假申请，exec_time 为未来时间（尚未执行），`extra_data` 中 `timer_set=true`
- **测试步骤**:

**场景A：exec_time 未到，重启后应重新注册定时器**
```bash
# 1. 提交明天的休息申请并审批通过
# 2. 验证 extra_data 中有 timer_set=true 和 exec_time
sqlite3 /TG/tgservice/db/tgservice.db "SELECT extra_data FROM applications WHERE id = <APP_ID>;"
# 预期: {"rest_date":"...","scheduled":1,"timer_set":true,"exec_time":"... 12:00:00"}

# 3. 重启后端服务
pm2 restart tgservice-dev

# 4. 等待3秒后检查日志
sleep 3
pm2 logs tgservice-dev --lines 30 --nostream | grep "申请定时器"
```

- **场景A预期结果**:
  - 日志: `[申请定时器] 恢复定时器: 找到 N 条 timer_set=true 记录`
  - 日志: `[申请定时器] 记录 <APP_ID> 已调度，延迟 XXXX秒 后恢复`
  - 日志: `[申请定时器] 恢复完成: 调度 N 个, 立即执行 0 个, 跳过 0 个`
  - 水牌保持"休息"不变，定时器已重新注册

**场景B：exec_time 已过，重启后应立即执行恢复**
```bash
# 1. 手动将一条记录的 exec_time 改为过去
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE applications SET extra_data = json_set(extra_data, '$.exec_time', '2026-04-18 12:00:00') WHERE id = <APP_ID>;"

# 2. 重启后端服务
pm2 restart tgservice-dev

# 3. 检查日志
sleep 3
pm2 logs tgservice-dev --lines 30 --nostream | grep "申请定时器"
```

- **场景B预期结果**:
  - 日志: `[申请定时器] 记录 <APP_ID> exec_time 已过，立即执行恢复`
  - 水牌状态自动恢复为对应班次的空闲状态

#### TC-095: 定时器取消 - 申请被取消
- **优先级**: P1
- **前置条件**: 提交休息申请（未来日期），审批通过，定时器已注册
- **测试步骤**: 取消该申请
- **预期结果**: 定时器被清除，到休息日12点不会自动变更水牌状态

---

### 十一、数据一致性（P2）

#### TC-100: 申请列表接口返回新申请类型
- **优先级**: P2
- **测试步骤**:
```bash
curl -s "http://127.0.0.1:8088/api/applications?limit=10" \
  -H "$AUTH_HEADER"
```
- **预期结果**: 列表中正确显示三种新申请类型的记录

#### TC-101: approved-recent 接口支持新申请类型
- **优先级**: P2
- **测试步骤**:
```bash
curl -s "http://127.0.0.1:8088/api/applications/approved-recent?application_types=班次切换申请,请假申请,休息申请&days=7" \
  -H "$AUTH_HEADER"
```
- **预期结果**: 返回近7天内已审批的三种新类型申请记录

---

## 测试数据准备 SQL

```sql
-- 查看现有助教信息
SELECT coach_no, employee_id, stage_name, phone, shift FROM coaches WHERE employee_id IS NOT NULL LIMIT 10;

-- 确保 water_boards 有对应记录
INSERT OR IGNORE INTO water_boards (coach_no, stage_name, status)
SELECT coach_no, stage_name, '下班' FROM coaches WHERE coach_no NOT IN (SELECT coach_no FROM water_boards);

-- 清理测试数据（测试完成后）
-- DELETE FROM applications WHERE application_type IN ('班次切换申请', '请假申请', '休息申请');
```

---

## 测试用例汇总

| 编号 | 模块 | 测试场景 | 优先级 |
|------|------|----------|--------|
| TC-001 | 申请类型 | 班次切换申请可提交 | P0 |
| TC-002 | 申请类型 | 请假申请可提交 | P0 |
| TC-003 | 申请类型 | 休息申请可提交 | P0 |
| TC-004 | 申请类型 | 乐捐报备已删除 | P0 |
| TC-005 | 申请类型 | 保留类型仍可用 | P0 |
| TC-010 | 班次切换 | 提交早→晚切换 | P0 |
| TC-011 | 班次切换 | 提交晚→早切换 | P0 |
| TC-012 | 班次切换 | 审批通过自动换班 | P0 |
| TC-013 | 班次切换 | 审批拒绝班次不变 | P0 |
| TC-014 | 班次切换 | 每月2次限制 | P0 |
| TC-015 | 班次切换 | 审批页面显示人数统计 | P1 |
| TC-016 | 班次切换 | 已审批不可再次审批 | P1 |
| TC-020 | 休息申请 | 提交当天休息 | P0 |
| TC-021 | 休息申请 | 提交未来30天内休息 | P0 |
| TC-022 | 休息申请 | 超过30天应拒绝 | P1 |
| TC-023 | 休息申请 | 每月4天限制 | P0 |
| TC-024 | 休息申请 | 审批通过水牌变更 | P0 |
| TC-025 | 休息申请 | 定时器预约执行 | P0 |
| TC-026 | 休息申请 | 审批拒绝不变 | P1 |
| TC-030 | 请假申请 | 提交事假 | P0 |
| TC-031 | 请假申请 | 提交病假 | P0 |
| TC-032 | 请假申请 | 无理由应拒绝 | P1 |
| TC-033 | 请假申请 | 无类型应拒绝 | P1 |
| TC-034 | 请假申请 | 图片超3张应拒绝 | P2 |
| TC-035 | 请假申请 | 一次一天 | P1 |
| TC-036 | 请假申请 | 审批通过水牌变更 | P0 |
| TC-037 | 请假申请 | 定时器预约执行 | P0 |
| TC-040 | 审批流程 | 查询待审批列表 | P0 |
| TC-041 | 审批流程 | 查询已同意列表 | P0 |
| TC-042 | 审批流程 | 查询已拒绝列表 | P1 |
| TC-043 | 审批流程 | 非管理员不可审批 | P1 |
| TC-050 | 待审批指示器 | 待审批数量API | P0 |
| TC-051 | 待审批指示器 | 数量为0正确返回 | P1 |
| TC-052 | 待审批指示器 | 提交后数量增加 | P1 |
| TC-053 | 待审批指示器 | 审批后数量减少 | P1 |
| TC-060 | 申请取消 | 取消待审批申请 | P1 |
| TC-061 | 申请取消 | 已同意不可取消 | P1 |
| TC-062 | 申请取消 | 已拒绝不可取消 | P2 |
| TC-063 | 申请取消 | 只能取消自己的 | P1 |
| TC-070 | 权限 | 助教可访问申请页 | P1 |
| TC-071 | 权限 | 助教管理可访问审批页 | P1 |
| TC-072 | 权限 | 店长可访问审批页 | P1 |
| TC-073 | 权限 | 管理员可访问审批页 | P1 |
| TC-074 | 权限 | 普通助教不可审批 | P1 |
| TC-080 | 异常 | 申请类型为空 | P1 |
| TC-081 | 异常 | 手机号为空 | P1 |
| TC-082 | 异常 | 手机号不存在 | P2 |
| TC-083 | 异常 | 审批不存在的申请 | P1 |
| TC-084 | 异常 | 审批状态值非法 | P2 |
| TC-085 | 异常 | 跨月次数重置 | P2 |
| TC-090 | 定时器 | 当天休息立即执行 | P0 |
| TC-091 | 定时器 | 未来休息延时执行 | P0 |
| TC-092 | 定时器 | 当天请假立即执行 | P0 |
| TC-093 | 定时器 | 未来请假延时执行 | P0 |
| TC-094 | 定时器 | 服务启动恢复 | P1 |
| TC-095 | 定时器 | 取消时清除定时器 | P1 |
| TC-100 | 数据一致性 | 列表接口返回新类型 | P2 |
| TC-101 | 数据一致性 | approved-recent支持新类型 | P2 |

**总计**: 53 条测试用例  
**P0 核心**: 26 条  
**P1 重要**: 21 条  
**P2 次要**: 6 条
