/**
 * 奶茶果盘任务统计 API
 * 路径: /api/tea-fruit
 * 功能: 奶茶和果盘任务统计、数据修复
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { enqueueRun, runInTransaction } = require('../db');
const auth = require('../middleware/auth');
const { requireBackendPermission, hasFrontendFeature } = require('../middleware/permission');
const TimeUtil = require('../utils/time');

// ========== 常量定义 ==========

const TEA_TARGET = 30;  // 奶茶任务目标: 30杯/月
const FRUIT_TARGET = 5; // 果盘任务目标: 5个/月

// ========== 辅助函数 ==========

/**
 * 获取日期范围（本月/上月）
 * @param {string} period - 'this-month' | 'last-month'
 * @returns {object} - { dateStart, dateEnd, label }
 */
function getDateRange(period) {
  const now = new Date(); // 服务器已设 Asia/Shanghai
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  const day = now.getDate();

  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

  if (period === 'this-month') {
    return {
      dateStart: dateStr(year, month, 1),
      dateEnd: dateStr(year, month, day),
      label: '本月'
    };
  }

  if (period === 'last-month') {
    // 上月最后一天
    const lastMonthEnd = new Date(year, month, 0).getDate();
    const lastMonthYear = month === 0 ? year - 1 : year;
    const lastMonthIndex = month === 0 ? 11 : month - 1;
    return {
      dateStart: dateStr(lastMonthYear, lastMonthIndex, 1),
      dateEnd: dateStr(lastMonthYear, lastMonthIndex, lastMonthEnd),
      label: '上月'
    };
  }

  throw new Error('无效的 period 参数');
}

/**
 * 获取奶茶商品名称列表
 * @returns {Promise<string[]>}
 */
async function getTeaProductNames() {
  const products = await db.all(
    `SELECT name FROM products WHERE category = '奶茶店' AND status = '上架'`
  );
  return products.map(p => p.name);
}

/**
 * 获取单份水果商品名称列表（不含果盘）
 * @returns {Promise<string[]>}
 */
async function getSingleFruitProductNames() {
  const products = await db.all(
    `SELECT name FROM products 
     WHERE category = '水果' 
       AND name NOT LIKE '%果盘%' 
       AND status = '上架'`
  );
  return products.map(p => p.name);
}

/**
 * 判断商品名是否为果盘
 * @param {string} itemName
 * @returns {boolean}
 */
function isFruitPlatter(itemName) {
  // 去除常见括号后缀后判断
  const cleanName = itemName
    .replace(/\s*\([^)]*\)/g, '')  // 去除 (小)、(大)、(豪华) 等后缀
    .replace(/\s*【[^】]*】/g, '')  // 去除 【小】【大】 等后缀
    .trim();
  return cleanName.includes('果盘');
}

/**
 * 计算奶茶任务进度
 * @param {Array} teaOrders
 * @returns {object}
 */
function calculateTeaProgress(teaOrders) {
  const completed = teaOrders.reduce((sum, order) => sum + order.quantity, 0);
  const rate = Math.min(completed / TEA_TARGET, 1);
  return {
    target: TEA_TARGET,
    completed,
    rate,
    percent: ((completed / TEA_TARGET) * 100).toFixed(1) + '%',
    status: completed >= TEA_TARGET ? 'complete' : 'incomplete'
  };
}

/**
 * 计算果盘任务进度
 * @param {Array} platterOrders - 整份果盘订单
 * @param {Array} singleFruitOrders - 单份水果订单
 * @returns {object}
 */
