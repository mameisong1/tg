const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function test() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  const page = (await browser.pages())[0];
  
  // 先清空 Storage
  await page.evaluate(() => localStorage.clear());
  
  console.log('1. 打开会员中心');
  await page.goto('https://tg.tiangong.club/#/pages/member/member', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: '/TG/temp/test/step1.png' });
  
  console.log('2. 输入手机号 18600000004');
  const inputs = await page.$$('input');
  console.log(`找到 ${inputs.length} 个输入框`);
  await inputs[0].click({ clickCount: 3 });
  await inputs[0].type('18600000004');
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: '/TG/temp/test/step2.png' });
  
  console.log('3. 点击获取验证码按钮');
  await page.click('.h5-code-btn');
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: '/TG/temp/test/step3.png' });
  
  console.log('4. 输入验证码 888888');
  const inputs2 = await page.$$('input');
  await inputs2[1].type('888888');
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: '/TG/temp/test/step4.png' });
  
  console.log('5. 勾选同意协议');
  const checkbox = await page.$('.h5-agreement .checkbox');
  if (checkbox) {
    const checked = await checkbox.evaluate(el => el.classList.contains('checked'));
    console.log(`协议勾选状态: ${checked}`);
    if (!checked) {
      await checkbox.click();
      await new Promise(r => setTimeout(r, 300));
    }
  }
  await page.screenshot({ path: '/TG/temp/test/step5.png' });
  
  console.log('6. 点击登录按钮');
  await page.click('.h5-login-btn');
  await new Promise(r => setTimeout(r, 5000));
  await page.screenshot({ path: '/TG/temp/test/step6.png' });
  
  // 检查是否有弹框
  const modal = await page.$('.uni-modal');
  if (modal) {
    console.log('7. 有身份选择弹框，选择助教');
    const btns = await page.$$('.uni-modal button');
    for (const b of btns) {
      const t = await b.evaluate(el => el.textContent);
      console.log(`按钮文本: ${t}`);
      if (t.includes('助教')) {
        await b.click();
        console.log('点击助教按钮');
        break;
      }
    }
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: '/TG/temp/test/step7.png' });
  } else {
    console.log('7. 无身份选择弹框');
  }
  
  console.log('8. 检查 Storage');
  const storage = await page.evaluate(() => {
    const keys = ['memberToken', 'memberInfo', 'coachToken', 'coachInfo'];
    const r = {};
    keys.forEach(k => r[k] = localStorage.getItem(k));
    return r;
  });
  console.log('Storage:', JSON.stringify(storage, null, 2));
  
  if (storage.memberToken) {
    console.log('✅ 用例1 通过: memberToken 有值');
  } else {
    console.log('❌ 用例1 失败: memberToken 为空');
  }
  
  browser.disconnect();
}

test().catch(e => console.error('错误:', e));