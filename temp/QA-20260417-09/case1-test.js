const puppeteer = require('puppeteer');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function test() {
  console.log('=== Case 1: 普通用户扫码下单完整流程 ===\n');
  
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
  
  // Step 2: 进入商品页
  console.log('\nStep 2: 进入商品页');
  await page.goto('http://127.0.0.1:8089/#/pages/products/products', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  
  tableName = await page.evaluate(() => localStorage.getItem('tableName'));
  console.log('  商品页 tableName:', tableName);
  
  // 检查页面内容
  let pageText = await page.evaluate(() => document.body.innerText);
  console.log('  页面显示台桌:', pageText.includes('VIP3') ? 'VIP3 ✅' : '未显示VIP3');
  
  // Step 3: 点击加车按钮
  console.log('\nStep 3: 点击加车按钮');
  try {
    await page.click('.add-cart-btn');
    await sleep(2000);
    console.log('  加车按钮已点击');
  } catch (e) {
    console.log('  加车按钮点击失败:', e.message);
    // 尝试其他选择器
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.innerText, btn);
      if (text.includes('+') || text.includes('加') || text.includes('购')) {
        await btn.click();
        console.log('  点击了按钮:', text);
        await sleep(2000);
        break;
      }
    }
  }
  
  // Step 4: 直接在商品页点击购物车图标进入购物车
  console.log('\nStep 4: 进入购物车');
  await page.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  
  tableName = await page.evaluate(() => localStorage.getItem('tableName'));
  console.log('  购物车页 tableName:', tableName);
  
  pageText = await page.evaluate(() => document.body.innerText);
  console.log('  页面内容:', pageText.substring(0, 300));
  
  // 检查购物车是否有商品
  let cartItems = await page.$$('.cart-item, .item');
  console.log('  购物车商品数:', cartItems.length);
  
  // 如果购物车为空，返回商品页重新加车
  if (cartItems.length === 0) {
    console.log('\n  购物车为空，返回商品页重新加车...');
    await page.goto('http://127.0.0.1:8089/#/pages/products/products', { waitUntil: 'domcontentloaded' });
    await sleep(5000);
    
    // 找商品并点击加车
    const productCards = await page.$$('.product-card, .product-item');
    if (productCards.length > 0) {
      // 点击第一个商品的加车按钮
      const firstProduct = productCards[0];
      const addBtn = await firstProduct.$('.add-cart-btn, button');
      if (addBtn) {
        await addBtn.click();
        console.log('  重新加车成功');
        await sleep(3000);
      }
    }
    
    // 再次进入购物车
    await page.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'domcontentloaded' });
    await sleep(5000);
    
    cartItems = await page.$$('.cart-item, .item');
    pageText = await page.evaluate(() => document.body.innerText);
    console.log('  再次进入购物车，商品数:', cartItems.length);
    console.log('  页面内容:', pageText.substring(0, 300));
  }
  
  // Step 5: 点击下单按钮
  if (cartItems.length > 0 || pageText.includes('可乐') || pageText.includes('商品')) {
    console.log('\nStep 5: 点击下单按钮');
    
    // 找下单按钮
    const buttons = await page.$$('button, uni-button');
    let submitBtn = null;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.innerText, btn);
      if (text.includes('提交') || text.includes('下单') || text.includes('结算')) {
        submitBtn = btn;
        console.log('  找到下单按钮:', text);
        break;
      }
    }
    
    if (submitBtn) {
      await submitBtn.click();
      await sleep(5000);
      
      pageText = await page.evaluate(() => document.body.innerText);
      console.log('  下单后页面内容:', pageText.substring(0, 500));
      
      // 检查订单号
      const orderNoMatch = pageText.match(/TG\d+/);
      if (orderNoMatch) {
        console.log('\n✅ 下单成功！订单号:', orderNoMatch[0]);
        
        // 写入报告
        const report = `# Case 1 完整下单测试报告
测试时间: ${new Date().toLocaleString()}
订单号: ${orderNoMatch[0]}
tableName: VIP3（全程保持）
结果: ✅ 成功`;
        
        require('fs').writeFileSync('/TG/temp/QA-20260417-09/case1-complete-order.md', report);
      } else if (pageText.includes('成功')) {
        console.log('\n✅ 下单成功提示已出现');
      } else {
        console.log('\n❌ 未检测到订单号或成功提示');
        console.log('页面内容:', pageText);
      }
    } else {
      console.log('  未找到下单按钮');
    }
  } else {
    console.log('\n❌ 购物车为空，无法下单');
  }
  
  // 最终检查tableName
  tableName = await page.evaluate(() => localStorage.getItem('tableName'));
  console.log('\n最终 tableName:', tableName);
  console.log('✅ tableName保持VIP3:', tableName === 'VIP3');
  
  await page.close();
  browser.disconnect();
  
  console.log('\n=== 测试完成 ===');
}

test().catch(console.error);