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
    console.log('导航到首页...');
    await page.goto('http://127.0.0.1:8089', { waitUntil: 'networkidle2' });
    await wait(2000);
    
    // 点击会员登录
    console.log('点击会员登录...');
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button, div, a, span');
      for (const btn of btns) {
        if (btn.innerText.trim() === '会员登录') {
          btn.click();
          console.log('点击了会员登录');
          return;
        }
      }
    });
    
    await wait(3000);
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/login-modal.png' });
    
    // 输入手机号 - 使用 evaluate 直接操作
    console.log('输入手机号...');
    await page.evaluate((phone) => {
      const inputs = document.querySelectorAll('input');
      for (const input of inputs) {
        const p = input.placeholder || '';
        if (p.includes('手机') || p.includes('号') || input.type === 'text') {
          input.value = phone;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }
      }
    }, '18775703862');
    
    await wait(1000);
    
    // 点击获取验证码
    console.log('点击获取验证码...');
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button, div');
      for (const btn of btns) {
        if (btn.innerText.includes('获取') || btn.innerText.includes('验证码')) {
          btn.click();
          return;
        }
      }
    });
    
    await wait(3000);
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/after-code.png' });
    
    // 输入验证码
    console.log('输入验证码...');
    await page.evaluate((code) => {
      const inputs = document.querySelectorAll('input');
      for (const input of inputs) {
        const p = input.placeholder || '';
        const t = input.type || '';
        if (p.includes('验证码') || p.includes('码') || t === 'number') {
          input.value = code;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }
      }
    }, '888888');
    
    await wait(1000);
    
    // 点击登录按钮
    console.log('点击登录...');
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button, div');
      for (const btn of btns) {
        const text = btn.innerText.trim();
        if (text === '登录' && !btn.innerText.includes('会员')) {
          btn.click();
          return;
        }
      }
    });
    
    await wait(5000);
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/after-login.png' });
    
    // 导航到会员中心
    console.log('导航到会员中心...');
    await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2' });
    await wait(5000);
    
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/member-lufei.png', fullPage: true });
    
    // 检查页面
    const info = await page.evaluate(() => {
      const badges = [];
      document.querySelectorAll('.badge, [class*="badge"]').forEach(el => {
        badges.push({ class: el.className, text: el.innerText.trim() });
      });
      
      return {
        url: location.href,
        text: document.body.innerText.substring(0, 2000),
        badges
      };
    });
    
    console.log('URL:', info.url);
    console.log('页面文本:', info.text.substring(0, 500));
    console.log('角标:', info.badges);
    
    // 检查奖罚角标
    const rewardIdx = info.text.indexOf('我的奖罚');
    if (rewardIdx > -1) {
      const nearReward = info.text.substring(rewardIdx, rewardIdx + 30);
      console.log('奖罚附近文本:', nearReward);
      const numMatch = nearReward.match(/我的奖罚\s*\n?\s*(\d+)/);
      if (numMatch) {
        console.log('✅ 奖罚角标数字:', numMatch[1]);
      } else {
        console.log('❌ 未找到奖罚角标数字');
      }
    }
    
  } catch (e) {
    console.error('错误:', e.message);
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/error-lufei.png' });
  }
  
  await page.close();
}

test();