/**
 * 空调数据迁移脚本 V2 - 完整35条数据
 */

const sqlite3 = require('sqlite3').verbose();
const TimeUtil = require('../utils/time');

const DB_PATHS = {
  production: '/TG/run/db/tgservice.db',
  development: '/TG/tgservice/db/tgservice.db'
};

// 第一组：switch_id = 6ceaf318ebda5c1211piog (17条)
const GROUP1 = [
  { seq: 1, label: 'P19', time_range: '00:00-->24:00', tables: 'putai19', remark: '' },
  { seq: 2, label: 'P13', time_range: '00:00-->24:00', tables: 'putai1,putai2', remark: '' },
  { seq: 3, label: 'P14', time_range: '00:00-->24:00', tables: 'putai13,putai15', remark: '' },
  { seq: 4, label: 'P4', time_range: '00:00-->14:00', tables: '', remark: '水吧区' },
  { seq: 5, label: 'P9', time_range: '00:00-->24:00', tables: 'putai16,putai18', remark: '' },
  { seq: 6, label: 'P6', time_range: '02:00-->14:00', tables: '', remark: '办公室门口休息区' },
  { seq: 7, label: 'P7', time_range: '00:00-->24:00', tables: 'putai3,putai5', remark: '' },
  { seq: 8, label: 'P21', time_range: '00:00-->24:00', tables: 'putai7,putai8', remark: '' },
  { seq: 9, label: 'P5', time_range: '00:00-->14:00', tables: '', remark: '水吧区' },
  { seq: 10, label: 'P18', time_range: '00:00-->24:00', tables: 'putai21,putai22,putai23,putai25', remark: '' },
  { seq: 11, label: 'P3', time_range: '00:00-->24:00', tables: '', remark: '收银区' },
  { seq: 12, label: 'P20', time_range: '00:00-->24:00', tables: 'putai20', remark: '' },
  { seq: 13, label: 'P8', time_range: '00:00-->24:00', tables: 'putai18,putai6', remark: '' },
  { seq: 14, label: 'P2', time_range: '02:00-->14:00', tables: '', remark: '休息区' },
  { seq: 15, label: 'OFFICE', time_range: '02:00-->09:00', tables: '', remark: '办公室' },
  { seq: 16, label: 'P1', time_range: '00:00-->24:00', tables: '', remark: '休息区' },
  { seq: 17, label: 'NA', time_range: '00:00-->14:00', tables: '', remark: '未知区域' }
];

// 第二组：switch_id = 6cedfa65e9e0d2f95bv8dw (18条)
const GROUP2 = [
  { seq: 1, label: 'VIP6', time_range: '00:00-->24:00', tables: 'VIP6', remark: '' },
  { seq: 2, label: 'VIP2', time_range: '00:00-->24:00', tables: 'VIP2', remark: '' },
  { seq: 3, label: 'P16', time_range: '00:00-->24:00', tables: 'sinuoke31', remark: '' },
  { seq: 4, label: 'P11', time_range: '00:00-->24:00', tables: 'putai9,putai10,putai11,putai12', remark: '' },
  { seq: 5, label: 'P17', time_range: '00:00-->24:00', tables: 'sinuoke30', remark: '' },
  { seq: 6, label: 'P12', time_range: '00:00-->24:00', tables: '', remark: '包厢走廊' },
  { seq: 7, label: 'P15', time_range: '00:00-->24:00', tables: 'putai26,putai27,putai28', remark: '' },
  { seq: 8, label: 'P10', time_range: '00:00-->24:00', tables: 'TVtai', remark: '' },
  { seq: 9, label: 'BOSS3', time_range: '00:00-->24:00', tables: 'BOSS3', remark: '' },
  { seq: 10, label: 'BOSS1', time_range: '00:00-->24:00', tables: 'BOSS1', remark: '' },
  { seq: 11, label: 'VIP8', time_range: '00:00-->24:00', tables: 'VIP8', remark: '' },
  { seq: 12, label: 'VIP3', time_range: '00:00-->24:00', tables: 'VIP3', remark: '' },
  { seq: 13, label: 'Q2', time_range: '00:00-->24:00', tables: 'que2', remark: '' },
  { seq: 14, label: 'VIP7', time_range: '00:00-->24:00', tables: 'VIP7', remark: '' },
  { seq: 15, label: 'BOSS2', time_range: '00:00-->24:00', tables: 'BOSS2', remark: '' },
  { seq: 16, label: 'VIP5', time_range: '00:00-->24:00', tables: 'VIP5', remark: '' },
  { seq: 17, label: 'Q1', time_range: '00:00-->24:00', tables: 'que1', remark: '' },
  { seq: 18, label: 'VIP1', time_range: '00:00-->24:00', tables: 'VIP1', remark: '' }
];

function parseTimeRange(range) {
  if (!range) return ['', ''];
  const parts = range.split('-->');
  return [parts[0] || '', parts[1] || ''];
}

async function migrate(dbPath, envName) {
  console.log(`\n========== ${envName} 环境迁移 ==========`);
  const db = new sqlite3.Database(dbPath);

  const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  });

  const get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  try {
    const now = TimeUtil.nowDB();
    const switchId1 = '6ceaf318ebda5c1211piog';
    const switchId2 = '6cedfa65e9e0d2f95bv8dw';

    let switchInserted = 0;
    let relationInserted = 0;

    // 第一组17条
    for (const item of GROUP1) {
      const [offStart, offEnd] = parseTimeRange(item.time_range);
      await run(
        `INSERT INTO switch_device (switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, device_type, remark, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, '空调', ?, ?, ?)`,
        [switchId1, String(item.seq), item.label, offStart, offEnd, item.remark, now, now]
      );
      switchInserted++;

      // 台桌设备关系
      if (item.tables) {
        const tables = item.tables.split(',').map(t => t.trim());
        for (const tableName of tables) {
          await run(
            `INSERT INTO table_device (table_name_en, switch_seq, switch_label, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [tableName, String(item.seq), item.label, now, now]
          );
          relationInserted++;
        }
      }
    }

    // 第二组18条
    for (const item of GROUP2) {
      const [offStart, offEnd] = parseTimeRange(item.time_range);
      await run(
        `INSERT INTO switch_device (switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, device_type, remark, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, '空调', ?, ?, ?)`,
        [switchId2, String(item.seq), item.label, offStart, offEnd, item.remark, now, now]
      );
      switchInserted++;

      // 台桌设备关系
      if (item.tables) {
        const tables = item.tables.split(',').map(t => t.trim());
        for (const tableName of tables) {
          await run(
            `INSERT INTO table_device (table_name_en, switch_seq, switch_label, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [tableName, String(item.seq), item.label, now, now]
          );
          relationInserted++;
        }
      }
    }

    console.log(`switch_device: 插入 ${switchInserted} 条`);
    console.log(`table_device: 插入 ${relationInserted} 条`);

    return { switchInserted, relationInserted };
  } finally {
    db.close();
  }
}

(async () => {
  const devResult = await migrate(DB_PATHS.development, '开发');
  const prodResult = await migrate(DB_PATHS.production, '生产');
  
  console.log('\n========== 总计 ==========');
  console.log(`开发环境: switch=${devResult.switchInserted}, relation=${devResult.relationInserted}`);
  console.log(`生产环境: switch=${prodResult.switchInserted}, relation=${prodResult.relationInserted}`);
  console.log('✅ 完成');
})();