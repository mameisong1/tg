/**
 * 权限校验中间件
 * 天宫国际 V2.0
 */

// 角色权限矩阵
const PERMISSION_MATRIX = {
  // 后台权限
  '管理员': {
    menu: ['all'],
    cashierDashboard: true,
    productManagement: true,
    vipRoomManagement: true,
    coachManagement: true,
    waterBoardManagement: true,
    invitationReview: true,
    overtimeApproval: true,
    leaveApproval: true,
    lejuanList: true,
    invitationStats: true,
    operationLogs: true,
    missingTableOutStats: true
  },
  '店长': {
    menu: ['all'],
    cashierDashboard: true,
    productManagement: true,
    vipRoomManagement: true,
    coachManagement: true,
    waterBoardManagement: true,
    invitationReview: true,
    overtimeApproval: true,
    leaveApproval: true,
    lejuanList: true,
    invitationStats: true,
    operationLogs: true,
    missingTableOutStats: true
  },
  '助教管理': {
    menu: ['all'],
    cashierDashboard: true,
    productManagement: true,
    vipRoomManagement: true,
    coachManagement: true,
    waterBoardManagement: true,
    invitationReview: true,
    overtimeApproval: true,
    leaveApproval: true,
    lejuanList: true,
    invitationStats: true,
    operationLogs: false,
    missingTableOutStats: true
  },
  '教练': {
    menu: ['cashier-dashboard', 'water-boards'],
    cashierDashboard: true,      // 上下桌单、服务单
    productManagement: false,
    vipRoomManagement: false,
    coachManagement: true,       // 打卡（自己）
    waterBoardManagement: 'readonly',
    invitationReview: true,      // 约客提交
    overtimeApproval: false,
    leaveApproval: false,
    lejuanList: false,
    invitationStats: false,
    operationLogs: false
  },
  '前厅管理': {
    menu: ['cashier-dashboard', 'products', 'vip-rooms'],
    cashierDashboard: true,
    productManagement: true,
    vipRoomManagement: true,
    coachManagement: false,
    waterBoardManagement: false,
    invitationReview: false,
    overtimeApproval: false,
    leaveApproval: false,
    lejuanList: false,
    invitationStats: false,
    operationLogs: false
  },
  '收银': {
    menu: ['cashier-dashboard', 'products'],
    cashierDashboard: true,
    serviceOrder: true,
    productManagement: true,
    vipRoomManagement: false,
    coachManagement: false,
    waterBoardManagement: false,
    invitationReview: false,
    overtimeApproval: false,
    leaveApproval: false,
    lejuanList: false,
    invitationStats: false,
    operationLogs: false
  },
  // 英文角色名映射（兼容数据库中的英文角色）
  'cashier': {
    menu: ['cashier-dashboard', 'products'],
    cashierDashboard: true,
    serviceOrder: true,
    productManagement: true,
    vipRoomManagement: false,
    coachManagement: false,
    waterBoardManagement: false,
    invitationReview: false,
    overtimeApproval: false,
    leaveApproval: false,
    lejuanList: false,
    invitationStats: false,
    operationLogs: false
  },
  '服务员': {
    menu: [],
    cashierDashboard: false,
    productManagement: false,
    vipRoomManagement: false,
    coachManagement: false,
    waterBoardManagement: false,
    invitationReview: false,
    overtimeApproval: false,
    leaveApproval: false,
    lejuanList: false,
    invitationStats: false,
    operationLogs: false
  }
};

