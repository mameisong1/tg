const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function debug() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  for (const p of pages) await p.close();
  const page = await browser.newPage();
  
  // 监听所有 console 输出
  page.on('console', msg => {
    const text = msg.text();
    // 过滤掉 PWA 调试信息
    if (!text.includes('PWA') && !text.includes('UserAgent') && !text.includes('设备检测') && !text.includes('deferredPrompt') && !text.includes('beforeinstallprompt')) {
      console.log('BROWSER:', text);
    }
  });
  
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 8000));
  await page.evaluate(() => localStorage.clear());
  
  await page.waitForSelector('input', { timeout: 10000 });
  const inputs = await page.$$('input');
  
  await inputs[0].click({ clickCount: 3 });
  await inputs[0].type('18600000004');
  await inputs[1].type('888888');
  
  await page.evaluate(() => document.querySelector('.h5-agreement .checkbox')?.click());
  await new Promise(r => setTimeout(r, 500));
  
  console.log('\n=== 点击登录按钮 ===');
  await page.evaluate(() => document.querySelector('.h5-login-btn')?.click());
  await new Promise(r => setTimeout(r, 6000));
  
  console.log('\n=== 点击 role-option ===');
  await page.evaluate(() => document.querySelector('.role-option')?.click());
  await new Promise(r => setTimeout(r, 6000));
  
  const storage = await page.evaluate(() => ({
    memberToken: localStorage.getItem('memberToken'),
    memberInfo: localStorage.getItem('memberInfo'),
    coachToken: localStorage.getItem('coachToken'),
    coachInfo: localStorage.getItem('coachInfo')
  }));
  
  console.log('\n=== 最终 Storage ===');
  console.log(JSON.stringify(storage, null, 2));
  
  browser.disconnect();
}

debug();