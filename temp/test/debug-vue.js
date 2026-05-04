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
  
  // 用 dispatchEvent 触发 input
  await page.evaluate(() => {
    const phoneInput = document.querySelectorAll('.h5-form-input')[0];
    phoneInput.value = '18600000004';
    phoneInput.dispatchEvent(new InputEvent('input', { bubbles: true, data: '18600000004' }));
    
    const codeInput = document.querySelectorAll('.h5-form-input')[1];
    codeInput.value = '888888';
    codeInput.dispatchEvent(new InputEvent('input', { bubbles: true, data: '888888' }));
  });
  
  await new Promise(r => setTimeout(r, 500));
  
  // 点击协议文字
  await page.evaluate(() => {
    document.querySelector('.h5-agreement .agreement-text')?.click();
  });
  
  await new Promise(r => setTimeout(r, 500));
  
  // 检查 Vue 组件状态
  const vueState = await page.evaluate(() => {
    // 检查输入框显示值
    const phoneInput = document.querySelectorAll('.h5-form-input')[0];
    const codeInput = document.querySelectorAll('.h5-form-input')[1];
    
    return {
      inputPhone: phoneInput?.value,
      inputCode: codeInput?.value,
      agreedCheckbox: document.querySelector('.h5-agreement .checkbox')?.classList.contains('checked')
    };
  });
  
  console.log('Vue 状态:', vueState);
  
  // 点击登录按钮
  console.log('\n点击登录按钮');
  await page.evaluate(() => {
    document.querySelector('.h5-login-btn')?.click();
  });
  
  await new Promise(r => setTimeout(r, 5000));
  
  // 检查结果
  const result = await page.evaluate(() => ({
    toast: document.querySelector('.uni-toast')?.innerText || '无 toast',
    loading: document.querySelector('.uni-loading')?.innerText || '无 loading',
    pageText: document.body.innerText.substring(0, 150)
  }));
  console.log('结果:', result);
  
  browser.disconnect();
}

debug();