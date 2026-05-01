/**
 * 打卡时间段判断逻辑测试
 * 30+ 测试用例，覆盖加班打卡、无效时间段、正常上班、乐捐归来等场景
 * 运行方式: node test-clockin-time.js
 */

// ========== 辅助函数（与 coaches.js 保持一致） ==========

function isOvertimeTime(hour, shift) {
  if (shift === '早班') {
    return hour >= 23 || hour < 11;
  } else {
    return hour >= 2 && hour < 11;
  }
}

function isInvalidTime(hour) {
  return hour >= 11 && hour < 13;
}

function isInWorkTime(hour, shift) {
  if (shift === '早班') {
    return hour >= 13 && hour < 23;
  } else {
    return hour >= 13 || hour < 2;
  }
}

function getOvertimeTargetDate(checkHour, todayStr) {
  if (checkHour >= 0 && checkHour < 11) {
    // 字符串运算，避免时区问题
    const parts = todayStr.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]) - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } else {
    return todayStr;
  }
}

// ========== 模拟打卡场景判定逻辑 ==========

function simulateClockIn(waterStatus, checkHour, shift) {
  // 水牌=乐捐
  if (waterStatus === '乐捐') {
    if (!isInWorkTime(checkHour, shift)) {
      return { action: 'rejected', reason: 'TIME_NOT_ALLOWED', message: '当前时间段不允许乐捐归来，必须在上班时间段内' };
    }
    return { action: 'lejuan_return', reason: '乐捐归来' };
  }

  // 水牌=下班
  if (waterStatus === '下班') {
    if (isOvertimeTime(checkHour, shift)) {
      const targetDate = getOvertimeTargetDate(checkHour, '2026-05-02');
      return { action: 'overtime', reason: '加班打卡', targetDate, clearClockOut: true };
    }
    if (isInvalidTime(checkHour)) {
      return { action: 'rejected', reason: 'TIME_NOT_ALLOWED', message: '当前时间段不允许打卡（11:00~13:00）' };
    }
    if (isInWorkTime(checkHour, shift)) {
      return { action: 'normal_clockin', reason: '正常上班' };
    }
    return { action: 'rejected', reason: 'TIME_NOT_ALLOWED', message: '当前时间段不允许打卡' };
  }

  // 其他状态
  if (['早加班', '休息', '公休', '请假'].includes(waterStatus)) {
    return { action: 'normal_clockin', reason: `${waterStatus}→空闲` };
  }
  if (waterStatus === '早班空闲' || waterStatus === '晚班空闲') {
    return { action: 'rejected', reason: 'ALREADY_ON_DUTY', message: '已在班状态' };
  }
  if (waterStatus === '早班上桌' || waterStatus === '晚班上桌') {
    return { action: 'rejected', reason: 'ON_TABLE', message: '上桌状态不能点上班' };
  }

  return { action: 'normal_clockin', reason: `${waterStatus}→空闲` };
}

// ========== 测试框架 ==========

let passed = 0;
let failed = 0;
let results = [];

function test(name, actual, expected) {
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  if (match) {
    passed++;
    results.push({ name, status: '✅ PASS', detail: '' });
  } else {
    failed++;
    results.push({ name, status: '❌ FAIL', detail: `期望: ${JSON.stringify(expected)}\n实际: ${JSON.stringify(actual)}` });
  }
}

// ========== 测试用例 ==========

const TODAY = '2026-05-02';
const YESTERDAY = '2026-05-01';

// ----- 辅助函数测试 (1-3) -----
test('TC-01: 辅助函数 isOvertimeTime 早班23点',
  isOvertimeTime(23, '早班'), true);
test('TC-02: 辅助函数 isOvertimeTime 早班10点',
  isOvertimeTime(10, '早班'), true);
test('TC-03: 辅助函数 isOvertimeTime 早班12点',
  isOvertimeTime(12, '早班'), false);

// ----- 加班打卡场景 (4-15) -----

// 早班加班打卡
test('TC-04: 早班 23:43 下班状态 → 加班打卡',
  simulateClockIn('下班', 23, '早班'),
  { action: 'overtime', reason: '加班打卡', targetDate: TODAY, clearClockOut: true });

test('TC-05: 早班 23:00 下班状态 → 加班打卡',
  simulateClockIn('下班', 23, '早班'),
  { action: 'overtime', reason: '加班打卡', targetDate: TODAY, clearClockOut: true });

test('TC-06: 早班 次日00:00 下班状态 → 加班打卡(跨日)',
  simulateClockIn('下班', 0, '早班'),
  { action: 'overtime', reason: '加班打卡', targetDate: YESTERDAY, clearClockOut: true });

