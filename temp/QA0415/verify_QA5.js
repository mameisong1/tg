/**
 * QA5 验证测试：重试确认水牌是否真的未创建
 */

let token = '';

async function api(path, options = {}) {
  const url = `http://localhost:8081${path}`;
  const opts = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (options.body) opts.body = JSON.stringify(options.body);
  const res = await fetch(url, opts);
  const text = await res.text();
  return JSON.parse(text);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getWaterBoardByCoachNo(coachNo, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const data = await api('/api/water-boards');
    const wb = (data.data || []).find(w => Number(w.coach_no) === Number(coachNo));
    if (wb) return wb;
    if (i < maxRetries - 1) {
      console.log(`  第${i+1}次重试，等待500ms...`);
      await sleep(500);
    }
  }
  return null;
}

async function run() {
  // 登录
  const loginData = await api('/api/admin/login', {
    method: 'POST',
    body: { username: 'tgadmin', password: 'mms633268' }
  });
  token = loginData.token;
  console.log('登录成功');

  // === 验证 TC-03: 离职改全职 - 找一名离职教练改全职，检查水牌 ===
  console.log('\n=== 验证 TC-03: 离职改全职 ===');
  const coaches = await api('/api/admin/coaches');
  const resignedCoach = coaches.find(c => c.status === '离职');
  
  if (!resignedCoach) {
    console.log('没有离职教练，先创建一个');
    await api('/api/admin/coaches', {
      method: 'POST',
      body: {
        employeeId: '9990', stageName: '验证改全职', realName: '测试',
        phone: '13800000001', level: '初级', price: 109, shift: '早班', status: '离职'
      }
    });
    const c2 = await api('/api/admin/coaches');
    var testCoach = c2.find(c => c.stage_name === '验证改全职');
  } else {
    var testCoach = resignedCoach;
  }
  
  console.log(`测试教练: ${testCoach.coach_no} (${testCoach.stage_name}), status=${testCoach.status}`);
  
  // 确认没有水牌
  const wbBefore = await getWaterBoardByCoachNo(testCoach.coach_no);
  console.log(`修改前水牌: ${wbBefore ? wbBefore.status : '无'}`);
  
  // 改为全职
  const updateResult = await api(`/api/admin/coaches/${testCoach.coach_no}`, {
    method: 'PUT',
    body: {
      employeeId: testCoach.employee_id, stageName: testCoach.stage_name,
      level: testCoach.level || '初级', price: testCoach.price || 109,
      shift: testCoach.shift || '早班', status: '全职'
    }
  });
  console.log(`更新结果: ${JSON.stringify(updateResult)}`);
  
  // 等待2秒再检查
  await sleep(2000);
  const wbAfter = await getWaterBoardByCoachNo(testCoach.coach_no, 1);
  console.log(`修改后水牌: ${wbAfter ? JSON.stringify(wbAfter) : '无'}`);
  console.log(wbAfter ? '✅ TC-03 PASS - 水牌已创建' : '❌ TC-03 FAIL - 水牌未创建');

  // === 验证 TC-07: 创建新助教 ===
  console.log('\n=== 验证 TC-07: 创建新助教 ===');
  const newStageName = '验证新助教_' + Date.now().toString().slice(-4);
  const created = await api('/api/admin/coaches', {
    method: 'POST',
    body: {
      employeeId: '9991', stageName: newStageName, realName: '测试',
      phone: '13800000002', level: '初级', price: 109, shift: '早班', status: '全职'
    }
  });
  console.log(`创建结果: ${JSON.stringify(created)}`);
  
  await sleep(2000);
  
  if (created.success) {
    const allCoaches = await api('/api/admin/coaches');
    const newCoach = allCoaches.find(c => c.stage_name === newStageName);
    console.log(`新教练: ${newCoach ? newCoach.coach_no : '未找到'}`);
    
    if (newCoach) {
      const wb = await getWaterBoardByCoachNo(newCoach.coach_no, 1);
      console.log(`新教练水牌: ${wb ? JSON.stringify(wb) : '无'}`);
      console.log(wb ? '✅ TC-07 PASS - 水牌已创建' : '❌ TC-07 FAIL - 水牌未创建');
    }
  }

  // 恢复测试教练为离职
  if (testCoach) {
    await api(`/api/admin/coaches/${testCoach.coach_no}`, {
      method: 'PUT',
      body: {
        employeeId: testCoach.employee_id, stageName: testCoach.stage_name,
        level: testCoach.level || '初级', price: testCoach.price || 109,
        shift: testCoach.shift || '早班', status: '离职'
      }
    });
  }

  console.log('\n=== 验证完成 ===');
}

run().catch(err => console.error('错误:', err));
