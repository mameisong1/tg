const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function debug() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
  
  // 打开会员中心
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 5000));
  
  // 清空 Storage
  await page.evaluate(() => localStorage.clear());
  
  // 输入手机号和验证码
  await page.evaluate(() => {
    document.querySelectorAll('input')[0].value = '18600000004';
    document.querySelectorAll('input')[0].dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelectorAll('input')[1].value = '888888';
    document.querySelectorAll('input')[1].dispatchEvent(new Event('input', { bubbles: true }));
  });
  
  // 勾选协议
  await page.evaluate(() => {
    const checkbox = document.querySelector('.h5-agreement .checkbox');
    if (checkbox && !checkbox.classList.contains('checked')) checkbox.click();
  });
  await new Promise(r => setTimeout(r, 500));
  
  // 点击登录按钮
  console.log('点击登录按钮');
  await page.evaluate(() => document.querySelector('.h5-login-btn')?.click());
  await new Promise(r => setTimeout(r, 5000));
  
  // 检查 Storage（登录后，选身份前）
  const storage1 = await page.evaluate(() => ({
    memberToken: localStorage.getItem('memberToken'),
    memberInfo: localStorage.getItem('memberInfo')
  }));
  console.log('登录后（选身份前）Storage:', storage1);
  
  // 检查页面内容
  const text = await page.evaluate(() => document.body.innerText);
  console.log('页面内容:', text.substring(0, 100));
  
  // 点击助教身份按钮
  if (text.includes('助教身份')) {
    console.log('点击助教身份按钮');
    await page.evaluate(() => {
      const elements = document.querySelectorAll('div, view, text, button, span');
      for (const el of elements) {
        if ((el.innerText || '').includes('助教身份') && (el.innerText || '').length < 50) {
          console.log('找到:', el.innerText);
          el.click();
          break;
        }
      }
    });
    await new Promise(r => setTimeout(r, 5000));
  }
  
  // 检查 Storage（选身份后）
  const storage2 = await page.evaluate(() => ({
    memberToken: localStorage.getItem('memberToken'),
    memberInfo: localStorage.getItem('memberInfo'),
    coachToken: localStorage.getItem('coachToken'),
    coachInfo: localStorage.getItem('coachInfo')
  }));
  console.log('选身份后 Storage:', storage2);
  
  // 检查页面
  const text2 = await page.evaluate(() => document.body.innerText);
  console.log('页面内容:', text2.substring(0, 100));
  
  browser.disconnect();
}

debug().catch(e => console.error('错误:', e));