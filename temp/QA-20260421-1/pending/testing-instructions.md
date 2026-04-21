你是测试员B。请执行API接口测试。

## 测试地址
- 后端API：http://127.0.0.1:8088
- **严禁使用 8081 和 8083 端口！**

## 测试用例
```
# 天宫QA测试用例 - 20260421-1

## QA需求概述

1. **水牌等级标志**:在特定水牌状态(早班空闲/早班上桌/晚班空闲/晚班上桌/乐捐)的助教卡片上显示等级标志(初级-青铜、中级-白银、高级-黄金、女神-钻石)
2. **上班打卡提交截图**:助教上班打卡时需提交一张打卡截图证明,复用现有图片上传模块和打卡表
3. **打卡审查页面(H5内部页面)**：前台H5会员中心新增管理页面,显示近2天打卡记录,包含迟到判断逻辑

---

## 测试环境

- **测试地址**:http://127.0.0.1:8088(严禁使用8081/8083!)
- **数据库**:/TG/run/db/tgservice.db
- **测试策略**:仅API/curl测试,无浏览器测试

---

## 一、水牌等级标志测试用例

### 需求分析
- 后端水牌列表API需要返回助教等级字段
- 仅对特定状态显示等级:早班空闲、早班上桌、晚班空闲、晚班上桌、乐捐
- 等级类型:初级、中级、高级、女神

### P0 - 核心功能测试

#### TC-WB-001: 水牌列表返回等级字段 【P0】

**测试目的**:验证水牌列表API是否正确返回助教等级

**前置条件**:
- 数据库存在助教记录,level字段已填写

**测试步骤**:
```bash
# 1. 查看数据库中的助教等级
sqlite3 /TG/run/db/tgservice.db "SELECT coach_no, employee_id, stage_name, level FROM coaches LIMIT 5;"

# 2. 获取水牌列表API(需要认证token)
curl -s "http://127.0.0.1:8088/api/water-boards" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" | jq '.data[] | {coach_no, stage_name, status, level}'
```

**预期结果**:
- API返回的每条水牌记录应包含 `level` 字段
- `level` 值应为:初级/中级/高级/女神 之一
- 与数据库 coaches.level 一致

**验证SQL**:
```sql
-- 对比API返回与数据库
SELECT wb.coach_no, wb.stage_name, wb.status, c.level
FROM water_boards wb
LEFT JOIN coaches c ON wb.coach_no = c.coach_no
WHERE wb.status IN ('早班空闲', '早班上桌', '晚班空闲', '晚班上桌', '乐捐');
```

---

#### TC-WB-002: 特定状态显示等级验证 【P0】

**测试目的**:验证只对指定状态的水牌返回等级信息

**前置条件**:
- 存在各种状态的水牌记录

**测试步骤**:
```bash
# 获取所有水牌状态
curl -s "http://127.0.0.1:8088/api/water-boards" \
  -H "Authorization: Bearer <token>" | jq '.data[] | {coach_no, status, level}'

# 检查特定状态的等级字段
curl -s "http://127.0.0.1:8088/api/water-boards?status=早班空闲" \
  -H "Authorization: Bearer <token>" | jq '.data[].level'

curl -s "http://127.0.0.1:8088/api/water-boards?status=乐捐" \
  -H "Authorization: Bearer <token>" | jq '.data[].level'
```

**预期结果**:
- 状态为 早班空闲/早班上桌/晚班空闲/晚班上桌/乐捐 的记录,level字段有值
- 其他状态(下班/休息/公休/请假/早加班/晚加班)的记录,level字段可以为空或null(不影响显示)

---

#### TC-WB-003: 单个水牌详情返回等级 【P0】

**测试目的**:验证单个水牌API返回等级字段

**测试步骤**:
```bash
# 获取某个助教的水牌详情
curl -s "http://127.0.0.1:8088/api/water-boards/<coach_no>" \
  -H "Authorization: Bearer <token>" | jq '.data | {coach_no, stage_name, status, level}'
```

**预期结果**:
- 返回的 data 对象包含 level 字段
- level 与 coaches 表一致

---

### P1 - 边界情况测试

#### TC-WB-004: 等级为空的助教处理 【P1】

**测试目的**:验证等级字段为空时的处理

**测试步骤**:
```sql
-- 创建测试数据:等级为空的助教
INSERT INTO coaches (coach_no, employee_id, stage_name, level, shift)
VALUES (99991, 'TEST01', '测试助教', NULL, '早班');

