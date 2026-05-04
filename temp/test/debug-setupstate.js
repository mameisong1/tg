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
  
  // 调用 onUpdate:modelValue 并验证 smsPhone.value 是否更新
  const result = await page.evaluate(() => {
    const phoneUniInput = document.querySelectorAll('.h5-form-input')[0];
    const phoneVueComp = phoneUniInput.__vueParentComponent;
    const phoneOnUpdate = phoneVueComp?.vnode?.props?.['onUpdate:modelValue'];
    
    // 调用 onUpdate:modelValue
    if (phoneOnUpdate) {
      phoneOnUpdate('18600000004');
      console.log('phoneOnUpdate 已调用');
    }
    
    // 检查 smsPhone.value 是否更新
    // 通过 accessCache 查找 smsPhone 的存储位置
    // accessCache.smsPhone = 0 表示在 setupState 中
    
    // 尝试在 memberComp 的 ctx 和 setupState 中查找
    const memberComp = phoneVueComp?.parent;
    if (!memberComp) {
      console.log('memberComp not found');
      return { error: 'memberComp not found' };
    }
    
    console.log('memberComp type:', memberComp.type?.name || memberComp.type?.__name);
    
    // 检查 memberComp.setupState
    const setupState = memberComp.setupState;
    console.log('setupState:', setupState);
    console.log('setupState keys:', Object.keys(setupState || {}));
    
    // 检查 smsPhone 是否在 setupState 中
    // Vue 3 Composition API: ref() 返回值存储在 setupState 中
    // 但 setupState 可能是一个 reactive proxy，Object.keys 可能返回空
    // 让我尝试直接访问 setupState.smsPhone
    if (setupState) {
      console.log('setupState.smsPhone:', setupState.smsPhone);
      console.log('setupState.smsPhone value:', setupState.smsPhone?.value);
      console.log('setupState.smsCode:', setupState.smsCode);
      console.log('setupState.agreed:', setupState.agreed);
      
      // 尝试直接在 setupState 上查找所有 ref
      for (const key of Object.getOwnPropertyNames(setupState)) {
        const val = setupState[key];
        if (val && typeof val === 'object' && val.__v_isRef) {
          console.log(`ref: ${key} = ${val.value}`);
        }
      }
    }
    
    return { done: true };
  });
  
  console.log('结果:', result);
  
  browser.disconnect();
}

debug();