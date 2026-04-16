你是QA审计员。请审计以下测试用例。

## 测试用例内容
```
# QA-20260416-7 测试用例

## 需求概述

### 1. 水牌显示优化
前台H5 水牌查看和水牌管理页面，下班助教的水牌显示优化：
- 删除下班筛选按钮
- 移动下班助教卡片到早班空闲/晚班空闲组（按班次）
- 下班助教卡片排在末尾、分行显示
- 下班助教卡片无头像、深灰色底
- 下班助教显示当天已同意加班小时数（红色粗体右上角）
- 加班小时数批量接口，30秒刷新

### 2. 公安备案号显示
首页底部和会员中心底部新增显示公安备案号：`京公网安备11010102000001号`

---

## 测试环境

| 项目 | 值 |
|------|------|
| 后端API | `http://127.0.0.1:8088` |
| 数据库 | `/TG/tgservice/db/tgservice.db` |
| Admin账号 | `tgadmin / mms633268` |

---

## 前置准备：获取认证Token

```bash
# 管理员登录获取token（用于所有需要认证的API测试）
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "ADMIN_TOKEN=$ADMIN_TOKEN"
```

---

## TC-01 [P0] 获取水牌列表API正常返回

**目的**：验证 GET /api/water-boards 正常返回所有助教的水牌数据

**步骤**：
```bash
# 1. 获取token
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 2. 获取水牌列表
curl -s -X GET "http://127.0.0.1:8088/api/water-boards" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool | head -30
```

**预期结果**：
- 返回 `{"success": true, "data": [...]}`
- data 为数组，包含所有助教的水牌记录
- 每条记录包含：coach_no, stage_name, status, shift, photos, employee_id, table_no_list
- 验证有 "下班" 状态的助教存在：
```bash
curl -s -X GET "http://127.0.0.1:8088/api/water-boards?status=下班" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'下班助教数量: {len(d[\"data\"])}'); [print(f'  {r[\"stage_name\"]} 班次:{r[\"shift\"]}') for r in d['data']]"
```
- 至少应返回若干条 "下班" 状态记录

---

## TC-02 [P0] 水牌列表按status筛选 - 下班状态

**目的**：验证可以单独筛选出 "下班" 状态的助教

**步骤**：
```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -s -X GET "http://127.0.0.1:8088/api/water-boards?status=下班" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'筛选结果: success={d[\"success\"]}, count={len(d[\"data\"])}')
for r in d['data']:
    print(f'  工号{r[\"employee_id\"]} {r[\"stage_name\"]} 班次={r[\"shift\"]} 状态={r[\"status\"]}')
    assert r['status'] == '下班', f'状态应为下班，实际: {r[\"status\"]}'
print('✅ 所有返回记录的状态都是下班')
"
```

**预期结果**：
- 返回所有 status = '下班' 的助教
- 每条记录的 status 字段都为 '下班'
- 包含早班和晚班的下班助教

---

## TC-03 [P0] 水牌列表按shift筛选 - 早班/晚班

**目的**：验证可以按班次筛选

**步骤**：
```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 筛选早班
echo "=== 早班助教 ==="
curl -s -X GET "http://127.0.0.1:8088/api/water-boards?shift=早班" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'早班数量: {len(d[\"data\"])}')"

# 筛选晚班
echo "=== 晚班助教 ==="
curl -s -X GET "http://127.0.0.1:8088/api/water-boards?shift=晚班" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'晚班数量: {len(d[\"data\"])}')"
```

**预期结果**：
- 早班筛选只返回 shift='早班' 的助教
- 晚班筛选只返回 shift='晚班' 的助教

---

## TC-04 [P0] 新接口：获取当天已同意加班小时数（批量）

**目的**：验证新增的批量加班小时数接口正确返回当天所有已审批同意的加班记录

> **注**：此接口为新开发接口，需求要求一次性批量返回所有当天审批同意的加班小时数。

**步骤**：
```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 调用批量加班小时数接口（接口路径待实现，预期为 /api/overtime-hours/today 或类似）
curl -s -X GET "http://127.0.0.1:8088/api/overtime-hours/today" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool
```

