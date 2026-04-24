/**
 * 乐捐时长计算算法测试
 * 测试目标：验证基于预约开始时间的时长计算逻辑
 */

const TimeUtil = require('./utils/time');

// 测试结果记录
const testResults = [];

function logTest(name, expected, actual, passed) {
  testResults.push({ name, expected, actual, passed });
  console.log(`${passed ? '✅' : '❌'} ${name}`);
  console.log(`   预期: ${expected} 小时, 实际: ${actual} 小时`);
}

/**
 * 计算乐捐时长（新算法）
 * @param {string} scheduledStart - 预约开始时间 "YYYY-MM-DD HH:MM:SS"
 * @param {string} endTime - 结束时间 "YYYY-MM-DD HH:MM:SS"
 * @returns {number} - 乐捐时长（小时）
 */
function calculateLejuanHours(scheduledStart, endTime) {
  let hours = 1;
  
  const startTime = TimeUtil.toDate(scheduledStart);
  const endMs = TimeUtil.toDate(endTime);
  
  if (startTime && endMs) {
    const diffMs = endMs.getTime() - startTime.getTime();
    const totalMinutes = Math.floor(diffMs / (60 * 1000));
    
    const baseHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    
    const extraHour = remainingMinutes > 10 ? 1 : 0;
    
    hours = Math.max(1, baseHours + extraHour);
  }
  
  return hours;
}

console.log('\n============================================');
console.log('  乐捐时长计算算法测试');
console.log('  测试时间: ' + new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
console.log('============================================\n');

// ========== 测试用例 ==========

// 测试 1: 诗雨案例（0点到2点，正好2小时）
const test1 = calculateLejuanHours('2026-04-24 00:00:00', '2026-04-24 02:00:14');
logTest('诗雨案例：0:00 -> 2:00:14 (120分钟)', 2, test1, test1 === 2);

// 测试 2: 1小时15分钟（应算2小时）
const test2 = calculateLejuanHours('2026-04-24 00:00:00', '2026-04-24 01:15:00');
logTest('1小时15分钟（剩余15分>10）', 2, test2, test2 === 2);

// 测试 3: 1小时10分钟（边界，不算额外小时）
const test3 = calculateLejuanHours('2026-04-24 00:00:00', '2026-04-24 01:10:00');
logTest('1小时10分钟（边界，剩余=10不算）', 1, test3, test3 === 1);

// 测试 4: 1小时11分钟（边界，算额外小时）
const test4 = calculateLejuanHours('2026-04-24 00:00:00', '2026-04-24 01:11:00');
logTest('1小时11分钟（边界，剩余=11算）', 2, test4, test4 === 2);

// 测试 5: 极短时长5分钟（最少算1小时）
const test5 = calculateLejuanHours('2026-04-24 00:00:00', '2026-04-24 00:05:00');
logTest('极短时长5分钟（最少1小时）', 1, test5, test5 === 1);

// 测试 6: 3小时59分钟
const test6 = calculateLejuanHours('2026-04-24 00:00:00', '2026-04-24 03:59:00');
logTest('3小时59分钟（剩余59分>10）', 4, test6, test6 === 4);

// 测试 7: 2小时整
const test7 = calculateLejuanHours('2026-04-24 00:00:00', '2026-04-24 02:00:00');
logTest('2小时整（剩余0分）', 2, test7, test7 === 2);

// 测试 8: 跨日乐捐（23点到次日2点）
const test8 = calculateLejuanHours('2026-04-23 23:00:00', '2026-04-24 02:00:00');
logTest('跨日乐捐：23:00 -> 02:00 (3小时)', 3, test8, test8 === 3);

// 测试 9: 实际诗雨历史案例（1点到2点）
const test9 = calculateLejuanHours('2026-04-23 01:00:00', '2026-04-23 02:00:41');
logTest('历史案例：1:00 -> 2:00:41 (60分钟)', 1, test9, test9 === 1);

// 测试 10: 半小时（不算额外）
const test10 = calculateLejuanHours('2026-04-24 00:00:00', '2026-04-24 00:30:00');
logTest('半小时（剩余30分>10）', 1, test10, test10 === 1);

// ========== 测试总结 ==========

console.log('\n============================================');
console.log('  测试结果汇总');
console.log('============================================\n');

const passedCount = testResults.filter(r => r.passed).length;
const totalCount = testResults.length;
console.log(`总计: ${totalCount} 个测试`);
console.log(`通过: ${passedCount} 个`);
console.log(`失败: ${totalCount - passedCount} 个`);

if (passedCount === totalCount) {
  console.log('\n✅ 所有测试通过！新算法正确。');
} else {
  console.log('\n❌ 有测试失败：');
  testResults.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.name}: 预期${r.expected}, 实际${r.actual}`);
  });
}

// ========== 验证 TimeUtil.toDate 正确性 ==========

console.log('\n============================================');
console.log('  TimeUtil.toDate 验证');
console.log('============================================\n');

const timeStr = '2026-04-24 00:00:00';
const parsed = TimeUtil.toDate(timeStr);
console.log(`输入: "${timeStr}"`);
console.log(`解析: ${parsed.toISOString()}`);
console.log(`本地时间: ${parsed.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);

// 验证 +08:00 时区是否正确
const expectedUTC = '2026-04-23T16:00:00.000Z'; // 北京时间 00:00 = UTC 16:00 前一天
const actualUTC = parsed.toISOString();
console.log(`预期 UTC: ${expectedUTC}`);
console.log(`实际 UTC: ${actualUTC}`);
console.log(`时区解析: ${actualUTC === expectedUTC ? '✅ 正确' : '❌ 错误'}`);