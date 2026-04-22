const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const path = require('path');

const SCREENSHOT_DIR = '/TG/temp/fulltest';
const DB_PATH = '/TG/tgservice/db/tgservice.db';
const BASE_URL = 'http://127.0.0.1:8089';
const PHONE = '18775703862';
const CODE = '888888';

// Helper: wait
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Helper: query sqlite via command line
function queryDB(sql) {
  try {
    const result = execSync(`sqlite3 "${DB_PATH}" "${sql}"`, { encoding: 'utf-8' });
    return result.trim();
  } catch (e) {
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

// Helper: 点击包含特定文字的元素
async function clickByText(page, text) {
  const elements = await page.$$('uni-view, button, a, uni-text');
  for (const el of elements) {
    const content = await page.evaluate(e => e.textContent || '', el);
    if (content.includes(text)) {
      await el.click();
      console.log(`点击: ${text}`);
      await wait(1000);
      return true;
    }
  }
  return false;
}

// Helper: 点击指定类名的元素
async function clickByClass(page, className) {
  const elements = await page.$$(`.${className}`);
  if (elements.length > 0) {
    await elements[0].click();
    console.log(`点击 .${className}`);
    await wait(1000);
    return true;
  }
  return false;
}

async function main() {
  console.log('=== 开始前端完整测试 V2 ===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const results = [];
  
  try {
    // =====================
    // 测试1: 登录测试
    // =====================
    console.log('[测试1] 登录测试...');
    const page1 = await browser.newPage();
    
    try {
      // 直接打开登录页
      await page1.goto(`${BASE_URL}/#/pages/auth/login`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(3000);
      
      const currentUrl = page1.url();
      console.log('当前URL:', currentUrl);
      await screenshot(page1, '01-1-login-page.png');
      
      // 获取页面内容
      const content = await page1.content();
      console.log('页面内容长度:', content.length);
      
      // 等待页面加载完成
      await wait(2000);
      
      // 查找手机号输入框 - 使用多种选择器
      let phoneInput = await page1.$('input[type="tel"]');
      if (!phoneInput) {
        phoneInput = await page1.$('input[type="number"]');
      }
      if (!phoneInput) {
        // 尝试通过 placeholder 查找
        phoneInput = await page1.$('input[placeholder*="手机"]');
      }
      
      if (phoneInput) {
        // 清空并输入手机号
        await phoneInput.click({ clickCount: 3 });
        await page1.keyboard.type(PHONE);
        console.log('输入手机号:', PHONE);
        await wait(500);
      } else {
        console.log('未找到手机号输入框');
      }
      
      await screenshot(page1, '01-2-phone-entered.png');
      
      // 点击获取验证码按钮
      const buttons = await page1.$$('button');
      for (const btn of buttons) {
        const text = await page1.evaluate(e => e.textContent || '', btn);
        if (text.includes('验证码') || text.includes('获取')) {
          await btn.click();
          console.log('点击获取验证码');
          await wait(1500);
          break;
        }
      }
      
      await screenshot(page1, '01-3-code-btn-clicked.png');
      
      // 查找验证码输入框
      let codeInput = await page1.$('input[type="number"]:nth-of-type(2)');
      if (!codeInput) {
        codeInput = await page1.$('input[placeholder*="验证码"]');
      }
      if (!codeInput) {
        // 获取所有输入框，第二个应该是验证码
        const inputs = await page1.$$('input');
        if (inputs.length >= 2) {
          codeInput = inputs[1];
        }
      }
      
      if (codeInput) {
        await codeInput.click({ clickCount: 3 });
        await page1.keyboard.type(CODE);
        console.log('输入验证码:', CODE);
        await wait(500);
      } else {
        console.log('未找到验证码输入框');
      }
      
      await screenshot(page1, '01-4-code-entered.png');
      
      // 点击登录按钮
      const loginBtns = await page1.$$('button');
      for (const btn of loginBtns) {
        const text = await page1.evaluate(e => e.textContent || '', btn);
        if (text.includes('登录') || text.includes('Login') || text.includes('确定')) {
          await btn.click();
          console.log('点击登录');
          await wait(3000);
          break;
        }
      }
      
      await screenshot(page1, '01-login.png');
      
      // 验证登录状态 - 检查是否跳转到其他页面
      const finalUrl = page1.url();
      console.log('最终URL:', finalUrl);
      
      // 检查页面内容是否包含会员相关元素
      const finalContent = await page1.content();
      const loginSuccess = !finalUrl.includes('login') && !finalUrl.includes('auth');
      
      results.push({
        test: '登录测试',
        status: loginSuccess ? 'PASS' : 'FAIL',
        detail: loginSuccess ? `登录成功，跳转到 ${finalUrl}` : '登录失败，仍在登录页'
      });
      console.log(`[结果] ${loginSuccess ? '✓ PASS' : '✗ FAIL'} - 登录测试\n`);
      
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
      // 记录下单前的订单数
      const beforeCount = queryDB("SELECT COUNT(*) FROM orders");
      console.log('下单前订单数:', beforeCount);
      
      // 打开首页
      await page2.goto(`${BASE_URL}/#/pages/index/index`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(3000);
      await screenshot(page2, '02-1-home.png');
      
      // 点击 VIP 包卡片（模拟选台桌）
      const vipCards = await page2.$$('.vip-card');
      if (vipCards.length > 0) {
        await vipCards[0].click();
        console.log('点击VIP包');
        await wait(3000);
      }
      
      await screenshot(page2, '02-2-vip-detail.png');
      
      // 查找商品点单入口
      const orderBtn = await page2.$('.main-btn');
      if (orderBtn) {
        await orderBtn.click();
        console.log('点击商品点单');
        await wait(3000);
      } else {
        // 点击 tabbar 的商品
        const tabbarItems = await page2.$$('.uni-tabbar__item');
        if (tabbarItems.length >= 2) {
          await tabbarItems[1].click();
          console.log('点击底部商品 tab');
          await wait(3000);
        }
      }
      
      await screenshot(page2, '02-3-products.png');
      
      // 添加商品到购物车
      const productCards = await page2.$$('.product-card');
      if (productCards.length > 0) {
        await productCards[0].click();
        console.log('点击商品');
        await wait(2000);
      }
      
      await screenshot(page2, '02-4-product-added.png');
      
      // 打开购物车
      const cartBtns = await page2.$$('.cart, [class*="cart"]');
      for (const btn of cartBtns) {
        const text = await page2.evaluate(e => e.textContent || '', btn);
        if (text.includes('购物车') || text.includes('cart') || btn.className?.includes('cart')) {
          await btn.click();
          console.log('打开购物车');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(page2, '02-5-cart.png');
      
      // 下单
      const submitBtns = await page2.$$('button');
      for (const btn of submitBtns) {
        const text = await page2.evaluate(e => e.textContent || '', btn);
        if (text.includes('下单') || text.includes('提交') || text.includes('结算')) {
          await btn.click();
          console.log('点击下单');
          await wait(3000);
          break;
        }
      }
      
      await screenshot(page2, '02-order.png');
      
      // 验证数据库
      const afterCount = queryDB("SELECT COUNT(*) FROM orders");
      console.log('下单后订单数:', afterCount);
      
      const orderSuccess = parseInt(afterCount) > parseInt(beforeCount);
      
      results.push({
        test: '商品下单',
        status: orderSuccess ? 'PASS' : 'FAIL',
        detail: orderSuccess ? `订单数从 ${beforeCount} 增加到 ${afterCount}` : '订单数未增加'
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
      
      // 先登录
      await page3.goto(`${BASE_URL}/#/pages/auth/login`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      
      // 快速登录流程
      const inputs = await page3.$$('input');
      if (inputs.length >= 1) {
        await inputs[0].click({ clickCount: 3 });
        await page3.keyboard.type(PHONE);
        await wait(300);
      }
      if (inputs.length >= 2) {
        await inputs[1].click({ clickCount: 3 });
        await page3.keyboard.type(CODE);
        await wait(300);
      }
      
      const loginBtns = await page3.$$('button');
      for (const btn of loginBtns) {
        const text = await page3.evaluate(e => e.textContent || '', btn);
        if (text.includes('登录')) {
          await btn.click();
          await wait(2000);
          break;
        }
      }
      
      // 打开会员中心
      await page3.goto(`${BASE_URL}/#/pages/member/center`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      await screenshot(page3, '03-1-member.png');
      
      // 查找服务下单入口
      const menuItems = await page3.$$('.menu-item, [class*="menu"], a, button');
      for (const item of menuItems) {
        const text = await page3.evaluate(e => e.textContent || '', item);
        if (text.includes('服务下单') || text.includes('服务')) {
          await item.click();
          console.log('点击服务下单');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(page3, '03-2-service-page.png');
      
      // 提交服务订单
      const submitBtns = await page3.$$('button');
      for (const btn of submitBtns) {
        const text = await page3.evaluate(e => e.textContent || '', btn);
        if (text.includes('提交') || text.includes('下单')) {
          await btn.click();
          console.log('提交服务订单');
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
        detail: serviceSuccess ? `服务订单数从 ${beforeCount} 增加到 ${afterCount}` : '服务订单数未增加'
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
      const beforeCount = queryDB(`SELECT COUNT(*) FROM attendance_records WHERE clock_in_time IS NOT NULL`);
      console.log('上班打卡前记录数:', beforeCount);
      
      // 登录
      await page4.goto(`${BASE_URL}/#/pages/auth/login`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      
      const inputs = await page4.$$('input');
      if (inputs.length >= 1) {
        await inputs[0].click({ clickCount: 3 });
        await page4.keyboard.type(PHONE);
        await wait(300);
      }
      if (inputs.length >= 2) {
        await inputs[1].click({ clickCount: 3 });
        await page4.keyboard.type(CODE);
        await wait(300);
      }
      
      const loginBtns = await page4.$$('button');
      for (const btn of loginBtns) {
        const text = await page4.evaluate(e => e.textContent || '', btn);
        if (text.includes('登录')) {
          await btn.click();
          await wait(2000);
          break;
        }
      }
      
      // 打开会员中心
      await page4.goto(`${BASE_URL}/#/pages/member/center`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      
      // 查找上下班入口
      const menuItems = await page4.$$('.menu-item, [class*="menu"], a, button');
      for (const item of menuItems) {
        const text = await page4.evaluate(e => e.textContent || '', item);
        if (text.includes('上下班') || text.includes('打卡')) {
          await item.click();
          console.log('进入打卡页面');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(page4, '04-1-clock-page.png');
      
      // 上班打卡
      const clockBtns = await page4.$$('button');
      for (const btn of clockBtns) {
        const text = await page4.evaluate(e => e.textContent || '', btn);
        if (text.includes('上班打卡') || text.includes('上班')) {
          await btn.click();
          console.log('点击上班打卡');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(page4, '04-clockin.png');
      
      const afterCount = queryDB(`SELECT COUNT(*) FROM attendance_records WHERE clock_in_time IS NOT NULL`);
      const clockInSuccess = parseInt(afterCount) > parseInt(beforeCount);
      
      results.push({
        test: '上班打卡',
        status: clockInSuccess ? 'PASS' : 'FAIL',
        detail: clockInSuccess ? `打卡记录从 ${beforeCount} 增加到 ${afterCount}` : '打卡记录未增加'
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
      const beforeCount = queryDB(`SELECT COUNT(*) FROM table_action_orders WHERE order_type = '上桌单'`);
      console.log('上桌前记录数:', beforeCount);
      
      // 登录
      await page5.goto(`${BASE_URL}/#/pages/auth/login`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      
      const inputs = await page5.$$('input');
      if (inputs.length >= 1) {
        await inputs[0].click({ clickCount: 3 });
        await page5.keyboard.type(PHONE);
        await wait(300);
      }
      if (inputs.length >= 2) {
        await inputs[1].click({ clickCount: 3 });
        await page5.keyboard.type(CODE);
        await wait(300);
      }
      
      const loginBtns = await page5.$$('button');
      for (const btn of loginBtns) {
        const text = await page5.evaluate(e => e.textContent || '', btn);
        if (text.includes('登录')) {
          await btn.click();
          await wait(2000);
          break;
        }
      }
      
      // 打开会员中心
      await page5.goto(`${BASE_URL}/#/pages/member/center`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      
      // 查找上下桌入口
      const menuItems = await page5.$$('.menu-item, [class*="menu"], a, button');
      for (const item of menuItems) {
        const text = await page5.evaluate(e => e.textContent || '', item);
        if (text.includes('上下桌') || text.includes('上桌')) {
          await item.click();
          console.log('进入上下桌页面');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(page5, '05-1-table-page.png');
      
      // 上桌
      const tableBtns = await page5.$$('button');
      for (const btn of tableBtns) {
        const text = await page5.evaluate(e => e.textContent || '', btn);
        if (text.includes('上桌') || text.includes('开台')) {
          await btn.click();
          console.log('点击上桌');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(page5, '05-tablein.png');
      
      const afterCount = queryDB(`SELECT COUNT(*) FROM table_action_orders WHERE order_type = '上桌单'`);
      const tableInSuccess = parseInt(afterCount) > parseInt(beforeCount);
      
      results.push({
        test: '上桌单',
        status: tableInSuccess ? 'PASS' : 'FAIL',
        detail: tableInSuccess ? `上桌记录从 ${beforeCount} 增加到 ${afterCount}` : '上桌记录未增加'
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
      const beforeCount = queryDB(`SELECT COUNT(*) FROM table_action_orders WHERE order_type = '下桌单'`);
      console.log('下桌前记录数:', beforeCount);
      
      // 登录
      await page6.goto(`${BASE_URL}/#/pages/auth/login`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      
      const inputs = await page6.$$('input');
      if (inputs.length >= 1) {
        await inputs[0].click({ clickCount: 3 });
        await page6.keyboard.type(PHONE);
        await wait(300);
      }
      if (inputs.length >= 2) {
        await inputs[1].click({ clickCount: 3 });
        await page6.keyboard.type(CODE);
        await wait(300);
      }
      
      const loginBtns = await page6.$$('button');
      for (const btn of loginBtns) {
        const text = await page6.evaluate(e => e.textContent || '', btn);
        if (text.includes('登录')) {
          await btn.click();
          await wait(2000);
          break;
        }
      }
      
      // 打开会员中心
      await page6.goto(`${BASE_URL}/#/pages/member/center`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      
      // 查找上下桌入口
      const menuItems = await page6.$$('.menu-item, [class*="menu"], a, button');
      for (const item of menuItems) {
        const text = await page6.evaluate(e => e.textContent || '', item);
        if (text.includes('上下桌') || text.includes('下桌')) {
          await item.click();
          console.log('进入上下桌页面');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(page6, '06-1-table-page.png');
      
      // 下桌
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
      
      const afterCount = queryDB(`SELECT COUNT(*) FROM table_action_orders WHERE order_type = '下桌单'`);
      const tableOutSuccess = parseInt(afterCount) > parseInt(beforeCount);
      
      results.push({
        test: '下桌单',
        status: tableOutSuccess ? 'PASS' : 'FAIL',
        detail: tableOutSuccess ? `下桌记录从 ${beforeCount} 增加到 ${afterCount}` : '下桌记录未增加'
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
      const beforeCount = queryDB(`SELECT COUNT(*) FROM lejuan_records`);
      console.log('报备前记录数:', beforeCount);
      
      // 登录
      await page7.goto(`${BASE_URL}/#/pages/auth/login`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      
      const inputs = await page7.$$('input');
      if (inputs.length >= 1) {
        await inputs[0].click({ clickCount: 3 });
        await page7.keyboard.type(PHONE);
        await wait(300);
      }
      if (inputs.length >= 2) {
        await inputs[1].click({ clickCount: 3 });
        await page7.keyboard.type(CODE);
        await wait(300);
      }
      
      const loginBtns = await page7.$$('button');
      for (const btn of loginBtns) {
        const text = await page7.evaluate(e => e.textContent || '', btn);
        if (text.includes('登录')) {
          await btn.click();
          await wait(2000);
          break;
        }
      }
      
      // 打开会员中心
      await page7.goto(`${BASE_URL}/#/pages/member/center`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      
      // 查找乐捐报备入口
      const menuItems = await page7.$$('.menu-item, [class*="menu"], a, button');
      for (const item of menuItems) {
        const text = await page7.evaluate(e => e.textContent || '', item);
        if (text.includes('乐捐') || text.includes('报备')) {
          await item.click();
          console.log('进入乐捐报备页面');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(page7, '07-1-lejuan-page.png');
      
      // 提交乐捐
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
      
      const afterCount = queryDB(`SELECT COUNT(*) FROM lejuan_records`);
      const lejuanSuccess = parseInt(afterCount) > parseInt(beforeCount);
      
      results.push({
        test: '乐捐报备',
        status: lejuanSuccess ? 'PASS' : 'FAIL',
        detail: lejuanSuccess ? `乐捐记录从 ${beforeCount} 增加到 ${afterCount}` : '乐捐记录未增加'
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
      const beforeCount = queryDB(`SELECT COUNT(*) FROM attendance_records WHERE clock_out_time IS NOT NULL`);
      console.log('下班打卡前记录数:', beforeCount);
      
      // 登录
      await page8.goto(`${BASE_URL}/#/pages/auth/login`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      
      const inputs = await page8.$$('input');
      if (inputs.length >= 1) {
        await inputs[0].click({ clickCount: 3 });
        await page8.keyboard.type(PHONE);
        await wait(300);
      }
      if (inputs.length >= 2) {
        await inputs[1].click({ clickCount: 3 });
        await page8.keyboard.type(CODE);
        await wait(300);
      }
      
      const loginBtns = await page8.$$('button');
      for (const btn of loginBtns) {
        const text = await page8.evaluate(e => e.textContent || '', btn);
        if (text.includes('登录')) {
          await btn.click();
          await wait(2000);
          break;
        }
      }
      
      // 打开会员中心
      await page8.goto(`${BASE_URL}/#/pages/member/center`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      
      // 查找上下班入口
      const menuItems = await page8.$$('.menu-item, [class*="menu"], a, button');
      for (const item of menuItems) {
        const text = await page8.evaluate(e => e.textContent || '', item);
        if (text.includes('上下班') || text.includes('打卡')) {
          await item.click();
          console.log('进入打卡页面');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(page8, '08-1-clock-page.png');
      
      // 下班打卡
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
      
      const afterCount = queryDB(`SELECT COUNT(*) FROM attendance_records WHERE clock_out_time IS NOT NULL`);
      const clockOutSuccess = parseInt(afterCount) > parseInt(beforeCount);
      
      results.push({
        test: '下班打卡',
        status: clockOutSuccess ? 'PASS' : 'FAIL',
        detail: clockOutSuccess ? `下班打卡记录从 ${beforeCount} 增加到 ${afterCount}` : '下班打卡记录未增加'
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
    
    // 保存结果到文件
    const fs = require('fs');
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'results-v2.json'),
      JSON.stringify(results, null, 2)
    );
    console.log(`\n结果已保存到 ${SCREENSHOT_DIR}/results-v2.json`);
  }
}

main().catch(console.error);