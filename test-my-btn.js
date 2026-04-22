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
    });
    await wait(1000);
    
    // 点击底部"我的"导航
    console.log('点击"我的"导航...');
    await page.evaluate(() => {
      const navItems = document.querySelectorAll('[class*="nav"], [class*="tab"], a, div');
      for (const item of navItems) {
        const text = item.innerText?.trim();
        if (text === '我的') {
          item.click();
          return;
        }
      }
    });
    
    await wait(3000);
    
    // 检查当前 URL
    const url1 = page.url();
    console.log('点击后 URL:', url1);
    
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/step1-click-my.png', fullPage: true });
    
    // 检查页面是否显示登录界面
    const pageText1 = await page.evaluate(() => document.body.innerText);
    console.log('页面文本:', pageText1.substring(0, 300));
    
    // 如果显示登录界面，输入手机号和验证码
    if (pageText1.includes('会员登录') || pageText1.includes('手机号')) {
      console.log('检测到登录界面，开始登录...');
      
      // 输入手机号
      await page.evaluate((phone) => {
        const inputs = Array.from(document.querySelectorAll('input'));
        for (const input of inputs) {
          const placeholder = input.placeholder || '';
          if (placeholder.includes('手机') || placeholder.includes('号')) {
            input.value = phone;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return;
          }
        }
      }, '18775703862');
      
      await wait(1000);
      
      // 点击获取验证码
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, [class*="btn"], div, span'));
        for (const btn of btns) {
          if (btn.innerText?.trim() === '获取') {
            btn.click();
            return;
          }
        }
      });
      
      await wait(3000);
      
      // 输入验证码
      await page.evaluate((code) => {
        const inputs = Array.from(document.querySelectorAll('input'));
        for (const input of inputs) {
          const placeholder = input.placeholder || '';
          if (placeholder.includes('验证码') || placeholder.includes('码')) {
            input.value = code;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return;
          }
        }
      }, '888888');
      
      await wait(1000);
      
      // 点击登录
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, [class*="btn"], div'));
        for (const btn of btns) {
          if (btn.innerText?.trim() === '登录') {
            btn.click();
            return;
          }
        }
      });
      
      await wait(5000);
    }
    
    // 截图登录后的状态
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/step2-after-login.png', fullPage: true });
    
    const url2 = page.url();
    console.log('登录后 URL:', url2);
    
    // 如果不是会员中心，导航到会员中心
    if (!url2.includes('member')) {
      console.log('导航到会员中心...');
      await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2' });
    }
    
    await wait(5000);
    
    // 截图会员中心
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/member-center-final.png', fullPage: true });
    console.log('截图: member-center-final.png');
    
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
        text: text.substring(0, 1500),
        badges,
        rewardIdx,
        rewardNearText: rewardIdx > -1 ? text.substring(rewardIdx, rewardIdx + 50) : ''
      };
    });
    
    console.log('\n=== 测试结果 ===');
    console.log('URL:', info.url);
    console.log('页面文本片段:', info.text.substring(0, 400));
    console.log('奖罚附近文本:', info.rewardNearText);
    console.log('角标元素:', info.badges);
    
    // 检查用户名
    if (info.text.includes('陆飞') || info.text.includes('路飞')) {
      console.log('✅ 当前用户: 路飞');
    } else if (info.text.includes('马美嵩')) {
      console.log('⚠️ 当前用户: 马美嵩（不是路飞）');
    }
    
    // 检查角标
    if (info.rewardNearText.includes('我的奖罚')) {
      const badgeMatch = info.rewardNearText.match(/我的奖罚\s*\n?\s*(\d+)/);
      if (badgeMatch) {
        console.log('✅ 奖罚角标数字:', badgeMatch[1]);
      } else {
        console.log('❌ 未找到奖罚角标数字');
      }
    }
    
  } catch (e) {
    console.error('错误:', e.message);
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/error-test.png', fullPage: true });
  }
  
  await page.close();
  console.log('测试完成');
}

test();