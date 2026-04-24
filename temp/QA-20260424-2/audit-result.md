# QA-20260424-2 设计稿审计报告

**审计时间**：2026-04-24  
**审计员**：QA审计员  
**设计稿**：单身份登录方案设计

---

## 审计结果：⚠️ 有条件通过

设计稿整体质量良好，编码规范声明正确，但存在以下需要修复的问题：

---

## 一、编码规范检查 ✅

| 规则ID | 检查项 | 状态 | 说明 |
|--------|--------|------|------|
| TIME | 时间处理 | ✅ 通过 | 设计稿声明使用 TimeUtil.nowDB()，代码片段中无时间处理 |
| DB_CONN | 数据库连接 | ✅ 通过 | 使用 `const { db, dbRun, dbAll, dbGet } = require('./db/index')` |
| DB_WRITE | 数据库写入 | ⚠️ 注意 | 设计稿无数据库写入操作，只有查询。如后续需要写入 token 记录，需使用 writeQueue |
| COACH_NO | 页面显示 | ✅ 通过 | 后端返回 `employeeId: coach.employee_id`，前端页面只显示 employee_id |

---

## 二、逻辑正确性 ⚠️

### 问题 1：前端判断逻辑与设计意图不一致

**设计意图**：
> 单身份用户登录 → 无弹框

**代码片段**：
```javascript
if (roles.length === 1 || (roles.includes('member') && roles.length === 2)) {
  saveLoginData(loginData);
  return;
}
```

**问题分析**：
- `roles = ['member', 'coach']` 时，条件 `roles.length === 2 && roles.includes('member')` 为 true
- 这会导致有助教身份的用户不弹框，直接保存
- 但如果用户同时有 `['member', 'coach', 'admin']`，则会弹框

**修复建议**：
```javascript
// 判断是否需要弹框的标准：是否有多种额外身份（除 member 外）
const extraRoles = roles.filter(r => r !== 'member');
if (extraRoles.length <= 1) {
  saveLoginData(loginData);
  return;
}
// 多种额外身份 → 弹框选择
```

### 问题 2：身份切换场景未考虑

**设计稿声明**：
> 身份变更处理：在会员中心新增「切换身份」按钮

**问题**：实施步骤中未包含此功能的具体实现方案。

**建议**：补充「切换身份」按钮的实现方案，或在本次 QA 中标记为"后续优化"。

---

## 三、安全性 ⚠️

### 问题 3：preferredRole 参数缺少白名单验证

**当前状态**：设计稿未定义参数验证

**风险**：
- 攻击者可能传入非法值（如 `preferredRole='superadmin'`）
- 可能导致未预期的行为

**修复建议**：
```javascript
// 后端验证 preferredRole
const VALID_ROLES = ['member', 'coach', 'admin'];
if (preferredRole && !VALID_ROLES.includes(preferredRole)) {
  return res.status(400).json({
    success: false,
    error: 'INVALID_PREFERRED_ROLE',
    message: 'preferredRole 必须是 member、coach 或 admin'
  });
}
```

---

## 四、错误处理 ⚠️

### 问题 4：API 错误码未明确定义

**当前状态**：设计稿只有 try/catch 结构，未定义具体错误码

**建议补充**：

| 错误码 | 说明 | HTTP状态码 |
|--------|------|-----------|
| INVALID_PREFERRED_ROLE | preferredRole 参数非法 | 400 |
| MEMBER_NOT_FOUND | 会员不存在 | 404 |
| COACH_NOT_ACTIVE | 助教已离职 | 403 |
| ADMIN_USER_INACTIVE | 后台用户已禁用 | 403 |
| TOKEN_GENERATION_FAILED | Token 生成失败 | 500 |

---

## 五、前后端一致性 ✅

### 字段名映射

| 后端数据库 | 后端返回（驼峰） | 前端使用 | 状态 |
|-----------|----------------|---------|------|
| coach_no | coachNo | coachInfo.coachNo（内部逻辑） | ✅ 正确 |
| employee_id | employeeId | 页面显示 employee_id | ✅ 正确 |

**检查结果**：
- coach_no 仅用于 `:key` 绑定和 API 参数，不显示在页面上
- 页面显示使用 `employee_id`，符合规范

---

## 六、设计摘要

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `/TG/tgservice-uniapp/src/App.vue` | 修改 | 新增身份选择弹框逻辑 |
| `/TG/tgservice-uniapp/src/pages/member/member.vue` | 修改 | 登录成功后触发身份选择 |
| `/TG/tgservice-uniapp/src/pages/profile/profile.vue` | 修改 | 退出登录清除 preferredRole |
| `/TG/tgservice/backend/server.js` | 修改 | auto-login API 新增 preferredRole 参数 |
| `/TG/tgservice-uniapp/src/utils/api.js` | 修改 | 新增 setPreferredRole 方法 |

### API 变更

**POST /api/member/auto-login**：
- 新增参数：`preferredRole` (string, 可选): 'coach' | 'admin' | 'member'
- 新增返回：`roles` (string[]): 用户拥有的所有身份

### Storage 变更

**新增字段**：
- `preferredRole`: 用户选择的身份偏好

### 数据库变更

无

---

## 七、修复建议优先级

| 优先级 | 问题 | 建议操作 |
|--------|------|---------|
| 🔴 高 | 参数验证缺失 | 实现 preferredRole 白名单验证 |
| 🟡 中 | 前端判断逻辑不一致 | 统一为"多种额外身份才弹框" |
| 🟢 低 | 错误码未定义 | 补充错误码定义文档 |
| 🟢 低 | 身份切换按钮 | 标记为后续优化或补充实现方案 |

---

## 八、审计结论

**审计结果**：⚠️ **有条件通过**

**条件**：
1. 必须修复问题 3（参数验证），否则存在安全风险
2. 建议修复问题 1（前端判断逻辑），确保逻辑一致性

**编码规范**：✅ 符合所有规范要求

**实施建议**：
1. 先修复安全性问题（问题 3）
2. 调整前端判断逻辑（问题 1）
3. 可以开始实施 Phase 1（后端改动）

---

**审计完成**