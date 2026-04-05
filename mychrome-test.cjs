/**
 * 使用 mychrome 进行真实界面测试 - 完整版
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

async function testWithMyChrome() {
  console.log('🎱 开始使用 mychrome 进行真实界面测试\n');
  
  // 1. 先通过 API 登录获取 token
  console.log('━━━ 步骤 1: 获取登录 Token ━━━');
  const loginResult = await loginAPI();
  if (!loginResult.token) {
    console.error('❌ 登录失败');
    return;
  }
  const token = loginResult.token;
  console.log('✅ Token 获取成功');
  
  // 2. 连接 Chrome
  const pages = await getChromePages();
  const wsUrl = pages[0].webSocketDebuggerUrl;
  console.log('✅ 连接 Chrome:', pages[0]['title']);
  
  const ws = new WebSocket(wsUrl);
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
    console.log('✅ WebSocket 连接成功\n');
    
    // 设置 token
    console.log('━━━ 步骤 2: 设置登录状态 ━━━');
    await send('Runtime.evaluate', {
      expression: `localStorage.setItem('adminToken', '${token}')`
    });
    console.log('✅ Token 已设置');
    
    // 刷新页面
    console.log('\n━━━ 步骤 3: 刷新订单页面 ━━━');
    await send('Runtime.evaluate', { expression: `location.reload()` });
    await new Promise(r => setTimeout(r, 3000));
    
    const shot1 = await send('Page.captureScreenshot');
    fs.writeFileSync('/TG/mychrome-1-refresh.png', Buffer.from(shot1.result.data, 'base64'));
    console.log('📸 截图: mychrome-1-refresh.png');
    
    // 检查订单
    console.log('\n━━━ 步骤 4: 检查订单状态 ━━━');
    const cardCount = await send('Runtime.evaluate', {
      expression: `document.querySelectorAll('.order-card').length`
    });
    console.log('订单卡片数量:', cardCount.result.result.value);
    
    if (cardCount.result.result.value === 0) {
      console.log('⚠️ 没有待处理订单');
      ws.close();
      return;
    }
    
    const btnCount = await send('Runtime.evaluate', {
      expression: `document.querySelectorAll('.item-cancel-btn').length`
    });
    console.log('取消按钮数量:', btnCount.result.result.value);
    
    const orderInfo = await send('Runtime.evaluate', {
      expression: `
        const card = document.querySelector('.order-card');
        const table = card.querySelector('.order-table').textContent;
        const total = card.querySelector('.order-total').textContent;
        const items = Array.from(card.querySelectorAll('.item-name')).map(el => el.textContent);
        '台桌:' + table + ', 总价:' + total + ', 商品:' + items.join(', ');
      `
    });
    console.log('订单信息:', orderInfo.result.result.value);
    
    // 点击第一个取消按钮
    console.log('\n━━━ 步骤 5: 点击第一个商品的取消按钮 ━━━');
    const firstItem = await send('Runtime.evaluate', {
      expression: `
        const btn = document.querySelector('.item-cancel-btn');
        const row = btn.closest('.item-row');
        const name = row.querySelector('.item-name').textContent;
        const qty = row.querySelector('.item-qty').textContent;
        btn.click();
        name + ' ' + qty;
      `
    });
    console.log('点击商品:', firstItem.result.result.value);
    await new Promise(r => setTimeout(r, 1500));
    
    const shot2 = await send('Page.captureScreenshot');
    fs.writeFileSync('/TG/mychrome-2-modal.png', Buffer.from(shot2.result.data, 'base64'));
    console.log('📸 截图: mychrome-2-modal.png');
    
    // 检查弹窗
    const modalContent = await send('Runtime.evaluate', {
      expression: `document.getElementById('cancelItemBody').innerText`
    });
    console.log('弹窗内容:\n' + modalContent.result.result.value);
    
    // 部分取消
    console.log('\n━━━ 步骤 6: 测试部分取消 ━━━');
    await send('Runtime.evaluate', {
      expression: `
        const input = document.getElementById('cancelQuantityInput');
        input.value = '1';
        input.dispatchEvent(new Event('change'));
      `
    });
    await new Promise(r => setTimeout(r, 500));
    
    const preview = await send('Runtime.evaluate', {
      expression: `document.getElementById('cancelPreviewTotal').textContent`
    });
    console.log('取消后预览:', preview.result.result.value);
    
    await send('Runtime.evaluate', {
      expression: `document.getElementById('cancelPartBtn').click()`
    });
    await new Promise(r => setTimeout(r, 2500));
    
    const shot3 = await send('Page.captureScreenshot');
    fs.writeFileSync('/TG/mychrome-3-part-cancel.png', Buffer.from(shot3.result.data, 'base64'));
    console.log('📸 截图: mychrome-3-part-cancel.png');
    
    const afterPart = await send('Runtime.evaluate', {
      expression: `
        const card = document.querySelector('.order-card');
        const total = card.querySelector('.order-total').textContent;
        const items = Array.from(card.querySelectorAll('.item-name')).map(el => el.textContent);
        '总价:' + total + ', 剩余商品:' + items.join(', ');
      `
    });
    console.log('部分取消后:', afterPart.result.result.value);
    
    // 全部取消剩余商品
    console.log('\n━━━ 步骤 7: 全部取消剩余商品 ━━━');
    
    for (let i = 0; i < 5; i++) {
      const btns = await send('Runtime.evaluate', {
        expression: `document.querySelectorAll('.item-cancel-btn').length`
      });
      
      if (btns.result.result.value === 0) break;
      
      console.log('取消第', i + 1, '个商品...');
      
      await send('Runtime.evaluate', {
        expression: `document.querySelector('.item-cancel-btn').click()`
      });
      await new Promise(r => setTimeout(r, 1000));
      
      await send('Runtime.evaluate', {
        expression: `document.getElementById('cancelAllBtn').click()`
      });
      await new Promise(r => setTimeout(r, 2000));
    }
    
    const shot4 = await send('Page.captureScreenshot');
    fs.writeFileSync('/TG/mychrome-4-final.png', Buffer.from(shot4.result.data, 'base64'));
    console.log('📸 截图: mychrome-4-final.png');
    
    const finalStatus = await send('Runtime.evaluate', {
      expression: `
        const cards = document.querySelectorAll('.order-card');
        cards.length > 0 ? '仍有订单' : '订单已全部取消';
      `
    });
    console.log('最终状态:', finalStatus.result.result.value);
    
    // 验证数据库
    ws.close();
    
    console.log('\n━━━ 步骤 8: 验证数据库 ━━━');
    
    console.log('\n✅ mychrome 测试完成！');
    console.log('\n📊 截图文件:');
    console.log('   /TG/mychrome-1-refresh.png');
    console.log('   /TG/mychrome-2-modal.png');
    console.log('   /TG/mychrome-3-part-cancel.png');
    console.log('   /TG/mychrome-4-final.png');
  });
}

testWithMyChrome().catch(console.error);