你是测试员B。请执行API接口测试。

## 测试地址
- 后端API：http://127.0.0.1:8088
- **严禁使用 8081 和 8083 端口！**

## 测试用例
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

## 七、前端H5浏览器测试用例

> **测试策略**：使用 Puppeteer 连接 Chrome 9222 端口进行前端浏览器自动化测试
> **测试网址**：http://127.0.0.1:8089
> **后端API**：http://127.0.0.1:8088
> **重点场景**：前后端对接验证（API返回数据是否正确渲染到页面）

---

### 🔴 P0 - 核心功能

#### TC-FE-P0-001: 通知图标入口 - 常用功能板块显示通知图标（P0）
**前置条件**：
- Chrome 已启动在 9222 端口
- 已通过 API 发送至少 1 条通知给测试用户

**测试步骤**：
```javascript
const puppeteer = require('puppeteer');
const browser = await puppeteer.connect({
  browserURL: 'http://127.0.0.1:9222',
  defaultViewport: { width: 375, height: 812 }
});

// 1. 打开前端页面
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8089');

// 2. 使用后台用户登录（助教管理账号）
await page.click('.login-card .admin-login-btn'); // 进入员工登录页
await page.type('#username-input', '18680174119');
await page.type('#password-input', '<密码>');
await page.click('.login-submit-btn');
await page.waitForNavigation();

// 3. 导航到会员中心（我的页面）
await page.goto('http://127.0.0.1:8089/#/pages/member/member');
await page.waitForSelector('.internal-group');

// 4. 检查「常用功能」板块
const commonFeaturesGroup = await page.$('.internal-group');
const groupTitle = await commonFeaturesGroup.$eval('.group-title', el => el.textContent);
console.log('板块标题:', groupTitle); // 应为「🔧 常用功能」

// 5. 检查通知按钮是否存在
const notificationBtn = await commonFeaturesGroup.$('.internal-btn:nth-child(1)');
const btnIcon = await notificationBtn.$eval('.internal-btn-icon', el => el.textContent);
const btnText = await notificationBtn.$eval('.internal-btn-text', el => el.textContent);
console.log('按钮图标:', btnIcon, '按钮文字:', btnText); // 应为 🔔 和 「通知」

// 6. 检查角标是否显示
const badge = await notificationBtn.$('.badge');
if (badge) {
  const badgeText = await badge.evaluate(el => el.textContent);
  console.log('角标数字:', badgeText);
}

// 7. 通过 API 验证角标数字是否正确
const unreadCount = await page.evaluate(async () => {
  const res = await fetch('http://127.0.0.1:8088/api/notifications/unread-count', {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
  });
  return await res.json();
});
console.log('API 未阅数量:', unreadCount.data.unread_count);
```

**预期结果**：
- 「常用功能」板块正确显示
- 通知按钮存在，图标为 🔔，文字为「通知」
- 未阅数量 > 0 时，角标显示正确数字
- 未阅数量 = 0 时，角标不显示
- 页面角标数字与 API 返回的 unread_count 一致

---

#### TC-FE-P0-002: 通知列表页 - 页面渲染与排序（P0）
**前置条件**：
- 已登录后台用户（助教管理）
- 已通过 API 发送多条通知（部分已阅，部分未阅）

**测试步骤**：
```javascript
// 1. 从会员中心点击通知按钮
await page.click('.internal-group .internal-btn:first-child'); // 点击通知
await page.waitForSelector('.page');

// 2. 等待通知列表加载
await page.waitForSelector('.notification-list');

// 3. 检查页面标题
const pageTitle = await page.$eval('.header-title', el => el.textContent);
console.log('页面标题:', pageTitle); // 应为「通知列表」

// 4. 获取所有通知项
const notifications = await page.$$('.notification-item');
console.log('通知数量:', notifications.length);

// 5. 检查排序：未阅优先 + 时间倒序
const itemsData = await page.evaluate(() => {
  const items = document.querySelectorAll('.notification-item');
  return Array.from(items).map(item => {
    const isNew = item.querySelector('.new-badge') !== null;
    const title = item.querySelector('.item-title').textContent;
    const time = item.querySelector('.item-time').textContent;
    return { isNew, title, time };
  });
});
console.log('通知列表数据:', itemsData);

// 6. 验证排序：未阅消息（有 NEW 图标）应排在前面
const unreadItems = itemsData.filter(item => item.isNew);
const readItems = itemsData.filter(item => !item.isNew);
console.log('未阅消息数量:', unreadItems.length, '已阅消息数量:', readItems.length);

// 7. 通过 API 验证数据一致性
const apiData = await page.evaluate(async () => {
  const res = await fetch('http://127.0.0.1:8088/api/notifications?page=1&pageSize=20', {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
  });
  return await res.json();
});
console.log('API 通知数量:', apiData.data.notifications.length);
```

