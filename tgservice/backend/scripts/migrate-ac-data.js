/**
 * 空调数据迁移脚本
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const TimeUtil = require('../utils/time');

const DB_PATHS = {
  production: '/TG/run/db/tgservice.db',
  development: '/TG/tgservice/db/tgservice.db'
};

// 空调数据（手动从XLS提取）
const AC_DATA = [
  { switch_label: 'P19', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '1', time_range: '00:00-->24:00', tables: 'putai19', remark: '' },
  { switch_label: 'P13', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '2', time_range: '00:00-->24:00', tables: 'putai1,putai2', remark: '' },
  { switch_label: 'P14', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '3', time_range: '00:00-->24:00', tables: 'putai13,putai15', remark: '' },
  { switch_label: 'P4', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '4', time_range: '00:00-->14:00', tables: '', remark: '水吧区' },
  { switch_label: 'P9', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '5', time_range: '00:00-->24:00', tables: 'putai16,putai18', remark: '' },
  { switch_label: 'P6', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '6', time_range: '02:00-->14:00', tables: '', remark: '办公室门口休息区' },
  { switch_label: 'P7', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '7', time_range: '00:00-->24:00', tables: 'putai3,putai5', remark: '' },
  { switch_label: 'P21', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '8', time_range: '00:00-->24:00', tables: 'putai7,putai8', remark: '' },
  { switch_label: 'P5', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '9', time_range: '00:00-->14:00', tables: '', remark: '水吧区' },
  { switch_label: 'P18', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '10', time_range: '00:00-->24:00', tables: 'putai21,putai22,putai23,putai25', remark: '' },
  { switch_label: 'P3', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '11', time_range: '00:00-->24:00', tables: '', remark: '收银区' },
  { switch_label: 'P20', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '12', time_range: '00:00-->24:00', tables: 'putai20', remark: '' },
  { switch_label: 'P8', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '13', time_range: '00:00-->24:00', tables: 'putai18,putai6', remark: '' },
  { switch_label: 'P2', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '14', time_range: '02:00-->14:00', tables: '', remark: '休息区' },
  { switch_label: 'OFFICE', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '15', time_range: '02:00-->09:00', tables: '', remark: '办公室' },
  { switch_label: 'P1', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '16', time_range: '00:00-->24:00', tables: '', remark: '前台' },
  { switch_label: 'NA', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '17', time_range: '00:00-->14:00', tables: '', remark: '' },
  { switch_label: 'VIP6', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '1', time_range: '00:00-->24:00', tables: 'vip6', remark: '' },
  { switch_label: 'VIP2', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '2', time_range: '00:00-->24:00', tables: 'vip2', remark: '' },
  { switch_label: 'P16', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '3', time_range: '00:00-->24:00', tables: 'putai9,putai10', remark: '' },
  { switch_label: 'P11', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '4', time_range: '00:00-->24:00', tables: 'putai11', remark: '' },
  { switch_label: 'P17', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '5', time_range: '00:00-->24:00', tables: 'putai17', remark: '' },
  { switch_label: 'P12', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '6', time_range: '00:00-->24:00', tables: 'putai12', remark: '' },
  { switch_label: 'P15', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '7', time_range: '00:00-->24:00', tables: 'putai14', remark: '' },
  { switch_label: 'P10', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '8', time_range: '00:00-->24:00', tables: 'putai4', remark: '' },
  { switch_label: 'BOSS3', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '9', time_range: '00:00-->24:00', tables: 'boss3', remark: '' },
  { switch_label: 'BOSS1', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '10', time_range: '00:00-->24:00', tables: 'boss1', remark: '' },
  { switch_label: 'VIP8', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '11', time_range: '00:00-->24:00', tables: 'vip8', remark: '' },
  { switch_label: 'VIP3', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '12', time_range: '00:00-->24:00', tables: 'vip3', remark: '' },
  { switch_label: 'Q2', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '13', time_range: '00:00-->24:00', tables: 'q2', remark: '' },
  { switch_label: 'VIP7', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '14', time_range: '00:00-->24:00', tables: 'vip7', remark: '' },
  { switch_label: 'BOSS2', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '15', time_range: '00:00-->24:00', tables: 'boss2', remark: '' },
  { switch_label: 'VIP5', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '16', time_range: '00:00-->24:00', tables: 'vip5', remark: '' },
  { switch_label: 'Q1', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '17', time_range: '00:00-->24:00', tables: 'q1', remark: '' },
  { switch_label: 'VIP1', switch_id: '6ceaf318ebda5c1211piog', switch_seq: '18', time_range: '00:00-->24:00', tables: 'vip1', remark: '' }
];

function parseTimeRange(range) {
  if (!range || range.trim() === '') return ['', ''];
  const parts = range.split('-->');
  return [parts[0] || '', parts[1] || ''];
}

async function migrate(dbPath, envName) {
  console.log(`\n========== ${envName} 环境迁移开始 ==========`);
  console.log(`数据库路径: ${dbPath}`);

  const db = new sqlite3.Database(dbPath);

  const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  });

  const all = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  try {
    // 1. 表结构修改
    console.log('\n[1] 表结构修改...');
    const columns = await all("PRAGMA table_info(switch_device)");
    const hasDeviceType = columns.some(c => c.name === 'device_type');
    const hasRemark = columns.some(c => c.name === 'remark');

    if (!hasDeviceType) {
      await run("ALTER TABLE switch_device ADD COLUMN device_type TEXT DEFAULT '灯'");
      console.log('  ✓ 新增 device_type 字段');
    } else {
      console.log('  - device_type 字段已存在');
    }

    if (!hasRemark) {
      await run("ALTER TABLE switch_device ADD COLUMN remark TEXT DEFAULT ''");
      console.log('  ✓ 新增 remark 字段');
    } else {
      console.log('  - remark 字段已存在');
    }

    // 2. 现有数据更新
    console.log('\n[2] 现有数据更新...');
    const existingCount = await get("SELECT COUNT(*) as count FROM switch_device WHERE device_type IS NULL OR device_type = ''");
    if (existingCount.count > 0) {
      await run("UPDATE switch_device SET device_type = '灯' WHERE device_type IS NULL OR device_type = ''");
      console.log(`  ✓ 更新 ${existingCount.count} 条记录为 '灯'`);
    } else {
      console.log('  - 无需更新');
    }

    // 3. 空调数据导入
    console.log('\n[3] 空调数据导入...');
    const now = TimeUtil.nowDB();
    let inserted = 0, skipped = 0;

    for (const row of AC_DATA) {
      const existing = await get(
        "SELECT id FROM switch_device WHERE switch_id = ? AND switch_seq = ?",
        [row.switch_id, row.switch_seq]
      );

      if (existing) {
        skipped++;
        continue;
      }

      const [autoOffStart, autoOffEnd] = parseTimeRange(row.time_range);

      await run(
        `INSERT INTO switch_device (switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, device_type, remark, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.switch_id, row.switch_seq, row.switch_label, autoOffStart, autoOffEnd, '空调', row.remark, now, now]
      );
      inserted++;
    }

    console.log(`  ✓ 插入 ${inserted} 条，跳过 ${skipped} 条`);

    // 4. 台桌设备关系导入
    console.log('\n[4] 台桌设备关系导入...');
    let relationInserted = 0;

    for (const row of AC_DATA) {
      if (!row.tables || row.tables.trim() === '') continue;

      const tableNames = row.tables.split(',').map(t => t.trim()).filter(t => t);

      for (const tableName of tableNames) {
        const existingRel = await get(
          "SELECT id FROM table_device WHERE table_name_en = ? AND switch_seq = ? AND switch_label = ?",
          [tableName, row.switch_seq, row.switch_label]
        );

        if (!existingRel) {
          await run(
            `INSERT INTO table_device (table_name_en, switch_seq, switch_label, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [tableName, row.switch_seq, row.switch_label, now, now]
          );
          relationInserted++;
        }
      }
    }

    console.log(`  ✓ 插入 ${relationInserted} 条台桌设备关系`);

    // 5. 系统配置新增
    console.log('\n[5] 系统配置新增...');
    const acConfig = await get("SELECT key FROM system_config WHERE key = 'ac_control'");
    if (!acConfig) {
      await run(
        `INSERT INTO system_config (key, value, description, updated_at)
         VALUES ('ac_control', '{"temp_set":23,"fan_speed_enum":"middle"}', '空调设定配置', ?)`,
        [now]
      );
      console.log('  ✓ 新增 ac_control 配置');
    } else {
      console.log('  - ac_control 配置已存在');
    }

    console.log(`\n========== ${envName} 环境迁移完成 ==========\n`);

  } catch (err) {
    console.error(`\n❌ 迁移失败:`, err.message);
    throw err;
  } finally {
    db.close();
  }
}

(async () => {
  try {
    await migrate(DB_PATHS.development, '开发');
    await migrate(DB_PATHS.production, '生产');
    console.log('✅ 全部迁移完成！');
    process.exit(0);
  } catch (err) {
    console.error('❌ 迁移失败:', err);
    process.exit(1);
  }
})();