/**
 * QA测试辅助脚本 - 操作 Turso 云端数据库
 */
const { db, run, get, all } = require('/TG/tgservice/backend/db/index');
const TimeUtil = require('/TG/tgservice/backend/utils/time');

async function setupTestData() {
    const todayStr = TimeUtil.todayStr();
    console.log('今日日期:', todayStr);

    // 1. 找一个下班状态的助教用于测试
    const coach1 = await get(`
        SELECT c.coach_no, c.employee_id, c.stage_name, c.dingtalk_user_id, wb.status
        FROM coaches c
        JOIN water_boards wb ON c.coach_no = wb.coach_no
        WHERE wb.status = '下班' AND c.dingtalk_user_id IS NOT NULL
        LIMIT 1
    `);
    console.log('找到下班助教:', coach1);

    // 2. 查看今天的考勤记录
    const records = await all(`
        SELECT * FROM attendance_records 
        WHERE date = ? 
        ORDER BY created_at DESC LIMIT 5
    `, [todayStr]);
    console.log('今日考勤记录:', records);

    // 3. 查看是否有乐捐状态的助教
    const lejuanCoach = await get(`
        SELECT c.coach_no, c.employee_id, c.stage_name, c.dingtalk_user_id, wb.status
        FROM coaches c
        JOIN water_boards wb ON c.coach_no = wb.coach_no
        WHERE wb.status = '乐捐'
        LIMIT 1
    `);
    console.log('乐捐状态助教:', lejuanCoach);

    return { coach1, records, lejuanCoach, todayStr };
}

async function createTestLejuan(coach_no, employee_id) {
    const nowDB = TimeUtil.nowDB();
    // 创建一个乐捐记录
    const result = await run(`
        INSERT INTO lejuan_records 
        (coach_no, employee_id, stage_name, scheduled_start_time, actual_start_time, lejuan_status, lejuan_hours, created_at, updated_at)
        VALUES (?, ?, '测试乐捐', ?, ?, 'active', 2, ?, ?)
    `, [coach_no, employee_id, nowDB, nowDB, nowDB, nowDB]);
    console.log('创建乐捐记录:', result);

    // 更新水牌状态为乐捐
    await run(`
        UPDATE water_boards SET status = '乐捐', updated_at = ? WHERE coach_no = ?
    `, [nowDB, coach_no]);
    console.log('水牌状态更新为乐捐');
    
    return result;
}

async function setDingtalkTime(coach_no, dateStr, dingtalkInTime) {
    // 模拟钉钉推送的考勤时间
    const nowDB = TimeUtil.nowDB();
    
    // 先检查是否有今天的考勤记录
    const existing = await get(`
        SELECT id FROM attendance_records WHERE coach_no = ? AND date = ?
    `, [coach_no, dateStr]);
    
    if (existing) {
        // 更新现有记录
        await run(`
            UPDATE attendance_records 
            SET dingtalk_in_time = ?, updated_at = ?
            WHERE id = ?
        `, [dingtalkInTime, nowDB, existing.id]);
        console.log('更新钉钉时间到现有记录:', existing.id);
    } else {
        // 创建新记录
        await run(`
            INSERT INTO attendance_records 
            (date, coach_no, employee_id, stage_name, dingtalk_in_time, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [dateStr, coach_no, 'TEST', '测试助教', dingtalkInTime, nowDB, nowDB]);
        console.log('创建新考勤记录，包含钉钉时间');
    }
}

async function resetCoachStatus(coach_no) {
    const nowDB = TimeUtil.nowDB();
    // 重置水牌状态为下班
    await run(`
        UPDATE water_boards SET status = '下班', clock_in_time = NULL, updated_at = ? WHERE coach_no = ?
    `, [nowDB, coach_no]);
    
    // 清除今天的考勤记录的 clock_in_time 和 dingtalk_in_time
    const todayStr = TimeUtil.todayStr();
    await run(`
        UPDATE attendance_records 
        SET clock_in_time = NULL, dingtalk_in_time = NULL, updated_at = ?
        WHERE coach_no = ? AND date = ?
    `, [nowDB, coach_no, todayStr]);
    console.log('重置助教状态:', coach_no);
}

async function getCoachStatus(coach_no) {
    const waterBoard = await get(`
        SELECT * FROM water_boards WHERE coach_no = ?
    `, [coach_no]);
    const todayStr = TimeUtil.todayStr();
    const attendance = await get(`
        SELECT * FROM attendance_records WHERE coach_no = ? AND date = ?
    `, [coach_no, todayStr]);
    return { waterBoard, attendance };
}

// 命令行参数执行
const action = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

if (action === 'setup') {
    setupTestData().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else if (action === 'createLejuan') {
    createTestLejuan(arg1, arg2).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else if (action === 'setDingtalk') {
    const todayStr = TimeUtil.todayStr();
    setDingtalkTime(arg1, todayStr, arg2).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else if (action === 'reset') {
    resetCoachStatus(arg1).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else if (action === 'status') {
    getCoachStatus(arg1).then(r => { console.log(JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
} else {
    console.log('用法: node test-helper.js <setup|createLejuan|setDingtalk|reset|status> [参数]');
    process.exit(1);
}