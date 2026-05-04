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
  
  const result = await page.evaluate(() => {
    // 找到 member 组件
    const phoneUniInput = document.querySelectorAll('.h5-form-input')[0];
    let current = phoneUniInput.__vueParentComponent;
    let memberComp = null;
    for (let i = 0; i < 20; i++) {
      if (current?.type?.name === 'member') { memberComp = current; break; }
      current = current?.parent;
    }
    
    if (!memberComp) return { error: 'member not found' };
    
    // 深入检查 memberComp 的所有属性
    const allOwnProps = Object.getOwnPropertyNames(memberComp);
    
    // 检查每个属性的值
    const interestingProps = {};
    for (const prop of allOwnProps) {
      try {
        const val = memberComp[prop];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          // 检查是否有 smsPhone
          const subOwnProps = Object.getOwnPropertyNames(val);
          if (subOwnProps.includes('smsPhone') || subOwnProps.includes('smsCode')) {
            interestingProps[prop] = {
              smsPhone: val.smsPhone?.value ?? val.smsPhone,
              smsCode: val.smsCode?.value ?? val.smsCode,
              agreed: val.agreed?.value ?? val.agreed,
              totalKeys: subOwnProps.length
            };
          }
        }
      } catch(e) {}
    }
    
    // 特别检查 memberComp.ctx（Vue 3 的渲染上下文）
    const ctx = memberComp.ctx;
    const ctxOwnProps = Object.getOwnPropertyNames(ctx || {});
    const ctxSmsPhone = ctx?.smsPhone;
    
    // 检查 memberComp.proxy
    const proxy = memberComp.proxy;
    const proxyOwnProps = Object.getOwnPropertyNames(proxy || {});
    const proxySmsPhone = proxy?.smsPhone;
    
    // 检查 memberComp.__pageInstance (UniApp 特殊属性)
    const pageInstance = memberComp.__pageInstance;
    
    // 直接在 memberComp 上遍历所有子对象的 smsPhone
    let foundSmsPhone = null;
    for (const prop of allOwnProps) {
      try {
        const val = memberComp[prop];
        if (val && typeof val === 'object') {
          // 尝试直接访问 smsPhone
          if ('smsPhone' in val) {
            foundSmsPhone = { 
              path: `memberComp.${prop}.smsPhone`,
              value: val.smsPhone?.value ?? val.smsPhone,
              isRef: val.smsPhone?.__v_isRef
            };
          }
        }
      } catch(e) {}
    }
    
    return {
      interestingProps,
      ctxOwnProps: ctxOwnProps.slice(0, 30),
      ctxSmsPhone,
      proxyOwnProps: proxyOwnProps.slice(0, 30),
      proxySmsPhone,
      foundSmsPhone,
      hasPageInstance: !!pageInstance
    };
  });
  
  console.log('结果:', JSON.stringify(result, null, 2));
  
  browser.disconnect();
}

debug();