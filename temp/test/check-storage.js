const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function check() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  const page = pages[pages.length - 1];
  
  const storage = await page.evaluate(() => {
    const keys = ['memberToken', 'memberInfo', 'coachToken', 'coachInfo'];
    const r = {};
    keys.forEach(k => r[k] = localStorage.getItem(k));
    return r;
  });
  
  console.log('Storage:', JSON.stringify(storage, null, 2));
  
  if (storage.memberInfo) {
    const info = JSON.parse(storage.memberInfo);
    console.log('memberInfo 内容:', info);
    
    if (info.error === 'no_member_in_tempLoginData') {
      console.log('⚠️ tempLoginData.value.member 为空！');
    }
  }
  
  browser.disconnect();
}

check();