const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function debug() {
  // 先退出登录
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  let page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
  
  // 监听所有 console 输出
  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('PWA') && !text.includes('UserAgent') && !text.includes('设备检测') && !text.includes('deferredPrompt') && !text.includes('beforeinstallprompt') && !text.includes('ErrorReporter') && !text.includes('App Launch') && !text.includes('App Show') && !text.includes('Service Worker') && !text.includes('meta name')) {
      console.log('CONSOLE:', text);
    }
  });
  
  // 退出登录
  console.log('=== 退出登录 ===');
  await page.goto('http://127.0.0.1:8089/#/pages/profile/profile', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 5000));
  await page.evaluate(() => document.querySelector('.logout-btn')?.click());
  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => document.querySelector('.uni-modal__btn_primary')?.click());
  await new Promise(r => setTimeout(r, 5000));
  console.log('退出完成');
  
  // 登录
  console.log('\n=== 登录 ===');
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 10000));  // 等待更长时间
  
  const inputs = await page.$$('input');
  console.log(`找到 ${inputs.length} 个输入框`);
  
  if (inputs.length < 2) {
    console.log('输入框不足');
    browser.disconnect();
    return;
  }
  
  await inputs[0].click({ clickCount: 3 });
  await inputs[0].type('18600000004');
  await inputs[1].type('888888');
  
  // 勾选协议（用 evaluate 点击）
  await page.evaluate(() => {
    const checkbox = document.querySelector('.h5-agreement .checkbox');
    if (checkbox) checkbox.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  
  // 确认勾选状态
  const checked = await page.evaluate(() => 
    document.querySelector('.h5-agreement .checkbox')?.classList.contains('checked')
  );
  console.log('协议勾选:', checked);
  
  if (!checked) {
    console.log('协议勾选失败，再次点击');
    await page.evaluate(() => document.querySelector('.h5-agreement .checkbox')?.click());
    await new Promise(r => setTimeout(r, 500));
  }
  
  // 点击登录
  console.log('\n=== 点击登录按钮 ===');
  await page.evaluate(() => document.querySelector('.h5-login-btn')?.click());
  await new Promise(r => setTimeout(r, 6000));
  
  // 点击 role-option
  console.log('\n=== 点击 role-option ===');
  await page.evaluate(() => {
    const opt = document.querySelector('.role-option');
    console.log('role-option:', opt);
    if (opt) opt.click();
  });
  await new Promise(r => setTimeout(r, 6000));
  
  // 检查 Storage
  const storage = await page.evaluate(() => ({
    memberToken: localStorage.getItem('memberToken'),
    memberInfo: localStorage.getItem('memberInfo'),
    coachToken: localStorage.getItem('coachToken')
  }));
  
  console.log('\n=== Storage ===');
  console.log(JSON.stringify(storage, null, 2));
  
  browser.disconnect();
}

debug();