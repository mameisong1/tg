const puppeteer = require('puppeteer');
const fs = require('fs');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  
  const page = await browser.newPage();
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
  };
  
  try {
    // 访问登录页面
    console.log('访问登录页面...');
    await page.goto('https://tg.tiangong.club/admin/login.html', { waitUntil: 'networkidle2' });
    
    // 登录
    console.log('执行登录...');
    await page.type('#username', 'tgadmin');
    await page.type('#password', 'mms633268');
    await page.click('.login-btn');
    
    // 等待跳转
    await delay(2000);
    await page.waitForNavigation({ timeout: 5000 }).catch(() => {});
    
    // 导航到助教列表页面
    console.log('导航到助教列表页面...');
    await page.goto('https://tg.tiangong.club/admin/coaches.html', { waitUntil: 'networkidle2' });
    await delay(3000);
    
    // 获取页面截图
    await page.screenshot({ path: '/TG/docs/temp/coaches-page.png', fullPage: true });
    console.log('助教列表页面截图已保存');
    
    // 获取页面内容
    const content = await page.content();
    fs.writeFileSync('/TG/docs/temp/coaches-content.html', content);
    console.log('助教列表页面内容已保存');
    
    // 检查页面上的按钮和功能
    console.log('\n分析页面元素...');
    
    // 查找所有按钮
    const buttons = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      return Array.from(btns).map(btn => ({
        text: btn.textContent.trim(),
        className: btn.className,
        disabled: btn.disabled,
        onclick: btn.onclick ? '有onclick' : '无onclick'
      }));
    });
    
    console.log('页面按钮:');
    buttons.forEach(btn => {
      console.log(`  - "${btn.text}" ${btn.disabled ? '(禁用)' : '(可用)'}`);
    });
    
    // 查找表格结构
    const tableInfo = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      return Array.from(tables).map(table => ({
        rows: table.querySelectorAll('tr').length,
        headers: Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim())
      }));
    });
    
    console.log('\n表格信息:', tableInfo);
    
    // 查找是否有上班/下班按钮列
    const actionButtons = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr');
      return Array.from(rows).slice(1, 10).map(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 0) return null;
        
        const name = cells[0]?.textContent?.trim() || '';
        const status = cells[1]?.textContent?.trim() || '';
        const buttons = Array.from(row.querySelectorAll('button')).map(btn => ({
          text: btn.textContent.trim(),
          disabled: btn.disabled
        }));
        
        return { name, status, buttons };
      }).filter(r => r !== null);
    });
    
    console.log('\n助教行数据（前10行）:');
    actionButtons.forEach(row => {
      console.log(`  ${row.name} (${row.status}):`);
      row.buttons.forEach(btn => {
        console.log(`    - ${btn.text} ${btn.disabled ? '[禁用]' : '[可用]'}`);
      });
    });
    
    results.buttons = buttons;
    results.actionButtons = actionButtons;
    
  } catch (error) {
    console.error('测试执行错误:', error);
    results.error = error.message;
  } finally {
    await browser.close();
  }
  
  return results;
}

runTest().then(results => {
  fs.writeFileSync('/TG/docs/temp/coaches-test-results.json', JSON.stringify(results, null, 2));
  console.log('\n测试完成');
});