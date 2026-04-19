你是测试员B。请执行API接口测试。

## 测试地址
- 后端API：http://127.0.0.1:8088
- **严禁使用 8081 和 8083 端口！**

## 测试用例
```
# QA3 + QA4 API 测试用例

> **QA3**: 公共计时器类 - 计时器模块化管理，系统重启后自动恢复，后台Admin系统报告页面显示计时器日志
> 
> **QA4**: cron批处理 - (1)凌晨2点自动结束乐捐 (2)中午12点奖罚自动同步（未约客罚金、漏单罚金、漏卡罚金、助教日常）
> 
> **测试环境**: 后端API http://127.0.0.1:8088
> **数据库**: /TG/tgservice/db/tgservice.db

---

## 前置准备

### P0-0. 获取管理员Token

所有需要认证的API都需要先登录获取token。

```bash
# 登录管理员账号
curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' | python3 -m json.tool

# 保存返回的 token 供后续使用
TOKEN="返回的token值"

# 后续请求统一携带:
# -H "Authorization: Bearer $TOKEN"
```

### 测试数据准备

```bash
# 查看现有助教（选择测试用助教）
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT coach_no, employee_id, stage_name, phone FROM coaches WHERE employee_id IS NOT NULL AND status != '离职' LIMIT 5;"

# 查看现有水牌状态
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT coach_no, status FROM water_boards LIMIT 5;"

# 查看现有乐捐记录
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT id, coach_no, employee_id, stage_name, lejuan_status, scheduled_start_time FROM lejuan_records ORDER BY id DESC LIMIT 5;"

# 查看现有奖罚记录
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT id, type, confirm_date, phone, name, amount, exec_status FROM reward_penalties ORDER BY id DESC LIMIT 5;"
```

---

## 一、QA3 公共计时器类测试用例

### 1.1 计时器模块化管理

#### TC-QA3-001 [P0] 乐捐定时器初始化检查

**目的**: 验证服务启动时乐捐定时器正确初始化（恢复 + 轮询）

**前置条件**: 服务已启动

```bash
# 检查服务日志中是否有定时器初始化日志
docker logs tgservice 2>&1 | grep -E "乐捐定时器.*已初始化|申请定时器.*已初始化"

# 或开发环境
pm2 logs tgservice-dev --lines 100 | grep -E "乐捐定时器.*已初始化|申请定时器.*已初始化"
```

**预期结果**: 日志中出现 `[乐捐定时器] 已初始化` 和 `[申请定时器] 已初始化`

---

#### TC-QA3-002 [P0] 乐捐定时器 — 当前小时立即激活

**目的**: 验证提交当前小时的乐捐预约时，水牌立即变为「乐捐」状态

```bash
# 步骤1：记录助教当前水牌状态（假设助教ID=1, coach_no=10001）
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT status FROM water_boards WHERE coach_no = 10001;"

# 步骤2：获取当前北京时间
date '+%Y-%m-%d %H:00:00'

# 步骤3：提交当前小时的乐捐预约
TOKEN="..." # 从登录获取
CURRENT_HOUR=$(date '+%Y-%m-%d %H:00:00')
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"$CURRENT_HOUR\",
    \"remark\": \"测试-当前小时立即激活\"
  }" | python3 -m json.tool

# 步骤4：验证返回 immediate=true
# 预期: {"success":true,"data":{"lejuan_status":"active","immediate":true,...}}

# 步骤5：验证水牌状态变为「乐捐」
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT status FROM water_boards WHERE coach_no = 10001;"
# 预期: 乐捐

# 步骤6：验证乐捐记录状态为 active
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT lejuan_status, actual_start_time FROM lejuan_records ORDER BY id DESC LIMIT 1;"
# 预期: lejuan_status = 'active', actual_start_time 有值
```

---

#### TC-QA3-003 [P0] 乐捐定时器 — 预约未来时间

**目的**: 验证预约未来时间的乐捐，记录状态为 pending，水牌不变

```bash
# 步骤1：先确保助教水牌不是乐捐状态
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE water_boards SET status = '早班空闲' WHERE coach_no = 10002;"

# 步骤2：获取明天的某个整点（14:00）
NEXT_HOUR=$(date -d '+1 day 14:00:00' '+%Y-%m-%d %H:%M:%S')

# 步骤3：提交乐捐预约
TOKEN="..."
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"employee_id\": \"2\",
    \"scheduled_start_time\": \"$NEXT_HOUR\",
    \"remark\": \"测试-预约未来时间\"
  }" | python3 -m json.tool

# 预期返回: {"success":true,"data":{"lejuan_status":"pending","immediate":false,...}}

# 步骤4：验证水牌状态不变
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT status FROM water_boards WHERE coach_no = 10002;"
# 预期: 早班空闲（不是乐捐）