**预期结果**：
- 页面正确渲染，标题为「通知列表」
- 通知项按未阅优先排列（有 NEW 图标的排前面）
- 未阅之后按发送时间倒序排列
- 页面显示的通知数量与 API 返回一致
- 每个通知项显示：标题、内容摘要、发送者、时间
- 未阅消息显示 NEW 图标（红色或醒目样式）

---

#### TC-FE-P0-003: 已阅交互 - 点击已阅按钮（P0）
**前置条件**：
- 已登录后台用户
- 当前有未阅通知

**测试步骤**：
```javascript
// 1. 找到第一条未阅通知
const unreadItem = await page.$('.notification-item.unread');
if (!unreadItem) throw new Error('没有未阅通知');

// 2. 检查 NEW 图标存在
const newBadge = await unreadItem.$('.new-badge');
const badgeVisible = await newBadge.evaluate(el => el.offsetParent !== null);
console.log('NEW 图标可见:', badgeVisible); // 应为 true

// 3. 获取通知标题（用于后续验证）
const title = await unreadItem.$eval('.item-title', el => el.textContent);
console.log('通知标题:', title);

// 4. 点击已阅按钮
const readBtn = await unreadItem.$('.read-btn');
await readBtn.click();

// 5. 等待 toast 提示
await page.waitForSelector('.uni-toast', { timeout: 3000 });
const toastText = await page.$eval('.uni-toast', el => el.textContent);
console.log('Toast 提示:', toastText); // 应为「已标记已阅」

// 6. 等待 toast 消失，检查 NEW 图标是否消失
await page.waitForTimeout(2000);
const newBadgeAfter = await unreadItem.$('.new-badge');
const badgeVisibleAfter = newBadgeAfter ? await newBadgeAfter.evaluate(el => el.offsetParent !== null) : false;
console.log('点击后 NEW 图标可见:', badgeVisibleAfter); // 应为 false

// 7. 返回会员中心，检查角标是否更新
await page.goBack();
await page.waitForSelector('.internal-group');
const badge = await page.$('.internal-group .badge');
const badgeNum = badge ? await badge.evaluate(el => el.textContent) : '0';
console.log('角标数字:', badgeNum); // 应减少 1
```

**预期结果**：
- 点击已阅按钮后显示成功 toast
- NEW 图标消失（不再显示）
- 返回会员中心后，角标数字减少 1
- 再次进入通知列表，该通知不再有 NEW 图标
- 已阅通知排序位置变化（排到已阅区域）

---

#### TC-FE-P0-004: 通知管理页 - 管理功能板块显示通知管理按钮（权限控制）（P0）
**前置条件**：
- Chrome 已启动
- 使用不同角色账号登录

