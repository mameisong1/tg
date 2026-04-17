你是QA审计员。请审计以下测试用例。

## 测试用例内容
```
# 规约客统计页面 - API 测试用例

> **QA编号**: QA-20260417-05  
> **测试员**: B  
> **后端地址**: `http://127.0.0.1:8088`  
> **测试策略**: 纯 API/curl 测试 + SQLite 直接操作数据库  
> **创建日期**: 2026-04-17

---

## 目录

- [前置准备：登录获取 Token](#前置准备登录获取-token)
- [测试数据准备](#测试数据准备)
- [TC01-P0: 统计周期-昨天](#tc01-p0-统计周期-昨天)
- [TC02-P0: 统计周期-前天](#tc02-p0-统计周期-前天)
- [TC03-P0: 统计周期-本月](#tc03-p0-统计周期-本月)
- [TC04-P0: 统计周期-上月](#tc04-p0-统计周期-上月)
- [TC05-P0: 约课率算法正确性](#tc05-p0-约课率算法正确性)
- [TC06-P0: 漏约助教一览表-数据完整性](#tc06-p0-漏约助教一览表-数据完整性)
- [TC07-P0: 漏约助教一览表-排序正确性](#tc07-p0-漏约助教一览表-排序正确性)
- [TC08-P1: 权限控制-有权限角色可访问](#tc08-p1-权限控制-有权限角色可访问)
- [TC09-P1: 权限控制-无权限角色不可访问](#tc09-p1-权限控制-无权限角色不可访问)
- [TC10-P1: 异常流程-无效统计周期参数](#tc10-p1-异常流程-无效统计周期参数)
- [TC11-P1: 异常流程-缺少参数](#tc11-p1-异常流程-缺少参数)
- [TC12-P2: 空数据周期返回](#tc12-p2-空数据周期返回)
- [TC13-P2: 仅含待审查记录的周期](#tc13-p2-仅含待审查记录的周期)
- [TC14-P2: 漏约助教头像字段完整性](#tc14-p2-漏约助教头像字段完整性)
- [TC15-P0: 未约人数统计准确性](#tc15-p0-未约人数统计准确性)
- [TC16-P0: 有效约课人数统计准确性](#tc16-p0-有效约课人数统计准确性)
- [TC17-P0: 无效约课人数统计准确性](#tc17-p0-无效约课人数统计准确性)

---

## 前置准备：登录获取 Token

所有测试用例需要先登录获取 admin token。以下三种角色需要分别获取 token：

### 获取管理员 Token（有权限）

```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

echo "ADMIN_TOKEN=$ADMIN_TOKEN"
```

### 获取店长 Token（有权限）

```bash
MANAGER_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"18680174119","password":"这里需确认店长密码"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

echo "MANAGER_TOKEN=$MANAGER_TOKEN"
```

### 获取助教管理 Token（有权限）

```bash
COACH_MGR_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"13760517760","password":"这里需确认密码"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

echo "COACH_MGR_TOKEN=$COACH_MGR_TOKEN"
```

### 获取教练 Token（无权限）

```bash
COACH_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/coach/login \
  -H 'Content-Type: application/json' \
  -d '{"employee_id":"1","stage_name":"歪歪","idCardLast6":"这里需确认"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('coachToken',''))")

echo "COACH_TOKEN=$COACH_TOKEN"
```

> **注**: 以上 curl 命令中的密码/idCardLast6 需根据实际情况填写，或使用已知的测试账号。

---

## 测试数据准备

> **策略**: 先用现有数据，不够则用 sqlite3 直接 INSERT。

### 当前数据库数据概览

```bash
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT date, shift, result, COUNT(*) as cnt
FROM guest_invitation_results 
GROUP BY date, shift, result 
ORDER BY date DESC, shift, result;
"
```

**现有数据（截至 2026-04-17）：**

| 日期 | 班次 | 结果 | 数量 | 助教 |
|------|------|------|------|------|
| 2026-04-15 | 早班 | 待审查 | 1 | 豆豆 |
| 2026-04-14 | 早班 | 应约客 | 2 | 安娜, 敏儿 |
| 2026-04-14 | 早班 | 约客有效 | 15 | 歪歪, 小雨, 柳柳 等 |
| 2026-04-14 | 晚班 | 应约客 | 2 | 六九, kimi |
| 2026-04-14 | 晚班 | 待审查 | 1 | 豆豆 |
| 2026-04-14 | 晚班 | 约客有效 | 13 | 恩恩, 四瑶, 江江 等 |
| 2026-04-13 | 晚班 | 应约客 | 7 | 雪梨, 莫莫, 恩恩 等 |
| 2026-04-13 | 晚班 | 约客有效 | 4 | 小涵, 快乐, 莲宝, 小唯 |

### 数据分类映射规则

| 需求术语 | 数据对应 |
|----------|----------|
| 未约课人数 | result IN ('应约客', '待审查') 的记录数（应约但未提交或待审查的） |
| 有效约课人数 | result = '约客有效' 的记录数 |
| 无效约课人数 | result = '约客无效' 的记录数（如没有则为0） |
| 应约客人数 | 未约 + 有效 + 无效（总和） |
| 约课率 | 有效约课人数 / 应约客人数 |
| 漏约助教 | result IN ('应约客', '约客无效') 的助教，按出现次数倒序 |

### 补充测试数据（如需）

若需补充 `约客无效` 数据或更多日期数据，使用以下 SQL：

```bash
# 插入 约客无效 记录（4月14日早班）
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT OR IGNORE INTO guest_invitation_results 
  (date, shift, coach_no, stage_name, invitation_image_url, result, created_at, updated_at)
VALUES 
  ('2026-04-14', '早班', 10003, '六六', 'https://example.com/img1.jpg', '约客无效', datetime('now'), datetime('now')),
  ('2026-04-14', '早班', 10005, '芝芝', 'https://example.com/img2.jpg', '约客无效', datetime('now'), datetime('now')),
  ('2026-04-13', '晚班', 10001, '歪歪', 'https://example.com/img3.jpg', '约客无效', datetime('now'), datetime('now')),
  ('2026-04-13', '晚班', 10001, '歪歪', 'https://example.com/img4.jpg', '约客无效', datetime('now'), datetime('now'))
  -- 注意: 歪歪在4/13有2条无效记录，用于测试排序
;
"
```

### 预期计算验证（以 4月14日 为"昨天"为例）

```
4月14日 数据:
  早班: 应约客2人(安娜,敏儿) + 约客有效15人 + 约客无效0人 = 17人
  晚班: 应约客2人(六九,kimi) + 待审查1人(豆豆) + 约客有效13人 + 约客无效0人 = 16人
  合计:
    未约 = 应约客(4) + 待审查(1) = 5
    有效 = 15 + 13 = 28
    无效 = 0
    应约客总人数 = 5 + 28 + 0 = 33
    约课率 = 28 / 33 = 84.85%
  漏约助教: 安娜(1), 敏儿(1), 六九(1), kimi(1) — 各1次，并列
```

> **注意**: 实际 API 实现可能对「未约」的定义不同（比如只算 result='应约客' 不含 '待审查'），
> 测试时需根据 API 实际实现调整预期结果。

---

## 测试用例

> **API 设计假设**: 新规约客统计 API 路径为 `GET /api/guest-invitations/booking-stats`，
> 接受 query 参数 `period`（昨天|前天|本月|上月）。
> 若实际实现路径或参数名不同，请相应调整 curl 命令。

---

### TC01-P0: 统计周期-昨天

**优先级**: P0（核心功能）  
**目标**: 验证 period=昨天 时，返回昨日（4月16日，若无数据则4月14日）的统计数据

**操作步骤**:

```bash
# 1. 获取 token
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

# 2. 请求统计数据（昨天）
curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=昨天" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -m json.tool
```

**预期结果**:
- HTTP 状态码 200
- 返回 JSON 包含以下字段:
  - `period`: "昨天"
  - `date_range`: { start: "YYYY-MM-DD", end: "YYYY-MM-DD" } （昨天的日期范围）
  - `unbooked_count`: 未约课人数（数字）
  - `effective_count`: 有效约课人数（数字）
  - `invalid_count`: 无效约课人数（数字）
  - `booking_rate`: 约课率（小数或百分比字符串）
  - `missed_coaches`: 漏约助教列表（数组）
- 数据统计范围仅覆盖昨天一天的所有班次

---

### TC02-P0: 统计周期-前天

**优先级**: P0（核心功能）  
**目标**: 验证 period=前天 时，返回前天的统计数据

**操作步骤**:

```bash
curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=前天" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -m json.tool
```

**预期结果**:
- HTTP 状态码 200
- `period`: "前天"
- `date_range` 覆盖前天的日期
- 统计数据仅包含前天的记录
- 各人数统计与数据库中前天数据一致

---

### TC03-P0: 统计周期-本月

**优先级**: P0（核心功能）  
**目标**: 验证 period=本月 时，返回本月（4月1日至4月16日）的累计统计数据

**操作步骤**:

```bash
curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=本月" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -m json.tool
```

**预期结果**:
- HTTP 状态码 200
- `period`: "本月"
- `date_range`: { start: "2026-04-01", end: "2026-04-16" }
- `unbooked_count` = 本月所有日期中 result IN ('应约客', '待审查') 的记录总数
- `effective_count` = 本月所有日期中 result = '约客有效' 的记录总数
- `invalid_count` = 本月所有日期中 result = '约客无效' 的记录总数
- `booking_rate` = effective_count / (unbooked_count + effective_count + invalid_count)
- `missed_coaches` 包含本月所有有漏约记录的助教

**手动验证 SQL**:

```bash
# 验证本月有效人数
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT COUNT(*) FROM guest_invitation_results 
WHERE date >= '2026-04-01' AND date <= '2026-04-16'
AND result = '约客有效';
"

# 验证本月未约人数
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT COUNT(*) FROM guest_invitation_results 
WHERE date >= '2026-04-01' AND date <= '2026-04-16'
AND result IN ('应约客', '待审查');
"

# 验证本月无效人数
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT COUNT(*) FROM guest_invitation_results 
WHERE date >= '2026-04-01' AND date <= '2026-04-16'
AND result = '约客无效';
"
```

---

### TC04-P0: 统计周期-上月

**优先级**: P0（核心功能）  
**目标**: 验证 period=上月 时，返回上月（3月1日至3月31日）的累计统计数据

**操作步骤**:

```bash
curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=上月" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -m json.tool
```

**预期结果**:
- HTTP 状态码 200
- `period`: "上月"
- `date_range`: { start: "2026-03-01", end: "2026-03-31" }
- 统计只覆盖3月份的数据
- 若3月份无数据，则所有计数为0，约课率为0或null，missed_coaches为空数组

---

### TC05-P0: 约课率算法正确性

**优先级**: P0（核心验收重点）  
**目标**: 验证约课率 = 有效约课人数 / 应约客人数

**操作步骤**:

```bash
# 1. 请求统计数据
RESPONSE=$(curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=本月" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "$RESPONSE" | python3 -m json.tool

# 2. 用 python3 验证算法
echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin).get('data', json.load(sys.stdin))
unbooked = data.get('unbooked_count', 0)
effective = data.get('effective_count', 0)
invalid = data.get('invalid_count', 0)
rate = data.get('booking_rate', 0)

should_invite = unbooked + effective + invalid
expected_rate = round(effective / should_invite, 4) if should_invite > 0 else 0

print(f'未约: {unbooked}, 有效: {effective}, 无效: {invalid}')
print(f'应约客总人数: {should_invite}')
print(f'API返回约课率: {rate}')
print(f'预期约课率: {expected_rate}')

# 判断是否一致（允许小数误差）
if isinstance(rate, str):
    rate = float(rate.strip('%')) / 100 if '%' in rate else float(rate)

if abs(rate - expected_rate) < 0.001:
    print('✅ 约课率计算正确')
else:
    print(f'❌ 约课率计算错误: 期望 {expected_rate}, 实际 {rate}')
"
```

**预期结果**:
- 约课率 = effective_count / (unbooked_count + effective_count + invalid_count)
- 当应约客总人数为0时，约课率应为 0 或 null（不能报错或除零）
- 验证脚本输出 "✅ 约课率计算正确"

---

### TC06-P0: 漏约助教一览表-数据完整性

**优先级**: P0（核心验收重点）  
**目标**: 验证漏约助教列表包含所有应约客和无效约客的助教

**操作步骤**:

```bash
# 1. 获取 API 返回的漏约助教列表
curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=本月" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(f'{c.get(\"coach_no\",\"?\")} | {c.get(\"stage_name\",\"?\")} | {c.get(\"missed_count\",\"?\")}') for c in d.get('data',d).get('missed_coaches',[])]"

# 2. 用 SQL 验证预期数据
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT coach_no, stage_name, COUNT(*) as missed_count
FROM guest_invitation_results
WHERE date >= '2026-04-01' AND date <= '2026-04-16'
  AND result IN ('应约客', '约客无效')
GROUP BY coach_no
ORDER BY missed_count DESC;
"
```

**预期结果**:
- API 返回的 `missed_coaches` 数组中，每个助教对象包含:
  - `coach_no`: 助教编号/工号（非空）
  - `employee_id`: 工号（如有）
  - `stage_name`: 艺名（非空）
  - `avatar` / `photos`: 头像 URL（非空或合理默认值）
  - `missed_count`: 漏约次数（正整数）
- API 返回的助教列表与 SQL 查询结果一致（数量、工号、漏约次数相同）

---

### TC07-P0: 漏约助教一览表-排序正确性

**优先级**: P0（核心验收重点）  
**目标**: 验证漏约助教按漏约次数倒序排列

**操作步骤**:

```bash
# 1. 准备测试数据：确保有漏约次数不同的助教
# 先用 sqlite3 插入多条约客无效记录，制造漏约次数差异
sqlite3 /TG/tgservice/db/tgservice.db "
-- 确保豆豆有3次漏约
INSERT OR IGNORE INTO guest_invitation_results 
  (date, shift, coach_no, stage_name, result, created_at, updated_at)
VALUES 
  ('2026-04-10', '早班', 10040, '豆豆', '约客无效', datetime('now'), datetime('now')),
  ('2026-04-11', '早班', 10040, '豆豆', '约客无效', datetime('now'), datetime('now'));

-- 确保小雪有2次漏约  
INSERT OR IGNORE INTO guest_invitation_results 
  (date, shift, coach_no, stage_name, result, created_at, updated_at)
VALUES 
  ('2026-04-10', '晚班', 10045, '小雪', '应约客', datetime('now'), datetime('now')),
  ('2026-04-11', '晚班', 10045, '小雪', '约客无效', datetime('now'), datetime('now'));
"

# 2. 请求数据
RESPONSE=$(curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=本月" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

# 3. 验证排序
echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin).get('data', json.load(sys.stdin))
coaches = data.get('missed_coaches', [])

if not coaches:
    print('⚠️  漏约助教列表为空，无法验证排序')
    sys.exit(0)

counts = [c.get('missed_count', 0) for c in coaches]
is_sorted_desc = all(counts[i] >= counts[i+1] for i in range(len(counts)-1))

print('漏约次数序列:', counts)
if is_sorted_desc:
    print('✅ 排序正确: 按漏约次数倒序排列')
else:
    print('❌ 排序错误: 未按漏约次数倒序排列')
    # 找出排序错误的位置
    for i in range(len(counts)-1):
        if counts[i] < counts[i+1]:
            print(f'   位置 {i} ({counts[i]}) < 位置 {i+1} ({counts[i+1]})')
"
```

**预期结果**:
- 验证脚本输出 "✅ 排序正确"
- 漏约次数高的助教排在前面
- 漏约次数相同的助教，排序可任意（不做严格要求）

---

### TC08-P1: 权限控制-有权限角色可访问

**优先级**: P1（重要）  
**目标**: 验证店长、助教管理、管理员角色可以正常访问统计 API

**操作步骤**:

```bash
# 1. 管理员
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

ADMIN_RESULT=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=本月" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "管理员访问: HTTP $ADMIN_RESULT"

# 2. 店长（需确认密码）
MANAGER_RESULT=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=本月" \
  -H "Authorization: Bearer $MANAGER_TOKEN")

echo "店长访问: HTTP $MANAGER_RESULT"

# 3. 助教管理（需确认密码）
COACH_MGR_RESULT=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=本月" \
  -H "Authorization: Bearer $COACH_MGR_TOKEN")

echo "助教管理访问: HTTP $COACH_MGR_RESULT"
```

**预期结果**:
- 管理员: HTTP 200
- 店长: HTTP 200
- 助教管理: HTTP 200
- 所有角色都能获取完整的统计数据

---

### TC09-P1: 权限控制-无权限角色不可访问

**优先级**: P1（重要）  
**目标**: 验证教练、前厅管理、收银等角色无法访问统计 API

**操作步骤**:

```bash
# 使用教练 token 访问（教练无 invitationStats 权限）
COACH_TOKEN="<教练token>"  # 需通过 /api/coach/login 获取

COACH_RESULT=$(curl -s -w "\n%{http_code}" \
  -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=本月" \
  -H "Authorization: Bearer $COACH_TOKEN")

echo "教练访问结果:"
echo "$COACH_RESULT"
```

**预期结果**:
- HTTP 状态码 403
- 返回错误信息包含 "权限不足" 或类似提示
- 不返回任何统计数据

---

### TC10-P1: 异常流程-无效统计周期参数

**优先级**: P1（重要）  
**目标**: 验证传入无效的 period 参数时，API 返回合理的错误

**操作步骤**:

```bash
# 1. 传入不合法的 period
curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=本周" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

echo ""

# 2. 传入空值
curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

echo ""

# 3. 传入完全不相关的值
curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=hello" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**预期结果**:
- HTTP 状态码 400
- 返回错误信息，说明 period 参数无效
- 可选的合法值应为: 昨天、前天、本月、上月

---

### TC11-P1: 异常流程-缺少参数

**优先级**: P1（重要）  
**目标**: 验证不传 period 参数时，API 返回合理的错误

**操作步骤**:

```bash
# 不传 period 参数
curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**预期结果**:
- HTTP 状态码 400
- 返回错误信息，提示缺少 period 参数

---

### TC12-P2: 空数据周期返回

**优先级**: P2（次要）  
**目标**: 验证统计周期内无任何数据时的返回

**操作步骤**:

```bash
# 假设某月没有任何约客记录
curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=上月" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -m json.tool
```

**预期结果**:
- HTTP 状态码 200（不是错误）
- `unbooked_count`: 0
- `effective_count`: 0
- `invalid_count`: 0
- `booking_rate`: 0 或 null
- `missed_coaches`: [] (空数组)

---

### TC13-P2: 仅含待审查记录的周期

**优先级**: P2（次要）  
**目标**: 验证周期内只有待审查记录时，统计是否正确

**操作步骤**:

```bash
# 1. 先确认当前待审查数据
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT date, shift, coach_no, stage_name, result 
FROM guest_invitation_results 
WHERE result = '待审查';
"

# 2. 请求包含待审查数据的周期
curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=昨天" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -m json.tool
```

**预期结果**:
- 待审查记录应计入 "未约课人数"（因为尚未确认有效或无效）
- 约课率 = 0 / (未约 + 0 + 0) = 0%
- 待审查记录中的助教应出现在漏约助教列表中

---

### TC14-P2: 漏约助教头像字段完整性

**优先级**: P2（次要）  
**目标**: 验证漏约助教列表中包含头像信息

**操作步骤**:

```bash
# 请求数据并检查头像字段
curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=本月" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin).get('data', json.load(sys.stdin))
coaches = data.get('missed_coaches', [])

if not coaches:
    print('⚠️  无漏约助教，跳过头像检查')
    sys.exit(0)

for c in coaches:
    has_avatar = bool(c.get('avatar') or c.get('photos') or c.get('head_url') or c.get('avatar_url'))
    print(f'{c.get(\"stage_name\",\"?\")}: 头像字段={\"✅ 有\" if has_avatar else \"⚠️ 无\"} ({list(c.keys())})')
"
```

**预期结果**:
- 每个助教对象中至少有一个头像字段（`avatar`、`photos`、`head_url` 等）
- 头像字段值为有效的 URL 字符串，或合理的默认头像
- 若无头像，应有处理（如默认头像或 null，但不应为空对象）

---

### TC15-P0: 未约人数统计准确性

**优先级**: P0（核心）  
**目标**: 验证未约课人数 = 应约客 + 待审查 记录总数

**操作步骤**:

```bash
# 1. SQL 统计预期值
EXPECTED=$(sqlite3 /TG/tgservice/db/tgservice.db "
SELECT COUNT(*) FROM guest_invitation_results 
WHERE date >= '2026-04-01' AND date <= '2026-04-16'
AND result IN ('应约客', '待审查');
")
echo "SQL预期未约人数: $EXPECTED"

# 2. API 返回
API_UNBOOKED=$(curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=本月" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',d).get('unbooked_count','MISSING'))")

echo "API返回未约人数: $API_UNBOOKED"

# 3. 对比
if [ "$EXPECTED" = "$API_UNBOOKED" ]; then
    echo "✅ 未约人数统计正确"
else
    echo "❌ 未约人数统计不一致: 期望 $EXPECTED, 实际 $API_UNBOOKED"
fi
```

**预期结果**:
- API 返回的 `unbooked_count` 与 SQL 查询结果一致

---

### TC16-P0: 有效约课人数统计准确性

**优先级**: P0（核心）  
**目标**: 验证有效约课人数 = 约客有效 记录总数

**操作步骤**:

```bash
# 1. SQL 统计预期值
EXPECTED=$(sqlite3 /TG/tgservice/db/tgservice.db "
SELECT COUNT(*) FROM guest_invitation_results 
WHERE date >= '2026-04-01' AND date <= '2026-04-16'
AND result = '约客有效';
")
echo "SQL预期有效人数: $EXPECTED"

# 2. API 返回
API_EFFECTIVE=$(curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=本月" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',d).get('effective_count','MISSING'))")

echo "API返回有效人数: $API_EFFECTIVE"

# 3. 对比
if [ "$EXPECTED" = "$API_EFFECTIVE" ]; then
    echo "✅ 有效约课人数统计正确"
else
    echo "❌ 有效约课人数统计不一致: 期望 $EXPECTED, 实际 $API_EFFECTIVE"
fi
```

**预期结果**:
- API 返回的 `effective_count` 与 SQL 查询结果一致

---

### TC17-P0: 无效约课人数统计准确性

**优先级**: P0（核心）  
**目标**: 验证无效约课人数 = 约客无效 记录总数

**操作步骤**:

```bash
# 1. 确保有约客无效数据（如无则插入）
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT OR IGNORE INTO guest_invitation_results 
  (date, shift, coach_no, stage_name, invitation_image_url, result, created_at, updated_at)
VALUES 
  ('2026-04-10', '早班', 10003, '六六', 'https://example.com/invalid.jpg', '约客无效', datetime('now'), datetime('now'));
"

# 2. SQL 统计预期值
EXPECTED=$(sqlite3 /TG/tgservice/db/tgservice.db "
SELECT COUNT(*) FROM guest_invitation_results 
WHERE date >= '2026-04-01' AND date <= '2026-04-16'
AND result = '约客无效';
")
echo "SQL预期无效人数: $EXPECTED"

# 3. API 返回
API_INVALID=$(curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/booking-stats?period=本月" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',d).get('invalid_count','MISSING'))")

echo "API返回无效人数: $API_INVALID"

# 4. 对比
if [ "$EXPECTED" = "$API_INVALID" ]; then
    echo "✅ 无效约课人数统计正确"
else
    echo "❌ 无效约课人数统计不一致: 期望 $EXPECTED, 实际 $API_INVALID"
fi
```

**预期结果**:
- API 返回的 `invalid_count` 与 SQL 查询结果一致

---

## 测试数据恢复脚本

> 测试完成后，如需清理测试插入的数据，可运行以下 SQL：

```bash
sqlite3 /TG/tgservice/db/tgservice.db "
-- 删除测试期间手动插入的数据（根据实际插入的记录调整 WHERE 条件）
DELETE FROM guest_invitation_results 
WHERE coach_no = 10045  -- 测试用助教'小雪'
  AND date IN ('2026-04-10', '2026-04-11');

-- 如果也插入了豆豆的测试数据
DELETE FROM guest_invitation_results 
WHERE coach_no = 10040 
  AND date IN ('2026-04-10', '2026-04-11')
  AND result = '约客无效';
"
```

---

## 测试结果记录表

| 用例编号 | 优先级 | 测试目标 | 预期结果 | 实际结果 | 状态 | 备注 |
|---------|--------|---------|---------|---------|------|------|
| TC01 | P0 | 统计周期-昨天 | 返回昨天数据 | | ⬜ | |
| TC02 | P0 | 统计周期-前天 | 返回前天数据 | | ⬜ | |
| TC03 | P0 | 统计周期-本月 | 返回本月累计数据 | | ⬜ | |
| TC04 | P0 | 统计周期-上月 | 返回上月累计数据 | | ⬜ | |
| TC05 | P0 | 约课率算法 | 有效/(未约+有效+无效) | | ⬜ | **验收重点** |
| TC06 | P0 | 漏约助教数据完整性 | 包含所有漏约助教 | | ⬜ | **验收重点** |
| TC07 | P0 | 漏约助教排序 | 按漏约次数倒序 | | ⬜ | **验收重点** |
| TC08 | P1 | 有权限角色访问 | 店长/助教管理/管理员: 200 | | ⬜ | |
| TC09 | P1 | 无权限角色访问 | 教练等: 403 | | ⬜ | |
| TC10 | P1 | 无效period参数 | 400 错误 | | ⬜ | |
| TC11 | P1 | 缺少period参数 | 400 错误 | | ⬜ | |
| TC12 | P2 | 空数据周期 | 全0, 空数组 | | ⬜ | |
| TC13 | P2 | 仅待审查数据 | 计入未约, 约课率0% | | ⬜ | |
| TC14 | P2 | 助教头像字段 | 每个助教有头像 | | ⬜ | |
| TC15 | P0 | 未约人数准确性 | 与SQL一致 | | ⬜ | |
| TC16 | P0 | 有效人数准确性 | 与SQL一致 | | ⬜ | |
| TC17 | P0 | 无效人数准确性 | 与SQL一致 | | ⬜ | |

---

## 附录: 关键数据库查询

### 查看现有助教信息

```bash
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT coach_no, employee_id, stage_name, 
       CASE WHEN photos IS NOT NULL AND photos != '' THEN '✅' ELSE '❌' END as has_photo,
       status
FROM coaches 
WHERE status != '离职' 
ORDER BY coach_no 
LIMIT 20;
"
```

### 查看指定日期范围的约客记录汇总

```bash
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT date, shift, result, COUNT(*) as cnt,
       GROUP_CONCAT(stage_name) as names
FROM guest_invitation_results 
WHERE date BETWEEN '2026-04-01' AND '2026-04-16'
GROUP BY date, shift, result
ORDER BY date, shift, result;
"
```

### 查看漏约助教排行

```bash
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT c.employee_id, gir.stage_name, COUNT(*) as missed_count,
       SUBSTR(gir.result, 1, 4) as result_types
FROM guest_invitation_results gir
JOIN coaches c ON gir.coach_no = c.coach_no
WHERE gir.date BETWEEN '2026-04-01' AND '2026-04-16'
  AND gir.result IN ('应约客', '约客无效')
GROUP BY gir.coach_no
ORDER BY missed_count DESC;
"
```

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