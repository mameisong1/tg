const puppeteer = require('puppeteer');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function test() {
  console.log('=== Case 1: 正确流程 - 先设置storage再进入页面 ===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222'
  });
  
  const page = await browser.newPage();
  
  // 监听API请求
  let addCartCalled = false;
  let addCartBody = null;
  
  page.on('request', request => {
    if (request.url().includes('/api/cart') && request.method() === 'POST') {
      addCartCalled = true;
      addCartBody = request.postData();
      console.log('[API] POST /api/cart:', addCartBody);
    }
  });
  
  page.on('response', async response => {
    if (response.url().includes('/api/cart') && response.status() === 200) {
      try {
        const text = await response.text();
        console.log('[API响应]', text);
      } catch(e) {}
    }
  });
  
  // ========== 关键：先在首页设置localStorage ==========
  console.log('Step 1: 进入首页（空白状态）');
  await page.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await sleep(3000);
  
  console.log('\nStep 2: 在首页设置localStorage（模拟扫码）');
  await page.evaluate(() => {
    localStorage.clear();
    // 设置tableName
    localStorage.setItem('tableName', 'VIP3');
    // 设置tableAuth（有效期30分钟）
    localStorage.setItem('tableAuth', JSON.stringify({
      table: 'VIP3',
      tableName: 'VIP3',
      time: Date.now() - 1000  // 确保不是未来时间
    }));
  });
  
  // 验证设置成功
  const storageCheck = await page.evaluate(() => ({
    tableName: localStorage.getItem('tableName'),
    tableAuth: localStorage.getItem('tableAuth')
  }));
  console.log('  localStorage已设置:', storageCheck);
  
  // ========== 关键：刷新页面让Vue组件重新初始化 ==========
  console.log('\nStep 3: 刷新首页，让Vue读取storage');
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(5000);
  
  // ========== 然后进入商品页 ==========
  console.log('\nStep 4: 进入商品页（Vue会读取已设置的storage）');
  await page.goto('http://127.0.0.1:8089/#/pages/products/products', { waitUntil: 'domcontentloaded' });
  await sleep(8000);
  
  // 检查tableName ref是否正确读取
  const pageState = await page.evaluate(() => {
    // 检查页面是否显示VIP3
    const bodyText = document.body.innerText;
    return {
      localStorageTableName: localStorage.getItem('tableName'),
      showsVIP3: bodyText.includes('VIP3'),
      bodyText: bodyText.substring(0, 200)
    };
  });
  console.log('  页面状态:', pageState);
  
  // ========== 点击加车按钮 ==========
  console.log('\nStep 5: 点击第一个商品的加车按钮');
  addCartCalled = false;
  
  await page.evaluate(() => {
    const addBtn = document.querySelector('.add-cart-btn');
    if (addBtn) {
      console.log('找到.add-cart-btn，点击');
      addBtn.click();
    }
  });
  
  await sleep(5000);
  console.log('  API是否被调用:', addCartCalled);
  console.log('  API请求内容:', addCartBody);
  
  // ========== 进入购物车 ==========
  console.log('\nStep 6: 进入购物车');
  await page.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'domcontentloaded' });
  await sleep(8000);
  
  const cartPage = await page.evaluate(() => ({
    tableName: localStorage.getItem('tableName'),
    bodyText: document.body.innerText.substring(0, 400)
  }));
  console.log('  tableName:', cartPage.tableName);
  console.log('  页面内容:', cartPage.bodyText);
  
  const hasProduct = cartPage.bodyText.includes('可乐') || cartPage.bodyText.includes('¥6');
  console.log('  有商品:', hasProduct);
  
  // ========== 下单 ==========
  if (hasProduct) {
    console.log('\nStep 7: 点击下单按钮');
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, uni-button'));
      const submitBtn = buttons.find(b => b.innerText.includes('下单'));
      if (submitBtn) submitBtn.click();
    });
    
    await sleep(5000);
    
    const resultPage = await page.evaluate(() => document.body.innerText);
    console.log('  下单结果:', resultPage.substring(0, 500));
    
    if (resultPage.includes('成功')) {
      console.log('\n✅✅✅ 下单成功！');
    }
  } else {
    console.log('\n❌ 购物车为空');
  }
  
  await page.close();
  browser.disconnect();
  
  console.log('\n=== 测试完成 ===');
}

test().catch(console.error);