-- 创建对应水牌
INSERT INTO water_boards (coach_no, stage_name, status)
VALUES (99991, '测试助教', '早班空闲');
```

```bash
curl -s "http://127.0.0.1:8088/api/water-boards?status=早班空闲" \
  -H "Authorization: Bearer <token>" | jq '.data[] | select(.coach_no==99991)'
```

**预期结果**:
- API正常返回,level为null或空字符串
- 前端应显示默认图标或不显示等级标志

**清理数据**:
```sql
DELETE FROM water_boards WHERE coach_no = 99991;
DELETE FROM coaches WHERE coach_no = 99991;
```

---

#### TC-WB-005: 等级值异常处理 【P1】

**测试目的**:验证等级值为非法值时的处理

**测试步骤**:
```sql
-- 创建测试数据:非法等级值
INSERT INTO coaches (coach_no, employee_id, stage_name, level, shift)
VALUES (99992, 'TEST02', '异常助教', '特级', '晚班');
INSERT INTO water_boards (coach_no, stage_name, status)
VALUES (99992, '异常助教', '晚班空闲');
```

```bash
curl -s "http://127.0.0.1:8088/api/water-boards/<coach_no>" \
  -H "Authorization: Bearer <token>" | jq '.data.level'
```

**预期结果**:
- API正常返回,level='特级'
- 前端应对非法等级做降级处理(显示默认或不显示)

**清理数据**:
```sql
DELETE FROM water_boards WHERE coach_no = 99992;
DELETE FROM coaches WHERE coach_no = 99992;
```

---

### P2 - 性能测试

#### TC-WB-006: 大量水牌查询性能 【P2】

**测试目的**:验证水牌列表查询性能

**测试步骤**:
```bash
# 查询所有水牌,检查响应时间
time curl -s "http://127.0.0.1:8088/api/water-boards" \
  -H "Authorization: Bearer <token>" > /dev/null
```

**预期结果**:
- 响应时间 < 500ms
- SQL使用JOIN而非子查询,性能良好

---

## 二、上班打卡提交截图测试用例

### 需求分析
- 上班打卡时需提交一张打卡截图
- 复用前端图片上传公共模块(图片提交到临时目录)
- 扩展 attendance_records 表,新增 clock_in_photo 字段

### 数据库变更检查
```sql
-- 检查 attendance_records 表是否有 clock_in_photo 字段
sqlite3 /TG/run/db/tgservice.db "PRAGMA table_info(attendance_records);"
```

**预期新增字段**:
```
clock_in_photo TEXT  -- 上班打卡截图URL
```

---

### P0 - 核心功能测试

#### TC-CK-001: 上班打卡API接口变更验证 【P0】

**测试目的**:验证打卡API支持接收截图参数

**前置条件**:
- 数据库 attendance_records 表已新增 clock_in_photo 字段
- 已准备好测试图片URL

**测试步骤**:
```bash
# 1. 查找一个测试助教
sqlite3 /TG/run/db/tgservice.db "SELECT coach_no, employee_id, stage_name, shift FROM coaches WHERE shift='早班' LIMIT 1;"

# 2. 模拟上班打卡请求(带截图)
curl -s -X POST "http://127.0.0.1:8088/api/coaches/<coach_no>/clock-in" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "clock_in_photo": "https://example.com/test-photo.jpg"
  }' | jq '.'
```

**预期结果**:
- API返回 success: true
- 数据库 attendance_records 表新增记录,clock_in_photo 字段有值

**验证SQL**:
```sql
SELECT id, coach_no, clock_in_time, clock_in_photo
FROM attendance_records
WHERE coach_no = <测试coach_no>
ORDER BY id DESC LIMIT 1;
```

---

#### TC-CK-002: 打卡记录包含照片字段验证 【P0】

**测试目的**:验证打卡记录查询返回照片字段

**测试步骤**:
```bash
# 需要先确认打卡审查API路径(假设为 /api/attendance-review)
curl -s "http://127.0.0.1:8088/api/attendance-review?date=<today>" \
  -H "Authorization: Bearer <token>" | jq '.data[] | {employee_id, clock_in_photo}'
