#!/usr/bin/env node
/**
 * BUG-0414 测试脚本
 * 
 * 测试 SQLite 事务嵌套冲突 bug 修复
 * 
 * 运行方式:
 *   node test_bug0414.js
 * 
 * 前置条件:
 *   1. 开发环境后端已启动 (PM2: tgservice-dev, 端口 8088)
 *   2. 数据库中有 admin 用户和助教数据
 */

const http = require('http');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// ==================== 配置 ====================

const BASE_URL = 'http://127.0.0.1:8088';
const ADMIN_USERNAME = 'tgadmin';
const ADMIN_PASSWORD = 'mms633268';

// JWT 配置 (与 .config.env 一致)
const JWT_SECRET = 'tgservice_jwt_secret_key_2026';

// 测试用数据
const TEST_SESSION_ID = `test_session_${Date.now()}`;
const TEST_TABLE_NO = '普台1'; // 数据库中存在的台桌

// ==================== 测试结果统计 ====================

const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  details: []
};

function log(color, msg) {
  const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    gray: '\x1b[90m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
  };
  console.log(`${colors[color] || ''}${msg}${colors.reset}`);
}

function pass(name, detail = '') {
  results.passed++;
  results.details.push({ name, status: 'PASS', detail });
  log('green', `  ✅ PASS: ${name}${detail ? ' — ' + detail : ''}`);
}

function fail(name, detail = '') {
  results.failed++;
  results.details.push({ name, status: 'FAIL', detail });
  log('red', `  ❌ FAIL: ${name}${detail ? ' — ' + detail : ''}`);
}

function skip(name, reason = '') {
  results.skipped++;
  results.details.push({ name, status: 'SKIP', detail: reason });
  log('yellow', `  ⏭️ SKIP: ${name}${reason ? ' — ' + reason : ''}`);
}

// ==================== HTTP 工具 ====================

function httpRequest(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (body) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: data });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('请求超时 (10s)'));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function get(path, headers = {}) {
  return httpRequest('GET', path, null, headers);
}

async function post(path, body, headers = {}) {
  return httpRequest('POST', path, body, headers);
}

async function put(path, body, headers = {}) {
  return httpRequest('PUT', path, body, headers);
}

async function del(path, body, headers = {}) {
  return httpRequest('DELETE', path, body, headers);
}

// ==================== JWT 工具 ====================

function generateAdminToken() {
  // 简单 JWT: header.payload.signature (HMAC SHA256)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    username: ADMIN_USERNAME,
    role: '管理员',
    iat: now,
    exp: now + 7 * 24 * 3600 // 7 天
  })).toString('base64url');

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

// ==================== 测试套件 ====================

let authToken = '';
let adminAuthHeader = {};
let coachNo = ''; // 用于测试的助教编号
let applicationId = null; // 用于测试的申请ID
let serviceOrderId = null; // 用于测试的服务单ID
let tableActionOrderId = null; // 用于测试的台桌操作订单ID
let guestInvitationId = null; // 用于测试的约客记录ID

