/**
 * 打卡时间段判断 - 数据库集成测试
 * 使用实际 Turso 测试数据库验证完整 clock-in 流程
 * 
 * 运行方式: cd /TG/tgservice && node backend/test-clockin-integration.js
 */

process.env.TGSERVICE_ENV = 'test';

const { get, all, run, enqueueRun } = require('./db');
const TimeUtil = require('./utils/time');
const http = require('http');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// ========== 配置 ==========
const API_BASE = 'http://127.0.0.1:8088';
const TEST_COACH_SHIFT = '早班';
let testCoachNo = null;
let testEmployeeId = null;
let testCoachName = '测试助教-CT';
let testPhone = '19900000099';
let authToken = null;

// ========== 工具函数 ==========

function log(msg) {
  console.log(`  [${new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai' })}] ${msg}`);
}

function apiPost(path, body, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

// ========== 生成 JWT Token ==========
function generateAdminToken() {
  const configPath = path.join(__dirname, '../.config');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const payload = {
    username: 'tgadmin',
    name: '管理员',
    role: '管理员',
    userType: 'admin'
  };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: '1h' });
}

// ========== 创建测试助教 ==========
async function createTestCoach() {
  const existing = await get("SELECT coach_no FROM coaches WHERE phone = ?", [testPhone]);
  if (existing) {
    log(`使用已有测试助教 coach_no=${existing.coach_no}`);
    return existing.coach_no;
  }

  const maxCoach = await get("SELECT MAX(CAST(coach_no AS INTEGER)) as max_no FROM coaches");
  const newCoachNo = String(parseInt(maxCoach.max_no) + 1);

  const maxEmp = await get("SELECT MAX(CAST(employee_id AS INTEGER)) as max_id FROM coaches WHERE employee_id IS NOT NULL AND employee_id != ''");
  const newEmployeeId = String(parseInt(maxEmp.max_id) + 1);

  await enqueueRun(`
    INSERT INTO coaches (coach_no, stage_name, phone, shift, employee_id)
    VALUES (?, ?, ?, ?, ?)
  `, [newCoachNo, testCoachName, testPhone, TEST_COACH_SHIFT, newEmployeeId]);

  await enqueueRun(`
    INSERT INTO water_boards (coach_no, stage_name, status)
    VALUES (?, ?, '下班')
  `, [newCoachNo, testCoachName]);

  log(`创建测试助教: coach_no=${newCoachNo}, employee_id=${newEmployeeId}`);
  return newCoachNo;
}