**测试步骤**：
```javascript
// 测试用例 A：管理员登录（应看到通知管理按钮）
const adminPage = await browser.newPage();
await adminPage.goto('http://127.0.0.1:8089');
await adminPage.click('.login-card .admin-login-btn');
await adminPage.type('#username-input', 'tgadmin');
await adminPage.type('#password-input', 'mayining633');
await adminPage.click('.login-submit-btn');
await adminPage.waitForNavigation();

await adminPage.goto('http://127.0.0.1:8089/#/pages/member/member');
await adminPage.waitForSelector('.internal-group');

// 检查「管理功能」板块是否存在
const managerGroup = await adminPage.$('.internal-group:last-of-type');
const groupTitle = await managerGroup.$eval('.group-title', el => el.textContent);
console.log('板块标题:', groupTitle); // 应为「⚙️ 管理功能」

// 检查通知管理按钮是否存在
const buttons = await managerGroup.$$('.internal-btn');
let foundNotificationManage = false;
for (const btn of buttons) {
  const text = await btn.$eval('.internal-btn-text', el => el.textContent);
  if (text === '通知管理') foundNotificationManage = true;
}
console.log('通知管理按钮可见:', foundNotificationManage); // 应为 true

// 测试用例 B：收银登录（不应看到通知管理按钮）
const cashierPage = await browser.newPage();
await cashierPage.goto('http://127.0.0.1:8089');
await cashierPage.click('.login-card .admin-login-btn');
await cashierPage.type('#username-input', 'tgcashier');
await cashierPage.type('#password-input', '<密码>');
await cashierPage.click('.login-submit-btn');
await cashierPage.waitForNavigation();

await cashierPage.goto('http://127.0.0.1:8089/#/pages/member/member');
await cashierPage.waitForSelector('.internal-group');

// 检查「管理功能」板块是否不存在（收银无管理权限）
const cashierManagerGroup = await cashierPage.$('.internal-group:last-of-type');
if (cashierManagerGroup) {
  const title = await cashierManagerGroup.$eval('.group-title', el => el.textContent);
  console.log('收银看到的板块:', title); // 不应为「⚙️ 管理功能」
}
```

**预期结果**：
- 管理员/店长/助教管理登录后，「管理功能」板块显示
- 「管理功能」板块中显示「通知管理」按钮
- 收银/服务员登录后，「管理功能」板块不显示（或通知管理按钮不显示）
- 权限控制与后端 API 权限矩阵一致

---

#### TC-FE-P0-005: 通知发送 - 全员发送（P0）
**前置条件**：
- 已登录管理员账号
- 进入通知管理页面

**测试步骤**：
```javascript
// 1. 点击通知管理按钮
await adminPage.click('.internal-btn:nth-child(1)'); // 假设通知管理是第一个按钮
await adminPage.waitForSelector('.page');

// 2. 检查页面标题
const pageTitle = await adminPage.$eval('.header-title', el => el.textContent);
console.log('页面标题:', pageTitle); // 应为「通知管理」

// 3. 确保在「发送通知」标签页
const sendTab = await adminPage.$('.tab-bar .tab:first-child');
await sendTab.click();
await adminPage.waitForSelector('.send-section');

// 4. 填写通知标题
await adminPage.type('.input-field[placeholder="请输入标题"]', '全员测试通知');

// 5. 塚写通知内容
await adminPage.type('.input-area[placeholder="请输入内容"]', '这是一条全员测试通知内容');

// 6. 选择「全员发送」
const allBtn = await adminPage.$('.recipient-type .type-btn:first-child');
await allBtn.click();

// 7. 点击发送按钮
const sendBtn = await adminPage.$('.send-btn:not(.disabled)');
await sendBtn.click();

// 8. 等待成功 toast
await adminPage.waitForSelector('.uni-toast', { timeout: 5000 });
const toastText = await adminPage.$eval('.uni-toast', el => el.textContent);
console.log('Toast 提示:', toastText); // 应为「发送成功」

// 9. 验证切换到「已发送列表」标签
await adminPage.waitForSelector('.list-section');
const activeTab = await adminPage.$('.tab-bar .tab.active');
const tabText = await activeTab.evaluate(el => el.textContent);
console.log('当前标签:', tabText); // 应为「已发送列表」

// 10. 通过 API 验证通知已发送
const apiCheck = await adminPage.evaluate(async () => {
  const res = await fetch('http://127.0.0.1:8088/api/notifications/manage/list?page=1&pageSize=10', {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
  });
  return await res.json();
});
const latestNotification = apiCheck.data.notifications[0];
console.log('最新通知:', latestNotification.title, '接收人数:', latestNotification.total_recipients);
```

**预期结果**：
- 通知管理页面正确渲染
- 填写标题和内容后，发送按钮可点击
- 点击发送后显示「发送成功」toast
- 自动切换到「已发送列表」标签
- 已发送列表显示新创建的通知
- total_recipients 显示正确的全员数量

---

### 🟡 P1 - 重要功能

#### TC-FE-P1-001: 员工选择器 - 搜索与筛选（P1）
**前置条件**：
- 已登录管理员
- 进入通知管理页面
- 选择「指定员工」发送模式

