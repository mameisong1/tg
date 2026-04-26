/**
 * 系统配置辅助函数
 * 统一从 system_config 表读取配置
 */

const { get, enqueueRun } = require('../db/index');
const TimeUtil = require('./time');

/**
 * 获取智能省电开关配置
 * @returns {Object} { switch_auto_off, ac_auto_off, switch_auto_on }
 */
async function getAutoOffSettings() {
  const row = await get('SELECT value FROM system_config WHERE key = "auto_off_settings"');
  if (!row) {
    // 兼容旧数据：尝试从 system_settings 读取
    const legacyOff = await get('SELECT value FROM system_settings WHERE key = "switch_auto_off_enabled"');
    const legacyAc = await get('SELECT value FROM system_settings WHERE key = "ac_auto_off_enabled"');
    const legacyOn = await get('SELECT value FROM system_settings WHERE key = "switch_auto_on_enabled"');
    
    return {
      switch_auto_off: legacyOff?.value === '1',
      ac_auto_off: legacyAc?.value === '1',
      switch_auto_on: legacyOn?.value === '1'
    };
  }
  try {
    return JSON.parse(row.value);
  } catch (e) {
    return { switch_auto_off: false, ac_auto_off: false, switch_auto_on: false };
  }
}

/**
 * 更新智能省电开关配置
 * @param {Object} settings - { switch_auto_off, ac_auto_off, switch_auto_on }
 */
async function setAutoOffSettings(settings) {
  const now = TimeUtil.nowDB();
  const value = JSON.stringify({
    switch_auto_off: settings.switch_auto_off ?? false,
    ac_auto_off: settings.ac_auto_off ?? false,
    switch_auto_on: settings.switch_auto_on ?? false
  });
  await enqueueRun(
    'INSERT OR REPLACE INTO system_config (key, value) VALUES ("auto_off_settings", ?)',
    [value]
  );
}

module.exports = {
  getAutoOffSettings,
  setAutoOffSettings
};