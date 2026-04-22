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
    // 先打开页面
    console.log('打开页面...');
    await page.goto('http://127.0.0.1:8089', { waitUntil: 'load' });
    
    // 设置 token 到 localStorage
    console.log('设置 localStorage...');
    await page.evaluate((t, m, c) => {
      localStorage.clear();
      localStorage.setItem('memberToken', t);
      localStorage.setItem('memberInfo', JSON.stringify(m));
      localStorage.setItem('coachToken', t);
      localStorage.setItem('coachInfo', JSON.stringify(c));
      console.log('Token 已设置');
      console.log('memberToken:', localStorage.getItem('memberToken'));
      console.log('coachToken:', localStorage.getItem('coachToken'));
    }, token, memberInfo, coachInfo);
    
    await wait(1000);
    
    // 导航到会员中心
    console.log('导航到会员中心...');
    await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2' });
    
    await wait(8000);
    
    // 截图会员中心
    console.log('截图会员中心...');
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/member-lufei-badge.png', fullPage: true });
    
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
    if (info.text.includes('陆飞') || info.text.includes('路飞')) {
      console.log('✅ 当前用户: 陆飞');
    } else if (info.text.includes('马美嵩')) {
      console.log('⚠️ 当前用户: 马美嵩');
    } else {
      console.log('⚠️ 未识别用户');
    }
    
    // 检查奖罚角标
    if (info.rewardIdx > -1) {
      // 查找"我的奖罚"后面的数字
      const nearReward = info.text.substring(info.rewardIdx, info.rewardIdx + 100);
      const numMatch = nearReward.match(/我的奖罚[\s\S]{0,30}(\d+)/);
      if (numMatch) {
        console.log('✅ 奖罚角标数字:', numMatch[1]);
      } else {
        console.log('❌ 奖罚附近没有数字');
      }
    } else {
      console.log('❌ 页面没有"我的奖罚"');
    }
    
    console.log('\n截图已保存: /root/.openclaw/workspace_coder-tg/member-lufei-badge.png');
    
  } catch (e) {
    console.error('错误:', e.message);
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/error-badge.png', fullPage: true });
  }
  
  await page.close();
  console.log('测试完成');
}

test();