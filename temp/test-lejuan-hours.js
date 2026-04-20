/**
 * 乐捐时长算法测试用例
 * 测试规则：结束分钟 > 10 算一小时，≤ 10 不算
 */

// 测试函数：模拟新算法
function calculateLejuanHours(startTimeStr, endTimeStr) {
    const startTime = new Date(startTimeStr + '+08:00');
    const endTime = new Date(endTimeStr + '+08:00');
    const diffMs = endTime.getTime() - startTime.getTime();
    const baseHours = Math.floor(diffMs / (60 * 60 * 1000));
    const endMinute = endTime.getMinutes();
    const extraHour = endMinute > 10 ? 1 : 0;
    return Math.max(1, baseHours + extraHour);
}

// 测试用例
const testCases = [
    // 基础场景：结束分钟 ≤ 10
    { start: '2026-04-20 14:00:00', end: '2026-04-20 15:05:00', expected: 1, desc: '14:00→15:05，分钟5≤10，不算' },
    { start: '2026-04-20 14:00:00', end: '2026-04-20 15:10:00', expected: 1, desc: '14:00→15:10，分钟10≤10，不算' },
    
    // 基础场景：结束分钟 > 10
    { start: '2026-04-20 14:00:00', end: '2026-04-20 15:11:00', expected: 2, desc: '14:00→15:11，分钟11>10，算' },
    { start: '2026-04-20 14:00:00', end: '2026-04-20 15:15:00', expected: 2, desc: '14:00→15:15，分钟15>10，算' },
    { start: '2026-04-20 14:00:00', end: '2026-04-20 15:59:00', expected: 2, desc: '14:00→15:59，分钟59>10，算' },
    
    // 多小时场景
    { start: '2026-04-20 14:00:00', end: '2026-04-20 16:05:00', expected: 2, desc: '14:00→16:05，分钟5≤10，不算' },
    { start: '2026-04-20 14:00:00', end: '2026-04-20 16:15:00', expected: 3, desc: '14:00→16:15，分钟15>10，算' },
    { start: '2026-04-20 14:00:00', end: '2026-04-20 17:10:00', expected: 3, desc: '14:00→17:10，分钟10≤10，不算' },
    { start: '2026-04-20 14:00:00', end: '2026-04-20 17:30:00', expected: 4, desc: '14:00→17:30，分钟30>10，算' },
    
    // 跨小时场景
    { start: '2026-04-20 14:30:00', end: '2026-04-20 15:05:00', expected: 1, desc: '14:30→15:05，分钟5≤10，不算' },
    { start: '2026-04-20 14:30:00', end: '2026-04-20 15:15:00', expected: 1, desc: '14:30→15:15，分钟15>10，算（baseHours=0）' },
    { start: '2026-04-20 14:55:00', end: '2026-04-20 15:05:00', expected: 1, desc: '14:55→15:05，分钟5≤10，不算（最小1）' },
    
    // 极端场景：小于1小时
    { start: '2026-04-20 14:00:00', end: '2026-04-20 14:05:00', expected: 1, desc: '14:00→14:05，小于1小时，最小1' },
    { start: '2026-04-20 14:00:00', end: '2026-04-20 14:15:00', expected: 1, desc: '14:00→14:15，小于1小时但分钟>10，最小1' },
    
    // 长时间场景
    { start: '2026-04-20 14:00:00', end: '2026-04-20 23:05:00', expected: 9, desc: '14:00→23:05，分钟5≤10，不算' },
    { start: '2026-04-20 14:00:00', end: '2026-04-20 23:15:00', expected: 10, desc: '14:00→23:15，分钟15>10，算' },
];

// 执行测试
console.log('========================================');
console.log('  乐捐时长算法测试');
console.log('========================================\n');

let passed = 0;
let failed = 0;

for (const tc of testCases) {
    const result = calculateLejuanHours(tc.start, tc.end);
    const status = result === tc.expected ? '✅ PASS' : '❌ FAIL';
    
    if (result === tc.expected) {
        passed++;
    } else {
        failed++;
    }
    
    console.log(`${status} | ${tc.desc}`);
    console.log(`      计算: ${tc.start} → ${tc.end} = ${result}小时 (期望: ${tc.expected}小时)`);
    console.log('');
}

console.log('========================================');
console.log(`  测试结果: ${passed}/${testCases.length} 通过`);
if (failed > 0) {
    console.log(`  ❌ 失败: ${failed} 个`);
} else {
    console.log('  ✅ 全部通过！');
}
console.log('========================================');