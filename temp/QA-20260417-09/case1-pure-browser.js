const puppeteer = require('puppeteer');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function test() {
  console.log('=== Case 1: 纯浏览器完整下单测试 ===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222'
  });
  
  const page = await browser.newPage();
  
  // 监听网络请求
  let cartApiCalled = false;
  let cartRequestBody = null;
  
  page.on('request', request => {
    if (request.url().includes('/api/cart')) {
      cartApiCalled = true;
      cartRequestBody = request.postData();
      console.log('[网络请求] POST /api/cart', cartRequestBody);
    }
    if (request.url().includes('/api/order')) {
      console.log('[网络请求] POST /api/order');
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/api/cart')) {
      console.log('[网络响应] /api/cart 状态:', response.status());
    }
    if (response.url().includes('/api/order')) {
      console.log('[网络响应] /api/order 状态:', response.status());
      response.text().then(text => {
        console.log('[下单响应]', text);
        const result = JSON.parse(text);
        if (result.orderNo) {
          console.log('\n✅✅✅ 下单成功！订单号:', result.orderNo);
        }
      });
    }
  });
  
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
  
  // Step 2: 进入商品页
  console.log('\nStep 2: 进入商品页');
  await page.goto('http://127.0.0.1:8089/#/pages/products/products', { waitUntil: 'domcontentloaded' });
  await sleep(8000);  // 等待页面完全加载
  
  tableName = await page.evaluate(() => localStorage.getItem('tableName'));
  console.log('  商品页 tableName:', tableName);
  
  // 等待商品列表加载
  console.log('\nStep 3: 等待商品加载并找到加车按钮');
  await sleep(5000);
  
  // 截图看看页面状态
  await page.screenshot({path: '/TG/temp/QA-20260417-09/products-page.png'});
  console.log('  已截图保存到 products-page.png');
  
  // 查找所有可能的加车按钮
  const pageContent = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, [class*="add"], [class*="cart"], uni-button'));
    return {
      buttonCount: buttons.length,
      buttonTexts: buttons.map(b => b.innerText || b.className).slice(0, 20),
      pageText: document.body.innerText.substring(0, 500)
    };
  });
  console.log('  页面按钮数:', pageContent.buttonCount);
  console.log('  按钮文本:', pageContent.buttonTexts);
  console.log('  页面内容:', pageContent.pageText.substring(0, 300));
  
  // 找并点击加车按钮
  console.log('\nStep 4: 点击加车按钮');
  cartApiCalled = false;
  
  // 尝试多种方式点击加车
  try {
    // 方式1: 点击.add-cart-btn
    const addBtn = await page.$('.add-cart-btn');
    if (addBtn) {
      console.log('  找到.add-cart-btn，点击...');
      await addBtn.click();
      await sleep(3000);
    } else {
      // 方式2: 找包含"+"或"加"的按钮
      const buttons = await page.$$('button, uni-button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.innerText, btn);
        const className = await page.evaluate(el => el.className, btn);
        if (text.includes('+') || className.includes('add') || className.includes('cart')) {
          console.log('  找到按钮:', text, className);
          await btn.click();
          await sleep(2000);
          break;
        }
      }
    }
    
    // 检查API是否被调用
    console.log('  加车API是否被调用:', cartApiCalled);
    if (cartApiCalled) {
      console.log('  加车请求内容:', cartRequestBody);
    }
  } catch (e) {
    console.log('  点击失败:', e.message);
  }
  
  // Step 5: 进入购物车
  console.log('\nStep 5: 进入购物车');
  await page.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'domcontentloaded' });
  await sleep(8000);
  
  tableName = await page.evaluate(() => localStorage.getItem('tableName'));
  console.log('  tableName:', tableName);
  
  // 截图
  await page.screenshot({path: '/TG/temp/QA-20260417-09/cart-page.png'});
  console.log('  已截图保存到 cart-page.png');
  
  const cartContent = await page.evaluate(() => {
    const items = document.querySelectorAll('.cart-item, .item, [class*="cart"]');
    const pageText = document.body.innerText;
    return {
      itemCount: items.length,
      hasProduct: pageText.includes('可乐') || pageText.includes('商品') || pageText.includes('¥'),
      pageText: pageText.substring(0, 500)
    };
  });
  console.log('  购物车商品数:', cartContent.itemCount);
  console.log('  有商品:', cartContent.hasProduct);
  console.log('  页面内容:', cartContent.pageText);
  
  // 如果购物车有商品，下单
  if (cartContent.hasProduct) {
    console.log('\nStep 6: 点击下单按钮');
    
    const buttons = await page.$$('button, uni-button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.innerText, btn);
      if (text.includes('下单') || text.includes('提交') || text.includes('结算')) {
        console.log('  找到下单按钮:', text);
        await btn.click();
        await sleep(5000);
        
        // 检查下单结果
        const resultText = await page.evaluate(() => document.body.innerText);
        console.log('  下单后页面:', resultText.substring(0, 500));
        
        if (resultText.includes('成功')) {
          console.log('\n✅✅✅ 下单成功！');
          
          // 查数据库获取订单号
          // ...
        }
        break;
      }
    }
  } else {
    console.log('\n❌ 购物车为空，无法下单');
    console.log('加车API是否被调用:', cartApiCalled);
    console.log('可能原因：');
    console.log('  1. 加车按钮点击没有触发API请求');
    console.log('  2. session_id不匹配');
  }
  
  await page.close();
  browser.disconnect();
  
  console.log('\n=== 测试完成 ===');
}

test().catch(console.error);