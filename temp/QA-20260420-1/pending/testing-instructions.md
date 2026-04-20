你是测试员B。请执行API接口测试。

## 测试地址
- 后端API：http://127.0.0.1:8088
- **严禁使用 8081 和 8083 端口！**

## 测试用例
```
# API错误日志测试用例

## 项目：天宫国际台球厅管理系统
## QA需求：完善API错误日志
## 测试策略：只用 API/curl 测试，测试地址：http://127.0.0.1:8088

---

## 测试数据准备

### 测试账号
| 角色 | 用户名 | 说明 |
|------|--------|------|
| 管理员 | tgadmin | 后台管理员 |
| 收银员 | tgcashier | 收银台权限 |
| 店长 | 18680174119 | 店长权限 |
| 助教管理 | 13760517760 | 助教管理权限 |

### 测试助教数据（从数据库获取）
| coach_no | employee_id | stage_name | shift | 当前水牌状态 |
|----------|-------------|------------|-------|--------------|
| 10001 | 1 | 歪歪 | 晚班 | 下班 |
| 10002 | 2 | 陆飞 | 早班 | 早班空闲（需确认） |
| 10003 | 3 | 六六 | 晚班 | 晚班空闲（需确认） |
| 10022 | - | 四瑶 | 晚班 | 晚班上桌(普台26) |
| 10012 | - | 柳柳 | 早班 | 早班上桌(VIP5) |

### 测试台桌数据
| 台桌号 | 状态 |
|--------|------|
| 普台1 | 接待中 |
| VIP5 | - |

---

## 测试用例分类

### P0 - 核心功能（必须通过）

#### TC-P0-001: 上桌单 - 重复上桌拒绝
**API**: POST /api/table-action-orders  
**场景**: 助教已在某台桌上桌，再次提交相同台桌的上桌单  
**预期**: 返回 400 错误，日志记录拒绝原因  
**测试步骤**:
```bash
# 1. 先确认助教10022当前状态为"晚班上桌"且table_no包含"普台26"
# 2. 尝试对同一台桌重复上桌
curl -X POST http://127.0.0.1:8088/api/table-action-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"table_no":"普台26","coach_no":"10022","order_type":"上桌单","action_category":"普通课","stage_name":"四瑶"}'

# 预期响应:
# {"success":false,"error":"已在台桌 普台26 上，不能重复上桌"}

# 验证日志:
grep "已在台桌" /TG/run/logs/operation.log
grep "重复上桌" /TG/run/logs/operation.log
```

#### TC-P0-002: 上桌单 - 离店状态拒绝
**API**: POST /api/table-action-orders  
**场景**: 下班/公休/请假等状态的助教提交上桌单  
**预期**: 返回 400 错误，日志记录状态不允许  
**测试步骤**:
```bash
# 助教10001状态为"下班"，提交上桌单应被拒绝
curl -X POST http://127.0.0.1:8088/api/table-action-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"table_no":"普台1","coach_no":"10001","order_type":"上桌单","action_category":"普通课","stage_name":"歪歪"}'

# 预期响应:
# {"success":false,"error":"当前状态（下班）不允许提交上桌单"}

# 验证日志:
grep "不允许提交上桌单" /TG/run/logs/operation.log
```

#### TC-P0-003: 下桌单 - 非上桌状态拒绝
**API**: POST /api/table-action-orders  
**场景**: 空闲状态的助教提交下桌单  
**预期**: 返回 400 错误，日志记录状态不允许  
**测试步骤**:
```bash
# 假设助教10001为"下班"或"空闲"状态，提交下桌单
curl -X POST http://127.0.0.1:8088/api/table-action-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"table_no":"普台1","coach_no":"10001","order_type":"下桌单","stage_name":"歪歪"}'

# 预期响应:
# {"success":false,"error":"当前状态（下班）不允许下桌"}