# 步骤5：验证乐捐记录为 pending
RECORD_ID=$(sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT id FROM lejuan_records WHERE employee_id='2' AND lejuan_status='pending' ORDER BY id DESC LIMIT 1;")
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT lejuan_status, scheduled, scheduled_start_time FROM lejuan_records WHERE id = $RECORD_ID;"
# 预期: lejuan_status='pending', scheduled=1, scheduled_start_time=$NEXT_HOUR
```

---

#### TC-QA3-004 [P0] 乐捐定时器 — 定时器取消

**目的**: 验证删除 pending 状态的乐捐预约时，定时器被正确取消

```bash
# 步骤1：确认有 pending 记录
RECORD_ID=$(sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT id FROM lejuan_records WHERE employee_id='2' AND lejuan_status='pending' ORDER BY id DESC LIMIT 1;")
echo "待删除记录ID: $RECORD_ID"

# 步骤2：删除乐捐预约
TOKEN="..."
curl -s -X DELETE "http://127.0.0.1:8088/api/lejuan-records/$RECORD_ID?employee_id=2" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 预期: {"success":true,"message":"乐捐预约已删除"}

# 步骤3：验证记录已删除
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT COUNT(*) FROM lejuan_records WHERE id = $RECORD_ID;"
# 预期: 0
```

---

#### TC-QA3-005 [P1] 乐捐归来

**目的**: 验证助教乐捐归来，水牌恢复为空闲状态

```bash
# 步骤1：找到 active 状态的乐捐记录
ACTIVE_ID=$(sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT id FROM lejuan_records WHERE lejuan_status='active' ORDER BY id DESC LIMIT 1;")
echo "active记录ID: $ACTIVE_ID"

# 步骤2：执行乐捐归来
TOKEN="..."
curl -s -X POST "http://127.0.0.1:8088/api/lejuan-records/$ACTIVE_ID/return" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"operator":"tgadmin"}' | python3 -m json.tool

# 预期: {"success":true,"data":{"lejuan_hours":N,...}}

# 步骤3：验证乐捐记录状态变为 returned
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT lejuan_status, lejuan_hours, return_time FROM lejuan_records WHERE id = $ACTIVE_ID;"
# 预期: lejuan_status='returned', lejuan_hours > 0, return_time 有值

# 步骤4：验证水牌状态恢复
COACH_NO=$(sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT coach_no FROM lejuan_records WHERE id = $ACTIVE_ID;")
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT status FROM water_boards WHERE coach_no = $COACH_NO;"
# 预期: 早班空闲 或 晚班空闲（不是乐捐）
```

---

#### TC-QA3-006 [P1] 乐捐报备 — 重复提交拦截

**目的**: 验证同一助教已有 pending/active 记录时，禁止重复提交

```bash
# 步骤1：确认助教1已有 pending 记录（用 TC-QA3-003 创建的或新建一个）
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT id, lejuan_status FROM lejuan_records WHERE employee_id='1' AND lejuan_status IN ('pending','active') LIMIT 1;"

# 步骤2：尝试再次提交
NEXT_HOUR=$(date -d '+1 day 15:00:00' '+%Y-%m-%d %H:%M:%S')
TOKEN="..."
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"employee_id\": \"1\",
    \"scheduled_start_time\": \"$NEXT_HOUR\",
    \"remark\": \"测试-重复提交\"
  }" | python3 -m json.tool

# 预期: {"error":"已有一条待出发的乐捐记录，请先处理"} 或类似错误
```

---

#### TC-QA3-007 [P1] 申请定时器 — 休息/请假自动恢复

**目的**: 验证休息/请假申请通过后，到指定时间水牌自动恢复为空闲

```bash
# 步骤1：查看现有已通过的休息/请假申请
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT id, application_type, applicant_phone, status, extra_data FROM applications WHERE application_type IN ('休息申请','请假申请') AND status = 1 AND extra_data LIKE '%timer_set%' LIMIT 3;"

# 步骤2：如果没有测试数据，创建一个
# 先确认助教3的coach_no
COACH_NO=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no FROM coaches WHERE employee_id='3';")

# 将水牌设为休息状态
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE water_boards SET status = '休息' WHERE coach_no = $COACH_NO;"

# 创建申请记录，exec_time 设为2分钟后（用于快速测试）
EXEC_TIME=$(date -d '+2 minutes' '+%Y-%m-%d %H:%M:%S')
PHONE=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT phone FROM coaches WHERE employee_id='3' LIMIT 1;")
sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT INTO applications (application_type, applicant_phone, status, extra_data, created_at, updated_at)
   VALUES ('休息申请', '$PHONE', 1, '{\"timer_set\":true,\"exec_time\":\"$EXEC_TIME\"}', datetime('now','localtime'), datetime('now','localtime'));"

echo "创建的申请ID: $(sqlite3 /TG/tgservice/db/tgservice.db "SELECT last_insert_rowid();")"
echo "exec_time: $EXEC_TIME"

# 步骤3：等待2分钟后检查
sleep 130

# 步骤4：验证水牌已恢复
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT status FROM water_boards WHERE coach_no = $COACH_NO;"
# 预期: 早班空闲 或 晚班空闲（不是休息）

# 步骤5：验证 extra_data 中 executed=1
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT extra_data FROM applications WHERE application_type='休息申请' AND applicant_phone='$PHONE' ORDER BY id DESC LIMIT 1;"
# 预期: extra_data 包含 "executed":1
```

---

#### TC-QA3-008 [P0] 系统重启后定时器自动恢复

**目的**: 验证服务重启后，pending 状态的乐捐定时器自动恢复

```bash
# 步骤1：创建一个未来时间的 pending 乐捐记录
FUTURE_TIME=$(date -d '+30 minutes' '+%Y-%m-%d %H:%M:%S')
TOKEN="..."
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"employee_id\": \"3\",
    \"scheduled_start_time\": \"$FUTURE_TIME\",
    \"remark\": \"测试-重启恢复\"
  }" | python3 -m json.tool

# 记录ID
RESTORE_ID=$(sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT id FROM lejuan_records WHERE employee_id='3' AND remark='测试-重启恢复' ORDER BY id DESC LIMIT 1;")
echo "恢复测试记录ID: $RESTORE_ID"

# 步骤2：重启服务
# 测试环境
pm2 restart tgservice-dev
# 或生产环境（需确认）
# docker restart tgservice

# 等待服务启动
sleep 10

# 步骤3：检查日志，确认定时器已恢复
# 测试环境
pm2 logs tgservice-dev --lines 50 | grep -E "乐捐定时器.*恢复|乐捐定时器.*已初始化"
# 预期: 看到恢复日志，如 "恢复定时器: 找到 N 条待处理记录"

# 步骤4：验证记录仍为 pending（未提前激活）
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT lejuan_status, scheduled FROM lejuan_records WHERE id = $RESTORE_ID;"
# 预期: lejuan_status='pending', scheduled=1

# 步骤5：等待30分钟后（或手动修改时间快速测试），验证自动激活
# 快速测试：将 scheduled_start_time 改为1分钟后
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE lejuan_records SET scheduled_start_time = datetime('now','localtime','+1 minute') WHERE id = $RESTORE_ID;"
sleep 70
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT lejuan_status, actual_start_time FROM lejuan_records WHERE id = $RESTORE_ID;"
# 预期: lejuan_status='active', actual_start_time 有值
```

---

#### TC-QA3-009 [P1] 轮询检查 — 兜底处理遗漏定时器

**目的**: 验证轮询检查机制能兜底处理 scheduled=0 的遗漏记录

```bash
# 步骤1：手动插入一条 scheduled=0 的 pending 记录（模拟遗漏）
POLL_TIME=$(date -d '+1 minute' '+%Y-%m-%d %H:%M:%S')
COACH_NO=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no FROM coaches WHERE employee_id='5' LIMIT 1;")
sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT INTO lejuan_records (coach_no, employee_id, stage_name, scheduled_start_time, lejuan_status, scheduled, created_at, updated_at)
   VALUES ($COACH_NO, '5', '芝芝', '$POLL_TIME', 'pending', 0, datetime('now','localtime'), datetime('now','localtime'));"

POLL_ID=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT last_insert_rowid();")
echo "轮询测试记录ID: $POLL_ID"

# 步骤2：等待轮询执行（每60秒一次）
sleep 70

# 步骤3：验证记录被标记为 scheduled=1
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT lejuan_status, scheduled FROM lejuan_records WHERE id = $POLL_ID;"
# 预期: scheduled=1

# 步骤4：再等1分钟，验证记录被激活
sleep 60
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT lejuan_status, actual_start_time FROM lejuan_records WHERE id = $POLL_ID;"
# 预期: lejuan_status='active'
```

---

### 1.2 计时器日志可视化（Admin 系统报告页面）

#### TC-QA3-010 [P0] 获取计时器状态 API

**目的**: 验证可以通过 API 获取当前所有活跃定时器状态

```bash
TOKEN="..."

# 获取乐捐待调度定时器列表
curl -s "http://127.0.0.1:8088/api/lejuan-records/pending-timers" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 预期: {"success":true,"data":[...]} 返回所有 pending 状态的记录
```

---

#### TC-QA3-011 [P0] 系统报告页面 — 计时器日志查询

**目的**: 验证后台Admin系统报告页面能显示计时器相关日志

```bash
TOKEN="..."

# 如果已有系统报告 API：
curl -s "http://127.0.0.1:8088/api/system-report/timer-logs" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 预期: 返回计时器日志列表，包含:
# - 定时器类型（乐捐/申请）
# - 记录ID
# - 助教艺名
# - 计划时间
# - 执行状态（已调度/已激活/已跳过）
# - 执行时间
```

> **备注**: 如果此 API 尚未实现，需在 server.js 中新增。以下为期望的 API 设计：
> - `GET /api/system-report/timer-logs?timer_type=lejuan|application&status=all|scheduled|activated|skipped&days=7`
> - `GET /api/system-report/cron-logs?task_type=auto_end_lejuan|sync_reward_penalty&status=all|success|failed&days=7`

---

#### TC-QA3-012 [P1] 操作日志 — 定时器自动操作记录

**目的**: 验证定时器的自动操作被记录到 operation_logs 表

```bash
# 查询定时器相关的操作日志
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT id, operator_name, operation_type, target_type, remark, created_at 
   FROM operation_logs 
   WHERE operator_name = '系统定时任务' 
   ORDER BY id DESC LIMIT 10;"

# 预期: 能看到 "乐捐自动生效"、"申请定时恢复" 等操作类型
```

---

## 二、QA4 cron批处理测试用例

### 2.1 凌晨2点自动结束乐捐

#### TC-QA4-001 [P0] 乐捐自动结束 — 基本流程

**目的**: 验证凌晨2点cron任务自动将 active 状态的乐捐记录结束（转为 returned）

```bash
# 步骤1：准备测试数据 — 创建一个 active 状态的乐捐记录
COACH_NO=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no FROM coaches WHERE employee_id='7' LIMIT 1;")

# 确保水牌是乐捐状态
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE water_boards SET status = '乐捐' WHERE coach_no = $COACH_NO;"

# 插入一条 active 状态的乐捐记录（模拟已到时间的）
sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT INTO lejuan_records (coach_no, employee_id, stage_name, scheduled_start_time, lejuan_status, actual_start_time, created_at, updated_at)
   VALUES ($COACH_NO, '7', '小月', datetime('now','localtime','-2 hours'), 'active', datetime('now','localtime','-2 hours'), datetime('now','localtime'), datetime('now','localtime'));"

LEJUAN_ID=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT last_insert_rowid();")
echo "乐捐记录ID: $LEJUAN_ID"

# 步骤2：手动触发cron任务（模拟凌晨2点）
TOKEN="..."
curl -s -X POST "http://127.0.0.1:8088/api/cron/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task":"auto_end_lejuan"}' | python3 -m json.tool

# 预期: {"success":true,"task":"auto_end_lejuan","processed":1,"skipped":0,...}

# 步骤3：验证乐捐记录状态变化
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT lejuan_status, lejuan_hours, return_time FROM lejuan_records WHERE id = $LEJUAN_ID;"
# 预期: lejuan_status='returned', lejuan_hours=2（向上取整）, return_time 有值

# 步骤4：验证水牌恢复
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT status FROM water_boards WHERE coach_no = $COACH_NO;"
# 预期: 早班空闲 或 晚班空闲
```

---

#### TC-QA4-002 [P0] 乐捐自动结束 — 多条记录处理

**目的**: 验证同时有多条 active 乐捐记录时，全部正确处理

```bash
# 步骤1：创建3条 active 状态的乐捐记录
for EMP_ID in 1 2 3; do
  COACH_NO=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no FROM coaches WHERE employee_id='$EMP_ID' LIMIT 1;")
  sqlite3 /TG/tgservice/db/tgservice.db \
    "UPDATE water_boards SET status = '乐捐' WHERE coach_no = $COACH_NO;"
  sqlite3 /TG/tgservice/db/tgservice.db \
    "INSERT INTO lejuan_records (coach_no, employee_id, stage_name, scheduled_start_time, lejuan_status, actual_start_time, created_at, updated_at)
     VALUES ($COACH_NO, '$EMP_ID', (SELECT stage_name FROM coaches WHERE employee_id='$EMP_ID'), datetime('now','localtime','-3 hours'), 'active', datetime('now','localtime','-3 hours'), datetime('now','localtime'), datetime('now','localtime'));"
done

echo "active记录数: $(sqlite3 /TG/tgservice/db/tgservice.db "SELECT COUNT(*) FROM lejuan_records WHERE lejuan_status='active';")"

# 步骤2：触发cron
TOKEN="..."
curl -s -X POST "http://127.0.0.1:8088/api/cron/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task":"auto_end_lejuan"}' | python3 -m json.tool

