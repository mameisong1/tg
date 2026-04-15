const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8089/#/pages/internal/clock', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  
  const allKeys = await page.evaluate(() => Object.keys(uni).sort());
  console.log('All uni keys:', JSON.stringify(allKeys));
  
  // Try to call getStorageSync
  try {
    const result = await page.evaluate(() => uni.getStorageSync('coachToken'));
    console.log('getStorageSync result:', result);
  } catch (e) {
    console.log('getStorageSync error:', e.message);
  }
  
  // Try alternative: maybe it's under a different name
  const tryKeys = allKeys.filter(k => k.toLowerCase().includes('storage') || k.toLowerCase().includes('store'));
  console.log('Storage-like keys:', JSON.stringify(tryKeys));
  
  await browser.close();
})();