// 前台【内部专用】版块权限矩阵
const FRONTEND_PERMISSION_MATRIX = {
  '助教': {
    internalHome: true,
    profile: true,
    clock: true,
    tableAction: true,
    overtimeApply: true,
    leaveApply: true,
    lejuan: true,
    invitationUpload: true,
    serviceOrder: false,
    waterBoardView: false,
    waterBoardManage: false
  },
  '店长': {
    internalHome: true,
    profile: true,
    clock: false,
    tableAction: false,
    overtimeApply: false,
    leaveApply: false,
    lejuan: false,
    invitationUpload: false,
    serviceOrder: true,
    waterBoardView: false,
    waterBoardManage: true
  },
  '助教管理': {
    internalHome: true,
    profile: true,
    clock: false,
    tableAction: false,
    overtimeApply: false,
    leaveApply: false,
    lejuan: false,
    invitationUpload: false,
    serviceOrder: true,
    waterBoardView: false,
    waterBoardManage: true
  },
  '教练': {
    internalHome: true,
    profile: true,
    clock: false,
    tableAction: false,
    overtimeApply: false,
    leaveApply: false,
    lejuan: false,
    invitationUpload: false,
    serviceOrder: true,
    waterBoardView: true,
    waterBoardManage: false
  },
  '前厅管理': {
    internalHome: false,
    profile: false,
    clock: false,
    tableAction: false,
    overtimeApply: false,
    leaveApply: false,
    lejuan: false,
    invitationUpload: false,
    serviceOrder: true,
    waterBoardView: false,
    waterBoardManage: false
  },
  '收银': {
    internalHome: false,
    profile: false,
    clock: false,
    tableAction: false,
    overtimeApply: false,
    leaveApply: false,
    lejuan: false,
    invitationUpload: false,
    serviceOrder: true,
    waterBoardView: false,
    waterBoardManage: false
  },
  '服务员': {
    internalHome: false,
    profile: false,
    clock: false,
    tableAction: false,
    overtimeApply: false,
    leaveApply: false,
    lejuan: false,
    invitationUpload: false,
    serviceOrder: false,
    waterBoardView: false,
    waterBoardManage: false
  }
};

/**
 * 获取用户权限列表
 * @param {string} role - 用户角色
 * @returns {object} - 权限对象
 */
function getUserPermissions(role) {
  const backendPerms = PERMISSION_MATRIX[role] || PERMISSION_MATRIX['服务员'];
  const frontendPerms = FRONTEND_PERMISSION_MATRIX[role] || FRONTEND_PERMISSION_MATRIX['服务员'];
  
  return {
    role,
    backend: backendPerms,
    frontend: frontendPerms
  };
}

// 前端页面路径 → 后端权限字段映射
const PAGE_PERMISSION_MAP = {
  'cashier-dashboard': 'cashierDashboard',
  'cashier-dashboard.html': 'cashierDashboard',
  'products': 'productManagement',
  'products.html': 'productManagement',
  'vip-rooms': 'vipRoomManagement',
  'vip-rooms.html': 'vipRoomManagement',
  'coaches': 'coachManagement',
  'coaches.html': 'coachManagement',
  'water-boards': 'waterBoardManagement',
  'water-boards.html': 'waterBoardManagement',
  'invitation-review': 'invitationReview',
  'invitation-review.html': 'invitationReview',
  'lejuan': 'lejuanList',
  'lejuan.html': 'lejuanList',
  'invitation-stats': 'invitationStats',
  'invitation-stats.html': 'invitationStats',
  'operation-logs': 'operationLogs',
  'operation-logs.html': 'operationLogs',
  'orders': 'cashierDashboard',
  'orders.html': 'cashierDashboard',
  'index': 'cashierDashboard',
  'index.html': 'cashierDashboard',
  'members': 'coachManagement',
  'members.html': 'coachManagement',
  'categories': 'productManagement',
  'categories.html': 'productManagement',
  'users': 'coachManagement',
  'users.html': 'coachManagement',
  'settings': 'coachManagement',
  'settings.html': 'coachManagement',
  'tables': 'vipRoomManagement',
  'tables.html': 'vipRoomManagement',
  'home': 'cashierDashboard',
  'home.html': 'cashierDashboard'
};

/**
 * 检查用户是否有访问某个前端页面的权限
 * @param {string} role - 用户角色
 * @param {string} page - 页面文件名或路径
 * @returns {boolean}
 */
function hasPagePermission(role, page) {
  const perms = PERMISSION_MATRIX[role];
  if (!perms) return false;
  
  // 管理员/店长/助教管理拥有全部权限
  if (perms.menu && perms.menu.includes('all')) return true;
  
  // 服务员禁止访问后台
  if (role === '服务员') return false;
  
  // 检查页面是否在菜单权限中
  if (perms.menu && perms.menu.includes(page)) return true;
  if (perms.menu && perms.menu.includes(page + '.html')) return true;
  
  // 通过映射检查后端权限
  const permKey = PAGE_PERMISSION_MAP[page];
  if (permKey && perms[permKey] === true) return true;
  
  return false;
}

