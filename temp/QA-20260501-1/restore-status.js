/**
 * 恢复助教状态脚本
 */
const { run } = require('/TG/tgservice/backend/db/index');
const TimeUtil = require('/TG/tgservice/backend/utils/time');

async function restoreCoach(coach_no, status) {
    const nowDB = TimeUtil.nowDB();
    await run(`
        UPDATE water_boards SET status = ?, clock_in_time = ?, updated_at = ? WHERE coach_no = ?
    `, [status, nowDB, nowDB, coach_no]);
    console.log(`恢复助教 ${coach_no} 状态为 ${status}`);
}

const coach_no = process.argv[2];
const status = process.argv[3] || '晚班空闲';

restoreCoach(coach_no, status).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });