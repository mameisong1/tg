const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function test() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  // 关闭所有标签页
  const pages = await browser.pages();
  console.log(`关闭 ${pages.length} 个旧标签页`);
  for (const p of pages) await p.close();
  
  // 等待一下
  await new Promise(r => setTimeout(r, 1000));
  
  // 创建新页面
  const page = await browser.newPage();
  
  console.log('1. 打开会员中心');
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.evaluate(() => localStorage.clear());
  
  await page.waitForSelector('input', { timeout: 10000 });
  const inputs = await page.$$('input');
  console.log(`找到 ${inputs.length} 个输入框`);
  
  console.log('2. 输入手机号');
  await inputs[0].click({ clickCount: 3 });
  await inputs[0].type('18600000004');
  
  console.log('3. 点击获取验证码');
  await page.click('.h5-code-btn');
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('4. 输入验证码');
  await inputs[1].type('888888');
  
  console.log('5. 勾选协议');
  await page.click('.h5-agreement .checkbox');
  await new Promise(r => setTimeout(r, 300));
  
  console.log('6. 点击登录');
  await page.click('.h5-login-btn');
  await new Promise(r => setTimeout(r, 5000));
  
  await page.screenshot({ path: '/TG/temp/test/login-modal.png' });
  
  // 查找并点击助教身份按钮
  console.log('7. 查找助教按钮');
  const allElements = await page.$$('div, view, button, text');
  for (const el of allElements) {
    try {
      const text = await el.evaluate(e => e.innerText || e.textContent || '');
      if (text.includes('助教身份') && text.length < 100) {
        console.log('找到助教身份:', text.substring(0, 50));
        await el.click();
        console.log('点击助教身份');
        await new Promise(r => setTimeout(r, 5000));
        break;
      }
    } catch {}
  }
  
  await page.screenshot({ path: '/TG/temp/test/after-select.png' });
  
  console.log('8. 检查 Storage');
  const storage = await page.evaluate(() => {
    const keys = ['memberToken', 'memberInfo', 'coachToken', 'coachInfo'];
    const r = {};
    keys.forEach(k => r[k] = localStorage.getItem(k));
    return r;
  });
  console.log('Storage:', JSON.stringify(storage, null, 2));
  
  const memberInfo = storage.memberInfo ? JSON.parse(storage.memberInfo) : null;
  
  if (storage.memberToken && memberInfo && memberInfo.phone === '18600000004') {
    console.log('✅ 用例1 通过');
  } else {
    console.log('❌ 用例1 失败');
  }
  
  browser.disconnect();
}

test().catch(e => console.error('错误:', e));