const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function test() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9998',
    defaultViewport: null
  });
  
  let page;
  const pages = await browser.pages();
  page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
  
  console.log('=== 测试退出登录清空 Storage ===');
  
  // 1. 设置登录状态
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('1. 设置登录状态');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('memberToken', 'fake_login_token');
    localStorage.setItem('memberInfo', '{"phone":"18600000004","name":"测试用户"}');
    localStorage.setItem('coachToken', 'fake_coach_token');
    localStorage.setItem('coachInfo', '{"coachNo":10121}');
  });
  
  const before = await page.evaluate(() => ({
    memberToken: localStorage.getItem('memberToken'),
    memberInfo: localStorage.getItem('memberInfo'),
    coachToken: localStorage.getItem('coachToken'),
    coachInfo: localStorage.getItem('coachInfo')
  }));
  console.log('登录状态:', JSON.stringify(before));
  
  // 2. 进入 profile 页面
  console.log('\n2. 进入 profile 页面');
  await page.goto('http://127.0.0.1:8089/#/pages/profile/profile', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: '/TG/temp/test/profile-page.png' });
  
  // 3. 点击退出登录按钮
  console.log('\n3. 点击退出登录按钮');
  const logoutBtn = await page.$('.logout-btn');
  if (!logoutBtn) {
    console.log('❌ 未找到退出登录按钮');
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('页面内容:', pageText.substring(0, 100));
    browser.disconnect();
    return;
  }
  
  await logoutBtn.click();
  console.log('点击退出按钮');
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: '/TG/temp/test/after-click-logout.png' });
  
  // 4. 确认弹窗
  console.log('\n4. 查找确认按钮');
  const confirmBtn = await page.$('.uni-modal__btn_primary');
  if (confirmBtn) {
    console.log('找到确认按钮，点击');
    await confirmBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  } else {
    // 尝试其他选择器
    console.log('尝试其他确认按钮选择器');
    const modalBtns = await page.$$('.uni-modal button');
    for (const btn of modalBtns) {
      const text = await btn.evaluate(e => e.textContent);
      console.log('按钮:', text);
      if (text.includes('确定') || text.includes('确认')) {
        await btn.click();
        console.log('点击确认');
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await page.screenshot({ path: '/TG/temp/test/after-confirm.png' });
  
  // 5. 等待页面跳转
  console.log('\n5. 等待页面跳转');
  await new Promise(r => setTimeout(r, 3000));
  
  // 检查当前 URL
  const currentUrl = page.url();
  console.log('当前 URL:', currentUrl);
  
  await page.screenshot({ path: '/TG/temp/test/final-state.png' });
  
  // 6. 检查 Storage
  console.log('\n6. 检查 Storage');
  const afterLogout = await page.evaluate(() => ({
    memberToken: localStorage.getItem('memberToken'),
    memberInfo: localStorage.getItem('memberInfo'),
    coachToken: localStorage.getItem('coachToken'),
    coachInfo: localStorage.getItem('coachInfo')
  }));
  console.log('退出后 Storage:', JSON.stringify(afterLogout));
  
  if (Object.values(afterLogout).every(v => v === null)) {
    console.log('✅ 用例4 通过：退出登录后 Storage 全部清空');
  } else {
    const notCleared = Object.entries(afterLogout).filter(([k,v]) => v !== null);
    console.log('❌ 用例4 失败：未清空的字段:', notCleared.map(([k]) => k).join(','));
  }
  
  browser.disconnect();
}

test().catch(e => console.error('错误:', e));