# 预期: {"success":true,"processed":3,...}

# 步骤3：验证所有记录都已结束
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT COUNT(*) as ended FROM lejuan_records WHERE lejuan_status='returned' AND date(created_at) = date('now');"
# 预期: ended >= 3
```

---

#### TC-QA4-003 [P1] 乐捐自动结束 — 无活跃记录时跳过

**目的**: 验证没有 active 乐捐记录时，cron任务正常返回0处理

```bash
# 步骤1：确认没有 active 记录
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT COUNT(*) FROM lejuan_records WHERE lejuan_status='active';"
# 预期: 0

# 步骤2：触发cron
TOKEN="..."
curl -s -X POST "http://127.0.0.1:8088/api/cron/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task":"auto_end_lejuan"}' | python3 -m json.tool

# 预期: {"success":true,"processed":0,"message":"无待处理的乐捐记录"}
```

---

#### TC-QA4-004 [P1] 乐捐自动结束 — 操作日志记录

**目的**: 验证自动结束乐捐时写入操作日志

```bash
# 步骤1：先创建一个 active 记录
COACH_NO=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no FROM coaches WHERE employee_id='5' LIMIT 1;")
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE water_boards SET status = '乐捐' WHERE coach_no = $COACH_NO;"
sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT INTO lejuan_records (coach_no, employee_id, stage_name, scheduled_start_time, lejuan_status, actual_start_time, created_at, updated_at)
   VALUES ($COACH_NO, '5', '芝芝', datetime('now','localtime','-1 hours'), 'active', datetime('now','localtime','-1 hours'), datetime('now','localtime'), datetime('now','localtime'));"

