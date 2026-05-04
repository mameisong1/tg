const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function debug() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  let page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
  
  // 先退出登录清空状态
  await page.evaluate(() => localStorage.clear());
  
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 10000));
  
  // 监听所有 console
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  
  // 检查 uni-input 组件的事件监听器
  const listenersInfo = await page.evaluate(() => {
    const uniInput = document.querySelectorAll('.h5-form-input')[0];
    const nativeInput = uniInput?.querySelector('input');
    
    // 检查 uni-input 上的事件监听
    const uniListeners = typeof getEventListeners === 'function' ? getEventListeners(uniInput) : 'getEventListeners not available';
    
    // 检查原生 input 上的事件监听
    const nativeListeners = typeof getEventListeners === 'function' ? getEventListeners(nativeInput) : 'getEventListeners not available';
    
    // 检查 Vue 实例
    const vueInstance = uniInput?.__vueParentComponent;
    
    return {
      uniInputTag: uniInput?.tagName,
      nativeInputTag: nativeInput?.tagName,
      nativeInputType: nativeInput?.type,
      nativeListeners: nativeListeners,
      uniListeners: uniListeners,
      hasVueInstance: !!vueInstance,
      vueProps: vueInstance?.props ? Object.keys(vueInstance.props) : []
    };
  });
  
  console.log('事件监听器信息:', JSON.stringify(listenersInfo, null, 2));
  
  // 尝试多种输入方式
  console.log('\n=== 方式1: focus + keyboard.type ===');
  const nativeInput1 = await page.$('.h5-form-input input');
  await nativeInput1.focus();
  await page.keyboard.type('18600000004', { delay: 50 });
  await new Promise(r => setTimeout(r, 500));
  
  const result1 = await page.evaluate(() => ({
    nativeValue: document.querySelectorAll('.h5-form-input')[0]?.querySelector('input')?.value,
    smsPhoneVue: '无法直接访问'
  }));
  console.log('方式1 结果:', result1);
  
  // 清空输入
  await page.evaluate(() => {
    const ni = document.querySelectorAll('.h5-form-input')[0]?.querySelector('input');
    if (ni) ni.value = '';
  });
  
  // 方式2: 用 evaluate 设置 value 并触发各种事件
  console.log('\n=== 方式2: evaluate + 触发 input/change/compositionend 事件 ===');
  await page.evaluate(() => {
    const nativeInput = document.querySelectorAll('.h5-form-input')[0]?.querySelector('input');
    nativeInput.value = '18600000004';
    nativeInput.dispatchEvent(new Event('input', { bubbles: true }));
    nativeInput.dispatchEvent(new Event('change', { bubbles: true }));
    // 触发 compositionend 事件（中文输入法完成）
    nativeInput.dispatchEvent(new CompositionEvent('compositionend', { data: '18600000004', bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 500));
  
  const result2 = await page.evaluate(() => ({
    nativeValue: document.querySelectorAll('.h5-form-input')[0]?.querySelector('input')?.value,
  }));
  console.log('方式2 结果:', result2);
  
  // 方式3: 直接访问 Vue 组件实例
  console.log('\n=== 方式3: 通过 Vue 组件实例设置值 ===');
  const result3 = await page.evaluate(() => {
    const uniInput = document.querySelectorAll('.h5-form-input')[0];
    // 查找 Vue 3 组件实例
    const vnode = uniInput?.__vueParentComponent;
    if (vnode) {
      console.log('找到 Vue 实例, props:', Object.keys(vnode.props || {}));
      console.log('modelValue:', vnode.props?.modelValue);
      
      // 查找父组件（member.vue 页面组件）
      const parentVnode = vnode.parent;
      if (parentVnode) {
        console.log('父组件 setupState keys:', Object.keys(parentVnode.setupState || {}));
        const smsPhone = parentVnode.setupState?.smsPhone;
        console.log('smsPhone.value:', smsPhone?.value);
        
        // 直接设置 smsPhone
        if (smsPhone) {
          smsPhone.value = '18600000004';
          console.log('smsPhone.value 已设置为:', smsPhone.value);
        }
      }
    }
    return { foundVue: !!vnode };
  });
  console.log('方式3 结果:', result3);
  
  // 检查设置后原生 input 的值是否同步
  await new Promise(r => setTimeout(r, 500));
  const syncCheck = await page.evaluate(() => ({
    nativeValue: document.querySelectorAll('.h5-form-input')[0]?.querySelector('input')?.value,
  }));
  console.log('设置后同步检查:', syncCheck);
  
  browser.disconnect();
}

debug();