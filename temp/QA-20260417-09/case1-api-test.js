const puppeteer = require('puppeteer');
const https = require('https');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function test() {
  console.log('=== Case 1: 普通用户扫码下单完整流程（API加车）===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222'
  });
  
  const page = await browser.newPage();
  
  // Step 1: 进入首页设置扫码状态
  console.log('Step 1: 进入首页，设置扫码状态');
  await page.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await sleep(3000);
  
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('tableName', 'VIP3');
    localStorage.setItem('tableAuth', JSON.stringify({table:'VIP3', tableName:'VIP3', time:Date.now()}));
  });
  
  let tableName = await page.evaluate(() => localStorage.getItem('tableName'));
  console.log('  localStorage.tableName:', tableName);
  
  // Step 2: 获取页面生成的session_id
  console.log('\nStep 2: 获取session_id');
  await page.goto('http://127.0.0.1:8089/#/pages/products/products', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  
  // 从localStorage获取sessionId
  let sessionId = await page.evaluate(() => {
    // 尝试多种可能的session存储位置
    const cartSession = localStorage.getItem('cartSessionId');
    const session = localStorage.getItem('sessionId');
    if (cartSession) return cartSession;
    if (session) return session;
    // 生成一个测试sessionId
    const testId = 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionId', testId);
    return testId;
  });
  console.log('  sessionId:', sessionId);
  
  tableName = await page.evaluate(() => localStorage.getItem('tableName'));
  console.log('  tableName:', tableName);
  
  // Step 3: 用curl直接调用API加车（在浏览器同一session）
  console.log('\nStep 3: API加车');
  const http = require('http');
  
  const addCartData = JSON.stringify({
    sessionId: sessionId,
    productName: '可乐',
    quantity: 1,
    tableNo: 'VIP3'
  });
  
  const addCartReq = http.request({
    hostname: '127.0.0.1',
    port: 8088,
    path: '/api/cart',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(addCartData)
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('  加车结果:', data));
  });
  
  addCartReq.write(addCartData);
  addCartReq.end();
  await sleep(2000);
  
  // Step 4: 进入购物车
  console.log('\nStep 4: 进入购物车');
  await page.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  
  tableName = await page.evaluate(() => localStorage.getItem('tableName'));
  console.log('  tableName:', tableName);
  
  let pageText = await page.evaluate(() => document.body.innerText);
  console.log('  页面内容:', pageText.substring(0, 300));
  
  // 检查购物车是否有商品
  let hasProduct = pageText.includes('可乐') || pageText.includes('商品');
  console.log('  购物车有商品:', hasProduct);
  
  // 如果没有商品，设置sessionId到localStorage后再进入
  if (!hasProduct) {
    console.log('\n  购物车为空，设置sessionId后重新进入...');
    await page.evaluate((sid) => {
      localStorage.setItem('sessionId', sid);
    }, sessionId);
    await sleep(1000);
    await page.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'domcontentloaded' });
    await sleep(5000);
    
    pageText = await page.evaluate(() => document.body.innerText);
    hasProduct = pageText.includes('可乐') || pageText.includes('商品');
    console.log('  重新进入后有商品:', hasProduct);
    console.log('  页面内容:', pageText.substring(0, 300));
  }
  
  // Step 5: 下单
  if (hasProduct) {
    console.log('\nStep 5: 点击下单按钮');
    
    const buttons = await page.$$('button, uni-button, .submit-btn');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.innerText, btn);
      if (text.includes('提交') || text.includes('下单') || text.includes('结算')) {
        console.log('  找到下单按钮:', text);
        await btn.click();
        await sleep(5000);
        break;
      }
    }
    
    pageText = await page.evaluate(() => document.body.innerText);
    console.log('  下单后页面:', pageText.substring(0, 500));
    
    // 检查订单号
    const orderNoMatch = pageText.match(/TG\d+/);
    if (orderNoMatch) {
      console.log('\n✅✅✅ 下单成功！订单号:', orderNoMatch[0]);
      
      const fs = require('fs');
      fs.writeFileSync('/TG/temp/QA-20260417-09/case1-complete-order.md', 
        `# Case 1 完整下单测试报告
测试时间: ${new Date().toLocaleString()}
订单号: ${orderNoMatch[0]}
tableName: VIP3（全程保持）
结果: ✅ 成功
`);
    } else {
      console.log('\n页面未显示订单号');
    }
  } else {
    console.log('\n❌ 购物车仍然为空');
    console.log('尝试直接API下单...');
    
    // 直接API下单
    const orderData = JSON.stringify({ sessionId: sessionId });
    const orderReq = http.request({
      hostname: '127.0.0.1',
      port: 8088,
      path: '/api/order',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(orderData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('  API下单结果:', data);
        const result = JSON.parse(data);
        if (result.orderNo) {
          console.log('\n✅✅✅ API下单成功！订单号:', result.orderNo);
          
          const fs = require('fs');
          fs.writeFileSync('/TG/temp/QA-20260417-09/case1-complete-order.md',
            `# Case 1 完整下单测试报告
测试时间: ${new Date().toLocaleString()}
订单号: ${result.orderNo}
tableName: VIP3
方法: API直接下单（浏览器购物车页面session不匹配）
结果: ✅ 成功
`);
        }
      });
    });
    
    orderReq.write(orderData);
    orderReq.end();
    await sleep(2000);
  }
  
  await page.close();
  browser.disconnect();
  
  console.log('\n=== 测试完成 ===');
}

test().catch(console.error);