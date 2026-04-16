你是QA审计员。请审计以下测试用例。

## 测试用例内容
```
# QA 测试用例：后台Admin左侧菜单栏公共化改造

**需求编号**: QA-20260416-06  
**版本**: v1.0  
**日期**: 2026-04-16  
**测试环境**: http://127.0.0.1:8088  

---

## 改造概述

将15个HTML页面中重复的菜单栏HTML提取为公共模板 `sidebar.html`，通过 `sidebar.js` 动态加载 + 自动高亮 + 角色权限过滤。解决菜单不一致问题。

**当前已知不一致问题**：
- `lejuan-records.html` 使用 "收银管理" / "系统设置" 分组名（其他页面用 "前厅" / "系统"）
- `lejuan-records.html` 缺少 nav-icon 图标
- `members.html` 前厅菜单项无分组（扁平排列）
- 多数页面缺少 "乐捐管理" 菜单项
- logo 路径不一致（`/images/logo.png` vs `/assets/logo.png`）

**改造后预期**：所有页面共享同一 sidebar.html 模板，菜单项一致，active/open 状态正确。

---

## 测试数据准备

### 1. 查看现有管理员用户

```bash
sqlite3 /TG/run/db/tgservice.db "SELECT username, role FROM admin_users;"
```

**预期结果**：至少返回一条管理员角色记录，如 `tgadmin | 管理员`

### 2. 如无测试用户，创建各角色测试账号

```bash
sqlite3 /TG/run/db/tgservice.db <<'SQL'
-- 插入测试用户（密码使用 bcrypt 哈希，实际可用 tgadmin 的密码）
-- 先用现有 tgadmin 登录获取 token，然后测试不同角色
SQL
```

---

## P0 核心功能测试

### TC-P0-01: sidebar.html 模板文件可被正确访问

**目的**: 验证公共侧边栏模板文件存在且可通过 HTTP 访问

**前置条件**: 改造已完成，sidebar.html 已部署

**步骤**:
```bash
# 1. 直接请求 sidebar.html 文件
curl -s -o /dev/null -w "HTTP %{http_code}" http://127.0.0.1:8088/admin/sidebar.html
```

**预期结果**:
- HTTP 状态码 `200`
- 文件内容包含 `class="sidebar"` 和所有菜单分组（前厅、助教管理、系统）
- 不包含 `<body>` 或 `<html>` 标签（纯片段）

**异常流程**:
```bash
# 文件不存在时
curl -s -o /dev/null -w "HTTP %{http_code}" http://127.0.0.1:8088/admin/sidebar-notexist.html
```
**预期**: HTTP 状态码 `404`

---

### TC-P0-02: sidebar.html 内容完整性

**目的**: 验证模板包含所有必需菜单项

**步骤**:
```bash
# 下载并检查内容
curl -s http://127.0.0.1:8088/admin/sidebar.html > /tmp/sidebar-check.html

# 检查必需元素
echo "=== 检查 Logo ==="
grep -c "sidebar-logo" /tmp/sidebar-check.html

echo "=== 检查数据概览 ==="
grep -c "index.html" /tmp/sidebar-check.html

echo "=== 检查前厅分组 ==="
grep -c "nav-group" /tmp/sidebar-check.html

echo "=== 检查收银看板 ==="
grep -c "cashier-dashboard.html" /tmp/sidebar-check.html

echo "=== 检查商品管理 ==="
grep -c "products.html" /tmp/sidebar-check.html

echo "=== 检查包房管理 ==="
grep -c "vip-rooms.html" /tmp/sidebar-check.html

echo "=== 检查台桌管理 ==="
grep -c "tables.html" /tmp/sidebar-check.html

echo "=== 检查商品分类 ==="
grep -c "categories.html" /tmp/sidebar-check.html

echo "=== 检查助教列表 ==="
grep -c "coaches.html" /tmp/sidebar-check.html

echo "=== 检查乐捐管理 ==="
grep -c "lejuan-records.html" /tmp/sidebar-check.html

echo "=== 检查操作日志 ==="
grep -c "operation-logs.html" /tmp/sidebar-check.html

echo "=== 检查首页配置 ==="
grep -c 'href="home.html"' /tmp/sidebar-check.html

