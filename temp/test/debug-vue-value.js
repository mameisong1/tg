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
  await inputs[0].type('18600000004', { delay: 100 });
  await inputs[1].click({ clickCount: 3 });
  await inputs[1].type('888888', { delay: 100 });
  
  await new Promise(r => setTimeout(r, 1000));
  
  // 检查 DOM 输入框值
  const domValues = await page.evaluate(() => ({
    phone: document.querySelectorAll('.h5-form-input')[0]?.value,
    code: document.querySelectorAll('.h5-form-input')[1]?.value
  }));
  console.log('DOM 输入框值:', domValues);
  
  // 勾选协议（确保成功）
  await page.evaluate(() => {
    const checkbox = document.querySelector('.h5-agreement .checkbox');
    const text = document.querySelector('.h5-agreement .agreement-text');
    if (!checkbox?.classList.contains('checked')) {
      text?.click();
    }
  });
  await new Promise(r => setTimeout(r, 500));
  
  const agreedState = await page.evaluate(() => ({
    checkboxClass: document.querySelector('.h5-agreement .checkbox')?.className,
    hasCheckmark: !!document.querySelector('.h5-agreement .checkbox text')
  }));
  console.log('协议状态:', agreedState);
  
  // 点击登录按钮并监听 console
  page.on('console', msg => {
    if (msg.text().includes('smsPhone') || msg.text().includes('smsCode') || msg.text().includes('agreed')) {
      console.log('BROWSER:', msg.text());
    }
  });
  
  console.log('\n点击登录按钮');
  await page.evaluate(() => {
    // 在点击前添加调试
    console.log('smsPhone.value:', window.smsPhone?.value);
    console.log('smsCode.value:', window.smsCode?.value);
    document.querySelector('.h5-login-btn')?.click();
  });
  
  await new Promise(r => setTimeout(r, 5000));
  
  // 检查 toast
  const toast = await page.evaluate(() => {
    const toastEl = document.querySelector('.uni-toast');
    const loadingEl = document.querySelector('.uni-loading');
    return {
      toast: toastEl?.innerText || '无',
      loading: loadingEl ? '有' : '无'
    };
  });
  console.log('Toast/Loading:', toast);
  
  // 检查页面变化
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 100));
  console.log('页面:', pageText);
  
  browser.disconnect();
}

debug();