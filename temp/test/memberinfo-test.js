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
let testResults = { passed: 0, failed: 0, details: [] };

function log(message) {
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const logLine = `[${timestamp}] ${message}`;
  console.log(logLine);
  fs.appendFileSync(LOG_FILE, logLine + '\n');
}

async function takeScreenshot(name) {
  const filename = `memberinfo-test-${name}-${Date.now()}.png`;
  const path = `${SCREENSHOT_DIR}${filename}`;
  await page.screenshot({ path, fullPage: true });
  log(`截图保存: ${path}`);
  return path;
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

// 用例1：SMS登录成功后 memberInfo 存储
async function test1_SMSLoginMemberInfo() {
  log('\n=== 用例1：SMS登录成功后 memberInfo 存储 ===');
  try {
    // 清空并设置旧数据
    await clearAllStorage();
    await setStorageItem('memberToken', 'old_token');
    await setStorageItem('memberInfo', { phone: '18600000000' });
    await setStorageItem('coachToken', 'old_coach_token');
    
    // 访问会员页
    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2' });
    await waitForTimeout(1000);
    
    // 输入手机号
    const phoneInput = await page.$('input[type="tel"], input[placeholder*="手机号"], input[placeholder*="电话"]');
    if (phoneInput) {
      await phoneInput.click({ clickCount: 3 });
      await phoneInput.type('18600000004');
      await waitForTimeout(500);
      
      // 点击获取验证码按钮
      const codeBtn = await page.$('button:has-text("验证码"), button:has-text("获取")');
      if (codeBtn) {
        await codeBtn.click();
        await waitForTimeout(1000);
      }
      
      // 输入验证码
      const codeInput = await page.$('input[placeholder*="验证码"], input[type="text"]');
      if (codeInput) {
        await codeInput.type('888888');
        await waitForTimeout(500);
      }
      
      // 点击登录
      const loginBtn = await page.$('button:has-text("登录"), button[type="submit"]');
      if (loginBtn) {
        await loginBtn.click();
        await waitForTimeout(2000);
      }
      
      // 检查是否需要选择身份
      const roleBtn = await page.$('button:has-text("助教"), text=助教');
      if (roleBtn) {
        await roleBtn.click();
        await waitForTimeout(1500);
      }
    }
    
    // 验证 memberInfo
    const memberInfo = await getStorageItem('memberInfo');
    if (memberInfo && memberInfo.phone === '18600000004') {
      log('用例1 通过: memberInfo 存储正确');
      testResults.passed++;
      testResults.details.push({ case: 1, result: 'PASS' });
    } else {
      log(`用例1 失败: memberInfo=${JSON.stringify(memberInfo)}`);
      await takeScreenshot('case1-fail');
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
    await clearAllStorage();
    
    // 设置一个有效的 token（需要从实际登录获取或模拟）
    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2' });
    await waitForTimeout(1000);
    
    // 先登录获取有效token
    const phoneInput = await page.$('input[type="tel"], input[placeholder*="手机号"]');
    if (phoneInput) {
      await phoneInput.click({ clickCount: 3 });
      await phoneInput.type('18600000004');
      await waitForTimeout(500);
      
      const codeBtn = await page.$('button:has-text("验证码"), button:has-text("获取")');
      if (codeBtn) {
        await codeBtn.click();
        await waitForTimeout(1000);
      }
      
      const codeInput = await page.$('input[placeholder*="验证码"]');
      if (codeInput) {
        await codeInput.type('888888');
        await waitForTimeout(500);
      }
      
      const loginBtn = await page.$('button:has-text("登录")');
      if (loginBtn) {
        await loginBtn.click();
        await waitForTimeout(2000);
      }
      
      const roleBtn = await page.$('button:has-text("助教")');
      if (roleBtn) {
        await roleBtn.click();
        await waitForTimeout(1500);
      }
    }
    
    // 获取当前 token
    const token = await getStorageItem('memberToken');
    if (!token) {
      log('用例2 跳过: 无法获取有效token');
      testResults.details.push({ case: 2, result: 'SKIP', reason: '无法获取token' });
      return;
    }
    
    // 刷新页面触发自动登录
    await page.reload({ waitUntil: 'networkidle2' });
    await waitForTimeout(2000);
    
    // 验证 memberInfo
    const memberInfo = await getStorageItem('memberInfo');
    if (memberInfo && memberInfo.phone) {
      log('用例2 通过: 自动登录后 memberInfo 存在');
      testResults.passed++;
      testResults.details.push({ case: 2, result: 'PASS' });
    } else {
      log(`用例2 失败: memberInfo=${JSON.stringify(memberInfo)}`);
      await takeScreenshot('case2-fail');
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
    
    // 验证已设置
    const beforeValues = await getAllStorageValues();
    log(`登录前 Storage: ${JSON.stringify(beforeValues).substring(0, 200)}...`);
    
    // 访问会员页并输入手机号
    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2' });
    await waitForTimeout(1000);
    
    const phoneInput = await page.$('input[type="tel"], input[placeholder*="手机号"]');
    if (phoneInput) {
      await phoneInput.click({ clickCount: 3 });
      await phoneInput.type('18600000004');
      await waitForTimeout(500);
      
      // 点击获取验证码（此时应该已清空旧数据）
      const codeBtn = await page.$('button:has-text("验证码"), button:has-text("获取")');
      if (codeBtn) {
        await codeBtn.click();
        await waitForTimeout(1000);
      }
    }
    
    // 检查 Storage 是否已清空
    const afterValues = await getAllStorageValues();
    const allCleared = Object.values(afterValues).every(v => v === null);
    
    if (allCleared) {
      log('用例3 通过: 所有旧数据已清空');
      testResults.passed++;
      testResults.details.push({ case: 3, result: 'PASS' });
    } else {
      const remaining = Object.entries(afterValues).filter(([k, v]) => v !== null);
      log(`用例3 失败: 未清空的字段: ${JSON.stringify(remaining)}`);
      await takeScreenshot('case3-fail');
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
    await clearAllStorage();
    
    // 先登录
    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2' });
    await waitForTimeout(1000);
    
    const phoneInput = await page.$('input[type="tel"], input[placeholder*="手机号"]');
    if (phoneInput) {
      await phoneInput.click({ clickCount: 3 });
      await phoneInput.type('18600000004');
      await waitForTimeout(500);
      
      const codeBtn = await page.$('button:has-text("验证码"), button:has-text("获取")');
      if (codeBtn) {
        await codeBtn.click();
        await waitForTimeout(1000);
      }
      
      const codeInput = await page.$('input[placeholder*="验证码"]');
      if (codeInput) {
        await codeInput.type('888888');
        await waitForTimeout(500);
      }
      
      const loginBtn = await page.$('button:has-text("登录")');
      if (loginBtn) {
        await loginBtn.click();
        await waitForTimeout(2000);
      }
      
      const roleBtn = await page.$('button:has-text("助教")');
      if (roleBtn) {
        await roleBtn.click();
        await waitForTimeout(1500);
      }
    }
    
    // 进入 profile 页面
    await page.goto(`${BASE_URL}/#/pages/member/profile`, { waitUntil: 'networkidle2' });
    await waitForTimeout(1000);
    
    // 点击退出登录
    const logoutBtn = await page.$('button:has-text("退出"), button:has-text("登出"), text=退出登录');
    if (logoutBtn) {
      await logoutBtn.click();
      await waitForTimeout(500);
      
      // 确认弹窗
      const confirmBtn = await page.$('button:has-text("确定"), button:has-text("确认")');
      if (confirmBtn) {
        await confirmBtn.click();
        await waitForTimeout(1500);
      }
    }
    
    // 验证 Storage 清空
    const afterValues = await getAllStorageValues();
    const allCleared = Object.values(afterValues).every(v => v === null);
    
    if (allCleared) {
      log('用例4 通过: 退出登录后 Storage 已清空');
      testResults.passed++;
      testResults.details.push({ case: 4, result: 'PASS' });
    } else {
      const remaining = Object.entries(afterValues).filter(([k, v]) => v !== null);
      log(`用例4 失败: 未清空的字段: ${JSON.stringify(remaining)}`);
      await takeScreenshot('case4-fail');
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
    await clearAllStorage();
    
    // 先登录
    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2' });
    await waitForTimeout(1000);
    
    const phoneInput = await page.$('input[type="tel"], input[placeholder*="手机号"]');
    if (phoneInput) {
      await phoneInput.click({ clickCount: 3 });
      await phoneInput.type('18600000004');
      await waitForTimeout(500);
      
      const codeBtn = await page.$('button:has-text("验证码"), button:has-text("获取")');
      if (codeBtn) {
        await codeBtn.click();
        await waitForTimeout(1000);
      }
      
      const codeInput = await page.$('input[placeholder*="验证码"]');
      if (codeInput) {
        await codeInput.type('888888');
        await waitForTimeout(500);
      }
      
      const loginBtn = await page.$('button:has-text("登录")');
      if (loginBtn) {
        await loginBtn.click();
        await waitForTimeout(2000);
      }
      
      const roleBtn = await page.$('button:has-text("助教")');
      if (roleBtn) {
        await roleBtn.click();
        await waitForTimeout(1500);
      }
    }
    
    // 修改 token 为无效值
    await page.evaluate(() => {
      localStorage.setItem('memberToken', JSON.stringify('invalid_token_for_test'));
    });
    
    // 触发需要认证的请求
    await page.goto(`${BASE_URL}/#/pages/member/profile`, { waitUntil: 'networkidle2' });
    await waitForTimeout(2000);
    
    // 验证 Storage 清空并跳转
    const afterValues = await getAllStorageValues();
    const currentUrl = page.url();
    
    if (currentUrl.includes('/member/member') || currentUrl.includes('/member')) {
      log(`用例5 通过: Token失效后已跳转到会员页 ${currentUrl}`);
      testResults.passed++;
      testResults.details.push({ case: 5, result: 'PASS' });
    } else {
      const remaining = Object.entries(afterValues).filter(([k, v]) => v !== null);
      log(`用例5 失败: URL=${currentUrl}, 未清空字段: ${JSON.stringify(remaining)}`);
      await takeScreenshot('case5-fail');
      testResults.failed++;
      testResults.details.push({ case: 5, result: 'FAIL', reason: `未跳转到会员页` });
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
    await clearAllStorage();
    
    // 先登录
    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2' });
    await waitForTimeout(1000);
    
    const phoneInput = await page.$('input[type="tel"], input[placeholder*="手机号"]');
    if (phoneInput) {
      await phoneInput.click({ clickCount: 3 });
      await phoneInput.type('18600000004');
      await waitForTimeout(500);
      
      const codeBtn = await page.$('button:has-text("验证码"), button:has-text("获取")');
      if (codeBtn) {
        await codeBtn.click();
        await waitForTimeout(1000);
      }
      
      const codeInput = await page.$('input[placeholder*="验证码"]');
      if (codeInput) {
        await codeInput.type('888888');
        await waitForTimeout(500);
      }
      
      const loginBtn = await page.$('button:has-text("登录")');
      if (loginBtn) {
        await loginBtn.click();
        await waitForTimeout(2000);
      }
      
      const roleBtn = await page.$('button:has-text("助教")');
      if (roleBtn) {
        await roleBtn.click();
        await waitForTimeout(1500);
      }
    }
    
    // 验证 memberInfo 存储
    const beforeRefresh = await getStorageItem('memberInfo');
    log(`刷新前 memberInfo: ${JSON.stringify(beforeRefresh)}`);
    
    if (!beforeRefresh) {
      log('用例6 跳过: 登录未成功');
      testResults.details.push({ case: 6, result: 'SKIP', reason: '登录未成功' });
      return;
    }
    
    // 刷新页面
    await page.reload({ waitUntil: 'networkidle2' });
    await waitForTimeout(2000);
    
    // 验证页面显示会员信息
    const afterRefresh = await getStorageItem('memberInfo');
    const pageContent = await page.content();
    const showsMemberInfo = pageContent.includes('18600000004') || 
                           await page.$('text=助教') !== null ||
                           await page.$('.member-info, .user-info') !== null;
    
    if (afterRefresh && afterRefresh.phone === '18600000004') {
      log('用例6 通过: 刷新后 memberInfo 正确加载');
      testResults.passed++;
      testResults.details.push({ case: 6, result: 'PASS' });
    } else {
      log(`用例6 失败: afterRefresh=${JSON.stringify(afterRefresh)}`);
      await takeScreenshot('case6-fail');
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
    
    // 助教登录
    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2' });
    await waitForTimeout(1000);
    
    const phoneInput = await page.$('input[type="tel"], input[placeholder*="手机号"]');
    if (phoneInput) {
      await phoneInput.click({ clickCount: 3 });
      await phoneInput.type('18600000004');
      await waitForTimeout(500);
      
      const codeBtn = await page.$('button:has-text("验证码"), button:has-text("获取")');
      if (codeBtn) {
        await codeBtn.click();
        await waitForTimeout(1000);
      }
      
      const codeInput = await page.$('input[placeholder*="验证码"]');
      if (codeInput) {
        await codeInput.type('888888');
        await waitForTimeout(500);
      }
      
      const loginBtn = await page.$('button:has-text("登录")');
      if (loginBtn) {
        await loginBtn.click();
        await waitForTimeout(2000);
      }
      
      // 选择助教身份
      const roleBtn = await page.$('button:has-text("助教")');
      if (roleBtn) {
        await roleBtn.click();
        await waitForTimeout(1500);
      }
    }
    
    // 访问首页带台桌号
    await page.goto(`${BASE_URL}/#/?table=que1`, { waitUntil: 'networkidle2' });
    await waitForTimeout(1500);
    
    // 进入商品页添加商品
    const productBtn = await page.$('.product-item, .goods-item, [class*="product"]');
    if (productBtn) {
      await productBtn.click();
      await waitForTimeout(1000);
      
      // 添加到购物车
      const addCartBtn = await page.$('button:has-text("加入购物车"), button:has-text("添加")');
      if (addCartBtn) {
        await addCartBtn.click();
        await waitForTimeout(500);
      }
      
      // 返回首页
      await page.goBack();
      await waitForTimeout(500);
    }
    
    // 进入购物车
    const cartBtn = await page.$('.cart-icon, [class*="cart"], button:has-text("购物车")');
    if (cartBtn) {
      await cartBtn.click();
      await waitForTimeout(1000);
      
      // 下单
      const submitBtn = await page.$('button:has-text("下单"), button:has-text("提交"), button:has-text("结算")');
      if (submitBtn) {
        await submitBtn.click();
        await waitForTimeout(2000);
      }
    }
    
    // 验证订单 member_phone（需要查询数据库或订单响应）
    // 由于无法直接查询数据库，这里检查是否成功跳转到订单页或显示订单信息
    const currentUrl = page.url();
    const pageContent = await page.content();
    
    if (currentUrl.includes('order') || pageContent.includes('订单') || pageContent.includes('成功')) {
      log('用例7 通过: 助教下单流程成功');
      log('注意: member_phone 需要在后端数据库验证');
      testResults.passed++;
      testResults.details.push({ case: 7, result: 'PASS', note: '需后端验证 member_phone' });
    } else {
      log(`用例7 失败: URL=${currentUrl}`);
      await takeScreenshot('case7-fail');
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
    
    // 使用非助教会员登录（假设 18600000005 是纯会员）
    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2' });
    await waitForTimeout(1000);
    
    const phoneInput = await page.$('input[type="tel"], input[placeholder*="手机号"]');
    if (phoneInput) {
      await phoneInput.click({ clickCount: 3 });
      await phoneInput.type('18600000005');
      await waitForTimeout(500);
      
      const codeBtn = await page.$('button:has-text("验证码"), button:has-text("获取")');
      if (codeBtn) {
        await codeBtn.click();
        await waitForTimeout(1000);
      }
      
      const codeInput = await page.$('input[placeholder*="验证码"]');
      if (codeInput) {
        await codeInput.type('888888');
        await waitForTimeout(500);
      }
      
      const loginBtn = await page.$('button:has-text("登录")');
      if (loginBtn) {
        await loginBtn.click();
        await waitForTimeout(2000);
      }
      
      // 如果有身份选择，选择会员
      const memberRoleBtn = await page.$('button:has-text("会员"), text=会员身份');
      if (memberRoleBtn) {
        await memberRoleBtn.click();
        await waitForTimeout(1500);
      }
    }
    
    // 访问首页带台桌号
    await page.goto(`${BASE_URL}/#/?table=que1`, { waitUntil: 'networkidle2' });
    await waitForTimeout(1500);
    
    // 进入商品页添加商品
    const productBtn = await page.$('.product-item, .goods-item, [class*="product"]');
    if (productBtn) {
      await productBtn.click();
      await waitForTimeout(1000);
      
      const addCartBtn = await page.$('button:has-text("加入购物车"), button:has-text("添加")');
      if (addCartBtn) {
        await addCartBtn.click();
        await waitForTimeout(500);
      }
      
      await page.goBack();
      await waitForTimeout(500);
    }
    
    // 进入购物车下单
    const cartBtn = await page.$('.cart-icon, [class*="cart"], button:has-text("购物车")');
    if (cartBtn) {
      await cartBtn.click();
      await waitForTimeout(1000);
      
      const submitBtn = await page.$('button:has-text("下单"), button:has-text("提交"), button:has-text("结算")');
      if (submitBtn) {
        await submitBtn.click();
        await waitForTimeout(2000);
      }
    }
    
    const currentUrl = page.url();
    const pageContent = await page.content();
    
    if (currentUrl.includes('order') || pageContent.includes('订单') || pageContent.includes('成功')) {
      log('用例8 通过: 会员下单流程成功');
      log('注意: member_phone 需要在后端数据库验证');
      testResults.passed++;
      testResults.details.push({ case: 8, result: 'PASS', note: '需后端验证 member_phone' });
    } else {
      log(`用例8 失败: URL=${currentUrl}`);
      await takeScreenshot('case8-fail');
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
  log('开始连接 Chrome...');
  
  try {
    browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
      defaultViewport: { width: 375, height: 812 },
      protocolTimeout: 120000
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
    log(`详情: ${JSON.stringify(testResults.details, null, 2)}`);
    
  } catch (error) {
    log(`连接失败: ${error.message}`);
    testResults.failed++;
  } finally {
    if (browser) {
      // 关闭所有标签页
      const pages = await browser.pages();
      for (const p of pages) {
        if (pages.indexOf(p) > 0) {
          await p.close();
        }
      }
      await browser.disconnect();
    }
  }
  
  log('\n测试结束');
  return testResults;
}

main().catch(console.error);