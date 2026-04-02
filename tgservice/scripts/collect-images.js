/**
 * 重新采集商品图片
 */

const { chromium } = require('playwright');
const fs = require('fs');

const DATA_FILE = '/TG/tgservice/data/taikeduo-products.json';
const OUTPUT_FILE = '/TG/tgservice/data/taikeduo-products-with-images.json';

async function main() {
  // 读取已有数据
  const products = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const productMap = new Map(products.map(p => [p.name, p]));
  
  console.log('连接 mychrome...');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  let page = context.pages()[0] || await context.newPage();
  
  console.log('打开台客多商品列表页面...');
  await page.goto('https://admin.taikeduo.com/#/productManagement/productList', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // 获取总页数
  const totalText = await page.textContent('.el-pagination__total');
  const totalMatch = totalText.match(/共\s*(\d+)\s*条/);
  const total = totalMatch ? parseInt(totalMatch[1]) : 0;
  const totalPages = Math.ceil(total / 20);
  console.log(`共 ${total} 条，${totalPages} 页`);
  
  // 采集每一页的图片
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    console.log(`采集第 ${pageNum}/${totalPages} 页图片...`);
    
    // 获取当前页图片
    const pageImages = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      const results = [];
      
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) continue;
        
        // 商品名称在第一个单元格
        const name = cells[0].textContent.trim().split('\n')[0];
        
        // 图片在第二个单元格
        const img = cells[1].querySelector('img');
        const imageUrl = img ? img.src : '';
        
        if (name && imageUrl) {
          results.push({ name, imageUrl });
        }
      }
      
      return results;
    });
    
    // 更新商品图片
    for (const item of pageImages) {
      if (productMap.has(item.name)) {
        productMap.get(item.name).imageUrl = item.imageUrl;
      }
    }
    
    console.log(`  找到 ${pageImages.length} 个图片`);
    
    // 翻页
    if (pageNum < totalPages) {
      const clicked = await page.evaluate((targetPage) => {
        const pagerItems = document.querySelectorAll('.el-pager li');
        for (const item of pagerItems) {
          if (item.textContent.trim() === String(targetPage + 1)) {
            item.click();
            return true;
          }
        }
        const nextBtn = document.querySelector('.btn-next:not(.disabled)');
        if (nextBtn) {
          nextBtn.click();
          return true;
        }
        return false;
      }, pageNum);
      
      if (clicked) {
        await page.waitForTimeout(2000);
      } else {
        console.log('无法翻页，停止采集');
        break;
      }
    }
  }
  
  // 统计
  const updatedProducts = Array.from(productMap.values());
  const withImages = updatedProducts.filter(p => p.imageUrl);
  console.log(`\n采集完成！共 ${updatedProducts.length} 条，有图片 ${withImages.length} 条`);
  
  // 保存
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(updatedProducts, null, 2), 'utf-8');
  console.log(`已保存到: ${OUTPUT_FILE}`);
  
  await browser.close();
}

main().catch(err => {
  console.error('采集失败:', err);
  process.exit(1);
});