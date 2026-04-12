/**
 * 购物车事务修复验证测试
 * 验证 BEGIN IMMEDIATE 事务能正确处理并发购物车操作
 */

const http = require('http');

const BASE = 'http://localhost:8088';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'localhost',
      port: 8088,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = http.request(opts, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(buf) });
        } catch {
          resolve({ status: res.statusCode, body: buf });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(buf) });
        } catch {
          resolve({ status: res.statusCode, body: buf });
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const sessionId = 'test_tx_' + Date.now();
  let pass = 0, fail = 0;

  console.log('=== 测试1: 添加商品到空购物车 (INSERT) ===');
  const r1 = await post('/api/cart', {
    sessionId, tableNo: '测试桌', productName: '测试商品A', quantity: 2
  });
  if (r1.status === 200 && r1.body.success) {
    console.log('  ✅ PASS'); pass++;
  } else {
    console.log('  ❌ FAIL:', r1); fail++;
  }

  console.log('=== 测试2: 再次添加相同商品 (UPDATE quantity) ===');
  const r2 = await post('/api/cart', {
    sessionId, tableNo: '测试桌', productName: '测试商品A', quantity: 3
  });
  if (r2.status === 200 && r2.body.success) {
    console.log('  ✅ PASS'); pass++;
  } else {
    console.log('  ❌ FAIL:', r2); fail++;
  }

  console.log('=== 测试3: 读取购物车验证数量 ===');
  const r3 = await get(`/api/cart/${sessionId}`);
  if (r3.status === 200 && r3.body.items && r3.body.items.length === 1 && r3.body.items[0].quantity === 5) {
    console.log('  ✅ PASS (quantity=5)'); pass++;
  } else {
    console.log('  ❌ FAIL:', r3.body); fail++;
  }

  console.log('=== 测试4: 添加不同商品 ===');
  const r4 = await post('/api/cart', {
    sessionId, tableNo: '测试桌', productName: '测试商品B', quantity: 1
  });
  if (r4.status === 200 && r4.body.success) {
    console.log('  ✅ PASS'); pass++;
  } else {
    console.log('  ❌ FAIL:', r4); fail++;
  }

  console.log('=== 测试5: 并发添加10个不同商品 ===');
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(post('/api/cart', {
      sessionId, tableNo: '测试桌', productName: `并发商品${i}`, quantity: 1
    }));
  }
  const results = await Promise.all(promises);
  const successCount = results.filter(r => r.status === 200 && r.body.success).length;
  if (successCount === 10) {
    console.log('  ✅ PASS (10/10 成功)'); pass++;
  } else {
    console.log(`  ❌ FAIL: ${successCount}/10 成功`); 
    results.filter(r => !(r.status === 200 && r.body.success)).forEach(r => console.log('    失败:', r.body));
    fail++;
  }

  console.log('=== 测试6: 并发重复添加同一商品10次 ===');
  const sessionId2 = 'test_tx_concurrent_' + Date.now();
  const promises2 = [];
  for (let i = 0; i < 10; i++) {
    promises2.push(post('/api/cart', {
      sessionId: sessionId2, tableNo: '测试桌', productName: '并发测试品', quantity: 1
    }));
  }
  const results2 = await Promise.all(promises2);
  const successCount2 = results2.filter(r => r.status === 200 && r.body.success).length;
  if (successCount2 === 10) {
    console.log('  ✅ PASS (10/10 成功)'); pass++;
  } else {
    console.log(`  ❌ FAIL: ${successCount2}/10 成功`);
    fail++;
  }

  // 验证数量
  const r6 = await get(`/api/cart/${sessionId2}`);
  if (r6.body.items && r6.body.items.length === 1 && r6.body.items[0].quantity === 10) {
    console.log('  ✅ 数量验证 PASS (quantity=10)'); pass++;
  } else {
    console.log('  ❌ 数量验证 FAIL:', r6.body); fail++;
  }

  console.log('\n========== 汇总 ==========');
  console.log(`通过: ${pass} | 失败: ${fail}`);
  if (fail === 0) {
    console.log('🎉 全部测试通过！事务修复有效。');
  } else {
    console.log('⚠️ 有测试失败，请检查。');
  }

  // 清理测试数据
  await post('/api/cart', { sessionId, productName: '测试商品A' });
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(err => { console.error('测试异常:', err); process.exit(1); });
