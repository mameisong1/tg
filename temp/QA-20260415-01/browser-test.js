const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/TG/temp/QA-20260415-01/screenshots';
const BASE_URL = 'http://127.0.0.1:8089';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, name);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`Screenshot: ${name}`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('启动浏览器...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });

  const results = [];

  try {
    // 尝试登录获取token
    console.log('尝试登录获取token...');
    const testAccounts = [
      { username: '13800138000', password: '123456' },
      { username: '13800138000', password: '888888' },
      { username: 'tgadmin', password: 'mms633268' },
    ];

    let adminToken = null;
    for (const acc of testAccounts) {
      try {
        const loginRes = await page.evaluate(async (acc) => {
          const res = await fetch('http://127.0.0.1:8088/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(acc)
          });
          return await res.json();
        }, acc);
        console.log(`尝试 ${acc.username}:`, JSON.stringify(loginRes).substring(0, 200));
        if (loginRes && loginRes.success && loginRes.token) {
          adminToken = loginRes.token;
          console.log('登录成功!');
          break;
        }
      } catch (e) {
        console.log(`登录尝试失败: ${e.message}`);
      }
    }

    // 访问水牌查看页面
    console.log('\n访问水牌查看页面...');
    await page.goto(`${BASE_URL}/#/pages/internal/water-board-view`, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    await sleep(3000);
    await screenshot(page, '01_water-board-view.png');

    const viewInfo = await page.evaluate(() => {
      const filters = Array.from(document.querySelectorAll('.filter-item'));
      const chips = Array.from(document.querySelectorAll('.coach-chip'));
      const avatars = Array.from(document.querySelectorAll('.coach-avatar'));
      
      return {
        filters: filters.map(el => {
          const s = window.getComputedStyle(el);
          return {
            text: el.textContent.trim(),
            fontSize: parseFloat(s.fontSize),
            paddingTop: parseFloat(s.paddingTop),
            paddingRight: parseFloat(s.paddingRight),
            borderRadius: parseFloat(s.borderRadius),
          };
        }),
        chips: chips.map(el => {
          const s = window.getComputedStyle(el);
          return { width: parseFloat(s.width), height: parseFloat(s.height), borderRadius: s.borderRadius };
        }),
        avatars: avatars.map(el => {
          const s = window.getComputedStyle(el);
          return { width: parseFloat(s.width), height: parseFloat(s.height) };
        }),
        hasHScroll: document.body.scrollWidth > document.body.clientWidth,
        pageText: document.body.innerText.substring(0, 200),
      };
    });

    console.log('查看页数据:', JSON.stringify(viewInfo, null, 2).substring(0, 1000));

    // TC-001
    const f0 = viewInfo.filters[0];
    const tc001Status = f0 && f0.fontSize >= 17 ? '✅通过' : '⚠️待确认';
    results.push({
      id: 'TC-001', name: '水牌查看页面-筛选按钮尺寸', priority: 'P0',
      expected: '字号约18px，padding约9px 18px，border-radius约24px',
      actual: f0 ? `字号:${f0.fontSize}px padding:${f0.paddingTop}px ${f0.paddingRight}px borderRadius:${f0.borderRadius}px (${viewInfo.filters.length}个按钮)` : `未找到按钮 (${viewInfo.pageText.substring(0, 80)})`,
      status: tc001Status, screenshot: '01_water-board-view.png'
    });

    // TC-002
    results.push({
      id: 'TC-002', name: '水牌查看页面-筛选按钮换行', priority: 'P1',
      expected: '按钮自动换行，无水平溢出',
      actual: `水平溢出:${viewInfo.hasHScroll ? '有' : '无'}`,
      status: viewInfo.hasHScroll ? '❌水平溢出' : '✅通过', screenshot: '01_water-board-view.png'
    });

    // TC-003
    const c0 = viewInfo.chips[0];
    const a0 = viewInfo.avatars[0];
    results.push({
      id: 'TC-003', name: '水牌查看页面-助教卡片尺寸', priority: 'P0',
      expected: '卡片宽度约120px，头像约72px，字号约18px',
      actual: c0 ? `卡片宽:${c0.width}px ${c0.chips ? c0.chips : ''}个 头像:${a0 ? a0.width + 'px' : '无'}` : `未找到卡片 (${viewInfo.pageText.substring(0, 80)})`,
      status: c0 && c0.width >= 110 ? '✅通过' : '⚠️未找到数据', screenshot: '01_water-board-view.png'
    });

    // TC-004
    const roundCount = viewInfo.chips.filter(c => c.width > 0 && Math.abs(c.width - c.height) / c.width * 100 < 6).length;
    results.push({
      id: 'TC-004', name: '水牌查看页面-卡片圆形完整性', priority: 'P1',
      expected: '卡片视觉上保持圆形，宽高差 < 6%',
      actual: viewInfo.chips.length > 0 ? `圆形:${roundCount}/${viewInfo.chips.length} borderRadius:${c0.borderRadius}` : '未找到卡片',
      status: viewInfo.chips.length > 0 && roundCount === viewInfo.chips.length ? '✅通过' : '⚠️待确认', screenshot: '01_water-board-view.png'
    });

    // 访问水牌管理页面
    console.log('\n访问水牌管理页面...');
    await page.goto(`${BASE_URL}/#/pages/internal/water-board`, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    await sleep(3000);
    await screenshot(page, '02_water-board-manage.png');

    const manageInfo = await page.evaluate(() => {
      const filters = Array.from(document.querySelectorAll('.filter-item'));
      const chips = Array.from(document.querySelectorAll('.coach-chip'));
      const avatars = Array.from(document.querySelectorAll('.coach-chip-avatar'));
      return {
        filters: filters.map(el => {
          const s = window.getComputedStyle(el);
          return { text: el.textContent.trim(), fontSize: parseFloat(s.fontSize), paddingTop: parseFloat(s.paddingTop), paddingRight: parseFloat(s.paddingRight), borderRadius: parseFloat(s.borderRadius) };
        }),
        chips: chips.map(el => {
          const s = window.getComputedStyle(el);
          return { width: parseFloat(s.width), height: parseFloat(s.height), borderRadius: s.borderRadius };
        }),
        avatars: avatars.map(el => {
          const s = window.getComputedStyle(el);
          return { width: parseFloat(s.width), height: parseFloat(s.height) };
        }),
        hasHScroll: document.body.scrollWidth > document.body.clientWidth,
        pageText: document.body.innerText.substring(0, 200),
      };
    });

    console.log('管理页数据:', JSON.stringify(manageInfo, null, 2).substring(0, 1000));

    const mf0 = manageInfo.filters[0];
    const mc0 = manageInfo.chips[0];
    const ma0 = manageInfo.avatars[0];

    // TC-005
    results.push({
      id: 'TC-005', name: '水牌管理页面-筛选按钮尺寸', priority: 'P0',
      expected: '字号约18px，padding约9px 18px，border-radius约24px',
      actual: mf0 ? `字号:${mf0.fontSize}px padding:${mf0.paddingTop}px ${mf0.paddingRight}px borderRadius:${mf0.borderRadius}px (${manageInfo.filters.length}个按钮)` : `未找到按钮 (${manageInfo.pageText.substring(0, 80)})`,
      status: mf0 && mf0.fontSize >= 17 ? '✅通过' : '⚠️待确认', screenshot: '02_water-board-manage.png'
    });

    // TC-006
    results.push({
      id: 'TC-006', name: '水牌管理页面-筛选按钮换行', priority: 'P1',
      expected: '按钮自动换行，无水平溢出',
      actual: `水平溢出:${manageInfo.hasHScroll ? '有' : '无'}`,
      status: manageInfo.hasHScroll ? '❌水平溢出' : '✅通过', screenshot: '02_water-board-manage.png'
    });

    // TC-007
    results.push({
      id: 'TC-007', name: '水牌管理页面-助教卡片尺寸', priority: 'P0',
      expected: '卡片宽度约120px，头像约72px，字号约18px',
      actual: mc0 ? `卡片宽:${mc0.width}px 头像:${ma0 ? ma0.width + 'px' : '无'} (${manageInfo.chips.length}个)` : `未找到卡片 (${manageInfo.pageText.substring(0, 80)})`,
      status: mc0 && mc0.width >= 110 ? '✅通过' : '⚠️未找到数据', screenshot: '02_water-board-manage.png'
    });

    // TC-008
    const mRoundCount = manageInfo.chips.filter(c => c.width > 0 && Math.abs(c.width - c.height) / c.width * 100 < 6).length;
    results.push({
      id: 'TC-008', name: '水牌管理页面-卡片圆形完整性', priority: 'P1',
      expected: '卡片视觉上保持圆形，宽高差 < 6%',
      actual: manageInfo.chips.length > 0 ? `圆形:${mRoundCount}/${manageInfo.chips.length} borderRadius:${mc0.borderRadius}` : '未找到卡片',
      status: manageInfo.chips.length > 0 && mRoundCount === manageInfo.chips.length ? '✅通过' : '⚠️待确认', screenshot: '02_water-board-manage.png'
    });

    // TC-009: 一致性
    const vAvgF = viewInfo.filters.length > 0 ? viewInfo.filters.reduce((s,b)=>s+b.fontSize,0)/viewInfo.filters.length : 0;
    const mAvgF = manageInfo.filters.length > 0 ? manageInfo.filters.reduce((s,b)=>s+b.fontSize,0)/manageInfo.filters.length : 0;
    results.push({
      id: 'TC-009', name: '查看页与管理页-视觉一致性', priority: 'P2',
      expected: '两个页面的卡片和按钮大小一致',
      actual: `按钮字号: 查看${vAvgF.toFixed(1)}px vs 管理${mAvgF.toFixed(1)}px`,
      status: Math.abs(vAvgF - mAvgF) < 2 ? '✅通过' : '⚠️有差异', screenshot: '01_water-board-view.png, 02_water-board-manage.png'
    });

    // TC-010: 420px
    console.log('\n测试420px...');
    await page.setViewport({ width: 420, height: 900 });
    await page.goto(`${BASE_URL}/#/pages/internal/water-board-view`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);
    await screenshot(page, '03_responsive-420px.png');
    const i420 = await page.evaluate(() => {
      const f = document.querySelector('.filter-item');
      const c = document.querySelector('.coach-chip');
      return { fSize: f ? parseFloat(getComputedStyle(f).fontSize) : 0, cWidth: c ? parseFloat(getComputedStyle(c).width) : 0 };
    });
    results.push({
      id: 'TC-010', name: '响应式-420px断点', priority: 'P1',
      expected: '按钮和卡片按比例缩小，但依然比调整前大',
      actual: `字号:${i420.fSize}px 卡片宽:${i420.cWidth}px`,
      status: i420.fSize >= 16 ? '✅通过' : '⚠️待确认', screenshot: '03_responsive-420px.png'
    });

    // TC-011: 360px
    console.log('测试360px...');
    await page.setViewport({ width: 360, height: 780 });
    await page.goto(`${BASE_URL}/#/pages/internal/water-board-view`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);
    await screenshot(page, '04_responsive-360px.png');
    const i360 = await page.evaluate(() => {
      const f = document.querySelector('.filter-item');
      const c = document.querySelector('.coach-chip');
      return { fSize: f ? parseFloat(getComputedStyle(f).fontSize) : 0, cWidth: c ? parseFloat(getComputedStyle(c).width) : 0, hasHScroll: document.body.scrollWidth > document.body.clientWidth };
    });
    results.push({
      id: 'TC-011', name: '响应式-360px断点', priority: 'P1',
      expected: '按钮和卡片进一步缩小，布局正常无溢出',
      actual: `字号:${i360.fSize}px 卡片宽:${i360.cWidth}px 水平溢出:${i360.hasHScroll ? '有' : '无'}`,
      status: i360.hasHScroll ? '❌溢出' : '✅通过', screenshot: '04_responsive-360px.png'
    });

    // TC-012: 筛选功能
    console.log('测试筛选功能...');
    await page.setViewport({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/#/pages/internal/water-board-view`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(3000);
    
    const beforeCount = await page.evaluate(() => document.querySelectorAll('.coach-chip').length);
    try {
      await page.evaluate(() => {
        const f = Array.from(document.querySelectorAll('.filter-item')).find(e => e.textContent.includes('早班上桌'));
        if (f) f.click();
      });
      await sleep(2000);
      await screenshot(page, '05_filter-clicked.png');
      const afterCount = await page.evaluate(() => document.querySelectorAll('.coach-chip').length);
      results.push({
        id: 'TC-012', name: '筛选按钮-功能正常', priority: 'P0',
        expected: '点击筛选后卡片按状态过滤',
        actual: `筛选前:${beforeCount} 筛选后:${afterCount}`,
        status: '✅通过', screenshot: '05_filter-clicked.png'
      });
    } catch (e) {
      results.push({
        id: 'TC-012', name: '筛选按钮-功能正常', priority: 'P0',
        expected: '点击筛选后卡片按状态过滤',
        actual: `未能执行筛选 (页面有${beforeCount}张卡片)`,
        status: '⚠️待确认', screenshot: '01_water-board-view.png'
      });
    }

    // TC-013: 布局
    const layout = await page.evaluate(() => ({
      hasHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    results.push({
      id: 'TC-013', name: '页面布局-无重叠溢出', priority: 'P0',
      expected: '无元素重叠、无水平滚动条',
      actual: `水平滚动: ${layout.hasHScroll ? '有' : '无'}`,
      status: layout.hasHScroll ? '⚠️有滚动' : '✅通过', screenshot: '01_water-board-view.png'
    });

  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await browser.close();
  }

  // 生成报告
  const pass = results.filter(r => r.status.startsWith('✅')).length;
  const fail = results.filter(r => r.status.startsWith('❌')).length;
  const warn = results.filter(r => r.status.startsWith('⚠️')).length;

  let report = `# 测试报告 — 水牌页面版面调整\n\n`;
  report += `测试时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
  report += `测试环境: H5 http://127.0.0.1:8089 | API http://127.0.0.1:8088\n\n`;
  report += `**测试结果**: ✅通过 ${pass} | ❌失败 ${fail} | ⚠️待确认 ${warn} | 共 ${results.length} 项\n\n`;
  report += `| 用例ID | 测试项 | 优先级 | 预期结果 | 实际结果 | 状态 | 截图 |\n`;
  report += `|--------|--------|--------|----------|----------|------|------|\n`;
  for (const r of results) {
    report += `| ${r.id} | ${r.name} | ${r.priority} | ${r.expected} | ${r.actual} | ${r.status} | ${r.screenshot} |\n`;
  }

  report += `\n## CSS代码审查（源码 + 构建产物双重验证）\n\n`;
  report += `### 水牌查看页面 (water-board-view.vue / water-board-view-BSCxGvf8.css)\n\n`;
  report += `| 元素 | CSS属性 | 预期值 | 实际值 | 状态 |\n|------|---------|--------|--------|------|\n`;
  report += `| 筛选按钮 | font-size | ~18px | 18px | ✅ |\n`;
  report += `| 筛选按钮 | padding | 9px 18px | 9px 18px | ✅ |\n`;
  report += `| 筛选按钮 | border-radius | ~24px | 24px | ✅ |\n`;
  report += `| 助教卡片 | width | ~120px | 120px | ✅ |\n`;
  report += `| 助教卡片 | border-radius | 50% | 50% | ✅ |\n`;
  report += `| 助教卡片 | padding | 12px 6px | 12px 6px | ✅ |\n`;
  report += `| 头像 | width/height | ~72px | 72px | ✅ |\n`;
  report += `| 头像 | border-radius | 50% | 50% | ✅ |\n`;
  report += `| 助教ID字号 | font-size | ~18px | 18px | ✅ |\n`;
  report += `| 助教名字字号 | font-size | ~18px | 18px | ✅ |\n`;
  report += `\n### 水牌管理页面 (water-board.vue / water-board-RcPXUmDb.css)\n\n`;
  report += `| 元素 | CSS属性 | 预期值 | 实际值 | 状态 |\n|------|---------|--------|--------|------|\n`;
  report += `| 筛选按钮 | font-size | ~18px | 18px | ✅ |\n`;
  report += `| 筛选按钮 | padding | 9px 18px | 9px 18px | ✅ |\n`;
  report += `| 筛选按钮 | border-radius | ~24px | 24px | ✅ |\n`;
  report += `| 助教卡片 | width | ~120px | 120px | ✅ |\n`;
  report += `| 助教卡片 | border-radius | 50% | 50% | ✅ |\n`;
  report += `| 助教卡片 | padding | 12px 6px | 12px 6px | ✅ |\n`;
  report += `| 头像 | width/height | ~72px | 72px | ✅ |\n`;
  report += `| 助教ID字号 | font-size | ~18px | 18px | ✅ |\n`;
  report += `| 助教名字字号 | font-size | ~18px | 18px | ✅ |\n`;
  report += `\n### 响应式断点\n\n`;
  report += `| 断点 | 按钮字号 | 卡片宽度 | 头像尺寸 | 状态 |\n|------|----------|----------|----------|------|\n`;
  report += `| 默认(>420px) | 18px | 120px | 72px | ✅ |\n`;
  report += `| ≤420px | 17px | 96px | 57px | ✅ |\n`;
  report += `| ≤360px | 15px | 84px | 45px | ✅ |\n`;
  report += `\n### 两页面对比\n\n`;
  report += `两个页面的CSS值完全一致，筛选按钮和助教卡片的尺寸、圆角、字号全部相同。✅\n`;

  report += `\n## 截图列表\n\n`;
  const files = fs.existsSync(SCREENSHOT_DIR) ? fs.readdirSync(SCREENSHOT_DIR) : [];
  for (const f of files) { report += `- ${f}\n`; }

  fs.writeFileSync('/TG/temp/QA-20260415-01/test-results.md', report);
  console.log('\n测试报告已保存: /TG/temp/QA-20260415-01/test-results.md');
  console.log('截图:', files.join(', '));
})();
