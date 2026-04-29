你是QA审计员。请审计以下测试用例。

## 测试用例内容
```
# 通知功能 API 测试用例

> **测试策略**：仅 API/curl 测试，无浏览器测试
> **测试地址**：http://127.0.0.1:8088
> **测试环境**：PM2 tgservice-dev

---

## 一、API 接口设计（待开发）

根据 QA 需求，设计以下 API 接口：

### 1. 通知发送 API
| API | 方法 | 说明 | 权限 |
|-----|------|------|------|
| `/api/notifications` | POST | 发送通知（全员/指定员工） | 店长/助教管理/管理员 |
| `/api/notifications/system` | POST | 系统异常通知（内部调用） | 系统内部 |

### 2. 通知查阅 API
| API | 方法 | 说明 | 权限 |
|-----|------|------|------|
| `/api/notifications/my` | GET | 获取我的通知列表 | 所有员工 |
| `/api/notifications/unread-count` | GET | 获取未阅通知数量 | 所有员工 |
| `/api/notifications/:id/read` | PUT | 标记为已阅 | 所有员工 |

### 3. 通知管理 API
| API | 方法 | 说明 | 权限 |
|-----|------|------|------|
| `/api/notifications/sent` | GET | 获取已发送通知列表 | 店长/助教管理/管理员 |
| `/api/notifications/:id/recipients` | GET | 获取通知接收者详情 | 店长/助教管理/管理员 |

### 4. 员工选择器 API
| API | 方法 | 说明 | 权限 |
|-----|------|------|------|
| `/api/notifications/employees` | GET | 获取可发送通知的员工列表 | 店长/助教管理/管理员 |

---

## 二、数据库表设计（待开发）

### notifications 表
```sql
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  sender_type TEXT NOT NULL,      -- 'admin' | 'system'
  sender_username TEXT,           -- 后台用户 username
  sender_name TEXT,               -- 发送者姓名
  notification_type TEXT DEFAULT 'normal', -- 'normal' | 'system_error'
  error_type TEXT,                -- 台桌同步异常/批处理异常/计时器任务异常
  created_at DATETIME NOT NULL,
  updated_at DATETIME
);
```

### notification_recipients 表
```sql
CREATE TABLE notification_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_id INTEGER NOT NULL,
  recipient_type TEXT NOT NULL,   -- 'coach' | 'admin'
  recipient_id TEXT NOT NULL,     -- coach_no 或 username
  recipient_name TEXT,            -- 姓名/艺名
  recipient_employee_id TEXT,     -- 工号（助教）
  recipient_stage_name TEXT,      -- 艺名（助教）
  is_read INTEGER DEFAULT 0,      -- 0=未阅, 1=已阅
  read_at DATETIME,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (notification_id) REFERENCES notifications(id)
);
```

---

## 三、测试用例

### 🔴 P0 - 核心功能

#### TC-P0-001: 后台用户登录获取 Token
```bash
# 测试管理员登录
curl -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mayining633"}'
```
**预期结果**：
- 返回 `{ success: true, token: "xxx", role: "管理员" }`
- token 为 JWT 格式

---

#### TC-P0-002: 助教管理登录获取 Token
```bash
# 测试助教管理登录
curl -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"18680174119","password":"<正确密码>"}'
```
**预期结果**：
- 返回 `{ success: true, token: "xxx", role: "助教管理" }`

---

#### TC-P0-003: 店长登录获取 Token
```bash
# 测试店长登录
curl -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"15815702628","password":"<正确密码>"}'
```
**预期结果**：
- 返回 `{ success: true, token: "xxx", role: "店长" }`

---

#### TC-P0-004: 发送全员通知（管理员）
```bash
# 先登录获取 TOKEN
ADMIN_TOKEN="<从登录获取的token>"

