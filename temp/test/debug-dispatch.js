const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function debug() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 8000));
  
  await page.evaluate(() => localStorage.clear());
  
  // 输入
  const inputs = await page.$$('input');
  await inputs[0].type('18600000004');
  await inputs[1].type('888888');
  
  // 勾选协议
  await page.evaluate(() => document.querySelector('.h5-agreement .checkbox')?.click());
  await new Promise(r => setTimeout(r, 500));
  
  // 点击登录按钮
  console.log('=== 点击登录 ===');
  await page.evaluate(() => document.querySelector('.h5-login-btn')?.click());
  await new Promise(r => setTimeout(r, 6000));
  
  // 用 dispatchEvent 触发 role-option 点击
  console.log('=== 点击 role-option ===');
  await page.evaluate(() => {
    const roleOptions = document.querySelectorAll('.role-option');
    console.log('role-option 数量:', roleOptions.length);
    for (const opt of roleOptions) {
      const nameEl = opt.querySelector('.role-name');
      if (nameEl && (nameEl.innerText || '').includes('助教')) {
        console.log('找到助教身份按钮');
        // 用 dispatchEvent 触发点击
        opt.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        console.log('dispatchEvent click');
        break;
      }
    }
  });
  
  await new Promise(r => setTimeout(r, 6000));
  
  // 检查 Storage
  const storage = await page.evaluate(() => ({
    memberToken: localStorage.getItem('memberToken'),
    memberInfo: localStorage.getItem('memberInfo'),
    coachToken: localStorage.getItem('coachToken')
  }));
  console.log('最终 Storage:', storage);
  
  browser.disconnect();
}

debug();