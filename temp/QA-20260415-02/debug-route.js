const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  
  // Intercept requests to set auth header
  await context.route('**/api/**', async (route, request) => {
    const url = request.url();
    // Add authorization header to API requests
    const headers = { ...request.headers() };
    
    // For coach API calls, we need the token
    // This is a read-only interception - we just let the request through
    // The auth token should come from localStorage
    route.continue({ headers });
  });
  
  const page = await context.newPage();
  
  // Get real token
  const loginResp = await fetch('http://127.0.0.1:8088/api/coach/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId: '99', stageName: '逍遥', idCardLast6: '30782X' })
  });
  const loginData = await loginResp.json();
  const realToken = loginData.token;
  const coach = { coachNo: 10056, employeeId: '99', stageName: '逍遥', shift: '晚班' };
  
  // Set localStorage BEFORE page loads
  await page.addInitScript(({ coach, token }) => {
    localStorage.setItem('coachToken', token);
    localStorage.setItem('coachInfo', JSON.stringify(coach));
    // Also set window.__coachToken for debugging
    window.__coachToken = token;
    window.__coachInfo = coach;
  }, { coach, token: realToken });
  
  // Navigate to the page
  await page.goto('http://127.0.0.1:8089/#/pages/internal/clock', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  // Check what API requests were made
  const requests = [];
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      requests.push({
        url: req.url(),
        method: req.method(),
        headers: req.headers()
      });
    }
  });
  
  // Reload to capture requests
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  console.log('API requests made:', requests.length);
  for (const req of requests) {
    console.log(`  ${req.method} ${req.url}`);
    console.log(`    Auth header: ${req.headers['authorization'] ? 'present' : 'MISSING'}`);
  }
  
  // Check UI state
  const badgeCount = await page.locator('.status-badge').count();
  console.log('Status badge count:', badgeCount);
  
  const btnCount = await page.locator('.clock-in-btn').count();
  if (btnCount > 0) {
    const classes = await page.locator('.clock-in-btn').first().getAttribute('class');
    console.log('Button disabled:', classes?.includes('disabled'));
  }
  
  const pageText = await page.locator('.page').textContent();
  console.log('Page text includes 乐捐:', pageText.includes('乐捐'));
  console.log('Page text includes 逍遥:', pageText.includes('逍遥'));
  console.log('Page text includes 晚班:', pageText.includes('晚班'));
  console.log('Page text (first 500):', pageText.slice(0, 500));
  
  await page.screenshot({ path: '/TG/temp/QA-20260415-02/screenshots/debug-route.png', fullPage: true });
  
  await browser.close();
})();
