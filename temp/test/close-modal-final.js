const puppeteer = require('/usr/lib/node_modules/puppeteer');
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages[0];
  
  // 点击确定按钮 (使用正确的类名)
  const clicked = await page.evaluate(() => {
    const confirmBtn = document.querySelector('.uni-modal__btn_primary');
    if (confirmBtn) {
      confirmBtn.click();
      return 'clicked';
    }
    return 'not found';
  });
  
  console.log('点击结果:', clicked);
  await new Promise(r => setTimeout(r, 1000));
  
  // 检查弹窗是否还存在
  const modalVisible = await page.evaluate(() => {
    const modal = document.querySelector('.uni-modal');
    if (!modal) return false;
    const parent = modal.closest('.uni-modal__wrapper, .uni-popup');
    if (parent) {
      return window.getComputedStyle(parent).display !== 'none';
    }
    return true;
  });
  console.log('弹窗可见:', modalVisible);
  
  console.log('当前URL:', page.url());
  const html = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log('页面内容:', html);
  
  await browser.disconnect();
})().catch(console.error);