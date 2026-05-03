const https = require('https');

// 生成 coachToken
const coachNo = 10121;
const phone = '18600000004';
const coachToken = Buffer.from(`${coachNo}:${phone}:${Date.now()}`).toString('base64');

// 测试 API 响应时间
async function testAPI() {
  const start = Date.now();
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'tg.tiangong.club',
      port: 443,
      path: '/api/tea-fruit/my-stats?period=this-month',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${coachToken}`
      }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        const elapsed = Date.now() - start;
        resolve({ elapsed, statusCode: res.statusCode, bodyLength: body.length });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// 测试本地 API
async function testLocalAPI() {
  const start = Date.now();
  
  return new Promise((resolve, reject) => {
    const req = require('http').request({
      hostname: '127.0.0.1',
      port: 8088,
      path: '/api/tea-fruit/my-stats?period=this-month',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${coachToken}`
      }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        const elapsed = Date.now() - start;
        resolve({ elapsed, statusCode: res.statusCode, bodyLength: body.length });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== 测试 API 响应时间 ===\n');
  
  // 测试线上API 3次
  console.log('线上API (tg.tiangong.club):');
  for (let i = 1; i <= 3; i++) {
    const result = await testAPI();
    console.log(`第${i}次: ${result.elapsed}ms, 状态码: ${result.statusCode}, 响应大小: ${result.bodyLength}字节`);
  }
  
  console.log('\n本地API (127.0.0.1:8088):');
  for (let i = 1; i <= 3; i++) {
    const result = await testLocalAPI();
    console.log(`第${i}次: ${result.elapsed}ms, 状态码: ${result.statusCode}, 响应大小: ${result.bodyLength}字节`);
  }
}

main().catch(console.error);
