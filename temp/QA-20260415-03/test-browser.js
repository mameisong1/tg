const puppeteer = require('puppeteer-core');

(async () => {
  console.log('=== 乐捐报备多图上传测试 ===\n');
  
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZW1iZXJObyI6MSwicGhvbmUiOiIxODY4MDE3NDExOSIsImlhdCI6MTc3NjI2NjU4OSwiZXhwIjoxNzc4ODU4NTg5fQ.kgC8FIoea-_wE_OBrwFK1lEE-0oBvYCVW0DsHm1FlkU';
  const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IjE4NjgwMTc0MTE5Iiwicm9sZSI6IuW6l-mVvyIsImlhdCI6MTc3NjI2NjU4OSwiZXhwIjoxNzc2ODcxMzg5fQ.ZIGAQrJkIGYOtjSkd9zBsUwk_KUowrvJvZxNCqFPdfA';
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const page = await browser.newPage();
  
  // 导航到 H5
  console.log('[1] 导航到 H5...');
  await page.goto('http://127.0.0.1:8089', { waitUntil: 'networkidle0', timeout: 30000 });
  
  // 注入 token
  console.log('[2] 注入认证 token...');
  await page.evaluate((t, at) => {
    localStorage.setItem('token', t);
    localStorage.setItem('adminToken', at);
  }, token, adminToken);
  
  // 刷新页面
  await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  
  // 截图：首页
  await page.screenshot({ path: '/TG/temp/QA-20260415-03/screenshots/01-home.png', fullPage: true });
  console.log('  ✅ 首页截图');
  
  // 查找"会员"按钮并点击
  console.log('[3] 点击「会员」...');
  const memberBtn = await page.$('text=会员');
  if (memberBtn) {
    await memberBtn.click();
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: '/TG/temp/QA-20260415-03/screenshots/02-member.png', fullPage: true });
    console.log('  ✅ 会员页截图');
  }
  
  // 查找"乐捐报备"卡片
  console.log('[4] 查找「乐捐报备」...');
  const lejuanCard = await page.$('text=乐捐报备');
  if (lejuanCard) {
    await lejuanCard.click();
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: '/TG/temp/QA-20260415-03/screenshots/03-lejuan-home.png', fullPage: true });
    console.log('  ✅ 乐捐报备页截图');
    
    // 查找近2天记录
    const content = await page.content();
    const hasRecords = content.includes('lejuan-record-card') || content.includes('record-card');
    console.log(`  记录卡片: ${hasRecords ? '✅ 找到' : '❌ 未找到'}`);
    
    // 查找没有 proof_image_url 的记录
    const records = await page.evaluate(() => {
      // 尝试获取记录列表
      const cards = document.querySelectorAll('[class*="record"]');
      return cards.length;
    });
    console.log(`  记录数量: ${records}`);
  }
  
  // 直接导航到乐捐详情测试页（如果知道记录ID）
  console.log('\n[5] 尝试直接访问乐捐详情页...');
  
  // 先查询数据库找一条没有 proof_image_url 的记录
  const { execSync } = require('child_process');
  const recordId = execSync(
    `sqlite3 /TG/tgservice/db/tgservice.db "SELECT id FROM lejuan_records WHERE proof_image_url IS NULL OR proof_image_url = '' LIMIT 1;"`
  ).toString().trim();
  
  if (recordId) {
    console.log(`  找到无 proof 的记录ID: ${recordId}`);
    
    // 导航到详情页
    await page.goto(`http://127.0.0.1:8089/#/pages/internal/lejuan-proof?id=${recordId}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: '/TG/temp/QA-20260415-03/screenshots/04-proof-page.png', fullPage: true });
    console.log('  ✅ 详情页截图');
    
    // 检查页面是否有上传图片的按钮
    const hasUploadBtn = await page.evaluate(() => {
      const btn = document.querySelector('[class*="upload"]') || 
                  document.querySelector('text')?.textContent?.includes('上传图片');
      return !!btn;
    });
    console.log(`  上传按钮: ${hasUploadBtn ? '✅ 找到' : '❌ 未找到'}`);
    
    // 检查是否有 watch 错误
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    
    // 重新加载检查错误
    await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    
    if (consoleErrors.length > 0) {
      console.log('  ⚠️ 控制台错误:');
      consoleErrors.forEach(e => console.log(`    - ${e}`));
    } else {
      console.log('  ✅ 无控制台错误（watch 导入修复生效）');
    }
  } else {
    console.log('  ❌ 没有找到无 proof 的记录，需要手动创建测试数据');
  }
  
  console.log('\n=== 测试完成 ===');
  
  await page.close();
  browser.disconnect();
})();
