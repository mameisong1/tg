你是程序员A。请按设计稿编码实现。

## 设计稿
```
# QA-20260420-1: 完善API错误日志

## 需求概述

**目标**：所有API拒绝用户操作时，记录完整错误日志到 `operation.log`

**方案A**：在每个路由 catch 块中添加 `operationLogService.logToFile` 调用

**涉及文件**：约 81 处 catch 块，69 处 throw 错误

---

## 技术方案

### 1. 日志记录策略

| 错误类型 | 是否记录 | 说明 |
|---------|---------|------|
| 业务拒绝（throw { status, error }） | ✅ 记录 | 用户操作被拒绝的场景 |
| 系统错误（数据库异常、网络超时） | ✅ 记录 | 便于排查问题 |
| 验证错误（return 400） | ✅ 记录 | 参数校验失败 |

### 2. 日志格式

```javascript
{
  operator_phone: req.user?.username || 'unknown',
  operator_name: req.user?.name || 'unknown',
  operation_type: 'API拒绝',
  target_type: `${req.method} ${req.path}`,
  target_id: null,
  old_value: null,
  new_value: null,
  remark: `状态码:${statusCode} 原因:${errorMessage} 请求体:${JSON.stringify(safeRequestBody)}`
}
```

**日志示例**：
```
[2026-04-20 15:30:00] [API拒绝] 操作人:张三 目标:POST /api/table-action-orders#- - → - 状态码:400 原因:已在台桌 A1 上，不能重复上桌 请求体:{"table_no":"A1","coach_no":"C001","order_type":"上桌单"}
```

### 3. 敏感字段过滤

以下字段在记录请求体时需要脱敏：
- `password`
- `token`
- `secret`
- `key`

```javascript
function sanitizeRequestBody(body) {
  const safe = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  for (const field of sensitiveFields) {
    if (safe[field]) safe[field] = '***';
  }
  return safe;
}
```

---

## 修改文件清单

### 核心修改

| 文件 | catch 块数量 | 说明 |
|------|-------------|------|
| `routes/table-action-orders.js` | 5 | 上下桌单 |
| `routes/coaches.js` | 4 | 助教管理 |
| `routes/applications.js` | 4 | 申请管理 |
| `routes/water-boards.js` | 3 | 水牌管理 |
| `routes/guest-invitations.js` | 5 | 访客邀请 |
| `routes/service-orders.js` | 5 | 服务单 |
| `routes/switch-routes.js` | 15+ | 开关控制 |
| `server.js` | 20+ | 其他 API |
| **合计** | **~81** | - |

### 新增文件

无需新增文件，复用现有 `services/operation-log.js`

---

## 实现方案

### 方案A：在每个 catch 块添加日志（推荐）

**优点**：
- 精确控制每个 API 的日志内容
- 可以针对不同错误类型定制日志
- 不需要修改 Express 错误处理中间件

**缺点**：
- 需要修改约 81 处代码
- 代码重复

**实现示例**：

```javascript
// routes/table-action-orders.js

router.post('/', auth.required, requireBackendPe...
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
2. 修复记录写入 /TG/temp/QA-20260420-1/fix-log.md（如有修复）