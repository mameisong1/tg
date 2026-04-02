/**
 * 天宫国际商品数据同步脚本
 * 从台客多后台采集商品数据，同步到天宫国际数据库
 * 
 * 使用方法: node sync-products.js
 * 日志文件: sync-products.log
 */

const { chromium } = require('playwright');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// ==================== 配置 ====================
const CONFIG = {
  chromePort: 9222,
  chromeStartCmd: 'bash /root/chrome',
  targetUrl: 'http://admin.taikeduo.com/#/productManagement/productList',
  dbPath: '/TG/tgservice/db/tgservice.db',
  logFile: '/TG/tgservice/scripts/sync-products.log',
  dataFile: '/TG/tgservice/data/taikeduo-products.json',
  minProducts: 100,  // 最少采集数量
  pageTimeout: 300000, // 页面加载超时5分钟
  excludeCategories: ['美女教练'], // 排除的分类
  credentialsPath: '/root/.openclaw/credentials.json',
};

// 随机停顿函数（防止操作过快导致网络异常）
function randomSleep(minMs = 200, maxMs = 500) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// 获取台客多登录凭证
function getTaikeduoCredentials() {
  try {
    const credentials = JSON.parse(fs.readFileSync(CONFIG.credentialsPath, 'utf8'));
    return credentials.taikeduo;
  } catch (err) {
    return null;
  }
}

// ==================== 日志工具 ====================
class Logger {
  constructor(logFile) {
    this.logFile = logFile;
    this.ensureDir();
  }

