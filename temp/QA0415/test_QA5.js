/**
 * QA5 测试脚本 v2：后台admin助教管理-水牌联动
 * 修复：添加延迟等待异步 enqueueRun 完成
 */

const results = [];
let token = '';

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function addResult(tc, status, detail) { results.push({ tc, status, detail, time: new Date().toISOString() }); log(`${status} - ${tc}: ${detail}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function api(path, options = {}) {
  const url = `http://localhost:8081${path}`;
  const opts = { method: options.method || 'GET', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }};
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (options.body) opts.body = JSON.stringify(options.body);
  const res = await fetch(url, opts);
  const text = await res.text();
  return JSON.parse(text);
}

async function getCoaches() { return api('/api/admin/coaches'); }

async function getWaterBoards() {
  const data = await api('/api/water-boards');
  return data.data || [];
}

async function findWaterBoardByCoachNo(coachNo, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const wbList = await getWaterBoards();
    const wb = wbList.find(w => String(w.coach_no) === String(coachNo));
    if (wb) return wb;
    if (i < retries - 1) { log(`  等待水牌数据同步 (${i+1}/${retries})...`); await sleep(1000); }
  }
  return null;
}

async function login() {
  const data = await api('/api/admin/login', { method: 'POST', body: { username: 'tgadmin', password: 'mms633268' }});
  if (data.token) { token = data.token; log('登录成功'); return true; }
  log('登录失败: ' + JSON.stringify(data)); return false;
}

async function createCoach(employeeId, stageName, status, shift) {
  return api('/api/admin/coaches', { method: 'POST', body: {
    employeeId: String(employeeId), stageName, realName: '测试' + stageName,
    phone: '138' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0'),
    level: '初级', price: 109, shift: shift || '早班', status: status || '全职'
  }});
}

