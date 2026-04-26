/**
 * 数据迁移脚本：将 system_settings 合并到 system_config
 * 
 * 迁移内容：
 * - switch_auto_off_enabled → auto_off_settings.switch_auto_off
 * - ac_auto_off_enabled → auto_off_settings.ac_auto_off
 * - switch_auto_on_enabled → auto_off_settings.switch_auto_on
 */

const { get, enqueueRun } = require('../db/index');
const TimeUtil = require('../utils/time');

async function migrate() {
  console.log('========================================');
  console.log('  数据迁移: system_settings → system_config');
  console.log('========================================');

  // 1. 读取旧数据
  const switchOff = await get("SELECT value FROM system_settings WHERE key = 'switch_auto_off_enabled'");
  const acOff = await get("SELECT value FROM system_settings WHERE key = 'ac_auto_off_enabled'");
  const switchOn = await get("SELECT value FROM system_settings WHERE key = 'switch_auto_on_enabled'");

  console.log('旧数据:');
  console.log(`  - switch_auto_off_enabled: ${switchOff?.value || '不存在'}`);
  console.log(`  - ac_auto_off_enabled: ${acOff?.value || '不存在'}`);
  console.log(`  - switch_auto_on_enabled: ${switchOn?.value || '不存在'}`);

  // 2. 构建新配置
  const newSettings = {
    switch_auto_off: switchOff?.value === '1',
    ac_auto_off: acOff?.value === '1',
    switch_auto_on: switchOn?.value === '1'
  };

  console.log('新配置:');
  console.log(`  - auto_off_settings: ${JSON.stringify(newSettings)}`);

  // 3. 写入 system_config
  await enqueueRun(
    'INSERT OR REPLACE INTO system_config (key, value) VALUES ("auto_off_settings", ?)',
    [JSON.stringify(newSettings)]
  );

  console.log('✅ 已写入 system_config.auto_off_settings');

  // 4. 清空 system_settings（保留表结构）
  await enqueueRun('DELETE FROM system_settings');
  console.log('✅ 已清空 system_settings 表');

  console.log('========================================');
  console.log('  迁移完成');
  console.log('========================================');
}

// 执行迁移
migrate().then(() => {
  console.log('脚本执行完毕');
  process.exit(0);
}).catch(err => {
  console.error('迁移失败:', err);
  process.exit(1);
});