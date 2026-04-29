/**
 * 权限校验中间件
 * 天宫国际 V2.0
 */

const db = require('../db');
const TimeUtil = require('../utils/time');

// QA-20260422-3: 添加日志支持
const logger = {
  warn: (msg) => console.log('[WARN] ' + new Date().toISOString() + ' ' + msg),
  error: (msg) => console.error('[ERROR] ' + new Date().toISOString() + ' ' + msg)
};

// ✅ 鉴权开关从 global 获取(server.js 统一管理,热更新自动同步)
// 不再维护独立的 authEnabledCache 变量

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
    missingTableOutStats: true,
    systemSettings: true,
    systemReport: true,
    switchDevices: true,
    tableDevices: true,
    switchScenes: true,
    userManagement: true,
    notificationManagement: true
  },
  '店长': {
    menu: ['index', 'home', 'members', 'users', 'reward-penalty-stats', 'cashier-dashboard', 'products', 'vip-rooms', 'tables', 'categories', 'coaches'],
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
    missingTableOutStats: true,
    systemSettings: false,
    systemReport: false,
    switchDevices: false,
    tableDevices: false,
    switchScenes: false,
    userManagement: true,  // 可以管理用户,但不能授权管理员角色
    notificationManagement: true
  },
  '助教管理': {
    menu: ['index', 'coaches', 'reward-penalty-stats', 'cashier-dashboard'],
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
    missingTableOutStats: true,
    systemSettings: false,
    systemReport: false,
    switchDevices: false,
    tableDevices: false,
    switchScenes: false,
    userManagement: false,
    notificationManagement: true
  },
  '教练': {
    menu: [],
    cashierDashboard: false,
    productManagement: false,
    vipRoomManagement: false,
    coachManagement: true,
    waterBoardManagement: true,
    invitationReview: false,
    overtimeApproval: false,
    leaveApproval: false,
    lejuanList: false,
    invitationStats: false,
    operationLogs: false,
    missingTableOutStats: false,
    systemSettings: false,
    systemReport: false,
    switchDevices: false,
    tableDevices: false,
    switchScenes: false,
    userManagement: false
  },
  '前厅管理': {
    menu: ['cashier-dashboard', 'products', 'vip-rooms', 'tables', 'categories'],
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
    operationLogs: false,
    missingTableOutStats: false,
    systemSettings: false,
    systemReport: false,
    switchDevices: false,
    tableDevices: false,
    switchScenes: false,
    userManagement: false
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
    operationLogs: false,
    missingTableOutStats: false,
    systemSettings: false,
    systemReport: false,
    switchDevices: false,
    tableDevices: false,
    switchScenes: false,
    userManagement: false,
    serviceOrder: true      // ✅ 收银员可查看服务单
  },
  // 英文角色名映射(兼容数据库中的英文角色)
  'cashier': {
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
    operationLogs: false,
    missingTableOutStats: false,
    systemSettings: false,
    systemReport: false,
    switchDevices: false,
    tableDevices: false,
    switchScenes: false,
    userManagement: false,
    serviceOrder: true      // ✅ 收银员可查看服务单
  },
  '服务员': {
    menu: [],
    cashierDashboard: false,
    productManagement: false,
    vipRoomManagement: false,
    coachManagement: true,
    waterBoardManagement: false,
    invitationReview: false,
    overtimeApproval: false,
    leaveApproval: false,
    lejuanList: false,
    invitationStats: false,
    operationLogs: false,
    missingTableOutStats: false,
    systemSettings: false,
    systemReport: false,
    switchDevices: false,
    tableDevices: false,
    switchScenes: false,
    userManagement: false
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
    serviceOrder: true,        // ✅ 服务下单可用
    waterBoardView: true,      // ✅ 水牌查看可用
    waterBoardManage: false,
    myRewardPenalty: true      // ✅ 我的奖罚可用
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
    serviceOrder: true,        // ✅ 服务下单可用
    waterBoardView: true,      // ✅ 水牌查看可用
    waterBoardManage: true,
    myRewardPenalty: true      // ✅ 我的奖罚可用
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
    serviceOrder: true,        // ✅ 服务下单可用
    waterBoardView: true,      // ✅ 水牌查看可用
    waterBoardManage: true,
    myRewardPenalty: true      // ✅ 我的奖罚可用
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
    serviceOrder: true,        // ✅ 服务下单可用
    waterBoardView: true,      // ✅ 水牌查看可用
    waterBoardManage: false,
    myRewardPenalty: true      // ✅ 我的奖罚可用
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
    serviceOrder: true,        // ✅ 服务下单可用
    waterBoardView: true,      // ✅ 水牌查看可用
    waterBoardManage: false,
    myRewardPenalty: true      // ✅ 我的奖罚可用
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
    serviceOrder: true,        // ✅ 服务下单可用
    waterBoardView: false,     // ❌ 不能看水牌
    waterBoardManage: false,
    myRewardPenalty: true      // ✅ 我的奖罚可用
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
    serviceOrder: true,        // ✅ 服务下单可用
    waterBoardView: false,     // ❌ 不能看水牌
    waterBoardManage: false,
    myRewardPenalty: true      // ✅ 我的奖罚可用
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
  'coachManagement',     // 打卡(需配合 coachSelfOnly 检查)
  'waterBoardManagement', // 水牌状态查看
  'invitationReview',    // 约客提交
  'all'                  // 申请(加班、请假、乐捐)
];

