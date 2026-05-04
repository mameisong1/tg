const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function test() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9998',
    defaultViewport: null  // 使用默认 viewport
  });
  
  // 不关闭旧标签页，直接获取或创建
  let page;
  const pages = await browser.pages();
  if (pages.length > 0) {
    page = pages[pages.length - 1];
    console.log(`使用现有标签页`);
  } else {
    page = await browser.newPage();
    console.log(`创建新标签页`);
  }
  
  console.log('1. 打开会员中心');
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));
  
  await page.evaluate(() => localStorage.clear());
  
  await page.waitForSelector('input', { timeout: 15000 });
  const inputs = await page.$$('input');
  console.log(`找到 ${inputs.length} 个输入框`);
  
  if (inputs.length < 2) {
    console.log('输入框数量不足，退出');
    browser.disconnect();
    return;
  }
  
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
  await new Promise(r => setTimeout(r, 500));
  
  console.log('6. 点击登录');
  await page.click('.h5-login-btn');
  await new Promise(r => setTimeout(r, 6000));  // 等久一点
  
  await page.screenshot({ path: '/TG/temp/test/after-login.png' });
  
  // 查找助教身份按钮
  console.log('7. 查找助教身份按钮');
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('页面内容:', bodyText.substring(0, 150));
  
  if (bodyText.includes('助教身份')) {
    console.log('发现助教身份选项');
    // 遍历所有元素找到包含"助教身份"的
    const divs = await page.$$('div, view');
    for (const div of divs) {
      const text = await div.evaluate(e => e.innerText || '');
      if (text.includes('助教身份') && !text.includes('会员中心')) {
        console.log('点击:', text.substring(0, 30));
        await div.click();
        await new Promise(r => setTimeout(r, 5000));
        break;
      }
    }
  }
  
  await page.screenshot({ path: '/TG/temp/test/final.png' });
  
  console.log('8. 检查 Storage');
  const storage = await page.evaluate(() => {
    return {
      memberToken: localStorage.getItem('memberToken'),
      memberInfo: localStorage.getItem('memberInfo'),
      coachToken: localStorage.getItem('coachToken'),
      coachInfo: localStorage.getItem('coachInfo')
    };
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