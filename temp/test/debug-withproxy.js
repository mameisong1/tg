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
  
  // Vue 3 accessCache 值的含义：
  // 0 = OTHER (setupState 或 data)
  // 1 = DATA
  // 2 = PROPS
  // 3 = CONTEXT
  // 4 = SETUP_STATE
  // 所以 smsPhone 的 accessCache 值为 0，说明它在 setupState 或其他位置
  
  // 但 setupStateKeys 为空... 让我检查 setupState 的类型
  const result = await page.evaluate(() => {
    const uniInput = document.querySelectorAll('.h5-form-input')[0];
    let memberComp = null;
    let current = uniInput.__vueParentComponent;
    for (let i = 0; i < 20; i++) {
      if (current?.type?.name === 'member') { memberComp = current; break; }
      current = current?.parent;
    }
    
    if (!memberComp) return { error: 'not found' };
    
    // 检查 setupState 的实际内容（可能 keys 为空但实际是 reactive object）
    const setupState = memberComp.setupState;
    const setupStateType = typeof setupState;
    const setupStateIsProxy = setupState ? setupState.__v_isReactive || setupState.__v_raw : false;
    
    // 检查 withProxy（Vue 3 Composition API 可能使用 withProxy 来访问 setupState）
    const withProxy = memberComp.withProxy;
    const withProxyKeys = withProxy ? Object.keys(withProxy).slice(0, 50) : [];
    const withProxySmsPhone = withProxy?.smsPhone;
    const withProxySmsCode = withProxy?.smsCode;
    const withProxyAgreed = withProxy?.agreed;
    
    // 尝试通过 withProxy 设置 smsPhone
    if (withProxy) {
      withProxy.smsPhone = '18600000004';
      withProxy.smsCode = '888888';
      withProxy.agreed = true;
      
      console.log('smsPhone after set:', withProxy.smsPhone);
      console.log('smsCode after set:', withProxy.smsCode);
      console.log('agreed after set:', withProxy.agreed);
    }
    
    return {
      setupStateType,
      setupStateIsProxy,
      withProxyKeys,
      withProxySmsPhone,
      withProxySmsCode,
      withProxyAgreed
    };
  });
  
  console.log('结果:', JSON.stringify(result, null, 2));
  
  // 同步原生 input 显示值
  await page.evaluate(() => {
    document.querySelectorAll('.h5-form-input')[0].querySelector('input').value = '18600000004';
    document.querySelectorAll('.h5-form-input')[1].querySelector('input').value = '888888';
  });
  
  // 勾选协议（可能已经通过 withProxy 设置了）
  const checkboxState = await page.evaluate(() => 
    document.querySelector('.h5-agreement .checkbox')?.classList.contains('checked')
  );
  console.log('协议勾选状态:', checkboxState);
  
  if (!checkboxState) {
    await page.evaluate(() => document.querySelector('.h5-agreement .agreement-text')?.click());
    await new Promise(r => setTimeout(r, 500));
  }
  
  // 点击登录按钮
  console.log('\n点击登录按钮');
  await page.evaluate(() => document.querySelector('.h5-login-btn')?.click());
  await new Promise(r => setTimeout(r, 8000));
  
  // 检查结果
  const storage = await page.evaluate(() => ({
    memberToken: localStorage.getItem('memberToken'),
    memberInfo: localStorage.getItem('memberInfo')
  }));
  console.log('Storage:', JSON.stringify(storage, null, 2));
  
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 100));
  console.log('页面:', pageText);
  
  browser.disconnect();
}

debug();