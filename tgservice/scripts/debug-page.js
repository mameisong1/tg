/**
 * 调试台客多商品列表页面
 */

const { chromium } = require('playwright');

async function main() {
  console.log('连接 mychrome...');
  
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  
  if (contexts.length === 0) {
    console.error('没有可用的浏览器上下文');
    process.exit(1);
  }
  
  const context = contexts[0];
  let page = context.pages()[0] || await context.newPage();
  
  console.log('当前页面:', page.url());
  
  // 打开商品列表页面
  console.log('打开台客多商品列表页面...');
  await page.goto('https://admin.taikeduo.com/#/productManagement/productList', { waitUntil: 'networkidle', timeout: 30000 });
  
  console.log('当前 URL:', page.url());
  
  await page.waitForTimeout(5000);
  
  // 截图
  await page.screenshot({ path: '/TG/tgservice/data/taikeduo-page.png', fullPage: true });
  console.log('截图已保存到 /TG/tgservice/data/taikeduo-page.png');
  
  // 获取页面标题
  const title = await page.title();
  console.log('页面标题:', title);
  
  // 获取页面文本内容
  const bodyText = await page.textContent('body');
  console.log('\n页面文本前 2000 字符:');
  console.log(bodyText.substring(0, 2000));
  
  // 检查是否有表格
  const tables = await page.$$('table');
  console.log(`\n找到 ${tables.length} 个表格`);
  
  // 检查分页
  const pagination = await page.$$('.ant-pagination, .el-pagination');
  console.log(`找到 ${pagination.length} 个分页组件`);
  
  // 尝试获取商品列表
  const rows = await page.$$('table tbody tr, .el-table__body-wrapper tr, .ant-table-tbody tr');
  console.log(`找到 ${rows.length} 个表格行`);
  
  // 检查是否有"共 xx 件"文本
  const totalMatch = bodyText.match(/共\s*(\d+)\s*件/);
  if (totalMatch) {
    console.log(`\n找到总件数: ${totalMatch[1]}`);
  } else {
    console.log('\n未找到"共 xx 件"文本');
  }
  
  await browser.close();
}

main().catch(err => {
  console.error('调试失败:', err);
  process.exit(1);
});