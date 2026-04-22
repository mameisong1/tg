# 后端错误日志完善 - 技术方案设计

> 程序员A - 2026-04-22

## 一、需求概述

完善后端错误日志，确保除低优先级（故意静默处理）错误外，所有返回错误的 API 都记录日志。

**验收重点**：
1. 所有认证错误（401/403）都有 logger 记录
2. catch 块不再静默处理错误

## 二、当前状态分析

### 2.1 Logger 使用方式

```javascript
// server.js 第195-206行定义了两个 logger
const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logDir, 'access.log') }),
    new winston.transports.Console()
  ]
});

// 操作日志（如登录、登出）
const operationLog = winston.createLogger({...});
```

**日志级别**：
- `logger.info()`: 普通信息（如请求日志）
- `logger.warn()`: 警告（如限流触发）
- `logger.error()`: 错误（如异常、失败）
- `operationLog.info()`: 操作日志（如登录成功）

### 2.2 需要添加日志的位置

根据代码调查，以下位置需要添加日志：

| 位置 | 行号 | 问题 | 优先级 |
|------|------|------|--------|
| authMiddleware | 1936-1970 | 401错误无日志 | P0 |
| requireBackendPermission | middleware/permission.js | 403错误无日志 | P0 |
| 教练登录失败 | 1148, 1153, 1160 | 无日志 | P0 |
| 会员资料更新 catch | 1840 | 无日志 | P1 |
| 会员登出 catch | 1864 | 无日志 | P1 |
| 其他 catch 块 | 多处 | 约46处无日志 | P1-P2 |

### 2.3 低优先级（故意静默处理）的错误

以下位置**不需要修改**（已确认是故意静默处理）：

| 行号 | 代码位置 | 原因 |
|------|----------|------|
| 466 | JSON解析失败 | 使用默认值 |
| 492 | JSON解析失败 | 使用默认值 |
| 1450 | 配置表不存在 | 使用默认值 |
| 3797 | 数据库列已存在 | 跳过重复创建 |
| 4321 | 缓存清理失败 | 不影响主流程 |
| 4332 | 缓存清理失败 | 不影响主流程 |
| 1961 | Base64解析失败 | 正常的token解析尝试 |

## 三、技术方案

### 3.1 authMiddleware 认证中间件（P0）

**位置**：`/TG/tgservice/backend/server.js` 第1936-1970行

**当前代码**：
```javascript
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    return next();
  } catch (err) {
    // JWT 解析失败,尝试 base64 解析(助教 token)
    try {
      const decodedStr = Buffer.from(token, 'base64').toString('utf8');
      const [coachNo, timestamp] = decodedStr.split(':');
      if (coachNo && timestamp) {
        req.user = { userType: 'coach', coachNo: coachNo, role: '助教' };
        return next();
      }
    } catch (e) {}
    return res.status(401).json({ error: 'token无效' });
  }
};
```

**修改后**：
```javascript
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    logger.warn(`认证失败: 未提供token - ${req.method} ${req.url} - IP: ${req.ip}`);
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    return next();
  } catch (err) {
    // JWT 解析失败,尝试 base64 解析(助教 token)
    try {
      const decodedStr = Buffer.from(token, 'base64').toString('utf8');
      const [coachNo, timestamp] = decodedStr.split(':');
      if (coachNo && timestamp) {
        req.user = { userType: 'coach', coachNo: coachNo, role: '助教' };
        return next();
      }
      // Base64解析成功但格式不对
      logger.warn(`认证失败: token格式无效 - ${req.method} ${req.url} - IP: ${req.ip}`);
    } catch (e) {
      logger.warn(`认证失败: token无效 - ${req.method} ${req.url} - IP: ${req.ip} - JWT错误: ${err.message}`);
    }
    return res.status(401).json({ error: 'token无效' });
  }
};
```

**说明**：
- 使用 `logger.warn()` 而非 `logger.error()`，因为认证失败是正常业务场景
- 记录请求方法、URL、IP地址，便于追踪
- 区分"无token"、"token格式无效"、"token解析失败"三种情况

### 3.2 权限中间件 requireBackendPermission（P0）

**位置**：`/TG/tgservice/backend/middleware/permission.js`

