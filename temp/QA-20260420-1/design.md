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

router.post('/', auth.required, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    // ... 业务逻辑
  } catch (error) {
    // 🆕 记录错误日志
    operationLogService.logToFile({
      operator_phone: req.user?.username || 'unknown',
      operator_name: req.user?.name || 'unknown',
      operation_type: 'API拒绝',
      target_type: `${req.method} ${req.path}`,
      target_id: null,
      old_value: null,
      new_value: null,
      remark: `状态码:${error.status || 500} 原因:${error.error || error.message} 请求体:${JSON.stringify(sanitizeRequestBody(req.body))}`
    });

    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
    console.error('提交上下桌单失败:', error);
    res.status(500).json({ success: false, error: '提交上下桌单失败' });
  }
});
```

### 方案B：统一错误处理中间件（备选）

**优点**：
- 集中管理，代码简洁
- 新增 API 自动获得日志能力

**缺点**：
- 需要修改所有路由，使用 `next(error)` 传递错误
- 无法针对每个 API 定制日志内容
- 需要在中间件中解析请求体，可能遗漏信息

**不采用原因**：现有代码使用 `throw` + 直接 `return res.status()`，改为中间件模式改动量大。

---

## 边界情况和异常处理

### 1. req.user 不存在

```javascript
// 未登录请求或登录中间件未通过
operator_phone: req.user?.username || 'anonymous'
operator_name: req.user?.name || 'anonymous'
```

### 2. 请求体过大

```javascript
// 限制请求体日志长度
const MAX_BODY_LENGTH = 1000;
const bodyStr = JSON.stringify(sanitizeRequestBody(req.body));
const safeBody = bodyStr.length > MAX_BODY_LENGTH 
  ? bodyStr.substring(0, MAX_BODY_LENGTH) + '...(truncated)'
  : bodyStr;
```

### 3. 循环引用

```javascript
// 使用 safe-json-stringify 或 try-catch
let bodyStr;
try {
  bodyStr = JSON.stringify(sanitizeRequestBody(req.body));
} catch (e) {
  bodyStr = '[无法序列化请求体]';
}
```

### 4. 日志写入失败

```javascript
// logToFile 内部使用 Winston，失败会自动 console.error
// 不影响主业务流程
operationLogService.logToFile({ ... }); // 无需 await
```

---

## 测试验证计划

### 1. 测试场景

| API | 测试操作 | 预期日志 |
|-----|---------|---------|
| POST /api/table-action-orders | 重复上桌 | `状态码:400 原因:已在台桌 A1 上，不能重复上桌` |
| POST /api/table-action-orders | 离店状态上桌 | `状态码:400 原因:当前状态（下班）不允许提交上桌单` |
| POST /api/coaches/:coach_no/clock-in | 重复打卡 | `状态码:400 原因:已打卡，不能重复打卡` |
| POST /api/service-orders | 缺少必填字段 | `状态码:400 原因:缺少必填字段：台桌号` |
| POST /api/applications | 权限不足 | `状态码:403 原因:无权限` |

### 2. 验证方法

```bash
# 1. 触发拒绝场景
curl -X POST http://127.0.0.1:8088/api/table-action-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"table_no":"A1","coach_no":"C001","order_type":"上桌单","stage_name":"测试"}'

# 2. 查看日志
tail -f /TG/run/logs/operation.log | grep "API拒绝"

# 3. 验证日志格式
# 应包含：操作人、请求路径、状态码、原因、请求体
```

### 3. 验收标准

- [ ] 所有 `throw { status: xxx, error: xxx }` 类型的业务拒绝错误都被记录
- [ ] 日志格式包含：操作人、请求路径、状态码、拒绝原因
- [ ] 敏感字段（password/token）已脱敏
- [ ] 不影响正常业务流程（日志失败不阻塞请求）
- [ ] 测试环境验证通过（PM2 重启后功能正常）

---

## 代码修改示例

### 1. 创建通用日志记录函数

**文件**：`backend/utils/error-logger.js`（新增）

```javascript
/**
 * API 错误日志记录工具
 * 用于记录用户操作被拒绝的场景
 */

const operationLogService = require('../services/operation-log');

// 敏感字段列表
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'key', 'authorization', 'accessToken', 'refreshToken'];

/**
 * 脱敏请求体
 */
function sanitizeRequestBody(body) {
  if (!body || typeof body !== 'object') return body;
  
  const safe = { ...body };
  for (const field of SENSITIVE_FIELDS) {
    if (safe[field]) safe[field] = '***';
  }
  return safe;
}

/**
 * 记录 API 拒绝日志
 * @param {Object} req - Express 请求对象
 * @param {Object} error - 错误对象 { status, error } 或 Error
 */