# 步骤2：触发cron
TOKEN="..."
curl -s -X POST "http://127.0.0.1:8088/api/cron/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task":"auto_end_lejuan"}' > /dev/null

# 步骤3：查询操作日志
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT operation_type, remark, created_at FROM operation_logs 
   WHERE operation_type LIKE '%乐捐%结束%' OR operation_type LIKE '%乐捐%自动%'
   ORDER BY id DESC LIMIT 3;"

# 预期: 有自动结束乐捐的操作日志记录
```

---

### 2.2 中午12点奖罚自动同步

#### TC-QA4-005 [P0] 奖罚自动同步 — 基本流程

**目的**: 验证中午12点cron任务自动同步奖罚数据（未约客罚金、漏单罚金、漏卡罚金、助教日常）

```bash
# 步骤1：清理测试数据（可选）
sqlite3 /TG/tgservice/db/tgservice.db \
  "DELETE FROM reward_penalties WHERE confirm_date = date('now');"

# 步骤2：确认系统配置中有奖罚类型
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT value FROM system_config WHERE key = 'reward_penalty_types';"

# 如果没有配置，先设置
sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT OR REPLACE INTO system_config (key, value) VALUES ('reward_penalty_types',
   '[{\"奖罚类型\":\"未约客罚金\",\"对象\":\"助教\"},{\"奖罚类型\":\"漏单罚金\",\"对象\":\"助教\"},{\"奖罚类型\":\"漏卡罚金\",\"对象\":\"助教\"},{\"奖罚类型\":\"助教日常\",\"对象\":\"助教\"}]');"

