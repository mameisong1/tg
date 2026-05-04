/**
 * memberInfo Storage 测试脚本（修正版）
 * 测试环境: Chrome 9222端口
 * 测试网址: https://tg.tiangong.club
 */

const puppeteer = require('/usr/lib/node_modules/puppeteer');
const fs = require('fs');

const BASE_URL = 'https://tg.tiangong.club';
const TEST_PHONE = '18600000004';
const TEST_CODE = '888888';

const LOG_FILE = '/TG/temp/test/memberinfo-test-fixed.log';
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
  const path = `${SCREENSHOT_DIR}/memberinfo-fixed-${name}-${Date.now()}.png`;
  await page.screenshot({ path, fullPage: false });
  log(`截图保存: ${path}`);
}

// ========================================
// 用例1：SMS登录成功后 memberInfo 存储
// ========================================
async function test1_SMSLoginMemberInfo(page) {
  log('\n=== 用例1：SMS登录成功后 memberInfo 存储 ===');
  
  try {
    // 1. 清空 Storage
    await clearAllStorage(page);
    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2' });
    await sleep(2000);
    
    // 2. 输入手机号
    const phoneInput = await page.$('input[type="tel"], input[placeholder*="手机"]');
    if (!phoneInput) {
      log('未找到手机号输入框');
      takeScreenshot(page, 'case1-no-phone-input');
      testResults.skipped++;
      testResults.details.push({ case: 1, result: 'SKIP', reason: '未找到手机号输入框' });
      return;
    }
    await phoneInput.click({ clickCount: 3 });
    await phoneInput.type(TEST_PHONE);
    log(`输入手机号: ${TEST_PHONE}`);
    await sleep(500);
    
    // 3. 点击获取验证码
    const codeBtn = await page.$('.h5-code-btn');
    if (codeBtn) {
      await codeBtn.click();
      log('点击获取验证码按钮');
      await sleep(2000);
    }
    
    // 4. 输入验证码
    const codeInput = await page.$('input[placeholder*="验证码"], input[maxlength="6"]');
    if (!codeInput) {
      log('未找到验证码输入框');
      takeScreenshot(page, 'case1-no-code-input');
      testResults.skipped++;
      testResults.details.push({ case: 1, result: 'SKIP', reason: '未找到验证码输入框' });
      return;
    }
    await codeInput.click();
    await codeInput.type(TEST_CODE);
    log(`输入验证码: ${TEST_CODE}`);
    await sleep(500);
    
    // 5. 勾选同意协议（关键步骤！）
    const agreementCheckbox = await page.$('.h5-agreement .checkbox');
    if (agreementCheckbox) {
      const isChecked = await agreementCheckbox.evaluate(el => el.classList.contains('checked'));
      if (!isChecked) {
        await agreementCheckbox.click();
        log('勾选同意协议');
        await sleep(300);
      }
    } else {
      log('未找到协议勾选框，尝试点击协议文字');
      const agreementText = await page.$('.agreement-text');
      if (agreementText) {
        await agreementText.click();
        log('点击同意协议文字');
        await sleep(300);
      }
    }
    
    // 6. 点击登录按钮（这时才应该清空旧 Storage）
    const loginBtn = await page.$('.h5-login-btn');
    if (!loginBtn) {
      log('未找到登录按钮');
      takeScreenshot(page, 'case1-no-login-btn');
      testResults.skipped++;
      testResults.details.push({ case: 1, result: 'SKIP', reason: '未找到登录按钮' });
      return;
    }
    
    takeScreenshot(page, 'case1-before-login-click');
    await loginBtn.click();
    log('点击登录按钮');
    await sleep(3000);
    
    // 6. 检查是否需要选择身份
    takeScreenshot(page, 'case1-after-login-click');
    const roleModal = await page.$('.role-modal, .uni-modal');
    if (roleModal) {
      // 选择助教身份
      const coachBtn = await page.$('button:has-text("助教"), .coach-role-btn');
      if (!coachBtn) {
        // 尝试其他选择器
        const buttons = await page.$$('button');
        for (const btn of buttons) {
          const text = await btn.evaluate(el => el.textContent);
          if (text.includes('助教')) {
            await btn.click();
            log('选择助教身份');
            break;
          }
        }
      } else {
        await coachBtn.click();
        log('选择助教身份');
      }
      await sleep(2000);
    }
    
    takeScreenshot(page, 'case1-after-role-select');
    
    // 7. 验证 Storage
    const storage = await getAllStorage(page);
    log(`Storage 状态: memberToken=${storage.memberToken ? '有值' : '空'}, memberInfo=${storage.memberInfo || '空'}`);
    
    const memberInfo = storage.memberInfo ? JSON.parse(storage.memberInfo) : null;
    
    if (storage.memberToken && memberInfo && memberInfo.phone === TEST_PHONE) {
      log(`✅ 用例1 通过: memberInfo 正确存储`);
      log(`   memberInfo: ${JSON.stringify(memberInfo)}`);
      testResults.passed++;
      testResults.details.push({ case: 1, result: 'PASS', memberInfo });
    } else {
      log(`❌ 用例1 失败: memberToken=${storage.memberToken}, memberInfo=${storage.memberInfo}`);
      testResults.failed++;
      testResults.details.push({ case: 1, result: 'FAIL', reason: '登录未成功或 memberInfo 未存储' });
    }
  } catch (err) {
    log(`用例1 异常: ${err.message}`);
    takeScreenshot(page, 'case1-error');
    testResults.failed++;
    testResults.details.push({ case: 1, result: 'FAIL', reason: err.message });
  }
}