function calculateFruitProgress(platterOrders, singleFruitOrders) {
  // 整份果盘直接计数
  const platterCount = platterOrders.reduce((sum, order) => sum + order.quantity, 0);

  // 单份水果总数
  const singleFruitTotal = singleFruitOrders.reduce((sum, order) => sum + order.quantity, 0);

  // 精确小数（用于显示）
  const totalEquivalent = platterCount + singleFruitTotal / 3;

  // 整数（用于达标判断）- 向下取整
  const completed = Math.floor(totalEquivalent);

  const rate = Math.min(totalEquivalent / FRUIT_TARGET, 1);

  return {
    target: FRUIT_TARGET,
    completed,           // 整数（用于达标判断）
    totalEquivalent,     // 精确小数（用于显示）
    platterCount,
    singleFruitTotal,
    rate,
    percent: ((totalEquivalent / FRUIT_TARGET) * 100).toFixed(1) + '%',
    status: completed >= FRUIT_TARGET ? 'complete' : 'incomplete'
  };
}

/**
 * 查询助教的奶茶订单
 * @param {string} coachNo
 * @param {string} dateStart
 * @param {string} dateEnd
 * @param {string[]} teaProductNames
 * @returns {Promise<Array>}
 */
async function getTeaOrders(coachNo, dateStart, dateEnd, teaProductNames) {
  if (!teaProductNames.length) return [];

  // 构建商品名 IN 条件
  const productNamesPlaceholder = teaProductNames.map(() => '?').join(',');

  // 查询该助教的 device_fingerprint 和 phone
  const coach = await db.get(
    'SELECT coach_no, phone FROM coaches WHERE coach_no = ?',
    [coachNo]
  );
  if (!coach) return [];

  // 查询 members 表获取 device_fingerprint
  const member = coach.phone ? await db.get(
    'SELECT device_fingerprint FROM members WHERE phone = ?',
    [coach.phone]
  ) : null;

  const deviceFingerprint = member?.device_fingerprint;

  // 构建 WHERE 条件
  let whereClause = '';
  const params = [dateStart, dateEnd];

  if (deviceFingerprint && coach.phone) {
    whereClause = `(o.device_fingerprint = ? OR o.member_phone = ?)`;
    params.push(deviceFingerprint, coach.phone);
  } else if (deviceFingerprint) {
    whereClause = `o.device_fingerprint = ?`;
    params.push(deviceFingerprint);
  } else if (coach.phone) {
    whereClause = `o.member_phone = ?`;
    params.push(coach.phone);
  } else {
    return []; // 无关联条件，返回空
  }

  // 添加商品名参数
  params.push(...teaProductNames);

  const orders = await db.all(`
    SELECT 
      o.order_no,
      o.created_at,
      JSON_EXTRACT(item.value, '$.name') as product_name,
      JSON_EXTRACT(item.value, '$.quantity') as quantity,
      JSON_EXTRACT(item.value, '$.price') as price
    FROM orders o, json_each(o.items) as item
    WHERE o.created_at >= ? AND o.created_at <= ? 
      AND o.status = '已完成'
      AND ${whereClause}
      AND JSON_EXTRACT(item.value, '$.name') IN (${productNamesPlaceholder})
    ORDER BY o.created_at DESC
  `, params);

  // quantity 从 JSON 提取后是数字，无需转换
  return orders.map(o => ({
    ...o,
    quantity: Number(o.quantity) || 0
  }));
}

/**
 * 查询助教的果盘订单（整份果盘）
 * @param {string} coachNo
 * @param {string} dateStart
 * @param {string} dateEnd
 * @returns {Promise<Array>}
 */
