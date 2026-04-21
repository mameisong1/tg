# 打卡审查改进 - API 测试用例

> QA编号: QA-20260422-01
> 需求日期: 2026-04-22
> 编写人: 测试员B
> 测试环境: http://127.0.0.1:8088 (PM2: tgservice-dev)
> ⚠️ **禁止在产环境测试，禁止操作生产数据库！**

---

## 前置准备

### P0-0. 获取管理员 Token

```bash
# 使用管理员账号登录获取JWT token
curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}'

# 预期返回:
# {"success":true,"token":"eyJ...","role":"管理员","user":{"username":"tgadmin","name":"","role":"管理员"},"permissions":{...}}
```

> 将返回的 `token` 值保存为环境变量 `TOKEN`，后续所有请求使用 `Authorization: Bearer $TOKEN`

### P0-0b. 确认测试数据库连接

```bash
# 确认测试环境数据库路径
# TGSERVICE_ENV=test 时应使用 /TG/tgservice/db/tgservice-dev.db
sqlite3 /TG/tgservice/db/tgservice-dev.db "SELECT COUNT(*) FROM attendance_records;"
```

---

## 需求1：上下班打卡表新增两个字段

### P0-1.1 表结构验证 - is_late 字段

```bash
sqlite3 /TG/tgservice/db/tgservice-dev.db ".schema attendance_records"
```

**预期结果**：`attendance_records` 表包含 `is_late INTEGER` 列（默认值应为 0）

### P0-1.2 表结构验证 - is_reviewed 字段

```bash
sqlite3 /TG/tgservice/db/tgservice-dev.db ".schema attendance_records"
```

**预期结果**：`attendance_records` 表包含 `is_reviewed INTEGER` 列（默认值应为 0）

### P0-1.3 存量数据兼容性

```bash
# 新增字段后，已有数据的 is_late 和 is_reviewed 应有合理默认值
sqlite3 /TG/tgservice/db/tgservice-dev.db "SELECT id, date, is_late, is_reviewed FROM attendance_records LIMIT 5;"
```

**预期结果**：已有记录的 `is_late` 和 `is_reviewed` 不为 NULL，is_late 应有正确值（历史数据可全为0或按逻辑回填），is_reviewed 应为 0

---

## 需求2：提交上班打卡时计算是否迟到并写入打卡表

### P0-2.1 早班正常打卡（不迟到）

```bash
# 准备工作：找一个早班助教
sqlite3 /TG/tgservice/db/tgservice-dev.db "SELECT coach_no, employee_id, stage_name, shift FROM coaches WHERE shift='早班' LIMIT 1;"

# 假设返回 coach_no=10002 (陆飞, 早班)
# 先在14:00前执行上班打卡（不迟到场景）
curl -s -X POST http://127.0.0.1:8088/api/coaches/10002/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clock_in_photo":"https://example.com/test.jpg"}'
```

**预期结果**：
- API 返回 `{"success":true,"data":{"coach_no":10002,"stage_name":"陆飞","status":"早班空闲"}}`
- 数据库 `attendance_records` 最新记录 `is_late=0`

```bash
sqlite3 /TG/tgservice/db/tgservice-dev.db "SELECT id, clock_in_time, is_late FROM attendance_records WHERE coach_no=10002 ORDER BY id DESC LIMIT 1;"
```

### P0-2.2 早班迟到打卡

```bash
# 模拟迟到场景：手动INSERT一条迟到记录（直接操作数据库更快）
sqlite3 /TG/tgservice/db/tgservice-dev.db "
  INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, clock_out_time, clock_in_photo, is_late, is_reviewed, created_at, updated_at)
  VALUES ('2026-04-22', 10002, '2', '陆飞', '2026-04-22 15:30:00', NULL, NULL, 1, 0, datetime('now'), datetime('now'));
"
```

**预期结果**：插入成功，验证：

```bash
sqlite3 /TG/tgservice/db/tgservice-dev.db "SELECT id, clock_in_time, is_late FROM attendance_records WHERE coach_no=10002 AND date='2026-04-22' ORDER BY id DESC LIMIT 1;"
# 预期: is_late=1
```

