const puppeteer = require('/usr/lib/node_modules/puppeteer');
const fs = require('fs');

async function main() {
  console.log('开始调试登录流程...');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 },
    protocolTimeout: 180000
  });
  
  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();
  
  // 清空 Storage
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  // 访问会员页
  console.log('访问会员页...');
  await page.goto('https://tg.tiangong.club/#/pages/member/member', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  
  // 获取页面 HTML 结构
  const html = await page.evaluate(() => {
    // 查找所有 input 元素
    const inputs = document.querySelectorAll('input');
    const inputInfo = [];
    inputs.forEach(input => {
      inputInfo.push({
        type: input.type,
        placeholder: input.placeholder,
        class: input.className,
        maxlength: input.maxlength,
        value: input.value
      });
    });
    
    // 查找所有按钮
    const buttons = document.querySelectorAll('button, .h5-login-btn, .h5-code-btn');
    const buttonInfo = [];
    buttons.forEach(btn => {
      buttonInfo.push({
        text: btn.textContent.trim(),
        class: btn.className
      });
    });
    
    // 查找 checkbox
    const checkbox = document.querySelector('.checkbox');
    const checkboxInfo = checkbox ? {
      class: checkbox.className,
      hasChecked: checkbox.classList.contains('checked')
    } : null;
    
    return { inputInfo, buttonInfo, checkboxInfo };
  });
  
  console.log('\n=== 页面结构 ===');
  console.log('Input 元素:');
  html.inputInfo.forEach((input, i) => {
    console.log(`  ${i}: type=${input.type}, placeholder="${input.placeholder}", class="${input.class}"`);
  });
  
  console.log('\nButton 元素:');
  html.buttonInfo.forEach((btn, i) => {
    console.log(`  ${i}: text="${btn.text}", class="${btn.class}"`);
  });
  
  console.log('\nCheckbox:');
  console.log(`  class="${html.checkboxInfo?.class}", checked=${html.checkboxInfo?.hasChecked}`);
  
  // 截图
  await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/debug-login-page.png', fullPage: true });
  console.log('\n截图保存: debug-login-page.png');
  
  // 尝试登录流程
  console.log('\n=== 开始登录流程 ===');
  
  // 1. 同意协议
  const checkbox = await page.$('.checkbox');
  if (checkbox) {
    const isChecked = await page.evaluate(el => el.classList.contains('checked'), checkbox);
    console.log(`Checkbox 当前状态: ${isChecked ? '已勾选' : '未勾选'}`);
    if (!isChecked) {
      console.log('点击勾选协议...');
      await checkbox.click();
      await new Promise(r => setTimeout(r, 500));
      const nowChecked = await page.evaluate(el => el.classList.contains('checked'), checkbox);
      console.log(`Checkbox 新状态: ${nowChecked ? '已勾选' : '未勾选'}`);
    }
  }
  
  // 2. 输入手机号
  const inputs = await page.$$('input');
  console.log(`找到 ${inputs.length} 个 input`);
  
  // 找手机号输入框
  let phoneInput = null;
  for (const input of inputs) {
    const placeholder = await page.evaluate(el => el.placeholder, input);
    console.log(`Input placeholder: "${placeholder}"`);
    if (placeholder && placeholder.includes('手机')) {
      phoneInput = input;
      break;
    }
  }
  
  if (phoneInput) {
    console.log('输入手机号: 18600000004');
    await phoneInput.click({ clickCount: 3 });
    await phoneInput.type('18600000004', { delay: 100 });
    await new Promise(r => setTimeout(r, 500));
    
    const phoneValue = await page.evaluate(el => el.value, phoneInput);
    console.log(`手机号输入框值: "${phoneValue}"`);
  } else {
    console.log('未找到手机号输入框！');
  }
  
  // 截图
  await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/debug-after-phone.png', fullPage: true });
  console.log('截图保存: debug-after-phone.png');
  
  // 3. 点击获取验证码
  const codeBtn = await page.$('.h5-code-btn');
  if (codeBtn) {
    const btnText = await page.evaluate(el => el.textContent, codeBtn);
    console.log(`验证码按钮文本: "${btnText}"`);
    
    // 检查是否 disabled
    const isDisabled = await page.evaluate(el => el.classList.contains('disabled'), codeBtn);
    console.log(`验证码按钮 disabled: ${isDisabled}`);
    
    if (!isDisabled) {
      console.log('点击获取验证码...');
      await codeBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }
  } else {
    console.log('未找到验证码按钮！');
  }
  
  await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/debug-after-code-btn.png', fullPage: true });
  console.log('截图保存: debug-after-code-btn.png');
  
  // 4. 输入验证码
  const inputs2 = await page.$$('input');
  let codeInput = null;
  for (const input of inputs2) {
    const placeholder = await page.evaluate(el => el.placeholder, input);
    if (placeholder && placeholder.includes('验证码')) {
      codeInput = input;
      break;
    }
  }
  
  if (codeInput) {
    console.log('输入验证码: 888888');
    await codeInput.click();
    await codeInput.type('888888', { delay: 100 });
    await new Promise(r => setTimeout(r, 500));
    
    const codeValue = await page.evaluate(el => el.value, codeInput);
    console.log(`验证码输入框值: "${codeValue}"`);
  } else {
    console.log('未找到验证码输入框！');
  }
  
  await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/debug-after-code-input.png', fullPage: true });
  console.log('截图保存: debug-after-code-input.png');
  
  // 5. 点击登录
  const loginBtn = await page.$('.h5-login-btn');
  if (loginBtn) {
    const btnText = await page.evaluate(el => el.textContent, loginBtn);
    console.log(`登录按钮文本: "${btnText}"`);
    console.log('点击登录...');
    await loginBtn.click();
    await new Promise(r => setTimeout(r, 3000));
  } else {
    console.log('未找到登录按钮！');
  }
  
  await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/debug-after-login-click.png', fullPage: true });
  console.log('截图保存: debug-after-login-click.png');
  
  // 6. 检查身份选择弹框
  const roleModal = await page.$('.role-select-content');
  if (roleModal) {
    console.log('发现身份选择弹框');
    const roleOptions = await page.$$('.role-option');
    console.log(`找到 ${roleOptions.length} 个身份选项`);
    
    for (const option of roleOptions) {
      const text = await page.evaluate(el => el.textContent, option);
      console.log(`身份选项: "${text.substring(0, 50)}"`);
      if (text.includes('助教')) {
        console.log('选择助教身份...');
        await option.click();
        await new Promise(r => setTimeout(r, 2000));
        break;
      }
    }
  } else {
    console.log('没有身份选择弹框');
  }
  
  await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/debug-after-role-select.png', fullPage: true });
  console.log('截图保存: debug-after-role-select.png');
  
  // 7. 检查 Storage
  const storage = await page.evaluate(() => {
    return {
      memberToken: localStorage.getItem('memberToken'),
      memberInfo: localStorage.getItem('memberInfo'),
      coachToken: localStorage.getItem('coachToken'),
      coachInfo: localStorage.getItem('coachInfo')
    };
  });
  
  console.log('\n=== Storage 结果 ===');
  console.log('memberToken:', storage.memberToken);
  console.log('memberInfo:', storage.memberInfo);
  console.log('coachToken:', storage.coachToken);
  console.log('coachInfo:', storage.coachInfo);
  
  // 8. 检查当前 URL
  const url = page.url();
  console.log('\n当前 URL:', url);
  
  await browser.disconnect();
  console.log('\n调试结束');
}

main().catch(console.error);