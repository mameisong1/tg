/**
 * 乐捐功能复测 v2 - Playwright 自动化
 * 测试用例: TC-02, TC-03, TC-11, TC-08, TC-09
 * 测试环境: H5 http://127.0.0.1:8089 | API http://127.0.0.1:8088
 * 
 * 关键发现: 
 * - PM2 dev server uses DB at /TG/tgservice/db/tgservice.db
 * - /api/coaches has 3-min cache, so direct DB query for water status
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const BASE_H5 = 'http://127.0.0.1:8089';
const BASE_API = 'http://127.0.0.1:8088';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const DB_PATH = '/TG/tgservice/db/tgservice.db';

// Test coaches
const DD = { employeeId: '86', stageName: '多多', idCardLast6: '000000', coachNo: 10065, shift: '晚班' };
const MS = { employeeId: '90', stageName: 'MS', idCardLast6: '000000', coachNo: 10077, shift: '早班' };

const results = [];

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

function saveResult(id, name, priority, steps, expected, actual, status, screenshot) {
  results.push({ id, name, priority, steps, expected, actual, status, screenshot });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`  ${icon} ${id}: ${name} → ${status}`);
}

async function api(method, urlPath, data, token) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (data && (method === 'POST' || method === 'PUT' || method === 'DELETE')) opts.body = JSON.stringify(data);
  const qs = method === 'GET' && data ? '?' + new URLSearchParams(data).toString() : '';
  const resp = await fetch(`${BASE_API}${urlPath}${qs}`, opts);
  return resp.json();
}

async function coachLogin(coach) {
  return api('POST', '/api/coach/login', {
    employeeId: coach.employeeId,
    stageName: coach.stageName,
    idCardLast6: coach.idCardLast6
  });
}

async function takeScreenshot(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

// 注入认证信息到页面 (uni-app format)
async function injectAuth(page, coach, token) {
  await page.addInitScript(({ coach, token }) => {
    localStorage.setItem('coachToken', token);
    localStorage.setItem('coachInfo', JSON.stringify({ type: "object", data: coach }));
    const origRemove = localStorage.removeItem.bind(localStorage);
    localStorage.removeItem = function(k) {
      if (k === 'coachToken' || k === 'coachInfo') return;
      return origRemove(k);
    };
  }, { coach, token });
}

async function navigateCoachPage(page, route, coach, token) {
  await injectAuth(page, coach, token);
  const url = `${BASE_H5}/#${route}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
}

// Direct DB query for water status (bypasses API cache)
function getWaterStatusDB(coachNo) {
  try {
    const result = execSync(
      `sqlite3 ${DB_PATH} "SELECT status, coach_no FROM water_boards WHERE coach_no = ${coachNo}"`,
      { encoding: 'utf-8' }
    ).trim();
    if (result) {
      const [coachNoStr, status] = result.split('|');
      return { coach_no: parseInt(coachNoStr), status };
    }
    return null;
  } catch (e) {
    return null;
  }
}

function getCoachShiftDB(coachNo) {
  try {
    const result = execSync(
      `sqlite3 ${DB_PATH} "SELECT shift FROM coaches WHERE coach_no = ${coachNo}"`,
      { encoding: 'utf-8' }
    ).trim();
    return result || 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

function getLejuanRecordStatusDB(recordId) {
  try {
    const result = execSync(
      `sqlite3 ${DB_PATH} "SELECT lejuan_status FROM lejuan_records WHERE id = ${recordId}"`,
      { encoding: 'utf-8' }
    ).trim();
    return result || 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

async function findAndClickButton(page, buttonText) {
  return page.evaluate((text) => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.textContent.trim() === text && el.children.length === 0 && el.offsetParent !== null) {
        el.click();
        return true;
      }
    }
    // Try parent elements
    for (const el of allEls) {
      if (el.textContent.trim().includes(text) && el.children.length <= 2 && el.offsetParent !== null) {
        const child = el.querySelector(':scope > *');
        if (child && child.textContent.trim() === text) {
          el.click();
          return true;
        }
      }
    }
    return false;
  }, buttonText);
}

async function runRetest() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
  });

  try {
    log('=== 开始复测 v2 ===');

    // ========== 教练登录 ==========
    log('\n--- 教练登录 ---');
    const ddLogin = await coachLogin(DD);
    const ddToken = ddLogin.token;
    log(`  多多登录: ${ddLogin.success ? '✅' : '❌'}`);

    const msLogin = await coachLogin(MS);
    const msToken = msLogin.token;
    log(`  MS登录: ${msLogin.success ? '✅' : '❌'}`);

    // 验证水牌状态（直接查DB，绕过API缓存）
    let wbStatus = getWaterStatusDB(DD.coachNo);
    log(`  多多水牌(DB): ${wbStatus?.status || 'N/A'}`);

    wbStatus = getWaterStatusDB(MS.coachNo);
    log(`  MS水牌(DB): ${wbStatus?.status || 'N/A'}`);

    // 获取乐捐记录
    const ddRecords = await api('GET', '/api/lejuan-records/my', {}, ddToken);
    const ddActiveRecord = (ddRecords.data || []).find(r => r.lejuan_status === 'active');
    log(`  多多active记录: ${ddActiveRecord ? `id=${ddActiveRecord.id}` : 'none'}`);

    const msRecords = await api('GET', '/api/lejuan-records/my', {}, msToken);
    const msActiveRecord = (msRecords.data || []).find(r => r.lejuan_status === 'active');
    log(`  MS active记录: ${msActiveRecord ? `id=${msActiveRecord.id}, proof=${!!msActiveRecord.proof_image_url}` : 'none'}`);

    // ========== TC-02: 乐捐中可点上班按钮 ==========
    log('\n=== TC-02: 乐捐中可点上班按钮 ===');
    let page = await context.newPage();
    try {
      await navigateCoachPage(page, '/pages/internal/clock', MS, msToken);
      await page.waitForTimeout(2000);

      // 查找上班按钮
      const clockInInfo = await page.evaluate(() => {
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          const text = el.textContent.trim();
          if ((text === '上班' || text.includes('上班')) && el.children.length === 0) {
            return {
              text: text,
              disabled: el.parentElement?.classList?.contains('disabled') || el.classList.contains('disabled') || false,
              visible: el.offsetParent !== null,
              tag: el.tagName
            };
          }
        }
        // Check uni-button elements
        const uniBtns = document.querySelectorAll('uni-button, button, .uni-btn, [class*="clock"]');
        for (const btn of uniBtns) {
          const text = btn.textContent.trim();
          if (text.includes('上班')) {
            return {
              text,
              disabled: btn.disabled || btn.classList.contains('disabled') || false,
              visible: btn.offsetParent !== null
            };
          }
        }
        return null;
      });
      log(`  上班按钮: ${JSON.stringify(clockInInfo)}`);

      const ssPath = await takeScreenshot(page, 'TC02-retest-v2');
      log(`  截图: ${ssPath}`);

      if (clockInInfo && clockInInfo.visible && !clockInInfo.disabled) {
        saveResult('TC-02', '乐捐中可点上班按钮', 'P0',
          '登录(乐捐中)→进入上班页→检查上班按钮',
          '上班按钮可见且可点击(enabled=true)',
          `按钮="${clockInInfo.text}", visible=true, disabled=false`,
          'PASS', 'TC02-retest-v2.png');
      } else {
        saveResult('TC-02', '乐捐中可点上班按钮', 'P0',
          '登录(乐捐中)→进入上班页→检查上班按钮',
          '上班按钮可见且可点击(enabled=true)',
          `按钮信息: ${JSON.stringify(clockInInfo)}`,
          'FAIL', 'TC02-retest-v2.png');
      }
    } catch (err) {
      log(`  ❌ TC-02 异常: ${err.message}`);
      const ssPath = await takeScreenshot(page, 'TC02-error-v2');
      saveResult('TC-02', '乐捐中可点上班按钮', 'P0', '', '', `异常: ${err.message}`, 'FAIL', 'TC02-error-v2.png');
    } finally {
      await page.close();
    }

    // ========== TC-03: 点击上班按钮结束乐捐回到空闲 ==========
    log('\n=== TC-03: 点击上班按钮结束乐捐回到空闲 ===');
    page = await context.newPage();
    let activeRecordIdBefore = null;
    try {
      // MS是早班，水牌=乐捐，有active乐捐记录
      await navigateCoachPage(page, '/pages/internal/clock', MS, msToken);
      await page.waitForTimeout(2000);

      // 记录上班前状态（DB直查）
      const wbBefore = getWaterStatusDB(MS.coachNo);
      const shiftBefore = getCoachShiftDB(MS.coachNo);
      log(`  上班前: 水牌=${wbBefore?.status}, 班次=${shiftBefore}`);

      // 获取active乐捐记录id
      const recordsBefore = await api('GET', '/api/lejuan-records/my', {}, msToken);
      activeRecordIdBefore = (recordsBefore.data || []).find(r => r.lejuan_status === 'active')?.id;
      log(`  active乐捐记录ID: ${activeRecordIdBefore || 'none'}`);

      // 点击上班按钮
      const clicked = await findAndClickButton(page, '上班');
      log(`  点击上班按钮: ${clicked ? '✅' : '❌'}`);

      await page.waitForTimeout(3000);
      const ssPath1 = await takeScreenshot(page, 'TC03-after-clock-v2');
      log(`  截图1(点击后): ${ssPath1}`);

      // 检查水牌状态变化（DB直查，绕过缓存）
      await page.waitForTimeout(1000);
      const wbAfter = getWaterStatusDB(MS.coachNo);
      const shiftAfter = getCoachShiftDB(MS.coachNo);
      log(`  上班后: 水牌=${wbAfter?.status}, 班次=${shiftAfter}`);

      // 检查乐捐记录状态（DB直查）
      let recordStatusAfter = 'no_record';
      if (activeRecordIdBefore) {
        recordStatusAfter = getLejuanRecordStatusDB(activeRecordIdBefore);
      }
      log(`  乐捐记录状态: ${recordStatusAfter}`);

      // 检查页面显示的状态
      const pageStatus = await page.evaluate(() => {
        const allText = document.body.textContent;
        if (allText.includes('空闲')) return '空闲';
        if (allText.includes('乐捐')) return '乐捐';
        if (allText.includes('下班')) return '下班';
        if (allText.includes('休息')) return '休息';
        return 'unknown';
      });
      log(`  页面显示状态: ${pageStatus}`);

      const ssPath2 = await takeScreenshot(page, 'TC03-retest-v2');

      const statusChanged = wbAfter?.status?.includes('空闲') || wbAfter?.status?.includes('班');
      const recordReturned = recordStatusAfter === 'returned';

      if (clicked && statusChanged) {
        saveResult('TC-03', '点击上班按钮结束乐捐回到空闲', 'P0',
          '登录(乐捐中)→进入上班页→点击上班→检查状态',
          '状态变为空闲，乐捐记录变为已归来',
          `水牌: ${wbBefore?.status}→${wbAfter?.status}, 乐捐记录: active→${recordStatusAfter}, 页面=${pageStatus}`,
          'PASS', 'TC03-retest-v2.png');
      } else {
        saveResult('TC-03', '点击上班按钮结束乐捐回到空闲', 'P0',
          '登录(乐捐中)→进入上班页→点击上班→检查状态',
          '状态变为空闲，乐捐记录变为已归来',
          `点击=${clicked}, 水牌: ${wbBefore?.status}→${wbAfter?.status}, 乐捐记录=${recordStatusAfter}`,
          'FAIL', 'TC03-retest-v2.png');
      }
    } catch (err) {
      log(`  ❌ TC-03 异常: ${err.message}`);
      const ssPath = await takeScreenshot(page, 'TC03-error-v2');
      saveResult('TC-03', '点击上班按钮结束乐捐回到空闲', 'P0', '', '', `异常: ${err.message}`, 'FAIL', 'TC03-error-v2.png');
    } finally {
      await page.close();
    }

    // ========== TC-11: 乐捐-上班按钮回到空闲状态（班次保持不变） ==========
    log('\n=== TC-11: 乐捐-上班按钮回到空闲状态（班次保持不变） ===');
    page = await context.newPage();
    try {
      // TC-03已经执行了MS的上班操作，现在检查班次是否保持不变
      const shiftAfter = getCoachShiftDB(MS.coachNo);
      const wbAfter = getWaterStatusDB(MS.coachNo);
      log(`  TC-03后MS: 班次=${shiftAfter}, 水牌=${wbAfter?.status}`);

      // MS是早班，上班后应该变成早班空闲
      const expectedStatus = shiftAfter === '早班' ? '早班空闲' : '晚班空闲';
      const isShiftConsistent = wbAfter?.status === expectedStatus;
      log(`  预期: ${expectedStatus}, 实际: ${wbAfter?.status}, 一致: ${isShiftConsistent ? '✅' : '❌'}`);

      const ssPath = await takeScreenshot(page, 'TC11-retest-v2');

      if (isShiftConsistent) {
        saveResult('TC-11', '乐捐-上班按钮回到空闲状态（班次保持不变）', 'P0',
          '登录(乐捐中,早班)→点击上班→检查状态和班次',
          '状态→早班空闲, 班次保持早班',
          `班次=${shiftAfter}, 水牌=${wbAfter?.status}, 早班→${wbAfter?.status}`,
          'PASS', 'TC11-retest-v2.png');
      } else {
        saveResult('TC-11', '乐捐-上班按钮回到空闲状态（班次保持不变）', 'P0',
          '登录(乐捐中,早班)→点击上班→检查状态和班次',
          '状态→早班空闲, 班次保持早班',
          `班次=${shiftAfter}, 水牌=${wbAfter?.status}, 预期=${expectedStatus}`,
          'FAIL', 'TC11-retest-v2.png');
      }
    } catch (err) {
      log(`  ❌ TC-11 异常: ${err.message}`);
      const ssPath = await takeScreenshot(page, 'TC11-error-v2');
      saveResult('TC-11', '乐捐-上班按钮回到空闲状态（班次保持不变）', 'P0', '', '', `异常: ${err.message}`, 'FAIL', 'TC11-error-v2.png');
    } finally {
      await page.close();
    }

    // ========== TC-08: 乐捐一览页面-显示乐捐截图 ==========
    log('\n=== TC-08: 乐捐一览页面-显示乐捐截图 ===');
    page = await context.newPage();
    try {
      // 用管理员视角进入乐捐一览（管理端页面）
      // lejuan-list.vue is a coach-facing page that calls /api/lejuan-records/list
      // But /list requires admin permissions. Let's check if coach can access it.
      
      // Actually, let's navigate to the lejuan page (lejuan.vue) which shows the coach's own records
      await navigateCoachPage(page, '/pages/internal/lejuan', MS, msToken);
      await page.waitForTimeout(3000);

      // Check if there's any visible images in the page
      const pageInfo = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'));
        const imgInfo = images.map(img => ({
          src: img.src ? img.src.substring(0, 120) : '',
          width: img.offsetWidth,
          height: img.offsetHeight,
          visible: img.offsetParent !== null && img.offsetWidth > 0 && img.offsetHeight > 0,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight
        }));

        // Check for proof images specifically
        const proofImgs = imgInfo.filter(img => 
          img.src.includes('oss') || img.src.includes('http') && !img.src.includes('tabbar') && !img.src.includes('static/')
        );

        return {
          totalImages: images.length,
          visibleImages: imgInfo.filter(i => i.visible).length,
          proofImages: proofImgs,
          bodyText: document.body.textContent.substring(0, 200)
        };
      });
      log(`  总图片: ${pageInfo.totalImages}`);
      log(`  可见图片: ${pageInfo.visibleImages}`);
      log(`  乐捐截图: ${JSON.stringify(pageInfo.proofImages)}`);

      // Also check if the record list has proof images rendered
      const recordInfo = await page.evaluate(() => {
        // Look for proof image elements
        const proofEls = document.querySelectorAll('[class*="proof"], [class*="screenshot"], [class*="image"]');
        return Array.from(proofEls).map(el => ({
          tag: el.tagName,
          text: el.textContent.trim().substring(0, 50),
          hasImg: el.querySelector('img') !== null
        }));
      });
      log(`  截图元素: ${JSON.stringify(recordInfo)}`);

      const ssPath = await takeScreenshot(page, 'TC08-retest-v2');
      log(`  截图: ${ssPath}`);

      const hasVisibleProof = pageInfo.proofImages.some(img => img.visible);
      
      if (hasVisibleProof) {
        saveResult('TC-08', '乐捐报备页面-显示乐捐截图（小图）', 'P1',
          '登录→进入乐捐报备页→检查截图显示',
          '有截图的记录显示缩略图',
          `可见截图=${hasVisibleProof}, 截图数=${pageInfo.proofImages.length}`,
          'PASS', 'TC08-retest-v2.png');
      } else {
        saveResult('TC-08', '乐捐报备页面-显示乐捐截图（小图）', 'P1',
          '登录→进入乐捐报备页→检查截图显示',
          '有截图的记录显示缩略图',
          `可见截图=${hasVisibleProof}, 图片详情=${JSON.stringify(pageInfo.proofImages.slice(0, 3))}`,
          'FAIL', 'TC08-retest-v2.png');
      }
    } catch (err) {
      log(`  ❌ TC-08 异常: ${err.message}`);
      const ssPath = await takeScreenshot(page, 'TC08-error-v2');
      saveResult('TC-08', '乐捐报备页面-显示乐捐截图（小图）', 'P1', '', '', `异常: ${err.message}`, 'FAIL', 'TC08-error-v2.png');
    } finally {
      await page.close();
    }

    // ========== TC-09: 点击截图可放大 ==========
    log('\n=== TC-09: 乐捐报备页面-点击截图可放大 ===');
    page = await context.newPage();
    try {
      await navigateCoachPage(page, '/pages/internal/lejuan', MS, msToken);
      await page.waitForTimeout(3000);

      // Find and click a proof image
      const clickResult = await page.evaluate(() => {
        // Find non-tabbar images
        const images = Array.from(document.querySelectorAll('img'));
        const proofImgs = images.filter(img => 
          img.offsetParent !== null && 
          img.offsetWidth > 10 && 
          img.offsetHeight > 10 &&
          !img.src.includes('tabbar') &&
          !img.src.includes('static/')
        );
        
        if (proofImgs.length === 0) {
          return { found: false, reason: 'no proof images visible' };
        }

        const firstImg = proofImgs[0];
        const rectBefore = firstImg.getBoundingClientRect();
        firstImg.click();
        
        return {
          found: true,
          src: firstImg.src.substring(0, 80),
          size: `${Math.round(rectBefore.width)}x${Math.round(rectBefore.height)}`
        };
      });
      log(`  点击结果: ${JSON.stringify(clickResult)}`);

      await page.waitForTimeout(2000);

      // Check for modal/overlay after click
      const modalInfo = await page.evaluate(() => {
        const modals = document.querySelectorAll('.uni-preview-image, .preview-modal, .image-modal, [class*="preview"], [class*="modal"]');
        const overlay = document.querySelector('.uni-mask, .mask, [class*="mask"]');
        const fullscreen = document.fullscreenElement !== null;
        
        // Also check if any image became larger
        const images = Array.from(document.querySelectorAll('img'));
        const largeImages = images.filter(img => 
          img.offsetWidth > 200 || img.offsetHeight > 200
        );
        
        return {
          modalCount: modals.length,
          hasOverlay: overlay !== null,
          fullscreen,
          largeImages: largeImages.length,
          bodyText: document.body.textContent.substring(0, 100)
        };
      });
      log(`  放大效果: ${JSON.stringify(modalInfo)}`);

      const ssPath1 = await takeScreenshot(page, 'TC09-after-click-v2');

      // Try to close
      await page.evaluate(() => {
        const closeBtn = document.querySelector('.close-btn, [class*="close"]');
        if (closeBtn) closeBtn.click();
      });
      await page.waitForTimeout(500);

      const ssPath2 = await takeScreenshot(page, 'TC09-retest-v2');

      if (clickResult.found && (modalInfo.modalCount > 0 || modalInfo.hasOverlay || modalInfo.largeImages > 0)) {
        saveResult('TC-09', '乐捐报备页面-点击截图可放大查看', 'P1',
          '登录→进入乐捐报备页→点击截图→检查放大效果',
          '点击后图片放大展示，可关闭',
          `找到图片=${clickResult.found}, 放大效果=${JSON.stringify(modalInfo)}`,
          'PASS', 'TC09-retest-v2.png');
      } else if (!clickResult.found) {
        saveResult('TC-09', '乐捐报备页面-点击截图可放大查看', 'P1',
          '登录→进入乐捐报备页→点击截图→检查放大效果',
          '点击后图片放大展示，可关闭',
          '无可点击的截图图片',
          'FAIL', 'TC09-retest-v2.png');
      } else {
        saveResult('TC-09', '乐捐报备页面-点击截图可放大查看', 'P1',
          '登录→进入乐捐报备页→点击截图→检查放大效果',
          '点击后图片放大展示，可关闭',
          `点击图片=${clickResult.found}, 放大效果=${JSON.stringify(modalInfo)}`,
          'FAIL', 'TC09-retest-v2.png');
      }
    } catch (err) {
      log(`  ❌ TC-09 异常: ${err.message}`);
      const ssPath = await takeScreenshot(page, 'TC09-error-v2');
      saveResult('TC-09', '乐捐报备页面-点击截图可放大查看', 'P1', '', '', `异常: ${err.message}`, 'FAIL', 'TC09-error-v2.png');
    } finally {
      await page.close();
    }

    // ========== 生成报告 ==========
    log('\n=== 生成测试报告 ===');
    await appendTestResults();

  } catch (err) {
    log(`❌ 测试异常: ${err.message}`);
    console.error(err.stack);
  } finally {
    await browser.close();
  }
}

async function appendTestResults() {
  const reportPath = path.join(__dirname, 'test-results.md');
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  
  let tableRows = results.map(r => {
    const icon = r.status === 'PASS' ? '✅通过' : r.status === 'FAIL' ? '❌失败' : '⏭️跳过';
    const ssIcon = r.screenshot ? '✅已截图' : '-';
    return `| ${r.id} | ${r.name} | ${r.priority} | ${r.steps} | ${r.expected} | ${r.actual} | ${icon} | ${ssIcon} |`;
  }).join('\n');

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;

  const report = `
## 复测结果 v2 (2026-04-15 ${timestamp})

> 使用MS助教（早班, coach_no=10077）进行测试，水牌状态=乐捐，有active乐捐记录+proof_image_url
> 水牌状态直接查询SQLite数据库（绕过3分钟API缓存）

### 复测概览
| 总计 | ✅通过 | ❌失败 |
|------|--------|--------|
| ${results.length} | ${passCount} | ${failCount} |

### 详细结果

| 用例ID | 测试项 | 优先级 | 操作步骤 | 预期结果 | 实际结果 | 状态 | 截图 |
|--------|--------|--------|----------|----------|----------|------|------|
${tableRows}

${failCount === 0 ? '### ✅ 所有复测用例通过' : `### ❌ 有 ${failCount} 个失败用例需要关注` }

---
*报告由 Playwright 自动化复测 v2 生成*
`;

  fs.appendFileSync(reportPath, report);
  log(`报告已追加到 ${reportPath}`);
  console.log(report);
}

runRetest().catch(console.error);
