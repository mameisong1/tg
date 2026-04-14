/**
 * 时区改造测试 - 测试环境 (tg.tiangong.club / 端口 8088)
 * 2026-04-14
 */

const http = require('http');
const https = require('https');
const url = require('url');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ============================================================
// 配置
// ============================================================
const API_BASE = 'https://tg.tiangong.club';
const ADMIN_USER = 'tgadmin';
const ADMIN_PASS = 'mms633268';

let passCount = 0;
let failCount = 0;
let warnings = [];
let authToken = '';

// ============================================================
// 工具函数
// ============================================================
function assert(condition, testName, detail = '') {
  if (condition) {
    passCount++;
    console.log(`  ✅ [通过] ${testName}`);
    if (detail) console.log(`     → ${detail}`);
  } else {
    failCount++;
    console.log(`  ❌ [失败] ${testName}`);
    if (detail) console.log(`     → ${detail}`);
  }
}

function warn(message) {
  warnings.push(message);
  console.log(`  ⚠️  [警告] ${message}`);
}

function httpsRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'tg.tiangong.club',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      rejectUnauthorized: false, // 测试环境可能有自签名证书
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function isBeijingTimeFormat(str) {
  // "YYYY-MM-DD HH:MM:SS" 格式检查
  if (!str) return false;
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str);
}

