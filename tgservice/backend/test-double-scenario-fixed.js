/**
 * 测试：双重场景判断逻辑修复
 * 
 * 测试场景：
 * 1. 没有打卡记录 → 双重场景
 * 2. 有打卡记录 + clock_in_time 与钉钉打卡时间相差 ≤ 15分钟 → 双重场景
 * 3. 有打卡记录 + clock_in_time 与钉钉打卡时间相差 > 15分钟 → 单一场景
 */

const { db, dbRun, dbGet, runInTransaction } = require('./db/index');
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
async function initTestCoach(status = '乐捐') {
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
async function createLejuanRecord() {
  console.log('\n========== 创建乐捐记录 ==========');
  
  const todayStr = TimeUtil.todayStr();
  const scheduledTime = `${todayStr} 14:00:00`;
  
  const result = await dbRun(`
    INSERT INTO lejuan_records (coach_no, employee_id, stage_name, scheduled_start_time, actual_start_time, lejuan_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
  `, [TEST_COACH_NO, TEST_EMPLOYEE_ID, TEST_STAGE_NAME, scheduledTime, scheduledTime, TimeUtil.nowDB(), TimeUtil.nowDB()]);
  
  console.log(`✅ 乐捐记录已创建: id=${result.lastID}, status=active`);
  return result.lastID;
}

// 创建打卡记录（带 clock_in_time）
async function createAttendanceRecord(clockInTime) {
  console.log('\n========== 创建打卡记录 ==========');
  
  const todayStr = TimeUtil.todayStr();
  
  const result = await dbRun(`
    INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [todayStr, TEST_COACH_NO, TEST_EMPLOYEE_ID, TEST_STAGE_NAME, clockInTime, TimeUtil.nowDB(), TimeUtil.nowDB()]);
  
  console.log(`✅ 打卡记录已创建: clock_in_time=${clockInTime}`);
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
  const dbCtx = { get: dbGet, all: dbGet, enqueueRun: dbRun };
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

async function test1_NoAttendance_DoubleScenario() {
  console.log('\n========================================');
  console.log('测试用例1: 没有打卡记录 → 双重场景');
  console.log('========================================');
  
  await cleanupTestData();
  await initTestCoach('乐捐');
  await createLejuanRecord();
  // 不创建打卡记录
  
  const todayStr = TimeUtil.todayStr();
  const checkTimeStr = `${todayStr} 16:30:00`;
  await simulateDingtalkPush(checkTimeStr);
  
  // 预期：两个表都有钉钉时间（双重场景）
  const result = await verifyResults('没有打卡记录', checkTimeStr, checkTimeStr);
  return result;
}

async function test2_ClockInTimeClose_DoubleScenario() {
  console.log('\n========================================');
  console.log('测试用例2: clock_in_time 与钉钉打卡时间相差 ≤ 15分钟 → 双重场景');
  console.log('========================================');
  
  await cleanupTestData();
  await initTestCoach('乐捐');
  await createLejuanRecord();
  
  const todayStr = TimeUtil.todayStr();
  const clockInTime = `${todayStr} 19:56:45`;  // 系统打卡时间
  await createAttendanceRecord(clockInTime);
  
  const checkTimeStr = `${todayStr} 19:55:33`;  // 钉钉打卡时间（相差1分钟）
  await simulateDingtalkPush(checkTimeStr);
  
  // 预期：两个表都有钉钉时间（双重场景）
  const result = await verifyResults('clock_in_time接近（1分钟）', checkTimeStr, checkTimeStr);
  return result;
}

async function test3_ClockInTimeFar_SingleScenario() {
  console.log('\n========================================');
  console.log('测试用例3: clock_in_time 与钉钉打卡时间相差 > 15分钟 → 单一场景');
  console.log('========================================');
  
  await cleanupTestData();
  await initTestCoach('乐捐');
  await createLejuanRecord();
  
  const todayStr = TimeUtil.todayStr();
  const clockInTime = `${todayStr} 18:00:00`;  // 系统打卡时间（乐捐开始时间）
  await createAttendanceRecord(clockInTime);
  
  const checkTimeStr = `${todayStr} 19:55:33`;  // 钉钉打卡时间（相差115分钟）
  await simulateDingtalkPush(checkTimeStr);
  
  // 预期：只有乐捐表有钉钉时间（单一场景）
  const result = await verifyResults('clock_in_time相差115分钟', checkTimeStr, null);
  return result;
}

async function test4_ClockInTime15Min_DoubleScenario() {
  console.log('\n========================================');
  console.log('测试用例4: clock_in_time 与钉钉打卡时间相差刚好15分钟 → 双重场景');
  console.log('========================================');
  
  await cleanupTestData();
  await initTestCoach('乐捐');
  await createLejuanRecord();
  
  const todayStr = TimeUtil.todayStr();
  const clockInTime = `${todayStr} 19:40:00`;  // 系统打卡时间
  await createAttendanceRecord(clockInTime);
  
  const checkTimeStr = `${todayStr} 19:55:00`;  // 钉钉打卡时间（相差刚好15分钟）
  await simulateDingtalkPush(checkTimeStr);
  
  // 预期：两个表都有钉钉时间（双重场景，15分钟刚好触发）
  const result = await verifyResults('clock_in_time相差刚好15分钟', checkTimeStr, checkTimeStr);
  return result;
}

async function test5_ClockInTime25Min_SingleScenario() {
  console.log('\n========================================');
  console.log('测试用例5: clock_in_time 与钉钉打卡时间相差25分钟 → 单一场景');
  console.log('========================================');
  
  await cleanupTestData();
  await initTestCoach('乐捐');
  await createLejuanRecord();
  
  const todayStr = TimeUtil.todayStr();
  const clockInTime = `${todayStr} 19:30:00`;  // 系统打卡时间
  await createAttendanceRecord(clockInTime);
  
  const checkTimeStr = `${todayStr} 19:55:00`;  // 钉钉打卡时间（相差25分钟）
  await simulateDingtalkPush(checkTimeStr);
  
  // 预期：只有乐捐表有钉钉时间（单一场景）
  const result = await verifyResults('clock_in_time相差25分钟', checkTimeStr, null);
  return result;
}

// ========== 主函数 ==========

async function main() {
  console.log('\n========================================');
  console.log('  双重场景判断逻辑测试');
  console.log('  日期: ' + TimeUtil.nowDB());
  console.log('========================================');
  
  try {
    const results = [];
    
    results.push(await test1_NoAttendance_DoubleScenario());
    results.push(await test2_ClockInTimeClose_DoubleScenario());
    results.push(await test3_ClockInTimeFar_SingleScenario());
    results.push(await test4_ClockInTime15Min_DoubleScenario());
    results.push(await test5_ClockInTime25Min_SingleScenario());
    
    console.log('\n========================================');
    console.log('  测试结果汇总');
    console.log('========================================');
    
    console.log(`测试用例1（无打卡记录）: ${results[0] ? '✅ 通过' : '❌ 失败'}`);
    console.log(`测试用例2（相差1分钟）: ${results[1] ? '✅ 通过' : '❌ 失败'}`);
    console.log(`测试用例3（相差115分钟）: ${results[2] ? '✅ 通过' : '❌ 失败'}`);
    console.log(`测试用例4（相差15分钟）: ${results[3] ? '✅ 通过' : '❌ 失败'}`);
    console.log(`测试用例5（相差25分钟）: ${results[4] ? '✅ 通过' : '❌ 失败'}`);
    
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