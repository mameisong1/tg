const puppeteer = require('puppeteer');

async function test() {
  console.log('=== 检查购物车页面是否正常加载 ===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222'
  });
  
  const page = await browser.newPage();
  
  // 监听console日志
  page.on('console', msg => {
    console.log('浏览器Console:', msg.text());
  });
  
  // 监听错误
  page.on('pageerror', err => {
    console.log('页面错误:', err.message);
  });
  
  await page.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.setItem('tableName', 'VIP3');
    localStorage.setItem('coachToken', '助教token');
    localStorage.setItem('coachInfo', JSON.stringify({coachNo:'10011'}));
  });
  
  console.log('导航到购物车...');
  await page.goto('http://127.0.0.1:8089/pages/cart/cart', { waitUntil: 'networkidle2' });
  
  console.log('等待3秒...');
  await new Promise(r => setTimeout(r, 3000));
  
  // 检查页面内容
  const pageContent = await page.evaluate(() => {
    return {
      title: document.title,
      bodyText: document.body.innerText.substring(0, 500),
      hasVueApp: !!document.querySelector('#app'),
      appInnerHTML: document.querySelector('#app')?.innerHTML?.substring(0, 300) || '无app',
      allElements: document.querySelectorAll('*').length,
      hasCartList: !!document.querySelector('.cart-list'),
      hasProductCard: !!document.querySelector('.product-card')
    };
  });
  
  console.log('页面内容:', JSON.stringify(pageContent, null, 2));
  
  // 检查localStorage
  const storage = await page.evaluate(() => ({
    tableName: localStorage.getItem('tableName'),
    coachToken: localStorage.getItem('coachToken'),
    coachInfo: localStorage.getItem('coachInfo')
  }));
  console.log('localStorage:', JSON.stringify(storage, null, 2));
  
  await page.close();
  browser.disconnect();
}

test().catch(console.error);