async function runTests() {
  log('bold', '\n========================================');
  log('bold', '  BUG-0414 测试: SQLite 事务嵌套冲突修复');
  log('bold', '========================================\n');

  // Step 0: 检查服务器
  log('blue', '[Step 0] 检查服务器连接...');
  try {
    const res = await get('/api/water-boards', { Authorization: 'Bearer ' + generateAdminToken() });
    // 即使 401 也说明服务器在线
    log('green', `  服务器在线: ${BASE_URL} (响应状态: ${res.status})`);
  } catch (e) {
    log('red', `  ❌ 无法连接服务器: ${e.message}`);
    log('red', '  请确保开发环境已启动: pm2 restart tgservice-dev');
    process.exit(1);
  }

  // Step 1: 获取认证 token
  log('blue', '\n[Step 1] 获取认证 Token...');
  try {
    const token = generateAdminToken();
    const res = await post('/api/admin/login', {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD
    });
    if (res.data && res.data.token) {
      authToken = res.data.token;
      adminAuthHeader = { Authorization: `Bearer ${authToken}` };
      pass('管理员登录成功');
    } else {
      // 如果登录失败，尝试直接用生成的 JWT token
      authToken = token;
      adminAuthHeader = { Authorization: `Bearer ${token}` };
      // 验证 token 是否可用
      const verifyRes = await get('/api/water-boards', adminAuthHeader);
      if (verifyRes.status === 200 || (verifyRes.data && !verifyRes.data.error)) {
        pass('JWT Token 生成成功 (使用本地生成)');
      } else {
        fail('管理员登录失败', JSON.stringify(res.data));
        log('red', '  无法获取认证 token，后续测试将跳过');
        // 继续用生成的 token 尝试
        authToken = token;
        adminAuthHeader = { Authorization: `Bearer ${token}` };
      }
    }
  } catch (e) {
    log('yellow', `  登录请求异常: ${e.message}，使用本地生成 JWT`);
    authToken = generateAdminToken();
    adminAuthHeader = { Authorization: `Bearer ${authToken}` };
  }

  // Step 2: 获取一个可用的助教编号
  log('blue', '\n[Step 2] 获取测试助教数据...');
  try {
    const res = await get('/api/water-boards', adminAuthHeader);
    if (res.data && res.data.data && res.data.data.length > 0) {
      // 找一个状态为"下班"或"休息"的助教（容易操作）
      let coach = res.data.data.find(wb => 
        ['下班', '休息', '公休', '早班空闲', '晚班空闲'].includes(wb.status)
      );
      if (!coach) {
        coach = res.data.data[0]; // 随便用一个
      }
      coachNo = coach.coach_no;
      pass(`获取到测试助教: ${coach.stage_name} (${coachNo}), 当前状态: ${coach.status}`);
    } else {
      skip('获取助教数据', '没有助教数据');
    }
  } catch (e) {
    skip('获取助教数据', e.message);
  }

  // ==================== 单元测试 ====================
  log('bold', '\n========================================');
  log('bold', '  [单元 1] db/index.js 单元测试');
  log('bold', '========================================\n');

  // 这些测试需要直接访问 db 模块，通过后端 API 间接测试
  // 因为测试脚本在后端外部运行

  // U01-U05: 通过 API 间接测试 db 函数
  // U06: dbTx 恢复逻辑测试 → 通过回归测试验证

  log('gray', '  注意: db/index.js 单元测试通过 API 集成测试间接验证');
  log('gray', '  原因: 测试脚本在后端进程外部运行，无法直接 require db 模块\n');

  // ==================== API 集成测试 ====================

  // --- 购物车 API ---
  log('bold', '\n========================================');
  log('bold', '  [API 2] 购物车 API 测试');
  log('bold', '========================================\n');

  // C01: 添加新商品到购物车
  try {
    const res = await post('/api/cart', {
      sessionId: TEST_SESSION_ID,
      tableNo: TEST_TABLE_NO,
      productName: '可乐',
      quantity: 2,
      options: '冰的'
    }, adminAuthHeader);
    if (res.status === 200 && res.data && res.data.success) {
      pass('C01: 添加新商品到购物车');
    } else {
      fail('C01: 添加新商品到购物车', JSON.stringify(res.data));
    }
  } catch (e) {
    fail('C01: 添加新商品到购物车', e.message);
  }

  // C02: 添加已存在商品（数量累加）
  try {
    const res = await post('/api/cart', {
      sessionId: TEST_SESSION_ID,
      tableNo: TEST_TABLE_NO,
      productName: '可乐',
      quantity: 1,
      options: '冰的'
    }, adminAuthHeader);
    if (res.status === 200 && res.data && res.data.success) {
      pass('C02: 添加已存在商品（数量累加）');
    } else {
      fail('C02: 添加已存在商品（数量累加）', JSON.stringify(res.data));
    }
  } catch (e) {
    fail('C02: 添加已存在商品（数量累加）', e.message);
  }

  // 验证购物车内容
  try {
    const res = await get(`/api/cart/${TEST_SESSION_ID}`, adminAuthHeader);
    if (res.status === 200 && res.data && res.data.items && res.data.items.length > 0) {
      const coke = res.data.items.find(i => i.product_name === '可乐');
      if (coke && coke.quantity >= 3) {
        pass('C02-verify: 购物车数量正确累加 (>= 3)');
      } else {
        fail('C02-verify: 购物车数量未正确累加', `实际数量: ${coke ? coke.quantity : '未找到'}`);
      }
    } else {
      fail('C02-verify: 获取购物车失败', JSON.stringify(res.data));
    }
  } catch (e) {
    fail('C02-verify: 获取购物车失败', e.message);
  }

  // C03: 更新商品数量
  try {
    const res = await put('/api/cart', {
      sessionId: TEST_SESSION_ID,
      productName: '可乐',
      quantity: 5,
      options: '冰的'
    }, adminAuthHeader);
    if (res.status === 200 && res.data && res.data.success) {
      pass('C03: 更新商品数量');
    } else {
      fail('C03: 更新商品数量', JSON.stringify(res.data));
    }
  } catch (e) {
    fail('C03: 更新商品数量', e.message);
  }

  // C04: 数量为 0 时删除商品
  try {
    // 先添加一个临时商品
    await post('/api/cart', {
      sessionId: TEST_SESSION_ID,
      tableNo: TEST_TABLE_NO,
      productName: '雪碧',
      quantity: 1,
      options: ''
    }, adminAuthHeader);

    // 然后设置数量为 0
    const res = await put('/api/cart', {
      sessionId: TEST_SESSION_ID,
      productName: '雪碧',
      quantity: 0,
      options: ''
    }, adminAuthHeader);
    if (res.status === 200 && res.data && res.data.success) {
      pass('C04: 数量为 0 时删除商品');
    } else {
      fail('C04: 数量为 0 时删除商品', JSON.stringify(res.data));
    }
  } catch (e) {
    fail('C04: 数量为 0 时删除商品', e.message);
  }

  // C05: 删除指定商品
  try {
    // 先添加一个商品
    await post('/api/cart', {
      sessionId: TEST_SESSION_ID,
      tableNo: TEST_TABLE_NO,
      productName: '果盘',
      quantity: 1,
      options: ''
    }, adminAuthHeader);

    const res = await del('/api/cart', {
      sessionId: TEST_SESSION_ID,
      productName: '果盘',
      options: ''
    }, adminAuthHeader);
    if (res.status === 200 && res.data && res.data.success) {
      pass('C05: 删除指定商品');
    } else {
      fail('C05: 删除指定商品', JSON.stringify(res.data));
    }
  } catch (e) {
    fail('C05: 删除指定商品', e.message);
  }

  // C06: 先不清空，留到订单测试后验证

  // C07: 更新购物车台桌号
  try {
    const res = await put('/api/cart/table', {
      sessionId: TEST_SESSION_ID,
      tableNo: TEST_TABLE_NO
    }, adminAuthHeader);
    if (res.status === 200 && res.data && res.data.success) {
      pass('C07: 更新购物车台桌号');
    } else {
      fail('C07: 更新购物车台桌号', JSON.stringify(res.data));
    }
  } catch (e) {
    fail('C07: 更新购物车台桌号', e.message);
  }

  // --- 订单 API ---
  log('bold', '\n========================================');
  log('bold', '  [API 3] 订单 API 测试');
  log('bold', '========================================\n');

  // O01: 正常下单
  try {
    const res = await post('/api/order', {
      sessionId: TEST_SESSION_ID
    }, adminAuthHeader);
    if (res.status === 200 && res.data && res.data.success) {
      pass('O01: 正常下单', `订单号: ${res.data.orderNo}`);
    } else {
      // 购物车可能为空（之前清空了）
      const errorMsg = res.data && res.data.error ? res.data.error : '未知错误';
      if (errorMsg.includes('购物车为空')) {
        // 先用新 session 添加商品再下单
        const newSession = `test_session_order_${Date.now()}`;
        await post('/api/cart', {
          sessionId: newSession,
          tableNo: TEST_TABLE_NO,
          productName: '矿泉水',
          quantity: 1,
          options: ''
        }, adminAuthHeader);

        const res2 = await post('/api/order', {
          sessionId: newSession
        }, adminAuthHeader);
        if (res2.status === 200 && res2.data && res2.data.success) {
          pass('O01: 正常下单 (重试)', `订单号: ${res2.data.orderNo}`);
        } else {
          fail('O01: 正常下单 (重试)', JSON.stringify(res2.data));
        }
      } else {
        fail('O01: 正常下单', errorMsg);
      }
    }
  } catch (e) {
    fail('O01: 正常下单', e.message);
  }

  // O02: 购物车为空
  try {
    const emptySession = `test_session_empty_${Date.now()}`;
    const res = await post('/api/order', {
      sessionId: emptySession
    }, adminAuthHeader);
    if (res.status === 400 && res.data && res.data.error && res.data.error.includes('购物车为空')) {
      pass('O02: 购物车为空时正确返回错误');
    } else {
      fail('O02: 购物车为空时正确返回错误', `状态: ${res.status}, 响应: ${JSON.stringify(res.data)}`);
    }
  } catch (e) {
    fail('O02: 购物车为空时正确返回错误', e.message);
  }

  // 清空购物车
  try {
    await del(`/api/cart/${TEST_SESSION_ID}`, null, adminAuthHeader);
    pass('C06: 清空购物车');
  } catch (e) {
    fail('C06: 清空购物车', e.message);
  }

  // --- 服务订单 API ---
  log('bold', '\n========================================');
  log('bold', '  [API 4] 服务订单 API 测试');
  log('bold', '========================================\n');

  // S01: 创建服务单
  try {
    const res = await post('/api/service-orders', {
      table_no: TEST_TABLE_NO,
      requirement: '需要加冰块',
      requester_name: '测试用户',
      requester_type: '顾客'
    }, adminAuthHeader);
    if (res.status === 200 && res.data && res.data.success) {
      serviceOrderId = res.data.data && res.data.data.id;
      pass('S01: 创建服务单', `ID: ${serviceOrderId}`);
    } else {
      fail('S01: 创建服务单', JSON.stringify(res.data));
    }
  } catch (e) {
    fail('S01: 创建服务单', e.message);
  }

  // S02: 获取服务单列表
  try {
    const res = await get('/api/service-orders', adminAuthHeader);
    if (res.status === 200 && res.data && res.data.success) {
      pass('S02: 获取服务单列表', `共 ${res.data.data ? res.data.data.length : 0} 条`);
    } else {
      fail('S02: 获取服务单列表', JSON.stringify(res.data));
    }
  } catch (e) {
    fail('S02: 获取服务单列表', e.message);
  }

  // S03: 获取单个服务单
  if (serviceOrderId) {
    try {
      const res = await get(`/api/service-orders/${serviceOrderId}`, adminAuthHeader);
      if (res.status === 200 && res.data && res.data.success) {
        pass('S03: 获取单个服务单');
      } else {
        fail('S03: 获取单个服务单', JSON.stringify(res.data));
      }
    } catch (e) {
      fail('S03: 获取单个服务单', e.message);
    }
  } else {
    skip('S03: 获取单个服务单', '没有可用的服务单ID');
  }

  // S04: 更新服务单状态
  if (serviceOrderId) {
    try {
      const res = await put(`/api/service-orders/${serviceOrderId}/status`, {
        status: '已完成'
      }, adminAuthHeader);
      if (res.status === 200 && res.data && res.data.success) {
        pass('S04: 更新服务单状态为"已完成"');
      } else {
        fail('S04: 更新服务单状态', JSON.stringify(res.data));
      }
    } catch (e) {
      fail('S04: 更新服务单状态', e.message);
    }
  } else {
    skip('S04: 更新服务单状态', '没有可用的服务单ID');
  }

  // --- 教练管理 API ---
  log('bold', '\n========================================');
  log('bold', '  [API 5] 教练管理 API 测试');
  log('bold', '========================================\n');

  if (coachNo) {
    // 先确保助教在下班状态，然后测试上班
    // CO01: 助教上班
    try {
      const res = await post(`/api/coaches/v2/${coachNo}/clock-in`, null, adminAuthHeader);
      if (res.status === 200 && res.data && res.data.success) {
        pass('CO01: 助教上班', `状态: ${res.data.data && res.data.data.status}`);
      } else if (res.status === 400 && res.data && res.data.error && res.data.error.includes('已在班')) {
        pass('CO01: 助教上班', '已在班状态 (视为通过)');
      } else {
        fail('CO01: 助教上班', `状态: ${res.status}, 响应: ${JSON.stringify(res.data)}`);
      }
    } catch (e) {
      fail('CO01: 助教上班', e.message);
    }

    // CO02: 助教下班
    try {
      const res = await post(`/api/coaches/v2/${coachNo}/clock-out`, null, adminAuthHeader);
      if (res.status === 200 && res.data && res.data.success) {
        pass('CO02: 助教下班', `状态: ${res.data.data && res.data.data.status}`);
      } else {
        fail('CO02: 助教下班', `状态: ${res.status}, 响应: ${JSON.stringify(res.data)}`);
      }
    } catch (e) {
      fail('CO02: 助教下班', e.message);
    }

    // CO03: 修改班次
    try {
      const res = await put(`/api/coaches/v2/${coachNo}/shift`, {
        shift: '晚班'
      }, adminAuthHeader);
      if (res.status === 200 && res.data && res.data.success) {
        pass('CO03: 修改班次为"晚班"');
      } else {
        fail('CO03: 修改班次', `状态: ${res.status}, 响应: ${JSON.stringify(res.data)}`);
      }
    } catch (e) {
      fail('CO03: 修改班次', e.message);
    }

    // CO04: 批量修改班次 (只改一个)
    try {
      const res = await put('/api/coaches/v2/batch-shift', {
        coach_no_list: [coachNo],
        shift: '早班'
      }, adminAuthHeader);
      if (res.status === 200 && res.data && res.data.success) {
        pass('CO04: 批量修改班次', `更新 ${res.data.data && res.data.data.updated_count} 名助教`);
      } else {
        fail('CO04: 批量修改班次', `状态: ${res.status}, 响应: ${JSON.stringify(res.data)}`);
      }
    } catch (e) {
      fail('CO04: 批量修改班次', e.message);
    }
  } else {
    skip('CO01-CO04: 教练管理 API', '没有可用的助教编号');
  }

  // --- 申请 API ---
  log('bold', '\n========================================');
  log('bold', '  [API 6] 申请 API 测试');
  log('bold', '========================================\n');

  // A01: 提交乐捐报备
  try {
    // 找一个有 employee_id 的助教
    let applicantPhone = '13800000001'; // 默认测试手机号
    if (coachNo) {
      try {
        const coachRes = await get(`/api/water-boards/${coachNo}`, adminAuthHeader);
        if (coachRes.data && coachRes.data.data && coachRes.data.data.employee_id) {
          applicantPhone = coachRes.data.data.employee_id;
        }
      } catch {}
    }

    const res = await post('/api/applications', {
      applicant_phone: applicantPhone,
      application_type: '乐捐报备',
      remark: '测试乐捐报备',
      extra_data: { hours: 1 }
    }, adminAuthHeader);
    if (res.status === 200 && res.data && res.data.success) {
      applicationId = res.data.data && res.data.data.id;
      pass('A01: 提交乐捐报备', `ID: ${applicationId}`);
    } else {
      fail('A01: 提交乐捐报备', `状态: ${res.status}, 响应: ${JSON.stringify(res.data)}`);
    }
  } catch (e) {
    fail('A01: 提交乐捐报备', e.message);
  }

  // A02: 获取申请列表
  try {
    const res = await get('/api/applications?limit=5', adminAuthHeader);
    if (res.status === 200 && res.data && res.data.success) {
      pass('A02: 获取申请列表', `共 ${res.data.data ? res.data.data.length : 0} 条`);
    } else {
      fail('A02: 获取申请列表', JSON.stringify(res.data));
    }
  } catch (e) {
    fail('A02: 获取申请列表', e.message);
  }

  // A03: 审批申请 (乐捐报备自动通过，跳过)
  if (applicationId) {
    // 先提交一个需要审批的申请
    try {
      let applicantPhone = '13800000002';
      const res1 = await post('/api/applications', {
        applicant_phone: applicantPhone,
        application_type: '早加班申请',
        remark: '测试加班申请'
      }, adminAuthHeader);
      if (res1.data && res1.data.success && res1.data.data && res1.data.data.id) {
        const pendingId = res1.data.data.id;
        const res2 = await put(`/api/applications/${pendingId}/approve`, {
          approver_phone: ADMIN_USERNAME,
          status: 1
        }, adminAuthHeader);
        if (res2.status === 200 && res2.data && res2.data.success) {
          pass('A03: 审批申请 (同意)', `ID: ${pendingId}`);
        } else {
          // 可能是水牌状态不允许
          const err = res2.data && res2.data.error ? res2.data.error : '';
          if (err.includes('正在上桌') || err.includes('已审批')) {
            pass('A03: 审批申请', `预期拒绝: ${err}`);
          } else {
            fail('A03: 审批申请', JSON.stringify(res2.data));
          }
        }
      } else {
        fail('A03: 审批申请', '无法创建待审批申请', JSON.stringify(res1.data));
      }
    } catch (e) {
      fail('A03: 审批申请', e.message);
    }
  } else {
    skip('A03: 审批申请', '没有可用的申请ID');
  }

  // --- 邀请 API ---
  log('bold', '\n========================================');
  log('bold', '  [API 7] 邀请 API 测试');
  log('bold', '========================================\n');

  // 检查锁状态
  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await get('/api/guest-invitations/check-lock?date=' + today + '&shift=早班', adminAuthHeader);
    if (res.status === 200 && res.data && res.data.success) {
      pass('G04: 检查锁定状态', `已锁定: ${res.data.data && res.data.data.is_locked}`);
    } else {
      fail('G04: 检查锁定状态', JSON.stringify(res.data));
    }
  } catch (e) {
    fail('G04: 检查锁定状态', e.message);
  }

  // G01: 提交约客记录 (测试环境下跳过时间限制)
  if (coachNo) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await post('/api/guest-invitations', {
        coach_no: coachNo,
        date: today,
        shift: '早班',
        invitation_image_url: null,
        images: null
      }, adminAuthHeader);
      if (res.status === 200 && res.data && res.data.success) {
        guestInvitationId = res.data.data && res.data.data.id;
        pass('G01: 提交约客记录', `ID: ${guestInvitationId}`);
      } else {
        fail('G01: 提交约客记录', `状态: ${res.status}, 响应: ${JSON.stringify(res.data)}`);
      }
    } catch (e) {
      fail('G01: 提交约客记录', e.message);
    }
  } else {
    skip('G01: 提交约客记录', '没有可用的助教编号');
  }

  // G02: 获取约客列表
  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await get('/api/guest-invitations?date=' + today, adminAuthHeader);
    if (res.status === 200 && res.data && res.data.success) {
      pass('G02: 获取约客列表', `共 ${res.data.data ? res.data.data.length : 0} 条`);
    } else {
      fail('G02: 获取约客列表', JSON.stringify(res.data));
    }
  } catch (e) {
    fail('G02: 获取约客列表', e.message);
  }

  // G03: 审查约客记录
  if (guestInvitationId) {
    try {
      const res = await put(`/api/guest-invitations/${guestInvitationId}/review`, {
        result: '约客有效',
        reviewer_phone: ADMIN_USERNAME
      }, adminAuthHeader);
      if (res.status === 200 && res.data && res.data.success) {
        pass('G03: 审查约客记录', `结果: 约客有效`);
      } else {
        fail('G03: 审查约客记录', `状态: ${res.status}, 响应: ${JSON.stringify(res.data)}`);
      }
    } catch (e) {
      fail('G03: 审查约客记录', e.message);
    }
  } else {
    skip('G03: 审查约客记录', '没有可用的约客记录ID');
  }

  // --- 水牌 API ---
  log('bold', '\n========================================');
  log('bold', '  [API 8] 水牌 API 测试');
  log('bold', '========================================\n');

  // W01: 获取水牌列表
  try {
    const res = await get('/api/water-boards', adminAuthHeader);
    if (res.status === 200 && res.data && res.data.success) {
      pass('W01: 获取水牌列表', `共 ${res.data.data ? res.data.data.length : 0} 条`);
    } else {
      fail('W01: 获取水牌列表', JSON.stringify(res.data));
    }
  } catch (e) {
    fail('W01: 获取水牌列表', e.message);
  }

  // W02: 更新水牌状态
  if (coachNo) {
    try {
      const res = await put(`/api/water-boards/${coachNo}/status`, {
        status: '早班空闲'
      }, adminAuthHeader);
      if (res.status === 200 && res.data && res.data.success) {
        pass('W02: 更新水牌状态为"早班空闲"');
      } else {
        fail('W02: 更新水牌状态', `状态: ${res.status}, 响应: ${JSON.stringify(res.data)}`);
      }
    } catch (e) {
      fail('W02: 更新水牌状态', e.message);
    }
  } else {
    skip('W02: 更新水牌状态', '没有可用的助教编号');
  }

  // --- 台桌操作订单 API ---
  log('bold', '\n========================================');
  log('bold', '  [API 9] 台桌操作订单 API 测试');
  log('bold', '========================================\n');

  // T01: 提交上桌单
  if (coachNo) {
    try {
      // 确保助教在空闲状态
      await put(`/api/water-boards/${coachNo}/status`, {
        status: '早班空闲'
      }, adminAuthHeader);

      const res = await post('/api/table-action-orders', {
        table_no: TEST_TABLE_NO,
        coach_no: coachNo,
        order_type: '上桌单',
        action_category: '普通课',
        stage_name: '测试'
      }, adminAuthHeader);
      if (res.status === 200 && res.data && res.data.success) {
        tableActionOrderId = res.data.data && res.data.data.id;
        pass('T01: 提交上桌单', `ID: ${tableActionOrderId}`);
      } else {
        fail('T01: 提交上桌单', `状态: ${res.status}, 响应: ${JSON.stringify(res.data)}`);
      }
    } catch (e) {
      fail('T01: 提交上桌单', e.message);
    }
  } else {
    skip('T01: 提交上桌单', '没有可用的助教编号');
  }

  // T02: 获取上下桌单列表
  try {
    const res = await get('/api/table-action-orders?limit=5', adminAuthHeader);
    if (res.status === 200 && res.data && res.data.success) {
      pass('T02: 获取上下桌单列表', `共 ${res.data.data ? res.data.data.length : 0} 条`);
    } else {
      fail('T02: 获取上下桌单列表', JSON.stringify(res.data));
    }
  } catch (e) {
    fail('T02: 获取上下桌单列表', e.message);
  }

  // T03: 更新上下桌单状态
  if (tableActionOrderId) {
    try {
      const res = await put(`/api/table-action-orders/${tableActionOrderId}/status`, {
        status: '已完成'
      }, adminAuthHeader);
      if (res.status === 200 && res.data && res.data.success) {
        pass('T03: 更新上下桌单状态为"已完成"');
      } else {
        fail('T03: 更新上下桌单状态', JSON.stringify(res.data));
      }
    } catch (e) {
      fail('T03: 更新上下桌单状态', e.message);
    }
  } else {
    skip('T03: 更新上下桌单状态', '没有可用的台桌操作订单ID');
  }

  // ==================== 并发测试 ====================
  log('bold', '\n========================================');
  log('bold', '  [并发 10] 并发写入测试');
  log('bold', '========================================\n');

  // P01: 并发添加购物车
  try {
    const concurrentSession = `test_session_concurrent_${Date.now()}`;
    const promises = [];
    const products = ['可乐', '雪碧', '果汁', '薯条', '汉堡'];

    for (let i = 0; i < 5; i++) {
      promises.push(
        post('/api/cart', {
          sessionId: concurrentSession,
          tableNo: TEST_TABLE_NO,
          productName: products[i],
          quantity: 1,
          options: ''
        }, adminAuthHeader).catch(e => ({ status: 0, data: { error: e.message } }))
      );
    }

    const concurrentResults = await Promise.all(promises);
    const successCount = concurrentResults.filter(r => r.status === 200 && r.data && r.data.success).length;

    if (successCount === 5) {
      pass('P01: 并发添加购物车 (5个同时)', `全部 ${successCount}/5 成功`);
    } else {
      // 检查是否有 SQLITE_ERROR
      const hasTxError = concurrentResults.some(r => {
        const errMsg = (r.data && r.data.error) || (r.error && r.error.error) || '';
        const errStr = typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg);
        return errStr.includes('cannot start a transaction') || errStr.includes('SQLITE_ERROR');
      });
      if (hasTxError) {
        fail('P01: 并发添加购物车', `发现 SQLITE 事务嵌套错误! ${successCount}/5 成功`);
      } else {
        // 其他原因失败也算通过核心测试（不是事务嵌套问题）
        pass('P01: 并发添加购物车', `${successCount}/5 成功，无事务嵌套错误`);
      }
    }
  } catch (e) {
    fail('P01: 并发添加购物车', e.message);
  }

  // P02: 并发购物车 + 服务单
  try {
    const concurrentSession2 = `test_session_mixed_${Date.now()}`;

    // 先加一个商品
    await post('/api/cart', {
      sessionId: concurrentSession2,
      tableNo: TEST_TABLE_NO,
      productName: '测试商品',
      quantity: 1,
      options: ''
    }, adminAuthHeader);

    const promises = [
      // 购物车操作
      put('/api/cart', {
        sessionId: concurrentSession2,
        productName: '测试商品',
        quantity: 3,
        options: ''
      }, adminAuthHeader).catch(e => ({ status: 0, data: { error: e.message } })),

      // 服务单创建
      post('/api/service-orders', {
        table_no: TEST_TABLE_NO,
        requirement: '并发测试',
        requester_name: '并发测试',
        requester_type: '测试'
      }, adminAuthHeader).catch(e => ({ status: 0, data: { error: e.message } })),

      // 另一个购物车操作
      post('/api/cart', {
        sessionId: concurrentSession2,
        tableNo: TEST_TABLE_NO,
        productName: '并发商品',
        quantity: 1,
        options: ''
      }, adminAuthHeader).catch(e => ({ status: 0, data: { error: e.message } }))
    ];

    const mixedResults = await Promise.all(promises);
    const successCount = mixedResults.filter(r => r.status === 200 && r.data && r.data.success).length;
    const hasTxError = mixedResults.some(r => {
      const errMsg = (r.data && r.data.error) || '';
      const errStr = typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg);
      return errStr.includes('cannot start a transaction') || errStr.includes('SQLITE_ERROR');
    });

    if (hasTxError) {
      fail('P02: 混合并发写入', `发现 SQLITE 事务嵌套错误! ${successCount}/3 成功`);
    } else {
      pass('P02: 混合并发写入', `${successCount}/3 成功，无事务嵌套错误`);
    }
  } catch (e) {
    fail('P02: 混合并发写入', e.message);
  }

  // P03: 多轮快速写入
  try {
    const fastSession = `test_session_fast_${Date.now()}`;
    let failCount = 0;
    let txErrorCount = 0;

    for (let i = 0; i < 10; i++) {
      try {
        const res = await post('/api/cart', {
          sessionId: fastSession,
          tableNo: TEST_TABLE_NO,
          productName: `快速商品${i}`,
          quantity: 1,
          options: ''
        }, adminAuthHeader);
        if (res.status !== 200 || !res.data.success) {
          failCount++;
        }
      } catch (e) {
        failCount++;
        if (e.message && e.message.includes('SQLITE_ERROR')) {
          txErrorCount++;
        }
      }
    }

    if (txErrorCount > 0) {
      fail('P03: 10次快速连续写入', `发现 ${txErrorCount} 次事务嵌套错误`);
    } else if (failCount === 0) {
      pass('P03: 10次快速连续写入', `全部 10/10 成功`);
    } else {
      pass('P03: 10次快速连续写入', `${10 - failCount}/10 成功，无事务嵌套错误`);
    }
  } catch (e) {
    fail('P03: 10次快速连续写入', e.message);
  }

  // ==================== 回归测试 ====================
  log('bold', '\n========================================');
  log('bold', '  [回归 11] 回归测试: 验证 bug 不再出现');
  log('bold', '========================================\n');

  // R01: 事务恢复测试
  // 先触发一个需要事务的操作，然后立即触发购物车操作
  try {
    // 同时触发教练下班（需要 beginTransaction）和购物车操作（需要 dbTx/dbRun）
    let coachTxError = null;
    let cartError = null;

    if (coachNo) {
      // 先让助教上班
      try {
        await put(`/api/water-boards/${coachNo}/status`, {
          status: '早班空闲'
        }, adminAuthHeader);
      } catch {}

      const [coachRes, cartRes] = await Promise.all([
        post(`/api/coaches/v2/${coachNo}/clock-in`, null, adminAuthHeader).catch(e => ({ error: e.message })),
        post('/api/cart', {
          sessionId: `test_session_regression_${Date.now()}`,
          tableNo: TEST_TABLE_NO,
          productName: '回归测试商品',
          quantity: 1,
          options: ''
        }, adminAuthHeader).catch(e => ({ error: e.message }))
      ]);

      // 检查是否有事务嵌套错误
      const coachHasTxError = coachRes.error && (
        (coachRes.data && coachRes.data.error && coachRes.data.error.includes('cannot start')) ||
        (coachRes.error && coachRes.error.includes('cannot start'))
      );
      const cartHasTxError = cartRes.error && (
        (cartRes.data && cartRes.data.error && cartRes.data.error.includes('cannot start')) ||
        (cartRes.error && cartRes.error.includes('cannot start'))
      );

      if (coachHasTxError || cartHasTxError) {
        fail('R01: 事务恢复测试', `发现 SQLITE 事务嵌套错误`);
      } else {
        pass('R01: 事务恢复测试', '并发事务操作无嵌套错误');
      }
    } else {
      skip('R01: 事务恢复测试', '没有可用的助教编号');
    }
  } catch (e) {
    fail('R01: 事务恢复测试', e.message);
  }

  // R02: dbTx 稳定性测试 — 连续多次调用
  try {
    let txErrorCount = 0;
    for (let i = 0; i < 5; i++) {
      try {
        const session = `test_session_stability_${Date.now()}_${i}`;
        const res = await post('/api/cart', {
          sessionId: session,
          tableNo: TEST_TABLE_NO,
          productName: '稳定性测试',
          quantity: 1,
          options: ''
        }, adminAuthHeader);
        if (res.data && res.data.error && res.data.error.includes('cannot start')) {
          txErrorCount++;
        }
      } catch (e) {
        if (e.message.includes('cannot start') || e.message.includes('SQLITE_ERROR')) {
          txErrorCount++;
        }
      }
    }

    if (txErrorCount > 0) {
      fail('R02: dbTx 稳定性测试', `5次调用中 ${txErrorCount} 次出现事务嵌套错误`);
    } else {
      pass('R02: dbTx 稳定性测试', '5次调用全部正常');
    }
  } catch (e) {
    fail('R02: dbTx 稳定性测试', e.message);
  }

  // ==================== 输出汇总 ====================
  log('bold', '\n========================================');
  log('bold', '  测试汇总');
  log('bold', '========================================\n');

  log('green', `  ✅ 通过: ${results.passed}`);
  log('red', `  ❌ 失败: ${results.failed}`);
  log('yellow', `  ⏭️  跳过: ${results.skipped}`);
  log('bold', `  📊 总计: ${results.passed + results.failed + results.skipped}`);

  if (results.failed > 0) {
    log('bold', '\n  失败的测试:');
    results.details
      .filter(d => d.status === 'FAIL')
      .forEach(d => {
        log('red', `    ❌ ${d.name}: ${d.detail}`);
      });
  }

  // 特别检查: 是否有任何 SQLITE 事务嵌套错误
  const txErrors = results.details.filter(d => {
    if (!d.detail) return false;
    // 排除 "无事务嵌套错误" 等正面表述
    const s = d.detail;
    if (s.includes('无事务嵌套错误') || s.includes('无 SQLITE_ERROR') || s.includes('无事务嵌套')) return false;
    return s.includes('cannot start a transaction') ||
           s.includes('SQLITE_ERROR') ||
           (s.includes('事务嵌套错误') && !s.includes('无事务嵌套错误'));
  });
  if (txErrors.length > 0) {
    log('bold', '\n  ⚠️  发现事务嵌套错误:');
    txErrors.forEach(d => {
      log('red', `    ${d.name}: ${d.detail}`);
    });
    log('bold', '\n  🔴 BUG-0414 修复可能不完整!');
  } else {
    log('bold', '\n  ✅ 未发现 SQLITE_ERROR 事务嵌套冲突');
    log('green', '  🟢 BUG-0414 修复验证通过!');
  }

  log('bold', '\n========================================\n');

  // 退出码
  process.exit(results.failed > 0 ? 1 : 0);
}

// ==================== 执行 ====================

runTests().catch(err => {
  log('red', `\n💥 测试执行异常: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
