/**
 * 后台管理公共侧边栏 v1
 * 功能：菜单渲染 + 自动高亮 + 角色权限过滤
 * 依赖：sidebar.css
 */

// ==================== 菜单配置 ====================
// 每个菜单项：{ label, icon, href, group }
// group 为 null 表示顶级项，非 null 表示属于该分组
var MENU_CONFIG = [
  // 顶级项
  { label: '数据概览', icon: '\uD83D\uDCCA', href: 'index.html', group: null },
  { label: '会员管理', icon: '\uD83D\uDC65', href: 'members.html', group: null },
  // 【前厅】
  { label: '收银看板', icon: '\uD83D\uDCB0', href: 'cashier-dashboard.html', group: '前厅' },
  { label: '商品管理', icon: '\uD83D\uDCE6', href: 'products.html', group: '前厅' },
  { label: '包房管理', icon: '\uD83D\uDECB\uFE0F', href: 'vip-rooms.html', group: '前厅' },
  { label: '台桌管理', icon: '\uD83C\uDFB1', href: 'tables.html', group: '前厅' },
  { label: '商品分类', icon: '\uD83C\uDFF7\uFE0F', href: 'categories.html', group: '前厅' },
  // 【助教管理】
  { label: '助教列表', icon: '\uD83D\uDC69', href: 'coaches.html', group: '助教管理' },
  { label: '批量更新班次', icon: '\uD83D\uDD04', href: 'coaches.html#batch-shift', group: '助教管理' },
  // 【设备管理】
  { label: '设备开关管理', icon: '\uD83D\uDD0C', href: 'switch-devices.html', group: '设备管理' },
  { label: '台桌设备关系', icon: '\uD83C\uDFB1', href: 'table-devices.html', group: '设备管理' },
  { label: '开关场景管理', icon: '\uD83C\uDFAC', href: 'switch-scenes.html', group: '设备管理' },
  // 【系统】
  { label: '操作日志', icon: '\uD83D\uDCDC', href: 'operation-logs.html', group: '系统' },
  { label: '系统报告', icon: '\uD83D\uDC8A', href: 'system-report.html', group: '系统' },
  { label: '首页配置', icon: '\uD83C\uDFE0', href: 'home.html', group: '系统' },
  { label: '用户管理', icon: '\uD83D\uDC65', href: 'users.html', group: '系统' },
  { label: '系统配置', icon: '\uD83D\uDEE1\uFE0F', href: 'settings.html', group: '系统' },
  // 【人事】
  { label: '奖罚统计', icon: '\uD83C\uDFC6', href: 'reward-penalty-stats.html', group: '人事' },
];

// 分组图标
var GROUP_ICONS = {
  '前厅': '\uD83C\uDFE0',
  '助教管理': '\uD83D\uDC69\u200D\uD83C\uDFEB',
  '设备管理': '\uD83D\uDCA1',
  '系统': '\u2699\uFE0F',
  '人事': '\uD83D\uDC65'
};

// 角色名映射（中英文兼容）
var ROLE_MAP = {
  '\u7BA1\u7406\u5458': ['\u7BA1\u7406\u5458', 'admin', 'superadmin'],
  '\u5E97\u957F': ['\u5E97\u957F', 'manager', 'store_manager'],
  '\u52A9\u6559\u7BA1\u7406': ['\u52A9\u6559\u7BA1\u7406', 'coach_manager'],
  '\u524D\u5385\u7BA1\u7406': ['\u524D\u5385\u7BA1\u7406', 'front_admin', 'front_desk'],
  '\u6536\u94F6': ['\u6536\u94F6', 'cashier'],
  '\u6559\u7EC3': ['\u6559\u7EC3', 'coach'],
  '\u670D\u52A1\u5458': ['\u670D\u52A1\u5458', 'waiter', 'server']
};

// 角色权限配置
var ROLE_ALLOWED = {
  '\u7BA1\u7406\u5458': 'all',
  '\u5E97\u957F': 'all',
  '\u52A9\u6559\u7BA1\u7406': 'all',
  '\u524D\u5385\u7BA1\u7406': ['cashier-dashboard.html', 'products.html', 'vip-rooms.html', 'tables.html', 'categories.html', 'members.html'],
  '\u6536\u94F6': ['cashier-dashboard.html'],
  '\u6559\u7EC3': [],
  '\u670D\u52A1\u5458': []
};

// ==================== 工具函数 ====================

function normalizeRole(role) {
  if (!role) return '\u7BA1\u7406\u5458';
  for (var key in ROLE_MAP) {
    if (ROLE_MAP[key].indexOf(role) !== -1) return key;
  }
  return role;
}

function getRole() {
  var token = localStorage.getItem('adminToken');
  if (!token) return null;
  try {
    var parts = token.split('.');
    if (parts.length < 2) return null;
    // URL-safe base64 解码
    var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    var payload = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    return normalizeRole(payload.role || 'admin');
  } catch (e) {
    return null;
  }
}

function getCurrentPage() {
  return window.location.pathname.split('/').pop() || 'index.html';
}

function isCurrentPage(href) {
  var currentPage = getCurrentPage();
  // 完全匹配（含hash，如 coaches.html#batch-shift）
  if (href === currentPage || href.indexOf('#') !== -1 && href.split('#')[0] === currentPage && window.location.hash === '#' + href.split('#')[1]) {
    return true;
  }
  // 仅匹配页面（无hash）
  var pageOnly = href.split('#')[0];
  return pageOnly === currentPage && href.indexOf('#') === -1;
}

