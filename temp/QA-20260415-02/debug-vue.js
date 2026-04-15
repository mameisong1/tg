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
  
  // Check Vue component state
  const vueState = await page.evaluate(() => {
    // Try to access the Vue app instance
    const app = document.querySelector('#app');
    if (!app) return { app: 'not found' };
    
    // Try __VUE_DEVTOOLS_GLOBAL_HOOK__ or window.__vue_app__
    const vueApp = window.__vue_app__ || app.__vue_app__;
    if (!vueApp) return { app: 'no vue app found' };
    
    return { app: 'found', hasGlobal: !!window.__VUE_DEVTOOLS_GLOBAL_HOOK__ };
  });
  console.log('Vue state:', JSON.stringify(vueState));
  
  // Check what uni.getStorageSync returns
  const uniValues = await page.evaluate(() => {
    // uni is a global object in uni-app H5
    if (typeof uni !== 'undefined') {
      return {
        coachToken: uni.getStorageSync('coachToken'),
        coachInfo: uni.getStorageSync('coachInfo'),
        uniExists: true
      };
    }
    return { uniExists: false };
  });
  console.log('uni.getStorageSync:', JSON.stringify(uniValues));
  
  // Try to call loadWaterBoard manually
  const manualCall = await page.evaluate(async () => {
    const token = localStorage.getItem('coachToken');
    const coachInfo = JSON.parse(localStorage.getItem('coachInfo') || '{}');
    console.log('Manual call - token:', token ? token.slice(0, 20) : 'none');
    console.log('Manual call - coachNo:', coachInfo.coachNo);
    
    try {
      const resp = await fetch(`http://127.0.0.1:8088/api/water-boards/${coachInfo.coachNo}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await resp.json();
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('Manual API call:', JSON.stringify(manualCall).slice(0, 200));
  
  // Screenshot
  await page.screenshot({ path: '/TG/temp/QA-20260415-02/screenshots/debug-vue.png' });
  console.log('Screenshot saved');
  
  await browser.close();
})();
