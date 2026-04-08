// Quick screenshot capture script
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = (await browser.contexts())[0].pages()[0];
  
  // Current page is the waiter rejection page
  await page.screenshot({
    path: '/TG/docs/temp/screenshots/TC-v3-服务员-拒绝登录.png',
    fullPage: false
  });
  console.log('✅ Saved: TC-v3-服务员-拒绝登录.png');
  
  await browser.close();
}

main().catch(console.error);
