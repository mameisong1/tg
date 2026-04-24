# QA-20260424-2 修复记录

## 任务：单身份登录方案实现

**程序员**: A（编码）
**完成时间**: 2026-04-24 18:13

---

## 审计问题修复

### 🔴 问题1：preferredRole 参数缺少白名单验证

**修复方案**：
- 后端 `server.js` 添加白名单验证
- 只允许 `member`、`coach`、`admin` 三个值
- 验证失败返回 400 错误

**代码位置**：`/TG/tgservice/backend/server.js` 第 1799-1801 行

```javascript
// 🔴 审计修复：白名单验证 preferredRole
if (preferredRole && !['member', 'coach', 'admin'].includes(preferredRole)) {
  return res.status(400).json({ error: 'preferredRole 参数无效' });
}
```

---

### 🟡 问题2：前端判断逻辑不一致

**修复方案**：
- 改为 `extraRoles.length <= 1` 判断
- 单身份或无额外身份时不弹框
- 多重身份（coach + admin）时弹框选择

**代码位置**：`/TG/tgservice-uniapp/src/pages/member/member.vue`

```javascript
// 🟡 审计修复：使用 extraRoles.length <= 1 判断
const handleRoleSelection = (roles, loginData) => {
  const extraRoles = roles.filter(r => r !== 'member')
  
  if (extraRoles.length <= 1) {
    // 单身份或无额外身份 → 直接保存
    saveLoginData(loginData)
    return
  }
  
  // 多重身份 → 弹框选择
  pendingRoles.value = extraRoles
  tempLoginData.value = loginData
  showRoleSelectModal.value = true
}
```

---

## 改动文件清单

| 文件 | 改动内容 | 状态 |
|------|---------|------|
| `/TG/tgservice/backend/server.js` | auto-login API 新增 preferredRole 参数和 roles 返回 | ✅ 已提交 |
| `/TG/tgservice-uniapp/src/utils/api.js` | 新增 setPreferredRole 方法 | ✅ 已提交 |
| `/TG/tgservice-uniapp/src/pages/member/member.vue` | 身份选择弹框 + 登录成功触发身份选择 | ✅ 已提交 |
| `/TG/tgservice-uniapp/src/pages/profile/profile.vue` | 退出登录清除 preferredRole | ✅ 已提交 |

---

## Git 提交记录

**提交 ID**: `4dcff87`
**提交信息**: `feat: 单身份登录方案 - 前端身份选择弹框`
**提交时间**: 2026-04-24 18:13

---

## 功能实现总结

### 1. 后端 auto-login API 改动

- 新增 `preferredRole` 参数（白名单验证）
- 返回 `roles` 数组（用户所有身份）
- 根据 `preferredRole` 返回对应身份信息：
  - `preferredRole='coach'` → 只返回 coachInfo
  - `preferredRole='admin'` → 只返回 adminInfo + adminToken
  - 无 `preferredRole` → 返回所有身份（前端弹框选择）

### 2. 前端身份选择弹框

- 检查 `roles` 数组判断是否需要弹框
- 弹框提供两个选项：
  - 🎱 助教身份（提交上桌单、服务下单）
  - 🔧 后台身份（审批管理、后台操作）
- 用户选择后调用 `setPreferredRole` 保存偏好

### 3. 退出登录清理

- 清除所有 token（memberToken、coachToken、adminToken）
- 清除所有 info（coachInfo、adminInfo）
- 清除偏好身份（preferredRole）

---

## 编码规范遵守

✅ 时间处理：使用 TimeUtil.nowDB()
✅ 数据库连接：复用 db/index.js 唯一连接
✅ 数据库写入：未涉及
✅ 页面显示：coachInfo 使用 employeeId 字段

---

## 待测试验证

由程序员B 进行测试验证：

1. 安娜登录测试：选择助教身份提交上桌单
2. 安娜登录测试：选择后台身份审批
3. 单身份用户测试：无弹框
4. 刷新页面测试：保持身份
5. 退出登录测试：清除所有