  ensureDir() {
    const dir = path.dirname(this.logFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  log(level, message, data = null) {
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
    let logLine = `[${timestamp}] [${level}] ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        logLine += '\n' + JSON.stringify(data, null, 2);
      } else {
        logLine += ' ' + data;
      }
    }
    
    // 写入文件
    fs.appendFileSync(this.logFile, logLine + '\n');
    
    // 控制台输出
    console.log(logLine);
  }

  info(message, data) { this.log('INFO', message, data); }
  warn(message, data) { this.log('WARN', message, data); }
  error(message, data) { this.log('ERROR', message, data); }
  success(message, data) { this.log('SUCCESS', message, data); }
}

// ==================== Chrome 管理 ====================
class ChromeManager {
  constructor(logger) {
    this.logger = logger;
    this.browser = null;
  }

  async ensureRunning() {
    this.logger.info('检查 Chrome 是否运行...');
    
    try {
      // 尝试连接已有的 Chrome
      const response = await fetch(`http://localhost:${CONFIG.chromePort}/json/version`);
      if (response.ok) {
        this.logger.success('Chrome 已在运行，直接连接');
        return true;
      }
    } catch (e) {
      this.logger.info('Chrome 未运行，正在启动...');
    }

    // 启动 Chrome
    try {
      execSync(CONFIG.chromeStartCmd, { detached: true, stdio: 'ignore' });
      
      // 等待 Chrome 启动
      for (let i = 0; i < 30; i++) {
        await this.sleep(1000);
        try {
          const response = await fetch(`http://localhost:${CONFIG.chromePort}/json/version`);
          if (response.ok) {
            this.logger.success('Chrome 启动成功');
            return true;
          }
        } catch (e) {
          // 继续等待
        }
      }
      
      this.logger.error('Chrome 启动超时');
      return false;
    } catch (e) {
      this.logger.error('启动 Chrome 失败', e.message);
      return false;
    }
  }

  async connect() {
    if (!await this.ensureRunning()) {
      throw new Error('无法连接到 Chrome');
    }

    this.browser = await chromium.connectOverCDP(`http://localhost:${CONFIG.chromePort}`);
    this.logger.success('已连接到 Chrome');
    return this.browser;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.logger.info('Chrome 连接已关闭');
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==================== 登录工具 ====================
// 检测是否在登录页面
async function checkLoginPage(page) {
  const url = page.url();
  const hasLoginBtn = await page.$('text=密码登录').then(el => !!el).catch(() => false);
  const hasSidebar = await page.$('.sidebar, .el-menu, .nav-menu').then(el => !!el).catch(() => false);
  return {
    isLoginPage: url.includes('login') && !hasSidebar,
    url: url
  };
}

// 自动登录（改进版：随机停顿 + 多次检查）
async function autoLogin(page, logger) {
  logger.info('检测到登录页面，尝试自动登录...');
  
  const credentials = getTaikeduoCredentials();
  if (!credentials) {
    throw new Error('无法获取台客多登录凭证');
  }
  
  logger.info(`使用账号: ${credentials.username}`);
  
  // 点击密码登录按钮
  const pwdBtn = await page.$('text=密码登录');
  if (pwdBtn) {
    await pwdBtn.click();
    await randomSleep(1500, 2500); // 等待表单切换（随机1.5-2.5秒）
    logger.info('  已点击密码登录');
  }
  
  // 填写用户名
  const usernameInput = await page.$('input[placeholder*="手机号"], input[type="text"]');
  if (usernameInput) {
    await usernameInput.fill(credentials.username);
    await randomSleep(300, 600); // 填写用户名后随机停顿
    logger.info('  已填写用户名');
  }
  
  // 填写密码
  const passwordInput = await page.$('input[type="password"]');
  if (passwordInput) {
    await passwordInput.fill(credentials.password);
    await randomSleep(500, 1000); // 填写密码后随机停顿
    logger.info('  已填写密码');
  }
  
  // 点击登录按钮
  const loginBtn = await page.$('button:has-text("登"), button:has-text("录")');
  if (loginBtn) {
    await loginBtn.click();
    logger.info('  已点击登录按钮');
  }
  
  // 等待登录完成（多次检查，不轻易放弃）
  logger.info('  等待登录完成...');
  await randomSleep(3000, 5000);
  
  // 检查登录结果（最多检查3次）
  for (let attempt = 1; attempt <= 3; attempt++) {
    const loginResult = await checkLoginPage(page);
    
    if (!loginResult.isLoginPage) {
      logger.info(`  自动登录成功（第 ${attempt} 次检查）`);
      return true;
    }
    
    logger.info(`  登录检查第 ${attempt} 次: 仍在登录页面 (${loginResult.url})`);
    
    if (attempt < 3) {
      await randomSleep(3000, 5000); // 等待3-5秒再检查
    }
  }
  
  // 最后检查是否有商品列表元素（可能已登录但URL没变）
  await randomSleep(2000, 3000);
  const hasProductTable = await page.$('table tbody tr').then(el => !!el).catch(() => false);
  if (hasProductTable) {
    logger.info('  检测到商品列表表格，登录可能已成功');
    return true;
  }
  
  throw new Error('自动登录失败，多次检查后仍在登录页面且无商品列表');
}

// ==================== 页面等待工具 ====================
async function waitForPageReady(page, logger, description = '页面') {
  logger.info(`等待 ${description} 加载完成...`);
  
  const startTime = Date.now();
  const timeout = CONFIG.pageTimeout;

  try {
    // 1. 等待 load 事件
    await page.waitForLoadState('load', { timeout });
    logger.info(`  - load 事件完成 (${Date.now() - startTime}ms)`);
  } catch (e) {
    logger.warn(`  - load 事件超时，继续等待关键组件`);
  }

  // 2. 等待关键组件（表格）
  try {
    await page.waitForSelector('table tbody tr', { timeout: timeout - (Date.now() - startTime) });
    logger.info(`  - 表格组件已加载 (${Date.now() - startTime}ms)`);
  } catch (e) {
    logger.warn(`  - 表格组件等待超时，检查元素是否已存在`);
    
    // 超时时先检查元素是否已存在（改进：不轻易放弃）
    const rows = await page.$$('table tbody tr');
    if (rows.length > 0) {
      logger.info(`  - 表格组件已存在（${rows.length}行），虽然超时但继续执行`);
    } else {
      // 再等待一段时间
      await page.waitForTimeout(3000);
      const rows2 = await page.$$('table tbody tr');
      if (rows2.length > 0) {
        logger.info(`  - 表格组件已存在（${rows2.length}行），继续执行`);
      } else {
        logger.warn(`  - 表格组件确实不存在，页面可能未正确加载`);
      }
    }
  }

  // 3. 额外等待确保数据渲染
  await page.waitForTimeout(2000);

  const elapsed = Date.now() - startTime;
  logger.info(`${description} 加载完成，耗时 ${elapsed}ms`);
  
  return true;
}

// ==================== 商品采集 ====================
class ProductCollector {
  constructor(browser, logger) {
    this.browser = browser;
    this.logger = logger;
    this.page = null;
    this.products = [];
  }

  async openPage() {
    const context = this.browser.contexts()[0];
    this.page = context.pages()[0] || await context.newPage();
    
    this.logger.info('打开台客多商品列表页面...');
    this.logger.info(`目标URL: ${CONFIG.targetUrl}`);
    
    await this.page.goto(CONFIG.targetUrl, { timeout: CONFIG.pageTimeout });
    
    // 等待页面初始渲染（台客多页面较慢）
    this.logger.info('等待页面初始渲染（10秒）...');
    await randomSleep(12000, 18000); // 随机12-18秒
    
    // 多次检测页面状态（最多18次，总时长约3分钟）
    this.logger.info('检测页面状态（最多检测18次，总时长约3分钟）...');
    
    const maxAttempts = 18;
    const checkIntervalMs = 10000;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const elapsedSec = Math.round((attempt - 1) * checkIntervalMs / 1000 + 15);
      this.logger.info(`页面状态检测第 ${attempt} 次（已等待约 ${elapsedSec} 秒）...`);
      
      // 检查是否需要登录
      const loginCheck = await checkLoginPage(this.page);
      if (loginCheck.isLoginPage) {
        this.logger.info('检测到登录页面，开始自动登录...');
        await autoLogin(this.page, this.logger);
        
        // 登录后重新导航
        this.logger.info('登录成功，重新导航到商品列表...');
        await this.page.goto(CONFIG.targetUrl, { timeout: CONFIG.pageTimeout });
        
        this.logger.info('等待页面渲染（15秒）...');
        await randomSleep(12000, 18000);
        
        // 再次检测（登录后最多检测10次）
        for (let loginAttempt = 1; loginAttempt <= 10; loginAttempt++) {
          const hasTable = await this.page.$('table tbody tr').then(el => !!el).catch(() => false);
          if (hasTable) {
            this.logger.info(`检测到商品列表表格（登录后第 ${loginAttempt} 次检测）`);
            await waitForPageReady(this.page, this.logger, '商品列表页面');
            return this.page;
          }
          this.logger.info(`登录后第 ${loginAttempt} 次检测: 未发现商品列表表格`);
          if (loginAttempt < 10) {
            await randomSleep(8000, 12000);
          }
        }
        
        throw new Error('登录后多次检测仍未找到商品列表表格');
      }
      
      // 检查是否有商品列表表格
      const hasTable = await this.page.$('table tbody tr').then(el => !!el).catch(() => false);
      if (hasTable) {
        this.logger.info(`检测到商品列表表格（第 ${attempt} 次检测）`);
        await waitForPageReady(this.page, this.logger, '商品列表页面');
        return this.page;
      }
      
      this.logger.info(`第 ${attempt} 次检测: 未发现登录页面或商品列表表格`);
      
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, checkIntervalMs)); // 固定10秒间隔
      }
    }
    
