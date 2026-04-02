const WebSocket = require('ws');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const wsUrl = 'ws://127.0.0.1:9222/devtools/page/C6666C3931D00549E1BD94E63797F744';

const ws = new WebSocket(wsUrl);

ws.on('open', async () => {
  console.log('刷新页面...');
  
  // 刷新页面
  ws.send(JSON.stringify({
    id: 1,
    method: 'Page.reload',
    params: {}
  }));
  
  await sleep(5000);
  
  console.log('检查页面内容...');
  
  ws.send(JSON.stringify({
    id: 2,
    method: 'Runtime.evaluate',
    params: { 
      expression: `
        (function() {
          return {
            title: document.title,
            url: window.location.href,
            bodyText: document.body.innerText.substring(0, 1500),
            html: document.body.innerHTML.substring(0, 800),
            hasTableNames: /普台\\d+|TV\\d+|包厢\\d+/.test(document.body.innerText),
            hasStats: document.body.innerText.includes('营业额') || document.body.innerText.includes('开台数')
          };
        })()
      `,
      returnByValue: true 
    }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.id === 2) {
    console.log(JSON.stringify(msg.result?.result?.value, null, 2));
    ws.close();
  }
});