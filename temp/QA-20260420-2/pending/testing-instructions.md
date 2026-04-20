你是测试员B。请执行API接口测试。

## 测试地址
- 后端API：http://127.0.0.1:8088
- **严禁使用 8081 和 8083 端口！**

## 测试用例
```
# API 测试用例：活跃计时器 (Active Timers)

> 需求：在系统报告页面新增「活跃计时器」Tab，新增 API `/api/system-report/active-timers`，扩展 timer-manager 内存存储增加助教信息字段。
> 测试环境：`http://127.0.0.1:8088`
> 认证方式：JWT Bearer Token

---

## 前置准备

### 生成 JWT Token（用于所有需要认证的请求）

```bash
cd /TG/tgservice/backend
TOKEN=$(node -e "const jwt = require('jsonwebtoken'); console.log(jwt.sign({username:'tgadmin',role:'管理员'}, 'tgservice_jwt_secret_key_2026', {expiresIn:'7d'}))")
```

> 以下所有 curl 命令中的 `$TOKEN` 都指上述生成的 JWT Token。

---

## 测试用例

| 用例ID | 测试项 | 优先级 | 操作步骤(curl命令) | 预期结果 |
|--------|--------|--------|---------------------|----------|
| AT-01 | 未认证访问返回401 | P0 | `curl -s http://127.0.0.1:8088/api/system-report/active-timers` | 返回 `{"success":false,"error":"未授权访问"}`，HTTP 401 |
| AT-02 | 正常访问返回成功结构 | P0 | `curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers` | 返回 `{"success":true,"timers":[...],"total":N}`，HTTP 200 |
| AT-03 | 无活跃计时器返回空数组 | P0 | `curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers`（启动后无定时器时） | `{"success":true,"timers":[],"total":0}` |
| AT-04 | 返回字段完整性（乐捐类型） | P0 | 先创建一条 pending 乐捐记录，重启服务恢复定时器后：<br>`curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers` | 每条 timer 包含字段：`timerId`, `type`, `recordId`, `execTime`, `coach_no`, `employee_id`, `stage_name`, `application_type`, `remainingSeconds` |
| AT-05 | 返回字段完整性（申请类型） | P0 | 先创建一条 timer_set=true 的休息/请假申请，重启服务恢复定时器后：<br>`curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers` | 每条 timer 包含字段：`timerId`, `type`, `recordId`, `execTime`, `coach_no`, `employee_id`, `stage_name`, `application_type`, `remainingSeconds` |
| AT-06 | 乐捐计时器包含正确的助教信息 | P1 | 插入乐捐记录后重启：<br>`sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO lejuan_records (coach_no, employee_id, stage_name, scheduled_start_time, lejuan_status, scheduled) VALUES ('10001', '1', '歪歪', datetime('now', '+2 hours'), 'pending', 0);"`<br>重启 PM2：`pm2 restart tgservice-dev`<br>等待5秒后：<br>`curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers \| python3 -c "import sys,json; data=json.load(sys.stdin); lj=[t for t in data['timers'] if t['type']=='lejuan']; print(json.dumps(lj[0] if lj else {}, indent=2))"` | 乐捐类型 timer 的 `coach_no` = `"10001"`, `employee_id` = `"1"`, `stage_name` = `"歪歪"`, `application_type` = `"lejuan"` |
| AT-07 | 申请计时器包含正确的助教信息 | P1 | 先查助教手机号：<br>`sqlite3 /TG/tgservice/db/tgservice.db "SELECT phone FROM coaches WHERE coach_no='10001';"`<br>插入申请记录：<br>`sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO applications (applicant_phone, application_type, status, extra_data) VALUES ('16675852676', '休息申请', 1, '{\"timer_set\":true,\"exec_time\":\"$(date -d '+2 hours' '+%Y-%m-%d %H:%M:%S')\",\"rest_date\":\"$(date '+%Y-%m-%d')\"}');"`<br>重启 PM2：`pm2 restart tgservice-dev`<br>等待5秒后：<br>`curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers \| python3 -c "import sys,json; data=json.load(sys.stdin); app=[t for t in data['timers'] if t['type']=='application']; print(json.dumps(app[0] if app else {}, indent=2))"` | 申请类型 timer 的 `coach_no` = `"10001"`, `employee_id` = `"1"`, `stage_name` = `"歪歪"`, `application_type` = `"休息申请"` |
| AT-08 | 剩余时间计算准确性 | P0 | 插入 exec_time 为未来 30 分钟的乐捐记录后重启服务，调用 API：<br>`curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers \| python3 -c "import sys,json; data=json.load(sys.stdin); t=data['timers'][0]; print(f'remainingSeconds={t[\"remainingSeconds\"]}, 约{t[\"remainingSeconds\"]//60}分钟'); assert 1700 <= t['remainingSeconds'] <= 1900, '剩余时间不在合理范围'"` | `remainingSeconds` 在 1700~1900 秒之间（允许 100 秒误差） |
| AT-09 | 剩余时间随时间递减 | P1 | 记录当前 remainingSeconds，等待 60 秒后再次调用 API：<br>`FIRST=$(curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers)`<br>`sleep 60`<br>`SECOND=$(curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers)`<br>`python3 -c "import json; f=json.loads('$FIRST')['timers'][0]['remainingSeconds']; s=json.loads('$SECOND')['timers'][0]['remainingSeconds']; print(f'第一次: {f}, 第二次: {s}, 差值: {f-s}'); assert 50 <= f-s <= 70"` | 第二次 remainingSeconds 比第一次少 50~70 秒 |
| AT-10 | 同时存在多种类型计时器 | P1 | 同时创建乐捐和申请计时器后重启服务：<br>`curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers \| python3 -c "import sys,json; data=json.load(sys.stdin); types=set(t['type'] for t in data['timers']); print(f'类型: {types}'); assert 'lejuan' in types and 'application' in types"` | 返回结果中同时包含 `lejuan` 和 `application` 两种类型 |
| AT-11 | total 字段与 timers 数组长度一致 | P1 | `curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers \| python3 -c "import sys,json; data=json.load(sys.stdin); print(f'total={data[\"total\"]}, len={len(data[\"timers\"])}'); assert data['total'] == len(data['timers'])"` | `total` 值等于 `timers` 数组长度 |
| AT-12 | 计时器取消后从列表中移除 | P1 | 创建乐捐计时器 → 确认 API 返回包含该计时器 → 通过管理后台或 API 取消该乐捐记录 → 再次调用 active-timers API：<br>`curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers` | 取消后该计时器不再出现在返回结果中 |
| AT-13 | 计时器执行后从列表中移除 | P1 | 创建 exec_time 为未来 1 分钟的乐捐记录 → 调用 API 确认存在 → 等待 2 分钟让计时器自动执行 → 再次调用 API：<br>`curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers` | 执行后该计时器不再出现在返回结果中 |
| AT-14 | 重复注册同一条记录不产生重复计时器 | P2 | 手动调用两次 createTimer 注册同一个 timerId → 调用 active-timers API：<br>`curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers \| python3 -c "import sys,json; data=json.load(sys.stdin); ids=[t['recordId'] for t in data['timers']]; from collections import Counter; dupes=[k for k,v in Counter(ids).items() if v>1]; print(f'重复ID: {dupes}'); assert len(dupes)==0"` | 每条 recordId 只出现一次，无重复 |
| AT-15 | 已过去 exec_time 的计时器立即执行不残留 | P2 | 插入 exec_time 为过去的乐捐记录 → 重启服务 → 等待 5 秒 → 调用 API：<br>`curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers` | 已过期的计时器已被执行并从列表中移除 |
| AT-16 | application_type 字段区分申请子类型 | P2 | 分别创建"休息申请"和"请假申请"的计时器 → 调用 API：<br>`curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers \| python3 -c "import sys,json; data=json.load(sys.stdin); apps=[t for t in data['timers'] if t['type']=='application']; print(json.dumps([(t['recordId'],t['application_type']) for t in apps], indent=2))"` | application 类型 timer 的 `application_type` 字段为 `"休息申请"` 或 `"请假申请"` |
| AT-17 | 乐捐计时器 application_type 固定为 lejuan | P2 | 创建多条乐捐计时器 → 调用 API 检查：<br>`curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers \| python3 -c "import sys,json; data=json.load(sys.stdin); lj=[t for t in data['timers'] if t['type']=='lejuan']; assert all(t['application_type']=='lejuan' for t in lj)"` | 所有 lejuan 类型 timer 的 `application_type` 均为 `"lejuan"` |
| AT-18 | 服务重启后计时器信息完整性 | P1 | 创建乐捐和申请计时器 → 确认 API 返回正常 → 重启 PM2 → 等待 10 秒 → 调用 API 检查所有字段：<br>`curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers \| python3 -c "import sys,json; data=json.load(sys.stdin); required=['timerId','type','recordId','execTime','coach_no','employee_id','stage_name','application_type','remainingSeconds']; missing=[f for t in data['timers'] for f in required if f not in t]; print(f'缺失字段: {missing}'); assert len(missing)==0"` | 重启恢复后所有计时器的所有必填字段都存在 |

