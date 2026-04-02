/**
 * 采集台客多商品数据 - Element Plus 版
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = '/TG/tgservice/data/taikeduo-products.json';
const products = [];

async function main() {
  console.log('连接 mychrome...');
  
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  let page = context.pages()[0] || await context.newPage();
  
  console.log('打开台客多商品列表页面...');
  await page.goto('https://admin.taikeduo.com/#/productManagement/productList', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // 获取总条数
  const totalText = await page.textContent('.el-pagination__total');
  const totalMatch = totalText.match(/共\s*(\d+)\s*条/);
  const total = totalMatch ? parseInt(totalMatch[1]) : 0;
  console.log(`总商品数: ${total}`);
  
  if (total < 190) {
    console.log(`⚠️ 商品数量 ${total} < 190，继续采集但需注意`);
  }
  
  // 获取总页数
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);
  console.log(`共 ${totalPages} 页`);
  
  console.log('开始采集商品数据...');
  
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    console.log(`采集第 ${pageNum}/${totalPages} 页...`);
    
    // 如果不是第一页，点击对应页码
    if (pageNum > 1) {
      // 点击页码按钮
      const pageClicked = await page.evaluate((targetPage) => {
        // Element Plus 分页
        const pagerItems = document.querySelectorAll('.el-pager li');
        for (const item of pagerItems) {
          if (item.textContent.trim() === String(targetPage)) {
            item.click();
            return true;
          }
        }
        
        // 如果找不到直接页码，尝试点击下一页
        const nextBtn = document.querySelector('.btn-next:not(.disabled)');
        if (nextBtn) {
          nextBtn.click();
          return true;
        }
        
        return false;
      }, pageNum);
      
      if (!pageClicked) {
        console.log(`  无法跳转到第 ${pageNum} 页`);
        break;
      }
      
      await page.waitForTimeout(2000);
    }
    
    // 获取当前页数据
    const rowsData = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      const results = [];
      
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 5) continue;
        
        const cellTexts = Array.from(cells).map(c => c.innerText.trim());
        
        // 商品名称在第一个单元格
        const name = cellTexts[0].split('\n')[0].trim();
        
        // 获取图片
        const img = cells[0].querySelector('img');
        const imageUrl = img ? img.src : '';
        
        // 解析数据
        let price = '', stockTotal = 0, stockAvailable = 0, category = '', status = '', creator = '', createTime = '';
        
        for (const text of cellTexts) {
          // 零售价
          if (!price && /^\d+\.?\d*$/.test(text.trim())) {
            price = text.trim();
          }
          
          // 库存
          if (text.includes('总:')) {
            const tm = text.match(/总:\s*(\d+)/);
            const am = text.match(/可用:\s*(\d+)/);
            if (tm) stockTotal = parseInt(tm[1]);
            if (am) stockAvailable = parseInt(am[1]);
          }
          
          // 分类
          for (const cat of ['美女教练', '高汤', '饮料', '零食', '泡面', '酒水', '槟榔', '奶茶店', '其他', '小吃']) {
            if (text === cat || text.includes(cat)) {
              category = cat;
              break;
            }
          }
          
          // 状态
          if (text.includes('上架') && !text.includes('下架')) {
            status = '上架';
          } else if (text.includes('下架')) {
            status = '下架';
          }
          
          // 创建人
          const creatorMatch = text.match(/(syb\d+)/);
          if (creatorMatch) creator = creatorMatch[1];
          
          // 创建时间
          const timeMatch = text.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
          if (timeMatch) createTime = timeMatch[1];
        }
        
        if (name && name.length > 0 && !name.includes('商品名称')) {
          results.push({ name, imageUrl, price, stockTotal, stockAvailable, category, status, creator, createTime });
        }
      }
      
      return results;
    });
    
    console.log(`  找到 ${rowsData.length} 条商品`);
    products.push(...rowsData);
  }
  
  // 去重
  const productMap = new Map();
  products.forEach(p => {
    if (p.name) productMap.set(p.name, p);
  });
  const uniqueProducts = Array.from(productMap.values());
  
  console.log(`\n采集完成！共 ${products.length} 条，去重后 ${uniqueProducts.length} 条`);
  
  // 分类统计
  const categoryCount = {};
  uniqueProducts.forEach(p => {
    const cat = p.category || '未分类';
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });
  
  console.log('\n分类统计:');
  Object.entries(categoryCount).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count} 件`);
  });
  
  // 检查数量
  if (uniqueProducts.length < 190) {
    console.log(`\n⚠️ 采集数量 ${uniqueProducts.length} < 190，任务中止！`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniqueProducts, null, 2));
    process.exit(1);
  }
  
  // 保存
  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniqueProducts, null, 2), 'utf-8');
  console.log(`\n已保存到: ${OUTPUT_FILE}`);
  
  await browser.close();
  console.log('浏览器连接已关闭');
}

main().catch(err => {
  console.error('采集失败:', err);
  process.exit(1);
});