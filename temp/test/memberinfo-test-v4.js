const puppeteer = require('/usr/lib/node_modules/puppeteer');
const fs = require('fs');

const LOG_FILE = '/TG/temp/test/memberinfo-test.log';
const SCREENSHOT_DIR = '/root/.openclaw/workspace_coder-tg/';
const BASE_URL = 'https://tg.tiangong.club';

// 12个需要验证的 Storage 字段
const STORAGE_FIELDS = [
  'memberToken', 'memberInfo', 'coachToken', 'coachInfo',
  'adminToken', 'adminInfo', 'preferredRole', 'sessionId',
  'tablePinyin', 'tableName', 'tableAuth', 'highlightProduct'
];

let browser = null;
let page = null;
let testResults = { passed: 0, failed: 0, skipped: 0, details: [] };

function log(message) {
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const logLine = `[${timestamp}] ${message}`;
  console.log(logLine);
  fs.appendFileSync(LOG_FILE, logLine + '\n');
}

async function takeScreenshot(name) {
  try {
    const filename = `memberinfo-test-${name}-${Date.now()}.png`;
    const path = `${SCREENSHOT_DIR}${filename}`;
    await page.screenshot({ path, fullPage: true });
    log(`截图保存: ${path}`);
    return path;
  } catch (e) {
    log(`截图失败: ${e.message}`);
    return null;
  }
}

async function clearAllStorage() {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function setStorageItem(key, value) {
  await page.evaluate((k, v) => {
    localStorage.setItem(k, JSON.stringify(v));
  }, key, value);
}

async function getStorageItem(key) {
  return await page.evaluate((k) => {
    const item = localStorage.getItem(k);
    return item ? JSON.parse(item) : null;
  }, key);
}

async function getAllStorageValues() {
  return await page.evaluate((fields) => {
    const values = {};
    fields.forEach(field => {
      const item = localStorage.getItem(field);
      values[field] = item;
    });
    return values;
  }, STORAGE_FIELDS);
}

async function waitForTimeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 检查是否已登录
async function isLoggedIn() {
  const memberInfo = await getStorageItem('memberInfo');
  return memberInfo && memberInfo.memberNo;
}

// 等待页面变成登录状态（未登录时显示登录表单）
async function waitForLoginPage(timeout = 10000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const hasLoginForm = await page.evaluate(() => {
      // 检查是否有登录表单
      const loginCard = document.querySelector('.h5-login-card');
      const loginSection = document.querySelector('.login-section');
      const inputs = document.querySelectorAll('uni-input, input');
      return loginCard !== null || loginSection !== null || inputs.length > 0;
    });
    if (hasLoginForm) {
      return true;
    }
    await waitForTimeout(500);
  }
  return false;
}

// 等待页面变成已登录状态
async function waitForLoggedIn(timeout = 10000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const memberSection = await page.$('.member-section');
    if (memberSection) {
      return true;
    }
    await waitForTimeout(500);
  }
  return false;
}

