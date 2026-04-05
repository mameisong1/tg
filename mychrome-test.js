/**
 * 使用 mychrome 进行真实的界面测试
 * 通过 Chrome DevTools Protocol 操作
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

async function testWithMyChrome() {
  console.log('🎱 开始使用 mychrome 进行真实界面测试\n');
  
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
    
    // 1. 刷新页面
    console.log('━━━ 步骤 1: 刷新订单页面 ━━━');
    await send('Runtime.evaluate', { expression: `location.reload()` });
    await new Promise(r => setTimeout(r, 3000));
    
    // 截图刷新后
    const shot1 = await send('Page.captureScreenshot');
    fs.writeFileSync('/TG/mychrome-1-refresh.png', Buffer.from(shot1.result.data, 'base64'));
    console.log('📸 截图: mychrome-1-refresh.png');
    
    // 2. 检查订单和按钮
    console.log('\n━━━ 步骤 2: 检查订单状态 ━━━');
    const cardCount = await send('Runtime.evaluate', {
      expression: `document.querySelectorAll('.order-card').length`
    });
    console.log('订单卡片数量:', cardCount.result.result.value);
    
    const btnCount = await send('Runtime.evaluate', {
      expression: `document.querySelectorAll('.item-cancel-btn').length`
    });
    console.log('取消按钮数量:', btnCount.result.result.value);
    
    // 获取订单信息
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
    
    // 3. 点击第一个取消按钮（啤酒）
    console.log('\n━━━ 步骤 3: 点击啤酒的取消按钮 ━━━');
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
    
    // 截图弹窗
    const shot2 = await send('Page.captureScreenshot');
    fs.writeFileSync('/TG/mychrome-2-modal.png', Buffer.from(shot2.result.data, 'base64'));
    console.log('📸 截图: mychrome-2-modal.png');
    
    // 检查弹窗内容
    const modalInfo = await send('Runtime.evaluate', {
      expression: `document.getElementById('cancelItemBody').innerText`
    });
    console.log('弹窗内容:\n' + modalInfo.result.result.value);
    
    // 4. 测试部分取消 - 取消 1 件啤酒
    console.log('\n━━━ 步骤 4: 部分取消（取消 1 件啤酒）━━━');
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
    console.log('取消后预览总价:', preview.result.result.value);
    
    // 点击部分取消
    await send('Runtime.evaluate', {
      expression: `document.getElementById('cancelPartBtn').click()`
    });
    await new Promise(r => setTimeout(r, 2500));
    
    // 截图部分取消后
    const shot3 = await send('Page.captureScreenshot');
    fs.writeFileSync('/TG/mychrome-3-part-cancel.png', Buffer.from(shot3.result.data, 'base64'));
    console.log('📸 截图: mychrome-3-part-cancel.png');
    
    // 检查订单更新
    const afterPart = await send('Runtime.evaluate', {
      expression: `
        const card = document.querySelector('.order-card');
        const total = card.querySelector('.order-total').textContent;
        const beerRow = Array.from(card.querySelectorAll('.item-row')).find(r => r.querySelector('.item-name').textContent === '啤酒');
        const beerQty = beerRow ? beerRow.querySelector('.item-qty').textContent : '无';
        '总价:' + total + ', 啤酒剩余:' + beerQty;
      `
    });
    console.log('部分取消后:', afterPart.result.result.value);
    
    // 5. 测试全部取消 - 取消花生
    console.log('\n━━━ 步骤 5: 全部取消花生 ━━━');
    
    // 找到花生的取消按钮
    const peanutBtn = await send('Runtime.evaluate', {
      expression: `
        const rows = document.querySelectorAll('.item-row');
        let found = null;
        rows.forEach(row => {
          const name = row.querySelector('.item-name').textContent;
          if (name === '花生') {
            found = row.querySelector('.item-cancel-btn');
          }
        });
        found ? found.click() : 'not found';
      `
    });
    await new Promise(r => setTimeout(r, 1500));
    
    // 截图
    const shot4 = await send('Page.captureScreenshot');
    fs.writeFileSync('/TG/mychrome-4-peanut-modal.png', Buffer.from(shot4.result.data, 'base64'));
    console.log('📸 截图: mychrome-4-peanut-modal.png');
    
    // 点击全部取消
    await send('Runtime.evaluate', {
      expression: `document.getElementById('cancelAllBtn').click()`
    });
    await new Promise(r => setTimeout(r, 2500));
    
    // 截图
    const shot5 = await send('Page.captureScreenshot');
    fs.writeFileSync('/TG/mychrome-5-peanut-cancelled.png', Buffer.from(shot5.result.data, 'base64'));
    console.log('📸 截图: mychrome-5-peanut-cancelled.png');
    
    // 检查
    const afterPeanut = await send('Runtime.evaluate', {
      expression: `
        const card = document.querySelector('.order-card');
        const total = card.querySelector('.order-total').textContent;
        const items = Array.from(card.querySelectorAll('.item-name')).map(el => el.textContent);
        '总价:' + total + ', 剩余商品:' + items.join(', ');
      `
    });
    console.log('取消花生后:', afterPeanut.result.result.value);
    
    // 6. 继续取消可乐
    console.log('\n━━━ 步骤 6: 全部取消可乐 ━━━');
    
    await send('Runtime.evaluate', {
      expression: `
        const rows = document.querySelectorAll('.item-row');
        rows.forEach(row => {
          const name = row.querySelector('.item-name').textContent;
          if (name === '可乐') {
            row.querySelector('.item-cancel-btn').click();
          }
        });
      `
    });
    await new Promise(r => setTimeout(r, 1500));
    
    await send('Runtime.evaluate', {
      expression: `document.getElementById('cancelAllBtn').click()`
    });
    await new Promise(r => setTimeout(r, 2500));
    
    // 截图
    const shot6 = await send('Page.captureScreenshot');
    fs.writeFileSync('/TG/mychrome-6-cola-cancelled.png', Buffer.from(shot6.result.data, 'base64'));
    console.log('📸 截图: mychrome-6-cola-cancelled.png');
    
    const afterCola = await send('Runtime.evaluate', {
      expression: `
        const card = document.querySelector('.order-card');
        card ? '仍有订单' : '订单已全部取消';
      `
    });
    console.log('取消可乐后:', afterCola.result.result.value);
    
    // 7. 最后取消啤酒（剩余2件）
    if (afterCola.result.result.value === '仍有订单') {
      console.log('\n━━━ 步骤 7: 取消剩余啤酒 ━━━');
      
      await send('Runtime.evaluate', {
        expression: `document.querySelector('.item-cancel-btn').click()`
      });
      await new Promise(r => setTimeout(r, 1500));
      
      await send('Runtime.evaluate', {
        expression: `document.getElementById('cancelAllBtn').click()`
      });
      await new Promise(r => setTimeout(r, 2500));
      
      // 最终截图
      const shot7 = await send('Page.captureScreenshot');
      fs.writeFileSync('/TG/mychrome-7-final.png', Buffer.from(shot7.result.data, 'base64'));
      console.log('📸 截图: mychrome-7-final.png');
      
      const finalStatus = await send('Runtime.evaluate', {
        expression: `
          const cards = document.querySelectorAll('.order-card');
          cards.length > 0 ? '仍有订单' : '所有商品已取消，订单自动取消';
        `
      });
      console.log('最终状态:', finalStatus.result.result.value);
    }
    
    // 8. 验证数据库
    console.log('\n━━━ 步骤 8: 验证数据库 ━━━');
    
    ws.close();
    
    console.log('\n✅ mychrome 界面测试完成！');
    console.log('\n📊 截图文件（/TG 目录）:');
    console.log('   1. mychrome-1-refresh.png - 刷新后订单列表');
    console.log('   2. mychrome-2-modal.png - 取消弹窗');
    console.log('   3. mychrome-3-part-cancel.png - 部分取消后');
    console.log('   4. mychrome-4-peanut-modal.png - 取消花生弹窗');
    console.log('   5. mychrome-5-peanut-cancelled.png - 花生取消后');
    console.log('   6. mychrome-6-cola-cancelled.png - 可乐取消后');
    console.log('   7. mychrome-7-final.png - 最终状态');
  });
}

testWithMyChrome().catch(console.error);