### P0-2.3 晚班正常打卡（不迟到）

```bash
# 找一个晚班助教
sqlite3 /TG/tgservice/db/tgservice-dev.db "SELECT coach_no, employee_id, stage_name, shift FROM coaches WHERE shift='晚班' LIMIT 1;"

# 假设返回 coach_no=10003 (六六, 晚班)
# 在18:00前执行上班打卡（不迟到）
curl -s -X POST http://127.0.0.1:8088/api/coaches/10003/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clock_in_photo":"https://example.com/test.jpg"}'
```

**预期结果**：
- API 返回成功
- 数据库记录 `is_late=0`

### P0-2.4 晚班迟到打卡

```bash
# 模拟晚班迟到：手动INSERT
sqlite3 /TG/tgservice/db/tgservice-dev.db "
  INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, clock_out_time, clock_in_photo, is_late, is_reviewed, created_at, updated_at)
  VALUES ('2026-04-22', 10003, '3', '六六', '2026-04-22 19:30:00', NULL, NULL, 1, 0, datetime('now'), datetime('now'));
"
```

**预期结果**：`is_late=1`

### P0-2.5 带加班申请的迟到计算

```bash
# 早班+早加班2小时 → 应上班时间变为12:00
# 先查是否有加班申请记录
sqlite3 /TG/tgservice/db/tgservice-dev.db "SELECT id, application_type, status FROM applications WHERE application_type='早加班申请' AND status=1 LIMIT 1;"

# 如没有，手动插入一条加班申请
sqlite3 /TG/tgservice/db/tgservice-dev.db "
  INSERT INTO applications (applicant_phone, application_type, status, created_at, extra_data)
  VALUES ('18775703862', '早加班申请', 1, '2026-04-22 10:00:00', '{\"hours\":2}');
"

# 然后打卡：14:00打卡应该不迟到（应上班时间12:00），15:00打卡应该迟到
sqlite3 /TG/tgservice/db/tgservice-dev.db "
  INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, clock_out_time, clock_in_photo, is_late, is_reviewed, created_at, updated_at)
  VALUES ('2026-04-22', 10002, '2', '陆飞', '2026-04-22 14:30:00', NULL, NULL, 0, 0, datetime('now'), datetime('now'));
"
```

**预期结果**：有早加班2小时时，14:30打卡不算迟到（应上班时间12:00）

### P0-2.6 上班打卡 API 自动写入 is_late 字段（端到端测试）

```bash
# 先清理教练今天的打卡记录
sqlite3 /TG/tgservice/db/tgservice-dev.db "DELETE FROM attendance_records WHERE coach_no=10005 AND date='2026-04-22';"

# 晚班助教 10005 (芝芝) 在19:00打卡（晚班18:00应上班，迟到）
curl -s -X POST http://127.0.0.1:8088/api/coaches/10005/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clock_in_photo":"https://example.com/test.jpg"}'

# 验证数据库 is_late 字段
sqlite3 /TG/tgservice/db/tgservice-dev.db "SELECT id, clock_in_time, is_late FROM attendance_records WHERE coach_no=10005 AND date='2026-04-22';"
```

**预期结果**：`is_late=1`（19:00 > 18:00，迟到）

---

## 需求3：打卡审查按钮加上角标

### P0-3.1 新增角标计数 API

```bash
# 调用打卡审查列表 API，检查返回数据是否包含角标计数
curl -s http://127.0.0.1:8088/api/attendance-review?date=2026-04-22 \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**预期结果**：返回数据应包含以下字段之一：
- `badge_count` (当天迟到且未审查的人数)
- 或在顶层返回 `{"success":true,"data":[...],"badge_count":N}`

### P0-3.2 角标计数准确性 - 有迟到未审查数据

```bash
# 准备测试数据：2条迟到未审查 + 1条迟到已审查 + 1条正常未审查
sqlite3 /TG/tgservice/db/tgservice-dev.db "
  INSERT OR IGNORE INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, clock_out_time, clock_in_photo, is_late, is_reviewed, created_at, updated_at)
  VALUES ('2026-04-22', 10007, '7', '小月', '2026-04-22 19:30:00', NULL, NULL, 1, 0, datetime('now'), datetime('now'));
