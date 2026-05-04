/**
 * memberInfo Storage 测试脚本（V2修正版）
 * 测试环境: Chrome 9222端口
 * 测试网址: https://tg.tiangong.club
 */

const puppeteer = require('/usr/lib/node_modules/puppeteer');
const fs = require('fs');

const BASE_URL = 'https://tg.tiangong.club';
const TEST_PHONE = '18600000004';
const TEST_CODE = '888888';

const LOG_FILE = '/TG/temp/test/memberinfo-test-v2.log';
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
    const path = `${SCREENSHOT_DIR}/memberinfo-v2-${name}-${Date.now()}.png`;
    await page.screenshot({ path, fullPage: false });
    log(`截图保存: ${path}`);
  } catch (e) {
    log(`截图失败: ${e.message}`);
  }
}

// ========================================
// 用例1：SMS登录成功后 memberInfo 存储
// ========================================
async function test1_SMSLoginMemberInfo(page) {
  log('\n=== 用例1：SMS登录成功后 memberInfo 存储 ===');
  
  try {
    // 1. 清空 Storage 并刷新页面
    await clearAllStorage(page);
    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2' });
    await sleep(2000);
    
    takeScreenshot(page, 'case1-initial');
    
    // 2. 获取所有输入框 - 修正选择器
    const inputs = await page.$$('input.uni-input-input');
    if (inputs.length < 2) {
      log(`输入框数量不足: ${inputs.length}`);
      testResults.skipped++;
      testResults.details.push({ case: 1, result: 'SKIP', reason: '输入框数量不足' });
      return;
    }
    
    const phoneInput = inputs[0];  // 第一个是手机号
    const codeInput = inputs[1];   // 第二个是验证码
    
    // 3. 输入手机号
    await phoneInput.click({ clickCount: 3 });
    await phoneInput.type(TEST_PHONE, { delay: 50 });
    log(`输入手机号: ${TEST_PHONE}`);
    await sleep(500);
    
    takeScreenshot(page, 'case1-phone-entered');
    
    // 4. 点击获取验证码
    const codeBtn = await page.$('.h5-code-btn');
    if (codeBtn) {
      await codeBtn.click();
      log('点击获取验证码按钮');
      await sleep(1500);
    }
    
    // 5. 输入验证码
    await codeInput.click();
    await codeInput.type(TEST_CODE, { delay: 50 });
    log(`输入验证码: ${TEST_CODE}`);
    await sleep(500);
    
    takeScreenshot(page, 'case1-code-entered');
    
    // 6. 勾选同意协议
    const checkbox = await page.$('.h5-agreement .checkbox');
    if (checkbox) {
      const isChecked = await checkbox.evaluate(el => el.classList.contains('checked'));
      if (!isChecked) {
        await checkbox.click();
        log('勾选同意协议');
        await sleep(300);
      }
    }
    
    takeScreenshot(page, 'case1-before-login');
    
    // 7. 点击登录按钮
    const loginBtn = await page.$('.h5-login-btn');
    if (!loginBtn) {
      log('未找到登录按钮');
      testResults.skipped++;
      testResults.details.push({ case: 1, result: 'SKIP', reason: '未找到登录按钮' });
      return;
    }
    
    await loginBtn.click();
    log('点击登录按钮');
    await sleep(3000);
    
    takeScreenshot(page, 'case1-after-login');
    
    // 8. 检查是否需要选择身份
    const roleModal = await page.$('.role-modal, .uni-modal');
    if (roleModal) {
      log('检测到身份选择弹窗');
      // 尝试点击助教按钮
      const buttons = await page.$$('button, .uni-modal-btn-confirm, .role-btn');
      for (const btn of buttons) {
        const text = await btn.evaluate(el => el.textContent);
        if (text.includes('助教')) {
          await btn.click();
          log('选择助教身份');
          await sleep(2000);
          break;
        }
      }
      takeScreenshot(page, 'case1-after-role-select');
    }
    
    // 9. 验证 Storage
    const storage = await getAllStorage(page);
    log(`Storage: memberToken=${storage.memberToken ? '有值' : '空'}, memberInfo=${storage.memberInfo ? '有值' : '空'}`);
    
    let memberInfo = null;
    try {
      memberInfo = storage.memberInfo ? JSON.parse(storage.memberInfo) : null;
    } catch (e) {
      log(`memberInfo 解析失败: ${e.message}`);
    }
    
    if (storage.memberToken && memberInfo && memberInfo.phone === TEST_PHONE) {
      log(`✅ 用例1 通过: memberInfo 正确存储`);
      log(`   memberInfo: ${JSON.stringify(memberInfo)}`);
      testResults.passed++;
      testResults.details.push({ case: 1, result: 'PASS', memberInfo });
    } else {
      log(`❌ 用例1 失败: memberToken=${!!storage.memberToken}, phone=${memberInfo?.phone}`);
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
// 用例3：点击登录按钮时清空旧 Storage
// ========================================
async function test3_LoginButtonClearsStorage(page) {
  log('\n=== 用例3：点击登录按钮时清空旧 Storage ===');
  
  try {
    // 1. 清空并设置假数据
    await clearAllStorage(page);
    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2' });
    await sleep(1500);
    
    // 设置假数据
    for (const key of STORAGE_KEYS) {
      await setStorage(page, key, `old_${key}_value`);
    }
    
    const beforeStorage = await getAllStorage(page);
    const beforeCount = Object.values(beforeStorage).filter(v => v !== null).length;
    log(`设置假数据后: ${beforeCount} 个字段有值`);
    
    takeScreenshot(page, 'case3-before-login');
    
    // 2. 输入手机号
    const inputs = await page.$$('input.uni-input-input');
    if (inputs.length < 2) {
      testResults.skipped++;
      testResults.details.push({ case: 3, result: 'SKIP', reason: '输入框数量不足' });
      return;
    }
    
    await inputs[0].click({ clickCount: 3 });
    await inputs[0].type(TEST_PHONE, { delay: 50 });
    log(`输入手机号: ${TEST_PHONE}`);
    await sleep(500);
    
    // 3. 点击获取验证码（此时 Storage 不应该清空）
    const codeBtn = await page.$('.h5-code-btn');
    if (codeBtn) {
      await codeBtn.click();
      log('点击获取验证码按钮');
      await sleep(1500);
    }
    
    const afterCodeClick = await getAllStorage(page);
    const afterCodeCount = Object.values(afterCodeClick).filter(v => v !== null).length;
    log(`点击验证码后: ${afterCodeCount} 个字段有值`);
    
    if (afterCodeCount === 0) {
      log('⚠️ 点击验证码按钮时 Storage 已清空（不符合预期）');
    } else {
      log('✅ 点击验证码按钮后 Storage 未清空（符合预期）');
    }
    
    // 4. 输入验证码
    await inputs[1].click();
    await inputs[1].type(TEST_CODE, { delay: 50 });
    await sleep(500);
    
    // 5. 勾选同意协议
    const checkbox = await page.$('.h5-agreement .checkbox');
    if (checkbox) {
      const isChecked = await checkbox.evaluate(el => el.classList.contains('checked'));
      if (!isChecked) {
        await checkbox.click();
        log('勾选同意协议');
        await sleep(300);
      }
    }
    
    takeScreenshot(page, 'case3-ready-login');
    
    // 6. 点击登录按钮（这时应该清空旧 Storage）
    const loginBtn = await page.$('.h5-login-btn');
    if (!loginBtn) {
      testResults.skipped++;
      testResults.details.push({ case: 3, result: 'SKIP', reason: '未找到登录按钮' });
      return;
    }
    
    await loginBtn.click();
    log('点击登录按钮');
    await sleep(3000);
    
    takeScreenshot(page, 'case3-after-login');
    
    // 7. 检查假数据是否清空
    const afterLogin = await getAllStorage(page);
    
    let fakeDataCleared = true;
    for (const [key, value] of Object.entries(afterLogin)) {
      if (value && value.includes('old_')) {
        log(`  ❌ ${key} 还是假数据: ${value.slice(0, 30)}`);
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
    await sleep(2000);
    
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
    
    takeScreenshot(page, 'case4-confirm-modal');
    
    // 4. 确认弹窗
    const confirmBtn = await page.$('.uni-modal-btn-confirm');
    if (confirmBtn) {
      await confirmBtn.click();
      log('确认退出');
      await sleep(2000);
    } else {
      // 尝试其他方式
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
    
    // 打印未清空的字段
    const notCleared = [];
    for (const [key, value] of Object.entries(afterLogout)) {
      if (value !== null) {
        notCleared.push(key);
        log(`  未清空: ${key} = ${value.slice(0, 50)}`);
      }
    }
    
    if (afterCount === 0) {
      log('✅ 用例4 通过: 退出登录后 Storage 全部清空');
      testResults.passed++;
      testResults.details.push({ case: 4, result: 'PASS' });
    } else {
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
  // 清空日志文件
  fs.writeFileSync(LOG_FILE, '');
  
  log('=== memberInfo Storage 测试开始（V2） ===');
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
    // 关闭多余标签页
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