test('TC-07: 早班 次日03:00 下班状态 → 加班打卡(跨日)',
  simulateClockIn('下班', 3, '早班'),
  { action: 'overtime', reason: '加班打卡', targetDate: YESTERDAY, clearClockOut: true });

test('TC-08: 早班 次日10:59 下班状态 → 加班打卡(跨日)',
  simulateClockIn('下班', 10, '早班'),
  { action: 'overtime', reason: '加班打卡', targetDate: YESTERDAY, clearClockOut: true });

// 晚班加班打卡
test('TC-09: 晚班 次日02:00 下班状态 → 加班打卡',
  simulateClockIn('下班', 2, '晚班'),
  { action: 'overtime', reason: '加班打卡', targetDate: YESTERDAY, clearClockOut: true });

test('TC-10: 晚班 次日03:00 下班状态 → 加班打卡',
  simulateClockIn('下班', 3, '晚班'),
  { action: 'overtime', reason: '加班打卡', targetDate: YESTERDAY, clearClockOut: true });

test('TC-11: 晚班 次日10:59 下班状态 → 加班打卡',
  simulateClockIn('下班', 10, '晚班'),
  { action: 'overtime', reason: '加班打卡', targetDate: YESTERDAY, clearClockOut: true });

test('TC-12: 晚班 次日01:00 下班状态 → 非加班(正常上班)',
  simulateClockIn('下班', 1, '晚班'),
  { action: 'normal_clockin', reason: '正常上班' });

test('TC-13: 晚班 次日00:00 下班状态 → 非加班(正常上班)',
  simulateClockIn('下班', 0, '晚班'),
  { action: 'normal_clockin', reason: '正常上班' });

test('TC-14: 晚班 23:00 下班状态 → 非加班(正常上班)',
  simulateClockIn('下班', 23, '晚班'),
  { action: 'normal_clockin', reason: '正常上班' });

test('TC-15: 早班 次日01:00 下班状态 → 加班打卡(跨日)',
  simulateClockIn('下班', 1, '早班'),
  { action: 'overtime', reason: '加班打卡', targetDate: YESTERDAY, clearClockOut: true });

// ----- 无效时间段 (16-19) -----
test('TC-16: 早班 11:00 下班状态 → 拒绝',
  simulateClockIn('下班', 11, '早班'),
  { action: 'rejected', reason: 'TIME_NOT_ALLOWED', message: '当前时间段不允许打卡（11:00~13:00）' });

test('TC-17: 早班 12:59 下班状态 → 拒绝',
  simulateClockIn('下班', 12, '早班'),
  { action: 'rejected', reason: 'TIME_NOT_ALLOWED', message: '当前时间段不允许打卡（11:00~13:00）' });

test('TC-18: 晚班 11:30 下班状态 → 拒绝',
  simulateClockIn('下班', 11, '晚班'),
  { action: 'rejected', reason: 'TIME_NOT_ALLOWED', message: '当前时间段不允许打卡（11:00~13:00）' });

test('TC-19: 晚班 12:00 下班状态 → 拒绝',
  simulateClockIn('下班', 12, '晚班'),
  { action: 'rejected', reason: 'TIME_NOT_ALLOWED', message: '当前时间段不允许打卡（11:00~13:00）' });

// ----- 正常上班场景 (20-27) -----
test('TC-20: 早班 13:00 下班状态 → 正常上班',
  simulateClockIn('下班', 13, '早班'),
  { action: 'normal_clockin', reason: '正常上班' });

test('TC-21: 早班 14:00 下班状态 → 正常上班',
  simulateClockIn('下班', 14, '早班'),
  { action: 'normal_clockin', reason: '正常上班' });

test('TC-22: 早班 22:59 下班状态 → 正常上班',
  simulateClockIn('下班', 22, '早班'),
  { action: 'normal_clockin', reason: '正常上班' });

test('TC-23: 早班 10:39 下班状态 → 加班打卡(非13点前拒绝，而是加班)',
  simulateClockIn('下班', 10, '早班'),
  { action: 'overtime', reason: '加班打卡', targetDate: YESTERDAY, clearClockOut: true });

test('TC-24: 晚班 13:00 下班状态 → 正常上班',
  simulateClockIn('下班', 13, '晚班'),
  { action: 'normal_clockin', reason: '正常上班' });

test('TC-25: 晚班 18:00 下班状态 → 正常上班',
  simulateClockIn('下班', 18, '晚班'),
  { action: 'normal_clockin', reason: '正常上班' });

test('TC-26: 晚班 23:00 下班状态 → 正常上班',
  simulateClockIn('下班', 23, '晚班'),
  { action: 'normal_clockin', reason: '正常上班' });

