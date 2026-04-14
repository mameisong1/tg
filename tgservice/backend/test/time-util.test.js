/**
 * 时区统一改造 - 后端 utils/time.js 单元测试
 * 
 * 运行: node backend/test/time-util.test.js
 * 目录: 从 /TG/tgservice/backend/ 运行
 */

const path = require('path');
const timeUtil = require(path.join(__dirname, '..', 'utils', 'time.js'));

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    results.push({ status: 'PASS', message });
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    results.push({ status: 'FAIL', message });
    console.log(`  ❌ FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
    results.push({ status: 'PASS', message });
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    results.push({ status: 'FAIL', message: `${message} (expected: "${expected}", got: "${actual}")` });
    console.log(`  ❌ FAIL: ${message}`);
    console.log(`     期望: "${expected}"`);
    console.log(`     实际: "${actual}"`);
  }
}

// ============================================================
// 1. nowDB() 测试
// ============================================================
console.log('\n📋 测试组 1: nowDB()');

// 1.1 返回值格式匹配
const nowDBResult = timeUtil.nowDB();
assert(
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(nowDBResult),
  `nowDB() 返回格式匹配 "YYYY-MM-DD HH:MM:SS"，实际值: "${nowDBResult}"`
);

// 1.2 解析后与当前时间差应在 1 秒内
const nowDBParsed = new Date(nowDBResult + '+08:00');
const timeDiff = Math.abs(Date.now() - nowDBParsed.getTime());
assert(
  timeDiff < 1000,
  `nowDB() 解析后与当前时间差 < 1秒 (实际差: ${timeDiff}ms)`
);

// 1.3 连续调用时间差不超过 1 秒
const call1 = timeUtil.nowDB();
const call2 = timeUtil.nowDB();
assert(
  call1 === call2 || Math.abs(new Date(call1 + '+08:00') - new Date(call2 + '+08:00')) < 1000,
  `nowDB() 连续调用时间一致 (call1: "${call1}", call2: "${call2}")`
);

// ============================================================
// 2. offsetDB() 测试
// ============================================================
console.log('\n📋 测试组 2: offsetDB()');

// 2.1 偏移 0 小时应接近 nowDB()
const offset0 = timeUtil.offsetDB(0);
const offset0Diff = Math.abs(new Date(offset0 + '+08:00') - new Date(nowDBResult + '+08:00'));
assert(
  offset0Diff < 2000,
  `offsetDB(0) 应接近 nowDB() (差: ${offset0Diff}ms)`
);

// 2.2 偏移 +1 小时（未来 1 小时）
const offsetPlus1 = timeUtil.offsetDB(1);
const diffPlus1 = Math.round((new Date(offsetPlus1 + '+08:00') - new Date(offset0 + '+08:00')) / 3600000);
assert(
  Math.abs(diffPlus1 - 1) <= 0.1,
  `offsetDB(+1) 应比 offsetDB(0) 多约 1 小时 (差: ${diffPlus1}小时)`
);

// 2.3 偏移 -1 小时（过去 1 小时）
const offsetMinus1 = timeUtil.offsetDB(-1);
const diffMinus1 = Math.round((new Date(offsetMinus1 + '+08:00') - new Date(offset0 + '+08:00')) / 3600000);
assert(
  Math.abs(diffMinus1 - (-1)) <= 0.1,
  `offsetDB(-1) 应比 offsetDB(0) 少约 1 小时 (差: ${diffMinus1}小时)`
);

// 2.4 偏移 +24 小时
const offset24 = timeUtil.offsetDB(24);
const diff24 = Math.round((new Date(offset24 + '+08:00') - new Date(offset0 + '+08:00')) / 3600000);
assert(
  Math.abs(diff24 - 24) <= 0.1,
  `offsetDB(+24) 应比 offsetDB(0) 多约 24 小时 (差: ${diff24}小时)`
);

// 2.5 返回值格式
assert(
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(offsetPlus1),
  `offsetDB(+1) 返回格式正确: "${offsetPlus1}"`
);

// ============================================================
// 3. todayStr() 测试
// ============================================================
console.log('\n📋 测试组 3: todayStr()');

// 3.1 返回值格式
const todayResult = timeUtil.todayStr();
assert(
  /^\d{4}-\d{2}-\d{2}$/.test(todayResult),
  `todayStr() 返回格式匹配 "YYYY-MM-DD"，实际值: "${todayResult}"`
);

// 3.2 与北京时间一致（零填充比较）
const bjNow = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
// toLocaleDateString 可能返回 "2026/4/14" 或 "2026-4-14"，统一转为 YYYY-MM-DD 并零填充
const bjNormalized = bjNow.replace(/[\/\-]/g, '-');
const bjParts = bjNormalized.split('-');
const bjPadded = bjParts.map((p, i) => i === 0 ? p : String(p).padStart(2, '0')).join('-');
assert(
  todayResult === bjPadded,
  `todayStr() 与北京时间一致 (todayStr: "${todayResult}", toLocaleDateString: "${bjPadded}")`
);

// 3.3 应该是 nowDB() 的日期部分
assert(
  todayResult === nowDBResult.split(' ')[0],
  `todayStr() 应等于 nowDB() 的日期部分 (todayStr: "${todayResult}", nowDB date: "${nowDBResult.split(' ')[0]}")`
);

// ============================================================
// 4. toDate() 测试
// ============================================================
console.log('\n📋 测试组 4: toDate()');

// 4.1 正常解析
const sampleTime = '2026-04-14 07:23:00';
const dateObj = timeUtil.toDate(sampleTime);
assert(
  dateObj instanceof Date && !isNaN(dateObj.getTime()),
  `toDate("${sampleTime}") 应返回有效 Date 对象`
);

// 4.2 UTC 时间戳正确（2026-04-14 07:23:00 CST = 2026-04-13 23:23:00 UTC）
const expectedUTC = Date.UTC(2026, 3, 13, 23, 23, 0, 0);
assert(
  Math.abs(dateObj.getTime() - expectedUTC) < 1000,
  `toDate("${sampleTime}") UTC 时间戳应约为 ${expectedUTC} (实际: ${dateObj.getTime()})`
);

// 4.3 空值返回 null
assert(
  timeUtil.toDate(null) === null,
  `toDate(null) 应返回 null`
);
assert(
  timeUtil.toDate(undefined) === null,
  `toDate(undefined) 应返回 null`
);
assert(
  timeUtil.toDate('') === null,
  `toDate('') 应返回 null`
);

// 4.4 反向验证：nowDB() -> toDate() -> 回推时间
const roundTrip = timeUtil.toDate(nowDBResult);
assert(
  Math.abs(Date.now() - roundTrip.getTime()) < 2000,
  `nowDB() -> toDate() 往返误差 < 2秒 (实际: ${Math.abs(Date.now() - roundTrip.getTime())}ms)`
);

// ============================================================
// 5. format() 测试
// ============================================================
console.log('\n📋 测试组 5: format()');

// 5.1 正常格式化
const formatted = timeUtil.format(sampleTime);
assert(
  typeof formatted === 'string' && formatted.length > 0,
  `format("${sampleTime}") 应返回非空字符串，实际: "${formatted}"`
);

// 5.2 包含日期和时间信息
assert(
  formatted.includes('2026') && formatted.includes('07') && formatted.includes('23'),
  `format("${sampleTime}") 应包含日期时间信息，实际: "${formatted}"`
);

// 5.3 空值返回 '-'
assertEqual(timeUtil.format(null), '-', `format(null) 应返回 "-"`);
assertEqual(timeUtil.format(''), '-', `format('') 应返回 "-"`);

// 5.4 自定义选项
const customFormat = timeUtil.format(sampleTime, { hour12: true });
assert(
  typeof customFormat === 'string' && customFormat.length > 0,
  `format() 自定义选项应返回字符串，实际: "${customFormat}"`
);

// ============================================================
// 6. formatDate() 测试
// ============================================================
console.log('\n📋 测试组 6: formatDate()');

const formattedDate = timeUtil.formatDate(sampleTime);
assert(
  typeof formattedDate === 'string' && formattedDate.length > 0,
  `formatDate("${sampleTime}") 应返回非空字符串，实际: "${formattedDate}"`
);
assertEqual(timeUtil.formatDate(null), '-', `formatDate(null) 应返回 "-"`);

// ============================================================
// 7. formatTime() 测试
// ============================================================
console.log('\n📋 测试组 7: formatTime()');

const formattedTime = timeUtil.formatTime(sampleTime);
assert(
  typeof formattedTime === 'string' && formattedTime.length > 0,
  `formatTime("${sampleTime}") 应返回非空字符串，实际: "${formattedTime}"`
);
assertEqual(timeUtil.formatTime(null), '-', `formatTime(null) 应返回 "-"`);

// ============================================================
// 8. isWithinMinutes() 测试
// ============================================================
console.log('\n📋 测试组 8: isWithinMinutes()');

// 8.1 刚刚的记录应在 5 分钟内
const justNow = timeUtil.nowDB();
assert(
  timeUtil.isWithinMinutes(justNow, 5) === true,
  `isWithinMinutes(nowDB(), 5) 应为 true`
);

// 8.2 10 分钟前的记录不在 5 分钟内
const tenMinAgo = timeUtil.offsetDB(-10 / 60); // 10 分钟前
assert(
  timeUtil.isWithinMinutes(tenMinAgo, 5) === false,
  `isWithinMinutes(10分钟前, 5) 应为 false`
);

// 8.3 3 分钟前的记录在 5 分钟内
const threeMinAgo = timeUtil.offsetDB(-3 / 60);
assert(
  timeUtil.isWithinMinutes(threeMinAgo, 5) === true,
  `isWithinMinutes(3分钟前, 5) 应为 true`
);

// 8.4 空值返回 false
assert(
  timeUtil.isWithinMinutes(null, 5) === false,
  `isWithinMinutes(null, 5) 应为 false`
);

// 8.5 30 分钟前的记录在 60 分钟内
const thirtyMinAgo = timeUtil.offsetDB(-0.5);
assert(
  timeUtil.isWithinMinutes(thirtyMinAgo, 60) === true,
  `isWithinMinutes(30分钟前, 60) 应为 true`
);

// ============================================================
// 9. toLocaleStr() 测试
// ============================================================
console.log('\n📋 测试组 9: toLocaleStr()');

const localeResult = timeUtil.toLocaleStr();
assert(
  typeof localeResult === 'string' && localeResult.length > 0,
  `toLocaleStr() 应返回非空字符串，实际: "${localeResult}"`
);

// ============================================================
// 汇总报告
// ============================================================
console.log('\n' + '='.repeat(60));
console.log('📊 测试结果汇总');
console.log('='.repeat(60));
console.log(`✅ 通过: ${passed}`);
console.log(`❌ 失败: ${failed}`);
console.log(`📝 总计: ${passed + failed}`);
console.log(`📈 通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
console.log('='.repeat(60));

if (failed > 0) {
  console.log('\n❌ 失败的测试:');
  results.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`  - ${r.message}`);
  });
  process.exit(1);
} else {
  console.log('\n🎉 所有测试通过！');
  process.exit(0);
}
