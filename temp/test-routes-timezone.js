/**
 * 测试路由时区修复
 * 测试环境: tg.tiangong.club
 */

const https = require('https');

const BASE = 'https://tg.tiangong.club';

function api(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const req = https.request(url.toString(), {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ _raw: data.substring(0, 200) });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function main() {
  console.log('=== 路由时区修复测试 ===\n');
  let passed = 0, failed = 0;

  // 1. 登录
  console.log('1. 登录获取 token...');
  const loginRes = await api('/api/admin/login', {
    method: 'POST',
    body: { username: 'tgadmin', password: 'mms633268' }
  });
  if (!loginRes.token) {
    console.log('   ❌ 登录失败:', loginRes);
    return;
  }
  console.log('   ✅ 登录成功\n');
  const auth = { Authorization: `Bearer ${loginRes.token}` };

  // 2. 获取当前北京时间
  const now = new Date();
  const beijingDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const beijingTime = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  console.log(`当前北京时间: ${beijingDate} ${beijingTime.split(' ')[1]}\n`);

  // 3. 测试约客记录列表（验证 today 日期格式）
  console.log('2. 测试 /api/guest-invitations （获取约客列表）...');
  try {
    const invRes = await api('/api/guest-invitations', { headers: auth });
    if (invRes.success && Array.isArray(invRes.data)) {
      console.log(`   ✅ 返回 ${invRes.data.length} 条约客记录`);
      
      // 检查日期格式
      if (invRes.data.length > 0) {
        const first = invRes.data[0];
        if (first.date && /^\d{4}-\d{2}-\d{2}$/.test(first.date)) {
          console.log(`   ✅ 日期格式正确: ${first.date}`);
          passed++;
        } else {
          console.log(`   ❌ 日期格式错误: ${first.date}`);
          failed++;
        }
      }
    } else {
      console.log(`   ⚠️ 返回格式异常:`, JSON.stringify(invRes).substring(0, 100));
    }
  } catch (e) {
    console.log(`   ❌ 请求失败: ${e.message}`);
    failed++;
  }

  // 4. 测试约客统计（验证 generated_at 返回北京时间）
  console.log('\n3. 测试 /api/guest-invitations/statistics （生成统计）...');
  try {
    const statsRes = await api('/api/guest-invitations/statistics', {
      method: 'POST',
      headers: auth,
      body: { date: beijingDate, shift: '早班' }
    });
    if (statsRes.success && statsRes.data) {
      const genAt = statsRes.data.generated_at;
      console.log(`   generated_at: ${genAt}`);
      
      // 检查是否为北京时间格式（包含 +08 或无 Z 后缀）
      if (genAt && (genAt.includes('+08') || (!genAt.endsWith('Z') && genAt.includes('T') === false))) {
        console.log(`   ✅ 时间格式正确（北京时间）`);
        passed++;
      } else if (genAt && genAt.includes('Z')) {
        console.log(`   ❌ 时间格式为 UTC（以 Z 结尾）`);
        failed++;
      } else if (genAt && genAt.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        console.log(`   ✅ 时间格式正确（YYYY-MM-DD HH:MM:SS）`);
        passed++;
      } else {
        console.log(`   ⚠️ 时间格式: ${genAt}`);
      }
    } else {
      console.log(`   ⚠️ 返回格式异常:`, JSON.stringify(statsRes).substring(0, 150));
    }
  } catch (e) {
    console.log(`   ❌ 请求失败: ${e.message}`);
  }

  // 5. 测试审批时间（applications.js）
  console.log('\n4. 测试 /api/applications （获取申请列表）...');
  try {
    const appsRes = await api('/api/applications', { headers: auth });
    if (appsRes.success && Array.isArray(appsRes.data)) {
      console.log(`   ✅ 返回 ${appsRes.data.length} 条申请记录`);
      passed++;
    } else {
      console.log(`   ⚠️ 返回格式异常:`, JSON.stringify(appsRes).substring(0, 100));
    }
  } catch (e) {
    console.log(`   ❌ 请求失败: ${e.message}`);
  }

  // 6. 验证 TimeUtil 模块加载
  console.log('\n5. 验证路由文件中 TimeUtil 模块加载...');
  const fs = require('fs');
  const guestInv = fs.readFileSync('/TG/tgservice/backend/routes/guest-invitations.js', 'utf-8');
  const apps = fs.readFileSync('/TG/tgservice/backend/routes/applications.js', 'utf-8');
  
  if (guestInv.includes("require('../utils/time')") || guestInv.includes("require('../utils/time')")) {
    console.log('   ✅ guest-invitations.js 已引入 TimeUtil');
    passed++;
  } else {
    console.log('   ❌ guest-invitations.js 未引入 TimeUtil');
    failed++;
  }
  
  if (apps.includes("require('../utils/time')")) {
    console.log('   ✅ applications.js 已引入 TimeUtil');
    passed++;
  } else {
    console.log('   ❌ applications.js 未引入 TimeUtil');
    failed++;
  }

  // 7. 验证无 toISOString 残留
  console.log('\n6. 验证无 toISOString 业务逻辑残留...');
  if (!guestInv.includes('.toISOString()') || guestInv.includes('//')) {
    const hasISO = guestInv.match(/\.toISOString\(\)/g);
    if (!hasISO) {
      console.log('   ✅ guest-invitations.js 无 toISOString() 残留');
      passed++;
    } else {
      console.log(`   ❌ guest-invitations.js 仍有 ${hasISO.length} 处 toISOString()`);
      failed++;
    }
  } else {
    console.log('   ✅ guest-invitations.js 无 toISOString() 残留');
    passed++;
  }
  
  if (!apps.includes('.toISOString()')) {
    console.log('   ✅ applications.js 无 toISOString() 残留');
    passed++;
  } else {
    console.log('   ❌ applications.js 仍有 toISOString() 残留');
    failed++;
  }

  console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===`);
}

main().catch(e => {
  console.error('测试失败:', e.message);
  process.exit(1);
});