```

**预期结果**:
- 每条打卡记录包含 clock_in_photo 字段
- 照片URL可访问或为null

---

#### TC-CK-003: 不提交截图时的打卡处理 【P0】

**测试目的**:验证不提交截图时打卡是否正常(根据业务规则可能必填或可选)

**测试步骤**:
```bash
# 不提交clock_in_photo参数
curl -s -X POST "http://127.0.0.1:8088/api/coaches/<coach_no>/clock-in" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'
```

**预期结果**(根据业务规则):
- 若必填:返回 400 error: "请提交打卡截图"
- 若可选:返回 success,clock_in_photo为null

---

### P1 - 边界情况测试

#### TC-CK-004: 无效图片URL处理 【P1】

**测试目的**:验证提交无效URL时的处理

**测试步骤**:
```bash
# 提交无效URL
curl -s -X POST "http://127.0.0.1:8088/api/coaches/<coach_no>/clock-in" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"clock_in_photo": "invalid-url"}' | jq '.'
```

**预期结果**:
- API不做URL有效性验证(仅存储)
- 返回success,数据库存储该值
- 前端显示时需处理无效URL

---

#### TC-CK-005: 图片上传OSS流程验证 【P1】

**测试目的**:验证前端图片上传到临时目录的流程

**说明**:此测试需要先获取OSS签名,前端流程:
1. 调用 `/api/upload/oss-signature` 获取签名
2. 使用签名上传图片到OSS
3. 获得URL后调用打卡API

**测试步骤**:
```bash
# 获取OSS签名(如果存在此API)
curl -s "http://127.0.0.1:8088/api/upload/oss-signature?dir=TgTemp" \
  -H "Authorization: Bearer <token>" | jq '.'
```

**预期结果**:
- 返回 OSS 签名信息(host, signature, policy等)
- 图片上传路径为 TgTemp/ 临时目录

---

### P2 - 数据一致性测试

#### TC-CK-006: 打卡照片与水牌状态关联 【P2】

**测试目的**:验证打卡后水牌状态与打卡记录一致性

**测试步骤**:
```bash
# 打卡后检查水牌状态
curl -s "http://127.0.0.1:8088/api/water-boards/<coach_no>" \
  -H "Authorization: Bearer <token>" | jq '.data.status'

# 检查打卡记录
sqlite3 /TG/run/db/tgservice.db "SELECT * FROM attendance_records WHERE coach_no=<coach_no> ORDER BY id DESC LIMIT 1;"
```

**预期结果**:
- 水牌状态变为 早班空闲/晚班空闲(根据shift)
- attendance_records 有对应记录,clock_in_photo有值

---

## 三、打卡审查页面测试用例(H5内部页面)

### 需求分析
- **页面位置**:前台H5内部页面 `/pages/internal/attendance-review.vue`
- **入口**:会员中心管理功能版块的管理分组
- 权限:店长/助教管理/管理员
- 显示近2天打卡记录(今天-早班/今天-晚班/昨天-早班/昨天-晚班 4个切换)
- 显示字段:工号、艺名、班次、上班打卡时间、下班时间、打卡记录照片、早晚加班小时数、是否迟到
- 迟到判断:应上班时间(早班14点,晚班18点,有加班顺延) < 实际上班打卡时间
- 排序:打卡时间倒序

### API路径
打卡审查API: `GET /api/attendance-review?date=YYYY-MM-DD&shift=早班/晚班`

---

### P0 - 核心功能测试

#### TC-AR-001: 打卡审查API权限验证 【P0】

**测试目的**:验证只有特定角色可访问打卡审查API

**前置条件**:
- 存在店长、助教管理、管理员角色用户

**测试步骤**:
```bash
# 1. 使用有权限的用户访问
curl -s "http://127.0.0.1:8088/api/attendance-review" \
  -H "Authorization: Bearer <manager_token>" | jq '.success'

# 2. 使用无权限的用户访问
curl -s "http://127.0.0.1:8088/api/attendance-review" \
  -H "Authorization: Bearer <coach_token>" | jq '.'
```

**预期结果**:
- 有权限用户返回 success: true
- 无权限用户返回 403 或权限错误

---

#### TC-AR-002: 打卡审查列表数据字段验证 【P0】

**测试目的**:验证返回数据包含所有必要字段

**前置条件**:
- 数据库存在近2天的打卡记录

**测试数据准备**:
```sql
-- 创建测试打卡记录(今天早班)
INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, clock_in_photo)
VALUES ('2026-04-21', 10002, '2', '陆飞', '2026-04-21 14:05:00', 'https://test.com/photo1.jpg');