**预期结果**：
- 返回格式如：`{"success": true, "data": [{"coach_no": 10008, "hours": 3}, ...]}`
- 只返回当天（北京时间）status=1（已同意）的加班申请
- 包含 coach_no 和 hours 字段
- 无当天加班记录时返回空数组 `[]`

---

## TC-05 [P1] 准备测试数据：创建加班审批并审批通过

**目的**：为后续加班小时数显示测试准备数据

**步骤**：
```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 步骤1：查询下班助教中谁有手机号（用于提交申请）
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT c.coach_no, c.stage_name, c.shift, c.phone, c.employee_id, wb.status 
FROM coaches c 
JOIN water_boards wb ON c.coach_no = wb.coach_no 
WHERE wb.status = '下班' AND c.phone IS NOT NULL AND c.phone != ''
LIMIT 3;
"

# 步骤2：提交一个早加班申请（以有手机号的下班助教为例，假设手机号为PHONE）
# 注意：请替换PHONE为上面查询结果中的实际手机号
# 使用sqlite直接插入更快：
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO applications (applicant_phone, application_type, remark, extra_data, status, created_at, updated_at)
SELECT c.phone, '早加班申请', '加班3小时', '{\"hours\":3}', 0, datetime('now','localtime'), datetime('now','localtime')
FROM coaches c 
JOIN water_boards wb ON c.coach_no = wb.coach_no 
WHERE wb.status = '下班' AND c.phone IS NOT NULL AND c.phone != ''
LIMIT 1;
"

# 步骤3：获取刚插入的申请ID
APP_ID=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT id FROM applications WHERE status = 0 AND application_type = '早加班申请' ORDER BY id DESC LIMIT 1;")
echo "申请ID: $APP_ID"

# 步骤4：审批通过（status=1 表示同意）
curl -s -X PUT "http://127.0.0.1:8088/api/applications/$APP_ID/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"approver_phone":"tgadmin","status":1}' | python3 -m json.tool

# 步骤5：验证水牌状态已自动变为"早加班"
echo "=== 验证水牌状态 ==="
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT c.stage_name, wb.status FROM coaches c
JOIN water_boards wb ON c.coach_no = wb.coach_no
JOIN applications a ON a.applicant_phone = c.phone OR a.applicant_phone = c.employee_id
WHERE a.id = $APP_ID;
"
```

**预期结果**：
- 步骤2：成功插入申请记录，status=0（待处理）
- 步骤4：审批返回成功 `{"success": true, "data": {"status": 1, ...}}`
- 步骤5：该助教的水牌状态自动变为 "早加班"
- 注意：审批通过会自动将下班状态变为加班状态，所以测试加班小时数显示时需要重新设置一个下班状态的助教

---

## TC-06 [P0] 数据库验证：下班助教按班次分类

**目的**：验证下班助教可以根据班次（早班/晚班）正确分类，这是前端移入空闲组的基础

**步骤**：
```bash
echo "=== 下班助教按班次分类 ==="
sqlite3 -header -column /TG/tgservice/db/tgservice.db "
SELECT c.stage_name, c.shift, wb.status, wb.coach_no
FROM coaches c
JOIN water_boards wb ON c.coach_no = wb.coach_no
WHERE wb.status = '下班'
ORDER BY c.shift, c.stage_name;
"

echo "=== 早班空闲组助教 ==="
sqlite3 -header -column /TG/tgservice/db/tgservice.db "
SELECT c.stage_name, c.shift, wb.status, wb.coach_no
FROM coaches c
JOIN water_boards wb ON c.coach_no = wb.coach_no
WHERE wb.status = '早班空闲'
ORDER BY c.stage_name;
"

echo "=== 晚班空闲组助教 ==="
sqlite3 -header -column /TG/tgservice/db/tgservice.db "
SELECT c.stage_name, c.shift, wb.status, wb.coach_no
FROM coaches c
JOIN water_boards wb ON c.coach_no = wb.coach_no
WHERE wb.status = '晚班空闲'
ORDER BY c.stage_name;
"
```

**预期结果**：
- 下班助教中既有早班也有晚班的
- 早班空闲组和晚班空闲组都有助教存在
- 下班助教应根据 shift 值分别归入早班空闲/晚班空闲组

---

