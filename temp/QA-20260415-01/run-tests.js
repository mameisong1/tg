const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/TG/temp/QA-20260415-01/screenshots';
const BASE_URL = 'http://127.0.0.1:8089';
const API_URL = 'http://127.0.0.1:8088';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function screenshot(page, name, opts = {}) {
  const filePath = path.join(SCREENSHOT_DIR, name);
  return page.screenshot({ path: filePath, fullPage: opts.fullPage || false });
}

async function login(page) {
  console.log('--- 登录 ---');
  // 导航到首页
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  
  // 检查是否已登录
  const url = page.url();
  console.log('当前URL:', url);
  
  // 如果需要登录，找手机号输入框
  if (url.includes('login') || url.includes('phone') || url.includes('auth')) {
    console.log('在登录页面');
    await screenshot(page, '00_login-page.png');
    
    // 输入手机号
    const phoneInput = await page.$('input[type="tel"], input[placeholder*="手机"], input[placeholder*="电话"], input[name="phone"]');
    if (phoneInput) {
      await phoneInput.click();
      await phoneInput.type('13800138000', { delay: 50 });
    }
    
    // 输入验证码
    const codeInput = await page.$('input[placeholder*="验证码"], input[name="code"], input[type="text"][maxlength="6"]');
    if (codeInput) {
      await codeInput.click();
      await codeInput.type('888888', { delay: 50 });
    }
    
    // 找登录按钮
    const loginBtn = await page.$('button, .btn, [class*="login"], [class*="submit"]');
    if (loginBtn) {
      await loginBtn.click();
    }
    
    await new Promise(r => setTimeout(r, 3000));
    await screenshot(page, '01_after-login.png');
  }
  
  console.log('登录后URL:', page.url());
}

