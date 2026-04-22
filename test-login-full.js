const puppeteer = require('puppeteer');

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function test() {
  console.log('连接 Chrome...');
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });

  const page = await browser.newPage();
  
  try {
    // 先清除缓存
    console.log('清除 localStorage...');
    await page.goto('http://127.0.0.1:8089', { waitUntil: 'load' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      console.log('缓存已清除');
    });
    await wait(1000);
    
    // 点击会员登录按钮
    console.log('点击会员登录...');
    const loginBtnClicked = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const text = el.innerText?.trim();
        if (text === '会员登录') {
          el.click();
          return true;
        }
      }
      return false;
    });
    console.log('点击会员登录结果:', loginBtnClicked);
    
    await wait(3000);
    
    // 截图登录弹窗
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/step1-login-modal.png', fullPage: true });
    console.log('截图: step1-login-modal.png');
    
    // 输入手机号 - 使用更精确的方法
    console.log('查找手机号输入框...');
    const phoneInputFound = await page.evaluate((phone) => {
      // 查找所有 input，找 placeholder 包含"手机"的
      const inputs = Array.from(document.querySelectorAll('input'));
      for (const input of inputs) {
        const placeholder = input.placeholder || '';
        console.log('input placeholder:', placeholder);
        if (placeholder.includes('手机') || placeholder.includes('号')) {
          input.focus();
          input.value = phone;
          // 触发 Vue 的 input 事件
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      // 如果没找到，尝试第一个 text input
      const textInput = inputs.find(i => i.type === 'text' || !i.type);
      if (textInput) {
        textInput.focus();
        textInput.value = phone;
        textInput.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    }, '18775703862');
    console.log('输入手机号结果:', phoneInputFound);
    
    await wait(1000);
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/step2-phone-input.png', fullPage: true });
    
    // 点击获取验证码
    console.log('点击获取验证码...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, [class*="btn"], div, span'));
      for (const btn of btns) {
        const text = btn.innerText?.trim();
        if (text === '获取' || text.includes('验证码')) {
          btn.click();
          return;
        }
      }
    });
    
    await wait(3000);
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/step3-after-code-btn.png', fullPage: true });
    
    // 输入验证码
    console.log('输入验证码...');
    const codeInputFound = await page.evaluate((code) => {
      const inputs = Array.from(document.querySelectorAll('input'));
      for (const input of inputs) {
        const placeholder = input.placeholder || '';
        const type = input.type || '';
        console.log('code input:', placeholder, type);
        if (placeholder.includes('验证码') || placeholder.includes('码') || type === 'number') {
          input.focus();
          input.value = code;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      return false;
    }, '888888');
    console.log('输入验证码结果:', codeInputFound);
    
    await wait(1000);
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/step4-code-input.png', fullPage: true });
    
    // 点击登录
    console.log('点击登录按钮...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, [class*="btn"], div'));
      for (const btn of btns) {
        const text = btn.innerText?.trim();
        if (text === '登录') {
          btn.click();
          return;
        }
      }
    });
    
    await wait(5000);
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/step5-after-login.png', fullPage: true });
    
    // 检查当前 URL
    const currentUrl = page.url();
    console.log('当前 URL:', currentUrl);
    
    // 如果还在登录页，说明登录失败
    if (!currentUrl.includes('member')) {
      console.log('登录失败，检查页面状态...');
      const pageText = await page.evaluate(() => document.body.innerText);
      console.log('页面文本:', pageText.substring(0, 500));
      
      // 截图错误状态
      await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/login-failed.png', fullPage: true });
    } else {
      // 登录成功，检查会员中心
      console.log('登录成功，检查会员中心...');
      
      // 等待页面完全加载
      await wait(5000);
      
      // 截图会员中心
      await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/member-center-success.png', fullPage: true });
      console.log('截图: member-center-success.png');
      
      // 检查页面内容
      const info = await page.evaluate(() => {
        const badges = [];
        document.querySelectorAll('.badge, [class*="badge"]').forEach(el => {
          badges.push({ class: el.className, text: el.innerText?.trim() });
        });
        
        const text = document.body.innerText;
        const rewardIdx = text.indexOf('我的奖罚');
        
        return {
          url: location.href,
          text: text.substring(0, 1000),
          badges,
          rewardIdx,
          rewardNearText: rewardIdx > -1 ? text.substring(rewardIdx, rewardIdx + 50) : ''
        };
      });
      
      console.log('URL:', info.url);
      console.log('页面文本:', info.text.substring(0, 300));
      console.log('奖罚附近文本:', info.rewardNearText);
      console.log('角标元素:', info.badges);
      
      // 检查用户名
      const userMatch = info.text.match(/陆飞|路飞|马美嵩|187.{0,10}/);
      console.log('用户信息:', userMatch);
    }
    
  } catch (e) {
    console.error('错误:', e.message);
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/error-final.png', fullPage: true });
  }
  
  await page.close();
  console.log('测试完成');
}

test();