const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function test() {
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
    if (!text.includes('PWA') && !text.includes('Service Worker') && !text.includes('meta name') && !text.includes('deferredPrompt') && !text.includes('beforeinstallprompt') && !text.includes('UserAgent') && !text.includes('设备检测')) {
      console.log('CONSOLE:', text.substring(0, 200));
    }
  });
  
  // 直接调用 onUpdate:modelValue 事件处理器！
  console.log('=== 通过 vnode props 直接调用 onUpdate:modelValue ===');
  
  const result = await page.evaluate(() => {
    // 手机号
    const phoneUniInput = document.querySelectorAll('.h5-form-input')[0];
    const phoneNativeInput = phoneUniInput.querySelector('input');
    const phoneVueComp = phoneUniInput.__vueParentComponent;
    
    // 获取 vnode props 中的 onUpdate:modelValue
    const phoneOnUpdate = phoneVueComp?.vnode?.props?.['onUpdate:modelValue'];
    
    // 验证码
    const codeUniInput = document.querySelectorAll('.h5-form-input')[1];
    const codeNativeInput = codeUniInput.querySelector('input');
    const codeVueComp = codeUniInput.__vueParentComponent;
    const codeOnUpdate = codeVueComp?.vnode?.props?.['onUpdate:modelValue'];
    
    console.log('phoneOnUpdate type:', typeof phoneOnUpdate);
    console.log('codeOnUpdate type:', typeof codeOnUpdate);
    
    if (phoneOnUpdate) {
      // 设置原生 input 值
      phoneNativeInput.value = '18600000004';
      // 调用 onUpdate:modelValue 回调
      phoneOnUpdate('18600000004');
      console.log('phone onUpdate:modelValue 已调用');
    }
    
    if (codeOnUpdate) {
      codeNativeInput.value = '888888';
      codeOnUpdate('888888');
      console.log('code onUpdate:modelValue 已调用');
    }
    
    return {
      phoneOnUpdateType: typeof phoneOnUpdate,
      codeOnUpdateType: typeof codeOnUpdate
    };
  });
  
  console.log('结果:', result);
  
  // 等待 Vue 响应式更新
  await new Promise(r => setTimeout(r, 500));
  
  // 勾选协议
  await page.evaluate(() => {
    const checkbox = document.querySelector('.h5-agreement .checkbox');
    if (!checkbox?.classList.contains('checked')) {
      document.querySelector('.h5-agreement .agreement-text')?.click();
    }
  });
  await new Promise(r => setTimeout(r, 500));
  
  const agreed = await page.evaluate(() => 
    document.querySelector('.h5-agreement .checkbox')?.classList.contains('checked')
  );
  console.log('协议勾选:', agreed);
  
  // 点击登录按钮
  console.log('\n点击登录按钮');
  await page.evaluate(() => document.querySelector('.h5-login-btn')?.click());
  await new Promise(r => setTimeout(r, 8000));
  
  // 检查后端日志
  console.log('\n检查结果');
  
  // 检查页面变化
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 100));
  console.log('页面:', pageText);
  
  // 检查 Storage
  const storage = await page.evaluate(() => ({
    memberToken: localStorage.getItem('memberToken'),
    memberInfo: localStorage.getItem('memberInfo'),
    coachToken: localStorage.getItem('coachToken')
  }));
  console.log('Storage:', JSON.stringify(storage, null, 2));
  
  browser.disconnect();
}

test();