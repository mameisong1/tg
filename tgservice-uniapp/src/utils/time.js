/**
 * 统一时间工具 - 北京时间 (Asia/Shanghai, UTC+8)
 * 前端版本
 */

/**
 * 获取今天的日期字符串（北京时间）
 * 返回: "2026-04-14"
 */
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 格式化时间字符串，用于显示
 * @param {string} dbTime - "2026-04-14 07:23:00"
 * 返回: "2026/04/14 07:23"
 */
function format(dbTime) {
  if (!dbTime) return '-';
  // 格式化: "2026-04-14 07:23:00" -> "2026/04/14 07:23"
  const parts = dbTime.split(' ');
  if (parts.length < 2) return dbTime;
  const datePart = parts[0].replace(/-/g, '/');
  const timePart = parts[1].substring(0, 5); // 只取 HH:MM
  return `${datePart} ${timePart}`;
}

/**
 * 格式化时间（简短版）
 * @param {string} dbTime - "2026-04-14 07:23:00"
 * 返回: "04/14 07:23"（当年）或 "2026/04/14 07:23"（非当年）
 */
function formatShort(dbTime) {
  if (!dbTime) return '-';
  const parts = dbTime.split(' ');
  if (parts.length < 2) return dbTime;
  
  const dateParts = parts[0].split('-');
  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2];
  const timePart = parts[1].substring(0, 5);
  
  const currentYear = new Date().getFullYear();
  if (parseInt(year) === currentYear) {
    return `${month}/${day} ${timePart}`;
  } else {
    return `${year}/${month}/${day} ${timePart}`;
  }
}

/**
 * 获取当前北京时间字符串
 * 返回: "2026-04-14 07:23:00"
 */
function nowDB() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

/**
 * 格式化日期（不含时间）
 * @param {string} dbTime - "2026-04-14 07:23:00"
 * 返回: "04月14日"
 */
function formatDate(dbTime) {
  if (!dbTime) return '-';
  const parts = dbTime.split(' ');
  if (parts.length < 1) return dbTime;
  const dateParts = parts[0].split('-');
  const month = dateParts[1];
  const day = dateParts[2];
  return `${month}月${day}日`;
}

/**
 * 格式化时间（不含日期）
 * @param {string} dbTime - "2026-04-14 07:23:00"
 * 返回: "07:23"
 */
function formatTimeOnly(dbTime) {
  if (!dbTime) return '-';
  const parts = dbTime.split(' ');
  if (parts.length < 2) return dbTime;
  return parts[1].substring(0, 5);
}

/**
 * 判断是否是今天
 * @param {string} dbTime - "2026-04-14 07:23:00"
 * 返回: boolean
 */
function isToday(dbTime) {
  if (!dbTime) return false;
  const datePart = dbTime.split(' ')[0];
  return datePart === todayStr();
}

export default {
  todayStr,
  format,
  formatShort,
  nowDB,
  formatDate,
  formatTimeOnly,
  isToday
};