const puppeteer = require('/usr/lib/node_modules/puppeteer');
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages[0];
  
  // 点击确定按钮
  let confirmBtn = await page.$('.uni-modal-btn-confirm');
  if (confirmBtn) {
    await confirmBtn.click();
    console.log('点击确定按钮');
    await new Promise(r => setTimeout(r, 1000));
  } else {
    // 尝试其他选择器
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent);
      console.log('按钮:', text);
      if (text.includes('确定')) {
        await btn.click();
        console.log('点击确定按钮（button）');
        break;
      }
    }
  }
  
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('当前URL:', page.url());
  const html = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log('页面内容:', html);
  
  await browser.disconnect();
})().catch(console.error);