**测试步骤**：
```javascript
// 1. 进入发送通知标签页
await adminPage.click('.tab-bar .tab:first-child');
await adminPage.waitForSelector('.send-section');

// 2. 选择「指定员工」
const selectedBtn = await adminPage.$('.recipient-type .type-btn:last-child');
await selectedBtn.click();
await adminPage.waitForSelector('.employee-selector');

// 3. 填写标题和内容（否则发送按钮禁用）
await adminPage.type('.input-field[placeholder="请输入标题"]', '指定员工测试');
await adminPage.type('.input-area[placeholder="请输入内容"]', '这是指定员工测试内容');

// 4. 检查员工列表加载
await adminPage.waitForSelector('.employee-list');
const employees = await adminPage.$$('.employee-item');
console.log('员工数量:', employees.length); // 应 > 0

// 5. 测试搜索功能
const searchInput = await adminPage.$('.search-input[placeholder="搜索姓名/艺名/工号"]');
await searchInput.type('陆飞');
await adminPage.waitForTimeout(500); // 等待搜索结果

const filteredEmployees = await adminPage.$$('.employee-item');
console.log('搜索后员工数量:', filteredEmployees.length); // 应显示匹配结果

// 6. 检查搜索结果是否正确匹配
for (const emp of filteredEmployees) {
  const name = await emp.$eval('.emp-name', el => el.textContent);
  console.log('员工姓名:', name);
}

// 7. 清空搜索，测试级别筛选
await searchInput.type(''); // 清空
await adminPage.waitForTimeout(500);

const levelFilters = await adminPage.$$('.filter-bar:first-of-type .filter-btn');
await levelFilters[2].click(); // 点击「高级」级别筛选
await adminPage.waitForTimeout(500);

const levelFiltered = await adminPage.$$('.employee-item');
console.log('高级助教数量:', levelFiltered.length);

// 8. 测试角色筛选（后台用户）
const roleFilters = await adminPage.$$('.filter-bar:last-of-type .filter-btn');
await roleFilters[1].click(); // 点击「店长」角色筛选
await adminPage.waitForTimeout(500);

const roleFiltered = await adminPage.$$('.employee-item');
console.log('店长数量:', roleFiltered.length);
```

**预期结果**：
- 员工选择器正确显示员工列表
- 搜索框输入后，列表实时过滤
- 搜索匹配姓名/艺名/工号
- 助教级别筛选正确工作
- 后台角色筛选正确工作
- 篮选后员工数量减少，显示正确结果

---

#### TC-FE-P1-002: 员工选择器 - 复选与已选显示（P1）
**前置条件**：
- 已进入员工选择器
- 有搜索结果

**测试步骤**：
```javascript
// 1. 点击第一个员工复选框
const firstEmployee = await adminPage.$('.employee-item:first-child');
await firstEmployee.click();

// 2. 检查复选框状态
const checkbox = await firstEmployee.$('.checkbox');
const isChecked = await checkbox.evaluate(el => el.classList.contains('checked'));
console.log('复选框已选中:', isChecked); // 应为 true

// 3. 检查已选人数
const selectedCount = await adminPage.$eval('.selected-count', el => el.textContent);
console.log('已选人数:', selectedCount); // 应为「已选择 1 人」

// 4. 点击第二个员工
const secondEmployee = await adminPage.$('.employee-item:nth-child(2)');
await secondEmployee.click();

// 5. 再次检查已选人数
const selectedCount2 = await adminPage.$eval('.selected-count', el => el.textContent);
console.log('已选人数:', selectedCount2); // 应为「已选择 2 人」

// 6. 取消第一个员工选中
await firstEmployee.click();
const checkboxAfter = await firstEmployee.$('.checkbox');
const isCheckedAfter = await checkboxAfter.evaluate(el => el.classList.contains('checked'));
console.log('取消后复选框状态:', isCheckedAfter); // 应为 false

// 7. 检查已选人数减少
const selectedCount3 = await adminPage.$eval('.selected-count', el => el.textContent);
console.log('已选人数:', selectedCount3); // 应为「已选择 1 人」
```

**预期结果**：
- 点击员工项可选中/取消选中
- 复选框状态正确切换（checked class）
- 已选人数实时更新
- 显示格式：「已选择 N 人」

---

#### TC-FE-P1-003: 通知发送 - 指定员工发送（P1）
**前置条件**：
- 已选择指定员工（至少 1 人）
- 已填写标题和内容

