/**
 * 定时自动开灯服务
 * 
 * 每5分钟检查一次，对空闲台桌在开灯时段内的灯具发送MQTT开灯指令。
 * 支持跨午夜时间判断（如 22:00~06:00）
 */

const TimeUtil = require('../utils/time');
const { all, get } = require('../db/index');
const { sendBatchCommand } = require('./mqtt-switch');

/**
 * 执行定时自动开灯
 * @returns {Object} { status, turnedOn }
 */
async function executeAutoOnLighting() {
  // 1. 检查定时自动开灯功能是否开启
  const setting = await get("SELECT value FROM system_settings WHERE key = 'switch_auto_on_enabled'");
  if (!setting || setting.value !== '1') {
    console.log('[定时自动开灯] 功能未开启，跳过');
    return { status: 'disabled' };
  }

  const now = TimeUtil.nowDB();

  // 2. 查询可能要开的灯：空闲台桌 + 在自动开灯时段内
  const maybeOn = await all(`
    SELECT DISTINCT sd.switch_id, sd.switch_seq
    FROM tables t
    JOIN table_device td ON td.table_name_en = t.name
    JOIN switch_device sd ON sd.switch_seq = td.switch_seq AND sd.switch_label = td.switch_label
    WHERE t.status = '空闲'
      AND sd.auto_on_start != ''
      AND sd.auto_on_end != ''
      AND (
        CASE
          WHEN sd.auto_on_start <= sd.auto_on_end THEN
            (TIME(?) >= TIME(sd.auto_on_start) AND TIME(?) <= TIME(sd.auto_on_end))
          ELSE
            (TIME(?) >= TIME(sd.auto_on_start) OR TIME(?) <= TIME(sd.auto_on_end))
        END
      )
  `, [now, now, now, now]);

  if (maybeOn.length === 0) {
    console.log('[定时自动开灯] 无需要开灯的设备');
    return { status: 'ok', turnedOn: 0 };
  }

  // 3. 暂不判断"已经在亮的灯"（无实时状态反馈）
  const toTurnOn = maybeOn;

  // 4. 发送 MQTT 开灯指令
  const successCount = await sendBatchCommand(toTurnOn, 'ON');

  console.log(`[定时自动开灯] 可能要开 ${maybeOn.length} 个, 实际开 ${successCount} 个`);
  return { status: 'ok', turnedOn: successCount };
}

module.exports = { executeAutoOnLighting };
