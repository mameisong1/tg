const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  let page = pages.find(p => p.url().includes('127.0.0.1:8089'));
  
  if (!page) {
    page = await browser.newPage();
    await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle0' });
  }
  
  await new Promise(r => setTimeout(r, 2000));
  
  // 截图
  await page.screenshot({ path: '/tmp/page-state.png', fullPage: false });
  console.log('截图保存到 /tmp/page-state.png');
  
  // 打印页面 HTML 结构
  const html = await page.evaluate(() => {
    return document.body.innerHTML.substring(0, 2000);
  });
  console.log('\n页面 HTML:');
  console.log(html);
  
  // 查找登录相关元素
  const elements = await page.evaluate(() => {
    const result = [];
    const selectors = ['.h5-login-card', '.h5-login-btn', '.h5-form-input', '.login-section', '.member-section'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        result.push({ selector: sel, found: true, visible: el.offsetParent !== null });
      } else {
        result.push({ selector: sel, found: false });
      }
    }
    return result;
  });
  
  console.log('\n元素检查:');
  for (const el of elements) {
    console.log(`  ${el.selector}: found=${el.found}, visible=${el.visible}`);
  }
}

main();