async function runTests() {
  log('=== QA5 水牌联动测试 v2 ===');
  if (!await login()) { addResult('ALL', 'FAIL', '登录失败'); return results; }

  let coaches = await getCoaches();
  log(`当前教练: ${coaches.length} 人`);

  // ============ TC-01: 删除离职助教 ============
  log('\n--- TC-01: 删除离职助教 ---');
  try {
    let resigned = coaches.filter(c => c.status === '离职');
    let testNo, testName;
    if (resigned.length > 0) {
      testNo = resigned[0].coach_no; testName = resigned[0].stage_name;
    } else {
      await createCoach(9901, '测试删除QA5', '离职', '早班');
      await sleep(1000);
      coaches = await getCoaches();
      const c = coaches.find(x => x.stage_name === '测试删除QA5');
      if (c) { testNo = c.coach_no; testName = c.stage_name; }
    }
    if (!testNo) { addResult('TC-01', 'FAIL', '无法获取测试教练'); }
    else {
      const wbBefore = await findWaterBoardByCoachNo(testNo);
      log(`删除前水牌: ${wbBefore ? wbBefore.status : '无'}`);
      const delResult = await api(`/api/admin/coaches/${testNo}`, { method: 'DELETE' });
      if (delResult.success) {
        await sleep(1000);
        coaches = await getCoaches();
        const stillExists = coaches.find(c => String(c.coach_no) === String(testNo));
        if (!stillExists) {
          const wbAfter = await findWaterBoardByCoachNo(testNo, 1);
          addResult('TC-01', wbAfter ? 'FAIL' : 'PASS', wbAfter ? '水牌未删除' : `教练${testNo}及水牌均已删除`);
        } else { addResult('TC-01', 'FAIL', '教练未被删除'); }
      } else { addResult('TC-01', 'FAIL', `删除失败: ${delResult.error}`); }
    }
  } catch (err) { addResult('TC-01', 'FAIL', `异常: ${err.message}`); }

  // ============ TC-02: 全职改离职 ============
  log('\n--- TC-02: 全职改为离职 ---');
  try {
    coaches = await getCoaches();
    let fullTime = coaches.filter(c => c.status === '全职');
    let testNo, testName;
    if (fullTime.length > 0) {
      testNo = fullTime[0].coach_no; testName = fullTime[0].stage_name;
    } else {
      await createCoach(9902, '测试改离职QA5', '全职', '早班');
      await sleep(1000);
      coaches = await getCoaches();
      const c = coaches.find(x => x.stage_name === '测试改离职QA5');
      if (c) { testNo = c.coach_no; testName = c.stage_name; }
    }
    if (!testNo) { addResult('TC-02', 'FAIL', '无法获取测试教练'); }
    else {
      const wbBefore = await findWaterBoardByCoachNo(testNo);
      log(`教练${testNo}(${testName}) 修改前水牌: ${wbBefore ? wbBefore.status : '无'}`);
      if (!wbBefore) { addResult('TC-02', 'SKIP', `教练${testNo}没有水牌`); }
      else {
        const c = coaches.find(x => String(x.coach_no) === String(testNo));
        const updateResult = await api(`/api/admin/coaches/${testNo}`, { method: 'PUT', body: {
          employeeId: c.employee_id, stageName: testName, level: c.level || '初级',
          price: c.price || 109, shift: c.shift || '早班', status: '离职'
        }});
        if (updateResult.success) {
          await sleep(1000);
          const wbAfter = await findWaterBoardByCoachNo(testNo, 1);
          addResult('TC-02', wbAfter ? 'FAIL' : 'PASS', wbAfter ? `水牌未删除(${wbAfter.status})` : '改为离职后水牌已删除');
        } else { addResult('TC-02', 'FAIL', `更新失败: ${JSON.stringify(updateResult)}`); }
      }
    }
  } catch (err) { addResult('TC-02', 'FAIL', `异常: ${err.message}`); }

  // ============ TC-03: 离职改全职 ============
  log('\n--- TC-03: 离职改为全职 ---');
  try {
    coaches = await getCoaches();
    let resigned = coaches.filter(c => c.status === '离职');
    let testNo, testName;
    // 找一名确认没有水牌的离职教练
    for (const c of resigned) {
      const wb = await findWaterBoardByCoachNo(c.coach_no, 1);
      if (!wb) { testNo = c.coach_no; testName = c.stage_name; break; }
    }
    // 如果没有无水印的，就创建一个
    if (!testNo) {
      await createCoach(9903, '测试改全职QA5', '离职', '早班');
      await sleep(1000);
      coaches = await getCoaches();
      const c = coaches.find(x => x.stage_name === '测试改全职QA5');
      if (c) { testNo = c.coach_no; testName = c.stage_name; }
    }
    if (!testNo) { addResult('TC-03', 'FAIL', '无法获取测试教练'); }
    else {
      const wbBefore = await findWaterBoardByCoachNo(testNo, 1);
      log(`教练${testNo}(${testName}) 修改前水牌: ${wbBefore ? wbBefore.status : '无'}`);
      if (wbBefore) { addResult('TC-03', 'SKIP', `教练${testNo}已有水牌`); }
      else {
        const c = coaches.find(x => String(x.coach_no) === String(testNo));
        const updateResult = await api(`/api/admin/coaches/${testNo}`, { method: 'PUT', body: {
          employeeId: c.employee_id, stageName: testName, level: c.level || '初级',
          price: c.price || 109, shift: c.shift || '早班', status: '全职'
        }});
        if (updateResult.success) {
          await sleep(2000);
          const wbAfter = await findWaterBoardByCoachNo(testNo, 3);
          if (wbAfter) {
            addResult('TC-03', 'PASS', `改为全职后水牌已创建，状态=${wbAfter.status}`);
            // 恢复为离职以便后续测试
            await api(`/api/admin/coaches/${testNo}`, { method: 'PUT', body: {
              employeeId: c.employee_id, stageName: testName, level: c.level || '初级',
              price: c.price || 109, shift: c.shift || '早班', status: '离职'
            }});
          } else {
            addResult('TC-03', 'FAIL', '水牌未创建');
          }
        } else { addResult('TC-03', 'FAIL', `更新失败: ${JSON.stringify(updateResult)}`); }
      }
    }
  } catch (err) { addResult('TC-03', 'FAIL', `异常: ${err.message}`); }

  // ============ TC-04: 离职改兼职 ============
  log('\n--- TC-04: 离职改为兼职 ---');
  try {
    coaches = await getCoaches();
    let resigned = coaches.filter(c => c.status === '离职');
    let testNo, testName;
    for (const c of resigned) {
      const wb = await findWaterBoardByCoachNo(c.coach_no, 1);
      if (!wb) { testNo = c.coach_no; testName = c.stage_name; break; }
    }
    if (!testNo) {
      await createCoach(9904, '测试改兼职QA5', '离职', '早班');
      await sleep(1000);
      coaches = await getCoaches();
      const c = coaches.find(x => x.stage_name === '测试改兼职QA5');
      if (c) { testNo = c.coach_no; testName = c.stage_name; }
    }
    if (!testNo) { addResult('TC-04', 'FAIL', '无法获取测试教练'); }
    else {
      const wbBefore = await findWaterBoardByCoachNo(testNo, 1);
      log(`教练${testNo}(${testName}) 修改前水牌: ${wbBefore ? wbBefore.status : '无'}`);
      if (wbBefore) { addResult('TC-04', 'SKIP', `教练${testNo}已有水牌`); }
      else {
        const c = coaches.find(x => String(x.coach_no) === String(testNo));
        const updateResult = await api(`/api/admin/coaches/${testNo}`, { method: 'PUT', body: {
          employeeId: c.employee_id, stageName: testName, level: c.level || '初级',
          price: c.price || 109, shift: c.shift || '早班', status: '兼职'
        }});
        if (updateResult.success) {
          await sleep(2000);
          const wbAfter = await findWaterBoardByCoachNo(testNo, 3);
          if (wbAfter) {
            addResult('TC-04', 'PASS', `改为兼职后水牌已创建，状态=${wbAfter.status}`);
          } else {
            addResult('TC-04', 'FAIL', '水牌未创建');
          }
        } else { addResult('TC-04', 'FAIL', `更新失败: ${JSON.stringify(updateResult)}`); }
      }
    }
  } catch (err) { addResult('TC-04', 'FAIL', `异常: ${err.message}`); }

  // ============ TC-05: 早班→晚班 ============
  log('\n--- TC-05: 修改班次 早班→晚班 ---');
  try {
    coaches = await getCoaches();
    let earlyShift = coaches.filter(c => c.shift === '早班' && c.status !== '离职');
    let testNo, testName;
    for (const c of earlyShift) {
      const wb = await findWaterBoardByCoachNo(c.coach_no, 1);
      if (wb && (wb.status.includes('早班'))) { testNo = c.coach_no; testName = c.stage_name; break; }
    }
    if (!testNo) {
      await createCoach(9905, '测试改晚班QA5', '全职', '早班');
      await sleep(2000);
      coaches = await getCoaches();
      const c = coaches.find(x => x.stage_name === '测试改晚班QA5');
      if (c) { testNo = c.coach_no; testName = c.stage_name; }
    }
    if (!testNo) { addResult('TC-05', 'FAIL', '无法获取测试教练'); }
    else {
      const wbBefore = await findWaterBoardByCoachNo(testNo);
      if (!wbBefore) { addResult('TC-05', 'SKIP', `教练${testNo}没有水牌`); }
      else {
        const oldStatus = wbBefore.status;
        log(`教练${testNo}(${testName}) 原水牌状态: ${oldStatus}`);
        const shiftResult = await api(`/api/admin/coaches/${testNo}/shift`, { method: 'PUT', body: { shift: '晚班' }});
        if (shiftResult.success) {
          await sleep(1500);
          const wbAfter = await findWaterBoardByCoachNo(testNo);
          const statusMap = { '早班空闲':'晚班空闲','晚班空闲':'早班空闲','早班上桌':'晚班上桌','晚班上桌':'早班上桌','早加班':'晚加班','晚加班':'早加班' };
          const expected = statusMap[oldStatus];
          if (wbAfter && wbAfter.status === expected) {
            addResult('TC-05', 'PASS', `班次改为晚班，水牌 ${oldStatus}→${wbAfter.status}`);
          } else if (wbAfter) {
            addResult('TC-05', 'FAIL', `水牌 ${oldStatus}→${wbAfter.status}，预期 ${expected}`);
          } else { addResult('TC-05', 'FAIL', '水牌记录消失'); }
        } else { addResult('TC-05', 'FAIL', `修改失败: ${JSON.stringify(shiftResult)}`); }
      }
    }
  } catch (err) { addResult('TC-05', 'FAIL', `异常: ${err.message}`); }

  // ============ TC-06: 晚班→早班 ============
  log('\n--- TC-06: 修改班次 晚班→早班 ---');
  try {
    coaches = await getCoaches();
    let lateShift = coaches.filter(c => c.shift === '晚班' && c.status !== '离职');
    let testNo, testName;
    for (const c of lateShift) {
      const wb = await findWaterBoardByCoachNo(c.coach_no, 1);
      if (wb && (wb.status.includes('晚班'))) { testNo = c.coach_no; testName = c.stage_name; break; }
    }
    if (!testNo) {
      await createCoach(9906, '测试改早班QA5', '全职', '晚班');
      await sleep(2000);
      coaches = await getCoaches();
      const c = coaches.find(x => x.stage_name === '测试改早班QA5');
      if (c) { testNo = c.coach_no; testName = c.stage_name; }
    }
    if (!testNo) { addResult('TC-06', 'FAIL', '无法获取测试教练'); }
    else {
      const wbBefore = await findWaterBoardByCoachNo(testNo);
      if (!wbBefore) { addResult('TC-06', 'SKIP', `教练${testNo}没有水牌`); }
      else {
        const oldStatus = wbBefore.status;
        log(`教练${testNo}(${testName}) 原水牌状态: ${oldStatus}`);
        const shiftResult = await api(`/api/admin/coaches/${testNo}/shift`, { method: 'PUT', body: { shift: '早班' }});
        if (shiftResult.success) {
          await sleep(1500);
          const wbAfter = await findWaterBoardByCoachNo(testNo);
          const statusMap = { '早班空闲':'晚班空闲','晚班空闲':'早班空闲','早班上桌':'晚班上桌','晚班上桌':'早班上桌','早加班':'晚加班','晚加班':'早加班' };
          const expected = statusMap[oldStatus];
          if (wbAfter && wbAfter.status === expected) {
            addResult('TC-06', 'PASS', `班次改为早班，水牌 ${oldStatus}→${wbAfter.status}`);
          } else if (wbAfter) {
            addResult('TC-06', 'FAIL', `水牌 ${oldStatus}→${wbAfter.status}，预期 ${expected}`);
          } else { addResult('TC-06', 'FAIL', '水牌记录消失'); }
        } else { addResult('TC-06', 'FAIL', `修改失败: ${JSON.stringify(shiftResult)}`); }
      }
    }
  } catch (err) { addResult('TC-06', 'FAIL', `异常: ${err.message}`); }

  // ============ TC-07: 添加新助教 ============
  log('\n--- TC-07: 添加新助教 ---');
  try {
    const newStageName = '测试新助教QA5_' + Date.now().toString().slice(-4);
    const created = await createCoach(9907, newStageName, '全职', '早班');
    if (created.success) {
      await sleep(2000);
      coaches = await getCoaches();
      const newCoach = coaches.find(c => c.stage_name === newStageName);
      if (newCoach) {
        const wb = await findWaterBoardByCoachNo(newCoach.coach_no, 3);
        if (wb) { addResult('TC-07', 'PASS', `新助教${newCoach.coach_no}(${newStageName})创建成功，水牌状态=${wb.status}`); }
        else { addResult('TC-07', 'FAIL', '新助教已创建但水牌未创建'); }
      } else { addResult('TC-07', 'FAIL', '新助教未在列表中找到'); }
    } else { addResult('TC-07', 'FAIL', `创建失败: ${JSON.stringify(created)}`); }
  } catch (err) { addResult('TC-07', 'FAIL', `异常: ${err.message}`); }

  // ============ TC-08: 删除非离职助教 ============
  log('\n--- TC-08: 删除非离职助教 ---');
  try {
    coaches = await getCoaches();
    const activeCoaches = coaches.filter(c => c.status !== '离职');
    if (activeCoaches.length > 0) {
      const testCoach = activeCoaches[0];
      const delResult = await api(`/api/admin/coaches/${testCoach.coach_no}`, { method: 'DELETE' });
      if (delResult.error && delResult.error.includes('只能删除离职助教')) {
        addResult('TC-08', 'PASS', `正确拒绝删除非离职助教: ${delResult.error}`);
      } else if (delResult.success) { addResult('TC-08', 'FAIL', `不应允许删除非离职助教${testCoach.coach_no}`); }
      else { addResult('TC-08', 'PASS', `删除被拒绝: ${delResult.error || '未知'}`); }
    } else { addResult('TC-08', 'SKIP', '没有非离职教练'); }
  } catch (err) { addResult('TC-08', 'FAIL', `异常: ${err.message}`); }

  log('\n=== QA5 测试完成 ===');
  return results;
}

runTests().then(results => {
  console.log('\n=== 测试结果汇总 ===');
  results.forEach(r => console.log(`${r.status}\t${r.tc}\t${r.detail}`));
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'SKIP').length;
  console.log(`\n总计: PASS=${pass}, FAIL=${fail}, SKIP=${skip}, Total=${results.length}`);
  console.log('\n=== JSON ===');
  console.log(JSON.stringify(results, null, 2));
}).catch(err => console.error('测试失败:', err));
