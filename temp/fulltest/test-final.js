const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = '/TG/temp/fulltest';
const DB_PATH = '/TG/tgservice/db/tgservice.db';
const BASE_URL = 'http://127.0.0.1:8089';
const PHONE = '18775703862';
const CODE = '888888';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

function queryDB(sql) {
  try {
    return execSync(`sqlite3 "${DB_PATH}" "${sql}"`, { encoding: 'utf-8' }).trim();
  } catch (e) {
    return '';
  }
}

async function screenshot(page, name) {
  const file = path.join(SCREENSHOT_DIR, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📷 ${name}`);
  return file;
}

// Click element containing text
async function clickText(page, text) {
  const found = await page.evaluate((t) => {
    // Search all visible elements
    const all = document.querySelectorAll('view, button, div, span, text, uni-view, uni-text, a, uni-text span');
    for (const el of all) {
      if (el.textContent && el.textContent.includes(t) && el.offsetParent !== null) {
        el.click();
        return true;
      }
    }
    return false;
  }, text);
  if (found) {
    console.log(`  ✅ 点击: "${text}"`);
    await wait(1500);
  } else {
    console.log(`  ⚠️ 未找到: "${text}"`);
  }
  return found;
}

// Set value via JS (more reliable than typing)
async function setInputValue(page, selector, value) {
  await page.evaluate((sel, val) => {
    const el = document.querySelector(sel);
    if (el) {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, selector, value);
}

async function main() {
  console.log('=== 前端完整测试 V4 ===\n');

  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });

  const results = [];
  let page = null;

  try {
    // ==========================
    // 测试1: 登录
    // ==========================
    console.log('[1] 登录测试...');
    page = await browser.newPage();

    await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(5000);

    // Check if already logged in
    let content = await page.content();
    let isLoggedIn = content.includes('memberInfo') || content.includes('member-section') || content.includes('陆飞');

    if (!isLoggedIn) {
      console.log('  未登录，开始登录...');
      await screenshot(page, '01-1-need-login.png');

      // Fill phone - find first number input
      const phoneInput = await page.$('input[type="number"]');
      if (phoneInput) {
        await phoneInput.click({ clickCount: 3 });
        await page.keyboard.type(PHONE);
        console.log(`  输入手机号: ${PHONE}`);
        await wait(500);
      }

      // Check agreement first
      await clickText(page, '《用户协议》');
      await wait(500);

      // Click get code
      await clickText(page, '获取');
      await wait(2000);

      // Fill code - find second number input
      const inputs = await page.$$('input[type="number"]');
      if (inputs.length >= 2) {
        await inputs[1].click({ clickCount: 3 });
        await page.keyboard.type(CODE);
        console.log(`  输入验证码: ${CODE}`);
        await wait(500);
      }

      // Click login button
      await clickText(page, '登录', '.h5-login-btn, .login-btn, button');
      await wait(4000);

      await screenshot(page, '01-login.png');

      content = await page.content();
      isLoggedIn = content.includes('member-section') || content.includes('陆飞') || content.includes('21');
    }

    const loginStatus = isLoggedIn ? 'PASS' : 'FAIL';
    results.push({ test: '登录测试', status: loginStatus, detail: isLoggedIn ? '登录成功' : '登录失败' });
    console.log(`  ${isLoggedIn ? '✅' : '❌'} 登录测试: ${loginStatus}\n`);

    // ==========================
    // 测试2: 商品下单
    // ==========================
    console.log('[2] 商品下单...');
    const beforeOrders = queryDB("SELECT COUNT(*) FROM orders");

    await page.goto(`${BASE_URL}/#/pages/index/index`, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(4000);
    await screenshot(page, '02-1-home.png');

    // Click on "商品点单" main button
    const clickedProduct = await clickText(page, '商品点单');
    await wait(3000);
    await screenshot(page, '02-2-products.png');

    // Find a product card and click add
    const productAdded = await page.evaluate(() => {
      // Look for product cards and try to add one
      const cards = document.querySelectorAll('.product-card');
      if (cards.length > 0) {
        cards[0].click();
        return true;
      }
      return false;
    });

    if (productAdded) {
      console.log('  点击商品');
      await wait(2000);
    }
    await screenshot(page, '02-3-product.png');

    // Look for add-to-cart or buy buttons
    await clickText(page, '加入', 'button, view, uni-view');
    await wait(1000);

    // Open cart - click cart tabbar or cart button
    const cartClicked = await clickText(page, '购物车');
    if (!cartClicked) {
      // Try clicking the cart tab (second tabbar item)
      await page.evaluate(() => {
        const items = document.querySelectorAll('.uni-tabbar__item');
        if (items.length >= 2) items[1].click();
      });
      await wait(2000);
    }
    await screenshot(page, '02-4-cart.png');

    // Submit order
    await clickText(page, '结算');
    await clickText(page, '提交');
    await clickText(page, '下单');
    await wait(3000);
    await screenshot(page, '02-order.png');

    const afterOrders = queryDB("SELECT COUNT(*) FROM orders");
    const orderOk = parseInt(afterOrders) > parseInt(beforeOrders);
    results.push({ test: '商品下单', status: orderOk ? 'PASS' : 'FAIL', detail: `订单 ${beforeOrders}→${afterOrders}` });
    console.log(`  ${orderOk ? '✅' : '❌'} 商品下单: ${orderOk ? 'PASS' : 'FAIL'} (${beforeOrders}→${afterOrders})\n`);

    // ==========================
    // 测试3: 服务下单
    // ==========================
    console.log('[3] 服务下单...');
    const beforeSvc = queryDB("SELECT COUNT(*) FROM service_orders");

    await page.goto(`${BASE_URL}/#/pages/internal/service-order`, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(4000);
    await screenshot(page, '03-1-service-page.png');

    content = await page.content();
    console.log('  页面长度:', content.length);

    // Fill requirement
    await page.evaluate(() => {
      const input = document.querySelector('.input, input[placeholder*="需求"], input[maxlength="200"]');
      if (input) {
        input.value = '需要清理台面';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    console.log('  填写需求');
    await wait(500);

    // Submit
    await clickText(page, '提交服务单');
    await wait(3000);
    await screenshot(page, '03-service.png');

    const afterSvc = queryDB("SELECT COUNT(*) FROM service_orders");
    const svcOk = parseInt(afterSvc) > parseInt(beforeSvc);
    results.push({ test: '服务下单', status: svcOk ? 'PASS' : 'FAIL', detail: svcOk ? `服务单 ${beforeSvc}→${afterSvc}` : '未增加' });
    console.log(`  ${svcOk ? '✅' : '❌'} 服务下单: ${svcOk ? 'PASS' : 'FAIL'}\n`);

    // ==========================
    // 测试4: 上班打卡
    // ==========================
    console.log('[4] 上班打卡...');
    const beforeIn = queryDB("SELECT COUNT(*) FROM attendance_records WHERE clock_in_time IS NOT NULL");

    await page.goto(`${BASE_URL}/#/pages/internal/clock`, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(4000);
    await screenshot(page, '04-1-clock-page.png');

    // Upload a test photo via JS
    await page.evaluate(() => {
      // Create a small image as blob
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#333';
      ctx.fillRect(0, 0, 100, 100);
      ctx.fillStyle = '#fff';
      ctx.font = '20px sans-serif';
      ctx.fillText('打卡', 25, 55);

      // Try to find the upload area and simulate image selection
      const uploadArea = document.querySelector('.photo-upload, .photo-item, [class*="photo"]');
      if (uploadArea) {
        // Check if the page has imageUrls state we can modify
        // For UniApp, we need to find the Vue instance or use the page's methods
        // Try clicking the upload area
        uploadArea.click();
      }
    });
    await wait(1000);

    // Try to inject a fake image directly into the Vue state
    await page.evaluate(() => {
      // Find the Vue app
      const app = document.querySelector('#app');
      if (app && app.__vue_app__) {
        // Try to access the component instance
        console.log('Found Vue app');
      }
    });

    await screenshot(page, '04-2-after-upload.png');

    // Click 上班
    await clickText(page, '上班');
    await wait(3000);
    await screenshot(page, '04-clockin.png');

    const afterIn = queryDB("SELECT COUNT(*) FROM attendance_records WHERE clock_in_time IS NOT NULL");
    const inOk = parseInt(afterIn) > parseInt(beforeIn);
    results.push({ test: '上班打卡', status: inOk ? 'PASS' : 'FAIL', detail: `打卡 ${beforeIn}→${afterIn}` });
    console.log(`  ${inOk ? '✅' : '❌'} 上班打卡: ${inOk ? 'PASS' : 'FAIL'}\n`);

    // ==========================
    // 测试5: 上桌单
    // ==========================
    console.log('[5] 上桌单...');
    const beforeTableIn = queryDB("SELECT COUNT(*) FROM table_action_orders WHERE order_type = '上桌单'");

    await page.goto(`${BASE_URL}/#/pages/internal/table-action`, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(4000);
    await screenshot(page, '05-1-table-page.png');

    // Select table
    await clickText(page, '请选择台桌');
    await wait(2000);
    await screenshot(page, '05-2-table-select.png');

    // Select first table from the selector
    await page.evaluate(() => {
      const items = document.querySelectorAll('.table-item, .radio-item, .selector-item, picker-view-column view');
      if (items.length > 0) items[0].click();
    });
    await wait(1500);

    // Select action type
    await clickText(page, '普通课');
    await wait(500);

    // Submit
    await clickText(page, '提交上桌单');
    await wait(3000);
    await screenshot(page, '05-tablein.png');

    const afterTableIn = queryDB("SELECT COUNT(*) FROM table_action_orders WHERE order_type = '上桌单'");
    const tableInOk = parseInt(afterTableIn) > parseInt(beforeTableIn);
    results.push({ test: '上桌单', status: tableInOk ? 'PASS' : 'FAIL', detail: `上桌单 ${beforeTableIn}→${afterTableIn}` });
    console.log(`  ${tableInOk ? '✅' : '❌'} 上桌单: ${tableInOk ? 'PASS' : 'FAIL'}\n`);

    // ==========================
    // 测试6: 下桌单
    // ==========================
    console.log('[6] 下桌单...');
    const beforeTableOut = queryDB("SELECT COUNT(*) FROM table_action_orders WHERE order_type = '下桌单'");

    await page.goto(`${BASE_URL}/#/pages/internal/table-action`, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(4000);

    // Switch to 下桌单 tab
    await clickText(page, '下桌单');
    await wait(2000);
    await screenshot(page, '06-1-table-out.png');

    // Select a table from radio items
    await page.evaluate(() => {
      const items = document.querySelectorAll('.radio-item');
      if (items.length > 0) items[0].click();
    });
    await wait(1000);

    // Submit
    await clickText(page, '提交下桌单');
    await wait(3000);
    await screenshot(page, '06-tableout.png');

    const afterTableOut = queryDB("SELECT COUNT(*) FROM table_action_orders WHERE order_type = '下桌单'");
    const tableOutOk = parseInt(afterTableOut) > parseInt(beforeTableOut);
    results.push({ test: '下桌单', status: tableOutOk ? 'PASS' : 'FAIL', detail: `下桌单 ${beforeTableOut}→${afterTableOut}` });
    console.log(`  ${tableOutOk ? '✅' : '❌'} 下桌单: ${tableOutOk ? 'PASS' : 'FAIL'}\n`);

    // ==========================
    // 测试7: 乐捐报备
    // ==========================
    console.log('[7] 乐捐报备...');
    const beforeLejuan = queryDB("SELECT COUNT(*) FROM lejuan_records");

    await page.goto(`${BASE_URL}/#/pages/internal/lejuan`, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(4000);
    await screenshot(page, '07-1-lejuan-page.png');

    // Set date to today via JS
    const today = new Date().toISOString().split('T')[0];
    await page.evaluate((d) => {
      // Try to set the picker value
      const picker = document.querySelector('picker[mode="date"]');
      if (picker) {
        // Trigger a change event with today's date
        const event = new Event('change');
        event.detail = { value: d };
        picker.dispatchEvent(event);
      }
    }, today);
    await wait(500);

    // Set hour to current hour
    const currentHour = new Date().getHours();
    await page.evaluate((h) => {
      const pickers = document.querySelectorAll('picker');
      if (pickers.length >= 2) {
        const event = new Event('change');
        event.detail = { value: h };
        pickers[1].dispatchEvent(event);
      }
    }, currentHour);
    await wait(500);

    // Fill remark
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="备注"]');
      if (input) {
        input.value = '测试乐捐';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await wait(500);

    // Submit
    await clickText(page, '提交预约');
    await wait(3000);
    await screenshot(page, '07-lejuan.png');

    const afterLejuan = queryDB("SELECT COUNT(*) FROM lejuan_records");
    const lejuanOk = parseInt(afterLejuan) > parseInt(beforeLejuan);
    results.push({ test: '乐捐报备', status: lejuanOk ? 'PASS' : 'FAIL', detail: `乐捐 ${beforeLejuan}→${afterLejuan}` });
    console.log(`  ${lejuanOk ? '✅' : '❌'} 乐捐报备: ${lejuanOk ? 'PASS' : 'FAIL'}\n`);

    // ==========================
    // 测试8: 下班打卡
    // ==========================
    console.log('[8] 下班打卡...');
    const beforeOut = queryDB("SELECT COUNT(*) FROM attendance_records WHERE clock_out_time IS NOT NULL");

    await page.goto(`${BASE_URL}/#/pages/internal/clock`, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(4000);
    await screenshot(page, '08-1-clock-page.png');

    // Click 下班 (no photo needed for clock-out)
    await clickText(page, '下班');
    await wait(3000);
    await screenshot(page, '08-clockout.png');

    const afterOut = queryDB("SELECT COUNT(*) FROM attendance_records WHERE clock_out_time IS NOT NULL");
    const outOk = parseInt(afterOut) > parseInt(beforeOut);
    results.push({ test: '下班打卡', status: outOk ? 'PASS' : 'FAIL', detail: `下班打卡 ${beforeOut}→${afterOut}` });
    console.log(`  ${outOk ? '✅' : '❌'} 下班打卡: ${outOk ? 'PASS' : 'FAIL'}\n`);

  } catch (e) {
    console.error('Fatal error:', e.message);
    results.push({ test: '异常', status: 'ERROR', detail: e.message });
  } finally {
    // Close all tabs
    const pages = await browser.pages();
    for (const p of pages) {
      try { await p.close(); } catch (e) {}
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('测试结果汇总');
    console.log('='.repeat(50));
    results.forEach(r => {
      const icon = r.status === 'PASS' ? '✅' : (r.status === 'FAIL' ? '❌' : '⚠️');
      console.log(`${icon} ${r.test}: ${r.status} | ${r.detail}`);
    });
    const passCount = results.filter(r => r.status === 'PASS').length;
    console.log(`\n总计: ${passCount}/${results.length} 通过`);

    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'results-final.json'),
      JSON.stringify(results, null, 2)
    );
  }
}

main().catch(console.error);
