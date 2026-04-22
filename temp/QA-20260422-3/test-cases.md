# 后端错误日志完善测试用例

## QA需求
验证后端错误日志完善：所有认证错误(401/403)都有logger记录，catch块不再静默处理错误。

## 测试环境
- 后端地址：http://127.0.0.1:8088
- 数据库：/TG/tgservice/db/tgservice.db
- 日志文件：/TG/tgservice/logs/combined.log（winston日志）

## 测试数据
```sql
-- 在职助教
coach_no: 10001, employee_id: 1, stage_name: 歪歪, status: 全职, id_card_last6: 201345
coach_no: 10002, employee_id: 2, stage_name: 陆飞, status: 全职

-- 离职助教（注意stage_name前有空格）
coach_no: 10010, employee_id: 11, stage_name: ' 小怡', status: 离职
coach_no: 10033, employee_id: 39, stage_name: 饼饼, status: 离职

-- 后台用户
username: tgadmin, role: 管理员
username: tgcashier, role: cashier (收银)
username: 18680174119, role: 店长

-- 服务员用户（禁止登录后台）
username: 13800000001, role: 服务员
username: 13800000002, role: 服务员
username: 13800000003, role: 服务员
```

---

## 测试用例列表

### TC-01：无token访问后台API（优先级：P0）
**场景**：认证中间件 authMiddleware - 无 token

**curl命令**：
```bash
curl -s -w "\nHTTP_CODE:%{http_code}" http://127.0.0.1:8088/api/admin/stats
```

**预期结果**：
- HTTP状态码：401
- 响应内容：`{"error":"未登录"}`
- **日志验证**：combined.log 中应有记录（认证失败日志）

---

### TC-02：无效token访问后台API（优先级：P0）
**场景**：认证中间件 authMiddleware - 无效 token

**curl命令**：
```bash
curl -s -w "\nHTTP_CODE:%{http_code}" \
  -H "Authorization: Bearer invalid_token_12345" \
  http://127.0.0.1:8088/api/admin/stats
```

**预期结果**：
- HTTP状态码：401
- 响应内容：`{"error":"token无效"}`
- **日志验证**：combined.log 中应有记录

---

### TC-03：后台登录失败 - 用户不存在（优先级：P0）
**场景**：后台登录 /api/admin/login - 用户不存在

**curl命令**：
```bash
curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"nonexistent_user","password":"any_password"}' \
  http://127.0.0.1:8088/api/admin/login
```

**预期结果**：
- HTTP状态码：401
- 响应内容：`{"error":"用户名或密码错误"}`
- **日志验证**：无特定日志（静默处理，但catch块有日志）

---

### TC-04：后台登录失败 - 密码错误（优先级：P0）
**场景**：后台登录 /api/admin/login - 密码错误

**curl命令**：
```bash
curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"wrong_password"}' \
  http://127.0.0.1:8088/api/admin/login
```

**预期结果**：
- HTTP状态码：401
- 响应内容：`{"error":"用户名或密码错误"}`
- **日志验证**：无特定日志（安全考虑，不暴露具体错误）

---

### TC-05：服务员登录后台被拒绝（优先级：P1）
**场景**：后台登录 /api/admin/login - 服务员角色禁止登录

**说明**：数据库已存在服务员用户 13800000001，即使密码错误也能测试401；如果密码正确会返回403。

**curl命令**：
```bash
curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"13800000001","password":"wrong_password"}' \
  http://127.0.0.1:8088/api/admin/login
```

**预期结果**：
- HTTP状态码：401（密码错误）或 403（密码正确时）
- 403响应内容：`{"error":"服务员不允许登录后台管理系统,请使用前台系统"}`
- **日志验证**：combined.log 中应有记录

---

### TC-06：助教登录失败 - 信息不匹配（优先级：P0）
**场景**：助教登录 /api/coach/login - employee_id 和 stage_name 不匹配

**curl命令**：
```bash
curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"1","stageName":"不存在","idCardLast6":"123456"}' \
  http://127.0.0.1:8088/api/coach/login
```

**预期结果**：
- HTTP状态码：401
- 响应内容：`{"error":"助教信息不匹配"}`
- **日志验证**：combined.log 中应有记录

---

### TC-07：助教登录失败 - 离职账号（优先级：P0）
**场景**：助教登录 /api/coach/login - 离职助教禁止登录

