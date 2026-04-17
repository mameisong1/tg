const puppeteer = require('puppeteer');

async function test() {
  console.log('=== 购物车页面正确导航测试 ===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222'
  });
  
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.text().includes('错误') || msg.text().includes('Error') || msg.text().includes('cart')) {
      console.log('Console:', msg.text());
    }
  });
  
  // 先进入首页
  await page.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  console.log('首页加载完成');
  
  // 设置localStorage
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('tableName', 'VIP3');
    localStorage.setItem('coachToken', 'real-coach-token');
    localStorage.setItem('coachInfo', JSON.stringify({coachNo:'10011', stageName:'十七'}));
  });
  
  console.log('localStorage已设置');
  
  // 检查首页底部是否有购物车图标
  const tabBar = await page.evaluate(() => {
    const tabs = document.querySelectorAll('.uni-tabbar__icon');
    return tabs.map(t => t.innerText || 'icon');
  });
  console.log('底部tabbar:', tabBar);
  
  // 点击购物车图标
  console.log('点击购物车图标...');
  
  // 在uni-app H5中，购物车可能在tabbar中，也可能需要通过URL访问
  // 检查是否有购物车相关的链接
  const cartLink = await page.evaluate(() => {
    // 查找购物车相关元素
    const links = Array.from(document.querySelectorAll('a, uni-view[class*="cart"]'));
    return links.map(l => ({text: l.innerText, href: l.href || 'no href', class: l.className}));
  });
  console.log('购物车相关元素:', cartLink.filter(l => l.text.includes('购物车') || l.text.includes('cart')));
  
  // 直接导航到购物车页面，等待更长时间
  console.log('导航到购物车页面（等待10秒）...');
  await page.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'domcontentloaded' });
  
  // 等待10秒让uni-app路由完成
  await new Promise(r => setTimeout(r, 10000));
  
  // 检查当前URL hash
  const currentUrl = page.url();
  console.log('当前URL:', currentUrl);
  
  // 检查页面内容
  const content = await page.evaluate(() => {
    const employeeBar = document.querySelector('.employee-table-bar');
    const cartList = document.querySelector('.cart-list');
    const pageContent = document.body.innerText.substring(0, 300);
    
    return {
      hasEmployeeBar: !!employeeBar,
      employeeBarText: employeeBar?.innerText || null,
      hasCartList: !!cartList,
      pageText: pageContent,
      tableName: localStorage.getItem('tableName'),
      coachToken: localStorage.getItem('coachToken')
    };
  });
  
  console.log('页面内容:', JSON.stringify(content, null, 2));
  
  await page.close();
  browser.disconnect();
}

test().catch(console.error);