/**
 * 更新商品图片URL到数据库
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const DB_PATH = '/TG/tgservice/db/tgservice.db';
const DATA_FILE = '/TG/tgservice/data/taikeduo-products-with-images.json';

async function main() {
  const products = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  console.log(`读取 ${products.length} 条商品数据`);
  
  const db = new sqlite3.Database(DB_PATH);
  
  const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  };
  
  let updated = 0;
  
  for (const p of products) {
    if (p.imageUrl && p.name) {
      await dbRun('UPDATE products SET image_url = ? WHERE name = ?', [p.imageUrl, p.name]);
      updated++;
    }
  }
  
  db.close();
  
  console.log(`更新了 ${updated} 条商品的图片URL`);
}

main();