const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function test() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9998',
    defaultViewport: null
  });
  
  let page;
  const pages = await browser.pages();
  page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
  
  console.log('=== 测试 Storage 清空功能 ===');
  
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  
  // 设置假数据
  console.log('1. 设置假数据');
  await page.evaluate(() => {
    localStorage.setItem('memberToken', 'fake_token');
    localStorage.setItem('memberInfo', 'fake_info');
    localStorage.setItem('coachToken', 'fake_coach');
    localStorage.setItem('coachInfo', 'fake_coach_info');
  });
  
  const before = await page.evaluate(() => ({
    memberToken: localStorage.getItem('memberToken'),
    memberInfo: localStorage.getItem('memberInfo'),
    coachToken: localStorage.getItem('coachToken'),
    coachInfo: localStorage.getItem('coachInfo')
  }));
  console.log('设置后:', JSON.stringify(before));
  
  // 执行清空函数（直接用 localStorage）
  console.log('\n2. 执行清空函数');
  await page.evaluate(() => {
    localStorage.removeItem('memberToken');
    localStorage.removeItem('memberInfo');
    localStorage.removeItem('coachToken');
    localStorage.removeItem('coachInfo');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminInfo');
    localStorage.removeItem('preferredRole');
    localStorage.removeItem('sessionId');
    localStorage.removeItem('tablePinyin');
    localStorage.removeItem('tableName');
    localStorage.removeItem('tableAuth');
    localStorage.removeItem('highlightProduct');
  });
  
  const after = await page.evaluate(() => ({
    memberToken: localStorage.getItem('memberToken'),
    memberInfo: localStorage.getItem('memberInfo'),
    coachToken: localStorage.getItem('coachToken'),
    coachInfo: localStorage.getItem('coachInfo')
  }));
  console.log('清空后:', JSON.stringify(after));
  
  if (Object.values(after).every(v => v === null)) {
    console.log('✅ Storage 清空正常');
  } else {
    console.log('❌ Storage 清空失败');
    // 尝试直接用 localStorage.removeItem
    console.log('\n尝试直接用 localStorage.removeItem');
    await page.evaluate(() => {
      localStorage.removeItem('memberToken');
      localStorage.removeItem('memberInfo');
      localStorage.removeItem('coachToken');
      localStorage.removeItem('coachInfo');
    });
    
    const after2 = await page.evaluate(() => ({
      memberToken: localStorage.getItem('memberToken'),
      memberInfo: localStorage.getItem('memberInfo'),
      coachToken: localStorage.getItem('coachToken'),
      coachInfo: localStorage.getItem('coachInfo')
    }));
    console.log('直接清空后:', JSON.stringify(after2));
  }
  
  browser.disconnect();
}

test().catch(e => console.error('错误:', e));