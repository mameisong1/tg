你是QA审计员。请审计以下测试用例。

## 测试用例内容
```
# 邀请助教上桌功能 - API测试用例

**测试环境**: http://127.0.0.1:8088
**测试日期**: 2026-04-24
**测试员**: 测试员B

---

## 一、需求分析

### 功能概述
前台H5助教详情页面，邀请助教上桌功能：
- 预约教练按钮改名为"邀请上桌"
- 水牌状态为空闲时按钮可用，非空闲时按钮禁用
- 进入页面时检查Storage中的台桌号是否失效
- 点击后验证台桌号有效性，显示确认对话框
- 确认后发送服务单

### 后端API涉及
| API | 功能 | 说明 |
|-----|------|------|
| GET /api/coaches/:coachNo | 助教详情 | 返回水牌状态 |
| GET /api/front-config | 前端配置 | 返回台桌授权有效期 |
| GET /api/table/:pinyin | 台桌信息 | 验证台桌有效性 |
| POST /api/service-orders | 创建服务单 | 发送邀请函 |

---

## 二、测试数据准备

### 2.1 查询现有数据

```bash
# 查询助教数据（包含水牌状态）
sqlite3 /TG/run/db/tgservice.db "
SELECT c.coach_no, c.employee_id, c.stage_name, c.shift, wb.status
FROM coaches c
LEFT JOIN water_boards wb ON c.coach_no = wb.coach_no
WHERE c.status != '离职' LIMIT 10;
"

# 查询空闲状态的助教
sqlite3 /TG/run/db/tgservice.db "
SELECT c.coach_no, c.employee_id, c.stage_name, wb.status
FROM coaches c
INNER JOIN water_boards wb ON c.coach_no = wb.coach_no
WHERE wb.status LIKE '%空闲%';
"

# 查询台桌数据
sqlite3 /TG/run/db/tgservice.db "
SELECT name, name_pinyin, status FROM tables LIMIT 5;
"
```

### 2.2 创建测试数据（如需要）

**如果没有空闲状态的助教，手动更新水牌状态：**

```bash
# 设置助教10002为早班空闲状态
sqlite3 /TG/run/db/tgservice.db "
UPDATE water_boards SET status = '早班空闲' WHERE coach_no = 10002;
"

# 验证更新
sqlite3 /TG/run/db/tgservice.db "
SELECT coach_no, stage_name, status FROM water_boards WHERE coach_no = 10002;
"
```

**测试台桌号（使用现有数据）：**
- 普台1 (putai1)
- 普台2 (putai2)
- 普台5 (putai5)

---

## 三、API测试用例

### 3.1 助教详情API - 水牌状态返回

#### TC-API-001: 查询助教详情包含水牌状态
**优先级**: P0
**目的**: 验证助教详情API返回正确的水牌状态信息
**前置条件**: 助教10002存在，水牌状态为"早班空闲"

**测试步骤**:
```bash
curl -s http://127.0.0.1:8088/api/coaches/10002 | jq '.'
```

**预期结果**:
```json
{
  "coach_no": 10002,
  "employee_id": "2",
  "stage_name": "陆飞",
  "water_status": "早班空闲",
  "display_status": "空闲",
  "display_status_icon": "🟢",
  "display_status_text": "空闲"
}
```

**验收标准**:
1. ✅ 返回 water_status 字段（水牌原始状态）
2. ✅ 返回 display_status 字段（分类后的状态：空闲/上桌/离店）
3. ✅ 返回 display_status_icon 和 display_status_text

---

#### TC-API-002: 验证不同水牌状态的display_status分类
**优先级**: P1
**目的**: 验证水牌状态分类逻辑正确
**前置条件**: 查询不同状态的助教

**测试步骤**:
```bash
# 测试"下班"状态
curl -s http://127.0.0.1:8088/api/coaches/10003 | jq '.display_status, .display_status_text'

