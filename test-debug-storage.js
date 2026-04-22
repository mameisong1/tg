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
    await page.goto('http://127.0.0.1:8089', { waitUntil: 'load' });
    
    // 清除缓存
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          await caches.delete(name);
        }
      }
      localStorage.clear();
      sessionStorage.clear();
    });
    
    await wait(2000);
    await page.reload({ waitUntil: 'networkidle2' });
    
    // 设置 localStorage - 使用 JSON.stringify
    await page.evaluate((t, m, c) => {
      localStorage.setItem('memberToken', t);
      localStorage.setItem('memberInfo', JSON.stringify(m));
      localStorage.setItem('coachToken', t);
      localStorage.setItem('coachInfo', JSON.stringify(c));
      console.log('coachInfo 设置:', localStorage.getItem('coachInfo'));
    }, token, memberInfo, coachInfo);
    
    await wait(1000);
    
    // 导航到会员中心
    await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2' });
    
    await wait(15000);  // 等待 15 秒
    
    // 截图
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/member-final-test.png', fullPage: true });
    
    // 检查 localStorage 和 API 调用
    const info = await page.evaluate(() => {
      // 检查 localStorage
      const coachInfoStr = localStorage.getItem('coachInfo');
      let coachInfoObj = null;
      try {
        coachInfoObj = JSON.parse(coachInfoStr);
      } catch (e) {}
      
      // 模拟 uni.getStorageSync 的行为
      const uniCoachInfo = coachInfoStr;  // uni.getStorageSync 可能返回字符串
      
      // 检查页面内容
      const text = document.body.innerText;
      const rewardIdx = text.indexOf('我的奖罚');
      
      // 检查角标
      const badges = [];
      document.querySelectorAll('.badge, [class*="badge"]').forEach(el => {
        badges.push({ class: el.className, text: el.innerText?.trim() });
      });
      
      return {
        coachInfoStr,
        coachInfoObj,
        uniCoachInfo,
        coachPhone: coachInfoObj?.phone,
        text: text,
        badges,
        rewardIdx,
        rewardNearText: rewardIdx > -1 ? text.substring(rewardIdx, rewardIdx + 50) : ''
      };
    });
    
    console.log('\n=== 测试结果 ===');
    console.log('coachInfo localStorage:', info.coachInfoStr);
    console.log('coachInfo 解析后:', info.coachInfoObj);
    console.log('coachInfo.phone:', info.coachPhone);
    console.log('奖罚附近文本:', info.rewardNearText);
    console.log('角标元素:', info.badges);
    
    if (info.coachPhone === '18775703862') {
      console.log('✅ coachInfo.phone 正确');
    } else {
      console.log('❌ coachInfo.phone 不正确:', info.coachPhone);
    }
    
    if (info.badges.length > 0) {
      console.log('✅ 检测到角标');
    } else {
      console.log('❌ 未检测到角标');
    }
    
  } catch (e) {
    console.error('错误:', e.message);
  }
  
  await page.close();
}

test();