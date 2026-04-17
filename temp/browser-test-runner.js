const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');

const BASE = 'http://127.0.0.1:8089';
const results = [];
let pageLog = [];

function log(msg) {
  const ts = new Date().toISOString().slice(11, 23);
  const line = `[${ts}] ${msg}`;
  pageLog.push(line);
  console.log(line);
}

function record(id, name, status, detail) {
  results.push({ id, name, status, detail });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`  ${icon} [${id}] ${status} - ${detail || ''}`);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ============ 登录函数 ============

async function loginCoach(page) {
  log('Coach login: navigating to coach-login page...');
  await page.goto(`${BASE}/#/pages/coach-login/coach-login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2000);

  // Fill form by evaluating in page
  const filled = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input.form-input');
    let filled = {};
    for (const inp of inputs) {
      const ph = inp.placeholder || '';
      if (ph.includes('工号')) { inp.value = '12'; filled.工号 = '12'; }
      else if (ph.includes('艺名')) { inp.value = '十七'; filled.艺名 = '十七'; }
      else if (ph.includes('身份证')) { inp.value = '171542'; filled.身份证 = '171542'; }
      // Dispatch input events for Vue reactivity
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return filled;
  });
  log(`Coach form filled: ${JSON.stringify(filled)}`);
  await sleep(500);

  // Click login button
  const clicked = await page.evaluate(() => {
    const btns = document.querySelectorAll('.login-btn');
    for (const btn of btns) {
      if (btn.textContent && btn.textContent.includes('登录')) {
        btn.click();
        return true;
      }
    }
    return false;
  });
  log(`Coach login clicked: ${clicked}`);
  await sleep(4000);
  log(`After login URL: ${page.url()}`);
}

async function loginAdmin(page) {
  log('Admin login via API...');
  await page.goto(`${BASE}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1000);

  try {
    const loginResult = await page.evaluate(async () => {
      try {
        const resp = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'tgadmin', password: 'mms633268' })
        });
        return await resp.json();
      } catch(e) {
        return { success: false, error: e.message };
      }
    });
    log(`Admin API login: ${JSON.stringify(loginResult)}`);

    if (loginResult && loginResult.success) {
      await page.evaluate((token, user) => {
        localStorage.setItem('adminToken', token);
        localStorage.setItem('adminInfo', user);
      }, loginResult.token, JSON.stringify(loginResult.user || { username: 'tgadmin', name: '管理员' }));
      log('Admin storage set from API');
    } else {
      throw new Error(loginResult?.error || loginResult?.message || 'Admin login failed');
    }
  } catch(e) {
    log(`Admin API error: ${e.message}, setting fallback storage`);
    await page.evaluate(() => {
      localStorage.setItem('adminToken', 'fallback-token');
      localStorage.setItem('adminInfo', JSON.stringify({ username: 'tgadmin', name: '管理员' }));
    });
  }
  await sleep(1000);
}

// ============ 测试 ============

