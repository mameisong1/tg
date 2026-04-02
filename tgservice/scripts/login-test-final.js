/**
 * 登录测试脚本 - 分步骤版本
 * 测试目标：https://tiangong.club/
 */

const { chromium } = require('playwright');

const BASE_URL = 'https://tiangong.club';

async function test() {
  console.log('========================================');
  console.log('[2026-04-02 11:36] 登录测试开始');
  console.log('========================================\n');
  
  // 连接 Chrome CDP
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0] || await browser.newContext();
  const pages = context.pages();
  let page = pages.find(p => p.url().includes('tiangong')) || pages[0];
  
  if (!page || !page.url().includes('tiangong')) {
    page = await context.newPage();
  }
  
  // ========================================
  // 步骤 1：打开网站首页
  // ========================================
  console.log('【步骤1】打开首页...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const homeUrl = page.url();
  console.log('  首页URL:', homeUrl);
  
  // 截图
  await page.screenshot({ path: '/tmp/step1-home.png' });
  console.log('  截图: /tmp/step1-home.png');
  
  // ========================================
  // 步骤 2：点击"我的"进入会员中心
  // ========================================
  console.log('\n【步骤2】点击"我的"...');
  
  // 等待 tabbar 加载
  await page.waitForTimeout(3000);
  
  // 找到并点击"我的" tabbar item
  const tabBar = await page.locator('.uni-tabbar-button, .tabbar-item, [class*="tabbar"]').all();
  console.log('  找到 tabbar 项:', tabBar.length);
  
  // 直接用文本定位
  let clicked = false;
  try {
    // 方式1: 直接找包含"我的"的元素
    const myText = page.getByText('我的', { exact: true });
    const count = await myText.count();
    console.log('  包含"我的"的元素数量:', count);
    
    if (count > 0) {
      // 找到第一个"我的"并点击
      await myText.first().click();
      clicked = true;
      console.log('  点击"我的"成功');
      await page.waitForTimeout(3000);
    }
  } catch (e) {
    console.log('  方式1失败:', e.message);
  }
  
  if (!clicked) {
    // 方式2: 尝试点击底部区域
    const bottomArea = await page.locator('[class*="bottom"], [class*="fixed"]').all();
    console.log('  底部区域元素:', bottomArea.length);
    
    // 遍历找到可点击的"我的"
    for (const el of bottomArea) {
      const text = await el.innerText();
      if (text.includes('我的')) {
        await el.click();
        clicked = true;
        console.log('  方式2成功');
        break;
      }
    }
  }
  
  const memberUrl = page.url();
  console.log('  会员中心URL:', memberUrl);
  
  await page.screenshot({ path: '/tmp/step2-member-center.png' });
  console.log('  截图: /tmp/step2-member-center.png');
  
  // ========================================
  // 步骤 3：进入登录页面
  // ========================================
  console.log('\n【步骤3】进入登录页面...');
  
  // 检查当前页面状态
  const pageText = await page.locator('body').innerText();
  console.log('  页面文本包含"登录":', pageText.includes('登录'));
  console.log('  页面文本包含"请登录":', pageText.includes('请登录'));
  
  // 点击登录按钮/提示
  if (pageText.includes('登录')) {
    try {
      // 找登录按钮
      const loginBtns = await page.locator('button, [class*="btn"], [class*="login"]').all();
      for (const btn of loginBtns) {
        const text = await btn.innerText();
        if (text.includes('登录')) {
          await btn.click();
          console.log('  点击登录按钮:', text);
          await page.waitForTimeout(2000);
          break;
        }
      }
    } catch (e) {
      console.log('  点击登录按钮失败:', e.message);
    }
  }
  
  const loginUrl = page.url();
  console.log('  登录页面URL:', loginUrl);
  
  await page.screenshot({ path: '/tmp/step3-login-page.png' });
  console.log('  截图: /tmp/step3-login-page.png');
  
  // ========================================
  // 步骤 4：分析登录页面结构
  // ========================================
  console.log('\n【步骤4】分析登录页面...');
  
  // 检查输入框
  const inputs = await page.locator('input').all();
  console.log('  输入框数量:', inputs.length);
  
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const type = await input.getAttribute('type') || 'text';
    const placeholder = await input.getAttribute('placeholder') || '';
    const isVisible = await input.isVisible();
    console.log(`    输入框${i}: type=${type}, placeholder="${placeholder}", visible=${isVisible}`);
  }
  
  // 检查按钮
  const buttons = await page.locator('button').all();
  console.log('  按钮数量:', buttons.length);
  
  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    const text = await btn.innerText();
    const isVisible = await btn.isVisible();
    console.log(`    按钮${i}: text="${text}", visible=${isVisible}`);
  }
  
  // 检查复选框
  const checkboxes = await page.locator('input[type="checkbox"]').all();
  console.log('  复选框数量:', checkboxes.length);
  
  // ========================================
  // 步骤 5：执行登录操作
  // ========================================
  console.log('\n【步骤5】执行登录操作...');
  
  // 5.1 勾选同意协议
  if (checkboxes.length > 0) {
    console.log('  勾选同意协议...');
    try {
      await checkboxes[0].check();
      console.log('  勾选成功');
    } catch (e) {
      // 尝试点击
      try {
        await checkboxes[0].click();
        console.log('  点击复选框成功');
      } catch (e2) {
        console.log('  勾选失败:', e2.message);
      }
    }
  }
  
  // 5.2 输入手机号
  const phoneInput = inputs.find(async (input) => {
    const placeholder = await input.getAttribute('placeholder');
    return placeholder && (placeholder.includes('手机') || placeholder.includes('号码') || placeholder.includes('号'));
  }) || inputs[0];
  
  try {
    await phoneInput.fill('18680174119');
    console.log('  输入手机号: 18680174119');
  } catch (e) {
    console.log('  输入手机号失败:', e.message);
    // 尝试其他方式
    for (const input of inputs) {
      const type = await input.getAttribute('type');
      if (type === 'tel' || type === 'number' || type === 'text') {
        try {
          await input.fill('18680174119');
          console.log('  成功输入到 type=' + type + ' 输入框');
          break;
        } catch (e2) {}
      }
    }
  }
  
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/step5-phone-input.png' });
  
  // 5.3 发送验证码
  console.log('  寻找发送验证码按钮...');
  
  let sentCode = false;
  for (const btn of buttons) {
    const text = await btn.innerText();
    if (text.includes('验证码') || text.includes('发送')) {
      try {
        await btn.click();
        console.log('  点击按钮:', text);
        sentCode = true;
        await page.waitForTimeout(3000);
        break;
      } catch (e) {
        console.log('  点击失败:', e.message);
      }
    }
  }
  
  if (!sentCode) {
    // 尝试其他选择器
    const codeBtns = await page.locator('[class*="code"], [class*="send"]').all();
    for (const btn of codeBtns) {
      const text = await btn.innerText();
      console.log('  其他按钮:', text);
      if (text.includes('验证码')) {
        await btn.click();
        console.log('  点击成功');
        sentCode = true;
        break;
      }
    }
  }
  
  console.log('  验证码发送状态:', sentCode ? '成功' : '失败');
  await page.screenshot({ path: '/tmp/step5-code-sent.png' });
  
  // ========================================
  // 步骤 6：等待并获取验证码
  // ========================================
  console.log('\n【步骤6】等待验证码...');
  
  if (sentCode) {
    console.log('  验证码已发送，等待30秒后去日志查找...');
    await page.waitForTimeout(30000);
    
    // 提示去日志找验证码
    console.log('\n  >>> 请执行以下命令获取验证码:');
    console.log('  >>> docker logs tgservice --tail 50 | grep -i "验证码"');
    console.log('  >>> 或: docker logs tgservice --tail 50 | grep "18680174119"');
  }
  
  // 保持浏览器打开，等待手动操作
  console.log('\n========================================');
  console.log('测试暂停，浏览器保持打开');
  console.log('请手动完成后续测试步骤');
  console.log('========================================');
  
  // 不关闭浏览器，保持连接
  // await browser.close();
}

test().catch(console.error);