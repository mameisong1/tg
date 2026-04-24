# 天宫QA - 单身份登录方案 API测试用例

**QA需求**: 单身份登录方案：当多重身份用户登录时，弹框让用户选择一个身份，删除其他token；自动登录时带preferredRole参数；Storage保存preferredRole；用户退出登录清除所有token和偏好。

**测试环境**: http://127.0.0.1:8088

**测试数据**:
- 多重身份用户：安娜（phone=13435743450, coach_no=10073, admin role=教练）
- 单身份用户：测试用户（需创建）

**测试策略**: 仅API/curl测试，不涉及浏览器测试

---

## 测试准备：创建测试数据

### P0 - 准备测试数据

```bash
# 创建单身份用户（仅有会员身份）
sqlite3 /TG/tgservice/backend/db/tgservice.db "INSERT OR IGNORE INTO members (phone, name, gender) VALUES ('13800000001', '测试单身份用户', '男')"

# 验证数据
sqlite3 /TG/tgservice/backend/db/tgservice.db "SELECT * FROM members WHERE phone IN ('13435743450', '13800000001')"
sqlite3 /TG/tgservice/backend/db/tgservice.db "SELECT * FROM coaches WHERE phone='13435743450'"
sqlite3 /TG/tgservice/backend/db/tgservice.db "SELECT * FROM admin_users WHERE username='13435743450'"
```

---

## P0 测试用例（核心功能，必须通过）

### TC-P0-01: 多重身份用户登录返回身份列表

**测试目的**: 验证多重身份用户登录后，API返回所有可用身份供前端选择

**前置条件**: 
- 用户安娜存在（phone=13435743450）
- 安娜同时具有会员、助教、后台角色

**测试步骤**:
```bash
# 1. 模拟微信登录获取openid（需要mock或跳过微信验证）
# 2. 直接调用auto-login API（待实现preferredRole参数）

# 预期结果：
# - 返回 success=true
# - 返回 roles 数组，包含：member, coach, admin
# - 每个角色包含必要的身份信息
```

**预期结果**:
```json
{
  "success": true,
  "registered": true,
  "token": "member_jwt_token",
  "member": {
    "memberNo": 39,
    "phone": "13435743450",
    "name": "安娜",
    "gender": "女"
  },
  "roles": [
    {
      "type": "member",
      "label": "会员",
      "info": { "memberNo": 39, "name": "安娜" }
    },
    {
      "type": "coach", 
      "label": "助教",
      "info": { "coachNo": 10073, "employeeId": "26", "stageName": "安娜" }
    },
    {
      "type": "admin",
      "label": "后台管理（教练）",
      "info": { "username": "13435743450", "role": "教练", "name": "梁安琪" }
    }
  ],
  "needSelectRole": true
}
```

---

### TC-P0-02: 多重身份用户选择身份后获取token

**测试目的**: 验证用户选择身份后，API返回对应身份的token，并删除其他token

**前置条件**: 
- 用户安娜已登录，选择身份

**测试步骤**:
```bash
# 调用选择身份API（需新增）
curl -X POST http://127.0.0.1:8088/api/member/select-role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {member_token}" \
  -d '{
    "preferredRole": "coach"
  }'
```

**预期结果**:
```json
{
  "success": true,
  "selectedRole": "coach",
  "coachToken": "base64_encoded_token",
  "coachInfo": {
    "coachNo": 10073,
    "employeeId": "26",
    "stageName": "安娜"
  }
}
```

**验证点**:
- 返回对应身份的token
- 不返回其他身份的token（adminToken不应返回）

---

### TC-P0-03: 自动登录携带preferredRole参数

**测试目的**: 验证自动登录时带上preferredRole参数，直接返回选中的身份token

**前置条件**: 
- 用户已登录并选择了身份
- Storage中保存了preferredRole

**测试步骤**:
```bash
# 调用auto-login API，带上preferredRole参数
curl -X POST http://127.0.0.1:8088/api/member/auto-login \
  -H "Content-Type: application/json" \
  -d '{
    "code": "mock_wx_code_for_anna",
    "preferredRole": "coach"
  }'
```

**预期结果**:
```json
{
  "success": true,
  "registered": true,
  "token": "member_jwt_token",
  "member": { "memberNo": 39, "name": "安娜" },
  "coachInfo": { "coachNo": 10073, "stageName": "安娜" },
  "coachToken": "base64_encoded_token",
  "adminInfo": null,  // 不返回后台信息
  "adminToken": null,  // 不返回后台token
  "selectedRole": "coach"
}
```

**验证点**:
- 只返回preferredRole对应的身份token
- 其他身份token为null或不返回

---

### TC-P0-04: 单身份用户登录无弹框

**测试目的**: 验证单身份用户登录后，不需要选择身份，直接返回token

**前置条件**: 
- 用户仅有会员身份（phone=13800000001）