// ==================== 角色权限过滤 ====================

function filterMenuByRole(role) {
  var allowed = ROLE_ALLOWED[role];
  if (allowed === 'all' || !allowed) return MENU_CONFIG;
  if (!Array.isArray(allowed) || allowed.length === 0) return [];
  return MENU_CONFIG.filter(function(item) {
    var page = item.href.split('#')[0];
    return allowed.indexOf(page) !== -1;
  });
}

// ==================== 渲染侧边栏 ====================

function renderSidebar() {
  var container = document.querySelector('.sidebar');
  if (!container) return;

  var role = getRole();

  // 服务员禁止访问后台
  if (role === '\u670D\u52A1\u5458') {
    alert('\u670D\u52A1\u5458\u4E0D\u5141\u8BB8\u8BBF\u95EE\u540E\u53F0\u7BA1\u7406\u7CFB\u7EDF');
    window.location.href = 'login.html';
    return;
  }

  var filteredMenu = filterMenuByRole(role);
  if (!filteredMenu.length) {
    container.innerHTML = '<div style="padding:20px;color:rgba(255,255,255,0.4);text-align:center">无菜单权限</div>';
    return;
  }

  // 按分组组织
  var topLevel = [];
  var groups = {};
  var groupOrder = []; // 保持顺序

  for (var i = 0; i < filteredMenu.length; i++) {
    var item = filteredMenu[i];
    if (!item.group) {
      topLevel.push(item);
    } else {
      if (!groups[item.group]) {
        groups[item.group] = [];
        groupOrder.push(item.group);
      }
      groups[item.group].push(item);
    }
  }

  var currentPage = getCurrentPage();
  var html = '';

  // Logo
  html += '<div class="sidebar-logo">';
  html += '<img src="/images/logo.png" alt="Logo">';
  html += '<div>';
  html += '<div class="sidebar-title">\u5929\u5BAB\u56FD\u9645</div>';
  html += '<div class="sidebar-sub">\u540E\u53F0\u7BA1\u7406\u7CFB\u7EDF</div>';
  html += '</div></div>';

  // 顶级项
  for (var j = 0; j < topLevel.length; j++) {
    var active = isCurrentPage(topLevel[j].href) ? ' active' : '';
    html += '<a href="' + topLevel[j].href + '" class="nav-item' + active + '">';
    html += '<span class="nav-icon">' + topLevel[j].icon + '</span> ' + topLevel[j].label + '</a>';
  }

  // 分组
  for (var k = 0; k < groupOrder.length; k++) {
    var groupName = groupOrder[k];
    var groupItems = groups[groupName];
    if (!groupItems.length) continue;

    // 检查分组内是否有当前页面
    var groupHasActive = false;
    for (var m = 0; m < groupItems.length; m++) {
      if (isCurrentPage(groupItems[m].href)) {
        groupHasActive = true;
        break;
      }
    }

    // 分组默认打开：如果有当前页面在组内，或者该组是"前厅"（首页默认打开）
    var openClass = (groupHasActive || groupName === '\u524D\u5385') ? ' open' : '';

    html += '<div class="nav-group' + openClass + '">';
    html += '<div class="nav-group-title" onclick="window.toggleGroup(this)">';
    html += '<span class="group-icon">' + (GROUP_ICONS[groupName] || '') + '</span>';
    html += '<span class="group-text">' + groupName + '</span>';
    html += '<span class="arrow">\u25BC</span>';
    html += '</div>';
    html += '<div class="nav-submenu">';

    for (var n = 0; n < groupItems.length; n++) {
      var itemActive = isCurrentPage(groupItems[n].href) ? ' active' : '';
      html += '<a href="' + groupItems[n].href + '" class="nav-item' + itemActive + '">';
      html += '<span class="nav-icon">' + groupItems[n].icon + '</span> ' + groupItems[n].label + '</a>';
    }

    html += '</div></div>';
  }

  container.innerHTML = html;
}

// ==================== 分组折叠切换 ====================

window.toggleGroup = function(el) {
  el.parentElement.classList.toggle('open');
};

// ==================== 页面重定向（教练禁止访问）====================

function checkRoleAccess() {
  var role = getRole();
  if (!role) return;

  // 教练禁止后台
  if (role === '\u6559\u7EC3') {
    var allowed = ROLE_ALLOWED['\u6559\u7EC3'];
    if (allowed && allowed.length === 0) {
      // 已登录但角色不允许访问，跳到第一个允许页面或登录
      alert('\u6559\u7EC3\u4E0D\u5141\u8BB8\u8BBF\u95EE\u540E\u53F0\u7BA1\u7406\u7CFB\u7EDF');
      window.location.href = 'login.html';
      return;
    }
  }

  // 前厅管理/收银：检查当前页面是否允许
  var allowed = ROLE_ALLOWED[role];
  if (allowed && Array.isArray(allowed) && allowed.length > 0) {
    var currentPage = getCurrentPage();
    if (allowed.indexOf(currentPage) === -1) {
      window.location.href = allowed[0];
    }
  }
}

// ==================== 初始化 ====================

(function() {
  var token = localStorage.getItem('adminToken');
  if (!token) {
    // 不在登录页面则跳转
    var currentPage = getCurrentPage();
    if (currentPage !== 'login.html') {
      window.location.href = 'login.html';
    }
    return;
  }

  checkRoleAccess();
  renderSidebar();
})();
