你是程序员A。请修复以下测试失败项。

## 失败项目（第 1/5 轮修复）
详见测试报告

## 完整测试结果
```
# API 接口测试报告

**测试日期**: 2026-04-24
**测试环境**: http://127.0.0.1:8088
**测试员**: B

---

## 测试数据验证

### 安娜（13435743450）三重身份确认

| 表 | 字段 | 值 |
|---|---|---|
| members | member_no | 39 |
| members | name | 安娜 |
| coaches | coach_no | 10073 |
| coaches | employee_id | 26 |
| coaches | stage_name | 安娜 |
| admin_users | username | 13435743450 |
| admin_users | role | 教练 |
| admin_users | name | 梁安琪 |

✅ **确认安娜拥有三重身份：会员 + 教练 + 管理员**

---

## 测试结果

| 用例ID | 测试项 | 预期结果 | 实际结果 | 状态 |
|--------|--------|----------|----------|------|
| TC-P0-01 | 多重身份用户登录返回身份列表 | roles 数组包含 ['member', 'coach', 'admin'] | **login-sms 接口未返回 roles 字段**；auto-login 无法测试（需微信code） | ⚠️ 需修复 |
| TC-P0-03 | 自动登录携带 preferredRole='coach' | 只返回 coachInfo，不返回 adminToken | **代码审查通过**（第1861-1868行逻辑正确），但无法实际测试 | ✅ 代码正确 |
| TC-P0-04 | 单身份用户登录无弹框 | needSelectRole=false 或 adminInfo/coachInfo=null | adminInfo=null, coachInfo=null，但 **无 needSelectRole 字段** | ⚠️ 需确认 |
| TC-P1-05 | 无效 preferredRole 处理 | 返回 400 错误 | **代码审查通过**（第1799-1801行白名单验证），返回 `{ error: 'preferredRole 参数无效' }` | ✅ 代码正确 |

---

## 详细测试记录

### TC-P0-01: 多重身份用户登录返回身份列表

**测试方式**: 实际 API 调用 + 代码审查

**login-sms 接口测试**:
```bash
curl -X POST http://127.0.0.1:8088/api/member/login-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"13435743450","code":"888888"}'
```

**实际响应**:
```json
{
  "success": true,
  "token": "...",
  "member": {"memberNo":39, "phone":"13435743450", "name":"安娜", "gender":"女"},
  "adminInfo": {"username":"13435743450", "name":"梁安琪", "role":"教练"},
  "adminToken": "...",
  "coachInfo": {"coachNo":10073, "employeeId":"26", "stageName":"安娜", ...}
}
```

**问题**: 
- ❌ **login-sms 接口未返回 `roles` 字段**
- auto-login 接口有返回 `roles`（第1907行），但无法实际测试（需要微信 code）

**代码审查**:
- auto-login 接口（第1848-1851行）构建 roles 数组：
  ```javascript
  const roles = ['member'];
  if (coach && coach.status !== '离职') roles.push('coach');
  if (adminUser) roles.push('admin');
  ```
- 返回格式（第1907行）：`{ ..., roles, adminInfo, adminToken, coachInfo }`

**建议**: login-sms 接口应同步返回 `roles` 字段

---

### TC-P0-03: 自动登录携带 preferredRole 参数

**测试方式**: 代码审查（无法实际测试，需要微信 code）

**代码逻辑**（第1861-1868行）:
```javascript
} else if (preferredRole === 'coach' && coach) {
  // 只返回助教身份
  coachInfo = {
    coachNo: coach.coach_no,
    employeeId: coach.employee_id,
    stageName: coach.stage_name,
    level: coach.level,
    status: coach.status
  };
}
```

**验证**: ✅ 当 preferredRole='coach' 时：
- 只设置 `coachInfo`
- 不设置 `adminToken`
- 不设置 `adminInfo`

**结论**: 代码逻辑正确，但建议添加测试 bypass 或 mock 接口

---

### TC-P0-04: 单身份用户登录无弹框

**测试方式**: 实际 API 调用

**测试数据**: 柳柳（19994636903）- 纯会员

```bash
curl -X POST http://127.0.0.1:8088/api/member/login-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"19994636903","code":"888888"}'
```

**实际响应**:
```json
{
  "success": true,
  "token": "...",
  "member": {"memberNo":14, "phone":"19994636903", "name":"柳柳", "gender":"女"},
  "adminInfo": null,
  "adminToken": null,
  "coachInfo": null
}
```

**问题**: 
- ⚠️ 响应中没有 `needSelectRole` 字段
- 前端需通过 `adminInfo === null && coachInfo === null` 判断是否单身份

**建议**: 
1. 添加 `needSelectRole` 字段，明确告知前端
2. 或在 `roles` 数组中返回 `['member']`，前端判断 `roles.length > 1`

---

### TC-P1-05: 无效 preferredRole 处理

**测试方式**: 代码审查（无法实际测试，需要微信 code）

**代码逻辑**（第1799-1801行）:
```javascript
// 🔴 审计修复：白名单验证 preferredRole
if (preferredRole && !['member', 'coach', 'admin'].includes(preferredRole)) {
  return res.status(400).json({ error: 'preferredRole 参数无效' });
}
```

**验证**: ✅ 白名单验证正确：
- 只允许 'member', 'coach', 'admin'
- 其他值返回 400 错误

---

## 发现的问题

### 1. login-sms 接口缺少 roles 字段（P0）

**严重程度**: 高
**影响**: 前端无法判断用户是否有多重身份，无法弹出身份选择弹框

**建议修复**:
在 `/api/member/login-sms` 接口中添加 `roles` 字段：

```javascript
// 在 res.json 之前添加
const roles = ['member'];
if (coach) roles.push('coach');
if (adminUser) roles.push('admin');

res.json({
  success: true,
  token: memberToken,
  member: {...},
  roles,  // ← 新增
  adminInfo: ...,
  adminToken: ...,
  coachInfo: ...
});
```

### 2. 缺少 needSelectRole 字段（P1）

**严重程度**: 中
**影响**: 前端需要自己判断逻辑，可能产生不一致

**建议**: 
- 添加 `needSelectRole: boolean` 字段
- 当 `roles.length > 1` 时返回 `true`

### 3. auto-login 接口无法测试（P2）

**严重程度**: 低
**影响**: 无法自动化测试微信登录流程

**建议**: 
- 添加测试环境 bypass：当 `TGSERVICE_ENV === 'test'` 时，支持通过 `phone` 参数直接登录
- 或添加 mock 接口

---

## 测试覆盖率

| 接口 | 可测试性 | 覆盖情况 |
|------|----------|----------|
| /api/member/login-sms | ✅ 可测试 | 已测试 |
| /api/member/auto-login | ❌ 需微信code | 仅代码审查 |
| /api/member/login | ❌ 需微信code | 未测试 |

---

## 总结

1. **TC-P0-01**: ⚠️ login-sms 接口缺少 `roles` 字段，需修复
2. **TC-P0-03**: ✅ 代码逻辑正确，但无法实际测试
3. **TC-P0-04**: ⚠️ 功能正常，但缺少 `needSelectRole` 字段
4. **TC-P1-05**: ✅ 白名单验证正确

**建议优先级**:
1. 【高】修复 login-sms 接口，添加 `roles` 字段
2. 【中】添加 `needSelectRole` 字段
3. 【低】添加 auto-login 测试 bypass
```

## 修复要求
1. 按失败项逐一修复
2. 遵守编码规范（TimeUtil、db/index.js、writeQueue）
3. 修复记录写入 /TG/temp/QA-20260424-2/fix-log.md
4. 代码提交到Git