/**
 * 权限校验中间件 - 后台
 * @param {string|string[]} requiredPermissions - 需要的权限列表
 * @param {object} options - 附加选项
 *   - coachSelfOnly: boolean - 助教只能操作自己的数据(如打卡)
 * @returns {function} - Express 中间件
 */
function requireBackendPermission(requiredPermissions, options = {}) {
  return async (req, res, next) => {
    // ✅ 关闭鉴权时跳过权限检查（从 global 获取，不查数据库）
    const getAuthEnabledCache = global.getAuthEnabledCache;
    if (getAuthEnabledCache && getAuthEnabledCache() === false) {
      req.user = req.user || { username: 'bypass', role: '管理员', userType: 'system' };  
      return next();
    }

    const user = req.user;
    if (!user || !user.role) {
      // QA-20260422-3: 权限拒绝日志
      logger.warn(`权限拒绝: 用户信息缺失 - ${req.method} ${req.url} - IP: ${req.ip}`);
      return res.status(403).json({ error: '未授权' });
    }

    // 助教用户:检查是否有权限访问
    if (user.userType === 'coach') {
      // 检查请求的权限是否在助教允许列表中
      const hasCoachPermission = requiredPermissions.some(perm =>
        COACH_ALLOWED_PERMISSIONS.includes(perm)
      );

      if (!hasCoachPermission) {
        // QA-20260422-3: 权限拒绝日志
        logger.warn(`权限拒绝: 助教无权限 - ${user.coachNo} 访问 ${requiredPermissions.join(',')} - ${req.method} ${req.url}`);
        return res.status(403).json({ error: '权限不足' });
      }

      // 如果设置了 coachSelfOnly,检查是否操作自己的数据
      if (options.coachSelfOnly) {
        // 从 params 或 body 获取 coach_no
        const targetCoachNo = req.params.coach_no || req.body.coach_no;
        // 类型转换后再比较(SQLite 返回数字,params 是字符串)
        if (targetCoachNo && String(targetCoachNo) !== String(user.coachNo)) {
          // QA-20260422-3: 权限拒绝日志
          logger.warn(`权限拒绝: 助教跨账号操作 - ${user.coachNo} 尝试操作 ${targetCoachNo} - ${req.method} ${req.url}`);
          return res.status(403).json({ error: '只能操作自己的数据' });
        }
      }

      return next();
    }

    const permissions = getUserPermissions(user.role);
    const backendPerms = permissions.backend;

    // 服务员角色:只允许 coachManagement 相关权限
    if (user.role === '服务员') {
      // 只允许 pending-count 等特定 API
      const allowedPerms = ['coachManagement'];
      const hasPermission = requiredPermissions.some(perm => allowedPerms.includes(perm));
      if (!hasPermission) {
        logger.warn(`权限拒绝: 服务员尝试访问后台 - ${user.username || '未知'} 角色 ${user.role} 缺少权限 ${requiredPermissions.join(',')} - ${req.method} ${req.url} - IP: ${req.ip}`);
        return res.status(403).json({ error: '服务员禁止访问后台管理系统' });
      }
      return next();
    }

    // 管理员和店长拥有所有权限
    if (['管理员', '店长'].includes(user.role)) {
      return next();
    }

    // 如果传入的是角色名,直接判断角色是否匹配
    if (Array.isArray(requiredPermissions)) {
      const isRoleCheck = requiredPermissions.every(perm =>
        ['管理员', '店长', '助教管理', '前厅管理', '收银', '教练', '服务员', 'cashier'].includes(perm)
      );
      if (isRoleCheck) {
        // 角色名检查:用户角色必须在允许的角色列表中
        if (!requiredPermissions.includes(user.role)) {
          logger.warn(`权限拒绝: 角色 ${user.role} 不在允许列表 ${requiredPermissions.join(',')} 中 - ${req.method} ${req.url}`);
          return res.status(403).json({ error: '权限不足' });
        }
        return next();
      }
    }

    // 检查是否有全部菜单权限
    if (backendPerms.menu && backendPerms.menu.includes('all')) {
      return next();
    }

    // 检查特定权限
    if (Array.isArray(requiredPermissions)) {
      const hasPermission = requiredPermissions.some(perm => {
        if (perm === 'all') return backendPerms.menu?.includes('all');
        // 支持页面路径名(如 'cashier-dashboard')
        if (backendPerms.menu && backendPerms.menu.includes(perm)) return true;
        if (backendPerms.menu && backendPerms.menu.includes(perm + '.html')) return true;
        // 支持 readonly 权限(如水牌管理的教练)
        const val = backendPerms[perm];
        if (val === true || val === 'readonly') return true;
        return false;
      });

      if (!hasPermission) {
        logger.warn(`权限拒绝: 用户 ${user.username || '未知'} 角色 ${user.role} 缺少权限 ${requiredPermissions.join(',')} - ${req.method} ${req.url} - IP: ${req.ip}`);
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
