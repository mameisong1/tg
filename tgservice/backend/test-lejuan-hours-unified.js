/**
 * 测试：乐捐时长计算统一函数
 * 
 * 测试场景：
 * 1. 预约16:00，归来18:08 → 2小时（剩余8分钟不算）
 * 2. 预约16:00，归来18:12 → 3小时（剩余12分钟算一小时）
 * 3. 预约16:00，归来17:05 → 1小时（剩余5分钟不算）
 * 4. 预约16:00，归来17:15 → 2小时（剩余15分钟算一小时）
 * 5. 预约16:00，归来16:30 → 1小时（最少1小时）
 * 6. 预约16:00，归来16:00 → 1小时（时间差为0）
 */

const { calculateLejuanHours } = require('./utils/lejuan-hours');

// 测试用例
const testCases = [
  {
    name: '预约16:00，归来18:08 → 2小时',
    scheduledStart: '2026-04-24 16:00:00',
    endTime: '2026-04-24 18:08:00',
    expected: 2
  },
  {
    name: '预约16:00，归来18:12 → 3小时',
    scheduledStart: '2026-04-24 16:00:00',
    endTime: '2026-04-24 18:12:00',
    expected: 3
  },
  {
    name: '预约16:00，归来17:05 → 1小时',
    scheduledStart: '2026-04-24 16:00:00',
    endTime: '2026-04-24 17:05:00',
    expected: 1
  },
  {
    name: '预约16:00，归来17:15 → 2小时',
    scheduledStart: '2026-04-24 16:00:00',
    endTime: '2026-04-24 17:15:00',
    expected: 2
  },
  {
    name: '预约16:00，归来16:30 → 1小时（最少1小时）',
    scheduledStart: '2026-04-24 16:00:00',
    endTime: '2026-04-24 16:30:00',
    expected: 1
  },
  {
    name: '预约16:00，归来16:00 → 1小时（时间差为0）',
    scheduledStart: '2026-04-24 16:00:00',
    endTime: '2026-04-24 16:00:00',
    expected: 1
  },
  {
    name: '预约14:00，归来16:30 → 3小时',
    scheduledStart: '2026-04-24 14:00:00',
    endTime: '2026-04-24 16:30:00',
    expected: 3
  },
  {
    name: '无预约时间 → 1小时（默认）',
    scheduledStart: null,
    endTime: '2026-04-24 18:00:00',
    expected: 1
  },
  {
    name: '预约20:00，归来次日02:15 → 7小时（晚班跨天）',
    scheduledStart: '2026-04-24 20:00:00',
    endTime: '2026-04-25 02:15:00',
    expected: 7
  }
];

// 运行测试
console.log('\n========================================');
console.log('  乐捐时长计算统一函数测试');
console.log('========================================\n');

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const result = calculateLejuanHours(testCase.scheduledStart, testCase.endTime);
  
  console.log(`测试: ${testCase.name}`);
  console.log(`  预约开始: ${testCase.scheduledStart || '无'}`);
  console.log(`  归来时间: ${testCase.endTime}`);
  console.log(`  预期结果: ${testCase.expected}小时`);
  console.log(`  实际结果: ${result}小时`);
  
  if (result === testCase.expected) {
    console.log('  ✅ 通过\n');
    passed++;
  } else {
    console.log('  ❌ 失败\n');
    failed++;
  }
}

console.log('========================================');
console.log(`  测试结果: ${passed} 通过, ${failed} 失败`);
console.log('========================================\n');

process.exit(failed > 0 ? 1 : 0);