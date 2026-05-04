const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function debug() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  let page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
  
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 10000));
  
  // 检查协议区域结构
  const agreementInfo = await page.evaluate(() => {
    const agreement = document.querySelector('.h5-agreement');
    return {
      outerHTML: agreement?.outerHTML,
      checkboxHTML: agreement?.querySelector('.checkbox')?.outerHTML,
      textHTML: agreement?.querySelector('.agreement-text')?.outerHTML,
      allElements: agreement?.innerHTML
    };
  });
  
  console.log('协议区域结构:');
  console.log(agreementInfo.outerHTML);
  
  browser.disconnect();
}

debug();