**curl命令**（注意stage_name前有空格，curl中需要转义）：
```bash
curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"11","stageName":" 小怡","idCardLast6":"123456"}' \
  http://127.0.0.1:8088/api/coach/login
```

**预期结果**：
- HTTP状态码：403
- 响应内容：`{"error":"该账号已离职"}`
- **日志验证**：combined.log 中应有记录

---

### TC-08：助教登录失败 - 身份证后6位不正确（优先级：P1）
**场景**：助教登录 /api/coach/login - 身份证验证失败

**说明**：歪歪(employee_id=1)已设置身份证后6位为 201345。

**curl命令**（使用错误的身份证后6位）：
```bash
curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"1","stageName":"歪歪","idCardLast6":"000000"}' \
  http://127.0.0.1:8088/api/coach/login
```

**预期结果**：
- HTTP状态码：401
- 响应内容：`{"error":"身份证后6位不正确"}`
- **日志验证**：combined.log 中应有记录

---

### TC-09：权限不足访问后台API（优先级：P1）
**场景**：权限中间件 requireBackendPermission - 收银员访问管理员功能

**准备**：先获取收银员的有效 token（需要知道密码）

**步骤1：获取收银员token**
```bash
curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"tgcashier","password":"[需查询密码]"}' \
  http://127.0.0.1:8088/api/admin/login
```

**步骤2：使用收银员token访问管理员功能（如用户管理）**
```bash
curl -s -w "\nHTTP_CODE:%{http_code}" \
  -H "Authorization: Bearer [收银员token]" \
  http://127.0.0.1:8088/api/admin/users
```

**预期结果**：
- HTTP状态码：403
- 响应内容：`{"error":"权限不足"}`
- **日志验证**：combined.log 中应有记录

---

### TC-10：无token访问会员API（优先级：P1）
**场景**：会员认证 /api/member/profile - 无 token

**curl命令**：
```bash
curl -s -w "\nHTTP_CODE:%{http_code}" http://127.0.0.1:8088/api/member/profile
```

**预期结果**：
- HTTP状态码：401
- 响应内容：`{"error":"未登录"}`
- **日志验证**：combined.log 中应有记录

---

### TC-11：无效token访问会员API（优先级：P1）
**场景**：会员认证 /api/member/profile - 无效 JWT token

**curl命令**：
```bash
curl -s -w "\nHTTP_CODE:%{http_code}" \
  -H "Authorization: Bearer invalid_jwt_token" \
  http://127.0.0.1:8088/api/member/profile
```

**预期结果**：
- HTTP状态码：401
- 响应内容：`{"error":"token无效"}`
- **日志验证**：combined.log 中应有记录

---

### TC-12：catch块异常处理验证（优先级：P2）
**场景**：验证 catch 块不再静默处理错误

**测试方法**：模拟数据库异常或服务内部错误

**curl命令**（触发可能的异常场景）：
```bash
# 异常格式的请求可能导致服务端错误
curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"invalid_json": malformed}' \
  http://127.0.0.1:8088/api/admin/login
```

**预期结果**：
- HTTP状态码：400 或 500
- **日志验证**：combined.log 中应有 error 级别日志，不能静默无日志

---

## 日志验证方法

### 查看最近日志
```bash
tail -50 /TG/tgservice/logs/combined.log
```

### 搜索认证错误日志
```bash
grep -E "认证失败|登录失败|token无效|权限不足|401|403" /TG/tgservice/logs/combined.log | tail -20
```

### 搜索 error 级别日志
```bash
grep "error:" /TG/tgservice/logs/combined.log | tail -20
```

---

## 测试执行顺序

按优先级执行：
1. P0 用例：TC-01, TC-02, TC-03, TC-04, TC-06, TC-07
2. P1 用例：TC-05, TC-08, TC-09, TC-10, TC-11
3. P2 用例：TC-12

---

## 验收标准

1. **所有 401 错误**：必须有 logger 记录（error 或 warn 级别）
2. **所有 403 错误**：必须有 logger 记录（error 或 warn 级别）
3. **catch 块**：不能静默处理，必须有 logger.error() 或其他日志记录
4. **日志内容**：应包含错误类型、请求路径、错误原因等关键信息

---

## 备注

- 测试环境使用 PM2: tgservice-dev
- 测试端口：8088
- 日志实时写入 combined.log
- 如果认证中间件没有日志，需要代码修改添加 logger 记录
- TC-07的stage_name前有空格，curl中JSON需要包含空格