const puppeteer = require('/usr/lib/node_modules/puppeteer');

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages[pages.length - 1];
  const debug = await page.evaluate(() => localStorage.getItem('debug_selectRole'));
  console.log('debug_selectRole:', debug);
  
  const storage = await page.evaluate(() => ({
    memberToken: localStorage.getItem('memberToken'),
    memberInfo: localStorage.getItem('memberInfo'),
    coachToken: localStorage.getItem('coachToken'),
    debug_selectRole: localStorage.getItem('debug_selectRole')
  }));
  console.log('Storage:', JSON.stringify(storage, null, 2));
  
  browser.disconnect();
})();