// ========== 设置测试数据 ==========
async function setDingtalkTime(coachNo, date, dingtalkTime) {
  await run(`DELETE FROM attendance_records WHERE coach_no = ? AND date = ?`, [coachNo, date]);
  await enqueueRun(`
    INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, dingtalk_in_time, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [date, coachNo, testEmployeeId, testCoachName, dingtalkTime, TimeUtil.nowDB(), TimeUtil.nowDB()]);
  log(`设置钉钉打卡时间: date=${date}, dingtalk_in_time=${dingtalkTime}`);
}

async function setWaterBoardStatus(coachNo, status) {
  await enqueueRun(`UPDATE water_boards SET status = ? WHERE coach_no = ?`, [status, coachNo]);
  log(`设置水牌状态: ${status}`);
}

async function setClockInTime(coachNo, date, clockInTime) {
  await enqueueRun(`
    UPDATE attendance_records SET clock_in_time = ?, dingtalk_in_time = ?
    WHERE coach_no = ? AND date = ?
  `, [clockInTime, clockInTime, coachNo, date]);
  log(`设置上班时间: ${clockInTime}`);
}

async function setClockOutTime(coachNo, date, clockOutTime) {
  await enqueueRun(`
    UPDATE attendance_records SET clock_out_time = ?, dingtalk_out_time = ?
    WHERE coach_no = ? AND date = ?
  `, [clockOutTime, clockOutTime, coachNo, date]);
  log(`设置下班时间: ${clockOutTime}`);
}

async function clearAttendance(coachNo, date) {
  await run(`DELETE FROM attendance_records WHERE coach_no = ? AND date = ?`, [coachNo, date]);
}

async function getRecord(coachNo, date) {
  return await get(
    "SELECT clock_in_time, clock_out_time, dingtalk_in_time, dingtalk_out_time FROM attendance_records WHERE coach_no = ? AND date = ?",
    [coachNo, date]
  );
}

async function getWaterStatus(coachNo) {
  const wb = await get("SELECT status FROM water_boards WHERE coach_no = ?", [coachNo]);
  return wb?.status;
}

// ========== 测试框架 ==========
let passed = 0;
let failed = 0;
let results = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push({ name, status: '✅ PASS' });
  } catch (err) {
    failed++;
    results.push({ name, status: '❌ FAIL', detail: err.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || '断言失败');
}

// ========== 主测试 ==========
async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('打卡时间段判断 - 数据库集成测试');
  console.log('='.repeat(70));
  console.log();

  authToken = generateAdminToken();
  log('生成 admin token 成功');

  testCoachNo = await createTestCoach();
  const empInfo = await get("SELECT employee_id FROM coaches WHERE coach_no = ?", [testCoachNo]);
  testEmployeeId = empInfo.employee_id;

  const todayStr = TimeUtil.todayStr();
  const yesterdayStr = TimeUtil.offsetDateStr(-1);

  console.log();
  console.log(`测试环境: today=${todayStr}, yesterday=${yesterdayStr}, coach_no=${testCoachNo}`);
  console.log();

  // TC-I01: 正常上班打卡
  await test('TC-I01: 早班14:00正常上班打卡', async () => {
    await setWaterBoardStatus(testCoachNo, '下班');
    await clearAttendance(testCoachNo, todayStr);
    await setDingtalkTime(testCoachNo, todayStr, `${todayStr} 14:00:00`);

    const res = await apiPost(`/api/coaches/v2/${testCoachNo}/clock-in`, { force_dingtalk: true }, authToken);
    assert(res.data && res.data.success, `预期success=true，实际: ${JSON.stringify(res.data)}`);

    const wb = await getWaterStatus(testCoachNo);
    assert(wb === '早班空闲', `水牌应为早班空闲，实际: ${wb}`);

    const rec = await getRecord(testCoachNo, todayStr);
    assert(rec && rec.clock_in_time, '应有clock_in_time');
    log(`  → 成功: 水牌=${wb}, clock_in=${rec.clock_in_time}`);
  });

  // TC-I02: 已在班拒绝
  await test('TC-I02: 已在班状态拒绝打卡', async () => {
    const res = await apiPost(`/api/coaches/v2/${testCoachNo}/clock-in`, { force_dingtalk: true }, authToken);
    assert(res.data && res.data.success === false, `预期success=false，实际: ${JSON.stringify(res.data)}`);
    log(`  → 正确拒绝: ${res.data?.error}`);
  });

  // TC-I03: 下班打卡
  await test('TC-I03: 从空闲状态下班', async () => {
    const res = await apiPost(`/api/coaches/v2/${testCoachNo}/clock-out`, {}, authToken);
    assert(res.data && res.data.success, `预期success=true，实际: ${JSON.stringify(res.data)}`);
    const wb = await getWaterStatus(testCoachNo);
    assert(wb === '下班', `水牌应为下班，实际: ${wb}`);
    log(`  → 成功: 水牌=${wb}`);
  });

  // TC-I04: 加班打卡 (23:00，找到记录→清空下班时间)
  await test('TC-I04: 早班23:00加班打卡(找到记录→清空下班时间)', async () => {
    await setWaterBoardStatus(testCoachNo, '下班');
    await setDingtalkTime(testCoachNo, todayStr, `${todayStr} 14:00:00`);
    await setClockInTime(testCoachNo, todayStr, `${todayStr} 14:00:00`);  // 设置上班时间
    await setClockOutTime(testCoachNo, todayStr, `${todayStr} 22:00:00`);

    // 覆盖钉钉时间为23:00（模拟加班打卡）
    await run(`UPDATE attendance_records SET dingtalk_in_time = ? WHERE coach_no = ? AND date = ?`,
      [`${todayStr} 23:00:00`, testCoachNo, todayStr]);

    const res = await apiPost(`/api/coaches/v2/${testCoachNo}/clock-in`, { force_dingtalk: true }, authToken);
    assert(res.data && res.data.success, `预期success=true，实际: ${JSON.stringify(res.data)}`);

    const wb = await getWaterStatus(testCoachNo);
    assert(wb === '早班空闲', `水牌应为早班空闲，实际: ${wb}`);

    const rec = await getRecord(testCoachNo, todayStr);
    assert(!rec.clock_out_time, `clock_out_time应为空，实际: ${rec.clock_out_time}`);
    assert(!rec.dingtalk_out_time, `dingtalk_out_time应为空，实际: ${rec.dingtalk_out_time}`);
    log(`  → 成功: 水牌=${wb}, 下班时间已清空`);
  });

  // TC-I05: 删除（场景无法测试：必须设置钉钉时间才能打卡，但设置后记录就存在）

  // TC-I06: 加班打卡 (跨日找前一日记录)
  await test('TC-I06: 早班03:00加班打卡(跨日找前一日)', async () => {
    await setWaterBoardStatus(testCoachNo, '下班');
    await clearAttendance(testCoachNo, yesterdayStr);
    await setDingtalkTime(testCoachNo, yesterdayStr, `${yesterdayStr} 14:00:00`);
    await setClockOutTime(testCoachNo, yesterdayStr, `${yesterdayStr} 22:00:00`);

    // 当前日期的钉钉打卡设为凌晨3点
    await clearAttendance(testCoachNo, todayStr);
    await setDingtalkTime(testCoachNo, todayStr, `${todayStr} 03:00:00`);

    const res = await apiPost(`/api/coaches/v2/${testCoachNo}/clock-in`, { force_dingtalk: true }, authToken);
    assert(res.data && res.data.success, `预期success=true，实际: ${JSON.stringify(res.data)}`);

    const prevRec = await getRecord(testCoachNo, yesterdayStr);
    assert(!prevRec.clock_out_time, `前一日clock_out_time应为空，实际: ${prevRec.clock_out_time}`);
    assert(!prevRec.dingtalk_out_time, `前一日dingtalk_out_time应为空，实际: ${prevRec.dingtalk_out_time}`);
    log(`  → 成功: 前一日记录下班时间已清空`);
  });

  // TC-I07: 无效时间段12:00拒绝
  await test('TC-I07: 12:00无效时间段打卡→拒绝', async () => {
    await setWaterBoardStatus(testCoachNo, '下班');
    await clearAttendance(testCoachNo, todayStr);
    await setDingtalkTime(testCoachNo, todayStr, `${todayStr} 12:00:00`);

    const res = await apiPost(`/api/coaches/v2/${testCoachNo}/clock-in`, { force_dingtalk: true }, authToken);
    assert(res.data && res.data.success === false, `预期success=false，实际: ${JSON.stringify(res.data)}`);
    assert(res.data?.error === 'TIME_NOT_ALLOWED', `预期TIME_NOT_ALLOWED，实际: ${res.data?.error}`);
    log(`  → 正确拒绝: ${res.data?.message}`);
  });

  // TC-I08: 无效时间段11:00拒绝
  await test('TC-I08: 11:00无效时间段打卡→拒绝', async () => {
    await setWaterBoardStatus(testCoachNo, '下班');
    await clearAttendance(testCoachNo, todayStr);
    await setDingtalkTime(testCoachNo, todayStr, `${todayStr} 11:00:00`);

    const res = await apiPost(`/api/coaches/v2/${testCoachNo}/clock-in`, { force_dingtalk: true }, authToken);
    assert(res.data && res.data.success === false, `预期success=false，实际: ${JSON.stringify(res.data)}`);
    assert(res.data?.error === 'TIME_NOT_ALLOWED', `预期TIME_NOT_ALLOWED，实际: ${res.data?.error}`);
    log(`  → 正确拒绝: ${res.data?.message}`);
  });

  // TC-I09: 加班打卡不修改上班时间
  await test('TC-I09: 加班打卡不修改clock_in_time', async () => {
    await setWaterBoardStatus(testCoachNo, '下班');
    await clearAttendance(testCoachNo, todayStr);

    const originalClockIn = `${todayStr} 14:00:00`;
    await enqueueRun(`
      INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, dingtalk_in_time, clock_out_time, dingtalk_out_time, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [todayStr, testCoachNo, testEmployeeId, testCoachName, originalClockIn, originalClockIn, `${todayStr} 22:00:00`, `${todayStr} 22:00:00`, TimeUtil.nowDB(), TimeUtil.nowDB()]);

    // 转换班次为早班（确保加班时间段判定正确）
    await enqueueRun(`UPDATE coaches SET shift = '早班' WHERE coach_no = ?`, [testCoachNo]);

    // 覆盖钉钉时间为23:30（模拟加班打卡的新钉钉推送）
    await run(`UPDATE attendance_records SET dingtalk_in_time = ? WHERE coach_no = ? AND date = ?`,
      [`${todayStr} 23:30:00`, testCoachNo, todayStr]);

    const res = await apiPost(`/api/coaches/v2/${testCoachNo}/clock-in`, { force_dingtalk: true }, authToken);
    assert(res.data && res.data.success, `预期success=true，实际: ${JSON.stringify(res.data)}`);

    const rec = await getRecord(testCoachNo, todayStr);
    // 加班打卡不修改 clock_in_time（保持14:00）
    assert(rec.clock_in_time === originalClockIn, `clock_in_time应保持${originalClockIn}，实际: ${rec.clock_in_time}`);
    // dingtalk_in_time = 打卡前的值（23:30，钉钉推送的新数据，系统不修改）
    assert(rec.dingtalk_in_time === `${todayStr} 23:30:00`, `dingtalk_in_time应为23:30，实际: ${rec.dingtalk_in_time}`);
    // 下班时间应被清空
    assert(!rec.clock_out_time, `clock_out_time应为空，实际: ${rec.clock_out_time}`);
    assert(!rec.dingtalk_out_time, `dingtalk_out_time应为空，实际: ${rec.dingtalk_out_time}`);
    log(`  → 成功: clock_in=${rec.clock_in_time} (未变), dingtalk_in=${rec.dingtalk_in_time}, 下班时间已清空`);
  });

  // TC-I10: 无钉钉打卡时间拒绝
  await test('TC-I10: 无钉钉打卡时间→拒绝', async () => {
    await setWaterBoardStatus(testCoachNo, '下班');
    await clearAttendance(testCoachNo, todayStr);

    const res = await apiPost(`/api/coaches/v2/${testCoachNo}/clock-in`, { force_dingtalk: true }, authToken);
    assert(res.data && res.data.success === false, `预期success=false，实际: ${JSON.stringify(res.data)}`);
    assert(res.data?.error === 'DINGTALK_NOT_FOUND', `预期DINGTALK_NOT_FOUND，实际: ${res.data?.error}`);
    log(`  → 正确拒绝: ${res.data?.message}`);
  });

  // TC-I11: 13:00边界正常上班
  await test('TC-I11: 13:00边界正常上班打卡', async () => {
    await setWaterBoardStatus(testCoachNo, '下班');
    await clearAttendance(testCoachNo, todayStr);
    await setDingtalkTime(testCoachNo, todayStr, `${todayStr} 13:00:00`);

    const res = await apiPost(`/api/coaches/v2/${testCoachNo}/clock-in`, { force_dingtalk: true }, authToken);
    assert(res.data && res.data.success, `预期success=true，实际: ${JSON.stringify(res.data)}`);
    log(`  → 成功: 13:00正常上班`);
  });

  // TC-I12: 早班10:39判定为加班打卡
  await test('TC-I12: 早班10:39→加班打卡(非拒绝)', async () => {
    await setWaterBoardStatus(testCoachNo, '下班');
    await clearAttendance(testCoachNo, todayStr);
    await setDingtalkTime(testCoachNo, todayStr, `${todayStr} 10:39:00`);

    const res = await apiPost(`/api/coaches/v2/${testCoachNo}/clock-in`, { force_dingtalk: true }, authToken);
    assert(res.data && res.data.success, `预期success=true，实际: ${JSON.stringify(res.data)}`);

    const wb = await getWaterStatus(testCoachNo);
    assert(wb === '早班空闲', `水牌应为早班空闲，实际: ${wb}`);
    log(`  → 成功: 10:39判定为加班打卡，水牌=${wb}`);
  });

  // TC-I13: 晚班23:00正常上班（非加班）
  await test('TC-I13: 晚班23:00→正常上班(非加班)', async () => {
    // 临时改班次为晚班
    await enqueueRun(`UPDATE coaches SET shift = '晚班' WHERE coach_no = ?`, [testCoachNo]);

    await setWaterBoardStatus(testCoachNo, '下班');
    await clearAttendance(testCoachNo, todayStr);
    await setDingtalkTime(testCoachNo, todayStr, `${todayStr} 23:00:00`);

    const res = await apiPost(`/api/coaches/v2/${testCoachNo}/clock-in`, { force_dingtalk: true }, authToken);
    assert(res.data && res.data.success, `预期success=true，实际: ${JSON.stringify(res.data)}`);

    const wb = await getWaterStatus(testCoachNo);
    assert(wb === '晚班空闲', `水牌应为晚班空闲，实际: ${wb}`);
    log(`  → 成功: 晚班23:00正常上班，水牌=${wb}`);

    // 恢复早班
    await enqueueRun(`UPDATE coaches SET shift = '早班' WHERE coach_no = ?`, [testCoachNo]);
  });

  // TC-I14: 晚班01:00正常上班（非加班）
  await test('TC-I14: 晚班01:00→正常上班(非加班)', async () => {
    await enqueueRun(`UPDATE coaches SET shift = '晚班' WHERE coach_no = ?`, [testCoachNo]);

    await setWaterBoardStatus(testCoachNo, '下班');
    await clearAttendance(testCoachNo, todayStr);
    await setDingtalkTime(testCoachNo, todayStr, `${todayStr} 01:00:00`);

    const res = await apiPost(`/api/coaches/v2/${testCoachNo}/clock-in`, { force_dingtalk: true }, authToken);
    assert(res.data && res.data.success, `预期success=true，实际: ${JSON.stringify(res.data)}`);

    const wb = await getWaterStatus(testCoachNo);
    assert(wb === '晚班空闲', `水牌应为晚班空闲，实际: ${wb}`);
    log(`  → 成功: 晚班01:00正常上班，水牌=${wb}`);

    await enqueueRun(`UPDATE coaches SET shift = '早班' WHERE coach_no = ?`, [testCoachNo]);
  });

  // TC-I15: 早加班状态不受时间段限制
  await test('TC-I15: 早加班状态不受时间段限制', async () => {
    await setWaterBoardStatus(testCoachNo, '早加班');
    await clearAttendance(testCoachNo, todayStr);
    await setDingtalkTime(testCoachNo, todayStr, `${todayStr} 12:00:00`);

    const res = await apiPost(`/api/coaches/v2/${testCoachNo}/clock-in`, { force_dingtalk: true }, authToken);
    assert(res.data && res.data.success, `预期success=true，实际: ${JSON.stringify(res.data)}`);
    log(`  → 成功: 早加班状态正常打卡`);
  });

  // 输出结果
  console.log();
  console.log('='.repeat(70));
  console.log('集成测试报告');
  console.log('='.repeat(70));
  console.log();

  for (const r of results) {
    if (r.status === '✅ PASS') {
      console.log(`  ${r.status}  ${r.name}`);
    } else {
      console.log(`  ${r.status}  ${r.name}`);
      if (r.detail) console.log(`         ${r.detail}`);
    }
  }

  console.log();
  console.log('='.repeat(70));
  console.log(`总计: ${results.length} 个测试 | ✅ 通过: ${passed} | ❌ 失败: ${failed}`);
  console.log('='.repeat(70));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('测试异常:', err);
  process.exit(1);
});
