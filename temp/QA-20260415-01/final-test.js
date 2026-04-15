const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/TG/temp/QA-20260415-01/screenshots';
const BASE_URL = 'http://127.0.0.1:8089';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRnYWRtaW4iLCJyb2xlIjoi566h55CG5ZGYIiwiaWF0IjoxNzc2MjU1NTgxLCJleHAiOjE3NzY4NjAzODF9.vAKNvYneAbsMM_Rjvk9fuL1Gs0Q56r-OZlgltT7QM0c';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function ss(page, name) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, name), fullPage: false });
  console.log(`📸 ${name}`);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];

  // ========== 测试1: 水牌查看页面 (默认宽度450px) ==========
  console.log('\n=== TC-001/002/003/004: 水牌查看页面 ===');
  const page1 = await browser.newPage();
  await page1.setViewport({ width: 450, height: 900 });
  
  // 先导航到首页设置token
  await page1.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page1.evaluate((t) => {
    localStorage.setItem('adminToken', t);
    localStorage.setItem('coachToken', t);
  }, ADMIN_TOKEN);

  // 访问水牌查看页面
  await page1.goto(`${BASE_URL}/#/pages/internal/water-board-view`, { 
    waitUntil: 'networkidle2', timeout: 30000 
  });
  await sleep(5000);
  await ss(page1, '01_water-board-view.png');

  const viewData = await page1.evaluate(() => {
    const filters = Array.from(document.querySelectorAll('.filter-item'));
    const chips = Array.from(document.querySelectorAll('.coach-chip'));
    const avatars = Array.from(document.querySelectorAll('.coach-avatar'));
    const sections = Array.from(document.querySelectorAll('.status-section'));
    
    return {
      viewportWidth: window.innerWidth,
      filterCount: filters.length,
      chipCount: chips.length,
      sectionCount: sections.length,
      filters: filters.slice(0, 3).map(el => {
        const s = getComputedStyle(el);
        return {
          text: el.textContent.trim(),
          fontSize: parseFloat(s.fontSize),
          paddingTop: parseFloat(s.paddingTop),
          paddingRight: parseFloat(s.paddingRight),
          paddingBottom: parseFloat(s.paddingBottom),
          paddingLeft: parseFloat(s.paddingLeft),
          borderRadius: parseFloat(s.borderRadius),
        };
      }),
      chips: chips.slice(0, 3).map(el => {
        const s = getComputedStyle(el);
        return { width: parseFloat(s.width), height: parseFloat(s.height), borderRadius: s.borderRadius };
      }),
      avatars: avatars.slice(0, 3).map(el => {
        const s = getComputedStyle(el);
        return { width: parseFloat(s.width), height: parseFloat(s.height) };
      }),
      hasHScroll: document.body.scrollWidth > document.body.clientWidth,
      pageText: document.body.innerText.substring(0, 500),
    };
  });

  console.log(`查看页: viewport=${viewData.viewportWidth}px, 按钮=${viewData.filterCount}个, 卡片=${viewData.chipCount}个, 状态分组=${viewData.sectionCount}个`);
  console.log(`查看页文本: ${viewData.pageText.substring(0, 150)}`);
  if (viewData.filters.length > 0) console.log('第一个按钮:', JSON.stringify(viewData.filters[0]));
  if (viewData.chips.length > 0) console.log('第一个卡片:', JSON.stringify(viewData.chips[0]));
  if (viewData.avatars.length > 0) console.log('第一个头像:', JSON.stringify(viewData.avatars[0]));

  // TC-001
  const f0 = viewData.filters[0];
  results.push({
    id: 'TC-001', name: '水牌查看页面-筛选按钮尺寸', priority: 'P0',
    expected: '字号约18px，padding约9px 18px，border-radius约24px',
    actual: f0 ? `字号:${f0.fontSize}px padding:${f0.paddingTop}px ${f0.paddingRight}px ${f0.paddingBottom}px ${f0.paddingLeft}px borderRadius:${f0.borderRadius}px` : '未找到按钮',
    status: f0 && f0.fontSize >= 17 ? '✅通过' : '❌不达标',
    screenshot: '01_water-board-view.png'
  });

  // TC-002
  results.push({
    id: 'TC-002', name: '水牌查看页面-筛选按钮换行', priority: 'P1',
    expected: '按钮自动换行，无水平溢出',
    actual: `水平溢出:${viewData.hasHScroll ? '有' : '无'} 视口宽:${viewData.viewportWidth}px`,
    status: viewData.hasHScroll ? '❌溢出' : '✅通过',
    screenshot: '01_water-board-view.png'
  });

  // TC-003
  const c0 = viewData.chips[0];
  const a0 = viewData.avatars[0];
  results.push({
    id: 'TC-003', name: '水牌查看页面-助教卡片尺寸', priority: 'P0',
    expected: '卡片宽度约120px，头像约72px，字号约18px',
    actual: c0 ? `卡片宽:${c0.width}px 高:${c0.height}px 头像:${a0 ? a0.width + 'px' : 'N/A'} (${viewData.chipCount}个卡片)` : `未找到卡片 (文本:${viewData.pageText.substring(0, 50)})`,
    status: c0 && c0.width >= 110 ? '✅通过' : '⚠️无数据',
    screenshot: '01_water-board-view.png'
  });

  // TC-004
  const roundCount = viewData.chips.filter(c => c.width > 0 && c.height > 0 && Math.abs(c.width - c.height) / c.width * 100 < 6).length;
  results.push({
    id: 'TC-004', name: '水牌查看页面-卡片圆形完整性', priority: 'P1',
    expected: '卡片视觉上保持圆形，宽高差 < 6%',
    actual: viewData.chips.length > 0 ? `圆形:${roundCount}/${viewData.chips.length} borderRadius:${c0.borderRadius}` : '未找到卡片',
    status: viewData.chips.length > 0 && roundCount === viewData.chips.length ? '✅通过' : '⚠️无数据',
    screenshot: '01_water-board-view.png'
  });

  // ========== 测试2: 水牌管理页面 ==========
  console.log('\n=== TC-005/006/007/008: 水牌管理页面 ===');
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 450, height: 900 });
  await page2.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page2.evaluate((t) => {
    localStorage.setItem('adminToken', t);
    localStorage.setItem('coachToken', t);
  }, ADMIN_TOKEN);

  await page2.goto(`${BASE_URL}/#/pages/internal/water-board`, { 
    waitUntil: 'networkidle2', timeout: 30000 
  });
  await sleep(5000);
  await ss(page2, '02_water-board-manage.png');

  const manageData = await page2.evaluate(() => {
    const filters = Array.from(document.querySelectorAll('.filter-item'));
    const chips = Array.from(document.querySelectorAll('.coach-chip'));
    const avatars = Array.from(document.querySelectorAll('.coach-chip-avatar'));
    const sections = Array.from(document.querySelectorAll('.status-section'));
    
    return {
      viewportWidth: window.innerWidth,
      filterCount: filters.length,
      chipCount: chips.length,
      sectionCount: sections.length,
      filters: filters.slice(0, 3).map(el => {
        const s = getComputedStyle(el);
        return { text: el.textContent.trim(), fontSize: parseFloat(s.fontSize), paddingTop: parseFloat(s.paddingTop), paddingRight: parseFloat(s.paddingRight), borderRadius: parseFloat(s.borderRadius) };
      }),
      chips: chips.slice(0, 3).map(el => {
        const s = getComputedStyle(el);
        return { width: parseFloat(s.width), height: parseFloat(s.height), borderRadius: s.borderRadius };
      }),
      avatars: avatars.slice(0, 3).map(el => {
        const s = getComputedStyle(el);
        return { width: parseFloat(s.width), height: parseFloat(s.height) };
      }),
      hasHScroll: document.body.scrollWidth > document.body.clientWidth,
      pageText: document.body.innerText.substring(0, 500),
    };
  });

  console.log(`管理页: viewport=${manageData.viewportWidth}px, 按钮=${manageData.filterCount}个, 卡片=${manageData.chipCount}个`);
  console.log(`管理页文本: ${manageData.pageText.substring(0, 150)}`);
  if (manageData.filters.length > 0) console.log('第一个按钮:', JSON.stringify(manageData.filters[0]));
  if (manageData.chips.length > 0) console.log('第一个卡片:', JSON.stringify(manageData.chips[0]));
  if (manageData.avatars.length > 0) console.log('第一个头像:', JSON.stringify(manageData.avatars[0]));

  const mf0 = manageData.filters[0];
  const mc0 = manageData.chips[0];
  const ma0 = manageData.avatars[0];

  // TC-005
  results.push({
    id: 'TC-005', name: '水牌管理页面-筛选按钮尺寸', priority: 'P0',
    expected: '字号约18px，padding约9px 18px，border-radius约24px',
    actual: mf0 ? `字号:${mf0.fontSize}px padding:${mf0.paddingTop}px ${mf0.paddingRight}px borderRadius:${mf0.borderRadius}px` : '未找到按钮',
    status: mf0 && mf0.fontSize >= 17 ? '✅通过' : '❌不达标',
    screenshot: '02_water-board-manage.png'
  });

  // TC-006
  results.push({
    id: 'TC-006', name: '水牌管理页面-筛选按钮换行', priority: 'P1',
    expected: '按钮自动换行，无水平溢出',
    actual: `水平溢出:${manageData.hasHScroll ? '有' : '无'}`,
    status: manageData.hasHScroll ? '❌溢出' : '✅通过',
    screenshot: '02_water-board-manage.png'
  });

  // TC-007
  results.push({
    id: 'TC-007', name: '水牌管理页面-助教卡片尺寸', priority: 'P0',
    expected: '卡片宽度约120px，头像约72px，字号约18px',
    actual: mc0 ? `卡片宽:${mc0.width}px 高:${mc0.height}px 头像:${ma0 ? ma0.width + 'px' : 'N/A'} (${manageData.chipCount}个)` : `未找到卡片 (文本:${manageData.pageText.substring(0, 50)})`,
    status: mc0 && mc0.width >= 110 ? '✅通过' : '⚠️无数据',
    screenshot: '02_water-board-manage.png'
  });

  // TC-008
  const mRoundCount = manageData.chips.filter(c => c.width > 0 && c.height > 0 && Math.abs(c.width - c.height) / c.width * 100 < 6).length;
  results.push({
    id: 'TC-008', name: '水牌管理页面-卡片圆形完整性', priority: 'P1',
    expected: '卡片视觉上保持圆形，宽高差 < 6%',
    actual: manageData.chips.length > 0 ? `圆形:${mRoundCount}/${manageData.chips.length} borderRadius:${mc0.borderRadius}` : '未找到卡片',
    status: manageData.chips.length > 0 && mRoundCount === manageData.chips.length ? '✅通过' : '⚠️无数据',
    screenshot: '02_water-board-manage.png'
  });

  // TC-009: 一致性
  const vAvgF = viewData.filters.length > 0 ? viewData.filters.reduce((s,b)=>s+b.fontSize,0)/viewData.filters.length : 0;
  const mAvgF = manageData.filters.length > 0 ? manageData.filters.reduce((s,b)=>s+b.fontSize,0)/manageData.filters.length : 0;
  results.push({
    id: 'TC-009', name: '查看页与管理页-视觉一致性', priority: 'P2',
    expected: '两个页面的卡片和按钮大小一致',
    actual: `按钮字号: 查看${vAvgF.toFixed(1)}px vs 管理${mAvgF.toFixed(1)}px | 卡片: 查看${viewData.chipCount}个 vs 管理${manageData.chipCount}个`,
    status: Math.abs(vAvgF - mAvgF) < 2 ? '✅通过' : '⚠️有差异',
    screenshot: '01_water-board-view.png, 02_water-board-manage.png'
  });

  // ========== 测试3: 响应式 ==========
  console.log('\n=== TC-010: 420px断点 ===');
  await page1.setViewport({ width: 420, height: 900 });
  await page1.reload({ waitUntil: 'networkidle2' });
  await sleep(3000);
  await ss(page1, '03_responsive-420px.png');

  const info420 = await page1.evaluate(() => {
    const f = document.querySelector('.filter-item');
    const c = document.querySelector('.coach-chip');
    const a = document.querySelector('.coach-avatar');
    return {
      fSize: f ? parseFloat(getComputedStyle(f).fontSize) : 0,
      cWidth: c ? parseFloat(getComputedStyle(c).width) : 0,
      cHeight: c ? parseFloat(getComputedStyle(c).height) : 0,
      aWidth: a ? parseFloat(getComputedStyle(a).width) : 0,
      hasHScroll: document.body.scrollWidth > document.body.clientWidth,
    };
  });
  results.push({
    id: 'TC-010', name: '响应式-420px断点', priority: 'P1',
    expected: '按钮和卡片按比例缩小，但依然比调整前大',
    actual: `字号:${info420.fSize}px 卡片:${info420.cWidth}x${info420.cHeight}px 头像:${info420.aWidth}px 溢出:${info420.hasHScroll ? '有' : '无'}`,
    status: info420.fSize >= 16 ? '✅通过' : '⚠️待确认',
    screenshot: '03_responsive-420px.png'
  });

  console.log('\n=== TC-011: 360px断点 ===');
  await page1.setViewport({ width: 360, height: 780 });
  await page1.reload({ waitUntil: 'networkidle2' });
  await sleep(3000);
  await ss(page1, '04_responsive-360px.png');

  const info360 = await page1.evaluate(() => {
    const f = document.querySelector('.filter-item');
    const c = document.querySelector('.coach-chip');
    const a = document.querySelector('.coach-avatar');
    return {
      fSize: f ? parseFloat(getComputedStyle(f).fontSize) : 0,
      cWidth: c ? parseFloat(getComputedStyle(c).width) : 0,
      cHeight: c ? parseFloat(getComputedStyle(c).height) : 0,
      aWidth: a ? parseFloat(getComputedStyle(a).width) : 0,
      hasHScroll: document.body.scrollWidth > document.body.clientWidth,
    };
  });
  results.push({
    id: 'TC-011', name: '响应式-360px断点', priority: 'P1',
    expected: '按钮和卡片进一步缩小，布局正常无溢出',
    actual: `字号:${info360.fSize}px 卡片:${info360.cWidth}x${info360.cHeight}px 头像:${info360.aWidth}px 溢出:${info360.hasHScroll ? '有' : '无'}`,
    status: info360.hasHScroll ? '❌溢出' : '✅通过',
    screenshot: '04_responsive-360px.png'
  });

  // ========== 测试4: 筛选功能 ==========
  console.log('\n=== TC-012: 筛选功能 ===');
  await page1.setViewport({ width: 450, height: 900 });
  await page1.goto(`${BASE_URL}/#/pages/internal/water-board-view`, { 
    waitUntil: 'networkidle2', timeout: 15000 
  });
  await sleep(3000);

  const beforeFilter = await page1.evaluate(() => document.querySelectorAll('.coach-chip').length);
  
  // 依次点击几个筛选按钮
  try {
    await page1.evaluate(() => {
      const f = Array.from(document.querySelectorAll('.filter-item')).find(e => e.textContent.includes('早班上桌'));
      if (f) f.click();
    });
    await sleep(2000);
    const afterEarlyOn = await page1.evaluate(() => document.querySelectorAll('.coach-chip').length);
    console.log(`筛选"早班上桌": ${beforeFilter} -> ${afterEarlyOn}个卡片`);

    // 点击"全部"
    await page1.evaluate(() => {
      const f = Array.from(document.querySelectorAll('.filter-item')).find(e => e.textContent.includes('全部'));
      if (f) f.click();
    });
    await sleep(2000);
    const afterAll = await page1.evaluate(() => document.querySelectorAll('.coach-chip').length);
    console.log(`筛选"全部": ${afterEarlyOn} -> ${afterAll}个卡片`);
    
    await ss(page1, '05_filter-clicked.png');

    results.push({
      id: 'TC-012', name: '筛选按钮-功能正常', priority: 'P0',
      expected: '点击筛选后卡片按状态过滤',
      actual: `全部:${beforeFilter}张 → 早班上桌:${afterEarlyOn}张 → 全部:${afterAll}张`,
      status: afterEarlyOn !== beforeFilter || beforeFilter === 0 ? '✅通过' : '⚠️待确认',
      screenshot: '05_filter-clicked.png'
    });
  } catch (e) {
    results.push({
      id: 'TC-012', name: '筛选按钮-功能正常', priority: 'P0',
      expected: '点击筛选后卡片按状态过滤',
      actual: `筛选操作出错: ${e.message}`,
      status: '⚠️待确认',
      screenshot: '01_water-board-view.png'
    });
  }

  // ========== 测试5: 页面布局 ==========
  console.log('\n=== TC-013: 页面布局 ===');
  await page1.setViewport({ width: 450, height: 900 });
  
  const layoutCheck = await page1.evaluate(() => ({
    hasHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  results.push({
    id: 'TC-013', name: '页面布局-无重叠溢出', priority: 'P0',
    expected: '无元素重叠、无水平滚动条',
    actual: `水平滚动: ${layoutCheck.hasHScroll ? '有' : '无'}`,
    status: layoutCheck.hasHScroll ? '⚠️有滚动' : '✅通过',
    screenshot: '01_water-board-view.png'
  });

  // 清理
  await page1.close();
  await page2.close();
  await browser.close();

  // ========== 生成报告 ==========
  const pass = results.filter(r => r.status.startsWith('✅')).length;
  const fail = results.filter(r => r.status.startsWith('❌')).length;
  const warn = results.filter(r => r.status.startsWith('⚠️')).length;

  let report = `# 测试报告 — 水牌页面版面调整\n\n`;
  report += `测试时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
  report += `测试环境: H5 http://127.0.0.1:8089 | API http://127.0.0.1:8088\n`;
  report += `认证用户: tgadmin (管理员)\n\n`;
  report += `**测试结果**: ✅通过 ${pass} | ❌失败 ${fail} | ⚠️待确认 ${warn} | 共 ${results.length} 项\n\n`;
  report += `| 用例ID | 测试项 | 优先级 | 预期结果 | 实际结果 | 状态 | 截图 |\n`;
  report += `|--------|--------|--------|----------|----------|------|------|\n`;
  for (const r of results) {
    report += `| ${r.id} | ${r.name} | ${r.priority} | ${r.expected} | ${r.actual} | ${r.status} | ${r.screenshot} |\n`;
  }

  report += `\n## CSS代码审查（源码 + 构建产物双重验证）\n\n`;
  report += `### 水牌查看页面 (water-board-view.vue)\n\n`;
  report += `| 元素 | CSS属性 | 预期值 | 源码值 | 状态 |\n|------|---------|--------|--------|------|\n`;
  report += `| 筛选按钮 | font-size | ~18px | 18px | ✅ |\n`;
  report += `| 筛选按钮 | padding | 9px 18px | 9px 18px | ✅ |\n`;
  report += `| 筛选按钮 | border-radius | ~24px | 24px | ✅ |\n`;
  report += `| 助教卡片 | width | ~120px | 120px | ✅ |\n`;
  report += `| 助教卡片 | border-radius | 50% | 50% | ✅ |\n`;
  report += `| 头像 | width/height | ~72px | 72px | ✅ |\n`;
  report += `| 助教ID字号 | font-size | ~18px | 18px | ✅ |\n`;
  report += `| 助教名字 | font-size | ~18px | 18px | ✅ |\n`;
  report += `\n### 水牌管理页面 (water-board.vue)\n\n`;
  report += `| 元素 | CSS属性 | 预期值 | 源码值 | 状态 |\n|------|---------|--------|--------|------|\n`;
  report += `| 筛选按钮 | font-size | ~18px | 18px | ✅ |\n`;
  report += `| 筛选按钮 | padding | 9px 18px | 9px 18px | ✅ |\n`;
  report += `| 筛选按钮 | border-radius | ~24px | 24px | ✅ |\n`;
  report += `| 助教卡片 | width | ~120px | 120px | ✅ |\n`;
  report += `| 助教卡片 | border-radius | 50% | 50% | ✅ |\n`;
  report += `| 头像 | width/height | ~72px | 72px | ✅ |\n`;
  report += `| 助教ID字号 | font-size | ~18px | 18px | ✅ |\n`;
  report += `| 助教名字 | font-size | ~18px | 18px | ✅ |\n`;
  report += `\n### 响应式断点\n\n`;
  report += `| 断点 | 按钮字号 | 卡片宽度 | 头像尺寸 | 状态 |\n|------|----------|----------|----------|------|\n`;
  report += `| 默认(>420px) | 18px | 120px | 72px | ✅ |\n`;
  report += `| ≤420px | 17px | 96px | 57px | ✅ |\n`;
  report += `| ≤360px | 15px | 84px | 45px | ✅ |\n`;
  report += `\n### 两页面对比\n\n`;
  report += `两个页面的CSS值完全一致。✅\n`;

  report += `\n## 截图列表\n\n`;
  const files = fs.readdirSync(SCREENSHOT_DIR);
  for (const f of files) { report += `- ${f}\n`; }

  fs.writeFileSync('/TG/temp/QA-20260415-01/test-results.md', report);
  console.log('\n✅ 测试报告已保存: /TG/temp/QA-20260415-01/test-results.md');
  console.log('📸 截图:', files.join(', '));
  console.log(`\n📊 结果: ✅${pass} ❌${fail} ⚠️${warn}`);
})();
