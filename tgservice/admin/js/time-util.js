/**
 * 前端统一时间工具 - 北京时间 (Asia/Shanghai, UTC+8)
 * 
 * 数据库中所有时间都是北京时间 "YYYY-MM-DD HH:MM:SS"
 * 本工具统一解析和格式化
 */

window.TimeUtil = {
  /**
   * 获取今天日期（北京时间），用于 API 查询参数
   * 返回: "2026-04-14"
   */
  today() {
    return new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }).replace(/\//g, '-');
  },

  /**
   * 把数据库时间字符串转成正确的 Date 对象
   * 数据库存的是北京时间，明确指定 +08:00 避免误判
   */
  toDate(timeStr) {
    if (!timeStr) return null;
    return new Date(timeStr + '+08:00');
  },

  /**
   * 格式化完整日期时间
   * 返回: "04月14日 07:23"
   */
  format(timeStr) {
    if (!timeStr) return '-';
    const d = this.toDate(timeStr);
    return d.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  },

  /**
   * 只格式化时间
   * 返回: "07:23"
   */
  formatTime(timeStr) {
    if (!timeStr) return '-';
    const d = this.toDate(timeStr);
    return d.toLocaleTimeString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  },

  /**
   * 格式化完整日期时间（含年月）
   * 返回: "2026/04/14 07:23:00"
   */
  formatFull(timeStr) {
    if (!timeStr) return '-';
    const d = this.toDate(timeStr);
    return d.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  },

  /**
   * 判断数据库时间是否在 N 分钟内
   */
  isWithinMinutes(timeStr, minutes) {
    if (!timeStr) return false;
    const d = this.toDate(timeStr);
    const now = new Date();
    return (now - d) <= minutes * 60 * 1000;
  },

  /**
   * 获取过去 N 小时的数据库格式时间（用于 SQL 参数）
   */
  hoursAgo(hours) {
    const d = new Date(Date.now() - hours * 60 * 60 * 1000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}:${s}`;
  }
};
