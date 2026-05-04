const puppeteer = require('/usr/lib/node_modules/puppeteer');
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages[0];
  
  // 获取弹窗的 HTML 结构
  const modalHtml = await page.evaluate(() => {
    // 检查所有可能的弹窗元素
    const uniModal = document.querySelector('.uni-modal');
    const uniPopup = document.querySelector('.uni-popup');
    const modal = document.querySelector('[role="dialog"]');
    const allModals = document.querySelectorAll('[class*="modal"], [class*="popup"], [class*="dialog"]');
    
    return {
      uniModal: uniModal ? uniModal.outerHTML.substring(0, 500) : null,
      uniPopup: uniPopup ? uniPopup.outerHTML.substring(0, 500) : null,
      modal: modal ? modal.outerHTML.substring(0, 500) : null,
      allModalsCount: allModals.length,
      allModalsClasses: Array.from(allModals).map(el => el.className)
    };
  });
  
  console.log('弹窗结构:');
  console.log(JSON.stringify(modalHtml, null, 2));
  
  // 获取所有按钮
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, [role="button"], .btn')).map(el => ({
      tag: el.tagName,
      class: el.className,
      text: el.textContent.substring(0, 50)
    }));
  });
  
  console.log('\n所有按钮:');
  console.log(JSON.stringify(buttons, null, 2));
  
  await browser.disconnect();
})().catch(console.error);