你是测试员B。请执行API接口测试。

## 测试地址
- 后端API：http://127.0.0.1:8088
- **严禁使用 8081 和 8083 端口！**

## 测试用例
```
# 测试用例：下桌单缺失统计功能

**QA编号**: QA-20260417-08  
**功能**: 下桌单缺失统计  
**入口**: 前端H5会员中心管理功能  
**权限**: 店长、助教管理、管理员  
**测试环境**: http://127.0.0.1:8088  

---

## 目录

1. [测试前提：获取Token](#1-测试前提获取token)
2. [P0 核心功能测试](#2-p0-核心功能测试)
3. [P1 重要功能测试](#3-p1-重要功能测试)
4. [P2 次要功能测试](#4-p2-次要功能测试)
5. [数据库性能测试](#5-数据库性能测试)
6. [测试数据准备](#6-测试数据准备)

---

## 1. 测试前提：获取Token

以下所有测试用例需要认证Token。先登录获取Token，后续用例中用 `$TOKEN` 表示。

### TC-AUTH-001 | 管理员登录获取Token | P0

```bash
curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' | python3 -m json.tool
```

**预期结果**:
- HTTP 200
- 返回 `{ "success": true, "token": "...", "role": "管理员" }`
- 提取 token 值，后续用例中替换 `$TOKEN`

```bash
# 实际操作：保存token
TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
echo "Token: ${TOKEN:0:20}..."
```

---

## 2. P0 核心功能测试

### TC-STATS-001 | 统计-周期为"昨天" | P0

**目的**: 验证核心统计功能，周期筛选为"昨天"

```bash
curl -s -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/stats?period=yesterday" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**预期结果**:
- HTTP 200
- 返回格式:
```json
{
  "success": true,
  "data": {
    "period": "yesterday",
    "date_start": "YYYY-MM-DD",
    "date_end": "YYYY-MM-DD",
    "total_missing": N,
    "list": [
      {
        "coach_no": 10078,
        "employee_id": "61",
        "stage_name": "小茹",
        "missing_count": 4
      },
      ...
    ]
  }
}
```
- `list` 数组按 `missing_count` 倒序排序
- `date_start` 和 `date_end` 为昨天的日期（同一天）
- `total_missing` 等于所有 coach 的 `missing_count` 之和
- 每条记录包含 `coach_no`、`employee_id`、`stage_name`、`missing_count`

> **验证方法**: 与数据库实际数据对比
```bash
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT t_in.coach_no, c.employee_id, t_in.stage_name, COUNT(*) as missing_count
FROM table_action_orders t_in
LEFT JOIN coaches c ON t_in.coach_no = c.coach_no
WHERE t_in.order_type = '上桌单'
AND DATE(t_in.created_at) = date('now','localtime','-1 day','start of day','+8 hours')
AND NOT EXISTS (
  SELECT 1 FROM table_action_orders t_out
  WHERE t_out.order_type = '下桌单'
    AND t_out.coach_no = t_in.coach_no
    AND t_out.table_no = t_in.table_no
    AND t_out.created_at > t_in.created_at
    AND (julianday(t_out.created_at) - julianday(t_in.created_at)) * 24 <= 15
)
GROUP BY t_in.coach_no
ORDER BY missing_count DESC;
"
```

---

### TC-STATS-002 | 统计-周期为"前天" | P0

**目的**: 验证"前天"周期筛选

```bash
curl -s -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/stats?period=beforeYesterday" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**预期结果**:
- HTTP 200
- `period` 为 `"beforeYesterday"`
- `date_start` 和 `date_end` 为前天的日期
- 返回前天下桌单缺失的统计数据

---

### TC-STATS-003 | 统计-周期为"本月" | P0

**目的**: 验证"本月"周期筛选（跨越多天）

```bash
curl -s -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/stats?period=thisMonth" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**预期结果**:
- HTTP 200
- `period` 为 `"thisMonth"`
- `date_start` 为本月1号，`date_end` 为今天
- 返回本月所有下桌单缺失的统计汇总

