你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
```
# QA-20260424-2 单身份登录方案设计

## 一、需求理解

### 业务场景
当用户具有多重身份（既是助教又是后台用户）时，系统同时保存了多个 token，导致权限混乱。例如：
- 安娜（coach_no=10073）既是助教又是后台用户（角色=教练）
- 她登录后应该选择一个身份：助教身份用于提交上桌单，后台身份用于审批

### 需求要点
1. **多重身份登录时弹出选择框**：让用户选择一个身份，删除其他 token
2. **自动登录带偏好参数**：auto-login API 支持 preferredRole 参数
3. **Storage 保存偏好**：刷新页面后保持选择的身份
4. **退出登录清除所有**：清除所有 token 和偏好

### 验收标准
- 安娜选择助教身份 → 能成功提交上桌单
- 安娜选择后台身份 → 能成功审批
- 单身份用户登录 → 无弹框
- 刷新页面 → 保持选择的身份
- 退出登录 → 清除所有 token 和偏好

---

## 二、当前实现分析

### 当前登录流程（问题所在）

```
用户登录成功 → 后端返回：
  - memberToken（会员认证）
  - adminToken（后台认证，如果有）
  - coachInfo（助教信息，如果有）

前端保存：
  - Storage: memberToken, adminToken, coachToken, coachInfo, adminInfo
  - api.js token优先级: adminToken || coachToken || memberToken
```

**问题**：安娜登录时同时保存了 coachToken 和 adminToken，api.js 会优先使用 adminToken（后台权限），导致她作为助教提交上桌单时可能使用错误的权限。

### 安娜的多重身份数据

| 身份类型 | 关键字段 | 值 |
|---------|---------|---|
| 助教 | coach_no | 10073 |
| 助教 | employee_id | 26 |
| 助教 | stage_name | 安娜 |
| 助教 | phone | 13435743450 |
| 后台用户 | username | 13435743450（手机号） |
| 后台用户 | role | 教练 |
| 后台用户 | name | 梁安琪 |

---

## 三、技术方案设计

### 1. 新增/修改文件

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `/TG/tgservice-uniapp/src/App.vue` | 修改 | 新增身份选择弹框逻辑 |
| `/TG/tgservice-uniapp/src/pages/member/member.vue` | 修改 | 登录成功后触发身份选择 |
| `/TG/tgservice-uniapp/src/pages/profile/profile.vue` | 修改 | 退出登录清除 preferredRole |
| `/TG/tgservice/backend/server.js` | 修改 | auto-login API 新增 preferredRole 参数 |
| `/TG/tgservice-uniapp/src/utils/api.js` | 修改 | 新增 setPreferredRole 方法 |

### 2. API 变更

#### POST /api/member/auto-login（修改）

**新增参数**：
```javascript
{
  code: string,           // 微信 code（必填）
  preferredRole: string   // 用户偏好身份（可选）：'coach' | 'admin' | 'member'
}
```

**返回值变更**：
```javascript
{
  success: true,
  registered: true,
  token: string,          // memberToken（始终返回）
  member: { ... },        // 会员信息
  
  // 根据 preferredRole 返回对应的身份信息
  adminInfo: { ... } | null,   // preferredRole='admin' 时返回
  adminToken: string | null,   // preferredRole='admin' 时返回
  coachInfo: { ... } | null,   // preferredRole='coach' 时返回
  
  // 新增：返回所有身份列表（供前端判断是否需要弹框）
  roles: ['member', 'coach', 'admin']  // 用户拥有的所有身份
}
```

**逻辑**：
- 如果 preferredRole='coach'：只返回 coachInfo，不返回 adminToken
- 如果 preferredRole='admin'：只返回 adminInfo + adminToken，不返回 coachInfo
- 如果 preferredRole 未指定或 'member'：不返回任何额外身份信息
- 无 preferredRole 时返回所有身份（roles 数组），前端据此判断是否弹框

### 3. Storage 结构变更

**新增字段**：
```javascript
preferredRole: 'coach' | 'admin' | 'member'  // 用户选择的身份偏好
```

**现有字段保持**：
```javascript
memberToken      // 会员 token（始终保留）
adminToken       // 后台 token（仅 preferredRole='admin' 时保留）
adminInfo        // 后台信息（仅 preferredRole='admin' 时保留）
coachToken       // 助教 token（仅 preferredRole='coach' 时保留）
coachInfo        // 助教信息（仅 preferredRole='coach' 时保留）
```

### 4. 前后端交互流程

#### 流程 A：多重身份用户首次登录

```
1. 用户登录成功 → 后端返回 roles: ['member', 'coach', 'admin']
2. 前端检测 roles.length > 1 → 弹出身份选择框
   - 选项：助教身份（提交上桌单） | 后台身份（审批管理）
3. 用户选择 → 调用 setPreferredRole(selectedRole)
   - Storage.save('preferredRole', selectedRole)
   - 删除其他身份的 token