# 测试"休息"状态
curl -s http://127.0.0.1:8088/api/coaches/10002 | jq '.display_status, .display_status_text'
```

**预期结果**:
| water_status | display_status | display_status_icon |
|--------------|----------------|---------------------|
| 早班空闲/晚班空闲 | 空闲 | 🟢 |
| 早班上桌/晚班上桌 | 上桌 | 🟡 |
| 下班/休息/公休/请假/乐捐 | 离店 | ⚪ |

**验收标准**:
1. ✅ 空闲状态正确分类为"空闲"
2. ✅ 上桌状态正确分类为"上桌"
3. ✅ 其他状态正确分类为"离店"

---

### 3.2 前端配置API - 台桌授权有效期

#### TC-API-003: 获取台桌授权有效期配置
**优先级**: P0
**目的**: 验证前端可以获取台桌授权有效期，用于前端判断台桌号是否失效
**前置条件**: 无

**测试步骤**:
```bash
curl -s http://127.0.0.1:8088/api/front-config | jq '.'
```

**预期结果**:
```json
{
  "tableAuthExpireMinutes": 5,
  "env": "test"
}
```

**验收标准**:
1. ✅ 返回 tableAuthExpireMinutes 字段
2. ✅ 测试环境返回 5 分钟（生产环境为 30 分钟）
3. ✅ 返回 env 字段标识当前环境

**说明**: 前端使用此值判断 Storage 中保存的台桌号是否过期（前端逻辑，无法用API直接测试）

---

### 3.3 台桌有效性验证API

#### TC-API-004: 通过拼音查询台桌信息（有效台桌）
**优先级**: P0
**目的**: 验证台桌查询API可以返回台桌信息，用于前端验证台桌号有效性
**前置条件**: 台桌"普台1"存在

**测试步骤**:
```bash
curl -s http://127.0.0.1:8088/api/table/putai1 | jq '.'
```

**预期结果**:
```json
{
  "id": 1,
  "area": "普台",
  "name": "普台1",
  "name_pinyin": "putai1",
  "status": "空闲"
}
```

**验收标准**:
1. ✅ 返回台桌信息（包含name字段）
2. ✅ 状态码 200

---

#### TC-API-005: 查询不存在的台桌
**优先级**: P1
**目的**: 验证台桌不存在时返回404，前端可据此判断台桌失效
**前置条件**: 台桌"invalid_table"不存在

**测试步骤**:
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" http://127.0.0.1:8088/api/table/invalid_table
```

**预期结果**:
```json
{
  "error": "台桌不存在"
}
```
HTTP Status: 404

**验收标准**:
1. ✅ 返回 404 状态码
2. ✅ 返回错误信息"台桌不存在"

---

### 3.4 服务单创建API

#### TC-API-006: 创建"邀请上桌"服务单（正常流程）
**优先级**: P0
**目的**: 验证邀请助教上桌的服务单可以正确创建
**前置条件**: 
1. 助教10002存在（工号：2，艺名：陆飞）
2. 台桌号：普台1
3. 已获取有效的认证token（助教登录后）

**测试步骤**:
```bash
# 先登录获取token（模拟助教登录）
curl -s -X POST http://127.0.0.1:8088/api/coach/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "助教手机号", "password": "密码"}' | jq '.token'

# 使用token创建服务单
curl -s -X POST http://127.0.0.1:8088/api/service-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "table_no": "普台1",
    "requirement": "助教上桌邀请函（工号：2，艺名：陆飞）",
    "requester_name": "陆飞",
    "requester_type": "助教"
  }' | jq '.'
```

**预期结果**:
```json
{
  "success": true,
  "data": {
    "id": <新生成的ID>,
    "status": "待处理"
  }
}
```

**验收标准**:
1. ✅ 返回 success: true
2. ✅ 返回新创建的服务单ID
3. ✅ 服务单状态为"待处理"
4. ✅ 数据库中正确记录服务单内容

