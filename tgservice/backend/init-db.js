/**
 * 数据库初始化脚本
 * 创建数据表并导入初始数据
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// 汉字转拼音映射（常用字）
const pinyinMap = {
  '普': 'pu', '台': 'tai', '空': 'kong', '闲': 'xian', '计': 'ji', '费': 'fei', '中': 'zhong',
  '包': 'bao', '厢': 'xiang', '雀': 'que', '斯': 'si', '诺': 'nuo', '克': 'ke',
  '大': 'da', '厅': 'ting', '棋': 'qi', '牌': 'pai', '虚': 'xu', '拟': 'ni',
  'V': 'V', 'I': 'I', 'P': 'P', 'B': 'B', 'O': 'S', 'T': 'T',
  '乔': 'qiao', '氏': 'shi', '已': 'yi', '暂': 'zan', '停': 'ting'
};

// 汉字转拼音
function toPinyin(text) {
  let result = '';
  for (const char of text) {
    if (pinyinMap[char]) {
      result += pinyinMap[char];
    } else if (/[a-zA-Z0-9]/.test(char)) {
      result += char.toLowerCase();
    } else {
      // 对于映射表中没有的汉字，使用Unicode转拼音（简化处理）
      result += char;
    }
  }
  return result;
}

// 配置
const DB_PATH = path.join(__dirname, '../db/tgservice.db');
const DATA_PATH = '/TG/data/taikeduo-products.json';
const TABLES_DATA_PATH = '/TG/data/taikeduo-tables.json';
const CONFIG_PATH = path.join(__dirname, '../.config');

// 日志函数
const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);
const error = (msg) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`);

// 创建数据库连接
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    error(`无法连接数据库: ${err.message}`);
    process.exit(1);
  }
  log(`数据库已连接: ${DB_PATH}`);
});

// 创建数据表
function createTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. 后台用户表
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_users (
          username TEXT PRIMARY KEY,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) error(`创建admin_users表失败: ${err.message}`);
        else log('表创建成功: admin_users');
      });

      // 2. 商品分类表
      db.run(`
        CREATE TABLE IF NOT EXISTS product_categories (
          name TEXT PRIMARY KEY,
          creator TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) error(`创建product_categories表失败: ${err.message}`);
        else log('表创建成功: product_categories');
      });

      // 3. 商品表
      db.run(`
        CREATE TABLE IF NOT EXISTS products (
          name TEXT PRIMARY KEY,
          category TEXT,
          image_url TEXT,
          price REAL DEFAULT 0,
          stock_total INTEGER DEFAULT 0,
          stock_available INTEGER DEFAULT 0,
          status TEXT DEFAULT '上架',
          creator TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category) REFERENCES product_categories(name)
        )
      `, (err) => {
        if (err) error(`创建products表失败: ${err.message}`);
        else log('表创建成功: products');
      });

      // 4. 助教表
      db.run(`
        CREATE TABLE IF NOT EXISTS coaches (
          coach_no TEXT PRIMARY KEY,
          employee_id TEXT,
          stage_name TEXT,
          real_name TEXT,
          id_card_last6 TEXT,
          level TEXT DEFAULT '初级',
          price REAL DEFAULT 2.3,
          age INTEGER,
          height INTEGER,
          photos TEXT,
          video TEXT,
          intro TEXT,
          is_popular INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) error(`创建coaches表失败: ${err.message}`);
        else log('表创建成功: coaches');
      });

      // 助教表唯一索引：工号+艺名组合唯一
      db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_coaches_employee_stage_unique ON coaches(employee_id, stage_name)
      `, (err) => {
        if (err) error(`创建coaches唯一索引失败: ${err.message}`);
        else log('索引创建成功: idx_coaches_employee_stage_unique');
      });

      // 5. 购物车表
      db.run(`
        CREATE TABLE IF NOT EXISTS carts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          table_no TEXT,
          product_name TEXT NOT NULL,
          quantity INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) error(`创建carts表失败: ${err.message}`);
        else log('表创建成功: carts');
      });

      // 6. 订单表
      db.run(`
        CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_no TEXT UNIQUE NOT NULL,
          table_no TEXT,
          items TEXT NOT NULL,
          total_price REAL DEFAULT 0,
          status TEXT DEFAULT '待处理',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) error(`创建orders表失败: ${err.message}`);
        else log('表创建成功: orders');
      });

      // 7. 首页配置表
      db.run(`
        CREATE TABLE IF NOT EXISTS home_config (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          banner_image TEXT,
          banner_title TEXT DEFAULT '充值送台费活动',
          banner_desc TEXT DEFAULT '充值满500送50元台费，多充多送',
          hot_products TEXT,
          popular_coaches TEXT,
          notice TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) error(`创建home_config表失败: ${err.message}`);
        else log('表创建成功: home_config');
      });

      // 8. 台桌表
      db.run(`
        CREATE TABLE IF NOT EXISTS tables (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          area TEXT NOT NULL,
          name TEXT NOT NULL UNIQUE,
          name_pinyin TEXT UNIQUE,
          status TEXT DEFAULT '空闲',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) error(`创建tables表失败: ${err.message}`);
        else log('表创建成功: tables');
      });

      // 9. 包房表
      db.run(`
        CREATE TABLE IF NOT EXISTS vip_rooms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          status TEXT DEFAULT '空闲',
          intro TEXT,
          photos TEXT,
          videos TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) error(`创建vip_rooms表失败: ${err.message}`);
        else log('表创建成功: vip_rooms');
      });

      // 插入默认首页配置
      db.run(`
        INSERT OR IGNORE INTO home_config (id) VALUES (1)
      `);

      resolve();
    });
  });
}

// 检查是否已有数据（保护机制）
async function checkExistingData() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT 
      (SELECT COUNT(*) FROM admin_users) as admin_count,
      (SELECT COUNT(*) FROM products) as product_count,
      (SELECT COUNT(*) FROM coaches) as coach_count,
      (SELECT COUNT(*) FROM vip_rooms) as vip_count
    `, [], (err, row) => {
      if (err) {
        error(`检查数据失败: ${err.message}`);
        resolve(false);
      } else {
        resolve(row);
      }
    });
  });
}

// 导入初始数据
async function importData() {
  // 检查是否已有数据（保护机制）
  const existingData = await checkExistingData();
  if (existingData && (existingData.admin_count > 0 || existingData.product_count > 0 || existingData.coach_count > 0)) {
    log('==========================================');
    log('检测到已有数据，跳过初始化导入：');
    log(`  - 后台用户: ${existingData.admin_count} 条`);
    log(`  - 商品: ${existingData.product_count} 条`);
    log(`  - 助教: ${existingData.coach_count} 条`);
    log(`  - 包房: ${existingData.vip_count} 条`);
    log('');
    log('如需重新初始化，请先清空数据库或删除数据库文件。');
    log('==========================================');
    return;
  }

  log('开始导入初始数据...');

  // 1. 导入后台用户
  const hashedPassword = await bcrypt.hash('mms633268', 10);
  await new Promise((resolve, reject) => {
    db.run(
      'INSERT OR IGNORE INTO admin_users (username, password) VALUES (?, ?)',
      ['tgadmin', hashedPassword],
      (err) => {
        if (err) error(`导入后台用户失败: ${err.message}`);
        else log('后台用户导入成功: tgadmin');
        resolve();
      }
    );
  });

  // 2. 读取商品数据
  if (!fs.existsSync(DATA_PATH)) {
    error(`数据文件不存在: ${DATA_PATH}`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  const products = data.products || [];

  // 过滤掉美女教练类别
  const normalProducts = products.filter(p => p.category !== '美女教练');
  const coachProducts = products.filter(p => p.category === '美女教练');

  log(`商品数据: ${normalProducts.length} 条商品, ${coachProducts.length} 条助教`);

  // 3. 导入商品分类
  const categories = [...new Set(normalProducts.map(p => p.category))];
  for (const cat of categories) {
    await new Promise((resolve) => {
      db.run(
        'INSERT OR IGNORE INTO product_categories (name, creator, created_at) VALUES (?, ?, datetime("now", "localtime"))',
        [cat, 'system'],
        (err) => {
          if (err) error(`导入分类失败: ${err.message}`);
          resolve();
        }
      );
    });
  }
  log(`商品分类导入成功: ${categories.length} 个分类`);

  // 4. 导入商品
  let productCount = 0;
  for (const p of normalProducts) {
    await new Promise((resolve) => {
      db.run(
        `INSERT OR IGNORE INTO products 
        (name, category, image_url, price, stock_total, stock_available, status, creator, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime("now", "localtime"), datetime("now", "localtime"))`,
        [
          p.name,
          p.category,
          p.image,
          parseFloat(p.price) || 0,
          p.stock?.total || 0,
          p.stock?.available || 0,
          p.status || '上架',
          p.creator || 'system'
        ],
        (err) => {
          if (!err) productCount++;
          resolve();
        }
      );
    });
  }
  log(`商品导入成功: ${productCount} 条`);

  // 5. 导入助教数据
  // 解析助教名称: "26号四瑶（女神）" -> {no: "26", name: "四瑶", level: "女神"}
  let coachCount = 0;
  for (let i = 0; i < coachProducts.length; i++) {
    const p = coachProducts[i];
    // 尝试解析名称格式: XX号XXX（X级）或 XX号XXX(X级)
    const match = p.name.match(/(\d+)号(.+?)[（(](.+?)[）)]/);
    if (match) {
      const coachNo = match[1];
      const stageName = match[2];
      const level = match[3];
      
      await new Promise((resolve) => {
        db.run(
          `INSERT OR IGNORE INTO coaches 
          (coach_no, employee_id, stage_name, level, photos, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime("now", "localtime"), datetime("now", "localtime"))`,
          [coachNo, coachNo, stageName, level, JSON.stringify([p.image])],
          (err) => {
            if (!err) coachCount++;
            resolve();
          }
        );
      });
    }
  }
  log(`助教导入成功: ${coachCount} 条`);

  // 6. 导入台桌数据
  if (fs.existsSync(TABLES_DATA_PATH)) {
    const tablesData = JSON.parse(fs.readFileSync(TABLES_DATA_PATH, 'utf-8'));
    const tables = tablesData.tables || {};
    let tableCount = 0;
    
    for (const [area, tableList] of Object.entries(tables)) {
      // 跳过虚拟区
      if (area === '虚拟区') continue;
      
      for (const t of tableList) {
        const name = t.name;
        const namePinyin = toPinyin(name);
        const status = t.status || '空闲';
        
        await new Promise((resolve) => {
          db.run(
            `INSERT OR IGNORE INTO tables (area, name, name_pinyin, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, datetime("now", "localtime"), datetime("now", "localtime"))`,
            [area, name, namePinyin, status],
            (err) => {
              if (!err) tableCount++;
              resolve();
            }
          );
        });
      }
    }
    log(`台桌导入成功: ${tableCount} 条`);
  } else {
    error(`台桌数据文件不存在: ${TABLES_DATA_PATH}`);
  }

  // 输出统计
  await printStats();
}

// 打印数据统计
async function printStats() {
  const stats = {};
  
  await new Promise((resolve) => {
    db.get('SELECT COUNT(*) as count FROM admin_users', [], (err, row) => {
      stats.admin_users = row?.count || 0;
      resolve();
    });
  });

  await new Promise((resolve) => {
    db.get('SELECT COUNT(*) as count FROM product_categories', [], (err, row) => {
      stats.product_categories = row?.count || 0;
      resolve();
    });
  });

  await new Promise((resolve) => {
    db.get('SELECT COUNT(*) as count FROM products', [], (err, row) => {
      stats.products = row?.count || 0;
      resolve();
    });
  });

  await new Promise((resolve) => {
    db.get('SELECT COUNT(*) as count FROM coaches', [], (err, row) => {
      stats.coaches = row?.count || 0;
      resolve();
    });
  });

  await new Promise((resolve) => {
    db.get('SELECT COUNT(*) as count FROM tables', [], (err, row) => {
      stats.tables = row?.count || 0;
      resolve();
    });
  });

  await new Promise((resolve) => {
    db.get('SELECT COUNT(*) as count FROM vip_rooms', [], (err, row) => {
      stats.vip_rooms = row?.count || 0;
      resolve();
    });
  });

  log('\n========== 数据导入统计 ==========');
  log(`后台用户表: ${stats.admin_users} 条`);
  log(`商品分类表: ${stats.product_categories} 条`);
  log(`商品表: ${stats.products} 条`);
  log(`助教表: ${stats.coaches} 条`);
  log(`台桌表: ${stats.tables || 0} 条`);
  log(`包房表: ${stats.vip_rooms || 0} 条`);
  log('==================================\n');
}

// 主函数
async function main() {
  try {
    await createTables();
    await importData();
    log('数据库初始化完成！');
    
    db.close((err) => {
      if (err) error(`关闭数据库失败: ${err.message}`);
      else log('数据库连接已关闭');
    });
  } catch (err) {
    error(`初始化失败: ${err.message}`);
    process.exit(1);
  }
}

main();
