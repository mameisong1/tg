const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function debug() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  let page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
  
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 10000));
  
  // 监听 console
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  
  // 直接调用登录 API
  console.log('\n直接调用 api.loginBySms');
  const result = await page.evaluate(async () => {
    try {
      // 检查全局 api 对象
      if (typeof window.api !== 'undefined') {
        const data = await window.api.loginBySms('18600000004', '888888');
        return { success: true, data };
      }
      return { error: 'api not found' };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  console.log('API 调用结果:', result);
  
  await new Promise(r => setTimeout(r, 5000));
  
  // 检查 Storage
  const storage = await page.evaluate(() => ({
    memberToken: localStorage.getItem('memberToken'),
    memberInfo: localStorage.getItem('memberInfo')
  }));
  console.log('Storage:', storage);
  
  browser.disconnect();
}

debug();