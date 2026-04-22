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

async function main() {
  console.log('=== 开始前端完整测试 ===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const results = [];
  let currentPage = null;
  
  try {
    // =====================
    // 测试1: 登录测试
    // =====================
    console.log('[测试1] 登录测试...');
    currentPage = await browser.newPage();
    
    try {
      // 打开会员中心
      await currentPage.goto(`${BASE_URL}/#/pages/member/center`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(3000);
      
      const currentUrl = currentPage.url();
      console.log('当前URL:', currentUrl);
      
      // 截图初始状态
      await screenshot(currentPage, '01-1-initial.png');
      
      // 检查是否需要登录
      const pageContent = await currentPage.content();
      const needLogin = pageContent.includes('登录') || pageContent.includes('手机号') || currentUrl.includes('login');
      
      if (needLogin) {
        console.log('检测到需要登录...');
        
        // 尝试各种可能的登录表单选择器
        const phoneInput = await currentPage.$('input[type="tel"], input[placeholder*="手机"], input[placeholder*="phone"]');
        if (phoneInput) {
          await phoneInput.click({ clickCount: 3 });
          await phoneInput.type(PHONE);
          console.log('输入手机号:', PHONE);
        }
        
        await wait(500);
        
        // 点击获取验证码
        const codeBtns = await currentPage.$$('button');
        for (const btn of codeBtns) {
          const text = await currentPage.evaluate(el => el.textContent, btn);
          if (text && (text.includes('验证码') || text.includes('code'))) {
            await btn.click();
            console.log('点击获取验证码');
            await wait(1000);
            break;
          }
        }
        
        // 输入验证码
        const codeInput = await currentPage.$('input[type="number"], input[placeholder*="验证码"], input[placeholder*="code"]');
        if (codeInput) {
          await codeInput.click({ clickCount: 3 });
          await codeInput.type(CODE);
          console.log('输入验证码:', CODE);
        }
        
        await wait(500);
        
        // 点击登录
        const loginBtns = await currentPage.$$('button');
        for (const btn of loginBtns) {
          const text = await currentPage.evaluate(el => el.textContent, btn);
          if (text && (text.includes('登录') || text.includes('Login') || text.includes('提交'))) {
            await btn.click();
            console.log('点击登录');
            await wait(3000);
            break;
          }
        }
      }
      
      await screenshot(currentPage, '01-login.png');
      
      // 验证登录状态
      const finalContent = await currentPage.content();
      const loginSuccess = finalContent.includes('会员中心') || finalContent.includes('余额') || finalContent.includes('积分');
      
      results.push({
        test: '登录测试',
        status: loginSuccess ? 'PASS' : 'FAIL',
        detail: loginSuccess ? '登录成功' : '登录失败或未检测到登录状态'
      });
      console.log(`[结果] ${loginSuccess ? '✓ PASS' : '✗ FAIL'} - 登录测试\n`);
      
    } catch (e) {
      results.push({ test: '登录测试', status: 'ERROR', detail: e.message });
      console.log(`[错误] ${e.message}\n`);
    }
    await currentPage.close();
    
    // =====================
    // 测试2: 商品下单
    // =====================
    console.log('[测试2] 商品下单...');
    currentPage = await browser.newPage();
    
    try {
      // 记录下单前的订单数
      const beforeCount = queryDB("SELECT COUNT(*) FROM orders");
      console.log('下单前订单数:', beforeCount);
      
      // 打开首页
      await currentPage.goto(`${BASE_URL}/#/pages/index/index`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(3000);
      await screenshot(currentPage, '02-1-home.png');
      
      // 查找并点击台桌
      const pageContent = await currentPage.content();
      console.log('首页内容长度:', pageContent.length);
      
      // 尝试点击任何可点击的台桌元素
      const clickableItems = await currentPage.$$('[class*="table"], [class*="desk"], .item, .card');
      console.log('找到可点击元素:', clickableItems.length);
      
      if (clickableItems.length > 0) {
        await clickableItems[0].click();
        console.log('点击第一个元素');
        await wait(2000);
      }
      
      await screenshot(currentPage, '02-2-detail.png');
      
      // 查找加号按钮添加商品
      const addBtns = await currentPage.$$('button, [class*="add"], [class*="plus"]');
      for (const btn of addBtns) {
        const text = await currentPage.evaluate(el => el.textContent || el.innerText || '', btn);
        if (text.includes('+') || text.includes('加') || btn.className?.includes('add')) {
          await btn.click();
          console.log('添加商品');
          await wait(1000);
          break;
        }
      }
      
      // 查找购物车
      const cartBtns = await currentPage.$$('.cart, [class*="cart"], button');
      for (const btn of cartBtns) {
        const text = await currentPage.evaluate(el => el.textContent || '', btn);
        if (text.includes('购物车') || text.includes('cart')) {
          await btn.click();
          console.log('打开购物车');
          await wait(1500);
          break;
        }
      }
      
      await screenshot(currentPage, '02-3-cart.png');
      
      // 下单
      const submitBtns = await currentPage.$$('button, [class*="submit"], [class*="order"]');
      for (const btn of submitBtns) {
        const text = await currentPage.evaluate(el => el.textContent || '', btn);
        if (text.includes('下单') || text.includes('提交') || text.includes('结算')) {
          await btn.click();
          console.log('点击下单');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(currentPage, '02-order.png');
      
      // 验证数据库
      const afterCount = queryDB("SELECT COUNT(*) FROM orders");
      console.log('下单后订单数:', afterCount);
      
      const orderSuccess = afterCount > beforeCount;
      
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
    await currentPage.close();
    
    // =====================
    // 测试3: 服务下单
    // =====================
    console.log('[测试3] 服务下单...');
    currentPage = await browser.newPage();
    
    try {
      const beforeCount = queryDB("SELECT COUNT(*) FROM service_orders");
      console.log('下单前服务订单数:', beforeCount);
      
      await currentPage.goto(`${BASE_URL}/#/pages/member/center`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      await screenshot(currentPage, '03-1-member.png');
      
      // 查找服务下单入口
      const allLinks = await currentPage.$$('a, button, [class*="menu"], [class*="item"]');
      for (const link of allLinks) {
        const text = await currentPage.evaluate(el => el.textContent || '', link);
        if (text.includes('服务下单') || text.includes('服务')) {
          await link.click();
          console.log('点击服务下单');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(currentPage, '03-2-service.png');
      
      // 提交服务订单
      const submitBtns = await currentPage.$$('button, [class*="submit"]');
      for (const btn of submitBtns) {
        const text = await currentPage.evaluate(el => el.textContent || '', btn);
        if (text.includes('提交') || text.includes('下单')) {
          await btn.click();
          console.log('提交服务订单');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(currentPage, '03-service.png');
      
      const afterCount = queryDB("SELECT COUNT(*) FROM service_orders");
      const serviceSuccess = afterCount > beforeCount;
      
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
    await currentPage.close();
    
    // =====================
    // 测试4: 上班打卡
    // =====================
    console.log('[测试4] 上班打卡...');
    currentPage = await browser.newPage();
    
    try {
      const beforeCount = queryDB(`SELECT COUNT(*) FROM attendance_records WHERE type = 'clock_in'`);
      console.log('打卡前记录数:', beforeCount);
      
      await currentPage.goto(`${BASE_URL}/#/pages/member/center`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      
      // 查找上下班入口
      const allLinks = await currentPage.$$('a, button, [class*="menu"], [class*="item"]');
      for (const link of allLinks) {
        const text = await currentPage.evaluate(el => el.textContent || '', link);
        if (text.includes('上下班') || text.includes('打卡')) {
          await link.click();
          console.log('进入打卡页面');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(currentPage, '04-1-clock.png');
      
      // 上班打卡
      const clockBtns = await currentPage.$$('button, [class*="clock"]');
      for (const btn of clockBtns) {
        const text = await currentPage.evaluate(el => el.textContent || '', btn);
        if (text.includes('上班打卡') || text.includes('上班')) {
          await btn.click();
          console.log('点击上班打卡');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(currentPage, '04-clockin.png');
      
      const afterCount = queryDB(`SELECT COUNT(*) FROM attendance_records WHERE type = 'clock_in'`);
      const clockInSuccess = afterCount > beforeCount;
      
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
    await currentPage.close();
    
    // =====================
    // 测试5: 上桌单
    // =====================
    console.log('[测试5] 上桌单...');
    currentPage = await browser.newPage();
    
    try {
      const beforeCount = queryDB(`SELECT COUNT(*) FROM table_action_orders WHERE action_type = 'in'`);
      console.log('上桌前记录数:', beforeCount);
      
      await currentPage.goto(`${BASE_URL}/#/pages/member/center`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      
      // 查找上下桌入口
      const allLinks = await currentPage.$$('a, button, [class*="menu"], [class*="item"]');
      for (const link of allLinks) {
        const text = await currentPage.evaluate(el => el.textContent || '', link);
        if (text.includes('上下桌') || text.includes('上桌')) {
          await link.click();
          console.log('进入上下桌页面');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(currentPage, '05-1-table.png');
      
      // 上桌
      const tableBtns = await currentPage.$$('button');
      for (const btn of tableBtns) {
        const text = await currentPage.evaluate(el => el.textContent || '', btn);
        if (text.includes('上桌') || text.includes('开台')) {
          await btn.click();
          console.log('点击上桌');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(currentPage, '05-tablein.png');
      
      const afterCount = queryDB(`SELECT COUNT(*) FROM table_action_orders WHERE action_type = 'in'`);
      const tableInSuccess = afterCount > beforeCount;
      
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
    await currentPage.close();
    
    // =====================
    // 测试6: 下桌单
    // =====================
    console.log('[测试6] 下桌单...');
    currentPage = await browser.newPage();
    
    try {
      const beforeCount = queryDB(`SELECT COUNT(*) FROM table_action_orders WHERE action_type = 'out'`);
      console.log('下桌前记录数:', beforeCount);
      
      await currentPage.goto(`${BASE_URL}/#/pages/member/center`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      
      // 查找上下桌入口
      const allLinks = await currentPage.$$('a, button, [class*="menu"], [class*="item"]');
      for (const link of allLinks) {
        const text = await currentPage.evaluate(el => el.textContent || '', link);
        if (text.includes('上下桌') || text.includes('下桌')) {
          await link.click();
          console.log('进入上下桌页面');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(currentPage, '06-1-table.png');
      
      // 下桌
      const tableBtns = await currentPage.$$('button');
      for (const btn of tableBtns) {
        const text = await currentPage.evaluate(el => el.textContent || '', btn);
        if (text.includes('下桌') || text.includes('结账')) {
          await btn.click();
          console.log('点击下桌');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(currentPage, '06-tableout.png');
      
      const afterCount = queryDB(`SELECT COUNT(*) FROM table_action_orders WHERE action_type = 'out'`);
      const tableOutSuccess = afterCount > beforeCount;
      
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
    await currentPage.close();
    
    // =====================
    // 测试7: 乐捐报备
    // =====================
    console.log('[测试7] 乐捐报备...');
    currentPage = await browser.newPage();
    
    try {
      const beforeCount = queryDB(`SELECT COUNT(*) FROM lejuan_records`);
      console.log('报备前记录数:', beforeCount);
      
      await currentPage.goto(`${BASE_URL}/#/pages/member/center`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      
      // 查找乐捐报备入口
      const allLinks = await currentPage.$$('a, button, [class*="menu"], [class*="item"]');
      for (const link of allLinks) {
        const text = await currentPage.evaluate(el => el.textContent || '', link);
        if (text.includes('乐捐') || text.includes('报备')) {
          await link.click();
          console.log('进入乐捐报备页面');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(currentPage, '07-1-lejuan.png');
      
      // 提交乐捐
      const submitBtns = await currentPage.$$('button');
      for (const btn of submitBtns) {
        const text = await currentPage.evaluate(el => el.textContent || '', btn);
        if (text.includes('提交') || text.includes('报备')) {
          await btn.click();
          console.log('提交乐捐报备');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(currentPage, '07-lejuan.png');
      
      const afterCount = queryDB(`SELECT COUNT(*) FROM lejuan_records`);
      const lejuanSuccess = afterCount > beforeCount;
      
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
    await currentPage.close();
    
    // =====================
    // 测试8: 下班打卡
    // =====================
    console.log('[测试8] 下班打卡...');
    currentPage = await browser.newPage();
    
    try {
      const beforeCount = queryDB(`SELECT COUNT(*) FROM attendance_records WHERE type = 'clock_out'`);
      console.log('下班打卡前记录数:', beforeCount);
      
      await currentPage.goto(`${BASE_URL}/#/pages/member/center`, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      
      // 查找上下班入口
      const allLinks = await currentPage.$$('a, button, [class*="menu"], [class*="item"]');
      for (const link of allLinks) {
        const text = await currentPage.evaluate(el => el.textContent || '', link);
        if (text.includes('上下班') || text.includes('打卡')) {
          await link.click();
          console.log('进入打卡页面');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(currentPage, '08-1-clock.png');
      
      // 下班打卡
      const clockBtns = await currentPage.$$('button');
      for (const btn of clockBtns) {
        const text = await currentPage.evaluate(el => el.textContent || '', btn);
        if (text.includes('下班打卡') || text.includes('下班')) {
          await btn.click();
          console.log('点击下班打卡');
          await wait(2000);
          break;
        }
      }
      
      await screenshot(currentPage, '08-clockout.png');
      
      const afterCount = queryDB(`SELECT COUNT(*) FROM attendance_records WHERE type = 'clock_out'`);
      const clockOutSuccess = afterCount > beforeCount;
      
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
    await currentPage.close();
    
  } finally {
    // 关闭所有测试创建的标签页
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
      path.join(SCREENSHOT_DIR, 'results.json'),
      JSON.stringify(results, null, 2)
    );
    console.log(`\n结果已保存到 ${SCREENSHOT_DIR}/results.json`);
  }
}

main().catch(console.error);