4. 根据 preferredRole 重新请求 auto-login 获取对应 token
```

#### 流程 B：单身份用户登录

```
1. 用户登录成功 → 后端返回 roles: ['member'] 或 roles: ['member', 'coach']
2. 前端检测 roles.length <= 1（只有会员身份）或只有一种额外身份
   - 无弹框，直接保存 token
```

#### 流程 C：刷新页面（自动登录）

```
1. App.vue onLaunch → 检查 memberToken
2. 有 token → 检查 preferredRole
3. 有 preferredRole → 调用 auto-login(code, preferredRole)
   - 只获取对应身份的 token
4. 无 preferredRole → 调用 auto-login(code)
   - 后端返回 roles，前端判断是否弹框
```

#### 流程 D：退出登录

```
1. 用户点击退出 → 调用 /api/member/logout
2. 清除所有 Storage：
   - memberToken, adminToken, coachToken
   - coachInfo, adminInfo
   - preferredRole（新增）
3. reLaunch 到会员中心
```

### 5. 身份选择弹框设计

**触发条件**：
```javascript
// 登录成功后判断
const needsRoleSelection = (roles) => {
  // 只有会员身份 → 不弹框
  if (roles.length === 1 && roles[0] === 'member') return false
  
  // 有多种额外身份（coach + admin）→ 弹框
  const extraRoles = roles.filter(r => r !== 'member')
  return extraRoles.length > 1
}
```

**弹框内容**：
```vue
<view class="role-select-modal">
  <text class="title">请选择您的身份</text>
  <view class="role-options">
    <view class="role-option" @click="selectRole('coach')">
      <text class="role-icon">🎱</text>
      <text class="role-name">助教身份</text>
      <text class="role-desc">用于提交上桌单、服务下单</text>
    </view>
    <view class="role-option" @click="selectRole('admin')">
      <text class="role-icon">🔧</text>
      <text class="role-name">后台身份</text>
      <text class="role-desc">用于审批管理、后台操作</text>
    </view>
  </view>