echo "=== 检查用户管理 ==="
grep -c "users.html" /tmp/sidebar-check.html

echo "=== 检查系统配置 ==="
grep -c "settings.html" /tmp/sidebar-check.html

echo "=== 检查 toggleGroup 函数 ==="
grep -c "toggleGroup" /tmp/sidebar-check.html
```

**预期结果**: 每项 `grep -c` 输出 >= 1（每个菜单项至少出现一次）

---

### TC-P0-03: sidebar.js 文件可被正确访问

**目的**: 验证动态加载脚本存在且可访问

**步骤**:
```bash
curl -s -o /dev/null -w "HTTP %{http_code}" http://127.0.0.1:8088/admin/js/sidebar.js
```

**预期结果**: HTTP 状态码 `200`

---

### TC-P0-04: 获取管理员 Token（登录测试）

**目的**: 获取测试用的 JWT Token

**步骤**:
```bash
# 登录获取 token
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

echo "Token: ${ADMIN_TOKEN:0:20}..."
```

**预期结果**: 返回非空 token 字符串，响应包含 `"success": true`

**异常流程**:
```bash
# 错误密码
curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"wrong_password"}'
```
**预期**: HTTP 401，返回 `{"error":"用户名或密码错误"}`

---

### TC-P0-05: 各页面正常加载（HTTP 200）

**目的**: 验证所有管理页面改造后仍可正常访问

**步骤**:
```bash
BASE="http://127.0.0.1:8088/admin"
PAGES=(
  "index.html"
  "cashier-dashboard.html"
  "products.html"
  "vip-rooms.html"
  "tables.html"
  "categories.html"
  "coaches.html"
  "lejuan-records.html"
  "operation-logs.html"
  "home.html"
  "users.html"
  "settings.html"
  "members.html"
)

for page in "${PAGES[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/${page}")
  echo "${page}: HTTP ${status}"
done
```

**预期结果**: 所有页面 HTTP 状态码 `200`

---

### TC-P0-06: 页面引用 sidebar.html 和 sidebar.js

**目的**: 验证改造后的页面正确引用公共模板和脚本

**步骤**:
```bash
# 检查每个页面是否引用了 sidebar.html 和 sidebar.js
BASE="http://127.0.0.1:8088/admin"
PAGES=(
  "index.html"
  "cashier-dashboard.html"
  "products.html"
  "settings.html"
)

for page in "${PAGES[@]}"; do
  content=$(curl -s "${BASE}/${page}")
  has_sidebar=$(echo "$content" | grep -c "sidebar.html")
  has_sidebar_js=$(echo "$content" | grep -c "sidebar.js")
  has_old_menu=$(echo "$content" | grep -c '<div class="sidebar-logo"')
  echo "${page}: sidebar.html引用=${has_sidebar}, sidebar.js引用=${has_sidebar_js}, 旧菜单=${has_old_menu}"
done
```

**预期结果**:
- `sidebar.html引用` >= 1（页面通过某种方式引用 sidebar.html，可以是 fetch 也可以是 include）
- `sidebar.js引用` >= 1（页面引用 sidebar.js 脚本）
- `旧菜单` = 0（不应再包含内联的完整侧边栏HTML，即不应有 `<div class="sidebar-logo"` 这样的内联结构）

---

### TC-P0-07: sidebar.js 自动高亮当前页面

**目的**: 验证 sidebar.js 能根据当前 URL 正确设置 active 状态

**原理**: 各页面 HTML 中应包含标识当前页面的机制（如 `data-page` 属性），sidebar.js 加载模板后据此设置 active 类

**步骤**:
```bash
# 以 index.html 为例，检查是否有当前页面标识
curl -s http://127.0.0.1:8088/admin/index.html | grep -o 'data-current-page="[^"]*"'

# 以 settings.html 为例
curl -s http://127.0.0.1:8088/admin/settings.html | grep -o 'data-current-page="[^"]*"'

