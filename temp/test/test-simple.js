/**
 * memberInfo Storage 测试 - 简洁版
 */

const puppeteer = require('/usr/lib/node_modules/puppeteer');

const TEST_URL = 'https://tg.tiangong.club/#/pages/member/member';
const PROFILE_URL = 'https://tg.tiangong.club/#/pages/profile/profile';
const PHONE = '18600000004';
const CODE = '888888';

const STORAGE_KEYS = [
  'memberToken', 'memberInfo', 'coachToken', 'coachInfo',
  'adminToken', 'adminInfo', 'preferredRole', 'sessionId',
  'tablePinyin', 'tableName', 'tableAuth', 'highlightProduct'
];

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

async function getStorage(page) {
  return page.evaluate(keys => {
    const r = {};
    keys.forEach(k => r[k] = localStorage.getItem(k));
    return r;
  }, STORAGE_KEYS);
}

async function run() {
  log('连接 Chrome...');
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 },
    protocolTimeout: 60000
  });

  const page = (await browser.pages())[0] || await browser.newPage();

  // ========== 用例1：登录后 memberInfo 存储 ==========
  log('\n【用例1】登录后 memberInfo 存储');
  
  await page.goto(TEST_URL, { waitUntil: 'networkidle2' });
  await page.waitForTimeout(2000);

  // 输入手机号
  await page.type('input[placeholder="手机号"]', PHONE);
  log(`输入手机号: ${PHONE}`);

  // 点击获取验证码
  await page.click('.h5-code-btn');
  log('点击获取验证码');
  await page.waitForTimeout(2000);

  // 输入验证码
  await page.type('input[placeholder="验证码"]', CODE);
  log(`输入验证码: ${CODE}`);

  // 勾选同意协议
  const checkbox = await page.$('.h5-agreement .checkbox');
  const isChecked = await checkbox.evaluate(el => el.classList.contains('checked'));
  if (!isChecked) {
    await page.click('.h5-agreement .checkbox');
    log('勾选同意协议');
  }
  await page.waitForTimeout(500);

  // 点击登录按钮
  await page.click('.h5-login-btn');
  log('点击登录按钮');
  await page.waitForTimeout(3000);

  // 选择助教身份（如有弹框）
  try {
    await page.waitForSelector('.uni-modal', { timeout: 3000 });
    const buttons = await page.$$('.uni-modal button');
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent);
      if (text.includes('助教')) {
        await btn.click();
        log('选择助教身份');
        break;
      }
    }
    await page.waitForTimeout(2000);
  } catch {}

  // 检查 Storage
  const storage = await getStorage(page);
  const memberInfo = storage.memberInfo ? JSON.parse(storage.memberInfo) : null;
  
  log(`Storage: memberToken=${storage.memberToken ? '有' : '空'}, memberInfo=${storage.memberInfo}`);
  
  if (storage.memberToken && memberInfo && memberInfo.phone === PHONE) {
    log('✅ 用例1 通过');
  } else {
    log('❌ 用例1 失败');
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/test-fail-case1.png' });
  }

  // ========== 用例3：登录按钮清空旧 Storage ==========
  log('\n【用例3】登录按钮清空旧 Storage');

  // 设置假数据
  await page.evaluate(() => {
    localStorage.setItem('memberToken', 'fake_token');
    localStorage.setItem('memberInfo', '{"phone":"fake"}');
    localStorage.setItem('coachToken', 'fake');
    localStorage.setItem('coachInfo', 'fake');
  });
  log('设置假数据');

  await page.goto(TEST_URL, { waitUntil: 'networkidle2' });
  await page.waitForTimeout(1000);

  // 输入手机号
  await page.type('input[placeholder="手机号"]', PHONE);

  // 点击获取验证码（这时不应该清空）
  await page.click('.h5-code-btn');
  log('点击获取验证码');
  await page.waitForTimeout(1500);

  const afterCodeClick = await getStorage(page);
  if (afterCodeClick.memberToken === 'fake_token') {
    log('✅ 点击验证码按钮后假数据还在（符合预期）');
  } else {
    log('❌ 点击验证码按钮后假数据被清空（不应该）');
  }

  // 输入验证码
  await page.type('input[placeholder="验证码"]', CODE);

  // 勾选协议并点击登录
  await page.click('.h5-agreement .checkbox');
  await page.waitForTimeout(300);
  await page.click('.h5-login-btn');
  log('点击登录按钮');
  await page.waitForTimeout(3000);

  // 选择身份
  try {
    await page.waitForSelector('.uni-modal', { timeout: 3000 });
    const buttons = await page.$$('.uni-modal button');
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent);
      if (text.includes('助教')) {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout(2000);
  } catch {}

  const afterLogin = await getStorage(page);
  const fakeCleared = afterLogin.memberToken !== 'fake_token';
  
  if (fakeCleared) {
    log('✅ 用例3 通过：登录后假数据被清空');
  } else {
    log('❌ 用例3 失败：登录后假数据还在');
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/test-fail-case3.png' });
  }

  // ========== 用例4：退出登录清空 Storage ==========
  log('\n【用例4】退出登录清空 Storage');

  await page.goto(PROFILE_URL, { waitUntil: 'networkidle2' });
  await page.waitForTimeout(1500);

  // 点击退出登录
  await page.click('.logout-btn');
  log('点击退出登录');
  await page.waitForTimeout(1000);

  // 确认弹窗
  try {
    await page.waitForSelector('.uni-modal-btn-confirm', { timeout: 3000 });
    await page.click('.uni-modal-btn-confirm');
    log('确认退出');
    await page.waitForTimeout(2000);
  } catch {}

  const afterLogout = await getStorage(page);
  const allCleared = Object.values(afterLogout).every(v => v === null);

  if (allCleared) {
    log('✅ 用例4 通过：退出后 Storage 全部清空');
  } else {
    const notCleared = Object.entries(afterLogout).filter(([k,v]) => v !== null).map(([k]) => k);
    log(`❌ 用例4 失败：未清空 ${notCleared.join(',')}`);
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/test-fail-case4.png' });
  }

  log('\n测试完成');
  browser.disconnect();
}

run().catch(e => console.error('错误:', e));