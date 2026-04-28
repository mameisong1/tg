/**
 * 测试：台桌无关设备查询 改前 vs 改后 结果一致性
 * 
 * 改前：SQL 中 TIME(?) 过滤
 * 改后：查询全量数据 → 内存 timeToMinutes 过滤
 * 
 * 测试覆盖：正常时间段、跨午夜时间段、边界时间、多时段混合
 */

const path = require('path');

// 加载 .config.env
const configPath = path.join(__dirname, '.config.env');
const config = JSON.parse(require('fs').readFileSync(configPath, 'utf-8'));
process.env.TURSO_DATABASE_URL = config.turso.url;
process.env.TURSO_AUTH_TOKEN = config.turso.authToken;

const { all } = require('./backend/db/index');

// ========== 改前的 SQL（直接从数据库查，带 TIME 过滤）==========
function queryOldWay(now) {
  return all(`
    SELECT DISTINCT sd.switch_id, sd.switch_seq
    FROM switch_device sd
    LEFT JOIN table_device td 
      ON LOWER(sd.switch_label) = LOWER(td.switch_label) 
      AND LOWER(sd.switch_seq) = LOWER(td.switch_seq)
    WHERE td.table_name_en IS NULL
      AND sd.device_type = '灯'
      AND sd.auto_off_start != ''
      AND sd.auto_off_end != ''
      AND (
        CASE
          WHEN sd.auto_off_start <= sd.auto_off_end THEN
            (TIME(?) >= TIME(sd.auto_off_start) AND TIME(?) <= TIME(sd.auto_off_end))
          ELSE
            (TIME(?) >= TIME(sd.auto_off_start) OR TIME(?) <= TIME(sd.auto_off_end))
        END
      )
  `, [now, now, now, now]);
}

// ========== 改后的逻辑（全量查询 + 内存过滤）==========
function timeToMinutes(timeStr) {
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

async function queryNewWay(now) {
  // 模拟从缓存/DB 获取全量数据
  const allSwitches = await all(`
    SELECT DISTINCT sd.switch_id, sd.switch_seq, sd.auto_off_start, sd.auto_off_end
    FROM switch_device sd
    LEFT JOIN table_device td 
      ON LOWER(sd.switch_label) = LOWER(td.switch_label) 
      AND LOWER(sd.switch_seq) = LOWER(td.switch_seq)
    WHERE td.table_name_en IS NULL
      AND sd.device_type = '灯'
      AND sd.auto_off_start != ''
      AND sd.auto_off_end != ''
  `);

  const currentMin = timeToMinutes(now.split(' ')[1] || now);
  const filtered = allSwitches.filter(s => {
    const startMin = timeToMinutes(s.auto_off_start);
    const endMin = timeToMinutes(s.auto_off_end);
    if (startMin <= endMin) {
      return currentMin >= startMin && currentMin <= endMin;
    } else {
      return currentMin >= startMin || currentMin <= endMin;
    }
  });

  return filtered;
}

// ========== 测试用例 ==========
const testCases = [
  // === 正常时间段测试（跨午夜窗口：22:00 ~ 06:00）===
  { time: '2026-04-28 03:00:00', desc: '凌晨 3:00 - 跨午夜时段内（22:00-06:00）' },
  { time: '2026-04-28 06:00:00', desc: '早上 6:00 - 跨午夜时段边界（刚好是结束时间）' },
  { time: '2026-04-28 05:59:59', desc: '早上 5:59 - 跨午夜时段内（边界前1秒）' },
  { time: '2026-04-28 22:00:00', desc: '晚上 22:00 - 跨午夜时段开始' },
  { time: '2026-04-28 23:30:00', desc: '晚上 23:30 - 跨午夜时段内' },
  { time: '2026-04-28 06:01:00', desc: '早上 6:01 - 跨午夜时段外（刚过期1分钟）' },
  { time: '2026-04-28 21:59:00', desc: '晚上 21:59 - 跨午夜时段外（开始前1分钟）' },

  // === 正常时间段测试（不跨午夜：01:00 ~ 05:00）===
  { time: '2026-04-28 02:00:00', desc: '凌晨 2:00 - 正常时段内（01:00-05:00）' },
  { time: '2026-04-28 01:00:00', desc: '凌晨 1:00 - 正常时段边界开始' },
  { time: '2026-04-28 05:00:00', desc: '凌晨 5:00 - 正常时段边界结束' },
  { time: '2026-04-28 00:59:00', desc: '凌晨 0:59 - 正常时段外（开始前1分钟）' },
  { time: '2026-04-28 05:01:00', desc: '凌晨 5:01 - 正常时段外（过期1分钟）' },

  // === 白天时间段（应该无结果）===
  { time: '2026-04-28 10:00:00', desc: '上午 10:00 - 白天（预期结果为空）' },
  { time: '2026-04-28 14:00:00', desc: '下午 14:00 - 白天（预期结果为空）' },
  { time: '2026-04-28 18:00:00', desc: '傍晚 18:00 - 白天（预期结果为空）' },

  // === 边界情况 ===
  { time: '2026-04-28 00:00:00', desc: '午夜 00:00 - 跨午夜时段内' },
  { time: '2026-04-28 23:59:59', desc: '深夜 23:59 - 跨午夜时段内（接近午夜）' },
];

async function compareResults() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  台桌无关设备查询：改前 SQL vs 改后 缓存+内存过滤');
  console.log('═══════════════════════════════════════════════════════\n');

  let passCount = 0;
  let failCount = 0;

  for (const tc of testCases) {
    const oldResult = await queryOldWay(tc.time);
    const newResult = await queryNewWay(tc.time);

    // 比较结果：switch_id + switch_seq 的组合
    const oldSet = new Set(oldResult.map(r => `${r.switch_id}|${r.switch_seq}`));
    const newSet = new Set(newResult.map(r => `${r.switch_id}|${r.switch_seq}`));

    const isMatch = oldSet.size === newSet.size && [...oldSet].every(k => newSet.has(k));
    const diff = isMatch ? '✅ PASS' : '❌ FAIL';

    if (isMatch) {
      passCount++;
    } else {
      failCount++;
    }

    console.log(`${diff} ${tc.desc}`);
    console.log(`   时间: ${tc.time.split(' ')[1]}`);
    console.log(`   改前(SQL): ${oldResult.length} 个`);
    console.log(`   改后(内存): ${newResult.length} 个`);

    if (!isMatch) {
      // 找差异
      const onlyInOld = [...oldSet].filter(k => !newSet.has(k));
      const onlyInNew = [...newSet].filter(k => !oldSet.has(k));
      if (onlyInOld.length > 0) {
        console.log(`   ⚠️ 只在改前: ${onlyInOld.join(', ')}`);
      }
      if (onlyInNew.length > 0) {
        console.log(`   ⚠️ 只在改后: ${onlyInNew.join(', ')}`);
      }
    }
    console.log();
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log(`  测试结果: ${passCount}/${testCases.length} 通过, ${failCount} 失败`);
  console.log('═══════════════════════════════════════════════════════');

  process.exit(failCount > 0 ? 1 : 0);
}

compareResults().catch(err => {
  console.error('测试异常:', err);
  process.exit(1);
});
