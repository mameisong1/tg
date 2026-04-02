/**
 * 关闭台客多标签页
 */

const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();
  
  let closed = 0;
  for (const page of pages) {
    if (page.url().includes('taikeduo.com')) {
      await page.close();
      closed++;
      console.log('已关闭台客多标签页');
    }
  }
  
  if (closed === 0) {
    console.log('没有找到台客多标签页');
  }
  
  await browser.close();
}

main();