# 步骤3：触发cron同步
TOKEN="..."
curl -s -X POST "http://127.0.0.1:8088/api/cron/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task":"sync_reward_penalty"}' | python3 -m json.tool

# 预期: {"success":true,"task":"sync_reward_penalty","created":N,"updated":M,"skipped":K,...}
```

---

#### TC-QA4-006 [P0] 奖罚自动同步 — 未约客罚金

**目的**: 验证未约客罚金数据正确同步

```bash
# 步骤1：准备测试数据
# 检查今天是否有未约客相关的源数据（根据业务表）
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT COUNT(*) FROM service_orders WHERE date(created_at) = date('now','localtime') AND status = '未约客';"

# 如果没有，手动插入测试订单
COACH_NO=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no FROM coaches WHERE employee_id='1' LIMIT 1;")
sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT INTO service_orders (coach_no, status, created_at)
   VALUES ($COACH_NO, '未约客', datetime('now','localtime'));"

# 步骤2：触发同步
TOKEN="..."
curl -s -X POST "http://127.0.0.1:8088/api/cron/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task":"sync_reward_penalty"}' | python3 -m json.tool

# 步骤3：验证未约客罚金记录
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT type, confirm_date, phone, name, amount, exec_status 
   FROM reward_penalties 
   WHERE type = '未约客罚金' AND confirm_date = date('now')
   ORDER BY id DESC LIMIT 5;"

# 预期: 有未约客罚金记录，金额正确，exec_status='未执行'
```

---

#### TC-QA4-007 [P0] 奖罚自动同步 — 漏单罚金

**目的**: 验证漏单罚金数据正确同步

```bash
# 步骤1：准备漏单测试数据
# 根据业务逻辑，漏单数据可能来自 service_orders 或 table_action_orders
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT COUNT(*) FROM service_orders WHERE date(created_at) = date('now','localtime') AND is_missing = 1;"

# 如果没有漏单数据，插入测试
COACH_NO=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no FROM coaches WHERE employee_id='2' LIMIT 1;")
sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT INTO service_orders (coach_no, status, is_missing, created_at)
   VALUES ($COACH_NO, '已完成', 1, datetime('now','localtime'));"

# 步骤2：触发同步
TOKEN="..."
curl -s -X POST "http://127.0.0.1:8088/api/cron/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task":"sync_reward_penalty"}' | python3 -m json.tool

# 步骤3：验证漏单罚金记录
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT type, confirm_date, phone, name, amount, exec_status 
   FROM reward_penalties 
   WHERE type = '漏单罚金' AND confirm_date = date('now')
   ORDER BY id DESC LIMIT 5;"

# 预期: 有漏单罚金记录
```

---

#### TC-QA4-008 [P0] 奖罚自动同步 — 漏卡罚金

**目的**: 验证漏卡罚金数据正确同步

```bash
# 步骤1：准备漏卡测试数据（根据业务逻辑插入）
# 漏卡可能来自打卡记录缺失等
# 如果已有数据直接测试，否则插入测试记录
# （根据实际业务表结构调整以下SQL）
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT COUNT(*) FROM attendance_records WHERE date(created_at) = date('now','localtime') AND status = '漏卡';"

# 步骤2：触发同步
TOKEN="..."
curl -s -X POST "http://127.0.0.1:8088/api/cron/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task":"sync_reward_penalty"}' | python3 -m json.tool

# 步骤3：验证漏卡罚金记录
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT type, confirm_date, phone, name, amount, exec_status 
   FROM reward_penalties 
   WHERE type = '漏卡罚金' AND confirm_date = date('now')
   ORDER BY id DESC LIMIT 5;"

# 预期: 有漏卡罚金记录（如果业务数据存在）
```

---

#### TC-QA4-009 [P0] 奖罚自动同步 — 助教日常

**目的**: 验证助教日常奖罚数据正确同步

```bash
# 步骤1：准备助教日常测试数据
# 根据业务逻辑，助教日常可能来自水牌状态、服务单等
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT COUNT(*) FROM water_boards WHERE status = '助教日常' OR updated_at >= date('now','localtime');"

