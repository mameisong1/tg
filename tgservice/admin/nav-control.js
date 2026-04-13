// 后台导航控制脚本 v9
// 根据用户角色过滤菜单和页面访问权限
// 权限矩阵:
//   管理员/店长/助教管理 → 全部菜单
//   前厅管理 → 收银看板、商品管理、包房管理、台桌管理、商品分类
//   收银 → 收银看板
//   教练 → 禁止后台访问 (2026-04-10)
//   服务员 → 禁止后台访问

(function() {
  // URL-safe base64 解码 + UTF-8 解码（JWT payload 可能包含中文等非ASCII字符）
  function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
      str += '=';
    }
    // atob 返回的是 Latin-1 编码的字符串，需要将 UTF-8 字节序列正确解码
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  }

  // 等待DOM加载完成
  function init() {
    const token = localStorage.getItem('adminToken');
    if (!token) return;
    
    // 角色名映射（中英文兼容）
    const ROLE_MAP = {
      '管理员': ['管理员', 'admin', 'superadmin'],
      '店长': ['店长', 'manager', 'store_manager'],
      '助教管理': ['助教管理', 'coach_manager'],
      '前厅管理': ['前厅管理', 'front_admin', 'front_desk'],
      '收银': ['收银', 'cashier'],
      '教练': ['教练', 'coach'],
      '服务员': ['服务员', 'waiter', 'server']
    };

    // 将角色名统一转为中文标准名（中英文兼容）
    function normalizeRole(role) {
      if (!role) return '管理员';
      for (const [cn, aliases] of Object.entries(ROLE_MAP)) {
        if (aliases.includes(role)) return cn;
      }
      return role; // 未知角色名原样返回
    }

    // 解析JWT获取角色
    try {
      const parts = token.split('.');
      if (parts.length < 2) {
        console.error('nav-control: token格式无效');
        return;
      }
      const payload = JSON.parse(base64UrlDecode(parts[1]));
      const rawRole = payload.role || 'admin';
      const role = normalizeRole(rawRole); // 统一转为中文标准名
      
      // 保存角色到localStorage
      localStorage.setItem('adminRole', role);
      
      // 服务员禁止访问后台（同时检查原始角色和标准化角色）
      if (role === '服务员') {
        alert('服务员不允许访问后台管理系统');
        window.location.href = 'login.html';
        return;
      }
      
      // 角色菜单权限映射（更新：前厅管理可访问前厅目录下所有页面）
      const roleAllowedPages = {
        '管理员': 'all',
        '店长': 'all',
        '助教管理': 'all',
        '前厅管理': ['cashier-dashboard.html', 'products.html', 'vip-rooms.html', 'tables.html', 'categories.html', 'members.html'],
        '收银': ['cashier-dashboard.html'],
        '教练': [] // 教练不再允许访问后台
      };
      
      const allowed = roleAllowedPages[role];
      const isAdmin = (allowed === 'all');
      
      if (!isAdmin && Array.isArray(allowed)) {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        // 如果当前页面不允许访问，跳转到第一个允许页面
        if (!allowed.includes(currentPage)) {
          window.location.href = allowed[0];
          return;
        }
        
        // 隐藏不允许的导航项
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
          const href = item.getAttribute('href');
          if (href && !allowed.includes(href)) {
            item.style.display = 'none';
          }
        });
        
        // 隐藏整个不允许的菜单组（如果组内所有子项都不允许访问）
        const navGroups = document.querySelectorAll('.nav-group');
        navGroups.forEach(group => {
          const subItems = group.querySelectorAll('.nav-submenu .nav-item');
          let allHidden = true;
          subItems.forEach(item => {
            const href = item.getAttribute('href');
            // 去除hash部分再比较
            const hrefPath = (href || '').split('#')[0];
            if (hrefPath && allowed.includes(hrefPath)) {
              allHidden = false;
            }
          });
          if (allHidden && subItems.length > 0) {
            group.style.display = 'none';
          }
        });
      }
      
      // 教练只读模式：隐藏水牌页面的编辑按钮
      if (role === '教练') {
        const style = document.createElement('style');
        // 隐藏各种编辑/删除/添加/保存按钮，以及水牌页面表格中的操作列按钮
        style.textContent = '.edit-btn, .delete-btn, .add-btn, .save-btn { display: none !important; } .btn-sm { display: none !important; }';
        document.head.appendChild(style);
      }
      
    } catch (e) {
      console.error('解析token失败:', e);
    }
  }
  
  // 确保DOM加载完成后再执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
