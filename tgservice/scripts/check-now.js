const WebSocket = require('ws');

async function getPages() {
  const response = await fetch('http://127.0.0.1:9222/json/list');
  return await response.json();
}

async function checkPage() {
  const pages = await getPages();
  const page = pages.find(p => p.url && p.url.includes('admin.taikeduo.com'));
  
  if (!page) {
    console.log('没有找到台客多页面');
    return;
  }
  
  console.log('页面URL:', page.url);
  
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  
  ws.on('open', () => {
    // 不刷新，直接检查当前内容
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { 
        expression: `
          (function() {
            return {
              url: window.location.href,
              title: document.title,
              bodyText: document.body.innerText.substring(0, 1500),
              appHTML: document.querySelector('#app')?.innerHTML.substring(0, 500),
              hasVue: !!window.__VUE__,
              localStorageKeys: Object.keys(localStorage),
              hasToken: !!localStorage.getItem('token') || !!localStorage.getItem('admin-token')
            };
          })()
        `,
        returnByValue: true 
      }
    }));
  });
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log(JSON.stringify(msg.result?.result?.value, null, 2));
    ws.close();
  });
}

checkPage().catch(console.error);