# 步骤2：触发同步
TOKEN="..."
curl -s -X POST "http://127.0.0.1:8088/api/cron/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task":"sync_reward_penalty"}' | python3 -m json.tool

# 步骤3：验证助教日常记录
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT type, confirm_date, phone, name, amount, exec_status 
   FROM reward_penalties 
   WHERE type = '助教日常' AND confirm_date = date('now')
   ORDER BY id DESC LIMIT 5;"

# 预期: 有助教日常记录（如果业务数据存在）
```

---

### 2.3 去重逻辑

#### TC-QA4-010 [P0] 奖罚同步 — 去重逻辑（已存在则跳过）

**目的**: 验证奖罚数据已存在时，同步任务跳过而不重复创建

```bash
# 步骤1：先手动创建一条奖罚记录
COACH_PHONE=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT phone FROM coaches WHERE employee_id='1' LIMIT 1;")
COACH_NAME=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT stage_name FROM coaches WHERE employee_id='1' LIMIT 1;")
TODAY=$(date '+%Y-%m-%d')

sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT OR IGNORE INTO reward_penalties (type, confirm_date, phone, name, amount, exec_status, created_at, updated_at)
   VALUES ('未约客罚金', '$TODAY', '$COACH_PHONE', '$COACH_NAME', 50, '未执行', datetime('now','localtime'), datetime('now','localtime'));"

echo "预创建记录: $(sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT id, type, amount FROM reward_penalties WHERE type='未约客罚金' AND confirm_date='$TODAY' AND phone='$COACH_PHONE';")"

# 步骤2：触发同步
TOKEN="..."
curl -s -X POST "http://127.0.0.1:8088/api/cron/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task":"sync_reward_penalty"}' | python3 -m json.tool

# 步骤3：验证没有重复记录
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT COUNT(*) FROM reward_penalties WHERE type='未约客罚金' AND confirm_date='$TODAY' AND phone='$COACH_PHONE';"

# 预期: COUNT = 1（只有一条，没有重复）
```

---

#### TC-QA4-011 [P1] 奖罚同步 — 去重逻辑（批量去重）

**目的**: 验证多条已存在记录都能正确跳过

```bash
# 步骤1：为3个助教创建预存在的奖罚记录
TODAY=$(date '+%Y-%m-%d')
for EMP_ID in 1 2 3; do
  PHONE=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT phone FROM coaches WHERE employee_id='$EMP_ID' LIMIT 1;")
  NAME=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT stage_name FROM coaches WHERE employee_id='$EMP_ID' LIMIT 1;")
  sqlite3 /TG/tgservice/db/tgservice.db \
    "INSERT OR IGNORE INTO reward_penalties (type, confirm_date, phone, name, amount, exec_status, created_at, updated_at)
     VALUES ('漏单罚金', '$TODAY', '$PHONE', '$NAME', 30, '未执行', datetime('now','localtime'), datetime('now','localtime'));"
done

BEFORE_COUNT=$(sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT COUNT(*) FROM reward_penalties WHERE type='漏单罚金' AND confirm_date='$TODAY';")
echo "同步前记录数: $BEFORE_COUNT"

# 步骤2：触发同步
TOKEN="..."
curl -s -X POST "http://127.0.0.1:8088/api/cron/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task":"sync_reward_penalty"}' | python3 -m json.tool

# 步骤3：验证记录数不变
AFTER_COUNT=$(sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT COUNT(*) FROM reward_penalties WHERE type='漏单罚金' AND confirm_date='$TODAY';")
echo "同步后记录数: $AFTER_COUNT"

# 预期: BEFORE_COUNT == AFTER_COUNT（没有新增重复记录）
```

---

### 2.4 批处理执行结果写日志

#### TC-QA4-012 [P0] cron执行日志 — 写入数据库

**目的**: 验证cron任务执行结果写入日志表

```bash
# 步骤1：触发乐捐自动结束
TOKEN="..."
curl -s -X POST "http://127.0.0.1:8088/api/cron/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task":"auto_end_lejuan"}' | python3 -m json.tool

# 步骤2：查询cron执行日志
# 如果存在 cron_logs 或 scheduler_logs 表：
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT * FROM cron_logs ORDER BY id DESC LIMIT 5;" 2>/dev/null || \
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT * FROM scheduler_logs ORDER BY id DESC LIMIT 5;" 2>/dev/null || \
echo "日志表不存在，需确认日志存储位置"

# 预期: 能看到 auto_end_lejuan 任务的执行记录，包含:
# - task_type
# - execute_time
# - status (success/failed)
# - processed_count
# - error_message (如有)
```

---

#### TC-QA4-013 [P1] cron执行日志 — 异常记录

**目的**: 验证cron任务执行失败时，错误信息被记录

```bash
# 此测试需要模拟异常场景（如数据库连接断开等）
# 或者在代码中故意制造一个异常

# 步骤1：触发同步（正常情况应成功）
TOKEN="..."
RESULT=$(curl -s -X POST "http://127.0.0.1:8088/api/cron/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task":"sync_reward_penalty"}')
echo "$RESULT" | python3 -m json.tool

# 步骤2：查询日志中的错误记录
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT task_type, status, error_message, execute_time 
   FROM cron_logs 
   WHERE status = 'failed' 
   ORDER BY id DESC LIMIT 3;" 2>/dev/null || echo "检查服务日志中的错误"