# 以 lejuan-records.html 为例
curl -s http://127.0.0.1:8088/admin/lejuan-records.html | grep -o 'data-current-page="[^"]*"'
```

**预期结果**: 每个页面返回对应的文件名（如 `index.html`、`settings.html`、`lejuan-records.html`）

---

### TC-P0-08: nav-control.js 权限过滤仍然生效

**目的**: 验证改造后 nav-control.js 的角色权限过滤功能正常

**步骤1**: 登录获取不同角色的 token
```bash
# 获取管理员 token
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

echo "Admin token obtained: ${ADMIN_TOKEN:+YES}"
```

**步骤2**: 查看各角色用户
```bash
# 查看所有用户角色分布
sqlite3 /TG/run/db/tgservice.db "SELECT role, COUNT(*) FROM admin_users GROUP BY role;"

# 注：收银角色在DB中存为 'cashier'，nav-control.js 通过 ROLE_MAP 映射为 '收银'
# 教练角色在DB中存为 '教练'
```

**步骤3**: 验证教练角色禁止访问后台
```bash
# 查找教练角色用户
sqlite3 /TG/run/db/tgservice.db "SELECT username, role FROM admin_users WHERE role='教练' LIMIT 1;"

# 如果有教练用户，尝试登录
COACH_USER=$(sqlite3 /TG/run/db/tgservice.db "SELECT username FROM admin_users WHERE role='教练' LIMIT 1;")
if [ -n "$COACH_USER" ]; then
  # 教练角色应该被禁止登录后台（后端返回403）
  curl -s -X POST http://127.0.0.1:8088/api/admin/login \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${COACH_USER}\",\"password\":\"test123\"}"
fi
```

**预期结果**:
- 管理员: 可以看到所有菜单项
- 前厅管理: 只能看到 cashier-dashboard.html, products.html, vip-rooms.html, tables.html, categories.html
- 收银: 只能看到 cashier-dashboard.html
- 教练: 禁止登录后台（或登录后无菜单）
- 服务员: 禁止登录后台

---

## P1 重要功能测试

### TC-P1-01: sidebar.js 折叠菜单展开/收起状态

**目的**: 验证包含当前页面所在分组的菜单组自动展开（open 类）

**步骤**:
```bash
# 1. 检查 sidebar.js 是否包含 open 状态设置逻辑
curl -s http://127.0.0.1:8088/admin/js/sidebar.js | grep -c "open\|active"

# 2. 加载 index.html（数据概览在系统分组外，前厅应默认展开或所有分组展开）
curl -s http://127.0.0.1:8088/admin/index.html | grep -c "nav-group open"
```

**预期结果**: sidebar.js 包含 active/open 状态设置逻辑

---

### TC-P1-02: 带 hash 的菜单项高亮（批量更新班次）

**目的**: 验证 `coaches.html#batch-shift` 带 hash 的菜单项也能正确高亮

**步骤**:
```bash
# 访问 coaches.html 页面，检查是否有当前页面标识
curl -s http://127.0.0.1:8088/admin/coaches.html | grep -o 'data-current-page="[^"]*"'
```

**预期结果**: 返回 `coaches.html`，sidebar.js 应能同时高亮 coaches.html 和 coaches.html#batch-shift

---

### TC-P1-03: sidebar.js 脚本执行顺序

**目的**: 验证 sidebar.js 在 nav-control.js 之前执行（先加载菜单，再过滤权限）

**步骤**:
```bash
# 检查页面中脚本加载顺序
curl -s http://127.0.0.1:8088/admin/index.html | grep -o '<script[^>]*src="[^"]*"[^>]*>'
```

**预期结果**: sidebar.js 的 `<script>` 标签出现在 nav-control.js 之前，类似：
```html
<script src="js/sidebar.js"></script>
<script src="nav-control.js"></script>
```

---

### TC-P1-04: 不同角色的菜单可见性验证（API 级别）

**目的**: 通过 API 验证不同角色的权限配置

**步骤**:
```bash
# 登录并获取权限信息
curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' | python3 -m json.tool
```

**预期结果**: 响应包含 `permissions` 字段，`role` 字段为 `管理员`

---

### TC-P1-05: 收银看板页面 sidebar 兼容性

**目的**: 收银看板布局特殊（三列全屏），验证 sidebar 加载不影响其布局

