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
  
  // 检查输入框结构
  const inputInfo = await page.evaluate(() => {
    const inputs = document.querySelectorAll('.h5-form-input');
    const result = [];
    inputs.forEach((input, i) => {
      result.push({
        index: i,
        tagName: input.tagName,
        type: input.type,
        isUniInput: input.tagName === 'UNI-INPUT',
        outerHTML: input.outerHTML.substring(0, 200),
        // 检查内部是否有原生 input
        hasNativeInput: input.querySelector('input') !== null,
        nativeInputValue: input.querySelector('input')?.value
      });
    });
    return result;
  });
  
  console.log('输入框结构:', JSON.stringify(inputInfo, null, 2));
  
  browser.disconnect();
}

debug();