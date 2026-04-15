const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  await page.addInitScript(() => {
    localStorage.setItem('coachToken', 'TEST_TOKEN_123');
    localStorage.setItem('coachInfo', JSON.stringify({ coachNo: 10056, employeeId: '99', stageName: '逍遥' }));
  });
  
  await page.goto('http://127.0.0.1:8089/#/pages/internal/clock', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  
  const storage = await page.evaluate(() => ({
    coachToken: localStorage.getItem('coachToken'),
    coachInfo: localStorage.getItem('coachInfo'),
  }));
  console.log('localStorage:', JSON.stringify(storage));
  
  const apiResult = await page.evaluate(async () => {
    const token = localStorage.getItem('coachToken');
    const resp = await fetch('http://127.0.0.1:8088/api/water-boards/10056', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return await resp.json();
  });
  console.log('API result:', JSON.stringify(apiResult).slice(0, 200));
  
  const badgeCount = await page.locator('.status-badge').count();
  console.log('Status badge count:', badgeCount);
  if (badgeCount > 0) {
    console.log('Badge text:', await page.locator('.status-badge').textContent());
  }
  
  const btnCount = await page.locator('.clock-in-btn').count();
  console.log('Clock-in button count:', btnCount);
  if (btnCount > 0) {
    console.log('Button classes:', await page.locator('.clock-in-btn').first().getAttribute('class'));
    console.log('Button text:', await page.locator('.clock-in-btn').first().textContent());
  }
  
  await browser.close();
})();
