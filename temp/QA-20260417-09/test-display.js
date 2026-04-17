const puppeteer = require('puppeteer');

async function test() {
  console.log('=== 通过页面显示验证逻辑 ===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222'
  });
  
  // 测试1: 普通用户 - 应该显示TableInfo组件（非员工模式）
  console.log('--- 测试1: 普通用户 ---');
  const page1 = await browser.newPage();
  await page1.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await page1.evaluate(() => {
    localStorage.setItem('tableName', 'VIP3');
    localStorage.setItem('tableAuth', JSON.stringify({table:'VIP3', time:Date.now()}));
    // 不设置任何token
  });
  
  await page1.goto('http://127.0.0.1:8089/pages/cart/cart', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const display1 = await page1.evaluate(() => {
    // 检查页面结构
    const employeeBar = document.querySelector('.employee-table-bar');
    const tableInfoWrapper = document.querySelector('.table-info-wrapper');
    
    return {
      hasEmployeeBar: !!employeeBar,
      employeeBarText: employeeBar ? employeeBar.innerText : null,
      hasTableInfoWrapper: !!tableInfoWrapper,
      tableInfoText: tableInfoWrapper ? tableInfoWrapper.innerText : null,
      tableNameStorage: localStorage.getItem('tableName')
    };
  });
  
  console.log('普通用户购物车:', JSON.stringify(display1, null, 2));
  console.log('预期: 无employeeBar（非员工），tableName保持VIP3\n');
  await page1.close();
  
  // 测试2: 助教用户 - 应该显示employee-table-bar（员工模式）
  console.log('--- 测试2: 助教用户 ---');
  const page2 = await browser.newPage();
  await page2.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await page2.evaluate(() => {
    localStorage.setItem('tableName', '普台5');
    localStorage.setItem('coachToken', '助教登录token');
    localStorage.setItem('coachInfo', JSON.stringify({coachNo:'10011', stageName:'十七'}));
  });
  
  await page2.goto('http://127.0.0.1:8089/pages/cart/cart', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const display2 = await page2.evaluate(() => {
    const employeeBar = document.querySelector('.employee-table-bar');
    const tableInfoWrapper = document.querySelector('.table-info-wrapper');
    
    return {
      hasEmployeeBar: !!employeeBar,
      employeeBarText: employeeBar ? employeeBar.innerText : null,
      hasTableInfoWrapper: !!tableInfoWrapper,
      tableInfoText: tableInfoWrapper ? tableInfoWrapper.innerText : null,
      tableNameStorage: localStorage.getItem('tableName'),
      coachTokenStorage: localStorage.getItem('coachToken')
    };
  });
  
  console.log('助教购物车:', JSON.stringify(display2, null, 2));
  console.log('预期: 有employeeBar显示"台桌：未选择"，tableName被清空\n');
  await page2.close();
  
  // 测试3: 后台用户
  console.log('--- 测试3: 后台用户 ---');
  const page3 = await browser.newPage();
  await page3.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await page3.evaluate(() => {
    localStorage.setItem('tableName', '普台5');
    localStorage.setItem('adminToken', '后台登录token');
    localStorage.setItem('adminInfo', JSON.stringify({username:'tgadmin'}));
  });
  
  await page3.goto('http://127.0.0.1:8089/pages/cart/cart', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const display3 = await page3.evaluate(() => {
    const employeeBar = document.querySelector('.employee-table-bar');
    const tableInfoWrapper = document.querySelector('.table-info-wrapper');
    
    return {
      hasEmployeeBar: !!employeeBar,
      employeeBarText: employeeBar ? employeeBar.innerText : null,
      tableNameStorage: localStorage.getItem('tableName'),
      adminTokenStorage: localStorage.getItem('adminToken')
    };
  });
  
  console.log('后台购物车:', JSON.stringify(display3, null, 2));
  console.log('预期: 有employeeBar显示"台桌：未选择"，tableName被清空\n');
  await page3.close();
  
  console.log('=== 测试结束 ===');
  browser.disconnect();
}

test().catch(console.error);