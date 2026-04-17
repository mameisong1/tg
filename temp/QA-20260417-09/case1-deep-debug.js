const puppeteer = require('puppeteer');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function test() {
  console.log('=== 深度调试：检查Vue组件内部状态 ===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222'
  });
  
  const page = await browser.newPage();
  
  // Step 1: 直接进入首页并设置storage
  console.log('Step 1: 进入首页并设置storage');
  await page.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await sleep(3000);
  
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('tableName', 'VIP3');
    localStorage.setItem('tableAuth', JSON.stringify({
      table: 'VIP3',
      tableName: 'VIP3',
      time: Date.now()
    }));
  });
  
  // Step 2: 用完整URL直接打开商品页（不使用hash路由）
  console.log('\nStep 2: 直接打开商品页（完整刷新）');
  
  // 关闭当前页，新开一个直接到商品页的URL
  await page.goto('http://127.0.0.1:8089/#/pages/products/products', { waitUntil: 'load' });
  
  // 等待Vue完全初始化
  await sleep(10000);
  
  // Step 3: 检查Vue组件状态
  console.log('\nStep 3: 检查Vue组件内部状态');
  
  const vueState = await page.evaluate(() => {
    // 检查localStorage
    const storage = {
      tableName: localStorage.getItem('tableName'),
      tableAuth: localStorage.getItem('tableAuth')
    };
    
    // 尝试获取Vue组件实例（uni-app H5）
    // 通过__uniConfig或其他方式检查
    const uniConfig = window.__uniConfig || {};
    const uniRoutes = window.__uniRoutes || [];
    
    // 检查页面显示的台桌信息
    const bodyText = document.body.innerText;
    const tableInfoElements = document.querySelectorAll('.table-info, [class*="table"]');
    
    return {
      storage,
      uniConfig,
      uniRoutesLength: uniRoutes.length,
      bodyText: bodyText.substring(0, 300),
      showsVIP3: bodyText.includes('VIP3'),
      tableInfoCount: tableInfoElements.length
    };
  });
  
  console.log('Vue状态:', JSON.stringify(vueState, null, 2));
  
  // Step 4: 监听点击后的网络请求
  console.log('\nStep 4: 点击加车按钮并监听请求');
  
  let requestLog = [];
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      requestLog.push({
        method: req.method(),
        url: req.url(),
        body: req.postData()
      });
    }
  });
  
  // 点击第一个加车按钮
  const clickInfo = await page.evaluate(() => {
    const addBtn = document.querySelector('.add-cart-btn');
    if (!addBtn) return {found: false};
    
    // 获取按钮的父元素信息
    const parent = addBtn.closest('.product-item, .product-card');
    const productName = parent ? parent.querySelector('.product-name, .name')?.innerText : '未知';
    
    // 点击
    addBtn.click();
    
    return {
      found: true,
      productName,
      buttonText: addBtn.innerText
    };
  });
  
  console.log('点击的按钮:', clickInfo);
  
  await sleep(5000);
  
  console.log('点击后5秒内的API请求:', requestLog);
  
  // Step 5: 检查购物车
  console.log('\nStep 5: 进入购物车检查');
  await page.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'load' });
  await sleep(8000);
  
  const cartInfo = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    return {
      tableName: localStorage.getItem('tableName'),
      hasProduct: bodyText.includes('可乐') || bodyText.includes('¥'),
      bodyText: bodyText.substring(0, 400)
    };
  });
  
  console.log('购物车:', cartInfo);
  
  if (cartInfo.hasProduct) {
    console.log('\n✅ 加车成功！');
    
    // 下单
    console.log('\nStep 6: 下单');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, uni-button'));
      const submitBtn = btns.find(b => b.innerText.includes('下单'));
      if (submitBtn) submitBtn.click();
    });
    
    await sleep(5000);
    
    const orderResult = await page.evaluate(() => document.body.innerText);
    console.log('下单结果:', orderResult.substring(0, 500));
    
    if (orderResult.includes('成功')) {
      console.log('\n✅✅✅ 下单成功！');
    }
  } else {
    console.log('\n❌ 加车失败');
    console.log('请求日志:', requestLog);
  }
  
  await page.close();
  browser.disconnect();
  
  console.log('\n=== 测试完成 ===');
}

test().catch(console.error);