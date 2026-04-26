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
async function executeAutoOffACTableIndependent() {
  // 1. 检查自动关空调功能是否开启
  const settings = await getAutoOffSettings();
  if (!settings.ac_auto_off) {
    console.log('[自动关空调-台桌无关] 功能未开启，跳过');
    return { status: 'disabled', turnedOffCount: 0 };
  }

  const now = TimeUtil.nowDB();

  // 2. 查询台桌无关的空调设备
  const switches = await all(`
    SELECT DISTINCT sd.switch_id, sd.switch_seq
    FROM switch_device sd
    LEFT JOIN table_device td 
      ON LOWER(sd.switch_label) = LOWER(td.switch_label) 
      AND LOWER(sd.switch_seq) = LOWER(td.switch_seq)
    WHERE td.table_name_en IS NULL
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

  if (switches.length === 0) {
    console.log('[自动关空调-台桌无关] 无需要关的空调');
    return { status: 'ok', turnedOffCount: 0 };
  }

  console.log(`[自动关空调-台桌无关] 查询到 ${switches.length} 个台桌无关空调`);

  // 3. 发送 MQTT 关空调指令
  const sendResult = await sendACOffBatch(switches);
  const turnedOffCount = sendResult?.successCount ?? sendResult ?? 0;

  // 4. 新增：重置台桌无关空调温度风速
  const tableIndependentACs = await all(`
    SELECT DISTINCT sd.switch_id, sd.switch_seq
    FROM switch_device sd
    LEFT JOIN table_device td 
      ON LOWER(sd.switch_label) = LOWER(td.switch_label) 
      AND LOWER(sd.switch_seq) = LOWER(td.switch_seq)
    WHERE td.table_name_en IS NULL
      AND sd.device_type = '空调'
  `);

  if (tableIndependentACs.length > 0) {
    console.log(`[自动关空调-台桌无关] 台桌无关空调 ${tableIndependentACs.length} 个，重置温度风速`);
    const resetResult = await sendACResetBatch(tableIndependentACs);
    console.log(`[自动关空调-台桌无关] 台桌无关空调重置完成: ${resetResult.successCount}/${tableIndependentACs.length}`);
  }

  // 5. 重置大厅区空调温度风速
  const hallACs = await all(`
    SELECT DISTINCT sd.switch_id, sd.switch_seq
    FROM switch_device sd
    JOIN table_device td ON sd.switch_seq = td.switch_seq AND sd.switch_label = td.switch_label
    JOIN tables t ON LOWER(td.table_name_en) = LOWER(t.name_pinyin)
    WHERE t.area = '大厅区'
      AND sd.device_type = '空调'
  `);

  if (hallACs.length > 0) {
    console.log(`[自动关空调-台桌无关] 大厅区空调 ${hallACs.length} 个，重置温度风速`);
    const resetResult = await sendACResetBatch(hallACs);
    console.log(`[自动关空调-台桌无关] 大厅区空调重置完成: ${resetResult.successCount}/${hallACs.length}`);
  }

  return { status: 'ok', turnedOffCount };
}

module.exports = { executeAutoOffAC, executeAutoOffACTableIndependent };
