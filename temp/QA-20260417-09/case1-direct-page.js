const puppeteer = require('puppeteer');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function test() {
  console.log('=== Case 1: 直接打开商品页（完整页面加载）===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222'
  });
  
  const page = await browser.newPage();
  
  // 监听API请求
  let addCartCalled = false;
  page.on('request', req => {
    if (req.url().includes('/api/cart') && req.method() === 'POST') {
      addCartCalled = true;
      console.log('[API] POST /api/cart:', req.postData());
    }
  });
  
  // ========== 关键：先在空白页设置storage ==========
  console.log('Step 1: 打开空白页设置localStorage');
  await page.goto('about:blank');
  await sleep(1000);
  
  // 设置storage
  await page.evaluate(() => {
    // 设置localStorage到即将打开的域名
    // 这需要在实际域名页面设置
  });
  
  // ========== 关键：用完整URL直接打开商品页 ==========
  console.log('\nStep 2: 直接打开商品页（完整URL）');
  
  // 先打开首页设置storage，然后立即打开商品页
  await page.goto('http://127.0.0.1:8089/', { waitUntil: 'load' });
  await sleep(2000);
  
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('tableName', 'VIP3');
    localStorage.setItem('tableAuth', JSON.stringify({
      table: 'VIP3',
      tableName: 'VIP3',
      time: Date.now()
    }));
  });
  
  // 等待一秒确保写入
  await sleep(1000);
  
  // ========== 用非hash方式重新打开商品页 ==========
  console.log('\nStep 3: 用新标签页直接打开商品页');
  
  // 关闭当前页，打开新页直接到商品页
  const newPage = await browser.newPage();
  
  // 直接打开商品页完整URL（带hash但会完整加载）
  await newPage.goto('http://127.0.0.1:8089/#/pages/products/products', { 
    waitUntil: 'load' 
  });
  
  await sleep(10000);  // 等待Vue完全初始化
  
  // 检查storage是否正确
  const checkStorage = await newPage.evaluate(() => ({
    tableName: localStorage.getItem('tableName'),
    tableAuth: localStorage.getItem('tableAuth')
  }));
  console.log('  localStorage:', checkStorage);
  
  // 检查页面显示
  const pageState = await newPage.evaluate(() => {
    const bodyText = document.body.innerText;
    return {
      showsVIP3: bodyText.includes('VIP3'),
      bodyText: bodyText.substring(0, 200)
    };
  });
  console.log('  页面状态:', pageState);
  
  // ========== 点击加车 ==========
  console.log('\nStep 4: 点击加车按钮');
  addCartCalled = false;
  
  await newPage.evaluate(() => {
    const addBtn = document.querySelector('.add-cart-btn');
    if (addBtn) addBtn.click();
  });
  
  await sleep(5000);
  console.log('  加车API是否被调用:', addCartCalled);
  
  // ========== 购物车 ==========
  console.log('\nStep 5: 进入购物车');
  await newPage.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'load' });
  await sleep(8000);
  
  const cartState = await newPage.evaluate(() => {
    const bodyText = document.body.innerText;
    return {
      tableName: localStorage.getItem('tableName'),
      hasProduct: bodyText.includes('可乐') || bodyText.includes('¥6'),
      bodyText: bodyText.substring(0, 400)
    };
  });
  console.log('  购物车:', cartState);
  
  if (cartState.hasProduct) {
    console.log('\n✅ 加车成功！');
    
    // 下单
    console.log('\nStep 6: 下单');
    await newPage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, uni-button'));
      const submitBtn = btns.find(b => b.innerText.includes('下单'));
      if (submitBtn) submitBtn.click();
    });
    
    await sleep(5000);
    
    const orderResult = await newPage.evaluate(() => document.body.innerText);
    console.log('  下单结果:', orderResult.substring(0, 500));
    
    if (orderResult.includes('成功')) {
      console.log('\n✅✅✅ 下单成功！');
    }
  } else {
    console.log('\n❌ 加车失败');
  }
  
  await page.close();
  await newPage.close();
  browser.disconnect();
  
  console.log('\n=== 测试完成 ===');
}

test().catch(console.error);