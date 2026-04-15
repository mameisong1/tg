const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  
  const loginResp = await fetch('http://127.0.0.1:8088/api/coach/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId: '99', stageName: '逍遥', idCardLast6: '30782X' })
  });
  const loginData = await loginResp.json();
  const realToken = loginData.token;
  console.log('Token obtained:', realToken.slice(0, 30) + '...');
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Intercept the storage REMOVE calls
  await page.addInitScript(({ token }) => {
    const coach = { coachNo: 10056, employeeId: '99', stageName: '逍遥', shift: '晚班' };
    
    // Set storage
    localStorage.setItem('coachToken', token);
    localStorage.setItem('coachInfo', JSON.stringify(coach));
    console.log('[INIT] Storage set');
    
    // Intercept removeItem to prevent auth code from clearing our values
    const originalRemove = localStorage.removeItem.bind(localStorage);
    localStorage.removeItem = function(key) {
      if (key === 'coachToken' || key === 'coachInfo') {
        console.log('[BLOCK] Prevented removal of', key);
        // Don't remove - just return
        return;
      }
      return originalRemove(key);
    };
    
    // Also intercept setItem to log
    const originalSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
      console.log('[SET]', key, '=', value ? value.slice(0, 50) : 'null');
      return originalSet(key, value);
    };
    
    // Intercept getItem to log
    const originalGet = localStorage.getItem.bind(localStorage);
    localStorage.getItem = function(key) {
      const result = originalGet(key);
      console.log('[GET]', key, '=', result ? result.slice(0, 50) : 'null');
      return result;
    };
    
    console.log('[INIT] Storage interception installed');
  }, { token: realToken });
  
  // Intercept API calls
  await context.route('**/api/water-boards/**', async (route, request) => {
    const url = request.url();
    console.log('[ROUTE] Intercepting water-boards:', url);
    
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${realToken}` }
    });
    const data = await resp.json();
    console.log('[ROUTE] Data:', JSON.stringify(data.data).slice(0, 100));
    
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data)
    });
  });
  
  console.log('Navigating...');
  await page.goto('http://127.0.0.1:8089/#/pages/internal/clock', { waitUntil: 'commit' });
  await page.waitForTimeout(5000);
  
  // Get console logs from browser
  const browserLogs = [];
  page.on('console', msg => {
    browserLogs.push(msg.text());
  });
  
  // Reload to trigger onShow
  await page.reload({ waitUntil: 'commit' });
  await page.waitForTimeout(5000);
  
  console.log('Browser console logs:');
  for (const log of browserLogs) {
    console.log('  ', log);
  }
  
  // Check final state
  const ls = await page.evaluate(() => ({
    coachToken: localStorage.getItem('coachToken')?.slice(0, 30),
    coachInfo: localStorage.getItem('coachInfo')
  }));
  console.log('Final localStorage:', JSON.stringify(ls));
  
  // Check UI
  const coachInfoSection = await page.locator('.coach-info-section').textContent();
  console.log('Coach info section:', coachInfoSection);
  
  const statusBadge = await page.locator('.status-badge').count();
  console.log('Status badge count:', statusBadge);
  
  if (statusBadge > 0) {
    const badgeText = await page.locator('.status-badge').textContent();
    console.log('Status badge:', badgeText);
  }
  
  const btnClasses = await page.locator('.clock-in-btn').first().getAttribute('class');
  console.log('Button disabled:', btnClasses?.includes('disabled'));
  
  await page.screenshot({ path: '/TG/temp/QA-20260415-02/screenshots/debug-block.png' });
  
  await browser.close();
})();