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
    operationLogs: true
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
    operationLogs: true
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
    operationLogs: false
  },
  '教练': {
    menu: [],
    cashierDashboard: true,
    productManagement: false,
    vipRoomManagement: false,
    coachManagement: false,
    waterBoardManagement: 'readonly',
    invitationReview: false,
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
    menu: ['cashier-dashboard'],
    cashierDashboard: true,
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

/**
 * 权限校验中间件 - 后台
 * @param {string|string[]} requiredPermissions - 需要的权限列表
 * @returns {function} - Express 中间件
 */
function requireBackendPermission(requiredPermissions) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !user.role) {
      return res.status(403).json({ error: '未授权' });
    }
    
    const permissions = getUserPermissions(user.role);
    const backendPerms = permissions.backend;
    
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
        return backendPerms[perm] === true;
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