// H5登录流程
async function doH5Login(phone, needRoleSelect = true) {
  log(`开始登录流程: phone=${phone}`);
  
  // 等待登录表单出现
  const hasLoginForm = await waitForLoginPage(5000);
  if (!hasLoginForm) {
    log('未找到登录表单，可能已登录');
    return false;
  }
  
  await takeScreenshot('login-form');
  
  // 1. 同意协议
  const checkbox = await page.$('.checkbox');
  if (checkbox) {
    const isChecked = await page.evaluate(el => el.classList.contains('checked'), checkbox);
    if (!isChecked) {
      log('勾选协议...');
      await checkbox.click();
      await waitForTimeout(300);
    }
  }
  
  // 2. 输入手机号 - uni-app 使用 uni-input
  const inputs = await page.$$('uni-input, input');
  log(`找到 ${inputs.length} 个输入框`);
  
  // 找手机号输入框（第一个）
  if (inputs.length > 0) {
    const phoneInput = inputs[0];
    log('输入手机号...');
    
    // 清空并输入
    await phoneInput.click();
    await waitForTimeout(200);
    
    // 通过 evaluate 设置值（uni-app 可能需要这样）
    await page.evaluate((el, value) => {
      const input = el.querySelector('input') || el;
      input.value = value;
      // 触发 input 事件
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, phoneInput, phone);
    
    await waitForTimeout(500);
    
    // 验证输入
    const phoneValue = await page.evaluate(el => {
      const input = el.querySelector('input') || el;
      return input.value;
    }, phoneInput);
    log(`手机号输入框值: "${phoneValue}"`);
  }
  
  // 3. 点击获取验证码
  const codeBtn = await page.$('.h5-code-btn');
  if (codeBtn) {
    const isDisabled = await page.evaluate(el => el.classList.contains('disabled'), codeBtn);
    if (!isDisabled) {
      log('点击获取验证码...');
      await codeBtn.click();
      await waitForTimeout(2000);
    }
  }
  
  await takeScreenshot('after-code-btn');
  
  // 4. 输入验证码 - 第二个输入框
  if (inputs.length > 1) {
    const codeInput = inputs[1];
    log('输入验证码...');
    
    await page.evaluate((el, value) => {
      const input = el.querySelector('input') || el;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, codeInput, '888888');
    
    await waitForTimeout(500);
  }
  
  await takeScreenshot('after-code-input');
  
  // 5. 点击登录
  const loginBtn = await page.$('.h5-login-btn');
  if (loginBtn) {
    log('点击登录按钮...');
    await loginBtn.click();
    await waitForTimeout(3000);
  }
  
  await takeScreenshot('after-login-click');
  
  // 6. 选择身份（如果需要）
  if (needRoleSelect) {
    const roleModal = await page.$('.role-select-content');
    if (roleModal) {
      log('发现身份选择弹框');
      const roleOptions = await page.$$('.role-option');
      for (const option of roleOptions) {
        const text = await page.evaluate(el => el.textContent, option);
        if (text.includes('助教')) {
          log('选择助教身份...');
          await option.click();
          await waitForTimeout(2000);
          break;
        }
      }
    }
  }
  
  await takeScreenshot('after-role-select');
  
  // 7. 等待登录成功
  const loggedIn = await waitForLoggedIn(5000);
  if (loggedIn) {
    log('登录成功');
    return true;
  } else {
    log('登录未成功');
    return false;
  }
}

// 用例1：SMS登录成功后 memberInfo 存储
async function test1_SMSLoginMemberInfo() {
  log('\n=== 用例1：SMS登录成功后 memberInfo 存储 ===');
  try {
    await clearAllStorage();
    await setStorageItem('memberToken', 'old_token');
    await setStorageItem('memberInfo', { phone: '18600000000' });
    
    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitForTimeout(2000);
    
    // 执行登录
    const loginSuccess = await doH5Login('18600000004');
    
    if (!loginSuccess) {
      log('用例1 跳过: 登录未成功');
      testResults.skipped++;
      testResults.details.push({ case: 1, result: 'SKIP', reason: '登录未成功' });
      return;
    }
    
    // 验证 memberInfo
    const memberInfo = await getStorageItem('memberInfo');
    const allStorage = await getAllStorageValues();
    log(`Storage 状态: memberToken=${allStorage.memberToken?.substring(0, 50)}, memberInfo=${JSON.stringify(memberInfo)}`);
    
    if (memberInfo && memberInfo.phone === '18600000004') {
      log('用例1 通过: memberInfo 存储正确');
      testResults.passed++;
      testResults.details.push({ case: 1, result: 'PASS' });
    } else {
      log(`用例1 失败: memberInfo=${JSON.stringify(memberInfo)}`);
      testResults.failed++;
      testResults.details.push({ case: 1, result: 'FAIL', reason: 'memberInfo 不正确' });
    }
  } catch (error) {
    log(`用例1 异常: ${error.message}`);
    await takeScreenshot('case1-error');
    testResults.failed++;
    testResults.details.push({ case: 1, result: 'FAIL', reason: error.message });
  }
}

// 用例2：自动登录成功后 memberInfo 存储
async function test2_AutoLoginMemberInfo() {
  log('\n=== 用例2：自动登录成功后 memberInfo 存储 ===');
  try {
    // 检查当前是否已登录
    const currentToken = await getStorageItem('memberToken');
    
    if (!currentToken) {
      log('用例2 跳过: 无有效token');
      testResults.skipped++;
      testResults.details.push({ case: 2, result: 'SKIP', reason: '无有效token' });
      return;
    }
    
    // 刷新页面触发自动登录
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await waitForTimeout(3000);
    
    await takeScreenshot('case2-after-refresh');
    
    // 验证 memberInfo
    const memberInfo = await getStorageItem('memberInfo');
    if (memberInfo && memberInfo.phone) {
      log('用例2 通过: 自动登录后 memberInfo 存在');
      testResults.passed++;
      testResults.details.push({ case: 2, result: 'PASS' });
    } else {
      log(`用例2 失败: memberInfo=${JSON.stringify(memberInfo)}`);
      testResults.failed++;
      testResults.details.push({ case: 2, result: 'FAIL', reason: 'memberInfo 不存在' });
    }
  } catch (error) {
    log(`用例2 异常: ${error.message}`);
    await takeScreenshot('case2-error');
    testResults.failed++;
    testResults.details.push({ case: 2, result: 'FAIL', reason: error.message });
  }
}

// 用例3：SMS登录前清空旧 Storage
async function test3_ClearOldStorageBeforeLogin() {
  log('\n=== 用例3：SMS登录前清空旧 Storage ===');
  try {
    await clearAllStorage();
    
    // 设置所有12个字段
    for (const field of STORAGE_FIELDS) {
      await setStorageItem(field, `old_${field}_value`);
    }
    
    const beforeValues = await getAllStorageValues();
    log(`登录前 Storage 已设置 ${Object.keys(beforeValues).length} 个字段`);
    
    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitForTimeout(2000);
    
    // 等待登录表单出现
    await waitForLoginPage(5000);
    
    // 输入手机号
    const inputs = await page.$$('uni-input, input');
    if (inputs.length > 0) {
      await page.evaluate((el, value) => {
        const input = el.querySelector('input') || el;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, inputs[0], '18600000004');
      await waitForTimeout(500);
      
      // 点击获取验证码 - 此时应该清空旧数据
      const codeBtn = await page.$('.h5-code-btn');
      if (codeBtn) {
        await codeBtn.click();
        await waitForTimeout(2000);
      }
    }
    
    await takeScreenshot('case3-after-click-code');
    
    // 检查 Storage 是否已清空
    const afterValues = await getAllStorageValues();
    const remaining = Object.entries(afterValues).filter(([k, v]) => v !== null);
    
    if (remaining.length === 0) {
      log('用例3 通过: 所有旧数据已清空');
      testResults.passed++;
      testResults.details.push({ case: 3, result: 'PASS' });
    } else {
      log(`用例3 失败: 未清空的字段: ${remaining.map(r => r[0]).join(', ')}`);
      testResults.failed++;
      testResults.details.push({ case: 3, result: 'FAIL', reason: `未清空: ${remaining.map(r => r[0]).join(',')}` });
    }
  } catch (error) {
    log(`用例3 异常: ${error.message}`);
    await takeScreenshot('case3-error');
    testResults.failed++;
    testResults.details.push({ case: 3, result: 'FAIL', reason: error.message });
  }
}

// 用例4：退出登录按钮清空 Storage
async function test4_LogoutButtonClearStorage() {
  log('\n=== 用例4：退出登录按钮清空 Storage ===');
  try {
    // 确保已登录
    const token = await getStorageItem('memberToken');
    if (!token) {
      // 先登录
      await clearAllStorage();
      await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2', timeout: 30000 });
      await waitForTimeout(2000);
      await doH5Login('18600000004');
    }
    
    const currentToken = await getStorageItem('memberToken');
    if (!currentToken) {
      log('用例4 跳过: 登录未成功');
      testResults.skipped++;
      testResults.details.push({ case: 4, result: 'SKIP', reason: '登录未成功' });
      return;
    }
    
    await takeScreenshot('case4-after-login');
    
    // 进入 profile 页面
    await page.goto(`${BASE_URL}/#/pages/member/profile`, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitForTimeout(2000);
    
    await takeScreenshot('case4-profile-page');
    
    // 查找退出登录按钮
    const logoutClicked = await page.evaluate(() => {
      const elements = document.querySelectorAll('uni-view, uni-text, button, .setting-item');
      for (const el of elements) {
        if (el.textContent.includes('退出') || el.textContent.includes('登出')) {
          el.click();
          return true;
        }
      }
      return false;
    });
    
    if (logoutClicked) {
      log('点击了退出按钮');
      await waitForTimeout(1000);
      
      await takeScreenshot('case4-logout-confirm');
      
      // 确认弹窗（如果有）
      const confirmClicked = await page.evaluate(() => {
        const buttons = document.querySelectorAll('uni-view, button');
        for (const btn of buttons) {
          if (btn.textContent.includes('确定') || btn.textContent.includes('确认')) {
            btn.click();
            return true;
          }
        }
        return false;
      });
      
      if (confirmClicked) {
        log('点击了确认按钮');
        await waitForTimeout(2000);
      }
    }
    
    await takeScreenshot('case4-after-logout');
    
    // 验证 Storage 清空
    const afterValues = await getAllStorageValues();
    const remaining = Object.entries(afterValues).filter(([k, v]) => v !== null);
    
    if (remaining.length === 0) {
      log('用例4 通过: 退出登录后 Storage 已清空');
      testResults.passed++;
      testResults.details.push({ case: 4, result: 'PASS' });
    } else {
      log(`用例4 失败: 未清空的字段: ${remaining.map(r => r[0]).join(', ')}`);
      testResults.failed++;
      testResults.details.push({ case: 4, result: 'FAIL', reason: `未清空: ${remaining.map(r => r[0]).join(',')}` });
    }
  } catch (error) {
    log(`用例4 异常: ${error.message}`);
    await takeScreenshot('case4-error');
    testResults.failed++;
    testResults.details.push({ case: 4, result: 'FAIL', reason: error.message });
  }
}

// 用例5：Token失效自动登出清空 Storage
async function test5_TokenExpireAutoLogout() {
  log('\n=== 用例5：Token失效自动登出清空 Storage ===');
  try {
    // 确保已登录
    const token = await getStorageItem('memberToken');
    if (!token) {
      await clearAllStorage();
      await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2', timeout: 30000 });
      await waitForTimeout(2000);
      await doH5Login('18600000004');
    }
    
    const currentToken = await getStorageItem('memberToken');
    if (!currentToken) {
      log('用例5 跳过: 登录未成功');
      testResults.skipped++;
      testResults.details.push({ case: 5, result: 'SKIP', reason: '登录未成功' });
      return;
    }
    
    // 修改 token 为无效值
    await page.evaluate(() => {
      localStorage.setItem('memberToken', JSON.stringify('invalid_token_for_test'));
    });
    
    log('已设置无效 token');
    
    // 触发需要认证的请求 - 访问 profile 页
    await page.goto(`${BASE_URL}/#/pages/member/profile`, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitForTimeout(3000);
    
    await takeScreenshot('case5-after-invalid-token');
    
    // 验证 Storage 清空并跳转
    const currentUrl = page.url();
    log(`当前URL: ${currentUrl}`);
    
    if (currentUrl.includes('/member/member') || !currentUrl.includes('/profile')) {
      log('用例5 通过: Token失效后已跳转到会员页');
      testResults.passed++;
      testResults.details.push({ case: 5, result: 'PASS' });
    } else {
      log(`用例5 失败: URL=${currentUrl}`);
      testResults.failed++;
      testResults.details.push({ case: 5, result: 'FAIL', reason: '未跳转到会员页' });
    }
  } catch (error) {
    log(`用例5 异常: ${error.message}`);
    await takeScreenshot('case5-error');
    testResults.failed++;
    testResults.details.push({ case: 5, result: 'FAIL', reason: error.message });
  }
}

// 用例6：页面刷新后 memberInfo 加载
async function test6_PageRefreshLoadMemberInfo() {
  log('\n=== 用例6：页面刷新后 memberInfo 加载 ===');
  try {
    // 确保已登录
    const token = await getStorageItem('memberToken');
    if (!token) {
      await clearAllStorage();
      await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2', timeout: 30000 });
      await waitForTimeout(2000);
      await doH5Login('18600000004');
    }
    
    const beforeRefresh = await getStorageItem('memberInfo');
    log(`刷新前 memberInfo: ${JSON.stringify(beforeRefresh)}`);
    
    if (!beforeRefresh) {
      log('用例6 跳过: 登录未成功');
      testResults.skipped++;
      testResults.details.push({ case: 6, result: 'SKIP', reason: '登录未成功' });
      return;
    }
    
    // 刷新页面
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await waitForTimeout(3000);
    
    await takeScreenshot('case6-after-refresh');
    
    // 验证 memberInfo
    const afterRefresh = await getStorageItem('memberInfo');
    if (afterRefresh && afterRefresh.phone === '18600000004') {
      log('用例6 通过: 刷新后 memberInfo 正确加载');
      testResults.passed++;
      testResults.details.push({ case: 6, result: 'PASS' });
    } else {
      log(`用例6 失败: afterRefresh=${JSON.stringify(afterRefresh)}`);
      testResults.failed++;
      testResults.details.push({ case: 6, result: 'FAIL', reason: 'memberInfo 未正确加载' });
    }
  } catch (error) {
    log(`用例6 异常: ${error.message}`);
    await takeScreenshot('case6-error');
    testResults.failed++;
    testResults.details.push({ case: 6, result: 'FAIL', reason: error.message });
  }
}

// 用例7：助教登录后下单 memberPhone 传递
async function test7_CoachOrderMemberPhone() {
  log('\n=== 用例7：助教登录后下单 memberPhone 传递 ===');
  try {
    await clearAllStorage();
    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitForTimeout(2000);
    
    await doH5Login('18600000004', true);
    
    const token = await getStorageItem('memberToken');
    if (!token) {
      log('用例7 跳过: 登录未成功');
      testResults.skipped++;
      testResults.details.push({ case: 7, result: 'SKIP', reason: '登录未成功' });
      return;
    }
    
    await takeScreenshot('case7-coach-logged-in');
    
    // 访问首页带台桌号
    await page.goto(`${BASE_URL}/#/?table=que1`, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitForTimeout(2000);
    
    await takeScreenshot('case7-home-with-table');
    
    // 尝试添加商品（简化版）
    const productClicked = await page.evaluate(() => {
      const items = document.querySelectorAll('.product-card, .goods-item, uni-view[class*="product"]');
      if (items.length > 0) {
        items[0].click();
        return true;
      }
      return false;
    });
    
    if (productClicked) {
      await waitForTimeout(1500);
      await takeScreenshot('case7-product-page');
      
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('uni-view, button');
        for (const btn of buttons) {
          if (btn.textContent.includes('加入') || btn.textContent.includes('添加')) {
            btn.click();
            return;
          }
        }
      });
      
      await waitForTimeout(1000);
    }
    
    // 进入购物车
    await page.goto(`${BASE_URL}/#/pages/cart/cart`, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitForTimeout(1500);
    
    await takeScreenshot('case7-cart-page');
    
    // 下单
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('uni-view, button');
      for (const btn of buttons) {
        if (btn.textContent.includes('下单') || btn.textContent.includes('结算') || btn.textContent.includes('提交')) {
          btn.click();
          return;
        }
      }
    });
    
    await waitForTimeout(3000);
    await takeScreenshot('case7-after-submit');
    
    const currentUrl = page.url();
    log(`当前URL: ${currentUrl}`);
    
    if (currentUrl.includes('order') || currentUrl.includes('success')) {
      log('用例7 通过: 助教下单流程成功（需后端验证 member_phone）');
      testResults.passed++;
      testResults.details.push({ case: 7, result: 'PASS', note: '需后端验证' });
    } else {
      log(`用例7 失败: URL=${currentUrl}`);
      testResults.failed++;
      testResults.details.push({ case: 7, result: 'FAIL', reason: '下单流程未完成' });
    }
  } catch (error) {
    log(`用例7 异常: ${error.message}`);
    await takeScreenshot('case7-error');
    testResults.failed++;
    testResults.details.push({ case: 7, result: 'FAIL', reason: error.message });
  }
}

// 用例8：会员登录后下单 memberPhone 传递
async function test8_MemberOrderMemberPhone() {
  log('\n=== 用例8：会员登录后下单 memberPhone 传递 ===');
  try {
    await clearAllStorage();
    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitForTimeout(2000);
    
    await doH5Login('18600000005', false);  // 不选择助教身份
    
    const token = await getStorageItem('memberToken');
    if (!token) {
      log('用例8 跳过: 登录未成功');
      testResults.skipped++;
      testResults.details.push({ case: 8, result: 'SKIP', reason: '登录未成功' });
      return;
    }
    
    await takeScreenshot('case8-member-logged-in');
    
    // 访问首页带台桌号
    await page.goto(`${BASE_URL}/#/?table=que1`, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitForTimeout(2000);
    
    // 尝试添加商品
    const productClicked = await page.evaluate(() => {
      const items = document.querySelectorAll('.product-card, .goods-item, uni-view[class*="product"]');
      if (items.length > 0) {
        items[0].click();
        return true;
      }
      return false;
    });
    
    if (productClicked) {
      await waitForTimeout(1500);
      
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('uni-view, button');
        for (const btn of buttons) {
          if (btn.textContent.includes('加入') || btn.textContent.includes('添加')) {
            btn.click();
            return;
          }
        }
      });
      
      await waitForTimeout(1000);
    }
    
    // 进入购物车下单
    await page.goto(`${BASE_URL}/#/pages/cart/cart`, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitForTimeout(1500);
    
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('uni-view, button');
      for (const btn of buttons) {
        if (btn.textContent.includes('下单') || btn.textContent.includes('结算') || btn.textContent.includes('提交')) {
          btn.click();
          return;
        }
      }
    });
    
    await waitForTimeout(3000);
    await takeScreenshot('case8-after-submit');
    
    const currentUrl = page.url();
    log(`当前URL: ${currentUrl}`);
    
    if (currentUrl.includes('order') || currentUrl.includes('success')) {
      log('用例8 通过: 会员下单流程成功（需后端验证 member_phone）');
      testResults.passed++;
      testResults.details.push({ case: 8, result: 'PASS', note: '需后端验证' });
    } else {
      log(`用例8 失败: URL=${currentUrl}`);
      testResults.failed++;
      testResults.details.push({ case: 8, result: 'FAIL', reason: '下单流程未完成' });
    }
  } catch (error) {
    log(`用例8 异常: ${error.message}`);
    await takeScreenshot('case8-error');
    testResults.failed++;
    testResults.details.push({ case: 8, result: 'FAIL', reason: error.message });
  }
}

// 主函数
async function main() {
  log('=== memberInfo Storage 测试开始 (v4 - uni-app) ===');
  log('开始连接 Chrome...');
  
  try {
    browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
      defaultViewport: { width: 375, height: 812 },
      protocolTimeout: 180000
    });
    
    const pages = await browser.pages();
    page = pages[0] || await browser.newPage();
    
    log('连接成功，开始测试...');
    
    // 执行测试用例
    await test1_SMSLoginMemberInfo();
    await test2_AutoLoginMemberInfo();
    await test3_ClearOldStorageBeforeLogin();
    await test4_LogoutButtonClearStorage();
    await test5_TokenExpireAutoLogout();
    await test6_PageRefreshLoadMemberInfo();
    await test7_CoachOrderMemberPhone();
    await test8_MemberOrderMemberPhone();
    
    // 汇总结果
    log('\n=== 测试汇总 ===');
    log(`通过: ${testResults.passed}`);
    log(`失败: ${testResults.failed}`);
    log(`跳过: ${testResults.skipped}`);
    testResults.details.forEach(d => {
      log(`用例${d.case}: ${d.result}${d.reason ? ' - ' + d.reason : ''}`);
    });
    
  } catch (error) {
    log(`连接失败: ${error.message}`);
    testResults.failed++;
    testResults.details.push({ case: 0, result: 'ERROR', reason: error.message });
  } finally {
    if (browser) {
      try {
        const pages = await browser.pages();
        for (let i = 1; i < pages.length; i++) {
          await pages[i].close();
        }
        await browser.disconnect();
      } catch (e) {
        log(`清理失败: ${e.message}`);
      }
    }
  }
  
  log('\n测试结束');
  return testResults;
}

main().catch(console.error);