# 预期: 正常情况下 status='success'；异常时有 error_message
```

---

### 2.5 批处理执行结果可视化

#### TC-QA4-014 [P0] 系统报告页面 — cron执行日志查询

**目的**: 验证后台Admin系统报告页面能查询cron批处理执行日志

```bash
TOKEN="..."

# 如果已有cron日志API：
curl -s "http://127.0.0.1:8088/api/system-report/cron-logs?days=7" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 预期: 返回cron执行日志列表，包含:
# - 任务类型（auto_end_lejuan / sync_reward_penalty）
# - 执行时间
# - 执行状态（成功/失败）
# - 处理数量
# - 跳过数量
# - 错误信息（如有）

# 按任务类型筛选
curl -s "http://127.0.0.1:8088/api/system-report/cron-logs?task_type=auto_end_lejuan&days=7" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

curl -s "http://127.0.0.1:8088/api/system-report/cron-logs?task_type=sync_reward_penalty&days=7" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

---

#### TC-QA4-015 [P1] 系统报告页面 — 执行统计

**目的**: 验证系统报告页面能显示cron任务执行统计

```bash
TOKEN="..."

# 如果已有统计API：
curl -s "http://127.0.0.1:8088/api/system-report/cron-stats" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 预期: 返回统计信息，如:
# {
#   "auto_end_lejuan": {
#     "total_runs": 30,
#     "success_rate": "100%",
#     "last_run": "2026-04-19 02:00:00",
#     "last_status": "success",
#     "total_processed": 15
#   },
#   "sync_reward_penalty": {
#     "total_runs": 30,
#     "success_rate": "100%",
#     "last_run": "2026-04-19 12:00:00",
#     "last_status": "success",
#     "total_created": 45,
#     "total_skipped": 10
#   }
# }
```

---

## 三、Cron任务配置验证

#### TC-QA4-016 [P0] Cron时间表验证

**目的**: 验证cron任务的调度时间配置正确

```bash
# 步骤1：检查server.js中的cron配置
grep -n "cron\|schedule\|0 2\|0 12" /TG/tgservice/backend/server.js | head -20

# 预期:
# - 乐捐自动结束: "0 2 * * *" (每天凌晨2点)
# - 奖罚自动同步: "0 12 * * *" (每天中午12点)

# 步骤2：验证cron任务已注册（查看启动日志）
# 测试环境
pm2 logs tgservice-dev --lines 50 | grep -i "cron\|schedule"
# 预期: 看到 cron 任务注册日志
```

---

#### TC-QA4-017 [P1] Cron并发保护

**目的**: 验证同一cron任务不会并发执行

```bash
# 步骤1：快速连续触发两次同一任务
TOKEN="..."

# 第一次触发
curl -s -X POST "http://127.0.0.1:8088/api/cron/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task":"sync_reward_penalty"}' &

# 第二次触发（间隔很短）
sleep 0.1
curl -s -X POST "http://127.0.0.1:8088/api/cron/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task":"sync_reward_penalty"}'

wait

# 预期: 第二次触发应被跳过或排队，不会导致重复处理
```

---

## 四、集成测试

#### TC-QA4-018 [P0] 端到端 — 乐捐完整生命周期

**目的**: 验证乐捐从预约→激活→自动结束→奖罚的完整流程

```bash
# 步骤1：助教提交乐捐预约（未来时间）
TOKEN="..."
FUTURE_TIME=$(date -d '+2 minutes' '+%Y-%m-%d %H:%M:%S')
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"employee_id\": \"7\",
    \"scheduled_start_time\": \"$FUTURE_TIME\",
    \"remark\": \"测试-完整生命周期\"
  }" | python3 -m json.tool

E2E_ID=$(sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT id FROM lejuan_records WHERE remark='测试-完整生命周期' ORDER BY id DESC LIMIT 1;")

# 步骤2：等待2分钟，验证自动激活
sleep 130
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT lejuan_status, actual_start_time FROM lejuan_records WHERE id = $E2E_ID;"
# 预期: active

# 步骤3：手动触发自动结束（模拟凌晨2点）
curl -s -X POST "http://127.0.0.1:8088/api/cron/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task":"auto_end_lejuan"}' | python3 -m json.tool

# 步骤4：验证乐捐已结束
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT lejuan_status, lejuan_hours, return_time FROM lejuan_records WHERE id = $E2E_ID;"
# 预期: returned, lejuan_hours > 0

# 步骤5：触发奖罚同步，验证是否生成乐捐相关奖罚
curl -s -X POST "http://127.0.0.1:8088/api/cron/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task":"sync_reward_penalty"}' | python3 -m json.tool

# 步骤6：查看奖罚记录
PHONE=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT phone FROM coaches WHERE employee_id='7';")
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT type, confirm_date, amount, exec_status FROM reward_penalties 
   WHERE phone = '$PHONE' ORDER BY id DESC LIMIT 5;"
```

---

## 五、测试数据清理

测试完成后清理测试数据：

