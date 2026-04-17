const puppeteer = require('puppeteer');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
  console.log('=== Case 1: 普通用户完整下单流程（详细版） ===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222'
  });
  
  const page = await browser.newPage();
  
  // 监听所有console和网络请求
  page.on('console', msg => console.log('[Console]', msg.text()));
  
  // 监听网络请求
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.url().includes('/api/cart') || req.url().includes('/api/order')) {
      console.log('[API请求]', req.method(), req.url(), req.postData());
    }
    req.continue();
  });
  
  page.on('response', res => {
    if (res.url().includes('/api/cart') || res.url().includes('/api/order')) {
      console.log('[API响应]', res.status(), res.url());
      res.text().then(body => {
        console.log('[响应内容]', body.substring(0, 200));
      });
    }
  });
  
  // Step 1: 进入首页，设置localStorage
  console.log('\n--- Step 1: 设置扫码状态 ---');
  await page.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await sleep(500);
  
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('tableName', 'VIP3');
    localStorage.setItem('tableAuth', JSON.stringify({table:'VIP3', tableName:'VIP3', time:Date.now()}));
  });
  
  console.log('localStorage.tableName:', await page.evaluate(() => localStorage.getItem('tableName')));
  
  // Step 2: 进入商品页
  console.log('\n--- Step 2: 进入商品页 ---');
  await page.goto('http://127.0.0.1:8089/#/pages/products/products', { waitUntil: 'domcontentloaded' });
  await sleep(5000); // 等待页面完全加载
  
  // 检查商品
  const productInfo = await page.evaluate(() => {
    const firstCard = document.querySelector('.product-card');
    if (firstCard) {
      const name = firstCard.querySelector('.product-name')?.innerText;
      const price = firstCard.querySelector('.product-price')?.innerText;
      const addBtn = firstCard.querySelector('.add-cart-btn');
      return {
        name: name,
        price: price,
        hasAddBtn: !!addBtn,
        cardHTML: firstCard.innerHTML.substring(0, 200)
      };
    }
    return null;
  });
  console.log('第一个商品:', JSON.stringify(productInfo, null, 2));
  
  // 点击加车按钮（多次点击确保触发）
  if (productInfo?.hasAddBtn) {
    console.log('\n点击加车按钮...');
    
    // 方式1: 直接click
    await page.click('.add-cart-btn');
    await sleep(2000);
    
    // 方式2: 触发click事件
    await page.evaluate(() => {
      const btn = document.querySelector('.add-cart-btn');
      if (btn) {
        btn.dispatchEvent(new MouseEvent('click', {bubbles: true}));
      }
    });
    await sleep(2000);
    
    // 方式3: 触发Vue的quickAdd
    await page.evaluate(() => {
      // 找到Vue组件实例并调用方法
      const card = document.querySelector('.product-card');
      if (card) {
        card.click();
      }
    });
    await sleep(2000);
  }
  
  // 检查购物车图标数量
  const cartBadge = await page.evaluate(() => {
    const badge = document.querySelector('.cart-badge, .uni-badge');
    return badge ? badge.innerText : '无badge';
  });
  console.log('购物车badge:', cartBadge);
  
  // Step 3: 进入购物车
  console.log('\n--- Step 3: 进入购物车 ---');
  await page.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  
  const cartInfo = await page.evaluate(() => {
    const items = document.querySelectorAll('.cart-item');
    const emptyText = document.body.innerText;
    const tableNameDisplay = document.querySelector('.table-info-wrapper')?.innerText;
    
    return {
      itemCount: items.length,
      isEmpty: emptyText.includes('购物车是空的'),
      tableNameDisplay: tableNameDisplay,
      pageText: emptyText.substring(0, 150),
      storageTableName: localStorage.getItem('tableName')
    };
  });
  console.log('购物车信息:', JSON.stringify(cartInfo, null, 2));
  
  // Step 4: 如果购物车有商品，点击下单
  if (cartInfo.itemCount > 0) {
    console.log('\n--- Step 4: 点击下单 ---');
    
    // 查找下单按钮
    const btnText = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, .submit-btn, .order-btn'));
      return btns.map(b => b.innerText).join(', ');
    });
    console.log('按钮:', btnText);
    
    // 点击下单
    await page.evaluate(() => {
      const submitBtn = document.querySelector('.submit-btn, .order-btn');
      if (submitBtn) submitBtn.click();
    });
    
    await sleep(3000);
    
    // 检查结果
    const result = await page.evaluate(() => {
      const modal = document.querySelector('.uni-modal, .result-modal');
      return modal ? modal.innerText : '无弹窗';
    });
    console.log('下单结果:', result);
  } else {
    console.log('\n购物车为空，无法下单');
    console.log('可能原因：加车API未正确调用或商品数据问题');
    
    // 检查数据库购物车表
    console.log('\n检查数据库购物车...');
  }
  
  await page.close();
  browser.disconnect();
  
  console.log('\n=== 测试结束 ===');
}

test().catch(console.error);