/**
 * 直接用 API 测试 Storage 存储逻辑
 */

const puppeteer = require('/usr/lib/node_modules/puppeteer');

const API_BASE = 'http://127.0.0.1:8088/api';
const PHONE = '18600000004';
const CODE = '888888';

async function test() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9998',
    defaultViewport: null
  });
  
  let page;
  const pages = await browser.pages();
  page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
  
  console.log('=== 用 API 直接测试 Storage 存储 ===');
  
  // 打开页面，清空 Storage
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));
  await page.evaluate(() => localStorage.clear());
  console.log('清空 Storage');
  
  // 直接调用后端 API 登录
  console.log('1. 调用后端登录 API');
  const loginRes = await page.evaluate(async (apiBase, phone, code) => {
    const res = await fetch(`${apiBase}/member/login-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    });
    return res.json();
  }, API_BASE, PHONE, CODE);
  
  console.log('登录响应:', JSON.stringify(loginRes).substring(0, 200));
  
  if (!loginRes.success) {
    console.log('❌ 登录失败');
    browser.disconnect();
    return;
  }
  
  // 模拟前端存储逻辑（按 member.vue 的代码）
  console.log('\n2. 模拟前端存储逻辑');
  await page.evaluate((data) => {
    // clearLoginStorage
    const keys = ['memberToken', 'memberInfo', 'coachToken', 'coachInfo',
                  'adminToken', 'adminInfo', 'preferredRole', 'sessionId',
                  'tablePinyin', 'tableName', 'tableAuth', 'highlightProduct'];
    keys.forEach(k => localStorage.removeItem(k));
    
    // 存储 token 和 member
    localStorage.setItem('memberToken', data.token);
    localStorage.setItem('memberInfo', JSON.stringify(data.member));
    
    // 有 roles 且有 coach 身份
    if (data.roles && data.roles.includes('coach')) {
      // 存储 coachInfo
      localStorage.setItem('coachInfo', JSON.stringify(data.coachInfo));
      // 生成 coachToken
      const phone = data.coachInfo.phone || '';
      const coachToken = btoa(`${data.coachInfo.coachNo}:${phone}:${Date.now()}`);
      localStorage.setItem('coachToken', coachToken);
    }
    
    console.log('已存储:', localStorage.getItem('memberToken'), localStorage.getItem('memberInfo'));
  }, loginRes);
  
  // 检查 Storage
  console.log('\n3. 检查 Storage');
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
  
  if (storage.memberToken && memberInfo && memberInfo.phone === PHONE) {
    console.log('\n✅ Storage 存储逻辑正确');
  } else {
    console.log('\n❌ Storage 存储逻辑有问题');
  }
  
  // 测试页面刷新后 memberInfo 加载
  console.log('\n=== 用例6: 页面刷新后 memberInfo 加载 ===');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));
  
  // 检查页面是否显示用户信息
  const pageText = await page.evaluate(() => document.body.innerText);
  if (pageText.includes('测试助教') || pageText.includes('186****0004')) {
    console.log('✅ 页面显示用户信息');
  } else {
    console.log('❌ 页面未显示用户信息');
    console.log('页面内容:', pageText.substring(0, 100));
  }
  
  // 测试退出登录清空 Storage
  console.log('\n=== 用例4: 退出登录清空 Storage ===');
  await page.goto('http://127.0.0.1:8089/#/pages/profile/profile', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  
  // 查找退出登录按钮
  const logoutBtn = await page.$('.logout-btn');
  if (logoutBtn) {
    await logoutBtn.click();
    await new Promise(r => setTimeout(r, 1000));
    
    // 查找确认按钮
    const confirmBtn = await page.$('.uni-modal__btn_primary');
    if (confirmBtn) {
      await confirmBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }
    
    const afterLogout = await page.evaluate(() => {
      const keys = ['memberToken', 'memberInfo', 'coachToken', 'coachInfo'];
      const r = {};
      keys.forEach(k => r[k] = localStorage.getItem(k));
      return r;
    });
    
    if (Object.values(afterLogout).every(v => v === null)) {
      console.log('✅ 退出登录后 Storage 清空');
    } else {
      console.log('❌ 退出登录后 Storage 未清空');
      console.log('残留:', JSON.stringify(afterLogout));
    }
  } else {
    console.log('⚠️ 未找到退出登录按钮');
  }
  
  browser.disconnect();
}

test().catch(e => console.error('错误:', e));