// 助教可访问的后台权限列表
const COACH_ALLOWED_PERMISSIONS = [
  'cashierDashboard',    // 上下桌单、服务单
  'serviceOrder',        // 服务单查看
  'coachManagement',     // 打卡（需配合 coachSelfOnly 检查）
  'waterBoardManagement', // 水牌状态查看
  'invitationReview',    // 约客提交
  'all'                  // 申请（加班、请假、乐捐）
];

/**
 * 权限校验中间件 - 后台
 * @param {string|string[]} requiredPermissions - 需要的权限列表
 * @param {object} options - 附加选项
 *   - coachSelfOnly: boolean - 助教只能操作自己的数据（如打卡）
 * @returns {function} - Express 中间件
 */
function requireBackendPermission(requiredPermissions, options = {}) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !user.role) {
      return res.status(403).json({ error: '未授权' });
    }
    
    // 助教用户：检查是否有权限访问
    if (user.userType === 'coach') {
      // 检查请求的权限是否在助教允许列表中
      const hasCoachPermission = requiredPermissions.some(perm => 
        COACH_ALLOWED_PERMISSIONS.includes(perm)
      );
      
      if (!hasCoachPermission) {
        return res.status(403).json({ error: '权限不足' });
      }
      
      // 如果设置了 coachSelfOnly，检查是否操作自己的数据
      if (options.coachSelfOnly) {
        // 从 params 或 body 获取 coach_no
        const targetCoachNo = req.params.coach_no || req.body.coach_no;
        // 类型转换后再比较（SQLite 返回数字，params 是字符串）
        if (targetCoachNo && String(targetCoachNo) !== String(user.coachNo)) {
          return res.status(403).json({ error: '只能操作自己的数据' });
        }
      }
      
      return next();
    }
    
    const permissions = getUserPermissions(user.role);
    const backendPerms = permissions.backend;
    
    // 服务员禁止访问后台
    if (user.role === '服务员') {
      return res.status(403).json({ error: '服务员禁止访问后台管理系统' });
    }
    
    // 管理员和店长拥有所有权限
    if (['管理员', '店长'].includes(user.role)) {
      return next();
    }
    
    // 检查是否有全部菜单权限
    if (backendPerms.menu && backendPerms.menu.includes('all')) {
      return next();
    }
    
    // 检查特定权限
    if (Array.isArray(requiredPermissions)) {
      const hasPermission = requiredPermissions.some(perm => {
        if (perm === 'all') return backendPerms.menu?.includes('all');
        // 支持页面路径名（如 'cashier-dashboard'）
        if (backendPerms.menu && backendPerms.menu.includes(perm)) return true;
        if (backendPerms.menu && backendPerms.menu.includes(perm + '.html')) return true;
        // 支持 readonly 权限（如水牌管理的教练）
        const val = backendPerms[perm];
        if (val === true || val === 'readonly') return true;
        return false;
      });
      
      if (!hasPermission) {
        return res.status(403).json({ error: '权限不足' });
      }
    }
    
    next();
  };
}

/**
 * 权限校验中间件 - 前台
 * @param {string} requiredFeature - 需要的功能
 * @returns {function} - Express 中间件
 */
function requireFrontendFeature(requiredFeature) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !user.role) {
      return res.status(403).json({ error: '未授权' });
    }
    
    const permissions = getUserPermissions(user.role);
    const frontendPerms = permissions.frontend;
    
    // 检查特定功能权限
    if (frontendPerms[requiredFeature] !== true) {
      return res.status(403).json({ error: '权限不足' });
    }
    
    next();
  };
}

/**
 * 检查用户是否有某个后台权限
 * @param {string} role - 用户角色
 * @param {string} permission - 权限名称
 * @returns {boolean}
 */
function hasBackendPermission(role, permission) {
  const perms = PERMISSION_MATRIX[role] || PERMISSION_MATRIX['服务员'];
  return perms[permission] === true || perms.menu?.includes('all');
}

/**
 * 检查用户是否有某个前台功能权限
 * @param {string} role - 用户角色
 * @param {string} feature - 功能名称
 * @returns {boolean}
 */
function hasFrontendFeature(role, feature) {
  const perms = FRONTEND_PERMISSION_MATRIX[role] || FRONTEND_PERMISSION_MATRIX['服务员'];
  return perms[feature] === true;
}

module.exports = {
  PERMISSION_MATRIX,
  FRONTEND_PERMISSION_MATRIX,
  getUserPermissions,
  requireBackendPermission,
  requireFrontendFeature,
  hasBackendPermission,
  hasFrontendFeature
};