    // 输出调试信息
    const url = this.page.url();
    const title = await this.page.title().catch(() => '未知');
    const bodyPreview = await this.page.evaluate(() => document.body.innerText.substring(0, 200)).catch(() => '无法获取');
    this.logger.error(`等待3分钟后仍无法识别页面状态 - URL: ${url}, 标题: ${title}`);
    this.logger.error(`页面内容预览: ${bodyPreview}`);
    
    throw new Error('等待3分钟后仍无法识别页面状态，既没有登录页面也没有商品列表');
  }

  async getTotalCount() {
    const totalText = await this.page.textContent('.el-pagination__total').catch(() => '');
    const match = totalText.match(/共\s*(\d+)\s*条/);
    return match ? parseInt(match[1]) : 0;
  }

  async collectPage(pageNum) {
    this.logger.info(`采集第 ${pageNum} 页...`);
    
    // 获取当前页数据
    const pageData = await this.page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      const results = [];
      
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 11) continue;
        
        // 解析各字段
        const name = cells[0].textContent.trim().split('\n')[0];
        const img = cells[1].querySelector('img');
        const imageUrl = img ? img.src : '';
        
        // 零售价
        let price = '';
        const priceText = cells[2].textContent.trim();
        const priceMatch = priceText.match(/^[\d.]+$/);
        if (priceMatch) price = priceText;
        
        // 库存
        const stockText = cells[3].textContent;
        const totalMatch = stockText.match(/总:\s*(\d+)/);
        const availableMatch = stockText.match(/可用:\s*(\d+)/);
        const stockTotal = totalMatch ? parseInt(totalMatch[1]) : 0;
        const stockAvailable = availableMatch ? parseInt(availableMatch[1]) : 0;
        
        // 分类
        let category = cells[4].textContent.trim();
        
        // 状态（根据可用库存判断）
        const status = stockAvailable > 0 ? '上架' : '下架';
        
        // 创建人
        const creatorText = cells[9].textContent.trim();
        const creatorMatch = creatorText.match(/(syb\d+)/);
        const creator = creatorMatch ? creatorMatch[1] : '';
        
        // 创建时间
        const timeText = cells[10].textContent.trim();
        const timeMatch = timeText.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
        const createTime = timeMatch ? timeMatch[1] : '';
        
        if (name) {
          results.push({
            name,
            imageUrl,
            price,
            stockTotal,
            stockAvailable,
            category,
            status,
            creator,
            createTime
          });
        }
      }
      
      return results;
    });
    
    this.logger.info(`  找到 ${pageData.length} 条商品`);
    
    // 记录采集数据到日志
    this.logger.info(`  第 ${pageNum} 页采集数据:`, pageData);
    
    return pageData;
  }

  async nextPage(currentPage) {
    const clicked = await this.page.evaluate((targetPage) => {
      // 查找页码按钮
      const pagerItems = document.querySelectorAll('.el-pager li');
      for (const item of pagerItems) {
        if (item.textContent.trim() === String(targetPage + 1)) {
          item.click();
          return true;
        }
      }
      
      // 查找下一页按钮
      const nextBtn = document.querySelector('.btn-next:not(.disabled)');
      if (nextBtn) {
        nextBtn.click();
        return true;
      }
      
      return false;
    }, currentPage);
    
    if (clicked) {
      await waitForPageReady(this.page, this.logger, `第 ${currentPage + 1} 页`);
    }
    
    return clicked;
  }

  async collect() {
    await this.openPage();
    
    const total = await this.getTotalCount();
    const totalPages = Math.ceil(total / 20);
    
    this.logger.info(`总商品数: ${total}，共 ${totalPages} 页`);
    
    if (total < CONFIG.minProducts) {
      this.logger.warn(`商品数量 ${total} < ${CONFIG.minProducts}，可能数据不完整`);
    }
    
    // 采集每一页
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageData = await this.collectPage(pageNum);
      this.products.push(...pageData);
      
      // 翻页
      if (pageNum < totalPages) {
        const success = await this.nextPage(pageNum);
        if (!success) {
          this.logger.warn(`无法翻到第 ${pageNum + 1} 页，停止采集`);
          break;
        }
      }
    }
    
    // 去重
    const productMap = new Map();
    this.products.forEach(p => {
      if (p.name) productMap.set(p.name, p);
    });
    this.products = Array.from(productMap.values());
    
    this.logger.success(`采集完成，共 ${this.products.length} 条商品（去重后）`);
    
    return this.products;
  }

  generateReport() {
    const report = {
      total: this.products.length,
      byCategory: {},
      withImages: 0,
      withoutImages: 0
    };
    
    this.products.forEach(p => {
      const cat = p.category || '未分类';
      report.byCategory[cat] = (report.byCategory[cat] || 0) + 1;
      
      if (p.imageUrl) report.withImages++;
      else report.withoutImages++;
    });
    
    return report;
  }
}

