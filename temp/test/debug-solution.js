const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function debug() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  let page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
  
  // 清空 Storage
  await page.evaluate(() => localStorage.clear());
  
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 10000));
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('smsPhone') || text.includes('smsCode') || text.includes('input') || text.includes('modelValue')) {
      console.log('CONSOLE:', text.substring(0, 200));
    }
  });
  
  // 尝试多种方式触发 Vue 响应式更新
  
  // 方式1: 在 uni-input 组件上触发事件（而不是内部原生 input）
  console.log('\n=== 方式1: 在 uni-input 上触发 input 事件 ===');
  const result1 = await page.evaluate(() => {
    const uniInput = document.querySelectorAll('.h5-form-input')[0];
    const nativeInput = uniInput.querySelector('input');
    
    // 先设置原生 input 的值
    nativeInput.value = '18600000004';
    
    // 在原生 input 上触发 input 事件（bubbles: true 让事件冒泡到 uni-input）
    nativeInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    
    // 在 uni-input 上也触发事件
    uniInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    
    return {
      nativeValue: nativeInput.value,
      uniInputHasVue: !!uniInput.__vueParentComponent
    };
  });
  console.log('方式1:', result1);
  
  // 方式2: 通过 Vue 组件实例的 emit 方法触发更新
  console.log('\n=== 方式2: 通过 Vue emit 触发 update:modelValue ===');
  const result2 = await page.evaluate(() => {
    const uniInput = document.querySelectorAll('.h5-form-input')[0];
    const nativeInput = uniInput.querySelector('input');
    const vueComp = uniInput.__vueParentComponent;
    
    // 设置原生 input 的值
    nativeInput.value = '18600000004';
    
    // 通过 Vue emit 触发 update:modelValue
    if (vueComp) {
      vueComp.emit('update:modelValue', '18600000004');
      console.log('emit update:modelValue 已触发');
    }
    
    return {
      nativeValue: nativeInput.value,
      hasVueComp: !!vueComp
    };
  });
  console.log('方式2:', result2);
  
  // 方式3: 通过 CDP (Chrome DevTools Protocol) 的 Input.dispatchKeyEvent 模拟真实键盘输入
  console.log('\n=== 方式3: CDP dispatchKeyEvent ===');
  
  // 先清空
  await page.evaluate(() => {
    document.querySelectorAll('.h5-form-input')[0].querySelector('input').value = '';
  });
  
  // focus 到原生 input
  const nativeInput = await page.$('.h5-form-input input');
  await nativeInput.focus();
  await new Promise(r => setTimeout(r, 200));
  
  // 用 CDP 方式逐键输入
  const phone = '18600000004';
  for (const char of phone) {
    await page.evaluate((c) => {
      const input = document.querySelectorAll('.h5-form-input')[0].querySelector('input');
      // 使用 InputEvent（更真实）
      input.dispatchEvent(new InputEvent('beforeinput', { data: c, inputType: 'insertText', bubbles: true }));
      input.value += c;
      input.dispatchEvent(new InputEvent('input', { data: c, inputType: 'insertText', bubbles: true }));
    }, char);
    await new Promise(r => setTimeout(r, 30));
  }
  
  const result3 = await page.evaluate(() => ({
    nativeValue: document.querySelectorAll('.h5-form-input')[0].querySelector('input').value
  }));
  console.log('方式3:', result3);
  
  // 检查 Vue smsPhone.value 的值
  console.log('\n=== 检查 Vue smsPhone.value ===');
  const vueCheck = await page.evaluate(() => {
    // 遍历所有 Vue 实例找 smsPhone
    const uniInput = document.querySelectorAll('.h5-form-input')[0];
    let comp = uniInput.__vueParentComponent;
    
    // 从 uni-input 的 Vue 实例往上遍历
    let path = [];
    let current = comp;
    while (current) {
      const stateKeys = current.setupState ? Object.keys(current.setupState) : [];
      const hasSmsPhone = current.setupState?.smsPhone !== undefined;
      path.push({
        name: current.type?.name || current.type?.__name || 'unknown',
        hasSmsPhone,
        smsPhoneValue: current.setupState?.smsPhone?.value,
        stateKeysCount: stateKeys.length
      });
      if (hasSmsPhone) break;
      current = current.parent;
    }
    return path;
  });
  console.log('Vue 实例遍历:', JSON.stringify(vueCheck, null, 2));
  
  browser.disconnect();
}

debug();