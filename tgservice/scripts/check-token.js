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
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { 
        expression: `
          (function() {
            const accessToken = localStorage.getItem('accessToken');
            const user = localStorage.getItem('user');
            const role = localStorage.getItem('role');
            
            return {
              url: window.location.href,
              accessToken: accessToken ? '(有值,长度:' + accessToken.length + ')' : '(空)',
              user: user ? user.substring(0, 100) : '(空)',
              role: role || '(空)',
              bodyText: document.body.innerText.substring(0, 300),
              appInnerHTML: document.querySelector('#app')?.innerHTML
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