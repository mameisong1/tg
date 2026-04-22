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
    console.log('导航到会员中心...');
    await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2', timeout: 30000 });
    
    await wait(5000);
    
    console.log('截图...');
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/member-page.png', fullPage: true });
    
    // 检查页面内容
    const info = await page.evaluate(() => {
      const badges = [];
      document.querySelectorAll('*').forEach(el => {
        const c = el.className || '';
        if (c.includes('badge') || c.includes('count') || c.includes('num')) {
          badges.push({ class: c, text: el.innerText });
        }
      });
      
      const rewardBtns = [];
      document.querySelectorAll('button, a, div, span').forEach(el => {
        const t = el.innerText || '';
        if (t.includes('奖罚') || t.includes('奖励')) {
          rewardBtns.push({ text: t, class: el.className });
        }
      });
      
      return {
        url: location.href,
        text: document.body.innerText,
        badges,
        rewardBtns
      };
    });
    
    console.log('URL:', info.url);
    console.log('页面文本:', info.text.substring(0, 300));
    console.log('角标元素:', info.badges);
    console.log('奖罚按钮:', info.rewardBtns);
    
    if (info.badges.length > 0) {
      console.log('✅ 发现角标');
    } else {
      console.log('❌ 未发现角标');
    }
    
  } catch (e) {
    console.error('错误:', e.message);
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/error.png' });
  }
  
  await page.close();
  console.log('完成');
}

test();