# 验证日志:
grep "不允许下桌" /TG/run/logs/operation.log
```

#### TC-P0-004: 上班打卡 - 已在班状态拒绝
**API**: POST /api/coaches/:coach_no/clock-in  
**场景**: 已上班的助教再次打卡上班  
**预期**: 返回 400 错误，日志记录重复上班  
**测试步骤**:
```bash
# 需要先确认某助教状态为"早班空闲"或"晚班空闲"
# 然后尝试再次上班
curl -X POST http://127.0.0.1:8088/api/coaches/10002/clock-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{}'

# 预期响应（如果状态为空闲）:
# {"success":false,"error":"助教已在班状态,无需重复上班"}

# 验证日志:
grep "已在班状态" /TG/run/logs/operation.log
grep "重复上班" /TG/run/logs/operation.log
```

#### TC-P0-005: 上班打卡 - 上桌状态拒绝
**API**: POST /api/coaches/:coach_no/clock-in  
**场景**: 正在上桌的助教尝试上班打卡  
**预期**: 返回 400 错误，日志记录上桌状态不能上班  
**测试步骤**:
```bash
# 助教10022当前状态为"晚班上桌"
curl -X POST http://127.0.0.1:8088/api/coaches/10022/clock-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{}'

# 预期响应:
# {"success":false,"error":"上桌状态不能点上班"}

# 验证日志:
grep "上桌状态不能点上班" /TG/run/logs/operation.log
```

#### TC-P0-006: 下班打卡 - 非允许状态拒绝
**API**: POST /api/coaches/:coach_no/clock-out  
**场景**: 下班/公休/请假状态的助教尝试下班打卡  
**预期**: 返回 400 错误，日志记录状态不允许下班  
**测试步骤**:
```bash
# 助教10001状态为"下班"
curl -X POST http://127.0.0.1:8088/api/coaches/10001/clock-out \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{}'

# 预期响应:
# {"success":false,"error":"当前状态(下班)不允许下班"}

# 验证日志:
grep "不允许下班" /TG/run/logs/operation.log
```

---

### P1 - 重要功能

#### TC-P1-001: 申请审批 - 重复审批拒绝
**API**: PUT /api/applications/:id/approve  
**场景**: 对已审批过的申请再次审批  
**预期**: 返回 400 错误，日志记录重复审批  
**测试步骤**:
```bash
# 1. 先查询一个已审批的申请（status=1或2）
sqlite3 /TG/tgservice/db/tgservice.db "SELECT id, status FROM applications WHERE status IN (1,2) LIMIT 1"

# 2. 尝试再次审批
curl -X PUT http://127.0.0.1:8088/api/applications/<已审批id>/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"approver_phone":"tgadmin","status":1}'

# 预期响应:
# {"success":false,"error":"该申请已审批过"}

# 验证日志:
grep "已审批过" /TG/run/logs/operation.log
```

#### TC-P1-002: 申请提交 - 班次切换次数超限
**API**: POST /api/applications  
**场景**: 某助教本月班次切换已达2次，再次提交  
**预期**: 返回 400 错误，日志记录次数超限  
**测试步骤**:
```bash
# 需要先模拟该助教已有2次班次切换申请通过
# 然后提交第3次
curl -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"applicant_phone":"<phone>","application_type":"班次切换申请","extra_data":{"target_shift":"早班"}}'

# 预期响应:
# {"success":false,"error":"本月班次切换次数已达上限（2次/月）"}

# 验证日志:
grep "班次切换次数已达上限" /TG/run/logs/operation.log
```

#### TC-P1-003: 申请提交 - 休息申请次数超限
**API**: POST /api/applications  
**场景**: 某助教本月休息已达4天，再次提交  
**预期**: 返回 400 错误，日志记录休息日超限  
**测试步骤**:
```bash
# 需要先模拟该助教已有4天休息申请通过
curl -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"applicant_phone":"<phone>","application_type":"休息申请","extra_data":{"rest_date":"2026-04-25"}}'

# 预期响应:
# {"success":false,"error":"本月休息日已达上限（4天/月）"}

