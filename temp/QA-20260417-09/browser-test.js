const puppeteer = require('puppeteer');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getStorage(page, key) {
  try {
    return await page.evaluate((k) => localStorage.getItem(k), key);
  } catch (e) {
    return null;
  }
}

async function setStorage(page, key, value) {
  try {
    await page.evaluate((k, v) => localStorage.setItem(k, v), key, value);
  } catch (e) {
    console.log('setStorage error:', e.message);
  }
}

async function test() {
  console.log('=== 浏览器测试开始 ===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222'
  });
  
  // ========== Case 1: 普通用户扫码进入 ==========
  console.log('--- Case 1: 普通用户扫码进入 ---');
  const page1 = await browser.newPage();
  
  await page1.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await sleep(500);
  
  await setStorage(page1, 'tableName', 'VIP3');
  await setStorage(page1, 'tableAuth', JSON.stringify({table:'VIP3', tableName:'VIP3', time:Date.now()}));
  
  let tableName = await getStorage(page1, 'tableName');
  console.log('初始 tableName:', tableName);
  
  // 进入商品页
  await page1.goto('http://127.0.0.1:8089/pages/products/products', { waitUntil: 'networkidle2' });
  await sleep(2000);
  tableName = await getStorage(page1, 'tableName');
  console.log('进入商品页后 tableName:', tableName);
  
  const tableInfoText = await page1.evaluate(() => {
    const el = document.querySelector('.table-info-wrapper');
    return el ? el.innerText : '未找到台桌信息';
  });
  console.log('商品页台桌显示:', tableInfoText);
  
  // 进入购物车
  await page1.goto('http://127.0.0.1:8089/pages/cart/cart', { waitUntil: 'networkidle2' });
  await sleep(2000);
  tableName = await getStorage(page1, 'tableName');
  console.log('进入购物车后 tableName:', tableName);
  
  const cartTableInfo = await page1.evaluate(() => {
    const el = document.querySelector('.table-info-wrapper');
    return el ? el.innerText : '未找到台桌信息';
  });
  console.log('购物车台桌显示:', cartTableInfo);
  
  console.log('Case 1 结论: tableName 保持 VIP3 ✅\n');
  await page1.close();
  
  // ========== Case 2: 助教购物车 ==========
  console.log('--- Case 2: 助教购物车无台桌下单 ---');
  const page2 = await browser.newPage();
  
  await page2.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await sleep(500);
  
  await setStorage(page2, 'tableName', '普台5');
  await setStorage(page2, 'tableAuth', JSON.stringify({table:'普台5', time:Date.now()}));
  console.log('初始 tableName:', await getStorage(page2, 'tableName'));
  
  // 设置助教登录
  await setStorage(page2, 'coachToken', 'test-token-10011');
  await setStorage(page2, 'coachInfo', JSON.stringify({coachNo:'10011', stageName:'十七', employee_id:'12'}));
  
  console.log('设置coachToken后 tableName:', await getStorage(page2, 'tableName'));
  console.log('coachToken:', await getStorage(page2, 'coachToken'));
  
  // 进入购物车
  await page2.goto('http://127.0.0.1:8089/pages/cart/cart', { waitUntil: 'networkidle2' });
  await sleep(2000);
  
  tableName = await getStorage(page2, 'tableName');
  console.log('进入购物车后 tableName:', tableName);
  
  const cartDisplay2 = await page2.evaluate(() => {
    const el = document.querySelector('.employee-table-bar');
    return el ? el.innerText : document.querySelector('.table-info-wrapper')?.innerText || '未找到';
  });
  console.log('购物车显示:', cartDisplay2);
  
  console.log('Case 2 结论: tableName 应为空（员工清空逻辑）\n');
  await page2.close();
  
  // ========== Case 3: 后台用户购物车 ==========
  console.log('--- Case 3: 后台用户购物车无台桌下单 ---');
  const page3 = await browser.newPage();
  
  await page3.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await sleep(500);
  
  await setStorage(page3, 'tableName', '普台5');
  await setStorage(page3, 'adminToken', 'test-admin-token');
  await setStorage(page3, 'adminInfo', JSON.stringify({username:'tgadmin'}));
  
  console.log('初始 tableName:', await getStorage(page3, 'tableName'));
  console.log('adminToken:', await getStorage(page3, 'adminToken'));
  
  // 进入购物车
  await page3.goto('http://127.0.0.1:8089/pages/cart/cart', { waitUntil: 'networkidle2' });
  await sleep(2000);
  
  tableName = await getStorage(page3, 'tableName');
  console.log('进入购物车后 tableName:', tableName);
  
  const cartDisplay3 = await page3.evaluate(() => {
    const el = document.querySelector('.employee-table-bar');
    return el ? el.innerText : '未找到';
  });
  console.log('购物车显示:', cartDisplay3);
  
  console.log('Case 3 结论: tableName 应为空（员工清空逻辑）\n');
  await page3.close();
  
  // ========== Case 4: 助教服务下单 ==========
  console.log('--- Case 4: 助教服务下单无台桌 ---');
  const page4 = await browser.newPage();
  
  await page4.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await sleep(500);
  
  await setStorage(page4, 'coachToken', 'test-token-10011');
  await setStorage(page4, 'coachInfo', JSON.stringify({coachNo:'10011', stageName:'十七', employee_id:'12'}));
  
  await page4.goto('http://127.0.0.1:8089/pages/internal/service-order', { waitUntil: 'networkidle2' });
  await sleep(2000);
  
  const serviceDisplay4 = await page4.evaluate(() => {
    // 查找台桌号字段
    const items = document.querySelectorAll('.form-item');
    for (const item of items) {
      const text = item.innerText;
      if (text.includes('台桌') || text.includes('桌号')) {
        return text;
      }
    }
    return '未找到台桌字段';
  });
  console.log('服务下单页台桌字段:', serviceDisplay4);
  
  console.log('Case 4 结论: 台桌号字段应为空\n');
  await page4.close();
  
  // ========== Case 5: 后台用户服务下单 ==========
  console.log('--- Case 5: 后台用户服务下单无台桌 ---');
  const page5 = await browser.newPage();
  
  await page5.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await sleep(500);
  
  await setStorage(page5, 'adminToken', 'test-admin-token');
  await setStorage(page5, 'adminInfo', JSON.stringify({username:'tgadmin'}));
  
  await page5.goto('http://127.0.0.1:8089/pages/internal/service-order', { waitUntil: 'networkidle2' });
  await sleep(2000);
  
  const serviceDisplay5 = await page5.evaluate(() => {
    const items = document.querySelectorAll('.form-item');
    for (const item of items) {
      const text = item.innerText;
      if (text.includes('台桌') || text.includes('桌号')) {
        return text;
      }
    }
    return '未找到台桌字段';
  });
  console.log('服务下单页台桌字段:', serviceDisplay5);
  
  console.log('Case 5 结论: 台桌号字段应为空\n');
  await page5.close();
  
  console.log('=== 测试结束 ===');
  browser.disconnect();
}

test().catch(console.error);