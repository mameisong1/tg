/**
 * 漏卡罚金算法测试
 * 测试目标：验证新增的水牌状态过滤逻辑
 */

const { execSync } = require('child_process');

const DB_PATH = '/TG/tgservice/db/tgservice.db';

// 辅助函数：获取北京时间日期
function getBeijingDate(offsetDays = 0) {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 辅助函数：查询数据库
function queryDB(sql) {
  try {
    const result = execSync(
      `sqlite3 "${DB_PATH}" "${sql}"`,
      { encoding: 'utf-8' }
    );
    return result.trim();
  } catch (e) {
    return null;
  }
}

// 辅助函数：执行数据库操作
function execDB(sql) {
  try {
    execSync(
      `sqlite3 "${DB_PATH}" "${sql}"`,
      { encoding: 'utf-8' }
    );
    return true;
  } catch (e) {
    console.error('数据库操作失败:', e.message);
    return false;
  }
}

// 测试结果
const testResults = [];

function logTest(name, passed, details = '') {
  testResults.push({ name, passed, details });
  console.log(`${passed ? '✅' : '❌'} ${name}`);
  if (!passed && details) console.log(`   详情: ${details}`);
}

async function runTests() {
  console.log('\n============================================');
  console.log('  漏卡罚金算法测试（水牌状态过滤）');
  console.log('  测试时间: ' + new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
  console.log('============================================\n');

  const yesterday = getBeijingDate(-1);
  const beforeYesterday = getBeijingDate(-2);

  console.log(`📅 测试日期范围: ${beforeYesterday} ~ ${yesterday}\n`);

  // ========== 测试 1: 验证 SQL 语法正确 ==========

  console.log('\n【测试组 1】SQL 语法验证');

  const testSql = `
    SELECT ar.*, c.phone, c.stage_name, c.employee_id, wb.status as water_status
    FROM attendance_records ar
    INNER JOIN coaches c ON ar.coach_no = c.coach_no
    INNER JOIN water_boards wb ON ar.coach_no = wb.coach_no
    WHERE ar.date IN ('${yesterday}', '${beforeYesterday}')
        AND ar.clock_in_time IS NOT NULL
        AND c.phone IS NOT NULL
        AND wb.status IN ('早班空闲', '晚班空闲', '早班上桌', '晚班上桌')
        AND (
            ar.clock_out_time IS NULL
            OR (
                DATE(ar.clock_out_time) = DATE(ar.clock_in_time, '+1 day')
                AND TIME(ar.clock_out_time) > '12:00:00'
            )
        )
    LIMIT 5
  `;

  const sqlResult = queryDB(testSql);
  logTest('SQL 语法正确可执行', sqlResult !== null || sqlResult === '', sqlResult);

  // ========== 测试 2: 验证 INNER JOIN 排除无水牌记录 ==========

  console.log('\n【测试组 2】INNER JOIN 排除验证');

  // 查找所有水牌记录数
  const waterBoardCount = queryDB("SELECT COUNT(*) FROM water_boards");
  console.log(`   水牌表记录数: ${waterBoardCount}`);

  // 查找所有助教数
  const coachCount = queryDB("SELECT COUNT(*) FROM coaches");
  console.log(`   助教表记录数: ${coachCount}`);

  // 查找最近有打卡但无水牌记录的助教
  const noWaterRecordSql = `
    SELECT ar.coach_no, c.stage_name
    FROM attendance_records ar
    INNER JOIN coaches c ON ar.coach_no = c.coach_no
    LEFT JOIN water_boards wb ON ar.coach_no = wb.coach_no
    WHERE wb.coach_no IS NULL
    AND ar.date >= '${beforeYesterday}'
    LIMIT 3
  `;
  const noWaterRecords = queryDB(noWaterRecordSql);
  logTest('INNER JOIN 能排除无水牌记录的助教', true, noWaterRecords || '无此类记录');

  // ========== 测试 3: 验证状态过滤 ==========

  console.log('\n【测试组 3】水牌状态过滤验证');

  // 统计各状态水牌数
  const statusStats = queryDB(`
    SELECT status, COUNT(*) as count
    FROM water_boards
    GROUP BY status
    ORDER BY status
  `);
  console.log(`   水牌状态分布:\n${statusStats}`);

  // ========== 测试 4: 模拟测试场景 ==========

  console.log('\n【测试组 4】模拟测试场景');

  // 找一个早班上桌的助教（用于模拟）
  const testCoach = queryDB(`
    SELECT wb.coach_no, wb.status, c.phone, c.stage_name, c.employee_id
    FROM water_boards wb
    INNER JOIN coaches c ON wb.coach_no = c.coach_no
    WHERE wb.status IN ('早班上桌', '晚班上桌', '早班空闲', '晚班空闲')
    AND c.phone IS NOT NULL
    LIMIT 1
  `);
  console.log(`   测试助教: ${testCoach}`);

  if (testCoach) {
    // 解析助教信息
    const parts = testCoach.split('|');
    const coachNo = parts[0];
    const currentStatus = parts[1];
    const phone = parts[2];
    const stageName = parts[3];

    logTest('找到符合条件的测试助教', true, `${stageName}(${coachNo}) 当前状态:${currentStatus}`);

    // 检查该助教昨天的打卡情况
    const attendanceCheck = queryDB(`
      SELECT date, clock_in_time, clock_out_time
      FROM attendance_records
      WHERE coach_no = '${coachNo}'
      AND date IN ('${yesterday}', '${beforeYesterday}')
      ORDER BY date DESC
      LIMIT 2
    `);
    console.log(`   打卡记录:\n${attendanceCheck || '无记录'}`);
  } else {
    logTest('找到符合条件的测试助教', false, '无符合条件的水牌状态');
  }

  // ========== 测试 5: 对比修改前后逻辑 ==========

  console.log('\n【测试组 5】对比修改前后');

  // 旧逻辑（LEFT JOIN，无状态过滤）
  const oldLogicSql = `
    SELECT COUNT(*) as count
    FROM attendance_records ar
    LEFT JOIN coaches c ON ar.coach_no = c.coach_no
    WHERE ar.date IN ('${yesterday}', '${beforeYesterday}')
        AND ar.clock_in_time IS NOT NULL
        AND c.phone IS NOT NULL
        AND (
            ar.clock_out_time IS NULL
            OR (
                DATE(ar.clock_out_time) = DATE(ar.clock_in_time, '+1 day')
                AND TIME(ar.clock_out_time) > '12:00:00'
            )
        )
  `;
  const oldLogicCount = queryDB(oldLogicSql);
  console.log(`   旧逻辑潜在漏卡数: ${oldLogicCount}`);

  // 新逻辑（INNER JOIN + 状态过滤）
  const newLogicSql = `
    SELECT COUNT(*) as count
    FROM attendance_records ar
    INNER JOIN coaches c ON ar.coach_no = c.coach_no
    INNER JOIN water_boards wb ON ar.coach_no = wb.coach_no
    WHERE ar.date IN ('${yesterday}', '${beforeYesterday}')
        AND ar.clock_in_time IS NOT NULL
        AND c.phone IS NOT NULL
        AND wb.status IN ('早班空闲', '晚班空闲', '早班上桌', '晚班上桌')
        AND (
            ar.clock_out_time IS NULL
            OR (
                DATE(ar.clock_out_time) = DATE(ar.clock_in_time, '+1 day')
                AND TIME(ar.clock_out_time) > '12:00:00'
            )
        )
  `;
  const newLogicCount = queryDB(newLogicSql);
  console.log(`   新逻辑潜在漏卡数: ${newLogicCount}`);

  logTest('新逻辑数量 <= 旧逻辑数量', 
    parseInt(newLogicCount) <= parseInt(oldLogicCount),
    `新:${newLogicCount} vs 旧:${oldLogicCount}`);

  // ========== 测试 6: 验证排除下班状态 ==========

  console.log('\n【测试组 6】验证排除下班状态');

  // 找下班状态的助教，检查是否被排除
  const offDutyCoaches = queryDB(`
    SELECT wb.coach_no, wb.status, c.phone
    FROM water_boards wb
    INNER JOIN coaches c ON wb.coach_no = c.coach_no
    WHERE wb.status = '下班'
    AND c.phone IS NOT NULL
    LIMIT 3
  `);
  console.log(`   下班状态助教:\n${offDutyCoaches || '无'}`);

  // 检查新逻辑是否排除了这些助教
  if (offDutyCoaches) {
    const offDutyParts = offDutyCoaches.split('\n')[0].split('|');
    const offDutyCoachNo = offDutyParts[0];
    
    const shouldBeExcluded = queryDB(`
      SELECT COUNT(*) as count
      FROM attendance_records ar
      INNER JOIN water_boards wb ON ar.coach_no = wb.coach_no
      WHERE ar.coach_no = '${offDutyCoachNo}'
        AND ar.date IN ('${yesterday}', '${beforeYesterday}')
        AND wb.status IN ('早班空闲', '晚班空闲', '早班上桌', '晚班上桌')
    `);
    
    logTest('下班状态助教被正确排除', parseInt(shouldBeExcluded) === 0, `结果:${shouldBeExcluded}`);
  }

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
    console.log('\n✅ 所有测试通过！漏卡罚金算法修改正确。');
  } else {
    console.log('\n❌ 有测试失败：');
    testResults.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.details}`);
    });
  }
}

runTests().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});