**测试步骤**：
```javascript
// 1. 确保已选员工数量
const selectedCount = await adminPage.$eval('.selected-count', el => el.textContent);
console.log('已选人数:', selectedCount);

// 2. 点击发送按钮
const sendBtn = await adminPage.$('.send-btn:not(.disabled)');
await sendBtn.click();

// 3. 等待成功 toast
await adminPage.waitForSelector('.uni-toast', { timeout: 5000 });
const toastText = await adminPage.$eval('.uni-toast', el => el.textContent);
console.log('Toast 提示:', toastText); // 应为「发送成功」

// 4. 验证切换到已发送列表
await adminPage.waitForSelector('.list-section');

// 5. 检查最新发送的通知
const latestItem = await adminPage.$('.sent-item:first-child');
const statsText = await latestItem.$eval('.stat-total', el => el.textContent);
console.log('发送统计:', statsText); // 应为「发送 N 人」，N 与已选人数一致

// 6. 通过 API 验证接收者详情
const notificationId = await latestItem.evaluate(el => el.dataset.id); // 需页面存储 ID
const apiCheck = await adminPage.evaluate(async (id) => {
  const res = await fetch(`http://127.0.0.1:8088/api/notifications/manage/${id}/recipients`, {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
  });
  return await res.json();
}, notificationId);
console.log('接收者数量:', apiCheck.data.recipients.length);
```

**预期结果**：
- 发送成功，显示 toast
- 切换到已发送列表
- 发送人数与已选员工数量一致
- API 返回的接收者列表与选中的员工匹配

---

#### TC-FE-P1-004: 通知列表板块 - 显示总人数/未阅人数（P1）
**前置条件**：
- 已登录管理员
- 已发送通知（部分接收者已阅，部分未阅）

**测试步骤**：
```javascript
// 1. 进入已发送列表标签页
await adminPage.click('.tab-bar .tab:last-child');
await adminPage.waitForSelector('.list-section');

// 2. 获取已发送通知列表
const sentItems = await adminPage.$$('.sent-item');
console.log('已发送通知数量:', sentItems.length);

// 3. 检查每条通知的统计信息
for (const item of sentItems) {
  const title = await item.$eval('.sent-title', el => el.textContent);
  const totalText = await item.$eval('.stat-total', el => el.textContent);
  const unreadText = await item.$eval('.stat-unread', el => el.textContent);
  console.log('通知:', title, '统计:', totalText, unreadText);
}

// 4. 通过 API 验证数据一致性
const apiData = await adminPage.evaluate(async () => {
  const res = await fetch('http://127.0.0.1:8088/api/notifications/manage/list', {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
  });
  return await res.json();
});

// 5. 对比页面和 API 数据
const firstApiItem = apiData.data.notifications[0];
const firstPageItem = await adminPage.$('.sent-item:first-child');
const pageTotal = await firstPageItem.$eval('.stat-total', el => el.textContent);
const pageUnread = await firstPageItem.$eval('.stat-unread', el => el.textContent);
console.log('API: total_recipients:', firstApiItem.total_recipients, 'unread_count:', firstApiItem.unread_count);
console.log('页面:', pageTotal, pageUnread);
```

**预期结果**：
- 已发送列表正确显示
- 每条通知显示「发送 N 人」和「未阅 M 人」
- 页面显示的数字与 API 返回数据一致
- 最多显示 50 条

---

#### TC-FE-P1-005: 通知列表板块 - 点击弹框显示未阅者（P1）
**前置条件**：
- 已发送通知且有未阅者

**测试步骤**：
```javascript
// 1. 找到有未阅者的通知（未阅人数 > 0）
const items = await adminPage.$$('.sent-item');
let targetItem = null;
for (const item of items) {
  const unreadText = await item.$eval('.stat-unread', el => el.textContent);
  const unreadNum = parseInt(unreadText.replace('未阅 ', '').replace(' 人', ''));
  if (unreadNum > 0) {
    targetItem = item;
    break;
  }
}

if (!targetItem) throw new Error('没有未阅者的通知');

// 2. 点击该通知
await targetItem.click();

// 3. 等待弹框显示
await adminPage.waitForSelector('.recipients-modal', { timeout: 3000 });

