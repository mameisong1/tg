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
    await page.goto('https://tg.tiangong.club/admin/water-boards.html', { waitUntil: 'networkidle2' });
    
    // 登录
    console.log('执行登录...');
    await page.type('#username', 'tgadmin');
    await page.type('#password', 'mms633268');
    await page.click('.login-btn');
    
    // 等待跳转或登录成功
    await delay(2000);
    
    // 检查是否登录成功
    const currentUrl = page.url();
    console.log('当前URL:', currentUrl);
    
    // 如果还在登录页面，等待跳转
    if (currentUrl.includes('login') || currentUrl.includes('water-boards') === false) {
      await page.waitForNavigation({ timeout: 5000 }).catch(() => {});
    }
    
    // 导航到水牌管理页面
    console.log('导航到水牌管理页面...');
    await page.goto('https://tg.tiangong.club/admin/water-boards.html', { waitUntil: 'networkidle2' });
    await delay(2000);
    
    // 获取页面截图
    await page.screenshot({ path: '/TG/docs/temp/water-board-page.png' });
    console.log('页面截图已保存');
    
    // 获取页面内容
    const content = await page.content();
    fs.writeFileSync('/TG/docs/temp/water-board-content.html', content);
    console.log('页面内容已保存');
    
    // 获取助教列表
    console.log('\n获取助教列表...');
    const assistants = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr[data-id]');
      return Array.from(rows).map(row => ({
        id: row.getAttribute('data-id'),
        name: row.querySelector('.name')?.textContent?.trim() || 'Unknown',
        status: row.querySelector('.status')?.textContent?.trim() || 'Unknown',
        html: row.innerHTML
      }));
    });
    
    console.log('找到助教数量:', assistants.length);
    assistants.forEach((a, i) => {
      console.log(`  ${i+1}. ${a.name} - 状态: ${a.status}`);
    });
    
    results.assistants = assistants;
    
    // 测试用例执行
    console.log('\n开始执行测试用例...\n');
    
    // 选取一个助教进行测试
    if (assistants.length > 0) {
      const testAssistant = assistants[0];
      console.log(`选择助教进行测试: ${testAssistant.name}`);
      
      // 测试TC-A系列: 上班按钮测试
      console.log('\n=== TC-A系列: 上班按钮测试 ===');
      
      // 查找第一个助教的状态
      const firstRow = await page.$('tr[data-id]');
      if (firstRow) {
        const statusText = await page.evaluate(row => {
          const statusEl = row.querySelector('.status');
          return statusEl ? statusEl.textContent.trim() : '未找到状态';
        }, firstRow);
        
        results.details.push({
          testId: 'TC-A-INFO',
          description: '获取第一个助教状态',
          result: 'INFO',
          actual: `状态: ${statusText}`
        });
      }
      
      // 查找所有按钮
      const buttons = await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        return Array.from(btns).map(btn => ({
          text: btn.textContent.trim(),
          disabled: btn.disabled,
          className: btn.className
        }));
      });
      
      console.log('页面按钮状态:');
      buttons.forEach(btn => {
        console.log(`  - ${btn.text} ${btn.disabled ? '(禁用)' : '(可用)'}`);
      });
      
      results.pageButtons = buttons;
    }
    
  } catch (error) {
    console.error('测试执行错误:', error);
    results.error = error.message;
  } finally {
    await browser.close();
  }
  
  return results;
}

runTest().then(results => {
  fs.writeFileSync('/TG/docs/temp/test-results.json', JSON.stringify(results, null, 2));
  console.log('\n测试完成，结果已保存到 test-results.json');
});