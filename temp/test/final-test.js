const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function test() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  // 关闭所有旧标签页，创建新页面
  const pages = await browser.pages();
  for (const p of pages) await p.close();
  const page = await browser.newPage();
  
  console.log('1. 打开会员中心');
  await page.goto('https://tg.tiangong.club/#/pages/member/member', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  
  // 清空 Storage（页面加载后）
  await page.evaluate(() => localStorage.clear());
  
  // 等待输入框出现
  await page.waitForSelector('input', { timeout: 10000 });
  const inputs = await page.$$('input');
  console.log(`找到 ${inputs.length} 个输入框`);
  
  if (inputs.length < 2) {
    console.log('输入框不足，截图查看');
    await page.screenshot({ path: '/TG/temp/test/page-state.png', fullPage: true });
    browser.disconnect();
    return;
  }
  
  await page.screenshot({ path: '/TG/temp/test/step1-page.png' });
  
  console.log('2. 输入手机号');
  await inputs[0].click({ clickCount: 3 });
  await inputs[0].type('18600000004');
  await new Promise(r => setTimeout(r, 500));
  
  console.log('3. 点击获取验证码');
  await page.click('.h5-code-btn');
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('4. 输入验证码');
  await inputs[1].type('888888');
  await new Promise(r => setTimeout(r, 500));
  
  console.log('5. 勾选协议');
  await page.click('.h5-agreement .checkbox');
  await new Promise(r => setTimeout(r, 300));
  
  console.log('6. 点击登录');
  await page.click('.h5-login-btn');
  await new Promise(r => setTimeout(r, 4000));
  
  await page.screenshot({ path: '/TG/temp/test/step2-after-login.png' });
  
  // 检查是否有身份选择弹框
  const modal = await page.$('.uni-modal');
  if (modal) {
    console.log('7. 选择助教身份');
    const btns = await modal.$$('button');
    for (const b of btns) {
      const t = await b.evaluate(el => el.textContent);
      if (t.includes('助教')) {
        await b.click();
        console.log('点击助教按钮');
        break;
      }
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  
  await page.screenshot({ path: '/TG/temp/test/step3-final.png' });
  
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