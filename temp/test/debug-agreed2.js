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
  
  // 输入手机号和验证码
  await page.evaluate(() => {
    document.querySelectorAll('.h5-form-input')[0].value = '18600000004';
    document.querySelectorAll('.h5-form-input')[0].dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelectorAll('.h5-form-input')[1].value = '888888';
    document.querySelectorAll('.h5-form-input')[1].dispatchEvent(new Event('input', { bubbles: true }));
  });
  
  await new Promise(r => setTimeout(r, 500));
  
  // 点击协议文字区域（而不是 checkbox）
  console.log('点击协议文字');
  await page.evaluate(() => {
    const text = document.querySelector('.h5-agreement .agreement-text');
    if (text) {
      console.log('找到 agreement-text');
      text.click();
    } else {
      console.log('没找到 agreement-text');
    }
  });
  
  await new Promise(r => setTimeout(r, 500));
  
  // 检查状态
  const state1 = await page.evaluate(() => {
    const checkbox = document.querySelector('.h5-agreement .checkbox');
    return {
      hasChecked: checkbox?.classList.contains('checked'),
      html: checkbox?.outerHTML
    };
  });
  console.log('点击文字后:', state1);
  
  // 如果还没勾选，尝试点击 checkbox
  if (!state1.hasChecked) {
    console.log('\n尝试点击 checkbox');
    await page.evaluate(() => {
      const checkbox = document.querySelector('.h5-agreement .checkbox');
      if (checkbox) {
        checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    });
    
    await new Promise(r => setTimeout(r, 500));
    
    const state2 = await page.evaluate(() => ({
      hasChecked: document.querySelector('.h5-agreement .checkbox')?.classList.contains('checked')
    }));
    console.log('MouseEvent 后:', state2);
  }
  
  // 点击登录按钮
  console.log('\n点击登录按钮');
  await page.evaluate(() => document.querySelector('.h5-login-btn')?.click());
  
  await new Promise(r => setTimeout(r, 5000));
  
  // 检查 toast 和页面
  const result = await page.evaluate(() => ({
    toast: document.querySelector('.uni-toast')?.innerText || '无',
    pageText: document.body.innerText.substring(0, 100)
  }));
  console.log('结果:', result);
  
  browser.disconnect();
}

debug();