**测试步骤**:
```bash
curl -X POST http://127.0.0.1:8088/api/member/auto-login \
  -H "Content-Type: application/json" \
  -d '{
    "code": "mock_wx_code_for_single_role_user"
  }'
```

**预期结果**:
```json
{
  "success": true,
  "registered": true,
  "token": "member_jwt_token",
  "member": {
    "memberNo": 40,
    "phone": "13800000001",
    "name": "测试单身份用户"
  },
  "adminInfo": null,
  "adminToken": null,
  "coachInfo": null,
  "needSelectRole": false  // 不需要选择身份
}
```

**验证点**:
- needSelectRole=false
- 不返回roles数组
- 无需前端弹框

---

### TC-P0-05: 退出登录清除所有token和偏好

**测试目的**: 验证退出登录清除所有token和preferredRole

**测试步骤**:
```bash
curl -X POST http://127.0.0.1:8088/api/member/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}"
```

**预期结果**:
```json
{
  "success": true,
  "message": "退出成功"
}
```

**验证点**:
- 后端清除session/token记录（如果有）
- 前端需要清除：
  - uni.removeStorageSync('token')
  - uni.removeStorageSync('adminToken')
  - uni.removeStorageSync('coachToken')
  - uni.removeStorageSync('coachInfo')
  - uni.removeStorageSync('adminInfo')
  - uni.removeStorageSync('preferredRole')

---

## P1 测试用例（重要功能）

### TC-P1-01: 刷新页面保持选择的身份

**测试目的**: 验证刷新页面后，通过preferredRole保持身份

**前置条件**: 
- 用户已选择身份为"coach"
- Storage中保存了preferredRole="coach"

**测试步骤**:
```bash
# 模拟刷新页面，auto-login带上preferredRole
curl -X POST http://127.0.0.1:8088/api/member/auto-login \
  -H "Content-Type: application/json" \
  -d '{
    "code": "mock_wx_code",
    "preferredRole": "coach"
  }'
```

**预期结果**:
- 返回coach身份的token
- 保持之前的身份选择

---

### TC-P1-02: 安娜选择助教身份提交上桌单

**测试目的**: 验证选择助教身份后，能成功提交上桌单

**前置条件**: 
- 安娜已选择"coach"身份
- 已获取coachToken

**测试步骤**:
```bash
# 查询可提交的上桌单
curl -X GET http://127.0.0.1:8088/api/coach/orders \
  -H "Authorization: Bearer {coach_token}"

# 提交上桌单
curl -X POST http://127.0.0.1:8088/api/coach/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {coach_token}" \
  -d '{
    "tableNo": "A01",
    "items": [...]
  }'
```

**预期结果**:
- 返回成功
- 记录操作日志

---

### TC-P1-03: 安娜选择后台身份审批申请

**测试目的**: 验证选择后台身份后，能成功审批

**前置条件**: 
- 安娜已选择"admin"身份
- 已获取adminToken

**测试步骤**:
```bash
# 获取待审批列表
curl -X GET http://127.0.0.1:8088/api/admin/applications \
  -H "Authorization: Bearer {admin_token}"

# 审批操作
curl -X POST http://127.0.0.1:8088/api/admin/applications/{id}/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {admin_token}" \
  -d '{
    "comment": "同意"
  }'
```

**预期结果**:
- 返回成功
- 记录审批日志

---

### TC-P1-04: 切换身份

**测试目的**: 验证用户可以切换身份

**测试步骤**:
```bash
# 从coach切换到admin
curl -X POST http://127.0.0.1:8088/api/member/select-role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {member_token}" \
  -d '{
    "preferredRole": "admin"
  }'
```

**预期结果**:
- 返回adminToken
- 更新preferredRole

---

### TC-P1-05: 无效preferredRole处理

**测试目的**: 验证传入无效的preferredRole时的错误处理

**测试步骤**:
```bash
curl -X POST http://127.0.0.1:8088/api/member/auto-login \
  -H "Content-Type: application/json" \
  -d '{
    "code": "mock_wx_code",
    "preferredRole": "invalid_role"
  }'
```

**预期结果**:
```json
{
  "success": false,
  "error": "无效的身份类型"
}
```

---

### TC-P1-06: 选择未拥有的身份

**测试目的**: 验证用户选择自己未拥有的身份时的错误处理

**测试步骤**:
```bash
# 单身份用户尝试选择coach身份
curl -X POST http://127.0.0.1:8088/api/member/auto-login \
  -H "Content-Type: application/json" \
  -d '{
    "code": "mock_wx_code_for_single_user",
    "preferredRole": "coach"
  }'
```

**预期结果**:
```json
{
  "success": false,
  "error": "您没有该身份"
}
```

---

## P2 测试用例（边界和异常场景）

### TC-P2-01: 未登录用户调用select-role

**测试目的**: 验证未登录用户无法选择身份