## TC-07 [P1] 准备测试数据：设置下班助教并创建已同意的加班申请

**目的**：准备一个"下班"状态的助教，且有当天已同意的加班申请，用于验证加班小时数显示

> ⚠️ 注意：TC-05中审批通过会将状态从"下班"变为"早加班"。我们需要另一个方案：
> 方案A：直接操作数据库插入已审批的加班记录和保持下班状态的助教
> 方案B：用另一个下班助教提交新申请

**步骤**：
```bash
# 步骤1：找到一个下班状态的助教（有手机号）
OFF_DUTY_COACH=$(sqlite3 /TG/tgservice/db/tgservice.db "
SELECT c.phone FROM coaches c
JOIN water_boards wb ON c.coach_no = wb.coach_no
WHERE wb.status = '下班' AND c.phone IS NOT NULL AND c.phone != ''
LIMIT 1;
")
echo "下班助教手机号: $OFF_DUTY_COACH"

if [ -z "$OFF_DUTY_COACH" ]; then
  echo "⚠️ 没有符合条件的下班助教，需要手动创建一个"
  # 创建一个测试助教（如果不存在）
  sqlite3 /TG/tgservice/db/tgservice.db "
  INSERT OR IGNORE INTO coaches (employee_id, stage_name, shift, phone) 
  VALUES ('999', '测试助教A', '早班', '19999999999');
  INSERT OR IGNORE INTO water_boards (coach_no, stage_name, status) 
  SELECT coach_no, stage_name, '下班' FROM coaches WHERE employee_id = '999';
  "
  OFF_DUTY_COACH="19999999999"
  echo "已创建测试助教，手机号: $OFF_DUTY_COACH"
fi

# 步骤2：确保该助教状态为下班
sqlite3 /TG/tgservice/db/tgservice.db "
UPDATE water_boards SET status = '下班' 
WHERE coach_no = (SELECT coach_no FROM coaches WHERE phone = '$OFF_DUTY_COACH');
"

# 步骤3：直接插入一条已同意(status=1)的加班申请（绕过审批流程，更快）
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO applications (applicant_phone, application_type, remark, extra_data, status, approve_time, created_at, updated_at)
VALUES (
  '$OFF_DUTY_COACH',
  '早加班申请',
  '加班4小时',
  '{\"hours\": 4}',
  1,
  datetime('now','localtime'),
  datetime('now','localtime'),
  datetime('now','localtime')
);
"
echo "已插入已同意的加班申请"

# 步骤4：验证数据
echo "=== 验证下班助教状态 ==="
sqlite3 -header -column /TG/tgservice/db/tgservice.db "
SELECT c.stage_name, c.shift, wb.status, a.id as app_id, a.status as app_status, a.extra_data
FROM coaches c
JOIN water_boards wb ON c.coach_no = wb.coach_no
LEFT JOIN applications a ON a.applicant_phone = c.phone AND a.status = 1
WHERE c.phone = '$OFF_DUTY_COACH';
"
```

**预期结果**：
- 助教 water_boards.status = '下班'
- applications.status = 1（已同意）
- applications.extra_data 包含 hours 字段（如 `{"hours": 4}`）

---

## TC-08 [P0] 验证水牌列表API返回下班助教完整数据

**目的**：确认下班助教在水牌列表API中有完整的 shift 信息，供前端判断归入哪个空闲组

**步骤**：
```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 获取全部水牌数据，检查下班助教的shift字段
curl -s -X GET "http://127.0.0.1:8088/api/water-boards?status=下班" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'下班助教总数: {len(d[\"data\"])}')
for r in d['data']:
    has_shift = r.get('shift') is not None and r['shift'] != ''
    print(f'  工号{r.get(\"employee_id\",\"?\")} {r[\"stage_name\"]} 班次={r.get(\"shift\",\"无\")} ✅' if has_shift else f'  工号{r.get(\"employee_id\",\"?\")} {r[\"stage_name\"]} 班次=❌缺失')
    assert has_shift, f'下班助教 {r[\"stage_name\"]} 缺少shift字段！'
print('✅ 所有下班助教都有shift字段')
"
```

**预期结果**：
- 所有下班助教的返回数据中都包含 `shift` 字段
- `shift` 值为 '早班' 或 '晚班'