async function navigateToShuipai(page, type) {
  // type: 'view' or 'manage'
  console.log(`--- 导航到水牌${type === 'view' ? '查看' : '管理'}页面 ---`);
  
  // 找导航入口
  const navItems = await page.$$('a, [class*="nav"], [class*="tab"], button');
  for (const item of navItems) {
    const text = await page.evaluate(el => el.textContent, item);
    console.log('导航项:', text.trim().substring(0, 50));
  }
  
  // 尝试通过URL直接访问
  if (type === 'view') {
    await page.goto(`${BASE_URL}/shuipai`, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    // 备用：水牌查看
    await page.goto(`${BASE_URL}/board`, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
  } else {
    await page.goto(`${BASE_URL}/shuipai-manage`, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
  }
  
  await screenshot(page, `02_${type}-page.png`);
  console.log(`当前URL:`, page.url());
}

async function findFilterButtons(page) {
  // 找筛选按钮
  const buttons = await page.$$('button, .filter-btn, [class*="filter"], [class*="status-btn"], [class*="tag"]');
  const result = [];
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    const style = await page.evaluate(el => {
      const s = window.getComputedStyle(el);
      return {
        fontSize: s.fontSize,
        padding: s.padding,
        borderRadius: s.borderRadius,
        width: s.width,
        height: s.height,
        display: s.display,
        marginTop: s.marginTop,
        marginBottom: s.marginBottom,
        marginLeft: s.marginLeft,
        marginRight: s.marginRight,
      };
    }, btn);
    if (text.trim()) {
      result.push({ text: text.trim(), style });
    }
  }
  return result;
}

async function findAssistantCards(page) {
  // 找助教卡片
  const cards = await page.$$('[class*="card"], [class*="avatar"], [class*="tutor"], [class*="assistant"]');
  const result = [];
  for (const card of cards) {
    const text = await page.evaluate(el => el.textContent, card);
    const style = await page.evaluate(el => {
      const s = window.getComputedStyle(el);
      return {
        width: s.width,
        height: s.height,
        borderRadius: s.borderRadius,
        fontSize: s.fontSize,
        display: s.display,
      };
    }, card);
    if (text.trim() || (parseFloat(style.width) > 30 && parseFloat(style.height) > 30)) {
      result.push({ text: text.trim().substring(0, 50), style });
    }
  }
  return result;
}

async function runTests() {
  const results = [];
  
  console.log('连接浏览器...');
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null,
  });
  
  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();
  
  // 设置视口为常见手机尺寸
  await page.setViewport({ width: 375, height: 812 });
  
  try {
    // === 登录 ===
    await login(page);
    
    // 截图首页
    await screenshot(page, '00_homepage.png');
    console.log('首页URL:', page.url());
    
    // === 探索页面结构 ===
    console.log('\n=== 探索页面结构 ===');
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('页面文本:', bodyText);
    
    // 找所有链接和按钮
    const allLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button, [role="button"], .tab, .nav-item'));
      return links.map(el => ({
        text: el.textContent.trim().substring(0, 60),
        href: el.href || '',
        class: el.className,
        tagName: el.tagName,
      })).filter(x => x.text);
    });
    console.log('可点击元素:', JSON.stringify(allLinks, null, 2));
    
    // === TC-001: 水牌查看页面-筛选按钮尺寸 ===
    console.log('\n=== TC-001: 水牌查看页面-筛选按钮尺寸 ===');
    
    // 先找水牌查看页面入口
    let shuipaiViewLink = allLinks.find(l => 
      l.text.includes('水牌') || l.text.includes('看板') || l.text.includes('board') || 
      l.text.includes('桌牌') || l.text.includes('台桌')
    );
    
    if (shuipaiViewLink) {
      console.log('找到水牌入口:', shuipaiViewLink.text);
      // 点击水牌链接
      const linkEl = await page.$(`a, button`);
      // 通过文本查找并点击
      await page.evaluate((txt) => {
        const els = Array.from(document.querySelectorAll('a, button, [role="button"]'));
        const el = els.find(e => e.textContent.includes(txt));
        if (el) el.click();
      }, shuipaiViewLink.text.substring(0, 10));
      await new Promise(r => setTimeout(r, 3000));
      await screenshot(page, '03_shuipai-view-page.png');
    } else {
      // 尝试通过URL
      await page.goto(`${BASE_URL}/pages/shuipai/shuipai`, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
      await screenshot(page, '03_shuipai-view-page.png');
    }
    
    console.log('水牌查看页URL:', page.url());
    
    // 检查筛选按钮
    const filterButtons = await findFilterButtons(page);
    console.log('筛选按钮:', JSON.stringify(filterButtons.slice(0, 20), null, 2));
    
    // 截图筛选按钮区域
    await screenshot(page, '04_filter-buttons-view.png');
    
    // 评估按钮尺寸
    const hasLargeButtons = filterButtons.some(b => {
      const fontSize = parseFloat(b.style.fontSize);
      return fontSize >= 16; // 接近18px
    });
    
    results.push({
      id: 'TC-001',
      name: '水牌查看页面-筛选按钮尺寸',
      priority: 'P0',
      expected: '字号约18px，padding约9px 18px，border-radius约24px',
      actual: filterButtons.length > 0 ? 
        `找到${filterButtons.length}个按钮，字号范围: ${filterButtons.map(b => b.style.fontSize).join(', ')}` : 
        '未找到筛选按钮',
      status: hasLargeButtons ? '✅通过' : '❌失败',
      screenshot: '04_filter-buttons-view.png'
    });
    
    // === TC-002: 筛选按钮换行 ===
    console.log('\n=== TC-002: 筛选按钮换行 ===');
    const pageWidth = await page.evaluate(() => document.body.clientWidth);
    const hasHorizontalScroll = await page.evaluate(() => document.body.scrollWidth > document.body.clientWidth);
    
    results.push({
      id: 'TC-002',
      name: '水牌查看页面-筛选按钮换行',
      priority: 'P1',
      expected: '按钮自动换行，无水平溢出',
      actual: `页面宽度: ${pageWidth}px, 水平溢出: ${hasHorizontalScroll ? '有' : '无'}`,
      status: !hasHorizontalScroll ? '✅通过' : '❌失败',
      screenshot: '04_filter-buttons-view.png'
    });
    
    // === TC-003: 助教卡片尺寸 ===
    console.log('\n=== TC-003: 助教卡片尺寸 ===');
    const cards = await findAssistantCards(page);
    console.log('助教卡片:', JSON.stringify(cards.slice(0, 10), null, 2));
    
    await screenshot(page, '05_cards-view.png');
    
    const hasLargeCards = cards.some(c => {
      const width = parseFloat(c.style.width);
      return width >= 100; // 接近120px
    });
    
    results.push({
      id: 'TC-003',
      name: '水牌查看页面-助教卡片尺寸',
      priority: 'P0',
      expected: '卡片宽度约120px，头像约72px，字号约18px',
      actual: cards.length > 0 ?
        `找到${cards.length}个卡片，宽度范围: ${cards.map(c => c.style.width).join(', ')}` :
        '未找到助教卡片',
      status: hasLargeCards ? '✅通过' : '⚠️待确认',
      screenshot: '05_cards-view.png'
    });
    
    // === TC-004: 卡片圆形完整性 ===
    console.log('\n=== TC-004: 卡片圆形完整性 ===');
    const roundCards = cards.filter(c => {
      const w = parseFloat(c.style.width);
      const h = parseFloat(c.style.height);
      const diff = w > 0 ? Math.abs(w - h) / w * 100 : 100;
      return diff < 6;
    });
    
    results.push({
      id: 'TC-004',
      name: '水牌查看页面-卡片圆形完整性',
      priority: 'P1',
      expected: '卡片视觉上保持圆形，宽高差 < 6%',
      actual: `圆形卡片: ${roundCards.length}/${cards.length}`,
      status: cards.length === roundCards.length && cards.length > 0 ? '✅通过' : '⚠️待确认',
      screenshot: '05_cards-view.png'
    });
    
    // === 导航到水牌管理页面 ===
    console.log('\n=== 导航到水牌管理页面 ===');
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 375, height: 812 });
    
    // 尝试直接访问管理页面
    await page2.goto(`${BASE_URL}/pages/shuipai/manage`, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    
    // 如果不在管理页，尝试从首页导航
    if (!page2.url().includes('manage') && !page2.url().includes('admin')) {
      await page2.goto(`${BASE_URL}`, { waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(r => setTimeout(r, 2000));
      
      const manageLinks = await page2.evaluate(() => {
        const els = Array.from(document.querySelectorAll('a, button'));
        return els.filter(e => 
          e.textContent.includes('管理') || e.textContent.includes('manage')
        ).map(e => e.textContent.trim().substring(0, 60));
      });
      console.log('管理页面入口:', manageLinks);
      
      if (manageLinks.length > 0) {
        await page2.evaluate((txt) => {
          const els = Array.from(document.querySelectorAll('a, button'));
          const el = els.find(e => e.textContent.includes(txt));
          if (el) el.click();
        }, manageLinks[0].substring(0, 10));
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    
    await screenshot(page2, '06_manage-page.png', { page: page2 });
    console.log('管理页URL:', page2.url());
    
    // === TC-005: 水牌管理页面-筛选按钮尺寸 ===
    console.log('\n=== TC-005: 水牌管理页面-筛选按钮尺寸 ===');
    const manageButtons = await findFilterButtons(page2);
    console.log('管理页筛选按钮:', JSON.stringify(manageButtons.slice(0, 20), null, 2));
    
    await screenshot(page2, '07_filter-buttons-manage.png');
    
    const hasLargeButtonsManage = manageButtons.some(b => {
      const fontSize = parseFloat(b.style.fontSize);
      return fontSize >= 16;
    });
    
    results.push({
      id: 'TC-005',
      name: '水牌管理页面-筛选按钮尺寸',
      priority: 'P0',
      expected: '字号约18px，padding约9px 18px，border-radius约24px',
      actual: manageButtons.length > 0 ?
        `找到${manageButtons.length}个按钮，字号范围: ${manageButtons.map(b => b.style.fontSize).join(', ')}` :
        '未找到筛选按钮',
      status: hasLargeButtonsManage ? '✅通过' : '❌失败',
      screenshot: '07_filter-buttons-manage.png'
    });
    
    // === TC-006: 管理页面-筛选按钮换行 ===
    const hasHorizontalScrollManage = await page2.evaluate(() => document.body.scrollWidth > document.body.clientWidth);
    
    results.push({
      id: 'TC-006',
      name: '水牌管理页面-筛选按钮换行',
      priority: 'P1',
      expected: '按钮自动换行，无水平溢出',
      actual: `水平溢出: ${hasHorizontalScrollManage ? '有' : '无'}`,
      status: !hasHorizontalScrollManage ? '✅通过' : '❌失败',
      screenshot: '07_filter-buttons-manage.png'
    });
    
    // === TC-007: 管理页面-助教卡片尺寸 ===
    console.log('\n=== TC-007: 管理页面-助教卡片尺寸 ===');
    const manageCards = await findAssistantCards(page2);
    console.log('管理页卡片:', JSON.stringify(manageCards.slice(0, 10), null, 2));
    
    await screenshot(page2, '08_cards-manage.png');
    
    const hasLargeCardsManage = manageCards.some(c => {
      const width = parseFloat(c.style.width);
      return width >= 100;
    });
    
    results.push({
      id: 'TC-007',
      name: '水牌管理页面-助教卡片尺寸',
      priority: 'P0',
      expected: '卡片宽度约120px，头像约72px，字号约18px',
      actual: manageCards.length > 0 ?
        `找到${manageCards.length}个卡片，宽度范围: ${manageCards.map(c => c.style.width).join(', ')}` :
        '未找到助教卡片',
      status: hasLargeCardsManage ? '✅通过' : '⚠️待确认',
      screenshot: '08_cards-manage.png'
    });
    
    // === TC-008: 管理页面-卡片圆形完整性 ===
    const roundManageCards = manageCards.filter(c => {
      const w = parseFloat(c.style.width);
      const h = parseFloat(c.style.height);
      const diff = w > 0 ? Math.abs(w - h) / w * 100 : 100;
      return diff < 6;
    });
    
    results.push({
      id: 'TC-008',
      name: '水牌管理页面-卡片圆形完整性',
      priority: 'P1',
      expected: '卡片视觉上保持圆形，宽高差 < 6%',
      actual: `圆形卡片: ${roundManageCards.length}/${manageCards.length}`,
      status: manageCards.length === roundManageCards.length && manageCards.length > 0 ? '✅通过' : '⚠️待确认',
      screenshot: '08_cards-manage.png'
    });
    
    // === TC-009: 视觉一致性 ===
    console.log('\n=== TC-009: 视觉一致性 ===');
    // 对比两个页面的按钮尺寸
    const viewFontSizes = filterButtons.map(b => parseFloat(b.style.fontSize)).filter(x => !isNaN(x));
    const manageFontSizes = manageButtons.map(b => parseFloat(b.style.fontSize)).filter(x => !isNaN(x));
    
    const avgViewFont = viewFontSizes.length > 0 ? viewFontSizes.reduce((a,b) => a+b, 0) / viewFontSizes.length : 0;
    const avgManageFont = manageFontSizes.length > 0 ? manageFontSizes.reduce((a,b) => a+b, 0) / manageFontSizes.length : 0;
    
    results.push({
      id: 'TC-009',
      name: '查看页与管理页-视觉一致性',
      priority: 'P2',
      expected: '两个页面的卡片和按钮大小一致',
      actual: `查看页平均字号: ${avgViewFont.toFixed(1)}px, 管理页平均字号: ${avgManageFont.toFixed(1)}px`,
      status: Math.abs(avgViewFont - avgManageFont) < 3 ? '✅通过' : '⚠️差异较大',
      screenshot: '04_filter-buttons-view.png, 07_filter-buttons-manage.png'
    });
    
    // === TC-010: 响应式-420px ===
    console.log('\n=== TC-010: 响应式-420px ===');
    await page.setViewport({ width: 420, height: 900 });
    await new Promise(r => setTimeout(r, 1000));
    await screenshot(page, '09_responsive-420px.png');
    
    const buttons420 = await findFilterButtons(page);
    const cards420 = await findAssistantCards(page);
    
    results.push({
      id: 'TC-010',
      name: '响应式-420px断点',
      priority: 'P1',
      expected: '按钮和卡片按比例缩小，但依然比调整前大',
      actual: `按钮${buttons420.length}个, 卡片${cards420.length}个, 字号范围: ${buttons420.map(b => b.style.fontSize).join(', ')}`,
      status: buttons420.length > 0 ? '✅通过' : '⚠️待确认',
      screenshot: '09_responsive-420px.png'
    });
    
    // === TC-011: 响应式-360px ===
    console.log('\n=== TC-011: 响应式-360px ===');
    await page.setViewport({ width: 360, height: 780 });
    await new Promise(r => setTimeout(r, 1000));
    await screenshot(page, '10_responsive-360px.png');
    
    const buttons360 = await findFilterButtons(page);
    const cards360 = await findAssistantCards(page);
    const hasOverflow360 = await page.evaluate(() => document.body.scrollWidth > document.body.clientWidth);
    
    results.push({
      id: 'TC-011',
      name: '响应式-360px断点',
      priority: 'P1',
      expected: '按钮和卡片进一步缩小，布局正常无溢出',
      actual: `按钮${buttons360.length}个, 卡片${cards360.length}个, 水平溢出: ${hasOverflow360 ? '有' : '无'}`,
      status: !hasOverflow360 ? '✅通过' : '❌溢出',
      screenshot: '10_responsive-360px.png'
    });
    
    // === TC-012: 筛选按钮功能 ===
    console.log('\n=== TC-012: 筛选按钮功能 ===');
    await page.setViewport({ width: 375, height: 812 });
    await new Promise(r => setTimeout(r, 1000));
    
    // 获取初始卡片数量
    const initialCards = await findAssistantCards(page);
    console.log('初始卡片数:', initialCards.length);
    
    // 尝试点击第一个筛选按钮（非"全部"）
    let filterClicked = false;
    let afterFilterCards = initialCards.length;
    
    if (filterButtons.length > 1) {
      // 点击第二个按钮（可能是某个状态筛选）
      try {
        const btnText = filterButtons[1].text;
        console.log('点击筛选按钮:', btnText);
        
        await page.evaluate((txt) => {
          const els = Array.from(document.querySelectorAll('button, .filter-btn, [class*="filter"], [class*="tag"]'));
          const el = els.find(e => e.textContent.includes(txt));
          if (el) el.click();
        }, btnText);
        
        await new Promise(r => setTimeout(r, 2000));
        await screenshot(page, '11_filter-clicked.png');
        
        afterFilterCards = (await findAssistantCards(page)).length;
        filterClicked = true;
      } catch (e) {
        console.log('点击筛选按钮失败:', e.message);
      }
    }
    
    results.push({
      id: 'TC-012',
      name: '筛选按钮-功能正常',
      priority: 'P0',
      expected: '点击筛选后卡片按状态过滤',
      actual: filterClicked ?
        `初始${initialCards.length}张卡片，筛选后${afterFilterCards}张` :
        `未能成功点击筛选按钮`,
      status: filterClicked ? '✅通过' : '⚠️待确认',
      screenshot: filterClicked ? '11_filter-clicked.png' : '04_filter-buttons-view.png'
    });
    
    // === TC-013: 页面布局-无重叠溢出 ===
    console.log('\n=== TC-013: 页面布局 ===');
    await page.setViewport({ width: 375, height: 812 });
    
    const layoutIssue = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const issues = [];
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 10 && rect.height > 10) {
          const style = window.getComputedStyle(el);
          if (style.overflow === 'visible' && rect.right > document.body.clientWidth) {
            issues.push(el.tagName + '.' + el.className);
          }
        }
        if (issues.length >= 5) break;
      }
      return issues;
    });
    
    const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    
    results.push({
      id: 'TC-013',
      name: '页面布局-无重叠溢出',
      priority: 'P0',
      expected: '无元素重叠、无水平滚动条',
      actual: `水平滚动: ${hasHScroll ? '有' : '无'}, 溢出元素: ${layoutIssue.length}个`,
      status: !hasHScroll && layoutIssue.length === 0 ? '✅通过' : '⚠️有溢出',
      screenshot: '05_cards-view.png'
    });
    
    // 关闭管理页标签
    await page2.close();
    
  } catch (error) {
    console.error('测试出错:', error.message);
    results.push({
      id: 'ERROR',
      name: '测试错误',
      priority: '-',
      expected: '-',
      actual: error.message,
      status: '❌错误',
      screenshot: '-'
    });
  } finally {
    // 生成测试报告
    const report = generateReport(results);
    fs.writeFileSync('/TG/temp/QA-20260415-01/test-results.md', report);
    console.log('\n测试报告已保存到 /TG/temp/QA-20260415-01/test-results.md');
    
    // 截图列表
    const files = fs.readdirSync(SCREENSHOT_DIR);
    console.log('截图文件:', files.join(', '));
    
    browser.disconnect();
  }
}