# 发送全员通知
curl -X POST http://127.0.0.1:8088/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"title":"系统维护通知","content":"系统将于今晚10点进行维护","send_to_all":true}'
```
**预期结果**：
- 返回 `{ success: true, notification_id: xxx, recipient_count: N }`
- recipient_count = 所有在职助教数 + 所有在职后台用户数（不含服务员）

---

#### TC-P0-005: 发送指定员工通知
```bash
# 发送给指定员工（助教+后台用户）
curl -X POST http://127.0.0.1:8088/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"title":"个人通知","content":"这是个人通知","recipients":[{"type":"coach","id":"10002"},{"type":"admin","id":"18680174119"}]}'
```
**预期结果**：
- 返回 `{ success: true, notification_id: xxx, recipient_count: 2 }`
- 只发送给指定的 2 个员工

---

#### TC-P0-006: 获取我的通知列表（未阅优先）
```bash
# 使用助教管理账号登录后查询
curl -X GET "http://127.0.0.1:8088/api/notifications/my?page=1&pageSize=20" \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```
**预期结果**：
- 返回 `{ success: true, data: [...], total: N, unread_count: M }`
- 数据按未阅优先 + 发送时间倒序排列
- 未阅消息有 `is_read: 0`，已阅消息有 `is_read: 1`

---

#### TC-P0-007: 获取未阅通知数量
```bash
curl -X GET http://127.0.0.1:8088/api/notifications/unread-count \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```
**预期结果**：
- 返回 `{ success: true, count: N }`
- count 为当前用户的未阅通知数

---

#### TC-P0-008: 标记通知为已阅
```bash
# 先获取通知列表，找到一条未阅通知的 id
NOTIFICATION_ID="<未阅通知id>"

# 标记为已阅
curl -X PUT "http://127.0.0.1:8088/api/notifications/$NOTIFICATION_ID/read" \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```
**预期结果**：
- 返回 `{ success: true }`
- 再次查询未阅数量减少 1
- 再次标记同一通知应返回 `{ success: true }`（已阅不可改回未阅，但返回成功）

---

#### TC-P0-009: 权限验证 - 服务员不可发送通知
```bash
# 服务员账号登录（如果有）
curl -X POST http://127.0.0.1:8088/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -d '{"title":"测试","content":"测试","send_to_all":true}'
```
**预期结果**：
- 返回 `403 Forbidden`
- 错误信息：权限不足

---

#### TC-P0-010: 权限验证 - 服务员可查阅通知
```bash
# 服务员账号查询通知列表
curl -X GET http://127.0.0.1:8088/api/notifications/my \
  -H "Authorization: Bearer $WAITER_TOKEN"
```
**预期结果**：
- 返回 `{ success: true, data: [...] }`
- 服务员可以查看自己的通知

---

### 🟡 P1 - 重要功能

#### TC-P1-001: 获取已发送通知列表（管理端）
```bash
curl -X GET "http://127.0.0.1:8088/api/notifications/sent?page=1&pageSize=50" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**预期结果**：
- 返回 `{ success: true, data: [...] }`
- 按发送时间倒序，最多 50 条
- 每条记录包含 `recipient_count` 和 `unread_count`

---

#### TC-P1-002: 获取通知接收者详情（未阅者列表）
```bash
# 先发送一条通知，获取 notification_id
curl -X GET "http://127.0.0.1:8088/api/notifications/$NOTIFICATION_ID/recipients" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**预期结果**：
- 返回 `{ success: true, data: [...] }`
- 包含所有接收者的姓名/工号/艺名
- 标注已阅/未阅状态

---

#### TC-P1-003: 获取可发送通知的员工列表
```bash
curl -X GET "http://127.0.0.1:8088/api/notifications/employees" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**预期结果**：
- 返回 `{ success: true, coaches: [...], admins: [...] }`
- coaches：未离职助教（包含 coach_no, employee_id, stage_name, level）
- admins：在职后台用户（包含 username, name, role）

---

#### TC-P1-004: 员工选择器 - 搜索功能
```bash
# 搜索姓名/艺名/工号
curl -X GET "http://127.0.0.1:8088/api/notifications/employees?search=陆飞" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**预期结果**：
- 返回匹配搜索关键词的员工
- 搜索字段：姓名、艺名、工号

---