**当前代码**（关键部分）：
```javascript
function requireBackendPermission(requiredPermissions, options = {}) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !user.role) {
      return res.status(403).json({ error: '未授权' });
    }
    
    // 助教用户：检查是否有权限访问
    if (user.userType === 'coach') {
      const hasCoachPermission = requiredPermissions.some(perm => 
        COACH_ALLOWED_PERMISSIONS.includes(perm)
      );
      
      if (!hasCoachPermission) {
        return res.status(403).json({ error: '权限不足' });
      }
      // ...
    }
    
    // 服务员禁止访问后台
    if (user.role === '服务员') {
      return res.status(403).json({ error: '服务员禁止访问后台管理系统' });
    }
    
    // ...
    if (!hasPermission) {
      return res.status(403).json({ error: '权限不足' });
    }
    // ...
  };
}
```

**问题**：permission.js 中没有引用 logger，需要添加。

**修改后**：
```javascript
/**
 * 权限校验中间件
 * 天宫国际 V2.0
 */

// 添加 logger 引用
const logger = require('../utils/logger') || {
  warn: (msg) => console.log(`[WARN] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`)
};

// ... 角色权限矩阵不变 ...

function requireBackendPermission(requiredPermissions, options = {}) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !user.role) {
      logger.warn(`权限拒绝: 用户信息缺失 - ${req.method} ${req.url} - IP: ${req.ip}`);
      return res.status(403).json({ error: '未授权' });
    }
    
    // 助教用户：检查是否有权限访问
    if (user.userType === 'coach') {
      const hasCoachPermission = requiredPermissions.some(perm => 
        COACH_ALLOWED_PERMISSIONS.includes(perm)
      );
      
      if (!hasCoachPermission) {
        logger.warn(`权限拒绝: 助教无权限 - ${user.coachNo} 访问 ${requiredPermissions.join(',')} - ${req.method} ${req.url}`);
        return res.status(403).json({ error: '权限不足' });
      }
      // ...
    }
    
    // 服务员禁止访问后台
    if (user.role === '服务员') {
      logger.warn(`权限拒绝: 服务员尝试访问后台 - ${req.method} ${req.url} - IP: ${req.ip}`);
      return res.status(403).json({ error: '服务员禁止访问后台管理系统' });
    }
    
    // ...
    if (!hasPermission) {
      logger.warn(`权限拒绝: ${user.role} 无权限 - ${req.method} ${req.url} - 需要: ${requiredPermissions.join(',')}`);
      return res.status(403).json({ error: '权限不足' });
    }
    // ...
  };
}

// requireFrontendFeature 同样添加日志
function requireFrontendFeature(requiredFeature) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !user.role) {
      logger.warn(`前台权限拒绝: 用户信息缺失 - ${req.method} ${req.url}`);
      return res.status(403).json({ error: '未授权' });
    }
    
    const permissions = getUserPermissions(user.role);
    const frontendPerms = permissions.frontend;
    
    if (frontendPerms[requiredFeature] !== true) {
      logger.warn(`前台权限拒绝: ${user.role} 无功能权限 - ${requiredFeature} - ${req.method} ${req.url}`);
      return res.status(403).json({ error: '权限不足' });
    }
    
    next();
  };
}
```

**说明**：
- 创建独立的 `utils/logger.js` 模块，避免循环引用
- 或直接在 permission.js 中创建简单的 console fallback
- 所有 403 错误都记录：用户角色、请求方法、URL、需要的权限

### 3.3 教练登录失败（P0）

**位置**：`/TG/tgservice/backend/server.js` 第1148, 1153, 1160行

**当前代码**：
```javascript
if (!coach) {
  return res.status(401).json({ error: '助教信息不匹配' });
}

// 离职助教禁止登录
if (coach.status === '离职') {
  return res.status(403).json({ error: '该账号已离职' });
}

// 更新身份证后6位(首次登录时设置)
if (!coach.id_card_last6) {
  await enqueueRun('UPDATE coaches SET id_card_last6 = ? WHERE coach_no = ?', [idCardLast6, coach.coach_no]);
} else if (coach.id_card_last6 !== idCardLast6) {
  return res.status(401).json({ error: '身份证后6位不正确' });
}
```