---

## TC-09 [P1] 验证近期审批API可以筛选加班类型

**目的**：验证 GET /api/applications/approved-recent 可以正确筛选加班申请类型

**步骤**：
```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 获取近期已同意的加班申请
curl -s -X GET "http://127.0.0.1:8088/api/applications/approved-recent?application_types=早加班申请,晚加班申请&status=1&days=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -m json.tool
```

**预期结果**：
- 返回当天已同意(status=1)的早加班和晚加班申请
- 每条记录包含：coach_no, stage_name, hours, status, approve_time
- hours 字段应从 extra_data 或 remark 中正确解析

---

## TC-10 [P2] 验证更新水牌状态API - 下班→早班空闲

**目的**：验证下班助教可以通过API变更为空闲状态

**步骤**：
```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 找到一个下班状态的早班助教
COACH_NO=$(sqlite3 /TG/tgservice/db/tgservice.db "
SELECT wb.coach_no FROM water_boards wb
JOIN coaches c ON wb.coach_no = c.coach_no
WHERE wb.status = '下班' AND c.shift = '早班'
LIMIT 1;
")
echo "测试助教coach_no: $COACH_NO"

# 更新为早班空闲
curl -s -X PUT "http://127.0.0.1:8088/api/water-boards/$COACH_NO/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"status":"早班空闲"}' | python3 -m json.tool

# 验证状态已更新
echo "=== 验证状态 ==="
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT stage_name, status FROM water_boards WHERE coach_no = $COACH_NO;
"
```

**预期结果**：
- 更新API返回 `{"success": true, "data": {"status": "早班空闲"}}`
- 数据库中 status 已变为 '早班空闲'

---

## TC-11 [P1] 验证加班小时数解析逻辑

**目的**：验证后端正确从 extra_data 和 remark 两个来源解析加班小时数

**步骤**：
```bash
# 方式1：从extra_data解析（推荐方式）
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO applications (applicant_phone, application_type, remark, extra_data, status, approve_time, created_at, updated_at)
VALUES ('19999999998', '晚加班申请', '加班', '{\"hours\": 5}', 1, datetime('now','localtime'), datetime('now','localtime'), datetime('now','localtime'));
"

# 方式2：从remark解析（兼容方式）
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO applications (applicant_phone, application_type, remark, extra_data, status, approve_time, created_at, updated_at)
VALUES ('19999999997', '晚加班申请', '加班6小时', NULL, 1, datetime('now','localtime'), datetime('now','localtime'), datetime('now','localtime'));
"

ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

echo "=== 验证hours解析 ==="
curl -s -X GET "http://127.0.0.1:8088/api/applications/approved-recent?application_types=早加班申请,晚加班申请&status=1&days=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d['data']:
    if r.get('applicant_phone') in ['19999999998', '19999999997']:
        print(f'{r[\"stage_name\"]}: hours={r[\"hours\"]}, type={r[\"application_type\"]}')
"
```

**预期结果**：
- 19999999998 对应的记录 hours=5（从 extra_data 解析）
- 19999999997 对应的记录 hours=6（从 remark 解析 "加班6小时"）

---

## TC-12 [P0] 验证公安备案号 - 首页底部

**目的**：验证首页底部铭牌信息栏显示公安备案号

> 此功能为前端H5展示，API侧无直接接口。需要通过检查前端源码验证。

**步骤**：
```bash
# 检查 index.vue 源码中是否包含公安备案号
echo "=== 检查首页 index.vue ==="
grep -n "公安\|11010102000001" /TG/tgservice-uniapp/src/pages/index/index.vue

# 检查 plate-icp 附近的样式是否一致
grep -n "plate-icp\|plate-public-security\|plate-links" /TG/tgservice-uniapp/src/pages/index/index.vue | head -20
```

**预期结果**：
- 源码中包含 `京公网安备11010102000001号` 文本
- 公安备案号不使用超链接（与工信部备案号不同）
- 字体颜色与 `plate-icp` 一致（`#6a6040`）

---

## TC-13 [P0] 验证公安备案号 - 会员中心底部

**目的**：验证会员中心底部信息栏显示公安备案号

