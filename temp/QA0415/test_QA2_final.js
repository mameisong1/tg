/**
 * QA2 最终复测：助教重复上桌功能支持 - 多桌号UI显示
 * 测试员：B2
 * 日期：2026-04-15
 * 
 * 验证A2修复后，table_no_list 数组在以下页面正确显示多桌号标签：
 * - table-action.vue (上下桌单)
 * - clock.vue (上下班)
 * - water-board.vue (水牌管理)
 * - water-board-view.vue (水牌查看)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_URL = 'http://127.0.0.1:8088';
const H5_URL = 'http://127.0.0.1:8089';
const SCREENSHOT_DIR = '/TG/temp/QA0415/screenshots_final';
const TEST_COACH_NO = '10001';
const TEST_TABLES = ['普台1', '普台3'];

// 确保截图目录存在
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function log(msg) {
  const ts = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  console.log(`[${ts}] ${msg}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  log('========== QA2 最终复测开始 ==========');
  const results = [];

  // ========== 步骤0: 确认测试环境 ==========
  log('步骤0: 确认测试环境...');
  try {
    const resp = await fetch(`${BASE_URL}/api/tables`);
    if (resp.ok) {
      log('  后端 API 可达 ✅');
    } else {
      log('  后端 API 不可达 ❌');
      results.push({ step: '环境检查', status: 'FAIL', detail: '后端不可达' });
      writeResult(results);
      process.exit(1);
    }
  } catch (e) {
    log('  后端 API 不可达 ❌');
    results.push({ step: '环境检查', status: 'FAIL', detail: '后端不可达' });
    writeResult(results);
    process.exit(1);
  }

  // ========== 步骤1: 备份原始水牌状态 ==========
  log('步骤1: 备份原始水牌状态...');
  let originalStatus = null;
  let originalTableNo = null;
  try {
    const row = execSync(`sqlite3 /TG/tgservice/db/tgservice.db "SELECT status, table_no FROM water_boards WHERE coach_no='${TEST_COACH_NO}';"`).toString().trim().split('|');
    originalStatus = row[0] || '';
    originalTableNo = row[1] || '';
    log(`  原始状态: status=${originalStatus}, table_no=${originalTableNo || '(空)'} ✅`);
  } catch (e) {
    log(`  查询失败: ${e.message}`);
  }

  // ========== 步骤2: 设置多桌号测试数据 ==========
  log('步骤2: 设置多桌号测试数据...');
  const tableNoStr = TEST_TABLES.join(',');
  try {
    execSync(`sqlite3 /TG/tgservice/db/tgservice.db "UPDATE water_boards SET status='晚班上桌', table_no='${tableNoStr}', updated_at=datetime('now') WHERE coach_no='${TEST_COACH_NO}';"`);
    log(`  水牌状态设置成功: table_no=${tableNoStr} ✅`);
    results.push({ step: '设置多桌号数据', status: 'PASS', detail: `table_no=${tableNoStr}` });
  } catch (e) {
    log(`  设置失败: ${e.message}`);
    results.push({ step: '设置多桌号数据', status: 'FAIL', detail: e.message });
    writeResult(results);
    process.exit(1);
  }

  // 验证API返回
  try {
    const resp = await fetch(`${BASE_URL}/api/coaches/${TEST_COACH_NO}/water-status`);
    const data = await resp.json();
    if (data.success && data.data.table_no_list) {
      log(`  API验证: table_no_list=[${data.data.table_no_list.join(', ')}] ✅`);
      results.push({ step: 'API返回table_no_list', status: 'PASS', detail: `[${data.data.table_no_list.join(', ')}]` });
    } else {
      log(`  API验证失败: ${JSON.stringify(data)}`);
      results.push({ step: 'API返回table_no_list', status: 'FAIL', detail: JSON.stringify(data) });
    }
  } catch (e) {
    log(`  API验证出错: ${e.message}`);
  }

  // ========== 步骤3: 生成教练token（用于直接访问内部页面） ==========
  log('步骤3: 生成教练token...');
  const coachToken = Buffer.from(`${TEST_COACH_NO}:${Date.now()}`).toString('base64');
  log(`  Token生成完成 ✅`);

  // ========== 步骤4: 浏览器测试 ==========
  log('步骤4: 启动浏览器进行测试...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  try {
    const pages = await browser.pages();
    const page = pages[0];
    // 设置手机视口（H5是移动端页面）
    await page.setViewport({ width: 375, height: 812 });

    // 先注入token到localStorage，避免需要登录
    log('4.1: 注入认证token到localStorage...');
    await page.goto(H5_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.evaluate((token) => {
      localStorage.setItem('coachToken', token);
      localStorage.setItem('coachInfo', JSON.stringify({
        coachNo: '10001',
        employeeId: '1',
        stageName: '歪歪',
        phone: '16675852676',
        level: '助教',
        shift: '早班'
      }));
    }, coachToken);
    log('  Token注入完成 ✅');

    // ---------- 4.2 测试上下桌单页面 (table-action.vue) ----------
    log('4.2: 测试上下桌单页面...');
    await page.goto(`${H5_URL}/#/pages/internal/table-action`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(5000); // 等待Vue渲染
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_table_action.png'), fullPage: true });
    
    // 获取页面全部文本内容
    const tableActionText = await page.evaluate(() => document.body.innerText);
    log(`  页面文本(前500字): ${tableActionText.substring(0, 500)}`);
    
    const hasTA1 = tableActionText.includes('普台1');
    const hasTA3 = tableActionText.includes('普台3');
    if (hasTA1 && hasTA3) {
      log('  ✅ 上下桌单页面显示多桌号 [普台1] [普台3]');
      results.push({ step: 'table-action多桌号显示', status: 'PASS', detail: '页面包含普台1和普台3' });
    } else {
      log(`  ❌ 上下桌单页面未显示多桌号 (普台1:${hasTA1}, 普台3:${hasTA3})`);
      results.push({ step: 'table-action多桌号显示', status: 'FAIL', detail: `普台1:${hasTA1}, 普台3:${hasTA3}` });
    }

    // ---------- 4.3 测试水牌查看页面 (water-board-view.vue) ----------
    log('4.3: 测试水牌查看页面...');
    await page.goto(`${H5_URL}/#/pages/internal/water-board-view`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(5000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_water_board_view.png'), fullPage: true });
    
    const wbViewText = await page.evaluate(() => document.body.innerText);
    log(`  页面文本(前500字): ${wbViewText.substring(0, 500)}`);
    
    const hasWBV1 = wbViewText.includes('普台1');
    const hasWBV3 = wbViewText.includes('普台3');
    if (hasWBV1 && hasWBV3) {
      log('  ✅ 水牌查看页面显示多桌号 [普台1] [普台3]');
      results.push({ step: 'water-board-view多桌号显示', status: 'PASS', detail: '页面包含普台1和普台3' });
    } else {
      log(`  ❌ 水牌查看页面未显示多桌号 (普台1:${hasWBV1}, 普台3:${hasWBV3})`);
      results.push({ step: 'water-board-view多桌号显示', status: 'FAIL', detail: `普台1:${hasWBV1}, 普台3:${hasWBV3}` });
    }

    // 保持标签页数量不超过2个 - 创建新标签页前关闭旧的
    const currentPages = await browser.pages();
    if (currentPages.length >= 2) {
      await currentPages[0].close();
    }
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 375, height: 812 });
    // 同样注入token
    await page2.goto(H5_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page2.evaluate((token) => {
      localStorage.setItem('coachToken', token);
      localStorage.setItem('coachInfo', JSON.stringify({
        coachNo: '10001',
        employeeId: '1',
        stageName: '歪歪',
        phone: '16675852676',
        level: '助教',
        shift: '早班'
      }));
    }, coachToken);

    // ---------- 4.4 测试水牌管理页面 (water-board.vue) ----------
    log('4.4: 测试水牌管理页面...');
    await page2.goto(`${H5_URL}/#/pages/internal/water-board`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(5000);
    await page2.screenshot({ path: path.join(SCREENSHOT_DIR, '05_water_board.png'), fullPage: true });
    
    const wbManageText = await page2.evaluate(() => document.body.innerText);
    log(`  页面文本(前500字): ${wbManageText.substring(0, 500)}`);
    
    const hasWBM1 = wbManageText.includes('普台1');
    const hasWBM3 = wbManageText.includes('普台3');
    if (hasWBM1 && hasWBM3) {
      log('  ✅ 水牌管理页面显示多桌号 [普台1] [普台3]');
      results.push({ step: 'water-board多桌号显示', status: 'PASS', detail: '页面包含普台1和普台3' });
    } else {
      log(`  ❌ 水牌管理页面未显示多桌号 (普台1:${hasWBM1}, 普台3:${hasWBM3})`);
      results.push({ step: 'water-board多桌号显示', status: 'FAIL', detail: `普台1:${hasWBM1}, 普台3:${hasWBM3}` });
    }

    // ---------- 4.5 测试上下班页面 (clock.vue) ----------
    log('4.5: 测试上下班页面...');
    await page2.goto(`${H5_URL}/#/pages/internal/clock`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(5000);
    await page2.screenshot({ path: path.join(SCREENSHOT_DIR, '06_clock.png'), fullPage: true });
    
    const clockText = await page2.evaluate(() => document.body.innerText);
    log(`  页面文本(前500字): ${clockText.substring(0, 500)}`);
    
    const hasC1 = clockText.includes('普台1');
    const hasC3 = clockText.includes('普台3');
    if (hasC1 && hasC3) {
      log('  ✅ 上下班页面显示多桌号 [普台1] [普台3]');
      results.push({ step: 'clock多桌号显示', status: 'PASS', detail: '页面包含普台1和普台3' });
    } else {
      log(`  ❌ 上下班页面未显示多桌号 (普台1:${hasC1}, 普台3:${hasC3})`);
      results.push({ step: 'clock多桌号显示', status: 'FAIL', detail: `普台1:${hasC1}, 普台3:${hasC3}` });
    }

    // 关闭多余标签页
    const allPages = await browser.pages();
    while (allPages.length > 1) {
      await allPages.shift().close();
    }

  } catch (e) {
    log(`浏览器测试出错: ${e.message}`);
    results.push({ step: '浏览器测试', status: 'ERROR', detail: e.message });
  } finally {
    await browser.close();
  }

  // ========== 步骤5: 清理测试数据 ==========
  log('步骤5: 清理测试数据...');
  try {
    execSync(`sqlite3 /TG/tgservice/db/tgservice.db "UPDATE water_boards SET status='${originalStatus}', table_no='${originalTableNo}', updated_at=datetime('now') WHERE coach_no='${TEST_COACH_NO}';"`);
    log(`  已恢复原始状态: status=${originalStatus}, table_no=${originalTableNo || '(空)'} ✅`);
    results.push({ step: '清理测试数据', status: 'PASS', detail: `恢复为 status=${originalStatus}, table_no=${originalTableNo || '(空)'}` });
  } catch (e) {
    log(`  清理失败: ${e.message}`);
    results.push({ step: '清理测试数据', status: 'FAIL', detail: e.message });
  }

  // ========== 写入结果 ==========
  writeResult(results);
  log('========== QA2 最终复测完成 ==========');
}

function writeResult(results) {
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const errorCount = results.filter(r => r.status === 'ERROR').length;
  
  let md = `# QA2 最终复测结果 - 助教重复上桌功能支持\n\n`;
  md += `**测试员**: B2\n`;
  md += `**日期**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
  md += `**测试环境**: http://127.0.0.1:8089 (H5)\n\n`;
  md += `## 测试概要\n\n`;
  md += `- 总计: ${results.length} 项\n`;
  md += `- ✅ 通过: ${passCount}\n`;
  md += `- ❌ 失败: ${failCount}\n`;
  md += `- ⚠️ 错误: ${errorCount}\n\n`;
  md += `## 详细结果\n\n`;
  md += `| 步骤 | 状态 | 详情 |\n`;
  md += `|------|------|------|\n`;
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    md += `| ${r.step} | ${icon} ${r.status} | ${r.detail} |\n`;
  });
  md += `\n## 截图\n\n`;
  md += `截图目录: /TG/temp/QA0415/screenshots_final/\n\n`;
  
  try {
    const screenshots = fs.readdirSync(SCREENSHOT_DIR);
    screenshots.forEach(f => {
      md += `- ${f}\n`;
    });
  } catch (e) {}
  
  md += `\n## 结论\n\n`;
  if (failCount === 0 && errorCount === 0) {
    md += `**全部通过！** 多桌号UI显示功能修复验证成功。A2修复的 table_no_list 数组渲染在四个页面均正确显示。\n`;
  } else {
    md += `**部分失败**，${failCount}项失败，${errorCount}项错误。请查看详细结果和截图。\n`;
  }
  
  fs.writeFileSync('/TG/temp/QA0415/test_result_QA2_final.md', md, 'utf-8');
  log(`结果已写入 /TG/temp/QA0415/test_result_QA2_final.md`);
  log(`摘要: ${passCount}通过, ${failCount}失败, ${errorCount}错误`);
}

run().catch(e => {
  console.error('测试脚本异常:', e);
  process.exit(1);
});