# 验证日志:
grep "休息日已达上限" /TG/run/logs/operation.log
```

#### TC-P1-004: 申请审批 - 上桌状态助教审批拒绝
**API**: PUT /api/applications/:id/approve  
**场景**: 审批通过某申请时，助教正在上桌  
**预期**: 返回 400 错误，日志记录上桌无法审批  
**测试步骤**:
```bash
# 1. 为正在上桌的助教（如10022）创建一个待审批申请
# 2. 尝试审批通过
curl -X PUT http://127.0.0.1:8088/api/applications/<待审批id>/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"approver_phone":"tgadmin","status":1}'

# 预期响应:
# {"success":false,"error":"助教XXX正在上桌服务（晚班上桌），无法审批通过XXX申请"}

# 验证日志:
grep "正在上桌服务" /TG/run/logs/operation.log
grep "无法审批通过" /TG/run/logs/operation.log
```

#### TC-P1-005: 水牌状态更新 - 无效状态值
**API**: PUT /api/water-boards/:coach_no/status  
**场景**: 提交无效的水牌状态值  
**预期**: 返回 400 错误，日志记录无效状态  
**测试步骤**:
```bash
curl -X PUT http://127.0.0.1:8088/api/water-boards/10001/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"status":"无效状态"}'

# 预期响应:
# {"success":false,"error":"无效的状态值"}

# 验证日志:
grep "无效的状态值" /TG/run/logs/operation.log
```

#### TC-P1-006: 约客锁定 - 时间限制拒绝
**API**: POST /api/guest-invitations/lock-should-invite  
**场景**: 早班在16:00前、晚班在20:00前尝试锁定应约客  
**预期**: 返回 400 错误，日志记录时间限制  
**注意**: 此测试需要根据当前时间判断是否可触发  
**测试步骤**:
```bash
# 如果当前时间早于16:00，测试早班锁定
curl -X POST http://127.0.0.1:8088/api/guest-invitations/lock-should-invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"date":"2026-04-20","shift":"早班"}'

# 预期响应（早于16:00时）:
# {"success":false,"error":"早班约客审查需在16:00后开始"}

# 验证日志:
grep "约客审查需在" /TG/run/logs/operation.log
```

#### TC-P1-007: 约客锁定 - 重复锁定拒绝
**API**: POST /api/guest-invitations/lock-should-invite  
**场景**: 同一天同一班次重复锁定  
**预期**: 返回 400 错误，日志记录重复锁定  
**测试步骤**:
```bash
# 第一次锁定成功后，再次锁定
curl -X POST http://127.0.0.1:8088/api/guest-invitations/lock-should-invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"date":"2026-04-20","shift":"晚班"}'

# 第二次锁定（假设第一次已成功）
curl -X POST http://127.0.0.1:8088/api/guest-invitations/lock-should-invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"date":"2026-04-20","shift":"晚班"}'

# 预期响应:
# {"success":false,"error":"今日已开始审查，无需重复锁定"}

# 验证日志:
grep "无需重复锁定" /TG/run/logs/operation.log
```

---

### P2 - 边界场景

#### TC-P2-001: 上桌单 - 缺少必填字段
**API**: POST /api/table-action-orders  
**场景**: 提交上桌单缺少 table_no 或 coach_no  
**预期**: 返回 400 错误，日志记录缺少字段  
**测试步骤**:
```bash
curl -X POST http://127.0.0.1:8088/api/table-action-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"coach_no":"10001","order_type":"上桌单","stage_name":"歪歪"}'

# 预期响应:
# {"success":false,"error":"缺少必填字段"}

# 验证日志:
grep "缺少必填字段" /TG/run/logs/operation.log
```

#### TC-P2-002: 上桌单 - 无效订单类型
**API**: POST /api/table-action-orders  
**场景**: 提交无效的 order_type  
**预期**: 返回 400 错误，日志记录无效类型  
**测试步骤**:
```bash
curl -X POST http://127.0.0.1:8088/api/table-action-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"table_no":"普台1","coach_no":"10001","order_type":"无效类型","stage_name":"歪歪"}'

# 预期响应:
# {"success":false,"error":"无效的订单类型"}

