# Bug修复记录 2026-04-24

## Bug描述

1. 登录后选择身份，会员中心没有显示对应的角色板块
2. 刷新页面后，两重身份都恢复了
3. auto-login没有传身份偏好参数
4. 多重身份下发时没有弹出选择框

## 根本原因

### 问题1-2：selectRole 和 checkAutoLogin 函数逻辑错误

**selectRole函数**（第1156-1180行）：
- 先调用 `api.setPreferredRole(role)` 删除其他token
- 然后又保存了token（如 `uni.setStorageSync('adminToken', ...)`)
- **顺序错误！刚保存的token又被删除了**

**checkAutoLogin函数**（第1008-1060行）：
- 获取profile后无条件保存所有身份信息（adminInfo、adminToken、coachInfo）
- **没有检查Storage中的preferredRole，刷新页面后两重身份都恢复了**

### 问题3：auto-login没有传身份偏好参数

`/TG/tgservice-uniapp/src/pages/member/member.vue` 第1110行：
```javascript
// 修复前
const data = await api.memberAutoLogin(loginRes.code)

// 修复后
const data = await api.memberAutoLogin(loginRes.code, uni.getStorageSync('preferredRole'))
```

### 问题4：微信登录接口没有返回roles数组

`/TG/tgservice/backend/server.js` 微信登录接口 `/api/member/login` 缺少 `roles` 返回字段，导致前端无法判断是否需要弹出身份选择框。

## 修复内容

### 1. 修复 selectRole 函数（member.vue）

**修改前**：
```javascript
const selectRole = async (role) => {
  showRoleSelectModal.value = false
  
  // 保存偏好身份
  api.setPreferredRole(role)  // ❌ 先删除了其他token
  
  // 然后保存token（但刚保存的又被删除了）
  if (role === 'admin' && tempLoginData.value) {
    uni.setStorageSync('adminToken', tempLoginData.value.adminToken)
    // ...
  }
}
```

**修改后**：
```javascript
const selectRole = async (role) => {
  showRoleSelectModal.value = false
  
  // ⚠️ 修复：先保存选中身份的token，再删除其他身份的token
  // 步骤1：保存选中身份的token
  if (role === 'admin' && tempLoginData.value) {
    if (tempLoginData.value.adminToken) {
      uni.setStorageSync('adminToken', tempLoginData.value.adminToken)
    }
    // ...
  }
  
  // 步骤2：保存偏好身份并删除其他身份的token
  api.setPreferredRole(role)
  
  // 步骤3：更新会员信息触发页面刷新
  if (tempLoginData.value && tempLoginData.value.member) {
    memberInfo.value = { ...tempLoginData.value.member, [role]: true }
  }
}
```

### 2. 修复 checkAutoLogin 函数（member.vue）

**修改前**：
```javascript
// 无条件保存所有身份信息
if (profile.adminInfo) {
  uni.setStorageSync('adminInfo', profile.adminInfo)
}
if (profile.coachInfo) {
  uni.setStorageSync('coachInfo', profile.coachInfo)
}
```

**修改后**：
```javascript
// 根据preferredRole只保存选中的身份
const preferredRole = uni.getStorageSync('preferredRole')

if (!preferredRole || preferredRole === 'admin') {
  if (profile.adminInfo) uni.setStorageSync('adminInfo', profile.adminInfo)
  if (profile.adminToken) uni.setStorageSync('adminToken', profile.adminToken)
}

if (!preferredRole || preferredRole === 'coach') {
  if (profile.coachInfo) {
    uni.setStorageSync('coachInfo', profile.coachInfo)
    coachInfo.value = profile.coachInfo
  }
}

// 如果有偏好身份，删除其他身份
if (preferredRole) {
  api.setPreferredRole(preferredRole)
}
```

### 3. 修复 auto-login 传参（member.vue）

```javascript
// 修复前
const data = await api.memberAutoLogin(loginRes.code)

// 修复后
const data = await api.memberAutoLogin(loginRes.code, uni.getStorageSync('preferredRole'))
```

### 4. 修复微信登录接口（server.js）

在 `/api/member/login` 返回中添加 `roles` 字段：

```javascript
// 构建身份列表
const roles = ['member'];
if (coach) roles.push('coach');
if (adminUser) roles.push('admin');

res.json({
  // ...
  roles,  // 🔴 新增：返回所有身份列表
  needSelectRole: roles.length > 1,
  // ...
});
```

## 修改文件

1. `/TG/tgservice-uniapp/src/pages/member/member.vue`
   - selectRole 函数：修复保存token顺序
   - checkAutoLogin 函数：根据preferredRole保存身份
   - auto-login调用：传递preferredRole参数

2. `/TG/tgservice/backend/server.js`
   - /api/member/login 接口：添加roles返回字段

## 测试验证

- [ ] 登录后选择身份，会员中心显示对应角色板块
- [ ] 刷新页面后，只保留选中的身份
- [ ] auto-login传递身份偏好参数
- [ ] 多重身份登录时弹出选择框

## Git提交

```bash
# 前端
cd /TG/tgservice-uniapp && git add -A && git commit -m "fix: 修复多重身份选择和刷新恢复问题

- selectRole: 先保存token再删除其他身份
- checkAutoLogin: 根据preferredRole保存身份
- auto-login: 传递preferredRole参数"

# 后端
cd /TG/tgservice && git add -A && git commit -m "fix: 微信登录接口添加roles返回字段

- 修复多重身份登录无法弹出选择框的问题"
```