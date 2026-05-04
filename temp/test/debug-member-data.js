const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function test() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  let page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
  
  // 清空 Storage
  await page.evaluate(() => localStorage.clear());
  
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 8000));
  
  // 监听 console
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('handleRoleSelection') || text.includes('memberInfo') || 
        text.includes('tempLoginData') || text.includes('member') || text.includes('selectRole')) {
      console.log('BROWSER:', text.substring(0, 200));
    }
  });
  
  // 直接调用 API 登录，然后手动触发 handleRoleSelection
  const result = await page.evaluate(async () => {
    const response = await fetch('http://127.0.0.1:8088/api/member/login-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '18600000004', code: '888888', deviceFingerprint: 'test' })
    });
    const data = await response.json();
    
    console.log('API data.member:', JSON.stringify(data.member));
    console.log('API data.roles:', JSON.stringify(data.roles));
    
    // 手动设置 tempLoginData 并检查
    if (data.roles && data.roles.length > 0) {
      // 模拟 handleRoleSelection
      const extraRoles = data.roles.filter(r => r !== 'member');
      console.log('extraRoles:', JSON.stringify(extraRoles));
      console.log('data object keys:', Object.keys(data));
      console.log('data.member type:', typeof data.member);
      console.log('data.member value:', JSON.stringify(data.member));
    }
    
    return {
      hasMember: !!data.member,
      memberValue: data.member,
      roles: data.roles
    };
  });
  
  console.log('Result:', JSON.stringify(result, null, 2));
  
  browser.disconnect();
}

test();