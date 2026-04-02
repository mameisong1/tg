/**
 * 检查台客多商品列表完整结构
 */

const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  let page = context.pages()[0] || await context.newPage();
  
  await page.goto('https://admin.taikeduo.com/#/productManagement/productList', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // 获取表头
  const headers = await page.evaluate(() => {
    const ths = document.querySelectorAll('table thead th');
    return Array.from(ths).map(th => th.textContent.trim());
  });
  
  console.log('表头:', headers);
  
  // 获取第一行所有单元格内容
  const rowCells = await page.evaluate(() => {
    const row = document.querySelector('table tbody tr');
    if (!row) return [];
    
    const cells = row.querySelectorAll('td');
    return Array.from(cells).map((td, i) => ({
      index: i,
      text: td.textContent.trim().substring(0, 100),
      hasImg: !!td.querySelector('img'),
      imgCount: td.querySelectorAll('img').length
    }));
  });
  
  console.log('\n第一行单元格:');
  rowCells.forEach(c => console.log(`  [${c.index}] ${c.hasImg ? '📷' : ''} ${c.text}`));
  
  // 检查是否有商品图片列
  const fullRow = await page.evaluate(() => {
    const row = document.querySelector('table tbody tr');
    return row ? row.innerHTML : '';
  });
  
  // 搜索img标签
  const imgMatches = fullRow.match(/<img[^>]*>/g) || [];
  console.log(`\n找到 ${imgMatches.length} 个img标签`);
  if (imgMatches.length > 0) {
    console.log('示例:', imgMatches.slice(0, 3));
  }
  
  // 检查整个页面是否有任何图片
  const allImages = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img');
    return Array.from(imgs).slice(0, 10).map(img => ({
      src: img.src?.substring(0, 100),
      alt: img.alt
    }));
  });
  
  console.log('\n页面前10个图片:');
  allImages.forEach(img => console.log(`  ${img.src}`));
  
  await browser.close();
}

main();