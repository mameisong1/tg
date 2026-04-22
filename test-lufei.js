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
    // 先清除 localStorage
    console.log('清除缓存...');
    await page.goto('http://127.0.0.1:8089', { waitUntil: 'load' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    console.log('缓存已清除');
    
    await wait(1000);
    
    // 导航到会员登录页
    console.log('导航到会员登录页...');
    await page.goto('http://127.0.0.1:8089/#/pages/vip-detail/vip-detail', { waitUntil: 'networkidle2', timeout: 30000 });
    
    await wait(3000);
    
    // 截图登录页
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/login-page.png', fullPage: true });
    
    // 查找手机号输入框
    console.log('查找输入框...');
    const inputs = await page.$$('input');
    console.log('输入框数量:', inputs.length);
    
    // 输入手机号
    const phoneInput = await page.$('input[type="text"], input[type="number"], input[placeholder*="手机"]');
    if (phoneInput) {
      console.log('输入手机号...');
      await phoneInput.type('18775703862');
    } else {
      // 尝试所有输入框
      for (const input of inputs) {
        const type = await input.evaluate(el => el.type);
        const placeholder = await input.evaluate(el => el.placeholder);
        console.log('输入框类型:', type, 'placeholder:', placeholder);
        if (type === 'text' || placeholder.includes('手机')) {
          await input.type('18775703862');
          console.log('已输入手机号');
          break;
        }
      }
    }
    
    await wait(1000);
    
    // 点击获取验证码
    console.log('点击获取验证码...');
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.innerText);
      if (text.includes('验证码') || text.includes('获取')) {
        await btn.click();
        console.log('已点击获取验证码');
        break;
      }
    }
    
    await wait(2000);
    
    // 输入验证码
    console.log('输入验证码...');
    const codeInputs = await page.$$('input');
    for (const input of codeInputs) {
      const placeholder = await input.evaluate(el => el.placeholder);
      if (placeholder.includes('验证码') || placeholder.includes('码')) {
        await input.type('888888');
        console.log('已输入验证码');
        break;
      }
    }
    
    await wait(1000);
    
    // 点击登录
    console.log('点击登录...');
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.innerText);
      if (text.includes('登录') && !text.includes('会员')) {
        await btn.click();
        console.log('已点击登录');
        break;
      }
    }
    
    await wait(5000);
    
    // 截图登录结果
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/login-result.png', fullPage: true });
    
    // 导航到会员中心
    console.log('导航到会员中心...');
    await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2', timeout: 30000 });
    
    await wait(5000);
    
    // 截图会员中心
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/member-center-lufei.png', fullPage: true });
    
    // 检查页面内容
    const info = await page.evaluate(() => {
      const badges = [];
      document.querySelectorAll('.badge, [class*="badge"]').forEach(el => {
        badges.push({ class: el.className, text: el.innerText });
      });
      
      return {
        url: location.href,
        text: document.body.innerText,
        badges,
        userInfo: document.body.innerText.match(/.{0,20}(陆飞|路飞|187.{0,10})/g) || []
      };
    });
    
    console.log('URL:', info.url);
    console.log('用户信息:', info.userInfo);
    console.log('页面文本片段:', info.text.substring(0, 500));
    console.log('角标元素:', info.badges);
    
    // 检查是否有奖罚角标
    const rewardBadge = info.badges.find(b => {
      // 检查角标是否在"我的奖罚"附近
      const text = info.text;
      const rewardIndex = text.indexOf('我的奖罚');
      if (rewardIndex > -1) {
        // 查找"我的奖罚"后面的数字
        const afterReward = text.substring(rewardIndex, rewardIndex + 20);
        return afterReward.includes(b.text);
      }
      return false;
    });
    
    if (rewardBadge) {
      console.log('✅ 奖罚角标:', rewardBadge.text);
    } else {
      console.log('❌ 未找到奖罚角标');
    }
    
  } catch (e) {
    console.error('错误:', e.message);
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/test-error.png' });
  }
  
  await page.close();
  console.log('完成');
}

test();