---

### TC-STATS-004 | 统计-周期为"上月" | P0

**目的**: 验证"上月"周期筛选

```bash
curl -s -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/stats?period=lastMonth" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**预期结果**:
- HTTP 200
- `period` 为 `"lastMonth"`
- `date_start` 为上月1号，`date_end` 为上月最后一天
- 返回上月所有下桌单缺失的统计汇总

---

### TC-DETAIL-001 | 明细-查询指定助教的缺失明细 | P0

**目的**: 验证点击统计记录后弹出明细框

```bash
# 以 coach_no=10078 (小茹) 为例，查询昨天的缺失明细
curl -s -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/detail?period=yesterday&coach_no=10078" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**预期结果**:
- HTTP 200
- 返回格式:
```json
{
  "success": true,
  "data": {
    "coach_no": 10078,
    "employee_id": "61",
    "stage_name": "小茹",
    "period": "yesterday",
    "details": [
      {
        "table_date": "YYYY-MM-DD",
        "table_time": "HH:MM:SS",
        "table_no": "普台X",
        "table_out_order": null
      },
      ...
    ]
  }
}
```
- 每条明细包含：上桌日期(`table_date`)、上桌时间(`table_time`)、桌号(`table_no`)、下桌单(`table_out_order` 为 null 表示缺失)
- 明细数量应等于统计中该助教的 `missing_count`

> **验证方法**: 与数据库对比
```bash
sqlite3 /TG/tgservice/db/tgservice.db "
SELECT DATE(t_in.created_at) as table_date,
       TIME(t_in.created_at) as table_time,
       t_in.table_no
FROM table_action_orders t_in
WHERE t_in.order_type = '上桌单'
AND t_in.coach_no = 10078
AND DATE(t_in.created_at) = date('now','localtime','-1 day','start of day','+8 hours')
AND NOT EXISTS (
  SELECT 1 FROM table_action_orders t_out
  WHERE t_out.order_type = '下桌单'
    AND t_out.coach_no = t_in.coach_no
    AND t_out.table_no = t_in.table_no
    AND t_out.created_at > t_in.created_at
    AND (julianday(t_out.created_at) - julianday(t_in.created_at)) * 24 <= 15
);
"
```

---

### TC-LOGIC-001 | 15小时判定逻辑-15小时内下桌不算缺失 | P0

**目的**: 验证15小时边界——上桌后14.5小时内发出下桌单，不算缺失

**步骤1**: 准备测试数据——创建一条上桌单（时间设置为今天 06:00）

```bash
# 先查一个有效 coach_no
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, stage_name FROM coaches WHERE coach_no=10002;"
# 预期: 10002|陆飞

# 创建上桌单（使用当前时间往回推，确保下桌单能在15小时内发出）
TABLE_IN_ID=$(sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at)
VALUES ('普台99', 10002, '上桌单', '陆飞', '待处理', datetime('now','localtime','-10 hours'), datetime('now','localtime','-10 hours'));
SELECT last_insert_rowid();
")
echo "上桌单ID: $TABLE_IN_ID"
```

**步骤2**: 在10小时后（仍在15小时内）创建下桌单

```bash
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at)
VALUES ('普台99', 10002, '下桌单', '陆飞', '待处理', datetime('now','localtime','-5 hours'), datetime('now','localtime','-5 hours'));
"
```

**步骤3**: 查询今天的统计，确认该助教不在缺失列表中

```bash
curl -s -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/stats?period=thisMonth" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
coaches = data.get('data',{}).get('list',[])
found = [c for c in coaches if c.get('coach_no') == 10002]
if found:
    print('FAIL: 助教10002不应出现在缺失列表中')
else:
    print('PASS: 助教10002不在缺失列表中（15小时内已下桌）')
"
```

**预期结果**: PASS — 10002(陆飞) 不应出现在缺失统计中

---

