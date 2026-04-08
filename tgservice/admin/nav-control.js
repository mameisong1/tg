// 后台导航控制脚本
// 收银员只能看到：数据概览、收银看板、商品管理、订单管理
// 管理员可以看到全部菜单

(function() {
  const token = localStorage.getItem('adminToken');
  if (!token) return;
  
  // 解析JWT获取角色
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const role = payload.role || 'admin';
    
    // 保存角色到localStorage
    localStorage.setItem('adminRole', role);
    
    // 收银员权限控制
    if (role === 'cashier') {
      // 允许的页面
      const allowedPages = ['index.html', 'cashier-dashboard.html', 'products.html', 'orders.html'];
      const currentPage = window.location.pathname.split('/').pop() || 'index.html';
      
      // 如果当前页面不允许访问，跳转到收银看板
      if (!allowedPages.includes(currentPage)) {
        window.location.href = 'cashier-dashboard.html';
        return;
      }
      
      // 隐藏不允许的导航项
      const navItems = document.querySelectorAll('.nav-item');
      navItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href && !allowedPages.includes(href)) {
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
          if (href && allowedPages.includes(href)) {
            allHidden = false;
          }
        });
        if (allHidden) {
          group.style.display = 'none';
        }
      });
    }
    
    // 其他角色（admin, manager等）默认可以看到全部菜单
  } catch (e) {
    console.error('解析token失败:', e);
  }
})();