test('TC-27: 晚班 次日01:00 下班状态 → 正常上班',
  simulateClockIn('下班', 1, '晚班'),
  { action: 'normal_clockin', reason: '正常上班' });

// ----- 乐捐归来场景 (28-33) -----
test('TC-28: 早班 15:00 乐捐状态 → 乐捐归来',
  simulateClockIn('乐捐', 15, '早班'),
  { action: 'lejuan_return', reason: '乐捐归来' });

test('TC-29: 早班 11:30 乐捐状态 → 拒绝',
  simulateClockIn('乐捐', 11, '早班'),
  { action: 'rejected', reason: 'TIME_NOT_ALLOWED', message: '当前时间段不允许乐捐归来，必须在上班时间段内' });

test('TC-30: 晚班 次日01:00 乐捐状态 → 乐捐归来',
  simulateClockIn('乐捐', 1, '晚班'),
  { action: 'lejuan_return', reason: '乐捐归来' });

test('TC-31: 晚班 次日00:00 乐捐状态 → 乐捐归来',
  simulateClockIn('乐捐', 0, '晚班'),
  { action: 'lejuan_return', reason: '乐捐归来' });

test('TC-32: 晚班 15:00 乐捐状态 → 乐捐归来',
  simulateClockIn('乐捐', 15, '晚班'),
  { action: 'lejuan_return', reason: '乐捐归来' });

test('TC-33: 早班 11:00 乐捐状态 → 拒绝',
  simulateClockIn('乐捐', 11, '早班'),
  { action: 'rejected', reason: 'TIME_NOT_ALLOWED', message: '当前时间段不允许乐捐归来，必须在上班时间段内' });

// ----- 其他状态场景 (34-37) -----
test('TC-34: 早班 12:00 早加班状态 → 正常上班(不受时间段限制)',
  simulateClockIn('早加班', 12, '早班'),
  { action: 'normal_clockin', reason: '早加班→空闲' });

test('TC-35: 晚班 11:30 公休状态 → 正常上班(不受时间段限制)',
  simulateClockIn('公休', 11, '晚班'),
  { action: 'normal_clockin', reason: '公休→空闲' });

test('TC-36: 早班 任意时间 早班空闲 → 拒绝',
  simulateClockIn('早班空闲', 14, '早班'),
  { action: 'rejected', reason: 'ALREADY_ON_DUTY', message: '已在班状态' });

test('TC-37: 晚班 任意时间 晚班上桌 → 拒绝',
  simulateClockIn('晚班上桌', 18, '晚班'),
  { action: 'rejected', reason: 'ON_TABLE', message: '上桌状态不能点上班' });

// ----- 边界场景 (38-42) -----
test('TC-38: 早班 23:59 下班状态 → 加班打卡',
  simulateClockIn('下班', 23, '早班'),
  { action: 'overtime', reason: '加班打卡', targetDate: TODAY, clearClockOut: true });

test('TC-39: 晚班 次日02:00 下班状态 → 加班打卡(边界)',
  simulateClockIn('下班', 2, '晚班'),
  { action: 'overtime', reason: '加班打卡', targetDate: YESTERDAY, clearClockOut: true });

test('TC-40: 晚班 次日01:59 下班状态 → 正常上班(非加班)',
  simulateClockIn('下班', 1, '晚班'),
  { action: 'normal_clockin', reason: '正常上班' });

test('TC-41: 早班 11:00 下班状态 → 拒绝(无效时间段)',
  simulateClockIn('下班', 11, '早班'),
  { action: 'rejected', reason: 'TIME_NOT_ALLOWED', message: '当前时间段不允许打卡（11:00~13:00）' });

test('TC-42: 早班 13:00 乐捐状态 → 乐捐归来',
  simulateClockIn('乐捐', 13, '早班'),
  { action: 'lejuan_return', reason: '乐捐归来' });

// ========== 输出结果 ==========

console.log('\n' + '='.repeat(70));
console.log('打卡时间段判断逻辑测试报告');
console.log('='.repeat(70));
console.log();

for (const r of results) {
  if (r.status === '✅ PASS') {
    console.log(`  ${r.status}  ${r.name}`);
  } else {
    console.log(`  ${r.status}  ${r.name}`);
    console.log(`         ${r.detail}`);
  }
}

console.log();
console.log('='.repeat(70));
console.log(`总计: ${results.length} 个测试 | ✅ 通过: ${passed} | ❌ 失败: ${failed}`);
console.log('='.repeat(70));

process.exit(failed > 0 ? 1 : 0);
