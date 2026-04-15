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
  console.log('Real token:', realToken.slice(0, 20) + '...');
  
  const coach = { coachNo: 10056, employeeId: '99', stageName: '逍遥', shift: '晚班' };
  
  await page.addInitScript(({ coach, token }) => {
    localStorage.setItem('coachToken', token);
    localStorage.setItem('coachInfo', JSON.stringify(coach));
  }, { coach, token: realToken });
  
  await page.goto('http://127.0.0.1:8089/#/pages/internal/clock', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(5000);
  
  // Check localStorage
  const storage = await page.evaluate(() => ({
    coachToken: localStorage.getItem('coachToken'),
    coachInfo: localStorage.getItem('coachInfo'),
  }));
  console.log('localStorage coachToken:', storage.coachToken ? 'set (' + storage.coachToken.slice(0, 20) + '...)' : 'NOT SET');
  console.log('localStorage coachInfo:', storage.coachInfo ? 'set' : 'NOT SET');
  
  // Check API result from within page
  const apiResult = await page.evaluate(async () => {
    const token = localStorage.getItem('coachToken');
    try {
      const resp = await fetch('http://127.0.0.1:8088/api/water-boards/10056', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await resp.json();
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('API result from page:', JSON.stringify(apiResult).slice(0, 200));
  
  // Check UI
  const badgeCount = await page.locator('.status-badge').count();
  console.log('Status badge count:', badgeCount);
  if (badgeCount > 0) {
    console.log('Badge text:', await page.locator('.status-badge').textContent());
  } else {
    const pageText = await page.locator('.page').textContent();
    console.log('Page text includes 乐捐:', pageText.includes('乐捐'));
    console.log('Page text includes 上班:', pageText.includes('上班'));
    console.log('Page text (first 300):', pageText.slice(0, 300));
  }
  
  const btnCount = await page.locator('.clock-in-btn').count();
  console.log('Clock-in button count:', btnCount);
  if (btnCount > 0) {
    const classes = await page.locator('.clock-in-btn').first().getAttribute('class');
    console.log('Button classes:', classes);
    console.log('Button disabled:', classes?.includes('disabled'));
  }
  
  await page.screenshot({ path: '/TG/temp/QA-20260415-02/screenshots/debug-clock.png' });
  console.log('Screenshot saved');
  
  await browser.close();
})();
