/**
 * 登录测试脚本
 * 使用 playwright 连接 mychrome (CDP 9222)
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
  console.log('[2026/4/2] 开始登录测试...');
  
  // 连接 mychrome
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  const context = contexts[0] || await browser.newContext();
  
  // 获取或创建页面
  const pages = context.pages();
  let page = pages.find(p => p.url().includes('tiangong.club')) || pages[0];
  
  if (!page) {
    page = await context.newPage();
  }
  
  // ===== 步骤1：打开网站 =====
  console.log('\n=== 步骤1：打开网站 ===');
  await page.goto('https://tiangong.club/', { waitUntil: 'networkidle', timeout: 30000 });
  console.log('当前页面:', page.url());
  
  // 等待页面加载
  await page.waitForTimeout(3000);
  
  // ===== 步骤2：点击"我的"进入会员中心 =====
  console.log('\n=== 步骤2：点击"我的" ===');
  
  // 检查是否有底部 tabbar
  const myTab = await page.locator('text=我的').first();
  if (await myTab.isVisible()) {
    console.log('找到"我的"按钮，点击...');
    await myTab.click();
    await page.waitForTimeout(2000);
  } else {
    // 尝试其他方式
    const memberTab = await page.locator('[class*="member"], [class*="我的"]').first();
    if (await memberTab.isVisible()) {
      await memberTab.click();
      await page.waitForTimeout(2000);
    }
  }
  
  console.log('当前页面:', page.url());
  
  // 截图
  await page.screenshot({ path: '/tmp/login-test-1-member-center.png' });
  console.log('截图保存: /tmp/login-test-1-member-center.png');
  
  // ===== 测试1：正常登录 =====
  console.log('\n=== 测试1：正常登录测试 ===');
  
  // 查找登录入口
  const loginBtn = await page.locator('text=登录').first();
  const phoneLoginBtn = await page.locator('text=手机号登录').first();
  
  // 检查页面内容
  const pageContent = await page.content();
  console.log('页面包含登录按钮:', pageContent.includes('登录'));
  console.log('页面包含手机号登录:', pageContent.includes('手机号登录'));
  
  // 如果在会员中心页面，应该能看到登录提示
  const needLoginTip = await page.locator('text=请登录').first();
  if (await needLoginTip.isVisible()) {
    console.log('看到"请登录"提示');
  }
  
  // 查找并点击登录按钮
  let clicked = false;
  
  // 尝试多种登录入口
  const loginSelectors = [
    'text=登录',
    'text=立即登录',
    'text=手机号登录',
    '.login-btn',
    '[class*="login"]'
  ];
  
  for (const selector of loginSelectors) {
    try {
      const el = await page.locator(selector).first();
      if (await el.isVisible({ timeout: 1000 })) {
        console.log(`找到登录入口: ${selector}`);
        await el.click();
        clicked = true;
        await page.waitForTimeout(1000);
        break;
      }
    } catch (e) {}
  }
  
  if (!clicked) {
    console.log('未找到登录入口，检查页面结构...');
    // 获取页面文本内容
    const bodyText = await page.locator('body').innerText();
    console.log('页面文本片段:', bodyText.substring(0, 500));
  }
  
  // 截图当前状态
  await page.screenshot({ path: '/tmp/login-test-2-before-login.png' });
  console.log('截图保存: /tmp/login-test-2-before-login.png');
  
  // ===== 检查是否进入登录页面 =====
  console.log('\n当前URL:', page.url());
  
  // 如果需要勾选同意协议
  const agreeCheckbox = await page.locator('input[type="checkbox"], .checkbox, text=同意').first();
  if (await agreeCheckbox.isVisible()) {
    console.log('找到同意协议复选框，勾选...');
    try {
      await agreeCheckbox.click();
      await page.waitForTimeout(500);
    } catch (e) {
      console.log('勾选协议失败:', e.message);
    }
  }
  
  // 查找手机号输入框
  const phoneInput = await page.locator('input[type="tel"], input[placeholder*="手机"], input[placeholder*="号码"]').first();
  if (await phoneInput.isVisible()) {
    console.log('找到手机号输入框');
    await phoneInput.fill('18680174119');
    console.log('已输入手机号: 18680174119');
    await page.waitForTimeout(500);
  } else {
    console.log('未找到手机号输入框');
    // 尝试其他选择器
    const inputs = await page.locator('input').all();
    console.log('页面输入框数量:', inputs.length);
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      console.log(`输入框 ${i}: type=${type}, placeholder=${placeholder}`);
    }
  }
  
  // 截图
  await page.screenshot({ path: '/tmp/login-test-3-input-phone.png' });
  
  // 查找发送验证码按钮
  const sendCodeBtn = await page.locator('text=发送验证码, text=获取验证码').first();
  if (await sendCodeBtn.isVisible()) {
    console.log('找到发送验证码按钮，点击...');
    await sendCodeBtn.click();
    await page.waitForTimeout(2000);
    console.log('验证码已发送');
    
    // 去日志找验证码
    console.log('\n请去后端日志查看验证码...');
    console.log('命令: docker logs tgservice | grep "验证码" | tail -5');
  }
  
  await browser.close();
}

main().catch(console.error);