/**
 * 天宫国际线上服务 - 后端服务
 */

// 统一时间工具（北京时间）
const TimeUtil = require('./utils/time');

// ========== PM2 检测(必须由PM2启动)==========
const PM2_PROCESS_ID = process.env.pm_id;

if (PM2_PROCESS_ID === undefined && process.env.NODE_ENV !== 'development') {
    console.error('');
    console.error('❌ 错误:此服务必须由 PM2 启动!');
    console.error('');
    console.error('正确启动方式:');
    console.error('  pm2 start server.js --name tgservice');
    console.error('  pm2 restart tgservice');
    console.error('');
    console.error('错误启动方式:');
    console.error('  node server.js  ← 请勿使用!');
    console.error('');
    process.exit(1);
}

if (PM2_PROCESS_ID !== undefined) {
    console.log(`✅ PM2 进程 ID: ${PM2_PROCESS_ID}`);
}
// ========== PM2 检测结束 ==========

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const crypto = require('crypto');
const QRCode = require('qrcode');

// 路由模块
const applicationsRouter = require('./routes/applications');
const guestInvitationsRouter = require('./routes/guest-invitations');

// V2.0 路由模块
const waterBoardsRouter = require('./routes/water-boards');
const coachesV2Router = require('./routes/coaches');
const serviceOrdersRouter = require('./routes/service-orders');
const tableActionOrdersRouter = require('./routes/table-action-orders');
const operationLogsRouter = require('./routes/operation-logs');
const operationLogService = require('./services/operation-log');

// 打卡审查路由
const attendanceReviewRouter = require('./routes/attendance-review');

// 乐捐记录路由
const lejuanRecordsRouter = require('./routes/lejuan-records');

// 门迎排序路由
const guestRankingsRouter = require('./routes/guest-rankings');

// 下桌单缺失统计路由
const missingTableOutOrdersRouter = require('./routes/missing-table-out-orders');

// 系统配置路由
const systemConfigRouter = require('./routes/system-config');

// 智能开关路由模块
const { router: switchRouter, triggerAutoOffIfEligible } = require('./routes/switch-routes');

// 智能空调路由模块（新增）
const { router: acRouter, triggerAutoOffACIfEligible } = require('./routes/ac-routes');

// 系统报告路由
const systemReportRouter = require('./routes/system-report');

// 钉钉回调路由
const dingtalkCallbackRouter = require('./routes/dingtalk-callback');

// 设备指纹访问记录(内存存储,每日过期)
// 结构: Map<fingerprint_coachNo, timestamp>
const popularityCache = new Map();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 助教列表缓存(内存存储,3分钟TTL)
const coachesListCache = new Map();
const COACHES_LIST_TTL = 3 * 60 * 1000;

// 短信验证码缓存(内存存储,5分钟过期)
// 结构: Map<phone, { code, timestamp, attempts }>
const smsCodeCache = new Map();
const SMS_CODE_EXPIRE_MS = 5 * 60 * 1000; // 5分钟过期
const SMS_SEND_INTERVAL_MS = 60 * 1000; // 发送间隔60秒

// 分类商品数量缓存(内存存储,10分钟过期)
const categoryCountCache = {
  data: null,
  expireAt: 0
};
const CATEGORY_COUNT_CACHE_TTL = 10 * 60 * 1000; // 10分钟缓存

// 每分钟清理过期验证码
setInterval(() => {
  const now = Date.now();
  for (const [phone, data] of smsCodeCache.entries()) {
    if (now - data.timestamp > SMS_CODE_EXPIRE_MS) {
      smsCodeCache.delete(phone);
    }
  }
}, 60 * 1000);

// 每小时清理过期的指纹记录
setInterval(() => {
  const now = Date.now();
  let expired = 0;
  for (const [key, timestamp] of popularityCache.entries()) {
    if (now - timestamp > ONE_DAY_MS) {
      popularityCache.delete(key);
      expired++;
    }
  }
  if (expired > 0) {
    logger.info(`清理过期设备指纹记录: ${expired} 条`);
  }
}, 60 * 60 * 1000);

// 加载配置(根据环境变量选择配置文件)
const env = process.env.TGSERVICE_ENV || 'production';
const configFileName = env === 'test' ? '.config.env' : '.config';
const configPath = path.join(__dirname, '../' + configFileName);
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
console.log(`[环境] 加载配置文件: ${configFileName}, 环境名称: ${config.env?.name || 'production'}`);

// ========== 鉴权开关缓存（启动时加载，动态更新）==========
// ✅ 统一管理 authEnabledCache，挂载到 global 供 auth.js 和 permission.js 使用
let authEnabledCache = true;  // 默认开启

// 获取 authEnabledCache（供其他文件调用）
function getAuthEnabledCache() {
  return authEnabledCache;
}

// 启动时从数据库加载鉴权配置
async function loadAuthConfig() {
  try {
    const row = await dbGet('SELECT value FROM system_config WHERE key = ?', ['auth_enabled']);
    if (row) {
      authEnabledCache = row.value === 'true';
    } else {
      // 无记录，自动插入默认值
      await enqueueRun('INSERT INTO system_config (key, value, description) VALUES (?, ?, ?)', 
        ['auth_enabled', 'true', 'API鉴权开关: true=启用, false=关闭']);
      authEnabledCache = true;
    }
    // ✅ 挂载到 global，供 auth.js 和 permission.js 使用
    global.authEnabledCache = authEnabledCache;
    global.getAuthEnabledCache = getAuthEnabledCache;
    logger.info(`[鉴权配置] 已加载并挂载到 global: ${authEnabledCache ? '启用' : '关闭'}`);
  } catch (err) {
    logger.error(`[鉴权配置] 加载失败: ${err.message}, 默认启用`);
    authEnabledCache = true;
    global.authEnabledCache = authEnabledCache;
    global.getAuthEnabledCache = getAuthEnabledCache;
  }
}

// 更新鉴权缓存（供 API 调用，热更新时同步所有文件）
function updateAuthCache(enabled) {
  authEnabledCache = enabled;
  global.authEnabledCache = enabled;  // ✅ 同步更新 global
  logger.info(`[鉴权配置] 已更新并同步 global: ${enabled ? '启用' : '关闭'}`);
}

// OSS配置
const OSS = require('ali-oss');

// 钉钉加签发送消息
async function sendDingtalkMessage(message) {
  const { webhook, secret } = config.dingtalk || {};

  if (!webhook || webhook.includes('YOUR_')) {
    logger.warn('钉钉webhook未配置,跳过发送消息');
    return null;
  }

  try {
    const timestamp = Date.now();
    const stringToSign = timestamp + '\n' + secret;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(stringToSign);
    const sign = encodeURIComponent(hmac.digest('base64'));

    const url = `${webhook}&timestamp=${timestamp}&sign=${sign}`;

    const https = require('https');
    const urlObj = new URL(url);

    const postData = JSON.stringify({
      msgtype: 'text',
      text: { content: message }
    });

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ errcode: -1, errmsg: 'parse error' });
          }
        });
      });

      req.on('error', (e) => {
        logger.error(`钉钉消息发送失败: ${e.message}`);
        resolve({ errcode: -1, errmsg: e.message });
      });

      req.write(postData);
      req.end();
    });
  } catch (err) {
    logger.error(`钉钉消息发送异常: ${err.message}`);
    return null;
  }
}

// 创建日志目录
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 配置日志
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `[${timestamp}] ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logDir, 'access.log') }),
    new winston.transports.Console()
  ]
});

const operationLog = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ message, timestamp }) => {
      return `[${timestamp}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'operation.log') })
  ]
});

// 创建Express应用
const app = express();
app.set('trust proxy', true)

// 中间件 - CORS 配置(仅允许指定域名访问)
const allowedOrigins = [
  'https://tiangong.club',
  'https://www.tiangong.club',
  'https://tg.tiangong.club',   // 开发环境
  'https://mp.weixin.qq.com',  // 微信小程序
  'http://localhost:8081',      // 本地开发
  'http://localhost:8083',      // 本地 H5
  'http://localhost:8088',      // 开发环境后端
  'http://localhost:8089',      // 开发环境 H5
  'http://127.0.0.1:8081',      // 本地开发(IP)
  'http://127.0.0.1:8083',      // 本地 H5(IP)
  'http://127.0.0.1:8088',      // 开发环境后端(IP)
  'http://127.0.0.1:8089'       // 开发环境 H5(IP)
];
app.use(cors({
  origin: function(origin, callback) {
    // 允许无 origin 的请求(如小程序请求、Postman 等)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('不允许的来源'));
    }
  }
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件
app.use('/images', express.static(path.join(__dirname, '../images')));
app.use('/videos', express.static(path.join(__dirname, '../videos')));
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));
app.use('/static', express.static(path.join(__dirname, '../frontend/static')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));
app.use('/qrcode', express.static(path.join(__dirname, '../qrcode')));

