你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
```
# 后台Admin左侧菜单栏公共化改造 - 设计方案

## QA需求
将15个HTML页面中重复的菜单栏HTML提取为公共模板，通过sidebar.js动态加载+自动高亮+角色权限过滤。解决菜单不一致问题（不同页面看到的菜单项不同）。

---

## 1. 现状分析

### 1.1 文件清单
共15个HTML页面包含侧边栏（login.html除外）：
- `index.html` - 数据概览
- `members.html` - 会员管理
- `cashier-dashboard.html` - 收银看板
- `products.html` - 商品管理
- `vip-rooms.html` - 包房管理
- `tables.html` - 台桌管理
- `categories.html` - 商品分类
- `coaches.html` - 助教列表
- `operation-logs.html` - 操作日志
- `home.html` - 首页配置
- `users.html` - 用户管理
- `settings.html` - 系统配置
- `switch-devices.html` - 设备开关管理
- `table-devices.html` - 台桌设备关系
- `switch-scenes.html` - 开关场景管理

### 1.2 发现的不一致问题

| 问题类型 | 影响页面数 | 具体情况 |
|---------|-----------|---------|
| **缺少"设备管理"分组** | 11个 | members, categories, coaches, home, products, settings, tables, users, vip-rooms, cashier-dashboard, operation-logs |
| **缺少"批量更新班次"链接** | 3个 | switch-devices, switch-scenes, table-devices |
| **CSS样式重复** | 15个 | 每个页面都有约50行sidebar相关CSS |
| **active状态硬编码** | 15个 | 每个页面手动设置active class |
| **toggleGroup函数重复** | 15个 | 每个页面都定义了toggleGroup函数 |
| **图标格式不一致** | 混合 | 部分使用`<span class="nav-icon">💰</span>`，部分直接用`💰` |

### 1.3 完整菜单结构（应该是统一的标准）

```
数据概览 (index.html)
会员管理 (members.html)

【前厅】(默认展开)
  - 收银看板 (cashier-dashboard.html)
  - 商品管理 (products.html)
  - 包房管理 (vip-rooms.html)
  - 台桌管理 (tables.html)
  - 商品分类 (categories.html)

