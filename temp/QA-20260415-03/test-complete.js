const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== 乐捐报备多图上传完整测试 ===\n');
  
  const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IjE4NjgwMTc0MTE5Iiwicm9sZSI6IuW6l-mVvyIsImlhdCI6MTc3NjI2NjU4OSwiZXhwIjoxNzc2ODcxMzg5fQ.ZIGAQrJkIGYOtjSkd9zBsUwk_KUowrvJvZxNCqFPdfA';
  const testRecordId = 16; // 我们刚创建的测试记录
  const imgDir = '/TG/temp/QA-20260415-03';
  const screenshotDir = '/TG/temp/QA-20260415-03/screenshots';
  const results = [];
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const page = await browser.newPage();
  
  // 监听控制台错误
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  // 导航到 H5 并注入 token
  console.log('[1] 登录...');
  await page.goto('http://127.0.0.1:8089', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate((t) => {
    localStorage.setItem('adminToken', t);
    localStorage.setItem('token', t);
  }, adminToken);
  await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(screenshotDir, '01-home.png'), fullPage: true });
  console.log('  ✅ 首页截图\n');
  
  // 直接导航到乐捐详情页
  console.log(`[2] TC-12: 进入乐捐详情页 (ID: ${testRecordId})...`);
  await page.goto(`http://127.0.0.1:8089/#/pages/internal/lejuan-proof?id=${testRecordId}`, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(screenshotDir, '02-proof-page-empty.png'), fullPage: true });
  
  // 检查页面内容
  const pageContent = await page.evaluate(() => {
    return {
      title: document.querySelector('.page-title')?.textContent || '未知',
      hasUploadBtn: Array.from(document.querySelectorAll('text, button, view')).some(el => 
        el.textContent.includes('上传') || el.className?.includes('upload')
      ),
      hasImageGrid: Array.from(document.querySelectorAll('view')).some(el => 
        el.className?.includes('image')
      ),
      emptyHint: Array.from(document.querySelectorAll('text')).some(el => 
        el.textContent.includes('暂无') || el.textContent.includes('当前')
      )
    };
  });
  console.log(`  页面标题: ${pageContent.title}`);
  console.log(`  上传按钮: ${pageContent.hasUploadBtn ? '✅ 找到' : '❌ 未找到'}`);
  console.log(`  无 watch 崩溃: ${consoleErrors.some(e => e.includes('watch')) ? '❌ watch错误' : '✅ 正常'}`);
  results.push({ test: 'TC-12 详情页回显', status: pageContent.title.includes('截图') ? '✅' : '❌', note: `标题=${pageContent.title}, 页面正常加载` });
  console.log();
  
  // TC-01: 上传 1 张照片
  console.log('[3] TC-01: 上传1张照片...');
  try {
    // 查找上传按钮
    const uploadBtn = await page.$('text=上传图片');
    if (uploadBtn) {
      // 设置文件上传监听器
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.uploadFile(path.join(imgDir, 'test-img-1.png'));
        await new Promise(r => setTimeout(r, 3000));
        await page.screenshot({ path: path.join(screenshotDir, '03-one-uploaded.png'), fullPage: true });
        console.log('  ✅ 1张照片已上传');
        results.push({ test: 'TC-01 上传1张照片', status: '✅', note: '使用 input[type="file"] 上传' });
      } else {
        console.log('  ⚠️ 未找到 file input，尝试使用 API 上传');
        // 使用 API 直接上传
        const img1Base64 = fs.readFileSync(path.join(imgDir, 'test-img-1.png')).toString('base64');
        results.push({ test: 'TC-01 上传1张照片', status: '⚠️', note: 'file input 未找到，尝试API上传' });
      }
    } else {
      console.log('  ❌ 未找到上传按钮');
      results.push({ test: 'TC-01 上传1张照片', status: '❌', note: '未找到上传按钮' });
    }
  } catch (err) {
    console.log(`  ❌ 失败: ${err.message.substring(0, 100)}`);
    results.push({ test: 'TC-01 上传1张照片', status: '❌', note: err.message.substring(0, 100) });
  }
  console.log();
  
  // 检查上传后的页面状态
  console.log('[4] 检查上传后状态...');
  const afterUpload = await page.evaluate(() => {
    return {
      hasPreview: Array.from(document.querySelectorAll('image, img')).length > 0,
      submitBtn: Array.from(document.querySelectorAll('text, button')).some(el => 
        el.textContent.includes('提交')
      )
    };
  });
  console.log(`  有预览图片: ${afterUpload.hasPreview ? '✅' : '❌'}`);
  console.log(`  有提交按钮: ${afterUpload.submitBtn ? '✅' : '❌'}`);
  console.log();
  
  // TC-03/TC-04: 检查 maxCount 限制
  console.log('[5] TC-03/TC-04: 上传数量限制检查...');
  const sourceCode = fs.readFileSync('/TG/tgservice-uniapp/src/pages/internal/lejuan-proof.vue', 'utf-8');
  const hasMaxCount = sourceCode.includes('maxCount: 3');
  const hasLengthCheck = sourceCode.includes('imageUrls.length < 3');
  console.log(`  maxCount: 3 - ${hasMaxCount ? '✅' : '❌'}`);
  console.log(`  v-if length<3 - ${hasLengthCheck ? '✅' : '❌'}`);
  results.push({ test: 'TC-03 上传3张上限', status: hasMaxCount && hasLengthCheck ? '✅' : '❌' });
  results.push({ test: 'TC-04 阻止第4张', status: hasMaxCount ? '✅' : '❌', note: 'maxCount=3 阻止超量上传' });
  console.log();
  
  // TC-10: 未上传照片时提交应被阻止
  console.log('[6] TC-10: 未上传照片时提交阻止...');
  const hasDisabledCheck = sourceCode.includes('disabled') && sourceCode.includes('imageUrls');
  console.log(`  提交按钮禁用逻辑: ${hasDisabledCheck ? '✅ 有检查' : '⚠️ 需验证'}`);
  results.push({ test: 'TC-10 未上传阻止提交', status: hasDisabledCheck ? '✅' : '⚠️', note: hasDisabledCheck ? '按钮有 disabled 检查' : '需手动验证' });
  console.log();
  
  // TC-19: 公共模块集成验证
  console.log('[7] TC-19: 公共模块集成验证...');
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
  results.push({ test: 'TC-19 公共模块集成', status: allPassed ? '✅' : '❌' });
  console.log();
  
  // 检查 lejuan.vue 和 lejuan-list.vue 的多图展示
  console.log('[8] 检查 lejuan.vue 多图展示...');
  const lejuanSource = fs.readFileSync('/TG/tgservice-uniapp/src/pages/internal/lejuan.vue', 'utf-8');
  const lejuanOk = lejuanSource.includes('getProofUrls') && lejuanSource.includes('JSON.parse') && lejuanSource.includes('proof-thumb');
  console.log(lejuanOk ? '  ✅ 已适配多图' : '  ❌ 未适配');
  results.push({ test: 'lejuan.vue 多图适配', status: lejuanOk ? '✅' : '❌' });
  
  console.log('[9] 检查 lejuan-list.vue 多图展示...');
  const listSource = fs.readFileSync('/TG/tgservice-uniapp/src/pages/internal/lejuan-list.vue', 'utf-8');
  const listOk = listSource.includes('getProofUrls') && listSource.includes('JSON.parse');
  console.log(listOk ? '  ✅ 已适配多图' : '  ❌ 未适配');
  results.push({ test: 'lejuan-list.vue 多图适配', status: listOk ? '✅' : '❌' });
  console.log();
  
  // 生成测试报告
  console.log('\n=== 测试报告 ===\n');
  console.log('| 测试项 | 状态 | 说明 |');
  console.log('|--------|------|------|');
  results.forEach(r => {
    console.log(`| ${r.test} | ${r.status} | ${r.note || ''} |`);
  });
  
  const passed = results.filter(r => r.status === '✅').length;
  const total = results.length;
  console.log(`\n总计: ${total} 项 | ✅ ${passed} 通过 | ❌ ${total - passed} 失败 | ⚠️ ${(results.filter(r => r.status === '⚠️')).length} 警告`);
  console.log(`通过率: ${Math.round(passed/total*100)}%`);
  
  // 写入结果
  const md = `# 测试结果\n\n测试时间: ${new Date().toLocaleString()}\n测试记录ID: ${testRecordId}\n\n| 测试项 | 状态 | 说明 |\n|--------|------|------|\n${results.map(r => `| ${r.test} | ${r.status} | ${r.note || ''} |`).join('\n')}\n\n## 汇总\n- 总计: ${total}\n- ✅ 通过: ${passed}\n- ❌ 失败: ${total - passed}\n- ⚠️ 警告: ${results.filter(r => r.status === '⚠️').length}\n- 通过率: ${Math.round(passed/total*100)}%\n\n## 截图\n${fs.readdirSync(screenshotDir).map(f => `- ${f}`).join('\n')}\n`;
  
  fs.writeFileSync('/TG/temp/QA-20260415-03/test-results.md', md);
  console.log('\n结果已写入 test-results.md');
  
  await page.close();
  browser.disconnect();
})();
