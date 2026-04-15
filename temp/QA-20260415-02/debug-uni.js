const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const loginResp = await fetch('http://127.0.0.1:8088/api/coach/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId: '99', stageName: '逍遥', idCardLast6: '30782X' })
  });
  const loginData = await loginResp.json();
  const realToken = loginData.token;
  const coach = { coachNo: 10056, employeeId: '99', stageName: '逍遥', shift: '晚班' };
  
  await page.addInitScript(({ coach, token }) => {
    localStorage.setItem('coachToken', token);
    localStorage.setItem('coachInfo', JSON.stringify(coach));
  }, { coach, token: realToken });
  
  await page.goto('http://127.0.0.1:8089/#/pages/internal/clock', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(5000);
  
  // Check what uni object has
  const uniInfo = await page.evaluate(() => {
    if (typeof uni === 'undefined') return { uni: 'undefined' };
    const keys = Object.keys(uni).filter(k => k.includes('Storage') || k.includes('storage') || k.includes('store'));
    return { uni: 'exists', keys };
  });
  console.log('uni info:', JSON.stringify(uniInfo));
  
  // Check all window globals
  const globals = await page.evaluate(() => {
    return Object.keys(window).filter(k => k.startsWith('uni') || k.startsWith('wx') || k === '__uniapp').sort();
  });
  console.log('Globals:', JSON.stringify(globals));
  
  // Check localStorage directly (this should work)
  const lsValues = await page.evaluate(() => ({
    coachToken: localStorage.getItem('coachToken')?.slice(0, 20),
    coachInfo: localStorage.getItem('coachInfo'),
  }));
  console.log('localStorage:', JSON.stringify(lsValues));
  
  // Check the Vue app and its state
  const vueState = await page.evaluate(() => {
    const app = document.querySelector('#app');
    const vueApp = app?.__vue_app__;
    if (!vueApp) return { vue: 'not found' };
    
    // Try to find the component state
    // In Vue 3, the component state is in the app's internal tree
    const internals = vueApp._instance;
    if (!internals) return { vue: 'no instance' };
    
    return { vue: 'found', hasInternals: true };
  });
  console.log('Vue state:', JSON.stringify(vueState));
  
  // Screenshot
  await page.screenshot({ path: '/TG/temp/QA-20260415-02/screenshots/debug-uni.png' });
  
  await browser.close();
})();