### TC-LOGIC-002 | 15小时判定逻辑-超过15小时下桌算缺失 | P0

**目的**: 验证15小时边界——上桌后16小时才发出下桌单，算缺失

**步骤1**: 创建上桌单（时间设置为今天 02:00）

```bash
TABLE_IN_ID2=$(sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at)
VALUES ('普台98', 10003, '上桌单', '六六', '待处理', datetime('now','localtime','-16 hours'), datetime('now','localtime','-16 hours'));
SELECT last_insert_rowid();
")
echo "上桌单ID: $TABLE_IN_ID2"
```

**步骤2**: 在16小时后创建下桌单（超过15小时窗口）

```bash
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at)
VALUES ('普台98', 10003, '下桌单', '六六', '待处理', datetime('now','localtime','-1 hours'), datetime('now','localtime','-1 hours'));
"
```

**步骤3**: 查询统计，确认该助教在缺失列表中

```bash
curl -s -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/stats?period=thisMonth" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
coaches = data.get('data',{}).get('list',[])
found = [c for c in coaches if c.get('coach_no') == 10003]
if found:
    print(f'PASS: 助教10003在缺失列表中，missing_count={found[0][\"missing_count\"]}')
else:
    print('FAIL: 助教10003应在缺失列表中')
"
```

**预期结果**: PASS — 10003(六六) 应出现在缺失统计中（下桌单超时）

---

## 3. P1 重要功能测试

### TC-PERM-001 | 权限-店长可访问 | P1

**目的**: 验证店长角色有权限访问统计功能

**步骤1**: 店长登录

```bash
TOKEN_STORE=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"18680174119","password":"mms633268"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('token','') if d.get('success') else 'LOGIN_FAILED')
")
echo "店长Token: ${TOKEN_STORE:0:20}..."
```

**步骤2**: 用店长Token请求统计

```bash
curl -s -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/stats?period=yesterday" \
  -H "Authorization: Bearer $TOKEN_STORE" | python3 -m json.tool
```

**预期结果**: HTTP 200，返回统计数据（权限通过）

---

### TC-PERM-002 | 权限-助教管理可访问 | P1

**目的**: 验证助教管理角色有权限访问统计功能

**步骤1**: 助教管理登录

```bash
TOKEN_COACH_MGR=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"13760517760","password":"mms633268"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('token','') if d.get('success') else 'LOGIN_FAILED')
")
```

**步骤2**: 用助教管理Token请求统计

```bash
curl -s -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/stats?period=yesterday" \
  -H "Authorization: Bearer $TOKEN_COACH_MGR" | python3 -m json.tool
```

**预期结果**: HTTP 200，返回统计数据（权限通过）

---

### TC-PERM-003 | 权限-收银无权限访问 | P1

**目的**: 验证收银角色**没有**权限访问统计功能

**步骤1**: 收银登录

```bash
TOKEN_CASHIER=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgcashier","password":"mms633268"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('token','') if d.get('success') else 'LOGIN_FAILED')
")
```

**步骤2**: 用收银Token请求统计

```bash
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/stats?period=yesterday" \
  -H "Authorization: Bearer $TOKEN_CASHIER"
```

**预期结果**: HTTP 403，返回 `{ "error": "权限不足" }` 或类似错误信息

---

### TC-PERM-004 | 权限-教练无权限访问 | P1

**目的**: 验证教练角色**没有**权限访问统计功能

**步骤1**: 教练登录

```bash
TOKEN_COACH=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"13590761730","password":"mms633268"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('token','') if d.get('success') else 'LOGIN_FAILED')
")
```

**步骤2**: 用教练Token请求统计

```bash
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/stats?period=yesterday" \
  -H "Authorization: Bearer $TOKEN_COACH"
```

**预期结果**: HTTP 403，返回权限不足错误

---

### TC-PERM-005 | 权限-未登录/无Token | P1

**目的**: 验证未携带Token时拒绝访问

```bash
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/stats?period=yesterday"
```

**预期结果**: HTTP 401，返回未授权错误