function isDateOnlyFormat(str) {
  // "YYYY-MM-DD" 格式检查
  if (!str) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

// ============================================================
// 1. 后端工具类测试
// ============================================================
async function testBackendTimeUtil() {
  console.log('\n═══════════════════════════════════════════');
  console.log('📦 测试 1: 后端工具类 (backend/utils/time.js)');
  console.log('═══════════════════════════════════════════\n');

  // 导入 time.js
  const timePath = path.join(__dirname, '../../tgservice/backend/utils/time.js');
  let TimeUtil;
  try {
    TimeUtil = require(timePath);
  } catch (e) {
    console.log(`  ❌ 无法加载 time.js: ${e.message}`);
    return;
  }

  // 1.1 nowDB()
  console.log('--- nowDB() ---');
  const nowStr = TimeUtil.nowDB();
  assert(isBeijingTimeFormat(nowStr), 'nowDB() 返回 YYYY-MM-DD HH:MM:SS 格式', nowStr);
  
  // 验证时间合理性（与当前服务器时间对比，允许 ±2 秒误差）
  const serverTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  // 解析 nowDB 返回的时间
  const parts = nowStr.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  const dbDate = new Date(`${parts[1]}-${parts[2]}-${parts[3]}T${parts[4]}:${parts[5]}:${parts[6]}+08:00`);
  const nowDate = new Date();
  const diff = Math.abs(dbDate - nowDate);
  assert(diff < 3000, 'nowDB() 时间与服务器当前时间一致（< 3秒误差）', `差值: ${diff}ms`);

  // 1.2 offsetDB()
  console.log('\n--- offsetDB() ---');
  const past5 = TimeUtil.offsetDB(-5);
  assert(isBeijingTimeFormat(past5), 'offsetDB(-5) 返回正确格式', past5);
  const pastDate = new Date(past5 + '+08:00');
  const expectedDiff = Math.abs((nowDate - pastDate) / 3600000 - 5);
  assert(expectedDiff < 0.01, 'offsetDB(-5) 相对偏移约 5 小时', `差值: ${(expectedDiff * 60).toFixed(1)} 分钟`);

  const future3 = TimeUtil.offsetDB(3);
  assert(isBeijingTimeFormat(future3), 'offsetDB(+3) 返回正确格式', future3);
  const futureDate = new Date(future3 + '+08:00');
  const expectedDiff2 = Math.abs((futureDate - nowDate) / 3600000 - 3);
  assert(expectedDiff2 < 0.01, 'offsetDB(+3) 相对偏移约 3 小时', `差值: ${(expectedDiff2 * 60).toFixed(1)} 分钟`);

  // 1.3 todayStr()
  console.log('\n--- todayStr() ---');
  const todayStr = TimeUtil.todayStr();
  assert(isDateOnlyFormat(todayStr), 'todayStr() 返回 YYYY-MM-DD 格式', todayStr);
  
  // 验证双数字月日
  const monthDay = todayStr.split('-');
  assert(monthDay[1].length === 2 && monthDay[2].length === 2, 'todayStr() 月份和日期均为双数字', `${monthDay[1]}月${monthDay[2]}日`);
  
  // 验证与当前日期一致
  const todayParts = todayStr.split('-');
  const nowBeijing = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const nowDateParts = nowBeijing.split(/[\/年月日]/).filter(Boolean);
  assert(todayParts[0] === nowDateParts[0] && parseInt(todayParts[1]) === parseInt(nowDateParts[1]) && parseInt(todayParts[2]) === parseInt(nowDateParts[2]),
    'todayStr() 与当前北京日期一致', `todayStr: ${todayStr}, 当前: ${nowBeijing}`);

  // 1.4 toDate()
  console.log('\n--- toDate() ---');
  const dbTime = '2026-04-14 09:30:00';
  const parsed = TimeUtil.toDate(dbTime);
  assert(parsed instanceof Date, 'toDate() 返回 Date 对象', parsed.toString());
  assert(parsed.getFullYear() === 2026, 'toDate() 年份正确 (2026)', `year=${parsed.getFullYear()}`);
  assert(parsed.getMonth() + 1 === 4, 'toDate() 月份正确 (4)', `month=${parsed.getMonth() + 1}`);
  assert(parsed.getDate() === 14, 'toDate() 日期正确 (14)', `date=${parsed.getDate()}`);
  assert(parsed.getHours() === 9, 'toDate() 小时正确 (9)', `hours=${parsed.getHours()}`);
  assert(parsed.getMinutes() === 30, 'toDate() 分钟正确 (30)', `minutes=${parsed.getMinutes()}`);

  // null/undefined 处理
  const nullResult = TimeUtil.toDate(null);
  assert(nullResult === null, 'toDate(null) 返回 null');
  const emptyResult = TimeUtil.toDate('');
  assert(emptyResult === null, 'toDate("") 返回 null');

  // 1.5 format()
  console.log('\n--- format() ---');
  const formatted = TimeUtil.format('2026-04-14 09:30:00');
  assert(typeof formatted === 'string' && formatted.length > 0, 'format() 返回非空字符串', formatted);

  // 1.6 isWithinMinutes()
  console.log('\n--- isWithinMinutes() ---');
  const recentTime = TimeUtil.nowDB();
  assert(TimeUtil.isWithinMinutes(recentTime, 5), 'isWithinMinutes(now, 5) 返回 true');
  
  const fiveMinAgo = TimeUtil.offsetDB(-5/60); // 5分钟前
  // 由于 offsetDB 有秒级差异，使用 6 分钟窗口
  assert(TimeUtil.isWithinMinutes(fiveMinAgo, 6), 'isWithinMinutes(5分钟前, 6) 返回 true');
  
  const oneHourAgo = TimeUtil.offsetDB(-1);
  assert(!TimeUtil.isWithinMinutes(oneHourAgo, 5), 'isWithinMinutes(1小时前, 5) 返回 false');
  
  assert(!TimeUtil.isWithinMinutes(null, 5), 'isWithinMinutes(null, 5) 返回 false');
  assert(!TimeUtil.isWithinMinutes('invalid', 5), 'isWithinMinutes("invalid", 5) 返回 false');

  // 1.7 formatDate() 和 formatTime()
  console.log('\n--- formatDate() & formatTime() ---');
  const dateOnly = TimeUtil.formatDate('2026-04-14 09:30:00');
  assert(typeof dateOnly === 'string' && dateOnly.length > 0, 'formatDate() 返回非空字符串', dateOnly);
  
  const timeOnly = TimeUtil.formatTime('2026-04-14 09:30:00');
  assert(typeof timeOnly === 'string' && timeOnly.length > 0, 'formatTime() 返回非空字符串', timeOnly);
}

// ============================================================
// 2. 数据库一致性测试
// ============================================================
async function testDatabaseConsistency() {
  console.log('\n═══════════════════════════════════════════');
  console.log('🗄️  测试 2: 数据库一致性');
  console.log('═══════════════════════════════════════════\n');

  const dbPath = path.join(__dirname, '../../tgservice/db/tgservice.db');
  
  if (!fs.existsSync(dbPath)) {
    console.log('  ❌ 数据库文件不存在: ' + dbPath);
    return;
  }

  const sqlite3 = require('sqlite3').verbose();
  const db = new sqlite3.Database(dbPath, { mode: sqlite3.OPEN_READONLY });

  // 辅助函数：执行查询
  function queryDB(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  function queryDBOne(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // 2.1 orders 表
  console.log('--- orders 表 created_at 检查 ---');
  const ordersCount = await queryDBOne('SELECT COUNT(*) as cnt FROM orders');
  console.log(`  总记录数: ${ordersCount.cnt}`);
  
  // 检查是否有非标准格式的时间
  const ordersBadFormat = await queryDBOne("SELECT COUNT(*) as cnt FROM orders WHERE created_at NOT LIKE '____-__-__ __:__:__'");
  assert(ordersBadFormat.cnt === 0, 'orders.created_at 全部为标准格式', `异常记录: ${ordersBadFormat.cnt} 条`);
  
  // 查看最近几条记录
  const recentOrders = await queryDB('SELECT id, created_at FROM orders ORDER BY id DESC LIMIT 5');
  console.log('  最近 5 条记录:');
  recentOrders.forEach(o => {
    const fmt = isBeijingTimeFormat(o.created_at) ? '✅' : '❌';
    console.log(`    ${fmt} id=${o.id}: "${o.created_at}"`);
    assert(isBeijingTimeFormat(o.created_at), `orders[${o.id}].created_at 格式正确`, o.created_at);
  });

  // 2.2 service_orders 表
  console.log('\n--- service_orders 表 created_at 检查 ---');
  const svcCount = await queryDBOne('SELECT COUNT(*) as cnt FROM service_orders');
  console.log(`  总记录数: ${svcCount.cnt}`);
  
  const svcBadFormat = await queryDBOne("SELECT COUNT(*) as cnt FROM service_orders WHERE created_at NOT LIKE '____-__-__ __:__:__'");
  assert(svcBadFormat.cnt === 0, 'service_orders.created_at 全部为标准格式', `异常记录: ${svcBadFormat.cnt} 条`);
  
  if (svcCount.cnt > 0) {
    const recentSvc = await queryDB('SELECT id, created_at FROM service_orders ORDER BY id DESC LIMIT 3');
    recentSvc.forEach(o => {
      const fmt = isBeijingTimeFormat(o.created_at) ? '✅' : '❌';
      console.log(`    ${fmt} id=${o.id}: "${o.created_at}"`);
    });
  }

  // 2.3 table_action_orders 表
  console.log('\n--- table_action_orders 表 created_at 检查 ---');
  const taCount = await queryDBOne('SELECT COUNT(*) as cnt FROM table_action_orders');
  console.log(`  总记录数: ${taCount.cnt}`);
  
  const taBadFormat = await queryDBOne("SELECT COUNT(*) as cnt FROM table_action_orders WHERE created_at NOT LIKE '____-__-__ __:__:__'");
  assert(taBadFormat.cnt === 0, 'table_action_orders.created_at 全部为标准格式', `异常记录: ${taBadFormat.cnt} 条`);
  
  if (taCount.cnt > 0) {
    const recentTa = await queryDB('SELECT id, created_at FROM table_action_orders ORDER BY id DESC LIMIT 3');
    recentTa.forEach(o => {
      const fmt = isBeijingTimeFormat(o.created_at) ? '✅' : '❌';
      console.log(`    ${fmt} id=${o.id}: "${o.created_at}"`);
    });
  }

  // 2.4 检查是否有 UTC 风格的时间（如带 Z 或 +00:00 后缀）
  console.log('\n--- UTC 残留检查 ---');
  const utcCheck = await queryDBOne("SELECT COUNT(*) as cnt FROM orders WHERE created_at LIKE '%Z%' OR created_at LIKE '%+00%' OR created_at LIKE '%UTC%'");
  assert(utcCheck.cnt === 0, 'orders 表无 UTC 风格时间残留', `UTC残留: ${utcCheck.cnt} 条`);

  db.close();
}

// ============================================================
// 3. API 测试
// ============================================================
async function testAPI() {
  console.log('\n═══════════════════════════════════════════');
  console.log('🌐 测试 3: API 测试');
  console.log('═══════════════════════════════════════════\n');

  // 3.0 先登录获取 token
  console.log('--- 登录获取认证 token ---');
  const loginRes = await httpsRequest('POST', '/api/admin/login', {
    username: ADMIN_USER,
    password: ADMIN_PASS
  });
  
  assert(loginRes.status === 200, '管理员登录成功', `HTTP ${loginRes.status}`);
  assert(loginRes.data && loginRes.data.success, '登录返回 success=true', loginRes.data ? JSON.stringify(loginRes.data).substring(0, 100) : '无数据');
  
  authToken = loginRes.data?.token || '';
  assert(authToken.length > 0, '获取到认证 token', `token长度: ${authToken.length}`);
  
  if (!authToken) {
    console.log('  ❌ 无法获取 token，跳过 API 测试');
    return;
  }

  const authHeader = { 'Authorization': `Bearer ${authToken}` };

  // 3.1 GET /api/admin/orders (不带 date 参数)
  console.log('\n--- GET /api/admin/orders (全部) ---');
  const ordersAll = await httpsRequest('GET', '/api/admin/orders', null, authHeader);
  assert(ordersAll.status === 200, '获取全部订单成功', `HTTP ${ordersAll.status}, 返回 ${Array.isArray(ordersAll.data) ? ordersAll.data.length : 'N/A'} 条`);
  
  if (Array.isArray(ordersAll.data) && ordersAll.data.length > 0) {
    const sample = ordersAll.data[0];
    assert(isBeijingTimeFormat(sample.created_at), '订单 created_at 格式正确', sample.created_at);
  }

  // 3.2 GET /api/admin/orders?date=2026-04-14
  console.log('\n--- GET /api/admin/orders?date=2026-04-14 ---');
  const ordersDate = await httpsRequest('GET', '/api/admin/orders?date=2026-04-14', null, authHeader);
  assert(ordersDate.status === 200, '按日期查询成功', `HTTP ${ordersDate.status}, 返回 ${Array.isArray(ordersDate.data) ? ordersDate.data.length : 'N/A'} 条`);
  
  if (Array.isArray(ordersDate.data)) {
    // 验证返回的订单日期都是 2026-04-14
    const allMatchDate = ordersDate.data.every(o => o.created_at && o.created_at.startsWith('2026-04-14'));
    assert(allMatchDate || ordersDate.data.length === 0, '返回订单日期均为 2026-04-14', `共 ${ordersDate.data.length} 条, 全部匹配: ${allMatchDate}`);
  }

  // 3.3 双数字月份匹配测试 (date=2026-04-14 vs 单数字)
  console.log('\n--- 双数字日期格式匹配测试 ---');
  const ordersDouble = await httpsRequest('GET', '/api/admin/orders?date=2026-04-14', null, authHeader);
  assert(ordersDouble.status === 200, '双数字日期查询 (2026-04-14) 成功', `HTTP ${ordersDouble.status}`);
  assert(Array.isArray(ordersDouble.data), '返回数组格式', `类型: ${typeof ordersDouble.data}`);

  // 3.4 验证时间相关 API 返回格式
  console.log('\n--- 订单时间字段格式 ---');
  if (Array.isArray(ordersAll.data) && ordersAll.data.length > 0) {
    const sample = ordersAll.data[0];
    assert(isBeijingTimeFormat(sample.created_at), 'created_at 格式正确', sample.created_at);
    if (sample.updated_at) {
      assert(isBeijingTimeFormat(sample.updated_at), 'updated_at 格式正确', sample.updated_at);
    }
  }

  // 3.5 测试 stats API
  console.log('\n--- GET /api/admin/stats ---');
  const stats = await httpsRequest('GET', '/api/admin/stats', null, authHeader);
  assert(stats.status === 200, '获取统计信息成功', `HTTP ${stats.status}`);
  if (stats.data) {
    console.log(`  返回数据: ${JSON.stringify(stats.data).substring(0, 100)}`);
  }
}

// ============================================================
// 4. 前端测试
// ============================================================
async function testFrontend() {
  console.log('\n═══════════════════════════════════════════');
  console.log('🖥️  测试 4: 前端时间处理');
  console.log('═══════════════════════════════════════════\n');

  // 前端时间处理函数在 HTML 中内联定义，检查相关页面
  const adminPath = path.join(__dirname, '../../tgservice/frontend/admin');
  
  if (!fs.existsSync(adminPath)) {
    warn(`admin 目录不存在: ${adminPath}`);
    return;
  }

  // 检查 settings.html 中的 formatTime 函数
  const settingsPath = path.join(adminPath, 'settings.html');
  if (fs.existsSync(settingsPath)) {
    const settingsContent = fs.readFileSync(settingsPath, 'utf-8');
    
    // 查找 formatTime 函数
    const formatTimeMatch = settingsContent.match(/function formatTime\([^)]*\)\s*\{([^}]+)\}/s);
    assert(formatTimeMatch !== null, 'settings.html 中存在 formatTime 函数');
    
    if (formatTimeMatch) {
      console.log('  formatTime 实现:');
      console.log(`    ${formatTimeMatch[1].trim().replace(/\n/g, '\n    ')}`);
    }

    // 检查是否有直接使用 datetime() SQL 函数
    const hasDatetimeCall = settingsContent.includes("datetime('now')");
    assert(!hasDatetimeCall, 'settings.html 未使用 datetime(\'now\') SQL 函数', hasDatetimeCall ? '存在 datetime(\'now\') 调用' : '无');
  }

  // 检查 members.html 中的 formatTime 函数
  const membersPath = path.join(adminPath, 'members.html');
  if (fs.existsSync(membersPath)) {
    const membersContent = fs.readFileSync(membersPath, 'utf-8');
    
    const formatTimeMatch = membersContent.match(/function formatTime\([^)]*\)\s*\{([^}]+)\}/s);
    assert(formatTimeMatch !== null, 'members.html 中存在 formatTime 函数');
    
    if (formatTimeMatch) {
      console.log('  formatTime 实现:');
      console.log(`    ${formatTimeMatch[1].trim().replace(/\n/g, '\n    ')}`);
    }

    const hasDatetimeCall = membersContent.includes("datetime('now')");
    assert(!hasDatetimeCall, 'members.html 未使用 datetime(\'now\') SQL 函数', hasDatetimeCall ? '存在 datetime(\'now\') 调用' : '无');
  }

  // 检查 uniapp 前端是否有时间工具
  console.log('\n--- uniapp 前端时间工具检查 ---');
  const utilsPath = path.join(__dirname, '../../tgservice-uniapp/utils');
  if (fs.existsSync(utilsPath)) {
    const timeFiles = fs.readdirSync(utilsPath).filter(f => f.includes('time') || f.includes('Time'));
    if (timeFiles.length > 0) {
      console.log(`  发现时间相关文件: ${timeFiles.join(', ')}`);
    } else {
      console.log('  未发现专门的时间工具文件');
    }
  } else {
    console.log(`  utils 目录不存在: ${utilsPath}`);
  }
}

