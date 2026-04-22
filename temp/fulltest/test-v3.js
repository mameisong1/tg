const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');

const SCREENSHOT_DIR = '/TG/temp/fulltest';
const DB_PATH = '/TG/tgservice/db/tgservice.db';
const COACH_NO = '10002';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

function sqliteQuery(sql) {
  try {
    return execSync(`sqlite3 ${DB_PATH} "${sql}"`, { encoding: 'utf8' }).trim();
  } catch (e) {
    return '';
  }
}

const results = [];
let ADMIN_TOKEN = '';

async function runTests() {
  console.log('连接 Chrome...');
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });

  const page = await browser.newPage();
  
  try {
    // ========== 0. 管理员登录获取Token ==========
    console.log('\n=== 管理员登录 ===');
    
    const adminLoginRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/admin/login" -H "Content-Type: application/json" -d '{"username":"tgadmin","password":"mms633268"}'`, { encoding: 'utf8' });
    const adminData = JSON.parse(adminLoginRes);
    
    if (!adminData.success || !adminData.token) {
      console.log('❌ 管理员登录失败:', adminLoginRes);
      results.push({ test: '管理员登录', status: 'FAIL', detail: adminLoginRes });
      await page.close();
      return;
    }
    
    ADMIN_TOKEN = adminData.token;
    console.log('✅ 管理员登录成功');
    results.push({ test: '管理员登录', status: 'PASS', detail: '获取adminToken' });

    // ========== 1. 前端登录测试 ==========
    console.log('\n=== 测试1: 前端登录 ===');
    
    // 会员登录
    execSync(`curl -s -X POST "http://127.0.0.1:8088/api/sms/send" -H "Content-Type: application/json" -d '{"phone":"18775703862"}'`);
    await wait(1000);
    
    const memberLoginRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/member/login-sms" -H "Content-Type: application/json" -d '{"phone":"18775703862","code":"888888"}'`, { encoding: 'utf8' });
    const memberData = JSON.parse(memberLoginRes);
    
    if (!memberData.success) {
      console.log('❌ 会员登录失败:', memberLoginRes);
      results.push({ test: '前端登录', status: 'FAIL', detail: memberLoginRes });
    } else {
      console.log('✅ 会员API登录成功');
      
      // 设置localStorage并打开页面
      await page.goto('http://127.0.0.1:8089', { waitUntil: 'load' });
      
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
      });
      
      await wait(2000);
      await page.reload({ waitUntil: 'networkidle2' });
      
      // 设置token
      const memberInfoWrapped = JSON.stringify({type:'object',data:{memberNo:memberData.member.memberNo,phone:'18775703862',name:memberData.member.name}});
      const coachInfoWrapped = JSON.stringify({type:'object',data:{coachNo:memberData.coachInfo.coachNo,employeeId:memberData.coachInfo.employeeId,stageName:memberData.coachInfo.stageName,phone:'18775703862'}});
      
      await page.evaluate((t, m, c, a) => {
        localStorage.setItem('memberToken', t);
        localStorage.setItem('memberInfo', m);
        localStorage.setItem('coachToken', t);
        localStorage.setItem('coachInfo', c);
        localStorage.setItem('adminToken', a);
      }, memberData.token, memberInfoWrapped, coachInfoWrapped, ADMIN_TOKEN);
      
      await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2' });
      await wait(5000);
      
      await page.screenshot({ path: `${SCREENSHOT_DIR}/01-login.png`, fullPage: true });
      
      const text = await page.evaluate(() => document.body.innerText);
      if (text.includes('陆飞') || text.includes('陆')) {
        console.log('✅ 前端登录成功');
        results.push({ test: '前端登录', status: 'PASS', detail: '显示陆飞用户名' });
      } else {
        console.log('❌ 前端未显示用户名');
        results.push({ test: '前端登录', status: 'FAIL', detail: '未显示陆飞' });
      }
    }

    // ========== 2. 上班打卡测试 ==========
    console.log('\n=== 测试2: 上班打卡 ===');
    
    const clockInBefore = parseInt(sqliteQuery(`SELECT COUNT(*) FROM attendance_records WHERE coach_no=${COACH_NO} AND clock_in_time IS NOT NULL`)) || 0;
    
    const clockInRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/coaches/v2/${COACH_NO}/clock-in" -H "Content-Type: application/json" -H "Authorization: Bearer ${ADMIN_TOKEN}" -d '{"clock_in_photo":"test.jpg"}'`, { encoding: 'utf8' });
    console.log('打卡响应:', clockInRes);
    await wait(1000);
    
    const clockInAfter = parseInt(sqliteQuery(`SELECT COUNT(*) FROM attendance_records WHERE coach_no=${COACH_NO} AND clock_in_time IS NOT NULL`)) || 0;
    
    if (clockInAfter > clockInBefore) {
      console.log('✅ 上班打卡成功');
      results.push({ test: '上班打卡', status: 'PASS', detail: `记录数+1` });
    } else {
      const resData = JSON.parse(clockInRes);
      console.log('❌ 上班打卡失败:', resData.error);
      results.push({ test: '上班打卡', status: 'FAIL', detail: resData.error });
    }
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-clockin.png`, fullPage: true });

    // ========== 3. 上桌单测试 ==========
    console.log('\n=== 测试3: 上桌单 ===');
    
    const tableInBefore = parseInt(sqliteQuery(`SELECT COUNT(*) FROM table_action_orders WHERE order_type='上桌单' AND coach_no='${COACH_NO}'`)) || 0;
    
    const tableInRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/table-action-orders" -H "Content-Type: application/json" -H "Authorization: Bearer ${ADMIN_TOKEN}" -d '{"table_no":"雀1","coach_no":"${COACH_NO}","order_type":"上桌单","action_category":"普通课","stage_name":"陆飞"}'`, { encoding: 'utf8' });
    console.log('上桌响应:', tableInRes);
    await wait(1000);
    
    const tableInAfter = parseInt(sqliteQuery(`SELECT COUNT(*) FROM table_action_orders WHERE order_type='上桌单' AND coach_no='${COACH_NO}'`)) || 0;
    
    if (tableInAfter > tableInBefore) {
      console.log('✅ 上桌单成功');
      results.push({ test: '上桌单', status: 'PASS', detail: `记录数+1` });
    } else {
      const resData = JSON.parse(tableInRes);
      console.log('❌ 上桌单失败:', resData.error);
      results.push({ test: '上桌单', status: 'FAIL', detail: resData.error });
    }
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-tablein.png`, fullPage: true });

    // ========== 4. 下桌单测试 ==========
    console.log('\n=== 测试4: 下桌单 ===');
    
    const tableOutBefore = parseInt(sqliteQuery(`SELECT COUNT(*) FROM table_action_orders WHERE order_type='下桌单' AND coach_no='${COACH_NO}'`)) || 0;
    
    const tableOutRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/table-action-orders" -H "Content-Type: application/json" -H "Authorization: Bearer ${ADMIN_TOKEN}" -d '{"table_no":"雀1","coach_no":"${COACH_NO}","order_type":"下桌单","stage_name":"陆飞"}'`, { encoding: 'utf8' });
    console.log('下桌响应:', tableOutRes);
    await wait(1000);
    
    const tableOutAfter = parseInt(sqliteQuery(`SELECT COUNT(*) FROM table_action_orders WHERE order_type='下桌单' AND coach_no='${COACH_NO}'`)) || 0;
    
    if (tableOutAfter > tableOutBefore) {
      console.log('✅ 下桌单成功');
      results.push({ test: '下桌单', status: 'PASS', detail: `记录数+1` });
    } else {
      const resData = JSON.parse(tableOutRes);
      console.log('❌ 下桌单失败:', resData.error);
      results.push({ test: '下桌单', status: 'FAIL', detail: resData.error });
    }
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-tableout.png`, fullPage: true });

    // ========== 5. 乐捐报备测试 ==========
    console.log('\n=== 测试5: 乐捐报备 ===');
    
    const lejuanBefore = parseInt(sqliteQuery(`SELECT COUNT(*) FROM lejuan_records WHERE coach_no='${COACH_NO}'`)) || 0;
    
    const lejuanRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/lejuan-records" -H "Content-Type: application/json" -H "Authorization: Bearer ${ADMIN_TOKEN}" -d '{"coach_no":"${COACH_NO}","employee_id":"2","stage_name":"陆飞","scheduled_start_time":"2026-04-23 08:00:00","remark":"测试乐捐"}'`, { encoding: 'utf8' });
    console.log('乐捐响应:', lejuanRes);
    await wait(1000);
    
    const lejuanAfter = parseInt(sqliteQuery(`SELECT COUNT(*) FROM lejuan_records WHERE coach_no='${COACH_NO}'`)) || 0;
    
    if (lejuanAfter > lejuanBefore) {
      console.log('✅ 乐捐报备成功');
      results.push({ test: '乐捐报备', status: 'PASS', detail: `记录数+1` });
    } else {
      const resData = JSON.parse(lejuanRes);
      console.log('❌ 乐捐报备失败:', resData.error);
      results.push({ test: '乐捐报备', status: 'FAIL', detail: resData.error });
    }
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-lejuan.png`, fullPage: true });

    // ========== 6. 下班打卡测试 ==========
    console.log('\n=== 测试6: 下班打卡 ===');
    
    const clockOutBefore = parseInt(sqliteQuery(`SELECT COUNT(*) FROM attendance_records WHERE coach_no=${COACH_NO} AND clock_out_time IS NOT NULL`)) || 0;
    
    const clockOutRes = execSync(`curl -s -X POST "http://127.0.0.1:8088/api/coaches/v2/${COACH_NO}/clock-out" -H "Content-Type: application/json" -H "Authorization: Bearer ${ADMIN_TOKEN}"`, { encoding: 'utf8' });
    console.log('下班响应:', clockOutRes);
    await wait(1000);
    
    const clockOutAfter = parseInt(sqliteQuery(`SELECT COUNT(*) FROM attendance_records WHERE coach_no=${COACH_NO} AND clock_out_time IS NOT NULL`)) || 0;
    
    if (clockOutAfter > clockOutBefore) {
      console.log('✅ 下班打卡成功');
      results.push({ test: '下班打卡', status: 'PASS', detail: `记录数+1` });
    } else {
      const resData = JSON.parse(clockOutRes);
      console.log('❌ 下班打卡失败:', resData.error);
      results.push({ test: '下班打卡', status: 'FAIL', detail: resData.error });
    }
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-clockout.png`, fullPage: true });

    // ========== 完成总结 ==========
    console.log('\n\n========== 测试完成 ==========');
    results.forEach(r => {
      console.log(`  ${r.status === 'PASS' ? '✅' : '❌'} ${r.test}: ${r.detail}`);
    });
    
    fs.writeFileSync(`${SCREENSHOT_DIR}/results.json`, JSON.stringify(results, null, 2));
    
    const passCount = results.filter(r => r.status === 'PASS').length;
    console.log(`\n总计: ${passCount}/${results.length} 通过`);
    
  } catch (e) {
    console.error('错误:', e.message);
    results.push({ test: '异常', status: 'FAIL', detail: e.message });
    fs.writeFileSync(`${SCREENSHOT_DIR}/results.json`, JSON.stringify(results, null, 2));
  }
  
  await page.close();
}

runTests();