/**
 * 测试 reset_water_board_status 任务
 */

const cronScheduler = require('../backend/services/cron-scheduler');

async function test() {
    console.log('===== 测试 reset_water_board_status =====');
    
    try {
        // 手动触发任务
        const result = await cronScheduler.triggerTask('reset_water_board_status');
        console.log('执行结果:', result);
    } catch (err) {
        console.error('执行失败:', err.message);
    }
    
    process.exit(0);
}

test();