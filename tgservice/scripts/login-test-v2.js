/**
 * 登录测试脚本 V2 - 简化版
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
  console.log('[2026/4/2 11:35] 开始登录测试...');
  
  // 连接 mychrome
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  const context = contexts[0] || await browser.newContext();
  
  // 获取现有页面
  const pages = context.pages();
  let page = pages.find(p => p.url().includes('tiangong.club')) || pages[0];
  
  if (!page) {
    page = await context.newPage();
  }
  
  // ===== 步骤1：打开网站 =====
  console.log('\n=== 步骤1：打开网站 ===');
  await page.goto('https://tiangong.club/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log('页面URL:', page.url());
  
  // ===== 步骤2：进入会员中心 =====
  console.log('\n=== 步骤2：点击"我的" ===');
  
  // 截图首页
  await page.screenshot({ path: '/tmp/test-home.png', fullPage: false });
  
  // 点击底部"我的"
  const tabBarItems = await page.locator('.uni-tabbar, [class*="tabbar"], .tabbar').all();
  console.log('找到 tabbar 容器:', tabBarItems.length);
  
  // 直接用文本匹配
  const myBtn = page.locator('text=我的').nth(0);
  try {
    await myBtn.waitFor({ state: 'visible', timeout: 5000 });
    await myBtn.click();
    console.log('点击"我的"成功');
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('点击失败，尝试其他方式...');
    // 截图帮助分析
    await page.screenshot({ path: '/tmp/test-home-debug.png', fullPage: true });
  }
  
  console.log('会员中心URL:', page.url());
  await page.screenshot({ path: '/tmp/test-member-center.png' });
  
  // ===== 测试1：正常登录 =====
  console.log('\n=== 测试1：正常登录 ===');
  
  // 检查是否需要登录
  const loginPrompt = await page.locator('text=登录, text=请登录').first();
  const isVisible = await loginPrompt.isVisible();
  console.log('看到登录提示:', isVisible);
  
  if (isVisible) {
    // 点击登录按钮
    await loginPrompt.click();
    await page.waitForTimeout(1500);
    console.log('点击登录按钮后URL:', page.url());
  }
  
  await page.screenshot({ path: '/tmp/test-login-page.png' });
  
  // 分析页面输入框
  const inputs = await page.locator('input').all();
  console.log('页面输入框数量:', inputs.length);
  
  for (let i = 0; i < Math.min(inputs.length, 5); i++) {
    const input = inputs[i];
    const type = await input.getAttribute('type') || 'text';
    const placeholder = await input.getAttribute('placeholder') || '';
    const name = await input.getAttribute('name') || '';
    console.log(`  输入框${i}: type=${type}, placeholder=${placeholder}, name=${name}`);
  }
  
  // 检查复选框
  const checkboxes = await page.locator('input[type="checkbox"]').all();
  console.log('复选框数量:', checkboxes.length);
  
  // 勾选同意协议（如果有）
  if (checkboxes.length > 0) {
    console.log('勾选同意协议...');
    await checkboxes[0].click();
    await page.waitForTimeout(500);
  }
  
  // 输入手机号
  const phoneInput = page.locator('input').nth(0);
  try {
    await phoneInput.fill('18680174119');
    console.log('输入手机号成功');
  } catch (e) {
    console.log('输入手机号失败:', e.message);
  }
  
  await page.screenshot({ path: '/tmp/test-phone-input.png' });
  
  // 点击发送验证码
  const sendBtn = page.locator('button, .btn, [class*="send"]').filter({ hasText: '验证码' }).first();
  try {
    await sendBtn.waitFor({ state: 'visible', timeout: 3000 });
    await sendBtn.click();
    console.log('发送验证码成功');
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('发送验证码失败:', e.message);
    // 尝试其他方式
    const allButtons = await page.locator('button').all();
    console.log('所有按钮数量:', allButtons.length);
    for (const btn of allButtons) {
      const text = await btn.innerText();
      console.log('  按钮文本:', text);
      if (text.includes('验证码')) {
        await btn.click();
        console.log('通过文本找到并点击验证码按钮');
        break;
      }
    }
  }
  
  await page.screenshot({ path: '/tmp/test-code-sent.png' });
  
  // 去后端日志找验证码
  console.log('\n请检查验证码...');
  
  // 等待用户输入验证码
  console.log('\n等待60秒后继续检查结果...');
  await page.waitForTimeout(60000);
  
  // 最终截图
  await page.screenshot({ path: '/tmp/test-final.png' });
  console.log('测试结束');
  
  await browser.close();
}

main().catch(console.error);