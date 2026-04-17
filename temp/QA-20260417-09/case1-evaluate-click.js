const puppeteer = require('puppeteer');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function test() {
  console.log('=== Case 1: 纯浏览器点击测试（evaluate方式）===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222'
  });
  
  const page = await browser.newPage();
  
  // 监听网络请求
  let lastCartRequest = null;
  
  page.on('request', request => {
    if (request.url().includes('/api/cart') && request.method() === 'POST') {
      lastCartRequest = {
        url: request.url(),
        body: request.postData(),
        time: new Date().toISOString()
      };
      console.log('[网络请求] POST /api/cart', lastCartRequest.body);
    }
  });
  
  page.on('response', async response => {
    if (response.url().includes('/api/cart')) {
      const status = response.status();
      console.log('[网络响应] /api/cart 状态:', status);
      if (status === 200 || status === 201) {
        try {
          const text = await response.text();
          console.log('[响应内容]', text);
        } catch(e) {}
      }
    }
  });
  
  // Step 1: 进入首页设置扫码
  console.log('Step 1: 进入首页，设置扫码状态');
  await page.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await sleep(3000);
  
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('tableName', 'VIP3');
    localStorage.setItem('tableAuth', JSON.stringify({table:'VIP3', tableName:'VIP3', time:Date.now()}));
  });
  
  let tableName = await page.evaluate(() => localStorage.getItem('tableName'));
  console.log('  tableName:', tableName);
  
  // Step 2: 进入商品页
  console.log('\nStep 2: 进入商品页');
  await page.goto('http://127.0.0.1:8089/#/pages/products/products', { waitUntil: 'domcontentloaded' });
  await sleep(10000);  // 等待页面和商品完全加载
  
  tableName = await page.evaluate(() => localStorage.getItem('tableName'));
  console.log('  tableName:', tableName);
  
  // Step 3: 在页面内部找到并点击第一个加车按钮
  console.log('\nStep 3: 用evaluate点击加车按钮');
  
  const clickResult = await page.evaluate(() => {
    // 找第一个商品的加车按钮
    const addBtns = document.querySelectorAll('.add-cart-btn');
    if (addBtns.length > 0) {
      console.log('找到', addBtns.length, '个.add-cart-btn');
      
      // 模拟真实点击
      const btn = addBtns[0];
      btn.click();
      
      // 也尝试触发touchstart/touchend（移动端事件）
      btn.dispatchEvent(new Event('touchstart', {bubbles: true}));
      btn.dispatchEvent(new Event('touchend', {bubbles: true}));
      
      return {clicked: true, btnCount: addBtns.length};
    } else {
      // 找"+"按钮
      const allBtns = Array.from(document.querySelectorAll('button, uni-button'));
      const plusBtns = allBtns.filter(b => b.innerText === '+');
      if (plusBtns.length > 0) {
        plusBtns[0].click();
        return {clicked: true, type: 'plus-btn', count: plusBtns.length};
      }
      return {clicked: false, reason: 'no buttons found'};
    }
  });
  
  console.log('  点击结果:', clickResult);
  await sleep(5000);  // 等待API响应
  
  console.log('  最后一个加车请求:', lastCartRequest);
  
  // Step 4: 进入购物车
  console.log('\nStep 4: 进入购物车');
  await page.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'domcontentloaded' });
  await sleep(8000);
  
  tableName = await page.evaluate(() => localStorage.getItem('tableName'));
  console.log('  tableName:', tableName);
  
  const cartContent = await page.evaluate(() => document.body.innerText);
  console.log('  页面内容:', cartContent.substring(0, 400));
  
  const hasProduct = cartContent.includes('可乐') || cartContent.includes('¥');
  console.log('  有商品:', hasProduct);
  
  if (hasProduct) {
    console.log('\nStep 5: 点击下单');
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, uni-button'));
      const submitBtn = buttons.find(b => b.innerText.includes('下单') || b.innerText.includes('提交'));
      if (submitBtn) {
        submitBtn.click();
        return true;
      }
      return false;
    });
    
    await sleep(5000);
    
    const resultContent = await page.evaluate(() => document.body.innerText);
    console.log('  下单结果:', resultContent.substring(0, 500));
    
    if (resultContent.includes('成功')) {
      console.log('\n✅✅✅ 下单成功！');
    }
  } else {
    console.log('\n❌ 购物车仍然为空');
    
    // 检查session_id
    const sessionInfo = await page.evaluate(() => {
      return {
        sessionId: localStorage.getItem('sessionId'),
        cartSessionId: localStorage.getItem('cartSessionId'),
        allKeys: Object.keys(localStorage)
      };
    });
    console.log('  session信息:', sessionInfo);
  }
  
  await page.close();
  browser.disconnect();
  
  console.log('\n=== 测试完成 ===');
}

test().catch(console.error);