**步骤**：
```bash
# 检查 member.vue 源码中是否包含公安备案号
echo "=== 检查会员中心 member.vue ==="
grep -n "公安\|11010102000001" /TG/tgservice-uniapp/src/pages/member/member.vue

# 检查 footer-icp 附近的样式
grep -n "footer-icp\|footer-section\|footer-company" /TG/tgservice-uniapp/src/pages/member/member.vue | head -20
```

**预期结果**：
- 源码中包含 `京公网安备11010102000001号` 文本
- 公安备案号不使用超链接
- 字体颜色与 `footer-icp` 一致（`rgba(255,255,255,0.5)`）

---

## TC-14 [P1] 水牌筛选按钮验证 - 下班按钮应被删除

**目的**：验证前端代码中下班筛选按钮已被移除

**步骤**：
```bash
# 检查 water-board-view.vue 的 offStatusList 是否包含"下班"
echo "=== water-board-view.vue ==="
grep -n "offStatusList\|下班" /TG/tgservice-uniapp/src/pages/internal/water-board-view.vue

# 检查 water-board.vue 的 offStatusList 是否包含"下班"  
echo "=== water-board.vue ==="
grep -n "offStatusList\|下班" /TG/tgservice-uniapp/src/pages/internal/water-board.vue
```

**预期结果（改造后）**：
- `offStatusList` 数组中**不包含** '下班'（如 `['休息', '公休', '请假', '早加班', '晚加班']`）
- 筛选按钮区域不再渲染"下班"按钮
- 但 "下班" 状态仍然存在于 `statusList` 中（用于数据分类）

---

## TC-15 [P1] 下班助教卡片样式验证（前端源码检查）

**目的**：验证下班助教卡片的前端样式符合需求

**步骤**：
```bash
# 检查水牌查看页面
echo "=== water-board-view.vue 下班卡片样式 ==="
grep -n "下班\|off-duty\|avatar.*none\|display.*none\|深灰\|gray\|grey" /TG/tgservice-uniapp/src/pages/internal/water-board-view.vue

# 检查水牌管理页面
echo "=== water-board.vue 下班卡片样式 ==="
grep -n "下班\|off-duty\|avatar.*none\|display.*none\|深灰\|gray\|grey" /TG/tgservice-uniapp/src/pages/internal/water-board.vue
```

**预期结果（改造后）**：
- 下班助教卡片有专门的CSS类或条件样式
- `.coach-avatar` 在下班状态下 `display: none` 或 `visibility: hidden`
- 卡片背景色为深灰色（如 `#333` 或 `#444`）
- 有加班小时数的红色粗体显示元素（如 `color: red; font-weight: bold`）

---

## TC-16 [P1] 下班助教状态变为上班空闲后不再显示加班小时数

**目的**：验证下班助教状态从"下班"变为"上班空闲"后，卡片不再显示加班小时数

**步骤**：
```bash
# 步骤1：准备数据 - 找到或创建一个下班状态的助教
COACH_NO=$(sqlite3 /TG/tgservice/db/tgservice.db "
SELECT wb.coach_no FROM water_boards wb
JOIN coaches c ON wb.coach_no = c.coach_no
WHERE wb.status = '下班' AND c.shift = '早班' AND c.phone IS NOT NULL
LIMIT 1;
")
echo "测试助教 coach_no: $COACH_NO"

# 步骤2：确认该助教有当天已同意的加班申请
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT id, application_type, status, extra_data FROM applications 
WHERE applicant_phone = (SELECT phone FROM coaches WHERE coach_no = $COACH_NO)
AND status = 1;
"

# 步骤3：将状态从下班变为早班空闲
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -s -X PUT "http://127.0.0.1:8088/api/water-boards/$COACH_NO/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"status":"早班空闲"}' | python3 -m json.tool

# 步骤4：验证状态已变为早班空闲
echo "=== 验证状态 ==="
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT stage_name, status FROM water_boards WHERE coach_no = $COACH_NO;
"
```

**预期结果**：
- 步骤3：API返回成功
- 步骤4：status = '早班空闲'
- 前端逻辑：状态变为非下班状态后，即使有已同意的加班记录，卡片也不再显示加班小时数

---

## TC-17 [P2] 30秒自动刷新功能验证