**数据库验证**:
```bash
sqlite3 /TG/run/db/tgservice.db "
SELECT id, table_no, requirement, requester_name, requester_type, status, created_at
FROM service_orders
WHERE requirement LIKE '%助教上桌邀请函%'
ORDER BY id DESC LIMIT 1;
"
```

---

#### TC-API-007: 创建服务单缺少台桌号
**优先级**: P1
**目的**: 验证缺少台桌号时返回错误（对应前端台桌失效场景）
**前置条件**: 已获取认证token

**测试步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/service-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "table_no": "",
    "requirement": "助教上桌邀请函（工号：2，艺名：陆飞）",
    "requester_name": "陆飞",
    "requester_type": "助教"
  }' | jq '.'
```

**预期结果**:
```json
{
  "success": false,
  "error": "缺少必填字段：台桌号"
}
```

**验收标准**:
1. ✅ 返回 success: false
2. ✅ 错误信息明确指出缺少台桌号

---

#### TC-API-008: 创建服务单缺少需求内容
**优先级**: P1
**目的**: 验证缺少需求内容时返回错误
**前置条件**: 已获取认证token

**测试步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/service-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "table_no": "普台1",
    "requirement": "",
    "requester_name": "陆飞",
    "requester_type": "助教"
  }' | jq '.'
```

**预期结果**:
```json
{
  "success": false,
  "error": "缺少必填字段：需求内容不能为空"
}
```

---

#### TC-API-009: 未登录创建服务单
**优先级**: P1
**目的**: 验证未认证时无法创建服务单
**前置条件**: 无token

**测试步骤**:
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://127.0.0.1:8088/api/service-orders \
  -H "Content-Type: application/json" \
  -d '{
    "table_no": "普台1",
    "requirement": "助教上桌邀请函",
    "requester_name": "陆飞",
    "requester_type": "助教"
  }'
```

**预期结果**:
```json
{
  "success": false,
  "error": "未登录或登录已过期"
}
```
HTTP Status: 401

**验收标准**:
1. ✅ 返回 401 状态码
2. ✅ 错误信息明确指出未登录

---

### 3.5 综合测试场景

#### TC-API-010: 完整流程测试（模拟前端调用链）
**优先级**: P0
**目的**: 验证完整的API调用链是否正确
**前置条件**: 
1. 助教10002水牌状态为"早班空闲"
2. 台桌"普台1"存在
3. 助教已登录

**测试步骤**:
```bash
# 1. 获取助教详情（检查水牌状态）
curl -s http://127.0.0.1:8088/api/coaches/10002 | jq '.water_status, .display_status'

# 2. 获取前端配置（台桌授权有效期）
curl -s http://127.0.0.1:8088/api/front-config | jq '.tableAuthExpireMinutes'

# 3. 验证台桌有效性
curl -s http://127.0.0.1:8088/api/table/putai1 | jq '.name'

# 4. 创建服务单（邀请上桌）
curl -s -X POST http://127.0.0.1:8088/api/service-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "table_no": "普台1",
    "requirement": "助教上桌邀请函（工号：2，艺名：陆飞）",
    "requester_name": "陆飞",
    "requester_type": "助教"
  }' | jq '.success, .data.id'

# 5. 验证服务单已创建
sqlite3 /TG/run/db/tgservice.db "
SELECT id, table_no, requirement, status FROM service_orders 
WHERE requirement LIKE '%陆飞%' 
ORDER BY id DESC LIMIT 1;
"
```

**预期结果**:
1. ✅ 步骤1返回 water_status: "早班空闲", display_status: "空闲"
2. ✅ 步骤2返回 tableAuthExpireMinutes: 5
3. ✅ 步骤3返回 name: "普台1"
4. ✅ 步骤4返回 success: true 和服务单ID
5. ✅ 步骤5数据库中存在新服务单，requirement包含助教工号和艺名

---

#### TC-API-011: 台桌失效场景测试
**优先级**: P1
**目的**: 验证台桌不存在时的错误处理
**前置条件**: 台桌"invalid"不存在

**测试步骤**:
```bash
# 1. 尝试查询不存在的台桌
curl -s -w "\nHTTP Status: %{http_code}\n" http://127.0.0.1:8088/api/table/invalid

