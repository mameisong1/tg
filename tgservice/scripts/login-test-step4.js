/**
 * 登录测试脚本 - 完整流程
 */

const { chromium } = require('playwright');

async function test() {
  console.log('========================================');
  console.log('[2026-04-02 11:41] 登录测试完整流程');
  console.log('========================================\n');
  
  // 连接 Chrome
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();
  let page = pages.find(p => p.url().includes('tiangong')) || pages[0];
  
  console.log('当前URL:', page.url());
  
  // ========================================
  // 步骤 1：回到会员中心首页
  // ========================================
  console.log('\n【步骤1】回到会员中心...');
  
  await page.goto('https://tiangong.club/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  
  console.log('  URL:', page.url());
  await page.screenshot({ path: '/tmp/test-member-page.png' });
  
  // ========================================
  // 步骤 2：点击"会员登录"打开弹窗
  // ========================================
  console.log('\n【步骤2】点击"会员登录"...');
  
  // 找登录入口
  const loginText = page.getByText('会员登录', { exact: true });
  try {
    await loginText.waitFor({ state: 'visible', timeout: 5000 });
    await loginText.click();
    console.log('  点击"会员登录"成功');
    await page.waitForTimeout(2000);
  } catch (e) {
    // 尝试其他方式
    const loginBtn = page.locator('.h5-login-btn');
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
      console.log('  通过 class 点击成功');
    } else {
      console.log('  点击失败:', e.message);
    }
  }
  
  await page.screenshot({ path: '/tmp/test-login-popup.png' });
  
  // ========================================
  // 步骤 3：勾选协议
  // ========================================
  console.log('\n【步骤3】勾选协议...');
  
  // 找 checkbox - 查看页面结构
  const bodyHtml = await page.content();
  const checkboxMatch = bodyHtml.match(/class="[^"]*checkbox[^"]*"/);
  console.log('  checkbox class 匹配:', checkboxMatch);
  
  // 找到协议区域
  const agreeArea = page.getByText('同意').first();
  
  // 找协议区域前面的 checkbox icon
  // 通过 DOM 结构分析，checkbox 应在"同意"左边
  const checkboxIcon = page.locator('[class*="icon"], [class*="checkbox"]').first();
  
  try {
    // 尝试点击 checkbox icon
    const allIcons = await page.locator('[class*="icon"]').all();
    console.log('  icon 元素数量:', allIcons.length);
    
    for (const icon of allIcons) {
      const className = await icon.getAttribute('class');
      // 找到 unchecked 状态的 checkbox
      if (className && className.includes('checkbox')) {
        console.log('  找到 checkbox:', className);
        await icon.click();
        console.log('  勾选成功');
        break;
      }
    }
  } catch (e) {
    console.log('  勾选失败:', e.message);
  }
  
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/test-agree-checked.png' });
  
  // ========================================
  // 步骤 4：输入手机号
  // ========================================
  console.log('\n【步骤4】输入手机号...');
  
  const inputs = await page.locator('input').all();
  console.log('  输入框数量:', inputs.length);
  
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const type = await input.getAttribute('type');
    const isVisible = await input.isVisible();
    console.log(`  输入框${i}: type=${type}, visible=${isVisible}`);
  }
  
  // 输入手机号到第一个可见的输入框
  if (inputs.length >= 1) {
    try {
      await inputs[0].fill('18680174119');
      console.log('  输入手机号: 18680174119');
    } catch (e) {
      console.log('  输入失败:', e.message);
    }
  }
  
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/test-phone-input-done.png' });
  
  // ========================================
  // 步骤 5：点击"获取"验证码
  // ========================================
  console.log('\n【步骤5】点击"获取"验证码...');
  
  const getCodeBtn = page.locator('.h5-code-btn');
  try {
    await getCodeBtn.waitFor({ state: 'visible', timeout: 5000 });
    await getCodeBtn.click();
    console.log('  点击"获取"成功！');
    await page.waitForTimeout(3000);
  } catch (e) {
    // 文本匹配
    const btn = page.getByText('获取', { exact: true });
    try {
      await btn.click();
      console.log('  通过文本点击成功');
    } catch (e2) {
      console.log('  点击失败:', e2.message);
    }
  }
  
  await page.screenshot({ path: '/tmp/test-code-sending.png' });
  
  // ========================================
  // 步骤 6：去 Docker 日志找验证码
  // ========================================
  console.log('\n【步骤6】查找验证码...');
  await page.waitForTimeout(5000);
  
  console.log('\n========================================');
  console.log('请手动执行以下命令获取验证码:');
  console.log('docker logs tgservice --tail 50 | grep 验证码');
  console.log('========================================');
  
  // 不关闭浏览器，等待后续操作
  // await browser.close();
}

test().catch(console.error);