```bash
# 清理测试乐捐记录
sqlite3 /TG/tgservice/db/tgservice.db \
  "DELETE FROM lejuan_records WHERE remark LIKE '测试%';"

# 清理今天的测试奖罚记录
sqlite3 /TG/tgservice/db/tgservice.db \
  "DELETE FROM reward_penalties WHERE confirm_date = date('now') AND remark LIKE '测试%';"

# 恢复水牌状态
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE water_boards SET status = '早班空闲';"

# 清理测试申请记录
sqlite3 /TG/tgservice/db/tgservice.db \
  "DELETE FROM applications WHERE extra_data LIKE '%测试%';"
```

---

## 测试用例汇总表

| 编号 | 优先级 | 分类 | 测试点 | 状态 |
|------|--------|------|--------|------|
| TC-QA3-001 | P0 | 计时器初始化 | 服务启动时定时器正确初始化 | ⬜ |
| TC-QA3-002 | P0 | 乐捐定时器 | 当前小时立即激活 | ⬜ |
| TC-QA3-003 | P0 | 乐捐定时器 | 预约未来时间pending | ⬜ |
| TC-QA3-004 | P0 | 乐捐定时器 | 定时器取消 | ⬜ |
| TC-QA3-005 | P1 | 乐捐定时器 | 乐捐归来 | ⬜ |
| TC-QA3-006 | P1 | 乐捐定时器 | 重复提交拦截 | ⬜ |
| TC-QA3-007 | P1 | 申请定时器 | 休息/请假自动恢复 | ⬜ |
| TC-QA3-008 | P0 | 重启恢复 | 系统重启后定时器自动恢复 | ⬜ |
| TC-QA3-009 | P1 | 轮询检查 | 兜底处理遗漏定时器 | ⬜ |
| TC-QA3-010 | P0 | 计时器日志 | 获取计时器状态API | ⬜ |
| TC-QA3-011 | P0 | 计时器日志 | 系统报告页面显示计时器日志 | ⬜ |
| TC-QA3-012 | P1 | 计时器日志 | 操作日志记录 | ⬜ |
| TC-QA4-001 | P0 | 乐捐自动结束 | 基本流程 | ⬜ |
| TC-QA4-002 | P0 | 乐捐自动结束 | 多条记录处理 | ⬜ |
| TC-QA4-003 | P1 | 乐捐自动结束 | 无活跃记录时跳过 | ⬜ |
| TC-QA4-004 | P1 | 乐捐自动结束 | 操作日志记录 | ⬜ |
| TC-QA4-005 | P0 | 奖罚同步 | 基本流程 | ⬜ |
| TC-QA4-006 | P0 | 奖罚同步 | 未约客罚金 | ⬜ |
| TC-QA4-007 | P0 | 奖罚同步 | 漏单罚金 | ⬜ |
| TC-QA4-008 | P0 | 奖罚同步 | 漏卡罚金 | ⬜ |
| TC-QA4-009 | P0 | 奖罚同步 | 助教日常 | ⬜ |
| TC-QA4-010 | P0 | 去重逻辑 | 已存在则跳过 | ⬜ |
| TC-QA4-011 | P1 | 去重逻辑 | 批量去重 | ⬜ |
| TC-QA4-012 | P0 | 执行日志 | 写入数据库 | ⬜ |
| TC-QA4-013 | P1 | 执行日志 | 异常记录 | ⬜ |
| TC-QA4-014 | P0 | 执行可视化 | cron日志查询 | ⬜ |
| TC-QA4-015 | P1 | 执行可视化 | 执行统计 | ⬜ |
| TC-QA4-016 | P0 | Cron配置 | 调度时间验证 | ⬜ |
| TC-QA4-017 | P1 | Cron配置 | 并发保护 | ⬜ |
| TC-QA4-018 | P0 | 集成测试 | 乐捐完整生命周期 | ⬜ |

**统计**: P0 = 20个, P1 = 10个, 总计 = 30个

---

## 备注

1. **API前提假设**: 部分API（如 `POST /api/cron/trigger`、`GET /api/system-report/cron-logs`）可能需要新增实现。如果这些API已存在但路径不同，请调整测试URL。
2. **数据库路径**: 测试中使用的数据库路径为 `/TG/tgservice/db/tgservice.db`，根据实际情况调整。
3. **Token认证**: 所有需要认证的API都需要先通过 `POST /api/admin/login` 获取token。
4. **时间窗口**: 乐捐报备时间窗口为每日14:00-次日01:00，测试时需注意。
5. **Cron触发**: 测试中使用 `POST /api/cron/trigger` 手动触发cron任务，避免等待实际时间点。如果系统不支持手动触发，可临时修改cron表达式或等待实际时间。
6. **去重机制**: 奖罚表 `reward_penalties` 有唯一索引 `idx_rp_unique(confirm_date, type, phone)`，天然防止重复插入。同步逻辑应使用 `INSERT OR IGNORE` 或先查询再插入。

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
1. 计时器统一管理，重启自动恢复
2. 计时器日志可视化（后台Admin系统报告页面）
3. 批处理执行结果写日志
4. 批处理执行结果可视化（后台Admin系统报告页面）
5. 去重逻辑：奖罚数据已存在则跳过

## 输出要求
- 测试结果写入：/TG/temp/QA-20260419-03/test-results.md
- 格式：表格（用例ID、测试项、优先级、预期结果、实际结果、状态）
- 状态：✅通过 / ❌失败 / ⏭️跳过