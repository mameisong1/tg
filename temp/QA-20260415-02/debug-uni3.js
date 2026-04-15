const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8089/#/pages/internal/clock', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  
  const uniInfo = await page.evaluate(() => {
    if (typeof uni === 'undefined') return 'undefined';
    if (uni === null) return 'null';
    return {
      type: typeof uni,
      toString: uni.toString(),
      constructor: uni.constructor?.name,
      prototype: Object.prototype.toString.call(uni)
    };
  });
  console.log('uni info:', JSON.stringify(uniInfo));
  
  // Check __uniConfig or other uni-app globals
  const uniGlobals = await page.evaluate(() => ({
    __uniConfig: typeof __uniConfig !== 'undefined' ? 'exists' : 'undefined',
    __uniRoutes: typeof __uniRoutes !== 'undefined' ? 'exists' : 'undefined',
    UniServiceJSBridge: typeof UniServiceJSBridge !== 'undefined' ? 'exists' : 'undefined',
  }));
  console.log('uni globals:', JSON.stringify(uniGlobals));
  
  // Check localStorage directly
  const lsCheck = await page.evaluate(() => {
    localStorage.setItem('testKey', 'testValue');
    return localStorage.getItem('testKey');
  });
  console.log('localStorage test:', lsCheck);
  
  await browser.close();
})();
