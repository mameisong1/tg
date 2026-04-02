const WebSocket = require('ws');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getPages() {
  const response = await fetch('http://127.0.0.1:9222/json/list');
  return await response.json();
}

async function executeScript(wsUrl, script) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let resolved = false;
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: script, returnByValue: true }
      }));
    });
    
    ws.on('message', (data) => {
      if (resolved) return;
      resolved = true;
      try {
        const msg = JSON.parse(data.toString());
        resolve(msg.result?.result?.value);
      } catch (err) {
        reject(err);
      }
      ws.close();
    });
    
    ws.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });
    
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        reject(new Error('Timeout'));
      }
    }, 10000);
  });
}

async function navigateTo(wsUrl, url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let resolved = false;
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Page.navigate',
        params: { url }
      }));
    });
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === 1) {
        if (resolved) return;
        resolved = true;
        ws.close();
        resolve();
      }
    });
    
    ws.on('error', reject);
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        resolve();
      }
    }, 10000);
  });
}

async function debug() {
  console.log('=== 1. 导航到台桌概览页面 ===\n');
  
  const pages = await getPages();
  const usablePage = pages.find(p => 
    p.webSocketDebuggerUrl && (
      p.url?.includes('chrome://newtab') || 
      p.url?.includes('about:blank')
    )
  );
  
  if (!usablePage) {
    console.log('没有可用标签页');
    return;
  }
  
  const targetUrl = 'http://admin.taikeduo.com/#/storeOverview/tableOverview';
  console.log(`导航到: ${targetUrl}`);
  
  await navigateTo(usablePage.webSocketDebuggerUrl, targetUrl);
  
  // 等待并多次检测
  for (let i = 1; i <= 6; i++) {
    const waitTime = i * 5;
    console.log(`\n=== ${waitTime} 秒后检测 (第 ${i} 次) ===`);
    
    await sleep(5000);
    
    const currentPages = await getPages();
    const taikeduoPage = currentPages.find(p => p.url && p.url.includes('admin.taikeduo.com'));
    
    if (!taikeduoPage) {
      console.log('未找到台客多页面');
      continue;
    }
    
    const result = await executeScript(taikeduoPage.webSocketDebuggerUrl, `
      (function() {
        const text = document.body.innerText;
        const html = document.body.innerHTML;
        const app = document.querySelector('#app');
        
        return {
          url: window.location.href,
          bodyTextLength: text.length,
          bodyPreview: text.substring(0, 200),
          appHTMLLength: app ? app.innerHTML.length : 0,
          hasTableNames: /普台\\d+|TV\\d+|包厢\\d+/.test(text),
          hasStats: text.includes('营业额'),
          hasLoginBtn: text.includes('密码登录'),
          isLoading: text.includes('加载') || html.includes('loading'),
          hasNetworkError: text.includes('网络') && text.includes('异常'),
          hasAccessToken: !!localStorage.getItem('accessToken')
        };
      })()
    `);
    
    console.log(`URL: ${result.url}`);
    console.log(`内容长度: ${result.bodyTextLength}`);
    console.log(`App HTML 长度: ${result.appHTMLLength}`);
    console.log(`内容预览: ${result.bodyPreview.substring(0, 100)}`);
    console.log(`台桌元素: ${result.hasTableNames || result.hasStats ? '✅' : '❌'}`);
    console.log(`登录元素: ${result.hasLoginBtn ? '✅' : '❌'}`);
    console.log(`加载中: ${result.isLoading ? '⏳' : '❌'}`);
    console.log(`网络错误: ${result.hasNetworkError ? '⚠️' : '❌'}`);
    console.log(`Token: ${result.hasAccessToken ? '✅' : '❌'}`);
    
    if (result.hasTableNames || result.hasStats) {
      console.log('\n✅ 检测到台桌元素，页面加载成功！');
      break;
    }
  }
}

debug().catch(console.error);