async function main() {
  log('Connecting to Chrome on port 9222...');
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  log('Connected!');

  // Get initial pages (don't close them - browser needs at least one)
  const initialPages = await browser.pages();
  log(`Found ${initialPages.length} initial tabs`);

  // Use the first existing page as our working page if available
  let workingPage = initialPages.length > 0 ? initialPages[0] : null;

  try {
    // ==================== F1 ====================
    log('========== F1: 助教进入购物车页面 - storage中台桌号被清空 ==========');
    try {
      if (!workingPage) workingPage = await browser.newPage();
      else await workingPage.bringToFront();

      await workingPage.goto(`${BASE}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1000);

      await workingPage.evaluate(() => localStorage.setItem('tableName', '普台5'));
      const before = await workingPage.evaluate(() => localStorage.getItem('tableName'));
      log(`F1 before login: tableName="${before}"`);

      await loginCoach(workingPage);

      await workingPage.goto(`${BASE}/#/pages/cart/cart`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(3000);

      const after = await workingPage.evaluate(() => localStorage.getItem('tableName'));
      log(`F1 after nav: tableName="${after}"`);

      if (after === '' || after === null || after === undefined) {
        record('F1', '助教进入购物车页面 - storage中台桌号被清空', 'PASS', `tableName被清空 (before="普台5", after="${after}")`);
      } else {
        record('F1', '助教进入购物车页面 - storage中台桌号被清空', 'FAIL', `tableName未被清空 (after="${after}")`);
      }
    } catch(e) {
      record('F1', '助教进入购物车页面 - storage中台桌号被清空', 'ERROR', e.message);
      log(`F1 error: ${e.stack}`);
    }

    // Clear page state for next test
    if (workingPage) {
      try {
        await workingPage.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 10000 });
        await sleep(500);
      } catch(e) {
        log(`Clear page error: ${e.message}`);
      }
    }

    // ==================== F2 ====================
    log('========== F2: 助教进入商品点单页 - storage中台桌号被清空 ==========');
    try {
      if (!workingPage) workingPage = await browser.newPage();
      else await workingPage.bringToFront();

      await workingPage.goto(`${BASE}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1000);

      await workingPage.evaluate(() => localStorage.setItem('tableName', '普台5'));
      const before = await workingPage.evaluate(() => localStorage.getItem('tableName'));
      log(`F2 before login: tableName="${before}"`);

      await loginCoach(workingPage);

      await workingPage.goto(`${BASE}/#/pages/products/products`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(3000);

      const after = await workingPage.evaluate(() => localStorage.getItem('tableName'));
      log(`F2 after nav: tableName="${after}"`);

      if (after === '' || after === null || after === undefined) {
        record('F2', '助教进入商品点单页 - storage中台桌号被清空', 'PASS', `tableName被清空`);
      } else {
        record('F2', '助教进入商品点单页 - storage中台桌号被清空', 'FAIL', `tableName未被清空 (after="${after}")`);
      }
    } catch(e) {
      record('F2', '助教进入商品点单页 - storage中台桌号被清空', 'ERROR', e.message);
    }

    if (workingPage) {
      try {
        await workingPage.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 10000 });
        await sleep(500);
      } catch(e) {}
    }

    // ==================== F3 ====================
    log('========== F3: 助教进入服务下单页 - form.table_no为空 ==========');
    try {
      if (!workingPage) workingPage = await browser.newPage();
      else await workingPage.bringToFront();

      await workingPage.goto(`${BASE}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1000);

      await loginCoach(workingPage);

      await workingPage.goto(`${BASE}/#/pages/internal/service-order`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(3000);

      const tableInfo = await workingPage.evaluate(() => {
        const formValue = document.querySelector('.form-value');
        if (formValue) {
          const textEl = formValue.querySelector('text:not(.arrow)');
          const text = textEl ? textEl.textContent : '';
          const isPlaceholder = textEl ? textEl.classList.contains('placeholder') : false;
          return { found: true, text, isPlaceholder };
        }
        return { found: false };
      });
      log(`F3 台桌号: ${JSON.stringify(tableInfo)}`);

      const isEmpty = tableInfo.found && (tableInfo.isPlaceholder || !tableInfo.text || tableInfo.text === '请选择台桌');
      record('F3', '助教进入服务下单页 - form.table_no为空', isEmpty ? 'PASS' : 'FAIL', `台桌号: ${JSON.stringify(tableInfo)}`);
    } catch(e) {
      record('F3', '助教进入服务下单页 - form.table_no为空', 'ERROR', e.message);
    }

    if (workingPage) {
      try {
        await workingPage.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 10000 });
        await sleep(500);
      } catch(e) {}
    }

    // ==================== F4 ====================
    log('========== F4: 助教单台桌自动选中 ==========');
    try {
      execSync(`sqlite3 /TG/tgservice/db/tgservice.db "UPDATE water_boards SET status='晚班上桌', table_no='VIP3' WHERE coach_no=10011;"`);
      log('F4: DB set coach 10011 -> 晚班上桌 VIP3');
    } catch(e) {
      log(`F4: DB update error: ${e.message}`);
    }

    try {
      if (!workingPage) workingPage = await browser.newPage();
      else await workingPage.bringToFront();

      await workingPage.goto(`${BASE}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1000);

      await loginCoach(workingPage);

      await workingPage.goto(`${BASE}/#/pages/internal/service-order`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(3000);

      // Click 台桌号 field
      const clicked = await workingPage.evaluate(() => {
        const formItem = document.querySelector('.form-item');
        if (formItem) { formItem.click(); return true; }
        return false;
      });
      log(`F4: clicked table field: ${clicked}`);
      await sleep(3000);

      const autoSelected = await workingPage.evaluate(() => {
        const toasts = document.querySelectorAll('.uni-toast, .van-toast');
        for (const t of toasts) {
          if (t.textContent && t.textContent.includes('VIP3')) {
            return { toast: t.textContent.trim() };
          }
        }
        const formValue = document.querySelector('.form-value text:not(.arrow)');
        if (formValue) {
          const val = formValue.textContent.trim();
          return { formValue: val, isAutoSelected: val === 'VIP3' };
        }
        return { nothing: true };
      });
      log(`F4: result: ${JSON.stringify(autoSelected)}`);

      const isVIP3 = autoSelected.toast?.includes('VIP3') || autoSelected.formValue === 'VIP3' || autoSelected.isAutoSelected;
      record('F4', '助教单台桌自动选中', isVIP3 ? 'PASS' : 'FAIL', `结果: ${JSON.stringify(autoSelected)}`);
    } catch(e) {
      record('F4', '助教单台桌自动选中', 'ERROR', e.message);
    }

    // Restore DB
    try {
      execSync(`sqlite3 /TG/tgservice/db/tgservice.db "UPDATE water_boards SET status='晚班空闲', table_no='' WHERE coach_no=10011;"`);
      log('F4: DB restored');
    } catch(e) {
      log(`F4: DB restore error: ${e.message}`);
    }

    if (workingPage) {
      try {
        await workingPage.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 10000 });
        await sleep(500);
      } catch(e) {}
    }

    // ==================== TC-BR-01 ====================
    log('========== TC-BR-01: 普通用户扫码进入 - 台桌号不被清空 ==========');
    try {
      if (!workingPage) workingPage = await browser.newPage();
      else await workingPage.bringToFront();

      await workingPage.goto(`${BASE}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1000);

      await workingPage.evaluate(() => {
        localStorage.setItem('tableName', 'VIP3');
        localStorage.setItem('tableAuth', JSON.stringify({ table: 'VIP3', time: Date.now() }));
      });

      const before = await workingPage.evaluate(() => localStorage.getItem('tableName'));
      log(`BR-01 before: tableName="${before}"`);

      // Go to products (no login)
      await workingPage.goto(`${BASE}/#/pages/products/products`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(3000);

      const after1 = await workingPage.evaluate(() => localStorage.getItem('tableName'));
      log(`BR-01 after products: tableName="${after1}"`);

      // Go to cart
      await workingPage.goto(`${BASE}/#/pages/cart/cart`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(3000);

      const after2 = await workingPage.evaluate(() => localStorage.getItem('tableName'));
      log(`BR-01 after cart: tableName="${after2}"`);

      if (after1 === 'VIP3' && after2 === 'VIP3') {
        record('TC-BR-01', '普通用户扫码进入 - 台桌号不被清空', 'PASS', `tableName保持VIP3`);
      } else {
        record('TC-BR-01', '普通用户扫码进入 - 台桌号不被清空', 'FAIL', `tableName被改变 (products="${after1}", cart="${after2}")`);
      }
    } catch(e) {
      record('TC-BR-01', '普通用户扫码进入 - 台桌号不被清空', 'ERROR', e.message);
    }

    if (workingPage) {
      try {
        await workingPage.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 10000 });
        await sleep(500);
      } catch(e) {}
    }

    // ==================== TC-BR-02 ====================
    log('========== TC-BR-02: 助教进入购物车 - 无台桌号下单报错 ==========');
    try {
      if (!workingPage) workingPage = await browser.newPage();
      else await workingPage.bringToFront();

      await workingPage.goto(`${BASE}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1000);

      await workingPage.evaluate(() => localStorage.setItem('tableName', '普台5'));

      await loginCoach(workingPage);

      await workingPage.goto(`${BASE}/#/pages/cart/cart`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(3000);

      const tableName = await workingPage.evaluate(() => localStorage.getItem('tableName'));
      log(`BR-02: tableName="${tableName}"`);

      // Click 结算/下单 button
      await workingPage.evaluate(() => {
        const btns = document.querySelectorAll('.submit-btn, .order-btn, button, .pay-btn, .settle-btn');
        for (const btn of btns) {
          const txt = btn.textContent?.trim() || '';
          if (txt.includes('结算') || txt.includes('下单') || txt.includes('提交订单')) {
            btn.click();
            return txt;
          }
        }
        return null;
      });
      await sleep(2000);

      const msg = await workingPage.evaluate(() => {
        const toast = document.querySelector('.uni-toast-text');
        if (toast) return toast.textContent?.trim();
        const vanToast = document.querySelector('.van-toast__text');
        if (vanToast) return vanToast.textContent?.trim();
        const all = Array.from(document.querySelectorAll('*'));
        const matches = all.filter(el => el.textContent && el.textContent.includes('台桌')).map(el => el.textContent.trim());
        return matches.length > 0 ? matches[0] : null;
      });
      log(`BR-02: msg="${msg}"`);

      if (msg && msg.includes('台桌')) {
        record('TC-BR-02', '助教进入购物车 - 无台桌号下单报错', 'PASS', `提示: "${msg}"`);
      } else {
        record('TC-BR-02', '助教进入购物车 - 无台桌号下单报错', 'FAIL', `未检测到台桌号提示 (msg="${msg}")`);
      }
    } catch(e) {
      record('TC-BR-02', '助教进入购物车 - 无台桌号下单报错', 'ERROR', e.message);
    }

    if (workingPage) {
      try {
        await workingPage.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 10000 });
        await sleep(500);
      } catch(e) {}
    }

    // ==================== TC-BR-03 ====================
    log('========== TC-BR-03: 后台用户进入购物车 - 无台桌号下单报错 ==========');
    try {
      if (!workingPage) workingPage = await browser.newPage();
      else await workingPage.bringToFront();

      await workingPage.goto(`${BASE}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1000);

      await workingPage.evaluate(() => localStorage.setItem('tableName', '普台5'));

      await loginAdmin(workingPage);

      await workingPage.goto(`${BASE}/#/pages/cart/cart`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(3000);

      const tableName = await workingPage.evaluate(() => localStorage.getItem('tableName'));
      log(`BR-03: tableName="${tableName}"`);

      // Click 结算 button
      await workingPage.evaluate(() => {
        const btns = document.querySelectorAll('.submit-btn, .order-btn, button, .pay-btn, .settle-btn');
        for (const btn of btns) {
          const txt = btn.textContent?.trim() || '';
          if (txt.includes('结算') || txt.includes('下单') || txt.includes('提交订单')) {
            btn.click();
            break;
          }
        }
      });
      await sleep(2000);

      const msg = await workingPage.evaluate(() => {
        const toast = document.querySelector('.uni-toast-text');
        if (toast) return toast.textContent?.trim();
        const vanToast = document.querySelector('.van-toast__text');
        if (vanToast) return vanToast.textContent?.trim();
        const all = Array.from(document.querySelectorAll('*'));
        const matches = all.filter(el => el.textContent && el.textContent.includes('台桌')).map(el => el.textContent.trim());
        return matches.length > 0 ? matches[0] : null;
      });
      log(`BR-03: msg="${msg}"`);

      if (msg && msg.includes('台桌')) {
        record('TC-BR-03', '后台用户进入购物车 - 无台桌号下单报错', 'PASS', `提示: "${msg}"`);
      } else {
        record('TC-BR-03', '后台用户进入购物车 - 无台桌号下单报错', 'FAIL', `未检测到台桌号提示`);
      }
    } catch(e) {
      record('TC-BR-03', '后台用户进入购物车 - 无台桌号下单报错', 'ERROR', e.message);
    }

    if (workingPage) {
      try {
        await workingPage.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 10000 });
        await sleep(500);
      } catch(e) {}
    }

    // ==================== TC-BR-04 ====================
    log('========== TC-BR-04: 助教进入服务下单页 - 无台桌号提交报错 ==========');
    try {
      if (!workingPage) workingPage = await browser.newPage();
      else await workingPage.bringToFront();

      await workingPage.goto(`${BASE}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1000);

      await loginCoach(workingPage);

      await workingPage.goto(`${BASE}/#/pages/internal/service-order`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(3000);

      // Verify table_no is empty
      const tableInfo = await workingPage.evaluate(() => {
        const formValue = document.querySelector('.form-value text:not(.arrow)');
        return { text: formValue?.textContent?.trim() || '', placeholder: formValue?.classList.contains('placeholder') };
      });
      log(`BR-04: table_no="${tableInfo.text}"`);

      // Fill requirement
      await workingPage.evaluate(() => {
        const inputs = document.querySelectorAll('input');
        for (const inp of inputs) {
          if (inp.placeholder && inp.placeholder.includes('需求')) {
            inp.value = '测试需求';
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
        }
        return false;
      });
      await sleep(500);

      // Click 提交
      await workingPage.evaluate(() => {
        const btns = document.querySelectorAll('.submit-btn');
        if (btns.length > 0) { btns[0].click(); }
      });
      await sleep(2000);

      const msg = await workingPage.evaluate(() => {
        const toast = document.querySelector('.uni-toast-text');
        if (toast) return toast.textContent?.trim();
        const vanToast = document.querySelector('.van-toast__text');
        if (vanToast) return vanToast.textContent?.trim();
        const all = Array.from(document.querySelectorAll('*'));
        const matches = all.filter(el => el.textContent && (el.textContent.includes('台桌') || el.textContent.includes('台号'))).map(el => el.textContent.trim());
        return matches.length > 0 ? matches[0] : null;
      });
      log(`BR-04: msg="${msg}"`);

      if (msg && (msg.includes('台桌') || msg.includes('台号'))) {
        record('TC-BR-04', '助教进入服务下单页 - 无台桌号提交报错', 'PASS', `提示: "${msg}"`);
      } else {
        record('TC-BR-04', '助教进入服务下单页 - 无台桌号提交报错', 'FAIL', `未检测到台桌号提示 (msg="${msg}")`);
      }
    } catch(e) {
      record('TC-BR-04', '助教进入服务下单页 - 无台桌号提交报错', 'ERROR', e.message);
    }

    if (workingPage) {
      try {
        await workingPage.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 10000 });
        await sleep(500);
      } catch(e) {}
    }

    // ==================== TC-BR-05 ====================
    log('========== TC-BR-05: 后台用户进入服务下单页 - 无台桌号提交报错 ==========');
    try {
      if (!workingPage) workingPage = await browser.newPage();
      else await workingPage.bringToFront();

      await workingPage.goto(`${BASE}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1000);

      await loginAdmin(workingPage);

      await workingPage.goto(`${BASE}/#/pages/internal/service-order`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(3000);

      // Fill requirement
      await workingPage.evaluate(() => {
        const inputs = document.querySelectorAll('input');
        for (const inp of inputs) {
          if (inp.placeholder && inp.placeholder.includes('需求')) {
            inp.value = '测试需求';
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
        }
        return false;
      });
      await sleep(500);

      // Click 提交
      await workingPage.evaluate(() => {
        const btns = document.querySelectorAll('.submit-btn');
        if (btns.length > 0) { btns[0].click(); }
      });
      await sleep(2000);

      const msg = await workingPage.evaluate(() => {
        const toast = document.querySelector('.uni-toast-text');
        if (toast) return toast.textContent?.trim();
        const vanToast = document.querySelector('.van-toast__text');
        if (vanToast) return vanToast.textContent?.trim();
        const all = Array.from(document.querySelectorAll('*'));
        const matches = all.filter(el => el.textContent && (el.textContent.includes('台桌') || el.textContent.includes('台号'))).map(el => el.textContent.trim());
        return matches.length > 0 ? matches[0] : null;
      });
      log(`BR-05: msg="${msg}"`);

      if (msg && (msg.includes('台桌') || msg.includes('台号'))) {
        record('TC-BR-05', '后台用户进入服务下单页 - 无台桌号提交报错', 'PASS', `提示: "${msg}"`);
      } else {
        record('TC-BR-05', '后台用户进入服务下单页 - 无台桌号提交报错', 'FAIL', `未检测到台桌号提示`);
      }
    } catch(e) {
      record('TC-BR-05', '后台用户进入服务下单页 - 无台桌号提交报错', 'ERROR', e.message);
    }

  } finally {
    // Clean up: close working page if it was newly created
    if (workingPage) {
      try {
        await workingPage.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 10000 });
      } catch(e) {}
    }

    browser.disconnect();
    log('Disconnected from browser');
  }

  // Write results
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const errorCount = results.filter(r => r.status === 'ERROR').length;

  const detailLines = results.map(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    return `${icon} **[${r.id}]** ${r.name}: **${r.status}**${r.detail ? ' — ' + r.detail : ''}`;
  }).join('\n');

  const report = `# 浏览器功能测试报告

**测试时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
**测试环境**: ${BASE}
**Chrome**: 端口 9222

## 测试结果

${detailLines}

## 统计

| 指标 | 数量 |
|------|------|
| ✅ 通过 | ${passCount} |
| ❌ 失败 | ${failCount} |
| ⚠️ 错误 | ${errorCount} |
| **总计** | **${results.length}** |

## 通过率

${results.length > 0 ? Math.round(passCount / results.length * 100) : 0}%

---

## 详细日志

\`\`\`
${pageLog.join('\n')}
\`\`\`
`;

  fs.writeFileSync('/TG/temp/QA-20260417-09/browser-test-results.md', report);
  log('Results written to /TG/temp/QA-20260417-09/browser-test-results.md');

  console.log('\n' + '='.repeat(60));
  console.log('测试完成');
  console.log(`通过: ${passCount}, 失败: ${failCount}, 错误: ${errorCount}, 总计: ${results.length}`);
  console.log('='.repeat(60));
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