async function getFruitPlatterOrders(coachNo, dateStart, dateEnd) {
  const coach = await db.get(
    'SELECT coach_no, phone FROM coaches WHERE coach_no = ?',
    [coachNo]
  );
  if (!coach) return [];

  const member = coach.phone ? await db.get(
    'SELECT device_fingerprint FROM members WHERE phone = ?',
    [coach.phone]
  ) : null;

  const deviceFingerprint = member?.device_fingerprint;

  let whereClause = '';
  const params = [dateStart, dateEnd];

  if (deviceFingerprint && coach.phone) {
    whereClause = `(o.device_fingerprint = ? OR o.member_phone = ?)`;
    params.push(deviceFingerprint, coach.phone);
  } else if (deviceFingerprint) {
    whereClause = `o.device_fingerprint = ?`;
    params.push(deviceFingerprint);
  } else if (coach.phone) {
    whereClause = `o.member_phone = ?`;
    params.push(coach.phone);
  } else {
    return [];
  }

  const orders = await db.all(`
    SELECT 
      o.order_no,
      o.created_at,
      JSON_EXTRACT(item.value, '$.name') as product_name,
      JSON_EXTRACT(item.value, '$.quantity') as quantity,
      JSON_EXTRACT(item.value, '$.price') as price,
      1 as is_platter
    FROM orders o, json_each(o.items) as item
    WHERE o.created_at >= ? AND o.created_at <= ? 
      AND o.status = '已完成'
      AND ${whereClause}
      AND JSON_EXTRACT(item.value, '$.name') LIKE '%果盘%'
    ORDER BY o.created_at DESC
  `, params);

  return orders.map(o => ({
    ...o,
    quantity: Number(o.quantity) || 0,
    is_platter: true
  }));
}

/**
 * 查询助教的单份水果订单
 * @param {string} coachNo
 * @param {string} dateStart
 * @param {string} dateEnd
 * @param {string[]} fruitProductNames
 * @returns {Promise<Array>}
 */
async function getSingleFruitOrders(coachNo, dateStart, dateEnd, fruitProductNames) {
  if (!fruitProductNames.length) return [];

  const productNamesPlaceholder = fruitProductNames.map(() => '?').join(',');

  const coach = await db.get(
    'SELECT coach_no, phone FROM coaches WHERE coach_no = ?',
    [coachNo]
  );
  if (!coach) return [];

  const member = coach.phone ? await db.get(
    'SELECT device_fingerprint FROM members WHERE phone = ?',
    [coach.phone]
  ) : null;

  const deviceFingerprint = member?.device_fingerprint;

  let whereClause = '';
  const params = [dateStart, dateEnd];

  if (deviceFingerprint && coach.phone) {
    whereClause = `(o.device_fingerprint = ? OR o.member_phone = ?)`;
    params.push(deviceFingerprint, coach.phone);
  } else if (deviceFingerprint) {
    whereClause = `o.device_fingerprint = ?`;
    params.push(deviceFingerprint);
  } else if (coach.phone) {
    whereClause = `o.member_phone = ?`;
    params.push(coach.phone);
  } else {
    return [];
  }

  params.push(...fruitProductNames);

  const orders = await db.all(`
    SELECT 
      o.order_no,
      o.created_at,
      JSON_EXTRACT(item.value, '$.name') as product_name,
      JSON_EXTRACT(item.value, '$.quantity') as quantity,
      JSON_EXTRACT(item.value, '$.price') as price,
      0 as is_platter
    FROM orders o, json_each(o.items) as item
    WHERE o.created_at >= ? AND o.created_at <= ? 
      AND o.status = '已完成'
      AND ${whereClause}
      AND JSON_EXTRACT(item.value, '$.name') IN (${productNamesPlaceholder})
      AND JSON_EXTRACT(item.value, '$.name') NOT LIKE '%果盘%'
    ORDER BY o.created_at DESC
  `, params);

  return orders.map(o => ({
    ...o,
    quantity: Number(o.quantity) || 0,
    is_platter: false,
    fruit_equivalent: Number(o.quantity) / 3
  }));
}

// ========== API 接口 ==========

/**
 * GET /api/tea-fruit/my-stats
 * 助教个人统计
 * 权限：助教（auth.required, userType === 'coach'）
 */