---

### TC-LOGIC-003 | 15小时判定逻辑-精确15小时边界 | P1

**目的**: 验证恰好15小时的情况（边界值测试）

**步骤1**: 创建上桌单（恰好15小时前）

```bash
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at)
VALUES ('普台97', 10012, '上桌单', '柳柳', '待处理', datetime('now','localtime','-15 hours'), datetime('now','localtime','-15 hours'));
"
```

**步骤2**: 不创建下桌单，查询统计

```bash
curl -s -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/detail?period=thisMonth&coach_no=10012" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
details = data.get('data',{}).get('details',[])
found = [d for d in details if d.get('table_no') == '普台97']
if found:
    print('PASS: 普台97上桌单在缺失明细中（恰好15小时无下桌单，算缺失）')
else:
    print('FAIL: 普台97上桌单应在缺失明细中')
"
```

**预期结果**: PASS — 恰好15小时没有下桌单，应算作缺失

---

### TC-LOGIC-004 | 15小时判定逻辑-14小时59分有下桌单不算缺失 | P1

**目的**: 验证14小时59分钟内发出下桌单不算缺失

```bash
# 创建上桌单（14小时59分前）
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at)
VALUES ('普台96', 10023, '上桌单', '小白', '待处理', datetime('now','localtime','-14 hours','-59 minutes'), datetime('now','localtime','-14 hours','-59 minutes'));
"

# 创建下桌单（1分钟后，即14小时58分后，仍在15小时内）
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at)
VALUES ('普台96', 10023, '下桌单', '小白', '待处理', datetime('now','localtime','-14 hours','-58 minutes'), datetime('now','localtime','-14 hours','-58 minutes'));
"
```

**验证**: 查询统计，10023的普台96上桌单不应在缺失明细中

```bash
curl -s -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/detail?period=thisMonth&coach_no=10023" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
details = data.get('data',{}).get('details',[])
found = [d for d in details if d.get('table_no') == '普台96']
if found:
    print('FAIL: 普台96上桌单不应在缺失明细中（14h58m内已下桌）')
else:
    print('PASS: 普台96上桌单不在缺失明细中')
"
```

**预期结果**: PASS

---

### TC-LOGIC-005 | 匹配逻辑-工号+桌号匹配，艺名一致 | P1

**目的**: 验证下桌单匹配规则：助教工号、桌号必须相同

**步骤1**: 创建上桌单（助教A在普台95）

```bash
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at)
VALUES ('普台95', 10021, '上桌单', '周周', '待处理', datetime('now','localtime','-5 hours'), datetime('now','localtime','-5 hours'));
"
```

**步骤2**: 创建下桌单（助教B在同一桌号，工号不同）

```bash
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at)
VALUES ('普台95', 10034, '下桌单', '羊羊', '待处理', datetime('now','localtime','-4 hours'), datetime('now','localtime','-4 hours'));
"
```

**步骤3**: 查询10021的缺失明细，普台95应仍在缺失列表中

```bash
curl -s -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/detail?period=thisMonth&coach_no=10021" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
details = data.get('data',{}).get('details',[])
found = [d for d in details if d.get('table_no') == '普台95']
if found:
    print('PASS: 普台95上桌单在缺失明细中（下桌单工号不匹配）')
else:
    print('FAIL: 普台95上桌单应在缺失明细中')
"
```

**预期结果**: PASS — 工号不同，不能匹配，仍算缺失

---

### TC-SORT-001 | 排序-按缺失数量倒序 | P1

**目的**: 验证统计结果按 `missing_count` 降序排列

```bash
curl -s -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/stats?period=2026-04-15" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
coaches = data.get('data',{}).get('list',[])
counts = [c['missing_count'] for c in coaches]
sorted_counts = sorted(counts, reverse=True)
if counts == sorted_counts:
    print(f'PASS: 排序正确，缺失数量: {counts}')
else:
    print(f'FAIL: 排序错误，实际: {counts}, 期望: {sorted_counts}')
"
```

