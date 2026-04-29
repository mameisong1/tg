/**
 * 门迎排序 API 路由
 * 路径: /api/guest-rankings
 */

const express = require('express');
const router = express.Router();
const guestRankingService = require('../services/guest-ranking-service');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const errorLogger = require('../utils/error-logger');
const redisCache = require('../utils/redis-cache');

/**
 * 检查是否为内部调用（IP 限制）
 */
function isInternalCall(req) {
  const clientIp = req.ip || req.connection.remoteAddress;
  return clientIp.includes('127.0.0.1') || clientIp.includes('::1');
}

// ========== 内部接口（Cron / 系统调用）==========

/**
 * POST /api/guest-rankings/internal/batch
 * 批处理排序，Cron 定时调用
 */
router.post('/internal/batch', async (req, res) => {
  try {
    if (!isInternalCall(req)) {
      console.warn(`[GuestRanking] 拒绝非内部调用: ${req.ip || req.connection.remoteAddress}`);
      return res.status(403).json({ success: false, error: '仅允许内部调用' });
    }

    const { shift, startRank, maxRank } = req.body;
    if (!shift || !['早班', '晚班'].includes(shift)) {
      return res.status(400).json({ success: false, error: '班次无效，应为早班或晚班' });
    }

    const result = await guestRankingService.batchRank(shift, startRank, maxRank);
    
    // 清除 Redis 缓存
    await redisCache.delOne('guest_ranking_today');

    res.json({ success: true, data: result });
  } catch (error) {
    errorLogger.logApiRejection(req, error);
    console.error('[GuestRanking] batch 失败:', error);
    res.status(500).json({ success: false, error: '批处理排序失败' });
  }
});

/**
 * POST /api/guest-rankings/internal/clear
 * 午夜清空排序
 */
router.post('/internal/clear', async (req, res) => {
  try {
    if (!isInternalCall(req)) {
      console.warn(`[GuestRanking] 拒绝非内部调用: ${req.ip || req.connection.remoteAddress}`);
      return res.status(403).json({ success: false, error: '仅允许内部调用' });
    }

    const result = await guestRankingService.clearAll();
    
    // 清除 Redis 缓存
    await redisCache.delOne('guest_ranking_today');

    res.json({ success: true, data: result });
  } catch (error) {
    errorLogger.logApiRejection(req, error);
    console.error('[GuestRanking] clear 失败:', error);
    res.status(500).json({ success: false, error: '清空排序失败' });
  }
});

/**
 * POST /api/guest-rankings/internal/after-clock
 * 打卡后排序触发
 */
router.post('/internal/after-clock', async (req, res) => {
  try {
    if (!isInternalCall(req)) {
      console.warn(`[GuestRanking] 拒绝非内部调用: ${req.ip || req.connection.remoteAddress}`);
      return res.status(403).json({ success: false, error: '仅允许内部调用' });
    }

    const { coachNo, shift, isLejuanReturn } = req.body;
    if (!coachNo || !shift) {
      return res.status(400).json({ success: false, error: '缺少 coachNo 或 shift' });
    }

    const result = await guestRankingService.afterClockRank(coachNo, shift, isLejuanReturn);
    
    // 清除 Redis 缓存（排序数据变化了）
    await redisCache.delOne('guest_ranking_today');

    res.json({ success: true, data: result });
  } catch (error) {
    errorLogger.logApiRejection(req, error);
    console.error('[GuestRanking] after-clock 失败:', error);
    res.status(500).json({ success: false, error: '打卡后排序失败' });
  }
});

// ========== 业务接口 ==========

/**
 * PUT /api/guest-rankings/exempt/:coach_no
 * 设置免门迎助教
 */
router.put('/exempt/:coach_no', auth.required, requireBackendPermission(['waterBoardManagement']), async (req, res) => {
  try {
    const { coach_no } = req.params;
    const result = await guestRankingService.setExempt(coach_no);
    
    // 清除 Redis 缓存（免门迎清单变化了）
    await redisCache.delOne('guest_ranking_today');

    res.json({ success: true, data: result });
  } catch (error) {
    errorLogger.logApiRejection(req, error);
    console.error('[GuestRanking] setExempt 失败:', error);
    res.status(500).json({ success: false, error: '设置免门迎失败' });
  }
});

/**
 * DELETE /api/guest-rankings/exempt/:coach_no
 * 取消免门迎
 */
router.delete('/exempt/:coach_no', auth.required, requireBackendPermission(['waterBoardManagement']), async (req, res) => {
  try {
    const { coach_no } = req.params;
    const result = await guestRankingService.removeExempt(coach_no);
    
    // 清除 Redis 缓存
    await redisCache.delOne('guest_ranking_today');

    res.json({ success: true, data: result });
  } catch (error) {
    errorLogger.logApiRejection(req, error);
    console.error('[GuestRanking] removeExempt 失败:', error);
    res.status(500).json({ success: false, error: '取消免门迎失败' });
  }
});

/**
 * GET /api/guest-rankings/today
 * 获取今日全部排序数据（带 Redis 缓存）
 */
router.get('/today', auth.required, requireBackendPermission(['waterBoardManagement']), async (req, res) => {
  try {
    const cacheKey = 'guest_ranking_today';
    
    // 先查 Redis 缓存（1分钟）
    const cached = await redisCache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }
    
    // 缓存不存在，从服务获取
    const result = await guestRankingService.getTodayRanking();
    
    // 写入 Redis 缓存（1分钟 = 60秒）
    await redisCache.set(cacheKey, result, 60);

    res.json({ success: true, data: result });
  } catch (error) {
    errorLogger.logApiRejection(req, error);
    console.error('[GuestRanking] getTodayRanking 失败:', error);
    res.status(500).json({ success: false, error: '获取排序数据失败' });
  }
});

module.exports = router;
