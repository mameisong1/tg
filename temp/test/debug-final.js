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
  
  // 用 Puppeteer type 输入
  const inputs = await page.$$('.h5-form-input');
  await inputs[0].click({ clickCount: 3 });
  await inputs[0].type('18600000004', { delay: 50 });
  await inputs[1].click({ clickCount: 3 });
  await inputs[1].type('888888', { delay: 50 });
  
  await new Promise(r => setTimeout(r, 500));
  
  // 勾选协议
  await page.evaluate(() => document.querySelector('.h5-agreement .agreement-text')?.click());
  await new Promise(r => setTimeout(r, 500));
  
  // 检查 Vue 组件实例
  const vueState = await page.evaluate(() => {
    // 尝试获取 Vue 组件实例
    const app = document.querySelector('#app');
    
    // 检查输入框的实际值
    const phoneInput = document.querySelectorAll('.h5-form-input')[0];
    const codeInput = document.querySelectorAll('.h5-form-input')[1];
    
    return {
      inputPhone: phoneInput?.value,
      inputCode: codeInput?.value,
      agreedCheckbox: document.querySelector('.h5-agreement .checkbox')?.classList.contains('checked'),
      // 检查是否有 Vue 宄件
      hasVueApp: !!app?.__vue_app__
    };
  });
  
  console.log('Vue 状态:', vueState);
  
  // 直接调用 loginBySms 函数测试
  console.log('\n尝试直接调用 loginBySms');
  const result = await page.evaluate(() => {
    // 查找 Vue 组件并调用 loginBySms
    try {
      // 检查全局是否有 Vue 组件方法
      const loginBtn = document.querySelector('.h5-login-btn');
      if (loginBtn) {
        // 触发 click 事件的各种方式
        loginBtn.click();
        return { method: 'click', success: true };
      }
      return { method: 'none', success: false };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  console.log('调用结果:', result);
  
  await new Promise(r => setTimeout(r, 5000));
  
  // 检查 toast
  const toast = await page.evaluate(() => document.querySelector('.uni-toast')?.innerText || '无 toast');
  console.log('Toast:', toast);
  
  // 检查后端请求
  console.log('\n等待5秒后检查页面');
  await new Promise(r => setTimeout(r, 5000));
  
  const finalPage = await page.evaluate(() => document.body.innerText.substring(0, 100));
  console.log('最终页面:', finalPage);
  
  browser.disconnect();
}

debug();