**步骤**:
```bash
# 检查 cashier-dashboard.html 是否引用 sidebar.js
curl -s http://127.0.0.1:8088/admin/cashier-dashboard.html | grep -c "sidebar.js"
curl -s http://127.0.0.1:8088/admin/cashier-dashboard.html | grep -c "sidebar.html"

# 检查是否仍包含原有 sidebar 内联HTML（改造后应移除）
curl -s http://127.0.0.1:8088/admin/cashier-dashboard.html | grep -c '<div class="sidebar-logo"'
```

**预期结果**:
- 引用 sidebar.js: >= 1
- 引用 sidebar.html: >= 1
- 旧内联 sidebar: = 0

---

### TC-P1-06: 收银看板全屏功能不受影响

**目的**: 验证收银看板的全屏按钮和全屏功能正常

**步骤**:
```bash
# 检查 cashier-dashboard.html 是否仍包含 fullscreen 相关代码
CONTENT=$(curl -s http://127.0.0.1:8088/admin/cashier-dashboard.html)

echo "=== 全屏按钮 ==="
echo "$CONTENT" | grep -c "fullscreenBtn\|fullscreen-btn"

echo "=== toggleFullscreen 函数 ==="
echo "$CONTENT" | grep -c "toggleFullscreen"

echo "=== fullscreenchange 事件 ==="
echo "$CONTENT" | grep -c "fullscreenchange"

echo "=== Fullscreen API 调用 ==="
echo "$CONTENT" | grep -c "requestFullscreen\|exitFullscreen"
```

**预期结果**: 每项 >= 1（全屏功能完整保留）

---

### TC-P1-07: 无 token 时页面跳转登录页

**目的**: 验证未登录时页面正常跳转到登录页

**步骤**:
```bash
# 不带 token 访问管理页面（检查 HTML 中是否有 token 检查逻辑）
curl -s http://127.0.0.1:8088/admin/index.html | grep -c "login.html"
```

**预期结果**: >= 1（页面包含跳转到 login.html 的逻辑）

---

### TC-P1-08: sidebar.js 加载失败降级处理

**目的**: 验证 sidebar.js 加载失败时有降级处理（或至少不阻断页面）

**步骤**:
```bash
# 检查 sidebar.js 是否包含错误处理
curl -s http://127.0.0.1:8088/admin/js/sidebar.js | grep -c "catch\|error\|fail\|fallback"
```

**预期结果**: >= 1（包含错误处理逻辑）

---

## P2 次要功能测试

### TC-P2-01: sidebar.js fetch 加载超时处理

**目的**: 验证 sidebar.js 对 fetch 请求有超时控制

**步骤**:
```bash
curl -s http://127.0.0.1:8088/admin/js/sidebar.js | grep -c "timeout\|AbortController\|signal"
```

**预期结果**: >= 1（包含超时处理）

---

### TC-P2-02: 改造前后菜单项一致性

**目的**: 对比各页面改造后的菜单项是否完全一致

**步骤**:
```bash
# 获取所有页面的侧边栏内容并对比
BASE="http://127.0.0.1:8088/admin"
PAGES=("index.html" "products.html" "settings.html" "coaches.html")

for page in "${PAGES[@]}"; do
  # 提取 sidebar 区域的 nav-item href
  hrefs=$(curl -s "${BASE}/${page}" | grep -o 'href="[^"]*\.html[^"]*"' | sort | tr '\n' ',')
  echo "${page}: ${hrefs}"
done
```

**预期结果**: 所有页面的 href 列表一致（active 类所在项可以不同）

---

### TC-P2-03: Logo 路径统一

**目的**: 验证所有页面使用统一的 Logo 路径

**步骤**:
```bash
# 检查 sidebar.html 中的 logo 路径
curl -s http://127.0.0.1:8088/admin/sidebar.html | grep -o 'src="[^"]*logo[^"]*"'

# 验证 logo 文件存在
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8088/images/logo.png
```

**预期结果**: 
- sidebar.html 中 logo 路径统一（如 `/images/logo.png`）
- logo 文件 HTTP 200

---

### TC-P2-04: 各页面 title 保持不变

**目的**: 验证改造后各页面的 `<title>` 保持不变

