const WebSocket = require('ws');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const wsUrl = 'ws://127.0.0.1:9222/devtools/page/C6666C3931D00549E1BD94E63797F744';

const ws = new WebSocket(wsUrl);

ws.on('open', async () => {
  // 启用 console 监听
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  
  await sleep(500);
  
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
            bodyText: document.body.innerText.substring(0, 1000),
            html: document.body.innerHTML.substring(0, 500),
            hasLoginBtn: document.body.innerText.includes('密码登录'),
            hasInputs: document.querySelectorAll('input').length,
            inputTypes: Array.from(document.querySelectorAll('input')).map(i => i.type)
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
    console.log('页面状态:', JSON.stringify(msg.result?.result?.value, null, 2));
    ws.close();
    process.exit(0);
  }
});