**预期结果**: PASS — 数组按 `missing_count` 降序排列

---

## 4. P2 次要功能测试

### TC-PARAM-001 | 参数校验-非法周期值 | P2

**目的**: 验证传入非法 period 参数时返回错误

```bash
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/stats?period=invalid_period" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**: HTTP 400，返回参数错误提示，如 `"error": "无效的周期参数，应为: yesterday, beforeYesterday, thisMonth, lastMonth"`

---

### TC-PARAM-002 | 参数校验-缺少period参数 | P2

**目的**: 验证缺少必填参数时返回错误

```bash
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/stats" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**: HTTP 400，返回 `"error": "缺少必填参数：period"`

---

### TC-PARAM-003 | 参数校验-明细接口缺少coach_no | P2

```bash
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/detail?period=yesterday" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**: HTTP 400，返回缺少 coach_no 参数的错误

---

### TC-PARAM-004 | 参数校验-明细接口非法coach_no | P2

```bash
curl -s -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/detail?period=yesterday&coach_no=99999999" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**预期结果**: HTTP 200，返回空明细列表 `{"details": []}` 或助教不存在错误

---

### TC-PARAM-005 | 参数校验-非法Token | P2

```bash
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/stats?period=yesterday" \
  -H "Authorization: Bearer invalid_token_xyz"
```

**预期结果**: HTTP 401，返回 token 无效错误

---

### TC-EMPTY-001 | 空数据-某天无缺失记录 | P2

**目的**: 验证某天没有下桌单缺失时，返回空列表而非报错

```bash
# 使用一个未来日期（肯定没有数据）
curl -s -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/stats?period=lastMonth" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
# 不检查具体数据，只验证接口不报错
if data.get('success') == True or data.get('data') is not None:
    print('PASS: 接口正常返回（即使无数据也不报错）')
else:
    print(f'WARNING: 返回格式异常: {data}')
"
```

**预期结果**: HTTP 200，`list` 为空数组或 `total_missing` 为 0

---

### TC-CROSS-001 | 跨天匹配-上深夜桌次日早 | P2

**目的**: 验证跨天下的15小时判定（如23:00上桌，次日10:00下桌 = 11小时，不算缺失）

```bash
# 创建跨天上桌单（昨晚23:00）
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at)
VALUES ('普台94', 10025, '上桌单', '青子', '待处理', datetime('now','localtime','-1 day','+06:00:00'), datetime('now','localtime','-1 day','+06:00:00'));
"

# 创建次日下桌单（次日06:00，即7小时后，仍在15小时内）
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at)
VALUES ('普台94', 10025, '下桌单', '青子', '待处理', datetime('now','localtime','-1 day','+13:00:00'), datetime('now','localtime','-1 day','+13:00:00'));
"
```

**验证**: 查询今天的统计，10025的普台94上桌单不应在缺失中

```bash
curl -s -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/detail?period=thisMonth&coach_no=10025" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
details = data.get('data',{}).get('details',[])
found = [d for d in details if d.get('table_no') == '普台94']
if found:
    print('FAIL: 普台94上桌单不应在缺失中（跨天11小时已下桌）')
else:
    print('PASS: 普台94上桌单不在缺失中（跨天11小时内已下桌）')
"
```

**预期结果**: PASS

---

### TC-CROSS-002 | 跨天超时-上深夜桌次日午后 | P2

**目的**: 验证跨天超过15小时的情况（如22:00上桌，次日15:00下桌 = 17小时，算缺失）

```bash
# 创建跨天上桌单
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at)
VALUES ('普台93', 10026, '上桌单', '江江', '待处理', datetime('now','localtime','-1 day','+04:00:00'), datetime('now','localtime','-1 day','+04:00:00'));
"

# 创建次日超时下桌单（17小时后）
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at)
VALUES ('普台93', 10026, '下桌单', '江江', '待处理', datetime('now','localtime','-1 day','+21:00:00'), datetime('now','localtime','-1 day','+21:00:00'));
"
```

