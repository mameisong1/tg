# 修复日志 - Round 2

## 修复时间
2026-04-24 18:27

## 修复问题

### P0 - `/api/member/login-sms` 接口缺少 `roles` 字段

**问题描述**：
- 当前 login-sms 返回 `{success, token, member, adminInfo, adminToken, coachInfo}`
- 缺少 `roles` 数组和 `needSelectRole` 字段

**修复方案**：
在 login-sms 接口返回中添加：
1. `roles` 数组：包含用户的所有身份（member/coach/admin）
2. `needSelectRole` 字段：当用户有多个身份时为 true

**修复文件**：
- `/TG/tgservice/backend/server.js` (第 1660-1689 行)

**修改内容**：
```javascript
// 构建身份列表
const roles = ['member'];
if (coach) roles.push('coach');
if (adminUser) roles.push('admin');

res.json({
  success: true,
  token: memberToken,
  member: {...},
  roles,
  needSelectRole: roles.length > 1,
  adminInfo: ...,
  adminToken: ...,
  coachInfo: ...
});
```

## Git 提交
- Commit: 67867ff
- Message: "fix: login-sms接口添加roles和needSelectRole字段"

## 测试验证
待测试员B验证

---
修复人: 程序员A
