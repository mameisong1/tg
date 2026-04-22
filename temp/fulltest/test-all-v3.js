const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = '/TG/temp/fulltest';
const DB_PATH = '/TG/tgservice/db/tgservice.db';
const BASE_URL = 'http://127.0.0.1:8089';
const PHONE = '18775703862';
const CODE = '888888';

// Helper: wait
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Helper: query sqlite
function queryDB(sql) {
  try {
    const result = execSync(`sqlite3 "${DB_PATH}" "${sql}"`, { encoding: 'utf-8' });
    return result.trim();
  } catch (e) {
    console.log('SQL Error:', e.message);
    return '';
  }
}

// Helper: screenshot
async function screenshot(page, name) {
  const file = path.join(SCREENSHOT_DIR, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`[SCREENSHOT] ${name}`);
  return file;
}

async function main() {
  console.log('=== 开始前端完整测试 V3 ===\n');
  console.log('正确的路由:');
  console.log('- 教练登录: #/pages/coach-login/coach-login');
  console.log('- 打卡: #/pages/internal/clock');
  console.log('- 上桌/下桌: #/pages/internal/table-action');
  console.log('- 服务下单: #/pages/internal/service-order');
  console.log('- 乐捐: #/pages/internal/lejuan');
  console.log('');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const results = [];
  let loggedIn = false;
  
  try {
    // =====================
    // 测试1: 登录测试（教练登录）
    // =====================
    console.log('[测试1] 教练登录...');
    const page1 = await browser.newPage();
    
    try {
      await page1.goto(`${BASE_URL}/#/pages/coach-login/coach-login`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(5000);  // 等待 Vue 渲染
      
      console.log('当前URL:', page1.url());
      await screenshot(page1, '01-1-coach-login.png');
      
      // 获取实际渲染内容
      const html = await page1.content();
      fs.writeFileSync('/TG/temp/fulltest/coach-login-v3.html', html);
      console.log('页面内容长度:', html.length);
      
      // 使用 evaluate 获取所有 input 元素信息
      const inputInfo = await page1.evaluate(() => {
        const inputs = document.querySelectorAll('input');
        return Array.from(inputs).map(i => ({
          type: i.type,
          placeholder: i.placeholder,
          name: i.name,
          className: i.className
        }));
      });
      console.log('输入框信息:', JSON.stringify(inputInfo, null, 2));
      
      // 输入手机号
      const phoneInput = await page1.$('input[type="tel"], input[type="number"], input');
      if (phoneInput) {
        await phoneInput.click({ clickCount: 3 });
        await phoneInput.type(PHONE, { delay: 50 });
        console.log('输入手机号:', PHONE);
        await wait(500);
      }
      
      await screenshot(page1, '01-2-phone.png');
      
      // 点击获取验证码
      const buttons = await page1.$$('button');
      console.log('找到按钮数量:', buttons.length);
      
      for (const btn of buttons) {
        const text = await page1.evaluate(e => e.textContent || '', btn);
        console.log('按钮文字:', text);
        if (text.includes('验证码') || text.includes('获取')) {
          await btn.click();
          console.log('点击获取验证码');
          await wait(1500);
          break;
        }
      }
      
      await screenshot(page1, '01-3-code-request.png');
      
      // 输入验证码
      const inputs = await page1.$$('input');
      if (inputs.length >= 2) {
        await inputs[1].click({ clickCount: 3 });
        await inputs[1].type(CODE, { delay: 50 });
        console.log('输入验证码:', CODE);
        await wait(500);
      }
      
      await screenshot(page1, '01-4-code.png');
      
      // 点击登录
      for (const btn of buttons) {
        const text = await page1.evaluate(e => e.textContent || '', btn);
        if (text.includes('登录') || text.includes('Login')) {
          await btn.click();
          console.log('点击登录按钮');
          await wait(3000);
          break;
        }
      }
      
      await screenshot(page1, '01-login.png');
      
      // 检查登录结果
      const finalUrl = page1.url();
      console.log('登录后URL:', finalUrl);
      
      loggedIn = !finalUrl.includes('login');
      
      results.push({
        test: '登录测试',
        status: loggedIn ? 'PASS' : 'FAIL',
        detail: loggedIn ? `登录成功，跳转到 ${finalUrl}` : `登录失败，仍在 ${finalUrl}`
      });
      console.log(`[结果] ${loggedIn ? '✓ PASS' : '✗ FAIL'} - 登录测试\n`);
      
    } catch (e) {
      results.push({ test: '登录测试', status: 'ERROR', detail: e.message });
      console.log(`[错误] ${e.message}\n`);
    }
    await page1.close();
    
    // =====================
    // 测试2: 商品下单
    // =====================
    console.log('[测试2] 商品下单...');
    const page2 = await browser.newPage();
    
    try {
      const beforeCount = queryDB("SELECT COUNT(*) FROM orders");
      console.log('下单前订单数:', beforeCount);
      
      await page2.goto(`${BASE_URL}/#/pages/index/index`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(3000);
      await screenshot(page2, '02-1-home.png');
      
      // 点击商品点单按钮
      const mainBtn = await page2.$('.main-btn');
      if (mainBtn) {
        await mainBtn.click();
        console.log('点击商品点单');
        await wait(3000);
      } else {
        // 点击底部tabbar的商品
        const tabItems = await page2.$$('.uni-tabbar__item');
        if (tabItems.length >= 2) {
          await tabItems[1].click();
          console.log('点击商品tab');
          await wait(3000);
        }
      }
      
      await screenshot(page2, '02-2-products.png');
      
      // 添加商品到购物车
      const productCards = await page2.$$('.product-card');
      if (productCards.length > 0) {
        // 点击第一个商品
        await productCards[0].click();
        console.log('点击商品');
        await wait(2000);
        
        // 查找加号按钮
        const addBtns = await page2.$$('button, [class*="add"]');
        for (const btn of addBtns) {
          const text = await page2.evaluate(e => e.textContent || '', btn);
          if (text.includes('+') || btn.className?.includes('add')) {
            await btn.click();
            console.log('点击加号添加商品');
            await wait(1000);
            break;
          }
        }
      }
      
      await screenshot(page2, '02-3-add-product.png');
      
      // 打开购物车 - 点击tabbar的购物车图标
      const cartTab = await page2.$$('.uni-tabbar__item');
      if (cartTab.length >= 2) {
        await cartTab[1].click();
        console.log('点击购物车tab');
        await wait(2000);
      }
      
      await screenshot(page2, '02-4-cart.png');
      
      // 点击下单按钮
      const orderBtns = await page2.$$('button');
      for (const btn of orderBtns) {
        const text = await page2.evaluate(e => e.textContent || '', btn);
        if (text.includes('下单') || text.includes('结算') || text.includes('提交')) {
          await btn.click();
          console.log('点击下单');
          await wait(3000);
          break;
        }
      }
      
      await screenshot(page2, '02-order.png');
      
      const afterCount = queryDB("SELECT COUNT(*) FROM orders");
      const orderSuccess = parseInt(afterCount) > parseInt(beforeCount);
      
      results.push({
        test: '商品下单',
        status: orderSuccess ? 'PASS' : 'FAIL',
        detail: orderSuccess ? `订单从 ${beforeCount} 增到 ${afterCount}` : `订单未增加 (${beforeCount} -> ${afterCount})`
      });
      console.log(`[结果] ${orderSuccess ? '✓ PASS' : '✗ FAIL'} - 商品下单\n`);
      
    } catch (e) {
      results.push({ test: '商品下单', status: 'ERROR', detail: e.message });
      console.log(`[错误] ${e.message}\n`);
    }
    await page2.close();
    
    // =====================
    // 测试3: 服务下单
    // =====================
    console.log('[测试3] 服务下单...');
    const page3 = await browser.newPage();
    
    try {
      const beforeCount = queryDB("SELECT COUNT(*) FROM service_orders");
      console.log('下单前服务订单数:', beforeCount);
      
      await page3.goto(`${BASE_URL}/#/pages/internal/service-order`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(3000);
      await screenshot(page3, '03-1-service-order.png');
      
      // 检查页面内容
      const html = await page3.content();
      console.log('服务下单页面内容长度:', html.length);
      
      // 查找提交按钮
      const submitBtns = await page3.$$('button');
      for (const btn of submitBtns) {
        const text = await page3.evaluate(e => e.textContent || '', btn);
        console.log('按钮:', text);
        if (text.includes('提交') || text.includes('下单')) {
          await btn.click();
          console.log('点击提交服务订单');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(page3, '03-service.png');
      
      const afterCount = queryDB("SELECT COUNT(*) FROM service_orders");
      const serviceSuccess = parseInt(afterCount) > parseInt(beforeCount);
      
      results.push({
        test: '服务下单',
        status: serviceSuccess ? 'PASS' : 'FAIL',
        detail: serviceSuccess ? `服务订单从 ${beforeCount} 增到 ${afterCount}` : `服务订单未增加`
      });
      console.log(`[结果] ${serviceSuccess ? '✓ PASS' : '✗ FAIL'} - 服务下单\n`);
      
    } catch (e) {
      results.push({ test: '服务下单', status: 'ERROR', detail: e.message });
      console.log(`[错误] ${e.message}\n`);
    }
    await page3.close();
    
    // =====================
    // 测试4: 上班打卡
    // =====================
    console.log('[测试4] 上班打卡...');
    const page4 = await browser.newPage();
    
    try {
      const beforeCount = queryDB("SELECT COUNT(*) FROM attendance_records WHERE clock_in_time IS NOT NULL");
      console.log('上班打卡前记录数:', beforeCount);
      
      await page4.goto(`${BASE_URL}/#/pages/internal/clock`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(3000);
      await screenshot(page4, '04-1-clock.png');
      
      // 检查页面内容
      const html = await page4.content();
      console.log('打卡页面内容长度:', html.length);
      
      // 点击上班打卡按钮
      const clockBtns = await page4.$$('button');
      for (const btn of clockBtns) {
        const text = await page4.evaluate(e => e.textContent || '', btn);
        console.log('按钮:', text);
        if (text.includes('上班打卡') || text.includes('上班')) {
          await btn.click();
          console.log('点击上班打卡');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(page4, '04-clockin.png');
      
      const afterCount = queryDB("SELECT COUNT(*) FROM attendance_records WHERE clock_in_time IS NOT NULL");
      const clockInSuccess = parseInt(afterCount) > parseInt(beforeCount);
      
      results.push({
        test: '上班打卡',
        status: clockInSuccess ? 'PASS' : 'FAIL',
        detail: clockInSuccess ? `打卡从 ${beforeCount} 增到 ${afterCount}` : `打卡未增加`
      });
      console.log(`[结果] ${clockInSuccess ? '✓ PASS' : '✗ FAIL'} - 上班打卡\n`);
      
    } catch (e) {
      results.push({ test: '上班打卡', status: 'ERROR', detail: e.message });
      console.log(`[错误] ${e.message}\n`);
    }
    await page4.close();
    
    // =====================
    // 测试5: 上桌单
    // =====================
    console.log('[测试5] 上桌单...');
    const page5 = await browser.newPage();
    
    try {
      const beforeCount = queryDB("SELECT COUNT(*) FROM table_action_orders WHERE order_type = '上桌单'");
      console.log('上桌单前记录数:', beforeCount);
      
      await page5.goto(`${BASE_URL}/#/pages/internal/table-action`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(3000);
      await screenshot(page5, '05-1-table-action.png');
      
      // 点击上桌单按钮
      const tableBtns = await page5.$$('button');
      for (const btn of tableBtns) {
        const text = await page5.evaluate(e => e.textContent || '', btn);
        console.log('按钮:', text);
        if (text.includes('上桌') || text.includes('开台')) {
          await btn.click();
          console.log('点击上桌');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(page5, '05-tablein.png');
      
      const afterCount = queryDB("SELECT COUNT(*) FROM table_action_orders WHERE order_type = '上桌单'");
      const tableInSuccess = parseInt(afterCount) > parseInt(beforeCount);
      
      results.push({
        test: '上桌单',
        status: tableInSuccess ? 'PASS' : 'FAIL',
        detail: tableInSuccess ? `上桌单从 ${beforeCount} 增到 ${afterCount}` : `上桌单未增加`
      });
      console.log(`[结果] ${tableInSuccess ? '✓ PASS' : '✗ FAIL'} - 上桌单\n`);
      
    } catch (e) {
      results.push({ test: '上桌单', status: 'ERROR', detail: e.message });
      console.log(`[错误] ${e.message}\n`);
    }
    await page5.close();
    
    // =====================
    // 测试6: 下桌单
    // =====================
    console.log('[测试6] 下桌单...');
    const page6 = await browser.newPage();
    
    try {
      const beforeCount = queryDB("SELECT COUNT(*) FROM table_action_orders WHERE order_type = '下桌单'");
      console.log('下桌单前记录数:', beforeCount);
      
      await page6.goto(`${BASE_URL}/#/pages/internal/table-action`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(3000);
      await screenshot(page6, '06-1-table-action.png');
      
      // 点击下桌单按钮
      const tableBtns = await page6.$$('button');
      for (const btn of tableBtns) {
        const text = await page6.evaluate(e => e.textContent || '', btn);
        if (text.includes('下桌') || text.includes('结账')) {
          await btn.click();
          console.log('点击下桌');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(page6, '06-tableout.png');
      
      const afterCount = queryDB("SELECT COUNT(*) FROM table_action_orders WHERE order_type = '下桌单'");
      const tableOutSuccess = parseInt(afterCount) > parseInt(beforeCount);
      
      results.push({
        test: '下桌单',
        status: tableOutSuccess ? 'PASS' : 'FAIL',
        detail: tableOutSuccess ? `下桌单从 ${beforeCount} 增到 ${afterCount}` : `下桌单未增加`
      });
      console.log(`[结果] ${tableOutSuccess ? '✓ PASS' : '✗ FAIL'} - 下桌单\n`);
      
    } catch (e) {
      results.push({ test: '下桌单', status: 'ERROR', detail: e.message });
      console.log(`[错误] ${e.message}\n`);
    }
    await page6.close();
    
    // =====================
    // 测试7: 乐捐报备
    // =====================
    console.log('[测试7] 乐捐报备...');
    const page7 = await browser.newPage();
    
    try {
      const beforeCount = queryDB("SELECT COUNT(*) FROM lejuan_records");
      console.log('乐捐报备前记录数:', beforeCount);
      
      await page7.goto(`${BASE_URL}/#/pages/internal/lejuan`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(3000);
      await screenshot(page7, '07-1-lejuan.png');
      
      // 提交乐捐报备
      const submitBtns = await page7.$$('button');
      for (const btn of submitBtns) {
        const text = await page7.evaluate(e => e.textContent || '', btn);
        if (text.includes('提交') || text.includes('报备')) {
          await btn.click();
          console.log('提交乐捐报备');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(page7, '07-lejuan.png');
      
      const afterCount = queryDB("SELECT COUNT(*) FROM lejuan_records");
      const lejuanSuccess = parseInt(afterCount) > parseInt(beforeCount);
      
      results.push({
        test: '乐捐报备',
        status: lejuanSuccess ? 'PASS' : 'FAIL',
        detail: lejuanSuccess ? `乐捐从 ${beforeCount} 增到 ${afterCount}` : `乐捐未增加`
      });
      console.log(`[结果] ${lejuanSuccess ? '✓ PASS' : '✗ FAIL'} - 乐捐报备\n`);
      
    } catch (e) {
      results.push({ test: '乐捐报备', status: 'ERROR', detail: e.message });
      console.log(`[错误] ${e.message}\n`);
    }
    await page7.close();
    
    // =====================
    // 测试8: 下班打卡
    // =====================
    console.log('[测试8] 下班打卡...');
    const page8 = await browser.newPage();
    
    try {
      const beforeCount = queryDB("SELECT COUNT(*) FROM attendance_records WHERE clock_out_time IS NOT NULL");
      console.log('下班打卡前记录数:', beforeCount);
      
      await page8.goto(`${BASE_URL}/#/pages/internal/clock`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(3000);
      await screenshot(page8, '08-1-clock.png');
      
      // 点击下班打卡按钮
      const clockBtns = await page8.$$('button');
      for (const btn of clockBtns) {
        const text = await page8.evaluate(e => e.textContent || '', btn);
        if (text.includes('下班打卡') || text.includes('下班')) {
          await btn.click();
          console.log('点击下班打卡');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(page8, '08-clockout.png');
      
      const afterCount = queryDB("SELECT COUNT(*) FROM attendance_records WHERE clock_out_time IS NOT NULL");
      const clockOutSuccess = parseInt(afterCount) > parseInt(beforeCount);
      
      results.push({
        test: '下班打卡',
        status: clockOutSuccess ? 'PASS' : 'FAIL',
        detail: clockOutSuccess ? `下班打卡从 ${beforeCount} 增到 ${afterCount}` : `下班打卡未增加`
      });
      console.log(`[结果] ${clockOutSuccess ? '✓ PASS' : '✗ FAIL'} - 下班打卡\n`);
      
    } catch (e) {
      results.push({ test: '下班打卡', status: 'ERROR', detail: e.message });
      console.log(`[错误] ${e.message}\n`);
    }
    await page8.close();
    
  } finally {
    // 关闭所有标签页
    const pages = await browser.pages();
    console.log('\n关闭所有标签页...');
    for (const page of pages) {
      try {
        await page.close();
      } catch (e) {}
    }
    
    // 打印汇总结果
    console.log('\n=== 测试结果汇总 ===');
    results.forEach(r => {
      const icon = r.status === 'PASS' ? '✓' : (r.status === 'FAIL' ? '✗' : '!');
      console.log(`${icon} ${r.test}: ${r.status} - ${r.detail}`);
    });
    
    const passCount = results.filter(r => r.status === 'PASS').length;
    console.log(`\n总计: ${passCount}/${results.length} 通过`);
    
    // 保存结果
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'results-v3.json'),
      JSON.stringify(results, null, 2)
    );
    console.log(`\n结果已保存到 ${SCREENSHOT_DIR}/results-v3.json`);
  }
}

main().catch(console.error);