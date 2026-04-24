/**
 * 测试：乐捐归来双重场景（钉钉打卡写入两个表）
 * 
 * 测试场景：
 * 1. 乐捐归来 + 无上班打卡记录 → 写入 lejuan_records.dingtalk_return_time + attendance_records.dingtalk_in_time
 * 2. 乐捐归来 + 已有上班打卡记录 → 只写入 lejuan_records.dingtalk_return_time
 * 3. 正常上班打卡 → 只写入 attendance_records.dingtalk_in_time
 * 4. 正常下班打卡 → 只写入 attendance_records.dingtalk_out_time
 */

const { db, dbRun, dbGet, dbAll, runInTransaction } = require('./db/index');
const TimeUtil = require('./utils/time');
const dingtalkService = require('./services/dingtalk-service');

// 测试助教数据
const TEST_COACH_NO = '99999';
const TEST_EMPLOYEE_ID = '999';
const TEST_STAGE_NAME = '测试助教';
const TEST_DINGTALK_USER_ID = 'test_dingtalk_id_99999';

// 清理测试数据
async function cleanupTestData() {
  console.log('\n========== 清理测试数据 ==========');
  
  await dbRun(`DELETE FROM attendance_records WHERE coach_no = ?`, [TEST_COACH_NO]);
  await dbRun(`DELETE FROM lejuan_records WHERE coach_no = ?`, [TEST_COACH_NO]);
  await dbRun(`DELETE FROM water_boards WHERE coach_no = ?`, [TEST_COACH_NO]);
  await dbRun(`DELETE FROM coaches WHERE coach_no = ?`, [TEST_COACH_NO]);
  
  console.log('✅ 测试数据已清理');
}

