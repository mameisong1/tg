/**
 * QA5 复测脚本 - 验证4个Bug修复
 * 测试员: B5
 * 日期: 2026-04-15
 */

const http = require('http');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const BASE = 'http://localhost:8081';
const DB_PATH = '/TG/tgservice/db/tgservice.db';

// ===== 数据库工具 =====
const db = new sqlite3.Database(DB_PATH);

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ===== API 工具 =====
function apiRequest(method, urlPath, body = null, cookie = '') {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath.startsWith('http') ? urlPath : BASE + urlPath);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (cookie) options.headers['Cookie'] = cookie;
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: JSON.parse(data),
            setCookie: res.headers['set-cookie']
          });
        } catch(e) {
          resolve({ status: res.statusCode, headers: res.headers, data: data, setCookie: res.headers['set-cookie'] });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login() {
  const res = await apiRequest('POST', '/api/admin/login', {
    username: 'tgadmin',
    password: 'mms633268'
  });
  
  if (res.setCookie) {
    const cookies = Array.isArray(res.setCookie) ? res.setCookie : [res.setCookie];
    return cookies.map(c => c.split(';')[0]).join('; ');
  }
  // Try to get cookie from login response data
  if (res.data && res.data.token) {
    return res.data.token;
  }
  return '';
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== 测试执行 =====
let cookie = '';
let results = [];

async function runTest(name, fn) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 ${name}`);
  console.log('='.repeat(60));
  try {
    const result = await fn();
    results.push({ name, ...result });
    console.log(`✅ ${name}: ${result.status}`);
  } catch(e) {
    results.push({ name, status: 'ERROR', detail: e.message });
    console.log(`💥 ${name}: ERROR - ${e.message}`);
  }
}

async function main() {
  // 登录
  console.log('🔑 登录中...');
  cookie = await login();
  console.log('Cookie:', cookie ? cookie.substring(0, 50) + '...' : '(空)');
  if (!cookie) {
    console.log('尝试其他方式获取cookie...');
    // 如果cookie为空，试试直接带token
  }
  await wait(500);

  // ===== TC-01: 删除离职助教 =====
  await runTest('TC-01: 删除离职助教-验证水牌删除', async () => {
    // 1. 创建离职教练用于测试
    const coachNo = '10100';
    const stageName = '删除测试QA5R';
    
    // 先清理可能存在的老数据
    await dbRun('DELETE FROM water_boards WHERE coach_no = ?', [coachNo]);
    await dbRun('DELETE FROM coaches WHERE coach_no = ?', [coachNo]);
    
    // 创建离职教练
    const createRes = await apiRequest('POST', '/api/admin/coaches', {
      coachNo, stageName, status: '离职', shift: '早班', gender: '女'
    }, cookie);
    console.log('  创建离职教练:', createRes.status, JSON.stringify(createRes.data).substring(0, 100));
    await wait(1000);
    
    // 确认创建成功
    const c1 = await dbGet('SELECT COUNT(*) as cnt FROM coaches WHERE coach_no = ?', [coachNo]);
    const w1 = await dbGet('SELECT COUNT(*) as cnt FROM water_boards WHERE coach_no = ?', [coachNo]);
    console.log('  创建后: coaches=', c1.cnt, 'water_boards=', w1.cnt);
    
    // 如果water_boards没有记录（离职状态不创建水牌），手动创建一条模拟
    if (w1.cnt === 0) {
      console.log('  离职教练无水印记录，手动创建一条模拟孤儿数据');
      await dbRun('INSERT INTO water_boards (coach_no, stage_name, wb_status, sort_order) VALUES (?, ?, ?, 0)', [coachNo, stageName, '下班']);
    }
    
    const w1b = await dbGet('SELECT COUNT(*) as cnt FROM water_boards WHERE coach_no = ?', [coachNo]);
    console.log('  删除前: water_boards=', w1b.cnt);
    
    // 删除
    const delRes = await apiRequest('DELETE', `/api/admin/coaches/${coachNo}`, null, cookie);
    console.log('  删除API响应:', JSON.stringify(delRes.data).substring(0, 100));
    await wait(1000);
    
    // 验证
    const c2 = await dbGet('SELECT COUNT(*) as cnt FROM coaches WHERE coach_no = ?', [coachNo]);
    const w2 = await dbGet('SELECT COUNT(*) as cnt FROM water_boards WHERE coach_no = ?', [coachNo]);
    console.log('  删除后: coaches=', c2.cnt, 'water_boards=', w2.cnt);
    
    const pass = c2.cnt === 0 && w2.cnt === 0;
    return {
      status: pass ? 'PASS' : 'FAIL',
      detail: `coaches=${c2.cnt} (预期0), water_boards=${w2.cnt} (预期0)`
    };
  });

  // ===== TC-02: 全职改离职-验证水牌删除 =====
  await runTest('TC-02: 全职改离职-验证水牌删除', async () => {
    const coachNo = '10101';
    const stageName = '全职改离职QA5R';
    
    await dbRun('DELETE FROM water_boards WHERE coach_no = ?', [coachNo]);
    await dbRun('DELETE FROM coaches WHERE coach_no = ?', [coachNo]);
    
    // 创建全职教练
    const createRes = await apiRequest('POST', '/api/admin/coaches', {
      coachNo, stageName, status: '全职', shift: '早班', gender: '女'
    }, cookie);
    console.log('  创建全职教练:', createRes.status);
    await wait(1000);
    
    const w1 = await dbGet('SELECT * FROM water_boards WHERE coach_no = ?', [coachNo]);
    console.log('  创建后水牌:', w1 ? w1.wb_status : '无');
    
    // 修改为离职
    const updateRes = await apiRequest('PUT', `/api/admin/coaches/${coachNo}`, {
      stageName, status: '离职', shift: '早班', gender: '女'
    }, cookie);
    console.log('  更新为离职API响应:', JSON.stringify(updateRes.data).substring(0, 100));
    await wait(1000);
    
    // 验证
    const c2 = await dbGet('SELECT status FROM coaches WHERE coach_no = ?', [coachNo]);
    const w2 = await dbGet('SELECT COUNT(*) as cnt FROM water_boards WHERE coach_no = ?', [coachNo]);
    console.log('  更新后: coaches.status=', c2 ? c2.status : '无', 'water_boards=', w2.cnt);
    
    const pass = c2 && c2.status === '离职' && w2.cnt === 0;
    return {
      status: pass ? 'PASS' : 'FAIL',
      detail: `status=${c2 ? c2.status : '无'} (预期离职), water_boards=${w2.cnt} (预期0)`
    };
  });

  // ===== TC-03: 离职改全职-验证水牌创建 =====
  await runTest('TC-03: 离职改全职-验证水牌创建', async () => {
    const coachNo = '10102';
    const stageName = '离职改全职QA5R';
    
    await dbRun('DELETE FROM water_boards WHERE coach_no = ?', [coachNo]);
    await dbRun('DELETE FROM coaches WHERE coach_no = ?', [coachNo]);
    
    // 创建离职教练
    await apiRequest('POST', '/api/admin/coaches', {
      coachNo, stageName, status: '离职', shift: '早班', gender: '女'
    }, cookie);
    await wait(1000);
    
    const w1 = await dbGet('SELECT COUNT(*) as cnt FROM water_boards WHERE coach_no = ?', [coachNo]);
    console.log('  离职时水牌数:', w1.cnt);
    
    // 修改为全职
    const updateRes = await apiRequest('PUT', `/api/admin/coaches/${coachNo}`, {
      stageName, status: '全职', shift: '早班', gender: '女'
    }, cookie);
    console.log('  更新为全职API响应:', JSON.stringify(updateRes.data).substring(0, 100));
    await wait(1000);
    
    // 验证
    const c2 = await dbGet('SELECT status FROM coaches WHERE coach_no = ?', [coachNo]);
    const w2 = await dbGet('SELECT * FROM water_boards WHERE coach_no = ?', [coachNo]);
    console.log('  更新后: coaches.status=', c2 ? c2.status : '无');
    console.log('  水牌:', w2 ? `status=${w2.wb_status}` : '无');
    
    const pass = c2 && c2.status === '全职' && w2 !== null;
    return {
      status: pass ? 'PASS' : 'FAIL',
      detail: `status=${c2 ? c2.status : '无'} (预期全职), water_boards=${w2 ? w2.wb_status : '无'} (预期有记录)`
    };
  });

  // ===== TC-04: 离职改兼职-验证水牌创建 =====
  await runTest('TC-04: 离职改兼职-验证水牌创建', async () => {
    const coachNo = '10103';
    const stageName = '离职改兼职QA5R';
    
    await dbRun('DELETE FROM water_boards WHERE coach_no = ?', [coachNo]);
    await dbRun('DELETE FROM coaches WHERE coach_no = ?', [coachNo]);
    
    // 创建离职教练
    await apiRequest('POST', '/api/admin/coaches', {
      coachNo, stageName, status: '离职', shift: '晚班', gender: '女'
    }, cookie);
    await wait(1000);
    
    // 修改为兼职
    const updateRes = await apiRequest('PUT', `/api/admin/coaches/${coachNo}`, {
      stageName, status: '兼职', shift: '晚班', gender: '女'
    }, cookie);
    console.log('  更新为兼职API响应:', JSON.stringify(updateRes.data).substring(0, 100));
    await wait(1000);
    
    // 验证
    const c2 = await dbGet('SELECT status FROM coaches WHERE coach_no = ?', [coachNo]);
    const w2 = await dbGet('SELECT * FROM water_boards WHERE coach_no = ?', [coachNo]);
    console.log('  更新后: coaches.status=', c2 ? c2.status : '无');
    console.log('  水牌:', w2 ? `status=${w2.wb_status}` : '无');
    
    const pass = c2 && c2.status === '兼职' && w2 !== null;
    return {
      status: pass ? 'PASS' : 'FAIL',
      detail: `status=${c2 ? c2.status : '无'} (预期兼职), water_boards=${w2 ? w2.wb_status : '无'} (预期有记录)`
    };
  });

  // ===== TC-05: 修改班次 早→晚 =====
  await runTest('TC-05: 修改班次早→晚-验证水牌状态映射', async () => {
    const coachNo = '10104';
    const stageName = '班次联动测试QA5R';
    
    await dbRun('DELETE FROM water_boards WHERE coach_no = ?', [coachNo]);
    await dbRun('DELETE FROM coaches WHERE coach_no = ?', [coachNo]);
    
    // 创建全职早班教练
    const createRes = await apiRequest('POST', '/api/admin/coaches', {
      coachNo, stageName, status: '全职', shift: '早班', gender: '女'
    }, cookie);
    console.log('  创建全职早班教练:', createRes.status);
    await wait(1000);
    
    // 确认水牌状态
    let w1 = await dbGet('SELECT * FROM water_boards WHERE coach_no = ?', [coachNo]);
    console.log('  创建后水牌状态:', w1 ? w1.wb_status : '无');
    
    // 如果创建时状态是"下班"或不对，手动设为"早班空闲"
    if (w1 && w1.wb_status !== '早班空闲') {
      console.log('  手动设置水牌状态为"早班空闲"');
      await dbRun("UPDATE water_boards SET wb_status = '早班空闲' WHERE coach_no = ?", [coachNo]);
      w1 = await dbGet('SELECT * FROM water_boards WHERE coach_no = ?', [coachNo]);
    }
    
    // 修改班次为晚班
    const shiftRes = await apiRequest('PUT', `/api/admin/coaches/${coachNo}/shift`, {
      shift: '晚班'
    }, cookie);
    console.log('  修改班次API响应:', JSON.stringify(shiftRes.data).substring(0, 100));
    await wait(1000);
    
    // 验证
    const c2 = await dbGet('SELECT shift FROM coaches WHERE coach_no = ?', [coachNo]);
    const w2 = await dbGet('SELECT wb_status FROM water_boards WHERE coach_no = ?', [coachNo]);
    console.log('  更新后: coaches.shift=', c2 ? c2.shift : '无');
    console.log('  水牌状态:', w2 ? w2.wb_status : '无');
    
    const pass = c2 && c2.shift === '晚班' && w2 && w2.wb_status === '晚班空闲';
    return {
      status: pass ? 'PASS' : 'FAIL',
      detail: `shift=${c2 ? c2.shift : '无'} (预期晚班), wb_status=${w2 ? w2.wb_status : '无'} (预期晚班空闲)`
    };
  });

  // ===== TC-06: 修改班次 晚→早 =====
  await runTest('TC-06: 修改班次晚→早-验证水牌状态映射', async () => {
    const coachNo = '10105';
    const stageName = '班次联动晚→早QA5R';
    
    await dbRun('DELETE FROM water_boards WHERE coach_no = ?', [coachNo]);
    await dbRun('DELETE FROM coaches WHERE coach_no = ?', [coachNo]);
    
    // 创建全职晚班教练
    await apiRequest('POST', '/api/admin/coaches', {
      coachNo, stageName, status: '全职', shift: '晚班', gender: '女'
    }, cookie);
    await wait(1000);
    
    let w1 = await dbGet('SELECT * FROM water_boards WHERE coach_no = ?', [coachNo]);
    console.log('  创建后水牌状态:', w1 ? w1.wb_status : '无');
    
    // 确保水牌状态为"晚班空闲"
    if (w1 && w1.wb_status !== '晚班空闲') {
      console.log('  手动设置水牌状态为"晚班空闲"');
      await dbRun("UPDATE water_boards SET wb_status = '晚班空闲' WHERE coach_no = ?", [coachNo]);
    }
    
    // 修改班次为早班
    const shiftRes = await apiRequest('PUT', `/api/admin/coaches/${coachNo}/shift`, {
      shift: '早班'
    }, cookie);
    console.log('  修改班次API响应:', JSON.stringify(shiftRes.data).substring(0, 100));
    await wait(1000);
    
    // 验证
    const c2 = await dbGet('SELECT shift FROM coaches WHERE coach_no = ?', [coachNo]);
    const w2 = await dbGet('SELECT wb_status FROM water_boards WHERE coach_no = ?', [coachNo]);
    console.log('  更新后: coaches.shift=', c2 ? c2.shift : '无');
    console.log('  水牌状态:', w2 ? w2.wb_status : '无');
    
    const pass = c2 && c2.shift === '早班' && w2 && w2.wb_status === '早班空闲';
    return {
      status: pass ? 'PASS' : 'FAIL',
      detail: `shift=${c2 ? c2.shift : '无'} (预期早班), wb_status=${w2 ? w2.wb_status : '无'} (预期早班空闲)`
    };
  });

  // ===== TC-07: 添加新助教-验证水牌自动创建 =====
  await runTest('TC-07: 添加新助教-验证水牌自动创建', async () => {
    const coachNo = '10106';
    const stageName = '新助教QA5R';
    
    await dbRun('DELETE FROM water_boards WHERE coach_no = ?', [coachNo]);
    await dbRun('DELETE FROM coaches WHERE coach_no = ?', [coachNo]);
    
    // 创建新教练
    const createRes = await apiRequest('POST', '/api/admin/coaches', {
      coachNo, stageName, status: '全职', shift: '早班', gender: '女'
    }, cookie);
    console.log('  创建新教练API响应:', JSON.stringify(createRes.data).substring(0, 100));
    await wait(1000);
    
    // 验证
    const c1 = await dbGet('SELECT * FROM coaches WHERE coach_no = ?', [coachNo]);
    const w1 = await dbGet('SELECT * FROM water_boards WHERE coach_no = ?', [coachNo]);
    console.log('  教练:', c1 ? `${c1.coach_no} ${c1.stage_name} ${c1.status}` : '无');
    console.log('  水牌:', w1 ? `status=${w1.wb_status}` : '无');
    
    const pass = c1 !== null && w1 !== null;
    return {
      status: pass ? 'PASS' : 'FAIL',
      detail: `教练=${c1 ? '存在' : '不存在'}, 水牌=${w1 ? '存在(status=' + w1.wb_status + ')' : '不存在'}`
    };
  });

  // ===== TC-08: 删除非离职助教-验证不允许 =====
  await runTest('TC-08: 删除非离职助教-验证不允许', async () => {
    const coachNo = '10107';
    const stageName = '全职不可删QA5R';
    
    await dbRun('DELETE FROM water_boards WHERE coach_no = ?', [coachNo]);
    await dbRun('DELETE FROM coaches WHERE coach_no = ?', [coachNo]);
    
    // 创建全职教练
    await apiRequest('POST', '/api/admin/coaches', {
      coachNo, stageName, status: '全职', shift: '早班', gender: '女'
    }, cookie);
    await wait(1000);
    
    // 尝试删除
    const delRes = await apiRequest('DELETE', `/api/admin/coaches/${coachNo}`, null, cookie);
    console.log('  删除非离职API响应:', JSON.stringify(delRes.data).substring(0, 100));
    await wait(500);
    
    // 验证教练还存在
    const c1 = await dbGet('SELECT COUNT(*) as cnt FROM coaches WHERE coach_no = ?', [coachNo]);
    
    // 应该被拒绝（error或失败）
    const rejected = delRes.data && (delRes.data.error || delRes.data.message || delRes.status === 400 || delRes.status === 403);
    const stillExists = c1.cnt > 0;
    const pass = (rejected || !stillExists === false) && stillExists;
    
    return {
      status: pass ? 'PASS' : 'FAIL',
      detail: `API返回=${JSON.stringify(delRes.data).substring(0, 80)}, 教练仍存在=${stillExists}`
    };
  });

  // ===== 汇总 =====
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(60));
  
  let passCount = 0, failCount = 0, errorCount = 0;
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '💥';
    console.log(`${icon} ${r.name}: ${r.status} - ${r.detail}`);
    if (r.status === 'PASS') passCount++;
    else if (r.status === 'FAIL') failCount++;
    else errorCount++;
  });
  
  console.log(`\n总计: PASS=${passCount}, FAIL=${failCount}, ERROR=${errorCount}, Total=${results.length}`);
  
  // 关闭数据库
  db.close();
  
  // 输出JSON结果供后续使用
  console.log('\n--- JSON RESULT ---');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(e => {
  console.error('测试执行异常:', e);
  db.close();
  process.exit(1);
});
