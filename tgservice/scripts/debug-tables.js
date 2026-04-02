const WebSocket = require('ws');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getPages() {
  const response = await fetch('http://127.0.0.1:9222/json/list');
  return await response.json();
}

async function debugPage() {
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
    
    // 先导航到首页
    console.log('=== 导航到首页 ===');
    ws.send(JSON.stringify({
      id: 2,
      method: 'Page.navigate',
      params: { url: 'http://admin.taikeduo.com/#/all-menus' }
    }));
    
    await sleep(8000);
    
    // 检查首页内容
    console.log('\n=== 检查首页内容 ===');
    ws.send(JSON.stringify({
      id: 3,
      method: 'Runtime.evaluate',
      params: { 
        expression: `
          (function() {
            return {
              url: window.location.href,
              bodyTextLength: document.body.innerText.length,
              bodyPreview: document.body.innerText.substring(0, 200)
            };
          })()
        `,
        returnByValue: true 
      }
    }));
  });
  
  ws.on('message', async (data) => {
    const msg = JSON.parse(data.toString());
    
    // 收集 console 消息
    if (msg.method === 'Runtime.consoleAPICalled') {
      const type = msg.params.type;
      const args = msg.params.args.map(a => a.value || a.description || '').join(' ');
      console.log(`Console [${type}]: ${args.substring(0, 80)}`);
    }
    
    if (msg.id === 3) {
      console.log('首页状态:', JSON.stringify(msg.result?.result?.value, null, 2));
      
      // 然后导航到台桌概览
      console.log('\n=== 导航到台桌概览 ===');
      ws.send(JSON.stringify({
        id: 4,
        method: 'Page.navigate',
        params: { url: 'http://admin.taikeduo.com/#/storeOverview/tableOverview' }
      }));
      
      await sleep(8000);
      
      // 检查台桌概览内容
      console.log('\n=== 检查台桌概览内容 ===');
      ws.send(JSON.stringify({
        id: 5,
        method: 'Runtime.evaluate',
        params: { 
          expression: `
            (function() {
              return {
                url: window.location.href,
                bodyTextLength: document.body.innerText.length,
                bodyPreview: document.body.innerText.substring(0, 500),
                hasTableNames: /普台\\d+|TV\\d+|包厢\\d+/.test(document.body.innerText),
                hasStats: document.body.innerText.includes('营业额')
              };
            })()
          `,
          returnByValue: true 
        }
      }));
    }
    
    if (msg.id === 5) {
      console.log('台桌概览状态:', JSON.stringify(msg.result?.result?.value, null, 2));
      ws.close();
      process.exit(0);
    }
  });
}

debugPage().catch(console.error);