# 验证日志:
grep "无效的订单类型" /TG/run/logs/operation.log
```

#### TC-P2-003: 上桌单 - 水牌不存在
**API**: POST /api/table-action-orders  
**场景**: 提交不存在助教的上桌单  
**预期**: 返回 404 错误，日志记录水牌不存在  
**测试步骤**:
```bash
curl -X POST http://127.0.0.1:8088/api/table-action-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"table_no":"普台1","coach_no":"99999","order_type":"上桌单","action_category":"普通课","stage_name":"不存在"}'

# 预期响应:
# {"success":false,"error":"水牌不存在"}

# 验证日志:
grep "水牌不存在" /TG/run/logs/operation.log
```

#### TC-P2-004: 批量修改班次 - 空列表
**API**: PUT /api/coaches/batch-shift  
**场景**: 提交空的助教列表  
**预期**: 返回 400 错误，日志记录列表为空  
**测试步骤**:
```bash
curl -X PUT http://127.0.0.1:8088/api/coaches/batch-shift \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"coach_no_list":[],"shift":"早班"}'

# 预期响应:
# {"success":false,"error":"助教列表不能为空"}

# 验证日志:
grep "助教列表不能为空" /TG/run/logs/operation.log
```

#### TC-P2-005: 批量修改班次 - 无效班次
**API**: PUT /api/coaches/batch-shift  
**场景**: 提交无效的班次值  
**预期**: 返回 400 错误，日志记录无效班次  
**测试步骤**:
```bash
curl -X PUT http://127.0.0.1:8088/api/coaches/batch-shift \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"coach_no_list":["10001","10002"],"shift":"无效班次"}'

# 预期响应:
# {"success":false,"error":"无效的班次值"}

# 验证日志:
grep "无效的班次值" /TG/run/logs/operation.log
```

#### TC-P2-006: 服务单创建 - 缺少台桌号
**API**: POST /api/service-orders  
**场景**: 创建服务单缺少台桌号  
**预期**: 返回 400 错误，日志记录缺少台桌号  
**测试步骤**:
```bash
curl -X POST http://127.0.0.1:8088/api/service-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"requirement":"测试需求","requester_name":"测试"}'

# 预期响应:
# {"success":false,"error":"缺少必填字段：台桌号"}

# 验证日志:
grep "缺少必填字段：台桌号" /TG/run/logs/operation.log
```

#### TC-P2-007: 服务单状态更新 - 无效状态
**API**: PUT /api/service-orders/:id/status  
**场景**: 更新服务单状态为无效值  
**预期**: 返回 400 错误，日志记录无效状态  
**测试步骤**:
```bash
# 先获取一个存在的服务单ID
sqlite3 /TG/tgservice/db/tgservice.db "SELECT id FROM service_orders LIMIT 1"

curl -X PUT http://127.0.0.1:8088/api/service-orders/<id>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"status":"无效状态"}'

# 预期响应:
# {"success":false,"error":"无效的状态值，应为：待处理、已完成、已取消"}

# 验证日志:
grep "无效的状态值" /TG/run/logs/operation.log
```

#### TC-P2-008: 申请提交 - 缺少必填字段
**API**: POST /api/applications  
**场景**: 提交申请缺少 applicant_phone  
**预期**: 返回 400 错误，日志记录缺少字段  
**测试步骤**:
```bash
curl -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"application_type":"早加班申请"}'

# 预期响应:
# {"success":false,"error":"缺少必填字段"}

# 验证日志:
grep "缺少必填字段" /TG/run/logs/operation.log
```

#### TC-P2-009: 申请提交 - 无效申请类型
**API**: POST /api/applications  
**场景**: 提交无效的申请类型  
**预期**: 返回 400 错误，日志记录无效类型  
**测试步骤**:
```bash
curl -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"applicant_phone":"13800138000","application_type":"无效申请"}'

# 预期响应:
# {"success":false,"error":"无效的申请类型"}

# 验证日志:
grep "无效的申请类型" /TG/run/logs/operation.log
```

#### TC-P2-010: 取消申请 - 非待处理状态
**API**: DELETE /api/applications/:id  
**场景**: 尝试取消已审批的申请  
**预期**: 返回 400 错误，日志记录只能取消待处理  
**测试步骤**:
```bash
# 获取一个已审批的申请ID
sqlite3 /TG/tgservice/db/tgservice.db "SELECT id, applicant_phone FROM applications WHERE status IN (1,2) LIMIT 1"

