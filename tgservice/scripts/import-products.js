/**
 * 导入商品数据到天宫国际数据库
 * 1. 过滤"美女教练"类别
 * 2. 同名商品覆盖更新
 * 3. 更新分类表
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = '/TG/tgservice/db/tgservice.db';
const DATA_FILE = '/TG/tgservice/data/taikeduo-products.json';

async function main() {
  // 读取采集数据
  console.log('读取采集数据...');
  const products = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  console.log(`共 ${products.length} 条商品`);
  
  // 过滤美女教练
  const filteredProducts = products.filter(p => p.category !== '美女教练');
  console.log(`过滤"美女教练"后: ${filteredProducts.length} 条`);
  
  // 统计过滤掉的数量
  const removedCount = products.length - filteredProducts.length;
  console.log(`已过滤"美女教练" ${removedCount} 条`);
  
  // 连接数据库
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('数据库连接失败:', err);
      process.exit(1);
    }
    console.log('数据库已连接');
  });
  
  // Promise 化数据库操作
  const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  };
  
  const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  };
  
  // 导入商品表
  console.log('\n导入商品表...');
  let inserted = 0, updated = 0, skipped = 0;
  
  for (const p of filteredProducts) {
    if (!p.name || p.name.trim() === '') {
      skipped++;
      continue;
    }
    
    // 检查是否存在（name 是主键）
    const existing = await dbGet('SELECT name FROM products WHERE name = ?', [p.name]);
    
    if (existing) {
      // 更新
      await dbRun(
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
      // 插入
      await dbRun(
        `INSERT INTO products (name, image_url, price, stock_total, stock_available, category, status, creator, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))`,
        [p.name, p.imageUrl, p.price, p.stockTotal, p.stockAvailable, p.category, p.status, p.creator]
      );
      inserted++;
    }
  }
  
  console.log(`  新增: ${inserted} 条`);
  console.log(`  更新: ${updated} 条`);
  console.log(`  跳过: ${skipped} 条`);
  
  // 更新分类表
  console.log('\n更新分类表...');
  
  // 获取所有分类（去重）
  const categories = [...new Set(filteredProducts.map(p => p.category).filter(c => c))];
  console.log(`发现 ${categories.length} 个分类: ${categories.join(', ')}`);
  
  let catInserted = 0, catUpdated = 0;
  
  for (const cat of categories) {
    const existing = await dbGet('SELECT name FROM product_categories WHERE name = ?', [cat]);
    
    if (existing) {
      catUpdated++;
    } else {
      await dbRun(
        `INSERT INTO product_categories (name, creator, created_at) VALUES (?, 'system', datetime('now', 'localtime'))`,
        [cat]
      );
      catInserted++;
    }
  }
  
  console.log(`  新增: ${catInserted} 个`);
  console.log(`  已存在: ${catUpdated} 个`);
  
  // 分类统计
  console.log('\n各分类导入数量:');
  const categoryCount = {};
  filteredProducts.forEach(p => {
    const cat = p.category || '未分类';
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });
  Object.entries(categoryCount).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count} 件`);
  });
  
  db.close();
  
  console.log('\n✅ 导入完成！');
  console.log(`商品表: 新增 ${inserted} 条，更新 ${updated} 条`);
  console.log(`分类表: 新增 ${catInserted} 个，已存在 ${catUpdated} 个`);
}

main().catch(err => {
  console.error('导入失败:', err);
  process.exit(1);
});