你是测试员B。请执行API接口测试。

## 测试地址
- 后端API：http://127.0.0.1:8088
- **严禁使用 8081 和 8083 端口！**

## 测试用例
```
# 规约客统计页面 - API 测试用例

> **QA编号**: QA-20260417-05  
> **测试员**: B（审计修正版）  
> **后端地址**: `http://127.0.0.1:8088`  
> **测试策略**: 纯 API/curl 测试 + SQLite 直接操作数据库  
> **创建日期**: 2026-04-17  
> **修正日期**: 2026-04-17（对齐实际实现）

---

## 实际 API 实现

| 项目 | 值 |
|------|-----|
| 路径 | `GET /api/guest-invitations/period-stats` |
| period 参数 | `yesterday` \| `day-before-yesterday` \| `this-month` \| `last-month` |
| 权限 | `invitationStats`（管理员/店长/助教管理=true，其他=false） |

### 响应格式

```json
{
  "success": true,
  "data": {
    "period": "yesterday",
    "period_label": "昨天",
    "date_range": "2026-04-16",
    "summary": {
      "not_invited": 5,
      "valid": 12,
      "invalid": 3,
      "pending": 2,
      "total_should": 20,
      "invite_rate": "60.0%"
    },
    "missed_coaches": [
      {
        "coach_no": 15,
        "employee_id": "A003",
        "stage_name": "小美",
        "photo_url": "http://...",
        "missed_count": 4
      }
    ]
  }
}
```

### 数据分类映射（后端实现）

| 需求术语 | result 值 | 统计字段 |
|----------|-----------|---------|
| 未约课人数 | `result = '应约客'` | `not_invited` |
| 有效约课人数 | `result = '约客有效'` | `valid` |
| 无效约课人数 | `result = '约客无效'` | `invalid` |
| 待审查 | `result = '待审查'` | `pending`（不计入约课率分母） |
| 漏约助教 | `result IN ('应约客', '约客无效')` | `missed_coaches` |

### 约课率算法
```
应约客人数 = not_invited + invalid + valid
约课率 = valid / 应约客人数 × 100%
```
> 注意：`pending`（待审查）不计入约课率分母

---

## 前置准备：登录获取 Token

### 获取管理员 Token（有权限）

```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

echo "ADMIN_TOKEN=$ADMIN_TOKEN"
```

---

## 测试数据准备

### 当前数据库数据概览

```bash
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT date, shift, result, COUNT(*) as cnt
FROM guest_invitation_results 
GROUP BY date, shift, result 
ORDER BY date DESC, shift, result;
"
```

**现有数据（截至 2026-04-17）**：

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

### 预期计算（以 4月14日 为"昨天"为例）

```
4月14日 数据:
  应约客 = 2 + 2 = 4  → not_invited = 4
  待审查 = 1  → pending = 1
  约客有效 = 15 + 13 = 28  → valid = 28
  约客无效 = 0  → invalid = 0
  应约客人数 = 4 + 0 + 28 = 32  → total_should = 32
  约课率 = 28 / 32 = 87.5%  → invite_rate = "87.5%"
  漏约助教: 安娜(1), 敏儿(1), 六九(1), kimi(1) — 各1次，按 coach_no ASC 并列
```

---

## 测试用例

### TC01-P0: 统计周期-昨天

**优先级**: P0  
**目标**: 验证 period=yesterday 时，返回昨天的统计数据

**操作步骤**:

```bash
# 1. 获取 token
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

# 2. 请求统计数据（昨天）
curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats?period=yesterday" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -m json.tool
```

**预期结果**:
- HTTP 200, success: true
- `period`: "yesterday", `period_label`: "昨天"
- `date_range`: 昨天的日期（如 "2026-04-16"）
- `summary` 包含 not_invited, valid, invalid, pending, total_should, invite_rate
- `missed_coaches`: 数组，包含昨天 result IN ('应约客','约客无效') 的助教

---

### TC02-P0: 统计周期-前天