---

## 测试数据准备脚本

### 脚本1：创建乐捐测试数据

```bash
# 创建一条未来2小时的乐捐预约记录
sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO lejuan_records (coach_no, employee_id, stage_name, scheduled_start_time, lejuan_status, scheduled) VALUES ('10001', '1', '歪歪', datetime('now', '+2 hours'), 'pending', 0);"

# 验证插入
sqlite3 /TG/tgservice/db/tgservice.db "SELECT id, coach_no, employee_id, stage_name, scheduled_start_time, lejuan_status FROM lejuan_records WHERE lejuan_status='pending' ORDER BY id DESC LIMIT 1;"
```

### 脚本2：创建申请测试数据

```bash
# 先查教练手机号
PHONE=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT phone FROM coaches WHERE coach_no='10001';")

# 计算 exec_time（未来2小时）
EXEC_TIME=$(date -d '+2 hours' '+%Y-%m-%d %H:%M:%S')
REST_DATE=$(date '+%Y-%m-%d')

# 插入休息申请记录（带 timer_set）
sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO applications (applicant_phone, application_type, status, extra_data) VALUES ('$PHONE', '休息申请', 1, '{\"timer_set\":true,\"exec_time\":\"$EXEC_TIME\",\"rest_date\":\"$REST_DATE\"}');"

# 验证插入
sqlite3 /TG/tgservice/db/tgservice.db "SELECT id, applicant_phone, application_type, status, substr(extra_data,1,80) FROM applications WHERE application_type='休息申请' ORDER BY id DESC LIMIT 1;"
```