**验证**: 10026的普台93上桌单应在缺失明细中

```bash
curl -s -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/detail?period=thisMonth&coach_no=10026" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
details = data.get('data',{}).get('details',[])
found = [d for d in details if d.get('table_no') == '普台93']
if found:
    print('PASS: 普台93上桌单在缺失中（跨天17小时才下桌，超时）')
else:
    print('FAIL: 普台93上桌单应在缺失中')
"
```

**预期结果**: PASS

---

### TC-MULTI-001 | 同一助教多桌同时上桌 | P2

**目的**: 验证同一助教在同一时间段在不同桌号上桌，缺失判定按桌号独立计算

```bash
# 助教在多桌上桌
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at)
VALUES ('普台91', 10032, '上桌单', '三七', '待处理', datetime('now','localtime','-3 hours'), datetime('now','localtime','-3 hours'));

INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at)
VALUES ('普台92', 10032, '上桌单', '三七', '待处理', datetime('now','localtime','-3 hours'), datetime('now','localtime','-3 hours'));
"

# 只对普台91下桌
sqlite3 /TG/tgservice/db/tgservice.db "
INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at)
VALUES ('普台91', 10032, '下桌单', '三七', '待处理', datetime('now','localtime','-2 hours'), datetime('now','localtime','-2 hours'));
"
```

**验证**: 10032的缺失明细中应只有普台92，不含普台91

```bash
curl -s -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/detail?period=thisMonth&coach_no=10032" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
details = data.get('data',{}).get('details',[])
tables_91 = [d for d in details if d.get('table_no') == '普台91']
tables_92 = [d for d in details if d.get('table_no') == '普台92']
if not tables_91 and tables_92:
    print('PASS: 仅普台92缺失（普台91已下桌）')
elif tables_91:
    print('FAIL: 普台91不应在缺失中')
else:
    print('FAIL: 普台92应在缺失中')
"
```

**预期结果**: PASS — 按桌号独立判定缺失

---

## 5. 数据库性能测试

### TC-PERF-001 | 查询性能-统计接口响应时间 | P0

**目的**: 验证统计接口查询有索引支持，响应时间合理

```bash
# 统计10次请求的平均响应时间
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "%{time_total}\n" \
    -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/stats?period=thisMonth" \
    -H "Authorization: Bearer $TOKEN"
done | awk '{sum+=$1; count++} END {printf "平均响应时间: %.3f 秒\n", sum/count}'
```

**预期结果**: 平均响应时间 < 1 秒（数据量增长后仍应 < 2 秒）

---

### TC-PERF-002 | 数据库索引-EXPLAIN查询计划 | P0

**目的**: 验证缺失统计查询使用了索引

```bash
sqlite3 /TG/tgservice/db/tgservice.db "EXPLAIN QUERY PLAN
SELECT t_in.coach_no, t_in.stage_name, t_in.table_no, t_in.created_at
FROM table_action_orders t_in
WHERE t_in.order_type = '上桌单'
AND DATE(t_in.created_at) BETWEEN date('now','start of month') AND date('now')
AND NOT EXISTS (
  SELECT 1 FROM table_action_orders t_out
  WHERE t_out.order_type = '下桌单'
    AND t_out.coach_no = t_in.coach_no
    AND t_out.table_no = t_in.table_no
    AND t_out.created_at > t_in.created_at
    AND t_out.created_at <= datetime(t_in.created_at, '+15 hours')
);
"
```

**预期结果**: 查询计划中应出现 `SEARCH` 或 `USING INDEX`，而非全表扫描(`SCAN`)。关键索引：
- `idx_table_action_orders_type` — 过滤 `order_type = '上桌单'`
- `idx_table_action_orders_created_at` — 过滤日期范围
- `idx_table_action_orders_coach_no` — 子查询中匹配教练

