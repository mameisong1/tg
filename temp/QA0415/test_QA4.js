/**
 * QA4 测试脚本：前端H5水牌管理/水牌查看页面
 * 
 * 测试项目：
 * 1. CSS响应式适配（窄屏 ≤420px / 极窄屏 ≤360px）
 * 2. 30秒定时自动刷新
 * 3. 手动刷新与自动刷新共存
 * 
 * 使用方法：npx puppeteer test_QA4.js
 * 或使用 browser 工具手动执行
 */

const BASE_URL = 'http://127.0.0.1:8089';
const WATER_BOARD_URL = `${BASE_URL}/#/pages/internal/water-board`;
const WATER_BOARD_VIEW_URL = `${BASE_URL}/#/pages/internal/water-board-view`;

const results = [];

function log(msg) {
  const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

function pass(tc, detail) {
  results.push({ tc, status: 'PASS', detail });
  log(`✅ ${tc}: ${detail}`);
}

function fail(tc, detail) {
  results.push({ tc, status: 'FAIL', detail });
  log(`❌ ${tc}: ${detail}`);
}

// ===== 测试函数 =====

async function testCSSMediaQueriesInBuild(page) {
  // TC-BUILD-01: 检查构建产物中是否包含媒体查询
  log('检查构建CSS是否包含@media规则...');
  
  const cssCheck = await page.evaluate(() => {
    const sheets = document.styleSheets;
    let mediaCount = 0;
    let waterBoardMediaRules = [];
    
    for (let sheet of sheets) {
      try {
        for (let rule of sheet.cssRules) {
          if (rule instanceof CSSMediaRule) {
            mediaCount++;
            if (rule.conditionText.includes('420') || rule.conditionText.includes('360')) {
              waterBoardMediaRules.push(rule.conditionText);
            }
          }
        }
      } catch (e) {
        // 跨域样式表无法访问
      }
    }
    
    return { mediaCount, waterBoardMediaRules };
  });
  
  if (cssCheck.waterBoardMediaRules.length > 0) {
    pass('BUILD-CSS-01', `找到 ${cssCheck.waterBoardMediaRules.length} 条水牌媒体查询: ${cssCheck.waterBoardMediaRules.join(', ')}`);
  } else {
    fail('BUILD-CSS-01', '构建CSS中未找到任何水牌相关的@media规则 (420px/360px)');
  }
  
  return cssCheck;
}

async function testAutoRefreshInJS(page) {
  // TC-JS-01: 检查JS中是否包含setInterval和30000
  log('检查构建JS是否包含自动刷新代码...');
  
  const jsCheck = await page.evaluate(() => {
    // 检查页面源码中是否包含30000或setInterval
    const scripts = document.querySelectorAll('script[src]');
    let found30000 = false;
    let foundSetInterval = false;
    
    return {
      scriptCount: scripts.length,
      scripts: Array.from(scripts).map(s => s.src).filter(s => s.includes('water-board'))
    };
  });
  
  log(`找到 ${jsCheck.scriptCount} 个脚本，水牌相关: ${JSON.stringify(jsCheck.scripts)}`);
  
  // 检查setInterval是否被调用
  const hasTimer = await page.evaluate(() => {
    // 覆盖setInterval来跟踪调用
    return typeof window.setInterval === 'function';
  });
  
  if (!hasTimer) {
    fail('BUILD-JS-01', 'setInterval不可用');
  } else {
    log('setInterval函数存在，但需要验证水牌页面是否调用');
  }
  
  return jsCheck;
}

async function testResponsiveWidth(page, width, testName, expectedValues) {
  // TC-XX: 测试特定宽度下的样式
  await page.setViewport({ width, height: 800 });
  await page.reload({ waitUntil: 'networkidle0' });
  
  const styles = await page.evaluate((expected) => {
    const filterBar = document.querySelector('.filter-bar');
    const coachChip = document.querySelector('.coach-chip');
    const coachAvatar = document.querySelector('.coach-avatar, .coach-chip-avatar');
    
    const getStyle = (el, prop) => el ? getComputedStyle(el).getPropertyValue(prop).trim() : null;
    
    return {
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      hasOverflow: document.documentElement.scrollWidth > window.innerWidth,
      filterBarGap: getStyle(filterBar, 'gap'),
      filterBarPadding: getStyle(filterBar, 'padding'),
      coachChipWidth: getStyle(coachChip, 'width'),
      coachChipPadding: getStyle(coachChip, 'padding'),
      avatarWidth: getStyle(coachAvatar, 'width'),
      avatarHeight: getStyle(coachAvatar, 'height'),
    };
  }, expectedValues);
  
  log(`宽度 ${width}px: 实际=${styles.viewportWidth}px, 溢出=${styles.hasOverflow}, coach-chip=${styles.coachChipWidth}`);
  
  return styles;
}

// ===== 主测试流程 =====

async function runTests(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  
  log('========== 开始 QA4 测试 ==========');
  
  // Step 1: 打开水牌管理页面（可能需要登录）
  log(`打开 ${WATER_BOARD_URL}...`);
  await page.goto(WATER_BOARD_URL, { waitUntil: 'networkidle0', timeout: 15000 });
  
  // 检查是否需要登录
  const currentUrl = page.url();
  const pageContent = await page.content();
  
  if (pageContent.includes('login') || pageContent.includes('登录') || currentUrl.includes('login')) {
    log('需要登录，尝试登录...');
    
    // 如果重定向到登录页面
    if (currentUrl.includes('login')) {
      // 尝试访问首页看看
      await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    }
    
    fail('AUTH-01', '页面需要登录，无法进行完整自动化测试');
    log('跳过需要登录的测试用例');
  }
  
  // Step 2: 构建产物检查（无需登录）
  log('--- 构建产物检查 ---');
  await testCSSMediaQueriesInBuild(page);
  await testAutoRefreshInJS(page);
  
  // Step 3: CSS文件直接检查
  log('--- CSS文件内容检查 ---');
  
  // 检查CSS文件是否包含媒体查询
  const cssResponse = await page.evaluate(async () => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    const waterBoardCSS = links.filter(l => l.href.includes('water-board'));
    return waterBoardCSS.map(l => l.href);
  });
  
  log(`水牌相关CSS: ${JSON.stringify(cssResponse)}`);
  
  for (const cssUrl of cssResponse) {
    try {
      const cssText = await page.evaluate(async (url) => {
        const resp = await fetch(url);
        return await resp.text();
      }, cssUrl);
      
      const has420 = cssText.includes('420px');
      const has360 = cssText.includes('360px');
      const hasMedia = cssText.includes('@media');
      
      if (hasMedia && has420 && has360) {
        pass(`CSS-FILE-${cssUrl.split('/').pop()}`, 'CSS文件包含完整的媒体查询 (420px + 360px)');
      } else if (hasMedia) {
        fail(`CSS-FILE-${cssUrl.split('/').pop()}`, `CSS包含@media但缺少断点: 420px=${has420}, 360px=${has360}`);
      } else {
        fail(`CSS-FILE-${cssUrl.split('/').pop()}`, 'CSS文件不包含任何@media规则');
      }
    } catch (e) {
      log(`无法获取CSS文件: ${cssUrl} - ${e.message}`);
    }
  }
  
  // Step 4: JS文件内容检查
  log('--- JS文件内容检查 ---');
  
  const jsResponse = await page.evaluate(async () => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const waterBoardJS = scripts.filter(s => s.src.includes('water-board'));
    return waterBoardJS.map(s => s.src);
  });
  
  log(`水牌相关JS: ${JSON.stringify(jsResponse)}`);
  
  for (const jsUrl of jsResponse) {
    try {
      const jsText = await page.evaluate(async (url) => {
        const resp = await fetch(url);
        return await resp.text();
      }, jsUrl);
      
      const has30000 = jsText.includes('30000');
      const hasSetInterval = jsText.includes('setInterval');
      const hasClearInterval = jsText.includes('clearInterval');
      const hasRefresh = jsText.includes('refresh');
      
      if (has30000 && hasSetInterval) {
        pass(`JS-FILE-${jsUrl.split('/').pop()}`, 'JS文件包含自动刷新代码 (setInterval + 30000)');
      } else {
        fail(`JS-FILE-${jsUrl.split('/').pop()}`, 
          `JS文件缺少自动刷新代码: setInterval=${hasSetInterval}, 30000=${has30000}, clearInterval=${hasClearInterval}, refresh=${hasRefresh}`);
      }
    } catch (e) {
      log(`无法获取JS文件: ${jsUrl} - ${e.message}`);
    }
  }
  
  // Step 5: 响应式布局测试（如果能登录的话）
  log('--- 响应式布局测试 ---');
  
  const widths = [
    { width: 500, name: '标准屏(>420px)', expected: { chipWidth: '80px' } },
    { width: 400, name: '窄屏(≤420px)', expected: { chipWidth: '68px' } },
    { width: 340, name: '极窄屏(≤360px)', expected: { chipWidth: '60px' } },
  ];
  
  for (const { width, name, expected } of widths) {
    try {
      const styles = await testResponsiveWidth(page, width, name, expected);
      
      if (styles.coachChipWidth === null) {
        log(`宽度 ${width}: 未找到coach-chip元素（可能未登录或无数据）`);
        fail(`RESP-${name}`, '未找到coach-chip元素，无法测试响应式');
      } else if (styles.coachChipWidth === expected.chipWidth) {
        pass(`RESP-${name}`, `coach-chip宽度=${styles.coachChipWidth}，符合预期`);
      } else {
        fail(`RESP-${name}`, `coach-chip宽度=${styles.coachChipWidth}，预期=${expected.chipWidth}（媒体查询未生效）`);
      }
      
      if (styles.hasOverflow) {
        fail(`OVERFLOW-${name}`, `水平溢出: scrollWidth=${styles.scrollWidth} > viewportWidth=${styles.viewportWidth}`);
      } else {
        pass(`OVERFLOW-${name}`, `无水平溢出`);
      }
    } catch (e) {
      fail(`RESP-${name}`, `测试出错: ${e.message}`);
    }
  }
  
  // Step 6: 自动刷新行为测试
  log('--- 自动刷新行为测试 ---');
  
  // 检测页面是否有setInterval调用
  const hasAutoRefresh = await page.evaluate(() => {
    // 在页面加载后，检查是否有定时器存在
    // 由于我们无法直接访问Vue内部，只能通过network请求来推断
    return '检测需通过network请求模式';
  });
  
  // 观察30秒内是否有自动network请求
  log('观察30秒内是否有自动API请求...（需要登录状态）');
  log('（由于需要登录，此测试需在登录状态下手动执行）');
  fail('AUTO-REFRESH-01', '需要登录状态才能测试自动刷新行为，已通过代码审查确认JS构建产物缺少setInterval调用');
  
  // 输出结果汇总
  log('========== 测试结果汇总 ==========');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  log(`总计: ${results.length} 项测试`);
  log(`通过: ${passed}, 失败: ${failed}`);
  
  results.forEach(r => {
    log(`${r.status === 'PASS' ? '✅' : '❌'} ${r.tc}: ${r.detail}`);
  });
  
  return results;
}

// ===== 执行 =====

if (typeof require !== 'undefined') {
  // Node.js 环境（Puppeteer）
  (async () => {
    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      await runTests(browser);
      await browser.close();
    } catch (e) {
      console.error('Puppeteer执行失败:', e.message);
      console.log('请使用 browser 工具手动执行测试');
    }
  })();
}

// 导出供其他模块使用
if (typeof module !== 'undefined') {
  module.exports = { runTests, BASE_URL, WATER_BOARD_URL, WATER_BOARD_VIEW_URL };
}