**目的**：验证水牌页面每30秒自动刷新

**步骤**：
```bash
# 检查源码中的刷新间隔设置
echo "=== water-board-view.vue 刷新间隔 ==="
grep -n "REFRESH_INTERVAL\|setInterval\|30000\|30秒\|refreshTimer" /TG/tgservice-uniapp/src/pages/internal/water-board-view.vue

echo "=== water-board.vue 刷新间隔 ==="
grep -n "REFRESH_INTERVAL\|setInterval\|30000\|30秒\|refreshTimer" /TG/tgservice-uniapp/src/pages/internal/water-board.vue
```

**预期结果（改造后）**：
- 刷新间隔为 30000ms（30秒）
- 使用 `setInterval` 定时调用 `loadData()`
- 刷新时也调用加班小时数批量接口

---

## TC-18 [P2] 异常流程：无Token访问水牌API

**目的**：验证未认证请求被正确拒绝

**步骤**：
```bash
# 不带token请求
curl -s -X GET "http://127.0.0.1:8088/api/water-boards" | python3 -m json.tool
```

**预期结果**：
- 返回 401 状态码
- 返回错误信息（如 "请先登录" 或 "未授权"）

---

## TC-19 [P2] 异常流程：无效Token访问水牌API

**目的**：验证无效token被正确拒绝

**步骤**：
```bash
curl -s -X GET "http://127.0.0.1:8088/api/water-boards" \
  -H "Authorization: Bearer invalid_token_12345" | python3 -m json.tool
```

**预期结果**：
- 返回 401 状态码
- 返回错误信息

---

## TC-20 [P1] 数据库完整性检查：下班助教数据一致性

**目的**：确保下班助教在 coaches 表和 water_boards 表中的数据一致

**步骤**：
```bash
sqlite3 -header -column /TG/tgservice/db/tgservice.db "
SELECT 
  wb.coach_no,
  wb.stage_name as wb_name,
  c.stage_name as c_name,
  wb.status,
  c.shift,
  c.employee_id,
  CASE 
    WHEN wb.stage_name = c.stage_name THEN '✅一致'
    ELSE '❌不一致'
  END as name_match
FROM water_boards wb
JOIN coaches c ON wb.coach_no = c.coach_no
WHERE wb.status = '下班';
"
```

**预期结果**：
- 所有下班助教的 water_boards.stage_name 与 coaches.stage_name 一致
- 所有记录都有有效的 shift 值

---

## 测试优先级汇总

| 优先级 | 用例数 | 覆盖内容 |
|--------|--------|----------|
| **P0 核心** | TC-01,02,03,04,06,08,12,13 | 水牌API正常、筛选功能、加班小时数接口、下班助教shift分类、公安备案号 |
| **P1 重要** | TC-05,07,09,10,11,14,15,16,20 | 测试数据准备、审批API、状态更新、前端筛选按钮删除、卡片样式、状态切换 |
| **P2 次要** | TC-17,18,19 | 刷新功能、异常流程 |

---

## 附录：关键API参考

| API | 方法 | 路径 | 说明 |
|-----|------|------|------|
| 管理员登录 | POST | `/api/admin/login` | 获取管理员token |
| 助教登录 | POST | `/api/coach/login` | 获取助教token |
| 水牌列表 | GET | `/api/water-boards` | 获取所有水牌（支持status/shift筛选） |
| 单条水牌 | GET | `/api/water-boards/:coach_no` | 获取单个助教水牌 |
| 更新水牌 | PUT | `/api/water-boards/:coach_no/status` | 更新水牌状态 |
| 申请列表 | GET | `/api/applications` | 获取申请列表（支持status多值） |
| 提交申请 | POST | `/api/applications` | 提交加班/公休申请 |
| 审批申请 | PUT | `/api/applications/:id/approve` | 审批申请（status: 1=同意, 2=拒绝） |
| 近期审批 | GET | `/api/applications/approved-recent` | 获取近期已审批记录 |

## 数据库关键表

| 表名 | 用途 |
|------|------|
| `water_boards` | 水牌状态表（status字段） |
| `coaches` | 助教表（shift班次字段） |
| `applications` | 申请审批表（status: 0待处理/1同意/2拒绝） |

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