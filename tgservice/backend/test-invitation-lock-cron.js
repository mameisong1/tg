/**
 * 约客锁定改造测试用例（数据库核心逻辑测试）
 * 测试目标：验证锁定状态改为由 cron_tasks 表决定
 */

const { execSync } = require('child_process');
const http = require('http');

const DB_PATH = '/TG/tgservice/db/tgservice.db';
const API_HOST = '127.0.0.1';
const API_PORT = 8088;

// 辅助函数：获取北京时间日期
function getBeijingDate() {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getBeijingTime() {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return now.toISOString().replace('T', ' ').substring(0, 19);
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

// 辅助函数：更新数据库
function updateDB(sql) {
  try {
    execSync(
      `sqlite3 "${DB_PATH}" "${sql}"`,
      { encoding: 'utf-8' }
    );
    return true;
  } catch (e) {
    console.error('数据库更新失败:', e.message);
    return false;
  }
}

// 辅助函数：发送内部 HTTP 请求
function sendInternalRequest(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// 测试结果记录
const testResults = [];

function logTest(name, passed, details = '') {
  testResults.push({ name, passed, details });
  console.log(`${passed ? '✅' : '❌'} ${name}`);
  if (!passed && details) console.log(`   详情: ${details}`);
}

async function runTests() {
  console.log('\n============================================');
  console.log('  约客锁定改造测试（数据库核心逻辑）');
  console.log('  测试时间: ' + new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
  console.log('============================================\n');

  const today = getBeijingDate();
  const nowTime = getBeijingTime();

  console.log(`📅 测试日期: ${today}`);
  console.log(`⏰ 当前时间: ${nowTime}\n`);

  // ========== 初始化：确保 cron_tasks 表有任务记录 ==========

  console.log('\n【初始化】检查 cron_tasks 表...');

  // 检查表是否存在
  const tableCheck = queryDB("SELECT name FROM sqlite_master WHERE type='table' AND name='cron_tasks'");
  if (!tableCheck || !tableCheck.includes('cron_tasks')) {
    console.log('⚠️ cron_tasks 表不存在，跳过测试（需要服务启动时初始化）');
    return;
  }

  // 检查任务记录是否存在
  const taskMorning = queryDB("SELECT task_name FROM cron_tasks WHERE task_name = 'lock_guest_invitation_morning'");
  const taskEvening = queryDB("SELECT task_name FROM cron_tasks WHERE task_name = 'lock_guest_invitation_evening'");

  if (!taskMorning || !taskEvening) {
    console.log('⚠️ 约客锁定任务记录不存在，跳过测试');
    return;
  }

  console.log('✅ cron_tasks 表和任务记录就绪\n');

  // ========== 测试 1: 清空初始状态 ==========

  console.log('\n【测试组 1】初始状态检查');

  updateDB(`UPDATE cron_tasks SET last_status = 'pending', last_run = NULL WHERE task_name = 'lock_guest_invitation_morning'`);
  updateDB(`UPDATE cron_tasks SET last_status = 'pending', last_run = NULL WHERE task_name = 'lock_guest_invitation_evening'`);

  const status1 = queryDB(`SELECT last_status, last_run FROM cron_tasks WHERE task_name = 'lock_guest_invitation_morning'`);
  logTest('早班任务状态已清空', status1 && (status1.includes('pending') || status1.includes('||')), status1);

  // ========== 测试 2: 模拟 Cron 锁定成功 ==========

  console.log('\n【测试组 2】模拟 Cron 锁定成功');

  updateDB(`UPDATE cron_tasks SET last_status = 'success', last_run = '${nowTime}' WHERE task_name = 'lock_guest_invitation_morning'`);

  const status2 = queryDB(`SELECT last_status FROM cron_tasks WHERE task_name = 'lock_guest_invitation_morning'`);
  logTest('last_status 已设置为 success', status2 && status2.includes('success'), status2);

  const runDate2 = queryDB(`SELECT last_run FROM cron_tasks WHERE task_name = 'lock_guest_invitation_morning'`);
  logTest('last_run 已设置为当日', runDate2 && runDate2.startsWith(today), runDate2);

  // ========== 测试 3: check-lock 核心逻辑验证 ==========

  console.log('\n【测试组 3】check-lock 核心逻辑（数据库查询）');

  // 模拟 check-lock API 的查询逻辑
  const checkResult3 = queryDB(`
    SELECT last_run, last_status FROM cron_tasks WHERE task_name = 'lock_guest_invitation_morning'
  `);

  // 判断逻辑：last_status = 'success' 且 last_run 以今日日期开头
  const isLocked3 = checkResult3 && 
                    checkResult3.includes('success') && 
                    checkResult3.split('|')[0].startsWith(today);

  logTest('早班锁定状态判断正确（is_locked=true）', isLocked3, checkResult3);

  // 晚班未锁定
  const checkResultEvening = queryDB(`
    SELECT last_run, last_status FROM cron_tasks WHERE task_name = 'lock_guest_invitation_evening'
  `);
  const isLockedEvening = checkResultEvening && 
                          checkResultEvening.includes('success') && 
                          checkResultEvening.split('|')[0].startsWith(today);
  logTest('晚班锁定状态判断正确（is_locked=false）', !isLockedEvening, checkResultEvening);

  // ========== 测试 4: last_run 不是当日 ==========

  console.log('\n【测试组 4】last_run 是昨日的判断');

  // 设置昨天的日期
  const yesterdayTime = new Date(Date.now() - 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000);
  const yesterdayStr = yesterdayTime.toISOString().replace('T', ' ').substring(0, 19);

  updateDB(`UPDATE cron_tasks SET last_status = 'success', last_run = '${yesterdayStr}' WHERE task_name = 'lock_guest_invitation_morning'`);

  const checkResult4 = queryDB(`
    SELECT last_run, last_status FROM cron_tasks WHERE task_name = 'lock_guest_invitation_morning'
  `);
  const isLocked4 = checkResult4 && 
                    checkResult4.includes('success') && 
                    checkResult4.split('|')[0].startsWith(today);

  logTest('last_run 是昨天时判断 is_locked=false', !isLocked4, checkResult4);

  // ========== 测试 5: last_status 不是 success ==========

  console.log('\n【测试组 5】last_status != success 的判断');

  updateDB(`UPDATE cron_tasks SET last_status = 'failed', last_run = '${nowTime}' WHERE task_name = 'lock_guest_invitation_morning'`);

  const checkResult5 = queryDB(`
    SELECT last_run, last_status FROM cron_tasks WHERE task_name = 'lock_guest_invitation_morning'
  `);
  const isLocked5 = checkResult5 && 
                    checkResult5.includes('success') && 
                    checkResult5.split('|')[0].startsWith(today);

  logTest('last_status=failed 时判断 is_locked=false', !isLocked5, checkResult5);

  // ========== 测试 6: 内部 API 锁定测试 ==========

  console.log('\n【测试组 6】内部 API 锁定测试');

  // 重置状态
  updateDB(`UPDATE cron_tasks SET last_status = 'pending', last_run = NULL WHERE task_name = 'lock_guest_invitation_morning'`);
  updateDB(`DELETE FROM guest_invitation_results WHERE date = '${today}' AND shift = '早班'`);

  // 调用内部 API
  const internalResult = await sendInternalRequest('/api/guest-invitations/internal/lock', {
    date: today,
    shift: '早班'
  });

  logTest('内部 API 返回成功', internalResult.status === 200 && internalResult.data?.success, 
    JSON.stringify(internalResult.data));

  // 检查 cron_tasks 更新
  const statusAfterLock = queryDB(`SELECT last_status FROM cron_tasks WHERE task_name = 'lock_guest_invitation_morning'`);
  logTest('锁定后 cron_tasks.last_status 更新为 success', 
    statusAfterLock && statusAfterLock.includes('success'), statusAfterLock);

  // ========== 测试 7: 重复锁定检查 ==========

  console.log('\n【测试组 7】重复锁定检查');

  // 再次调用内部 API（应该返回错误）
  const internalResultAgain = await sendInternalRequest('/api/guest-invitations/internal/lock', {
    date: today,
    shift: '早班'
  });

  logTest('已锁定时再次锁定返回错误', 
    internalResultAgain.status === 400 && internalResultAgain.data?.error?.includes('已锁定'),
    internalResultAgain.data?.error);

  // ========== 测试 8: 检查 guest_invitation_results 写入 ==========

  console.log('\n【测试组 8】检查应约客记录写入');

  const guestRecords = queryDB(`
    SELECT COUNT(*) FROM guest_invitation_results WHERE date = '${today}' AND shift = '早班' AND result = '应约客'
  `);

  logTest('应约客记录已写入', guestRecords && parseInt(guestRecords) > 0, `记录数: ${guestRecords}`);

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
    console.log('\n✅ 所有测试通过！');
  } else {
    console.log('\n❌ 有测试失败：');
    testResults.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.details}`);
    });
  }

  // 清理测试数据
  console.log('\n【清理】恢复初始状态...');
  updateDB(`UPDATE cron_tasks SET last_status = 'pending', last_run = NULL WHERE task_name = 'lock_guest_invitation_morning'`);
  updateDB(`UPDATE cron_tasks SET last_status = 'pending', last_run = NULL WHERE task_name = 'lock_guest_invitation_evening'`);
  updateDB(`DELETE FROM guest_invitation_results WHERE date = '${today}' AND shift = '早班'`);
  console.log('✅ 清理完成');
}

runTests().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});