"
sqlite3 /TG/tgservice/db/tgservice-dev.db "
  INSERT OR IGNORE INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, clock_out_time, clock_in_photo, is_late, is_reviewed, created_at, updated_at)
  VALUES ('2026-04-22', 10008, '8', '小雨', '2026-04-22 15:30:00', NULL, NULL, 1, 0, datetime('now'), datetime('now'));
"
sqlite3 /TG/tgservice/db/tgservice-dev.db "
  INSERT OR IGNORE INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, clock_out_time, clock_in_photo, is_late, is_reviewed, created_at, updated_at)
  VALUES ('2026-04-22', 10003, '3', '六六', '2026-04-22 19:30:00', NULL, NULL, 1, 1, datetime('now'), datetime('now'));
"
sqlite3 /TG/tgservice/db/tgservice-dev.db "
  INSERT OR IGNORE INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, clock_out_time, clock_in_photo, is_late, is_reviewed, created_at, updated_at)
  VALUES ('2026-04-22', 10002, '2', '陆飞', '2026-04-22 13:30:00', NULL, NULL, 0, 0, datetime('now'), datetime('now'));
"

# 查询角标计数
curl -s http://127.0.0.1:8088/api/attendance-review?date=2026-04-22 \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**预期结果**：`badge_count=2`（仅统计 is_late=1 且 is_reviewed=0 的，即小月+小雨）

### P0-3.3 角标计数 - 无迟到数据

```bash
curl -s http://127.0.0.1:8088/api/attendance-review?date=2025-01-01 \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**预期结果**：`badge_count=0` 或无迟到记录

### P0-3.4 前端打卡审查入口角标显示

> **此项为前端页面测试**，验证 `member.vue` 中"打卡审查"按钮是否正确显示角标数字。
> 
> 手动验证路径：打开小程序 → 内部专区 → 打卡审查按钮 → 检查是否有红色角标显示数字

---

## 需求4：打卡审查页面新增两条提示

### P1-4.1 提示1：审查打卡时间和截图时间是否一致

> **此项为前端页面显示测试**
> - 打开打卡审查页面 `attendance-review.vue`
> - 页面顶部应显示提示文字："请审查打卡时间和截图时间是否一致" 或类似文案
> 
> 手动验证

### P1-4.2 提示2：处理迟到的处罚

> **此项为前端页面显示测试**
> - 打开打卡审查页面
> - 页面应显示迟到处理处罚相关提示文字
> 
> 手动验证

### P1-4.3 提示仅在审查页面显示

> 确认这两条提示只出现在打卡审查页面，不污染其他页面。
> 
> 手动验证

---

## 需求5：打卡审查页面不再计算迟到，直接显示打卡表的是否迟到字段

### P0-5.1 API 返回数据包含 is_late 字段（来自数据库）

```bash
# 调用打卡审查列表 API
curl -s http://127.0.0.1:8088/api/attendance-review?date=2026-04-22 \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**预期结果**：
- 每条记录返回 `is_late` 字段（0或1），值来自数据库字段而非动态计算
- 每条记录返回 `is_late_text` 字段（"迟到"或"正常"）

### P0-5.2 后端不再动态计算 is_late

```bash
# 验证：在数据库中手动设置 is_late=1，但打卡时间实际上不迟到
# 先插入一条"假迟到"数据（打卡时间很早，但手动标为迟到）
sqlite3 /TG/tgservice/db/tgservice-dev.db "
  INSERT OR REPLACE INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, clock_out_time, clock_in_photo, is_late, is_reviewed, created_at, updated_at)
  VALUES ('2026-04-22', 10007, '7', '小月', '2026-04-22 13:00:00', NULL, NULL, 1, 0, datetime('now'), datetime('now'));
"

# 查询 API 返回
curl -s "http://127.0.0.1:8088/api/attendance-review?date=2026-04-22&shift=晚班" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for r in data.get('data', []):
    if r.get('employee_id') == '7':
        print(f'小月: is_late={r[\"is_late\"]}, clock_in_time={r[\"clock_in_time\"]}')
"
```

