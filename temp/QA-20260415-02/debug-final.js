const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  
  // Get real token first
  const loginResp = await fetch('http://127.0.0.1:8088/api/coach/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId: '99', stageName: '逍遥', idCardLast6: '30782X' })
  });
  const loginData = await loginResp.json();
  const realToken = loginData.token;
  console.log('Token:', realToken.slice(0, 30) + '...');
  
  // Create context with service worker
  const context = await browser.newContext();
  
  // Intercept and modify storage API calls at the network level
  await context.route('**/api/water-boards/**', async (route, request) => {
    const url = request.url();
    console.log('Intercepting:', url);
    
    // Get the real data with proper auth
    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${realToken}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await resp.json();
    console.log('Water board data:', JSON.stringify(data).slice(0, 150));
    
    // Return the data to the browser
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data)
    });
  });
  
  const page = await context.newPage();
  
  // Set localStorage after page starts loading but before Vue renders
  page.on('frameravigated', frame => {
    if (frame === page.mainFrame()) {
      console.log('Frame navigated, setting localStorage...');
      frame.evaluate(({ token }) => {
        localStorage.setItem('coachToken', token);
        localStorage.setItem('coachInfo', JSON.stringify({ 
          coachNo: 10056, 
          employeeId: '99', 
          stageName: '逍遥', 
          shift: '晚班' 
        }));
        console.log('localStorage set in frame');
      }, { token: realToken });
    }
  });
  
  // Alternative: set via addInitScript with proper timing
  await page.addInitScript(({ token }) => {
    // Run immediately when page context is created
    const coach = { coachNo: 10056, employeeId: '99', stageName: '逍遥', shift: '晚班' };
    localStorage.setItem('coachToken', token);
    localStorage.setItem('coachInfo', JSON.stringify(coach));
    console.log('[init] localStorage set');
    
    // Also intercept any getStorageSync calls by monkeypatching
    const originalGetItem = localStorage.getItem.bind(localStorage);
    localStorage.getItem = function(key) {
      const result = originalGetItem(key);
      console.log('[intercept] getItem(', key, ') =', result ? result.slice(0, 50) : 'null');
      return result;
    };
  }, { token: realToken });
  
  // Navigate
  console.log('Navigating to clock page...');
  await page.goto('http://127.0.0.1:8089/#/pages/internal/clock', { waitUntil: 'commit', timeout: 15000 });
  
  // Wait for Vue to render
  await page.waitForTimeout(5000);
  
  // Check console logs
  const logs = await page.evaluate(() => {
    // Return localStorage state
    return {
      coachToken: localStorage.getItem('coachToken')?.slice(0, 30),
      coachInfo: localStorage.getItem('coachInfo'),
      allKeys: Object.keys(localStorage).filter(k => k.startsWith('coach') || k.startsWith('uni'))
    };
  });
  console.log('Final localStorage:', JSON.stringify(logs));
  
  // Check UI
  const badgeCount = await page.locator('.status-badge').count();
  console.log('Status badge count:', badgeCount);
  
  const coachInfoSection = await page.locator('.coach-info-section').count();
  console.log('Coach info section count:', coachInfoSection);
  
  if (coachInfoSection > 0) {
    const coachInfoText = await page.locator('.coach-info-section').textContent();
    console.log('Coach info text:', coachInfoText);
  }
  
  const btnCount = await page.locator('.clock-in-btn').count();
  if (btnCount > 0) {
    const classes = await page.locator('.clock-in-btn').first().getAttribute('class');
    const text = await page.locator('.clock-in-btn').first().textContent();
    console.log('Button:', { text, classes, disabled: classes?.includes('disabled') });
  }
  
  const pageText = await page.locator('.page').textContent();
  console.log('Page contains coach name:', pageText.includes('逍遥'));
  console.log('Page contains employee ID:', pageText.includes('99'));
  console.log('Page contains 乐捐:', pageText.includes('乐捐'));
  console.log('Page text sample:', pageText.slice(0, 400));
  
  await page.screenshot({ path: '/TG/temp/QA-20260415-02/screenshots/debug-final.png', fullPage: true });
  
  await browser.close();
})();