curl -X DELETE "http://127.0.0.1:8088/api/applications/<已审批id>?applicant_phone=<phone>" \
  -H "Authorization: Bearer <token>"

# 预期响应:
# {"success":false,"error":"只能取消待处理状态的申请"}

# 验证日志:
grep "只能取消待处理状态的申请" /TG/run/logs/operation.log
```

---

## 日志验证方法

### 日志文件位置
- 开发环境: `/TG/tgservice/logs/operation.log`
- 生产环境: `/TG/run/logs/operation.log`

### 日志格式要求
每条错误日志应包含：
- 操作人（operator_phone/operator_name）
- 请求内容（可从 target_type/target_id/old_value/new_value 推断）
- 拒绝原因（remark 或 error 字段）
- HTTP 状态码（从 API 响应获取）

### 验证命令示例
```bash
# 查看最近的错误日志
tail -50 /TG/run/logs/operation.log

# 搜索特定错误关键词
grep "重复上桌" /TG/run/logs/operation.log
grep "不允许" /TG/run/logs/operation.log

# 统计今日错误日志数量
grep "$(date +%Y-%m-%d)" /TG/run/logs/operation.log | wc -l
```

---

## 测试执行注意事项

1. **认证Token获取**: 需要先调用登录API获取有效token
   ```bash
   curl -X POST http://127.0.0.1:8088/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"tgadmin","password":"<password>"}'
   ```

2. **测试数据准备**: 部分测试需要特定的数据状态，可能需要：
   - 直接修改数据库状态
   - 或先执行正常操作达到特定状态

3. **并发冲突处理**: TC-P0-001等测试涉及并发更新，需要确保测试时数据状态稳定

4. **时间相关测试**: TC-P1-006涉及时间限制，需要根据当前时间判断是否可触发

5. **日志清理**: 测试前可清空日志文件，便于验证
   ```bash
   # 清空日志（可选）
   echo "" > /TG/run/logs/operation.log
   ```

---

## 测试用例统计

| 优先级 | 数量 | 覆盖API |
|--------|------|---------|
| P0 | 6 | table-action-orders, coaches (clock-in/out) |
| P1 | 7 | applications, water-boards, guest-invitations |
| P2 | 10 | table-action-orders, coaches, service-orders, applications |
| **总计** | **23** | 覆盖主要拒绝场景 |

---

## 附录：完整curl测试脚本示例

```bash
#!/bin/bash
# API错误日志测试脚本
# 测试地址: http://127.0.0.1:8088

BASE_URL="http://127.0.0.1:8088"
LOG_FILE="/TG/run/logs/operation.log"

# 登录获取token（需替换实际密码）
echo "=== 登录获取Token ==="
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | jq -r '.data.token')

echo "Token: $TOKEN"

# TC-P0-001: 重复上桌测试
echo "=== TC-P0-001: 重复上桌测试 ==="
curl -s -X POST "$BASE_URL/api/table-action-orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"table_no":"普台26","coach_no":"10022","order_type":"上桌单","action_category":"普通课","stage_name":"四瑶"}'

echo ""
echo "验证日志:"
grep "重复上桌" $LOG_FILE | tail -3

# 更多测试...
```

---

_测试用例编写完成，等待程序员A完成代码修改后执行测试验证_
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
1. 所有throw {status: xxx, error: xxx}类型的业务拒绝错误都被记录到operation.log 2. 日志格式包含：操作人、请求内容、拒绝原因、HTTP状态码 3. 测试验证：故意触发拒绝场景（如重复上桌、状态不允许）后能在日志中找到记录

## 输出要求
- 测试结果写入：/TG/temp/QA-20260420-1/test-results.md
- 格式：表格（用例ID、测试项、优先级、预期结果、实际结果、状态）
- 状态：✅通过 / ❌失败 / ⏭️跳过