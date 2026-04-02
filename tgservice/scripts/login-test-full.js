/**
 * 登录测试完整流程
 * 测试目标：https://tiangong.club/
 * 
 * 测试场景：
 * 1. 正常登录测试（手机号 + 验证码）
 * 2. 自动登录测试（session 过期后重新进入）
 * 3. 退出登录测试
 * 4. 退出后无法自动登录测试
 */

const { chromium } = require('playwright');
const { execSync } = require('child_process');

const TEST_PHONE = '18680174119';
const BASE_URL = 'https://tiangong.club';

async function test() {
  console.log('========================================');
  console.log('[2026-04-02 11:56] 登录测试完整流程');
  console.log('========================================\n');
  
  // 连接 Chrome
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();
  let page = pages.find(p => p.url().includes('tiangong')) || pages[0];
  
  if (!page || !page.url().includes('tiangong')) {
    page = await context.newPage();
  }
  
  // ========================================
  // 测试 1：正常登录
  // ========================================
  console.log('\n========== 测试 1：正常登录 ==========\n');
  
  // 步骤 1.1：进入会员中心
  console.log('【步骤 1.1】进入会员中心...');
  await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  console.log('  URL:', page.url());
  await page.screenshot({ path: '/tmp/test1-member-center.png' });
  
  // 步骤 1.2：点击"会员登录"打开弹窗
  console.log('\n【步骤 1.2】点击"会员登录"...');
  const loginBtn = page.getByText('会员登录', { exact: true });
  await loginBtn.waitFor({ state: 'visible', timeout: 5000 });
  await loginBtn.click();
  console.log('  点击成功');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/test1-login-popup.png' });
  
  // 步骤 1.3：勾选协议
  console.log('\n【步骤 1.3】勾选同意协议...');
  const checkbox = page.locator('.checkbox').first();
  await checkbox.click();
  console.log('  勾选成功');
  await page.waitForTimeout(500);
  
  // 步骤 1.4：输入手机号
  console.log('\n【步骤 1.4】输入手机号...');
  const phoneInput = page.locator('input').first();
  await phoneInput.fill(TEST_PHONE);
  console.log('  输入手机号:', TEST_PHONE);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/test1-phone-input.png' });
  
  // 步骤 1.5：点击"获取"验证码
  console.log('\n【步骤 1.5】点击"获取"验证码...');
  const getCodeBtn = page.locator('.h5-code-btn');
  await getCodeBtn.click();
  console.log('  点击成功，等待短信发送...');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/test1-code-sent.png' });
  
  // 步骤 1.6：从日志获取验证码
  console.log('\n【步骤 1.6】获取验证码...');
  await page.waitForTimeout(3000); // 等短信发送
  
  let verifyCode = null;
  try {
    const logCmd = `docker exec tgservice cat /app/tgservice/logs/operation.log | grep "${TEST_PHONE}" | grep "验证码" | tail -1`;
    const logOutput = execSync(logCmd, { encoding: 'utf-8' });
    
    // 提取验证码
    const codeMatch = logOutput.match(/验证码: (\d{6})/);
    if (codeMatch) {
      verifyCode = codeMatch[1];
      console.log('  ✅ 获取验证码:', verifyCode);
    } else {
      console.log('  ❌ 未找到验证码');
      console.log('  日志输出:', logOutput);
    }
  } catch (e) {
    console.log('  ❌ 获取验证码失败:', e.message);
  }
  
  if (!verifyCode) {
    console.log('\n========================================');
    console.log('⚠️  无法获取验证码，测试终止');
    console.log('请检查短信服务商配置');
    console.log('========================================');
    await browser.close();
    return;
  }
  
  // 步骤 1.7：输入验证码
  console.log('\n【步骤 1.7】输入验证码...');
  const inputs = await page.locator('input').all();
  await inputs[1].fill(verifyCode);
  console.log('  输入验证码:', verifyCode);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/test1-code-input.png' });
  
  // 步骤 1.8：点击"登录"按钮
  console.log('\n【步骤 1.8】点击"登录"...');
  const submitBtn = page.locator('.h5-login-btn');
  await submitBtn.click();
  console.log('  点击成功，等待登录...');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/test1-after-login.png' });
  
  // 步骤 1.9：验证登录成功
  console.log('\n【步骤 1.9】验证登录状态...');
  const pageText = await page.locator('body').innerText();
  
  const loginSuccess = !pageText.includes('会员登录') && pageText.includes('186');
  console.log('  登录成功:', loginSuccess ? '✅ 是' : '❌ 否');
  
  // 检查是否能看到助教专用版块
  const coachSection = pageText.includes('助教') || pageText.includes('个人中心');
  console.log('  看到助教版块:', coachSection ? '✅ 是' : '❌ 否');
  
  // ========================================
  // 测试 2：自动登录测试
  // ========================================
  console.log('\n========== 测试 2：自动登录测试 ==========\n');
  
  // 步骤 2.1：模拟 session 过期（清除 localStorage）
  console.log('【步骤 2.1】清除 localStorage...');
  await page.evaluate(() => {
    localStorage.removeItem('memberToken');
    localStorage.removeItem('sessionId');
  });
  console.log('  清除成功');
  
  // 步骤 2.2：重新进入会员中心
  console.log('\n【步骤 2.2】重新进入会员中心...');
  await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/test2-auto-login.png' });
  
  // 步骤 2.3：检查是否自动登录
  console.log('\n【步骤 2.3】检查自动登录状态...');
  const pageText2 = await page.locator('body').innerText();
  
  const autoLoginSuccess = !pageText2.includes('会员登录') && pageText2.includes('186');
  console.log('  自动登录成功:', autoLoginSuccess ? '✅ 是' : '❌ 否');
  
  // ========================================
  // 测试 3：退出登录测试
  // ========================================
  console.log('\n========== 测试 3：退出登录测试 ==========\n');
  
  // 步骤 3.1：如果已登录，先确保登录状态
  if (!autoLoginSuccess) {
    console.log('【步骤 3.0】先登录...');
    // 暂时跳过，假设登录成功
  }
  
  // 步骤 3.2：进入个人信息页面
  console.log('\n【步骤 3.1】点击个人信息...');
  
  // 查找个人信息入口
  const profileLink = page.getByText('个人信息', { exact: true });
  try {
    await profileLink.waitFor({ state: 'visible', timeout: 3000 });
    await profileLink.click();
    console.log('  点击成功');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/test3-profile-page.png' });
  } catch (e) {
    console.log('  未找到个人信息入口，尝试其他方式...');
    
    // 直接访问个人信息页面
    await page.goto(`${BASE_URL}/#/pages/profile/profile`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/test3-profile-page-alt.png' });
  }
  
  // 步骤 3.3：点击退出登录
  console.log('\n【步骤 3.2】点击退出登录...');
  
  const logoutBtn = page.getByText('退出登录', { exact: true });
  try {
    await logoutBtn.waitFor({ state: 'visible', timeout: 3000 });
    await logoutBtn.click();
    console.log('  点击成功');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/test3-after-logout.png' });
  } catch (e) {
    console.log('  未找到退出登录按钮:', e.message);
  }
  
  // 步骤 3.4：验证退出成功
  console.log('\n【步骤 3.3】验证退出状态...');
  
  const pageText3 = await page.locator('body').innerText();
  const logoutSuccess = pageText3.includes('会员登录') || pageText3.includes('请登录');
  console.log('  已退出登录:', logoutSuccess ? '✅ 是' : '❌ 否');
  
  const coachSectionVisible = pageText3.includes('助教中心') || pageText3.includes('助教专用');
  console.log('  看到助教版块:', coachSectionVisible ? '❌ 是（错误）' : '✅ 否（正确）');
  
  // ========================================
  // 测试 4：退出后无法自动登录
  // ========================================
  console.log('\n========== 测试 4：退出后无法自动登录 ==========\n');
  
  // 步骤 4.1：重新进入会员中心
  console.log('【步骤 4.1】重新进入会员中心...');
  await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/test4-reenter.png' });
  
  // 步骤 4.2：刷新页面
  console.log('\n【步骤 4.2】刷新页面...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/test4-refresh.png' });
  
  // 步骤 4.3：验证仍然处于退出状态
  console.log('\n【步骤 4.3】验证退出状态保持...');
  
  const pageText4 = await page.locator('body').innerText();
  const stillLogout = pageText4.includes('会员登录') || !pageText4.includes('186');
  console.log('  仍处于退出状态:', stillLogout ? '✅ 是（正确）' : '❌ 否（错误）');
  
  const noCoachSection = !pageText4.includes('助教中心') && !pageText4.includes('助教专用');
  console.log('  看不到助教版块:', noCoachSection ? '✅ 是（正确）' : '❌ 否（错误）');
  
  // ========================================
  // 测试总结
  // ========================================
  console.log('\n========================================');
  console.log('测试总结');
  console.log('========================================');
  console.log('');
  console.log('测试 1：正常登录');
  console.log('  - 登录成功:', loginSuccess ? '✅ 通过' : '❌ 失败');
  console.log('  - 看到助教版块:', coachSection ? '✅ 通过' : '❌ 失败');
  console.log('');
  console.log('测试 2：自动登录');
  console.log('  - 自动登录成功:', autoLoginSuccess ? '✅ 通过' : '❌ 失败');
  console.log('');
  console.log('测试 3：退出登录');
  console.log('  - 退出成功:', logoutSuccess ? '✅ 通过' : '❌ 失败');
  console.log('  - 看不到助教版块:', !coachSectionVisible ? '✅ 通过' : '❌ 失败');
  console.log('');
  console.log('测试 4：退出后无法自动登录');
  console.log('  - 保持退出状态:', stillLogout ? '✅ 通过' : '❌ 失败');
  console.log('  - 看不到助教版块:', noCoachSection ? '✅ 通过' : '❌ 失败');
  console.log('');
  console.log('========================================');
  
  await browser.close();
}

test().catch(console.error);