// 4. 检查弹框标题
const modalTitle = await adminPage.$eval('.recipients-modal .modal-title', el => el.textContent);
console.log('弹框标题:', modalTitle); // 应为「未阅者列表」

// 5. 获取未阅者列表
const recipients = await adminPage.$$('.recipients-list .recipient-item');
console.log('未阅者数量:', recipients.length);

// 6. 检查每个未阅者的信息格式
for (const r of recipients) {
  const name = await r.$eval('.r-name', el => el.textContent);
  const idText = await r.$('.r-id') ? await r.$eval('.r-id', el => el.textContent) : ''; // 后台用户无工号
  const typeText = await r.$eval('.r-type', el => el.textContent);
  console.log('未阅者:', name, idText, typeText);
}

// 7. 关闭弹框
await adminPage.click('.recipients-modal .modal-close');
await adminPage.waitForTimeout(300);
const modalClosed = await adminPage.$('.recipients-modal') === null;
console.log('弹框已关闭:', modalClosed); // 应为 true
```

**预期结果**：
- 点击有未阅者的通知后，弹框显示
- 弹框标题为「未阅者列表」
- 显示所有未阅者的姓名
- 助教显示工号（如「001号」），后台用户不显示工号
- 显示类型标签（助教/后台）
- 点击关闭按钮可关闭弹框

---

### 🟢 P2 - 次要功能

#### TC-FE-P2-001: 权限控制 - 收银查看通知列表（无发送权限）（P2）
**前置条件**：
- 收银账号已登录

**测试步骤**：
```javascript
// 1. 导航到会员中心
await cashierPage.goto('http://127.0.0.1:8089/#/pages/member/member');
await cashierPage.waitForSelector('.internal-group');

// 2. 检查常用功能板块
const commonFeatures = await cashierPage.$('.internal-group');
const groupTitle = await commonFeatures.$eval('.group-title', el => el.textContent);
console.log('板块标题:', groupTitle); // 应为「🔧 常用功能」

// 3. 检查通知按钮是否存在（收银应该能看到通知）
const notificationBtn = await commonFeatures.$('.internal-btn:nth-child(1)');
const btnText = await notificationBtn.$eval('.internal-btn-text', el => el.textContent);
console.log('按钮文字:', btnText); // 应为「通知」

// 4. 点击通知按钮，进入通知列表
await notificationBtn.click();
await cashierPage.waitForSelector('.notification-list');

// 5. 收银应该能查看自己的通知列表
const notifications = await cashierPage.$$('.notification-item');
console.log('收银的通知数量:', notifications.length);

// 6. 收银不应该能看到通知管理按钮（无发送权限）
await cashierPage.goBack();
await cashierPage.waitForSelector('.internal-group');

// 检查管理功能板块（应该不显示或无通知管理按钮）
const managerGroups = await cashierPage.$$('.internal-group');
let foundManage = false;
for (const group of managerGroups) {
  const title = await group.$eval('.group-title', el => el.textContent);
  if (title.includes('管理功能')) foundManage = true;
}
console.log('管理功能板块可见:', foundManage); // 应为 false
```

**预期结果**：
- 收银可以看到「常用功能」板块
- 收银可以看到「通知」按钮并查看通知列表
- 收银不能看到「管理功能」板块
- 收银不能看到「通知管理」按钮

---

#### TC-FE-P2-002: 通知列表 - 空列表状态（P2）
**前置条件**：
- 新用户登录（无通知）

**测试步骤**：
```javascript
// 1. 进入通知列表
await page.goto('http://127.0.0.1:8089/#/pages/internal/notification-list');
await page.waitForSelector('.notification-list');

// 2. 检查空状态提示
const emptyState = await page.$('.empty');
if (emptyState) {
  const emptyText = await emptyState.evaluate(el => el.textContent);
  console.log('空状态提示:', emptyText); // 应为「暂无通知」
}

// 3. 验证通知数量为 0
const notifications = await page.$$('.notification-item');
console.log('通知数量:', notifications.length); // 应为 0
```

**预期结果**：
- 无通知时显示「暂无通知」提示
- 不显示任何通知项

---

#### TC-FE-P2-003: 通知列表 - 下拉加载更多（P2）
**前置条件**：
- 有超过 20 条通知

**测试步骤**：
```javascript
// 1. 进入通知列表
await page.goto('http://127.0.0.1:8089/#/pages/internal/notification-list');
await page.waitForSelector('.notification-list');

