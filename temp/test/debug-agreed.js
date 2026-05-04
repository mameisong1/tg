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
    const phoneInput = document.querySelectorAll('.h5-form-input')[0];
    phoneInput.value = '18600000004';
    phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    const codeInput = document.querySelectorAll('.h5-form-input')[1];
    codeInput.value = '888888';
    codeInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  // 勾选协议
  await page.evaluate(() => {
    const checkbox = document.querySelector('.h5-agreement .checkbox');
    if (checkbox) checkbox.click();
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  // 检查 agreed 变量值
  const state = await page.evaluate(() => {
    // 检查 checkbox 的 class
    const checkbox = document.querySelector('.h5-agreement .checkbox');
    const hasCheckedClass = checkbox?.classList.contains('checked');
    
    // 检查勾选图标
    const checkmark = checkbox?.querySelector('text');
    const hasCheckmark = checkmark?.innerText?.includes('✓');
    
    return {
      hasCheckedClass,
      hasCheckmark,
      checkboxText: checkbox?.outerHTML
    };
  });
  
  console.log('协议状态:', state);
  
  // 点击登录按钮
  console.log('\n点击登录按钮');
  await page.evaluate(() => document.querySelector('.h5-login-btn')?.click());
  
  await new Promise(r => setTimeout(r, 5000));
  
  // 检查页面是否有 toast 提示
  const toast = await page.evaluate(() => {
    const toastEl = document.querySelector('.uni-toast');
    return toastEl ? toastEl.innerText : '无 toast';
  });
  console.log('Toast:', toast);
  
  browser.disconnect();
}

debug();