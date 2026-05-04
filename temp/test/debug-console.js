const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function debug() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
  
  // 监听 console
  page.on('console', msg => {
    console.log('BROWSER:', msg.text());
  });
  
  // 打开会员中心
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 5000));
  
  await page.evaluate(() => localStorage.clear());
  
  // 输入、勾选、登录
  await page.evaluate(() => {
    document.querySelectorAll('input')[0].value = '18600000004';
    document.querySelectorAll('input')[0].dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelectorAll('input')[1].value = '888888';
    document.querySelectorAll('input')[1].dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.h5-agreement .checkbox')?.click();
  });
  await new Promise(r => setTimeout(r, 500));
  
  console.log('点击登录');
  await page.evaluate(() => document.querySelector('.h5-login-btn')?.click());
  await new Promise(r => setTimeout(r, 6000));
  
  // 点击助教身份
  console.log('点击助教身份');
  await page.evaluate(() => {
    const els = document.querySelectorAll('div, view, text, button, span');
    for (const el of els) {
      if ((el.innerText || '').includes('助教身份') && (el.innerText || '').length < 50) {
        el.click();
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

debug().catch(e => console.error('错误:', e));