/**
 * 测试订单取消商品功能 - 界面测试
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

async function getPages() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function loginAndGetToken() {
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
      res.on('end', () => {
        const result = JSON.parse(data);
        resolve(result.token);
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function test() {
  console.log('📋 开始界面测试...\n');
  
  // 1. 登录获取 token
  console.log('步骤1: 登录获取 token');
  const token = await loginAndGetToken();
  if (!token) {
    console.error('❌ 登录失败');
    return;
  }
  console.log('✅ Token:', token.substring(0, 20) + '...');
  
  // 2. 连接 Chrome
  const pages = await getPages();
  const wsUrl = pages[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  
  let messageId = 1;
  const send = (method, params = {}) => {
    return new Promise((resolve) => {
      const id = messageId++;
      ws.send(JSON.stringify({ id, method, params }));
      const handler = (data) => {
        const response = JSON.parse(data);
        if (response.id === id) {
          ws.removeListener('message', handler);
          resolve(response);
        }
      };
      ws.on('message', handler);
    });
  };
  
  ws.on('open', async () => {
    console.log('✅ 连接 Chrome 成功');
    
    // 3. 导航到订单管理页面
    console.log('步骤2: 导航到订单管理页面');
    await send('Page.navigate', { url: 'http://localhost:8081/admin/orders.html' });
    await new Promise(r => setTimeout(r, 2000));
    
    // 4. 设置 token
    console.log('步骤3: 设置登录 token');
    await send('Runtime.evaluate', {
      expression: `localStorage.setItem('adminToken', '${token}')`
    });
    
    // 5. 刷新页面
    await send('Runtime.evaluate', { expression: `location.reload()` });
    await new Promise(r => setTimeout(r, 3000));
    
    // 6. 截图初始状态
    console.log('步骤4: 截图初始订单列表');
    const screenshot1 = await send('Page.captureScreenshot');
    fs.writeFileSync('/TG/ui-test-1-initial.png', Buffer.from(screenshot1.result.data, 'base64'));
    console.log('✅ 截图保存: ui-test-1-initial.png');
    
    // 7. 检查订单卡片
    const cardCount = await send('Runtime.evaluate', {
      expression: `document.querySelectorAll('.order-card').length`
    });
    console.log('订单卡片数量:', cardCount.result.result.value);
    
    const btnCount = await send('Runtime.evaluate', {
      expression: `document.querySelectorAll('.item-cancel-btn').length`
    });
    console.log('取消按钮数量:', btnCount.result.result.value);
    
    if (btnCount.result.result.value === 0) {
      console.error('❌ 没有取消按钮');
      ws.close();
      return;
    }
    
    // 8. 点击第一个取消按钮
    console.log('\n步骤5: 点击第一个取消按钮');
    
    // 获取商品信息
    const itemInfo = await send('Runtime.evaluate', {
      expression: `
        const btn = document.querySelector('.item-cancel-btn');
        const row = btn.closest('.item-row');
        const nameEl = row.querySelector('.item-name');
        const qtyEl = row.querySelector('.item-qty');
        nameEl ? nameEl.textContent + ' ' + (qtyEl ? qtyEl.textContent : '') : '未知';
      `
    });
    console.log('第一个商品:', itemInfo.result.result.value);
    
    // 点击取消按钮
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.item-cancel-btn').click()`
    });
    await new Promise(r => setTimeout(r, 1500));
    
    // 截图弹窗
    const screenshot2 = await send('Page.captureScreenshot');
    fs.writeFileSync('/TG/ui-test-2-modal.png', Buffer.from(screenshot2.result.data, 'base64'));
    console.log('✅ 截图保存: ui-test-2-modal.png');
    
    // 检查弹窗内容
    const modalText = await send('Runtime.evaluate', {
      expression: `document.getElementById('cancelItemBody').innerText`
    });
    console.log('弹窗内容:', modalText.result.result.value);
    
    // 9. 修改数量并点击部分取消
    console.log('\n步骤6: 测试部分取消');
    await send('Runtime.evaluate', {
      expression: `
        const input = document.getElementById('cancelQuantityInput');
        input.value = '1';
        input.dispatchEvent(new Event('change'));
      `
    });
    await new Promise(r => setTimeout(r, 500));
    
    // 查看预览
    const preview = await send('Runtime.evaluate', {
      expression: `document.getElementById('cancelPreviewTotal').textContent`
    });
    console.log('取消后预览:', preview.result.result.value);
    
    // 点击部分取消
    await send('Runtime.evaluate', {
      expression: `document.getElementById('cancelPartBtn').click()`
    });
    await new Promise(r => setTimeout(r, 2500));
    
    // 截图部分取消后
    const screenshot3 = await send('Page.captureScreenshot');
    fs.writeFileSync('/TG/ui-test-3-part-cancel.png', Buffer.from(screenshot3.result.data, 'base64'));
    console.log('✅ 截图保存: ui-test-3-part-cancel.png');
    
    // 检查更新
    const updateCheck = await send('Runtime.evaluate', {
      expression: `
        const card = document.querySelector('.order-card');
        card ? '总价: ' + card.querySelector('.order-total').textContent : '无订单';
      `
    });
    console.log('部分取消后总价:', updateCheck.result.result.value);
    
    // 10. 测试全部取消
    console.log('\n步骤7: 测试全部取消');
    const remainingBtns = await send('Runtime.evaluate', {
      expression: `document.querySelectorAll('.item-cancel-btn').length`
    });
    console.log('剩余取消按钮:', remainingBtns.result.result.value);
    
    if (remainingBtns.result.result.value > 0) {
      await send('Runtime.evaluate', {
        expression: `document.querySelectorAll('.item-cancel-btn')[0].click()`
      });
      await new Promise(r => setTimeout(r, 1500));
      
      await send('Runtime.evaluate', {
        expression: `document.getElementById('cancelAllBtn').click()`
      });
      await new Promise(r => setTimeout(r, 2500));
      
      const screenshot4 = await send('Page.captureScreenshot');
      fs.writeFileSync('/TG/ui-test-4-all-cancel.png', Buffer.from(screenshot4.result.data, 'base64'));
      console.log('✅ 截图保存: ui-test-4-all-cancel.png');
      
      const afterCancel = await send('Runtime.evaluate', {
        expression: `
          const card = document.querySelector('.order-card');
          card ? '商品数: ' + card.querySelectorAll('.item-row').length : '无订单';
        `
      });
      console.log('全部取消后:', afterCancel.result.result.value);
    }
    
    ws.close();
    
    console.log('\n✅ 界面测试完成！');
    console.log('\n📊 截图文件列表:');
    console.log('   /TG/ui-test-1-initial.png');
    console.log('   /TG/ui-test-2-modal.png');
    console.log('   /TG/ui-test-3-part-cancel.png');
    console.log('   /TG/ui-test-4-all-cancel.png');
  });
}

test().catch(console.error);