**测试步骤**:
```bash
curl -X POST http://127.0.0.1:8088/api/member/select-role \
  -H "Content-Type: application/json" \
  -d '{
    "preferredRole": "coach"
  }'
```

**预期结果**:
- 返回401错误

---

### TC-P2-02: expired token处理

**测试目的**: 验证token过期后的处理

**测试步骤**:
```bash
curl -X POST http://127.0.0.1:8088/api/member/auto-login \
  -H "Content-Type: application/json" \
  -d '{
    "code": "mock_wx_code",
    "preferredRole": "coach"
  }'
```

**预期结果**:
- 返回新的token

---

### TC-P2-03: 并发登录处理

**测试目的**: 验证同一用户在不同设备登录时的token管理

**测试步骤**:
1. 设备A登录并选择coach身份
2. 设备B登录并选择admin身份
3. 验证两设备的token互不影响

---

### TC-P2-04: Storage清除验证

**测试目的**: 验证退出登录后前端Storage的正确清除

**验证点**（前端测试，仅供参考）:
```javascript
// 退出前检查
console.log('退出前的Storage:', uni.getStorageInfoSync())

// 执行退出
// ...

// 退出后检查
console.log('退出后的Storage:', uni.getStorageInfoSync())

// 验证以下key不应存在
const keysShouldNotExist = [
  'token', 'adminToken', 'coachToken', 
  'coachInfo', 'adminInfo', 'preferredRole'
]
```

---

## 测试执行记录

| 测试用例 | 优先级 | 执行时间 | 结果 | 备注 |
|---------|--------|----------|------|------|
| TC-P0-01 | P0 | - | - | 待开发 |
| TC-P0-02 | P0 | - | - | 待开发 |
| TC-P0-03 | P0 | - | - | 待开发 |
| TC-P0-04 | P0 | - | - | 待开发 |
| TC-P0-05 | P0 | - | - | 待开发 |
| TC-P1-01 | P1 | - | - | 待开发 |
| TC-P1-02 | P1 | - | - | 待开发 |
| TC-P1-03 | P1 | - | - | 待开发 |
| TC-P1-04 | P1 | - | - | 待开发 |
| TC-P1-05 | P1 | - | - | 待开发 |
| TC-P1-06 | P1 | - | - | 待开发 |
| TC-P2-01 | P2 | - | - | 待开发 |
| TC-P2-02 | P2 | - | - | 待开发 |
| TC-P2-03 | P2 | - | - | 待开发 |
| TC-P2-04 | P2 | - | - | 待开发 |

---

## API设计建议

基于QA需求，建议新增/修改以下API：

### 1. 修改 POST /api/member/auto-login

**新增参数**:
```typescript
{
  code: string,          // 微信code
  preferredRole?: string // 可选：优先身份（member/coach/admin）
}
```

**返回格式调整**:
```typescript
{
  success: boolean,
  registered: boolean,
  token: string,
  member: object,
  roles?: array,           // 多重身份时返回
  needSelectRole?: boolean, // 是否需要选择身份
  selectedRole?: string,    // 当前选中的身份
  coachInfo?: object,
  coachToken?: string,
  adminInfo?: object,
  adminToken?: string
}
```

### 2. 新增 POST /api/member/select-role

**请求参数**:
```typescript
{
  preferredRole: string  // 选择的身份（member/coach/admin）
}
```

**返回格式**:
```typescript
{
  success: boolean,
  selectedRole: string,
  // 根据选择返回对应token
  coachToken?: string,
  coachInfo?: object,
  adminToken?: string,
  adminInfo?: object
}
```

### 3. 新增 POST /api/member/logout

**请求参数**: 无（从Authorization header获取token）

**返回格式**:
```typescript
{
  success: boolean,
  message: string
}
```

---

## 测试数据SQL

```sql
-- 查看安娜的多重身份数据
SELECT 'member' as type, member_no as no, phone, name FROM members WHERE phone='13435743450'
UNION ALL
SELECT 'coach' as type, coach_no as no, phone, stage_name as name FROM coaches WHERE phone='13435743450'
UNION ALL
SELECT 'admin' as type, 0 as no, username as phone, name FROM admin_users WHERE username='13435743450';

-- 创建单身份测试用户
INSERT OR IGNORE INTO members (phone, name, gender) VALUES ('13800000001', '测试单身份用户', '男');

-- 查看单身份用户
SELECT * FROM members WHERE phone='13800000001';
```

---

## 注意事项

1. **测试环境**: 仅使用 127.0.0.1:8088，严禁使用生产环境端口
2. **数据准备**: 优先使用现有数据（安娜），必要时用sqlite3直接操作数据库
3. **API测试**: 仅使用curl测试，不涉及浏览器测试
4. **前端实现**: Storage操作需要在前端代码中验证，API测试仅验证token返回

---

**测试用例编写完成，等待后端实现后执行测试**