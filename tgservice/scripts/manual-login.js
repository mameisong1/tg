const WebSocket = require('ws');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const wsUrl = 'ws://127.0.0.1:9222/devtools/page/C6666C3931D00549E1BD94E63797F744';
const credentials = {
  username: '18680174119',
  password: 'tgk123456'
};

const ws = new WebSocket(wsUrl);

ws.on('open', async () => {
  console.log('=== 导航到登录页面 ===');
  
  // 导航到登录页面
  ws.send(JSON.stringify({
    id: 1,
    method: 'Page.navigate',
    params: { url: 'http://admin.taikeduo.com/#/login' }
  }));
  
  await sleep(3000);
  
  console.log('=== 检查登录页面 ===');
  
  ws.send(JSON.stringify({
    id: 2,
    method: 'Runtime.evaluate',
    params: { 
      expression: `document.body.innerText.substring(0, 300)`,
      returnByValue: true 
    }
  }));
});

ws.on('message', async (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.id === 2) {
    console.log('登录页面内容:', msg.result?.result?.value);
    
    // 点击密码登录
    await sleep(1000);
    console.log('=== 点击密码登录 ===');
    
    ws.send(JSON.stringify({
      id: 3,
      method: 'Runtime.evaluate',
      params: { 
        expression: `
          (function() {
            const span = document.querySelector('span.switch-text');
            if (span) {
              span.click();
              return '已点击密码登录';
            }
            return '未找到密码登录按钮';
          })()
        `,
        returnByValue: true 
      }
    }));
  }
  
  if (msg.id === 3) {
    console.log('点击结果:', msg.result?.result?.value);
    
    await sleep(2000);
    console.log('=== 填写用户名密码 ===');
    
    ws.send(JSON.stringify({
      id: 4,
      method: 'Runtime.evaluate',
      params: { 
        expression: `
          (function() {
            const inputs = document.querySelectorAll('input');
            for (const inp of inputs) {
              if (inp.type === 'text' && inp.placeholder.includes('手机号')) {
                inp.focus();
                inp.value = '${credentials.username}';
                inp.dispatchEvent(new Event('input', { bubbles: true }));
              }
              if (inp.type === 'password') {
                inp.focus();
                inp.value = '${credentials.password}';
                inp.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }
            return '已填写';
          })()
        `,
        returnByValue: true 
      }
    }));
  }
  
  if (msg.id === 4) {
    console.log('填写结果:', msg.result?.result?.value);
    
    await sleep(1000);
    console.log('=== 点击登录按钮 ===');
    
    ws.send(JSON.stringify({
      id: 5,
      method: 'Runtime.evaluate',
      params: { 
        expression: `
          (function() {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
              if (btn.innerText.includes('登') && btn.innerText.includes('录')) {
                btn.click();
                return '已点击登录';
              }
            }
            return '未找到登录按钮';
          })()
        `,
        returnByValue: true 
      }
    }));
  }
  
  if (msg.id === 5) {
    console.log('登录点击:', msg.result?.result?.value);
    
    await sleep(5000);
    console.log('=== 检查登录结果 ===');
    
    ws.send(JSON.stringify({
      id: 6,
      method: 'Runtime.evaluate',
      params: { 
        expression: `
          (function() {
            return {
              url: window.location.href,
              bodyText: document.body.innerText.substring(0, 500),
              hasSidebar: !!document.querySelector('.sidebar, .el-menu')
            };
          })()
        `,
        returnByValue: true 
      }
    }));
  }
  
  if (msg.id === 6) {
    console.log('登录结果:', JSON.stringify(msg.result?.result?.value, null, 2));
    
    if (msg.result?.result?.value?.url.includes('login')) {
      console.log('仍在登录页面，登录失败');
    } else {
      console.log('登录成功！导航到台桌概览...');
      
      ws.send(JSON.stringify({
        id: 7,
        method: 'Page.navigate',
        params: { url: 'http://admin.taikeduo.com/#/storeOverview/tableOverview' }
      }));
      
      await sleep(5000);
      
      ws.send(JSON.stringify({
        id: 8,
        method: 'Runtime.evaluate',
        params: { 
          expression: `document.body.innerText.substring(0, 1000)`,
          returnByValue: true 
        }
      }));
    }
    ws.close();
  }
  
  if (msg.id === 8) {
    console.log('台桌概览内容:', msg.result?.result?.value);
    ws.close();
  }
});