function logApiRejection(req, error) {
  const user = req.user || {};
  const statusCode = error.status || 500;
  const errorMessage = error.error || error.message || '未知错误';
  
  // 脱敏请求体
  let bodyStr;
  try {
    const safeBody = sanitizeRequestBody(req.body);
    const bodyJson = JSON.stringify(safeBody);
    bodyStr = bodyJson.length > 1000 ? bodyJson.substring(0, 1000) + '...(truncated)' : bodyJson;
  } catch (e) {
    bodyStr = '[无法序列化请求体]';
  }
  
  operationLogService.logToFile({
    operator_phone: user.username || 'anonymous',
    operator_name: user.name || 'anonymous',
    operation_type: 'API拒绝',
    target_type: `${req.method} ${req.path}`,
    target_id: null,
    old_value: null,
    new_value: null,
    remark: `状态码:${statusCode} 原因:${errorMessage} 请求体:${bodyStr}`
  });
}

module.exports = {
  logApiRejection,
  sanitizeRequestBody
};
```

### 2. 修改路由文件（示例）

**文件**：`backend/routes/table-action-orders.js`

```javascript
const errorLogger = require('../utils/error-logger');

router.post('/', auth.required, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    // ... 业务逻辑
  } catch (error) {
    // 🆕 记录 API 拒绝日志
    errorLogger.logApiRejection(req, error);

    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
    console.error('提交上下桌单失败:', error);
    res.status(500).json({ success: false, error: '提交上下桌单失败' });
  }
});
```

### 3. 需要修改的文件列表

| 文件 | 需要添加 import | 需要修改 catch 块 |
|------|----------------|-------------------|
| `routes/table-action-orders.js` | `const errorLogger = require('../utils/error-logger');` | 5 处 |
| `routes/coaches.js` | `const errorLogger = require('../utils/error-logger');` | 4 处 |
| `routes/applications.js` | `const errorLogger = require('../utils/error-logger');` | 4 处 |
| `routes/water-boards.js` | `const errorLogger = require('../utils/error-logger');` | 3 处 |
| `routes/guest-invitations.js` | `const errorLogger = require('../utils/error-logger');` | 5 处 |
| `routes/service-orders.js` | `const errorLogger = require('../utils/error-logger');` | 5 处 |
| `routes/switch-routes.js` | `const errorLogger = require('../utils/error-logger');` | 15+ 处 |
| `server.js` | 已有 operationLogService | 20+ 处 |

---

## 实施步骤

### 阶段 1：创建工具函数（1个文件）
1. 创建 `backend/utils/error-logger.js`

### 阶段 2：修改路由文件（约 81 处）
1. 在每个路由文件顶部添加 import
2. 在每个 catch 块开头添加 `errorLogger.logApiRejection(req, error);`

### 阶段 3：测试验证
1. 重启开发环境：`pm2 restart tgservice-dev`
2. 执行测试场景，验证日志输出
3. 检查日志格式完整性

### 阶段 4：提交代码
1. Git commit: `feat: 完善API错误日志记录`
2. 重启测试环境验证

---

## 时间估算

| 阶段 | 预计时间 |
|------|---------|
| 创建工具函数 | 10 分钟 |
| 修改路由文件（~81 处） | 60 分钟 |
| 测试验证 | 20 分钟 |
| 提交代码 | 10 分钟 |
| **合计** | **100 分钟** |

---

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 日志写入失败影响业务 | 低 | logToFile 使用 Winston 异步写入，失败不影响主流程 |
| 请求体包含敏感信息 | 中 | 脱敏处理 password/token 等字段 |
| 日志量增大 | 低 | 只记录拒绝场景，正常请求不记录 |
| 遗漏部分 catch 块 | 中 | 使用 grep 全量搜索 `} catch` 确保覆盖 |

---

## 附录：现有错误处理模式

### 模式 1：throw + catch（主要模式）

```javascript
try {
  // 验证
  if (!required) {
    throw { status: 400, error: '缺少必填字段' };
  }
  // 业务逻辑
} catch (error) {
  if (error.status) {
    return res.status(error.status).json({ success: false, error: error.error });
  }
  console.error('操作失败:', error);
  res.status(500).json({ success: false, error: '操作失败' });
}
```

### 模式 2：直接 return（部分使用）

```javascript
if (!table_no) {
  return res.status(400).json({ success: false, error: '缺少台桌号' });
}
```

**说明**：模式 2 需要在每个 return 前添加日志记录，工作量更大。建议优先处理模式 1。

---

## 总结

采用方案 A（在每个 catch 块添加日志），创建统一的 `error-logger.js` 工具函数，修改约 81 处 catch 块，确保所有 API 拒绝场景都被完整记录到 `operation.log`。