【助教管理】
  - 助教列表 (coaches.html)
  - 批量更新班次 (coaches.html#batch-shift)

【设备管理】
  - 设备开关管理 (switch-devices.html)
  - 台桌设备关系 (table-devices.html)
  - 开关场景管理 (switch-scenes.html)

【系统】
  - 操作日志 (operation-logs.html)
  - 首页配置 (home.html)
  - 用户管理 (users.html)
  - 系统配置 (settings.html)
```

共16个菜单项 + 4个分组

### 1.4 现有角色权限系统

已有 `nav-control.js` 实现角色过滤：
- 管理员/店长/助教管理 → 全部菜单
- 前厅管理 → 收银看板、商品管理、包房管理、台桌管理、商品分类、会员管理
- 收银 → 仅收银看板
- 教练/服务员 → 禁止访问后台

---

## 2. 技术方案

### 2.1 方案选择

**方案：JavaScript动态渲染 + 内联配置**

- 将菜单配置内联到sidebar.js中，避免异步fetch导致的时序问题
- sidebar.js在页面加载时同步渲染侧边栏HTML
- 自动检测当前页面并设置active高亮
- 内置角色权限过滤，渲染时只显示允许的菜单项
- 提取CSS到独立文件sidebar.css

**为何不使用fetch加载sidebar.html：**
1. 异步加载会导致nav-control.js运行时侧边栏尚未渲染
2. 需要复杂的时序协调（DOMContentLoaded、Promise等）
3. 内联渲染更简单、更可靠、性能更好

### 2.2 新增文件

| 文件 | 路径 | 说明 |
|-----|------|-----|
| `sidebar.js` | `/TG/tgservice/admin/sidebar.js` | 侧边栏渲染+角色过滤+自动高亮 |
| `sidebar.css` | `/TG/tgservice/admin/sidebar.css` | 侧边栏样式（从各页面提取） |
| `sidebar.html` | `/TG/tgservice/admin/sidebar.html` | 最小化容器模板（可选） |

### 2.3 删除文件

| 文件 | 路径 | 原因 |
|-----|------|-----|
| `nav-control.js` | `/TG/tgservice/admin/nav-control.js` | 功能已整合到sidebar.js |

### 2.4 修改文件

全部15个HTML页面需要修改：
- 移除内联侧边栏HTML（约50行）
- 移除内联sidebar相关CSS（约40行）
- 移除nav-control.js引用
- 移除toggleGroup函数定义
- 添加sidebar.css引用
- 添加sidebar.js引用（放在body顶部，确保先渲染）

---

## 3. 详细设计

### 3.1 sidebar.js 设计

```javascript
// sidebar.js - 后台侧边栏渲染脚本 v1
// 功能：动态渲染 + 自动高亮 + 角色权限过滤

(function() {
  // ========== 菜单配置 ==========
  const MENU_CONFIG = {
    standalone: [
      { id: 'index', label: '数据概览', icon: '📊', href: 'index.html' },
      { id: 'members', label: '会员管理', icon: '👥', href: 'members.html' }
    ],
    groups: [
      {
        id: 'front-hall',
        title: '前厅',
        icon: '🏠',
        defaultOpen: true,
        items: [
          { id: 'cashier-dashboard', label: '收银看板', icon: '💰', href: 'cashier-dashboard.html' },
          { id: 'products', label: '商品管理', icon: '📦', href: 'products.html' },
          { id: 'vip-rooms', label: '包房管理', icon: '🛋️', href: 'vip-rooms.html' },
          { id: 'tables', label: '台桌管理', icon: '🎱', href: 'tables.html' },
          { id: 'categories', label: '商品分类', icon: '🏷️', href: 'categories.html' }
        ]
      },
      {
        id: 'coach-mgmt',
        title: '助教管理',
        icon: '👩🏫',
        defaultOpen: false,
        items: [
          { id: 'coaches', label: '助教列表', icon: '👩', href: 'coaches.html' },
          { id: 'batch-shift', label: '批量更新班次', icon: '🔄', href: 'coaches.html#batch-shift' }
        ]
      },
      {
        id: 'device-mgmt',
        title: '设备管理',
        icon: '💡',
        defaultOpen: false,
        items: [
          { id: 'switch-devices', label: '设备开关管理', icon: '🔌', href: 'switch-devices.html' },
          { id: 'table-devices', label: '台桌设备关系', icon: '🎱', href: 'table-devices.html' },
          { id: 'switch-scenes', label: '开关场景管理', icon: '🎬', href: 'switch-scenes.html' }
        ]
      },
      {
        id: 'system',
        title: '系统',
        icon: '⚙️',
        defaultOpen: false,
        items: [
          { id: 'operation-logs', label: '操作日志', icon: '📜', href: 'operation-logs.html' },
          { id: 'home', label: '首页配置', icon: '🏠', href: 'home.html' },
          { id: 'users', label: '用户管理', icon: '👥', href: 'users.html' },
          { id: 'settings', label: '系统配置', icon: '🛡️', href: 'settings.html' }
        ]
      }
    ]
  };

  // ========== 角色权限配置 ==========
  const ROLE_PERMISSIONS = {
    '管理员': 'all',
    '店长': 'all',
    '助教管理': 'all',
    '前厅管理': ['index.html', 'members.html', 'cashier-dashboard.html', 'products.html', 'vip-rooms.html', 'tables.html', 'categories.html'],
    '收银': ['cashier-dashboard.html'],
    '教练': [],
    '服务员': []
  };

  // ========== JWT解析（复用nav-control.js逻辑）==========
  function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function getRoleFromToken() {
    const token = localStorage.getItem('adminToken');
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = JSON.parse(base64UrlDecode(parts[1]));
      // 角色名标准化
      const ROLE_MAP = {
        '管理员': ['管理员', 'admin', 'superadmin'],
        '店长': ['店长', 'manager', 'store_manager'],
        '助教管理': ['助教管理', 'coach_manager'],
        '前厅管理': ['前厅管理', 'front_admin', 'front_desk'],
        '收银': ['收银', 'cashier'],
        '教练': ['教练', 'coach'],
        '服务员': ['服务员', 'waiter', 'server']
      };
      const rawRole = payload.role || 'admin';
      for (const [cn, aliases] of Object.entries(ROLE_MAP)) {
        if (aliases.includes(rawRole)) return cn;
      }
      return rawRole;
    } catch (e) {
      console.error('sidebar.js: 解析token失败', e);
      return null;
    }
  }

  // ========== 权限检查 ==========
  function isAllowed(href, role) {
    const allowed = ROLE_PERMISSIONS[role];
    if (!allowed) return false;
    if (allowed === 'all') return true;
    // 去除hash部分比较
    const hrefPath = href.split('#')[0];
    return allowed.includes(hrefPath);
  }

  function getFirstAllowedPage(role) {
    const allowed = ROLE_PERMISSIONS[role];
    if (!allowed || allowed.length === 0) return null;
    if (allowed === 'all') return 'index.html';
    return allowed[0];
  }

  // ========== 当前页面检测 ==========
  function getCurrentPage() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    const hash = window.location.hash;
    return { path, hash, full: path + hash };
  }

  // ========== 渲染侧边栏 ==========
  function renderSidebar(role) {
    const currentPage = getCurrentPage();
    const sidebarEl = document.querySelector('.sidebar');
    if (!sidebarEl) {
      console.error('sidebar.js: 未找到.sidebar容器');
      return;
    }

    // 构建HTML
    let html = `
      <div class="sidebar-logo">
        <img src="/images/logo.png" alt="Logo">
        <div>
          <div class="sidebar-title">天宫国际</div>
          <div class="sidebar-sub">后台管理系统</div>
        </div>
      </div>
    `;

    // 独立菜单项
    MENU_CONFIG.standalone.forEach(item => {
      if (!isAllowed(item.href, role)) return;
      const isActive = item.href === currentPage.path;
      html += `
        <a href="${item.href}" class="nav-item${isActive ? ' active' : ''}">
          <span class="nav-icon">${item.icon}</span> ${item.label}
        </a>
      `;
    });

    // 分组菜单
    MENU_CONFIG.groups.forEach(group => {
      // 过滤该分组下允许的项
      const allowedItems = group.items.filter(item => isAllowed(item.href, role));
      if (allowedItems.length === 0) return; // 整个分组不显示

      // 检查分组内是否有当前页（决定是否展开）
      const hasCurrentPage = allowedItems.some(item => {
        const itemPath = item.href.split('#')[0];
        if (itemPath === currentPage.path) return true;
        if (item.href.includes('#') && item.href === currentPage.full) return true;
        return false;
      });

      html += `
        <div class="nav-group${hasCurrentPage ? ' open' : ''}">
          <div class="nav-group-title" onclick="toggleGroup(this)">
            <span class="group-icon">${group.icon}</span>
            <span class="group-text">${group.title}</span>
            <span class="arrow">▼</span>
          </div>
          <div class="nav-submenu">
      `;

      allowedItems.forEach(item => {
        const itemPath = item.href.split('#')[0];
        const isActive = (itemPath === currentPage.path && 
          (!item.href.includes('#') || currentPage.hash === item.href.split('#')[1]));
        html += `
          <a href="${item.href}" class="nav-item${isActive ? ' active' : ''}">
            <span class="nav-icon">${item.icon}</span> ${item.label}
          </a>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    sidebarEl.innerHTML = html;
  }

  // ========== 页面访问控制 ==========
  function checkPageAccess(role) {
    const currentPage = getCurrentPage();
    
    // 教练/服务员：禁止访问后台
    if (role === '教练' || role === '服务员') {
      alert(role === '教练' ? '教练不允许访问后台管理系统' : '服务员不允许访问后台管理系统');
      localStorage.removeItem('adminToken');
      window.location.href = 'login.html';
      return false;
    }

    // 检查当前页面是否允许
    if (!isAllowed(currentPage.path, role)) {
      const firstAllowed = getFirstAllowedPage(role);
      if (firstAllowed) {
        window.location.href = firstAllowed;
        return false;
      }
    }

    return true;
  }

  // ========== 教练只读模式 ==========
  function applyCoachReadOnly(role) {
    if (role === '教练') {
      const style = document.createElement('style');
      style.textContent = '.edit-btn, .delete-btn, .add-btn, .save-btn, .btn-sm { display: none !important; }';
      document.head.appendChild(style);
    }
  }

  // ========== 全局函数 ==========
  window.toggleGroup = function(el) {
    el.parentElement.classList.toggle('open');
  };

  // ========== 主入口 ==========
  function init() {
    const role = getRoleFromToken();
    
    // 无token：跳转登录
    if (!role) {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        window.location.href = 'login.html';
        return;
      }
    }

    // 存储角色（兼容现有代码）
    localStorage.setItem('adminRole', role);

    // 页面访问检查
    if (!checkPageAccess(role)) return;

    // 渲染侧边栏
    renderSidebar(role);

    // 教练只读模式（虽然教练已禁止访问，但保留以防万一）
    applyCoachReadOnly(role);
  }

  // 同步执行（确保在nav-control.js之前完成）
  init();
})();
```

### 3.2 sidebar.css 设计

```css
/* sidebar.css - 后台侧边栏样式 */

.sidebar {
  width: 220px;
  background: rgba(20,20,30,0.8);
  border-right: 1px solid rgba(218,165,32,0.1);
  padding: 20px 0;
  flex-shrink: 0;
  overflow-y: auto;
  height: 100vh;
  position: sticky;
  top: 0;
}

.sidebar-logo {
  padding: 0 20px 30px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  margin-bottom: 20px;
}

.sidebar-logo img {
  width: 32px;
  height: 32px;
}

.sidebar-title {
  font-size: 16px;
  color: #d4af37;
}

.sidebar-sub {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  margin-top: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  color: rgba(255,255,255,0.6);
  text-decoration: none;
  font-size: 14px;
  transition: all 0.2s;
  cursor: pointer;
}

.nav-item:hover,
.nav-item.active {
  background: rgba(212,175,55,0.1);
  color: #d4af37;
}

.nav-icon {
  font-size: 18px;
}

/* 折叠菜单 */
.nav-group {
  border-bottom: 1px solid rgba(255,255,255,0.03);
}

.nav-group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  color: rgba(255,255,255,0.6);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-group-title:hover {
  background: rgba(212,175,55,0.05);
  color: rgba(255,255,255,0.8);
}

.nav-group-title .arrow {
  transition: transform 0.2s;
  font-size: 12px;
}

.nav-group.open .nav-group-title .arrow {
  transform: rotate(180deg);
}

.nav-group-title .group-icon {
  font-size: 18px;
  margin-right: 12px;
}

.nav-group-title .group-text {
  flex: 1;
}

.nav-submenu {
  display: none;
  background: rgba(0,0,0,0.2);
}

.nav-group.open .nav-submenu {
  display: block;
}

.nav-submenu .nav-item {
  padding-left: 48px;
  font-size: 13px;
}
```

### 3.3 sidebar.html 设计（最小化容器）

```html
<!-- sidebar.html - 侧边栏容器模板 -->
<!-- 实际使用时，各页面只需要 <div class="sidebar"></div> 作为容器 -->
<!-- sidebar.js 会动态填充内容 -->

<div class="sidebar"></div>
```

---

## 4. 修改流程

### 4.1 各HTML页面修改模板

每个页面需要：
1. 在 `<head>` 中添加 `<link rel="stylesheet" href="sidebar.css">`
2. 在 `<body>` 开头添加 `<div class="sidebar"></div>`
3. 移除原有的侧边栏HTML（从 `<div class="sidebar">` 到 `</div>` 约50行）
4. 移除 `<style>` 中侧边栏相关CSS（约40行）
5. 移除 `<script src="nav-control.js"></script>`
6. 移除末尾的 toggleGroup 函数定义
7. 在侧边栏容器后添加 `<script src="sidebar.js"></script>`

**修改前后对比：**

修改前（index.html）：
```html
<head>
  <style>
    /* 约40行 sidebar CSS */
    .sidebar { ... }
    .nav-item { ... }
    ...
  </style>
</head>
<body>
  <div class="sidebar">
    <!-- 约50行侧边栏HTML -->
    <div class="sidebar-logo">...</div>
    <a href="index.html" class="nav-item active">...</a>
    ...
  </div>
  <div class="main">...</div>
  <script>...</script>
  <script src="nav-control.js"></script>
  <script>
    function toggleGroup(el) { ... }
  </script>
</body>
```

修改后：
```html
<head>
  <link rel="stylesheet" href="sidebar.css">
  <style>
    /* 只保留页面特定样式 */
  </style>
</head>
<body>
  <div class="sidebar"></div>
  <script src="sidebar.js"></script>
  <div class="main">...</div>
  <script>...</script>
</body>
```

### 4.2 文件修改清单

| 文件 | 修改内容 |
|-----|---------|
| index.html | 移除sidebar HTML/CSS，添加sidebar.css/sidebar.js引用 |
| members.html | 同上 |
| cashier-dashboard.html | 同上 |
| products.html | 同上 |
| vip-rooms.html | 同上 |
| tables.html | 同上 |
| categories.html | 同上 |
| coaches.html | 同上 |
| operation-logs.html | 同上 |
| home.html | 同上 |
| users.html | 同上 |
| settings.html | 同上 |
| switch-devices.html | 同上 |
| table-devices.html | 同上 |
| switch-scenes.html | 同上 |

---

## 5. API变更

**无需新增API**

- 菜单配置已内联到sidebar.js
- 角色权限配置已内联到sidebar.js
- 如需动态配置，可在后续版本添加 `/api/admin/menu-config` API

---

## 6. 数据库变更

**无需数据库变更**

- 角色信息已存储在admin_users表的role字段
- JWT token已包含role信息

---

## 7. 前后端交互流程

```
┌─────────────────────────────────────────────────────────────┐
│                      页面加载流程                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 浏览器请求 HTML 页面                                     │
│     ↓                                                       │
│  2. HTML 解析，加载 sidebar.css                             │
│     ↓                                                       │
│  3. 遇到 <div class="sidebar"></div>                        │
│     ↓                                                       │
│  4. 遇到 <script src="sidebar.js"></script>                 │
│     ↓                                                       │
│  5. sidebar.js 同步执行：                                    │
│     - 从 localStorage 读取 adminToken                        │
│     - 解析 JWT 获取角色                                      │
│     - 检查页面访问权限（不允许则重定向）                       │
│     - 根据 MENU_CONFIG + ROLE_PERMISSIONS 渲染侧边栏         │
│     - 自动检测当前页面设置 active                            │
│     ↓                                                       │
│  6. 侧边栏渲染完成，继续解析页面其余内容                       │
│     ↓                                                       │
│  7. 页面特定 JS 执行                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. 边界情况与异常处理

### 8.1 无Token或Token过期
- sidebar.js检测到无token → 重定向到login.html
- Token过期 → 后端API返回401 → 页面已有处理逻辑

### 8.2 角色无页面访问权限
- 教练/服务员 → 显示提示 → 重定向到login.html
- 其他受限角色 → 重定向到第一个允许页面

### 8.3 sidebar容器不存在
- console.error输出错误日志
- 页面继续加载（侧边栏区域为空）

### 8.4 Hash链接处理
- `coaches.html#batch-shift` 自动高亮对应菜单项
- 分组自动展开显示当前页

### 8.5 新增菜单项
- 只需修改 sidebar.js 中的 MENU_CONFIG
- 所有页面自动同步

### 8.6 新增角色
- 只需修改 sidebar.js 中的 ROLE_PERMISSIONS
- 所有页面自动同步

---

## 9. 验收测试要点

### 9.1 功能测试

| 测试项 | 验收标准 |
|-------|---------|
| 所有15个页面加载 | 侧边栏正确显示，无空白 |
| 菜单项统一 | 所有页面看到相同的16个菜单项 |
| Active高亮 | 当前页面的菜单项显示active样式 |
| 分组展开 | 当前页面所在的分组自动展开 |
| 角色过滤 | 不同角色看到对应的菜单项 |
| 权限重定向 | 受限角色自动跳转到允许页面 |
| 教练/服务员 | 显示提示后跳转登录页 |
| 折叠/展开 | 点击分组标题可切换展开状态 |
| Hash链接 | coaches.html#batch-shift 正确高亮 |

### 9.2 角色测试矩阵

| 角色 | 可见菜单项数 | 预期行为 |
|-----|------------|---------|
| 管理员 | 16 | 全部可见 |
| 店长 | 16 | 全部可见 |
| 助教管理 | 16 | 全部可见 |
| 前厅管理 | 7 | 数据概览、会员管理、前厅5项 |
| 收银 | 1 | 仅收银看板 |
| 教练 | 0 | 禁止访问，跳转登录 |
| 服务员 | 0 | 禁止访问，跳转登录 |

### 9.3 页面测试流程

验收重点：点击每一个菜单项，确认目标页面正常打开。

测试步骤：
1. 以管理员身份登录
2. 依次点击16个菜单项
3. 每个页面验证：
   - 侧边栏显示完整
   - 当前菜单项高亮
   - 页面功能正常
4. 测试受限角色（前厅管理、收银）
5. 测试禁止角色（教练）

---

## 10. 编码规范遵守

### 10.1 时间处理
- 本方案不涉及时间处理，无需使用TimeUtil

### 10.2 数据库连接
- 本方案不涉及数据库操作，无需使用db/index.js

### 10.3 数据库写入
- 本方案不涉及数据库写入，无需使用writeQueue

---

## 11. 风险评估

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| JS执行失败导致侧边栏空白 | 页面不可用 | 添加错误处理，fallback到硬编码HTML |
| 角色解析错误 | 权限混乱 | 保留nav-control.js作为备用（可选） |
| CSS加载失败 | 样式错乱 | 使用内联样式或备用CSS |
| 浏览器兼容性 | 部分功能失效 | 使用标准ES5语法，避免新特性 |

---

## 12. 后续优化建议

1. **动态菜单配置API** - 可添加 `/api/admin/menu-config` 支持后台动态配置菜单
2. **菜单缓存** - 可将渲染后的HTML缓存到localStorage减少重复渲染
3. **面包屑导航** - 可添加顶部面包屑显示当前页面路径
4. **菜单搜索** - 可添加搜索功能快速定位菜单项
5. **移动端适配** - 可添加响应式设计支持移动端访问

---

## 13. 附录

### 13.1 完整菜单项清单

| 序号 | 菜单项 | 文件 | 分组 |
|-----|-------|------|-----|
| 1 | 数据概览 | index.html | 独立 |
| 2 | 会员管理 | members.html | 独立 |
| 3 | 收银看板 | cashier-dashboard.html | 前厅 |
| 4 | 商品管理 | products.html | 前厅 |
| 5 | 包房管理 | vip-rooms.html | 前厅 |
| 6 | 台桌管理 | tables.html | 前厅 |
| 7 | 商品分类 | categories.html | 前厅 |
| 8 | 助教列表 | coaches.html | 助教管理 |
| 9 | 批量更新班次 | coaches.html#batch-shift | 助教管理 |
| 10 | 设备开关管理 | switch-devices.html | 设备管理 |
| 11 | 台桌设备关系 | table-devices.html | 设备管理 |
| 12 | 开关场景管理 | switch-scenes.html | 设备管理 |
| 13 | 操作日志 | operation-logs.html | 系统 |
| 14 | 首页配置 | home.html | 系统 |
| 15 | 用户管理 | users.html | 系统 |
| 16 | 系统配置 | settings.html | 系统 |

---

**设计完成日期：** 2026-04-16
**设计者：** 程序员A
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