> **⚠️ 注意**: 由于 NOT EXISTS 子查询需要按 (coach_no, table_no, order_type, created_at) 联合查找，建议新增复合索引：
> ```sql
> CREATE INDEX IF NOT EXISTS idx_tao_match 
> ON table_action_orders(coach_no, table_no, order_type, created_at);
> ```

---

### TC-PERF-003 | 数据库索引-新增复合索引验证 | P1

**目的**: 确认开发实现中新增了复合索引（如果实现需要）

```bash
sqlite3 /TG/tgservice/db/tgservice.db ".indices table_action_orders"
```

**预期结果**: 除了现有索引外，应存在用于匹配查询的复合索引，例如：
```
idx_tao_match  (coach_no, table_no, order_type, created_at)
```

或至少以下索引组合能覆盖查询：
```
idx_table_action_orders_coach_no  (coach_no)
idx_table_action_orders_type      (order_type)
idx_table_action_orders_created_at (created_at)
```

---

### TC-PERF-004 | 大数据量性能测试 | P2

**目的**: 模拟大数据量场景下查询性能（压力测试）

```bash
# 批量插入模拟数据（100条上桌单，均无对应下桌单）
sqlite3 /TG/tgservice/db/tgservice.db "
BEGIN TRANSACTION;
$(for i in $(seq 1 100); do
  coach=$((10000 + (i % 50)))
  table="普台$((i % 30 + 1))"
  echo "INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at) VALUES ('$table', $coach, '上桌单', '测试', '待处理', datetime('now','localtime','-2 days','+$((i % 12)) hours'), datetime('now','localtime','-2 days','+$((i % 12)) hours'));"
done)
COMMIT;
"

# 测试查询性能
time curl -s -o /dev/null -w "响应时间: %{time_total} 秒\n" \
  -X GET "http://127.0.0.1:8088/api/missing-table-out-orders/stats?period=thisMonth" \
  -H "Authorization: Bearer $TOKEN"

# 清理测试数据
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM table_action_orders WHERE stage_name='测试';"
```

**预期结果**: 响应时间 < 3 秒

---

## 6. 测试数据准备

### 已有真实数据统计

以下数据来自生产数据库 `/TG/tgservice/db/tgservice.db`，可直接用于验证：

| 日期 | 上桌单总数 | 下桌单缺失助教数 | 典型缺失案例 |
|------|-----------|----------------|-------------|
| 2026-04-16 | 59 | 8 | 快乐(2), 小茹/莲宝/kimi/多多/小涵/逍遥/柳柳(各1) |
| 2026-04-15 | 82 | 13 | 小茹(4), 莲宝(3), 快乐(3), kimi(2), 三七(2) 等 |
| 2026-04-17(今天) | 34 | 约10 | 球球/AA/江江/安娜/青子/快乐/敏儿/周周 等 |

### 快速验证SQL

以下SQL可用于手动验证API返回数据的准确性：

```sql
-- 统计某天下桌单缺失（按助教分组）
SELECT 
  t_in.coach_no,
  c.employee_id,
  t_in.stage_name,
  GROUP_CONCAT(t_in.table_no || '@' || TIME(t_in.created_at)) as missing_tables,
  COUNT(*) as missing_count
FROM table_action_orders t_in
LEFT JOIN coaches c ON t_in.coach_no = c.coach_no
WHERE t_in.order_type = '上桌单'
AND DATE(t_in.created_at) = '2026-04-16'  -- 替换为目标日期
AND NOT EXISTS (
  SELECT 1 FROM table_action_orders t_out
  WHERE t_out.order_type = '下桌单'
    AND t_out.coach_no = t_in.coach_no
    AND t_out.table_no = t_in.table_no
    AND t_out.created_at > t_in.created_at
    AND (julianday(t_out.created_at) - julianday(t_in.created_at)) * 24 <= 15
)
GROUP BY t_in.coach_no
ORDER BY missing_count DESC;
```

### 测试数据清理

所有本测试用例 INSERT 的测试数据清理SQL：