**预期结果**：`is_late=1`（直接读数据库字段，不因打卡时间早而覆盖为0）

> **对比当前行为**：当前 `attendance-review.js` 第65-80行动态计算 is_late，改造后应直接读取数据库 `ar.is_late` 字段。

### P0-5.3 前端页面显示 is_late 字段值

> **此项为前端页面测试**
> - 页面中"迟到/正常"徽章应读取 API 返回的 `is_late` 字段
> - 不应在前端重新计算迟到状态
> 
> 手动验证

---

## 需求6：每条未审查完毕的打卡数据增加审查完毕按钮

### P0-6.1 新增标记审查完毕 API

```bash
# 假设存在一个 review API endpoint: POST /api/attendance-review/:id/review
# 或 PATCH /api/attendance-review/:id
# 具体路径待开发确认，以下为预期格式测试

# 先用数据库找一条未审查的记录
sqlite3 /TG/tgservice/db/tgservice-dev.db "SELECT id, employee_id, stage_name, is_reviewed FROM attendance_records WHERE is_reviewed=0 AND date='2026-04-22' LIMIT 1;"
# 假设返回 id=10

# 测试标记审查完毕
curl -s -X POST http://127.0.0.1:8088/api/attendance-review/10/review \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_reviewed":1}' | python3 -m json.tool
```

**预期结果**：
- API 返回 `{"success":true}` 或 `{"success":true,"data":{"is_reviewed":1}}`

```bash
# 验证数据库
sqlite3 /TG/tgservice/db/tgservice-dev.db "SELECT id, is_reviewed FROM attendance_records WHERE id=10;"
```

**预期结果**：`is_reviewed=1`

### P0-6.2 重复标记审查完毕（幂等性）

```bash
# 对已标记为 is_reviewed=1 的记录再次调用审查完毕
curl -s -X POST http://127.0.0.1:8088/api/attendance-review/10/review \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_reviewed":1}' | python3 -m json.tool
```

**预期结果**：返回成功或提示已审查，不报错

### P0-6.3 标记不存在的记录

```bash
curl -s -X POST http://127.0.0.1:8088/api/attendance-review/999999/review \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_reviewed":1}' | python3 -m json.tool
```

**预期结果**：返回 `{"success":false,"error":"记录不存在"}` 或 404

### P0-6.4 无权限用户无法标记审查完毕

```bash
# 使用普通助教token（非店长/管理员）尝试调用
# 先用助教登录获取token
curl -s -X POST http://127.0.0.1:8088/api/coach/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"2","stageName":"陆飞","idCardLast6":"xxxxxx"}'
# 获取助教token后尝试调用审查API
```

**预期结果**：403 权限拒绝

### P0-6.5 审查完毕后角标计数减少

```bash
# 先查看当前角标计数
curl -s http://127.0.0.1:8088/api/attendance-review?date=2026-04-22 \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f'审查前 badge_count={data.get(\"badge_count\",\"N/A\")}')
"

# 标记一条迟到未审查的记录为已审查
sqlite3 /TG/tgservice/db/tgservice-dev.db "SELECT id FROM attendance_records WHERE is_late=1 AND is_reviewed=0 AND date='2026-04-22' LIMIT 1;"
# 假设返回 id=10

curl -s -X POST http://127.0.0.1:8088/api/attendance-review/10/review \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_reviewed":1}'

# 再次查看角标计数
curl -s http://127.0.0.1:8088/api/attendance-review?date=2026-04-22 \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f'审查后 badge_count={data.get(\"badge_count\",\"N/A\")}')
"
```

**预期结果**：角标计数减少1

---

## 回归测试（确保现有功能不被破坏）

### P1-R.1 上班打卡正常流程