// ==================== 数据库操作 ====================
class DatabaseSync {
  constructor(logger) {
    this.logger = logger;
    this.db = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(CONFIG.dbPath, (err) => {
        if (err) {
          this.logger.error('数据库连接失败', err.message);
          reject(err);
        } else {
          this.logger.success('数据库已连接');
          resolve();
        }
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async syncProducts(products) {
    // 过滤排除分类
    const filteredProducts = products.filter(p => !CONFIG.excludeCategories.includes(p.category));
    const removedCount = products.length - filteredProducts.length;
    
    this.logger.info(`过滤"${CONFIG.excludeCategories.join('、')}"分类: ${removedCount} 条`);
    this.logger.info(`待导入商品: ${filteredProducts.length} 条`);
    
    let inserted = 0, updated = 0, skipped = 0;
    
    for (const p of filteredProducts) {
      if (!p.name || p.name.trim() === '') {
        skipped++;
        continue;
      }
      
      // 特殊规则：指定图片的商品强制下架
      const offlineImageUrl = 'https://hui-shang.oss-cn-hangzhou.aliyuncs.com/pic/GtYe33GDA60y6xWF.png';
      if (p.imageUrl === offlineImageUrl) {
        p.status = '下架';
      }
      
      try {
        const existing = await this.get('SELECT name FROM products WHERE name = ?', [p.name]);
        
        if (existing) {
          await this.run(
            `UPDATE products SET 
              image_url = ?, 
              price = ?, 
              stock_total = ?, 
              stock_available = ?, 
              category = ?, 
              status = ?, 
              creator = ?,
              updated_at = datetime('now', 'localtime')
            WHERE name = ?`,
            [p.imageUrl, p.price, p.stockTotal, p.stockAvailable, p.category, p.status, p.creator, p.name]
          );
          updated++;
        } else {
          await this.run(
            `INSERT INTO products (name, image_url, price, stock_total, stock_available, category, status, creator, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))`,
            [p.name, p.imageUrl, p.price, p.stockTotal, p.stockAvailable, p.category, p.status, p.creator]
          );
          inserted++;
        }
      } catch (e) {
        this.logger.error(`同步商品失败: ${p.name}`, e.message);
        skipped++;
      }
    }
    
    return { inserted, updated, skipped };
  }

  async syncCategories(products) {
    // 过滤掉排除的分类
    const filteredCategories = [...new Set(
      products
        .map(p => p.category)
        .filter(c => c && !CONFIG.excludeCategories.includes(c))
    )];
    this.logger.info(`发现 ${filteredCategories.length} 个分类: ${filteredCategories.join(', ')}`);
    
    let inserted = 0, existing = 0;
    
    for (const cat of filteredCategories) {
      try {
        const row = await this.get('SELECT name FROM product_categories WHERE name = ?', [cat]);
        
        if (row) {
          existing++;
        } else {
          await this.run(
            `INSERT INTO product_categories (name, creator, created_at) VALUES (?, 'sync-script', datetime('now', 'localtime'))`,
            [cat]
          );
          inserted++;
        }
      } catch (e) {
        this.logger.error(`同步分类失败: ${cat}`, e.message);
      }
    }
    
    return { inserted, existing };
  }

  close() {
    if (this.db) {
      this.db.close();
      this.logger.info('数据库连接已关闭');
    }
  }
}

// ==================== 主函数 ====================
async function main() {
  const startTime = Date.now();
  const logger = new Logger(CONFIG.logFile);
  
  logger.info('========== 商品数据同步开始 ==========');
  logger.info(`开始时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`);
  logger.info(`目标URL: ${CONFIG.targetUrl}`);
  logger.info(`页面超时: ${CONFIG.pageTimeout}ms`);
  
  let chrome = null;
  let db = null;
  
  try {
    // 1. 连接 Chrome
    logger.info('步骤1: 连接 Chrome...');
    chrome = new ChromeManager(logger);
    const browser = await chrome.connect();
    logger.info('Chrome 连接成功');
    
    // 2. 采集商品数据
    logger.info('步骤2: 采集商品数据...');
    const collector = new ProductCollector(browser, logger);
    const products = await collector.collect();
    logger.info(`采集完成，共 ${products.length} 个商品`);
    
    // 3. 生成采集报告
    const report = collector.generateReport();
    logger.info('采集报告:', report);
    
    // 4. 保存采集数据
    logger.info('步骤3: 保存采集数据...');
    const dataDir = path.dirname(CONFIG.dataFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG.dataFile, JSON.stringify(products, null, 2), 'utf-8');
    logger.success(`采集数据已保存到: ${CONFIG.dataFile}`);
    
    // 5. 检查采集数量
    if (products.length < CONFIG.minProducts) {
      logger.error(`采集数量 ${products.length} < ${CONFIG.minProducts}，不写入数据库`);
      
      // 输出调试信息
      if (products.length > 0) {
        logger.info('采集到的商品样本:', products.slice(0, 3));
      }
      
      logger.info('========== 商品数据同步结束（异常） ==========');
      process.exit(1);
    }
    
    // 6. 同步到数据库
    logger.info('步骤4: 同步到数据库...');
    db = new DatabaseSync(logger);
    await db.connect();
    
    const productResult = await db.syncProducts(products);
    logger.success(`商品表同步完成: 新增 ${productResult.inserted} 条，更新 ${productResult.updated} 条，跳过 ${productResult.skipped} 条`);
    
    const categoryResult = await db.syncCategories(products);
    logger.success(`分类表同步完成: 新增 ${categoryResult.inserted} 个，已存在 ${categoryResult.existing} 个`);
    
    // 7. 最终报告
    const elapsed = Date.now() - startTime;
    const finalReport = {
      采集时间: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }),
      耗时毫秒: elapsed,
      台客多商品总数: products.length,
      过滤分类: CONFIG.excludeCategories,
      导入商品数: productResult.inserted + productResult.updated,
      分类统计: report.byCategory,
      图片统计: { 有图: report.withImages, 无图: report.withoutImages }
    };
    
    logger.success('========== 同步完成 ==========');
    logger.success('最终报告:', finalReport);
    
  } catch (error) {
    const elapsed = Date.now() - startTime;
    
    // 完整错误日志输出
    logger.error('========== 同步失败 ==========');
    logger.error(`错误类型: ${error.name}`);
    logger.error(`错误消息: ${error.message}`);
    logger.error(`错误堆栈: ${error.stack}`);
    logger.error(`耗时: ${elapsed}ms`);
    
    // 尝试获取当前页面状态用于调试
    try {
      if (chrome && chrome.browser) {
        const context = chrome.browser.contexts()[0];
        const pages = context.pages();
        if (pages.length > 0) {
          const page = pages[0];
          const url = page.url();
          const title = await page.title().catch(() => '未知');
          logger.error(`当前页面 - URL: ${url}, 标题: ${title}`);
          
          // 尝试获取页面内容预览
          const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 300)).catch(() => '无法获取');
          logger.error(`页面内容预览: ${bodyText}`);
        }
      }
    } catch (debugErr) {
      logger.error(`获取页面调试信息失败: ${debugErr.message}`);
    }
    
    logger.error('========== 错误日志结束 ==========');
    logger.info('========== 商品数据同步结束（异常） ==========');
    process.exit(1);
  } finally {
    if (db) db.close();
    // 注意：不关闭 chrome，保持运行状态
  }
}

// 执行
main();