#### TC-P1-005: 员工选择器 - 助教级别筛选
```bash
curl -X GET "http://127.0.0.1:8088/api/notifications/employees?coach_level=高级" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**预期结果**：
- 只返回指定级别的助教
- 级别选项：女神/高级/中级/初级

---

#### TC-P1-006: 员工选择器 - 后台角色筛选
```bash
curl -X GET "http://127.0.0.1:8088/api/notifications/employees?admin_role=店长" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**预期结果**：
- 只返回指定角色的后台用户
- 角色选项：管理员/店长/助教管理/教练/前厅管理/收银

---

#### TC-P1-007: 系统异常通知 - 台桌同步异常
```bash
# 此 API 应为系统内部调用，测试时可模拟
curl -X POST http://127.0.0.1:8088/api/notifications/system \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"error_type":"台桌同步异常","content":"台桌同步服务异常，请检查"}'
```
**预期结果**：
- 返回 `{ success: true }`
- 所有管理员收到异常通知
- notification_type = 'system_error'

---

#### TC-P1-008: 系统异常通知 - 批处理异常
```bash
curl -X POST http://127.0.0.1:8088/api/notifications/system \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"error_type":"批处理异常","content":"批处理任务执行失败"}'
```
**预期结果**：
- 同 TC-P1-007

---

#### TC-P1-009: 系统异常通知 - 计时器任务异常
```bash
curl -X POST http://127.0.0.1:8088/api/notifications/system \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"error_type":"计时器任务异常","content":"计时器任务执行异常"}'
```
**预期结果**：
- 同 TC-P1-007

---

#### TC-P1-010: 助教登录后查看通知
```bash
# 助教登录（使用工号+艺名+身份证后6位）
curl -X POST http://127.0.0.1:8088/api/coach/login \
  -H "Content-Type: application/json" \
  -d '{"employee_id":"2","stage_name":"陆飞","id_card_last6":"<正确后6位>"}'

# 获取 token 后查询通知
curl -X GET http://127.0.0.1:8088/api/notifications/my \
  -H "Authorization: Bearer $COACH_TOKEN"
```
**预期结果**：
- 助教可以查看自己的通知列表
- 返回格式与后台用户相同

---

### 🟢 P2 - 次要功能

#### TC-P2-001: 未登录访问通知 API
```bash
curl -X GET http://127.0.0.1:8088/api/notifications/my
```
**预期结果**：
- 返回 `401 Unauthorized`
- 错误信息：未授权访问

---

#### TC-P2-002: 分页查询通知列表
```bash
curl -X GET "http://127.0.0.1:8088/api/notifications/my?page=2&pageSize=10" \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```
**预期结果**：
- 返回第二页数据（10条）
- 包含分页信息：total, page, pageSize

---

#### TC-P2-003: 发送通知 - 缺少必填字段
```bash
curl -X POST http://127.0.0.1:8088/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"title":"测试"}'  # 缺少 content
```
**预期结果**：
- 返回 `400 Bad Request`
- 错误信息：缺少必填字段

---

#### TC-P2-004: 发送通知 - 既无 send_to_all 也无 recipients
```bash
curl -X POST http://127.0.0.1:8088/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"title":"测试","content":"测试"}'  # 缺少接收者
```
**预期结果**：
- 返回 `400 Bad Request`
- 错误信息：请指定接收者

---

#### TC-P2-005: 发送通知 - 接收者不存在
```bash
curl -X POST http://127.0.0.1:8088/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"title":"测试","content":"测试","recipients":[{"type":"coach","id":"99999"}]}'
```
**预期结果**：
- 返回 `{ success: true, recipient_count: 0 }` 或
- 返回 `400` 并提示接收者不存在

---

#### TC-P2-006: 发送通知 - 接收者已离职
```bash
# 假设 coach_no 99999 是离职助教
curl -X POST http://127.0.0.1:8088/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"title":"测试","content":"测试","recipients":[{"type":"coach","id":"99999"}]}'
```
**预期结果**：
- 不发送给离职员工
- 返回的 recipient_count 不包含离职员工

