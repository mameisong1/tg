/**
 * 自动关空调服务
 * 
 * 由台桌状态同步接口触发，当更新>=40条台桌数据时执行。
 * 逻辑：可能要关的空调 - 不能关的空调 = 要关的空调
 * 
 * 支持跨午夜时间判断（如 22:00~06:00）
 */

const TimeUtil = require('../utils/time');
const { all, get } = require('../db/index');
const { sendACOffBatch, sendACResetBatch } = require('./mqtt-ac');
const { getAutoOffSettings } = require('../utils/config-helper');
const redisCache = require('../utils/redis-cache');

// 辅助函数：HH:MM:SS 转分钟数
function timeToMinutes(timeStr) {
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/**
 * 执行自动关空调（台桌相关）
 * @returns {Object} { status, maybeOffCount, cannotOffCount, turnedOffCount }
 */
async function executeAutoOffAC() {
  // 1. 检查自动关空调功能是否开启
  const settings = await getAutoOffSettings();
  if (!settings.ac_auto_off) {
    console.log('[自动关空调] 功能未开启，跳过');
    return { status: 'disabled' };
  }

  const now = TimeUtil.nowDB();

  // 2. 查询"可能要关的空调"：空闲台桌 + 在自动关空调时段内
  const maybeOff = await all(`
    SELECT DISTINCT sd.switch_id, sd.switch_seq
    FROM tables t
    JOIN table_device td ON LOWER(td.table_name_en) = LOWER(t.name_pinyin)
    JOIN switch_device sd ON sd.switch_seq = td.switch_seq AND sd.switch_label = td.switch_label
    WHERE t.status = '空闲'
      AND sd.device_type = '空调'
      AND sd.auto_off_start != ''
      AND sd.auto_off_end != ''
      AND (
        CASE
          WHEN sd.auto_off_start <= sd.auto_off_end THEN
            (TIME(?) >= TIME(sd.auto_off_start) AND TIME(?) <= TIME(sd.auto_off_end))
          ELSE
            (TIME(?) >= TIME(sd.auto_off_start) OR TIME(?) <= TIME(sd.auto_off_end))
        END
      )
  `, [now, now, now, now]);

  if (maybeOff.length === 0) {
    console.log('[自动关空调] 无需要关的空调');
    return { status: 'ok', maybeOffCount: 0, cannotOffCount: 0, turnedOffCount: 0 };
  }

  // 3. 查询"不能关的空调"：非空闲台桌 + 在自动关空调时段内
  const cannotOff = await all(`
    SELECT DISTINCT sd.switch_id, sd.switch_seq
    FROM tables t
    JOIN table_device td ON LOWER(td.table_name_en) = LOWER(t.name_pinyin)
    JOIN switch_device sd ON sd.switch_seq = td.switch_seq AND sd.switch_label = td.switch_label
    WHERE t.status != '空闲'
      AND sd.device_type = '空调'
      AND sd.auto_off_start != ''
      AND sd.auto_off_end != ''
      AND (
        CASE
          WHEN sd.auto_off_start <= sd.auto_off_end THEN
            (TIME(?) >= TIME(sd.auto_off_start) AND TIME(?) <= TIME(sd.auto_off_end))
          ELSE
            (TIME(?) >= TIME(sd.auto_off_start) OR TIME(?) <= TIME(sd.auto_off_end))
        END
      )
  `, [now, now, now, now]);

  // 4. 集合差集：可能要关 - 不能关 = 要关
  const maybeOffSet = new Set(maybeOff.map(s => `${s.switch_id}|${s.switch_seq}`));
  const cannotOffSet = new Set(cannotOff.map(s => `${s.switch_id}|${s.switch_seq}`));

  const toTurnOff = [...maybeOffSet]
    .filter(key => !cannotOffSet.has(key))
    .map(key => {
      const [switch_id, switch_seq] = key.split('|');
      return { switch_id, switch_seq };
    });

  console.log(`[自动关空调] 可能要关 ${maybeOff.length} 个, 不能关 ${cannotOff.length} 个, 实际要关 ${toTurnOff.length} 个`);

  if (toTurnOff.length === 0) {
    return { status: 'ok', maybeOffCount: maybeOff.length, cannotOffCount: cannotOff.length, turnedOffCount: 0 };
  }

  // 5. 发送 MQTT 关空调指令（测试环境只写日志，不执行真实指令）
  const sendResult = await sendACOffBatch(toTurnOff);
  const turnedOffCount = sendResult?.successCount ?? sendResult ?? 0;

  return {
    status: 'ok',
    maybeOffCount: maybeOff.length,
    cannotOffCount: cannotOff.length,
    turnedOffCount
  };
}

/**
 * 执行台桌无关自动关空调
 * @returns {Object} { status, turnedOffCount }
 */
/**
 * 清除台桌无关设备缓存（在 switch_device/table_device 增删改时调用）
 */
async function clearTableIndependentCache() {
  await redisCache.del('autooff:independent:');
  console.log('[自动关空调-台桌无关] 缓存已清除');
}

async function executeAutoOffACTableIndependent() {
  // 1. 检查自动关空调功能是否开启
  const settings = await getAutoOffSettings();
  if (!settings.ac_auto_off) {
    console.log('[自动关空调-台桌无关] 功能未开启，跳过');
    return { status: 'disabled', turnedOffCount: 0 };
  }

  const now = TimeUtil.nowDB();
  const cacheKeyAC = 'autooff:independent:空调';
  const cacheKeyTableInd = 'autooff:independent:空调:all';
  const cacheKeyHall = 'autooff:independent:hall_ac';

  // 2. 查询台桌无关的空调设备（带时间窗口过滤）
  let switches = await redisCache.get(cacheKeyAC);

  if (!switches) {
    switches = await all(`
      SELECT DISTINCT sd.switch_id, sd.switch_seq, sd.auto_off_start, sd.auto_off_end
      FROM switch_device sd
      LEFT JOIN table_device td
        ON LOWER(sd.switch_label) = LOWER(td.switch_label)
        AND LOWER(sd.switch_seq) = LOWER(td.switch_seq)
      WHERE td.table_name_en IS NULL
        AND sd.device_type = '空调'
        AND sd.auto_off_start != ''
        AND sd.auto_off_end != ''
    `);
    await redisCache.set(cacheKeyAC, switches, 86400);
    console.log(`[自动关空调-台桌无关] 数据库查询 ${switches.length} 个，已缓存 24h`);
  } else {
    console.log(`[自动关空调-台桌无关] Redis缓存命中 ${switches.length} 个`);
  }

  // 内存过滤时间窗口
  const currentMin = timeToMinutes(now.split(' ')[1] || now);
  const filtered = switches.filter(s => {
    const startMin = timeToMinutes(s.auto_off_start);
    const endMin = timeToMinutes(s.auto_off_end);
    if (startMin <= endMin) {
      return currentMin >= startMin && currentMin <= endMin;
    } else {
      return currentMin >= startMin || currentMin <= endMin;
    }
  });

  if (filtered.length === 0) {
    console.log('[自动关空调-台桌无关] 无需要关的空调');
    return { status: 'ok', turnedOffCount: 0 };
  }

  console.log(`[自动关空调-台桌无关] 查询到 ${filtered.length} 个台桌无关空调`);

  // 3. 发送 MQTT 关空调指令
  const sendResult = await sendACOffBatch(filtered);
  const turnedOffCount = sendResult?.successCount ?? sendResult ?? 0;

  // 4. 重置台桌无关空调温度风速（全量缓存，无时间窗口）
  let tableIndependentACs = await redisCache.get(cacheKeyTableInd);

  if (!tableIndependentACs) {
    tableIndependentACs = await all(`
      SELECT DISTINCT sd.switch_id, sd.switch_seq
      FROM switch_device sd
      LEFT JOIN table_device td
        ON LOWER(sd.switch_label) = LOWER(td.switch_label)
        AND LOWER(sd.switch_seq) = LOWER(td.switch_seq)
      WHERE td.table_name_en IS NULL
        AND sd.device_type = '空调'
    `);
    await redisCache.set(cacheKeyTableInd, tableIndependentACs, 86400);
    console.log(`[自动关空调-台桌无关] 台桌无关空调列表 ${tableIndependentACs.length} 个，已缓存 24h`);
  } else {
    console.log(`[自动关空调-台桌无关] Redis缓存命中（重置列表） ${tableIndependentACs.length} 个`);
  }

  if (tableIndependentACs.length > 0) {
    const resetResult = await sendACResetBatch(tableIndependentACs);
    console.log(`[自动关空调-台桌无关] 台桌无关空调重置完成: ${resetResult.successCount}/${tableIndependentACs.length}`);
  }

  // 5. 重置大厅区空调温度风速（缓存）
  let hallACs = await redisCache.get(cacheKeyHall);

  if (!hallACs) {
    hallACs = await all(`
      SELECT DISTINCT sd.switch_id, sd.switch_seq
      FROM switch_device sd
      JOIN table_device td ON sd.switch_seq = td.switch_seq AND sd.switch_label = td.switch_label
      JOIN tables t ON LOWER(td.table_name_en) = LOWER(t.name_pinyin)
      WHERE t.area = '大厅区'
        AND sd.device_type = '空调'
    `);
    await redisCache.set(cacheKeyHall, hallACs, 86400);
    console.log(`[自动关空调-台桌无关] 大厅区空调列表 ${hallACs.length} 个，已缓存 24h`);
  } else {
    console.log(`[自动关空调-台桌无关] Redis缓存命中（大厅区） ${hallACs.length} 个`);
  }

  if (hallACs.length > 0) {
    const resetResult = await sendACResetBatch(hallACs);
    console.log(`[自动关空调-台桌无关] 大厅区空调重置完成: ${resetResult.successCount}/${hallACs.length}`);
  }

  return { status: 'ok', turnedOffCount };
}

module.exports = { executeAutoOffAC, executeAutoOffACTableIndependent, clearTableIndependentCache };
