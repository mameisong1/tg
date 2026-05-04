const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function debug() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  let page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
  
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 10000));
  
  page.on('console', msg => console.log('CONSOLE:', msg.text().substring(0, 300)));
  
  // 先调用 onUpdate:modelValue，然后遍历所有 Vue 组件找 smsPhone
  const result = await page.evaluate(() => {
    // 先调用 onUpdate:modelValue 设置值
    const phoneUniInput = document.querySelectorAll('.h5-form-input')[0];
    const phoneVueComp = phoneUniInput.__vueParentComponent;
    phoneVueComp?.vnode?.props?.['onUpdate:modelValue']?.('18600000004');
    
    const codeUniInput = document.querySelectorAll('.h5-form-input')[1];
    const codeVueComp = codeUniInput.__vueParentComponent;
    codeVueComp?.vnode?.props?.['onUpdate:modelValue']?.('888888');
    
    // 遍历所有 Vue 组件，找到 smsPhone.value 不为空的组件
    let current = phoneVueComp;
    const path = [];
    for (let i = 0; i < 30; i++) {
      if (!current) break;
      
      const name = current.type?.name || current.type?.__name || current.type?.__file?.split('/').pop()?.replace('.vue', '') || 'unknown';
      const setupStateKeys = Object.keys(current.setupState || {});
      const smsPhone = current.setupState?.smsPhone;
      const smsPhoneValue = smsPhone?.value ?? smsPhone;
      const smsCode = current.setupState?.smsCode;
      const smsCodeValue = smsCode?.value ?? smsCode;
      const agreed = current.setupState?.agreed;
      const agreedValue = agreed?.value ?? agreed;
      
      path.push({
        depth: i,
        name,
        setupStateKeysCount: setupStateKeys.length,
        smsPhoneValue,
        smsCodeValue,
        agreedValue
      });
      
      current = current.parent;
    }
    
    return { path };
  });
  
  console.log('Vue 组件遍历:', JSON.stringify(result, null, 2));
  
  browser.disconnect();
}

debug();