// API访问日志
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url} - ${req.ip}`);
  next();
});

// ========== 反爬虫:User-Agent 黑名单 ==========
const BLOCKED_USER_AGENTS = [
  'semrush', 'ahrefs', 'mj12bot', 'dotbot', 'petalbot',
  'bytespider', 'yandexbot', 'baiduspider', 'sogou',
  '360spider', 'spider', 'crawler', 'scraper'
];

app.use((req, res, next) => {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const isBlocked = BLOCKED_USER_AGENTS.some(bot => ua.includes(bot));

  if (isBlocked) {
    // 静默返回 403,不记录日志
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// ========== 限流配置 ==========
// 白名单路径(不限流)
const RATE_LIMIT_SKIP_PATHS = [
  '/api/health',
  '/api/front-config',
  '/api/agreement/'
];

// 跳过限流:已认证用户(有 Authorization header)
// 收银台高频轮询、助教使用店内WiFi共享IP 等场景都需要跳过限流
// 未认证用户(前台顾客/爬虫)仍然正常限流
const isAuthUser = (req) => {
  const authHeader = req.headers.authorization;
  return authHeader && authHeader.startsWith('Bearer ');
};

// API 限流:1分钟最多 120 次请求(未认证用户)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  validate: { trustProxy: false },
  skip: (req) => {
    return RATE_LIMIT_SKIP_PATHS.some(p => req.path.startsWith(p))
      || isAuthUser(req);
  },
  handler: (req, res) => {
    res.status(429).json({ error: '请求太频繁,请稍后再试' });
  }
});
app.use('/api/', apiLimiter);

// 后台管理限流:1分钟最多 120 次请求(未认证用户)
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  validate: { trustProxy: false },
  skip: (req) => isAuthUser(req),
  handler: (req, res) => {
    res.status(429).json({ error: '请求太频繁,请稍后再试' });
  }
});
app.use('/api/admin/', adminLimiter);

// 极端IP上限:每分钟1000次(所有请求,包括已认证用户)
// 作为最后一道安全网,防止token泄露后无限刷接口
const extremeIPLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  validate: { trustProxy: false },
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    logger.warn(`⚠️ 极端IP限流触发: ${req.ip} 1分钟内请求超过1000次`);
    res.status(429).json({ error: '请求太频繁,请稍后再试' });
  }
});
app.use('/api/', extremeIPLimiter);

// 注册路由模块
app.use('/api/applications', applicationsRouter);
app.use('/api/guest-invitations', guestInvitationsRouter);

// V2.0 路由注册
app.use('/api/water-boards', waterBoardsRouter);
app.use('/api/coaches/v2', coachesV2Router);
app.use('/api/service-orders', serviceOrdersRouter);
app.use('/api/table-action-orders', tableActionOrdersRouter);
app.use('/api/operation-logs', operationLogsRouter);
app.use('/api/attendance-review', attendanceReviewRouter);

// 乐捐记录路由
app.use('/api/lejuan-records', lejuanRecordsRouter);

// 门迎排序路由
app.use('/api/guest-rankings', guestRankingsRouter);

// 下桌单缺失统计路由
app.use('/api/missing-table-out-orders', missingTableOutOrdersRouter);

// 系统配置路由
app.use('/api/system-config', systemConfigRouter);

// 系统报告
app.use('/api/system-report', systemReportRouter);

// 钉钉回调（不需要鉴权，钉钉签名验证）
app.use('/api/dingtalk/callback', dingtalkCallbackRouter);

// 智能开关路由（在 authMiddleware 之后注册）

// 数据库连接 - 统一从 db/index.js 获取，确保单连接
const { db, dbAll, dbGet, dbRun, dbTx, dbTxAsync, writeQueue, runInTransaction, enqueueRun } = require('./db');

// 商品选项缓存
let productOptionsCache = [];

// 加载商品选项缓存
function loadProductOptionsCache() {
  return new Promise((resolve) => {
    db.all('SELECT * FROM product_options', [], (err, rows) => {
      if (err) {
        logger.error(`加载商品选项缓存失败: ${err.message}`);
        productOptionsCache = [];
      } else {
        productOptionsCache = rows || [];
        logger.info(`商品选项缓存加载完成: ${productOptionsCache.length} 条`);
      }
      resolve();
    });
  });
}

// 匹配商品选项
function matchProductOptions(category, productName) {
  if (!category || !productName) return null;
  
  // 优先精确匹配
  const exact = productOptionsCache.find(
    opt => opt.category === category && opt.product_name === productName
  );
  if (exact) return exact;
  
  // 通配匹配：product_name='所有商品'
  const wildcard = productOptionsCache.find(
    opt => opt.category === category && opt.product_name === '所有商品'
  );
  if (wildcard) return wildcard;
  
  return null;
}

// 启动时加载商品选项缓存
loadProductOptionsCache();

// =============== API 路由 ===============

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: TimeUtil.nowDB() });
});

// 获取商品选项
app.get('/api/product-options', (req, res) => {
  const { category, product_name } = req.query;
  const options = matchProductOptions(category, product_name);
  res.json({ options });
});



// 获取前端配置(台桌授权有效期等)
app.get('/api/front-config', (req, res) => {
  const tableAuthExpireMinutes = config.tableAuth?.expireMinutes || 30;
  const envName = config.env?.name || 'production';
  res.json({
    tableAuthExpireMinutes,
    env: envName
  });
});

// 获取服务器北京时间（供前端判断早/晚班）
app.get('/api/server-time', (req, res) => {
  res.json({
    serverTime: TimeUtil.nowDB(),
    hour: parseInt(TimeUtil.nowDB().split(' ')[1].split(':')[0], 10)
  });
});

// ------------------- 前台 API -------------------

// 游客创建服务单（无需登录，用于"邀请助教上桌"功能）
app.post('/api/service-orders/guest', async (req, res) => {
  try {
    const { table_no, requirement, coach_no } = req.body;
    
    // 验证必填字段
    if (!table_no || !table_no.toString().trim()) {
      return res.status(400).json({ success: false, error: '缺少必填字段：台桌号' });
    }
    if (!requirement || !requirement.toString().trim()) {
      return res.status(400).json({ success: false, error: '缺少必填字段：需求内容不能为空' });
    }
    
    // 游客默认requester_name和requester_type
    const requester_name = '顾客';
    const requester_type = '顾客';
    
    // 使用 enqueueRun 写入（遵守编码规范）
    const result = await enqueueRun(`
      INSERT INTO service_orders (table_no, requirement, requester_name, requester_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, '待处理', ?, ?)
    `, [table_no, requirement, requester_name, requester_type, TimeUtil.nowDB(), TimeUtil.nowDB()]);
    
    res.json({ success: true, data: { id: result.lastID, status: '待处理' } });
  } catch (error) {
    console.error('游客创建服务单失败:', error);
    res.status(500).json({ success: false, error: '创建服务单失败' });
  }
});

// 获取首页配置
app.get('/api/home', async (req, res) => {
  try {
    const config = await dbGet('SELECT * FROM home_config WHERE id = 1');

    // 获取热门商品(hot_products存储的是商品名称数组)
    let hotProducts = [];
    if (config?.hot_products && config.hot_products.trim() !== '') {
      try {
        const productNames = JSON.parse(config.hot_products);
        if (productNames.length > 0) {
          const placeholders = productNames.map(() => '?').join(',');
          hotProducts = await dbAll(`SELECT name, image_url, price FROM products WHERE name IN (${placeholders}) AND status = '上架'`, productNames);
        }
      } catch (e) { /* ignore parse error */ }
    }

    // 如果没有配置热门商品,取前6个
    if (hotProducts.length === 0) {
      hotProducts = await dbAll(`SELECT name, image_url, price FROM products WHERE status = '上架' LIMIT 6`);
    }

    // 获取人气助教(按人气值排序取前6,过滤离职助教和无效数据)
    let popularCoaches = await dbAll(`SELECT coach_no, employee_id, stage_name, level, photos, popularity FROM coaches WHERE (status = '全职' OR status = '兼职' OR status IS NULL) AND employee_id IS NOT NULL AND employee_id != '' AND stage_name IS NOT NULL AND stage_name != '' ORDER BY popularity DESC LIMIT 6`);

    // 处理助教照片
    popularCoaches = popularCoaches.map(c => ({
      ...c,
      photos: c.photos ? JSON.parse(c.photos) : []
    }));

    // 获取热销V包(hot_vip_rooms存储的是包房ID数组)
    let hotVipRooms = [];
    if (config?.hot_vip_rooms && config.hot_vip_rooms.trim() !== '') {
      try {
        const roomIds = JSON.parse(config.hot_vip_rooms);
        if (roomIds.length > 0) {
          const placeholders = roomIds.map(() => '?').join(',');
          hotVipRooms = await dbAll(`SELECT id, name, status, photos FROM vip_rooms WHERE id IN (${placeholders})`, roomIds);
        }
      } catch (e) { /* ignore parse error */ }
    }

    // 如果没有配置热销V包,取前4个
    if (hotVipRooms.length === 0) {
      hotVipRooms = await dbAll(`SELECT id, name, status, photos FROM vip_rooms LIMIT 4`);
    }

    // 处理包房照片
    hotVipRooms = hotVipRooms.map(r => ({
      ...r,
      photos: r.photos ? JSON.parse(r.photos) : []
    }));

    res.json({
      banner: {
        image: config?.banner_image || '',
        title: config?.banner_title || '充值送台费活动',
        desc: config?.banner_desc || '充值满500送50元台费,多充多送'
      },
      notice: config?.notice || '',
      hotProducts,
      popularCoaches,
      hotVipRooms
    });
  } catch (err) {
    logger.error(`获取首页配置失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取商品分类列表
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await dbAll('SELECT name, sort_order FROM product_categories ORDER BY sort_order ASC, name ASC');
    res.json(categories.map(c => c.name));
  } catch (err) {
    logger.error(`获取分类失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取分类商品数量(带10分钟内存缓存)
app.get('/api/categories/counts', async (req, res) => {
  try {
    const now = Date.now();

    // 检查缓存
    if (categoryCountCache.data && now < categoryCountCache.expireAt) {
      return res.json(categoryCountCache.data);
    }

    // 查询数据库
    const counts = await dbAll(`
      SELECT category, COUNT(*) as count
      FROM products
      WHERE status = '上架'
      GROUP BY category
    `);

    // 转换为对象格式 { '酒水': 5, '奶茶店': 3 }
    const result = {};
    counts.forEach(row => {
      result[row.category] = row.count;
    });

    // 更新缓存
    categoryCountCache.data = result;
    categoryCountCache.expireAt = now + CATEGORY_COUNT_CACHE_TTL;

    res.json(result);
  } catch (err) {
    logger.error(`获取分类数量失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取商品列表
app.get('/api/products', async (req, res) => {
  try {
    const { category } = req.query;
    let sql = "SELECT name, category, image_url, price, stock_available, status, popularity FROM products WHERE status = '上架'";
    const params = [];

    if (category && category !== '全部') {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY popularity DESC, created_at DESC';

    const products = await dbAll(sql, params);
    res.json(products);
  } catch (err) {
    logger.error(`获取商品失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取商品详情
app.get('/api/products/:name', async (req, res) => {
  try {
    const product = await dbGet('SELECT * FROM products WHERE name = ?', [req.params.name]);
    if (!product) {
      return res.status(404).json({ error: '商品不存在' });
    }
    res.json(product);
  } catch (err) {
    logger.error(`获取商品详情失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 购物车操作
app.post('/api/cart', async (req, res) => {
  try {
    const { sessionId, tableNo, productName, quantity = 1, options = '' } = req.body;

    if (!sessionId || !productName) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 事务内完成 SELECT + INSERT/UPDATE，避免中间被其他写操作抢占锁
    await runInTransaction(async (tx) => {
      const existing = await tx.get(
        'SELECT id, quantity FROM carts WHERE session_id = ? AND product_name = ? AND (options = ? OR (options IS NULL OR options = \'\') AND ? = \'\')',
        [sessionId, productName, options, options]
      );
      if (existing) {
        await tx.run(
          'UPDATE carts SET quantity = quantity + ?, table_no = ? WHERE id = ?',
          [quantity, tableNo || null, existing.id]
        );
      } else {
        await tx.run(
          'INSERT INTO carts (session_id, table_no, product_name, quantity, options) VALUES (?, ?, ?, ?, ?)',
          [sessionId, tableNo || null, productName, quantity, options]
        );
        // 首次加入购物车，商品热度+1
        await tx.run('UPDATE products SET popularity = popularity + 1 WHERE name = ?', [productName]);
      }
    });

    operationLog.info(`购物车操作: sessionId=${sessionId}, tableNo=${tableNo}, product=${productName}, qty=${quantity}, options=${options}`);
    res.json({ success: true, message: '已添加到购物车' });
  } catch (err) {
    logger.error(`购物车操作失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取购物车
app.get('/api/cart/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const items = await dbAll(
      `SELECT c.product_name, c.quantity, c.table_no, c.options, p.price, p.image_url
       FROM carts c
       LEFT JOIN products p ON c.product_name = p.name
       WHERE c.session_id = ?`,
      [sessionId]
    );

    const tableNo = items.length > 0 ? items[0].table_no : null;
    const totalPrice = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

    res.json({ items, tableNo, totalPrice });
  } catch (err) {
    logger.error(`获取购物车失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新购物车数量
app.put('/api/cart', async (req, res) => {
  try {
    const { sessionId, productName, quantity, options = '' } = req.body;

    if (quantity <= 0) {
      await runInTransaction(async (tx) => {
        // 先确认商品在购物车中，并获取当前数量
        const existing = await tx.get(
          'SELECT id, quantity FROM carts WHERE session_id = ? AND product_name = ? AND (options = ? OR (options IS NULL OR options = \'\') AND ? = \'\')',
          [sessionId, productName, options, options]
        );
        if (existing) {
          // 只有数量为1的商品被删除时，人气值-1
          if (existing.quantity === 1) {
            await tx.run('UPDATE products SET popularity = MAX(popularity - 1, 0) WHERE name = ?', [productName]);
          }
        }
        await tx.run('DELETE FROM carts WHERE session_id = ? AND product_name = ? AND (options = ? OR (options IS NULL OR options = \'\') AND ? = \'\')', [sessionId, productName, options, options]);
      });
    } else {
      await enqueueRun('UPDATE carts SET quantity = ? WHERE session_id = ? AND product_name = ? AND (options = ? OR (options IS NULL OR options = \'\') AND ? = \'\')', [quantity, sessionId, productName, options, options]);
    }

    res.json({ success: true });
  } catch (err) {
    logger.error(`更新购物车失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除购物车商品
app.delete('/api/cart', async (req, res) => {
  try {
    const { sessionId, productName, options = '' } = req.body;
    await runInTransaction(async (tx) => {
      // 先确认商品在购物车中，并获取当前数量
      const existing = await tx.get(
        'SELECT id, quantity FROM carts WHERE session_id = ? AND product_name = ? AND (options = ? OR (options IS NULL OR options = \'\') AND ? = \'\')',
        [sessionId, productName, options, options]
      );
      if (existing) {
        // 只有数量为1的商品被删除时，人气值-1
        if (existing.quantity === 1) {
          await tx.run('UPDATE products SET popularity = MAX(popularity - 1, 0) WHERE name = ?', [productName]);
        }
      }
      await tx.run('DELETE FROM carts WHERE session_id = ? AND product_name = ? AND (options = ? OR (options IS NULL OR options = \'\') AND ? = \'\')', [sessionId, productName, options, options]);
    });
    res.json({ success: true });
  } catch (err) {
    logger.error(`删除购物车商品失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 清空购物车
app.delete('/api/cart/:sessionId', async (req, res) => {
  try {
    await enqueueRun('DELETE FROM carts WHERE session_id = ?', [req.params.sessionId]);
    res.json({ success: true });
  } catch (err) {
    logger.error(`清空购物车失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新购物车台桌号(扫码切换台桌时调用)
app.put('/api/cart/table', async (req, res) => {
  try {
    const { sessionId, tableNo } = req.body;
    if (!sessionId || !tableNo) {
      return res.status(400).json({ error: '缺少参数' });
    }
    // 验证台桌是否存在
    const table = await dbGet('SELECT name FROM tables WHERE name = ?', [tableNo]);
    if (!table) {
      return res.status(400).json({ error: '台桌不存在' });
    }
    await enqueueRun('UPDATE carts SET table_no = ? WHERE session_id = ?', [tableNo, sessionId]);
    res.json({ success: true });
  } catch (err) {
    logger.error(`更新购物车台桌失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 下单
app.post('/api/order', async (req, res) => {
  try {
    const { sessionId, deviceFingerprint } = req.body;

    // 检查设备指纹黑名单
    if (deviceFingerprint) {
      const blacklisted = await dbGet(
        'SELECT id FROM device_blacklist WHERE device_fingerprint = ?',
        [deviceFingerprint]
      );
      if (blacklisted) {
        logger.warn(`黑名单设备尝试下单: ${deviceFingerprint}`);
        return res.status(403).json({ error: '订单提交失败' });
      }
    }

    // 获取购物车
    const items = await dbAll(
      `SELECT c.product_name, c.quantity, c.table_no, c.options, p.price
       FROM carts c
       LEFT JOIN products p ON c.product_name = p.name
       WHERE c.session_id = ?`,
      [sessionId]
    );

    if (items.length === 0) {
      return res.status(400).json({ error: '购物车为空' });
    }

    // 强制验证台桌号
    const tableNo = items[0].table_no;
    if (!tableNo || tableNo === 'null' || tableNo === 'undefined' || tableNo.trim() === '') {
      return res.status(400).json({ error: '请扫台桌码进入后再下单' });
    }

    // 检查台桌是否存在
    const table = await dbGet('SELECT name FROM tables WHERE name = ?', [tableNo]);
    if (!table) {
      return res.status(400).json({ error: '台桌不存在,请重新扫码' });
    }

    // 检查购物车是否有多个不同的台桌号
    const tableSet = new Set(items.map(item => item.table_no).filter(t => t));
    if (tableSet.size > 1) {
      return res.status(400).json({ error: '购物车存在多个台桌商品,请清空后重新下单' });
    }

    const totalPrice = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

    // 生成订单号
    const orderNo = `TG${Date.now()}`;

    // 准备订单信息
    const orderItems = items.map(item => ({
      name: item.product_name,
      quantity: item.quantity,
      price: item.price,
      options: item.options || ''
    }));

    // 发送钉钉消息（商品名显示选项）
    const message = `【天宫国际 - 新订单】\n\n台桌号: ${tableNo}\n商品:\n${orderItems.map(i => {
      const displayName = i.options ? `${i.name}(${i.options})` : i.name;
      return `  • ${displayName} x${i.quantity} = ¥${(i.price * i.quantity).toFixed(2)}`;
    }).join('\n')}\n\n合计: ¥${totalPrice.toFixed(2)}\n订单号: ${orderNo}\n时间: ${TimeUtil.toLocaleStr()}`;

    // 发送钉钉消息(加签方式)
    const dingtalkResult = await sendDingtalkMessage(message);
    if (dingtalkResult && dingtalkResult.errcode === 0) {
      operationLog.info(`订单创建: ${orderNo}, 台桌: ${tableNo}, 商品: ${orderItems.length}件, 金额: ${totalPrice}, 钉钉通知成功`);
    } else {
      operationLog.info(`订单创建: ${orderNo}, 台桌: ${tableNo}, 商品: ${orderItems.length}件, 金额: ${totalPrice}, 钉钉通知: ${dingtalkResult?.errmsg || '未配置'}`);
    }

    // 保存订单(存UTC时间,前端显示时转换为北京时间)
    // 已迁移：device_fingerprint 列已存在，无需在启动路径执行 DDL
    // await enqueueRun(`ALTER TABLE orders ADD COLUMN device_fingerprint TEXT`);

    await enqueueRun(
      `INSERT INTO orders (order_no, table_no, items, total_price, status, device_fingerprint, created_at) VALUES (?, ?, ?, ?, '待处理', ?, ?)`,
      [orderNo, tableNo, JSON.stringify(orderItems), totalPrice, deviceFingerprint || null, TimeUtil.nowDB()]
    );

    // 清空购物车
    await enqueueRun('DELETE FROM carts WHERE session_id = ?', [sessionId]);

    res.json({
      success: true,
      orderNo,
      message: '下单成功!请等待服务员送餐。'
    });
  } catch (err) {
    logger.error(`下单失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 将水牌状态归类为三类:空闲、上桌、离店
const WATER_STATUS_MAP = {
  '早班空闲': '空闲',
  '晚班空闲': '空闲',
  '早班上桌': '上桌',
  '晚班上桌': '上桌',
  '早加班': '离店',
  '晚加班': '离店',
  '乐捐': '离店',
  '休息': '离店',
  '公休': '离店',
  '请假': '离店',
  '下班': '离店'
};

const WATER_STATUS_ICON = {
  '空闲': '🟢',
  '上桌': '🟠',
  '离店': '⚪'
};

function categorizeWaterStatus(status) {
  return WATER_STATUS_MAP[status] || '离店';
}

function getWaterStatusIcon(status) {
  const categorized = categorizeWaterStatus(status);
  return WATER_STATUS_ICON[categorized] || '⚪';
}

function cleanCoachesCache() {
  const now = Date.now();
  for (const [key, entry] of coachesListCache.entries()) {
    if (now - entry.timestamp > COACHES_LIST_TTL) {
      coachesListCache.delete(key);
    }
  }
}

// 获取助教列表(带3分钟缓存 + 水牌状态)
app.get('/api/coaches', async (req, res) => {
  try {
    const { level } = req.query;
    const cacheKey = `coaches_${level || 'all'}`;

    // 检查缓存
    cleanCoachesCache();
    const cached = coachesListCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < COACHES_LIST_TTL) {
      return res.json(cached.data);
    }

    let sql = `
      SELECT c.coach_no, c.employee_id, c.stage_name, c.level, c.photos, c.popularity,
             wb.status AS water_status, wb.table_no AS water_table_no
      FROM coaches c
      LEFT JOIN water_boards wb ON c.coach_no = wb.coach_no
      WHERE (c.status = '全职' OR c.status = '兼职' OR c.status IS NULL)
        AND c.employee_id IS NOT NULL AND c.employee_id != ''
        AND c.stage_name IS NOT NULL AND c.stage_name != ''
    `;
    const params = [];

    if (level && level !== '全部') {
      sql += ' AND c.level = ?';
      params.push(level);
    }

    // 排序:空闲/上桌优先,离店排后面
    sql += `
      ORDER BY
        CASE wb.status
          WHEN '早班空闲' THEN 1
          WHEN '晚班空闲' THEN 1
          WHEN '早班上桌' THEN 2
          WHEN '晚班上桌' THEN 2
          ELSE 3
        END,
        c.popularity DESC, c.coach_no
    `;

    let coaches = await dbAll(sql, params);
    coaches = coaches.map(c => {
      const displayStatus = categorizeWaterStatus(c.water_status);
      return {
        ...c,
        photos: c.photos ? JSON.parse(c.photos) : [],
        display_status: displayStatus,
        display_status_icon: getWaterStatusIcon(c.water_status),
        display_status_text: displayStatus
      };
    });

    // 写入缓存
    coachesListCache.set(cacheKey, { data: coaches, timestamp: Date.now() });

    res.json(coaches);
  } catch (err) {
    logger.error(`获取助教列表失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取人气值TOP6助教（带水牌状态）
app.get('/api/coaches/popularity/top6', async (req, res) => {
  try {
    let coaches = await dbAll(`
      SELECT c.coach_no, c.employee_id, c.stage_name, c.level, c.photos, c.popularity,
             wb.status AS water_status, wb.table_no AS water_table_no
      FROM coaches c
      LEFT JOIN water_boards wb ON c.coach_no = wb.coach_no
      WHERE (c.status = '全职' OR c.status = '兼职' OR c.status IS NULL)
        AND c.employee_id IS NOT NULL AND c.employee_id != ''
        AND c.stage_name IS NOT NULL AND c.stage_name != ''
      ORDER BY c.popularity DESC LIMIT 6
    `);
    coaches = coaches.map(c => ({
      ...c,
      photos: c.photos ? JSON.parse(c.photos) : [],
      display_status: categorizeWaterStatus(c.water_status),
      display_status_icon: getWaterStatusIcon(c.water_status),
      display_status_text: categorizeWaterStatus(c.water_status)
    }));
    res.json(coaches);
  } catch (err) {
    logger.error(`获取人气助教失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取助教详情（带水牌状态）
app.get('/api/coaches/:coachNo', async (req, res) => {
  try {
    const coach = await dbGet(`
      SELECT c.*, wb.status AS water_status, wb.table_no AS water_table_no
      FROM coaches c
      LEFT JOIN water_boards wb ON c.coach_no = wb.coach_no
      WHERE c.coach_no = ?
    `, [req.params.coachNo]);
    if (!coach) {
      return res.status(404).json({ error: '助教不存在' });
    }

    // 离职助教前台不可见
    if (coach.status === '离职') {
      return res.status(404).json({ error: '助教不存在' });
    }

    // 设备指纹防刷榜：同一设备一天内对同一助教只增加一次人气值
    const fingerprint = req.query.fp || req.headers['x-device-fp'] || '';
    const popularityCacheKey = `${fingerprint}_${req.params.coachNo}`;
    const now = Date.now();

    const displayStatus = categorizeWaterStatus(coach.water_status);

    // 先返回响应，不等人气值写入
    res.json({
      ...coach,
      photos: coach.photos ? JSON.parse(coach.photos) : [],
      videos: coach.videos ? JSON.parse(coach.videos) : [],
      display_status: displayStatus,
      display_status_icon: getWaterStatusIcon(coach.water_status),
      display_status_text: displayStatus
    });

    // 有设备指纹时，异步更新人气值（fire-and-forget）
    if (fingerprint) {
      const lastVisit = popularityCache.get(popularityCacheKey);
      if (!lastVisit || (now - lastVisit > ONE_DAY_MS)) {
        setImmediate(async () => {
          try {
            await enqueueRun('UPDATE coaches SET popularity = popularity + 1 WHERE coach_no = ?', [req.params.coachNo]);
            popularityCache.set(popularityCacheKey, now);
          } catch (err) {
            logger.error(`人气值更新失败 (coach_no=${req.params.coachNo}): ${err.message}`);
          }
        });
      }
    }
    // 没有设备指纹 → 跳过更新
  } catch (err) {
    logger.error(`获取助教详情失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 助教查询自己的水牌状态(用于H5员工下单默认台桌号)
app.get('/api/coaches/:coachNo/water-status', async (req, res) => {
  try {
    const waterBoard = await dbGet(
      'SELECT coach_no, stage_name, status, table_no, updated_at FROM water_boards WHERE coach_no = ?',
      [req.params.coachNo]
    );
    if (!waterBoard) {
      return res.status(404).json({ error: '水牌不存在' });
    }
    // 新增 table_no_list 字段，方便前端使用
    const { parseTables } = require('./db');
    res.json({ success: true, data: {
      ...waterBoard,
      table_no_list: parseTables(waterBoard.table_no)
    }});
  } catch (err) {
    logger.error(`查询水牌状态失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// =============== 台桌 API ===============

// 通过拼音获取台桌信息
app.get('/api/table/:pinyin', async (req, res) => {
  try {
    const table = await dbGet('SELECT * FROM tables WHERE name_pinyin = ?', [req.params.pinyin]);
    if (!table) {
      return res.status(404).json({ error: '台桌不存在' });
    }
    res.json(table);
  } catch (err) {
    logger.error(`获取台桌信息失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取台桌列表(前台用,返回区域和台桌名)
app.get('/api/tables', async (req, res) => {
  try {
    const tables = await dbAll('SELECT area, name, name_pinyin, status FROM tables ORDER BY area, name');
    res.json(tables);
  } catch (err) {
    logger.error(`获取台桌列表失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取待处理订单(按台桌名查询,5小时内)
app.get('/api/orders/pending/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const orders = await dbAll(
      `SELECT * FROM orders
       WHERE table_no = ? AND status = '待处理'
       AND created_at >= ?
       ORDER BY created_at DESC`,
      [tableName, TimeUtil.offsetDB(-5)]
    );
    res.json(orders.map(o => ({
      ...o,
      items: o.items ? JSON.parse(o.items) : []
    })));
  } catch (err) {
    logger.error(`获取待处理订单失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取当前设备的待处理订单(严格模式)
app.get('/api/orders/my-pending', async (req, res) => {
  try {
    const { deviceFingerprint } = req.query;

    if (!deviceFingerprint) {
      return res.json([]);
    }

    const orders = await dbAll(
      `SELECT * FROM orders
       WHERE device_fingerprint = ? AND status = '待处理'
       AND created_at >= ?
       ORDER BY created_at DESC`,
      [deviceFingerprint, TimeUtil.offsetDB(-5)]
    );

    res.json(orders.map(o => ({
      ...o,
      items: o.items ? JSON.parse(o.items) : []
    })));
  } catch (err) {
    logger.error(`获取我的待处理订单失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 助教登录
app.post('/api/coach/login', async (req, res) => {
  try {
    const { employeeId, stageName, idCardLast6 } = req.body;

    if (!employeeId || !stageName || !idCardLast6) {
      return res.status(400).json({ error: '请填写完整信息' });
    }

    const coach = await dbGet(
      'SELECT * FROM coaches WHERE employee_id = ? AND stage_name = ?',
      [employeeId, stageName]
    );

    if (!coach) {
      // QA-20260422-3: 登录失败日志
      logger.warn(`助教登录失败: 信息不匹配 - 工号=${employeeId}, 艺名=${stageName}`);
      return res.status(401).json({ error: '助教信息不匹配' });
    }

    // 离职助教禁止登录
    if (coach.status === '离职') {
      // QA-20260422-3: 登录失败日志
      logger.warn(`助教登录失败: 账号已离职 - 工号=${employeeId}, 艺名=${stageName}`);
      return res.status(403).json({ error: '该账号已离职' });
    }

    // 更新身份证后6位(首次登录时设置)
    if (!coach.id_card_last6) {
      await enqueueRun('UPDATE coaches SET id_card_last6 = ? WHERE coach_no = ?', [idCardLast6, coach.coach_no]);
    } else if (coach.id_card_last6 !== idCardLast6) {
      // QA-20260422-3: 登录失败日志
      logger.warn(`助教登录失败: 身份证不匹配 - 工号=${employeeId}`);
      return res.status(401).json({ error: '身份证后6位不正确' });
    }

    // 生成简单token
    const token = Buffer.from(`${coach.coach_no}:${Date.now()}`).toString('base64');

    // 检查助教是否同时是后台用户(通过手机号匹配)
    let adminInfo = null;
    let adminToken = null;
    if (coach.phone) {
      const adminUser = await dbGet('SELECT username, role, name FROM admin_users WHERE username = ?', [coach.phone]);
      if (adminUser) {
        adminInfo = {
          username: adminUser.username,
          name: adminUser.name || '',
          role: adminUser.role
        };
        adminToken = jwt.sign({ username: adminUser.username, role: adminUser.role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
      }
    }

    operationLog.info(`助教登录: ${coach.stage_name} (${coach.coach_no})`);
    res.json({
      success: true,
      token,
      coach: {
        coachNo: coach.coach_no,
        employeeId: coach.employee_id,
        stageName: coach.stage_name,
        phone: coach.phone || '',
        level: coach.level,
        shift: coach.shift || '晚班'
      },
      adminInfo: adminInfo,
      adminToken: adminToken
    });
  } catch (err) {
    logger.error(`助教登录失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 助教更新信息
app.put('/api/coach/profile', async (req, res) => {
  try {
    const { coachNo, age, height, intro, photos, video, videos } = req.body;

    const updates = [];
    const params = [];

    if (age !== undefined) {
      updates.push('age = ?');
      params.push(age);
    }
    if (height !== undefined) {
      updates.push('height = ?');
      params.push(height);
    }
    if (intro !== undefined) {
      updates.push('intro = ?');
      params.push(intro);
    }
    if (photos !== undefined) {
      updates.push('photos = ?');
      params.push(JSON.stringify(photos));
    }
    // 兼容单个video和多个videos
    if (videos !== undefined) {
      updates.push('videos = ?');
      params.push(JSON.stringify(videos));
    }
    if (video !== undefined) {
      updates.push('video = ?');
      params.push(video);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的内容' });
    }

    updates.push("updated_at = ?");
    params.push(TimeUtil.nowDB(), coachNo);

    await enqueueRun(`UPDATE coaches SET ${updates.join(', ')} WHERE coach_no = ?`, params);

    operationLog.info(`助教更新信息: ${coachNo}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`更新助教信息失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// =============== 会员 API ===============

// kltx 短信发送函数
async function sendKltxSms(phone, code) {
  // 从项目配置加载 kltx 配置
  let kltxConfig = config.kltxSms || null;

  if (!kltxConfig) {
    logger.error('kltx 短信配置不存在');
    return { success: false, error: 'kltx 配置不存在' };
  }

  // 使用凭证中的模板,把 {code} 替换为实际验证码
  const template = kltxConfig.template || '验证码为:{code},有效时间5分钟。【海淘国际】';
  const content = template.replace('{code}', code);

  const http = require('http');
  const iconv = require('iconv-lite');

  // 构建参数
  const params = {
    cmd: 'send',
    uid: kltxConfig.uid,
    psw: kltxConfig.psw_md5,
    mobiles: phone,
    msgid: '',
    msg: content
  };

  // GBK URL 编码函数(模拟 Java 的 URLEncoder.encode(str, "GBK"))
  function gbkUrlEncode(str) {
    const gbkBuffer = iconv.encode(str, 'gbk');
    let result = '';
    for (let i = 0; i < gbkBuffer.length; i++) {
      const byte = gbkBuffer[i];
      // 字母、数字、部分安全字符不编码
      if ((byte >= 0x41 && byte <= 0x5A) ||  // A-Z
          (byte >= 0x61 && byte <= 0x7A) ||  // a-z
          (byte >= 0x30 && byte <= 0x39) ||  // 0-9
          byte === 0x2D || byte === 0x5F || byte === 0x2E || byte === 0x2A) {  // - _ . *
        result += String.fromCharCode(byte);
      } else if (byte === 0x20) {
        result += '+';  // 空格转 +
      } else {
        result += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
      }
    }
    return result;
  }

  // 按 Test.java 的方式:对每个 key 和 value 进行 GBK URL 编码
  const encodedParts = Object.entries(params).map(([key, value]) => {
    return gbkUrlEncode(key) + '=' + gbkUrlEncode(value);
  });
  const encodedParams = encodedParts.join('&');

  logger.info(`kltx 短信请求参数: ${encodedParams.substring(0, 100)}...`);

  return new Promise((resolve) => {
    const options = {
      hostname: 'kltx.sms10000.com.cn',
      port: 80,
      path: '/sdk/SMS',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(encodedParams)
      },
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        // 用 GBK 解码响应
        const buffer = Buffer.concat(chunks);
        const data = iconv.decode(buffer, 'gbk');
        // 响应码处理
        const codeMap = {
          '100': '发送成功',
          '101': '发送失败',
          '102': '验证失败',
          '103': '号码有错',
          '104': '内容有错',
          '105': '操作频率过快',
          '106': '限制发送',
          '107': '参数不全'
        };

        const result = data.trim();
        const message = codeMap[result] || `未知响应: ${result}`;

        logger.info(`kltx 短信响应: ${result} - ${message}`);

        if (result === '100') {
          logger.info(`kltx 短信发送成功: ${phone}`);
          resolve({ success: true, code: result, message });
        } else {
          logger.error(`kltx 短信发送失败: ${result} - ${message}`);
          resolve({ success: false, code: result, error: message });
        }
      });
    });

    req.on('error', (e) => {
      logger.error(`kltx 短信请求失败: ${e.message}`);
      resolve({ success: false, error: e.message });
    });

    req.on('timeout', () => {
      req.destroy();
      logger.error('kltx 短信请求超时');
      resolve({ success: false, error: '请求超时' });
    });

    req.write(encodedParams);
    req.end();
  });
}

// 阿里云短信发送函数
async function sendAliyunSms(phone, code) {
  const smsConfig = config.aliyunSms;

  if (!smsConfig || smsConfig.accessKeyId.includes('【')) {
    return { success: false, error: '阿里云短信配置未完成' };
  }

  try {
    const Core = require('@alicloud/pop-core');
    const client = new Core({
      accessKeyId: smsConfig.accessKeyId,
      accessKeySecret: smsConfig.accessKeySecret,
      endpoint: 'https://dysmsapi.aliyuncs.com',
      apiVersion: '2017-05-25'
    });

    const result = await client.request('SendSms', {
      PhoneNumbers: phone,
      SignName: smsConfig.signName,
      TemplateCode: smsConfig.templateCode,
      TemplateParam: JSON.stringify({ code })
    });

    logger.info(`阿里云短信响应: ${JSON.stringify(result)} (手机号: ${phone})`);

    if (result.Code === 'OK') {
      return { success: true, code: result.Code, message: '发送成功' };
    } else {
      return { success: false, code: result.Code, error: result.Message };
    }
  } catch (e) {
    logger.error(`阿里云短信发送失败: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// 发送短信验证码(H5登录用)
app.post('/api/sms/send', async (req, res) => {
  try {
    const { phone } = req.body;

    // 验证手机号格式
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '请输入正确的手机号' });
    }

    // 🔧 后门: 1860000000 开头的手机号固定验证码 888888（开发和测试环境通用）
    const isTestUser = /^1860000000\d$/.test(phone);
    if (isTestUser) {
      smsCodeCache.set(phone, { code: '888888', timestamp: Date.now(), attempts: 0 });
      operationLog.info(`测试账号短信验证码: ${phone}, 验证码: 888888 (固定)`);
      return res.json({ success: true, message: '验证码已发送' });
    }

    // 检查发送频率
    const existing = smsCodeCache.get(phone);
    if (existing && Date.now() - existing.timestamp < SMS_SEND_INTERVAL_MS) {
      const waitSeconds = Math.ceil((SMS_SEND_INTERVAL_MS - (Date.now() - existing.timestamp)) / 1000);
      return res.status(429).json({ error: `请${waitSeconds}秒后再试` });
    }

    // 生成6位验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // 获取当前短信服务商配置
    let smsProvider = 'aliyun';
    try {
      const configRow = await dbGet("SELECT value FROM system_config WHERE key = 'sms_provider'");
      if (configRow) {
        smsProvider = configRow.value;
      }
    } catch (e) {
      // 配置表可能不存在,使用默认值
    }

    logger.info(`短信发送请求: 手机号=${phone}, 服务商=${smsProvider}`);

    // 根据服务商调用对应的发送函数
    let sendResult;
    if (smsProvider === 'kltx') {
      sendResult = await sendKltxSms(phone, code);
    } else {
      // 默认使用阿里云
      sendResult = await sendAliyunSms(phone, code);
    }

    if (!sendResult.success) {
      // 发送失败
      logger.error(`短信发送失败: ${sendResult.error}`);
      return res.status(500).json({ error: '短信发送失败,请稍后重试' });
    }

    // 保存验证码
    smsCodeCache.set(phone, { code, timestamp: Date.now(), attempts: 0 });

    operationLog.info(`短信验证码发送成功: ${phone}, 服务商: ${smsProvider}, 验证码: ${code}`);
    res.json({ success: true, message: '验证码已发送' });
  } catch (err) {
    logger.error(`发送验证码失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 短信验证码登录(H5用)
app.post('/api/member/login-sms', async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: '请输入手机号和验证码' });
    }

    // 🔧 后门: 1860000000 开头的手机号固定验证码 888888
    const isTestUser = /^1860000000\d$/.test(phone);

    if (isTestUser && code === '888888') {
      operationLog.info(`测试账号登录: ${phone}, 验证码: 888888`);
      // 跳过验证码校验，直接进入会员查询/创建流程
    } else if (process.env.TGSERVICE_ENV === 'test' && code === '888888') {
      // 测试环境：任何号码都能用 888888 登录
      operationLog.info(`测试环境登录: ${phone}, 验证码: 888888`);
    } else {
      // 正常验证码验证流程
      const codeData = smsCodeCache.get(phone);
      if (!codeData) {
        return res.status(400).json({ error: '验证码已过期,请重新获取' });
      }

      // 检查尝试次数
      if (codeData.attempts >= 5) {
        smsCodeCache.delete(phone);
        return res.status(400).json({ error: '验证码错误次数过多,请重新获取' });
      }

      // 检查过期
      if (Date.now() - codeData.timestamp > SMS_CODE_EXPIRE_MS) {
        smsCodeCache.delete(phone);
        return res.status(400).json({ error: '验证码已过期,请重新获取' });
      }

      // 验证码校验
      if (codeData.code !== code) {
        codeData.attempts++;
        return res.status(400).json({ error: '验证码错误' });
      }

      // 验证成功,删除验证码
      smsCodeCache.delete(phone);
    }

    // 查询或创建会员
    let member = await dbGet('SELECT * FROM members WHERE phone = ?', [phone]);

    if (!member) {
      // 新用户注册（使用事务保证原子性，避免 INSERT/SELECT 竞态）
      member = await runInTransaction(async (tx) => {
        const result = await tx.run(
          'INSERT INTO members (phone, created_at, updated_at) VALUES (?, ?, ?)',
          [phone, TimeUtil.nowDB(), TimeUtil.nowDB()]
        );
        const newMember = await tx.get(
          'SELECT * FROM members WHERE member_no = ?',
          [result.lastID]
        );
        return newMember;
      });
      operationLog.info(`新会员注册(H5): ${phone}`);
    }

    // 生成token
    const memberToken = jwt.sign({ memberNo: member.member_no, phone: member.phone }, config.jwt.secret, { expiresIn: '30d' });

    // 检查是否同时是助教
    const coach = await dbGet('SELECT coach_no, employee_id, stage_name, phone, level, shift, status FROM coaches WHERE phone = ? AND status != ?', [phone, '离职']);

    // 检查是否匹配后台用户(自动实现内部员工登录)
    const adminUser = await dbGet('SELECT username, role, name FROM admin_users WHERE username = ?', [phone]);

    // 如果是后台用户,生成 adminToken
    let adminToken = null;
    if (adminUser) {
      adminToken = jwt.sign({ username: adminUser.username, role: adminUser.role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    }

    // 构建身份列表
    const roles = ['member'];
    if (coach) roles.push('coach');
    if (adminUser) roles.push('admin');

    operationLog.info(`会员登录(H5): ${phone}`);
    res.json({
      success: true,
      token: memberToken,
      member: {
        memberNo: member.member_no,
        phone: member.phone,
        name: member.name,
        gender: member.gender
      },
      roles,
      needSelectRole: roles.length > 1,
      adminInfo: adminUser ? {
        username: adminUser.username,
        name: adminUser.name || '',
        role: adminUser.role
      } : null,
      adminToken: adminToken,
      coachInfo: coach ? {
        coachNo: coach.coach_no,
        employeeId: coach.employee_id,
        stageName: coach.stage_name,
        phone: coach.phone,
        level: coach.level,
        shift: coach.shift || '晚班',
        status: coach.status
      } : null
    });
  } catch (err) {
    logger.error(`短信登录失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 微信手机号登录/注册
app.post('/api/member/login', async (req, res) => {
  try {
    const { code, encryptedData, iv } = req.body;

    if (!code || !encryptedData || !iv) {
      return res.status(400).json({ error: '参数不完整' });
    }

    // 1. 用code换取openid和session_key
    const wxAppId = config.wechat.appid;
    const wxSecret = config.wechat.appsecret;

    const https = require('https');
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${wxAppId}&secret=${wxSecret}&js_code=${code}&grant_type=authorization_code`;

    const wxSession = await new Promise((resolve, reject) => {
      https.get(wxUrl, (wxRes) => {
        let data = '';
        wxRes.on('data', chunk => data += chunk);
        wxRes.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(e); }
        });
      }).on('error', reject);
    });

    if (wxSession.errcode) {
      logger.error(`微信登录失败: ${wxSession.errmsg}`);
      return res.status(400).json({ error: '微信登录失败' });
    }

    const openid = wxSession.openid;
    const sessionKey = wxSession.session_key;

    // 2. 解密手机号
    let phone = '';
    try {
      const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(sessionKey, 'base64'), Buffer.from(iv, 'base64'));
      let decoded = decipher.update(Buffer.from(encryptedData, 'base64'));
      decoded = Buffer.concat([decoded, decipher.final()]);
      const decodedData = JSON.parse(decoded.toString());
      phone = decodedData.phoneNumber || decodedData.purePhoneNumber;
    } catch (e) {
      logger.error(`解密手机号失败: ${e.message}`);
      return res.status(400).json({ error: '获取手机号失败,请重试' });
    }

    if (!phone) {
      return res.status(400).json({ error: '获取手机号失败' });
    }

    // 3. 查询或创建会员
    let member = await dbGet('SELECT * FROM members WHERE phone = ?', [phone]);

    if (!member) {
      // 新用户注册
      const result = await enqueueRun(
        'INSERT INTO members (phone, openid, created_at, updated_at) VALUES (?, ?, ?, ?)',
        [phone, openid, TimeUtil.nowDB(), TimeUtil.nowDB()]
      );
      member = await dbGet('SELECT * FROM members WHERE member_no = ?', [result.lastID]);
      operationLog.info(`新会员注册: ${phone}`);
    } else {
      // 更新openid(可能用户换手机了)
      if (member.openid !== openid) {
        await enqueueRun('UPDATE members SET openid = ?, updated_at = ? WHERE member_no = ?', [openid, TimeUtil.nowDB(), member.member_no]);
        member.openid = openid;
      }
    }

    // 4. 生成token
    const memberToken = jwt.sign({ memberNo: member.member_no, phone: member.phone }, config.jwt.secret, { expiresIn: '30d' });

    // 5. 检查是否同时是助教
    const coach = await dbGet('SELECT coach_no, stage_name, level FROM coaches WHERE phone = ? AND status != ?', [phone, '离职']);

    // 6. 检查是否匹配后台用户(自动实现内部员工登录)
    const adminUser = await dbGet('SELECT username, role, name FROM admin_users WHERE username = ?', [phone]);

    // 如果是后台用户,生成 adminToken
    let adminToken = null;
    if (adminUser) {
      adminToken = jwt.sign({ username: adminUser.username, role: adminUser.role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    }

    // 🔴 新增：构建身份列表
    const roles = ['member'];
    if (coach) roles.push('coach');
    if (adminUser) roles.push('admin');

    res.json({
      success: true,
      token: memberToken,
      member: {
        memberNo: member.member_no,
        phone: member.phone,
        name: member.name,
        gender: member.gender
      },
      roles,  // 🔴 新增：返回所有身份列表
      needSelectRole: roles.length > 1,
      adminInfo: adminUser ? {
        username: adminUser.username,
        name: adminUser.name || '',
        role: adminUser.role
      } : null,
      adminToken: adminToken,
      coachInfo: coach ? {
        coachNo: coach.coach_no,
        stageName: coach.stage_name,
        level: coach.level,
        status: coach.status
      } : null
    });
  } catch (err) {
    logger.error(`会员登录失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 通过openid自动登录
app.post('/api/member/auto-login', async (req, res) => {
  try {
    const { code, preferredRole } = req.body;

    if (!code) {
      return res.status(400).json({ error: '缺少code' });
    }

    // 🔴 审计修复：白名单验证 preferredRole
    if (preferredRole && !['member', 'coach', 'admin'].includes(preferredRole)) {
      return res.status(400).json({ error: 'preferredRole 参数无效' });
    }

    // 用code换取openid
    const wxAppId = config.wechat.appid;
    const wxSecret = config.wechat.appsecret;

    const https = require('https');
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${wxAppId}&secret=${wxSecret}&js_code=${code}&grant_type=authorization_code`;

    const wxSession = await new Promise((resolve, reject) => {
      https.get(wxUrl, (wxRes) => {
        let data = '';
        wxRes.on('data', chunk => data += chunk);
        wxRes.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(e); }
        });
      }).on('error', reject);
    });

    if (wxSession.errcode) {
      return res.status(400).json({ error: '微信登录失败' });
    }

    const openid = wxSession.openid;

    // 查询是否已注册
    const member = await dbGet('SELECT * FROM members WHERE openid = ?', [openid]);

    if (!member) {
      // 未注册,返回空
      return res.json({ success: false, registered: false });
    }

    // 已注册,生成token返回
    const memberToken = jwt.sign({ memberNo: member.member_no, phone: member.phone }, config.jwt.secret, { expiresIn: '30d' });

    // 检查是否同时是助教
    const coach = await dbGet('SELECT coach_no, employee_id, stage_name, level, status FROM coaches WHERE phone = ? AND status != ?', [member.phone, '离职']);

    // 检查是否匹配后台用户
    const adminUser = await dbGet('SELECT username, role, name FROM admin_users WHERE username = ?', [member.phone]);

    // 构建 roles 数组（用户拥有的所有身份）
    const roles = ['member'];
    if (coach && coach.status !== '离职') roles.push('coach');
    if (adminUser) roles.push('admin');

    // 根据 preferredRole 返回对应信息
    let adminToken = null;
    let adminInfo = null;
    let coachInfo = null;

    if (preferredRole === 'admin' && adminUser) {
      // 只返回后台身份
      adminToken = jwt.sign({ username: adminUser.username, role: adminUser.role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
      adminInfo = {
        username: adminUser.username,
        name: adminUser.name || '',
        role: adminUser.role
      };
    } else if (preferredRole === 'coach' && coach) {
      // 只返回助教身份
      coachInfo = {
        coachNo: coach.coach_no,
        employeeId: coach.employee_id,
        stageName: coach.stage_name,
        level: coach.level,
        status: coach.status
      };
    } else if (!preferredRole) {
      // 无偏好参数：返回所有身份（前端弹框选择）
      if (adminUser) {
        adminToken = jwt.sign({ username: adminUser.username, role: adminUser.role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
        adminInfo = {
          username: adminUser.username,
          name: adminUser.name || '',
          role: adminUser.role
        };
      }
      if (coach) {
        coachInfo = {
          coachNo: coach.coach_no,
          employeeId: coach.employee_id,
          stageName: coach.stage_name,
          level: coach.level,
          status: coach.status
        };
      }
    }
    // preferredRole === 'member' 时，不返回任何额外身份信息

    res.json({
      success: true,
      registered: true,
      token: memberToken,
      member: {
        memberNo: member.member_no,
        phone: member.phone,
        name: member.name,
        gender: member.gender
      },
      roles,  // 🔴 新增：返回所有身份列表
      adminInfo,
      adminToken,
      coachInfo
    });
  } catch (err) {
    logger.error(`自动登录失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取当前会员信息
app.get('/api/member/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未登录' });
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    const member = await dbGet('SELECT member_no, phone, name, gender, remark, created_at FROM members WHERE member_no = ?', [decoded.memberNo]);

    if (!member) {
      return res.status(404).json({ error: '会员不存在' });
    }

    // 检查是否同时是助教
    const coach = await dbGet('SELECT coach_no, employee_id, stage_name, phone, level, shift, status FROM coaches WHERE phone = ? AND status != ?', [member.phone, '离职']);

    // 检查是否匹配后台用户
    const adminUser = await dbGet('SELECT username, role, name FROM admin_users WHERE username = ?', [member.phone]);

    // 如果是后台用户,生成 adminToken
    let adminToken = null;
    if (adminUser) {
      adminToken = jwt.sign({ username: adminUser.username, role: adminUser.role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    }

    res.json({
      memberNo: member.member_no,
      phone: member.phone,
      name: member.name,
      gender: member.gender,
      remark: member.remark,
      createdAt: member.created_at,
      adminInfo: adminUser ? {
        username: adminUser.username,
        name: adminUser.name || '',
        role: adminUser.role
      } : null,
      adminToken: adminToken,
      coachInfo: coach ? {
        coachNo: coach.coach_no,
        employeeId: coach.employee_id,
        stageName: coach.stage_name,
        phone: coach.phone || member.phone,
        level: coach.level,
        shift: coach.shift || '晚班',
        status: coach.status
      } : null
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'token无效' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新会员信息
app.put('/api/member/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未登录' });
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    const { name, gender } = req.body;

    await enqueueRun(
      'UPDATE members SET name = ?, gender = ?, updated_at = ? WHERE member_no = ?',
      [name, gender, TimeUtil.nowDB(), decoded.memberNo]
    );

    res.json({ success: true });
  } catch (err) {
    // QA-20260422-3: 会员资料更新失败日志
    logger.error(`会员资料更新失败: ${err.message} - ${req.ip}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 会员退出登录(清除openid,防止自动登录)
app.post('/api/member/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未登录' });
    }

    const decoded = jwt.verify(token, config.jwt.secret);

    // 清除openid,防止自动登录
    await enqueueRun(
      'UPDATE members SET openid = NULL, updated_at = ? WHERE member_no = ?',
      [TimeUtil.nowDB(), decoded.memberNo]
    );

    operationLog.info(`会员退出登录: ${decoded.memberNo}`);
    res.json({ success: true });
  } catch (err) {
    // QA-20260422-3: 会员登出失败日志
    logger.error(`会员登出失败: ${err.message} - ${req.ip}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ------------------- 后台 API -------------------

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// 后台登录
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await dbGet('SELECT * FROM admin_users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 服务员禁止登录后台
    const role = user.role || '管理员';
    if (role === '服务员') {
      return res.status(403).json({ error: '服务员不允许登录后台管理系统,请使用前台系统' });
    }

    const token = jwt.sign({ username: user.username, name: user.name || '', role: role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

    // 获取用户权限
    const { getUserPermissions } = require('./middleware/permission');
    const permissions = getUserPermissions(role);

    operationLog.info(`后台登录:${username} (${role})`);
    res.json({
      success: true,
      token,
      role,
      user: { username: user.username, name: user.name || '', role: role },
      permissions: permissions.backend
    });
  } catch (err) {
    logger.error(`后台登录失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 后台验证码登录
app.post('/api/admin/login/sms', async (req, res) => {
  try {
    const { phone, code } = req.body;

    // 验证手机号格式
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '请输入正确的手机号' });
    }

    // 验证验证码格式
    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: '请输入6位验证码' });
    }

    // 验证验证码是否正确
    const cached = smsCodeCache.get(phone);
    if (!cached || cached.code !== code || Date.now() - cached.timestamp > SMS_CODE_EXPIRE_MS) {
      return res.status(401).json({ error: '验证码错误或已过期' });
    }

    // 查询用户（username = 手机号）
    const user = await dbGet('SELECT * FROM admin_users WHERE username = ?', [phone]);
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }

    // 服务员和教练禁止登录后台
    const role = user.role || '管理员';
    if (role === '服务员') {
      return res.status(403).json({ error: '服务员不允许登录后台管理系统' });
    }
    if (role === '教练') {
      return res.status(403).json({ error: '教练不允许登录后台管理系统' });
    }

    // 生成 token
    const token = jwt.sign({ username: user.username, name: user.name || '', role: role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

    // 删除验证码缓存（一次性使用）
    smsCodeCache.delete(phone);

    // 获取用户权限
    const { getUserPermissions } = require('./middleware/permission');
    const permissions = getUserPermissions(role);

    operationLog.info(`后台验证码登录:${phone} (${role})`);
    res.json({
      success: true,
      token,
      role,
      user: { username: user.username, name: user.name || '', role: role },
      permissions: permissions.backend
    });
  } catch (err) {
    logger.error(`后台验证码登录失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 后台认证中间件 - 支持 JWT 和 base64 两种 token
const authMiddleware = (req, res, next) => {
  // QA-20260422-3: 鉴权开关检查（直接读内存缓存）
  if (authEnabledCache === false) {
    req.user = { username: 'bypass', role: '管理员', userType: 'system' };  
    return next();
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    // QA-20260422-3: 认证失败日志
    logger.warn(`认证失败: 未提供token - ${req.method} ${req.url} - IP: ${req.ip}`);
    return res.status(401).json({ error: '未登录' });
  }

  // 先尝试 JWT 解析
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    return next();
  } catch (err) {
    // JWT 解析失败,尝试 base64 解析(助教 token)
    try {
      const decodedStr = Buffer.from(token, 'base64').toString('utf8');
      // 格式: "coachNo:timestamp"
      const [coachNo, timestamp] = decodedStr.split(':');
      if (coachNo && timestamp) {
        req.user = {
          userType: 'coach',
          coachNo: coachNo,
          role: '助教'
        };
        return next();
      }
      // QA-20260422-3: Base64解析成功但格式不对
      logger.warn(`认证失败: token格式无效 - ${req.method} ${req.url} - IP: ${req.ip}`);
    } catch (e) {
      // QA-20260422-3: JWT和Base64都解析失败
      logger.warn(`认证失败: token无效 - ${req.method} ${req.url} - IP: ${req.ip} - JWT错误: ${err.message}`);
    }
    return res.status(401).json({ error: 'token无效' });
  }
};

// V2.0: 权限中间件
const { requireBackendPermission, hasBackendPermission } = require('./middleware/permission');

// === 设备访问记录（必须在 authMiddleware 之前注册，否则会被拦截返回 401）===
// 内存去重集合：记录已写入的 device_fp + visit_date，防止重复写入导致 UNIQUE 冲突
const deviceVisitSet = new Set();

app.post('/api/device/visit', async (req, res) => {
  try {
    const { deviceFp } = req.body;
    if (!deviceFp) {
      return res.status(400).json({ error: '缺少设备指纹' });
    }

    const today = TimeUtil.todayStr(); // 北京时间 YYYY-MM-DD
    const key = `${deviceFp}_${today}`;

    // 内存去重：当天已记录则跳过
    if (deviceVisitSet.has(key)) {
      return res.json({ success: true });
    }

    // DB 兜底：INSERT OR IGNORE 防止重启后 Set 丢失
    await enqueueRun(
      'INSERT OR IGNORE INTO device_visits (device_fp, visit_date) VALUES (?, ?)',
      [deviceFp, today]
    );

    deviceVisitSet.add(key);

    res.json({ success: true });
  } catch (err) {
    logger.error(`记录设备访问失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 智能开关路由（必须在 authMiddleware 之后注册）
app.use(authMiddleware, switchRouter);

// 智能空调路由（新增，必须在 authMiddleware 之后注册）
app.use(authMiddleware, acRouter);

// V2.0: 免扫码权限检查
app.get('/api/auth/check-scan-permission', authMiddleware, async (req, res) => {
  try {
    const { coach_no } = req.query;
    const user = req.user;
    const userRole = user?.role || '';
    const isAdmin = ['管理员', '超级管理员'].includes(userRole);

    // 后台用户角色(店长/助教管理/前厅管理/收银/教练/服务员)都可以免扫码下单
    const backendRoles = ['管理员', '超级管理员', '店长', '助教管理', '前厅管理', '收银', '教练', '服务员'];
    const isBackendUser = backendRoles.includes(userRole);

    // 如果没有提供 coach_no
    if (!coach_no) {
      // 后台用户:返回自己的权限信息(后台用户默认可以免扫码下单)
      if (isBackendUser) {
        return res.json({
          success: true,
          data: {
            can_skip_scan: true,
            coach_no: null,
            stage_name: user.name || user.username,
            default_table_no: null,
            status: userRole,
            is_admin: isAdmin
          }
        });
      }
      // 非后台用户,需要提供 coach_no
      return res.status(400).json({
        success: false,
        error: '缺少 coach_no 参数'
      });
    }

    // 查询助教信息和水牌状态
    const coach = await dbGet(
      `SELECT c.coach_no, c.stage_name, c.shift, wb.status, wb.table_no
       FROM coaches c
       LEFT JOIN water_boards wb ON c.coach_no = wb.coach_no
       WHERE c.coach_no = ?`,
      [coach_no]
    );

    if (!coach) {
      return res.status(404).json({
        success: false,
        error: '助教不存在'
      });
    }

    // 判断是否可免扫码:当前状态为上桌(早班上桌/晚班上桌)时,允许免扫码下单
    // 管理员查看任何助教时,返回该助教的状态
    const canSkipScan = ['早班上桌', '晚班上桌'].includes(coach.status);
    const { parseTables } = require('./db');

    res.json({
      success: true,
      data: {
        can_skip_scan: canSkipScan,
        coach_no: coach.coach_no,
        stage_name: coach.stage_name,
        default_table_no: coach.table_no || null,
        table_no_list: parseTables(coach.table_no),
        status: coach.status,
        is_admin: isAdmin
      }
    });
  } catch (err) {
    logger.error(`检查免扫码权限失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// V2.0: 权限检查
app.get('/api/auth/check-permission', authMiddleware, async (req, res) => {
  try {
    const { permission } = req.query;
    const user = req.user;

    if (!user || !user.role) {
      return res.status(401).json({
        success: false,
        error: '未登录'
      });
    }

    const { getUserPermissions } = require('./middleware/permission');
    const permissions = getUserPermissions(user.role || '管理员');

    // 如果指定了具体权限,检查是否有该权限
    if (permission) {
      const hasPermission = permissions.backend.includes(permission);
      return res.json({
        success: true,
        data: {
          has_permission: hasPermission,
          permission,
          role: user.role
        }
      });
    }

    // 返回全部权限
    res.json({
      success: true,
      data: {
        role: user.role,
        permissions: permissions.backend
      }
    });
  } catch (err) {
    logger.error(`检查权限失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 后台数据概览
app.get('/api/admin/stats', authMiddleware, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    // 人气值前5助教(过滤无效数据)
    const topCoaches = await dbAll(`SELECT coach_no, employee_id, stage_name, level, popularity FROM coaches WHERE employee_id IS NOT NULL AND employee_id != '' AND stage_name IS NOT NULL AND stage_name != '' ORDER BY popularity DESC LIMIT 6`);

    // 统计数据
    const productCount = await dbGet('SELECT COUNT(*) as count FROM products WHERE status = "上架"');
    const coachCount = await dbGet('SELECT COUNT(*) as count FROM coaches');
    const tableCount = await dbGet('SELECT COUNT(*) as count FROM tables');

    res.json({
      topCoaches,
      stats: {
        products: productCount?.count || 0,
        coaches: coachCount?.count || 0,
        tables: tableCount?.count || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取 DB 写入队列监控数据（纯内存读取，不碰数据库）
const dbModule = require('./db');
app.get('/api/admin/db-queue-stats', authMiddleware, async (req, res) => {
  const stats = dbModule.queueStats;
  const data = stats.data || [];
  res.json({
    timestamps: data.map(d => d.timestamp),
    queueLengths: data.map(d => d.queueLength),
    waitTimes: data.map(d => d.waitMs),
    currentQueueLength: writeQueue.length,
    currentMinute: stats.currentMinute
  });
});

// =============== 后台订单管理 API ===============

// GET /api/admin/orders/stats - 订单统计（数量 + 销售额）
// ⚠️ 必须在 /api/admin/orders 之前定义，否则 Express 会先匹配到 /api/admin/orders
app.get('/api/admin/orders/stats', authMiddleware, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    const { date, date_start, date_end, status } = req.query;

    let sql = 'SELECT COUNT(*) as count, COALESCE(SUM(total_price), 0) as totalRevenue FROM orders WHERE 1=1';
    const params = [];

    if (date) {
      sql += ' AND DATE(created_at) = ?';
      params.push(date);
    }
    if (date_start) {
      sql += ' AND DATE(created_at) >= ?';
      params.push(date_start);
    }
    if (date_end) {
      sql += ' AND DATE(created_at) <= ?';
      params.push(date_end);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    const row = await dbGet(sql, params);

    res.json({
      success: true,
      data: {
        count: row.count,
        totalRevenue: row.totalRevenue
      }
    });
  } catch (error) {
    logger.error(`获取订单统计失败: ${error.message}`);
    res.status(500).json({ success: false, error: '获取订单统计失败' });
  }
});

// 获取订单列表
app.get('/api/admin/orders', authMiddleware, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    const { status, date, date_start, date_end } = req.query;
    let sql = 'SELECT * FROM orders';
    const params = [];

    const conditions = [];
    if (date) {
      conditions.push("DATE(created_at) = ?");
      params.push(date);
    }
    if (date_start) {
      conditions.push("DATE(created_at) >= ?");
      params.push(date_start);
    }
    if (date_end) {
      conditions.push("DATE(created_at) <= ?");
      params.push(date_end);
    }
    if (status && status !== '全部') {
      conditions.push("status = ?");
      params.push(status);
    } else if (!status) {
      // 默认不传status时，排除已取消订单
      conditions.push("status != ?");
      params.push('已取消');
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC';

    const orders = await dbAll(sql, params);

    // 获取所有商品信息(用于关联图片和类别)
    const products = await dbAll('SELECT name, image_url, category FROM products');
    const productMap = {};
    products.forEach(p => {
      productMap[p.name] = { image_url: p.image_url, category: p.category };
    });

    // 处理订单,添加商品图片和类别
    const processedOrders = orders.map(o => {
      const items = o.items ? JSON.parse(o.items) : [];
      const itemsWithDetails = items.map(item => ({
        ...item,
        image_url: productMap[item.name]?.image_url || '',
        category: productMap[item.name]?.category || '其他'
      }));
      return {
        ...o,
        items: itemsWithDetails
      };
    });

    res.json(processedOrders);
  } catch (err) {
    logger.error(`获取订单列表失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 完成订单
app.post('/api/admin/orders/:id/complete', authMiddleware, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    await enqueueRun("UPDATE orders SET status = '已完成', updated_at = ? WHERE id = ?", [TimeUtil.nowDB(), req.params.id]);
    operationLog.info(`订单完成: ${req.params.id} by ${req.user.username}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`完成订单失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 取消订单
app.post('/api/admin/orders/:id/cancel', authMiddleware, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    await enqueueRun("UPDATE orders SET status = '已取消', updated_at = ? WHERE id = ?", [TimeUtil.nowDB(), req.params.id]);
    operationLog.info(`订单取消: ${req.params.id} by ${req.user.username}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`取消订单失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 取消订单中的单个商品
app.post('/api/admin/orders/:id/cancel-item', authMiddleware, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    const { itemName, cancelQuantity } = req.body;
    const orderId = req.params.id;

    // 参数验证
    if (!itemName || !cancelQuantity || cancelQuantity < 1) {
      return res.status(400).json({ error: '参数错误:商品名称和取消数量必填' });
    }

    // 查询订单
    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }

    if (order.status !== '待处理') {
      return res.status(400).json({ error: '只能取消待处理订单中的商品' });
    }

    // 解析订单商品
    const items = JSON.parse(order.items || '[]');

    // 找到要取消的商品
    const itemIndex = items.findIndex(i => i.name === itemName);
    if (itemIndex === -1) {
      return res.status(404).json({ error: '商品不存在于该订单中' });
    }

    const item = items[itemIndex];

    // 验证取消数量
    if (cancelQuantity > item.quantity) {
      return res.status(400).json({ error: `取消数量超过商品数量(当前${item.quantity})` });
    }

    // 记录操作日志
    const cancelDetail = cancelQuantity === item.quantity
      ? `全部取消`
      : `部分取消(${cancelQuantity}/${item.quantity})`;
    operationLog.info(`订单商品取消: 订单${orderId} 商品${itemName} ${cancelDetail} by ${req.user.username}`);

    // 更新商品
    if (cancelQuantity === item.quantity) {
      // 全部取消,删除该商品
      items.splice(itemIndex, 1);
    } else {
      // 部分取消,减少数量
      item.quantity -= cancelQuantity;
      item.subtotal = item.price * item.quantity;
    }

    // 重新计算总金额
    const totalPrice = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    // 如果订单无商品,自动取消订单
    if (items.length === 0) {
      await enqueueRun(
        "UPDATE orders SET status = '已取消', items = ?, total_price = 0, updated_at = ? WHERE id = ?",
        [JSON.stringify([]), TimeUtil.nowDB(), orderId]
      );
      operationLog.info(`订单自动取消: ${orderId}(所有商品已取消) by ${req.user.username}`);

      res.json({
        success: true,
        orderEmpty: true,
        message: '订单已无商品,自动取消'
      });
    } else {
      // 更新订单
      await enqueueRun(
        "UPDATE orders SET items = ?, total_price = ?, updated_at = ? WHERE id = ?",
        [JSON.stringify(items), totalPrice, TimeUtil.nowDB(), orderId]
      );

      // 返回更新后的订单信息(包含商品图片和类别)
      const products = await dbAll('SELECT name, image_url, category FROM products');
      const processedItems = items.map(i => {
        const product = products.find(p => p.name === i.name);
        return {
          ...i,
          image_url: product?.image_url || null,
          category: product?.category || '其他'
        };
      });

      res.json({
        success: true,
        orderEmpty: false,
        order: {
          id: parseInt(orderId),
          items: processedItems,
          total_price: totalPrice
        }
      });
    }
  } catch (err) {
    logger.error(`取消订单商品失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 收银看板 API - 统一返回服务单 + 上下桌单 + 商品订单
app.get('/api/cashier-dashboard', authMiddleware, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    const limit = req.query.limit || 50;

    // 获取待处理服务单
    const serviceOrders = await dbAll(
      `SELECT * FROM service_orders WHERE status = '待处理' ORDER BY created_at DESC LIMIT ?`,
      [parseInt(limit)]
    );

    // 获取待处理上下桌单
    const tableActionOrders = await dbAll(
      `SELECT * FROM table_action_orders WHERE status = '待处理' ORDER BY created_at DESC LIMIT ?`,
      [parseInt(limit)]
    );

    // 获取待处理商品订单
    const orders = await dbAll(
      `SELECT * FROM orders WHERE status = '待处理' ORDER BY created_at DESC LIMIT ?`,
      [parseInt(limit)]
    );

    // 统计数量
    const pendingServiceCount = await dbGet(
      `SELECT COUNT(*) as count FROM service_orders WHERE status = '待处理'`
    );
    const pendingTableActionCount = await dbGet(
      `SELECT COUNT(*) as count FROM table_action_orders WHERE status = '待处理'`
    );
    const pendingOrderCount = await dbGet(
      `SELECT COUNT(*) as count FROM orders WHERE status = '待处理'`
    );

    res.json({
      success: true,
      data: {
        service_orders: serviceOrders,
        table_action_orders: tableActionOrders,
        orders: orders,
        counts: {
          pending_service: pendingServiceCount?.count || 0,
          pending_table_action: pendingTableActionCount?.count || 0,
          pending_orders: pendingOrderCount?.count || 0
        }
      }
    });
  } catch (err) {
    logger.error(`收银看板查询失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 后台用户管理
app.get('/api/admin/users', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const users = await dbAll('SELECT username, name, role, created_at, employment_status FROM admin_users');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// V2.0: 获取用户权限
app.get('/api/admin/users/:username/permissions', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { username } = req.params;

    // 获取用户信息
    const user = await dbGet('SELECT username, role, name FROM admin_users WHERE username = ?', [username]);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 获取权限
    const { getUserPermissions } = require('./middleware/permission');
    const permissions = getUserPermissions(user.role || '管理员');

    res.json({
      success: true,
      data: {
        username: user.username,
        name: user.name,
        role: user.role || '管理员',
        permissions: permissions.backend
      }
    });
  } catch (err) {
    logger.error(`获取用户权限失败:${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.post('/api/admin/users', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { username, password, name, role } = req.body;

    // 店长不能授权管理员角色
    if (req.user.role === '店长' && (role === '管理员' || role === 'admin' || role === 'superadmin')) {
      return res.status(403).json({ error: '店长不能授权管理员角色' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await enqueueRun('INSERT INTO admin_users (username, password, name, role) VALUES (?, ?, ?, ?)', [username, hashedPassword, name || '', role || '店长']);
    operationLog.info(`创建后台用户: ${username} (${role || '店长'})`);
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

app.put('/api/admin/users/:username', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { password, name, role, employmentStatus } = req.body;

    // 店长不能授权管理员角色
    if (role !== undefined && req.user.role === '店长' && (role === '管理员' || role === 'admin' || role === 'superadmin')) {
      return res.status(403).json({ error: '店长不能授权管理员角色' });
    }

    // 只更新请求中提供的字段，避免覆盖未提供的字段
    const updates = [];
    const params = [];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      params.push(hashedPassword);
    }
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      params.push(role);
    }
    if (employmentStatus !== undefined) {
      updates.push('employment_status = ?');
      params.push(employmentStatus);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '未提供更新字段' });
    }

    params.push(req.params.username);
    await enqueueRun(`UPDATE admin_users SET ${updates.join(', ')} WHERE username = ?`, params);

    operationLog.info(`更新后台用户: ${req.params.username}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

app.delete('/api/admin/users/:username', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    if (req.params.username === 'tgadmin') {
      return res.status(400).json({ error: '不能删除默认管理员' });
    }
    await enqueueRun('DELETE FROM admin_users WHERE username = ?', [req.params.username]);
    operationLog.info(`删除后台用户: ${req.params.username}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 商品分类管理
app.get('/api/admin/categories', authMiddleware, requireBackendPermission(['productManagement']), async (req, res) => {
  try {
    const categories = await dbAll('SELECT * FROM product_categories ORDER BY sort_order ASC, name ASC');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

app.post('/api/admin/categories', authMiddleware, requireBackendPermission(['productManagement']), async (req, res) => {
  try {
    const { name, sortOrder } = req.body;
    const order = sortOrder || 0;
    await enqueueRun('INSERT INTO product_categories (name, creator, sort_order, created_at) VALUES (?, ?, ?, ?)', [name, req.user.username, order, TimeUtil.nowDB()]);
    operationLog.info(`创建商品分类: ${name}`);
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '分类已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

app.put('/api/admin/categories/:name', authMiddleware, requireBackendPermission(['productManagement']), async (req, res) => {
  try {
    const { sortOrder } = req.body;
    await enqueueRun('UPDATE product_categories SET sort_order = ? WHERE name = ?', [sortOrder || 0, req.params.name]);
    operationLog.info(`更新分类排序: ${req.params.name} -> ${sortOrder}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

app.delete('/api/admin/categories/:name', authMiddleware, requireBackendPermission(['productManagement']), async (req, res) => {
  try {
    // 检查是否有商品使用此分类
    const count = await dbGet('SELECT COUNT(*) as count FROM products WHERE category = ?', [req.params.name]);
    if (count.count > 0) {
      return res.status(400).json({ error: `该分类下有${count.count}个商品,无法删除` });
    }
    await enqueueRun('DELETE FROM product_categories WHERE name = ?', [req.params.name]);
    operationLog.info(`删除商品分类: ${req.params.name}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 商品同步状态
// 获取商品同步状态(改为查询数据库 updated_at)
app.get('/api/admin/sync-products-status', authMiddleware, requireBackendPermission(['productManagement']), async (req, res) => {
  try {
    // 查询最近更新的商品
    const latestProduct = await dbGet(
      `SELECT updated_at FROM products ORDER BY updated_at DESC LIMIT 1`
    );

    if (!latestProduct || !latestProduct.updated_at) {
      return res.json({ status: 'none', lastSyncTime: null, productsCount: 0, message: '从未同步' });
    }

    // 统计商品数量
    const countResult = await dbGet('SELECT COUNT(*) as count FROM products');

    // 将本地时间字符串转换为 ISO 8601 格式(带时区 +08:00)
    const localTime = latestProduct.updated_at;
    const isoTime = localTime.replace(' ', 'T') + '+08:00';

    res.json({
      status: 'success',
      lastSyncTime: isoTime,  // ISO 8601 格式(带时区)
      lastSyncTimeLocal: localTime,  // 本地时间字符串(用于显示)
      productsCount: countResult?.count || 0,
      message: '同步成功'
    });
  } catch (err) {
    logger.error(`获取商品同步状态失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 商品数据同步接口(供同步脚本调用)
app.post('/api/admin/sync/products', authMiddleware, requireBackendPermission(['productManagement']), async (req, res) => {
  const startTime = Date.now();
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: '缺少商品数据或数据格式错误' });
    }

    logger.info(`开始商品数据同步,共 ${products.length} 条数据`);

    // 排除分类(与脚本逻辑一致)
    const EXCLUDE_CATEGORIES = ['美女教练'];
    const filteredProducts = products.filter(p => !EXCLUDE_CATEGORIES.includes(p.category));
    const removedCount = products.length - filteredProducts.length;
    logger.info(`过滤分类: ${EXCLUDE_CATEGORIES.join('、')}, 排除 ${removedCount} 条`);

    // 特殊图片强制下架(与脚本逻辑一致)
    const OFFLINE_IMAGE_URL = 'https://hui-shang.oss-cn-hangzhou.aliyuncs.com/pic/GtYe33GDA60y6xWF.png';

    // 事务包裹: 所有商品+分类同步在一个 BEGIN/COMMIT 内执行
    const result = await runInTransaction(async (tx) => {
      let inserted = 0, updated = 0, skipped = 0;

      for (const p of filteredProducts) {
        if (!p.name || p.name.trim() === '') {
          skipped++;
          continue;
        }

        // 特殊图片强制下架
        const finalStatus = p.imageUrl === OFFLINE_IMAGE_URL ? '下架' : (p.status || '上架');

        try {
          const existing = await tx.get('SELECT name FROM products WHERE name = ?', [p.name]);

          if (existing) {
            await tx.run(
              `UPDATE products SET
                image_url = ?,
                price = ?,
                stock_total = ?,
                stock_available = ?,
                category = ?,
                status = ?,
                creator = ?,
                updated_at = ?
              WHERE name = ?`,
              [p.imageUrl || '', p.price || '', p.stockTotal || 0, p.stockAvailable || 0, p.category || '', finalStatus, p.creator || '', TimeUtil.nowDB(), p.name]
            );
            updated++;
          } else {
            await tx.run(
              `INSERT INTO products (name, image_url, price, stock_total, stock_available, category, status, creator, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [p.name, p.imageUrl || '', p.price || '', p.stockTotal || 0, p.stockAvailable || 0, p.category || '', finalStatus, p.creator || '', TimeUtil.nowDB(), TimeUtil.nowDB()]
            );
            inserted++;
          }
        } catch (e) {
          logger.error(`同步商品失败: ${p.name} - ${e.message}`);
          skipped++;
        }
      }

      // 同步分类(与脚本逻辑一致)
      const filteredCategories = [...new Set(
        filteredProducts
          .map(p => p.category)
          .filter(c => c && !EXCLUDE_CATEGORIES.includes(c))
      )];

      let categoriesInserted = 0, categoriesExisting = 0;

      for (const cat of filteredCategories) {
        try {
          const row = await tx.get('SELECT name FROM product_categories WHERE name = ?', [cat]);

          if (row) {
            categoriesExisting++;
          } else {
            await tx.run(
              `INSERT INTO product_categories (name, creator, created_at) VALUES (?, 'sync-script', ?)`,
              [cat, TimeUtil.nowDB()]
            );
            categoriesInserted++;
          }
        } catch (e) {
          logger.error(`同步分类失败: ${cat} - ${e.message}`);
        }
      }

      return { inserted, updated, skipped, categoriesInserted, categoriesExisting };
    });

    const elapsed = Date.now() - startTime;
    logger.info(`商品同步完成: 新增 ${result.inserted} 条, 更新 ${result.updated} 条, 跳过 ${result.skipped} 条, 分类新增 ${result.categoriesInserted} 个, 已存在 ${result.categoriesExisting} 个, 耗时 ${elapsed}ms`);

    res.json({
      success: true,
      data: {
        productsInserted: result.inserted,
        productsUpdated: result.updated,
        productsSkipped: result.skipped,
        categoriesInserted: result.categoriesInserted,
        categoriesExisting: result.categoriesExisting,
        productsCount: filteredProducts.length,
        elapsedMs: elapsed
      }
    });
  } catch (err) {
    const elapsed = Date.now() - startTime;
    logger.error(`商品同步失败: ${err.message}, 耗时 ${elapsed}ms`);
    res.status(500).json({ error: '服务器错误', elapsedMs: elapsed });
  }
});

// 商品管理
app.get('/api/admin/products', authMiddleware, requireBackendPermission(['productManagement']), async (req, res) => {
  try {
    const products = await dbAll('SELECT * FROM products ORDER BY created_at DESC');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

app.post('/api/admin/products', authMiddleware, requireBackendPermission(['productManagement']), async (req, res) => {
  try {
    const { name, category, imageUrl, price, stockTotal, stockAvailable, status } = req.body;

    await enqueueRun(
      `INSERT INTO products (name, category, image_url, price, stock_total, stock_available, status, creator, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category, imageUrl, price, stockTotal, stockAvailable, status, req.user.username, TimeUtil.nowDB(), TimeUtil.nowDB()]
    );
    operationLog.info(`创建商品: ${name}`);
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '商品名称已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

app.put('/api/admin/products/:name', authMiddleware, requireBackendPermission(['productManagement']), async (req, res) => {
  try {
    const { category, imageUrl, price, stockTotal, stockAvailable, status } = req.body;

    await enqueueRun(
      `UPDATE products SET category = ?, image_url = ?, price = ?, stock_total = ?, stock_available = ?, status = ?, updated_at = ? WHERE name = ?`,
      [category, imageUrl, price, stockTotal, stockAvailable, status, TimeUtil.nowDB(), req.params.name]
    );
    operationLog.info(`更新商品: ${req.params.name}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

app.delete('/api/admin/products/:name', authMiddleware, requireBackendPermission(['productManagement']), async (req, res) => {
  try {
    await enqueueRun('DELETE FROM products WHERE name = ?', [req.params.name]);
    operationLog.info(`删除商品: ${req.params.name}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 助教管理
app.get('/api/admin/coaches', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    let coaches = await dbAll('SELECT * FROM coaches WHERE employee_id IS NOT NULL AND employee_id != \'\' AND stage_name IS NOT NULL AND stage_name != \'\' ORDER BY CAST(employee_id AS INTEGER) ASC, coach_no');
    coaches = coaches.map(c => ({
      ...c,
      photos: c.photos ? JSON.parse(c.photos) : [],
      videos: c.videos ? JSON.parse(c.videos) : []
    }));
    res.json(coaches);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

app.post('/api/admin/coaches', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { employeeId, stageName, realName, phone, level, price, age, height, photos, video, intro, isPopular, status, shift } = req.body;

    // 验证班次枚举值
    const validShifts = ['早班', '晚班'];
    const finalShift = (shift && validShifts.includes(shift)) ? shift : '早班';

    // 检查工号和艺名组合是否已存在
    const existing = await dbGet(
      'SELECT coach_no FROM coaches WHERE employee_id = ? AND stage_name = ?',
      [employeeId, stageName]
    );
    if (existing) {
      return res.status(400).json({ error: '该工号和艺名组合已存在,请检查是否重复添加' });
    }

    // 开启事务
    await runInTransaction(async (tx) => {
      const result = await tx.run(
        `INSERT INTO coaches (employee_id, stage_name, real_name, phone, level, price, age, height, photos, video, intro, is_popular, status, shift, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [employeeId, stageName, realName, phone || null, level, price, age, height, JSON.stringify(photos || []), video, intro, isPopular ? 1 : 0, status || '全职', finalShift, TimeUtil.nowDB(), TimeUtil.nowDB()]
      );
      const newCoachNo = result.lastID;

      // 同步创建 water_boards 记录（根据班次设置初始状态）
      const initialWbStatus = finalShift === '晚班' ? '晚班空闲' : '早班空闲';
      await tx.run(
        `INSERT INTO water_boards (coach_no, stage_name, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [newCoachNo, stageName, initialWbStatus, TimeUtil.nowDB(), TimeUtil.nowDB()]
      );

      // 验证水牌记录是否创建成功
      const wbCheck = await tx.get('SELECT id FROM water_boards WHERE coach_no = ?', [newCoachNo]);
      if (!wbCheck) {
        logger.error(`水牌记录创建失败: coach_no=${newCoachNo}, stage_name=${stageName}`);
        throw new Error('水牌记录创建失败，请重试');
      }

      operationLog.info(`创建助教: ${stageName} (${newCoachNo}), 水牌记录已同步创建`);
      res.json({ success: true, coachNo: newCoachNo });
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '该工号和艺名组合已存在,请检查是否重复添加' });
    }
    logger.error(`创建助教失败: ${err.message}`);
    res.status(500).json({ error: `服务器错误: ${err.message}` });
  }
});

app.put('/api/admin/coaches/:coachNo', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { employeeId, stageName, realName, phone, level, price, age, height, photos, video, intro, isPopular, status, shift } = req.body;

    // 验证班次枚举值
    const validShifts = ['早班', '晚班'];
    const finalShift = (shift && validShifts.includes(shift)) ? shift : undefined;

    // 检查工号和艺名组合是否被其他助教使用
    const existing = await dbGet(
      'SELECT coach_no FROM coaches WHERE employee_id = ? AND stage_name = ? AND coach_no != ?',
      [employeeId, stageName, req.params.coachNo]
    );
    if (existing) {
      return res.status(400).json({ error: '该工号和艺名组合已被其他助教使用' });
    }

    // 获取原有数据,用于保留前台可编辑字段
    const currentCoach = await dbGet('SELECT photos, videos, intro, age, height, shift, status FROM coaches WHERE coach_no = ?', [req.params.coachNo]);

    // 对于前台可编辑的字段,如果后台没有传值,保留原有数据
    let finalPhotos = photos;
    if (!photos || (Array.isArray(photos) && photos.length === 0)) {
      finalPhotos = currentCoach?.photos ? JSON.parse(currentCoach.photos) : [];
    }

    let finalVideos = currentCoach?.videos ? JSON.parse(currentCoach.videos) : [];
    let finalIntro = intro !== undefined ? intro : (currentCoach?.intro || '');
    let finalAge = age !== undefined ? age : currentCoach?.age;
    let finalHeight = height !== undefined ? height : currentCoach?.height;
    let resolvedShift = finalShift !== undefined ? finalShift : (currentCoach?.shift || '早班');

    const newStatus = status || '全职';
    const oldStatus = currentCoach?.status || '全职';

    // 使用事务确保 coaches 更新和 water_boards 联动原子执行
    await runInTransaction(async (tx) => {
      await tx.run(
        `UPDATE coaches SET employee_id = ?, stage_name = ?, real_name = ?, phone = ?, level = ?, price = ?, age = ?, height = ?, photos = ?, video = ?, intro = ?, videos = ?, is_popular = ?, status = ?, shift = ?, updated_at = ? WHERE coach_no = ?`,
        [employeeId, stageName, realName, phone || null, level, price, finalAge, finalHeight, JSON.stringify(finalPhotos || []), video, finalIntro, JSON.stringify(finalVideos || []), isPopular ? 1 : 0, newStatus, resolvedShift, TimeUtil.nowDB(), req.params.coachNo]
      );

      // 联动 water_boards 处理
      if (newStatus === '离职' && oldStatus !== '离职') {
        // 改为离职 → 删除水牌
        await tx.run('DELETE FROM water_boards WHERE coach_no = ?', [req.params.coachNo]);
        // 验证水牌是否已删除
        const wbCheck = await tx.get('SELECT id FROM water_boards WHERE coach_no = ?', [req.params.coachNo]);
        if (wbCheck) {
          logger.error(`水牌删除验证失败: coach_no=${req.params.coachNo}, 水牌记录仍然存在`);
          throw new Error('水牌记录删除失败');
        }
        operationLog.info(`助教改为离职: ${req.params.coachNo}, 水牌记录已同步删除`);
      } else if ((newStatus === '全职' || newStatus === '兼职') && oldStatus === '离职') {
        // 从离职改为全职/兼职 → 创建水牌（先删再插，防止 UNIQUE 冲突）
        await tx.run('DELETE FROM water_boards WHERE coach_no = ?', [req.params.coachNo]);
        const initialWbStatus = resolvedShift === '晚班' ? '晚班空闲' : '早班空闲';
        await tx.run(
          `INSERT INTO water_boards (coach_no, stage_name, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [req.params.coachNo, stageName, initialWbStatus, TimeUtil.nowDB(), TimeUtil.nowDB()]
        );
        operationLog.info(`助教恢复为${newStatus}: ${req.params.coachNo}, 水牌记录已同步创建`);
      }
    });
    // 全职↔兼职互切：水牌已存在，无需额外操作

    operationLog.info(`更新助教: ${req.params.coachNo}`);
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '该工号和艺名组合已被其他助教使用' });
    }
    logger.error(`更新助教失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.delete('/api/admin/coaches/:coachNo', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const coach = await dbGet('SELECT stage_name, status FROM coaches WHERE coach_no = ?', [req.params.coachNo]);
    if (!coach) {
      return res.status(404).json({ error: '助教不存在' });
    }

    // 全职和兼职助教不允许删除
    if (coach.status !== '离职') {
      return res.status(400).json({ error: '只能删除离职助教' });
    }

    // 使用事务确保 water_boards 和 coaches 删除原子执行
    await runInTransaction(async (tx) => {
      // 先删除 water_boards 记录
      await tx.run('DELETE FROM water_boards WHERE coach_no = ?', [req.params.coachNo]);
      // 验证水牌是否已删除
      const wbCheck = await tx.get('SELECT id FROM water_boards WHERE coach_no = ?', [req.params.coachNo]);
      if (wbCheck) {
        logger.error(`水牌删除验证失败: coach_no=${req.params.coachNo}`);
        throw new Error('水牌记录删除失败');
      }

      // 再删除 coaches 记录
      await tx.run('DELETE FROM coaches WHERE coach_no = ?', [req.params.coachNo]);
    });

    operationLog.info(`删除助教: ${coach.stage_name}(${req.params.coachNo}), 水牌记录已同步删除`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`删除助教失败: ${err.message}`);
    res.status(500).json({ error: `服务器错误: ${err.message}` });
  }
});

/**
 * PUT /api/admin/coaches/:coachNo/shift
 * 专用班次修改接口 - 只更新班次字段,不覆盖其他数据
 */
app.put('/api/admin/coaches/:coachNo/shift', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { shift } = req.body;

    // 验证班次值
    if (shift !== '早班' && shift !== '晚班') {
      return res.status(400).json({ error: '班次必须是早班或晚班' });
    }

    // 检查助教是否存在
    const coach = await dbGet('SELECT coach_no, stage_name, shift FROM coaches WHERE coach_no = ?', [req.params.coachNo]);
    if (!coach) {
      return res.status(404).json({ error: '助教不存在' });
    }

    const oldShift = coach.shift || '早班';

    // 使用事务确保 coaches 班次更新和水牌状态映射原子执行
    await runInTransaction(async (tx) => {
      // 只更新班次字段
      await tx.run('UPDATE coaches SET shift = ?, updated_at = ? WHERE coach_no = ?', [shift, TimeUtil.nowDB(), req.params.coachNo]);

      // 联动水牌状态映射（参考 routes/coaches.js v2 接口）
      const waterBoard = await tx.get('SELECT id, status FROM water_boards WHERE coach_no = ?', [req.params.coachNo]);
      if (waterBoard) {
        const statusMap = {
          '早班空闲': '晚班空闲',
          '晚班空闲': '早班空闲',
          '早班上桌': '晚班上桌',
          '晚班上桌': '早班上桌',
          '早加班': '晚加班',
          '晚加班': '早加班'
        };

        const wbOldStatus = waterBoard.status;
        const wbNewStatus = statusMap[wbOldStatus];

        if (wbNewStatus) {
          await tx.run(
            'UPDATE water_boards SET status = ?, updated_at = ? WHERE coach_no = ?',
            [wbNewStatus, TimeUtil.nowDB(), req.params.coachNo]
          );
          operationLog.info(`班次变更联动: ${coach.stage_name}(${req.params.coachNo}) 水牌 ${wbOldStatus}→${wbNewStatus}`);
        }
      }
      // 水牌不存在的情况（如离职助教）：静默跳过
    });

    operationLog.info(`修改班次: ${coach.stage_name}(${req.params.coachNo}) ${oldShift} → ${shift}`);
    res.json({ success: true, coach_no: req.params.coachNo, old_shift: oldShift, new_shift: shift });
  } catch (err) {
    logger.error(`修改班次失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// =============== 同步水牌 API ===============

/**
 * GET /api/admin/coaches/sync-water-boards/preview
 * 预览同步差异：检测孤儿数据和缺失数据
 */
app.get('/api/admin/coaches/sync-water-boards/preview', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    // 孤儿数据检测
    // 注意：coaches.coach_no 是 INTEGER，water_boards.coach_no 是 TEXT
    // 需要用 CAST 统一类型
    const orphanRecords = await dbAll(`
      SELECT * FROM (
        SELECT wb.coach_no, wb.stage_name, wb.status AS wb_status,
               'coaches表不存在' AS reason
        FROM water_boards wb
        LEFT JOIN coaches c ON wb.coach_no = CAST(c.coach_no AS TEXT)
        WHERE c.coach_no IS NULL

        UNION ALL

        SELECT wb.coach_no, wb.stage_name, wb.status AS wb_status,
               'coaches.status=离职' AS reason
        FROM water_boards wb
        INNER JOIN coaches c ON wb.coach_no = CAST(c.coach_no AS TEXT)
        WHERE c.status = '离职'
      ) ORDER BY CAST(coach_no AS INTEGER)
    `);

    // 缺失数据检测
    const missingRecords = await dbAll(`
      SELECT CAST(c.coach_no AS TEXT) AS coach_no, c.stage_name, c.status, c.shift
      FROM coaches c
      LEFT JOIN water_boards wb ON CAST(c.coach_no AS TEXT) = wb.coach_no
      WHERE c.status IN ('全职', '兼职')
        AND wb.coach_no IS NULL
      ORDER BY c.coach_no
    `);

    // 离店助教残留台桌检测
    const offDutyWithTables = await dbAll(`
      SELECT wb.coach_no, wb.stage_name, wb.status, wb.table_no, wb.updated_at, c.shift, c.photos
      FROM water_boards wb
      LEFT JOIN coaches c ON wb.coach_no = CAST(c.coach_no AS TEXT)
      WHERE wb.status IN ('休息', '公休', '请假', '下班')
        AND wb.table_no IS NOT NULL
        AND wb.table_no != ''
      ORDER BY CAST(wb.coach_no AS INTEGER)
    `);

    const { parseTables } = require('./db');
    const offDutyData = (offDutyWithTables || []).map(r => ({
      coach_no: r.coach_no,
      stage_name: r.stage_name,
      status: r.status,
      table_no: r.table_no,
      table_no_list: parseTables(r.table_no),
      table_count: parseTables(r.table_no).length
    }));

    res.json({
      orphanRecords: orphanRecords || [],
      missingRecords: missingRecords || [],
      offDutyWithTables: offDutyData,
      summary: {
        orphanCount: orphanRecords ? orphanRecords.length : 0,
        missingCount: missingRecords ? missingRecords.length : 0,
        offDutyCount: offDutyData.length
      }
    });
  } catch (err) {
    logger.error(`预览水牌同步失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * POST /api/admin/coaches/sync-water-boards/execute
 * 执行同步：删除孤儿记录 + 添加缺失记录
 */
app.post('/api/admin/coaches/sync-water-boards/execute', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { deleteOrphanIds, addMissingIds, clearTableCoachNos } = req.body;

    if (!Array.isArray(deleteOrphanIds) || !Array.isArray(addMissingIds)) {
      return res.status(400).json({ error: '参数格式错误' });
    }

    const errors = [];
    let deleted = 0;
    let added = 0;
    let cleared = 0;

    await runInTransaction(async (tx) => {
      // 1. 批量删除孤儿记录
      for (const coachNo of deleteOrphanIds) {
        try {
          await tx.run('DELETE FROM water_boards WHERE coach_no = ?', [coachNo]);
          // 验证删除
          const wbCheck = await tx.get('SELECT id FROM water_boards WHERE coach_no = ?', [coachNo]);
          if (wbCheck) {
            throw new Error(`coach_no=${coachNo} 删除验证失败`);
          }
          deleted++;
        } catch (e) {
          errors.push(`coach_no=${coachNo}: 删除失败 - ${e.message}`);
        }
      }

      // 2. 批量添加缺失记录
      for (const coachNo of addMissingIds) {
        try {
          const coach = await tx.get('SELECT stage_name, shift FROM coaches WHERE CAST(coach_no AS TEXT) = ?', [coachNo]);
          if (!coach) {
            throw new Error(`coach_no=${coachNo} 在coaches表中不存在`);
          }
          const initialStatus = coach.shift === '晚班' ? '晚班空闲' : '早班空闲';
          await tx.run(
            'INSERT INTO water_boards (coach_no, stage_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
            [coachNo, coach.stage_name, initialStatus, TimeUtil.nowDB(), TimeUtil.nowDB()]
          );
          // 验证插入
          const wbCheck = await tx.get('SELECT id FROM water_boards WHERE coach_no = ?', [coachNo]);
          if (!wbCheck) {
            throw new Error(`coach_no=${coachNo} 插入验证失败`);
          }
          added++;
        } catch (e) {
          errors.push(`coach_no=${coachNo}: 添加失败 - ${e.message}`);
        }
      }

      // 3. 清理离店助教残留台桌号
      if (Array.isArray(clearTableCoachNos) && clearTableCoachNos.length > 0) {
        const nowDB = TimeUtil.nowDB();
        for (const coachNo of clearTableCoachNos) {
          try {
            const wb = await tx.get('SELECT id, coach_no, stage_name, table_no, status FROM water_boards WHERE coach_no = ?', [coachNo]);
            if (wb && wb.table_no) {
              await tx.run(
                'UPDATE water_boards SET table_no = NULL, updated_at = ? WHERE coach_no = ?',
                [nowDB, coachNo]
              );
              const user = req.user;
              await operationLogService.create(tx, {
                operator_phone: user.username,
                operator_name: user.name,
                operation_type: '清理残留台桌',
                target_type: 'water_board',
                target_id: wb.id,
                old_value: JSON.stringify({ table_no: wb.table_no, status: wb.status }),
                new_value: JSON.stringify({ table_no: null, status: wb.status }),
                remark: `同步水牌时清理${wb.stage_name}(${wb.coach_no})残留台桌号：${wb.table_no} → 空（状态：${wb.status}）`
              });
              cleared++;
            }
          } catch (e) {
            errors.push(`coach_no=${coachNo}: 清理台桌失败 - ${e.message}`);
          }
        }
      }

      // 4. 记录操作日志
      operationLog.info(`同步水牌: 删除${deleted}条孤儿记录, 添加${added}条缺失记录, 清理${cleared}人残留台桌`);
    });

    if (errors.length > 0) {
      return res.json({
        success: false,
        error: '部分操作失败',
        deleted,
        added,
        cleared,
        errors
      });
    }

    res.json({ success: true, deleted, added, cleared, errors: [] });
  } catch (err) {
    logger.error(`执行水牌同步失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// =============== 会员管理 API ===============

// =============== 会员同步助教 API ===============

/**
 * 构建备注字符串（幂等处理）
 * @param {string} currentRemark - 当前备注
 * @param {string} employeeId - 助教工号
 * @param {string} stageName - 助教艺名
 */
function buildRemark(currentRemark, employeeId, stageName) {
  const newTag = `[助教] 工号:${employeeId}, 艺名:${stageName}`;
  if (!currentRemark || currentRemark.trim() === '') {
    return newTag;
  }
  // 如果已有相同工号的助教标记，替换它
  const regex = /\[助教\]\s*工号:[^,]+,\s*艺名:[^\]]*/g;
  if (regex.test(currentRemark)) {
    return currentRemark.replace(regex, newTag);
  }
  // 否则追加
  return currentRemark + '；' + newTag;
}

/**
 * POST /api/admin/members/sync-coaches/preview
 * 匹配会员与助教（根据手机号）
 */
app.post('/api/admin/members/sync-coaches/preview', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const matches = await dbAll(`
      SELECT 
        m.member_no, m.phone, m.name, m.gender, m.remark,
        c.employee_id AS coach_employee_id, 
        c.stage_name AS coach_stage_name,
        c.status AS coach_status
      FROM members m
      INNER JOIN coaches c ON m.phone = c.phone
      WHERE m.phone IS NOT NULL AND m.phone != ''
        AND c.phone IS NOT NULL AND c.phone != ''
        AND c.status != '离职'
      ORDER BY m.member_no
    `);

    const totalMembers = await dbGet('SELECT COUNT(*) as cnt FROM members');
    const totalCoaches = await dbGet("SELECT COUNT(*) as cnt FROM coaches WHERE status != '离职'");

    res.json({
      success: true,
      matches: matches || [],
      summary: {
        totalMembers: totalMembers?.cnt || 0,
        totalCoaches: totalCoaches?.cnt || 0,
        matchedCount: matches ? matches.length : 0
      }
    });
  } catch (err) {
    logger.error(`会员同步助教预览失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * POST /api/admin/members/sync-coaches/execute
 * 执行批量同步
 */
app.post('/api/admin/members/sync-coaches/execute', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: '请选择需要同步的会员' });
    }

    const details = [];
    const errors = [];

    for (const item of items) {
      const { member_no, coach_employee_id, coach_stage_name } = item;

      try {
        const member = await dbGet(
          'SELECT member_no, name, gender, remark FROM members WHERE member_no = ?',
          [member_no]
        );

        if (!member) {
          errors.push({ member_no, status: 'not_found', message: '会员不存在' });
          continue;
        }

        const newRemark = buildRemark(member.remark, coach_employee_id, coach_stage_name);

        const updatedFields = ['remark'];
        const genderUpdate = (!member.gender || member.gender.trim() === '') ? '女' : null;
        if (genderUpdate) updatedFields.push('gender');

        const nameUpdate = (!member.name || member.name.trim() === '') ? coach_stage_name : null;
        if (nameUpdate) updatedFields.push('name');

        await enqueueRun(
          `UPDATE members 
           SET remark = ?, 
               gender = CASE WHEN IFNULL(gender, '') = '' THEN '女' ELSE gender END,
               name = CASE WHEN IFNULL(name, '') = '' THEN ? ELSE name END,
               updated_at = ?
           WHERE member_no = ?`,
          [newRemark, nameUpdate || member.name, TimeUtil.nowDB(), member_no]
        );

        details.push({ member_no, status: 'success', updated_fields: updatedFields });

      } catch (err) {
        errors.push({ member_no, status: 'error', message: err.message });
      }
    }

    operationLog.info(`会员同步助教: 成功 ${details.length} 条, 失败 ${errors.length} 条`);

    res.json({
      success: true,
      syncedCount: details.length,
      details,
      errors
    });
  } catch (err) {
    logger.error(`会员同步助教执行失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// =============== 会员管理 API ===============

// 获取会员列表
app.get('/api/admin/members', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const members = await dbAll('SELECT member_no, phone, openid, name, gender, remark, created_at FROM members ORDER BY created_at DESC');
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 新增会员
app.post('/api/admin/members', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { phone, name, gender, remark } = req.body;

    if (!phone) {
      return res.status(400).json({ error: '手机号必填' });
    }

    // 检查手机号是否已存在
    const existing = await dbGet('SELECT member_no FROM members WHERE phone = ?', [phone]);
    if (existing) {
      return res.status(400).json({ error: '手机号已存在' });
    }

    await enqueueRun(
      'INSERT INTO members (phone, name, gender, remark, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [phone, name, gender, remark, TimeUtil.nowDB(), TimeUtil.nowDB()]
    );

    operationLog.info(`新增会员: ${phone}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 修改会员
app.put('/api/admin/members/:memberNo', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { phone, name, gender, remark } = req.body;

    // 检查手机号是否被其他会员使用
    const existing = await dbGet('SELECT member_no FROM members WHERE phone = ? AND member_no != ?', [phone, req.params.memberNo]);
    if (existing) {
      return res.status(400).json({ error: '手机号已被其他会员使用' });
    }

    await enqueueRun(
      'UPDATE members SET phone = ?, name = ?, gender = ?, remark = ?, updated_at = ? WHERE member_no = ?',
      [phone, name, gender, remark, TimeUtil.nowDB(), req.params.memberNo]
    );

    operationLog.info(`更新会员: ${req.params.memberNo}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// =============== 短信配置管理 API ===============

// 获取短信配置
app.get('/api/admin/sms/config', authMiddleware, requireBackendPermission(['all']), async (req, res) => {
  try {
    // 获取当前服务商
    const configRow = await dbGet("SELECT value, updated_at FROM system_config WHERE key = 'sms_provider'");
    const currentProvider = configRow?.value || 'aliyun';

    // 获取阿里云配置信息(从项目配置)
    const aliyunInfo = {
      provider: 'aliyun',
      name: '阿里云短信',
      signName: config.aliyunSms?.signName || '未配置',
      templateCode: config.aliyunSms?.templateCode || '未配置',
      status: config.aliyunSms?.accessKeyId ? '已配置' : '未配置'
    };

    // 获取 kltx 配置信息(从凭证文件)
    let kltxInfo = {
      provider: 'kltx',
      name: 'kltx 短信',
      signName: '未配置',
      uid: '未配置',
      status: '未配置'
    };

    try {
      if (config.kltxSms) {
        // 从模板中提取签名(模板最后有【签名】)
        const template = config.kltxSms.template || '';
        const signMatch = template.match(/【(.+?)】/);
        kltxInfo.signName = signMatch ? signMatch[1] : '未配置';
        kltxInfo.uid = config.kltxSms.uid || '未配置';
        kltxInfo.status = '已配置';
      }
    } catch (e) {
      // 配置读取失败
    }

    res.json({
      currentProvider,
      updatedAt: configRow?.updated_at || null,
      providers: [aliyunInfo, kltxInfo]
    });
  } catch (err) {
    logger.error(`获取短信配置失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 切换短信服务商
app.put('/api/admin/sms/config', authMiddleware, requireBackendPermission(['all']), async (req, res) => {
  try {
    const { provider } = req.body;

    if (!['aliyun', 'kltx'].includes(provider)) {
      return res.status(400).json({ error: '无效的服务商' });
    }

    await enqueueRun(
      "INSERT OR REPLACE INTO system_config (key, value, description, updated_at) VALUES ('sms_provider', ?, '短信服务商: aliyun / kltx', ?)",
      [provider, TimeUtil.nowDB()]
    );

    operationLog.info(`短信服务商切换: ${provider}, 操作人: ${req.user.username}`);
    res.json({ success: true, message: `已切换到 ${provider === 'aliyun' ? '阿里云' : 'kltx'} 短信服务` });
  } catch (err) {
    logger.error(`切换短信服务商失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 发送测试短信
app.post('/api/admin/sms/test', authMiddleware, requireBackendPermission(['all']), async (req, res) => {
  try {
    const { phone, provider } = req.body;

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '请输入正确的手机号' });
    }

    // 使用指定的服务商或当前配置的服务商
    const smsProvider = provider || (await dbGet("SELECT value FROM system_config WHERE key = 'sms_provider'"))?.value || 'aliyun';

    // 生成测试验证码
    const code = '888888';

    let sendResult;
    if (smsProvider === 'kltx') {
      sendResult = await sendKltxSms(phone, code);
    } else {
      sendResult = await sendAliyunSms(phone, code);
    }

    operationLog.info(`测试短信发送: 手机号=${phone}, 服务商=${smsProvider}, 结果=${sendResult.success ? '成功' : '失败'}, 操作人=${req.user.username}`);

    if (sendResult.success) {
      res.json({ success: true, message: `测试短信已发送到 ${phone}(服务商: ${smsProvider})` });
    } else {
      res.status(500).json({ error: `发送失败: ${sendResult.error}` });
    }
  } catch (err) {
    logger.error(`发送测试短信失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// =============== 设备指纹黑名单管理 API ===============

// 创建黑名单表(如果不存在)
const initBlacklistTable = async () => {
  try {
    await enqueueRun(`
      CREATE TABLE IF NOT EXISTS device_blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_fingerprint TEXT NOT NULL UNIQUE,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT
      )
    `);
  } catch (err) {
    // 表已存在,忽略
  }
};
initBlacklistTable();

// 创建乐捐记录表(如果不存在)
const initLejuanRecordsTable = async () => {
    try {
        await enqueueRun(`CREATE TABLE IF NOT EXISTS lejuan_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            coach_no TEXT NOT NULL,
            employee_id TEXT NOT NULL,
            stage_name TEXT,
            scheduled_start_time TEXT NOT NULL,
            extra_hours INTEGER,
            remark TEXT,
            lejuan_status TEXT DEFAULT 'pending',
            scheduled INTEGER DEFAULT 0,
            actual_start_time TEXT,
            return_time TEXT,
            lejuan_hours INTEGER,
            proof_image_url TEXT,
            proof_image_updated_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            returned_by TEXT
        )`);
        await enqueueRun(`CREATE INDEX IF NOT EXISTS idx_lejuan_coach ON lejuan_records(coach_no)`);
        await enqueueRun(`CREATE INDEX IF NOT EXISTS idx_lejuan_status ON lejuan_records(lejuan_status)`);
        await enqueueRun(`CREATE INDEX IF NOT EXISTS idx_lejuan_scheduled ON lejuan_records(scheduled_start_time)`);
        await enqueueRun(`CREATE INDEX IF NOT EXISTS idx_lejuan_status_time ON lejuan_records(lejuan_status, scheduled_start_time)`);
        console.log('✅ lejuan_records 表初始化完成');
    } catch (err) {
        if (!err.message.includes('already exists')) {
            console.error('lejuan_records 表初始化失败:', err.message);
        }
    }
};
initLejuanRecordsTable();

// 创建计时器日志表（如果不存在）
const initTimerLogTable = async () => {
    try {
        await enqueueRun(`
            CREATE TABLE IF NOT EXISTS timer_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timer_id TEXT NOT NULL,
                timer_type TEXT NOT NULL,
                record_id TEXT,
                action TEXT NOT NULL,
                status TEXT DEFAULT 'success',
                scheduled_time TEXT,
                actual_time TEXT,
                delay_ms INTEGER,
                error TEXT,
                created_at TEXT DEFAULT (datetime('now', '+8 hours'))
            )
        `);
        console.log('✅ timer_log 表初始化完成');
    } catch (err) {
        if (!err.message.includes('already exists')) {
            console.error('timer_log 表初始化失败:', err.message);
        }
    }
};
initTimerLogTable();

// 创建下桌单缺失匹配索引
const createMissingTableOutIndex = async () => {
    try {
        await enqueueRun(`CREATE INDEX IF NOT EXISTS idx_tao_out_match ON table_action_orders(order_type, coach_no, table_no, stage_name, created_at)`);
        console.log('✅ idx_tao_out_match 索引创建完成');
    } catch (err) {
        console.error('idx_tao_out_match 索引创建失败:', err.message);
    }
};
createMissingTableOutIndex();

// 创建系统配置表(如果不存在)
const initSystemConfigTable = async () => {
  try {
    await enqueueRun(`
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 初始化默认配置
    const existing = await dbGet("SELECT value FROM system_config WHERE key = 'sms_provider'");
    if (!existing) {
      await enqueueRun("INSERT INTO system_config (key, value, description) VALUES ('sms_provider', 'aliyun', '短信服务商: aliyun / kltx')");
      logger.info('初始化短信服务商配置: aliyun');
    }
  } catch (err) {
    // 表已存在,忽略
  }
};
initSystemConfigTable();

// =============== 奖罚管理初始化 ===============
const initRewardPenaltyTable = async () => {
  try {
    await enqueueRun(`CREATE TABLE IF NOT EXISTS reward_penalties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      confirm_date TEXT NOT NULL,
      phone TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      remark TEXT,
      exec_status TEXT DEFAULT '未执行',
      exec_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await enqueueRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_rp_unique ON reward_penalties(confirm_date, type, phone)`);
    await enqueueRun(`CREATE INDEX IF NOT EXISTS idx_rp_phone ON reward_penalties(phone)`);
    await enqueueRun(`CREATE INDEX IF NOT EXISTS idx_rp_type ON reward_penalties(type)`);
    await enqueueRun(`CREATE INDEX IF NOT EXISTS idx_rp_confirm_date ON reward_penalties(confirm_date)`);
    await enqueueRun(`CREATE INDEX IF NOT EXISTS idx_rp_exec_status ON reward_penalties(exec_status)`);
    console.log('✅ reward_penalties 表初始化完成');
  } catch (err) {
    if (!err.message.includes('already exists')) {
      console.error('reward_penalties 表初始化失败:', err.message);
    }
  }
};
initRewardPenaltyTable();

const initAdminUserEmploymentStatus = async () => {
  try {
    // 先检查字段是否存在
    const tableInfo = await dbAll("PRAGMA table_info(admin_users)");
    const hasColumn = tableInfo.some(col => col.name === 'employment_status');
    if (!hasColumn) {
      await enqueueRun(`ALTER TABLE admin_users ADD COLUMN employment_status TEXT DEFAULT '在职'`);
      console.log('✅ admin_users.employment_status 字段添加完成');
    }
  } catch (err) {
    // 字段已存在或添加失败，静默忽略
  }
};
initAdminUserEmploymentStatus();

const initRewardPenaltyTypes = async () => {
  try {
    const existing = await dbGet("SELECT value FROM system_config WHERE key = 'reward_penalty_types'");
    if (!existing) {
      const defaultTypes = JSON.stringify([
        {"奖罚类型": "服务日奖", "对象": "服务员"},
        {"奖罚类型": "未约客罚金", "对象": "助教"},
        {"奖罚类型": "漏单罚金", "对象": "助教"}
      ]);
      await enqueueRun(
        "INSERT INTO system_config (key, value, description) VALUES ('reward_penalty_types', ?, '奖罚类型配置JSON')",
        [defaultTypes]
      );
      logger.info('初始化奖罚类型配置');
    }
  } catch (err) {
    console.error('奖罚类型配置初始化失败:', err.message);
  }
};
initRewardPenaltyTypes();
// =============== 奖罚管理初始化结束 ===============

// 获取黑名单列表
app.get('/api/admin/blacklist', authMiddleware, requireBackendPermission(['all']), async (req, res) => {
  try {
    const blacklist = await dbAll('SELECT * FROM device_blacklist ORDER BY created_at DESC');
    res.json(blacklist);
  } catch (err) {
    logger.error(`获取黑名单失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 添加黑名单
app.post('/api/admin/blacklist', authMiddleware, requireBackendPermission(['all']), async (req, res) => {
  try {
    const { deviceFingerprint, reason } = req.body;

    if (!deviceFingerprint) {
      return res.status(400).json({ error: '设备指纹不能为空' });
    }

    // 检查是否已存在
    const existing = await dbGet('SELECT id FROM device_blacklist WHERE device_fingerprint = ?', [deviceFingerprint]);
    if (existing) {
      return res.status(400).json({ error: '该设备已在黑名单中' });
    }

    await enqueueRun(
      'INSERT INTO device_blacklist (device_fingerprint, reason, created_by, created_at) VALUES (?, ?, ?, ?)',
      [deviceFingerprint, reason || '', req.user.username, TimeUtil.nowDB()]
    );

    operationLog.info(`添加设备黑名单: ${deviceFingerprint}, 原因: ${reason || '无'}, 操作人: ${req.user.username}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`添加黑名单失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除黑名单
app.delete('/api/admin/blacklist/:id', authMiddleware, requireBackendPermission(['all']), async (req, res) => {
  try {
    const item = await dbGet('SELECT device_fingerprint FROM device_blacklist WHERE id = ?', [req.params.id]);
    if (!item) {
      return res.status(404).json({ error: '黑名单记录不存在' });
    }

    await enqueueRun('DELETE FROM device_blacklist WHERE id = ?', [req.params.id]);
    operationLog.info(`删除设备黑名单: ${item.device_fingerprint}, 操作人: ${req.user.username}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`删除黑名单失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 首页配置管理
app.get('/api/admin/home-config', authMiddleware, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    const config = await dbGet('SELECT * FROM home_config WHERE id = 1');
    res.json({
      ...config,
      hot_products: config?.hot_products ? JSON.parse(config.hot_products) : [],
      popular_coaches: config?.popular_coaches ? JSON.parse(config.popular_coaches) : [],
      hot_vip_rooms: config?.hot_vip_rooms ? JSON.parse(config.hot_vip_rooms) : []
    });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

app.put('/api/admin/home-config', authMiddleware, requireBackendPermission(['all']), async (req, res) => {
  try {
    const { bannerImage, bannerTitle, bannerDesc, hotProducts, popularCoaches, hotVipRooms, notice } = req.body;

    // 添加hot_vip_rooms字段(如果不存在则先添加列)
    try {
      await enqueueRun(`ALTER TABLE home_config ADD COLUMN hot_vip_rooms TEXT DEFAULT ''`);
    } catch (e) { /* 列已存在 */ }

    await enqueueRun(
      `UPDATE home_config SET banner_image = ?, banner_title = ?, banner_desc = ?, hot_products = ?, popular_coaches = ?, hot_vip_rooms = ?, notice = ?, updated_at = ? WHERE id = 1`,
      [bannerImage, bannerTitle, bannerDesc, JSON.stringify(hotProducts || []), JSON.stringify(popularCoaches || []), JSON.stringify(hotVipRooms || []), notice || '', TimeUtil.nowDB()]
    );
    operationLog.info(`更新首页配置`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// =============== 助教休假日历 API ===============

/**
 * GET /api/leave-calendar/stats
 * 获取本月和下月的休假日历统计（每天预计休息人数）
 * 参数：yearMonth（可选，默认本月）
 * 返回：本月和下月每天的休息人数
 */
app.get('/api/leave-calendar/stats', authMiddleware, async (req, res) => {
  try {
    const { yearMonth } = req.query;
    const today = TimeUtil.todayStr();
    const currentYearMonth = yearMonth || today.substring(0, 7);
    
    // 计算下个月
    const [year, month] = currentYearMonth.split('-');
    const nextYear = month === '12' ? parseInt(year) + 1 : year;
    const nextMonth = month === '12' ? '01' : String(parseInt(month) + 1).padStart(2, '0');
    const nextYearMonth = `${nextYear}-${nextMonth}`;
    
    // 查询本月数据
    const currentMonthData = await getLeaveCalendarMonthStats(currentYearMonth);
    
    // 查询下月数据
    const nextMonthData = await getLeaveCalendarMonthStats(nextYearMonth);
    
    res.json({
      success: true,
      data: {
        currentMonth: {
          yearMonth: currentYearMonth,
          days: currentMonthData
        },
        nextMonth: {
          yearMonth: nextYearMonth,
          days: nextMonthData
        }
      }
    });
  } catch (error) {
    console.error('获取休假日历统计失败:', error);
    res.status(500).json({ success: false, error: '获取休假日历统计失败' });
  }
});

/**
 * GET /api/leave-calendar/day-count
 * 获取指定日期的预计休息人数
 * 参数：date（必填，如 2026-04-27）
 * 返回：当天的休息人数
 */
app.get('/api/leave-calendar/day-count', authMiddleware, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, error: '缺少日期参数' });
    }
    
    const count = await getLeaveCalendarDayCount(date);
    
    res.json({
      success: true,
      data: {
        date,
        count
      }
    });
  } catch (error) {
    console.error('获取日期休息人数失败:', error);
    res.status(500).json({ success: false, error: '获取日期休息人数失败' });
  }
});

/**
 * 辅助函数：获取指定月份每天的休息人数
 */
async function getLeaveCalendarMonthStats(yearMonth) {
  const sql = `
    SELECT 
      COALESCE(
        JSON_EXTRACT(extra_data, '$.leave_date'),
        JSON_EXTRACT(extra_data, '$.rest_date')
      ) as leave_date,
      COUNT(DISTINCT applicant_phone) as count
    FROM applications
    WHERE application_type IN ('请假申请', '休息申请')
      AND status = 1
      AND (
        JSON_EXTRACT(extra_data, '$.leave_date') LIKE ?
        OR JSON_EXTRACT(extra_data, '$.rest_date') LIKE ?
      )
    GROUP BY leave_date
  `;
  const params = [`${yearMonth}%`, `${yearMonth}%`];
  const rows = await dbAll(sql, params);
  
  // 转换为对象 { '2026-04-02': 3, '2026-04-06': 2 }
  const result = {};
  for (const row of rows) {
    if (row.leave_date) {
      result[row.leave_date] = row.count;
    }
  }
  return result;
}

/**
 * 辅助函数：获取指定日期的休息人数
 */
async function getLeaveCalendarDayCount(date) {
  const sql = `
    SELECT COUNT(DISTINCT applicant_phone) as count
    FROM applications
    WHERE application_type IN ('请假申请', '休息申请')
      AND status = 1
      AND (
        JSON_EXTRACT(extra_data, '$.leave_date') = ?
        OR JSON_EXTRACT(extra_data, '$.rest_date') = ?
      )
  `;
  const params = [date, date];
  const row = await dbGet(sql, params);
  return row ? row.count : 0;
}

// =============== 台桌管理 API ===============

// 汉字转拼音映射(扩展版)
const pinyinMap = {
  // 数字
  '零': 'ling', '一': 'yi', '二': 'er', '三': 'san', '四': 'si', '五': 'wu',
  '六': 'liu', '七': 'qi', '八': 'ba', '九': 'jiu', '十': 'shi',
  '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '0': '0',

  // 台球相关
  '普': 'pu', '台': 'tai', '空': 'kong', '闲': 'xian', '计': 'ji', '费': 'fei', '中': 'zhong',
  '包': 'bao', '厢': 'xiang', '雀': 'que', '斯': 'si', '诺': 'nuo', '克': 'ke',
  '大': 'da', '厅': 'ting', '棋': 'qi', '牌': 'pai', '虚': 'xu', '拟': 'ni',
  '乔': 'qiao', '氏': 'shi', '已': 'yi', '暂': 'zan', '停': 'ting',

  // 英文字母
  'V': 'V', 'I': 'I', 'P': 'P', 'B': 'B', 'O': 'O', 'S': 'S', 'T': 'T', 'A': 'A', 'E': 'E', 'R': 'R',

  // 常见汉字
  '号': 'hao', '金': 'jin', '银': 'yin', '铜': 'tong', '铁': 'tie',
  '东': 'dong', '西': 'xi', '南': 'nan', '北': 'bei',
  '上': 'shang', '下': 'xia', '左': 'zuo', '右': 'you',
  '新': 'xin', '旧': 'jiu', '总': 'zong', '分': 'fen',
  '高': 'gao', '低': 'di', '长': 'chang', '宽': 'kuan',
  '甲': 'jia', '乙': 'yi', '丙': 'bing', '丁': 'ding',
  'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E', 'F': 'F', 'G': 'G', 'H': 'H',
  'J': 'J', 'K': 'K', 'L': 'L', 'M': 'M', 'N': 'N', 'Q': 'Q', 'U': 'U', 'W': 'W', 'X': 'X', 'Y': 'Y', 'Z': 'Z'
};

function toPinyin(text) {
  let result = '';
  for (const char of text) {
    if (pinyinMap[char]) {
      result += pinyinMap[char];
    } else if (/[a-zA-Z0-9]/.test(char)) {
      result += char;
    } else {
      // 对于未映射的汉字,使用Unicode转拼音的简化处理
      // 这里保留原字符,或者可以添加更多映射
      result += char;
    }
  }
  return result;
}

// 二维码目录
const qrcodeDir = path.join(__dirname, '../qrcode');
if (!fs.existsSync(qrcodeDir)) {
  fs.mkdirSync(qrcodeDir, { recursive: true });
}

// 生成单个台桌二维码(直接生成PNG文件)
async function generateTableQRCode(namePinyin, tableName) {
  // 确保目录存在(部署时可能被清空)
  if (!fs.existsSync(qrcodeDir)) {
    fs.mkdirSync(qrcodeDir, { recursive: true });
  }

  const filePath = path.join(qrcodeDir, `${namePinyin}.png`);
  const url = `https://tiangong.club/?table=${encodeURIComponent(namePinyin)}`;

  // 直接生成PNG文件
  await QRCode.toFile(filePath, url, {
    type: 'png',
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' }
  });

  return filePath;
}

// 检查并生成所有缺失的二维码
app.get('/api/admin/tables/qrcode/check', authMiddleware, requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const tables = await dbAll('SELECT id, name, name_pinyin FROM tables WHERE name_pinyin IS NOT NULL');
    const generated = [];

    for (const t of tables) {
      const filePath = path.join(qrcodeDir, `${t.name_pinyin}.png`);
      if (!fs.existsSync(filePath)) {
        await generateTableQRCode(t.name_pinyin, t.name);
        generated.push(t.name);
      }
    }

    res.json({
      success: true,
      total: tables.length,
      generated: generated.length,
      generatedNames: generated
    });
  } catch (err) {
    console.error('生成二维码失败:', err);
    res.status(500).json({ error: '生成二维码失败: ' + err.message });
  }
});

// 获取台桌列表
app.get('/api/admin/tables', authMiddleware, requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const tables = await dbAll('SELECT * FROM tables ORDER BY area, name');
    res.json(tables);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 新增台桌
app.post('/api/admin/tables', authMiddleware, requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { area, name, status } = req.body;
    const namePinyin = toPinyin(name);

    await enqueueRun(
      `INSERT INTO tables (area, name, name_pinyin, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [area, name, namePinyin, status || '空闲', TimeUtil.nowDB(), TimeUtil.nowDB()]
    );
    operationLog.info(`新增台桌: ${area} - ${name} (${namePinyin})`);
    res.json({ success: true, namePinyin });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '台桌名已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新台桌
app.put('/api/admin/tables/:id', authMiddleware, requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { area, name, status } = req.body;
    const namePinyin = toPinyin(name);

    await enqueueRun(
      `UPDATE tables SET area = ?, name = ?, name_pinyin = ?, status = ?, updated_at = ? WHERE id = ?`,
      [area, name, namePinyin, status, TimeUtil.nowDB(), req.params.id]
    );
    operationLog.info(`更新台桌: ${req.params.id} -> ${name}`);
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '台桌名已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除台桌
app.delete('/api/admin/tables/:id', authMiddleware, requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    await enqueueRun('DELETE FROM tables WHERE id = ?', [req.params.id]);
    operationLog.info(`删除台桌: ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取台桌同步状态
// 获取台桌同步状态(改为查询数据库 updated_at)
app.get('/api/admin/sync-tables-status', authMiddleware, requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    // 查询最近更新的台桌
    const latestTable = await dbGet(
      `SELECT updated_at FROM tables ORDER BY updated_at DESC LIMIT 1`
    );

    if (!latestTable || !latestTable.updated_at) {
      return res.json({
        success: true,
        lastSyncTime: null,
        tablesCount: 0,
        message: '暂无同步记录'
      });
    }

    // 统计台桌数量
    const countResult = await dbGet('SELECT COUNT(*) as count FROM tables');

    // 将本地时间字符串转换为 ISO 8601 格式(带时区 +08:00)
    // SQLite datetime('now', 'localtime') 返回格式: "2026-04-11 09:20:26"
    const localTime = latestTable.updated_at;
    const isoTime = localTime.replace(' ', 'T') + '+08:00';

    res.json({
      success: true,
      lastSyncTime: isoTime,  // ISO 8601 格式(带时区)
      lastSyncTimeLocal: localTime,  // 本地时间字符串(用于显示)
      tablesCount: countResult?.count || 0,
      message: '同步成功'
    });
  } catch (err) {
    logger.error(`获取台桌同步状态失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 台桌状态同步接口(供同步脚本调用)
app.post('/api/admin/sync/tables', authMiddleware, requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  const startTime = Date.now();
  try {
    const { tables } = req.body;

    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      return res.status(400).json({ error: '缺少台桌数据或数据格式错误' });
    }

    logger.info(`开始台桌状态同步,共 ${tables.length} 条数据`);

    // 状态转换函数(与脚本逻辑完全一致)
    const convertStatus = (status) => {
      if (status === '空闲') return '空闲';
      if (status === '已暂停') return '已暂停';
      return '接待中';
    };

    // 事务包裹: 所有更新在一个 BEGIN/COMMIT 内执行
    const result = await runInTransaction(async (tx) => {
      let tablesUpdated = 0;
      let vipRoomsUpdated = 0;

      // 更新 tables 表
      for (const table of tables) {
        const dbStatus = convertStatus(table.status);
        const r = await tx.run(
          `UPDATE tables SET status = ?, updated_at = ? WHERE name = ?`,
          [dbStatus, TimeUtil.nowDB(), table.name]
        );
        if (r.changes > 0) tablesUpdated++;
      }

      // 更新 vip_rooms 表(name 匹配台桌名前缀,与脚本逻辑一致)
      for (const table of tables) {
        const dbStatus = convertStatus(table.status);
        const r = await tx.run(
          `UPDATE vip_rooms SET status = ?, updated_at = ? WHERE name LIKE ? || '%'`,
          [dbStatus, TimeUtil.nowDB(), table.name]
        );
        if (r.changes > 0) vipRoomsUpdated += r.changes;
      }

      return { tablesUpdated, vipRoomsUpdated };
    });

    const elapsed = Date.now() - startTime;
    logger.info(`台桌同步完成: tables更新 ${result.tablesUpdated} 条, vip_rooms更新 ${result.vipRoomsUpdated} 条, 耗时 ${elapsed}ms`);

    // 触发自动关灯（当更新>=40条台桌数据时）
    const autoOffResult = await triggerAutoOffIfEligible(result.tablesUpdated, result.vipRoomsUpdated);
    if (autoOffResult.triggered) {
      logger.info(`[自动关灯触发] ${JSON.stringify(autoOffResult)}`);
    }

    // 触发自动关空调（当更新>=40条台桌数据时）
    const autoOffACResult = await triggerAutoOffACIfEligible(result.tablesUpdated, result.vipRoomsUpdated);
    if (autoOffACResult.triggered) {
      logger.info(`[自动关空调触发] ${JSON.stringify(autoOffACResult)}`);
    }

    res.json({
      success: true,
      data: {
        tablesUpdated: result.tablesUpdated,
        vipRoomsUpdated: result.vipRoomsUpdated,
        tablesCount: tables.length,
        elapsedMs: elapsed
      }
    });
  } catch (err) {
    const elapsed = Date.now() - startTime;
    logger.error(`台桌同步失败: ${err.message}, 耗时 ${elapsed}ms`);
    res.status(500).json({ error: '服务器错误', elapsedMs: elapsed });
  }
});

// =============== 包房管理 API ===============

// 获取包房列表(前台)
app.get('/api/vip-rooms', async (req, res) => {
  try {
    let rooms = await dbAll('SELECT id, name, status, intro, photos, videos FROM vip_rooms ORDER BY id');
    rooms = rooms.map(r => ({
      ...r,
      photos: r.photos ? JSON.parse(r.photos) : [],
      videos: r.videos ? JSON.parse(r.videos) : []
    }));
    res.json(rooms);
  } catch (err) {
    logger.error(`获取包房列表失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取包房详情(前台)
app.get('/api/vip-rooms/:id', async (req, res) => {
  try {
    const room = await dbGet('SELECT * FROM vip_rooms WHERE id = ?', [req.params.id]);
    if (!room) {
      return res.status(404).json({ error: '包房不存在' });
    }
    res.json({
      ...room,
      photos: room.photos ? JSON.parse(room.photos) : [],
      videos: room.videos ? JSON.parse(room.videos) : []
    });
  } catch (err) {
    logger.error(`获取包房详情失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取包房列表(后台)
app.get('/api/admin/vip-rooms', authMiddleware, requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    let rooms = await dbAll('SELECT * FROM vip_rooms ORDER BY id');
    rooms = rooms.map(r => ({
      ...r,
      photos: r.photos ? JSON.parse(r.photos) : [],
      videos: r.videos ? JSON.parse(r.videos) : []
    }));
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 新增包房
app.post('/api/admin/vip-rooms', authMiddleware, requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { name, status, intro, photos, videos } = req.body;

    const result = await enqueueRun(
      `INSERT INTO vip_rooms (name, status, intro, photos, videos, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, status || '空闲', intro || '', JSON.stringify(photos || []), JSON.stringify(videos || []), TimeUtil.nowDB(), TimeUtil.nowDB()]
    );
    operationLog.info(`新增包房: ${name} (ID: ${result.lastID})`);
    res.json({ success: true, id: result.lastID });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '包房名已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新包房
app.put('/api/admin/vip-rooms/:id', authMiddleware, requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { name, status, intro, photos, videos } = req.body;

    await enqueueRun(
      `UPDATE vip_rooms SET name = ?, status = ?, intro = ?, photos = ?, videos = ?, updated_at = ? WHERE id = ?`,
      [name, status, intro, JSON.stringify(photos || []), JSON.stringify(videos || []), TimeUtil.nowDB(), req.params.id]
    );
    operationLog.info(`更新包房: ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '包房名已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除包房
app.delete('/api/admin/vip-rooms/:id', authMiddleware, requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    // 获取包房信息以便删除OSS文件
    const room = await dbGet('SELECT photos, videos FROM vip_rooms WHERE id = ?', [req.params.id]);

    if (room) {
      // 删除OSS上的照片和视频
      const ossConfig = config.oss;
      if (ossConfig && ossConfig.accessKeyId) {
        const client = new OSS({
          region: ossConfig.region,
          bucket: ossConfig.bucket,
          accessKeyId: ossConfig.accessKeyId,
          accessKeySecret: ossConfig.accessKeySecret,
          secure: true
        });

        // 删除照片
        const photos = room.photos ? JSON.parse(room.photos) : [];
        for (const url of photos) {
          if (url && url.includes(ossConfig.bucket)) {
            try {
              const objectKey = url.split('.com/')[1];
              if (objectKey) await client.delete(objectKey);
            } catch (e) { /* ignore */ }
          }
        }

        // 删除视频
        const videos = room.videos ? JSON.parse(room.videos) : [];
        for (const url of videos) {
          if (url && url.includes(ossConfig.bucket)) {
            try {
              const objectKey = url.split('.com/')[1];
              if (objectKey) await client.delete(objectKey);
            } catch (e) { /* ignore */ }
          }
        }
      }
    }

    await enqueueRun('DELETE FROM vip_rooms WHERE id = ?', [req.params.id]);
    operationLog.info(`删除包房: ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除包房的单张照片
app.delete('/api/admin/vip-rooms/:id/photo', authMiddleware, requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { photoUrl } = req.body;
    const room = await dbGet('SELECT photos FROM vip_rooms WHERE id = ?', [req.params.id]);

    if (!room) {
      return res.status(404).json({ error: '包房不存在' });
    }

    let photos = room.photos ? JSON.parse(room.photos) : [];
    photos = photos.filter(p => p !== photoUrl);

    // 删除OSS文件
    if (photoUrl && photoUrl.includes(config.oss?.bucket || '')) {
      const client = new OSS({
        region: config.oss.region,
        bucket: config.oss.bucket,
        accessKeyId: config.oss.accessKeyId,
        accessKeySecret: config.oss.accessKeySecret,
        secure: true
      });
      const objectKey = photoUrl.split('.com/')[1];
      if (objectKey) await client.delete(objectKey);
    }

    await enqueueRun('UPDATE vip_rooms SET photos = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(photos), TimeUtil.nowDB(), req.params.id]);

    res.json({ success: true, photos });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除包房的单个视频
app.delete('/api/admin/vip-rooms/:id/video', authMiddleware, requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { videoUrl } = req.body;
    const room = await dbGet('SELECT videos FROM vip_rooms WHERE id = ?', [req.params.id]);

    if (!room) {
      return res.status(404).json({ error: '包房不存在' });
    }

    let videos = room.videos ? JSON.parse(room.videos) : [];
    videos = videos.filter(v => v !== videoUrl);

    // 删除OSS文件
    if (videoUrl && videoUrl.includes(config.oss?.bucket || '')) {
      const client = new OSS({
        region: config.oss.region,
        bucket: config.oss.bucket,
        accessKeyId: config.oss.accessKeyId,
        accessKeySecret: config.oss.accessKeySecret,
        secure: true
      });
      const objectKey = videoUrl.split('.com/')[1];
      if (objectKey) await client.delete(objectKey);
    }

    await enqueueRun('UPDATE vip_rooms SET videos = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(videos), TimeUtil.nowDB(), req.params.id]);

    res.json({ success: true, videos });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 设置包房头像(将照片置顶)
app.put('/api/admin/vip-rooms/:id/avatar', authMiddleware, requireBackendPermission(['vipRoomManagement']), async (req, res) => {
  try {
    const { photoIndex } = req.body;
    const room = await dbGet('SELECT photos FROM vip_rooms WHERE id = ?', [req.params.id]);

    if (!room) {
      return res.status(404).json({ error: '包房不存在' });
    }

    let photos = room.photos ? JSON.parse(room.photos) : [];
    if (photoIndex < 0 || photoIndex >= photos.length) {
      return res.status(400).json({ error: '照片索引无效' });
    }

    const targetPhoto = photos.splice(photoIndex, 1)[0];
    photos.unshift(targetPhoto);

    await enqueueRun('UPDATE vip_rooms SET photos = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(photos), TimeUtil.nowDB(), req.params.id]);

    operationLog.info(`设置包房头像: ${req.params.id}, 照片索引: ${photoIndex}`);
    res.json({ success: true, photos });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 文件上传
const multer = require('multer');

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../images');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../videos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});

const uploadImage = multer({ storage: imageStorage, limits: { fileSize: config.upload.maxImageSize } });
const uploadVideo = multer({ storage: videoStorage, limits: { fileSize: config.upload.maxVideoSize } });

app.post('/api/upload/image', uploadImage.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有上传文件' });
  }
  res.json({
    success: true,
    url: `/images/${req.file.filename}`
  });
});

app.post('/api/upload/video', uploadVideo.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有上传文件' });
  }
  res.json({
    success: true,
    url: `/videos/${req.file.filename}`
  });
});

// =============== OSS 直传相关 API ===============

/**
 * 获取OSS STS临时凭证
 * 前端使用此凭证直接上传文件到OSS
 */
app.get('/api/oss/sts', async (req, res) => {
  try {
    const ossConfig = config.oss;

    if (!ossConfig || !ossConfig.accessKeyId || ossConfig.accessKeyId === 'YOUR_ACCESS_KEY_ID') {
      return res.status(500).json({ error: 'OSS未配置,请联系管理员' });
    }

    // 创建OSS客户端
    const client = new OSS({
      region: ossConfig.region,
      bucket: ossConfig.bucket,
      accessKeyId: ossConfig.accessKeyId,
      accessKeySecret: ossConfig.accessKeySecret,
      secure: true
    });

    // 生成临时凭证(如果配置了STS角色)
    if (ossConfig.stsRoleArn) {
      const STS = require('@alicloud/sts-sdk');
      const stsClient = new STS({
        accessKeyId: ossConfig.accessKeyId,
        accessKeySecret: ossConfig.accessKeySecret
      });

      const result = await stsClient.assumeRole(
        ossConfig.stsRoleArn,
        JSON.stringify({
          Version: '1',
          Statement: [
            {
              Action: ['oss:PutObject'],
              Effect: 'Allow',
              Resource: [`acs:oss:*:*:${ossConfig.bucket}/${ossConfig.uploadDir}*`]
            }
          ]
        }),
        ossConfig.stsExpiry || 3600,
        'tg-upload-session'
      );

      res.json({
        success: true,
        credentials: {
          accessKeyId: result.Credentials.AccessKeyId,
          accessKeySecret: result.Credentials.AccessKeySecret,
          securityToken: result.Credentials.SecurityToken,
          expiration: result.Credentials.Expiration
        },
        region: ossConfig.region,
        bucket: ossConfig.bucket,
        uploadDir: ossConfig.uploadDir
      });
    } else {
      // 简化模式:直接返回签名URL(适合小规模使用)
      const fileType = req.query.type || 'image';
      const ext = req.query.ext || (fileType === 'video' ? 'mp4' : 'jpg');
      const dir = req.query.dir || ossConfig.uploadDir; // 默认 coaches/
      const timestamp = Date.now();
      const randomStr = crypto.randomBytes(4).toString('hex');
      const objectKey = `${dir}${timestamp}_${randomStr}.${ext}`;

      // 生成签名URL
      const signedUrl = client.signatureUrl(objectKey, {
        method: 'PUT',
        expires: 3600,
        'Content-Type': fileType === 'video' ? 'video/mp4' : 'image/jpeg'
      });

      // 构建最终的访问URL
      const accessUrl = `https://${ossConfig.bucket}.${ossConfig.endpoint}/${objectKey}`;

      res.json({
        success: true,
        signedUrl,
        objectKey,
        accessUrl,
        expires: 3600
      });
    }
  } catch (err) {
    logger.error(`获取OSS凭证失败: ${err.message}`);
    res.status(500).json({ error: '获取上传凭证失败' });
  }
});

/**
 * 后端代理上传到OSS(解决CORS问题)
 * 前端上传文件到此API,后端再上传到OSS
 * 使用分片上传支持大文件(>10MB)
 */
const uploadToOSS = multer({
  storage: multer.diskStorage({
    destination: '/tmp/uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
  }),
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.post('/api/oss/upload', uploadToOSS.single('file'), async (req, res) => {
  const tempFilePath = req.file?.path;
  const maxRetries = 3; // 最大重试次数

  try {
    const ossConfig = config.oss;

    if (!ossConfig || !ossConfig.accessKeyId) {
      if (tempFilePath) fs.unlinkSync(tempFilePath);
      return res.status(500).json({ error: 'OSS未配置' });
    }

    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    const fileType = req.body.type || 'image';
    const ext = req.file.originalname.split('.').pop() || (fileType === 'video' ? 'mp4' : 'jpg');
    const timestamp = Date.now();
    const randomStr = crypto.randomBytes(4).toString('hex');
    const objectKey = `${ossConfig.uploadDir}${timestamp}_${randomStr}.${ext}`;

    logger.info(`开始分片上传: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)}MB)`);

    // 创建OSS客户端 - 添加更完整的配置
    const client = new OSS({
      region: ossConfig.region,
      bucket: ossConfig.bucket,
      accessKeyId: ossConfig.accessKeyId,
      accessKeySecret: ossConfig.accessKeySecret,
      secure: true,
      timeout: 600000, // 10分钟超时
      requestOptions: {
        timeout: 600000, // HTTP 请求超时
        agent: new (require('https').Agent)({
          keepAlive: true,
          keepAliveMsecs: 30000, // 30秒发送一次 keep-alive
          maxSockets: 10,
          maxFreeSockets: 5
        })
      }
    });

    // 分片上传 - 带重试机制
    let lastError = null;
    let result = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 每次重试创建新的 OSS 客户端,避免连接复用问题
        const retryClient = new OSS({
          region: ossConfig.region,
          bucket: ossConfig.bucket,
          accessKeyId: ossConfig.accessKeyId,
          accessKeySecret: ossConfig.accessKeySecret,
          secure: true,
          timeout: 600000,
          requestOptions: {
            timeout: 600000,
            agent: new (require('https').Agent)({
              keepAlive: true,
              keepAliveMsecs: 30000,
              maxSockets: 10,
              maxFreeSockets: 5
            })
          }
        });

        result = await retryClient.multipartUpload(objectKey, tempFilePath, {
          partSize: 512 * 1024, // 512KB 每片,更小的分片更稳定
          parallel: 2, // 减少并发数到2,避免连接问题
          progress: (p) => {
            const percent = Math.round(p * 100);
            logger.info(`上传进度: ${percent}% (${req.file.originalname})${attempt > 1 ? ` [重试${attempt}]` : ''}`);
          },
          headers: {
            'Content-Type': fileType === 'video' ? 'video/mp4' : 'image/jpeg'
          }
        });

        // 上传成功,跳出重试循环
        logger.info(`分片上传完成: ${req.file.originalname} -> ${objectKey}`);
        break;
      } catch (retryErr) {
        lastError = retryErr;
        logger.warn(`上传尝试 ${attempt}/${maxRetries} 失败: ${retryErr.message}`);

        // 如果是 socket hang up 或超时错误,等待后重试
        if (attempt < maxRetries && (
          retryErr.message.includes('socket hang up') ||
          retryErr.message.includes('timeout') ||
          retryErr.message.includes('ECONNRESET') ||
          retryErr.code === 'ETIMEDOUT'
        )) {
          const waitTime = attempt * 3000; // 递增等待时间
          logger.info(`等待 ${waitTime/1000}s 后重试...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          // 非网络错误或已达最大重试次数,抛出异常
          throw retryErr;
        }
      }
    }

    if (!result) {
      throw lastError || new Error('上传失败');
    }

    // 删除临时文件
    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        logger.warn(`删除临时文件失败: ${tempFilePath}`);
      }
    }

    // 返回访问URL
    const accessUrl = `https://${ossConfig.bucket}.${ossConfig.endpoint}/${objectKey}`;

    res.json({
      success: true,
      url: accessUrl,
      objectKey
    });
  } catch (err) {
    logger.error(`OSS上传失败: ${err.message}`);
    // 删除临时文件
    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        // 忽略删除失败
      }
    }
    res.status(500).json({ error: '上传失败: ' + err.message });
  }
});

/**
 * 接收上传错误日志
 */
app.post('/api/upload-error', async (req, res) => {
  try {
    const errorInfo = req.body;
    logger.error(`上传失败详情: ${JSON.stringify(errorInfo, null, 2)}`);
    res.json({ success: true, message: '错误已记录' });
  } catch (err) {
    res.status(500).json({ error: '记录失败' });
  }
});

/**
 * 助教设置头像(将指定照片置顶)
 */
app.put('/api/coach/avatar', async (req, res) => {
  try {
    const { coachNo, photoIndex } = req.body;

    if (coachNo === undefined || photoIndex === undefined) {
      return res.status(400).json({ error: '缺少参数' });
    }

    // 获取当前照片列表
    const coach = await dbGet('SELECT photos FROM coaches WHERE coach_no = ?', [coachNo]);
    if (!coach) {
      return res.status(404).json({ error: '助教不存在' });
    }

    let photos = coach.photos ? JSON.parse(coach.photos) : [];
    if (photoIndex < 0 || photoIndex >= photos.length) {
      return res.status(400).json({ error: '照片索引无效' });
    }

    // 将指定照片移到第一位
    const targetPhoto = photos.splice(photoIndex, 1)[0];
    photos.unshift(targetPhoto);

    // 更新数据库
    await enqueueRun('UPDATE coaches SET photos = ?, updated_at = ? WHERE coach_no = ?',
      [JSON.stringify(photos), TimeUtil.nowDB(), coachNo]);

    operationLog.info(`助教设置头像: ${coachNo}, 照片索引: ${photoIndex}`);
    res.json({ success: true, photos });
  } catch (err) {
    logger.error(`设置头像失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// === 设备访问统计 ===
// 缓存变量
let deviceStatsCache = {
  today: { count: 0, date: '', timestamp: 0 },      // 当天设备数,缓存10分钟
  week: { count: 0, weekStart: '', timestamp: 0 },  // 本周设备数,缓存2小时
  weeks12: { data: [], timestamp: 0 }               // 近12周数据,缓存1天
};

// 获取设备统计数据
app.get('/api/admin/device-stats', async (req, res) => {
  try {
    const now = Date.now();
    const today = TimeUtil.todayStr(); // 北京时间

    // 计算本周开始日期(周一) - 北京时间
    const getWeekStart = () => {
      const d = new Date(); // 服务器本地即北京时间
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const weekStart = getWeekStart();

    // 当天设备数(缓存10分钟)
    if (deviceStatsCache.today.date !== today || now - deviceStatsCache.today.timestamp > 10 * 60 * 1000) {
      const result = await dbGet("SELECT COUNT(DISTINCT device_fp) as count FROM device_visits WHERE visit_date = ?", [today]);
      deviceStatsCache.today = { count: result.count, date: today, timestamp: now };
    }

    // 本周设备数(缓存2小时)
    if (deviceStatsCache.week.weekStart !== weekStart || now - deviceStatsCache.week.timestamp > 2 * 60 * 60 * 1000) {
      const result = await dbGet(
        "SELECT COUNT(DISTINCT device_fp) as count FROM device_visits WHERE visit_date >= ?",
        [weekStart]
      );
      deviceStatsCache.week = { count: result.count, weekStart, timestamp: now };
    }

    // 近12周数据(按自然周,周一~周日,缓存1天)
    if (now - deviceStatsCache.weeks12.timestamp > 24 * 60 * 60 * 1000) {
      const weeksData = [];
      // 从当前北京日期计算本周日
      const todayStr = TimeUtil.todayStr();
      const today = new Date(todayStr);
      const dayOfWeek = today.getDay(); // 0=周日, 1=周一, ..., 6=周六
      const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      const thisSunday = new Date(today);
      thisSunday.setDate(today.getDate() + daysToSunday);

      const toDBDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      for (let i = 0; i < 12; i++) {
        const weekEndDate = new Date(thisSunday);
        weekEndDate.setDate(weekEndDate.getDate() - i * 7);
        const weekEndStr = toDBDate(weekEndDate);
        const weekStartDate = new Date(weekEndDate);
        weekStartDate.setDate(weekStartDate.getDate() - 6); // 周一 = 周日往前6天
        const weekStartStr = toDBDate(weekStartDate);

        const result = await dbGet(
          "SELECT COUNT(DISTINCT device_fp) as count FROM device_visits WHERE visit_date >= ? AND visit_date <= ?",
          [weekStartStr, weekEndStr]
        );
        weeksData.unshift({
          week: `第${12 - i}周`,
          startDate: weekStartStr,
          endDate: weekEndStr,
          count: result.count
        });
      }
      deviceStatsCache.weeks12 = { data: weeksData, timestamp: now };
    }

    res.json({
      today: deviceStatsCache.today.count,
      week: deviceStatsCache.week.count,
      weeks12: deviceStatsCache.weeks12.data
    });
  } catch (err) {
    logger.error(`获取设备统计失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 清理90天前的数据(每天凌晨3点执行)
const cleanOldDeviceVisits = async () => {
  try {
    const ninetyDaysAgo = TimeUtil.offsetDB(-24 * 90).split(' ')[0];
    const result = await enqueueRun(
      "DELETE FROM device_visits WHERE visit_date < ?",
      [ninetyDaysAgo]
    );
    if (result.changes > 0) {
      logger.info(`清理90天前的设备访问记录: ${result.changes} 条`);
    }
  } catch (err) {
    logger.error(`清理设备访问记录失败: ${err.message}`);
  }
};
// 每天凌晨3点执行
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 3 && now.getMinutes() === 0) {
    cleanOldDeviceVisits();
  }
}, 60000);

// =============== 协议 API ===============

// 用户协议
app.get('/api/agreement/user', (req, res) => {
  res.json({
    title: '天宫国际用户服务协议',
    content: `一、总则

1.1 欢迎您使用天宫国际台球城小程序服务。为使用天宫国际台球城小程序服务(以下简称"本服务"),您应当阅读并遵守《天宫国际用户服务协议》(以下简称"本协议")。请您务必审慎阅读、充分理解各条款内容,特别是免除或限制责任的相应条款。

1.2 除非您已阅读并接受本协议所有条款,否则您无权使用本服务。您使用本服务即视为您已阅读并同意上述协议的约束。

二、服务内容

2.1 本服务为您提供天宫国际台球城的在线点单、助教预约、包房预订等功能。

2.2 您理解并同意,本服务仅提供线上点单及预约服务,具体服务内容由中山市开火体育文化有限公司(以下简称"本公司")线下门店提供。

三、用户注册

3.1 您在使用本服务时需要注册一个账号。账号应当使用手机号码绑定注册,请您使用尚未与天宫国际账号绑定的手机号码进行注册。

3.2 您理解并承诺,您所设置的账号不得违反国家法律法规及平台规则,您的账号名称、头像和简介等注册信息中不得出现违法或不良信息。

四、用户信息保护

4.1 保护用户个人信息是本公司的一项基本原则。本公司将按照本协议及《隐私政策》的规定收集、使用、储存和分享您的个人信息。

4.2 本服务不会向任何第三方出售您的个人信息。

五、用户行为规范

5.1 您不得利用本服务制作、复制、发布、传播如下干扰天宫国际正常运营,以及侵犯其他用户或第三方合法权益的内容:
(1)反对宪法所确定的基本原则的;
(2)危害国家安全,泄露国家秘密,颠覆国家政权,破坏国家统一的;
(3)损害国家荣誉和利益的;
(4)煽动民族仇恨、民族歧视,破坏民族团结的;
(5)破坏国家宗教政策,宣扬邪教和封建迷信的;
(6)散布谣言,扰乱社会秩序,破坏社会稳定的;
(7)散布淫秽、色情、赌博、暴力、凶杀、恐怖或者教唆犯罪的;
(8)侮辱或者诽谤他人,侵害他人合法权益的;
(9)含有法律、行政法规禁止的其他内容的。

六、服务变更、中断或终止

6.1 鉴于网络服务的特殊性,您同意本公司有权随时变更、中断或终止部分或全部的服务。

6.2 如发生下列任何一种情形,本公司有权不经通知而中断或终止向您提供的服务:
(1)您提供的个人资料不真实;
(2)您违反本协议中规定的使用规则;
(3)您存在侵犯他人合法权益的行为。

七、免责声明

7.1 您使用本服务存在的风险将完全由您自己承担。

7.2 本公司不保证服务一定能满足您的要求,也不保证服务不会中断,对服务的及时性、安全性、准确性也都不作保证。

八、其他

8.1 本协议的订立、执行和解释及争议的解决均应适用中华人民共和国法律。

8.2 如双方就本协议内容或其执行发生任何争议,双方应尽量友好协商解决;协商不成时,任何一方均可向本公司所在地人民法院提起诉讼。

8.3 本公司有权根据需要不时修改本协议,并在天宫国际台球城小程序公布,不再单独通知您。若您在本协议内容公告变更后继续使用本服务的,视为您已充分理解并同意接受修改后的协议内容。

公司名称:中山市开火体育文化有限公司
备案号:备案中`
  });
});

// 隐私协议
app.get('/api/agreement/privacy', (req, res) => {
  res.json({
    title: '天宫国际隐私政策',
    content: `引言

天宫国际台球城小程序(以下简称"本小程序")非常重视用户的隐私和个人信息保护。本隐私政策将向您说明我们如何收集、使用、储存和保护您的个人信息,以及您享有的相关权利。请您在使用本小程序前仔细阅读本隐私政策。

一、我们如何收集您的个人信息

1.1 账号注册与登录
当您注册成为会员时,我们会收集您的手机号码用于账号注册和登录验证。手机号码是您使用本小程序服务的必要信息。

1.2 服务使用
当您使用本小程序的点单服务时,我们会收集以下信息:
- 您的台桌信息(用于送餐服务)
- 您的订单信息(商品名称、数量、金额等)
- 设备信息(用于防刷榜和设备统计)

1.3 微信授权
当您使用微信一键登录时,我们会通过微信提供的接口获取您的微信OpenID和手机号,用于账号识别和注册。

二、我们如何使用您的个人信息

2.1 我们会将您的个人信息用于以下用途:
- 为您提供点单、预约等核心服务
- 处理您的订单和支付
- 发送服务通知和订单状态更新
- 改进我们的产品和服务
- 保障服务的安全稳定运行

2.2 我们不会将您的个人信息用于以下用途,除非获得您的明确同意:
- 向第三方出售您的个人信息
- 向您推送商业广告
- 其他未经您同意的用途

三、我们如何储存和保护您的个人信息

3.1 数据储存
您的个人信息储存于中国境内的服务器,我们采用业界标准的安全技术和管理措施保护您的个人信息。

3.2 安全保护措施
- 数据加密传输(HTTPS)
- 敏感信息加密存储
- 严格的数据访问权限控制
- 定期安全审计和漏洞修复

3.3 数据保存期限
- 会员信息:您注销账号前一直保存
- 订单信息:保存3年用于售后和财务核对
- 设备访问记录:保存90天用于统计分析

四、您享有的权利

4.1 访问权
您有权访问我们在您使用本小程序过程中收集的个人信息,包括账号信息、订单记录等。

4.2 更正权
您有权要求我们更正不准确的个人信息。

4.3 删除权
在以下情形下,您有权要求我们删除您的个人信息:
- 处理目的已实现、无法实现或者为实现处理目的不再必要
- 我们停止提供产品或者服务,或者保存期限已届满
- 您撤回同意

4.4 注销账号
您可以联系我们注销您的会员账号。账号注销后,我们将停止为您提供服务,并根据法律规定删除或匿名化处理您的个人信息。

五、未成年人保护

我们非常重视对未成年人个人信息的保护。若您是18周岁以下的未成年人,在使用本小程序服务前,应事先取得您家长或法定监护人的同意。

六、本政策的更新

我们可能会适时对本隐私政策进行修订。未经您明确同意,我们不会削减您依据本隐私政策所享有的权利。我们会在本页面上发布对本政策所做的任何变更。

七、联系我们

如果您对本隐私政策有任何疑问、意见或建议,可通过以下方式与我们联系:

公司名称:中山市开火体育文化有限公司
备案号:备案中

我们将在15个工作日内回复您的请求。`
  });
});

// 摄像头错误日志上报
app.post('/api/log/camera-error', (req, res) => {
  try {
    const {
      errorName,
      errorMessage,
      errorStack,
      userAgent,
      platform,
      url,
      timestamp
    } = req.body;

    // 构建日志记录
    const logEntry = {
      time: TimeUtil.nowDB(),
      ip: req.ip,
      errorName,
      errorMessage,
      errorStack,
      userAgent,
      platform,
      url,
      clientTimestamp: timestamp
    };

    // 写入专门的摄像头错误日志文件
    const cameraErrorLogPath = path.join(__dirname, '../logs/camera-error.log');
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(cameraErrorLogPath, logLine);

    // 同时输出到控制台
    logger.error(`摄像头启动失败: ${errorName} - ${errorMessage} [${platform}]`);

    res.json({ success: true, message: '日志已记录' });
  } catch (err) {
    logger.error(`记录摄像头错误日志失败: ${err.message}`);
    res.status(500).json({ error: '记录失败' });
  }
});

// 发声失败日志 API
app.post('/api/admin/sound-failure-log', authMiddleware, requireBackendPermission(['cashierDashboard']), async (req, res) => {
  try {
    const { reason, timestamp, pendingOrders } = req.body;
    const user = req.user.username;

    const logEntry = {
      timestamp: timestamp || TimeUtil.nowDB(),
      user,
      reason,
      pendingOrders
    };

    // 写入专门的发声失败日志文件
    const soundFailureLogPath = path.join(__dirname, '../logs/sound-failure.log');
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(soundFailureLogPath, logLine);

    // 同时输出到控制台
    logger.warn(`发声失败: ${reason} | 用户: ${user} | 待处理: 商品${pendingOrders?.product || 0} 服务${pendingOrders?.service || 0} 上下桌${pendingOrders?.coach || 0}`);

    res.json({ success: true, message: '日志已记录' });
  } catch (err) {
    logger.error(`记录发声失败日志失败: ${err.message}`);
    res.status(500).json({ error: '记录失败' });
  }
});

// 前端错误日志 API（支持自动收集 + 业务追踪）
// 注意：移除权限限制，因为前端错误上报无需权限
app.post('/api/admin/frontend-error-log', authMiddleware, async (req, res) => {
  try {
    const { type, action, message, stack, route, url, userAgent, user, timestamp, ...rest } = req.body;

    // 构造日志条目（简化格式）
    const logEntry = {
      timestamp: timestamp || TimeUtil.nowDB(),
      type: type || 'business_track',
      action: action || '',
      message: (message || '').substring(0, 500),  // 限制长度
      stack: (stack || '').substring(0, 1000),      // 限制长度
      route: route || '',
      url: (url || '').substring(0, 200),
      user: user?.type + ':' + (user?.username || user?.coachNo || 'unknown'),
      userAgent: (userAgent || '').substring(0, 100),
      ...rest
    };

    // 写入前端错误日志文件（挂载目录）
    const frontendErrorLogPath = path.join(__dirname, '../logs/frontend-error.log');
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(frontendErrorLogPath, logLine);

    // 检查并清理过期日志（3天）
    cleanFrontendErrorLog(frontendErrorLogPath);

    // 输出到控制台
    logger.info(`📋 前端日志: ${logEntry.type} | ${logEntry.action || logEntry.message?.substring(0, 50)} | ${logEntry.user}`);

    res.json({ success: true, message: '日志已记录' });
  } catch (err) {
    logger.error(`记录前端错误日志失败: ${err.message}`);
    res.status(500).json({ error: '记录失败' });
  }
});

// 日志清理函数（保留3天）
function cleanFrontendErrorLog(logPath) {
  try {
    if (!fs.existsSync(logPath)) return;

    const stats = fs.statSync(logPath);
    const fileAgeDays = (Date.now() - stats.mtimeMs) / (24 * 60 * 60 * 1000);

    // 超过3天，清空文件
    if (fileAgeDays > 3) {
      fs.writeFileSync(logPath, '');
      logger.info('前端错误日志已清空（超过3天）');
    }

    // 文件超过10MB，截断保留最新部分
    if (stats.size > 10 * 1024 * 1024) {
      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      const keepLines = lines.slice(-5000);  // 保留最新5000条
      fs.writeFileSync(logPath, keepLines.join('\n') + '\n');
      logger.info(`前端错误日志已截断（从${lines.length}条保留${keepLines.length}条）`);
    }
  } catch (e) {
    logger.error('清理前端错误日志失败:', e.message);
  }
}

// 前端页面路由
app.get('/', (req, res) => {
  res.redirect('/frontend/index.html');
});

// =============== 奖罚管理 API ===============

// 获取奖罚类型配置
app.get('/api/admin/reward-penalty/types', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const config = await dbGet("SELECT value FROM system_config WHERE key = 'reward_penalty_types'");
    let types = [];
    if (config && config.value) {
      try {
        types = JSON.parse(config.value);
      } catch (e) {
        types = [];
      }
    }
    res.json({ success: true, types });
  } catch (err) {
    logger.error(`获取奖罚类型失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新奖罚类型配置
app.put('/api/admin/reward-penalty/types', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { types } = req.body;
    if (!Array.isArray(types)) {
      return res.status(400).json({ error: 'types必须是数组' });
    }
    await enqueueRun(
      "INSERT INTO system_config (key, value, description, updated_at) VALUES ('reward_penalty_types', ?, '奖罚类型配置JSON', ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?",
      [JSON.stringify(types), TimeUtil.nowDB(), JSON.stringify(types), TimeUtil.nowDB()]
    );
    res.json({ success: true });
  } catch (err) {
    logger.error(`更新奖罚类型失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 写入/更新奖罚记录（upsert）
app.post('/api/reward-penalty/upsert', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    // Bug #3 修复：检查 body 是否为合法 JSON 对象
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: '请求体必须是有效的JSON对象' });
    }

    const { type, confirmDate, phone, name, amount, remark } = req.body;
    if (!type || !confirmDate || !phone || name === undefined || amount === undefined) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // Bug #4 修复：验证 type 是否在系统配置的奖罚类型中
    const config = await dbGet("SELECT value FROM system_config WHERE key = 'reward_penalty_types'");
    if (config && config.value) {
      try {
        const validTypes = JSON.parse(config.value);
        if (Array.isArray(validTypes) && validTypes.length > 0) {
          const typeNames = validTypes.map(t => typeof t === 'string' ? t : (t['奖罚类型'] || t.name || t.label || ''));
          if (!typeNames.includes(type)) {
            return res.status(400).json({ error: `无效的奖罚类型: ${type}，有效类型: ${typeNames.join(', ')}` });
          }
        }
      } catch (e) {
        // 配置解析失败，跳过验证
      }
    }

    // Bug #5 修复：验证日期格式
    const dateRegex = /^\d{4}-\d{2}(-\d{2})?$/;
    if (!dateRegex.test(confirmDate)) {
      return res.status(400).json({ error: 'confirmDate格式错误，请使用 YYYY-MM-DD 或 YYYY-MM 格式' });
    }

    // amount === 0 → 删除
    if (amount === 0) {
      const result = await enqueueRun(
        'DELETE FROM reward_penalties WHERE confirm_date = ? AND type = ? AND phone = ? AND remark = ?',
        [confirmDate, type, phone, remark || '']
      );
      return res.json({ success: true, action: 'deleted', changes: result.changes });
    }

    // upsert: INSERT ... ON CONFLICT DO UPDATE
    await enqueueRun(
      `INSERT INTO reward_penalties (type, confirm_date, phone, name, amount, remark, exec_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, '未执行', ?)
       ON CONFLICT(confirm_date, type, phone, remark) DO UPDATE SET
         name = excluded.name,
         amount = excluded.amount,
         remark = excluded.remark,
         updated_at = excluded.updated_at`,
      [type, confirmDate, phone, name, amount, remark || '', TimeUtil.nowDB()]
    );

    // 判断是新增还是更新
    const record = await dbGet('SELECT created_at, updated_at FROM reward_penalties WHERE confirm_date = ? AND type = ? AND phone = ? AND remark = ?', [confirmDate, type, phone, remark || '']);
    const action = (record && record.created_at === record.updated_at) ? 'created' : 'updated';

    res.json({ success: true, action });
  } catch (err) {
    logger.error(`奖罚记录upsert失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 查询奖罚记录列表
app.get('/api/reward-penalty/list', authMiddleware, async (req, res) => {
  try {
    const { type, confirmDate, phone, execStatus } = req.query;
    let sql = 'SELECT * FROM reward_penalties WHERE 1=1';
    const params = [];

    // Bug #1 修复：根据当前用户自动过滤
    // 教练用户只能查看自己的奖罚记录
    const user = req.user;
    if (user && user.userType === 'coach' && user.coachNo) {
      const coach = await dbGet('SELECT phone FROM coaches WHERE coach_no = ?', [user.coachNo]);
      const coachPhone = coach && coach.phone ? coach.phone : '';
      sql += ' AND phone = ?';
      params.push(coachPhone);
    }
    // 非教练用户（管理员等）：如果传了 phone 参数则过滤，否则返回所有记录

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (confirmDate) {
      sql += ' AND confirm_date LIKE ?';
      params.push(confirmDate + '%');
    }
    // phone 参数：仅当不是 coach 用户时才使用（coach 用户已通过 coachNo 自动过滤）
    if (phone && !(user && user.userType === 'coach')) {
      sql += ' AND phone = ?';
      params.push(phone);
    }
    if (execStatus) {
      sql += ' AND exec_status = ?';
      params.push(execStatus);
    }

    sql += ' ORDER BY confirm_date DESC, id DESC';

    const data = await dbAll(sql, params);

    // 计算合计（Bug #2 修复：sumSql 必须镜像相同的 WHERE 条件和 params）
    let sumSql = 'SELECT SUM(amount) as sumAmount, COUNT(*) as total FROM reward_penalties WHERE 1=1';
    const sumParams = [];

    // 教练用户自动过滤
    if (user && user.userType === 'coach' && user.coachNo) {
      const coach = await dbGet('SELECT phone FROM coaches WHERE coach_no = ?', [user.coachNo]);
      const coachPhone = coach && coach.phone ? coach.phone : '';
      sumSql += ' AND phone = ?';
      sumParams.push(coachPhone);
    }

    if (type) {
      sumSql += ' AND type = ?';
      sumParams.push(type);
    }
    if (confirmDate) {
      sumSql += ' AND confirm_date LIKE ?';
      sumParams.push(confirmDate + '%');
    }
    if (phone && !(user && user.userType === 'coach')) {
      sumSql += ' AND phone = ?';
      sumParams.push(phone);
    }
    if (execStatus) {
      sumSql += ' AND exec_status = ?';
      sumParams.push(execStatus);
    }

    const sumResult = await dbGet(sumSql, sumParams);

    res.json({ success: true, data, total: sumResult?.total || 0, sumAmount: sumResult?.sumAmount || 0 });
  } catch (err) {
    logger.error(`查询奖罚记录失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 按月统计奖罚数据
// ============ 奖罚统计 API（两阶段加载）============

// GET /api/reward-penalty/stats — 统计摘要（不含明细）
app.get('/api/reward-penalty/stats', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { month, type, execStatus } = req.query;
    const queryMonth = month || TimeUtil.todayStr().substring(0, 7); // 默认本月 YYYY-MM

    // 1) 按人员分组聚合统计
    let sql = `SELECT rp.phone, rp.name, c.employee_id,
                      SUM(rp.amount) as personTotal,
                      COUNT(*) as totalCount,
                      SUM(CASE WHEN rp.exec_status = '已执行' THEN 1 ELSE 0 END) as executedCount,
                      SUM(CASE WHEN rp.exec_status = '未执行' THEN 1 ELSE 0 END) as pendingCount,
                      GROUP_CONCAT(CASE WHEN rp.exec_status = '未执行' THEN rp.id END) as pendingIdsStr
               FROM reward_penalties rp
               LEFT JOIN coaches c ON c.phone = rp.phone
               WHERE rp.confirm_date LIKE ?`;
    const params = [queryMonth + '%'];

    if (type) {
      sql += ' AND rp.type = ?';
      params.push(type);
    }
    if (execStatus) {
      sql += ' AND rp.exec_status = ?';
      params.push(execStatus);
    }

    sql += ' GROUP BY rp.phone, rp.name, c.employee_id ORDER BY rp.phone';

    const rows = await dbAll(sql, params);

    const data = rows.map(r => ({
      phone: r.phone,
      name: r.name,
      employee_id: r.employee_id || null,
      personTotal: r.personTotal || 0,
      totalCount: r.totalCount || 0,
      executedCount: r.executedCount || 0,
      pendingCount: r.pendingCount || 0,
      pendingIds: r.pendingIdsStr ? r.pendingIdsStr.split(',').map(Number) : []
    }));

    // 2) 总体汇总
    let summarySql = 'SELECT SUM(amount) as totalAmount, COUNT(*) as totalCount FROM reward_penalties WHERE confirm_date LIKE ?';
    const summaryParams = [queryMonth + '%'];
    if (type) {
      summarySql += ' AND type = ?';
      summaryParams.push(type);
    }
    if (execStatus) {
      summarySql += ' AND exec_status = ?';
      summaryParams.push(execStatus);
    }
    const summaryRow = await dbGet(summarySql, summaryParams);

    let bonusSql = 'SELECT SUM(amount) as totalBonus FROM reward_penalties WHERE confirm_date LIKE ? AND amount > 0';
    const bonusParams = [queryMonth + '%'];
    if (type) {
      bonusSql += ' AND type = ?';
      bonusParams.push(type);
    }
    if (execStatus) {
      bonusSql += ' AND exec_status = ?';
      bonusParams.push(execStatus);
    }
    const bonusRow = await dbGet(bonusSql, bonusParams);

    let penaltySql = 'SELECT SUM(amount) as totalPenalty FROM reward_penalties WHERE confirm_date LIKE ? AND amount < 0';
    const penaltyParams = [queryMonth + '%'];
    if (type) {
      penaltySql += ' AND type = ?';
      penaltyParams.push(type);
    }
    if (execStatus) {
      penaltySql += ' AND exec_status = ?';
      penaltyParams.push(execStatus);
    }
    const penaltyRow = await dbGet(penaltySql, penaltyParams);

    let pendingSql = "SELECT COUNT(*) as pendingCount FROM reward_penalties WHERE confirm_date LIKE ? AND exec_status = '未执行'";
    const pendingParams = [queryMonth + '%'];
    if (type) {
      pendingSql += ' AND type = ?';
      pendingParams.push(type);
    }
    const pendingRow = await dbGet(pendingSql, pendingParams);

    // 如果传了 execStatus，根据状态直接计算 pending/executed
    let pendingCount, executedCount;
    if (execStatus === '已执行') {
      // 已执行过滤：pendingCount=0，executedCount=totalCount
      pendingCount = 0;
      executedCount = summaryRow?.totalCount || 0;
    } else if (execStatus === '未执行') {
      // 未执行过滤：pendingCount=totalCount，executedCount=0
      pendingCount = summaryRow?.totalCount || 0;
      executedCount = 0;
    } else {
      // 无状态过滤：用 pendingCount 查询结果
      pendingCount = pendingRow?.pendingCount || 0;
      executedCount = (summaryRow?.totalCount || 0) - (pendingRow?.pendingCount || 0);
    }

    const summary = {
      totalAmount: summaryRow?.totalAmount || 0,
      totalBonus: bonusRow?.totalBonus || 0,
      totalPenalty: penaltyRow?.totalPenalty || 0,
      totalCount: summaryRow?.totalCount || 0,
      pendingCount,
      executedCount
    };

    res.json({ success: true, data, summary });
  } catch (err) {
    logger.error(`奖罚统计失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/reward-penalty/stats/detail — 按人员查明细
app.get('/api/reward-penalty/stats/detail', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { phone, month, type, execStatus } = req.query;
    if (!phone) {
      return res.status(400).json({ error: 'phone参数必填' });
    }

    const queryMonth = month || TimeUtil.todayStr().substring(0, 7);

    let sql = 'SELECT id, type, confirm_date, amount, remark, exec_status, exec_date FROM reward_penalties WHERE phone = ? AND confirm_date LIKE ?';
    const params = [phone, queryMonth + '%'];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (execStatus) {
      sql += ' AND exec_status = ?';
      params.push(execStatus);
    }

    sql += ' ORDER BY confirm_date, id';

    const rows = await dbAll(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    logger.error(`查询奖罚明细失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/reward-penalty/recent-count — 获取用户昨天和今天新增生成的奖罚数据条数
app.get('/api/reward-penalty/recent-count', authMiddleware, async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.json({ success: true, count: 0 });
    }
    
    const today = TimeUtil.todayStr(); // YYYY-MM-DD
    const yesterday = TimeUtil.offsetDateStr(-1); // 昨天
    
    // 查询该用户昨天和今天 created_at 的奖罚记录条数（新增生成的数据）
    const sql = `SELECT COUNT(*) as count FROM reward_penalties WHERE phone = ? AND date(created_at) IN (?, ?)`;
    const row = await dbGet(sql, [phone, yesterday, today]);
    
    res.json({ success: true, count: row?.count || 0 });
  } catch (err) {
    logger.error(`查询奖罚计数失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/reward-penalty/detail/:id — 修改明细金额
app.post('/api/reward-penalty/detail/:id', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'id必须是数字' });
    }

    const { amount, remark } = req.body;
    if (amount === undefined || amount === null || typeof amount !== 'number' || isNaN(amount)) {
      return res.status(400).json({ error: 'amount必须为有效数字' });
    }

    // 检查记录是否存在
    const record = await dbGet('SELECT id, exec_status FROM reward_penalties WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }

    // 已执行记录禁止修改金额
    if (record.exec_status === '已执行') {
      return res.status(400).json({ error: '已执行记录不可修改金额' });
    }

    const now = TimeUtil.nowDB();
    const updates = ['amount = ?', 'updated_at = ?'];
    const updateParams = [amount, now];

    if (remark !== undefined) {
      updates.push('remark = ?');
      updateParams.push(remark);
    }

    updateParams.push(id);

    await enqueueRun(
      `UPDATE reward_penalties SET ${updates.join(', ')} WHERE id = ?`,
      updateParams
    );

    res.json({
      success: true,
      record: {
        id,
        amount,
        remark: remark !== undefined ? remark : '',
        exec_status: record.exec_status,
        updated_at: now
      }
    });
  } catch (err) {
    logger.error(`修改奖罚明细失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/reward-penalty/detail/:id — 删除奖罚明细
app.delete('/api/reward-penalty/detail/:id', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'id必须是数字' });
    }

    // 权限已由 requireBackendPermission(['coachManagement']) 控制
    // 店长、助教管理、管理员都可删除

    // 检查记录是否存在
    const record = await dbGet('SELECT id, exec_status, type, confirm_date, phone, name, amount FROM reward_penalties WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }

    // 已执行记录禁止删除
    if (record.exec_status === '已执行') {
      return res.status(400).json({ error: '已执行记录不可删除' });
    }

    // 执行删除
    await enqueueRun('DELETE FROM reward_penalties WHERE id = ?', [id]);

    logger.info(`删除奖罚记录: id=${id}, type=${record.type}, phone=${record.phone}, amount=${record.amount}`);

    res.json({
      success: true,
      deleted: {
        id,
        type: record.type,
        confirm_date: record.confirm_date,
        phone: record.phone,
        name: record.name,
        amount: record.amount
      }
    });
  } catch (err) {
    logger.error(`删除奖罚明细失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/reward-penalty/stats/execute-person — 一键执行某人所有未执行明细
app.post('/api/reward-penalty/stats/execute-person', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { phone, month, type, execStatus } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'phone参数必填' });
    }

    const queryMonth = month || TimeUtil.todayStr().substring(0, 7);
    const execDt = TimeUtil.nowDB().substring(0, 10);
    const now = TimeUtil.nowDB();

    // 只更新未执行的记录（双重保护）
    let sql = "UPDATE reward_penalties SET exec_status = '已执行', exec_date = ?, updated_at = ? WHERE phone = ? AND confirm_date LIKE ? AND exec_status = '未执行'";
    const params = [execDt, now, phone, queryMonth + '%'];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    const result = await runInTransaction(async (tx) => {
      const r = await tx.run(sql, params);
      return r;
    });

    res.json({ success: true, updated: result.changes || 0 });
  } catch (err) {
    logger.error(`执行人员奖罚失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 批量执行奖罚
app.post('/api/reward-penalty/batch-execute', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { ids, execDate } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids必须是非空数组' });
    }

    const execDt = execDate || TimeUtil.nowDB().substring(0, 10);
    const placeholders = ids.map(() => '?').join(',');
    const params = [execDt, TimeUtil.nowDB(), ...ids];

    const result = await enqueueRun(
      `UPDATE reward_penalties SET exec_status = '已执行', exec_date = ?, updated_at = ? WHERE id IN (${placeholders})`,
      params
    );

    res.json({ success: true, updated: result.changes });
  } catch (err) {
    logger.error(`批量执行奖罚失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 单条执行奖罚
app.post('/api/reward-penalty/execute/:id', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const execDt = TimeUtil.nowDB().substring(0, 10);
    await enqueueRun(
      "UPDATE reward_penalties SET exec_status = '已执行', exec_date = ?, updated_at = ? WHERE id = ?",
      [execDt, TimeUtil.nowDB(), req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    logger.error(`执行奖罚失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取对应角色的人员列表（用于奖金设定页面）
app.get('/api/reward-penalty/targets', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { role } = req.query; // '服务员' 或 '助教'

    if (role === '服务员') {
      const users = await dbAll(
        "SELECT username as phone, name, role FROM admin_users WHERE role = '服务员' AND employment_status = '在职' ORDER BY name"
      );
      return res.json({ success: true, data: users, role });
    }

    if (role === '助教') {
      const coaches = await dbAll(
        `SELECT coach_no, employee_id, stage_name, real_name, phone, status
         FROM coaches
         WHERE status != '离职' AND employee_id IS NOT NULL AND employee_id != ''
         ORDER BY CAST(employee_id AS INTEGER)`
      );
      // 格式化显示名称: 工号 + 艺名 + 姓名
      const formatted = coaches.map(c => ({
        phone: c.phone || '',
        coach_no: c.coach_no,
        employee_id: c.employee_id,
        displayName: `${c.employee_id}号 ${c.stage_name || ''} ${c.real_name || ''}`.trim(),
        name: c.stage_name || c.real_name || '',  // QA-20260422: 优先取艺名，与批处理一致
        stage_name: c.stage_name || '',          // QA-20260422: 新增，方便前台区分
        real_name: c.real_name || '',            // QA-20260422: 新增
        status: c.status
      }));
      return res.json({ success: true, data: formatted, role });
    }

    res.status(400).json({ error: 'role参数必须是"服务员"或"助教"' });
  } catch (err) {
    logger.error(`获取奖罚对象列表失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ===================== 新增端点 (Bug #6 修复) =====================

// 获取当前用户可用的奖罚类型（按角色过滤）
app.get('/api/reward-penalty/my-types', authMiddleware, async (req, res) => {
  try {
    const config = await dbGet("SELECT value FROM system_config WHERE key = 'reward_penalty_types'");
    let types = [];
    if (config && config.value) {
      try {
        const allTypes = JSON.parse(config.value);
        // 根据用户角色过滤奖罚类型
        const userRole = req.user?.role || '';
        // 管理员/店长/助教管理等后台角色可以看到所有类型
        const adminRoles = ['管理员', '店长', '助教管理', 'cashier'];
        if (adminRoles.includes(userRole)) {
          types = allTypes;
        } else if (userRole === '助教' || userRole === '教练') {
          // 助教/教练只能看到对象包含"助教"或"教练"的类型
          types = allTypes.filter(t => {
            const obj = t['对象'] || '';
            return obj.includes('助教') || obj.includes('教练');
          });
        } else {
          // 其他角色（如服务员）：看到对象匹配自己角色的类型
          types = allTypes.filter(t => {
            const obj = t['对象'] || '';
            return obj.includes(userRole);
          });
        }
      } catch (e) {
        types = [];
      }
    }
    res.json({ success: true, types });
  } catch (err) {
    logger.error(`获取可用奖罚类型失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 批量设定奖金
app.post('/api/reward-penalty/batch-set', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    // Bug #3 修复：检查 body 是否为合法 JSON 对象
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: '请求体必须是有效的JSON对象' });
    }

    const { records, execDate } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'records必须是非空数组' });
    }

    // 验证每条记录的必要字段
    for (const r of records) {
      if (!r.type || !r.confirmDate || !r.phone || r.name === undefined || r.amount === undefined) {
        return res.status(400).json({ error: '每条记录必须包含 type, confirmDate, phone, name, amount' });
      }
    }

    // Bug #4 修复：验证 type 是否在系统配置中
    const config = await dbGet("SELECT value FROM system_config WHERE key = 'reward_penalty_types'");
    if (config && config.value) {
      try {
        const validTypes = JSON.parse(config.value);
        if (Array.isArray(validTypes) && validTypes.length > 0) {
          const typeNames = validTypes.map(t => typeof t === 'string' ? t : (t['奖罚类型'] || t.name || t.label || ''));
          for (const r of records) {
            if (!typeNames.includes(r.type)) {
              return res.status(400).json({ error: `无效的奖罚类型: ${r.type}` });
            }
          }
        }
      } catch (e) {}
    }

    // Bug #5 修复：验证日期格式
    const dateRegex = /^\d{4}-\d{2}(-\d{2})?$/;
    for (const r of records) {
      if (!dateRegex.test(r.confirmDate)) {
        return res.status(400).json({ error: `confirmDate格式错误: ${r.confirmDate}，请使用 YYYY-MM-DD 或 YYYY-MM 格式` });
      }
    }

    // 批量 upsert
    let created = 0, updated = 0;
    for (const r of records) {
      if (r.amount === 0) {
        await enqueueRun(
          'DELETE FROM reward_penalties WHERE confirm_date = ? AND type = ? AND phone = ?',
          [r.confirmDate, r.type, r.phone]
        );
        created++; // 算作一次操作
      } else {
        await enqueueRun(
          `INSERT INTO reward_penalties (type, confirm_date, phone, name, amount, remark, exec_status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, '未执行', ?)
           ON CONFLICT(confirm_date, type, phone) DO UPDATE SET
             name = excluded.name,
             amount = excluded.amount,
             remark = excluded.remark,
             updated_at = excluded.updated_at`,
          [r.type, r.confirmDate, r.phone, r.name, r.amount, r.remark || '', TimeUtil.nowDB()]
        );

        // 判断新增还是更新
        const existing = await dbGet(
          'SELECT created_at, updated_at FROM reward_penalties WHERE confirm_date = ? AND type = ? AND phone = ?',
          [r.confirmDate, r.type, r.phone]
        );
        if (existing && existing.created_at !== existing.updated_at) {
          updated++;
        } else {
          created++;
        }
      }
    }

    res.json({ success: true, created, updated, total: records.length });
  } catch (err) {
    logger.error(`批量设定奖金失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 撤销执行
app.post('/api/reward-penalty/unexecute/:id', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const record = await dbGet('SELECT id, exec_status FROM reward_penalties WHERE id = ?', [req.params.id]);
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }
    if (record.exec_status !== '已执行') {
      return res.status(400).json({ error: '该记录尚未执行，无法撤销' });
    }

    await enqueueRun(
      "UPDATE reward_penalties SET exec_status = '未执行', exec_date = NULL, updated_at = ? WHERE id = ?",
      [TimeUtil.nowDB(), req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    logger.error(`撤销执行失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 金额汇总统计（旧接口，保留兼容）
app.get('/api/reward-penalty/stats/summary', authMiddleware, async (req, res) => {
  try {
    const { month, type, phone } = req.query;

    let sql = 'SELECT type, COUNT(*) as count, SUM(amount) as totalAmount FROM reward_penalties WHERE 1=1';
    const params = [];

    // 教练用户只能查看自己的数据
    const user = req.user;
    if (user && user.userType === 'coach' && user.coachNo) {
      const coach = await dbGet('SELECT phone FROM coaches WHERE coach_no = ?', [user.coachNo]);
      const coachPhone = coach && coach.phone ? coach.phone : '';
      sql += ' AND phone = ?';
      params.push(coachPhone);
    } else if (phone) {
      sql += ' AND phone = ?';
      params.push(phone);
    }

    if (month) {
      sql += ' AND confirm_date LIKE ?';
      params.push(month + '%');
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' GROUP BY type ORDER BY totalAmount DESC';

    const breakdown = await dbAll(sql, params);

    // 总体汇总
    let totalSql = 'SELECT SUM(amount) as totalAmount, COUNT(*) as totalCount FROM reward_penalties WHERE 1=1';
    const totalParams = [];

    if (user && user.userType === 'coach' && user.coachNo) {
      const coach = await dbGet('SELECT phone FROM coaches WHERE coach_no = ?', [user.coachNo]);
      const coachPhone = coach && coach.phone ? coach.phone : '';
      totalSql += ' AND phone = ?';
      totalParams.push(coachPhone);
    } else if (phone) {
      totalSql += ' AND phone = ?';
      totalParams.push(phone);
    }
    if (month) {
      totalSql += ' AND confirm_date LIKE ?';
      totalParams.push(month + '%');
    }
    if (type) {
      totalSql += ' AND type = ?';
      totalParams.push(type);
    }

    const total = await dbGet(totalSql, totalParams);

    // 按执行状态统计
    let statusSql = "SELECT exec_status, COUNT(*) as count, SUM(amount) as amount FROM reward_penalties WHERE 1=1";
    const statusParams = [];
    if (user && user.userType === 'coach' && user.coachNo) {
      const coach = await dbGet('SELECT phone FROM coaches WHERE coach_no = ?', [user.coachNo]);
      const coachPhone = coach && coach.phone ? coach.phone : '';
      statusSql += ' AND phone = ?';
      statusParams.push(coachPhone);
    } else if (phone) {
      statusSql += ' AND phone = ?';
      statusParams.push(phone);
    }
    if (month) {
      statusSql += ' AND confirm_date LIKE ?';
      statusParams.push(month + '%');
    }
    if (type) {
      statusSql += ' AND type = ?';
      statusParams.push(type);
    }
    statusSql += ' GROUP BY exec_status';

    const byStatus = await dbAll(statusSql, statusParams);

    res.json({
      success: true,
      total: {
        totalAmount: total?.totalAmount || 0,
        totalCount: total?.totalCount || 0
      },
      breakdown,
      byStatus
    });
  } catch (err) {
    logger.error(`金额汇总统计失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// =====================================================================

// 更新用户在职状态
app.put('/api/admin/users/:username/status', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { employmentStatus } = req.body;
    if (!['在职', '离职'].includes(employmentStatus)) {
      return res.status(400).json({ error: 'employmentStatus必须是"在职"或"离职"' });
    }
    await enqueueRun(
      'UPDATE admin_users SET employment_status = ? WHERE username = ?',
      [employmentStatus, req.params.username]
    );
    res.json({ success: true });
  } catch (err) {
    logger.error(`更新用户在职状态失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// =============== 奖罚管理 API 结束 ===============

// =============== QA-20260422-3: 鉴权配置 API（独立验证，不走 authMiddleware）==============

// 获取鉴权配置
app.get('/api/admin/auth-config', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });
  
  try {
    jwt.verify(token, config.jwt.secret);
    res.json({ enabled: authEnabledCache });
  } catch (err) {
    res.status(401).json({ error: 'token无效' });
  }
});

// 更新鉴权配置
app.put('/api/admin/auth-config', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: '参数错误，enabled 必须为 boolean' });
    }
    
    // 确保 DB 有记录（无则自动插入）
    const existing = await dbGet('SELECT value FROM system_config WHERE key = ?', ['auth_enabled']);
    if (!existing) {
      await enqueueRun('INSERT INTO system_config (key, value, description) VALUES (?, ?, ?)',
        ['auth_enabled', enabled.toString(), 'API鉴权开关']);
    } else {
      await enqueueRun('UPDATE system_config SET value = ?, updated_at = ? WHERE key = ?',
        [enabled.toString(), TimeUtil.nowDB(), 'auth_enabled']);
    }
    
    // 更新内存缓存
    updateAuthCache(enabled);
    
    // 操作日志
    operationLog.info(`${decoded.username} 修改鉴权配置: ${enabled ? '启用' : '关闭'}`);
    
    res.json({ success: true, message: `鉴权已${enabled ? '启用' : '关闭'}` });
  } catch (err) {
    res.status(401).json({ error: 'token无效' });
  }
});

// =============== 鉴权配置 API 结束 ===============

// =============== 系统配置总览 API ===============

// 获取所有系统配置（只读）
app.get('/api/admin/system-config/all', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });

  try {
    jwt.verify(token, config.jwt.secret);
    const configs = await dbAll('SELECT key, value, description, updated_at FROM system_config ORDER BY key');
    res.json({ success: true, data: configs });
  } catch (err) {
    res.status(401).json({ error: 'token无效' });
  }
});

// =============== 系统配置总览 API 结束 ===============

// Bug #3 修复：JSON 解析错误返回 400 而非 500
app.use((err, req, res, next) => {
  // Express JSON 解析失败（SyntaxError）→ 返回 400
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: '请求体格式错误，请检查JSON格式' });
  }
  next(err);
});

// 通用错误处理
app.use((err, req, res, next) => {
  logger.error(`未处理的错误: ${err.message}`);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
const PORT = process.env.PORT || config.server.port || 8081;
app.listen(PORT, async () => {
  logger.info(`天宫国际线上服务已启动: http://localhost:${PORT}`);
  console.log(`🚀 服务已启动: http://localhost:${PORT}`);

  // QA-20260422-3: 加载鉴权配置缓存
  await loadAuthConfig();

  // 初始化公共计时器管理器（自包含，无需回调）
  const TimerManager = require('./services/timer-manager');
  TimerManager.init();
  
  // 加载今日门迎排序数据
  const guestRankingService = require('./services/guest-ranking-service');
  guestRankingService.loadTodayData().catch(err => {
    console.error('[GuestRanking] 启动时加载数据失败:', err.message);
  });
  
  // 同步助教钉钉用户ID
  const syncDingtalkUserid = require('./services/sync-dingtalk-userid');
  syncDingtalkUserid.syncDingtalkUserIds().catch(err => {
    console.error('[Dingtalk] 启动时同步用户ID失败:', err.message);
  });
  
  // 初始化 Cron 批处理调度器
  require('./services/cron-scheduler').init();
});

// 优雅关闭
process.on('SIGINT', () => {
  logger.info('收到SIGINT信号,正在关闭...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号,正在关闭...');
  db.close();
  process.exit(0);
});
