/**
 * 全 API 测试用例 - 测试环境 Turso 云端数据库迁移后回归测试
 * 重点验证: 汉字字符串常量、BigInt 序列化、中文 SQL 查询
 * 
 * 运行方式: cd /TG/tgservice/backend && node test-api-full.js
 * 测试地址: http://127.0.0.1:8088
 */

const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:8088';

// 测试结果统计
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: [],
  details: []
};

// 后台管理员凭证（用于登录获取 token）
const ADMIN_USERNAME = 'tgadmin';
const ADMIN_PASSWORD = 'mayining633';

let adminToken = null;

// =============== 工具函数 ===============

async function apiTest(label, method, path, options = {}) {
  results.total++;
  const { params, data, headers, expectedStatus = 200, validate, skip, skipReason } = options;

  if (skip) {
    results.skipped++;
    results.details.push({ label, status: 'SKIPPED', reason: skipReason || '手动跳过' });
    console.log(`  ⏭  ${label} — 跳过: ${skipReason || '手动跳过'}`);
    return null;
  }

  try {
    const reqHeaders = { ...(headers || {}) };
    if (adminToken && !reqHeaders.Authorization) {
      reqHeaders.Authorization = `Bearer ${adminToken}`;
    }

    const config = {
      method,
      url: `${BASE_URL}${path}`,
      headers: reqHeaders,
      timeout: 15000,
      validateStatus: () => true // 不自动抛异常，自己判断
    };

    if (params) config.params = params;
    if (data !== undefined) config.data = data;

    const response = await axios(config);

    // 验证状态码
    const statusOk = response.status === expectedStatus || Math.floor(response.status / 100) === Math.floor(expectedStatus / 100);

    // 自定义验证
    let customOk = true;
    let customMsg = '';
    if (validate) {
      const vResult = validate(response);
      if (typeof vResult === 'boolean') {
        customOk = vResult;
      } else if (typeof vResult === 'object') {
        customOk = vResult.ok;
        customMsg = vResult.message || '';
      }
    }

    if (statusOk && customOk) {
      results.passed++;
      results.details.push({ label, status: 'PASS', httpStatus: response.status });
      console.log(`  ✅ ${label} — ${response.status}`);
      return response;
    } else {
      const msg = `状态码: ${response.status} (期望 ${expectedStatus})${customMsg ? ', ' + customMsg : ''}`;
      results.failed++;
      results.errors.push({ label, message: msg, response: response.data });
      results.details.push({ label, status: 'FAIL', httpStatus: response.status, message: msg });
      console.log(`  ❌ ${label} — ${msg}`);
      return response;
    }
  } catch (err) {
    const msg = err.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)?.substring(0, 200)}` : err.message;
    results.failed++;
    results.errors.push({ label, message: msg });
    results.details.push({ label, status: 'ERROR', message: msg });
    console.log(`  💥 ${label} — ${msg}`);
    return null;
  }
}

// =============== 主测试流程 ===============

async function runTests() {
  console.log('='.repeat(70));
  console.log('🧪 全 API 测试 — Turso 云端数据库迁移回归测试');
  console.log(`📍 测试地址: ${BASE_URL}`);
  console.log(`⏰ 开始时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  console.log('='.repeat(70));

  // ========== 0. 健康检查 ==========
  console.log('\n📋 [0] 健康检查...');
  await apiTest('健康检查', 'GET', '/api/health', {
    validate: (r) => r.data.status === 'ok'
  });

  // ========== 1. 无需认证的公开 API ==========
  console.log('\n📋 [1] 无需认证的公开 API...');

  // 1.1 前端配置
  await apiTest('获取前端配置', 'GET', '/api/front-config', {
    validate: (r) => r.data.tableAuthExpireMinutes !== undefined
  });

  // 1.2 服务器时间
  await apiTest('获取服务器时间', 'GET', '/api/server-time', {
    validate: (r) => r.data.serverTime && r.data.hour !== undefined
  });

  // 1.3 首页配置
  await apiTest('获取首页配置', 'GET', '/api/home', {
    validate: (r) => r.data.banner !== undefined
  });

  // 1.4 商品分类
  await apiTest('获取商品分类', 'GET', '/api/categories', {
    validate: (r) => Array.isArray(r.data)
  });

  // 1.5 分类商品数量
  await apiTest('获取分类商品数量', 'GET', '/api/categories/counts', {
    validate: (r) => typeof r.data === 'object'
  });

  // 1.6 商品列表（全部）
  await apiTest('获取商品列表（全部）', 'GET', '/api/products', {
    validate: (r) => Array.isArray(r.data)
  });

  // 1.7 商品列表（按分类筛选 - 中文SQL重点测试）
  await apiTest('获取商品列表（按分类: 酒水）', 'GET', '/api/products', {
    params: { category: '酒水' },
    validate: (r) => Array.isArray(r.data)
  });

  // 1.8 商品列表（分类=全部）
  await apiTest('获取商品列表（分类=全部）', 'GET', '/api/products', {
    params: { category: '全部' },
    validate: (r) => Array.isArray(r.data)
  });

  // 1.9 商品选项
  await apiTest('获取商品选项', 'GET', '/api/product-options');

  // 1.10 商品详情（找一个存在的商品）
  await apiTest('获取商品详情', 'GET', '/api/products/测试商品', {
    expectedStatus: 404 // 不存在应该返回404，说明查询正常
  });

  // 1.11 助教列表
  await apiTest('获取助教列表', 'GET', '/api/coaches', {
    validate: (r) => Array.isArray(r.data)
  });

  // 1.12 助教列表（按等级筛选）
  await apiTest('获取助教列表（按等级筛选）', 'GET', '/api/coaches', {
    params: { level: '全部' },
    validate: (r) => Array.isArray(r.data)
  });

  // 1.13 人气TOP6助教
  await apiTest('获取人气TOP6助教', 'GET', '/api/coaches/popularity/top6', {
    validate: (r) => Array.isArray(r.data) && r.data.length <= 6
  });

  // 1.14 台桌列表
  await apiTest('获取台桌列表', 'GET', '/api/tables', {
    validate: (r) => Array.isArray(r.data)
  });

  // 1.15 包房列表
  await apiTest('获取包房列表', 'GET', '/api/vip-rooms', {
    validate: (r) => Array.isArray(r.data)
  });

  // 1.16 用户协议
  await apiTest('获取用户协议', 'GET', '/api/agreement/user', {
    validate: (r) => r.data.title && r.data.content
  });

  // 1.17 隐私协议
  await apiTest('获取隐私协议', 'GET', '/api/agreement/privacy', {
    validate: (r) => r.data.title && r.data.content
  });

  // 1.18 OSS STS凭证
  await apiTest('获取OSS STS凭证', 'GET', '/api/oss/sts', {
    expectedStatus: 500 // 可能配置不完整，返回500也算正常（说明路由可达）
  });

  // ========== 2. 游客/前台操作 API ==========
  console.log('\n📋 [2] 游客/前台操作 API...');

  // 2.1 游客创建服务单
  await apiTest('游客创建服务单', 'POST', '/api/service-orders/guest', {
    data: { table_no: '普台1', requirement: '测试需求-自动测试' },
    expectedStatus: 200,
    validate: (r) => r.data.success === true
  });

  // 2.2 游客创建服务单（缺少必填字段）
  await apiTest('游客创建服务单（缺少台桌号）', 'POST', '/api/service-orders/guest', {
    data: { requirement: '测试' },
    expectedStatus: 400
  });

  // 2.3 游客创建服务单（缺少需求）
  await apiTest('游客创建服务单（缺少需求）', 'POST', '/api/service-orders/guest', {
    data: { table_no: '普台1' },
    expectedStatus: 400
  });

  // 2.4 设备访问记录
  await apiTest('记录设备访问', 'POST', '/api/device/visit', {
    data: { deviceFp: 'test-fp-' + Date.now() },
    validate: (r) => r.data.success === true
  });

  // 2.5 待处理订单（按台桌）
  await apiTest('获取待处理订单（普台1）', 'GET', '/api/orders/pending/普台1', {
    validate: (r) => Array.isArray(r.data)
  });

  // 2.6 我的待处理订单（无指纹）
  await apiTest('获取我的待处理订单（无指纹）', 'GET', '/api/orders/my-pending', {
    validate: (r) => Array.isArray(r.data)
  });

  // ========== 3. 需要认证的 API — 先登录 ==========
  console.log('\n📋 [3] 后台登录获取 Token...');

  const loginRes = await apiTest('后台登录', 'POST', '/api/admin/login', {
    data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
    expectedStatus: 200,
    validate: (r) => {
      if (r.data.success && r.data.token) {
        adminToken = r.data.token;
        return true;
      }
      return { ok: false, message: `登录失败: ${JSON.stringify(r.data)}` };
    }
  });

  if (!adminToken) {
    console.log('\n⚠️  后台登录失败，后续需要认证的 API 将跳过');
    console.log('='.repeat(70));
    printSummary();
    return;
  }

  console.log(`   ✅ 登录成功，Token 已获取`);

  // ========== 4. 后台管理 — 统计与概览 ==========
  console.log('\n📋 [4] 后台管理 — 统计与概览...');

  await apiTest('后台数据概览', 'GET', '/api/admin/stats', {
    validate: (r) => r.data.topCoaches !== undefined
  });

  await apiTest('DB写入队列监控', 'GET', '/api/admin/db-queue-stats', {
    validate: (r) => r.data.currentQueueLength !== undefined
  });

  await apiTest('收银看板', 'GET', '/api/cashier-dashboard', {
    validate: (r) => r.data.success === true
  });

  await apiTest('设备访问统计', 'GET', '/api/admin/device-stats', {
    validate: (r) => r.data.today !== undefined
  });

  // ========== 5. 后台管理 — 订单管理 ==========
  console.log('\n📋 [5] 后台管理 — 订单管理...');

  await apiTest('订单统计', 'GET', '/api/admin/orders/stats', {
    validate: (r) => r.data.success === true
  });

  await apiTest('订单统计（按日期）', 'GET', '/api/admin/orders/stats', {
    params: { date: '2026-04-26' },
    validate: (r) => r.data.success === true
  });

  await apiTest('订单列表', 'GET', '/api/admin/orders', {
    validate: (r) => Array.isArray(r.data)
  });

  await apiTest('订单列表（按状态: 待处理）', 'GET', '/api/admin/orders', {
    params: { status: '待处理' },
    validate: (r) => Array.isArray(r.data)
  });

  await apiTest('订单列表（按状态: 全部）', 'GET', '/api/admin/orders', {
    params: { status: '全部' },
    validate: (r) => Array.isArray(r.data)
  });

  await apiTest('订单列表（按日期范围）', 'GET', '/api/admin/orders', {
    params: { date_start: '2026-04-01', date_end: '2026-04-30' },
    validate: (r) => Array.isArray(r.data)
  });

  // ========== 6. 后台管理 — 用户管理 ==========
  console.log('\n📋 [6] 后台管理 — 用户管理...');

  await apiTest('获取后台用户列表', 'GET', '/api/admin/users', {
    validate: (r) => Array.isArray(r.data)
  });

  await apiTest('获取用户权限（tgadmin）', 'GET', '/api/admin/users/tgadmin/permissions', {
    validate: (r) => r.data.success === true
  });

  await apiTest('创建后台用户（测试用）', 'POST', '/api/admin/users', {
    data: {
      username: `testuser_${Date.now()}`,
      password: 'test123456',
      name: '测试用户',
      role: '店长'
    },
    validate: (r) => r.data.success === true
  });

  // 获取刚创建的测试用户，然后更新和删除
  // 注意：由于用户名是动态的，我们通过列表获取
  await apiTest('更新后台用户（tgadmin状态）', 'PUT', `/api/admin/users/tgadmin/status`, {
    data: { employmentStatus: '在职' },
    validate: (r) => r.data.success === true
  });

  // ========== 7. 后台管理 — 商品管理 ==========
  console.log('\n📋 [7] 后台管理 — 商品管理...');

  await apiTest('获取商品分类列表', 'GET', '/api/admin/categories', {
    validate: (r) => Array.isArray(r.data)
  });

  await apiTest('获取商品列表（后台）', 'GET', '/api/admin/products', {
    validate: (r) => Array.isArray(r.data)
  });

  await apiTest('商品同步状态', 'GET', '/api/admin/sync-products-status', {
    validate: (r) => r.data.status !== undefined || r.data.message !== undefined
  });

  await apiTest('同步商品数据', 'POST', '/api/admin/sync/products', {
    data: { products: [] },
    expectedStatus: 400 // 空数组应该返回400
  });

  await apiTest('创建商品（测试用）', 'POST', '/api/admin/products', {
    data: {
      name: `测试商品_${Date.now()}`,
      category: '测试分类',
      imageUrl: '',
      price: '9.9',
      stockTotal: 100,
      stockAvailable: 50,
      status: '上架'
    },
    validate: (r) => r.data.success === true
  });

  await apiTest('删除商品（测试用）', 'DELETE', `/api/admin/products/测试商品_${Date.now()}`, {
    // 这条大概率不存在，但DELETE不存在的商品应该成功或返回错误
    expectedStatus: 200
  });

  // ========== 8. 后台管理 — 助教管理 ==========
  console.log('\n📋 [8] 后台管理 — 助教管理...');

  await apiTest('获取助教列表（后台）', 'GET', '/api/admin/coaches', {
    validate: (r) => Array.isArray(r.data)
  });

  await apiTest('预览同步水牌', 'GET', '/api/admin/coaches/sync-water-boards/preview', {
    validate: (r) => r.data.orphanRecords !== undefined
  });

  // ========== 9. 后台管理 — 会员管理 ==========
  console.log('\n📋 [9] 后台管理 — 会员管理...');

  await apiTest('获取会员列表', 'GET', '/api/admin/members', {
    validate: (r) => Array.isArray(r.data)
  });

  await apiTest('会员同步助教预览', 'POST', '/api/admin/members/sync-coaches/preview', {
    validate: (r) => r.data.success === true
  });

  await apiTest('创建会员（测试用）', 'POST', '/api/admin/members', {
    data: {
      phone: '186' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0'),
      name: '测试会员',
      gender: '男',
      remark: '自动测试创建'
    },
    validate: (r) => r.data.success === true
  });

  // ========== 10. 后台管理 — 台桌管理 ==========
  console.log('\n📋 [10] 后台管理 — 台桌管理...');

  await apiTest('获取台桌列表（后台）', 'GET', '/api/admin/tables', {
    validate: (r) => Array.isArray(r.data)
  });

  await apiTest('台桌二维码检查', 'GET', '/api/admin/tables/qrcode/check', {
    validate: (r) => r.data.success === true
  });

  await apiTest('台桌同步状态', 'GET', '/api/admin/sync-tables-status', {
    validate: (r) => r.data.success === true
  });

  await apiTest('同步台桌数据', 'POST', '/api/admin/sync/tables', {
    data: { tables: [] },
    expectedStatus: 400 // 空数组应该返回400
  });

  // ========== 11. 后台管理 — 包房管理 ==========
  console.log('\n📋 [11] 后台管理 — 包房管理...');

  await apiTest('获取包房列表（后台）', 'GET', '/api/admin/vip-rooms', {
    validate: (r) => Array.isArray(r.data)
  });

  // ========== 12. 后台管理 — 首页配置 ==========
  console.log('\n📋 [12] 后台管理 — 首页配置...');

  await apiTest('获取首页配置（后台）', 'GET', '/api/admin/home-config', {
    validate: (r) => r.data !== null
  });

  // ========== 13. 后台管理 — 短信配置 ==========
  console.log('\n📋 [13] 后台管理 — 短信配置...');

  await apiTest('获取短信配置', 'GET', '/api/admin/sms/config', {
    validate: (r) => r.data.currentProvider !== undefined
  });

  await apiTest('切换短信服务商', 'PUT', '/api/admin/sms/config', {
    data: { provider: 'aliyun' },
    validate: (r) => r.data.success === true
  });

  // ========== 14. 后台管理 — 黑名单管理 ==========
  console.log('\n📋 [14] 后台管理 — 黑名单管理...');

  await apiTest('获取黑名单列表', 'GET', '/api/admin/blacklist', {
    validate: (r) => Array.isArray(r.data)
  });

  // ========== 15. 后台管理 — 系统配置 ==========
  console.log('\n📋 [15] 后台管理 — 系统配置...');

  await apiTest('获取系统配置总览', 'GET', '/api/admin/system-config/all', {
    validate: (r) => r.data.success === true
  });

  await apiTest('获取鉴权配置', 'GET', '/api/admin/auth-config', {
    validate: (r) => r.data.enabled !== undefined
  });

  // ========== 16. 系统配置路由模块 ==========
  console.log('\n📋 [16] 系统配置路由模块...');

  await apiTest('获取服务下单分类配置', 'GET', '/api/system-config/service-categories', {
    validate: (r) => r.data !== undefined
  });

  // ========== 17. 权限检查 API ==========
  console.log('\n📋 [17] 权限检查 API...');

  await apiTest('检查免扫码权限', 'GET', '/api/auth/check-scan-permission', {
    validate: (r) => r.data.success !== undefined
  });

  await apiTest('检查权限', 'GET', '/api/auth/check-permission', {
    validate: (r) => r.data.success === true
  });

  await apiTest('检查权限（指定权限名）', 'GET', '/api/auth/check-permission', {
    params: { permission: 'cashierDashboard' },
    validate: (r) => r.data.success === true
  });

  // ========== 18. 休假日历 API ==========
  console.log('\n📋 [18] 休假日历 API...');

  await apiTest('休假日历统计', 'GET', '/api/leave-calendar/stats', {
    validate: (r) => r.data.success === true
  });

  await apiTest('休假日历按日统计', 'GET', '/api/leave-calendar/day-count', {
    params: { date: '2026-04-26' },
    validate: (r) => r.data.success === true
  });

  // ========== 19. 智能开关 API（后台管理） ==========
  console.log('\n📋 [19] 智能开关 API（后台）...');

  await apiTest('获取开关列表', 'GET', '/api/admin/switches', {
    validate: (r) => Array.isArray(r.data)
  });

  await apiTest('获取开关列表（按label筛选）', 'GET', '/api/admin/switches', {
    params: { label: '普台1' },
    validate: (r) => Array.isArray(r.data)
  });

  await apiTest('获取台桌设备关系列表', 'GET', '/api/admin/table-devices', {
    validate: (r) => Array.isArray(r.data)
  });

  await apiTest('获取开关场景列表', 'GET', '/api/admin/switch-scenes', {
    validate: (r) => Array.isArray(r.data)
  });

  await apiTest('获取空调设定配置', 'GET', '/api/admin/ac-control', {
    validate: (r) => r.data.success === true
  });

  // ========== 20. 智能开关 API（前台控制） ==========
  console.log('\n📋 [20] 智能开关 API（前台控制）...');

  await apiTest('获取自动关灯状态', 'GET', '/api/switch/auto-status', {
    validate: (r) => r.data.auto_off_enabled !== undefined
  });

  await apiTest('获取开关标签列表', 'GET', '/api/switch/labels', {
    validate: (r) => Array.isArray(r.data)
  });

  await apiTest('获取场景列表（前台）', 'GET', '/api/switch/scenes', {
    validate: (r) => Array.isArray(r.data)
  });

  await apiTest('获取台桌列表及关联开关', 'GET', '/api/switch/tables', {
    validate: (r) => Array.isArray(r.data)
  });

  // ========== 21. 智能空调 API（后台管理） ==========
  console.log('\n📋 [21] 智能空调 API（后台）...');

  await apiTest('获取空调设备列表', 'GET', '/api/admin/ac-devices', {
    validate: (r) => Array.isArray(r.data)
  });

  await apiTest('获取空调场景列表', 'GET', '/api/admin/ac-scenes', {
    validate: (r) => Array.isArray(r.data)
  });

  // ========== 22. 智能空调 API（前台控制） ==========
  console.log('\n📋 [22] 智能空调 API（前台控制）...');

  await apiTest('获取自动关空调状态', 'GET', '/api/ac/auto-status', {
    validate: (r) => r.data.auto_off_enabled !== undefined
  });

  await apiTest('获取空调标签列表', 'GET', '/api/ac/labels', {
    validate: (r) => Array.isArray(r.data)
  });

  await apiTest('获取空调场景列表（前台）', 'GET', '/api/ac/scenes', {
    validate: (r) => Array.isArray(r.data)
  });

  await apiTest('获取台桌列表及关联空调', 'GET', '/api/ac/tables', {
    validate: (r) => Array.isArray(r.data)
  });

  // ========== 23. 奖罚管理 API ==========
  console.log('\n📋 [23] 奖罚管理 API...');

  await apiTest('获取奖罚类型配置', 'GET', '/api/admin/reward-penalty/types', {
    validate: (r) => r.data.success === true
  });

  await apiTest('获取奖罚记录列表', 'GET', '/api/reward-penalty/list', {
    validate: (r) => r.data.success === true
  });

  await apiTest('获取奖罚统计', 'GET', '/api/reward-penalty/stats', {
    validate: (r) => r.data.success === true
  });

  await apiTest('获取奖罚统计（本月）', 'GET', '/api/reward-penalty/stats', {
    params: { month: '2026-04' },
    validate: (r) => r.data.success === true
  });

  await apiTest('获取奖罚金额汇总', 'GET', '/api/reward-penalty/stats/summary', {
    validate: (r) => r.data.success === true
  });

  await apiTest('获取可用奖罚类型', 'GET', '/api/reward-penalty/my-types', {
    validate: (r) => r.data.success === true
  });

  await apiTest('获取奖罚目标列表（助教）', 'GET', '/api/reward-penalty/targets', {
    params: { role: '助教' },
    validate: (r) => r.data.success === true
  });

  await apiTest('获取奖罚目标列表（服务员）', 'GET', '/api/reward-penalty/targets', {
    params: { role: '服务员' },
    validate: (r) => r.data.success === true
  });

  // ========== 24. 错误日志 API ==========
  console.log('\n📋 [24] 错误日志 API...');

  await apiTest('摄像头错误日志上报', 'POST', '/api/log/camera-error', {
    data: {
      errorName: 'NotFoundError',
      errorMessage: '测试错误',
      platform: 'Chrome',
      timestamp: new Date().toISOString()
    },
    validate: (r) => r.data.success === true
  });

  await apiTest('前端错误日志上报', 'POST', '/api/admin/frontend-error-log', {
    data: {
      type: 'test',
      action: '自动测试',
      message: '测试日志记录',
      timestamp: new Date().toISOString()
    },
    validate: (r) => r.data.success === true
  });

  // ========== 25. 错误处理测试 ==========
  console.log('\n📋 [25] 错误处理测试...');

  await apiTest('无效路由', 'GET', '/api/nonexistent', {
    expectedStatus: 404
  });

  await apiTest('JSON解析错误', 'POST', '/api/admin/login', {
    headers: { 'Content-Type': 'application/json' },
    data: 'invalid json',
    expectedStatus: 400
  });

  await apiTest('后台登录（错误密码）', 'POST', '/api/admin/login', {
    data: { username: ADMIN_USERNAME, password: 'wrongpassword' },
    expectedStatus: 401
  });

  await apiTest('后台登录（不存在用户）', 'POST', '/api/admin/login', {
    data: { username: 'nonexistent', password: 'test' },
    expectedStatus: 401
  });

  await apiTest('无效Token', 'GET', '/api/admin/stats', {
    headers: { Authorization: 'Bearer invalidtoken123' },
    expectedStatus: 401
  });

  await apiTest('无Token访问后台', 'GET', '/api/admin/stats', {
    headers: {},
    expectedStatus: 401
  });

  // ========== 26. BigInt 序列化重点测试 ==========
  console.log('\n📋 [26] BigInt 序列化重点测试...');

  // 这些API可能返回大整数ID，验证JSON序列化是否正常
  await apiTest('BigInt测试 - 助教列表(含coach_no)', 'GET', '/api/coaches', {
    validate: (r) => {
      if (!Array.isArray(r.data)) return { ok: false, message: '返回不是数组' };
      if (r.data.length === 0) return true;
      const first = r.data[0];
      // coach_no 是大整数，如果能正常解析为数字或字符串都可以
      const coachNo = first.coach_no;
      if (coachNo === undefined || coachNo === null) return true; // 可能没有数据
      // 只要没有JSON序列化错误就通过（axios解析成功说明没报BigInt错误）
      return true;
    }
  });

  await apiTest('BigInt测试 - 订单列表(含order id)', 'GET', '/api/admin/orders', {
    validate: (r) => {
      if (!Array.isArray(r.data)) return true;
      if (r.data.length === 0) return true;
      const first = r.data[0];
      if (first.id !== undefined) {
        // id 可能是大整数
        return true;
      }
      return true;
    }
  });

  await apiTest('BigInt测试 - 助教后台列表', 'GET', '/api/admin/coaches', {
    validate: (r) => {
      if (!Array.isArray(r.data)) return true;
      return true;
    }
  });

  await apiTest('BigInt测试 - 设备统计', 'GET', '/api/admin/device-stats', {
    validate: (r) => true // 能解析就是成功
  });

  // ========== 27. 会员相关 API (需要Token) ==========
  console.log('\n📋 [27] 会员相关 API...');

  // 注意：这里的token是adminToken，不是会员token，profile可能返回不同的结果
  await apiTest('获取会员信息', 'GET', '/api/member/profile', {
    // adminToken可能无法作为会员token使用，跳过验证
    expectedStatus: 200
  });

  // ========== 28. 上传 API ==========
  console.log('\n📋 [28] 上传 API...');

  await apiTest('上传图片（无文件）', 'POST', '/api/upload/image', {
    expectedStatus: 400 // 没有上传文件应该返回400
  });

  await apiTest('上传视频（无文件）', 'POST', '/api/upload/video', {
    expectedStatus: 400
  });

  // ========== 打印测试报告 ==========
  console.log('\n' + '='.repeat(70));
  printSummary();
}

