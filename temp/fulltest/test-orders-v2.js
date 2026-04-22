const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');

const SCREENSHOT_DIR = '/TG/temp/fulltest';
const DB_PATH = '/TG/tgservice/db/tgservice.db';

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
  console.log('=== 商品点单测试（修正参数）===\n');
  
  // 管理员登录
  const adminLoginRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/admin/login" -H "Content-Type: application/json" -d '{"username":"tgadmin","password":"mms633268"}'`, { encoding: 'utf8' });
  const adminData = JSON.parse(adminLoginRes);
  const ADMIN_TOKEN = adminData.token;
  
  // ========== 商品点单测试 ==========
  console.log('=== 商品点单完整流程 ===');
  
  const ordersBefore = parseInt(sqliteQuery("SELECT COUNT(*) FROM orders")) || 0;
  console.log('订单数(前):', ordersBefore);
  
  // 生成sessionId
  const sessionId = `test_order_${Date.now()}`;
  console.log('sessionId:', sessionId);
  
  // Step 1: 添加商品到购物车（使用正确的参数名）
  console.log('\n1. 添加商品到购物车...');
  const addToCartRes1 = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/cart" -H "Content-Type: application/json" -d '{"sessionId":"${sessionId}","tableNo":"雀1","productName":"椰青美式","quantity":2}'`, { encoding: 'utf8' });
  console.log('添加椰青美式:', addToCartRes1);
  
  await wait(500);
  
  const addToCartRes2 = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/cart" -H "Content-Type: application/json" -d '{"sessionId":"${sessionId}","tableNo":"雀1","productName":"无穷鸡腿","quantity":1}'`, { encoding: 'utf8' });
  console.log('添加无穷鸡腿:', addToCartRes2);
  
  await wait(1000);
  
  // Step 2: 检查购物车
  console.log('\n2. 检查购物车...');
  const cartCheck = execSync(`curl -s "http://127.0.0.1:8088/api/cart/${sessionId}"`, { encoding: 'utf8' });
  const cartData = JSON.parse(cartCheck);
  console.log('购物车商品数:', cartData.items?.length || 0);
  console.log('购物车总价:', cartData.totalPrice || 0);
  
  if (cartData.items?.length > 0) {
    console.log('✅ 购物车有商品');
    
    // Step 3: 提交订单
    console.log('\n3. 提交订单...');
    const orderRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/order" -H "Content-Type: application/json" -d '{"sessionId":"${sessionId}"}'`, { encoding: 'utf8' });
    const orderData = JSON.parse(orderRes);
    console.log('订单响应:', orderRes);
    
    await wait(2000);
    
    // Step 4: 检查订单数
    const ordersAfter = parseInt(sqliteQuery("SELECT COUNT(*) FROM orders")) || 0;
    console.log('订单数(后):', ordersAfter);
    
    // 查询最新订单详情
    const latestOrder = sqliteQuery("SELECT order_no, table_no, total_price, status FROM orders ORDER BY created_at DESC LIMIT 1");
    console.log('最新订单:', latestOrder);
    
    if (ordersAfter > ordersBefore && orderData.success) {
      console.log('\n✅ 商品点单成功！');
      results.push({ test: '商品点单', status: 'PASS', detail: `订单号:${orderData.orderNo}, 台桌:雀1, 商品:${cartData.items.length}件` });
    } else {
      console.log('\n❌ 商品点单失败:', orderData.error);
      results.push({ test: '商品点单', status: 'FAIL', detail: orderData.error });
    }
  } else {
    console.log('❌ 购物车为空，无法下单');
    results.push({ test: '商品点单', status: 'FAIL', detail: '购物车添加失败' });
  }
  
  // ========== 服务下单测试（再次验证）==========
  console.log('\n=== 服务下单验证 ===');
  
  const serviceBefore = parseInt(sqliteQuery("SELECT COUNT(*) FROM service_orders")) || 0;
  
  const serviceRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/service-orders" -H "Content-Type: application/json" -H "Authorization: Bearer ${ADMIN_TOKEN}" -d '{"table_no":"雀2","requirement":"需要两杯可乐","requester_name":"测试助教","requester_type":"助教"}'`, { encoding: 'utf8' });
  console.log('服务单响应:', serviceRes);
  
  await wait(1000);
  
  const serviceAfter = parseInt(sqliteQuery("SELECT COUNT(*) FROM service_orders")) || 0;
  
  if (serviceAfter > serviceBefore) {
    const latest = sqliteQuery("SELECT id, table_no, requirement FROM service_orders ORDER BY created_at DESC LIMIT 1");
    console.log('✅ 服务下单成功:', latest);
    results.push({ test: '服务下单', status: 'PASS', detail: latest });
  } else {
    console.log('❌ 服务下单失败');
    results.push({ test: '服务下单', status: 'FAIL', detail: '服务单未创建' });
  }
  
  // ========== 截图 ==========
  console.log('\n=== 浏览器截图 ===');
  
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
      defaultViewport: { width: 375, height: 812 }
    });
    
    const page = await browser.newPage();
    
    await page.goto('http://127.0.0.1:8089/#/pages/products/products?table=雀1', { waitUntil: 'networkidle2' });
    await wait(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/10-products.png`, fullPage: true });
    
    await page.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'networkidle2' });
    await wait(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/11-cart.png`, fullPage: true });
    
    await page.close();
    console.log('✅ 截图完成');
  } catch (e) {
    console.log('截图失败:', e.message);
  }
  
  // ========== 总结 ==========
  console.log('\n========== 测试完成 ==========');
  results.forEach(r => console.log(`${r.status === 'PASS' ? '✅' : '❌'} ${r.test}: ${r.detail}`));
  
  const existingResults = JSON.parse(fs.readFileSync(`${SCREENSHOT_DIR}/results.json`, 'utf8') || '[]');
  fs.writeFileSync(`${SCREENSHOT_DIR}/results.json`, JSON.stringify([...existingResults, ...results], null, 2));
}

runTests();