---

#### TC-P2-007: 标记已阅 - 通知不存在
```bash
curl -X PUT "http://127.0.0.1:8088/api/notifications/999999/read" \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```
**预期结果**：
- 返回 `404 Not Found`
- 错误信息：通知不存在

---

#### TC-P2-008: 标记已阅 - 通知不属于当前用户
```bash
# 使用用户A的token标记用户B的通知
curl -X PUT "http://127.0.0.1:8088/api/notifications/$NOTIFICATION_ID/read" \
  -H "Authorization: Bearer $OTHER_TOKEN"
```
**预期结果**：
- 返回 `403 Forbidden` 或 `404`
- 不能标记他人的通知

---

#### TC-P2-009: 查看已发送通知 - 非发送者权限
```bash
# 使用收银账号查看已发送通知列表
curl -X GET http://127.0.0.1:8088/api/notifications/sent \
  -H "Authorization: Bearer $CASHIER_TOKEN"
```
**预期结果**：
- 返回 `403 Forbidden`
- 收银无权查看已发送通知列表

---

#### TC-P2-010: 通知列表 - 空列表
```bash
# 新用户查询通知（没有任何通知）
curl -X GET http://127.0.0.1:8088/api/notifications/my \
  -H "Authorization: Bearer $NEW_USER_TOKEN"
```
**预期结果**：
- 返回 `{ success: true, data: [], total: 0, unread_count: 0 }`

---

## 四、测试数据准备

### 登录凭证
| 角色 | 用户名 | 密码/验证码 | 用途 |
|------|--------|-------------|------|
| 管理员 | tgadmin | mayining633 | 发送通知、管理通知 |
| 助教管理 | 18680174119 | 需确认 | 发送通知、查阅通知 |
| 店长 | 15815702628 | 需确认 | 发送通知、查阅通知 |
| 收银 | tgcashier | 需确认 | 查阅通知（无发送权限） |
| 教练 | 13590761730 | 需确认 | 查阅通知 |

### 助教数据
| coach_no | employee_id | stage_name | level | status |
|----------|-------------|------------|-------|--------|
| 10002 | 2 | 陆飞 | 高级 | 全职 |
| 10003 | 3 | 六六 | 女神 | 全职 |
| 10005 | 5 | 芝芝 | 中级 | 全职 |

---

## 五、测试流程建议

1. **登录获取 Token**
   - 先用 tgadmin 登录获取管理员 token
   - 用助教管理账号登录获取 token
   - 用收银账号登录获取 token

2. **发送通知测试**
   - 发送全员通知
   - 发送指定员工通知
   - 验证接收者数量

3. **查阅通知测试**
   - 各角色查询自己的通知列表
   - 验证未阅数量
   - 标记已阅

4. **权限边界测试**
   - 无权限角色发送通知
   - 无权限角色查看管理列表
   - 跨用户操作

5. **异常场景测试**
   - 缺少必填字段
   - 不存在的资源
   - 离职员工处理

---

## 六、验收标准

| 功能 | 验收点 |
|------|--------|
| 通知发送 | ✅ 店长/助教管理/管理员可发送，其他角色禁止 |
| 通知查阅 | ✅ 所有员工可查阅自己的通知 |
| 未阅数量 | ✅ 角标显示正确数量 |
| 已阅标记 | ✅ 可标记已阅，不可改回未阅 |
| 系统异常通知 | ✅ 自动发送给所有管理员 |
| 员工选择器 | ✅ 搜索、筛选功能正常 |
| 接收者详情 | ✅ 可查看未阅者名单 |

---

_测试用例编写完成，等待程序员A完成代码开发后执行测试。_
```

## 审计要点
1. 是否覆盖QA需求的所有功能点
2. 是否包含API接口真实测试操作（curl测试）
3. 测试步骤是否可执行
4. 是否有明确的预期结果
5. 是否区分了正常流程和异常流程

这是第 1/3 次审计。

## 输出要求
1. 审计结果：通过/不通过
2. 如不通过，列出具体问题