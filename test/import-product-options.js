/**
 * 商品选项数据导入脚本
 * 从 Excel 读取数据并写入 dev/prod 数据库
 * 
 * 运行方式：
 *   node import-product-options.js
 *   node import-product-options.js --env=prod
 */

const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 配置
const EXCEL_PATH = '/TG/docs/商品选项（奶茶店）.xlsx';
const DEV_DB_PATH = '/TG/tgservice/db/tgservice.db';
const PROD_DB_PATH = '/TG/run/db/tgservice.db';  // 生产环境数据库路径

// 解析命令行参数
const args = process.argv.slice(2);
const envArg = args.find(a => a.startsWith('--env='));
const targetEnv = envArg ? envArg.split('=')[1] : 'dev';

// 确定目标数据库
const dbPath = targetEnv === 'prod' ? PROD_DB_PATH : DEV_DB_PATH;

console.log('========================================');
console.log('商品选项数据导入工具');
console.log('========================================');
console.log(`目标环境: ${targetEnv}`);
console.log(`数据库路径: ${dbPath}`);
console.log(`Excel路径: ${EXCEL_PATH}`);
console.log('');

// 检查 Excel 文件
if (!fs.existsSync(EXCEL_PATH)) {
  console.error('❌ Excel 文件不存在:', EXCEL_PATH);
  console.log('');
  console.log('请创建 Excel 文件，格式如下：');
  console.log('');
  console.log('| 分类 | 商品名称 | 选项类型 | 可选值 | 默认值 | 是否必选 | 排序 |');
  console.log('|------|----------|----------|--------|--------|----------|------|');
  console.log('| 奶茶店 | 所有商品 | temperature | 热,温,冷,冰 | 温 | 是 | 0 |');
  console.log('| 奶茶店 | 所有商品 | sugar | 全糖,七分糖,半糖,三分糖,无糖 | 半糖 | 是 | 1 |');
  console.log('| 奶茶店 | 珍珠奶茶 | temperature | 热,温,冷 | 温 | 是 | 0 |');
  console.log('');
  console.log('说明：');
  console.log('  - "所有商品" 表示分类通配，适用于该分类下所有商品');
  console.log('  - 具体商品名表示精确匹配，优先级高于通配');
  console.log('  - 可选值用逗号分隔');
  console.log('  - 是否必选：是/否');
  console.log('');
  process.exit(1);
}

// 连接数据库
console.log('📦 连接数据库...');
const db = new Database(dbPath);
console.log('✅ 数据库已连接');

// 创建表（如不存在）
console.log('');
console.log('📋 创建 product_options 表...');
db.exec(`
  CREATE TABLE IF NOT EXISTS product_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    product_name TEXT NOT NULL,
    option_type TEXT NOT NULL,
    option_values TEXT NOT NULL,
    default_value TEXT,
    is_required INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_product_options_category ON product_options(category)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_product_options_product ON product_options(product_name)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_product_options_type ON product_options(option_type)`);
console.log('✅ 表已创建');

// 读取 Excel
console.log('');
console.log('📊 读取 Excel 文件...');
const workbook = XLSX.readFile(EXCEL_PATH);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

console.log(`✅ 读取到 ${data.length} 条数据`);

// 清空旧数据
console.log('');
console.log('🗑️  清空旧数据...');
db.exec('DELETE FROM product_options');
console.log('✅ 已清空');

// 准备插入语句
const insertStmt = db.prepare(`
  INSERT INTO product_options 
  (category, product_name, option_type, option_values, default_value, is_required, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// 转换并插入数据
console.log('');
console.log('💾 导入数据...');
let successCount = 0;
let errorCount = 0;

data.forEach((row, index) => {
  try {
    const category = row['分类'] || row['category'] || '';
    const productName = row['商品名称'] || row['product_name'] || '';
    const optionType = row['选项类型'] || row['option_type'] || '';
    const optionValuesRaw = row['可选值'] || row['option_values'] || '';
    const defaultValue = row['默认值'] || row['default_value'] || '';
    const isRequiredRaw = row['是否必选'] || row['is_required'] || '否';
    const sortOrderRaw = row['排序'] || row['sort_order'] || '0';

    // 验证必填字段
    if (!category || !productName || !optionType || !optionValuesRaw) {
      console.log(`⚠️  行 ${index + 1}: 缺少必填字段，跳过`);
      errorCount++;
      return;
    }

    // 转换可选值为 JSON 数组
    const valuesArray = optionValuesRaw.split(',').map(v => v.trim()).filter(v => v);
    const optionValues = JSON.stringify(valuesArray);

    // 转换是否必选
    const isRequired = (isRequiredRaw === '是' || isRequiredRaw === '1' || isRequiredRaw === 'true') ? 1 : 0;

    // 转换排序
    const sortOrder = parseInt(sortOrderRaw) || 0;

    // 插入
    insertStmt.run(category, productName, optionType, optionValues, defaultValue, isRequired, sortOrder);
    successCount++;

    console.log(`✅ 行 ${index + 1}: ${category}/${productName}/${optionType}`);

  } catch (err) {
    console.log(`❌ 行 ${index + 1}: ${err.message}`);
    errorCount++;
  }
});

// 统计
console.log('');
console.log('========================================');
console.log('导入结果');
console.log('========================================');
console.log(`✅ 成功: ${successCount} 条`);
console.log(`❌ 失败: ${errorCount} 条`);

// 查询验证
console.log('');
console.log('📋 数据验证...');
const count = db.prepare('SELECT COUNT(*) as count FROM product_options').get();
console.log(`product_options 表记录数: ${count.count}`);

// 显示导入的数据
const samples = db.prepare('SELECT * FROM product_options LIMIT 10').all();
console.log('');
console.log('示例数据:');
samples.forEach(row => {
  console.log(`  ${row.category}/${row.product_name}/${row.option_type}: ${row.option_values} (默认: ${row.default_value || '-'})`);
});

// 关闭数据库
db.close();
console.log('');
console.log('🎉 导入完成！');