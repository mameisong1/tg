/**
 * 生成测试约客数据
 * 早班晚班各50条，使用助教照片作为约客截图
 */

const Database = require('better-sqlite3');
const path = require('path');

// 测试环境数据库路径
const dbPath = process.env.TGSERVICE_ENV === 'test' 
  ? '/TG/tgservice/db/tgservice.db'
  : '/TG/tgservice/db/tgservice.db';

const db = new Database(dbPath);

// 获取所有助教及其照片
const coaches = db.prepare(`
  SELECT coach_no, stage_name, photos 
  FROM coaches 
  WHERE photos IS NOT NULL AND photos != '[]'
`).all();

console.log(`找到 ${coaches.length} 个有照片的助教`);

// 提取所有照片URL
const allPhotos = [];
coaches.forEach(c => {
  if (c.photos) {
    try {
      const photos = JSON.parse(c.photos);
      photos.forEach(url => {
        allPhotos.push({
          coach_no: c.coach_no,
          stage_name: c.stage_name || `助教${c.coach_no}`,
          url: url
        });
      });
    } catch (e) {
      console.log(`解析照片失败: ${c.coach_no}`);
    }
  }
});

console.log(`共 ${allPhotos.length} 张照片可用`);

// 清理旧测试数据（最近3天的数据）
const today = new Date();
const dates = [];
for (let d = 0; d < 3; d++) {
  const dateObj = new Date(today);
  dateObj.setDate(dateObj.getDate() - d);
  dates.push(dateObj.toISOString().split('T')[0]);
}

dates.forEach(d => {
  db.prepare(`DELETE FROM guest_invitation_results WHERE date = ?`).run(d);
});
console.log(`已清理 ${dates.join(', ')} 的旧数据`);

// 生成早班50条（使用3天数据）
const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO guest_invitation_results 
  (date, shift, coach_no, stage_name, invitation_image_url, result, created_at)
  VALUES (?, ?, ?, ?, ?, '待审查', datetime('now', 'localtime'))
`);

let earlyCount = 0;
let lateCount = 0;

// 每天生成约客数据
for (let dayIdx = 0; dayIdx < dates.length; dayIdx++) {
  const date = dates[dayIdx];
  
  // 早班：每天生成约20条（3天共60条）
  for (let i = 0; i < 20 && earlyCount < 50; i++) {
    const photo = allPhotos[(dayIdx * 20 + i) % allPhotos.length];
    insertStmt.run(date, '早班', photo.coach_no, photo.stage_name, photo.url);
    earlyCount++;
  }
  
  // 晚班：每天生成约20条
  for (let i = 0; i < 20 && lateCount < 50; i++) {
    const photo = allPhotos[(dayIdx * 20 + i + 10) % allPhotos.length]; // 偏移10张照片
    insertStmt.run(date, '晚班', photo.coach_no, photo.stage_name, photo.url);
    lateCount++;
  }
}
console.log(`已生成早班约客数据 ${earlyCount} 条`);
console.log(`已生成晚班约客数据 ${lateCount} 条`);

// 验证结果
const totalEarly = db.prepare(`SELECT COUNT(*) as count FROM guest_invitation_results WHERE shift = '早班'`).get();
const totalLate = db.prepare(`SELECT COUNT(*) as count FROM guest_invitation_results WHERE shift = '晚班'`).get();

console.log(`\n生成结果：`);
console.log(`早班约客: ${totalEarly.count} 条`);
console.log(`晚班约客: ${totalLate.count} 条`);

// 显示部分数据
const samples = db.prepare(`
  SELECT id, coach_no, stage_name, shift, invitation_image_url, result 
  FROM guest_invitation_results 
  ORDER BY created_at DESC
  LIMIT 5
`).all();

console.log('\n示例数据：');
samples.forEach(s => {
  console.log(`${s.id}: ${s.coach_no}号 ${s.stage_name} - ${s.shift} - ${s.result}`);
});

db.close();
console.log('\n测试数据生成完成！');