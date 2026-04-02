const WebSocket = require('ws');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
  
  ws.on('open', async () => {
    // 启用 console 监听
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    
    console.log('刷新页面...');
    ws.send(JSON.stringify({ id: 2, method: 'Page.reload', params: {} }));
    
    // 等待20秒
    console.log('等待20秒让Vue完全渲染...');
    await sleep(20000);
    
    ws.send(JSON.stringify({
      id: 3,
      method: 'Runtime.evaluate',
      params: { 
        expression: `
          (function() {
            return {
              url: window.location.href,
              bodyText: document.body.innerText.substring(0, 1000),
              bodyLength: document.body.innerText.length,
              hasTableNames: /普台\\d+|TV\\d+|包厢\\d+/.test(document.body.innerText),
              appHTML: document.querySelector('#app')?.innerHTML.substring(0, 500)
            };
          })()
        `,
        returnByValue: true 
      }
    }));
  });
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    
    if (msg.method === 'Runtime.consoleAPICalled') {
      const type = msg.params.type;
      const args = msg.params.args.map(a => a.value || a.description || '').join(' ');
      console.log(`[${type}] ${args.substring(0, 80)}`);
    }
    
    if (msg.id === 3) {
      console.log('\n页面状态:', JSON.stringify(msg.result?.result?.value, null, 2));
      ws.close();
      process.exit(0);
    }
  });
}

checkPage().catch(console.error);