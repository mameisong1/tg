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
  
  page.on('console', msg => console.log('CONSOLE:', msg.text().substring(0, 200)));
  
  // 通过 Vue 组件实例直接设置 smsPhone 和 smsCode，然后检查
  const result = await page.evaluate(() => {
    // 找到 member.vue 页面组件
    const app = document.querySelector('#app');
    const appVue = app?.__vue_app__;
    
    // 通过 uni-input 的 Vue 实例找到父组件
    const uniInput = document.querySelectorAll('.h5-form-input')[0];
    const vnode = uniInput?.__vueParentComponent;
    
    // 找到页面级组件（member.vue）
    let pageComponent = vnode;
    while (pageComponent?.parent && pageComponent.parent.type?.name !== 'Page') {
      pageComponent = pageComponent.parent;
    }
    
    console.log('pageComponent type:', pageComponent?.type?.name);
    console.log('pageComponent parent type:', pageComponent?.parent?.type?.name);
    
    // 继续往上找，直到找到有 smsPhone 的组件
    let memberComponent = pageComponent;
    for (let i = 0; i < 10; i++) {
      if (memberComponent?.setupState?.smsPhone) break;
      memberComponent = memberComponent?.parent;
      console.log(`层级${i}:`, memberComponent?.type?.name, memberComponent?.setupState ? Object.keys(memberComponent.setupState).join(',') : 'no setupState');
    }
    
    if (memberComponent?.setupState?.smsPhone) {
      console.log('找到 smsPhone ref！');
      console.log('smsPhone.value:', memberComponent.setupState.smsPhone.value);
      
      // 直接设置 smsPhone 的值
      memberComponent.setupState.smsPhone.value = '18600000004';
      console.log('smsPhone.value 已设置为:', memberComponent.setupState.smsPhone.value);
      
      // 同步设置 smsCode
      if (memberComponent.setupState.smsCode) {
        memberComponent.setupState.smsCode.value = '888888';
        console.log('smsCode.value 已设置为:', memberComponent.setupState.smsCode.value);
      }
      
      // 同步原生 input 的显示值
      const phoneInput = document.querySelectorAll('.h5-form-input')[0]?.querySelector('input');
      const codeInput = document.querySelectorAll('.h5-form-input')[1]?.querySelector('input');
      if (phoneInput) phoneInput.value = '18600000004';
      if (codeInput) codeInput.value = '888888';
      
      return { success: true, smsPhone: memberComponent.setupState.smsPhone.value, smsCode: memberComponent.setupState.smsCode?.value };
    }
    
    return { success: false, reason: '找不到 smsPhone ref' };
  });
  
  console.log('设置结果:', result);
  
  if (!result.success) {
    console.log('失败');
    browser.disconnect();
    return;
  }
  
  // 勾选协议
  await page.evaluate(() => {
    const checkbox = document.querySelector('.h5-agreement .checkbox');
    if (!checkbox?.classList.contains('checked')) {
      const text = document.querySelector('.h5-agreement .agreement-text');
      text?.click();
    }
  });
  await new Promise(r => setTimeout(r, 500));
  
  const agreed = await page.evaluate(() => 
    document.querySelector('.h5-agreement .checkbox')?.classList.contains('checked')
  );
  console.log('协议勾选:', agreed);
  
  if (!agreed) {
    // 再次尝试
    await page.evaluate(() => document.querySelector('.h5-agreement .checkbox')?.click());
    await new Promise(r => setTimeout(r, 500));
    const agreed2 = await page.evaluate(() => 
      document.querySelector('.h5-agreement .checkbox')?.classList.contains('checked')
    );
    console.log('二次协议勾选:', agreed2);
  }
  
  // 点击登录按钮
  console.log('\n点击登录按钮');
  await page.evaluate(() => document.querySelector('.h5-login-btn')?.click());
  await new Promise(r => setTimeout(r, 8000));
  
  // 检查结果
  const storage = await page.evaluate(() => ({
    memberToken: localStorage.getItem('memberToken'),
    memberInfo: localStorage.getItem('memberInfo'),
    coachToken: localStorage.getItem('coachToken')
  }));
  console.log('Storage:', JSON.stringify(storage, null, 2));
  
  // 检查页面
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 100));
  console.log('页面:', pageText);
  
  browser.disconnect();
}

debug();