const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function debug() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  let page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
  
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 5000));
  
  // 直接用 fetch 调用后端 API
  console.log('直接调用后端 API');
  const result = await page.evaluate(async () => {
    try {
      const response = await fetch('http://127.0.0.1:8088/api/member/login-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: '18600000004', 
          code: '888888',
          deviceFingerprint: 'test-fingerprint'
        })
      });
      const data = await response.json();
      return { success: true, data };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  console.log('API 结果:', JSON.stringify(result, null, 2));
  
  // 如果登录成功，存储 token
  if (result.success && result.data?.token) {
    await page.evaluate((token, member) => {
      localStorage.setItem('memberToken', token);
      localStorage.setItem('memberInfo', JSON.stringify(member));
    }, result.data.token, result.data.member);
    
    console.log('已存储 token');
    
    // 刷新页面
    await page.evaluate(() => location.reload());
    await new Promise(r => setTimeout(r, 5000));
    
    // 检查页面
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 100));
    console.log('刷新后页面:', pageText);
    
    // 检查 Storage
    const storage = await page.evaluate(() => ({
      memberToken: localStorage.getItem('memberToken'),
      memberInfo: localStorage.getItem('memberInfo')
    }));
    console.log('Storage:', storage);
  }
  
  browser.disconnect();
}

debug();