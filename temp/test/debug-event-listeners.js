const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function test() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  let page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
  
  // 清空 Storage 和页面
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 10000));
  
  // 搜索 UniApp runtime 中的 input 处理方式
  // 检查 uni-input 组件的 render 函数中如何绑定 input 事件
  const inputHandlerInfo = await page.evaluate(() => {
    const uniInput = document.querySelectorAll('.h5-form-input')[0];
    const nativeInput = uniInput.querySelector('input');
    const vueComp = uniInput.__vueParentComponent;
    
    // 检查 vueComp 的 render 函数（vnode）
    const vnode = vueComp?.vnode;
    const props = vnode?.props || {};
    
    // 检查 native input 的所有属性
    const nativeAttrs = {};
    for (const attr of nativeInput.attributes) {
      nativeAttrs[attr.name] = attr.value;
    }
    
    // 检查事件监听器（通过检查 __vei 内部属性）
    const nativeEventListeners = {};
    // Vue 3 在元素上存储事件监听器为 __vei
    const vei = nativeInput.__vei;
    if (vei) {
      for (const [key, handler] of Object.entries(vei)) {
        nativeEventListeners[key] = typeof handler === 'function' ? 'function' : (handler?.toString?.() || typeof handler);
      }
    }
    
    // 检查 uni-input 组件上的事件监听器
    const uniVei = uniInput.__vei;
    const uniEventListeners = {};
    if (uniVei) {
      for (const [key, handler] of Object.entries(uniVei)) {
        uniEventListeners[key] = typeof handler === 'function' ? 'function' : (handler?.toString?.() || typeof handler);
      }
    }
    
    return {
      nativeAttrs,
      nativeEventListeners,
      uniEventListeners,
      vnodeProps: Object.keys(props)
    };
  });
  
  console.log('input 事件信息:', JSON.stringify(inputHandlerInfo, null, 2));
  
  browser.disconnect();
}

test();