// 2. 获取初始通知数量
const initialCount = await page.$$('.notification-item').length;
console.log('初始通知数量:', initialCount);

// 3. 滚动到底部触发加载更多
await page.evaluate(() => {
  const scrollEl = document.querySelector('.notification-list');
  scrollEl.scrollTop = scrollEl.scrollHeight;
});

// 4. 等待加载
await page.waitForTimeout(1000);
await page.waitForSelector('.loading', { hidden: true });

// 5. 检查加载后的数量
const afterCount = await page.$$('.notification-item').length;
console.log('加载后通知数量:', afterCount);

// 6. 验证数量增加
console.log('新增通知:', afterCount - initialCount); // 应 > 0 或无更多数据
```

**预期结果**：
- 滚动到底部触发加载更多
- 如果有更多数据，通知数量增加
- 显示加载提示

---

#### TC-FE-P2-004: 通知详情弹框（P2）
**前置条件**：
- 有通知列表

**测试步骤**：
```javascript
// 1. 点击通知项（不点击已阅按钮）
const firstItem = await page.$('.notification-item:first-child');
await firstItem.click();

// 2. 等待详情弹框
await page.waitForSelector('.detail-modal', { timeout: 3000 });

// 3. 检查弹框内容
const modalTitle = await page.$eval('.detail-modal .modal-title', el => el.textContent);
const modalContent = await page.$eval('.detail-modal .modal-content-text', el => el.textContent);
const modalTime = await page.$eval('.detail-modal .modal-time', el => el.textContent);
console.log('详情弹框:', modalTitle, modalContent, modalTime);

// 4. 如果是未阅通知，检查已阅按钮
const readBtn = await page.$('.detail-modal .modal-btn');
if (readBtn) {
  const btnText = await readBtn.evaluate(el => el.textContent);
  console.log('弹框中已阅按钮:', btnText);
  await readBtn.click(); // 点击已阅
  await page.waitForSelector('.uni-toast', { timeout: 3000 });
}

// 5. 关闭弹框（点击背景）
await page.click('.detail-modal');
await page.waitForTimeout(300);
```

**预期结果**：
- 点击通知项显示详情弹框
- 弹框显示完整标题、内容、时间
- 未阅通知在弹框中显示已阅按钮
- 点击弹框背景可关闭弹框

---

#### TC-FE-P2-005: 发送按钮禁用状态（P2）
**前置条件**：
- 进入通知管理发送页面

**测试步骤**：
```javascript
// 1. 进入发送通知标签页
await adminPage.click('.tab-bar .tab:first-child');
await adminPage.waitForSelector('.send-section');

// 2. 不填写任何内容，检查发送按钮状态
const sendBtn = await adminPage.$('.send-btn.disabled');
const isDisabled = sendBtn !== null;
console.log('发送按钮禁用:', isDisabled); // 应为 true

// 3. 只填写标题，不填写内容
await adminPage.type('.input-field[placeholder="请输入标题"]', '测试标题');
const sendBtn2 = await adminPage.$('.send-btn.disabled');
console.log('只填标题后禁用:', sendBtn2 !== null); // 应为 true

// 4. 填写标题和内容
await adminPage.type('.input-area[placeholder="请输入内容"]', '测试内容');
await adminPage.waitForTimeout(300);
const sendBtn3 = await adminPage.$('.send-btn:not(.disabled)');
console.log('填写完整后可点击:', sendBtn3 !== null); // 应为 true

// 5. 选择指定员工但不选择任何员工
const selectedBtn = await adminPage.$('.recipient-type .type-btn:last-child');
await selectedBtn.click();
await adminPage.waitForTimeout(300);
const sendBtn4 = await adminPage.$('.send-btn.disabled');
console.log('未选员工时禁用:', sendBtn4 !== null); // 应为 true
```

**预期结果**：
- 未填写标题时发送按钮禁用
- 未填写内容时发送按钮禁用
- 选择指定员工但未选择任何员工时发送按钮禁用
- 填写完整且选择接收者后发送按钮可点击

---

#### TC-FE-P2-006: 页面禁止显示 coach_no（编码规范检查）（P2）
**前置条件**：
- 进入员工选择器

**测试步骤**：
```javascript
// 1. 进入员工选择器
await adminPage.waitForSelector('.employee-selector');

