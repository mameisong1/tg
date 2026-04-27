/**
 * 系统配置 API
 * 路径: /api/system-config
 */

const express = require('express');
const router = express.Router();
const { get } = require('../db');
const redisCache = require('../utils/redis-cache');

/**
 * GET /api/system-config/service-categories
 * 获取服务下单分类配置（带 Redis 缓存）
 */
router.get('/service-categories', async (req, res) => {
  try {
    const cacheKey = 'service_categories';
    
    // 先查 Redis 缓存（1小时 = 3600秒）
    const cached = await redisCache.get(cacheKey);
    if (cached) {
      return res.json({ data: cached });
    }
    
    // 从数据库读取
    const config = await get(
      'SELECT value FROM system_config WHERE key = ?',
      ['service_order_categories']
    );
    
    if (!config) {
      return res.json({ data: [] });
    }
    
    const categories = JSON.parse(config.value);
    
    // 写入 Redis 缓存（1小时 = 3600秒）
    await redisCache.set(cacheKey, categories, 3600);
    
    res.json({ data: categories });
  } catch (e) {
    console.error('读取服务分类配置失败:', e);
    res.status(500).json({ error: '读取配置失败' });
  }
});

module.exports = router;