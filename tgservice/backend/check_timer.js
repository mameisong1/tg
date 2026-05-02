const { dbAll, dbGet, enqueueRun } = require('./db/index');

const TimeUtil = require('./utils/time');

async function checkNeedFix() {
  const today = '2026-05-02';
  console.log('=== 筛选需要修复Timer的申请记录 ===');
  console.log('今天:', today);
  console.log('');
  
  const apps = await dbAll(
    `SELECT id, applicant_phone, application_type, status, extra_data, approve_time 
    FROM applications 
    WHERE status = 1 
      AND application_type IN ('休息申请', '请假申请') 
      AND extra_data NOT LIKE '%timer_set%' 
    ORDER BY approve_time DESC`
  );
  
  const needFixApps = [];
  for (const app of apps) {
    try {
      const extra = JSON.parse(app.extra_data || '{}');
      const restDate = extra.rest_date || extra.leave_date;
      
      if (restDate >= today && !extra.timer_set && !extra.executed) {
        needFixApps.push({
          id: app.id,
          applicant_phone: app.applicant_phone,
          application_type: app.application_type,
          rest_date: restDate,
          approve_time: app.approve_time
        });
      }
    } catch(e) {}
  }
  
  console.log('需要修复Timer的记录:', needFixApps.length, ' 条');
  needFixApps.forEach(app => {
    console.log('ID:', app.id, '| 类型:', app.application_type, '| 休息日期:', app.rest_date, '| 审批时间:', app.approve_time);
  });
}

checkNeedFix().catch(e => { console.error(e); process.exit(1); });