const https = require('https');
const http = require('http');

// 用 coachToken
const coachNo = 10121;
const phone = '18600000004';
const coachToken = Buffer.from(`${coachNo}:${phone}:${Date.now()}`).toString('base64');

async function testAPI(token) {
  const start = Date.now();
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'tg.tiangong.club',
      port: 443,
      path: '/api/tea-fruit/coach-detail?coach_no=10121&period=this-month&type=tea',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
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

async function testLocalAPI(token) {
  const start = Date.now();
  
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 8088,
      path: '/api/tea-fruit/coach-detail?coach_no=10121&period=this-month&type=tea',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
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
  console.log('=== 测试 coach-detail API 响应时间 ===\n');
  
  console.log('本地API (127.0.0.1:8088) - 奶茶明细:');
  for (let i = 1; i <= 5; i++) {
    const result = await testLocalAPI(coachToken);
    console.log(`第${i}次: ${result.elapsed}ms, 状态码: ${result.statusCode}, 响应大小: ${result.bodyLength}字节`);
  }
  
  console.log('\n本地API - 果盘明细:');
  for (let i = 1; i <= 5; i++) {
    const start = Date.now();
    const result = await new Promise((resolve, reject) => {
      http.request({
        hostname: '127.0.0.1',
        port: 8088,
        path: '/api/tea-fruit/coach-detail?coach_no=10121&period=this-month&type=fruit',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${coachToken}` }
      }, res => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => resolve({ elapsed: Date.now() - start, statusCode: res.statusCode }));
      }).on('error', reject).end();
    });
    console.log(`第${i}次: ${result.elapsed}ms, 状态码: ${result.statusCode}`);
  }
  
  console.log('\n线上API (tg.tiangong.club) - 奶茶明细:');
  for (let i = 1; i <= 3; i++) {
    const result = await testAPI(coachToken);
    console.log(`第${i}次: ${result.elapsed}ms, 状态码: ${result.statusCode}`);
  }
}

main().catch(console.error);
