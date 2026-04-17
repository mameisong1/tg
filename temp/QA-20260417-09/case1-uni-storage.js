const puppeteer = require('puppeteer');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function test() {
  console.log('=== Case 1: 用uni.setStorageSync设置storage ===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222'
  });
  
  const page = await browser.newPage();
  
  // 监听API
  let addCartCalled = false;
  let addCartBody = null;
  page.on('request', req => {
    if (req.url().includes('/api/cart') && req.method() === 'POST') {
      addCartCalled = true;
      addCartBody = req.postData();
      console.log('[API] POST /api/cart:', addCartBody);
    }
  });
  
  // ========== 用uni.setStorageSync设置storage ==========
  console.log('Step 1: 进入首页，用uni.setStorageSync设置');
  await page.goto('http://127.0.0.1:8089/', { waitUntil: 'load' });
  await sleep(3000);
  
  // 检查uni对象是否存在
  const uniCheck = await page.evaluate(() => ({
    hasUni: typeof window.uni !== 'undefined',
    hasSetStorageSync: typeof window.uni?.setStorageSync === 'function',
    hasGetStorageSync: typeof window.uni?.getStorageSync === 'function'
  }));
  console.log('  uni对象检查:', uniCheck);
  
  // 用uni.setStorageSync设置
  await page.evaluate(() => {
    if (window.uni && window.uni.setStorageSync) {
      window.uni.setStorageSync('tableName', 'VIP3');
      window.uni.setStorageSync('tableAuth', JSON.stringify({
        table: 'VIP3',
        tableName: 'VIP3',
        time: Date.now()
      }));
      return 'uni.setStorageSync成功';
    } else {
      // 回退到localStorage
      localStorage.setItem('tableName', 'VIP3');
      localStorage.setItem('tableAuth', JSON.stringify({
        table: 'VIP3',
        tableName: 'VIP3',
        time: Date.now()
      }));
      return '用localStorage回退';
    }
  });
  
  await sleep(2000);
  
  // 验证设置成功
  const verify = await page.evaluate(() => {
    const viaUni = window.uni?.getStorageSync?.('tableName');
    const viaLocal = localStorage.getItem('tableName');
    return {
      viaUni,
      viaLocal,
      match: viaUni === viaLocal
    };
  });
  console.log('  验证:', verify);
  
  // ========== 直接打开商品页（新页面，让Vue重新初始化）==========
  console.log('\nStep 2: 新页面直接打开商品页');
  const productPage = await browser.newPage();
  await productPage.goto('http://127.0.0.1:8089/#/pages/products/products', { waitUntil: 'load' });
  await sleep(10000);
  
  // 监听API
  productPage.on('request', req => {
    if (req.url().includes('/api/cart') && req.method() === 'POST') {
      console.log('[商品页API] POST /api/cart:', req.postData());
    }
    if (req.url().includes('/api/product-options')) {
      console.log('[商品页API] GET product-options');
    }
  });
  
  // 检查storage和页面状态
  const productState = await productPage.evaluate(() => {
    const tableNameViaUni = window.uni?.getStorageSync?.('tableName');
    const tableNameViaLocal = localStorage.getItem('tableName');
    const bodyText = document.body.innerText;
    return {
      tableNameViaUni,
      tableNameViaLocal,
      showsVIP3: bodyText.includes('VIP3'),
      bodyPreview: bodyText.substring(0, 150)
    };
  });
  console.log('  商品页状态:', productState);
  
  // ========== 点击加车 ==========
  console.log('\nStep 3: 点击加车按钮');
  
  await productPage.evaluate(() => {
    const addBtn = document.querySelector('.add-cart-btn');
    if (addBtn) {
      console.log('点击.add-cart-btn');
      addBtn.click();
    }
  });
  
  await sleep(8000);  // 等待API和弹窗
  
  // 检查是否有弹窗
  const afterClick = await productPage.evaluate(() => {
    const bodyText = document.body.innerText;
    const hasModal = bodyText.includes('请用手机相机扫码') || 
                     bodyText.includes('扫码授权已过期') ||
                     bodyText.includes('选择');
    return {
      hasModal,
      bodyText: bodyText.substring(0, 500)
    };
  });
  console.log('  点击后:', afterClick);
  
  // ========== 购物车 ==========
  console.log('\nStep 4: 进入购物车');
  await productPage.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'load' });
  await sleep(8000);
  
  const cartState = await productPage.evaluate(() => {
    const bodyText = document.body.innerText;
    return {
      tableName: localStorage.getItem('tableName'),
      hasProduct: bodyText.includes('可乐') || bodyText.includes('¥'),
      bodyText: bodyText.substring(0, 400)
    };
  });
  console.log('  购物车:', cartState);
  
  if (cartState.hasProduct) {
    console.log('\n✅ 加车成功！');
    
    // 下单
    console.log('\nStep 5: 下单');
    await productPage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, uni-button'));
      const submitBtn = btns.find(b => b.innerText.includes('下单'));
      if (submitBtn) submitBtn.click();
    });
    
    await sleep(5000);
    
    const orderResult = await productPage.evaluate(() => document.body.innerText);
    if (orderResult.includes('成功')) {
      console.log('\n✅✅✅ 下单成功！');
      
      // 查数据库
      const orderNoMatch = orderResult.match(/TG\d+/);
      if (orderNoMatch) {
        console.log('订单号:', orderNoMatch[0]);
      }
    }
  } else {
    console.log('\n❌ 加车失败');
  }
  
  await page.close();
  await productPage.close();
  browser.disconnect();
  
  console.log('\n=== 测试完成 ===');
}

test().catch(console.error);