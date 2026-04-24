/**
 * 系统配置 API
 * 路径: /api/system-config
 */

const express = require('express');
const router = express.Router();
const { get } = require('../db');

// 内存缓存（1小时有效期）
let serviceCategoriesCache = null;
let serviceCategoriesCacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1小时

/**
 * GET /api/system-config/service-categories
 * 获取服务下单分类配置（带缓存）
 */
router.get('/service-categories', async (req, res) => {
  try {
    const now = Date.now();
    
    // 检查内存缓存是否有效
    if (serviceCategoriesCache && (now - serviceCategoriesCacheTime) < CACHE_DURATION) {
      return res.json({ data: serviceCategoriesCache });
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
    
    // 更新缓存
    serviceCategoriesCache = categories;
    serviceCategoriesCacheTime = now;
    
    res.json({ data: categories });
  } catch (e) {
    console.error('读取服务分类配置失败:', e);
    res.status(500).json({ error: '读取配置失败' });
  }
});

module.exports = router;