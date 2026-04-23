/**
 * 统一时间工具 - 北京时间 (Asia/Shanghai, UTC+8)
 * 
 * 数据库存储格式: "YYYY-MM-DD HH:MM:SS"（无时区标记，统一北京时间）
 */

/**
 * 生成当前北京时间，格式适合存入数据库
 * 返回: "2026-04-14 07:23:00"
 */
function nowDB() {
  const d = new Date();
  // new Date() 返回的是服务器本地时间（容器已设 Asia/Shanghai）
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

/**
 * 生成过去/未来时间的数据库格式（相对当前北京时间偏移）
 * @param {number} hours - 偏移小时数（正数=未来，负数=过去）
 * 返回: "2026-04-14 02:23:00"
 */
function offsetDB(hours) {
  const d = new Date(Date.now() + hours * 60 * 60 * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

/**
 * 获取今天的日期字符串（北京时间），用于 SQL DATE() 比较
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
 * 获取偏移 N 天的日期字符串（北京时间）
 * @param {number} days - 偏移天数（正数=未来，负数=过去）
 * 返回: "2026-04-13"
 */
function offsetDateStr(days) {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 把数据库中的时间字符串转成 JavaScript Date 对象（已正确解释为北京时间）
 * @param {string} dbTime - "2026-04-14 07:23:00"
 * 返回: Date 对象（UTC 内部值正确对应北京时间）
 */
function toDate(dbTime) {
  if (!dbTime) return null;
  // 明确指定 +08:00 时区，避免 Node.js 时区设置变化导致解析错误
  return new Date(dbTime + '+08:00');
}

/**
 * 将毫秒时间戳转为北京时间字符串
 * @param {number} timestamp - 毫秒时间戳
 * 返回: "2026-04-14 07:23:00"
 */
function formatTimestamp(timestamp) {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

/**
 * 格式化时间字符串，用于 API 返回或日志
 * @param {string} dbTime - "2026-04-14 07:23:00"
 * @param {object} options - toLocaleString 选项
 */
function format(dbTime, options = {}) {
  const d = toDate(dbTime);
  if (!d) return '-';
  const defaultOptions = {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  return d.toLocaleString('zh-CN', { ...defaultOptions, ...options });
}

/**
 * 格式化日期（不含时间）
 */
function formatDate(dbTime) {
  const d = toDate(dbTime);
  if (!d) return '-';
  return d.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

/**
 * 格式化时间（不含日期）
 */
function formatTime(dbTime) {
  const d = toDate(dbTime);
  if (!d) return '-';
  return d.toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * 判断数据库时间是否在 N 分钟前到现在（北京时间比较）
 */
function isWithinMinutes(dbTime, minutes) {
  const d = toDate(dbTime);
  if (!d) return false;
  const now = new Date();
  return (now - d) <= minutes * 60 * 1000;
}

/**
 * 安全版 toLocaleString（给前端打印用）
 */
function toLocaleStr(options = {}) {
  return new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    ...options
  });
}

module.exports = {
  nowDB,
  offsetDB,
  todayStr,
  offsetDateStr,
  toDate,
  formatTimestamp,
  format,
  formatDate,
  formatTime,
  isWithinMinutes,
  toLocaleStr
};