```bash
# 找一个今天还没有打卡记录的教练
sqlite3 /TG/tgservice/db/tgservice-dev.db "
  SELECT c.coach_no, c.employee_id, c.stage_name, c.shift, c.phone,
    (SELECT COUNT(*) FROM attendance_records WHERE coach_no=c.coach_no AND date='2026-04-22') as cnt
  FROM coaches c
  WHERE c.shift IS NOT NULL AND c.status NOT IN ('离职','黑名单')
  HAVING cnt=0
  LIMIT 1;
"

# 对该教练执行上班打卡
# curl ... (同上)

# 验证：水牌状态变为"早班空闲"或"晚班空闲"
# 验证：attendance_records 新增记录
```

**预期结果**：打卡成功，水牌状态和打卡记录均正确更新

### P1-R.2 下班打卡正常流程

```bash
# 对已在班的教练执行下班打卡
curl -s -X POST http://127.0.0.1:8088/api/coaches/10005/clock-out \
  -H "Authorization: Bearer $TOKEN"

# 验证：attendance_records 对应记录 clock_out_time 被更新
sqlite3 /TG/tgservice/db/tgservice-dev.db "
  SELECT id, clock_in_time, clock_out_time FROM attendance_records 
  WHERE coach_no=10005 AND date='2026-04-22' ORDER BY id DESC LIMIT 1;
"
```

**预期结果**：`clock_out_time` 有值

### P1-R.3 打卡审查列表正常返回

```bash
curl -s http://127.0.0.1:8088/api/attendance-review?date=2026-04-22&shift=晚班 \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**预期结果**：
- `success: true`
- `data` 数组包含当天晚班打卡记录
- 每条记录包含：employee_id, stage_name, shift, clock_in_time, clock_out_time, clock_in_photo, is_late, is_late_text, overtime_hours

### P1-R.4 重复上班打卡拦截

```bash
# 对已在班状态的教练再次点上班
curl -s -X POST http://127.0.0.1:8088/api/coaches/10005/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**预期结果**：`{"success":false,"error":"助教已在班状态,无需重复上班"}`

### P1-R.5 不在班状态下班拦截

```bash
# 对已下班的教练再次点下班
curl -s -X POST http://127.0.0.1:8088/api/coaches/10005/clock-out \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：`{"success":false,"error":"当前状态(下班)不允许下班"}`

---

## 权限测试

### P1-P.1 只有店长/助教管理/管理员可查看打卡审查

```bash
# 用 cashier 角色登录（应无权查看）
curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgcashier","password":"<cashier密码>"}'

# 用 cashier token 调用打卡审查 API
curl -s http://127.0.0.1:8088/api/attendance-review \
  -H "Authorization: Bearer $CASHIER_TOKEN"
```

**预期结果**：403 权限拒绝

---

## 边界条件测试

### P2-B.1 空日期参数

```bash
curl -s http://127.0.0.1:8088/api/attendance-review \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**预期结果**：默认使用今天日期，返回正常

### P2-B.2 无效日期格式

```bash
curl -s "http://127.0.0.1:8088/api/attendance-review?date=invalid-date" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：返回空数据或错误提示，不崩溃

### P2-B.3 无效班次参数

```bash
curl -s "http://127.0.0.1:8088/api/attendance-review?date=2026-04-22&shift=invalid" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：返回空数据，不崩溃

### P2-B.4 is_reviewed 标记后 API 列表仍返回该记录

```bash
# 标记一条记录为已审查
sqlite3 /TG/tgservice/db/tgservice-dev.db "UPDATE attendance_records SET is_reviewed=1 WHERE id=10;"

# 查看列表
curl -s "http://127.0.0.1:8088/api/attendance-review?date=2026-04-22" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for r in data.get('data', []):
    if r.get('employee_id') and int(r.get('employee_id')) in [7,8]:
        print(f'id={r}')
"
```

**预期结果**：已审查的记录仍然返回列表中，但 `is_reviewed=1`（前端应做视觉区分）

---

## 测试用例汇总

