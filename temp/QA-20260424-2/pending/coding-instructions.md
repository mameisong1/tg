你是程序员A。请按设计稿编码实现。

## 设计稿
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
  adminToken: string | null,   // preferredRole='a...
```

## 编码要求
# 程序员A — 任务指令模板

## 角色

你是程序员A，负责天宫QA项目的设计方案和编码实现。

**禁止**：编写测试用例、运行测试。

## 设计规范

1. 明确列出新增/修改的文件
2. 说明API变更（路径、方法、参数、返回值）
3. 说明数据库变更（新表、字段、索引）
4. 说明前后端交互流程
5. 考虑边界情况和异常处理

## 编码规范（必须遵守）

### 🔴 时间处理

- ✅ 后端：`const TimeUtil = require('./utils/time'); TimeUtil.nowDB()`
- ✅ 前端：`TimeUtil.today()` / `TimeUtil.format(timeStr)`
- ❌ 禁止：`datetime('now')`、手动时区偏移、`new Date().getTime() + 8*60*60*1000`

### 🔴 数据库连接

- ✅ 唯一连接：`const { db, dbRun, dbAll, dbGet } = require('./db/index');`
- ❌ 禁止：`new sqlite3.Database()`、自行实例化

### 🔴 数据库写入

- ✅ `await enqueueRun('INSERT ...', [...])`
- ✅ `await runInTransaction(async (tx) => { ... })`
- ❌ 禁止：`db.run('BEGIN TRANSACTION')`、裸开事务

### 🔴 页面显示规范

- ✅ 页面显示助教工号：`{{ employee_id }}` 或 `${employee_id}`
- ❌ 禁止：在页面显示 `coach_no`（如 `{{ coach_no }}`、`${c.coach_no}`）
- ❌ 禁止：使用回退逻辑 `employee_id || coach_no`（可能暴露系统编号）
- ✅ `coach_no` 仅限内部用途：API 参数、`:key` 绑定、`data-*` 属性、JS 内部逻辑

## 工作目录

所有设计/代码产出写入指定工作目录。

## 输出要求

- 设计方案：写入 `design.md`
- 代码实现：直接修改项目代码，提交Git
- 修复记录：写入工作目录的 `fix-log.md`


## 完成要求
1. 代码提交到Git
2. 修复记录写入 /TG/temp/QA-20260424-2/fix-log.md（如有修复）