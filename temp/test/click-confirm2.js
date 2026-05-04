const puppeteer = require('/usr/lib/node_modules/puppeteer');
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages[0];
  
  // 使用 JavaScript 点击确定按钮
  await page.evaluate(() => {
    // 尝试点击 uni-modal 的确定按钮
    const confirmBtn = document.querySelector('.uni-modal-btn-confirm');
    if (confirmBtn) {
      confirmBtn.click();
      return 'clicked .uni-modal-btn-confirm';
    }
    
    // 尝试点击所有 button
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent.includes('确定')) {
        btn.click();
        return 'clicked button with 确定';
      }
    }
    
    return 'no button found';
  });
  
  console.log('尝试点击确定按钮');
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('当前URL:', page.url());
  const html = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log('页面内容:', html);
  
  // 检查弹窗是否还存在
  const modalVisible = await page.evaluate(() => {
    const modal = document.querySelector('.uni-modal');
    return modal && window.getComputedStyle(modal).display !== 'none';
  });
  console.log('弹窗可见:', modalVisible);
  
  await browser.disconnect();
})().catch(console.error);