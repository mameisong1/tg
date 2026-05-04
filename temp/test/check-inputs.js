const puppeteer = require('/usr/lib/node_modules/puppeteer');
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages[0];
  
  // 获取所有输入框
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(el => ({
      type: el.type,
      placeholder: el.placeholder,
      name: el.name,
      id: el.id,
      class: el.className,
      maxlength: el.maxlength,
      value: el.value
    }));
  });
  
  console.log('所有输入框:');
  console.log(JSON.stringify(inputs, null, 2));
  
  // 获取所有可能的按钮
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, .btn, [class*="btn"], [class*="button"]')).map(el => ({
      tag: el.tagName,
      class: el.className,
      text: el.textContent.substring(0, 30).trim()
    }));
  });
  
  console.log('\n所有按钮:');
  console.log(JSON.stringify(buttons, null, 2));
  
  await browser.disconnect();
})().catch(console.error);