**修改后**：
```javascript
if (!coach) {
  logger.warn(`助教登录失败: 信息不匹配 - 工号=${employeeId}, 艺名=${stageName}`);
  return res.status(401).json({ error: '助教信息不匹配' });
}

// 离职助教禁止登录
if (coach.status === '离职') {
  logger.warn(`助教登录失败: 账号已离职 - 工号=${employeeId}, 艺名=${stageName}`);
  return res.status(403).json({ error: '该账号已离职' });
}

// 更新身份证后6位(首次登录时设置)
if (!coach.id_card_last6) {
  await enqueueRun('UPDATE coaches SET id_card_last6 = ? WHERE coach_no = ?', [idCardLast6, coach.coach_no]);
} else if (coach.id_card_last6 !== idCardLast6) {
  logger.warn(`助教登录失败: 身份证不匹配 - 工号=${employeeId}`);
  return res.status(401).json({ error: '身份证后6位不正确' });
}
```

### 3.4 会员相关 catch 块（P1）

**位置**：`/TG/tgservice/backend/server.js` 第1836, 1861, 1884行

**当前代码**：
```javascript
// 会员资料更新 - 第1836-1840行
} catch (err) {
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'token无效' });
  }
  res.status(500).json({ error: '服务器错误' });
}

// 会员登出 - 第1861-1864行
} catch (err) {
  res.status(500).json({ error: '服务器错误' });
}
```

**修改后**：
```javascript
// 会员资料更新
} catch (err) {
  if (err.name === 'JsonWebTokenError') {
    logger.warn(`会员资料更新失败: token无效 - ${err.message}`);
    return res.status(401).json({ error: 'token无效' });
  }
  logger.error(`会员资料更新异常: ${err.message}`);
  res.status(500).json({ error: '服务器错误' });
}

// 会员登出
} catch (err) {
  logger.error(`会员登出异常: ${err.message}`);
  res.status(500).json({ error: '服务器错误' });
}
```

### 3.5 其他 catch 块（P2）

对于其他 catch 块，按以下原则处理：

1. **已有日志的**：保持不变
2. **低优先级静默的**：保持不变（见 2.3 节列表）
3. **其他所有 catch 块**：添加 `logger.error()`

**批量修改模板**：
```javascript
// 原代码
} catch (err) {
  res.status(500).json({ error: '服务器错误' });
}

// 修改后
} catch (err) {
  logger.error(`API名称失败: ${err.message}`);
  res.status(500).json({ error: '服务器错误' });
}
```

**建议的修改清单**（P2优先级，共约40处）：

| 行号范围 | API/功能 | 日志消息 |
|----------|----------|----------|
| 517-521 | 获取首页配置 | `获取首页配置失败` |
| 528-532 | 获取分类 | `获取分类失败` |
| 563-567 | 获取分类数量 | `获取分类数量失败` |
| 585-589 | 获取商品 | `获取商品失败` |
| 599-603 | 获取商品详情 | `获取商品详情失败` |
| ... | ... | ... |

（完整清单见附录 A）

## 四、实施计划

### 4.1 Phase 1: 认证与权限（P0）

**修改文件**：
1. `/TG/tgservice/backend/server.js` - authMiddleware
2. `/TG/tgservice/backend/server.js` - 教练登录失败
3. `/TG/tgservice/backend/middleware/permission.js` - 权限中间件

**预计修改行数**：约 20 行

**验证方式**：
- 使用无效 token 访问 API，检查日志是否记录
- 使用无权限账号访问，检查 403 日志

### 4.2 Phase 2: 会员相关（P1）

**修改文件**：
1. `/TG/tgservice/backend/server.js` - 会员资料更新、登出等

**预计修改行数**：约 10 行

**验证方式**：
- 模拟会员操作异常，检查日志

### 4.3 Phase 3: 其他 catch 块（P2）

**修改文件**：
1. `/TG/tgservice/backend/server.js` - 批量添加日志

**预计修改行数**：约 40 行

**验证方式**：
- 代码审查确认所有 catch 块都有日志或明确静默

## 五、注意事项

### 5.1 日志级别使用规范