-- 创建测试打卡记录(今天晚班)
INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, clock_in_photo)
VALUES ('2026-04-21', 10003, '3', '六六', '2026-04-21 18:30:00', 'https://test.com/photo2.jpg');

-- 创建迟到记录
INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, clock_in_photo)
VALUES ('2026-04-21', 10005, '5', '芝芝', '2026-04-21 14:30:00', 'https://test.com/photo3.jpg');
```

**测试步骤**:
```bash
curl -s "http://127.0.0.1:8088/api/attendance-review?date=2026-04-21&shift=早班" \
  -H "Authorization: Bearer <token>" | jq '.data[0]'
```

**预期返回字段**:
- employee_id(工号)
- stage_name(艺名)
- shift(班次)
- clock_in_time(上班打卡时间)
- clock_out_time(下班时间)
- clock_in_photo(打卡记录照片)
- overtime_hours(早晚加班小时数)
- is_late(是否迟到:true/false)

---

#### TC-AR-003: 迟到判断逻辑验证 【P0】

**测试目的**:验证迟到判断逻辑正确

**迟到判断规则**:
- 早班应上班时间:14:00
- 晚班应上班时间:18:00
- 有加班申请时,应上班时间顺延(如早班加班2小时,则应16:00上班)
- 实际打卡时间 > 应上班时间 → is_late = true

**测试数据准备**:
```sql
-- 查看今天日期
SELECT date('now', '+8 hours');

-- 创建早班加班申请(假设今天)
INSERT INTO applications (applicant_phone, application_type, status, extra_data, created_at)
SELECT employee_id, '早加班申请', 1, '{"hours":2}', datetime('now', '+8 hours')
FROM coaches WHERE shift='早班' LIMIT 1;

-- 创建测试打卡记录(不同迟到情况)
-- 正常打卡(14:05,无加班)
INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time)
SELECT datetime('now', '+8 hours', 'start of day'), coach_no, employee_id, stage_name, datetime('now', '+8 hours', 'start of day') || ' 14:05:00'
FROM coaches WHERE shift='早班' AND coach_no NOT IN (SELECT coach_no FROM attendance_records) LIMIT 1;

-- 迟到打卡(14:30,无加班)
INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time)
SELECT datetime('now', '+8 hours', 'start of day'), coach_no, employee_id, stage_name, datetime('now', '+8 hours', 'start of day') || ' 14:30:00'
FROM coaches WHERE shift='早班' LIMIT 1;
```

**测试步骤**:
```bash
# 查看今天的打卡审查(早班)
curl -s "http://127.0.0.1:8088/api/attendance-review?date=<today>&shift=早班" \
  -H "Authorization: Bearer <token>" | jq '.data[] | {stage_name, clock_in_time, overtime_hours, is_late}'
```

**预期结果**:
- clock_in_time <= 14:00 → is_late = false
- clock_in_time > 14:00 → is_late = true
- 有加班时,threshold顺延(如clock_in_time=14:05,有2小时加班,threshold=16:00 → is_late=false)

---

#### TC-AR-004: 日期筛选验证 【P0】

**测试目的**:验证按日期筛选功能

**测试步骤**:
```bash
# 查询今天的打卡记录
curl -s "http://127.0.0.1:8088/api/attendance-review?date=2026-04-21" \
  -H "Authorization: Bearer <token>" | jq '.data[].date'

# 查询昨天的打卡记录
curl -s "http://127.0.0.1:8088/api/attendance-review?date=2026-04-20" \
  -H "Authorization: Bearer <token>" | jq '.data[].date'

# 查询非近2天日期(应返回空或错误)
curl -s "http://127.0.0.1:8088/api/attendance-review?date=2026-04-19" \
  -H "Authorization: Bearer <token>" | jq '.'
```

**预期结果**:
- date=2026-04-21 返回当天记录
- date=2026-04-20 返回昨天记录
- date超出近2天范围,返回空数据或限制提示

---

#### TC-AR-005: 班次筛选验证 【P0】

**测试目的**:验证按班次筛选(早班/晚班)

**测试步骤**:
```bash
# 早班打卡记录
curl -s "http://127.0.0.1:8088/api/attendance-review?shift=早班" \
  -H "Authorization: Bearer <token>" | jq '.data[].shift'

# 晚班打卡记录
curl -s "http://127.0.0.1:8088/api/attendance-review?shift=晚班" \
  -H "Authorization: Bearer <token>" | jq '.data[].shift'
