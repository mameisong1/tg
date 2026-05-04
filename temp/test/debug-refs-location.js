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
  
  // 检查 $vm 和 $pageInstance 上是否有 smsPhone
  const result = await page.evaluate(() => {
    const uniInput = document.querySelectorAll('.h5-form-input')[0];
    let memberComp = null;
    let current = uniInput.__vueParentComponent;
    for (let i = 0; i < 20; i++) {
      const name = current?.type?.name || current?.type?.__name || '';
      if (name === 'member') {
        memberComp = current;
        break;
      }
      current = current?.parent;
    }
    
    if (!memberComp) return { error: 'not found' };
    
    // 检查 $vm
    const vm = memberComp.proxy?.$vm;
    const vmKeys = vm ? Object.keys(vm).slice(0, 50) : [];
    
    // 检查 $pageInstance
    const pageInst = memberComp.$pageInstance || memberComp.proxy?.$pageInstance;
    const pageInstKeys = pageInst ? Object.keys(pageInst).slice(0, 50) : [];
    const pageInstProxyKeys = pageInst?.proxy ? Object.keys(pageInst.proxy).slice(0, 50) : [];
    const pageInstSetupStateKeys = pageInst?.setupState ? Object.keys(pageInst.setupState).slice(0, 50) : [];
    
    // 检查 pageInst.proxy.smsPhone
    const proxySmsPhone = pageInst?.proxy?.smsPhone;
    
    // 检查 memberComp 内部所有可能存储 ref 的地方
    const allRefs = [];
    for (const key of Object.keys(memberComp)) {
      const val = memberComp[key];
      if (val && typeof val === 'object') {
        try {
          // 检查 smsPhone 在嵌套对象中
          for (const subKey of Object.keys(val)) {
            if (subKey === 'smsPhone' || subKey === 'smsCode' || subKey === 'agreed') {
              allRefs.push({ path: `memberComp.${key}.${subKey}`, value: val[subKey] });
            }
          }
        } catch(e) {}
      }
    }
    
    return {
      vmKeys,
      pageInstKeys,
      pageInstProxyKeys,
      pageInstSetupStateKeys,
      proxySmsPhone,
      allRefs
    };
  });
  
  console.log('结果:', JSON.stringify(result, null, 2));
  
  browser.disconnect();
}

debug();