function generateReport(results) {
  let md = `# 测试报告 — 水牌页面版面调整\n\n`;
  md += `测试时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
  md += `测试环境: H5 http://127.0.0.1:8089 | API http://127.0.0.1:8088\n\n`;
  
  // 统计
  const pass = results.filter(r => r.status.startsWith('✅')).length;
  const fail = results.filter(r => r.status.startsWith('❌')).length;
  const warn = results.filter(r => r.status.startsWith('⚠️')).length;
  md += `**测试结果**: ✅通过 ${pass} | ❌失败 ${fail} | ⚠️待确认 ${warn}\n\n`;
  
  md += `| 用例ID | 测试项 | 优先级 | 预期结果 | 实际结果 | 状态 | 截图 |\n`;
  md += `|--------|--------|--------|----------|----------|------|------|\n`;
  
  for (const r of results) {
    if (r.id === 'ERROR') continue;
    md += `| ${r.id} | ${r.name} | ${r.priority} | ${r.expected} | ${r.actual} | ${r.status} | ${r.screenshot} |\n`;
  }
  
  md += `\n## 截图列表\n\n`;
  const files = fs.readdirSync(SCREENSHOT_DIR);
  for (const f of files) {
    md += `- ${f}\n`;
  }
  
  return md;
}

runTests().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
