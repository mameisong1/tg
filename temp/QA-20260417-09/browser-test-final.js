const puppeteer = require('puppeteer');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function test() {
  console.log('=== 浏览器测试全部6个Case ===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222'
  });
  
  // ========== Case 1: 普通用户扫码下单 ==========
  console.log('【Case 1: 普通用户扫码下单】');
  const page1 = await browser.newPage();
  
  // 先进入首页获取uni-app上下文
  await page1.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await sleep(2000);
  
  // 在首页内设置localStorage
  console.log('1. 设置扫码状态（tableName=VIP3）');
  await page1.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('tableName', 'VIP3');
    localStorage.setItem('tableAuth', JSON.stringify({table:'VIP3', tableName:'VIP3', time:Date.now()}));
  });
  
  let tableName = await page1.evaluate(() => localStorage.getItem('tableName'));
  console.log('   localStorage.tableName:', tableName);
  
  // 进入商品页
  console.log('2. 进入商品页');
  await page1.goto('http://127.0.0.1:8089/#/pages/products/products', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  
  tableName = await page1.evaluate(() => localStorage.getItem('tableName'));
  console.log('   进入商品页后 tableName:', tableName);
  
  // 点击第一个商品的加车按钮
  console.log('3. 点击加车按钮');
  await page1.click('.add-cart-btn');
  await sleep(2000);
  
  // 进入购物车
  console.log('4. 进入购物车');
  await page1.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  
  tableName = await page1.evaluate(() => localStorage.getItem('tableName'));
  console.log('   进入购物车后 tableName:', tableName);
  
  // 检查购物车内容
  const cart1 = await page1.evaluate(() => {
    const items = document.querySelectorAll('.cart-item');
    const tableInfo = document.querySelector('.table-info-wrapper, .employee-table-bar');
    const pageText = document.body.innerText;
    return {
      itemCount: items.length,
      tableInfo: tableInfo ? tableInfo.innerText : '无',
      hasVIP3: pageText.includes('VIP3'),
      pageText: pageText.substring(0, 200)
    };
  });
  console.log('   购物车:', JSON.stringify(cart1, null, 2));
  
  // 点击下单按钮
  if (cart1.itemCount > 0) {
    console.log('5. 点击下单按钮');
    await page1.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, uni-button, .submit-btn'));
      const submitBtn = btns.find(b => b.innerText.includes('提交') || b.innerText.includes('下单'));
      if (submitBtn) submitBtn.click();
    });
    await sleep(3000);
    
    const result1 = await page1.evaluate(() => {
      const modal = document.querySelector('.uni-modal, .result-modal');
      const toast = document.querySelector('.uni-toast');
      return {
        hasModal: !!modal,
        modalText: modal ? modal.innerText : null,
        hasToast: !!toast,
        bodyText: document.body.innerText.substring(0, 300)
      };
    });
    console.log('   下单结果:', JSON.stringify(result1, null, 2));
    
    const success = result1.bodyText.includes('成功') || result1.bodyText.includes('TG');
    console.log('✅ Case 1:', success ? '下单成功' : '下单失败');
  } else {
    console.log('❌ Case 1: 购物车为空，无法下单');
  }
  
  await page1.close();
  console.log('');
  
  // ========== Case 2: 助教购物车无台桌下单报错 ==========
  console.log('【Case 2: 助教购物车无台桌下单报错】');
  const page2 = await browser.newPage();
  
  await page2.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await sleep(2000);
  
  console.log('1. 设置助教登录状态');
  await page2.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('tableName', '普台5');  // 先设置旧记忆
    localStorage.setItem('coachToken', 'test-coach-token');
    localStorage.setItem('coachInfo', JSON.stringify({coachNo:'10011', stageName:'十七', employee_id:'12'}));
  });
  
  tableName = await page2.evaluate(() => localStorage.getItem('tableName'));
  console.log('   初始 tableName:', tableName);
  console.log('   coachToken:', await page2.evaluate(() => localStorage.getItem('coachToken')));
  
  // 进入购物车
  console.log('2. 进入购物车（员工模式应清空tableName）');
  await page2.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  
  tableName = await page2.evaluate(() => localStorage.getItem('tableName'));
  console.log('   进入购物车后 tableName:', tableName);
  
  const cart2 = await page2.evaluate(() => {
    const employeeBar = document.querySelector('.employee-table-bar');
    const tableInfo = document.querySelector('.table-info-wrapper');
    const pageText = document.body.innerText;
    return {
      hasEmployeeBar: !!employeeBar,
      employeeBarText: employeeBar ? employeeBar.innerText : null,
      tableInfoText: tableInfo ? tableInfo.innerText : null,
      pageText: pageText.substring(0, 200)
    };
  });
  console.log('   购物车显示:', JSON.stringify(cart2, null, 2));
  
  // 验证：tableName应为空或null，页面显示"未选择"
  const cleared = tableName === null || tableName === '' || tableName === 'null';
  const showsUnselected = cart2.pageText.includes('未选择') || cart2.pageText.includes('台桌：');
  console.log('✅ Case 2:', cleared && showsUnselected ? 'tableName已清空，显示未选择' : 'tableName未清空');
  
  await page2.close();
  console.log('');
  
  // ========== Case 3: 后台用户购物车无台桌下单报错 ==========
  console.log('【Case 3: 后台用户购物车无台桌下单报错】');
  const page3 = await browser.newPage();
  
  await page3.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await sleep(2000);
  
  console.log('1. 设置后台登录状态');
  await page3.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('tableName', '普台5');
    localStorage.setItem('adminToken', 'test-admin-token');
    localStorage.setItem('adminInfo', JSON.stringify({username:'tgadmin'}));
  });
  
  tableName = await page3.evaluate(() => localStorage.getItem('tableName'));
  console.log('   初始 tableName:', tableName);
  console.log('   adminToken:', await page3.evaluate(() => localStorage.getItem('adminToken')));
  
  console.log('2. 进入购物车');
  await page3.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  
  tableName = await page3.evaluate(() => localStorage.getItem('tableName'));
  console.log('   进入购物车后 tableName:', tableName);
  
  const cart3 = await page3.evaluate(() => {
    const employeeBar = document.querySelector('.employee-table-bar');
    const pageText = document.body.innerText;
    return {
      hasEmployeeBar: !!employeeBar,
      employeeBarText: employeeBar ? employeeBar.innerText : null,
      pageText: pageText.substring(0, 200)
    };
  });
  console.log('   购物车显示:', JSON.stringify(cart3, null, 2));
  
  const cleared3 = tableName === null || tableName === '' || tableName === 'null';
  console.log('✅ Case 3:', cleared3 ? 'tableName已清空' : 'tableName未清空');
  
  await page3.close();
  console.log('');
  
  // ========== Case 4: 助教服务下单无台桌报错 ==========
  console.log('【Case 4: 助教服务下单无台桌报错】');
  const page4 = await browser.newPage();
  
  await page4.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await sleep(2000);
  
  console.log('1. 设置助教登录状态');
  await page4.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('coachToken', 'test-coach-token');
    localStorage.setItem('coachInfo', JSON.stringify({coachNo:'10011', stageName:'十七', employee_id:'12'}));
  });
  
  console.log('2. 进入服务下单页');
  await page4.goto('http://127.0.0.1:8089/#/pages/internal/service-order', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  
  const service4 = await page4.evaluate(() => {
    // 查找台桌号字段
    const items = document.querySelectorAll('.form-item');
    let tableField = null;
    for (const item of items) {
      if (item.innerText.includes('台桌') || item.innerText.includes('桌号')) {
        tableField = item.innerText;
        break;
      }
    }
    const pageText = document.body.innerText;
    return {
      tableField: tableField,
      hasEmptyTable: pageText.includes('请选择'),
      pageText: pageText.substring(0, 200)
    };
  });
  console.log('   服务下单页:', JSON.stringify(service4, null, 2));
  
  console.log('✅ Case 4:', service4.hasEmptyTable ? '台桌号字段为空"请选择"' : '台桌号有值');
  
  await page4.close();
  console.log('');
  
  // ========== Case 5: 后台用户服务下单无台桌报错 ==========
  console.log('【Case 5: 后台用户服务下单无台桌报错】');
  const page5 = await browser.newPage();
  
  await page5.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await sleep(2000);
  
  console.log('1. 设置后台登录状态');
  await page5.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('adminToken', 'test-admin-token');
    localStorage.setItem('adminInfo', JSON.stringify({username:'tgadmin'}));
  });
  
  console.log('2. 进入服务下单页');
  await page5.goto('http://127.0.0.1:8089/#/pages/internal/service-order', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  
  const service5 = await page5.evaluate(() => {
    const items = document.querySelectorAll('.form-item');
    let tableField = null;
    for (const item of items) {
      if (item.innerText.includes('台桌') || item.innerText.includes('桌号')) {
        tableField = item.innerText;
        break;
      }
    }
    const pageText = document.body.innerText;
    return {
      tableField: tableField,
      hasEmptyTable: pageText.includes('请选择'),
      pageText: pageText.substring(0, 200)
    };
  });
  console.log('   服务下单页:', JSON.stringify(service5, null, 2));
  
  console.log('✅ Case 5:', service5.hasEmptyTable ? '台桌号字段为空"请选择"' : '台桌号有值');
  
  await page5.close();
  console.log('');
  
  // ========== Case 6: 普通用户无台桌下单报错（补充） ==========
  console.log('【Case 6: 普通用户无台桌下单报错】');
  const page6 = await browser.newPage();
  
  await page6.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await sleep(2000);
  
  console.log('1. 设置无台桌状态（模拟扫码过期）');
  await page6.evaluate(() => {
    localStorage.clear();
    // 不设置tableName
  });
  
  console.log('2. 进入商品页加车');
  await page6.goto('http://127.0.0.1:8089/#/pages/products/products', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  
  await page6.click('.add-cart-btn');
  await sleep(2000);
  
  console.log('3. 进入购物车');
  await page6.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  
  const cart6 = await page6.evaluate(() => {
    const pageText = document.body.innerText;
    return {
      hasItems: document.querySelectorAll('.cart-item').length > 0,
      pageText: pageText.substring(0, 200)
    };
  });
  console.log('   购物车:', JSON.stringify(cart6, null, 2));
  
  if (cart6.hasItems) {
    console.log('4. 点击下单（应报错）');
    await page6.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, uni-button, .submit-btn'));
      const submitBtn = btns.find(b => b.innerText.includes('提交') || b.innerText.includes('下单'));
      if (submitBtn) submitBtn.click();
    });
    await sleep(3000);
    
    const result6 = await page6.evaluate(() => {
      const modal = document.querySelector('.uni-modal, .result-modal');
      const toast = document.querySelector('.uni-toast');
      return {
        hasModal: !!modal,
        modalText: modal ? modal.innerText : null,
        bodyText: document.body.innerText.substring(0, 300)
      };
    });
    console.log('   下单结果:', JSON.stringify(result6, null, 2));
    
    const hasError = result6.bodyText.includes('请扫台桌码') || result6.bodyText.includes('请选择台桌');
    console.log('✅ Case 6:', hasError ? '无台桌下单报错成功' : '未报错');
  } else {
    console.log('❌ Case 6: 购物车为空');
  }
  
  await page6.close();
  
  console.log('\n=== 测试完成 ===');
  browser.disconnect();
}

test().catch(console.error);