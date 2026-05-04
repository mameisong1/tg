const puppeteer = require('/usr/lib/node_modules/puppeteer');
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages[0];
  
  // 使用各种方式触发点击
  const result = await page.evaluate(() => {
    // 1. 找到确定按钮
    const confirmBtn = document.querySelector('.uni-modal-btn-confirm');
    if (!confirmBtn) return 'button not found';
    
    // 2. 尝试多种点击方式
    // 方式1: 原生 click
    confirmBtn.click();
    
    // 方式2: dispatchEvent
    confirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    
    // 方式3: 触摸事件 (uni-app 可能用的是触摸事件)
    confirmBtn.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
    confirmBtn.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    
    // 方式4: 触发 tap 事件
    confirmBtn.dispatchEvent(new Event('tap', { bubbles: true }));
    
    return 'clicked with multiple methods';
  });
  
  console.log('结果:', result);
  await new Promise(r => setTimeout(r, 1000));
  
  // 检查弹窗是否还存在
  const modalVisible = await page.evaluate(() => {
    const modal = document.querySelector('.uni-modal');
    return modal && window.getComputedStyle(modal).display !== 'none';
  });
  console.log('弹窗可见:', modalVisible);
  
  // 如果弹窗还在，尝试点击取消按钮
  if (modalVisible) {
    await page.evaluate(() => {
      const cancelBtn = document.querySelector('.uni-modal-btn-cancel');
      if (cancelBtn) {
        cancelBtn.click();
        cancelBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        cancelBtn.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
        cancelBtn.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 500));
    console.log('尝试点击取消按钮');
  }
  
  console.log('当前URL:', page.url());
  const html = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log('页面内容:', html);
  
  await browser.disconnect();
})().catch(console.error);