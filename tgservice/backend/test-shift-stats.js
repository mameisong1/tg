/**
 * 班次统计 API 测试
 * 测试目标：验证排除离职、新增兼职统计
 */

const http = require('http');

const API_HOST = '127.0.0.1';
const API_PORT = 8088;

function sendRequest(path, method, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('\n============================================');
  console.log('  班次统计 API 测试');
  console.log('  测试时间: ' + new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
  console.log('============================================\n');

  // 测试 API 返回
  const result = await sendRequest('/api/applications/shift-stats', 'GET');
  
  console.log('API 返回结果:');
  console.log(JSON.stringify(result.data, null, 2));
  
  if (result.status === 200 && result.data.success) {
    const stats = result.data.data;
    
    console.log('\n============================================');
    console.log('  统计结果验证');
    console.log('============================================\n');
    
    console.log(`早班全职: ${stats.early_shift} 人`);
    console.log(`晚班全职: ${stats.late_shift} 人`);
    console.log(`兼职: ${stats.part_time} 人`);
    console.log(`总计: ${stats.total} 人`);
    
    // 验证逻辑
    const expectedTotal = stats.early_shift + stats.late_shift + stats.part_time;
    const correctTotal = stats.total === expectedTotal;
    const noResigned = stats.total === 50; // 预期 50 人（排除离职）
    
    console.log('\n============================================');
    console.log('  测试结果');
    console.log('============================================\n');
    
    console.log(`${correctTotal ? '✅' : '❌'} 总计计算正确: ${stats.total} = ${stats.early_shift} + ${stats.late_shift} + ${stats.part_time}`);
    console.log(`${noResigned ? '✅' : '❌'} 排除离职: 总计应为 50 人，实际 ${stats.total} 人`);
    
    if (correctTotal && noResigned) {
      console.log('\n✅ 所有测试通过！');
    } else {
      console.log('\n❌ 测试失败，请检查数据！');
    }
  } else {
    console.log('❌ API 请求失败:', result.status, result.data);
  }
}

runTests().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});