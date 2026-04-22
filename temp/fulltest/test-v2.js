const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');

const SCREENSHOT_DIR = '/TG/temp/fulltest';
const DB_PATH = '/TG/tgservice/db/tgservice.db';
const PHONE = '18775703862';
const CODE = '888888';
const COACH_NO = '10002';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

function sqliteQuery(sql) {
  try {
    return execSync(`sqlite3 ${DB_PATH} "${sql}"`, { encoding: 'utf8' }).trim();
  } catch (e) {
    console.log('SQLite错误:', e.message);
    return '';
  }
}

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
    
    // 发送验证码并登录
    execSync(`curl -s -X POST "http://127.0.0.1:8088/api/sms/send" -H "Content-Type: application/json" -d '{"phone":"${PHONE}"}'`);
    await wait(1000);
    
    const loginRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/member/login-sms" -H "Content-Type: application/json" -d '{"phone":"${PHONE}","code":"${CODE}"}'`, { encoding: 'utf8' });
    const loginData = JSON.parse(loginRes);
    
    if (!loginData.success || !loginData.token) {
      console.log('❌ API登录失败:', loginRes);
      results.push({ test: '登录测试', status: 'FAIL', detail: loginRes });
      await page.close();
      return;
    }
    
    const TOKEN = loginData.token;
    console.log('✅ API登录成功, Token获取成功');
    
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
    
    // 设置token (uni-app包装格式)
    const memberInfoWrapped = JSON.stringify({type:'object',data:{memberNo:loginData.member.memberNo,phone:PHONE,name:loginData.member.name}});
    const coachInfoWrapped = JSON.stringify({type:'object',data:{coachNo:loginData.coachInfo.coachNo,employeeId:loginData.coachInfo.employeeId,stageName:loginData.coachInfo.stageName,phone:PHONE}});
    
    await page.evaluate((t, m, c) => {
      localStorage.setItem('memberToken', t);
      localStorage.setItem('memberInfo', m);
      localStorage.setItem('coachToken', t);
      localStorage.setItem('coachInfo', c);
      localStorage.setItem('adminToken', t); // 同时设置adminToken
    }, TOKEN, memberInfoWrapped, coachInfoWrapped);
    
    console.log('✅ Token已设置');
    
    // 导航到会员中心
    await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2' });
    await wait(5000);
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-login-success.png`, fullPage: true });
    
    const text = await page.evaluate(() => document.body.innerText);
    if (text.includes('陆飞') || text.includes('陆')) {
      console.log('✅ 登录成功，显示用户名');
      results.push({ test: '登录测试', status: 'PASS', detail: '显示陆飞用户名' });
    } else {
      console.log('❌ 页面未显示用户名');
      results.push({ test: '登录测试', status: 'FAIL', detail: '未显示陆飞用户名' });
    }

    // ========== 2. 上班打卡测试 ==========
    console.log('\n=== 测试2: 上班打卡 ===');
    
    const clockInBefore = parseInt(sqliteQuery(`SELECT COUNT(*) FROM attendance_records WHERE coach_no=${COACH_NO} AND clock_in_time IS NOT NULL`)) || 0;
    console.log('上班记录数(前):', clockInBefore);
    
    // 调用打卡API
    const clockInRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/coaches/v2/${COACH_NO}/clock-in" -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" -d '{"clock_in_photo":"test.jpg"}'`, { encoding: 'utf8' });
    console.log('打卡响应:', clockInRes);
    
    await wait(1000);
    
    const clockInAfter = parseInt(sqliteQuery(`SELECT COUNT(*) FROM attendance_records WHERE coach_no=${COACH_NO} AND clock_in_time IS NOT NULL`)) || 0;
    console.log('上班记录数(后):', clockInAfter);
    
    if (clockInAfter > clockInBefore) {
      console.log('✅ 上班打卡成功');
      results.push({ test: '上班打卡', status: 'PASS', detail: `记录数从${clockInBefore}增加到${clockInAfter}` });
    } else {
      console.log('❌ 上班打卡失败:', clockInRes);
      results.push({ test: '上班打卡', status: 'FAIL', detail: clockInRes.substring(0,100) });
    }
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-clockin.png`, fullPage: true });

    // ========== 3. 上桌单测试 ==========
    console.log('\n=== 测试3: 上桌单 ===');
    
    const tableInBefore = parseInt(sqliteQuery(`SELECT COUNT(*) FROM table_action_orders WHERE order_type='上桌单' AND coach_no='${COACH_NO}'`)) || 0;
    console.log('上桌记录数(前):', tableInBefore);
    
    const tableInRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/table-action-orders" -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" -d '{"table_no":"雀1","coach_no":"${COACH_NO}","order_type":"上桌单","action_category":"普通课","stage_name":"陆飞"}'`, { encoding: 'utf8' });
    console.log('上桌响应:', tableInRes);
    
    await wait(1000);
    
    const tableInAfter = parseInt(sqliteQuery(`SELECT COUNT(*) FROM table_action_orders WHERE order_type='上桌单' AND coach_no='${COACH_NO}'`)) || 0;
    console.log('上桌记录数(后):', tableInAfter);
    
    if (tableInAfter > tableInBefore) {
      console.log('✅ 上桌单成功');
      results.push({ test: '上桌单', status: 'PASS', detail: `记录数从${tableInBefore}增加到${tableInAfter}` });
    } else {
      console.log('❌ 上桌单失败:', tableInRes);
      results.push({ test: '上桌单', status: 'FAIL', detail: tableInRes.substring(0,100) });
    }
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-tablein.png`, fullPage: true });

    // ========== 4. 下桌单测试 ==========
    console.log('\n=== 测试4: 下桌单 ===');
    
    const tableOutBefore = parseInt(sqliteQuery(`SELECT COUNT(*) FROM table_action_orders WHERE order_type='下桌单' AND coach_no='${COACH_NO}'`)) || 0;
    console.log('下桌记录数(前):', tableOutBefore);
    
    const tableOutRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/table-action-orders" -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" -d '{"table_no":"雀1","coach_no":"${COACH_NO}","order_type":"下桌单","stage_name":"陆飞"}'`, { encoding: 'utf8' });
    console.log('下桌响应:', tableOutRes);
    
    await wait(1000);
    
    const tableOutAfter = parseInt(sqliteQuery(`SELECT COUNT(*) FROM table_action_orders WHERE order_type='下桌单' AND coach_no='${COACH_NO}'`)) || 0;
    console.log('下桌记录数(后):', tableOutAfter);
    
    if (tableOutAfter > tableOutBefore) {
      console.log('✅ 下桌单成功');
      results.push({ test: '下桌单', status: 'PASS', detail: `记录数从${tableOutBefore}增加到${tableOutAfter}` });
    } else {
      console.log('❌ 下桌单失败:', tableOutRes);
      results.push({ test: '下桌单', status: 'FAIL', detail: tableOutRes.substring(0,100) });
    }
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-tableout.png`, fullPage: true });

    // ========== 5. 乐捐报备测试 ==========
    console.log('\n=== 测试5: 乐捐报备 ===');
    
    const lejuanBefore = parseInt(sqliteQuery(`SELECT COUNT(*) FROM lejuan_records WHERE coach_no='${COACH_NO}'`)) || 0;
    console.log('乐捐记录数(前):', lejuanBefore);
    
    const lejuanRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/lejuan-records" -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" -d '{"coach_no":"${COACH_NO}","employee_id":"2","stage_name":"陆飞","scheduled_start_time":"2026-04-23 08:00:00","remark":"测试乐捐"}'`, { encoding: 'utf8' });
    console.log('乐捐响应:', lejuanRes);
    
    await wait(1000);
    
    const lejuanAfter = parseInt(sqliteQuery(`SELECT COUNT(*) FROM lejuan_records WHERE coach_no='${COACH_NO}'`)) || 0;
    console.log('乐捐记录数(后):', lejuanAfter);
    
    if (lejuanAfter > lejuanBefore) {
      console.log('✅ 乐捐报备成功');
      results.push({ test: '乐捐报备', status: 'PASS', detail: `记录数从${lejuanBefore}增加到${lejuanAfter}` });
    } else {
      console.log('❌ 乐捐报备失败:', lejuanRes);
      results.push({ test: '乐捐报备', status: 'FAIL', detail: lejuanRes.substring(0,100) });
    }
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-lejuan.png`, fullPage: true });

    // ========== 6. 下班打卡测试 ==========
    console.log('\n=== 测试6: 下班打卡 ===');
    
    const clockOutBefore = parseInt(sqliteQuery(`SELECT COUNT(*) FROM attendance_records WHERE coach_no=${COACH_NO} AND clock_out_time IS NOT NULL`)) || 0;
    console.log('下班记录数(前):', clockOutBefore);
    
    const clockOutRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/coaches/v2/${COACH_NO}/clock-out" -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}"`, { encoding: 'utf8' });
    console.log('下班响应:', clockOutRes);
    
    await wait(1000);
    
    const clockOutAfter = parseInt(sqliteQuery(`SELECT COUNT(*) FROM attendance_records WHERE coach_no=${COACH_NO} AND clock_out_time IS NOT NULL`)) || 0;
    console.log('下班记录数(后):', clockOutAfter);
    
    if (clockOutAfter > clockOutBefore) {
      console.log('✅ 下班打卡成功');
      results.push({ test: '下班打卡', status: 'PASS', detail: `记录数从${clockOutBefore}增加到${clockOutAfter}` });
    } else {
      console.log('❌ 下班打卡失败:', clockOutRes);
      results.push({ test: '下班打卡', status: 'FAIL', detail: clockOutRes.substring(0,100) });
    }
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-clockout.png`, fullPage: true });

    // ========== 完成 ==========
    console.log('\n\n========== 测试完成 ==========');
    console.log('测试结果:');
    results.forEach(r => {
      console.log(`  ${r.status === 'PASS' ? '✅' : '❌'} ${r.test}: ${r.detail}`);
    });
    
    fs.writeFileSync(`${SCREENSHOT_DIR}/results.json`, JSON.stringify(results, null, 2));
    
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    console.log(`\n总计: ${passCount} 通过, ${failCount} 失败`);
    
  } catch (e) {
    console.error('错误:', e.message);
    results.push({ test: '异常', status: 'FAIL', detail: e.message });
    fs.writeFileSync(`${SCREENSHOT_DIR}/results.json`, JSON.stringify(results, null, 2));
  }
  
  await page.close();
  console.log('标签页已关闭');
}

runTests();