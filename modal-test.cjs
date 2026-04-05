/**
 * mychrome 测试 - 弹窗居中问题修复验证
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

async function getChromePages() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function loginAPI() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ username: 'tgadmin', password: 'mms633268' });
    const req = http.request({
      hostname: 'localhost',
      port: 8081,
      path: '/api/admin/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function test() {
  console.log('🎱 测试弹窗居中修复\n');
  
  const loginResult = await loginAPI();
  const token = loginResult.token;
  console.log('✅ 登录成功');
  
  const pages = await getChromePages();
  const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
  let msgId = 1;
  
  const send = (method, params = {}) => {
    return new Promise((resolve) => {
      const id = msgId++;
      ws.send(JSON.stringify({ id, method, params }));
      const handler = (data) => {
        const resp = JSON.parse(data);
        if (resp.id === id) {
          ws.removeListener('message', handler);
          resolve(resp);
        }
      };
      ws.on('message', handler);
    });
  };
  
  ws.on('open', async () => {
    console.log('✅ 连接 Chrome\n');
    
    // 设置 token 并刷新
    await send('Runtime.evaluate', { expression: `localStorage.setItem('adminToken', '${token}')` });
    await send('Runtime.evaluate', { expression: `location.href = 'http://localhost:8081/admin/orders.html'` });
    await new Promise(r => setTimeout(r, 3500));
    
    // 截图1: 订单列表
    const shot1 = await send('Page.captureScreenshot');
    fs.writeFileSync('/TG/modal-test-1-list.png', Buffer.from(shot1.result.data, 'base64'));
    console.log('📸 1. 订单列表: modal-test-1-list.png');
    
    // 检查订单
    const cardCount = await send('Runtime.evaluate', {
      expression: `document.querySelectorAll('.order-card').length`
    });
    console.log('   订单数量:', cardCount.result.result.value);
    
    // 点击取消按钮
    console.log('\n测试弹窗居中...');
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.item-cancel-btn').click()`
    });
    await new Promise(r => setTimeout(r, 1500));
    
    // 截图2: 弹窗
    const shot2 = await send('Page.captureScreenshot');
    fs.writeFileSync('/TG/modal-test-2-centered.png', Buffer.from(shot2.result.data, 'base64'));
    console.log('📸 2. 弹窗居中: modal-test-2-centered.png');
    
    // 检查弹窗是否居中
    const modalPosition = await send('Runtime.evaluate', {
      expression: `
        const modal = document.getElementById('cancelItemModal');
        const content = modal.querySelector('.modal-content');
        const rect = content.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const pageCenterX = window.innerWidth / 2;
        const pageCenterY = window.innerHeight / 2;
        '弹窗中心: (' + Math.round(centerX) + ',' + Math.round(centerY) + ') 页面中心: (' + Math.round(pageCenterX) + ',' + Math.round(pageCenterY) + ')';
      `
    });
    console.log('   ' + modalPosition.result.result.value);
    
    // 关闭弹窗
    await send('Runtime.evaluate', {
      expression: `document.getElementById('cancelItemModal').classList.remove('show')`
    });
    await new Promise(r => setTimeout(r, 500));
    
    // 截图3: 关闭后
    const shot3 = await send('Page.captureScreenshot');
    fs.writeFileSync('/TG/modal-test-3-closed.png', Buffer.from(shot3.result.data, 'base64'));
    console.log('📸 3. 关闭弹窗: modal-test-3-closed.png');
    
    ws.close();
    
    console.log('\n✅ 测试完成！');
    console.log('\n截图文件:');
    console.log('   /TG/modal-test-1-list.png');
    console.log('   /TG/modal-test-2-centered.png');
    console.log('   /TG/modal-test-3-closed.png');
  });
}

test().catch(console.error);