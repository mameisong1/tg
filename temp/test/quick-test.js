const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function test() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  const page = (await browser.pages())[0];
  
  console.log('1. 打开会员中心');
  await page.goto('https://tg.tiangong.club/#/pages/member/member', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('2. 输入手机号');
  const inputs = await page.$$('input');
  await inputs[0].type('18600000004');
  
  console.log('3. 点击获取验证码');
  await page.click('.h5-code-btn');
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('4. 输入验证码');
  await inputs[1].type('888888');
  
  console.log('5. 勾选协议');
  await page.click('.h5-agreement .checkbox');
  await new Promise(r => setTimeout(r, 500));
  
  console.log('6. 点击登录');
  await page.click('.h5-login-btn');
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('7. 选择助教身份');
  const btns = await page.$$('button');
  for (const b of btns) {
    const t = await b.evaluate(el => el.textContent);
    if (t.includes('助教')) { await b.click(); break; }
  }
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('8. 检查 Storage');
  const storage = await page.evaluate(() => {
    return {
      memberToken: localStorage.getItem('memberToken'),
      memberInfo: localStorage.getItem('memberInfo')
    };
  });
  console.log('Storage:', storage);
  
  if (storage.memberToken && storage.memberInfo) {
    console.log('✅ 登录成功');
  } else {
    console.log('❌ 登录失败');
  }
  
  browser.disconnect();
}

test().catch(e => console.error('错误:', e));