</view>
```

---

## 四、边界情况和异常处理

### 1. 网络错误处理

**场景**：auto-login 失败
**处理**：保留现有 memberToken，不清除，下次重试

### 2. Token 过期处理

**场景**：preferredRole 对应的 token 过期
**处理**：重新调用 auto-login(code, preferredRole) 获取新 token

### 3. 身份变更处理

**场景**：用户想切换身份（从助教切换到后台）
**处理**：在会员中心新增「切换身份」按钮，点击后重新弹框选择

### 4. 多设备登录

**场景**：用户在设备 A 选择助教身份，在设备 B 选择后台身份
**处理**：每个设备独立保存 preferredRole，不影响其他设备

### 5. 小程序 vs H5

**小程序**：通过 wx.login 获取 code，调用 auto-login
**H5**：通过短信登录，登录成功后同样触发身份选择逻辑

---

## 五、数据验证

### 安娜测试数据

| 测试项 | 预期结果 |
|-------|---------|
| 登录后选择助教身份 | Storage: preferredRole='coach', coachToken 存在, adminToken 不存在 |
| 选择助教后提交上桌单 | API 使用 coachToken，成功提交 |
| 登录后选择后台身份 | Storage: preferredRole='admin', adminToken 存在, coachToken 不存在 |
| 选择后台后进入审批页面 | API 使用 adminToken，成功审批 |
| 刷新页面 | 保持 preferredRole，重新获取对应 token |
| 退出登录 | 清除所有 Storage，包括 preferredRole |

---

## 六、编码规范遵守声明

### 时间处理
- ✅ 使用 TimeUtil.nowDB() 获取数据库时间
- ❌ 不使用 datetime('now') 或手动时区偏移

### 数据库连接
- ✅ 使用 `const { db, dbRun, dbAll, dbGet } = require('./db/index')`
- ❌ 不自行实例化 sqlite3.Database

### 数据库写入
- ✅ 使用 `await enqueueRun('UPDATE ...', [...])`
- ✅ 使用 `await runInTransaction(async (tx) => { ... })`

### 页面显示规范
- ✅ 页面显示助教工号：`{{ employee_id }}`
- ❌ 不在页面显示 `coach_no`
- ❌ 不使用回退逻辑 `employee_id || coach_no`

---

## 七、实施步骤

### Phase 1：后端改动
1. 修改 `/api/member/auto-login`：新增 preferredRole 参数和 roles 返回
2. 修改 `/api/member/profile`：支持 preferredRole 参数

### Phase 2：前端改动
1. App.vue：新增身份选择弹框组件和逻辑
2. member.vue：登录成功后触发身份选择
3. profile.vue：退出登录清除 preferredRole
4. api.js：新增 setPreferredRole 方法

### Phase 3：测试验证
1. 安娜登录测试：助教身份提交上桌单
2. 安娜登录测试：后台身份审批
3. 单身份用户测试：无弹框
4. 刷新页面测试：保持身份
5. 退出登录测试：清除所有

---

## 八、附录：关键代码片段预览

### 后端 auto-login API 改动

```javascript
// server.js - /api/member/auto-login 改动
app.post('/api/member/auto-login', async (req, res) => {
  try {
    const { code, preferredRole } = req.body;  // 新增 preferredRole
    
    // ... 换取 openid、查询会员 ...
    
    // 检查所有身份
    const coach = await dbGet('SELECT ... FROM coaches WHERE phone = ?', [member.phone]);
    const adminUser = await dbGet('SELECT ... FROM admin_users WHERE username = ?', [member.phone]);
    
    // 构建 roles 数组
    const roles = ['member'];
    if (coach && coach.status !== '离职') roles.push('coach');
    if (adminUser) roles.push('admin');
    
    // 根据 preferredRole 返回对应信息
    let adminToken = null, adminInfo = null, coachInfo = null;
    
    if (preferredRole === 'admin' && adminUser) {
      adminToken = jwt.sign({ ... }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
      adminInfo = { username: adminUser.username, name: adminUser.name, role: adminUser.role };
    } else if (preferredRole === 'coach' && coach) {
      coachInfo = { coachNo: coach.coach_no, employeeId: coach.employee_id, ... };
    } else if (!preferredRole && roles.length > 1) {
      // 无偏好且有多重身份 → 返回所有（前端弹框）
      if (adminUser) {
        adminToken = jwt.sign({ ... });
        adminInfo = { ... };
      }
      if (coach) {
        coachInfo = { ... };
      }
    }
    
    res.json({
      success: true,
      registered: true,
      token: memberToken,
      member: { ... },
      roles,  // 新增：返回所有身份
      adminInfo,
      adminToken,
      coachInfo
    });
  } catch (err) {
    // ...
  }
});
```

### 前端身份选择逻辑

```javascript
// App.vue - 身份选择弹框
const showRoleSelectModal = ref(false);
const pendingRoles = ref([]);

// 处理登录成功后的身份选择
const handleRoleSelection = (roles, loginData) => {
  // 单身份用户 → 直接保存
  if (roles.length === 1 || (roles.includes('member') && roles.length === 2)) {
    saveLoginData(loginData);
    return;
  }
  
  // 多重身份 → 弹框选择
  pendingRoles.value = roles.filter(r => r !== 'member');
  showRoleSelectModal.value = true;
  
  // 先保存临时数据（用于选择后调用 auto-login）
  tempLoginData.value = loginData;
};

// 用户选择身份
const selectRole = async (role) => {
  showRoleSelectModal.value = false;
  
  // 保存偏好
  uni.setStorageSync('preferredRole', role);
  
  // 删除其他身份的 token
  if (role === 'coach') {
    uni.removeStorageSync('adminToken');
    uni.removeStorageSync('adminInfo');
  } else if (role === 'admin') {
    uni.removeStorageSync('coachToken');
    uni.removeStorageSync('coachInfo');
  }
  
  // 如果已有 token，直接使用
  if (tempLoginData.value.adminToken && role === 'admin') {
    uni.setStorageSync('adminToken', tempLoginData.value.adminToken);
    uni.setStorageSync('adminInfo', tempLoginData.value.adminInfo);
  } else if (tempLoginData.value.coachInfo && role === 'coach') {
    uni.setStorageSync('coachInfo', tempLoginData.value.coachInfo);
    // 生成 coachToken
    const coachToken = btoa(`${tempLoginData.value.coachInfo.coachNo}:${Date.now()}`);
    uni.setStorageSync('coachToken', coachToken);
  }
};
```

---

**设计方案完成，等待程序员B测试验证。**
```

## 审计检查清单
# 代码审计检查清单

## 编码规范检查（自动化）

运行 `check-style.js` 脚本，检查：

| 规则ID | 检查项 | 禁止 | 必须 |
|--------|--------|------|------|
| TIME | 时间处理 | `datetime('now')`、手动时区偏移 | `TimeUtil` |
| DB_CONN | 数据库连接 | `new sqlite3.Database()` | `db/index.js` |
| DB_WRITE | 数据库写入 | 裸开事务 | `writeQueue` |

## 人工审计检查项

### 逻辑正确性

- [ ] API路径、方法、参数与设计方案一致
- [ ] 数据库字段名、类型与设计一致
- [ ] 业务逻辑分支完整（if/else覆盖所有情况）
- [ ] 边界值处理（空值、最大值、最小值）

### 安全性

- [ ] 输入验证（参数类型、长度、范围）
- [ ] SQL注入防护（参数化查询）
- [ ] 权限校验（用户身份验证）

### 错误处理

- [ ] API错误有明确的错误码和消息
- [ ] 数据库操作有try/catch
- [ ] 异常情况有fallback处理

### 代码质量

- [ ] 变量命名清晰
- [ ] 函数单一职责
- [ ] 无死代码（未使用的变量/函数）
- [ ] Git提交信息描述清晰

### 前后端一致性

- [ ] API请求/响应格式前后端匹配
- [ ] 前端字段名与后端返回一致
- [ ] 错误处理前后端对齐


## 输出要求
1. 审计结果：通过/不通过
2. 如不通过，列出具体问题（对应检查清单的哪些项）
3. 如果通过，提取设计摘要（改了什么文件、新增什么API、数据表变更等）

这是第 1/3 次审计。