// 2. 获取所有员工项的文本
const employeeItems = await adminPage.$$('.employee-item');
for (const item of employeeItems) {
  const fullText = await item.evaluate(el => el.textContent);
  console.log('员工项文本:', fullText);
  // 检查是否包含 coach_no（如 C001, 10001 等内部 ID）
  // 应只显示 employee_id（工号）如 001, 002 等
}

// 3. 检查未阅者弹框
await adminPage.click('.tab-bar .tab:last-child');
await adminPage.waitForSelector('.list-section');
await adminPage.click('.sent-item:first-child');
await adminPage.waitForSelector('.recipients-modal');

const recipientItems = await adminPage.$$('.recipient-item');
for (const r of recipientItems) {
  const fullText = await r.evaluate(el => el.textContent);
  console.log('未阅者项文本:', fullText);
  // 检查是否包含 coach_no
}
```

**预期结果**：
- 员工选择器不显示 coach_no
- 只显示 employee_id（工号）如「001号」「002号」
- 未阅者弹框不显示 coach_no
- 页面遵守编码规范：禁止显示 coach_no

---

## 八、前端测试流程建议

1. **权限验证流程**
   - 管理员登录 → 检查所有功能可见
   - 收银登录 → 检查通知可见但管理不可见
   - 助教登录 → 检查通知可见但管理不可见

2. **通知查阅流程**
   - 检查角标显示
   - 进入通知列表 → 检查排序
   - 点击已阅 → 检查状态变化
   - 返回检查角标更新

3. **通知发送流程**
   - 进入通知管理 → 全员发送
   - 进入通知管理 → 指定员工发送
   - 检查已发送列表
   - 点击查看未阅者

4. **前后端对接验证**
   - 页面数据 vs API 数据一致性
   - 角标数字 vs API unread_count
   - 发送人数 vs API total_recipients
   - 未阅人数 vs API unread_count

5. **编码规范检查**
   - 页面不显示 coach_no
   - 只显示 employee_id

---

## 九、前端验收标准

| 功能 | 验收点 |
|------|--------|
| 通知图标入口 | ✅ 常用功能板块显示通知图标，角标数字正确 |
| 通知列表页 | ✅ 未阅优先排序，NEW 图标正确显示 |
| 已阅交互 | ✅ 点击已阅后 NEW 消失，角标更新 |
| 通知管理入口 | ✅ 管理功能板块显示通知管理按钮（权限控制） |
| 员工选择器 | ✅ 搜索、筛选、复选功能正常 |
| 通知发送 | ✅ 全员/指定发送成功，切换到列表 |
| 已发送列表 | ✅ 显示发送/未阅人数 |
| 未阅者弹框 | ✅ 显示姓名/工号，不显示 coach_no |
| 权限控制 | ✅ 不同角色功能可见性正确 |
| 编码规范 | ✅ 页面不显示 coach_no |

---

_测试用例编写完成（含前端H5浏览器测试），等待程序员A完成代码开发后执行测试。_
```

## 测试策略
- **只用 API/curl 测试，不需要浏览器测试**
- 核心测试：通过 curl 调用后端API，验证接口逻辑
- 测试数据：先用 sqlite3 查数据库找现成数据，没有就直接 INSERT 创建
- 不要反复调 API 找数据，直接操作数据库更快

## curl 测试示例
```bash
# 查询
curl -s http://127.0.0.1:8088/api/xxx?param=value

# 提交
curl -s -X POST http://127.0.0.1:8088/api/xxx \
  -H 'Content-Type: application/json' \
  -d '{"key":"value"}'
```

## 验证要点
- 状态码是否符合预期（200/400/404）
- 响应体中的 success 字段
- 数据库中的数据是否正确写入

## 验收重点
1. 通知发送和查阅功能完整可用 2. 权限控制正确（店长/助教管理/管理员可发通知，所有员工可查阅） 3. 系统异常通知自动发送 4. 员工选择器搜索和筛选功能正常 5. 已阅/未阅状态管理正确

## 输出要求
- 测试结果写入：/TG/temp/QA-20260429-2/test-results.md
- 格式：表格（用例ID、测试项、优先级、预期结果、实际结果、状态）
- 状态：✅通过 / ❌失败 / ⏭️跳过