**步骤**:
```bash
BASE="http://127.0.0.1:8088/admin"

echo "index.html: $(curl -s ${BASE}/index.html | grep -o '<title>[^<]*</title>')"
echo "cashier-dashboard.html: $(curl -s ${BASE}/cashier-dashboard.html | grep -o '<title>[^<]*</title>')"
echo "products.html: $(curl -s ${BASE}/products.html | grep -o '<title>[^<]*</title>')"
echo "settings.html: $(curl -s ${BASE}/settings.html | grep -o '<title>[^<]*</title>')"
echo "coaches.html: $(curl -s ${BASE}/coaches.html | grep -o '<title>[^<]*</title>')"
echo "lejuan-records.html: $(curl -s ${BASE}/lejuan-records.html | grep -o '<title>[^<]*</title>')"
echo "members.html: $(curl -s ${BASE}/members.html | grep -o '<title>[^<]*</title>')"
```

**预期结果**: 每个页面的 title 与改造前一致

---

### TC-P2-05: sidebar.html 不破坏各页面原有功能

**目的**: 验证改造后各页面的核心 API 调用正常

**步骤**:
```bash
# 先获取 token
TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

# 测试数据概览 API
echo "=== 数据概览 ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://127.0.0.1:8088/api/admin/stats \
  -H "Authorization: Bearer ${TOKEN}"

# 测试商品管理 API
echo ""
echo "=== 商品列表 ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://127.0.0.1:8088/api/admin/products \
  -H "Authorization: Bearer ${TOKEN}"

# 测试台桌管理 API
echo ""
echo "=== 台桌列表 ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://127.0.0.1:8088/api/admin/tables \
  -H "Authorization: Bearer ${TOKEN}"

# 测试助教列表 API
echo ""
echo "=== 助教列表 ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://127.0.0.1:8088/api/admin/users \
  -H "Authorization: Bearer ${TOKEN}"
```

**预期结果**: 所有 API 返回 HTTP 200

---

### TC-P2-06: sidebar.js 缓存处理

**目的**: 验证 sidebar.js 正确处理浏览器缓存（或使用缓存破坏）

**步骤**:
```bash
# 检查 sidebar.js 是否处理缓存（如加时间戳或 no-cache）
curl -s http://127.0.0.1:8088/admin/js/sidebar.js | grep -c "cache\|no-cache\|timestamp\|v="

# 检查页面引用 sidebar.html 的方式是否包含缓存处理
curl -s http://127.0.0.1:8088/admin/index.html | grep -c "sidebar.html"
```

**预期结果**: 有缓存处理机制（至少一种）

---

## 测试优先级总结

| 优先级 | 用例数 | 说明 |
|--------|--------|------|
| P0 核心 | 8 | sidebar.html/js 可访问、内容完整、权限过滤、页面加载 |
| P1 重要 | 8 | 高亮状态、脚本顺序、全屏功能、降级处理 |
| P2 次要 | 6 | 一致性、缓存、title、Logo 路径 |
| **合计** | **22** | |

---

## 验收检查清单

改造完成后，按以下顺序验收：

1. [ ] `sidebar.html` 文件存在且 HTTP 200 (TC-P0-01)
2. [ ] `sidebar.html` 包含所有菜单项 (TC-P0-02)
3. [ ] `sidebar.js` 文件存在且 HTTP 200 (TC-P0-03)
4. [ ] 管理员登录正常 (TC-P0-04)
5. [ ] 所有 13 个管理页面 HTTP 200 (TC-P0-05)
6. [ ] 页面引用 sidebar.html 和 sidebar.js，无内联旧菜单 (TC-P0-06)
7. [ ] 各页面有当前页面标识 (TC-P0-07)
8. [ ] 权限过滤正常工作 (TC-P0-08)
9. [ ] 折叠菜单状态正确 (TC-P1-01)
10. [ ] 带 hash 菜单项高亮正确 (TC-P1-02)
11. [ ] sidebar.js 在 nav-control.js 之前加载 (TC-P1-03)
12. [ ] 收银看板全屏功能正常 (TC-P1-06)
13. [ ] 各页面菜单项一致 (TC-P2-02)
14. [ ] 各页面 title 保持不变 (TC-P2-04)
15. [ ] 各页面 API 调用正常 (TC-P2-05)

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