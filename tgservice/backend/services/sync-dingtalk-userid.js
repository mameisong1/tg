/**
 * 同步助教钉钉用户ID
 * 系统启动时执行，查询 dingtalk_user_id 为空的助教并更新
 */

const dingtalkService = require('./dingtalk-service');
const { all, enqueueRun } = require('../db');
const TimeUtil = require('../utils/time');

/**
 * 同步所有助教的钉钉用户ID
 * @returns {Promise<object>} 同步结果
 */
async function syncDingtalkUserIds() {
  const dingtalkLog = dingtalkService.dingtalkLog;
  
  dingtalkLog.write('开始同步助教钉钉用户ID...');
  
  // 查询 dingtalk_user_id 为空的助教
  const coaches = await all(
    `SELECT coach_no, employee_id, stage_name, phone FROM coaches 
     WHERE (dingtalk_user_id IS NULL OR dingtalk_user_id = '') 
       AND phone IS NOT NULL 
       AND phone != ''
       AND status != '离职'`,
    []
  );
  
  dingtalkLog.write(`找到 ${coaches.length} 位需要同步的助教`);
  
  const results = {
    total: coaches.length,
    success: 0,
    failed: 0,
    details: []
  };
  
  for (const coach of coaches) {
    try {
      dingtalkLog.write(`查询 ${coach.stage_name} (${coach.phone}) 的钉钉用户ID...`);
      
      const userid = await dingtalkService.getUserIdByMobile(coach.phone);
      
      if (userid) {
        // 更新数据库
        await enqueueRun(
          `UPDATE coaches SET dingtalk_user_id = ?, updated_at = ? WHERE coach_no = ?`,
          [userid, TimeUtil.nowDB(), coach.coach_no]
        );
        
        dingtalkLog.write(`${coach.stage_name} 钉钉用户ID: ${userid} 已更新`);
        results.success++;
        results.details.push({
          coach_no: coach.coach_no,
          stage_name: coach.stage_name,
          phone: coach.phone,
          userid: userid,
          status: 'success'
        });
      } else {
        dingtalkLog.write(`${coach.stage_name} 未找到钉钉用户ID`);
        results.failed++;
        results.details.push({
          coach_no: coach.coach_no,
          stage_name: coach.stage_name,
          phone: coach.phone,
          userid: null,
          status: 'not_found'
        });
      }
      
      // 每次查询间隔 100ms，避免频繁调用
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err) {
      dingtalkLog.write(`${coach.stage_name} 同步失败: ${err.message}`);
      results.failed++;
      results.details.push({
        coach_no: coach.coach_no,
        stage_name: coach.stage_name,
        phone: coach.phone,
        error: err.message,
        status: 'error'
      });
    }
  }
  
  dingtalkLog.write(`同步完成: 成功 ${results.success}, 失败 ${results.failed}`);
  
  return results;
}

module.exports = {
  syncDingtalkUserIds
};