// 初始化测试助教
async function initTestCoach(status = '下班') {
  console.log('\n========== 初始化测试助教 ==========');
  
  // 创建助教
  await dbRun(`
    INSERT INTO coaches (coach_no, employee_id, stage_name, phone, dingtalk_user_id, shift, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [TEST_COACH_NO, TEST_EMPLOYEE_ID, TEST_STAGE_NAME, '13800000000', TEST_DINGTALK_USER_ID, '早班', '全职']);
  
  // 创建水牌
  await dbRun(`
    INSERT INTO water_boards (coach_no, stage_name, status, clock_in_time, updated_at)
    VALUES (?, ?, ?, NULL, ?)
  `, [TEST_COACH_NO, TEST_STAGE_NAME, status, TimeUtil.nowDB()]);
  
  console.log(`✅ 测试助教已创建: coach_no=${TEST_COACH_NO}, status=${status}`);
}

// 创建乐捐记录
async function createLejuanRecord(status = 'active') {
  console.log('\n========== 创建乐捐记录 ==========');
  
  const todayStr = TimeUtil.todayStr();
  const scheduledTime = `${todayStr} 14:00:00`;
  const actualStartTime = status === 'active' ? scheduledTime : null; // active 状态需要 actual_start_time
  
  const result = await dbRun(`
    INSERT INTO lejuan_records (coach_no, employee_id, stage_name, scheduled_start_time, actual_start_time, lejuan_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [TEST_COACH_NO, TEST_EMPLOYEE_ID, TEST_STAGE_NAME, scheduledTime, actualStartTime, status, TimeUtil.nowDB(), TimeUtil.nowDB()]);
  
  console.log(`✅ 乐捐记录已创建: id=${result.lastID}, status=${status}, actual_start_time=${actualStartTime}`);
  return result.lastID;
}

// 创建上班打卡记录
async function createAttendanceRecord(withDingtalkInTime = false) {
  console.log('\n========== 创建上班打卡记录 ==========');
  
  const todayStr = TimeUtil.todayStr();
  const dingtalkInTime = withDingtalkInTime ? `${todayStr} 14:30:00` : null;
  
  const result = await dbRun(`
    INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, dingtalk_in_time, clock_in_time, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [todayStr, TEST_COACH_NO, TEST_EMPLOYEE_ID, TEST_STAGE_NAME, dingtalkInTime, `${todayStr} 14:30:00`, TimeUtil.nowDB(), TimeUtil.nowDB()]);
  
  console.log(`✅ 打卡记录已创建: id=${result.lastID}, dingtalk_in_time=${dingtalkInTime}`);
  return result.lastID;
}

// 模拟钉钉打卡推送
async function simulateDingtalkPush(checkTimeStr) {
  console.log('\n========== 模拟钉钉打卡推送 ==========');
  console.log(`打卡时间: ${checkTimeStr}`);
  
  // 构造钉钉推送数据（毫秒时间戳）
  const checkTimeTs = new Date(checkTimeStr + '+08:00').getTime();
  
  const eventData = {
    DataList: [{
      userId: TEST_DINGTALK_USER_ID,
      checkTime: checkTimeTs,
      deviceId: 'test_device',
      locationResult: 'Normal'
    }],
    EventType: 'attendance_check_record'
  };
  
  // 调用钉钉服务处理
  const dbCtx = { get: dbGet, all: dbAll, enqueueRun: dbRun };
  await dingtalkService.handleAttendanceEvent(eventData, dbCtx);
  
  console.log('✅ 钉钉打卡推送已处理');
}

// 验证结果
async function verifyResults(scenario, expectedLejuanReturnTime, expectedDingtalkInTime) {
  console.log('\n========== 验证结果 ==========');
  console.log(`场景: ${scenario}`);
  
  const todayStr = TimeUtil.todayStr();
  
  // 检查乐捐表
  const lejuanRecord = await dbGet(`
    SELECT id, dingtalk_return_time FROM lejuan_records 
    WHERE coach_no = ? ORDER BY id DESC LIMIT 1
  `, [TEST_COACH_NO]);
  
  // 检查打卡表
  const attendanceRecord = await dbGet(`
    SELECT id, dingtalk_in_time FROM attendance_records 
    WHERE coach_no = ? AND date = ?
  `, [TEST_COACH_NO, todayStr]);
  
  console.log(`lejuan_records.dingtalk_return_time: ${lejuanRecord?.dingtalk_return_time || '无'}`);
  console.log(`attendance_records.dingtalk_in_time: ${attendanceRecord?.dingtalk_in_time || '无'}`);
  
  // 验证预期
  const lejuanMatch = expectedLejuanReturnTime === null 
    ? (!lejuanRecord?.dingtalk_return_time)
    : (lejuanRecord?.dingtalk_return_time === expectedLejuanReturnTime);
  
  const attendanceMatch = expectedDingtalkInTime === null
    ? (!attendanceRecord?.dingtalk_in_time)
    : (attendanceRecord?.dingtalk_in_time === expectedDingtalkInTime);
  
  if (lejuanMatch && attendanceMatch) {
    console.log('✅ 测试通过！');
    return true;
  } else {
    console.log('❌ 测试失败！');
    console.log(`预期: lejuan_return_time=${expectedLejuanReturnTime}, dingtalk_in_time=${expectedDingtalkInTime}`);
    return false;
  }
}

// ========== 测试用例 ==========

async function test1_DoubleScenario() {
  console.log('\n========================================');
  console.log('测试用例1: 乐捐归来 + 无上班打卡记录（双重场景）');
  console.log('========================================');
  
  await cleanupTestData();
  await initTestCoach('乐捐');
  await createLejuanRecord('active'); // 需要是 active 状态，钉钉查询才能找到
  // 不创建上班打卡记录
  
  const checkTimeStr = `${TimeUtil.todayStr()} 14:43:12`;
  await simulateDingtalkPush(checkTimeStr);
  
  // 预期：两个表都有钉钉时间
  const result = await verifyResults('双重场景', checkTimeStr, checkTimeStr);
  return result;
}

async function test2_SingleScenario() {
  console.log('\n========================================');
  console.log('测试用例2: 乐捐归来 + 已有上班打卡记录（单一场景）');
  console.log('========================================');
  
  await cleanupTestData();
  await initTestCoach('乐捐');
  await createLejuanRecord('active'); // 需要是 active 状态
  await createAttendanceRecord(true); // 已有 dingtalk_in_time
  
  const checkTimeStr = `${TimeUtil.todayStr()} 14:43:12`;
  await simulateDingtalkPush(checkTimeStr);
  
  // 预期：只有乐捐表有钉钉时间，打卡表不变
  const result = await verifyResults('单一场景', checkTimeStr, `${TimeUtil.todayStr()} 14:30:00`);
  return result;
}

async function test3_NormalClockIn() {
  console.log('\n========================================');
  console.log('测试用例3: 正常上班打卡');
  console.log('========================================');
  
  await cleanupTestData();
  await initTestCoach('下班');
  // 不创建乐捐记录
  
  const checkTimeStr = `${TimeUtil.todayStr()} 14:43:12`;
  await simulateDingtalkPush(checkTimeStr);
  
  // 预期：只有打卡表有钉钉时间
  const result = await verifyResults('正常上班', null, checkTimeStr);
  return result;
}

async function test4_NormalClockOut() {
  console.log('\n========================================');
  console.log('测试用例4: 正常下班打卡');
  console.log('========================================');
  
  await cleanupTestData();
  await initTestCoach('早班空闲');
  await createAttendanceRecord(true); // 已有上班打卡
  
  const checkTimeStr = `${TimeUtil.todayStr()} 23:43:12`;
  await simulateDingtalkPush(checkTimeStr);
  
  // 验证下班时间
  const attendanceRecord = await dbGet(`
    SELECT id, dingtalk_out_time FROM attendance_records 
    WHERE coach_no = ? AND date = ?
  `, [TEST_COACH_NO, TimeUtil.todayStr()]);
  
  console.log(`attendance_records.dingtalk_out_time: ${attendanceRecord?.dingtalk_out_time || '无'}`);
  
  if (attendanceRecord?.dingtalk_out_time === checkTimeStr) {
    console.log('✅ 测试通过！');
    return true;
  } else {
    console.log('❌ 测试失败！');
    return false;
  }
}

// ========== 主函数 ==========

async function main() {
  console.log('\n========================================');
  console.log('  乐捐归来双重场景测试');
  console.log('  日期: ' + TimeUtil.nowDB());
  console.log('========================================');
  
  try {
    const results = [];
    
    results.push(await test1_DoubleScenario());
    results.push(await test2_SingleScenario());
    results.push(await test3_NormalClockIn());
    results.push(await test4_NormalClockOut());
    
    console.log('\n========================================');
    console.log('  测试结果汇总');
    console.log('========================================');
    
    console.log(`测试用例1（双重场景）: ${results[0] ? '✅ 通过' : '❌ 失败'}`);
    console.log(`测试用例2（单一场景）: ${results[1] ? '✅ 通过' : '❌ 失败'}`);
    console.log(`测试用例3（正常上班）: ${results[2] ? '✅ 通过' : '❌ 失败'}`);
    console.log(`测试用例4（正常下班）: ${results[3] ? '✅ 通过' : '❌ 失败'}`);
    
    const allPassed = results.every(r => r);
    console.log(`\n总体结果: ${allPassed ? '✅ 全部通过' : '❌ 有失败'}`);
    
    // 最终清理
    await cleanupTestData();
    
    process.exit(allPassed ? 0 : 1);
  } catch (err) {
    console.error('测试异常:', err);
    await cleanupTestData();
    process.exit(1);
  }
}

main();