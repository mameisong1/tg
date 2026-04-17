/**
 * 台桌无关自动关灯脚本
 *
 * 功能：查询未关联台桌的开关，在指定时间段内发送 MQTT 关灯指令
 * 受 system_settings.switch_auto_off_enabled 控制
 *
 * 运行方式：
 *   cd /TG/tgservice && node scripts/auto-off-table-independent.js
 *
 * 定时调度（建议每 10 分钟）：
 *   */10 * * * * cd /app/tgservice && node scripts/auto-off-table-independent.js >> logs/auto-off-independent.log 2>&1
 */

const path = require('path');
const fs = require('fs');

// 加载配置文件
const env = process.env.TGSERVICE_ENV || 'production';
const configFileName = env === 'test' ? '.config.env' : '.config';
const configPath = path.join(__dirname, '../' + configFileName);

try {
  const configRaw = fs.readFileSync(configPath, 'utf-8');
  global.APP_CONFIG = JSON.parse(configRaw);
  console.log(`[自动关灯-台桌无关] 配置加载成功: ${configFileName}`);
} catch (err) {
  console.error(`[自动关灯-台桌无关] 加载配置文件失败: ${err.message}`);
}

const TimeUtil = require('../backend/utils/time');
const { all, get } = require('../backend/db/index');
const { sendBatchCommand } = require('../backend/services/mqtt-switch');

async function main() {
  console.log('[自动关灯-台桌无关] ========== 开始执行 ==========');

  try {
    // Step 1: 检查智能省电开关
    const setting = await get("SELECT value FROM system_settings WHERE key = 'switch_auto_off_enabled'");
    if (!setting || setting.value !== '1') {
      console.log('[自动关灯-台桌无关] 智能省电开关：未开启，跳过');
      return;
    }
    console.log('[自动关灯-台桌无关] 智能省电开关：已开启');

    const now = TimeUtil.nowDB();
    console.log(`[自动关灯-台桌无关] 当前时间: ${now}`);

    // Step 2: 查询台桌无关的关灯对象
    const switches = await all(`
      SELECT DISTINCT sd.switch_id, sd.switch_seq
      FROM switch_device sd
      LEFT JOIN table_device td 
        ON LOWER(sd.switch_label) = LOWER(td.switch_label) 
        AND LOWER(sd.switch_seq) = LOWER(td.switch_seq)
      WHERE td.table_name_en IS NULL
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
      console.log('[自动关灯-台桌无关] 无需要关的灯');
      return;
    }

    const switchList = switches.map(s => `${s.switch_id} ${s.switch_seq}`).join(', ');
    console.log(`[自动关灯-台桌无关] 查询到台桌无关开关 ${switches.length} 个: ${switchList}`);

    // Step 3: 发送 MQTT 关灯指令
    const sendResult = await sendBatchCommand(switches, 'OFF');
    const successCount = sendResult?.successCount ?? 0;
    const totalCount = sendResult?.totalCount ?? switches.length;

    console.log(`[自动关灯-台桌无关] 批量发送结果: 成功 ${successCount}/${totalCount}`);

    if (sendResult?.failures && sendResult.failures.length > 0) {
      console.error('[自动关灯-台桌无关] 失败详情:', sendResult.failures.map(f => f.error).join('; '));
    }
  } catch (err) {
    console.error(`[自动关灯-台桌无关] 执行异常: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log('[自动关灯-台桌无关] ========== 执行完毕 ==========');
}

main();
