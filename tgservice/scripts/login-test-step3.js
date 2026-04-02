/**
 * 登录测试脚本 - 第三阶段（正确勾选协议）
 */

const { chromium } = require('playwright');

async function test() {
  console.log('========================================');
  console.log('[2026-04-02 11:40] 继续登录测试');
  console.log('========================================\n');
  
  // 连接 Chrome
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();
  let page = pages.find(p => p.url().includes('tiangong')) || pages[0];
  
  console.log('当前URL:', page.url());
  
  // ========================================
  // 步骤 1：回到会员中心
  // ========================================
  console.log('\n【步骤1】回到会员中心...');
  
  // 如果在协议页面，返回
  if (page.url().includes('agreement')) {
    console.log('  当前在协议页面，返回...');
    await page.goBack();
    await page.waitForTimeout(2000);
  }
  
  console.log('  当前URL:', page.url());
  await page.screenshot({ path: '/tmp/test-back-to-member.png' });
  
  // 等待登录弹窗重新出现
  await page.waitForTimeout(3000);
  
  // ========================================
  // 步骤 2：分析登录弹窗结构
  // ========================================
  console.log('\n【步骤2】分析登录弹窗...');
  
  // 查找登录弹窗的所有子元素
  const popup = await page.locator('[class*="login-popup"], [class*="login-modal"], [class*="modal"]').first();
  
  if (await popup.isVisible()) {
    console.log('  找到登录弹窗');
    
    // 获取弹窗内的所有元素
    const children = await popup.locator('*').all();
    console.log('  弹窗内元素数量:', children.length);
    
    // 输出元素信息
    for (const child of children) {
      try {
        const className = await child.getAttribute('class') || '';
        const text = await child.innerText();
        if (className || text) {
          console.log(`    class="${className}", text="${text?.substring(0, 30)}"`);
        }
      } catch (e) {}
    }
  }
  
  // ========================================
  // 步骤 3：找到并勾选 checkbox
  // ========================================
  console.log('\n【步骤3】勾选协议 checkbox...');
  
  // 找 checkbox 图标（可能是自定义的 icon）
  const checkboxIcons = await page.locator('[class*="checkbox"], [class*="check"], [class*="icon"]').all();
  console.log('  checkbox/icon 相关元素:', checkboxIcons.length);
  
  // 分析登录弹窗的 HTML 结构
  const popupHtml = await popup.innerHTML();
  console.log('\n登录弹窗 HTML 结构:');
  console.log(popupHtml.substring(0, 1000));
  
  // 找到 checkbox 并点击
  for (const icon of checkboxIcons) {
    const className = await icon.getAttribute('class');
    const parent = await icon.evaluateHandle(el => el.parentElement);
    const parentText = await parent.innerText();
    
    console.log(`  icon class="${className}", parent text="${parentText?.substring(0, 20)}"`);
    
    // 如果父元素包含"同意"，点击这个 icon
    if (parentText && parentText.includes('同意')) {
      console.log('  找到同意旁边的 checkbox，点击...');
      await icon.click();
      console.log('  勾选成功');
      break;
    }
  }
  
  await page.screenshot({ path: '/tmp/test-checkbox-clicked.png' });
  
  // ========================================
  // 步骤 4：输入手机号
  // ========================================
  console.log('\n【步骤4】输入手机号...');
  
  const inputs = await page.locator('input').all();
  console.log('  输入框数量:', inputs.length);
  
  if (inputs.length >= 2) {
    // 第一个应该是手机号，第二个是验证码
    try {
      await inputs[0].fill('18680174119');
      console.log('  输入手机号成功');
    } catch (e) {
      console.log('  输入失败:', e.message);
    }
  }
  
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/test-phone-entered.png' });
  
  // ========================================
  // 步骤 5：点击"获取"验证码
  // ========================================
  console.log('\n【步骤5】点击"获取"验证码...');
  
  // 用 CSS class 选择器
  const getCodeBtn = page.locator('.h5-code-btn');
  try {
    if (await getCodeBtn.isVisible()) {
      console.log('  找到 .h5-code-btn');
      await getCodeBtn.click();
      console.log('  点击"获取"成功！');
      await page.waitForTimeout(3000);
    } else {
      // 用文本匹配
      const btn = page.getByText('获取', { exact: true });
      await btn.click();
      console.log('  通过文本匹配点击成功');
    }
  } catch (e) {
    console.log('  点击失败:', e.message);
  }
  
  await page.screenshot({ path: '/tmp/test-code-sent.png' });
  
  // ========================================
  // 步骤 6：去日志找验证码
  // ========================================
  console.log('\n【步骤6】去 Docker 日志找验证码...');
  
  // 执行命令获取验证码
  console.log('\n  执行: docker logs tgservice --tail 30');
  
  await browser.close();
}

test().catch(console.error);