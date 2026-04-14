/**
 * 北京时间工具函数
 * 
 * 修复原因：
 * - `new Date().toISOString()` 会将时间转为 UTC，导致北京时间 08:00 变成 00:00
 * - 使用 `toISOString().split('T')[0]` 获取日期时，UTC+8 的日期可能已经倒退一天
 * - 例如：北京时间 2026-04-14 02:00 → toISOString() → 2026-04-13T18:00:00Z → 日期变成 04-13
 * 
 * 解决方案：
 * - 服务器部署在 CST (UTC+8) 时区，new Date() 返回的已是北京时间
 * - 直接从 new Date() 提取年月日即可，无需经过 toISOString()
 * - 数据库时间字符串 "YYYY-MM-DD HH:MM:SS" 解析时需加 '+08:00' 显式指定时区
 */

/**
 * 获取北京时间日期字符串 YYYY-MM-DD
 * 服务器运行在 CST (UTC+8)，new Date() 已经是北京时间
 */
export function getBeijingDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 获取北京时间时间戳 ISO 格式
 * 格式：YYYY-MM-DDTHH:mm:ss+08:00
 */
export function getBeijingTimestamp() {
  const now = new Date();
  return getBeijingDate() + 'T' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0') + '+08:00';
}
