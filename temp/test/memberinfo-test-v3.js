/**
 * memberInfo Storage 测试脚本（V3 - 完善版）
 * 测试环境: Chrome 9222端口
 * 测试网址: https://tg.tiangong.club
 */

const puppeteer = require('/usr/lib/node_modules/puppeteer');
const fs = require('fs');

const BASE_URL = 'https://tg.tiangong.club';
const TEST_PHONE = '18600000004';
const TEST_CODE = '888888';

const LOG_FILE = '/TG/temp/test/memberinfo-test-v3.log';
const SCREENSHOT_DIR = '/root/.openclaw/workspace_coder-tg';

const STORAGE_KEYS = [
  'memberToken', 'memberInfo', 'coachToken', 'coachInfo',
  'adminToken', 'adminInfo', 'preferredRole', 'sessionId',
  'tablePinyin', 'tableName', 'tableAuth', 'highlightProduct'
];

let testResults = { passed: 0, failed: 0, skipped: 0, details: [] };

function log(msg) {
  const timestamp = new Date().toLocaleString('zh-CN', { hour12: false });
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getAllStorage(page) {
  return await page.evaluate((keys) => {
    const r = {};
    keys.forEach(k => r[k] = localStorage.getItem(k));
    return r;
  }, STORAGE_KEYS);
}

async function setStorage(page, key, value) {
  await page.evaluate((k, v) => localStorage.setItem(k, JSON.stringify(v)), key, value);
}

async function clearAllStorage(page) {
  await page.evaluate((keys) => keys.forEach(k => localStorage.removeItem(k)), STORAGE_KEYS);
}

async function takeScreenshot(page, name) {
  try {
    const path = `${SCREENSHOT_DIR}/memberinfo-v3-${name}-${Date.now()}.png`;
    await page.screenshot({ path, fullPage: false });
    log(`截图: ${name}`);
  } catch (e) {
    log(`截图失败: ${e.message}`);
  }
}

// ========================================
// 通用登录函数
// ========================================
async function performLogin(page, selectRole = 'coach') {
  log('执行登录流程...');
  
  // 清空 Storage
  await clearAllStorage(page);
  await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  
  // 获取输入框
  const inputs = await page.$$('input.uni-input-input');
  if (inputs.length < 2) {
    log('输入框数量不足');
    return false;
  }
  
  // 输入手机号
  await inputs[0].click({ clickCount: 3 });
  await inputs[0].type(TEST_PHONE, { delay: 50 });
  log(`输入手机号: ${TEST_PHONE}`);
  await sleep(500);
  
  // 点击获取验证码
  const codeBtn = await page.$('.h5-code-btn');
  if (codeBtn) {
    await codeBtn.click();
    log('点击获取验证码');
    await sleep(1500);
  }
  
  // 输入验证码
  await inputs[1].click();
  await inputs[1].type(TEST_CODE, { delay: 50 });
  log('输入验证码');
  await sleep(500);
  
  // 勾选协议
  const checkbox = await page.$('.h5-agreement .checkbox');
  if (checkbox) {
    const isChecked = await checkbox.evaluate(el => el.classList.contains('checked'));
    if (!isChecked) {
      await checkbox.click();
      log('勾选协议');
      await sleep(300);
    }
  }
  
  // 点击登录
  const loginBtn = await page.$('.h5-login-btn');
  if (!loginBtn) {
    log('未找到登录按钮');
    return false;
  }
  
  await loginBtn.click();
  log('点击登录按钮');
  await sleep(3000);
  
  // 检查身份选择弹窗
  const roleModal = await page.$('.role-modal, .uni-modal');
  if (roleModal) {
    log('检测到身份选择弹窗');
    await sleep(500);
    
    // 尝试点击助教按钮
    const allButtons = await page.$$('button, .btn, .role-btn, .uni-modal__btn');
    for (const btn of allButtons) {
      const text = await btn.evaluate(el => el.textContent.trim());
      if (text.includes('助教')) {
        await btn.click();
        log('选择助教身份');
        await sleep(2000);
        break;
      }
    }
    
    // 如果没有助教按钮，可能需要直接点击确定
    const confirmBtn = await page.$('.uni-modal__btn_primary');
    if (confirmBtn) {
      const btnText = await confirmBtn.evaluate(el => el.textContent.trim());
      if (btnText.includes('确定') && !btnText.includes('退出')) {
        await confirmBtn.click();
        log('点击确定按钮');
        await sleep(2000);
      }
    }
  }
  
  // 验证登录成功
  const storage = await getAllStorage(page);
  if (storage.memberToken) {
    log('登录成功，memberToken 有值');
    return true;
  } else {
    log('登录失败，memberToken 为空');
    return false;
  }
}

// ========================================
// 用例1：SMS登录成功后 memberInfo 存储
// ========================================
async function test1_SMSLoginMemberInfo(page) {
  log('\n=== 用例1：SMS登录成功后 memberInfo 存储 ===');
  
  try {
    const success = await performLogin(page);
    takeScreenshot(page, 'case1-after-login');
    
    if (!success) {
      testResults.failed++;
      testResults.details.push({ case: 1, result: 'FAIL', reason: '登录失败' });
      return;
    }
    
    // 验证 memberInfo
    const storage = await getAllStorage(page);
    let memberInfo = null;
    try {
      memberInfo = storage.memberInfo ? JSON.parse(storage.memberInfo) : null;
    } catch (e) {
      log(`memberInfo 解析失败: ${e.message}`);
    }
    
    if (memberInfo && memberInfo.phone === TEST_PHONE) {
      log(`✅ 用例1 通过: memberInfo.phone=${memberInfo.phone}`);
      testResults.passed++;
      testResults.details.push({ case: 1, result: 'PASS', memberInfo });
    } else {
      log(`❌ 用例1 失败: phone=${memberInfo?.phone}`);
      testResults.failed++;
      testResults.details.push({ case: 1, result: 'FAIL', reason: `phone不匹配: ${memberInfo?.phone}` });
    }
  } catch (err) {
    log(`用例1 异常: ${err.message}`);
    testResults.failed++;
    testResults.details.push({ case: 1, result: 'FAIL', reason: err.message });
  }
}

// ========================================
// 用例3：点击登录按钮时清空旧 Storage
// ========================================
async function test3_LoginButtonClearsStorage(page) {
  log('\n=== 用例3：点击登录按钮时清空旧 Storage ===');
  
  try {
    // 先清空，然后设置假数据
    await clearAllStorage(page);
    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2' });
    await sleep(1500);
    
    // 设置假数据
    for (const key of STORAGE_KEYS) {
      await setStorage(page, key, `fake_${key}`);
    }
    
    const beforeCount = Object.values(await getAllStorage(page)).filter(v => v !== null).length;
    log(`设置假数据: ${beforeCount} 个字段`);
    
    takeScreenshot(page, 'case3-before');
    
    // 获取输入框
    const inputs = await page.$$('input.uni-input-input');
    if (inputs.length < 2) {
      testResults.skipped++;
      testResults.details.push({ case: 3, result: 'SKIP', reason: '输入框不足' });
      return;
    }
    
    // 输入手机号
    await inputs[0].click({ clickCount: 3 });
    await inputs[0].type(TEST_PHONE, { delay: 50 });
    await sleep(500);
    
    // 点击获取验证码 - 此时 Storage 不应该清空
    const codeBtn = await page.$('.h5-code-btn');
    if (codeBtn) {
      await codeBtn.click();
      log('点击获取验证码');
      await sleep(1500);
    }
    
    const afterCode = Object.values(await getAllStorage(page)).filter(v => v !== null).length;
    log(`点击验证码后: ${afterCode} 个字段`);
    
    if (afterCode === 0) {
      log('⚠️ 点击验证码按钮时 Storage 已清空（不符合预期）');
    } else {
      log('✅ 点击验证码按钮后 Storage 未清空（符合预期）');
    }
    
    // 输入验证码
    await inputs[1].click();
    await inputs[1].type(TEST_CODE, { delay: 50 });
    await sleep(500);
    
    // 勾选协议
    const checkbox = await page.$('.h5-agreement .checkbox');
    if (checkbox) {
      const isChecked = await checkbox.evaluate(el => el.classList.contains('checked'));
      if (!isChecked) {
        await checkbox.click();
        await sleep(300);
      }
    }
    
    // 点击登录按钮 - 这时应该清空旧 Storage
    const loginBtn = await page.$('.h5-login-btn');
    if (!loginBtn) {
      testResults.skipped++;
      testResults.details.push({ case: 3, result: 'SKIP', reason: '无登录按钮' });
      return;
    }
    
    await loginBtn.click();
    log('点击登录按钮');
    await sleep(3000);
    
    // 处理身份选择
    const roleModal = await page.$('.role-modal, .uni-modal');
    if (roleModal) {
      const allButtons = await page.$$('button, .btn, .uni-modal__btn');
      for (const btn of allButtons) {
        const text = await btn.evaluate(el => el.textContent.trim());
        if (text.includes('助教')) {
          await btn.click();
          log('选择助教');
          await sleep(2000);
          break;
        }
      }
    }
    
    takeScreenshot(page, 'case3-after');
    
    // 检查假数据是否清空
    const afterLogin = await getAllStorage(page);
    let fakeCleared = true;
    for (const [key, value] of Object.entries(afterLogin)) {
      if (value && value.includes('fake_')) {
        log(`  假数据残留: ${key}`);
        fakeCleared = false;
      }
    }
    
    if (fakeCleared) {
      log('✅ 用例3 通过: 假数据已清空');
      testResults.passed++;
      testResults.details.push({ case: 3, result: 'PASS' });
    } else {
      log('❌ 用例3 失败: 假数据未清空');
      testResults.failed++;
      testResults.details.push({ case: 3, result: 'FAIL', reason: '假数据残留' });
    }
  } catch (err) {
    log(`用例3 异常: ${err.message}`);
    testResults.failed++;
    testResults.details.push({ case: 3, result: 'FAIL', reason: err.message });
  }
}

// ========================================
// 用例4：退出登录清空 Storage
// ========================================
async function test4_LogoutClearsStorage(page) {
  log('\n=== 用例4：退出登录清空 Storage ===');
  
  try {
    // 确保已登录
    const storage = await getAllStorage(page);
    if (!storage.memberToken) {
      log('需要先登录');
      const success = await performLogin(page);
      if (!success) {
        testResults.skipped++;
        testResults.details.push({ case: 4, result: 'SKIP', reason: '无法登录' });
        return;
      }
    }
    
    log('已登录，进入个人设置页');
    await page.goto(`${BASE_URL}/#/pages/profile/profile`, { waitUntil: 'networkidle2' });
    await sleep(2000);
    
    takeScreenshot(page, 'case4-profile');
    
    // 点击退出登录
    const logoutBtn = await page.$('.logout-btn');
    if (!logoutBtn) {
      log('未找到退出按钮');
      testResults.skipped++;
      testResults.details.push({ case: 4, result: 'SKIP', reason: '无退出按钮' });
      return;
    }
    
    await logoutBtn.click();
    log('点击退出登录');
    await sleep(1000);
    
    takeScreenshot(page, 'case4-modal');
    
    // 确认退出
    const confirmBtn = await page.$('.uni-modal__btn_primary');
    if (confirmBtn) {
      await confirmBtn.click();
      log('确认退出');
      await sleep(2000);
    } else {
      // 其他方式确认
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await btn.evaluate(el => el.textContent.trim());
        if (text === '确定') {
          await btn.click();
          break;
        }
      }
      await sleep(2000);
    }
    
    takeScreenshot(page, 'case4-after');
    
    // 验证 Storage 清空
    const afterLogout = await getAllStorage(page);
    const notCleared = Object.entries(afterLogout)
      .filter(([k, v]) => v !== null)
      .map(([k]) => k);
    
    if (notCleared.length === 0) {
      log('✅ 用例4 通过: Storage 全部清空');
      testResults.passed++;
      testResults.details.push({ case: 4, result: 'PASS' });
    } else {
      log(`❌ 用例4 失败: 未清空 ${notCleared.join(', ')}`);
      testResults.failed++;
      testResults.details.push({ case: 4, result: 'FAIL', reason: `未清空: ${notCleared.join(',')}` });
    }
  } catch (err) {
    log(`用例4 异常: ${err.message}`);
    testResults.failed++;
    testResults.details.push({ case: 4, result: 'FAIL', reason: err.message });
  }
}

