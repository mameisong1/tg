const puppeteer = require('puppeteer');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZW1iZXJObyI6MjEsInBob25lIjoiMTg3NzU3MDM4NjIiLCJpYXQiOjE3NzY4Njg5NzEsImV4cCI6MTc3OTQ2MDk3MX0.JO77mYEGfLoiFxw125sagzMkxArEx72-efIsRtuTQ70';
const memberInfo = {"memberNo":21,"phone":"18775703862","name":"陆飞","gender":"女"};
const coachInfo = {"coachNo":10002,"employeeId":"2","stageName":"陆飞","phone":"18775703862","level":"高级","shift":"早班","status":"全职"};

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function test() {
  console.log('连接 Chrome...');
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });

  const page = await browser.newPage();
  
  try {
    // 先打开页面，清除 Service Worker
    console.log('打开页面并清除 Service Worker...');
    await page.goto('http://127.0.0.1:8089', { waitUntil: 'load' });
    
    // 强制清除 Service Worker 和缓存
    await page.evaluate(async () => {
      // 清除 Service Worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.log('Service Worker 已注销');
        }
      }
      
      // 清除所有缓存
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          await caches.delete(name);
          console.log('缓存已删除:', name);
        }
      }
      
      // 清除 localStorage
      localStorage.clear();
      sessionStorage.clear();
    });
    
    console.log('缓存已清除');
    
    await wait(2000);
    
    // 硬刷新页面
    console.log('硬刷新页面...');
    await page.reload({ waitUntil: 'networkidle2' });
    
    await wait(3000);
    
    // 设置 token 到 localStorage
    console.log('设置 localStorage...');
    await page.evaluate((t, m, c) => {
      localStorage.setItem('memberToken', t);
      localStorage.setItem('memberInfo', JSON.stringify(m));
      localStorage.setItem('coachToken', t);
      localStorage.setItem('coachInfo', JSON.stringify(c));
    }, token, memberInfo, coachInfo);
    
    await wait(1000);
    
    // 导航到会员中心
    console.log('导航到会员中心...');
    await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2' });
    
    await wait(10000);  // 等待 10 秒让数据加载
    
    // 截图会员中心
    console.log('截图会员中心...');
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/member-lufei-final2.png', fullPage: true });
    
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
        text: text,
        badges,
        rewardIdx,
        rewardNearText: rewardIdx > -1 ? text.substring(rewardIdx, rewardIdx + 50) : ''
      };
    });
    
    console.log('\n=== 测试结果 ===');
    console.log('URL:', info.url);
    console.log('页面文本长度:', info.text.length);
    console.log('页面文本片段:', info.text.substring(0, 800));
    console.log('奖罚附近文本:', info.rewardNearText);
    console.log('角标元素:', info.badges);
    
    // 检查用户名
    if (info.text.includes('陆飞')) {
      console.log('✅ 当前用户: 陆飞');
    }
    
    // 检查角标
    if (info.badges.length > 0) {
      console.log('✅ 检测到角标:', info.badges);
    } else {
      console.log('❌ 未检测到角标');
    }
    
    console.log('\n截图已保存: /root/.openclaw/workspace_coder-tg/member-lufei-final2.png');
    
  } catch (e) {
    console.error('错误:', e.message);
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/error-final2.png', fullPage: true });
  }
  
  await page.close();
  console.log('测试完成');
}

test();