**优先级**: P0  
**目标**: 验证 period=day-before-yesterday 时，返回前天的统计数据

**操作步骤**:

```bash
curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats?period=day-before-yesterday" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -m json.tool
```

**预期结果**:
- HTTP 200, `period`: "day-before-yesterday", `period_label`: "前天"
- 统计数据仅覆盖前天的记录

---

### TC03-P0: 统计周期-本月

**优先级**: P0  
**目标**: 验证 period=this-month 时，返回本月累计统计

**操作步骤**:

```bash
curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats?period=this-month" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -m json.tool
```

**预期结果**:
- HTTP 200, `period`: "this-month", `period_label`: "本月"
- `date_range`: "2026-04-01 ~ 2026-04-17"（或类似范围）
- 各字段值与 SQL 验证一致：

**验证 SQL**:
```bash
# 验证本月未约
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT COUNT(*) FROM guest_invitation_results 
WHERE date >= '2026-04-01' AND date <= date('now')
AND result = '应约客';
"

# 验证本月有效
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT COUNT(*) FROM guest_invitation_results 
WHERE date >= '2026-04-01' AND date <= date('now')
AND result = '约客有效';
"

# 验证本月无效
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT COUNT(*) FROM guest_invitation_results 
WHERE date >= '2026-04-01' AND date <= date('now')
AND result = '约客无效';
"
```

---

### TC04-P0: 统计周期-上月

**优先级**: P0  
**目标**: 验证 period=last-month 时，返回上月累计统计

**操作步骤**:

```bash
curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats?period=last-month" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -m json.tool
```

**预期结果**:
- HTTP 200, `period`: "last-month", `period_label`: "上月"
- 若3月份无数据，各计数为0，invite_rate 为 "0.0%"，missed_coaches 为空数组

---

### TC05-P0: 约课率算法正确性

**优先级**: P0（**验收重点**）  
**目标**: 验证约课率 = valid / (not_invited + invalid + valid)

**操作步骤**:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

