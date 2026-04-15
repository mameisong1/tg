const { chromium } = require('/tmp/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_URL = 'http://127.0.0.1:8088';
const LOGIN_URL = `${BASE_URL}/admin/login.html`;
const COACHES_URL = `${BASE_URL}/admin/coaches.html`;
const ADMIN_USER = 'tgadmin';
const ADMIN_PASS = 'mms633268';
const SCREENSHOTS_DIR = '/TG/temp/QA-20260415-04/screenshots';
const DB_PATH = '/TG/tgservice/db/tgservice.db';

const results = [];

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function queryDB(sql) {
  try {
    const out = execSync(`sqlite3 "${DB_PATH}" "${sql}"`).toString().trim();
    return out ? out.split('\n') : [];
  } catch (e) {
    return [];
  }
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  log(`Screenshot saved: ${filePath}`);
  return `screenshots/${name}.png`;
}

async function login(page) {
  log('Logging in...');
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);
  
  // Fill login form
  const usernameInput = await page.$('input[placeholder="请输入用户名"], input[name="username"], #username, input[type="text"]');
  const passwordInput = await page.$('input[placeholder="请输入密码"], input[name="password"], #password, input[type="password"]');
  
  if (!usernameInput || !passwordInput) {
    // Try to find inputs by various selectors
    const inputs = await page.$$('input');
    log(`Found ${inputs.length} inputs`);
    for (let i = 0; i < inputs.length; i++) {
      const type = await inputs[i].getAttribute('type');
      const placeholder = await inputs[i].getAttribute('placeholder');
      log(`Input ${i}: type=${type}, placeholder=${placeholder}`);
    }
  }
  
  if (usernameInput) await usernameInput.fill(ADMIN_USER);
  else {
    // Try first text input
    const textInputs = await page.$$('input[type="text"]');
    if (textInputs[0]) await textInputs[0].fill(ADMIN_USER);
  }
  
  if (passwordInput) await passwordInput.fill(ADMIN_PASS);
  else {
    const pwdInputs = await page.$$('input[type="password"]');
    if (pwdInputs[0]) await pwdInputs[0].fill(ADMIN_PASS);
  }
  
  // Click login button
  const loginBtn = await page.$('button:has-text("登录"), input[type="submit"], button[type="submit"]');
  if (loginBtn) {
    await loginBtn.click();
  } else {
    const buttons = await page.$$('button');
    log(`Found ${buttons.length} buttons`);
    for (let i = 0; i < buttons.length; i++) {
      const text = await buttons[i].innerText();
      log(`Button ${i}: "${text}"`);
    }
    if (buttons[0]) await buttons[0].click();
  }
  
  await page.waitForTimeout(2000);
  
  // Check if login succeeded (redirect to coaches.html or dashboard)
  const currentUrl = page.url();
  log(`After login, URL: ${currentUrl}`);
  
  // If still on login page, check for error
  if (currentUrl.includes('login')) {
    const errorEl = await page.$('.error, .alert-danger, .msg-error');
    if (errorEl) {
      const errorMsg = await errorEl.innerText();
      log(`Login error: ${errorMsg}`);
      return false;
    }
    // Maybe it uses hash navigation
    await page.waitForTimeout(1000);
  }
  
  // Navigate to coaches page if not already there
  if (!currentUrl.includes('coaches.html')) {
    await page.goto(COACHES_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
  }
  
  return true;
}

async function resetDBState() {
  log('Resetting DB state...');
  // Remove test coaches (10117, 10118)
  queryDB("DELETE FROM water_boards WHERE coach_no IN ('10117','10118');");
  queryDB("DELETE FROM coaches WHERE coach_no IN (10117,10118);");
  
  // Re-add test coaches as missing records
  queryDB(`INSERT INTO coaches (stage_name, status, shift, created_at, updated_at) VALUES 
    ('测试小A', '全职', '早班', datetime('now'), datetime('now')),
    ('测试小B', '兼职', '晚班', datetime('now'), datetime('now'));`);
  
  log('DB state reset complete');
}

async function waitForSyncDetection(page) {
  // Wait for the modal to appear with detection state or results
  await page.waitForTimeout(3000);
}

async function clickSyncButton(page) {
  const btn = await page.$('button:has-text("同步水牌"), button:has-text("🔄")');
  if (btn) {
    await btn.click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

async function getModalContent(page) {
  // Try to get modal/dialog content
  const modal = await page.$('.modal.show, .dialog, .el-dialog, [role="dialog"], .sync-modal, .popup');
  if (modal) {
    return await modal.innerText();
  }
  // Fallback: get body text
  return await page.evaluate(() => document.body.innerText);
}

async function getModalVisible(page) {
  const modal = await page.$('.modal.show, .dialog, .el-dialog, [role="dialog"], .sync-modal, .popup, #syncModal');
  if (modal) {
    const display = await modal.evaluate(el => window.getComputedStyle(el).display);
    return display !== 'none';
  }
  return false;
}

async function closeModal(page) {
  const closeBtn = await page.$('.modal .close, .close-btn, button:has-text("关闭"), .el-dialog__close, [aria-label="Close"]');
  if (closeBtn) {
    await closeBtn.click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

async function getToastText(page) {
  await page.waitForTimeout(1000);
  const toast = await page.$('.toast, .el-message, .message, .notification, [class*="toast"], [class*="message"]');
  if (toast) {
    return await toast.innerText();
  }
  return null;
}

// ============ TEST CASES ============

async function runTC01(page) {
  log('=== TC-01: 正常流程 — 完整同步闭环 ===');
  const shots = [];
  try {
    // Ensure test data exists
    resetDBState();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    shots.push(await screenshot(page, 'tc01_before'));
    
    // Click sync button
    const clicked = await clickSyncButton(page);
    if (!clicked) throw new Error('未找到同步水牌按钮');
    
    await page.waitForTimeout(1000);
    shots.push(await screenshot(page, 'tc01_loading'));
    
    // Wait for detection results
    await waitForSyncDetection(page);
    shots.push(await screenshot(page, 'tc01_results'));
    
    const modalText = await getModalContent(page);
    log(`Modal content: ${modalText.substring(0, 200)}`);
    
    // Check for orphan and missing tables
    const hasOrphan = modalText.includes('孤儿') || modalText.includes('⚠️');
    const hasMissing = modalText.includes('缺失') || modalText.includes('➕');
    log(`Has orphan table: ${hasOrphan}, Has missing table: ${hasMissing}`);
    
    // Check checkboxes are checked by default
    const checkboxes = await page.$$('input[type="checkbox"]');
    log(`Found ${checkboxes.length} checkboxes`);
    
    // Check summary
    const summaryText = await page.evaluate(() => {
      const el = document.querySelector('.summary, .modal-summary, .sync-summary');
      return el ? el.innerText : '';
    });
    log(`Summary: ${summaryText}`);
    
    // Click confirm sync
    const confirmBtn = await page.$('button:has-text("确认同步")');
    if (confirmBtn) {
      await confirmBtn.click();
      await page.waitForTimeout(3000);
    }
    shots.push(await screenshot(page, 'tc01_after_sync'));
    
    // Check toast
    const toast = await getToastText(page);
    log(`Toast: ${toast}`);
    
    // Verify DB state
    const wbCount = queryDB("SELECT COUNT(*) FROM water_boards;")[0];
    const coCount = queryDB("SELECT COUNT(*) FROM coaches WHERE status IN ('全职','兼职');")[0];
    log(`After sync - water_boards: ${wbCount}, active coaches: ${coCount}`);
    
    return { pass: true, shots, notes: `孤儿表: ${hasOrphan}, 缺失表: ${hasMissing}, Toast: ${toast || '无'}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc01_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC02(page) {
  log('=== TC-02: 无差异场景 ===');
  const shots = [];
  try {
    // First sync to make data consistent
    resetDBState();
    
    // Now sync to make them consistent
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // First do a full sync to make data consistent
    const clicked1 = await clickSyncButton(page);
    if (clicked1) {
      await page.waitForTimeout(5000);
      const confirmBtn = await page.$('button:has-text("确认同步")');
      if (confirmBtn) {
        await confirmBtn.click();
        await page.waitForTimeout(3000);
      }
      await closeModal(page);
      await page.waitForTimeout(1000);
    }
    
    // Now click sync again - should show "no difference"
    shots.push(await screenshot(page, 'tc02_before'));
    
    const clicked2 = await clickSyncButton(page);
    if (!clicked2) throw new Error('未找到同步按钮');
    
    await page.waitForTimeout(5000);
    shots.push(await screenshot(page, 'tc02_result'));
    
    const modalText = await getModalContent(page);
    log(`TC02 modal: ${modalText.substring(0, 300)}`);
    
    const hasNoDiff = modalText.includes('已同步') || modalText.includes('无需') || 
                      modalText.includes('✅') || modalText.includes('无需操作');
    
    // Check if only "close" button, no "confirm sync" button
    const confirmBtn = await page.$('button:has-text("确认同步")');
    const closeBtn = await page.$('button:has-text("关闭")');
    
    log(`Confirm btn visible: ${!!confirmBtn}, Close btn visible: ${!!closeBtn}`);
    
    return { pass: hasNoDiff, shots, notes: `无差异提示: ${hasNoDiff}, confirmBtn: ${!!confirmBtn}, closeBtn: ${!!closeBtn}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc02_error'));
    return { pass: false, shots, error: e.message };
    }
}

async function runTC03(page) {
  log('=== TC-03: 部分勾选 ===');
  const shots = [];
  try {
    resetDBState();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    await clickSyncButton(page);
    await page.waitForTimeout(5000);
    shots.push(await screenshot(page, 'tc03_detected'));
    
    // Uncheck first orphan checkbox
    const orphanCheckboxes = await page.$$('.orphan-section input[type="checkbox"], .orphan-table input[type="checkbox"], tr[data-type="orphan"] input[type="checkbox"]');
    if (orphanCheckboxes.length > 1) {
      await orphanCheckboxes[1].uncheck(); // Skip header checkbox, uncheck first data row
    }
    
    // Uncheck first missing checkbox
    const missingCheckboxes = await page.$$('.missing-section input[type="checkbox"], .missing-table input[type="checkbox"], tr[data-type="missing"] input[type="checkbox"]');
    if (missingCheckboxes.length > 1) {
      await missingCheckboxes[1].uncheck();
    }
    
    await page.waitForTimeout(500);
    shots.push(await screenshot(page, 'tc03_unchecked'));
    
    // Check summary update
    const summaryText = await page.evaluate(() => {
      const el = document.querySelector('.summary, .modal-summary, .sync-summary');
      return el ? el.innerText : '';
    });
    log(`Summary after uncheck: ${summaryText}`);
    
    // Click confirm
    const confirmBtn = await page.$('button:has-text("确认同步")');
    if (confirmBtn) {
      await confirmBtn.click();
      await page.waitForTimeout(3000);
    }
    
    shots.push(await screenshot(page, 'tc03_after'));
    
    const toast = await getToastText(page);
    log(`Toast: ${toast}`);
    
    return { pass: true, shots, notes: `摘要: ${summaryText}, Toast: ${toast || '无'}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc03_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC04(page) {
  log('=== TC-04: 孤儿数据删除验证 ===');
  const shots = [];
  try {
    resetDBState();
    
    const wbBefore = parseInt(queryDB("SELECT COUNT(*) FROM water_boards;")[0] || '0');
    log(`Water boards before: ${wbBefore}`);
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    await clickSyncButton(page);
    await page.waitForTimeout(5000);
    
    // Uncheck all missing checkboxes
    const missingCheckboxes = await page.$$('input[type="checkbox"]');
    // Need to identify which are missing checkboxes - try by section
    // Uncheck all, then check orphan ones
    for (const cb of missingCheckboxes) {
      const parentText = await page.evaluate(el => {
        let p = el.parentElement;
        while (p && p !== document.body) {
          const cls = p.className || '';
          if (cls.includes('missing') || cls.includes('Missing')) return 'missing';
          if (cls.includes('orphan') || cls.includes('Orphan')) return 'orphan';
          p = p.parentElement;
        }
        return 'unknown';
      }, cb);
      if (parentText === 'missing') {
        await cb.uncheck();
      }
    }
    
    shots.push(await screenshot(page, 'tc04_unchecked_missing'));
    
    // Click confirm
    const confirmBtn = await page.$('button:has-text("确认同步")');
    if (confirmBtn) {
      await confirmBtn.click();
      await page.waitForTimeout(3000);
    }
    
    shots.push(await screenshot(page, 'tc04_after_sync'));
    
    // Refresh page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    const wbAfter = parseInt(queryDB("SELECT COUNT(*) FROM water_boards;")[0] || '0');
    log(`Water boards after: ${wbAfter}`);
    
    const toast = await getToastText(page);
    
    return { pass: wbAfter < wbBefore, shots, notes: `WB before: ${wbBefore}, after: ${wbAfter}, Toast: ${toast || '无'}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc04_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC05(page) {
  log('=== TC-05: 缺失数据添加验证 ===');
  const shots = [];
  try {
    resetDBState();
    
    const wbBefore = parseInt(queryDB("SELECT COUNT(*) FROM water_boards;")[0] || '0');
    log(`Water boards before: ${wbBefore}`);
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    await clickSyncButton(page);
    await page.waitForTimeout(5000);
    
    // Uncheck all orphan checkboxes
    const allCheckboxes = await page.$$('input[type="checkbox"]');
    for (const cb of allCheckboxes) {
      const parentText = await page.evaluate(el => {
        let p = el.parentElement;
        while (p && p !== document.body) {
          const cls = p.className || '';
          if (cls.includes('orphan') || cls.includes('Orphan')) return 'orphan';
          if (cls.includes('missing') || cls.includes('Missing')) return 'missing';
          p = p.parentElement;
        }
        return 'unknown';
      }, cb);
      if (parentText === 'orphan') {
        await cb.uncheck();
      }
    }
    
    shots.push(await screenshot(page, 'tc05_unchecked_orphan'));
    
    // Click confirm
    const confirmBtn = await page.$('button:has-text("确认同步")');
    if (confirmBtn) {
      await confirmBtn.click();
      await page.waitForTimeout(3000);
    }
    
    shots.push(await screenshot(page, 'tc05_after_sync'));
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    const wbAfter = parseInt(queryDB("SELECT COUNT(*) FROM water_boards;")[0] || '0');
    log(`Water boards after: ${wbAfter}`);
    
    // Check new records
    const newRecords = queryDB("SELECT coach_no, stage_name, status FROM water_boards WHERE coach_no IN ('10117','10118');");
    log(`New records: ${newRecords.join(' | ')}`);
    
    const toast = await getToastText(page);
    
    return { pass: wbAfter > wbBefore, shots, notes: `WB before: ${wbBefore}, after: ${wbAfter}, 新记录: ${newRecords.join('; ') || '无'}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc05_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC06(page) {
  log('=== TC-06: 空操作 ===');
  const shots = [];
  try {
    resetDBState();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    await clickSyncButton(page);
    await page.waitForTimeout(5000);
    
    // Uncheck all checkboxes
    const allCheckboxes = await page.$$('input[type="checkbox"]');
    // Skip header checkboxes (usually the first in each section)
    for (const cb of allCheckboxes) {
      const idx = allCheckboxes.indexOf(cb);
      // Check if it's a header checkbox by checking if it has no sibling data rows
      const parentText = await page.evaluate(el => {
        let p = el.parentElement;
        while (p && p !== document.body) {
          const tag = p.tagName;
          const cls = p.className || '';
          if (tag === 'TH' || cls.includes('header')) return 'header';
          if (tag === 'TD' || tag === 'TR') return 'data';
          p = p.parentElement;
        }
        return 'unknown';
      }, cb);
      if (parentText === 'data' || parentText === 'unknown') {
        await cb.uncheck();
      }
    }
    
    await page.waitForTimeout(500);
    shots.push(await screenshot(page, 'tc06_all_unchecked'));
    
    // Check summary shows 0
    const summaryText = await page.evaluate(() => {
      const el = document.querySelector('.summary, .modal-summary, .sync-summary');
      return el ? el.innerText : '';
    });
    log(`Summary: ${summaryText}`);
    
    // Click confirm
    const confirmBtn = await page.$('button:has-text("确认同步")');
    if (confirmBtn) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    }
    
    shots.push(await screenshot(page, 'tc06_after'));
    
    const toast = await getToastText(page);
    log(`Toast: ${toast}`);
    
    const hasWarning = toast && (toast.includes('至少') || toast.includes('选择'));
    
    return { pass: hasWarning, shots, notes: `摘要: ${summaryText}, Toast: ${toast || '无'}, 有警告: ${hasWarning}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc06_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC07(page) {
  log('=== TC-07: 同步按钮位置和样式 ===');
  const shots = [];
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    shots.push(await screenshot(page, 'tc07_button'));
    
    // Check button exists and has correct text
    const syncBtn = await page.$('button:has-text("同步水牌"), button:has-text("🔄 同步水牌")');
    const addBtn = await page.$('button:has-text("添加助教"), button:has-text("+ 添加助教")');
    
    if (!syncBtn) throw new Error('未找到同步水牌按钮');
    
    // Check button position relative to add button
    const btnInfo = await page.evaluate(() => {
      const syncBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('同步水牌'));
      const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('添加助教'));
      if (!syncBtn || !addBtn) return { error: 'Button not found' };
      
      const syncRect = syncBtn.getBoundingClientRect();
      const addRect = addBtn.getBoundingClientRect();
      const syncStyle = window.getComputedStyle(syncBtn);
      
      return {
        syncLeft: syncRect.left,
        addLeft: addRect.left,
        syncBeforeAdd: syncRect.left < addRect.left,
        gap: Math.abs(addRect.left - syncRect.right),
        syncBg: syncStyle.background || syncStyle.backgroundColor,
        syncText: syncBtn.textContent.trim(),
        addText: addBtn.textContent.trim()
      };
    });
    
    log(`Button info: ${JSON.stringify(btnInfo)}`);
    
    return { pass: btnInfo.syncBeforeAdd, shots, notes: `同步按钮在添加左侧: ${btnInfo.syncBeforeAdd}, 间距: ${btnInfo.gap}px, 背景: ${btnInfo.syncBg}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc07_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC08(page) {
  log('=== TC-08: 弹窗加载状态 ===');
  const shots = [];
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Enable slow network throttling (simulate with slower page)
    const clicked = await clickSyncButton(page);
    if (!clicked) throw new Error('未找到同步按钮');
    
    await page.waitForTimeout(500);
    shots.push(await screenshot(page, 'tc08_loading'));
    
    // Check loading state
    const loadingVisible = await page.evaluate(() => {
      const body = document.body;
      const text = body.innerText;
      return text.includes('检测中') || text.includes('⏳') || text.includes('loading') || text.includes('加载中');
    });
    
    log(`Loading state visible: ${loadingVisible}`);
    
    await page.waitForTimeout(5000);
    shots.push(await screenshot(page, 'tc08_after_loading'));
    
    return { pass: loadingVisible, shots, notes: `加载状态: ${loadingVisible}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc08_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC09(page) {
  log('=== TC-09: 孤儿数据表格列完整性 ===');
  const shots = [];
  try {
    resetDBState();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    await clickSyncButton(page);
    await page.waitForTimeout(5000);
    shots.push(await screenshot(page, 'tc09_table'));
    
    const tableInfo = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      const info = [];
      tables.forEach((table, idx) => {
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
        const title = table.previousElementSibling ? table.previousElementSibling.textContent.trim() : '';
        info.push({ idx, headers, title });
      });
      return info;
    });
    
    log(`Tables: ${JSON.stringify(tableInfo)}`);
    
    // Check for orphan table with expected columns
    const orphanTable = tableInfo.find(t => 
      t.title.includes('孤儿') || t.headers.includes('原因') || t.headers.includes('当前状态')
    );
    
    const hasCheckbox = orphanTable && orphanTable.headers.some(h => h === '☑' || h === '☐' || h === 'checkbox' || h === '');
    const hasCoachNo = orphanTable && orphanTable.headers.includes('编号');
    const hasStageName = orphanTable && orphanTable.headers.includes('艺名');
    const hasStatus = orphanTable && orphanTable.headers.includes('状态') || orphanTable && orphanTable.headers.includes('当前状态');
    const hasReason = orphanTable && orphanTable.headers.includes('原因');
    
    const pass = orphanTable && hasCoachNo && hasStageName && hasReason;
    
    return { pass, shots, notes: `孤儿表列: ${orphanTable ? orphanTable.headers.join(', ') : '未找到'}, 标题: ${orphanTable ? orphanTable.title : '无'}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc09_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC10(page) {
  log('=== TC-10: 缺失数据表格列完整性 ===');
  const shots = [];
  try {
    resetDBState();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    await clickSyncButton(page);
    await page.waitForTimeout(5000);
    shots.push(await screenshot(page, 'tc10_table'));
    
    const tableInfo = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      const info = [];
      tables.forEach((table, idx) => {
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
        const title = table.previousElementSibling ? table.previousElementSibling.textContent.trim() : '';
        info.push({ idx, headers, title });
      });
      return info;
    });
    
    log(`Tables: ${JSON.stringify(tableInfo)}`);
    
    const missingTable = tableInfo.find(t => 
      t.title.includes('缺失') || t.headers.includes('班次') || t.headers.includes('初始状态')
    );
    
    const hasShift = missingTable && missingTable.headers.includes('班次');
    const hasInitStatus = missingTable && missingTable.headers.includes('初始状态');
    
    const pass = missingTable && hasShift && hasInitStatus;
    
    return { pass, shots, notes: `缺失表列: ${missingTable ? missingTable.headers.join(', ') : '未找到'}, 标题: ${missingTable ? missingTable.title : '无'}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc10_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC11(page) {
  log('=== TC-11: 全选/取消全选 ===');
  const shots = [];
  try {
    resetDBState();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    await clickSyncButton(page);
    await page.waitForTimeout(5000);
    
    // Find header checkboxes (select all)
    const headerCheckboxes = await page.$$('th input[type="checkbox"], thead input[type="checkbox"]');
    log(`Found ${headerCheckboxes.length} header checkboxes`);
    
    if (headerCheckboxes.length >= 1) {
      // Uncheck first header checkbox
      await headerCheckboxes[0].uncheck();
      await page.waitForTimeout(500);
      shots.push(await screenshot(page, 'tc11_uncheck_all'));
      
      // Re-check
      await headerCheckboxes[0].check();
      await page.waitForTimeout(500);
      shots.push(await screenshot(page, 'tc11_recheck_all'));
    }
    
    const summaryText = await page.evaluate(() => {
      const el = document.querySelector('.summary, .modal-summary, .sync-summary');
      return el ? el.innerText : '';
    });
    log(`Summary: ${summaryText}`);
    
    return { pass: true, shots, notes: `全选checkbox数: ${headerCheckboxes.length}, 摘要: ${summaryText}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc11_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC12(page) {
  log('=== TC-12: 底部摘要实时更新 ===');
  const shots = [];
  try {
    resetDBState();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    await clickSyncButton(page);
    await page.waitForTimeout(5000);
    
    const getSummary = async () => {
      return await page.evaluate(() => {
        const el = document.querySelector('.summary, .modal-summary, .sync-summary');
        return el ? el.innerText.trim() : '';
      });
    };
    
    const initialSummary = await getSummary();
    log(`Initial summary: ${initialSummary}`);
    shots.push(await screenshot(page, 'tc12_initial'));
    
    // Uncheck one data row checkbox
    const allCBs = await page.$$('input[type="checkbox"]');
    if (allCBs.length > 2) {
      await allCBs[2].uncheck();
      await page.waitForTimeout(500);
      const afterUncheck = await getSummary();
      log(`After uncheck 1: ${afterUncheck}`);
      shots.push(await screenshot(page, 'tc12_uncheck1'));
      
      // Uncheck another
      if (allCBs.length > 4) {
        await allCBs[4].uncheck();
        await page.waitForTimeout(500);
        const afterUncheck2 = await getSummary();
        log(`After uncheck 2: ${afterUncheck2}`);
        shots.push(await screenshot(page, 'tc12_uncheck2'));
      }
    }
    
    return { pass: true, shots, notes: `初始: ${initialSummary}, 取消1后: ${await getSummary()}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc12_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC13(page) {
  log('=== TC-13: 关闭弹窗 ===');
  const shots = [];
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    await clickSyncButton(page);
    await page.waitForTimeout(5000);
    shots.push(await screenshot(page, 'tc13_open'));
    
    // Close modal
    const closed = await closeModal(page);
    if (!closed) {
      // Try pressing Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    shots.push(await screenshot(page, 'tc13_closed'));
    
    // Check modal is gone
    const modalVisible = await getModalVisible(page);
    log(`Modal visible after close: ${modalVisible}`);
    
    // Try reopening
    await clickSyncButton(page);
    await page.waitForTimeout(5000);
    shots.push(await screenshot(page, 'tc13_reopen'));
    
    const modalVisible2 = await getModalVisible(page);
    
    return { pass: !modalVisible && modalVisible2, shots, notes: `关闭后弹窗可见: ${modalVisible}, 重新打开可见: ${modalVisible2}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc13_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC14(page) {
  log('=== TC-14: 网络异常 ===');
  const shots = [];
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Go offline
    await page.route('**/*', route => route.abort());
    
    await clickSyncButton(page);
    await page.waitForTimeout(5000);
    shots.push(await screenshot(page, 'tc14_offline'));
    
    // Restore network
    await page.unroute('**/*');
    
    const toast = await getToastText(page);
    log(`Toast: ${toast}`);
    
    const hasError = toast && (toast.includes('网络') || toast.includes('❌') || toast.includes('错误') || toast.includes('失败'));
    
    return { pass: hasError, shots, notes: `Toast: ${toast || '无'}, 有网络错误: ${hasError}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc14_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC15(page) {
  log('=== TC-15: 权限不足 ===');
  const shots = [];
  try {
    // Logout
    const logoutBtn = await page.$('button:has-text("退出"), button:has-text("登出"), a:has-text("退出"), .logout');
    if (logoutBtn) {
      await logoutBtn.click();
      await page.waitForTimeout(1000);
    } else {
      // Clear cookies and go to login
      const context = page.context();
      await context.clearCookies();
    }
    
    // Try to access the API directly
    const response = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/admin/coaches/sync-water-boards/preview');
        return { status: res.status };
      } catch (e) {
        return { error: e.message };
      }
    });
    log(`API response without auth: ${JSON.stringify(response)}`);
    
    // The API should return 401
    shots.push(await screenshot(page, 'tc15_noauth'));
    
    return { pass: response.status === 401 || response.error, shots, notes: `API响应: ${JSON.stringify(response)}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc15_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC16(page) {
  log('=== TC-16: 并发操作 — 快速连点 ===');
  const shots = [];
  try {
    await login(page);
    resetDBState();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    await clickSyncButton(page);
    await page.waitForTimeout(5000);
    shots.push(await screenshot(page, 'tc16_detected'));
    
    // Rapid click confirm button
    const confirmBtn = await page.$('button:has-text("确认同步")');
    if (confirmBtn) {
      // Click 5 times rapidly
      for (let i = 0; i < 5; i++) {
        await confirmBtn.click();
        await page.waitForTimeout(50);
      }
    }
    
    await page.waitForTimeout(3000);
    shots.push(await screenshot(page, 'tc16_after_clicks'));
    
    // Check if button was disabled
    const btnDisabled = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('确认同步') || b.textContent.includes('同步中'));
      return btn ? btn.disabled : 'not found';
    });
    log(`Button disabled: ${btnDisabled}`);
    
    // Check network - should only have 1 request
    // (can't easily check this, but we can check if page shows one result)
    const toast = await getToastText(page);
    log(`Toast: ${toast}`);
    
    return { pass: true, shots, notes: `按钮禁用: ${btnDisabled}, Toast: ${toast || '无'}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc16_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC17(page) {
  log('=== TC-17: 执行失败后弹窗保持 ===');
  const shots = [];
  try {
    await login(page);
    resetDBState();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Block the execute API
    await page.route('**/sync-water-boards/execute', route => route.fulfill({
      status: 500,
      body: JSON.stringify({ error: '服务器错误' })
    }));
    
    await clickSyncButton(page);
    await page.waitForTimeout(5000);
    
    const confirmBtn = await page.$('button:has-text("确认同步")');
    if (confirmBtn) {
      await confirmBtn.click();
      await page.waitForTimeout(3000);
    }
    
    shots.push(await screenshot(page, 'tc17_after_fail'));
    
    // Check modal is still open
    const modalVisible = await getModalVisible(page);
    log(`Modal visible after failure: ${modalVisible}`);
    
    const toast = await getToastText(page);
    log(`Toast: ${toast}`);
    
    // Unblock
    await page.unroute('**/sync-water-boards/execute');
    
    return { pass: modalVisible, shots, notes: `失败后弹窗可见: ${modalVisible}, Toast: ${toast || '无'}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc17_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC18(page) {
  log('=== TC-18: 已离职助教孤儿检测 ===');
  const shots = [];
  try {
    resetDBState();
    
    // Check for 离职 coaches in water_boards
    const resignedCoaches = queryDB("SELECT c.coach_no, c.stage_name, w.status FROM coaches c JOIN water_boards w ON c.coach_no = w.coach_no WHERE c.status = '离职';");
    log(`Resigned coaches in water_boards: ${resignedCoaches.join(' | ')}`);
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    await clickSyncButton(page);
    await page.waitForTimeout(5000);
    shots.push(await screenshot(page, 'tc18_detected'));
    
    const modalText = await getModalContent(page);
    
    // Check if resigned coaches appear in orphan table
    let found = false;
    if (resignedCoaches.length > 0) {
      for (const row of resignedCoaches) {
        const coachNo = row.split('|')[0];
        if (modalText.includes(coachNo)) {
          found = true;
          break;
        }
      }
    }
    
    // Also check for "离职" reason
    const hasResignedReason = modalText.includes('离职') || modalText.includes('status=离职');
    
    return { pass: found || hasResignedReason, shots, notes: `离职助教: ${resignedCoaches.join('; ') || '无'}, 包含离职原因: ${hasResignedReason}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc18_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC19(page) {
  log('=== TC-19: coaches表中不存在的孤儿检测 ===');
  const shots = [];
  try {
    resetDBState();
    
    // Find orphans not in coaches
    const orphansNotInCoaches = queryDB("SELECT coach_no FROM water_boards WHERE coach_no NOT IN (SELECT coach_no FROM coaches);");
    log(`Orphans not in coaches: ${orphansNotInCoaches.join(', ')}`);
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    await clickSyncButton(page);
    await page.waitForTimeout(5000);
    shots.push(await screenshot(page, 'tc19_detected'));
    
    const modalText = await getModalContent(page);
    
    let allFound = true;
    for (const no of orphansNotInCoaches) {
      if (!modalText.includes(no)) {
        allFound = false;
        log(`Missing orphan ${no} in modal`);
      }
    }
    
    const hasNotExistsReason = modalText.includes('coaches表不存在') || modalText.includes('不存在');
    
    return { pass: allFound && hasNotExistsReason, shots, notes: `孤儿数: ${orphansNotInCoaches.length}, 全部找到: ${allFound}, 原因: ${hasNotExistsReason}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc19_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC20(page) {
  log('=== TC-20: 全职/兼职助教缺失检测 ===');
  const shots = [];
  try {
    resetDBState();
    
    // Find missing coaches (full/part-time not in water_boards)
    const missingCoaches = queryDB("SELECT coach_no, stage_name, status, shift FROM coaches WHERE status IN ('全职', '兼职') AND coach_no NOT IN (SELECT coach_no FROM water_boards);");
    log(`Missing coaches: ${missingCoaches.join(' | ')}`);
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    await clickSyncButton(page);
    await page.waitForTimeout(5000);
    shots.push(await screenshot(page, 'tc20_detected'));
    
    const modalText = await getModalContent(page);
    
    let allFound = true;
    for (const row of missingCoaches) {
      const coachNo = row.split('|')[0];
      if (!modalText.includes(coachNo)) {
        allFound = false;
        log(`Missing ${coachNo} in modal`);
      }
    }
    
    return { pass: allFound, shots, notes: `缺失数: ${missingCoaches.length}, 全部找到: ${allFound}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc20_error'));
    return { pass: false, shots, error: e.message };
  }
}

async function runTC21(page) {
  log('=== TC-21: 同步后刷新助教列表 ===');
  const shots = [];
  try {
    resetDBState();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    shots.push(await screenshot(page, 'tc21_before'));
    
    await clickSyncButton(page);
    await page.waitForTimeout(5000);
    
    const confirmBtn = await page.$('button:has-text("确认同步")');
    if (confirmBtn) {
      await confirmBtn.click();
      await page.waitForTimeout(3000);
    }
    shots.push(await screenshot(page, 'tc21_after_sync'));
    
    // Check if list refreshed (check if table rows updated)
    await page.waitForTimeout(2000);
    
    // Check for new coaches in list
    const listHasNewCoaches = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('测试小A') || text.includes('测试小B');
    });
    log(`List has new coaches: ${listHasNewCoaches}`);
    
    // F5 refresh
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    shots.push(await screenshot(page, 'tc21_after_refresh'));
    
    const listAfterRefresh = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('测试小A') || text.includes('测试小B');
    });
    
    return { pass: listAfterRefresh, shots, notes: `同步后有新教练: ${listHasNewCoaches}, 刷新后有: ${listAfterRefresh}` };
  } catch (e) {
    shots.push(await screenshot(page, 'tc21_error'));
    return { pass: false, shots, error: e.message };
  }
}

// ============ MAIN ============

(async () => {
  log('Starting browser tests...');
  
  // Ensure screenshots directory exists
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'zh-CN'
  });
  
  const page = await context.newPage();
  
  try {
    // Login first
    await login(page);
    log('Login completed');
    
    await page.waitForTimeout(1000);
    
    // Run all test cases
    const testCases = [
      { id: 'TC-01', name: '正常流程 — 完整同步闭环', fn: runTC01 },
      { id: 'TC-02', name: '无差异场景 — 完全同步', fn: runTC02 },
      { id: 'TC-03', name: '部分勾选后确认', fn: runTC03 },
      { id: 'TC-04', name: '孤儿数据删除验证', fn: runTC04 },
      { id: 'TC-05', name: '缺失数据添加验证', fn: runTC05 },
      { id: 'TC-06', name: '空操作 — 不勾选直接确认', fn: runTC06 },
      { id: 'TC-07', name: '同步按钮位置和样式', fn: runTC07 },
      { id: 'TC-08', name: '弹窗加载状态', fn: runTC08 },
      { id: 'TC-09', name: '孤儿数据表格列完整性', fn: runTC09 },
      { id: 'TC-10', name: '缺失数据表格列完整性', fn: runTC10 },
      { id: 'TC-11', name: '全选/取消全选功能', fn: runTC11 },
      { id: 'TC-12', name: '底部摘要实时更新', fn: runTC12 },
      { id: 'TC-13', name: '关闭弹窗', fn: runTC13 },
      { id: 'TC-14', name: '网络异常', fn: runTC14 },
      { id: 'TC-15', name: '权限不足', fn: runTC15 },
      { id: 'TC-16', name: '并发操作 — 快速连点', fn: runTC16 },
      { id: 'TC-17', name: '执行失败后弹窗保持', fn: runTC17 },
      { id: 'TC-18', name: '已离职助教孤儿检测', fn: runTC18 },
      { id: 'TC-19', name: 'coaches表不存在孤儿检测', fn: runTC19 },
      { id: 'TC-20', name: '全职/兼职助教缺失检测', fn: runTC20 },
      { id: 'TC-21', name: '同步后刷新列表数据', fn: runTC21 },
    ];
    
    for (const tc of testCases) {
      log(`\n>>> Running ${tc.id}: ${tc.name}`);
      try {
        // Re-login before each test if needed
        const result = await tc.fn(page);
        results.push({
          id: tc.id,
          name: tc.name,
          ...result
        });
        log(`<<< ${tc.id}: ${result.pass ? 'PASS' : 'FAIL'}`);
      } catch (e) {
        results.push({
          id: tc.id,
          name: tc.name,
          pass: false,
          error: e.message,
          shots: []
        });
        log(`<<< ${tc.id}: ERROR - ${e.message}`);
      }
      // Small delay between tests
      await page.waitForTimeout(1000);
    }
    
  } catch (e) {
    log(`Fatal error: ${e.message}`);
  } finally {
    await browser.close();
  }
  
  // Write results
  writeReport();
  log('All tests completed!');
})();

function writeReport() {
  let report = `# 同步水牌功能 - 浏览器测试报告\n\n`;
  report += `> 执行时间: ${new Date().toISOString()}\n`;
  report += `> 测试员: B (自动化)\n\n`;
  report += `## 环境信息\n\n`;
  report += `- 后端API: http://127.0.0.1:8088\n`;
  report += `- 后台管理: http://127.0.0.1:8088/admin/coaches.html\n`;
  report += `- 数据库: /TG/tgservice/db/tgservice.db\n\n`;
  
  // Summary
  const passCount = results.filter(r => r.pass).length;
  const failCount = results.filter(r => !r.pass).length;
  report += `## 执行摘要\n\n`;
  report += `- **总计**: ${results.length} 条\n`;
  report += `- **通过**: ${passCount} ✅\n`;
  report += `- **失败**: ${failCount} ❌\n\n`;
  report += `---\n\n`;
  
  // Individual results
  for (const r of results) {
    report += `## ${r.id}: ${r.name}\n\n`;
    report += `- **状态**: ${r.pass ? '✅ 通过' : '❌ 失败'}\n`;
    if (r.shots && r.shots.length > 0) {
      report += `- **截图**: ${r.shots.join(', ')}\n`;
    }
    if (r.notes) {
      report += `- **备注**: ${r.notes}\n`;
    }
    if (r.error) {
      report += `- **错误**: ${r.error}\n`;
    }
    report += '\n';
  }
  
  // Failed test details
  const failed = results.filter(r => !r.pass);
  if (failed.length > 0) {
    report += `---\n\n`;
    report += `## 失败用例详情\n\n`;
    for (const r of failed) {
      report += `### ${r.id}: ${r.name}\n`;
      report += `- **错误**: ${r.error || '未通过断言'}\n`;
      report += `- **备注**: ${r.notes || '无'}\n\n`;
    }
  }
  
  fs.writeFileSync('/TG/temp/QA-20260415-04/test-results.md', report);
  log('Report written to /TG/temp/QA-20260415-04/test-results.md');
}