```sql
-- 清理TC-LOGIC测试数据
DELETE FROM table_action_orders WHERE table_no IN ('普台99','普台98','普台97','普台96','普台95','普台94','普台93','普台92','普台91') AND stage_name != '测试';

-- 清理TC-MULTI测试数据（已包含在上面）
-- 清理TC-PERF大数据量模拟数据
DELETE FROM table_action_orders WHERE stage_name = '测试';
```

---

## 测试用例汇总

| 编号 | 类别 | 优先级 | 测试点 | 状态 |
|------|------|--------|--------|------|
| TC-AUTH-001 | 认证 | P0 | 管理员登录获取Token | ⬜ |
| TC-STATS-001 | 统计 | P0 | 周期=昨天 | ⬜ |
| TC-STATS-002 | 统计 | P0 | 周期=前天 | ⬜ |
| TC-STATS-003 | 统计 | P0 | 周期=本月 | ⬜ |
| TC-STATS-004 | 统计 | P0 | 周期=上月 | ⬜ |
| TC-DETAIL-001 | 明细 | P0 | 查询指定助教缺失明细 | ⬜ |
| TC-LOGIC-001 | 逻辑 | P0 | 15小时内下桌不算缺失 | ⬜ |
| TC-LOGIC-002 | 逻辑 | P0 | 超过15小时下桌算缺失 | ⬜ |
| TC-PERM-001 | 权限 | P1 | 店长可访问 | ⬜ |
| TC-PERM-002 | 权限 | P1 | 助教管理可访问 | ⬜ |
| TC-PERM-003 | 权限 | P1 | 收银无权限 | ⬜ |
| TC-PERM-004 | 权限 | P1 | 教练无权限 | ⬜ |
| TC-PERM-005 | 权限 | P1 | 未登录拒绝 | ⬜ |
| TC-LOGIC-003 | 逻辑 | P1 | 精确15小时边界 | ⬜ |
| TC-LOGIC-004 | 逻辑 | P1 | 14h59m内下桌不算缺失 | ⬜ |
| TC-LOGIC-005 | 逻辑 | P1 | 工号+桌号匹配规则 | ⬜ |
| TC-SORT-001 | 排序 | P1 | 按缺失数量倒序 | ⬜ |
| TC-PARAM-001 | 参数 | P2 | 非法周期值 | ⬜ |
| TC-PARAM-002 | 参数 | P2 | 缺少period参数 | ⬜ |
| TC-PARAM-003 | 参数 | P2 | 缺少coach_no参数 | ⬜ |
| TC-PARAM-004 | 参数 | P2 | 非法coach_no | ⬜ |
| TC-PARAM-005 | 参数 | P2 | 非法Token | ⬜ |
| TC-EMPTY-001 | 边界 | P2 | 空数据返回空列表 | ⬜ |
| TC-CROSS-001 | 逻辑 | P2 | 跨天11小时内下桌不算缺失 | ⬜ |
| TC-CROSS-002 | 逻辑 | P2 | 跨天17小时下桌算缺失 | ⬜ |
| TC-MULTI-001 | 逻辑 | P2 | 同一助教多桌独立判定 | ⬜ |
| TC-PERF-001 | 性能 | P0 | 响应时间<1秒 | ⬜ |
| TC-PERF-002 | 性能 | P0 | EXPLAIN查询计划有索引 | ⬜ |
| TC-PERF-003 | 性能 | P1 | 复合索引验证 | ⬜ |
| TC-PERF-004 | 性能 | P2 | 大数据量性能 | ⬜ |

**总计**: 30 条测试用例 (P0: 10, P1: 9, P2: 11)

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
数据库查询性能（索引）、15小时判定逻辑、周期筛选、弹框明细展示、权限控制

## 输出要求
- 测试结果写入：/TG/temp/QA-20260417-08/test-results.md
- 格式：表格（用例ID、测试项、优先级、预期结果、实际结果、状态）
- 状态：✅通过 / ❌失败 / ⏭️跳过