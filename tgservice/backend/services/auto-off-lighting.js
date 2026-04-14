/**
 * 自动关灯服务
 * 
 * 由台桌状态同步接口触发，当更新>=40条台桌数据时执行。
 * 逻辑：可能要关的灯 - 不能关的灯 = 要关的灯
 * 
 * 支持跨午夜时间判断（如 22:00~06:00）
 */

const TimeUtil = require('../utils/time');
const { all, get } = require('../db/index');
const { sendBatchCommand } = require('./mqtt-switch');

/**
 * 执行自动关灯
 * @returns {Object} { status, maybeOffCount, cannotOffCount, turnedOffCount }
 */
async function executeAutoOffLighting() {
  // 1. 检查自动关灯功能是否开启
  const setting = await get("SELECT value FROM system_settings WHERE key = 'switch_auto_off_enabled'");
  if (!setting || setting.value !== '1') {
    console.log('[自动关灯] 功能未开启，跳过');
    return { status: 'disabled' };
  }

  const now = TimeUtil.nowDB();

  // 2. 查询"可能要关的灯"：空闲台桌 + 在自动关灯时段内
  const maybeOff = await all(`
    SELECT DISTINCT sd.switch_id, sd.switch_seq
    FROM tables t
    JOIN table_device td ON LOWER(td.table_name_en) = LOWER(t.name_pinyin)
    JOIN switch_device sd ON sd.switch_seq = td.switch_seq AND sd.switch_label = td.switch_label
    WHERE t.status = '空闲'
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
    console.log('[自动关灯] 无需要关的灯');
    return { status: 'ok', maybeOffCount: 0, cannotOffCount: 0, turnedOffCount: 0 };
  }

  // 3. 查询"不能关的灯"：非空闲台桌 + 在自动关灯时段内
  const cannotOff = await all(`
    SELECT DISTINCT sd.switch_id, sd.switch_seq
    FROM tables t
    JOIN table_device td ON LOWER(td.table_name_en) = LOWER(t.name_pinyin)
    JOIN switch_device sd ON sd.switch_seq = td.switch_seq AND sd.switch_label = td.switch_label
    WHERE t.status != '空闲'
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

  console.log(`[自动关灯] 可能要关 ${maybeOff.length} 个, 不能关 ${cannotOff.length} 个, 实际要关 ${toTurnOff.length} 个`);

  if (toTurnOff.length === 0) {
    return { status: 'ok', maybeOffCount: maybeOff.length, cannotOffCount: cannotOff.length, turnedOffCount: 0 };
  }

  // 5. 发送 MQTT 关灯指令
  const successCount = await sendBatchCommand(toTurnOff, 'OFF');

  return {
    status: 'ok',
    maybeOffCount: maybeOff.length,
    cannotOffCount: cannotOff.length,
    turnedOffCount: successCount
  };
}

module.exports = { executeAutoOffLighting };
