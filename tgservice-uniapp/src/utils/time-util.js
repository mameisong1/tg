/**
 * 北京时间工具函数
 * 
 * 修复原因：
 * - `new Date().toIS...()` (UTC 转换) 会将时间转为 UTC，导致北京时间 08:00 变成 00:00
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

/**
 * 把数据库时间字符串转成 JavaScript Date 对象
 * @param {string} dbTime - "YYYY-MM-DD HH:MM:SS"
 * @returns {Date|null}
 */
export function toDate(dbTime) {
  if (!dbTime) return null;
  return new Date(dbTime + '+08:00');
}

/**
 * 格式化数据库时间字符串
 * @param {string} dbTime - "YYYY-MM-DD HH:MM:SS"
 * @param {string} formatStr - 格式："MM/DD HH:mm" | "YYYY-MM-DD" | "YYYY-MM-DD HH:mm" | "YYYY-MM-DD HH:mm:ss"
 * @returns {string}
 */
export function format(dbTime, formatStr = 'YYYY-MM-DD HH:mm') {
  const d = toDate(dbTime);
  if (!d) return '-';
  
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  
  return formatStr
    .replace('YYYY', y)
    .replace('MM', m)
    .replace('DD', day)
    .replace('HH', h)
    .replace('mm', min)
    .replace('ss', s);
}

/**
 * 获取偏移后的北京时间日期字符串 YYYY-MM-DD
 * @param {number} days - 偏移天数，正数表示未来，负数表示过去
 * @returns {string}
 */
export function offsetBeijingDate(days) {
  const now = new Date();
  now.setDate(now.getDate() + days);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 获取当前北京时间小时 (0-23)
 * @returns {number}
 */
export function getBeijingHour() {
  return new Date().getHours();
}
