const puppeteer = require('/usr/lib/node_modules/puppeteer');
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages[0];
  
  // 先尝试点击取消按钮关闭弹窗
  let cancelBtn = await page.$('.uni-modal-btn-cancel');
  if (cancelBtn) {
    await cancelBtn.click();
    console.log('点击取消按钮关闭弹窗');
    await new Promise(r => setTimeout(r, 500));
  }
  
  // 如果还有弹窗，尝试点击确定
  let confirmBtn = await page.$('.uni-modal-btn-confirm');
  if (confirmBtn) {
    await confirmBtn.click();
    console.log('点击确定按钮');
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // 清空 Storage
  const STORAGE_KEYS = [
    'memberToken', 'memberInfo', 'coachToken', 'coachInfo',
    'adminToken', 'adminInfo', 'preferredRole', 'sessionId',
    'tablePinyin', 'tableName', 'tableAuth', 'highlightProduct'
  ];
  await page.evaluate((keys) => keys.forEach(k => localStorage.removeItem(k)), STORAGE_KEYS);
  console.log('已清空 Storage');
  
  // 导航到登录页面
  await page.goto('https://tg.tiangong.club/#/pages/member/member', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('当前URL:', page.url());
  const html = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('页面内容:', html);
  
  await browser.disconnect();
})().catch(console.error);