const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function test() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  let page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
  
  // 等一下让页面稳定
  await new Promise(r => setTimeout(r, 2000));
  
  await page.screenshot({ path: '/TG/temp/test/current-state.png' });
  
  // 查找身份选择相关元素
  console.log('查找身份选择元素...');
  
  // 查找包含"助教"文本的元素
  const allElements = await page.$$('div, button, view, text');
  for (const el of allElements) {
    try {
      const text = await el.evaluate(e => e.innerText || e.textContent);
      if (text && text.includes('助教身份')) {
        console.log('找到助教身份元素:', text.substring(0, 50));
        await el.click();
        console.log('点击助教身份');
        await new Promise(r => setTimeout(r, 3000));
        break;
      }
    } catch {}
  }
  
  await page.screenshot({ path: '/TG/temp/test/after-click-coach.png' });
  
  console.log('检查 Storage');
  const storage = await page.evaluate(() => {
    const keys = ['memberToken', 'memberInfo', 'coachToken', 'coachInfo'];
    const r = {};
    keys.forEach(k => r[k] = localStorage.getItem(k));
    return r;
  });
  console.log('Storage:', JSON.stringify(storage, null, 2));
  
  browser.disconnect();
}

test().catch(e => console.error('错误:', e));