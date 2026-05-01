/**
 * 乐捐时长计算工具
 * 
 * 算法（基于预约开始时间）：
 * 1. totalMinutes = (结束时间 - 预约开始时间) / 60000
 * 2. baseHours = Math.floor(totalMinutes / 60)
 * 3. remainingMinutes = totalMinutes % 60
 * 4. extraHour = remainingMinutes > 10 ? 1 : 0
 * 5. hours = Math.max(1, baseHours + extraHour)
 * 
 * 规则：
 * - 从预约开始时间计算（整点），不是实际外出时间
 * - 预约开始那一个小时就算
 * - 归来时间剩余分钟 > 10 算额外一小时
 * - 最少算 1 小时
 */

const TimeUtil = require('./time');

/**
 * 计算乐捐时长（基于预约开始时间）
 * 
 * @param {string} scheduledStartTime 预约开始时间 "YYYY-MM-DD HH:MM:SS"
 * @param {string|Date} endTime 结束时间（归来时间）"YYYY-MM-DD HH:MM:SS" 或 Date对象
 * @returns {number} 乐捐时长（整数小时，最小为1）
 */
function calculateLejuanHours(scheduledStartTime, endTime) {
  // 无预约时间，默认1小时
  if (!scheduledStartTime) return 1;
  
  // 解析时间（使用 TimeUtil.toDate）
  const startTime = TimeUtil.toDate(scheduledStartTime);
  const endDate = typeof endTime === 'string' ? TimeUtil.toDate(endTime) : endTime;
  
  // 解析失败，默认1小时
  if (!startTime || !endDate) return 1;
  
  // 计算时间差
  const diffMs = endDate.getTime() - startTime.getTime();
  
  // 时间差为负数（异常情况），默认1小时
  if (diffMs <= 0) return 1;
  
  // 计算总分钟数
  const totalMinutes = Math.floor(diffMs / (60 * 1000));
  
  // 计算完整小时数 + 剩余分钟数
  const baseHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  
  // 剩余分钟 > 10 时额外算一小时
  const extraHour = remainingMinutes > 10 ? 1 : 0;
  
  // 计算原始时长（最少 1 小时）
  let hours = Math.max(1, baseHours + extraHour);
  
  // 整日乐捐判断：>= 8小时视为整日乐捐，调整为 10 小时
  if (hours >= 8) {
    hours = 10;
  }
  
  return hours;
}

module.exports = { calculateLejuanHours };