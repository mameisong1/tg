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
});

let errors = [];

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  // 收集 console 消息
  if (msg.method === 'Runtime.consoleAPICalled') {
    const type = msg.params.type;
    const args = msg.params.args.map(a => a.value || a.description || '').join(' ');
    if (type === 'error') {
      errors.push(args);
    }
    console.log(`Console [${type}]: ${args}`);
  }
  
  // 收集异常
  if (msg.method === 'Runtime.exceptionThrown') {
    const text = msg.params.exceptionDetails.text;
    errors.push(text);
    console.log(`Exception: ${text}`);
  }
  
  // 5秒后检查结果
  if (msg.id === 2) {
    setTimeout(async () => {
      console.log('\n=== 检查页面状态 ===');
      
      ws.send(JSON.stringify({
        id: 3,
        method: 'Runtime.evaluate',
        params: { 
          expression: `
            (function() {
              // 检查 Vue 应用状态
              const app = document.querySelector('#app');
              const appContent = app ? app.innerHTML.substring(0, 300) : 'null';
              
              // 检查脚本加载
              const scripts = document.querySelectorAll('script[src]');
              const scriptSrcs = Array.from(scripts).map(s => s.src);
              
              return {
                url: window.location.href,
                appExists: !!app,
                appContent: appContent,
                scriptCount: scripts.length,
                scripts: scriptSrcs.slice(0, 5),
                bodyText: document.body.innerText.substring(0, 200)
              };
            })()
          `,
          returnByValue: true 
        }
      }));
    }, 5000);
  }
  
  if (msg.id === 3) {
    console.log('页面状态:', JSON.stringify(msg.result?.result?.value, null, 2));
    console.log('\n收集到的错误:', errors);
    ws.close();
    process.exit(0);
  }
});