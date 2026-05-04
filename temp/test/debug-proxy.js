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
  
  // 找到 member.vue 组件实例，检查 ref 存储位置
  const result = await page.evaluate(() => {
    const uniInput = document.querySelectorAll('.h5-form-input')[0];
    let comp = uniInput.__vueParentComponent;
    
    // 找到 member 组件
    let memberComp = null;
    let current = comp;
    for (let i = 0; i < 20; i++) {
      const name = current?.type?.name || current?.type?.__name || '';
      if (name === 'member' || name === 'Member' || name === 'MemberVue') {
        memberComp = current;
        break;
      }
      current = current?.parent;
    }
    
    if (!memberComp) {
      return { error: '找不到 member 组件', path: [] };
    }
    
    // 检查 member 组件的所有属性
    const keys = Object.keys(memberComp);
    const subKeys = {};
    for (const key of keys) {
      const val = memberComp[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        subKeys[key] = Object.keys(val).slice(0, 20);
      }
    }
    
    // 特别检查 ctx, setupState, proxy, data
    const ctxKeys = memberComp.ctx ? Object.keys(memberComp.ctx).slice(0, 30) : [];
    const proxyKeys = memberComp.proxy ? Object.keys(memberComp.proxy).slice(0, 30) : [];
    
    // 检查 proxy 上是否有 smsPhone
    const proxySmsPhone = memberComp.proxy?.smsPhone;
    
    return {
      memberFound: true,
      memberKeys: keys,
      subKeys,
      ctxKeys,
      proxyKeys,
      proxySmsPhone: proxySmsPhone
    };
  });
  
  console.log('member 组件信息:', JSON.stringify(result, null, 2));
  
  // 如果 proxy 上有 smsPhone，直接设置
  if (result.proxySmsPhone !== undefined) {
    console.log('\n找到 smsPhone！尝试通过 proxy 设置');
    
    const setResult = await page.evaluate(() => {
      const uniInput = document.querySelectorAll('.h5-form-input')[0];
      let memberComp = null;
      let current = uniInput.__vueParentComponent;
      for (let i = 0; i < 20; i++) {
        if (current?.type?.name === 'member' || current?.type?.__name === 'member') {
          memberComp = current;
          break;
        }
        current = current?.parent;
      }
      
      if (memberComp?.proxy?.smsPhone) {
        // smsPhone 是 ref，proxy.smsPhone 会自动解包
        memberComp.proxy.smsPhone = '18600000004';
        
        // smsCode
        if (memberComp.proxy.smsCode !== undefined) {
          memberComp.proxy.smsCode = '888888';
        }
        
        // agreed
        if (memberComp.proxy.agreed !== undefined) {
          memberComp.proxy.agreed = true;
        }
        
        return {
          smsPhone: memberComp.proxy.smsPhone,
          smsCode: memberComp.proxy.smsCode,
          agreed: memberComp.proxy.agreed
        };
      }
      
      return { error: 'proxy.smsPhone 不存在' };
    });
    
    console.log('设置结果:', setResult);
    
    // 同步原生 input 显示
    await page.evaluate(() => {
      document.querySelectorAll('.h5-form-input')[0].querySelector('input').value = '18600000004';
      document.querySelectorAll('.h5-form-input')[1].querySelector('input').value = '888888';
    });
    
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
    console.log('点击登录按钮');
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
  }
  
  browser.disconnect();
}

debug();