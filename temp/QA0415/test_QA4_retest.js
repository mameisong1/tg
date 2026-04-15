/**
 * QA4 复测脚本：验证 BUG-01 和 BUG-02 是否修复
 * 
 * 测试地址：http://127.0.0.1:8089
 * 使用 puppeteer 端到端测试
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'http://127.0.0.1:8089';
const WATER_BOARD_URL = `${BASE_URL}/#/pages/internal/water-board`;

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

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTests() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  let page = null;
  try {
    // ===== 第1页：构建产物检查 =====
    page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    
    log('========== QA4 复测开始 ==========');
    log(`目标地址: ${BASE_URL}`);
    
    // --- TC-BUILD-01: CSS 媒体查询是否编译 ---
    log('--- TC-BUILD-01: CSS 媒体查询检查 ---');
    await page.goto(WATER_BOARD_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await sleep(2000);
    
    const cssUrls = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.filter(l => l.href.includes('water-board')).map(l => l.href);
    });
    
    log(`找到 ${cssUrls.length} 个水牌相关CSS文件`);
    
    let cssPass = false;
    for (const cssUrl of cssUrls) {
      try {
        const cssText = await page.evaluate(async (url) => {
          const resp = await fetch(url);
          return await resp.text();
        }, cssUrl);
        
        const has420 = cssText.includes('420px');
        const has360 = cssText.includes('360px');
        const hasMedia = cssText.includes('@media');
        const fileName = cssUrl.split('/').pop();
        
        if (hasMedia && has420 && has360) {
          pass(`BUILD-CSS-${fileName}`, `CSS包含完整媒体查询: @media + 420px + 360px`);
          cssPass = true;
        } else if (hasMedia && (has420 || has360)) {
          fail(`BUILD-CSS-${fileName}`, `CSS包含@media但断点不全: 420px=${has420}, 360px=${has360}`);
        } else {
          fail(`BUILD-CSS-${fileName}`, `CSS不包含媒体查询`);
        }
      } catch (e) {
        fail(`BUILD-CSS-${cssUrl.split('/').pop()}`, `无法获取CSS: ${e.message}`);
      }
    }
    
    // 通过运行时CSS规则检查
    const runtimeMediaCheck = await page.evaluate(() => {
      let mediaRules = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSMediaRule) {
              if (rule.conditionText.includes('420') || rule.conditionText.includes('360')) {
                mediaRules.push(rule.conditionText);
              }
            }
          }
        } catch (e) {}
      }
      return mediaRules;
    });
    
    if (runtimeMediaCheck.length >= 2) {
      pass('RUNTIME-CSS', `运行时找到 ${runtimeMediaCheck.length} 条媒体查询: ${runtimeMediaCheck.join(', ')}`);
    } else {
      fail('RUNTIME-CSS', `运行时仅找到 ${runtimeMediaCheck.length} 条媒体查询`);
    }
    
    // --- TC-BUILD-02: JS setInterval 是否编译 ---
    log('--- TC-BUILD-02: JS 自动刷新代码检查 ---');
    
    const jsUrls = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      return scripts.filter(s => s.src.includes('water-board')).map(s => s.src);
    });
    
    log(`找到 ${jsUrls.length} 个水牌相关JS文件`);
    
    for (const jsUrl of jsUrls) {
      try {
        const jsText = await page.evaluate(async (url) => {
          const resp = await fetch(url);
          return await resp.text();
        }, jsUrl);
        
        const hasSetInterval = jsText.includes('setInterval');
        const hasClearInterval = jsText.includes('clearInterval');
        const has30000 = jsText.includes('30000') || jsText.includes('3e4');
        const fileName = jsUrl.split('/').pop();
        
        if (hasSetInterval && hasClearInterval && has30000) {
          pass(`BUILD-JS-${fileName}`, `JS包含完整自动刷新代码: setInterval + clearInterval + 30000(或3e4)`);
        } else {
          fail(`BUILD-JS-${fileName}`, `JS缺少自动刷新代码: setInterval=${hasSetInterval}, clearInterval=${hasClearInterval}, 30000=${has30000}`);
        }
      } catch (e) {
        fail(`BUILD-JS-${jsUrl.split('/').pop()}`, `无法获取JS: ${e.message}`);
      }
    }
    
    // --- 关闭第一页 ---
    await page.close();
    page = null;
    await sleep(1000);
    
    // ===== 第2页：响应式布局测试 =====
    log('--- 响应式布局测试 ---');
    
    page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(WATER_BOARD_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await sleep(3000);
    
    // TC-RESP-01: 标准屏 (>420px)
    log('TC-RESP-01: 标准屏 500px');
    await page.setViewport({ width: 500, height: 800 });
    await sleep(500);
    const standardStyles = await page.evaluate(() => {
      const chip = document.querySelector('.coach-chip');
      const getStyle = (el, prop) => el ? getComputedStyle(el).getPropertyValue(prop).trim() : null;
      return {
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        hasOverflow: document.documentElement.scrollWidth > window.innerWidth,
        chipWidth: getStyle(chip, 'width'),
        chipExists: chip !== null
      };
    });
    
    if (standardStyles.chipExists) {
      // 标准屏 chip 应该是 80px
      if (standardStyles.chipWidth === '80px') {
        pass('RESP-STD-500', `coach-chip宽度=${standardStyles.chipWidth}，符合标准屏预期`);
      } else {
        fail('RESP-STD-500', `coach-chip宽度=${standardStyles.chipWidth}，预期=80px`);
      }
    } else {
      log('RESP-STD-500: 未找到coach-chip元素（可能未登录）');
      fail('RESP-STD-500', '未找到coach-chip元素');
    }
    
    if (!standardStyles.hasOverflow) {
      pass('OVERFLOW-STD-500', '无水平溢出');
    } else {
      fail('OVERFLOW-STD-500', `水平溢出: scrollWidth=${standardStyles.scrollWidth} > viewportWidth=${standardStyles.viewportWidth}`);
    }
    
    // TC-RESP-02: 窄屏 (≤420px)
    log('TC-RESP-02: 窄屏 400px');
    await page.setViewport({ width: 400, height: 800 });
    await sleep(1000); // 等CSS媒体查询生效
    
    const narrowStyles = await page.evaluate(() => {
      const chip = document.querySelector('.coach-chip');
      const getStyle = (el, prop) => el ? getComputedStyle(el).getPropertyValue(prop).trim() : null;
      return {
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        hasOverflow: document.documentElement.scrollWidth > window.innerWidth,
        chipWidth: getStyle(chip, 'width'),
        chipPadding: getStyle(chip, 'padding'),
        chipExists: chip !== null
      };
    });
    
    if (narrowStyles.chipExists) {
      // 窄屏 chip 应该是 68px
      if (narrowStyles.chipWidth === '68px') {
        pass('RESP-NARROW-400', `coach-chip宽度=${narrowStyles.chipWidth}，符合窄屏预期`);
      } else {
        fail('RESP-NARROW-400', `coach-chip宽度=${narrowStyles.chipWidth}，预期=68px（媒体查询可能未生效）`);
      }
    } else {
      log('RESP-NARROW-400: 未找到coach-chip元素（可能未登录）');
      fail('RESP-NARROW-400', '未找到coach-chip元素');
    }
    
    if (!narrowStyles.hasOverflow) {
      pass('OVERFLOW-NARROW-400', '无水平溢出');
    } else {
      fail('OVERFLOW-NARROW-400', `水平溢出: scrollWidth=${narrowStyles.scrollWidth} > viewportWidth=${narrowStyles.viewportWidth}`);
    }
    
    // TC-RESP-03: 极窄屏 (≤360px)
    log('TC-RESP-03: 极窄屏 340px');
    await page.setViewport({ width: 340, height: 800 });
    await sleep(1000);
    
    const tinyStyles = await page.evaluate(() => {
      const chip = document.querySelector('.coach-chip');
      const getStyle = (el, prop) => el ? getComputedStyle(el).getPropertyValue(prop).trim() : null;
      return {
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        hasOverflow: document.documentElement.scrollWidth > window.innerWidth,
        chipWidth: getStyle(chip, 'width'),
        chipPadding: getStyle(chip, 'padding'),
        chipExists: chip !== null
      };
    });
    
    if (tinyStyles.chipExists) {
      // 极窄屏 chip 应该是 60px
      if (tinyStyles.chipWidth === '60px') {
        pass('RESP-TINY-340', `coach-chip宽度=${tinyStyles.chipWidth}，符合极窄屏预期`);
      } else {
        fail('RESP-TINY-340', `coach-chip宽度=${tinyStyles.chipWidth}，预期=60px（媒体查询可能未生效）`);
      }
    } else {
      log('RESP-TINY-340: 未找到coach-chip元素（可能未登录）');
      fail('RESP-TINY-340', '未找到coach-chip元素');
    }
    
    if (!tinyStyles.hasOverflow) {
      pass('OVERFLOW-TINY-340', '无水平溢出');
    } else {
      fail('OVERFLOW-TINY-340', `水平溢出: scrollWidth=${tinyStyles.scrollWidth} > viewportWidth=${tinyStyles.viewportWidth}`);
    }
    
    // TC-RESP-04: flex-wrap 折行测试
    log('TC-RESP-04: flex-wrap折行测试');
    const flexWrapCheck = await page.evaluate(() => {
      const chipsContainer = document.querySelector('.coach-chips');
      if (!chipsContainer) return { exists: false };
      const style = getComputedStyle(chipsContainer);
      return {
        exists: true,
        flexWrap: style.flexWrap,
        display: style.display
      };
    });
    
    if (flexWrapCheck.exists) {
      if (flexWrapCheck.flexWrap === 'wrap' || flexWrapCheck.flexWrap === 'wrap-reverse') {
        pass('FLEX-WRAP', `.coach-chips 使用 flex-wrap: ${flexWrapCheck.flexWrap}，支持折行`);
      } else {
        fail('FLEX-WRAP', `.coach-chips 的 flex-wrap=${flexWrapCheck.flexWrap}，预期=wrap`);
      }
    } else {
      fail('FLEX-WRAP', '未找到 .coach-chips 容器');
    }
    
    // --- 关闭第二页 ---
    await page.close();
    page = null;
    await sleep(1000);
    
    // ===== 第3页：自动刷新行为测试 =====
    log('--- 自动刷新行为测试 ---');
    
    page = await browser.newPage();
    
    // 拦截API请求，统计请求次数
    let apiRequestCount = 0;
    const apiRequestTimes = [];
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.url().includes('/api/') && req.url().includes('water')) {
        apiRequestCount++;
        apiRequestTimes.push(Date.now());
        log(`  [网络请求] ${req.url().split('/').pop()}`);
      }
      req.continue();
    });
    
    await page.setViewport({ width: 500, height: 800 });
    await page.goto(WATER_BOARD_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    
    const initialRequestCount = apiRequestCount;
    log(`初始API请求次数: ${initialRequestCount}`);
    
    if (initialRequestCount > 0) {
      pass('AUTO-LOAD', `页面加载时触发了 ${initialRequestCount} 次API请求`);
    } else {
      fail('AUTO-LOAD', '页面加载时未触发API请求（可能未登录）');
    }
    
    // 等待约30秒观察自动刷新
    log('等待30秒观察自动刷新...');
    await sleep(32000);
    
    const after30sCount = apiRequestCount;
    const newRequests = after30sCount - initialRequestCount;
    
    if (newRequests > 0) {
      pass('AUTO-REFRESH-30S', `30秒后触发了 ${newRequests} 次新API请求，自动刷新生效`);
    } else {
      fail('AUTO-REFRESH-30S', `30秒后未触发新API请求（初始=${initialRequestCount}, 30秒后=${after30sCount}）`);
    }
    
    // 测试手动刷新不干扰自动刷新
    log('测试手动刷新...');
    const beforeManualCount = apiRequestCount;
    
    // 尝试点击刷新按钮
    const refreshClicked = await page.evaluate(() => {
      const refreshBtn = document.querySelector('.refresh-btn, [class*="refresh"]');
      if (refreshBtn) {
        refreshBtn.click();
        return true;
      }
      return false;
    });
    
    if (refreshClicked) {
      await sleep(3000);
      const afterManualCount = apiRequestCount;
      const manualRequests = afterManualCount - beforeManualCount;
      
      if (manualRequests > 0) {
        pass('MANUAL-REFRESH', `手动刷新触发 ${manualRequests} 次API请求`);
      } else {
        fail('MANUAL-REFRESH', '手动刷新未触发API请求');
      }
    } else {
      log('未找到刷新按钮，跳过手动刷新测试');
      fail('MANUAL-REFRESH', '未找到刷新按钮');
    }
    
    // 继续等待观察定时器是否继续
    log('继续等待25秒观察定时器是否继续运行...');
    await sleep(25000);
    
    const finalCount = apiRequestCount;
    const afterManualRefresh = finalCount - beforeManualCount - (refreshClicked ? 1 : 0);
    
    if (afterManualRefresh > 0) {
      pass('TIMER-CONTINUE', '手动刷新后定时器继续运行');
    } else {
      fail('TIMER-CONTINUE', '手动刷新后未观察到定时器继续触发请求');
    }
    
    // --- 关闭第三页 ---
    await page.close();
    page = null;
    
  } catch (e) {
    log(`测试出错: ${e.message}`);
    fail('ERROR', `测试执行异常: ${e.message}`);
  } finally {
    if (page) {
      try { await page.close(); } catch(e) {}
    }
    await browser.close();
  }
  
  // ===== 输出汇总 =====
  log('');
  log('========== QA4 复测结果汇总 ==========');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  log(`总计: ${results.length} 项`);
  log(`通过: ${passed}`);
  log(`失败: ${failed}`);
  log('');
  results.forEach(r => {
    log(`${r.status === 'PASS' ? '✅' : '❌'} ${r.tc}: ${r.detail}`);
  });
  
  return results;
}

runTests().then(results => {
  // 输出JSON结果供脚本使用
  console.log('\n=== JSON_RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}).catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
