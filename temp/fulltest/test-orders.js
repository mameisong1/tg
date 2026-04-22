const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');

const SCREENSHOT_DIR = '/TG/temp/fulltest';
const DB_PATH = '/TG/tgservice/db/tgservice.db';
const COACH_NO = '10002';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

function sqliteQuery(sql) {
  try {
    return execSync(`sqlite3 ${DB_PATH} "${sql}"`, { encoding: 'utf8' }).trim();
  } catch (e) {
    return '';
  }
}

const results = [];

async function runTests() {
  console.log('=== 商品点单和服务下单测试 ===\n');
  
  // 1. 管理员登录
  console.log('管理员登录...');
  const adminLoginRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/admin/login" -H "Content-Type: application/json" -d '{"username":"tgadmin","password":"mms633268"}'`, { encoding: 'utf8' });
  const adminData = JSON.parse(adminLoginRes);
  
  if (!adminData.success) {
    console.log('❌ 管理员登录失败');
    return;
  }
  
  const ADMIN_TOKEN = adminData.token;
  console.log('✅ 管理员登录成功');
  
  // ========== 商品点单测试 ==========
  console.log('\n=== 测试1: 商品点单 ===');
  
  // 记录初始订单数
  const ordersBefore = parseInt(sqliteQuery("SELECT COUNT(*) FROM orders")) || 0;
  console.log('订单数(前):', ordersBefore);
  
  // 生成sessionId
  const sessionId = `test_${Date.now()}`;
  console.log('sessionId:', sessionId);
  
  // 1. 添加商品到购物车
  const addToCartRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/cart" -H "Content-Type: application/json" -d '{"session_id":"${sessionId}","product_name":"椰青美式","quantity":1,"table_no":"雀1","price":20}'`, { encoding: 'utf8' });
  console.log('添加购物车响应:', addToCartRes);
  
  await wait(1000);
  
  // 检查购物车是否有数据
  const cartCheck = execSync(`curl -s "http://127.0.0.1:8088/api/cart/${sessionId}"`, { encoding: 'utf8' });
  console.log('购物车内容:', cartCheck);
  
  // 2. 提交订单
  const orderRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/order" -H "Content-Type: application/json" -d '{"sessionId":"${sessionId}"}'`, { encoding: 'utf8' });
  console.log('订单响应:', orderRes);
  
  await wait(2000);
  
  // 检查订单数
  const ordersAfter = parseInt(sqliteQuery("SELECT COUNT(*) FROM orders")) || 0;
  console.log('订单数(后):', ordersAfter);
  
  // 查询最新订单详情
  const latestOrder = sqliteQuery("SELECT order_no, table_no, total_price, status FROM orders ORDER BY created_at DESC LIMIT 1");
  console.log('最新订单:', latestOrder);
  
  if (ordersAfter > ordersBefore) {
    console.log('✅ 商品点单成功');
    results.push({ test: '商品点单', status: 'PASS', detail: `订单数+1, 最新订单: ${latestOrder}` });
  } else {
    const orderData = JSON.parse(orderRes);
    console.log('❌ 商品点单失败:', orderData.error);
    results.push({ test: '商品点单', status: 'FAIL', detail: orderData.error || '订单未创建' });
  }
  
  // ========== 服务下单测试 ==========
  console.log('\n=== 测试2: 服务下单 ===');
  
  // 记录初始服务单数
  const serviceOrdersBefore = parseInt(sqliteQuery("SELECT COUNT(*) FROM service_orders")) || 0;
  console.log('服务单数(前):', serviceOrdersBefore);
  
  // 创建服务单（用管理员token）
  const serviceOrderRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/service-orders" -H "Content-Type: application/json" -H "Authorization: Bearer ${ADMIN_TOKEN}" -d '{"table_no":"雀1","requirement":"需要一杯水","requester_name":"陆飞","requester_type":"助教"}'`, { encoding: 'utf8' });
  console.log('服务单响应:', serviceOrderRes);
  
  await wait(1000);
  
  // 检查服务单数
  const serviceOrdersAfter = parseInt(sqliteQuery("SELECT COUNT(*) FROM service_orders")) || 0;
  console.log('服务单数(后):', serviceOrdersAfter);
  
  // 查询最新服务单详情
  const latestService = sqliteQuery("SELECT id, table_no, requirement, requester_name, status FROM service_orders ORDER BY created_at DESC LIMIT 1");
  console.log('最新服务单:', latestService);
  
  if (serviceOrdersAfter > serviceOrdersBefore) {
    console.log('✅ 服务下单成功');
    results.push({ test: '服务下单', status: 'PASS', detail: `服务单数+1, 最新: ${latestService}` });
  } else {
    const serviceData = JSON.parse(serviceOrderRes);
    console.log('❌ 服务下单失败:', serviceData.error);
    results.push({ test: '服务下单', status: 'FAIL', detail: serviceData.error || '服务单未创建' });
  }
  
  // ========== 浏览器截图 ==========
  console.log('\n=== 浏览器截图 ===');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const page = await browser.newPage();
  
  // 设置token并打开页面
  await page.goto('http://127.0.0.1:8089', { waitUntil: 'load' });
  
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    }
    if ('caches' in window) {
      const names = await caches.keys();
      for (const n of names) await caches.delete(n);
    }
    localStorage.clear();
  });
  
  await wait(2000);
  await page.reload({ waitUntil: 'networkidle2' });
  
  // 设置管理员token
  await page.evaluate((t) => {
    localStorage.setItem('adminToken', t);
  }, ADMIN_TOKEN);
  
  // 导航到商品页
  await page.goto('http://127.0.0.1:8089/#/pages/products/products?table=雀1', { waitUntil: 'networkidle2' });
  await wait(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/07-products-page.png`, fullPage: true });
  console.log('截图: 07-products-page.png');
  
  // 导航到购物车
  await page.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'networkidle2' });
  await wait(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/08-cart-page.png`, fullPage: true });
  console.log('截图: 08-cart-page.png');
  
  // 导航到会员中心服务下单
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2' });
  await wait(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/09-service-page.png`, fullPage: true });
  console.log('截图: 09-service-page.png');
  
  await page.close();
  
  // ========== 完成 ==========
  console.log('\n\n========== 测试完成 ==========');
  results.forEach(r => {
    console.log(`  ${r.status === 'PASS' ? '✅' : '❌'} ${r.test}: ${r.detail}`);
  });
  
  // 更新results.json
  const existingResults = JSON.parse(fs.readFileSync(`${SCREENSHOT_DIR}/results.json`, 'utf8') || '[]');
  const allResults = [...existingResults, ...results];
  fs.writeFileSync(`${SCREENSHOT_DIR}/results.json`, JSON.stringify(allResults, null, 2));
  
  console.log(`\n总计: ${results.filter(r => r.status === 'PASS').length}/${results.length} 通过`);
}

runTests();