# 2. 使用不存在的台桌创建服务单（应该失败）
curl -s -X POST http://127.0.0.1:8088/api/service-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "table_no": "invalid",
    "requirement": "助教上桌邀请函",
    "requester_name": "陆飞",
    "requester_type": "助教"
  }' | jq '.'
```

**预期结果**:
1. ✅ 步骤1返回 404 和错误信息
2. ✅ 步骤2可以成功创建服务单（API不验证台桌是否存在，只验证table_no字段不为空）

**说明**: 前端应在调用服务单API前先验证台桌有效性

---

## 四、验收重点对照

### 验收点1: 按钮状态与水牌状态同步
**API测试覆盖**: TC-API-001, TC-API-002
**说明**: 前端根据 `display_status` 判断按钮状态
- `display_status: "空闲"` → 按钮可用
- `display_status: "上桌" 或 "离店"` → 按钮禁用

### 验收点2: 台桌号失效检测逻辑正确
**API测试覆盖**: TC-API-003, TC-API-004, TC-API-005
**说明**: 
- 前端通过 `/api/front-config` 获取有效期
- 前端通过 `/api/table/:pinyin` 验证台桌是否存在
- 前端结合两者判断 Storage 中的台桌号是否失效

### 验收点3: 对话框样式与预约助教一致
**API测试覆盖**: 无（纯前端UI测试）
**说明**: 此验收点需要浏览器测试验证，不属于API测试范围

### 验收点4: 服务单正确发送
**API测试覆盖**: TC-API-006, TC-API-007, TC-API-008, TC-API-009, TC-API-010
**说明**: 
- 服务单内容格式：`助教上桌邀请函（工号：XX，艺名：XX）`
- requester_name 为助教艺名
- requester_type 为"助教"
- 状态默认为"待处理"

---

## 五、测试执行清单

| 用例ID | 优先级 | 状态 | 备注 |
|--------|--------|------|------|
| TC-API-001 | P0 | 待执行 | 助教详情-水牌状态 |
| TC-API-002 | P1 | 待执行 | 水牌状态分类 |
| TC-API-003 | P0 | 待执行 | 前端配置-有效期 |
| TC-API-004 | P0 | 待执行 | 台桌有效性验证 |
| TC-API-005 | P1 | 待执行 | 台桌不存在 |
| TC-API-006 | P0 | 待执行 | 创建服务单-正常 |
| TC-API-007 | P1 | 待执行 | 创建服务单-缺台桌 |
| TC-API-008 | P1 | 待执行 | 创建服务单-缺需求 |
| TC-API-009 | P1 | 待执行 | 创建服务单-未登录 |
| TC-API-010 | P0 | 待执行 | 完整流程 |
| TC-API-011 | P1 | 待执行 | 台桌失效场景 |

---

## 六、注意事项

1. **测试环境严格使用 http://127.0.0.1:8088**
   - 严禁使用 8081（生产端口）或 8083（H5端口）

2. **认证Token获取**
   - 需要先调用 `/api/coach/login` 获取token
   - 或使用测试账号的已知token

3. **前端逻辑无法通过API测试**
   - 按钮禁用状态（前端JS逻辑）
   - Storage过期判断（前端时间戳对比）
   - 对话框样式（UI测试）

4. **数据库直接验证**
   - 每个关键测试用例都应包含数据库验证步骤
   - 使用 sqlite3 查询确认数据正确写入

---

## 七、测试数据清理

测试完成后，清理测试创建的服务单：

```bash
sqlite3 /TG/run/db/tgservice.db "
DELETE FROM service_orders 
WHERE requirement LIKE '%助教上桌邀请函%' 
AND created_at > '2026-04-24';
"
```

---

**测试用例编写完成**
**编写人**: 测试员B
**编写时间**: 2026-04-24
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