### 脚本3：清理测试数据

```bash
# 删除测试用乐捐记录
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM lejuan_records WHERE stage_name='歪歪' AND lejuan_status='pending' AND id > (SELECT MAX(id)-20 FROM lejuan_records);"

# 删除测试用申请记录
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM applications WHERE id > (SELECT MAX(id)-20 FROM applications) AND extra_data LIKE '%timer_set%';"
```

---

## 快速验证命令（一键检查所有核心功能）

```bash
#!/bin/bash
# 一键验证活跃计时器 API
cd /TG/tgservice/backend

echo "=== 1. 生成 Token ==="
TOKEN=$(node -e "const jwt = require('jsonwebtoken'); console.log(jwt.sign({username:'tgadmin',role:'管理员'}, 'tgservice_jwt_secret_key_2026', {expiresIn:'7d'}))")

echo "=== 2. 无定时器时调用 ==="
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers | python3 -m json.tool

echo "=== 3. 插入乐捐测试数据 ==="
sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO lejuan_records (coach_no, employee_id, stage_name, scheduled_start_time, lejuan_status, scheduled) VALUES ('10001', '1', '歪歪', datetime('now', '+2 hours'), 'pending', 0);"

echo "=== 4. 重启 PM2 恢复定时器 ==="
pm2 restart tgservice-dev
sleep 5

echo "=== 5. 检查活跃计时器 ==="
RESULT=$(curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8088/api/system-report/active-timers)
echo "$RESULT" | python3 -m json.tool

echo "=== 6. 验证字段完整性 ==="
echo "$RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'总计: {data[\"total\"]} 个计时器')
required = ['timerId','type','recordId','execTime','coach_no','employee_id','stage_name','application_type','remainingSeconds']
for t in data['timers']:
    missing = [f for f in required if f not in t]
    if missing:
        print(f'❌ recordId={t.get(\"recordId\")} 缺失字段: {missing}')
    else:
        print(f'✅ recordId={t[\"recordId\"]} type={t[\"type\"]} coach={t[\"stage_name\"]}({t[\"coach_no\"]}) remaining={t[\"remainingSeconds\"]}s')
"

echo "=== 7. 清理测试数据 ==="
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM lejuan_records WHERE stage_name='歪歪' AND lejuan_status='pending' AND id > (SELECT MAX(id)-20 FROM lejuan_records);"
```

---

## 覆盖率说明

| 验收重点 | 覆盖用例 | 覆盖情况 |
|----------|----------|----------|
| 活跃计时器列表显示完整助教信息 | AT-04, AT-06, AT-07, AT-18 | ✅ coach_no, employee_id, stage_name 全覆盖 |
| 能实时反映内存状态 | AT-12, AT-13, AT-15 | ✅ 取消/执行/过期后自动移除 |
| 剩余时间计算准确 | AT-08, AT-09 | ✅ 计算精度 + 时间递减验证 |
| 未授权拦截 | AT-01 | ✅ 401 拦截 |
| 空状态处理 | AT-03 | ✅ 空数组返回 |
| 多类型混合 | AT-10 | ✅ lejuan + application 共存 |
| 字段一致性 | AT-11 | ✅ total 与数组长度一致 |

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
活跃计时器列表显示完整助教信息，能实时反映内存状态，剩余时间计算准确

## 输出要求
- 测试结果写入：/TG/temp/QA-20260420-2/test-results.md
- 格式：表格（用例ID、测试项、优先级、预期结果、实际结果、状态）
- 状态：✅通过 / ❌失败 / ⏭️跳过