const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');

const SCREENSHOT_DIR = '/TG/temp/fulltest'; // 截图保存目录
const DB_PATH = '/TG/tgservice/db/tgservice.db';
const PHONE = '18775703862';
const CODE = '888888';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// SQLite查询函数
function sqliteQuery(sql) {
  try {
    const result = execSync(`sqlite3 ${DB_PATH} "${sql}"`, { encoding: 'utf8' });
    return result.trim();
  } catch (e) {
    return '';
  }
}

// 测试结果记录
const results = [];

async function runTests() {
  console.log('连接 Chrome...');
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });

  const page = await browser.newPage();
  
  try {
    // ========== 1. 登录测试 ==========
    console.log('\n=== 测试1: 登录 ===');
    
    // 先发送验证码并登录获取token
    execSync(`curl -s -X POST "http://127.0.0.1:8088/api/sms/send" -H "Content-Type: application/json" -d '{"phone":"${PHONE}"}'`);
    await wait(1000);
    const loginRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/member/login-sms" -H "Content-Type: application/json" -d '{"phone":"${PHONE}","code":"${CODE}"}'`, { encoding: 'utf8' });
    const loginData = JSON.parse(loginRes);
    
    if (loginData.success && loginData.token) {
      console.log('✅ API登录成功');
      
      // 打开页面并设置token
      await page.goto('http://127.0.0.1:8089', { waitUntil: 'load' });
      
      // 清除缓存
      await page.evaluate(async () => {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const r of regs) await r.unregister();
        }
        if ('caches' in window) {
          const names = await caches.keys();
          for (const n of names) await caches.delete(n);
        }
        localStorage.clear();
        sessionStorage.clear();
      });
      
      await wait(2000);
      await page.reload({ waitUntil: 'networkidle2' });
      
      // 设置localStorage (uni-app包装格式)
      const memberInfoWrapped = {type:'object',data:{memberNo:loginData.member.memberNo,phone:PHONE,name:loginData.member.name}};
      const coachInfoWrapped = {type:'object',data:{coachNo:loginData.coachInfo.coachNo,employeeId:loginData.coachInfo.employeeId,stageName:loginData.coachInfo.stageName,phone:PHONE}};
      
      await page.evaluate((t, m, c) => {
        localStorage.setItem('memberToken', t);
        localStorage.setItem('memberInfo', JSON.stringify(m));
        localStorage.setItem('coachToken', t);
        localStorage.setItem('coachInfo', JSON.stringify(c));
      }, loginData.token, memberInfoWrapped, coachInfoWrapped);
      
      console.log('✅ Token已设置');
      
      // 导航到会员中心
      await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2' });
      await wait(5000);
      
      await page.screenshot({ path: `${SCREENSHOT_DIR}/01-login-success.png`, fullPage: true });
      
      // 检查是否显示用户名
      const text = await page.evaluate(() => document.body.innerText);
      if (text.includes('陆飞')) {
        console.log('✅ 登录成功，显示用户名');
        results.push({ test: '登录测试', status: 'PASS', detail: '显示陆飞用户名' });
      } else {
        console.log('❌ 未显示用户名');
        results.push({ test: '登录测试', status: 'FAIL', detail: '未显示陆飞用户名' });
      }
    } else {
      console.log('❌ API登录失败:', loginRes);
      results.push({ test: '登录测试', status: 'FAIL', detail: loginRes });
      await page.close();
      return;
    }

    // ========== 2. 商品下单测试 ==========
    console.log('\n=== 测试2: 商品下单 ===');
    
    // 记录初始订单数
    const orderCountBefore = parseInt(sqliteQuery("SELECT COUNT(*) FROM orders")) || 0;
    console.log('订单数(前):', orderCountBefore);
    
    // 点击商品导航
    await page.evaluate(() => {
      const navItems = document.querySelectorAll('*');
      for (const item of navItems) {
        if (item.innerText?.trim() === '商品') {
          item.click();
          return;
        }
      }
    });
    
    await wait(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-1-products.png`, fullPage: true });
    
    // 选择台桌并添加商品 - 使用URL直接导航
    await page.goto('http://127.0.0.1:8089/#/pages/products/products?table=雀1', { waitUntil: 'networkidle2' });
    await wait(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-2-products-page.png`, fullPage: true });
    
    // 尝试点击添加商品
    await page.evaluate(() => {
      const addBtns = document.querySelectorAll('*');
      for (const btn of addBtns) {
        const text = btn.innerText?.trim();
        if (text === '+' || text === '添加' || text.includes('加入')) {
          btn.click();
          return;
        }
      }
    });
    
    await wait(2000);
    
    // 导航到购物车
    await page.goto('http://127.0.0.1:8089/#/pages/cart/cart', { waitUntil: 'networkidle2' });
    await wait(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-3-cart.png`, fullPage: true });
    
    // 点击提交订单
    await page.evaluate(() => {
      const btns = document.querySelectorAll('*');
      for (const btn of btns) {
        const text = btn.innerText?.trim();
        if (text === '提交订单' || text === '下单' || text === '确认') {
          btn.click();
          return;
        }
      }
    });
    
    await wait(5000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-4-after-order.png`, fullPage: true });
    
    // 验证订单数
    const orderCountAfter = parseInt(sqliteQuery("SELECT COUNT(*) FROM orders")) || 0;
    console.log('订单数(后):', orderCountAfter);
    
    if (orderCountAfter > orderCountBefore) {
      console.log('✅ 商品下单成功');
      results.push({ test: '商品下单', status: 'PASS', detail: `订单数从${orderCountBefore}增加到${orderCountAfter}` });
    } else {
      console.log('❌ 商品下单失败');
      results.push({ test: '商品下单', status: 'FAIL', detail: '订单数未增加' });
    }

    // ========== 3. 服务下单测试 ==========
    console.log('\n=== 测试3: 服务下单 ===');
    
    const serviceCountBefore = parseInt(sqliteQuery("SELECT COUNT(*) FROM service_orders")) || 0;
    console.log('服务单数(前):', serviceCountBefore);
    
    // 回到会员中心
    await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2' });
    await wait(3000);
    
    // 点击服务下单
    await page.evaluate(() => {
      const btns = document.querySelectorAll('*');
      for (const btn of btns) {
        if (btn.innerText?.includes('服务下单')) {
          btn.click();
          return;
        }
      }
    });
    
    await wait(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-1-service-page.png`, fullPage: true });
    
    // 直接用API创建服务单
    execSync(`curl -s -X POST "http://127.0.0.1:8088/api/service-orders" -H "Content-Type: application/json" -H "Authorization: Bearer ${loginData.token}" -d '{"table_no":"雀1","coach_no":"10002"}'`);
    await wait(1000);
    
    const serviceCountAfter = parseInt(sqliteQuery("SELECT COUNT(*) FROM service_orders")) || 0;
    console.log('服务单数(后):', serviceCountAfter);
    
    if (serviceCountAfter > serviceCountBefore) {
      console.log('✅ 服务下单成功');
      results.push({ test: '服务下单', status: 'PASS', detail: `服务单数从${serviceCountBefore}增加到${serviceCountAfter}` });
    } else {
      console.log('❌ 服务下单失败');
      results.push({ test: '服务下单', status: 'FAIL', detail: '服务单数未增加' });
    }

    // ========== 4. 上班打卡测试 ==========
    console.log('\n=== 测试4: 上班打卡 ===');
    
    const clockInCountBefore = parseInt(sqliteQuery("SELECT COUNT(*) FROM attendance_records WHERE coach_no=10002 AND clock_in_time IS NOT NULL")) || 0;
    console.log('打卡记录数(前):', clockInCountBefore);
    
    // 直接用API打卡
    execSync(`curl -s -X POST "http://127.0.0.1:8088/api/coaches/v2/10002/clock-in" -H "Content-Type: application/json" -H "Authorization: Bearer ${loginData.token}" -d '{"photo_url":"test.jpg"}'`);
    await wait(1000);
    
    const clockInCountAfter = parseInt(sqliteQuery("SELECT COUNT(*) FROM attendance_records WHERE coach_no=10002 AND clock_in_time IS NOT NULL")) || 0;
    console.log('打卡记录数(后):', clockInCountAfter);
    
    if (clockInCountAfter > clockInCountBefore) {
      console.log('✅ 上班打卡成功');
      results.push({ test: '上班打卡', status: 'PASS', detail: `打卡记录数从${clockInCountBefore}增加到${clockInCountAfter}` });
    } else {
      console.log('❌ 上班打卡失败');
      results.push({ test: '上班打卡', status: 'FAIL', detail: '打卡记录数未增加' });
    }
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-clockin.png`, fullPage: true });

    // ========== 5. 上桌单测试 ==========
    console.log('\n=== 测试5: 上桌单 ===');
    
    const tableInCountBefore = parseInt(sqliteQuery("SELECT COUNT(*) FROM table_action_orders WHERE action='上桌' AND coach_no=10002")) || 0;
    console.log('上桌记录数(前):', tableInCountBefore);
    
    // 直接用API创建上桌单
    execSync(`curl -s -X POST "http://127.0.0.1:8088/api/table-action-orders" -H "Content-Type: application/json" -H "Authorization: Bearer ${loginData.token}" -d '{"table_no":"雀1","coach_no":"10002","action":"上桌"}'`);
    await wait(1000);
    
    const tableInCountAfter = parseInt(sqliteQuery("SELECT COUNT(*) FROM table_action_orders WHERE action='上桌' AND coach_no=10002")) || 0;
    console.log('上桌记录数(后):', tableInCountAfter);
    
    if (tableInCountAfter > tableInCountBefore) {
      console.log('✅ 上桌单成功');
      results.push({ test: '上桌单', status: 'PASS', detail: `上桌记录数从${tableInCountBefore}增加到${tableInCountAfter}` });
    } else {
      console.log('❌ 上桌单失败');
      results.push({ test: '上桌单', status: 'FAIL', detail: '上桌记录数未增加' });
    }
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-tablein.png`, fullPage: true });

    // ========== 6. 下桌单测试 ==========
    console.log('\n=== 测试6: 下桌单 ===');
    
    const tableOutCountBefore = parseInt(sqliteQuery("SELECT COUNT(*) FROM table_action_orders WHERE action='下桌' AND coach_no=10002")) || 0;
    console.log('下桌记录数(前):', tableOutCountBefore);
    
    // 直接用API创建下桌单
    execSync(`curl -s -X POST "http://127.0.0.1:8088/api/table-action-orders" -H "Content-Type: application/json" -H "Authorization: Bearer ${loginData.token}" -d '{"table_no":"雀1","coach_no":"10002","action":"下桌"}'`);
    await wait(1000);
    
    const tableOutCountAfter = parseInt(sqliteQuery("SELECT COUNT(*) FROM table_action_orders WHERE action='下桌' AND coach_no=10002")) || 0;
    console.log('下桌记录数(后):', tableOutCountAfter);
    
    if (tableOutCountAfter > tableOutCountBefore) {
      console.log('✅ 下桌单成功');
      results.push({ test: '下桌单', status: 'PASS', detail: `下桌记录数从${tableOutCountBefore}增加到${tableOutCountAfter}` });
    } else {
      console.log('❌ 下桌单失败');
      results.push({ test: '下桌单', status: 'FAIL', detail: '下桌记录数未增加' });
    }
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-tableout.png`, fullPage: true });

    // ========== 7. 乐捐报备测试 ==========
    console.log('\n=== 测试7: 乐捐报备 ===');
    
    const lejuanCountBefore = parseInt(sqliteQuery("SELECT COUNT(*) FROM lejuan_records WHERE coach_no=10002")) || 0;
    console.log('乐捐记录数(前):', lejuanCountBefore);
    
    // 直接用API创建乐捐记录
    execSync(`curl -s -X POST "http://127.0.0.1:8088/api/lejuan-records" -H "Content-Type: application/json" -H "Authorization: Bearer ${loginData.token}" -d '{"coach_no":"10002","amount":10,"reason":"测试乐捐"}'`);
    await wait(1000);
    
    const lejuanCountAfter = parseInt(sqliteQuery("SELECT COUNT(*) FROM lejuan_records WHERE coach_no=10002")) || 0;
    console.log('乐捐记录数(后):', lejuanCountAfter);
    
    if (lejuanCountAfter > lejuanCountBefore) {
      console.log('✅ 乐捐报备成功');
      results.push({ test: '乐捐报备', status: 'PASS', detail: `乐捐记录数从${lejuanCountBefore}增加到${lejuanCountAfter}` });
    } else {
      console.log('❌ 乐捐报备失败');
      results.push({ test: '乐捐报备', status: 'FAIL', detail: '乐捐记录数未增加' });
    }
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-lejuan.png`, fullPage: true });

    // ========== 8. 下班打卡测试 ==========
    console.log('\n=== 测试8: 下班打卡 ===');
    
    const clockOutCountBefore = parseInt(sqliteQuery("SELECT COUNT(*) FROM attendance_records WHERE coach_no=10002 AND clock_out_time IS NOT NULL")) || 0;
    console.log('下班记录数(前):', clockOutCountBefore);
    
    // 直接用API下班打卡
    execSync(`curl -s -X POST "http://127.0.0.1:8088/api/coaches/v2/10002/clock-out" -H "Content-Type: application/json" -H "Authorization: Bearer ${loginData.token}"`);
    await wait(1000);
    
    const clockOutCountAfter = parseInt(sqliteQuery("SELECT COUNT(*) FROM attendance_records WHERE coach_no=10002 AND clock_out_time IS NOT NULL")) || 0;
    console.log('下班记录数(后):', clockOutCountAfter);
    
    if (clockOutCountAfter > clockOutCountBefore) {
      console.log('✅ 下班打卡成功');
      results.push({ test: '下班打卡', status: 'PASS', detail: `下班记录数从${clockOutCountBefore}增加到${clockOutCountAfter}` });
    } else {
      console.log('❌ 下班打卡失败');
      results.push({ test: '下班打卡', status: 'FAIL', detail: '下班记录数未增加' });
    }
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-clockout.png`, fullPage: true });

    // ========== 完成总结 ==========
    console.log('\n\n========== 测试完成 ==========');
    console.log('测试结果:');
    results.forEach(r => {
      console.log(`  ${r.status === 'PASS' ? '✅' : '❌'} ${r.test}: ${r.detail}`);
    });
    
    // 保存结果
    fs.writeFileSync(`${SCREENSHOT_DIR}/results-final.json`, JSON.stringify(results, null, 2));
    
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    console.log(`\n总计: ${passCount} 通过, ${failCount} 失败`);
    
  } catch (e) {
    console.error('错误:', e.message);
    results.push({ test: '异常', status: 'FAIL', detail: e.message });
    fs.writeFileSync(`${SCREENSHOT_DIR}/results-final.json`, JSON.stringify(results, null, 2));
  }
  
  await page.close();
  console.log('\n标签页已关闭');
}

runTests();