const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function test() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  for (const p of pages) await p.close();
  const page = await browser.newPage();
  
  console.log('1. 打开会员中心（本地测试环境）');
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
  
  await page.screenshot({ path: '/TG/temp/test/pre-login.png' });
  
  console.log('6. 点击登录');
  await page.click('.h5-login-btn');
  await new Promise(r => setTimeout(r, 5000)); // 等久一点
  
  await page.screenshot({ path: '/TG/temp/test/post-login.png' });
  
  // 检查页面内容
  const content = await page.evaluate(() => document.body.innerText);
  console.log('页面内容片段:', content.substring(0, 200));
  
  // 检查是否有 uni-modal 或 role-modal
  const modal = await page.$('.uni-modal, .role-modal, [class*="modal"]');
  if (modal) {
    console.log('7. 发现有弹框，选择助教');
    const modalClass = await modal.evaluate(el => el.className);
    console.log('弹框 class:', modalClass);
    
    // 截图
    await page.screenshot({ path: '/TG/temp/test/modal-found.png' });
    
    const btns = await modal.$$('button');
    console.log(`弹框内按钮数量: ${btns.length}`);
    for (const b of btns) {
      const t = await b.evaluate(el => el.textContent);
      console.log('按钮:', t);
      if (t.includes('助教')) {
        await b.click();
        console.log('点击助教按钮');
        await new Promise(r => setTimeout(r, 3000));
        break;
      }
    }
  } else {
    console.log('7. 无弹框（可能是单身份）');
  }
  
  await page.screenshot({ path: '/TG/temp/test/final-state.png' });
  
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
    console.log('✅ 用例1 通过: memberToken 和 memberInfo 都有值');
  } else if (storage.memberToken && !memberInfo) {
    console.log('⚠️ 部分成功: memberToken 有值，但 memberInfo 空');
  } else {
    console.log('❌ 用例1 失败');
  }
  
  browser.disconnect();
}

test().catch(e => console.error('错误:', e));