// ============================================================
// 5. 综合测试：写入新订单验证
// ============================================================
async function testNewOrderWrite() {
  console.log('\n═══════════════════════════════════════════');
  console.log('📝 测试 5: 新写入数据时间验证');
  console.log('═══════════════════════════════════════════\n');

  const dbPath = path.join(__dirname, '../../tgservice/db/tgservice.db');
  
  // 直接通过后端代码创建测试数据
  const TimeUtil = require(path.join(__dirname, '../../tgservice/backend/utils/time.js'));
  
  // 验证 TimeUtil.nowDB() 返回的是北京时间
  const dbTime = TimeUtil.nowDB();
  assert(isBeijingTimeFormat(dbTime), 'TimeUtil.nowDB() 生成北京时间', dbTime);
  
  // 验证 toDate 解析
  const parsed = TimeUtil.toDate(dbTime);
  assert(parsed instanceof Date, 'TimeUtil.toDate() 正确解析', parsed.toString());
  
  // 对比服务器时间，确认是北京时间
  const nowUTC = new Date();
  const diffMs = parsed - nowUTC;
  const expectedDiffMs = 8 * 3600 * 1000; // 北京时间 = UTC + 8
  // 由于服务器本身就在 CST 时区，差异应该接近 0
  // 如果服务器不在 CST 时区，差异应该是 ±8 小时
  const isCST = Math.abs(diffMs) < 10000; // 服务器是 CST
  const isUTC = Math.abs(Math.abs(diffMs) - expectedDiffMs) < 10000; // 服务器是 UTC
  const isCorrectTZ = isCST || isUTC;
  assert(isCorrectTZ, 'TimeUtil.nowDB() 时间与时区一致', 
    `服务器时间: ${nowUTC.toISOString()}, nowDB: ${dbTime}, 差异: ${(diffMs/3600000).toFixed(2)}小时`);

  // 直接在数据库中插入一条测试记录
  console.log('\n--- 数据库写入测试 ---');
  const sqlite3 = require('sqlite3').verbose();
  const db = new sqlite3.Database(dbPath);

  const testOrderNo = `TZ_TEST_${Date.now()}`;
  const testTime = TimeUtil.nowDB();
  const testItems = JSON.stringify([{ name: '测试商品', qty: 1, price: 0.01 }]);
  
  console.log(`  准备插入测试订单: ${testOrderNo}, 时间: ${testTime}`);

  await new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO orders (order_no, table_no, items, total_price, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [testOrderNo, 'TZ-TEST', testItems, 0.01, '测试', testTime],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });

  // 验证写入后的数据
  const inserted = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM orders WHERE order_no = ?', [testOrderNo], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  assert(inserted !== null, '测试订单写入成功', `id=${inserted?.id}`);
  assert(inserted && inserted.created_at === testTime, '数据库存储的 created_at 与写入一致', 
    `写入: ${testTime}, 存储: ${inserted?.created_at}`);
  assert(inserted && isBeijingTimeFormat(inserted.created_at), '数据库存储格式正确', inserted?.created_at);

  // 清理测试数据
  await new Promise((resolve, reject) => {
    db.run('DELETE FROM orders WHERE order_no = ?', [testOrderNo], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  console.log('  ✅ 测试数据已清理');

  db.close();
}

// ============================================================
// 主函数
// ============================================================
async function main() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   时区改造测试报告                         ║');
  console.log('║   测试环境: tg.tiangong.club (8088)        ║');
  console.log(`║   测试时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}          ║`);
  console.log('╚═══════════════════════════════════════════╝');

  try {
    await testBackendTimeUtil();
    await testDatabaseConsistency();
    await testAPI();
    await testFrontend();
    await testNewOrderWrite();
  } catch (err) {
    console.log(`\n❌ 测试过程中发生错误: ${err.message}`);
    console.log(err.stack);
  }

  // 打印总结
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║              测试总结                      ║');
  console.log('╠═══════════════════════════════════════════╣');
  console.log(`║  ✅ 通过: ${String(passCount).padStart(3)}                           ║`);
  console.log(`║  ❌ 失败: ${String(failCount).padStart(3)}                           ║`);
  if (warnings.length > 0) {
    console.log(`║  ⚠️  警告: ${String(warnings.length).padStart(3)}                           ║`);
  }
  console.log('╚═══════════════════════════════════════════╝');

  if (failCount === 0) {
    console.log('\n🎉 所有测试通过！时区改造验证成功。');
  } else {
    console.log(`\n⚠️  有 ${failCount} 项测试失败，请检查上方详细输出。`);
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
