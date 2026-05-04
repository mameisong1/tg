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
  
  // 用键盘输入
  const inputs = await page.$$('.h5-form-input');
  const phoneInput = await inputs[0].$('input');
  await phoneInput.focus();
  await new Promise(r => setTimeout(r, 100));
  
  for (const char of '18600000004') {
    await page.keyboard.sendCharacter(char);
    await new Promise(r => setTimeout(r, 50));
  }
  
  const codeInput = await inputs[1].$('input');
  await codeInput.focus();
  await new Promise(r => setTimeout(r, 100));
  
  for (const char of '888888') {
    await page.keyboard.sendCharacter(char);
    await new Promise(r => setTimeout(r, 50));
  }
  
  await new Promise(r => setTimeout(r, 500));
  
  // 检查原生 input 值
  const inputVals = await page.evaluate(() => ({
    phone: document.querySelectorAll('.h5-form-input')[0]?.querySelector('input')?.value,
    code: document.querySelectorAll('.h5-form-input')[1]?.querySelector('input')?.value
  }));
  console.log('原生 input 值:', inputVals);
  
  // 勾选协议
  await page.evaluate(() => document.querySelector('.h5-agreement .checkbox')?.click());
  await new Promise(r => setTimeout(r, 500));
  
  // 检查是否勾选
  const agreed = await page.evaluate(() => 
    document.querySelector('.h5-agreement .checkbox')?.classList.contains('checked')
  );
  console.log('协议勾选:', agreed);
  
  // 点击登录按钮并监听 console
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('smsPhone') || text.includes('smsCode') || text.includes('agreed') || text.includes('请输入')) {
      console.log('BROWSER:', text);
    }
  });
  
  console.log('\n点击登录按钮');
  await page.evaluate(() => document.querySelector('.h5-login-btn')?.click());
  
  await new Promise(r => setTimeout(r, 5000));
  
  // 检查 toast
  const toast = await page.evaluate(() => document.querySelector('.uni-toast')?.innerText || '无 toast');
  console.log('Toast:', toast);
  
  // 检查页面
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 100));
  console.log('页面:', pageText);
  
  browser.disconnect();
}

debug();