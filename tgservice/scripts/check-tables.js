const WebSocket = require('ws');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const wsUrl = 'ws://127.0.0.1:9222/devtools/page/6912941E5DBDC17A6A846F1E9EE1F409';

const ws = new WebSocket(wsUrl);

ws.on('open', async () => {
  // 启用 console 监听
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  
  // 刷新页面
  console.log('刷新页面...');
  ws.send(JSON.stringify({ id: 2, method: 'Page.reload', params: {} }));
  
  // 等待10秒让Vue渲染
  await sleep(10000);
  
  console.log('\n=== 检查页面状态 (10秒后) ===');
  
  ws.send(JSON.stringify({
    id: 3,
    method: 'Runtime.evaluate',
    params: { 
      expression: `
        (function() {
          return {
            url: window.location.href,
            title: document.title,
            bodyText: document.body.innerText.substring(0, 1500),
            hasTableNames: /普台\\d+|TV\\d+|包厢\\d+/.test(document.body.innerText),
            hasStats: document.body.innerText.includes('营业额') || document.body.innerText.includes('开台数'),
            appContent: document.querySelector('#app')?.innerHTML.substring(0, 300)
          };
        })()
      `,
      returnByValue: true 
    }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  // 收集 console 消息
  if (msg.method === 'Runtime.consoleAPICalled') {
    const type = msg.params.type;
    const args = msg.params.args.map(a => a.value || a.description || '').join(' ');
    console.log(`Console [${type}]: ${args}`);
  }
  
  if (msg.id === 3) {
    console.log('\n页面状态:', JSON.stringify(msg.result?.result?.value, null, 2));
    ws.close();
    process.exit(0);
  }
});