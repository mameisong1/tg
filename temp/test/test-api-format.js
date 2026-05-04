const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function test() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  let page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
  
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));
  
  const result = await page.evaluate(async () => {
    try {
      const response = await fetch('http://127.0.0.1:8088/api/member/login-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '18600000004', code: '888888', deviceFingerprint: 'test' })
      });
      const data = await response.json();
      return { raw: data, hasSuccess: data.success, hasToken: data.token, hasDataSuccess: data.data?.success, hasDataToken: data.data?.token };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  console.log('API 返回:', JSON.stringify(result, null, 2));
  
  browser.disconnect();
}

test();