router.get('/my-stats', auth.required, async (req, res) => {
  try {
    // 权限检查：必须是助教
    if (req.user.userType !== 'coach') {
      return res.status(403).json({ success: false, error: '仅限助教访问' });
    }

    const { period } = req.query;
    if (!period || !['this-month', 'last-month'].includes(period)) {
      return res.status(400).json({ success: false, error: '缺少或无效的 period 参数' });
    }

    const coachNo = req.user.coachNo;
    if (!coachNo) {
      return res.status(400).json({ success: false, error: '无法获取助教信息' });
    }

    // 获取日期范围
    const dateRange = getDateRange(period);

    // 获取商品列表
    const teaProductNames = await getTeaProductNames();
    const fruitProductNames = await getSingleFruitProductNames();

    // 查询订单
    const teaOrders = await getTeaOrders(coachNo, dateRange.dateStart, dateRange.dateEnd, teaProductNames);
    const platterOrders = await getFruitPlatterOrders(coachNo, dateRange.dateStart, dateRange.dateEnd);
    const singleFruitOrders = await getSingleFruitOrders(coachNo, dateRange.dateStart, dateRange.dateEnd, fruitProductNames);

    // 计算进度
    const teaProgress = calculateTeaProgress(teaOrders);
    const fruitProgress = calculateFruitProgress(platterOrders, singleFruitOrders);

    // 获取助教信息
    const coach = await db.get(
      'SELECT employee_id, stage_name FROM coaches WHERE coach_no = ?',
      [coachNo]
    );

    res.json({
      success: true,
      data: {
        period,
        period_label: dateRange.label,
        date_range: `${dateRange.dateStart} ~ ${dateRange.dateEnd}`,
        coach: {
          employee_id: coach?.employee_id || '',
          stage_name: coach?.stage_name || ''
        },
        tea: {
          target: teaProgress.target,
          completed: teaProgress.completed,
          percent: teaProgress.percent,
          status: teaProgress.status,
          orders: teaOrders.map(o => ({
            order_no: o.order_no,
            product_name: o.product_name,
            quantity: o.quantity,
            created_at: o.created_at
          }))
        },
        fruit: {
          target: fruitProgress.target,
          completed: fruitProgress.completed,
          totalEquivalent: Number(fruitProgress.totalEquivalent.toFixed(2)),
          percent: fruitProgress.percent,
          status: fruitProgress.status,
          orders: [
            ...platterOrders.map(o => ({
              order_no: o.order_no,
              product_name: o.product_name,
              quantity: o.quantity,
              is_platter: true,
              created_at: o.created_at
            })),
            ...singleFruitOrders.map(o => ({
              order_no: o.order_no,
              product_name: o.product_name,
              quantity: o.quantity,
              is_platter: false,
              fruit_equivalent: Number(o.fruit_equivalent.toFixed(2)),
              created_at: o.created_at
            }))
          ]
        }
      }
    });
  } catch (err) {
    console.error('[tea-fruit/my-stats] 错误:', err);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

/**
 * GET /api/tea-fruit/admin-stats
 * 管理员统计（助教列表）
 * 权限：requireBackendPermission(['teaFruitStats'])
 */
router.get('/admin-stats', auth.required, requireBackendPermission(['teaFruitStats']), async (req, res) => {
  try {
    const { period, coach_no } = req.query;
    if (!period || !['this-month', 'last-month'].includes(period)) {
      return res.status(400).json({ success: false, error: '缺少或无效的 period 参数' });
    }

    const dateRange = getDateRange(period);

    // 获取商品列表
    const teaProductNames = await getTeaProductNames();
    const fruitProductNames = await getSingleFruitProductNames();

    // 获取助教列表（排除离职）
    let coaches;
    if (coach_no) {
      coaches = await db.all(
        'SELECT coach_no, employee_id, stage_name, phone FROM coaches WHERE coach_no = ? AND status != ?',
        [coach_no, '离职']
      );
    } else {
      coaches = await db.all(
        'SELECT coach_no, employee_id, stage_name, phone FROM coaches WHERE status != ? ORDER BY employee_id',
        ['离职']
      );
    }

    // 为每个助教计算统计
    const coachStats = [];
    for (const coach of coaches) {
      const teaOrders = await getTeaOrders(coach.coach_no, dateRange.dateStart, dateRange.dateEnd, teaProductNames);
      const platterOrders = await getFruitPlatterOrders(coach.coach_no, dateRange.dateStart, dateRange.dateEnd);
      const singleFruitOrders = await getSingleFruitOrders(coach.coach_no, dateRange.dateStart, dateRange.dateEnd, fruitProductNames);

      const teaProgress = calculateTeaProgress(teaOrders);
      const fruitProgress = calculateFruitProgress(platterOrders, singleFruitOrders);

      coachStats.push({
        coach_no: coach.coach_no,
        employee_id: coach.employee_id,
        stage_name: coach.stage_name,
        tea_target: teaProgress.target,
        tea_completed: teaProgress.completed,
        tea_status: teaProgress.status,
        fruit_target: fruitProgress.target,
        fruit_completed: fruitProgress.completed,
        fruit_totalEquivalent: Number(fruitProgress.totalEquivalent.toFixed(2)),
        fruit_status: fruitProgress.status
      });
    }

    // 汇总统计
    const teaCompleteCount = coachStats.filter(c => c.tea_status === 'complete').length;
    const fruitCompleteCount = coachStats.filter(c => c.fruit_status === 'complete').length;
    const bothCompleteCount = coachStats.filter(c => c.tea_status === 'complete' && c.fruit_status === 'complete').length;

    res.json({
      success: true,
      data: {
        period,
        period_label: dateRange.label,
        date_range: `${dateRange.dateStart} ~ ${dateRange.dateEnd}`,
        coaches: coachStats,
        summary: {
          total_coaches: coachStats.length,
          tea_complete: teaCompleteCount,
          fruit_complete: fruitCompleteCount,
          both_complete: bothCompleteCount
        }
      }
    });
  } catch (err) {
    console.error('[tea-fruit/admin-stats] 错误:', err);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

/**
 * GET /api/tea-fruit/coach-detail
 * 管理员查看助教明细
 * 权限：requireBackendPermission(['teaFruitStats'])
 */
router.get('/coach-detail', auth.required, requireBackendPermission(['teaFruitStats']), async (req, res) => {
  try {
    const { coach_no, period, type } = req.query;

    if (!coach_no) {
      return res.status(400).json({ success: false, error: '缺少 coach_no 参数' });
    }
    if (!period || !['this-month', 'last-month'].includes(period)) {
      return res.status(400).json({ success: false, error: '缺少或无效的 period 参数' });
    }
    if (!type || !['tea', 'fruit'].includes(type)) {
      return res.status(400).json({ success: false, error: '缺少或无效的 type 参数' });
    }

    const dateRange = getDateRange(period);

    // 获取助教信息
    const coach = await db.get(
      'SELECT coach_no, employee_id, stage_name, phone FROM coaches WHERE coach_no = ?',
      [coach_no]
    );
    if (!coach) {
      return res.status(404).json({ success: false, error: '助教不存在' });
    }

    // 获取商品列表
    const teaProductNames = await getTeaProductNames();
    const fruitProductNames = await getSingleFruitProductNames();

    if (type === 'tea') {
      const teaOrders = await getTeaOrders(coach_no, dateRange.dateStart, dateRange.dateEnd, teaProductNames);
      const teaProgress = calculateTeaProgress(teaOrders);

      res.json({
        success: true,
        data: {
          period,
          period_label: dateRange.label,
          date_range: `${dateRange.dateStart} ~ ${dateRange.dateEnd}`,
          coach: {
            coach_no: coach.coach_no,
            employee_id: coach.employee_id,
            stage_name: coach.stage_name
          },
          type: 'tea',
          target: teaProgress.target,
          completed: teaProgress.completed,
          percent: teaProgress.percent,
          status: teaProgress.status,
          orders: teaOrders.map(o => ({
            order_no: o.order_no,
            product_name: o.product_name,
            quantity: o.quantity,
            created_at: o.created_at
          }))
        }
      });
    } else {
      const platterOrders = await getFruitPlatterOrders(coach_no, dateRange.dateStart, dateRange.dateEnd);
      const singleFruitOrders = await getSingleFruitOrders(coach_no, dateRange.dateStart, dateRange.dateEnd, fruitProductNames);
      const fruitProgress = calculateFruitProgress(platterOrders, singleFruitOrders);

      res.json({
        success: true,
        data: {
          period,
          period_label: dateRange.label,
          date_range: `${dateRange.dateStart} ~ ${dateRange.dateEnd}`,
          coach: {
            coach_no: coach.coach_no,
            employee_id: coach.employee_id,
            stage_name: coach.stage_name
          },
          type: 'fruit',
          target: fruitProgress.target,
          completed: fruitProgress.completed,
          totalEquivalent: Number(fruitProgress.totalEquivalent.toFixed(2)),
          percent: fruitProgress.percent,
          status: fruitProgress.status,
          orders: [
            ...platterOrders.map(o => ({
              order_no: o.order_no,
              product_name: o.product_name,
              quantity: o.quantity,
              is_platter: true,
              created_at: o.created_at
            })),
            ...singleFruitOrders.map(o => ({
              order_no: o.order_no,
              product_name: o.product_name,
              quantity: o.quantity,
              is_platter: false,
              fruit_equivalent: Number(o.fruit_equivalent.toFixed(2)),
              created_at: o.created_at
            }))
          ]
        }
      });
    }
  } catch (err) {
    console.error('[tea-fruit/coach-detail] 错误:', err);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

/**
 * POST /api/tea-fruit/repair-data
 * 数据修复
 * 权限：requireBackendPermission(['teaFruitStats'])
 * 
 * 功能：通过 coaches.phone 找 members 表对应会员，
 *       把订单的 device_fingerprint 写入 members.device_fingerprint
 */
router.post('/repair-data', auth.required, requireBackendPermission(['teaFruitStats']), async (req, res) => {
  try {
    // 1. 获取所有有手机号的助教
    const coaches = await db.all(
      'SELECT coach_no, phone FROM coaches WHERE phone IS NOT NULL AND phone != ""'
    );

    let processedOrders = 0;
    let matchedCoaches = 0;
    let repairedCount = 0;

    for (const coach of coaches) {
      // 2. 查找该助教手机号对应的会员
      const member = await db.get(
        'SELECT member_no, phone, device_fingerprint FROM members WHERE phone = ?',
        [coach.phone]
      );

      if (!member) continue;
      matchedCoaches++;

      // 3. 如果会员已有 device_fingerprint，跳过
      if (member.device_fingerprint) continue;

      // 4. 查找该会员的订单，获取 device_fingerprint
      const order = await db.get(
        'SELECT device_fingerprint FROM orders WHERE member_phone = ? AND device_fingerprint IS NOT NULL AND device_fingerprint != "" LIMIT 1',
        [coach.phone]
      );

      if (order && order.device_fingerprint) {
        // 5. 写入 device_fingerprint 到 members 表
        await enqueueRun(
          'UPDATE members SET device_fingerprint = ? WHERE member_no = ?',
          [order.device_fingerprint, member.member_no]
        );
        repairedCount++;
      }

      // 统计该助教的订单数
      const orderCount = await db.get(
        'SELECT COUNT(*) as count FROM orders WHERE member_phone = ?',
        [coach.phone]
      );
      processedOrders += orderCount?.count || 0;
    }

    res.json({
      success: true,
      data: {
        processed_orders: processedOrders,
        matched_coaches: matchedCoaches,
        repaired_count: repairedCount,
        message: `成功修复 ${repairedCount} 个会员的设备指纹，涉及 ${matchedCoaches} 个助教，共 ${processedOrders} 个订单`
      }
    });
  } catch (err) {
    console.error('[tea-fruit/repair-data] 错误:', err);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

module.exports = router;