const puppeteer = require('puppeteer');

async function test() {
  console.log('=== localStorage vs uni.getStorageSync 验证 ===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222'
  });
  
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  
  // 用localStorage设置
  await page.evaluate(() => {
    localStorage.setItem('coachToken', 'test-by-localStorage');
    localStorage.setItem('adminToken', 'test-by-localStorage');
  });
  
  // 检查localStorage能读吗？
  const coachToken_localStorage = await page.evaluate(() => localStorage.getItem('coachToken'));
  console.log('localStorage.getItem("coachToken"):', coachToken_localStorage);
  
  // 检查uni能读吗？
  const coachToken_uni = await page.evaluate(() => {
    if (typeof uni !== 'undefined' && uni.getStorageSync) {
      return uni.getStorageSync('coachToken');
    }
    return 'uni不存在';
  });
  console.log('uni.getStorageSync("coachToken"):', coachToken_uni);
  
  // 进入购物车页面，检查页面读取的值
  await page.goto('http://127.0.0.1:8089/pages/cart/cart', { waitUntil: 'networkidle2' });
  
  // 检查Vue组件的isEmployee值
  const isEmployeeValue = await page.evaluate(() => {
    // 尝试从Vue组件实例获取
    const app = document.querySelector('#app');
    if (app && app.__vue_app__) {
      // 需要从组件上下文获取
      return '无法直接获取computed值';
    }
    return 'Vue实例不存在';
  });
  console.log('isEmployee computed值:', isEmployeeValue);
  
  // 检查页面显示的内容
  const pageDisplay = await page.evaluate(() => {
    const employeeBar = document.querySelector('.employee-table-bar');
    const tableInfo = document.querySelector('.table-info-wrapper');
    return {
      employeeBar: employeeBar ? employeeBar.innerText : '不存在',
      tableInfo: tableInfo ? tableInfo.innerText : '不存在'
    };
  });
  console.log('页面显示:', JSON.stringify(pageDisplay, null, 2));
  
  // 再检查localStorage
  const afterTableName = await page.evaluate(() => localStorage.getItem('tableName'));
  const afterCoachToken = await page.evaluate(() => localStorage.getItem('coachToken'));
  console.log('进入购物车后 localStorage.tableName:', afterTableName);
  console.log('进入购物车后 localStorage.coachToken:', afterCoachToken);
  
  await page.close();
  browser.disconnect();
}

test().catch(console.error);