// ========================================
// 主函数
// ========================================
async function runTests() {
  fs.writeFileSync(LOG_FILE, '');
  log('=== memberInfo Storage 测试开始（V3） ===');
  log(`测试时间: ${new Date().toLocaleString('zh-CN')}`);
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 },
    protocolTimeout: 120000
  });
  
  log('Chrome 连接成功');
  
  let pages = await browser.pages();
  let page = pages[0] || await browser.newPage();
  
  try {
    // 先清空状态
    await clearAllStorage(page);
    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    
    // 执行测试（每个用例独立）
    await test1_SMSLoginMemberInfo(page);
    
    // 用例3需要重新设置状态
    await test3_LoginButtonClearsStorage(page);
    
    // 用例4需要先确保登录状态
    await test4_LogoutClearsStorage(page);
    
    // 汇报结果
    log('\n=== 测试汇总 ===');
    log(`通过: ${testResults.passed}`);
    log(`失败: ${testResults.failed}`);
    log(`跳过: ${testResults.skipped}`);
    
    testResults.details.forEach(d => {
      log(`用例${d.case}: ${d.result} ${d.reason || ''}`);
    });
    
  } finally {
    const allPages = await browser.pages();
    for (const p of allPages) {
      if (p !== page) await p.close();
    }
    browser.disconnect();
    log('测试结束');
  }
}

runTests().catch(err => {
  log(`脚本异常: ${err.message}`);
  console.error(err);
});