```

**预期结果**:
- shift=早班 返回早班助教打卡记录
- shift=晚班 返回晚班助教打卡记录
- 每条记录的shift字段与筛选参数一致

---

### P1 - 边界情况测试

#### TC-AR-006: 无打卡记录时返回空列表 【P1】

**测试目的**:验证无数据时的处理

**测试步骤**:
```bash
# 查询未来日期(无数据)
curl -s "http://127.0.0.1:8088/api/attendance-review?date=2099-01-01" \
  -H "Authorization: Bearer <token>" | jq '.'
```

**预期结果**:
- 返回 success: true, data: []
- 无报错

---

#### TC-AR-007: 打卡时间倒序排序验证 【P1】

**测试目的**:验证打卡记录按时间倒序排序

**测试数据准备**:
```sql
-- 创建多条同一天打卡记录(不同时间)
INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time)
VALUES ('2026-04-21', 10002, '2', '陆飞', '2026-04-21 14:05:00');

INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time)
VALUES ('2026-04-21', 10003, '3', '六六', '2026-04-21 14:30:00');

INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time)
VALUES ('2026-04-21', 10005, '5', '芝芝', '2026-04-21 15:00:00');
```

**测试步骤**:
```bash
curl -s "http://127.0.0.1:8088/api/attendance-review?date=2026-04-21" \
  -H "Authorization: Bearer <token>" | jq '.data | map(.clock_in_time)'
```

**预期结果**:
- 返回顺序:15:00 → 14:30 → 14:05(倒序)
- 最晚打卡时间排在最前

---

#### TC-AR-008: 加班小时数关联验证 【P1】

**测试目的**:验证加班小时数正确关联到打卡记录

**测试数据准备**:
```sql
-- 创建加班申请(已批准)
INSERT INTO applications (applicant_phone, application_type, status, extra_data, created_at)
VALUES ('2', '早加班申请', 1, '{"hours":3}', '2026-04-21 10:00:00');

-- 确保 coach_no=10002 的 employee_id='2'
```

**测试步骤**:
```bash
curl -s "http://127.0.0.1:8088/api/attendance-review?date=2026-04-21&shift=早班" \
  -H "Authorization: Bearer <token>" | jq '.data[] | select(.employee_id=="2") | {employee_id, overtime_hours}'
```

**预期结果**:
- employee_id='2' 的记录,overtime_hours=3
- 从 applications 表关联获取

---

#### TC-AR-009: 下班时间为空处理 【P1】

**测试目的**:验证未下班时 clock_out_time 为 null

**测试步骤**:
```bash
curl -s "http://127.0.0.1:8088/api/attendance-review" \
  -H "Authorization: Bearer <token>" | jq '.data[] | select(.clock_out_time==null)'
```

**预期结果**:
- 未下班的记录,clock_out_time 为 null
- 前端显示为"未下班"或"-""

---

### P2 - 性能测试

#### TC-AR-010: 大量打卡记录查询性能 【P2】

**测试目的**:验证大量数据时的查询性能

**测试数据准备**(批量创建):
```sql
-- 批量创建100条打卡记录
INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time)
SELECT '2026-04-21', coach_no, employee_id, stage_name,
       '2026-04-21 ' || printf('%02d', (14 + (rowid % 10))) || ':00:00'
FROM coaches
WHERE coach_no BETWEEN 10002 AND 10100;
```

**测试步骤**:
```bash
time curl -s "http://127.0.0.1:8088/api/attendance-review?date=2026-04-21" \
  -H "Authorization: Bearer <token>" > /dev/null
```

**预期结果**:
- 响应时间 < 1000ms
- 使用索引优化查询

---

## 四、权限测试用例

### P0 - 核心权限测试

#### TC-PERM-001: 打卡审查页面权限验证 【P0】

**测试目的**:验证权限配置正确

**角色权限矩阵**:
| 角色 | 水牌等级 | 打卡截图 | 打卡审查 |
|------|----------|----------|----------|
| 店长 | ✓ | ✓ | ✓ |
| 助教管理 | ✓ | ✓ | ✓ |
| 管理员 | ✓ | ✓ | ✓ |
| 普通助教 | ✓(只看自己) | ✓(只打自己) | ✗ |

**测试步骤**:
```bash
# 检查各角色权限配置
sqlite3 /TG/run/db/tgservice.db "SELECT * FROM admin_users WHERE role IN ('店长', '助教管理', '管理员', 'coach');"

