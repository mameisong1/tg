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
    // 先用 API 登录获取 token
    console.log('调用 API 登录...');
    const loginResponse = await page.evaluate(async () => {
      const res = await fetch('http://127.0.0.1:8088/api/coaches/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '18775703862', code: '888888' })
      });
      return await res.json();
    });
    
    console.log('登录响应:', JSON.stringify(loginResponse));
    
    if (loginResponse.success && loginResponse.token) {
      console.log('✅ 登录成功，获取到 token');
      
      // 设置 token 到 localStorage
      await page.evaluate((token, coach) => {
        localStorage.setItem('coachToken', token);
        localStorage.setItem('coachInfo', JSON.stringify(coach));
        localStorage.setItem('memberToken', token);  // 同时设置 memberToken
        localStorage.setItem('memberInfo', JSON.stringify(coach));
      }, loginResponse.token, loginResponse.coach);
      
      console.log('Token 已设置到 localStorage');
      
      // 导航到会员中心
      console.log('导航到会员中心...');
      await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2' });
      
      await wait(5000);
      
      // 截图会员中心
      await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/member-lufei-final.png', fullPage: true });
      console.log('截图: member-lufei-final.png');
      
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
          text: text.substring(0, 2000),
          badges,
          rewardIdx,
          rewardNearText: rewardIdx > -1 ? text.substring(rewardIdx, rewardIdx + 50) : ''
        };
      });
      
      console.log('\n=== 测试结果 ===');
      console.log('URL:', info.url);
      console.log('页面文本片段:', info.text.substring(0, 500));
      console.log('奖罚附近文本:', info.rewardNearText);
      console.log('角标元素:', info.badges);
      
      // 检查用户名
      if (info.text.includes('陆飞') || info.text.includes('路飞')) {
        console.log('✅ 当前用户: 路飞');
      } else if (info.text.includes('马美嵩')) {
        console.log('⚠️ 当前用户: 马美嵩');
      }
      
      // 检查角标
      const rewardBadge = info.badges.find(b => !isNaN(parseInt(b.text)));
      if (rewardBadge) {
        console.log('✅ 检测到角标:', rewardBadge.text);
      } else {
        console.log('❌ 未检测到角标');
      }
      
    } else {
      console.log('❌ 登录失败:', loginResponse.error || loginResponse.message);
      
      // 截图登录失败状态
      await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/login-api-failed.png', fullPage: true });
    }
    
  } catch (e) {
    console.error('错误:', e.message);
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/error-api-login.png', fullPage: true });
  }
  
  await page.close();
  console.log('测试完成');
}

test();