| 场景 | 级别 | 说明 |
|------|------|------|
| 认证失败（正常业务） | `logger.warn()` | 用户输错密码、token过期等 |
| 权限不足（正常业务） | `logger.warn()` | 用户尝试访问无权限资源 |
| 系统异常 | `logger.error()` | 数据库错误、网络错误等 |
| 业务操作成功 | `operationLog.info()` | 登录成功、登出成功等 |

### 5.2 日志格式规范

```javascript
// 认证相关
logger.warn(`认证失败: 未提供token - ${req.method} ${req.url} - IP: ${req.ip}`);

// 权限相关
logger.warn(`权限拒绝: ${user.role} 无权限 - ${req.method} ${req.url} - 需要: ${perm}`);

// 异常捕获
logger.error(`API名称失败: ${err.message}`);
```

### 5.3 敏感信息处理

**禁止记录**：
- 密码明文
- 身份证完整号码
- token 完整内容

**允许记录**：
- 工号、艺名
- IP 地址
- 请求路径
- 错误原因

### 5.4 性能考虑

日志操作是同步的，但 Winston 会缓冲写入，性能影响可忽略。

## 六、测试计划

### 6.1 单元测试（手动）

1. **认证中间件测试**：
   - 无 token 访问 → 检查日志有 "未提供token"
   - 无效 token 访问 → 检查日志有 "token无效"
   - 有效 token 访问 → 无错误日志

2. **权限中间件测试**：
   - 服务员访问后台 → 检查日志有 "服务员尝试访问后台"
   - 助教访问无权限功能 → 检查日志有 "助教无权限"

3. **教练登录测试**：
   - 信息不匹配 → 检查日志有 "助教登录失败: 信息不匹配"
   - 离职账号 → 检查日志有 "助教登录失败: 账号已离职"

### 6.2 集成测试

```bash
# 测试脚本
cd /TG/tgservice/backend

# 1. 测试无效token
curl -H "Authorization: Bearer invalid_token" http://127.0.0.1:8088/api/admin/verify
# 检查日志: tail -5 logs/access.log

# 2. 测试无token
curl http://127.0.0.1:8088/api/admin/verify
# 检查日志: grep "未提供token" logs/access.log

# 3. 测试权限不足
# （需要登录获取token，然后访问无权限的API）
```

## 七、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 日志文件过大 | 磁盘空间不足 | Winston 自动轮转，保留最近7天 |
| 敏感信息泄露 | 安全风险 | 严格按规范过滤敏感信息 |
| 日志影响性能 | 响应变慢 | Winston 异步写入，影响可忽略 |

## 八、附录

### 附录 A: 完整 catch 块修改清单

**需要添加日志的 catch 块**（按行号排序）：

| 行号 | API/功能 | 当前状态 | 修改内容 |
|------|----------|----------|----------|
| 1148 | 教练登录-信息不匹配 | 无日志 | 添加 `logger.warn()` |
| 1153 | 教练登录-已离职 | 无日志 | 添加 `logger.warn()` |
| 1160 | 教练登录-身份证错误 | 无日志 | 添加 `logger.warn()` |
| 1839 | 会员资料更新-401 | 无日志 | 添加 `logger.warn()` |
| 1840 | 会员资料更新-500 | 无日志 | 添加 `logger.error()` |
| 1863 | 会员登出-500 | 无日志 | 添加 `logger.error()` |
| 1943 | authMiddleware-无token | 无日志 | 添加 `logger.warn()` |
| 1958 | authMiddleware-JWT失败 | 无日志 | 添加 `logger.warn()` |
| 1961 | authMiddleware-Base64失败 | 无日志 | 添加 `logger.warn()` |
| ... | ... | ... | ... |

（完整清单约 40 处，由程序员B实施时填充）

### 附录 B: 权限中间件日志位置

**permission.js 需要添加日志的位置**：

1. 第 180 行：`if (!user || !user.role)` - 用户信息缺失
2. 第 189 行：`if (!hasCoachPermission)` - 助教无权限
3. 第 202 行：`if (user.role === '服务员')` - 服务员访问后台
4. 第 222 行：`if (!hasPermission)` - 角色无权限
5. 第 260 行：`if (!user || !user.role)` - 前台用户信息缺失
6. 第 268 行：`if (frontendPerms[requiredFeature] !== true)` - 前台功能无权限

---

**文档版本**: v1.0
**创建时间**: 2026-04-22
**作者**: 程序员A