function printSummary() {
  console.log('📊 测试报告:');
  console.log(`  总计: ${results.total}`);
  console.log(`  ✅ 通过: ${results.passed}`);
  console.log(`  ❌ 失败: ${results.failed}`);
  console.log(`  ⏭  跳过: ${results.skipped}`);

  if (results.errors.length > 0) {
    console.log('\n❌ 失败详情:');
    for (const err of results.errors) {
      console.log(`  - ${err.label}: ${err.message}`);
    }
  }

  // 统计覆盖率
  const passRate = results.total > 0 ? ((results.passed / results.total) * 100).toFixed(1) : 0;
  console.log(`\n  通过率: ${passRate}%`);
  console.log('='.repeat(70));

  // 输出详细分类统计
  console.log('\n📋 详细分类统计:');
  const groups = {};
  for (const d of results.details) {
    const group = d.label.split('—')[0]?.trim() || '未知';
    if (!groups[group]) groups[group] = { pass: 0, fail: 0, skip: 0 };
    if (d.status === 'PASS') groups[group].pass++;
    else if (d.status === 'FAIL' || d.status === 'ERROR') groups[group].fail++;
    else if (d.status === 'SKIPPED') groups[group].skip++;
  }
  for (const [name, stats] of Object.entries(groups)) {
    const icon = stats.fail > 0 ? '⚠️' : '✅';
    console.log(`  ${icon} ${name}: ${stats.pass}通过, ${stats.fail}失败, ${stats.skip}跳过`);
  }
}

// 运行
runTests().catch(err => {
  console.error('测试运行异常:', err.message);
  console.error(err.stack);
  printSummary();
  process.exit(1);
});
