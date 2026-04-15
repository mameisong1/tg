const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  // Get real token
  const loginResp = await fetch('http://127.0.0.1:8088/api/coach/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId: '99', stageName: '逍遥', idCardLast6: '30782X' })
  });
  const loginData = await loginResp.json();
  const realToken = loginData.token;
  const coach = { coachNo: 10056, employeeId: '99', stageName: '逍遥', shift: '晚班' };
  
  // Set BOTH plain localStorage AND uni-prefixed keys
  await page.addInitScript(({ coach, token }) => {
    localStorage.setItem('coachToken', token);
    localStorage.setItem('coachInfo', JSON.stringify(coach));
    // Try uni-prefixed keys
    localStorage.setItem('uni:coachToken', token);
    localStorage.setItem('uni:coachInfo', JSON.stringify(coach));
    localStorage.setItem('uni_coachToken', token);
    localStorage.setItem('uni_coachInfo', JSON.stringify(coach));
  }, { coach, token: realToken });
  
  await page.goto('http://127.0.0.1:8089/#/pages/internal/clock', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(5000);
  
  // Check ALL localStorage keys
  const allKeys = await page.evaluate(() => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      keys.push(localStorage.key(i));
    }
    return keys;
  });
  console.log('All localStorage keys:', JSON.stringify(allKeys));
  
  // Check specific values
  const values = await page.evaluate(() => ({
    coachToken: localStorage.getItem('coachToken'),
    'uni:coachToken': localStorage.getItem('uni:coachToken'),
    'uni_coachToken': localStorage.getItem('uni_coachToken'),
  }));
  console.log('Key values:', JSON.stringify(values));
  
  // Check button state
  const btnCount = await page.locator('.clock-in-btn').count();
  if (btnCount > 0) {
    const classes = await page.locator('.clock-in-btn').first().getAttribute('class');
    console.log('Button disabled:', classes?.includes('disabled'));
  }
  
  // Check status badge
  const badgeCount = await page.locator('.status-badge').count();
  console.log('Status badge count:', badgeCount);
  
  // Take screenshot
  await page.screenshot({ path: '/TG/temp/QA-20260415-02/screenshots/debug-keys.png' });
  
  await browser.close();
})();
