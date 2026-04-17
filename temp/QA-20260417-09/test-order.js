const puppeteer = require('puppeteer');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
  console.log('=== Case 1: 普通用户完整下单流程 ===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222'
  });
  
  const page = await browser.newPage();
  
  // 监听console
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('错误') || text.includes('Error') || text.includes('下单') || text.includes('成功')) {
      console.log('Console:', text);
    }
  });
  
  // Step 1: 进入首页，设置localStorage模拟扫码
  console.log('Step 1: 进入首页，模拟扫码...');
  await page.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await sleep(1000);
  
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('tableName', 'VIP3');
    localStorage.setItem('tableAuth', JSON.stringify({table:'VIP3', tableName:'VIP3', time:Date.now()}));
  });
  
  let tableName = await page.evaluate(() => localStorage.getItem('tableName'));
  console.log('localStorage.tableName:', tableName);
  
  // Step 2: 进入商品页，点击商品加车
  console.log('\nStep 2: 进入商品页，添加商品到购物车...');
  await page.goto('http://127.0.0.1:8089/#/pages/products/products', { waitUntil: 'domcontentloaded' });
  await sleep(3000); // 等待页面渲染
  
  // 查找商品卡片
  const products = await page.evaluate(() => {
    const cards = document.querySelectorAll('.product-card');
    return cards.length;
  });
  console.log('商品数量:', products);
  
  // 点击第一个商品的+按钮
  const addBtn = await page.evaluate(() => {
    const btn = document.querySelector('.add-cart-btn');
    return btn ? true : false;
  });
  console.log('找到加车按钮:', addBtn);
  
  if (addBtn) {
    await page.click('.add-cart-btn');
    await sleep(1000);
    console.log('已点击加车按钮');
  }
  
  // 检查localStorage.tableName是否还在
  tableName = await page.evaluate(() => localStorage.getItem('tableName'));
  console.log('加车后 localStorage.tableName:', tableName);
  
  // Step 3: 进入购物车页
  console.log('\nStep 3: 进入购物车页...');
  await page.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  
  // 检查购物车内容
  const cartContent = await page.evaluate(() => {
    const cartList = document.querySelector('.cart-list');
    const items = document.querySelectorAll('.cart-item');
    return {
      hasCartList: !!cartList,
      itemCount: items.length,
      pageText: document.body.innerText.substring(0, 200)
    };
  });
  console.log('购物车内容:', JSON.stringify(cartContent, null, 2));
  
  tableName = await page.evaluate(() => localStorage.getItem('tableName'));
  console.log('进入购物车后 localStorage.tableName:', tableName);
  
  // Step 4: 点击下单按钮
  console.log('\nStep 4: 点击下单按钮...');
  
  // 查找下单按钮
  const orderBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, uni-button'));
    const orderBtn = btns.find(b => b.innerText.includes('下单') || b.innerText.includes('提交'));
    return orderBtn ? {text: orderBtn.innerText, className: orderBtn.className} : null;
  });
  console.log('下单按钮:', orderBtn);
  
  if (orderBtn) {
    // 点击下单
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, uni-button'));
      const orderBtn = btns.find(b => b.innerText.includes('下单') || b.innerText.includes('提交'));
      if (orderBtn) orderBtn.click();
    });
    
    await sleep(2000);
    
    // 检查是否有弹窗或提示
    const afterOrder = await page.evaluate(() => {
      const modal = document.querySelector('.uni-modal');
      const toast = document.querySelector('.uni-toast');
      const resultModal = document.querySelector('.result-modal');
      return {
        hasModal: !!modal,
        modalText: modal?.innerText || null,
        hasToast: !!toast,
        toastText: toast?.innerText || null,
        hasResultModal: !!resultModal,
        resultModalText: resultModal?.innerText || null,
        pageText: document.body.innerText.substring(0, 300)
      };
    });
    console.log('下单后页面:', JSON.stringify(afterOrder, null, 2));
    
    // 检查localStorage.tableName最终状态
    tableName = await page.evaluate(() => localStorage.getItem('tableName'));
    const tableAuth = await page.evaluate(() => localStorage.getItem('tableAuth'));
    console.log('下单后 localStorage.tableName:', tableName);
    console.log('下单后 localStorage.tableAuth:', tableAuth);
  }
  
  // Step 5: 检查订单是否创建成功
  console.log('\nStep 5: 检查数据库是否有新订单...');
  
  await page.close();
  browser.disconnect();
  
  console.log('\n=== 测试结束 ===');
}

test().catch(console.error);