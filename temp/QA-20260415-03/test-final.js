const puppeteer = require('puppeteer-core');

(async () => {
  console.log('=== 乐捐报备多图上传测试 ===\n');
  
  const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IjE4NjgwMTc0MTE5Iiwicm9sZSI6IuW6l-mVvyIsImlhdCI6MTc3NjI2NjU4OSwiZXhwIjoxNzc2ODcxMzg5fQ.ZIGAQrJkIGYOtjSkd9zBsUwk_KUowrvJvZxNCqFPdfA';
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const page = await browser.newPage();
  const results = [];
  
  // 导航到 H5 并注入 token
  console.log('[1] 导航到 H5 并注入 token...');
  await page.goto('http://127.0.0.1:8089', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate((t) => {
    localStorage.setItem('adminToken', t);
    localStorage.setItem('token', t);
  }, adminToken);
  await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: '/TG/temp/QA-20260415-03/screenshots/01-home.png', fullPage: true });
  console.log('  ✅ 首页截图\n');
  
  // 检查是否有 watch 错误
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  // 直接导航到乐捐详情页（ID 12，无 proof）
  console.log('[2] 导航到乐捐详情页 (ID: 12)...');
  await page.goto('http://127.0.0.1:8089/#/pages/internal/lejuan-proof?id=12', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: '/TG/temp/QA-20260415-03/screenshots/02-proof-page.png', fullPage: true });
  console.log('  ✅ 详情页截图\n');
  
  // 检查页面内容
  console.log('[3] 检查页面内容...');
  const pageContent = await page.evaluate(() => {
    return {
      title: document.querySelector('.page-title')?.textContent || document.title,
      hasUploadBtn: document.querySelector('[class*="upload"]') !== null || 
                   Array.from(document.querySelectorAll('text')).some(t => t.textContent.includes('上传')),
      hasImageGrid: document.querySelector('[class*="image"]') !== null,
      html: document.body.innerHTML.substring(0, 500)
    };
  });
  console.log(`  页面标题: ${pageContent.title || '未知'}`);
  console.log(`  上传按钮: ${pageContent.hasUploadBtn ? '✅ 找到' : '❌ 未找到'}`);
  console.log(`  图片网格: ${pageContent.hasImageGrid ? '✅ 找到' : '❌ 未找到'}`);
  
  // 检查控制台错误
  await new Promise(r => setTimeout(r, 1000));
  if (consoleErrors.length > 0) {
    console.log(`  ⚠️ 控制台错误: ${consoleErrors.length} 个`);
    consoleErrors.forEach(e => console.log(`    - ${e.substring(0, 100)}`));
    results.push({ test: 'watch导入检查', status: consoleErrors.some(e => e.includes('watch')) ? '❌' : '✅', note: consoleErrors.join('; ') });
  } else {
    console.log('  ✅ 无控制台错误（watch 导入修复生效）');
    results.push({ test: 'watch导入检查', status: '✅', note: '页面正常加载' });
  }
  console.log();
  
  // TC-19: 公共模块集成验证
  console.log('[4] TC-19: 公共模块集成验证...');
  const fs = require('fs');
  const sourceCode = fs.readFileSync('/TG/tgservice-uniapp/src/pages/internal/lejuan-proof.vue', 'utf-8');
  const checks = {
    'import useImageUpload': sourceCode.includes("import { useImageUpload }"),
    'from image-upload.js': sourceCode.includes("@/utils/image-upload.js"),
    'maxCount: 3': sourceCode.includes("maxCount: 3"),
    'ossDir: TgTemp/': sourceCode.includes("ossDir: 'TgTemp/'"),
    'errorType: lejuan_proof': sourceCode.includes("errorType: 'lejuan_proof'"),
    'uses imageUrls': sourceCode.includes("imageUrls"),
    'uses chooseAndUpload': sourceCode.includes("chooseAndUpload"),
    'uses removeImage': sourceCode.includes("removeImage")
  };
  
  const allPassed = Object.values(checks).every(v => v);
  console.log(allPassed ? '  ✅ 全部通过' : '  ❌ 部分失败');
  results.push({ test: 'TC-19 公共模块集成', status: allPassed ? '✅' : '❌', note: Object.entries(checks).map(([k,v]) => `${k}: ${v?'✅':'❌'}`).join(', ') });
  console.log();
  
  // TC-03/TC-04: 检查 maxCount 限制
  console.log('[5] TC-03/TC-04: 上传数量限制检查...');
  const hasMaxCount = sourceCode.includes("maxCount: 3");
  const hasLengthCheck = sourceCode.includes("imageUrls.length < 3");
  console.log(`  maxCount: 3 - ${hasMaxCount ? '✅' : '❌'}`);
  console.log(`  v-if length<3 - ${hasLengthCheck ? '✅' : '❌'}`);
  results.push({ test: 'TC-03 上传3张上限', status: hasMaxCount && hasLengthCheck ? '✅' : '❌', note: `maxCount=${hasMaxCount}, length check=${hasLengthCheck}` });
  console.log();
  
  // 检查 lejuan.vue 的多图展示
  console.log('[6] 检查 lejuan.vue 多图展示...');
  const lejuanSource = fs.readFileSync('/TG/tgservice-uniapp/src/pages/internal/lejuan.vue', 'utf-8');
  const hasGetProofUrls = lejuanSource.includes('getProofUrls');
  const hasJsonParse = lejuanSource.includes('JSON.parse');
  const hasProofThumbs = lejuanSource.includes('proof-thumb');
  console.log(`  getProofUrls: ${hasGetProofUrls ? '✅' : '❌'}`);
  console.log(`  JSON.parse: ${hasJsonParse ? '✅' : '❌'}`);
  console.log(`  proof-thumb: ${hasProofThumbs ? '✅' : '❌'}`);
  results.push({ test: 'lejuan.vue 多图适配', status: hasGetProofUrls && hasJsonParse && hasProofThumbs ? '✅' : '❌' });
  console.log();
  
  // 检查 lejuan-list.vue 的多图展示
  console.log('[7] 检查 lejuan-list.vue 多图展示...');
  const listSource = fs.readFileSync('/TG/tgservice-uniapp/src/pages/internal/lejuan-list.vue', 'utf-8');
  const listHasGetProofUrls = listSource.includes('getProofUrls');
  const listHasJsonParse = listSource.includes('JSON.parse');
  const listHasProofThumbs = listSource.includes('proof-thumb') || listSource.includes('lj-proof-thumb');
  console.log(`  getProofUrls: ${listHasGetProofUrls ? '✅' : '❌'}`);
  console.log(`  JSON.parse: ${listHasJsonParse ? '✅' : '❌'}`);
  console.log(`  proof-thumb: ${listHasProofThumbs ? '✅' : '❌'}`);
  results.push({ test: 'lejuan-list.vue 多图适配', status: listHasGetProofUrls && listHasJsonParse && listHasProofThumbs ? '✅' : '❌' });
  console.log();
  
  // 生成测试报告
  console.log('\n=== 测试报告 ===\n');
  const report = results.map(r => `| ${r.test} | ${r.status} | ${r.note || ''} |`).join('\n');
  console.log('| 测试项 | 状态 | 说明 |');
  console.log('|--------|------|------|');
  console.log(report);
  
  const passed = results.filter(r => r.status === '✅').length;
  const total = results.length;
  console.log(`\n总计: ${total} 项 | ✅ ${passed} 通过 | ❌ ${total - passed} 失败`);
  
  // 写入结果文件
  const md = `# 测试结果\n\n测试时间: ${new Date().toLocaleString()}\n\n| 测试项 | 状态 | 说明 |\n|--------|------|------|\n${report}\n\n## 汇总\n- 总计: ${total}\n- ✅ 通过: ${passed}\n- ❌ 失败: ${total - passed}\n- 通过率: ${Math.round(passed/total*100)}%\n`;
  
  fs.writeFileSync('/TG/temp/QA-20260415-03/test-results.md', md);
  console.log('\n结果已写入 test-results.md');
  
  await page.close();
  browser.disconnect();
})();