| 用例ID | 测试项 | 优先级 | 关联需求 | 状态 |
|--------|--------|--------|----------|------|
| P0-0 | 获取管理员Token | P0 | 前置 | ⬜ |
| P0-0b | 确认测试数据库 | P0 | 前置 | ⬜ |
| P0-1.1 | is_late 字段存在 | P0 | 需求1 | ⬜ |
| P0-1.2 | is_reviewed 字段存在 | P0 | 需求1 | ⬜ |
| P0-1.3 | 存量数据兼容性 | P0 | 需求1 | ⬜ |
| P0-2.1 | 早班正常打卡不迟到 | P0 | 需求2 | ⬜ |
| P0-2.2 | 早班迟到打卡 | P0 | 需求2 | ⬜ |
| P0-2.3 | 晚班正常打卡不迟到 | P0 | 需求2 | ⬜ |
| P0-2.4 | 晚班迟到打卡 | P0 | 需求2 | ⬜ |
| P0-2.5 | 加班影响迟到计算 | P0 | 需求2 | ⬜ |
| P0-2.6 | 上班打卡API自动写入is_late | P0 | 需求2 | ⬜ |
| P0-3.1 | 角标计数API返回 | P0 | 需求3 | ⬜ |
| P0-3.2 | 角标计数准确性 | P0 | 需求3 | ⬜ |
| P0-3.3 | 角标计数为零 | P0 | 需求3 | ⬜ |
| P0-3.4 | 前端角标显示 | P1 | 需求3 | ⬜ |
| P1-4.1 | 提示1:打卡时间与截图时间 | P1 | 需求4 | ⬜ |
| P1-4.2 | 提示2:迟到处罚 | P1 | 需求4 | ⬜ |
| P1-4.3 | 提示仅审查页面显示 | P1 | 需求4 | ⬜ |
| P0-5.1 | API返回is_late字段 | P0 | 需求5 | ⬜ |
| P0-5.2 | 后端不再动态计算is_late | P0 | 需求5 | ⬜ |
| P0-5.3 | 前端显示数据库is_late | P1 | 需求5 | ⬜ |
| P0-6.1 | 标记审查完毕API | P0 | 需求6 | ⬜ |
| P0-6.2 | 重复标记幂等性 | P0 | 需求6 | ⬜ |
| P0-6.3 | 标记不存在记录 | P1 | 需求6 | ⬜ |
| P0-6.4 | 无权限用户不可标记 | P0 | 需求6 | ⬜ |
| P0-6.5 | 审查后角标减少 | P0 | 需求3+6 | ⬜ |
| P1-R.1 | 上班打卡回归 | P1 | 回归 | ⬜ |
| P1-R.2 | 下班打卡回归 | P1 | 回归 | ⬜ |
| P1-R.3 | 打卡审查列表回归 | P1 | 回归 | ⬜ |
| P1-R.4 | 重复上班拦截 | P1 | 回归 | ⬜ |
| P1-R.5 | 不在班下班拦截 | P1 | 回归 | ⬜ |
| P1-P.1 | 权限控制回归 | P1 | 回归 | ⬜ |
| P2-B.1 | 空日期参数 | P2 | 边界 | ⬜ |
| P2-B.2 | 无效日期格式 | P2 | 边界 | ⬜ |
| P2-B.3 | 无效班次参数 | P2 | 边界 | ⬜ |
| P2-B.4 | 已审查记录仍返回列表 | P2 | 边界 | ⬜ |

---

## 备注

1. **测试数据库路径**：测试环境使用 `/TG/tgservice/db/tgservice-dev.db`，生产库为 `/TG/run/db/tgservice.db`，**切勿混淆**
2. **时间敏感用例**：P0-2.1/P0-2.3 的"正常打卡"场景依赖执行时间（需在应上班时间之前），建议在代码中通过直接INSERT方式模拟，而非依赖真实时间
3. **API路径待确认**：需求6的"标记审查完毕"API路径待开发确定，测试用例中假设为 `POST /api/attendance-review/:id/review`
4. **前端测试项**：P0-3.4/P1-4.x/P0-5.3 为页面显示测试，需手动验证或后续补充自动化
5. **测试数据清理**：每个测试用例执行完毕后，建议清理测试插入的数据，避免影响后续用例
