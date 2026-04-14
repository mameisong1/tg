/**
 * 智能开关数据导入脚本
 * 从 Excel 文件 SwitchManagement.xlsx 导入数据到数据库
 * 
 * 使用方法：
 *   cd /TG/tgservice/backend
 *   node scripts/import-switch-data.js
 */

const path = require('path');
const XLSX = require('xlsx');

// 模块路径解析
const backendDir = path.join(__dirname, '..');
const TimeUtil = require(path.join(backendDir, 'utils/time'));
const { enqueueRun, runInTransaction, db } = require(path.join(backendDir, 'db/index'));

// Excel 文件路径
const EXCEL_PATH = path.join(__dirname, '../../../docs/智能开关改造/SwitchManagement.xlsx');

console.log('[导入] 开始读取 Excel 文件:', EXCEL_PATH);

/**
 * 格式化时间字符串为 HH:MM 格式
 * "4:00" -> "04:00", "14:00" -> "14:00"
 */
function formatTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const parts = timeStr.split(':');
  if (parts.length !== 2) return timeStr;
  return String(parts[0]).padStart(2, '0') + ':' + String(parts[1]).padStart(2, '0');
}

/**
 * 解析时间段 "HH:MM-->HH:MM" 格式
 * 返回 { start, end }
 */
function parseTimeRange(timeRange) {
  if (!timeRange || typeof timeRange !== 'string') return { start: '', end: '' };
  const parts = timeRange.split('-->');
  if (parts.length === 2) {
    return {
      start: formatTime(parts[0].trim()),
      end: formatTime(parts[1].trim())
    };
  }
  return { start: '', end: '' };
}

async function importSwitchDevices(workbook) {
  const sheet = workbook.Sheets['设备开关表'];
  if (!sheet) {
    console.error('[导入] 找不到【设备开关表】Sheet');
    return;
  }

  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`[导入] 设备开关表: 共 ${data.length} 行数据`);

  let inserted = 0;
  let skipped = 0;

  for (const row of data) {
    if (!row['开关ID'] || !row['开关序号']) {
      skipped++;
      continue;
    }

    const timeRange = parseTimeRange(row['自动关灯时间段'] || '');
    const autoOnStart = row['自动开灯开始时间'] ? formatTime(String(row['自动开灯开始时间'])) : '';
    const autoOnEnd = row['自动开灯结束时间'] ? formatTime(String(row['自动开灯结束时间'])) : '';

    try {
      await enqueueRun(
        `INSERT OR IGNORE INTO switch_device 
         (switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, auto_on_start, auto_on_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(row['开关ID']),
          String(row['开关序号']),
          String(row['开关标签'] || ''),
          timeRange.start,
          timeRange.end,
          autoOnStart,
          autoOnEnd,
          TimeUtil.nowDB(),
          TimeUtil.nowDB()
        ]
      );
      inserted++;
    } catch (err) {
      console.error(`[导入] 插入开关设备失败: ${row['开关ID']} ${row['开关序号']}`, err.message);
      skipped++;
    }
  }

  console.log(`[导入] 设备开关表: 导入 ${inserted} 条, 跳过 ${skipped} 条`);
}

async function importTableDevices(workbook) {
  const sheet = workbook.Sheets['设备开关表'];
  if (!sheet) {
    console.error('[导入] 找不到【设备开关表】Sheet');
    return;
  }

  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`[导入] 台桌设备关系: 解析 ${data.length} 行`);

  let inserted = 0;
  let skipped = 0;

  for (const row of data) {
    if (!row['关联台桌'] || !row['开关序号'] || !row['开关标签']) {
      skipped++;
      continue;
    }

    const tableNames = String(row['关联台桌']).split(/[，,]/).map(t => t.trim()).filter(Boolean);

    for (const tableName of tableNames) {
      try {
        await enqueueRun(
          `INSERT OR IGNORE INTO table_device 
           (table_name_en, switch_seq, switch_label, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            tableName,
            String(row['开关序号']),
            String(row['开关标签']),
            TimeUtil.nowDB(),
            TimeUtil.nowDB()
          ]
        );
        inserted++;
      } catch (err) {
        console.error(`[导入] 插入台桌设备失败: ${tableName}`, err.message);
        skipped++;
      }
    }
  }

  console.log(`[导入] 台桌设备关系: 导入 ${inserted} 条, 跳过 ${skipped} 条`);
}

async function importScenes(workbook) {
  // 场景映射: Sheet名 -> 场景信息
  const sceneMap = [
    { sheet: '全部开灯', name: '全部开灯', action: 'ON', sort: 1 },
    { sheet: '全部关灯', name: '全部关灯', action: 'OFF', sort: 2 },
    { sheet: '手动开灯-9点', name: '9点开灯', action: 'ON', sort: 3 },
    { sheet: '手动开灯-14点', name: '14点开灯', action: 'ON', sort: 4 },
    { sheet: '手动开灯-17点', name: '17点开灯', action: 'ON', sort: 5 },
  ];

  let imported = 0;

  for (const scene of sceneMap) {
    if (!workbook.Sheets[scene.sheet]) {
      console.log(`[导入] 场景 "${scene.name}": Sheet "${scene.sheet}" 不存在, 跳过`);
      continue;
    }

    const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[scene.sheet]);
    const switches = sheetData
      .filter(r => r['开关ID'] && r['开关序号'])
      .map(r => ({
        switch_id: String(r['开关ID']),
        switch_seq: String(r['开关序号'])
      }));

    if (switches.length === 0) {
      console.log(`[导入] 场景 "${scene.name}": 无有效开关数据, 跳过`);
      continue;
    }

    try {
      await enqueueRun(
        `INSERT OR REPLACE INTO switch_scene 
         (scene_name, action, switches, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          scene.name,
          scene.action,
          JSON.stringify(switches),
          scene.sort,
          TimeUtil.nowDB(),
          TimeUtil.nowDB()
        ]
      );
      imported++;
      console.log(`[导入] 场景 "${scene.name}": 导入 ${switches.length} 个开关`);
    } catch (err) {
      console.error(`[导入] 场景 "${scene.name}" 导入失败:`, err.message);
    }
  }

  console.log(`[导入] 场景: 共导入 ${imported} 个场景`);
}

async function main() {
  try {
    // 读取 Excel
    const workbook = XLSX.readFile(EXCEL_PATH);
    console.log('[导入] Excel 文件读取成功');
    console.log('[导入] 可用 Sheet:', workbook.SheetNames);

    // 1. 导入设备开关表
    console.log('\n========== 导入设备开关表 ==========');
    await importSwitchDevices(workbook);

    // 2. 导入台桌设备关系
    console.log('\n========== 导入台桌设备关系 ==========');
    await importTableDevices(workbook);

    // 3. 导入场景数据
    console.log('\n========== 导入场景数据 ==========');
    await importScenes(workbook);

    console.log('\n[导入] ========== 导入完成 ==========');
  } catch (err) {
    console.error('[导入] 导入失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    // 等待写队列完成
    await new Promise(resolve => {
      const check = () => {
        if (require(path.join(backendDir, 'db/index')).writeQueue.length === 0) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
    // 关闭数据库
    db.close();
  }
}

main();