# 使用不同角色访问打卡审查API
curl -s "http://127.0.0.1:8088/api/attendance-review" \
  -H "Authorization: Bearer <店长_token>" | jq '.success'

curl -s "http://127.0.0.1:8088/api/attendance-review" \
  -H "Authorization: Bearer <助教_token>" | jq '.'
```

**预期结果**:
- 店长/助教管理/管理员 → success: true
- 普通助教 → 403 forbidden

---

## 五、数据完整性测试用例

### P1 - 数据关联测试

#### TC-DATA-001: 打卡记录与助教信息关联 【P1】

**测试目的**:验证打卡记录中的工号、艺名与coaches表一致

**测试步骤**:
```sql
-- 验证数据关联正确性
SELECT ar.*, c.level, c.shift
FROM attendance_records ar
LEFT JOIN coaches c ON ar.coach_no = c.coach_no
WHERE ar.date >= date('now', '-2 days', '+8 hours');
```

**预期结果**:
- 所有记录都能正确关联到coaches表
- 无孤儿记录(coach_no不存在)

---

## 测试执行顺序建议

### 第一轮:P0用例(必须通过)
1. TC-WB-001 → TC-WB-002 → TC-WB-003(水牌等级)
2. TC-CK-001 → TC-CK-002 → TC-CK-003(打卡截图)
3. TC-AR-001 → TC-AR-002 → TC-AR-003 → TC-AR-004 → TC-AR-005(打卡审查)
4. TC-PERM-001(权限)

### 第二轮:P1用例(重要边界)
1. TC-WB-004 → TC-WB-005
2. TC-CK-004 → TC-CK-005
3. TC-AR-006 → TC-AR-007 → TC-AR-008 → TC-AR-009
4. TC-DATA-001

### 第三轮:P2用例(性能)
1. TC-WB-006
2. TC-CK-006
3. TC-AR-010

---

## 测试数据清理脚本

```bash
# 清理所有测试数据
sqlite3 /TG/run/db/tgservice.db "
DELETE FROM attendance_records WHERE coach_no >= 99990;
DELETE FROM water_boards WHERE coach_no >= 99990;
DELETE FROM coaches WHERE coach_no >= 99990;
DELETE FROM applications WHERE applicant_phone LIKE 'TEST%';
"
```

---

## 附录:API接口列表(待确认)

| 功能 | API路径 | 方法 | 状态 |
|------|---------|------|------|
| 水牌列表 | /api/water-boards | GET | 已存在 |
| 单个水牌 | /api/water-boards/:coach_no | GET | 已存在 |
| 上班打卡 | /api/coaches/:coach_no/clock-in | POST | 已存在 |
| 下班打卡 | /api/coaches/:coach_no/clock-out | POST | 已存在 |
| 打卡审查 | /api/attendance-review | GET | **待新增** |
| OSS签名 | /api/upload/oss-signature | GET | 需确认 |
| 加班小时数 | /api/applications/today-approved-overtime | GET | 已存在 |

---

## 注意事项

1. **严禁使用8081/8083端口**,测试地址固定为 http://127.0.0.1:8088
2. **使用现有数据**:优先使用sqlite3查询现成数据,无数据时才INSERT创建
3. **时间处理**:所有时间使用北京时间(+8小时)
4. **权限验证**:每个API都需携带有效Authorization token
5. **清理测试数据**:测试完成后清理临时数据

---

*测试用例编写完成 - 测试员B*
*日期:2026-04-21*
```

## 测试策略
- **只用 API/curl 测试，不需要浏览器测试**
- 核心测试：通过 curl 调用后端API，验证接口逻辑
- 测试数据：先用 sqlite3 查数据库找现成数据，没有就直接 INSERT 创建
- 不要反复调 API 找数据，直接操作数据库更快

## curl 测试示例
```bash
# 查询
curl -s http://127.0.0.1:8088/api/xxx?param=value

# 提交
curl -s -X POST http://127.0.0.1:8088/api/xxx \
  -H 'Content-Type: application/json' \
  -d '{"key":"value"}'
```

## 验证要点
- 状态码是否符合预期（200/400/404）
- 响应体中的 success 字段
- 数据库中的数据是否正确写入

## 验收重点
设计概要必须给用户确认后才能编码

## 输出要求
- 测试结果写入：/TG/temp/QA-20260421-1/test-results.md
- 格式：表格（用例ID、测试项、优先级、预期结果、实际结果、状态）
- 状态：✅通过 / ❌失败 / ⏭️跳过