RESPONSE=$(curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats?period=this-month" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "$RESPONSE" | python3 -m json.tool

# 验证算法
echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
s = data['data']['summary']
not_invited = s['not_invited']
valid = s['valid']
invalid = s['invalid']
total_should = s['total_should']
invite_rate = s['invite_rate']

# 验证 total_should
assert total_should == not_invited + invalid + valid, f'total_should 错误: {total_should} != {not_invited}+{invalid}+{valid}'

# 验证 invite_rate
expected = round(valid / total_should * 100, 1) if total_should > 0 else 0.0
actual = float(invite_rate.replace('%', ''))
diff = abs(expected - actual)
assert diff < 0.2, f'约课率错误: 期望 {expected}%, 实际 {invite_rate}'

print(f'✅ 约课率计算正确: {invite_rate} (预期 ~{expected}%)')
print(f'  未约={not_invited}, 有效={valid}, 无效={invalid}, 总计={total_should}')
"
```

**预期结果**:
- total_should = not_invited + invalid + valid
- invite_rate ≈ valid / total_should × 100%
- total_should = 0 时 invite_rate = "0.0%"

---

### TC06-P0: 漏约助教一览表-数据完整性

**优先级**: P0（**验收重点**）  
**目标**: 验证漏约助教列表包含所有应约客和无效约客的助教

**操作步骤**:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

# 1. API 返回的漏约助教
curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats?period=this-month" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
coaches = data['data']['missed_coaches']
print(f'API 返回漏约助教数: {len(coaches)}')
for c in coaches:
    print(f'  coach_no={c[\"coach_no\"]}, employee_id={c[\"employee_id\"]}, stage_name={c[\"stage_name\"]}, missed_count={c[\"missed_count\"]}')
"

# 2. SQL 验证
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT coach_no, COUNT(*) as missed_count
FROM guest_invitation_results
WHERE date >= '2026-04-01' AND date <= date('now')
  AND result IN ('应约客', '约客无效')
GROUP BY coach_no
ORDER BY missed_count DESC, coach_no ASC;
"
```

**预期结果**:
- API 返回数量与 SQL 查询结果一致
- 每个助教对象包含: coach_no, employee_id, stage_name, photo_url, missed_count

---

### TC07-P0: 漏约助教一览表-排序正确性

**优先级**: P0（**验收重点**）  
**目标**: 验证漏约助教按漏约次数倒序排列

**操作步骤**:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

# 先插入测试数据制造漏约次数差异
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT OR IGNORE INTO guest_invitation_results 
  (date, shift, coach_no, stage_name, invitation_image_url, images, result, created_at, updated_at)
VALUES 
  ('2026-04-10', '早班', 10003, '六六', '', '[]', '约客无效', datetime('now'), datetime('now')),
  ('2026-04-11', '早班', 10003, '六六', '', '[]', '约客无效', datetime('now'), datetime('now')),
  ('2026-04-12', '早班', 10003, '六六', '', '[]', '约客无效', datetime('now'), datetime('now'));
"

# 请求数据
RESPONSE=$(curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats?period=this-month" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

# 验证排序
echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
coaches = data['data']['missed_coaches']

if not coaches:
    print('⚠️  漏约助教列表为空')
    sys.exit(0)

counts = [c['missed_count'] for c in coaches]
is_desc = all(counts[i] >= counts[i+1] for i in range(len(counts)-1))

print('漏约次数序列:', counts)
if is_desc:
    print('✅ 排序正确: 按漏约次数倒序')
else:
    print('❌ 排序错误')
    for i in range(len(counts)-1):
        if counts[i] < counts[i+1]:
            print(f'   位置{i} ({counts[i]}) < 位置{i+1} ({counts[i+1]})')
"
```

**预期结果**: 漏约次数降序排列

---

### TC08-P1: 权限控制-有权限角色可访问

**优先级**: P1  
**目标**: 验证管理员角色可以正常访问

**操作步骤**:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats?period=this-month" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "管理员访问: HTTP $HTTP_CODE"
```

**预期结果**: HTTP 200

---

### TC09-P1: 权限控制-无权限角色不可访问

**优先级**: P1  
**目标**: 验证教练等无权限角色无法访问

**操作步骤**:

```bash
# 用助教账号登录获取token（助教无 invitationStats 权限）
# 尝试用助教手机号登录
COACH_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/coach/login \
  -H 'Content-Type: application/json' \
  -d '{"employee_id":"1","stage_name":"歪歪","idCardLast6":"待确认"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',d.get('coachToken','')))")

if [ -n "$COACH_TOKEN" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats?period=this-month" \
    -H "Authorization: Bearer $COACH_TOKEN")
  echo "助教访问: HTTP $HTTP_CODE"
else
  echo "⚠️ 无法获取助教token，跳过此测试"
fi
```

**预期结果**: HTTP 403 或 401

---

### TC10-P1: 异常流程-无效统计周期参数

**优先级**: P1  
**目标**: 验证无效 period 返回 400

**操作步骤**:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

# 1. 中文参数
curl -s -w "\nHTTP:%{http_code}" \
  -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats?period=昨天" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

echo ""

# 2. 不相关值
curl -s -w "\nHTTP:%{http_code}" \
  -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats?period=hello" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

echo ""

# 3. 本周（不在合法列表中）
curl -s -w "\nHTTP:%{http_code}" \
  -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats?period=this-week" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**预期结果**: 所有请求返回 HTTP 400 + success: false

---

### TC11-P1: 异常流程-缺少参数

**优先级**: P1  
**目标**: 验证不传 period 返回 400

**操作步骤**:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

curl -s -w "\nHTTP:%{http_code}" \
  -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**预期结果**: HTTP 400 + success: false + 错误信息提示缺少参数

---

### TC12-P2: 空数据周期返回

**优先级**: P2  
**目标**: 验证无数据周期返回全0

**操作步骤**:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

RESPONSE=$(curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats?period=last-month" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if not data.get('success'):
    print('❌ 请求失败')
    sys.exit(1)
s = data['data']['summary']
mc = data['data']['missed_coaches']
print(f'not_invited={s[\"not_invited\"]}, valid={s[\"valid\"]}, invalid={s[\"invalid\"]}')
print(f'total_should={s[\"total_should\"]}, invite_rate={s[\"invite_rate\"]}')
print(f'missed_coaches_count={len(mc)}')
if s['total_should'] == 0 and len(mc) == 0:
    print('✅ 空数据返回正确')
else:
    print('⚠️ 非空数据（可能有历史记录）')
"
```

**预期结果**: 若无历史数据，各计数为0，invite_rate="0.0%"，missed_coaches=[]

---

### TC13-P2: 仅含待审查记录的周期

**优先级**: P2  
**目标**: 验证只有待审查数据时，not_invited 不包含 pending

**操作步骤**:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats?period=yesterday" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
s = data['data']['summary']
print(f'not_invited={s[\"not_invited\"]}, pending={s[\"pending\"]}, valid={s[\"valid\"]}, invalid={s[\"invalid\"]}')
print(f'total_should={s[\"total_should\"]} (= not_invited+invalid+valid)')
# pending 不应计入 total_should
expected = s['not_invited'] + s['invalid'] + s['valid']
if s['total_should'] == expected:
    print('✅ pending 未计入 total_should')
else:
    print(f'❌ total_should={s[\"total_should\"]}, 期望={expected}')
"
```

**预期结果**: pending 不计入 total_should

---

### TC14-P2: 漏约助教头像字段完整性

**优先级**: P2  
**目标**: 验证漏约助教列表中包含 photo_url 字段

**操作步骤**:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats?period=this-month" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
coaches = data['data']['missed_coaches']
if not coaches:
    print('⚠️ 无漏约助教')
    sys.exit(0)
for c in coaches:
    has_photo = 'photo_url' in c and c['photo_url']
    print(f'{c[\"stage_name\"]}: photo_url={\"✅\" if has_photo else \"⚠️ 无\"}')
# 检查所有必需字段
required = ['coach_no', 'employee_id', 'stage_name', 'photo_url', 'missed_count']
for c in coaches:
    missing = [f for f in required if f not in c]
    if missing:
        print(f'❌ {c.get(\"stage_name\",\"?\")} 缺少字段: {missing}')
        break
else:
    print(f'✅ 所有 {len(coaches)} 个助教字段完整')
"
```

**预期结果**: 每个助教包含 photo_url 字段

---

### TC15-P0: 未约人数统计准确性

**优先级**: P0  
**目标**: 验证 not_invited = COUNT(result='应约客')

**操作步骤**:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

# SQL 预期
SQL_EXPECTED=$(sqlite3 /TG/tgservice/db/tgservice.db "
SELECT COUNT(*) FROM guest_invitation_results 
WHERE date >= '2026-04-01' AND date <= date('now')
AND result = '应约客';
")
echo "SQL预期未约人数: $SQL_EXPECTED"

# API 返回
API_NOT_INVITED=$(curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats?period=this-month" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['summary']['not_invited'])")

echo "API返回未约人数: $API_NOT_INVITED"

if [ "$SQL_EXPECTED" = "$API_NOT_INVITED" ]; then
    echo "✅ 未约人数统计正确"
else
    echo "❌ 未约人数不一致: 期望 $SQL_EXPECTED, 实际 $API_NOT_INVITED"
fi
```

**预期结果**: API 与 SQL 一致

---

### TC16-P0: 有效约课人数统计准确性

**优先级**: P0  
**目标**: 验证 valid = COUNT(result='约客有效')

**操作步骤**:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

SQL_EXPECTED=$(sqlite3 /TG/tgservice/db/tgservice.db "
SELECT COUNT(*) FROM guest_invitation_results 
WHERE date >= '2026-04-01' AND date <= date('now')
AND result = '约客有效';
")
echo "SQL预期有效人数: $SQL_EXPECTED"

API_VALID=$(curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats?period=this-month" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['summary']['valid'])")

echo "API返回有效人数: $API_VALID"

if [ "$SQL_EXPECTED" = "$API_VALID" ]; then
    echo "✅ 有效约课人数统计正确"
else
    echo "❌ 有效人数不一致: 期望 $SQL_EXPECTED, 实际 $API_VALID"
fi
```

**预期结果**: API 与 SQL 一致

---

### TC17-P0: 无效约课人数统计准确性

**优先级**: P0  
**目标**: 验证 invalid = COUNT(result='约客无效')

**操作步骤**:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

SQL_EXPECTED=$(sqlite3 /TG/tgservice/db/tgservice.db "
SELECT COUNT(*) FROM guest_invitation_results 
WHERE date >= '2026-04-01' AND date <= date('now')
AND result = '约客无效';
")
echo "SQL预期无效人数: $SQL_EXPECTED"

API_INVALID=$(curl -s -X GET "http://127.0.0.1:8088/api/guest-invitations/period-stats?period=this-month" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['summary']['invalid'])")

echo "API返回无效人数: $API_INVALID"

if [ "$SQL_EXPECTED" = "$API_INVALID" ]; then
    echo "✅ 无效约课人数统计正确"
else
    echo "❌ 无效人数不一致: 期望 $SQL_EXPECTED, 实际 $API_INVALID"
fi
```

**预期结果**: API 与 SQL 一致

---

## 测试结果记录表

| 用例ID | 优先级 | 测试目标 | 预期结果 | 实际结果 | 状态 | 备注 |
|--------|--------|---------|---------|---------|------|------|
| TC01 | P0 | 统计周期-昨天 | 返回昨天数据 | | ⬜ | |
| TC02 | P0 | 统计周期-前天 | 返回前天数据 | | ⬜ | |
| TC03 | P0 | 统计周期-本月 | 返回本月累计 | | ⬜ | |
| TC04 | P0 | 统计周期-上月 | 返回上月累计 | | ⬜ | |
| TC05 | P0 | 约课率算法 | valid/total | | ⬜ | **验收重点** |
| TC06 | P0 | 漏约助教完整性 | 与SQL一致 | | ⬜ | **验收重点** |
| TC07 | P0 | 漏约助教排序 | 按次数倒序 | | ⬜ | **验收重点** |
| TC08 | P1 | 有权限访问 | 200 | | ⬜ | |
| TC09 | P1 | 无权限访问 | 403/401 | | ⬜ | |
| TC10 | P1 | 无效period | 400 | | ⬜ | |
| TC11 | P1 | 缺少period | 400 | | ⬜ | |
| TC12 | P2 | 空数据 | 全0 | | ⬜ | |
| TC13 | P2 | 仅待审查 | pending不计入 | | ⬜ | |
| TC14 | P2 | 头像字段 | photo_url存在 | | ⬜ | |
| TC15 | P0 | 未约人数 | 与SQL一致 | | ⬜ | |
| TC16 | P0 | 有效人数 | 与SQL一致 | | ⬜ | |
| TC17 | P0 | 无效人数 | 与SQL一致 | | ⬜ | |

---

## 测试数据恢复脚本

```bash
# 清理测试插入的约客无效数据
sqlite3 /TG/tgservice/db/tgservice.db "
DELETE FROM guest_invitation_results 
WHERE coach_no = 10003
  AND date IN ('2026-04-10', '2026-04-11', '2026-04-12')
  AND result = '约客无效';
"
```

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
约课率算法正确性、统计周期切换准确性、漏约助教数据完整性及排序正确性

## 输出要求
- 测试结果写入：/TG/temp/QA-20260417-05/test-results.md
- 格式：表格（用例ID、测试项、优先级、预期结果、实际结果、状态）
- 状态：✅通过 / ❌失败 / ⏭️跳过