// ========================================
// 用例3：点击登录按钮时清空旧 Storage（修正）
// ========================================
async function test3_LoginButtonClearsStorage(page) {
  log('\n=== 用例3：点击登录按钮时清空旧 Storage ===');
  
  try {
    // 1. 设置假数据（模拟旧登录状态）
    await clearAllStorage(page);  // 先清空
    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    
    // 设置12个字段都有值
    for (const key of STORAGE_KEYS) {
      await setStorage(page, key, `old_${key}_value`);
    }
    
    const beforeStorage = await getAllStorage(page);
    const beforeCount = Object.values(beforeStorage).filter(v => v !== null).length;
    log(`登录前 Storage: ${beforeCount} 个字段有值`);
    
    takeScreenshot(page, 'case3-before-login');
    
    // 2. 输入手机号
    const phoneInput = await page.$('input[type="tel"], input[placeholder*="手机"]');
    if (!phoneInput) {
      log('未找到手机号输入框');
      testResults.skipped++;
      testResults.details.push({ case: 3, result: 'SKIP', reason: '未找到手机号输入框' });
      return;
    }
    await phoneInput.click({ clickCount: 3 });
    await phoneInput.type(TEST_PHONE);
    await sleep(500);
    
    // 3. 点击获取验证码（此时 Storage 不应该清空）
    const codeBtn = await page.$('.h5-code-btn');
    if (codeBtn) {
      await codeBtn.click();
      log('点击获取验证码按钮（Storage 应该还没清空）');
      await sleep(1500);
    }
    
    const afterCodeClick = await getAllStorage(page);
    const afterCodeCount = Object.values(afterCodeClick).filter(v => v !== null).length;
    log(`点击验证码后 Storage: ${afterCodeCount} 个字段有值`);
    
    // 验证：点击验证码后 Storage 不应该清空
    if (afterCodeCount === 0) {
      log('⚠️ 点击验证码按钮时 Storage 已清空（不符合预期，应该是在登录按钮时清空）');
    } else {
      log('✅ 点击验证码按钮后 Storage 未清空（符合预期）');
    }
    
    // 4. 输入验证码
    const codeInput = await page.$('input[placeholder*="验证码"], input[maxlength="6"]');
    if (codeInput) {
      await codeInput.click();
      await codeInput.type(TEST_CODE);
      await sleep(500);
    }
    
    // 5. 勾选同意协议
    const agreementCheckbox = await page.$('.h5-agreement .checkbox');
    if (agreementCheckbox) {
      const isChecked = await agreementCheckbox.evaluate(el => el.classList.contains('checked'));
      if (!isChecked) {
        await agreementCheckbox.click();
        log('勾选同意协议');
        await sleep(300);
      }
    }
    
    // 6. 点击登录按钮（这时应该清空旧 Storage）
    const loginBtn = await page.$('.h5-login-btn');
    if (!loginBtn) {
      log('未找到登录按钮');
      testResults.skipped++;
      testResults.details.push({ case: 3, result: 'SKIP', reason: '未找到登录按钮' });
      return;
    }
    
    await loginBtn.click();
    log('点击登录按钮（这时应该清空旧 Storage）');
    await sleep(2000);
    
    takeScreenshot(page, 'case3-after-login-click');
    
    // 6. 验证 Storage 是否清空
    const afterLogin = await getAllStorage(page);
    const afterLoginCount = Object.values(afterLogin).filter(v => v !== null).length;
    log(`点击登录按钮后 Storage: ${afterLoginCount} 个字段有值`);
    
    // 注意：登录成功后会设置新的 memberToken 和 memberInfo
    // 所以这里验证的是：旧的假数据被清空，新的真实数据被写入
    
    // 检查假数据是否被清空
    let fakeDataCleared = true;
    for (const [key, value] of Object.entries(afterLogin)) {
      if (value && value.includes('old_')) {
        log(`  ❌ ${key} 还是假数据: ${value}`);
        fakeDataCleared = false;
      }
    }
    
    if (fakeDataCleared) {
      log('✅ 用例3 通过: 旧假数据已清空');
      testResults.passed++;
      testResults.details.push({ case: 3, result: 'PASS' });
    } else {
      log('❌ 用例3 失败: 旧假数据未清空');
      testResults.failed++;
      testResults.details.push({ case: 3, result: 'FAIL', reason: '旧假数据未清空' });
    }
  } catch (err) {
    log(`用例3 异常: ${err.message}`);
    takeScreenshot(page, 'case3-error');
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
    // 1. 确保已登录
    const storage = await getAllStorage(page);
    if (!storage.memberToken) {
      log('未登录，跳过用例4');
      testResults.skipped++;
      testResults.details.push({ case: 4, result: 'SKIP', reason: '未登录' });
      return;
    }
    
    log(`当前已登录，memberToken 有值`);
    
    // 2. 进入 profile 页面
    await page.goto(`${BASE_URL}/#/pages/profile/profile`, { waitUntil: 'networkidle2' });
    await sleep(1500);
    
    takeScreenshot(page, 'case4-profile-page');
    
    // 3. 点击退出登录按钮
    const logoutBtn = await page.$('.logout-btn');
    if (!logoutBtn) {
      log('未找到退出登录按钮');
      testResults.skipped++;
      testResults.details.push({ case: 4, result: 'SKIP', reason: '未找到退出按钮' });
      return;
    }
    
    await logoutBtn.click();
    log('点击退出登录按钮');
    await sleep(1000);
    
    // 4. 确认弹窗
    takeScreenshot(page, 'case4-confirm-modal');
    await sleep(500);
    
    // 先尝试 uni-modal 的确认按钮
    let confirmBtn = await page.$('.uni-modal-btn-confirm');
    if (confirmBtn) {
      await confirmBtn.click();
      log('确认退出（uni-modal-btn-confirm）');
      await sleep(2000);
    } else {
      // 尝试其他方式找确定按钮
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await btn.evaluate(el => el.textContent);
        if (text.includes('确定') || text.includes('确认')) {
          await btn.click();
          log('确认退出（button）');
          break;
        }
      }
      await sleep(2000);
    }
    
    takeScreenshot(page, 'case4-after-logout');
    
    // 5. 验证 Storage 是否清空
    const afterLogout = await getAllStorage(page);
    const afterCount = Object.values(afterLogout).filter(v => v !== null).length;
    log(`退出后 Storage: ${afterCount} 个字段有值`);
    
    if (afterCount === 0) {
      log('✅ 用例4 通过: 退出登录后 Storage 全部清空');
      testResults.passed++;
      testResults.details.push({ case: 4, result: 'PASS' });
    } else {
      const notCleared = Object.entries(afterLogout).filter(([k,v]) => v !== null).map(([k]) => k);
      log(`❌ 用例4 失败: 未清空的字段: ${notCleared.join(', ')}`);
      testResults.failed++;
      testResults.details.push({ case: 4, result: 'FAIL', reason: `未清空: ${notCleared.join(',')}` });
    }
  } catch (err) {
    log(`用例4 异常: ${err.message}`);
    takeScreenshot(page, 'case4-error');
    testResults.failed++;
    testResults.details.push({ case: 4, result: 'FAIL', reason: err.message });
  }
}

// ========================================
// 主函数
// ========================================
async function runTests() {
  log('=== memberInfo Storage 测试开始（修正版） ===');
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
    // 执行测试
    await test1_SMSLoginMemberInfo(page);
    await test3_LoginButtonClearsStorage(page);
    await test4_LogoutClearsStorage(page);
    
    // 汇报结果
    log('\n=== 测试汇总 ===');
    log(`通过: ${testResults.passed}`);
    log(`失败: ${testResults.failed}`);
    log(`跳过: ${testResults.skipped}`);
    
    testResults.details.forEach(d => {
      log(`用例${d.case}: ${d.result} ${d.reason ? '- ' + d.reason : ''}`);
    });
    
  } finally {
    // 关闭所有标签页
    const allPages = await browser.pages();
    for (const p of allPages) {
      if (p !== page) await p.close();
    }
    browser.disconnect();
    log('测试结束，浏览器断开连接');
  }
}

runTests().catch(err => {
  log(`测试脚本异常: ${err.message}`);
  console.error(err);
});