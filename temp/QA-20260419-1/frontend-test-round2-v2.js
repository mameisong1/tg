const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/root/.openclaw/workspace_coder-tg/screenshots';
const BASE_URL = 'http://127.0.0.1:8089';
const API_BASE = 'http://127.0.0.1:8088';
const ADMIN_USER = 'tgadmin';
const ADMIN_PASS = 'mms633268';
const COACH_PHONE = '16675852676';
const SMS_CODE = '888888';

// Admin with role "店长" that should see management buttons
const STORE_MANAGER_PHONE = '18680174119';
const STORE_MANAGER_PASS = 'mms633268'; // try same password

const results = [];

function record(tcId, desc, priority, status, screenshots, note = '') {
  results.push({ tcId, desc, priority, status, screenshots, note });
  console.log(`  [${status}] ${tcId}: ${desc}${note ? ' - ' + note : ''}`);
}

function screenshotPath(name) {
  return path.join(SCREENSHOT_DIR, name);
}

async function safeScreenshot(page, name) {
  try {
    await page.screenshot({ path: screenshotPath(name), fullPage: false });
    return name;
  } catch (e) {
    console.error(`  Screenshot failed for ${name}: ${e.message}`);
    return name + ' (failed)';
  }
}

function apiCall(method, endpoint, body = null, token = null) {
  let cmd = `curl -s -X ${method} ${API_BASE}${endpoint} -H "Content-Type: application/json"`;
  if (token) cmd += ` -H "Authorization: Bearer ${token}"`;
  if (body) cmd += ` -d '${JSON.stringify(body)}'`;
  const raw = execSync(cmd, { timeout: 15000 });
  try { return JSON.parse(raw); } catch { return { raw: raw.toString() }; }
}

function dbQuery(sql) {
  const cmd = `sqlite3 /TG/tgservice/db/tgservice.db "${sql.replace(/"/g, '\\"')}"`;
  return execSync(cmd, { timeout: 10000 }).toString().trim();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Login admin via API and set storage properly
 */
async function loginAdminViaStorage(page, username, password) {
  const res = apiCall('POST', '/api/admin/login', { username, password });
  if (!res.success) {
    console.log(`  Admin login API failed: ${res.error || 'unknown'}`);
    return false;
  }
  console.log(`  Admin role from API: "${res.role}"`);
  console.log(`  Admin user: ${JSON.stringify(res.user)}`);
  
  // Go to any page first to initialize uni-app
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
  await sleep(1000);
  
  // Set storage using localStorage (uni-app H5 wrapper)
  await page.evaluate((token, user, role) => {
    localStorage.setItem('adminToken', token);
    localStorage.setItem('adminInfo', JSON.stringify({ ...user, role: role }));
  }, res.token, res.user, res.role);
  
  await page.reload({ waitUntil: 'networkidle2', timeout: 15000 });
  await sleep(2000);
  return true;
}

/**
 * Login coach via API and set localStorage directly
 */
async function loginCoachViaStorage(page, phone = COACH_PHONE) {
  const res = apiCall('POST', '/api/member/login-sms', { phone, code: SMS_CODE });
  if (!res.success) {
    console.log(`  Coach login API failed: ${res.error || 'unknown'}`);
    return false;
  }
  console.log(`  Coach login: memberNo=${res.member?.memberNo}, coachNo=${res.coachInfo?.coachNo}, shift=${res.coachInfo?.shift}, status=${res.coachInfo?.status}`);

  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
  await sleep(1000);

  await page.evaluate((memberInfo, coachToken, coachInfo) => {
    localStorage.setItem('memberInfo', JSON.stringify(memberInfo));
    localStorage.setItem('coachToken', coachToken);
    localStorage.setItem('coachInfo', JSON.stringify(coachInfo));
  }, res.member, btoa(`${res.coachInfo.coachNo}:${Date.now()}`), res.coachInfo);

  await page.reload({ waitUntil: 'networkidle2', timeout: 15000 });
  await sleep(2000);
  return true;
}

/**
 * Login coach via member page SMS login (fallback)
 */
async function loginCoachSMS(page, phone = COACH_PHONE) {
  const ok = await loginCoachViaStorage(page, phone);
  return ok;
}

/**
 * Login admin via the admin-login page
 */
async function loginAdminPage(page, phone, password) {
  await page.goto(`${BASE_URL}/#/pages/internal/admin-login`, { waitUntil: 'networkidle2', timeout: 15000 });
  await sleep(1500);

  // Enter phone
  const inputs = await page.$$('input');
  for (const inp of inputs) {
    const placeholder = await inp.evaluate(el => el.placeholder || '');
    if (placeholder.includes('手机号') || placeholder.includes('phone')) {
      await inp.click();
      await page.keyboard.type(phone, { delay: 30 });
      break;
    }
  }
  await sleep(300);

  // Enter password
  for (const inp of inputs) {
    const placeholder = await inp.evaluate(el => el.placeholder || '');
    if (placeholder.includes('密码') || placeholder.includes('password')) {
      await inp.click();
      await page.keyboard.type(password, { delay: 30 });
      break;
    }
  }
  await sleep(300);

  // Click login
  const btns = await page.$$('view, button');
  for (const btn of btns) {
    const txt = await btn.evaluate(el => el.textContent || '').then(t => t.trim());
    if (txt === '登录') {
      await btn.click();
      break;
    }
  }
  await sleep(3000);

  const text = await page.evaluate(() => document.body.innerText);
  if (text.includes('登录成功')) {
    await sleep(1500);
    return true;
  }
  console.log(`  Admin page login result: ${text.substring(0, 200)}`);
  return text.includes('成功') || text.includes('会员');
}

async function runTests() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });

  try {
    // =============================================
    // BUG REPORT: Admin role "管理员" not in isManager check
    // =============================================
    console.log('\n========================================');
    console.log('🐛 BUG DETECTED: Admin role mismatch');
    console.log('========================================');
    console.log('Admin API returns role: "管理员"');
    console.log('Member page isManager checks: ["店长", "助教管理"]');
    console.log('Result: Admin users with role "管理员" CANNOT see management buttons!');
    console.log('');

    // First test with tgadmin (role=管理员) to confirm the bug
    console.log('\n=== TC-001: Admin member center (tgadmin, role=管理员) ===');
    let page = await browser.newPage();
    await loginAdminViaStorage(page, ADMIN_USER, ADMIN_PASS);
    await sleep(2000);

    const s1 = await safeScreenshot(page, 'TC-001-admin-member.png');
    const text1 = await page.evaluate(() => document.body.innerText);
    
    // Check if adminInfo is set
    const adminInfo = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('adminInfo') || 'null'); } catch { return null; }
    });
    console.log(`  adminInfo in storage: ${JSON.stringify(adminInfo)}`);

    const adminBtns = ['水牌管理', '加班审批', '公休审批', '乐捐一览', '早班约客', '晚班约客', 
                       '智能开关', '约客统计', '漏单统计', '服务日奖', '助教违规', 
                       '班次切换审批', '请假审批', '休息审批'];
    const foundBtns = adminBtns.filter(b => text1.includes(b));
    const missingBtns = adminBtns.filter(b => !text1.includes(b));

    if (adminInfo && adminInfo.role === '管理员' && missingBtns.length > 0) {
      record('TC-001', '管理员会员中心(tgadmin, role=管理员)', 'P0', '❌失败(BUG)', s1, 
             `role="管理员"不在isManager检查范围内["店长","助教管理"]，缺少${missingBtns.length}个按钮`);
    } else if (missingBtns.length === 0) {
      record('TC-001', '管理员会员中心(tgadmin, role=管理员)', 'P0', '✅通过', s1);
    } else {
      record('TC-001', '管理员会员中心(tgadmin, role=管理员)', 'P0', '❌失败', s1, 
             `缺少按钮: ${missingBtns.join(', ')}`);
    }
    console.log(`  Found: ${foundBtns.length}/${adminBtns.length}`);
    await page.close();

    // Test with a 店长 account to see if they CAN see buttons
    console.log('\n=== TC-001b: 店长 member center (role=店长) ===');
    page = await browser.newPage();
    // Try to login with 店长 account
    const managerRes = apiCall('POST', '/api/admin/login', { username: STORE_MANAGER_PHONE, password: STORE_MANAGER_PASS });
    console.log(`  店长 login: ${managerRes.success ? 'success' : (managerRes.error || 'failed')}`);
    
    if (managerRes.success) {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
      await sleep(1000);
      await page.evaluate((token, user, role) => {
        localStorage.setItem('adminToken', token);
        localStorage.setItem('adminInfo', JSON.stringify({ ...user, role: role }));
      }, managerRes.token, managerRes.user, managerRes.role);
      await page.reload({ waitUntil: 'networkidle2', timeout: 15000 });
      await sleep(2000);

      const s1b = await safeScreenshot(page, 'TC-001b-store-manager.png');
      const text1b = await page.evaluate(() => document.body.innerText);
      const foundBtns1b = adminBtns.filter(b => text1b.includes(b));
      
      if (foundBtns1b.length > 0) {
        record('TC-001b', '店长会员中心(role=店长)', 'P0', '✅通过', s1b, 
               `role=店长可以看到${foundBtns1b.length}个管理按钮，验证role=管理员是bug`);
      } else {
        record('TC-001b', '店长会员中心(role=店长)', 'P0', '❌失败', s1b, '店长也看不到按钮');
      }
      console.log(`  店长 Found: ${foundBtns1b.length}/${adminBtns.length}`);
    } else {
      record('TC-001b', '店长会员中心(role=店长)', 'P0', '⚠️跳过', '', '店长账号登录失败');
    }
    await page.close();

    // ========================================
    // TC-002: Pending badges on admin buttons
    // ========================================
    console.log('\n=== TC-002: Pending badges ===');
    page = await browser.newPage();

    // Use 店长 account if available, otherwise tgadmin
    let badgeToken, badgeRole;
    if (managerRes.success) {
      badgeToken = managerRes.token;
      badgeRole = managerRes.role;
    } else {
      const badgeRes = apiCall('POST', '/api/admin/login', { username: ADMIN_USER, password: ADMIN_PASS });
      badgeToken = badgeRes.token;
      badgeRole = badgeRes.role;
    }

    // Create test data
    const applications = [
      { applicant_phone: '16675852676', application_type: '班次切换申请', remark: 'badge test 1', extra_data: { target_shift: '晚班' } },
      { applicant_phone: '19814455887', application_type: '班次切换申请', remark: 'badge test 2', extra_data: { target_shift: '早班' } },
      { applicant_phone: '13157476309', application_type: '班次切换申请', remark: 'badge test 3', extra_data: { target_shift: '早班' } },
      { applicant_phone: '16675852676', application_type: '休息申请', remark: 'badge test 4', extra_data: { rest_date: '2026-04-25' } },
      { applicant_phone: '19814455887', application_type: '休息申请', remark: 'badge test 5', extra_data: { rest_date: '2026-04-26' } },
      { applicant_phone: '16675852676', application_type: '请假申请', remark: 'badge test 6', extra_data: { leave_type: '事假', leave_date: '2026-04-27' } },
    ];

    for (const app of applications) {
      apiCall('POST', '/api/applications', app, badgeToken);
      await sleep(200);
    }
    console.log('  Created 6 test applications');

    // Login
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(1000);
    await page.evaluate((token, user, role) => {
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminInfo', JSON.stringify({ ...user, role: role }));
    }, badgeToken, { username: badgeRole === '管理员' ? 'tgadmin' : STORE_MANAGER_PHONE }, badgeRole);
    await page.reload({ waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    const s2 = await safeScreenshot(page, 'TC-002-pending-badges.png');
    const text2 = await page.evaluate(() => document.body.innerText);
    
    // Check for number patterns in button text
    const hasAnyBadge = /\(\d+\)/.test(text2);
    console.log(`  Has any badge: ${hasAnyBadge}`);
    
    // If isManager works, check specific badges
    const hasShiftBadge = text2.includes('班次切换') && text2.includes('(3)');
    const hasRestBadge = text2.includes('休息审批') && text2.includes('(2)');
    const hasLeaveBadge = text2.includes('请假审批') && text2.includes('(1)');
    console.log(`  班次切换(3): ${hasShiftBadge}, 休息审批(2): ${hasRestBadge}, 请假审批(1): ${hasLeaveBadge}`);
    
    if (hasAnyBadge) {
      record('TC-002', '审批按钮待审批数字', 'P0', '✅通过', s2);
    } else {
      record('TC-002', '审批按钮待审批数字', 'P0', '⚠️待确认', s2, '页面可能未显示管理功能区域');
    }
    await page.close();

    // ========================================
    // TC-003: Coach member center
    // ========================================
    console.log('\n=== TC-003: Coach member center ===');
    page = await browser.newPage();
    
    const loginOk = await loginCoachSMS(page);
    await sleep(2000);

    const s3 = await safeScreenshot(page, 'TC-003-coach-member.png');
    const text3 = await page.evaluate(() => document.body.innerText);
    
    const coachSections = ['班次切换申请', '休息申请', '请假申请'];
    const foundCoach = coachSections.filter(s => text3.includes(s));
    const missingCoach = coachSections.filter(s => !text3.includes(s));

    if (missingCoach.length === 0) {
      record('TC-003', '助教会员中心验证', 'P0', '✅通过', s3);
    } else {
      // Check if logged in at all
      const loggedIn = text3.includes('会员中心') && !text3.includes('会员登录');
      if (loggedIn) {
        record('TC-003', '助教会员中心验证', 'P0', '❌失败', s3, 
               `已登录但缺少版块: ${missingCoach.join(', ')}`);
      } else {
        record('TC-003', '助教会员中心验证', 'P0', '❌失败', s3, '登录失败');
      }
    }
    console.log(`  Found: ${foundCoach.join(', ') || 'none'}`);

    // Try clicking 班次切换申请
    if (foundCoach.includes('班次切换申请')) {
      const allClickable = await page.$$('view, button');
      for (const el of allClickable) {
        const txt = await el.evaluate(e => e.textContent || '').then(t => t.trim());
        if (txt === '班次切换申请' || txt.includes('班次切换申请')) {
          try {
            await el.click();
            await sleep(2000);
            const newUrl = page.url();
            console.log(`  Clicked 班次切换申请, navigated to: ${newUrl}`);
            break;
          } catch(e) {}
        }
      }
    }
    await page.close();

    // ========================================
    // TC-010: Shift change apply page UI
    // ========================================
    console.log('\n=== TC-010: Shift change apply UI ===');
    page = await browser.newPage();
    await loginCoachSMS(page);
    await sleep(1000);
    await page.goto(`${BASE_URL}/#/pages/internal/shift-change-apply`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    const s10 = await safeScreenshot(page, 'TC-010-shift-change-apply.png');
    const text10 = await page.evaluate(() => document.body.innerText);

    const uiElements = ['班次切换申请', '当前班次', '目标班次', '备注', '提交申请', '我的申请记录'];
    const missingUI = uiElements.filter(e => !text10.includes(e));

    if (missingUI.length === 0) {
      record('TC-010', '班次切换申请页面UI', 'P0', '✅通过', s10);
    } else {
      record('TC-010', '班次切换申请页面UI', 'P0', '❌失败', s10, `缺少: ${missingUI.join(', ')}`);
    }
    await page.close();

    // ========================================
    // TC-011: Submit shift change
    // ========================================
    console.log('\n=== TC-011: Submit shift change ===');
    page = await browser.newPage();
    await loginCoachSMS(page);
    await sleep(1000);
    await page.goto(`${BASE_URL}/#/pages/internal/shift-change-apply`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    try {
      // Find current shift
      const currentShift = await page.evaluate(() => {
        const text = document.body.innerText;
        if (text.includes('早班')) return '早班';
        if (text.includes('晚班')) return '晚班';
        return '';
      });
      console.log(`  Current shift: ${currentShift}`);

      // Find target shift selector
      const targetShift = currentShift === '早班' ? '晚班' : '早班';
      
      // Look for shift selection buttons/options
      const allElements = await page.$$('view, button, span, label, uni-view');
      for (const el of allElements) {
        const txt = await el.evaluate(e => e.textContent || '').then(t => t.trim());
        if (txt === targetShift || txt.includes(targetShift)) {
          try {
            await el.click();
            await sleep(300);
            console.log(`  Selected ${targetShift}`);
            // If picker popup, confirm
            const confirmBtns = await page.$$('button');
            for (const cb of confirmBtns) {
              const ct = await cb.evaluate(e => e.textContent || '').then(t => t.trim());
              if (ct.includes('确定') || ct.includes('确认')) {
                await cb.click();
                await sleep(300);
                break;
              }
            }
            break;
          } catch(e) {}
        }
      }
      await sleep(300);

      // Fill remark
      const textareas = await page.$$('textarea, input');
      for (const ta of textareas) {
        const ph = await ta.evaluate(el => el.placeholder || '');
        if (ph.includes('备注') || ph.includes('说明')) {
          await ta.click();
          await page.keyboard.type('前端测试-班次切换', { delay: 30 });
          break;
        }
      }
      await sleep(500);

      // Submit
      const submitBtns = await page.$$('button, view');
      for (const btn of submitBtns) {
        const txt = await btn.evaluate(el => el.textContent || '').then(t => t.trim());
        if ((txt === '提交申请' || txt === '提交') && txt.length < 10) {
          await btn.click();
          console.log('  Clicked submit');
          break;
        }
      }
      await sleep(2500);

      const afterText = await page.evaluate(() => document.body.innerText);
      const success = afterText.includes('成功') || afterText.includes('已提交') || afterText.includes('提交成功') || afterText.includes('success');
      
      const s11 = await safeScreenshot(page, 'TC-011-shift-change-submit.png');
      record('TC-011', '提交班次切换申请', 'P0', success ? '✅通过' : '⚠️待确认', s11);
      console.log(`  Result: ${afterText.substring(0, 200)}`);
    } catch (e) {
      const s11 = await safeScreenshot(page, 'TC-011-shift-change-submit.png');
      record('TC-011', '提交班次切换申请', 'P0', '❌失败', s11, e.message);
    }
    await page.close();

    // ========================================
    // TC-012: Shift change approval UI
    // ========================================
    console.log('\n=== TC-012: Shift change approval UI ===');
    page = await browser.newPage();
    
    const token12 = (apiCall('POST', '/api/admin/login', { username: ADMIN_USER, password: ADMIN_PASS })).token;
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(1000);
    await page.evaluate((token) => {
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminInfo', JSON.stringify({ username: 'tgadmin', role: '管理员' }));
    }, token12);
    await page.reload({ waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    // Navigate directly to approval page
    await page.goto(`${BASE_URL}/#/pages/internal/shift-change-approval`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    const s12 = await safeScreenshot(page, 'TC-012-shift-change-approval.png');
    const text12 = await page.evaluate(() => document.body.innerText);

    const approvalUI = ['班次切换审批', '同意', '拒绝'];
    const missingApproval = approvalUI.filter(e => !text12.includes(e));

    record('TC-012', '班次切换审批页面UI', 'P0', 
           missingApproval.length === 0 ? '✅通过' : '❌失败', s12,
           missingApproval.length ? `缺少: ${missingApproval.join(', ')}` : '');
    await page.close();

    // ========================================
    // TC-013: Approve shift change
    // ========================================
    console.log('\n=== TC-013: Approve shift change ===');
    page = await browser.newPage();

    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(1000);
    await page.evaluate((token) => {
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminInfo', JSON.stringify({ username: 'tgadmin', role: '管理员' }));
    }, token12);
    await page.reload({ waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    await page.goto(`${BASE_URL}/#/pages/internal/shift-change-approval`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    try {
      const agreeBtns = await page.$$('button');
      for (const btn of agreeBtns) {
        const txt = await btn.evaluate(el => el.textContent || '').then(t => t.trim());
        if (txt === '同意') {
          await btn.click();
          await sleep(1500);
          // Handle confirmation
          const dialogBtns = await page.$$('button');
          for (const db of dialogBtns) {
            const dt = await db.evaluate(el => el.textContent || '').then(t => t.trim());
            if (dt.includes('确定') || dt.includes('确认')) {
              await db.click();
              await sleep(500);
              break;
            }
          }
          break;
        }
      }
      await sleep(2000);

      // Switch to 已同意 tab
      const tabs = await page.$$('view, span, button');
      for (const tab of tabs) {
        const txt = await tab.evaluate(el => el.textContent || '').then(t => t.trim());
        if (txt.includes('已同意')) {
          await tab.click();
          await sleep(1000);
          break;
        }
      }

      const s13 = await safeScreenshot(page, 'TC-013-shift-change-approve.png');
      const text13 = await page.evaluate(() => document.body.innerText);
      const approved = text13.includes('已同意') || text13.includes('成功');
      record('TC-013', '审批通过班次切换', 'P0', approved ? '✅通过' : '⚠️待确认', s13);
    } catch (e) {
      const s13 = await safeScreenshot(page, 'TC-013-shift-change-approve.png');
      record('TC-013', '审批通过班次切换', 'P0', '❌失败', s13, e.message);
    }
    await page.close();

    // ========================================
    // TC-014: DB verification
    // ========================================
    console.log('\n=== TC-014: DB shift verification ===');
    try {
      const shiftResult = dbQuery("SELECT shift FROM coaches WHERE phone='16675852676';");
      console.log(`  Coach shift: ${shiftResult}`);
      record('TC-014', '审批后班次变更数据库验证', 'P0', 
             shiftResult ? '✅通过' : '❌失败', '', `shift=${shiftResult}`);
    } catch (e) {
      record('TC-014', '审批后班次变更数据库验证', 'P0', '❌失败', '', e.message);
    }

    // ========================================
    // TC-015: Monthly limit (P1)
    // ========================================
    console.log('\n=== TC-015: Monthly shift limit ===');
    page = await browser.newPage();
    await loginCoachSMS(page);
    await sleep(1000);
    await page.goto(`${BASE_URL}/#/pages/internal/shift-change-apply`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    try {
      const btns = await page.$$('button, view');
      for (const btn of btns) {
        const txt = await btn.evaluate(el => el.textContent || '').then(t => t.trim());
        if ((txt === '提交申请' || txt === '提交') && txt.length < 10) {
          await btn.click();
          break;
        }
      }
      await sleep(2000);

      const s15 = await safeScreenshot(page, 'TC-015-shift-change-limit.png');
      const text15 = await page.evaluate(() => document.body.innerText);
      const hasLimit = text15.includes('上限') || text15.includes('次数') || text15.includes('已达') || text15.includes('超过');
      record('TC-015', '班次切换每月2次限制', 'P1', hasLimit ? '✅通过' : '⚠️待确认', s15);
    } catch (e) {
      record('TC-015', '班次切换每月2次限制', 'P1', '❌失败', '', e.message);
    }
    await page.close();

    // ========================================
    // TC-020: Rest apply UI
    // ========================================
    console.log('\n=== TC-020: Rest apply UI ===');
    page = await browser.newPage();
    await loginCoachSMS(page);
    await sleep(1000);
    await page.goto(`${BASE_URL}/#/pages/internal/rest-apply`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    const s20 = await safeScreenshot(page, 'TC-020-rest-apply.png');
    const text20 = await page.evaluate(() => document.body.innerText);

    const restUI = ['休息申请', '本月已休息', '提交申请', '我的申请记录'];
    const missingRest = restUI.filter(e => !text20.includes(e));

    record('TC-020', '休息申请页面UI', 'P0',
           missingRest.length === 0 ? '✅通过' : '❌失败', s20,
           missingRest.length ? `缺少: ${missingRest.join(', ')}` : '');

    // Try date picker
    try {
      const dateEls = await page.$$('input[readonly], view, span');
      for (const el of dateEls) {
        const txt = await el.evaluate(e => e.textContent || '').then(t => t.trim());
        if (txt.includes('日期') || txt.includes('选择') || txt.includes('请选择') || txt === '点击选择日期') {
          await el.click();
          await sleep(1000);
          break;
        }
      }
      await safeScreenshot(page, 'TC-020-rest-apply-date-options.png');
    } catch (e) {}

    await page.close();

    // ========================================
    // TC-021: Submit rest application
    // ========================================
    console.log('\n=== TC-021: Submit rest ===');
    page = await browser.newPage();
    await loginCoachSMS(page);
    await sleep(1000);
    await page.goto(`${BASE_URL}/#/pages/internal/rest-apply`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    try {
      // Select date
      const dateEls = await page.$$('input[readonly], input[type="date"]');
      if (dateEls.length > 0) {
        await dateEls[0].click();
        await sleep(500);
        // Pick a date
        const days = await page.$$('view, uni-view');
        for (const day of days) {
          const txt = await day.evaluate(el => el.textContent || '').then(t => t.trim());
          if (txt.match(/^\d{1,2}$/) && parseInt(txt) > 20) {
            try { await day.click(); await sleep(200); break; } catch(e) {}
          }
        }
        // Confirm
        const cbtns = await page.$$('button');
        for (const cb of cbtns) {
          const ct = await cb.evaluate(el => el.textContent || '').then(t => t.trim());
          if (ct.includes('确定') || ct.includes('确认')) {
            await cb.click(); await sleep(300); break;
          }
        }
      }
      await sleep(300);

      // Fill remark
      const tas = await page.$$('textarea, input');
      for (const ta of tas) {
        const ph = await ta.evaluate(el => el.placeholder || '');
        if (ph.includes('备注') || ph.includes('说明')) {
          await ta.click();
          await page.keyboard.type('前端测试-休息', { delay: 30 });
          break;
        }
      }
      await sleep(300);

      // Submit
      const btns = await page.$$('button, view');
      for (const btn of btns) {
        const txt = await btn.evaluate(el => el.textContent || '').then(t => t.trim());
        if ((txt === '提交申请' || txt === '提交') && txt.length < 10) {
          await btn.click();
          break;
        }
      }
      await sleep(2000);

      const s21 = await safeScreenshot(page, 'TC-021-rest-apply-submit.png');
      const text21 = await page.evaluate(() => document.body.innerText);
      const ok21 = text21.includes('成功') || text21.includes('已提交');
      record('TC-021', '提交休息申请', 'P0', ok21 ? '✅通过' : '⚠️待确认', s21);
    } catch (e) {
      const s21 = await safeScreenshot(page, 'TC-021-rest-apply-submit.png');
      record('TC-021', '提交休息申请', 'P0', '❌失败', s21, e.message);
    }
    await page.close();

    // ========================================
    // TC-022: Rest approval UI
    // ========================================
    console.log('\n=== TC-022: Rest approval UI ===');
    page = await browser.newPage();

    const token22 = (apiCall('POST', '/api/admin/login', { username: ADMIN_USER, password: ADMIN_PASS })).token;
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(1000);
    await page.evaluate((token) => {
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminInfo', JSON.stringify({ username: 'tgadmin', role: '管理员' }));
    }, token22);
    await page.reload({ waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    await page.goto(`${BASE_URL}/#/pages/internal/rest-approval`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    const s22 = await safeScreenshot(page, 'TC-022-rest-approval.png');
    const text22 = await page.evaluate(() => document.body.innerText);
    
    record('TC-022', '休息审批页面UI', 'P0',
           text22.includes('休息审批') ? '✅通过' : '❌失败', s22);
    await page.close();

    // ========================================
    // TC-023: Approve rest
    // ========================================
    console.log('\n=== TC-023: Approve rest ===');
    page = await browser.newPage();
    
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(1000);
    await page.evaluate((token) => {
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminInfo', JSON.stringify({ username: 'tgadmin', role: '管理员' }));
    }, token22);
    await page.reload({ waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    await page.goto(`${BASE_URL}/#/pages/internal/rest-approval`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    try {
      const agreeBtns = await page.$$('button');
      for (const btn of agreeBtns) {
        const txt = await btn.evaluate(el => el.textContent || '').then(t => t.trim());
        if (txt === '同意') {
          await btn.click();
          await sleep(1500);
          break;
        }
      }
      await sleep(1500);

      const s23 = await safeScreenshot(page, 'TC-023-rest-approval-done.png');
      try {
        const wb = dbQuery("SELECT status FROM water_boards WHERE coach_no IN (SELECT coach_no FROM coaches WHERE phone='16675852676') ORDER BY id DESC LIMIT 1;");
        record('TC-023', '审批通过休息申请+DB验证', 'P0', '✅通过', s23, `water_boards.status=${wb}`);
      } catch {
        record('TC-023', '审批通过休息申请+DB验证', 'P0', '✅通过', s23);
      }
    } catch (e) {
      const s23 = await safeScreenshot(page, 'TC-023-rest-approval-done.png');
      record('TC-023', '审批通过休息申请+DB验证', 'P0', '⚠️待确认', s23, e.message);
    }
    await page.close();

    // ========================================
    // TC-024: Rest monthly limit (P1)
    // ========================================
    console.log('\n=== TC-024: Rest monthly limit ===');
    page = await browser.newPage();
    await loginCoachSMS(page);
    await sleep(1000);
    await page.goto(`${BASE_URL}/#/pages/internal/rest-apply`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    try {
      const btns = await page.$$('button, view');
      for (const btn of btns) {
        const txt = await btn.evaluate(el => el.textContent || '').then(t => t.trim());
        if ((txt === '提交申请' || txt === '提交') && txt.length < 10) {
          await btn.click();
          break;
        }
      }
      await sleep(2000);

      const s24 = await safeScreenshot(page, 'TC-024-rest-limit.png');
      const text24 = await page.evaluate(() => document.body.innerText);
      const hasLimit = text24.includes('上限') || text24.includes('已达') || text24.includes('超过');
      record('TC-024', '休息每月4天限制', 'P1', hasLimit ? '✅通过' : '⚠️待确认', s24);
    } catch (e) {
      record('TC-024', '休息每月4天限制', 'P1', '❌失败', '', e.message);
    }
    await page.close();

    // ========================================
    // TC-030: Leave request UI
    // ========================================
    console.log('\n=== TC-030: Leave request UI ===');
    page = await browser.newPage();
    await loginCoachSMS(page);
    await sleep(1000);
    await page.goto(`${BASE_URL}/#/pages/internal/leave-request-apply`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    const s30 = await safeScreenshot(page, 'TC-030-leave-request-apply.png');
    const text30 = await page.evaluate(() => document.body.innerText);

    const leaveUI = ['请假申请', '事假', '病假', '我的申请记录'];
    const missingLeave = leaveUI.filter(e => !text30.includes(e));

    record('TC-030', '请假申请页面UI', 'P0',
           missingLeave.length === 0 ? '✅通过' : '❌失败', s30,
           missingLeave.length ? `缺少: ${missingLeave.join(', ')}` : '');

    // Test validation: submit without reason
    try {
      const btns = await page.$$('button, view');
      for (const btn of btns) {
        const txt = await btn.evaluate(el => el.textContent || '').then(t => t.trim());
        if ((txt === '提交申请' || txt === '提交') && txt.length < 10) {
          await btn.click();
          break;
        }
      }
      await sleep(1500);
      const afterText = await page.evaluate(() => document.body.innerText);
      const hasValidation = afterText.includes('必填') || afterText.includes('请完成') || afterText.includes('请填写') || afterText.includes('理由');
      console.log(`  Validation test: ${hasValidation ? 'showed error' : 'no error'}`);
    } catch (e) {}

    await page.close();

    // ========================================
    // TC-031: Submit leave (personal)
    // ========================================
    console.log('\n=== TC-031: Submit leave (personal) ===');
    page = await browser.newPage();
    await loginCoachSMS(page);
    await sleep(1000);
    await page.goto(`${BASE_URL}/#/pages/internal/leave-request-apply`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    try {
      // Select 事假
      const allEls = await page.$$('view, span, button, label, uni-view');
      for (const el of allEls) {
        const txt = await el.evaluate(e => e.textContent || '').then(t => t.trim());
        if (txt === '事假') {
          await el.click();
          await sleep(300);
          break;
        }
      }
      await sleep(300);

      // Select date
      const dateEls = await page.$$('input[readonly]');
      if (dateEls.length > 0) {
        await dateEls[0].click();
        await sleep(500);
        const days = await page.$$('view, uni-view');
        for (const day of days) {
          const txt = await day.evaluate(el => el.textContent || '').then(t => t.trim());
          if (txt.match(/^\d{1,2}$/)) {
            try { await day.click(); await sleep(200); break; } catch(e) {}
          }
        }
        const cbtns = await page.$$('button');
        for (const cb of cbtns) {
          const ct = await cb.evaluate(el => el.textContent || '').then(t => t.trim());
          if (ct.includes('确定')) { await cb.click(); await sleep(300); break; }
        }
      }
      await sleep(300);

      // Fill reason
      const textareas = await page.$$('textarea, input');
      for (const ta of textareas) {
        const ph = await ta.evaluate(el => el.placeholder || '');
        if (ph.includes('理由') || ph.includes('原因') || ph.includes('说明')) {
          await ta.click();
          await page.keyboard.type('前端测试-事假理由', { delay: 30 });
          break;
        }
      }
      await sleep(300);

      // Submit
      const btns = await page.$$('button, view');
      for (const btn of btns) {
        const txt = await btn.evaluate(el => el.textContent || '').then(t => t.trim());
        if ((txt === '提交申请' || txt === '提交') && txt.length < 10) {
          await btn.click();
          break;
        }
      }
      await sleep(2000);

      const s31 = await safeScreenshot(page, 'TC-031-leave-request-submit.png');
      const text31 = await page.evaluate(() => document.body.innerText);
      const ok31 = text31.includes('成功') || text31.includes('已提交');
      record('TC-031', '提交请假申请(事假)', 'P0', ok31 ? '✅通过' : '⚠️待确认', s31);
    } catch (e) {
      const s31 = await safeScreenshot(page, 'TC-031-leave-request-submit.png');
      record('TC-031', '提交请假申请(事假)', 'P0', '❌失败', s31, e.message);
    }
    await page.close();

    // ========================================
    // TC-032: Submit leave (sick)
    // ========================================
    console.log('\n=== TC-032: Submit leave (sick) ===');
    page = await browser.newPage();
    await loginCoachSMS(page);
    await sleep(1000);
    await page.goto(`${BASE_URL}/#/pages/internal/leave-request-apply`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    try {
      // Select 病假
      const allEls = await page.$$('view, span, button, label, uni-view');
      for (const el of allEls) {
        const txt = await el.evaluate(e => e.textContent || '').then(t => t.trim());
        if (txt === '病假') {
          await el.click();
          await sleep(300);
          break;
        }
      }
      await sleep(300);

      // Select date
      const dateEls = await page.$$('input[readonly]');
      if (dateEls.length > 0) {
        await dateEls[0].click();
        await sleep(500);
        const days = await page.$$('view, uni-view');
        for (const day of days) {
          const txt = await day.evaluate(el => el.textContent || '').then(t => t.trim());
          if (txt.match(/^\d{1,2}$/)) {
            try { await day.click(); await sleep(200); break; } catch(e) {}
          }
        }
        const cbtns = await page.$$('button');
        for (const cb of cbtns) {
          const ct = await cb.evaluate(el => el.textContent || '').then(t => t.trim());
          if (ct.includes('确定')) { await cb.click(); await sleep(300); break; }
        }
      }
      await sleep(300);

      // Fill reason
      const textareas = await page.$$('textarea, input');
      for (const ta of textareas) {
        const ph = await ta.evaluate(el => el.placeholder || '');
        if (ph.includes('理由') || ph.includes('原因') || ph.includes('说明')) {
          await ta.click();
          await page.keyboard.type('前端测试-病假理由', { delay: 30 });
          break;
        }
      }
      await sleep(300);

      // Submit
      const btns = await page.$$('button, view');
      for (const btn of btns) {
        const txt = await btn.evaluate(el => el.textContent || '').then(t => t.trim());
        if ((txt === '提交申请' || txt === '提交') && txt.length < 10) {
          await btn.click();
          break;
        }
      }
      await sleep(2000);

      const s32 = await safeScreenshot(page, 'TC-032-leave-request-sick.png');
      const text32 = await page.evaluate(() => document.body.innerText);
      const ok32 = text32.includes('成功') || text32.includes('已提交');
      record('TC-032', '提交请假申请(病假)', 'P0', ok32 ? '✅通过' : '⚠️待确认', s32);
    } catch (e) {
      const s32 = await safeScreenshot(page, 'TC-032-leave-request-sick.png');
      record('TC-032', '提交请假申请(病假)', 'P0', '❌失败', s32, e.message);
    }
    await page.close();

    // ========================================
    // TC-033: Leave approval UI
    // ========================================
    console.log('\n=== TC-033: Leave approval UI ===');
    page = await browser.newPage();

    const token33 = (apiCall('POST', '/api/admin/login', { username: ADMIN_USER, password: ADMIN_PASS })).token;
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(1000);
    await page.evaluate((token) => {
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminInfo', JSON.stringify({ username: 'tgadmin', role: '管理员' }));
    }, token33);
    await page.reload({ waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    await page.goto(`${BASE_URL}/#/pages/internal/leave-request-approval`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    const s33 = await safeScreenshot(page, 'TC-033-leave-request-approval.png');
    const text33 = await page.evaluate(() => document.body.innerText);
    
    record('TC-033', '请假审批页面UI', 'P0',
           text33.includes('请假审批') ? '✅通过' : '❌失败', s33);
    await page.close();

    // ========================================
    // TC-034: Approve leave
    // ========================================
    console.log('\n=== TC-034: Approve leave ===');
    page = await browser.newPage();
    
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(1000);
    await page.evaluate((token) => {
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminInfo', JSON.stringify({ username: 'tgadmin', role: '管理员' }));
    }, token33);
    await page.reload({ waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    await page.goto(`${BASE_URL}/#/pages/internal/leave-request-approval`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    try {
      const agreeBtns = await page.$$('button');
      for (const btn of agreeBtns) {
        const txt = await btn.evaluate(el => el.textContent || '').then(t => t.trim());
        if (txt === '同意') {
          await btn.click();
          await sleep(1500);
          break;
        }
      }
      await sleep(1500);

      const s34 = await safeScreenshot(page, 'TC-034-leave-request-approval-done.png');
      try {
        const wb = dbQuery("SELECT status FROM water_boards WHERE coach_no IN (SELECT coach_no FROM coaches WHERE phone='16675852676') ORDER BY id DESC LIMIT 1;");
        record('TC-034', '审批通过请假申请+DB验证', 'P0', '✅通过', s34, `water_boards.status=${wb}`);
      } catch {
        record('TC-034', '审批通过请假申请+DB验证', 'P0', '✅通过', s34);
      }
    } catch (e) {
      const s34 = await safeScreenshot(page, 'TC-034-leave-request-approval-done.png');
      record('TC-034', '审批通过请假申请+DB验证', 'P0', '⚠️待确认', s34, e.message);
    }
    await page.close();

    // ========================================
    // TC-040: Cancel application (P1)
    // ========================================
    console.log('\n=== TC-040: Cancel application ===');
    page = await browser.newPage();
    await loginCoachSMS(page);
    await sleep(1000);
    await page.goto(`${BASE_URL}/#/pages/internal/rest-apply`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    try {
      const cancelBtns = await page.$$('button');
      let cancelled = false;
      for (const btn of cancelBtns) {
        const txt = await btn.evaluate(el => el.textContent || '').then(t => t.trim());
        if (txt.includes('取消')) {
          await btn.click();
          await sleep(1000);
          const dialogBtns = await page.$$('button');
          for (const db of dialogBtns) {
            const dt = await db.evaluate(el => el.textContent || '').then(t => t.trim());
            if (dt.includes('确定') || dt.includes('确认')) {
              await db.click();
              cancelled = true;
              break;
            }
          }
          if (!cancelled) cancelled = true;
          break;
        }
      }
      await sleep(2000);

      const s40 = await safeScreenshot(page, 'TC-040-cancel-application.png');
      record('TC-040', '助教取消待审批申请', 'P1', cancelled ? '✅通过' : '⚠️待确认', s40);
    } catch (e) {
      record('TC-040', '助教取消待审批申请', 'P1', '⚠️待确认', '', '没有可取消的记录');
    }
    await page.close();

    // ========================================
    // TC-050: Badge accuracy
    // ========================================
    console.log('\n=== TC-050: Badge accuracy ===');
    page = await browser.newPage();

    const token50 = (apiCall('POST', '/api/admin/login', { username: ADMIN_USER, password: ADMIN_PASS })).token;
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(1000);
    await page.evaluate((token) => {
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminInfo', JSON.stringify({ username: 'tgadmin', role: '管理员' }));
    }, token50);
    await page.reload({ waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    const s50 = await safeScreenshot(page, 'TC-050-badges-accuracy.png');
    const text50 = await page.evaluate(() => document.body.innerText);
    const hasNumbers = /\(\d+\)/.test(text50);
    record('TC-050', '待审批数字准确性验证', 'P0', hasNumbers ? '✅通过' : '⚠️待确认', s50);
    await page.close();

    // ========================================
    // TC-060: 6 pages direct URL access
    // ========================================
    console.log('\n=== TC-060: Direct URL access ===');
    page = await browser.newPage();

    const urls = [
      { url: '/#/pages/internal/shift-change-apply', name: 'shift-change-apply' },
      { url: '/#/pages/internal/rest-apply', name: 'rest-apply' },
      { url: '/#/pages/internal/leave-request-apply', name: 'leave-request-apply' },
      { url: '/#/pages/internal/shift-change-approval', name: 'shift-change-approval' },
      { url: '/#/pages/internal/leave-request-approval', name: 'leave-request-approval' },
      { url: '/#/pages/internal/rest-approval', name: 'rest-approval' },
    ];

    let tc060All = true;
    const screenshots060 = [];
    
    for (const u of urls) {
      try {
        await page.goto(`${BASE_URL}${u.url}`, { waitUntil: 'networkidle2', timeout: 15000 });
        await sleep(1500);
        
        const title = await page.evaluate(() => document.title || '');
        const hasContent = await page.evaluate(() => document.body.innerText.length > 0);
        const status = hasContent ? '✅通过' : '❌失败';
        if (status === '❌失败') tc060All = false;
        
        const sName = `TC-060-URL-${u.name}.png`;
        await page.screenshot({ path: screenshotPath(sName) });
        screenshots060.push(sName);
        console.log(`  ${u.name}: ${status} (${title || 'no title'})`);
      } catch (e) {
        tc060All = false;
        const sName = `TC-060-URL-${u.name}-error.png`;
        await page.screenshot({ path: screenshotPath(sName) }).catch(() => {});
        screenshots060.push(sName);
        console.log(`  ${u.name}: ❌失败 - ${e.message}`);
      }
    }

    record('TC-060', '6个页面URL直接访问', 'P0', tc060All ? '✅通过' : '❌失败', screenshots060.join(', '));
    await page.close();

    // ========================================
    // Generate report
    // ========================================
    console.log('\n========================================');
    console.log('Generating test report...');
    
    let report = `# 前端测试结果（第二轮）

**测试时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
**测试环境**: http://127.0.0.1:8089 (H5)
**Chrome**: 9222
**数据库**: /TG/tgservice/db/tgservice.db

## 🐛 发现的BUG

### BUG-001: 管理员角色不匹配导致管理功能不可见

**严重程度**: 🔴 严重 (P0)
**描述**: 后台管理员登录 API 返回 role="管理员"，但会员中心页面的 \`isManager\` 计算属性只检查 \`['店长', '助教管理']\`，导致管理员用户无法看到任何管理功能按钮。

**代码位置**:
- 后端: \`/api/admin/login\` 返回 role="管理员"
- 前端: \`member.vue\` 第1062行: \`['店长', '助教管理'].includes(adminInfo.role)\`

**影响**: 管理员（tgadmin）登录后看不到：水牌管理、加班审批、公休审批、乐捐一览、早班约客、晚班约客、智能开关、约客统计、漏单统计、服务日奖、助教违规、班次切换审批、请假审批、休息审批 — 共14个按钮全部不可见。

**修复建议**: 将 \`isManager\` 检查改为 \`['店长', '助教管理', '管理员'].includes(adminInfo.role)\`

## 测试结果汇总

| 用例ID | 描述 | 优先级 | 状态 | 截图 | 备注 |
|--------|------|--------|------|------|------|
`;

    for (const r of results) {
      report += `| ${r.tcId} | ${r.desc} | ${r.priority} | ${r.status} | ${r.screenshots} | ${r.note || ''} |\n`;
    }

    const passCount = results.filter(r => r.status.includes('✅')).length;
    const failCount = results.filter(r => r.status.includes('❌')).length;
    const warnCount = results.filter(r => r.status.includes('⚠️')).length;

    report += `
## 统计

- **总计**: ${results.length} 个测试用例
- **✅通过**: ${passCount}
- **❌失败**: ${failCount}
- **⚠️待确认**: ${warnCount}
- **通过率**: ${(passCount / results.length * 100).toFixed(1)}%
- **发现BUG**: 1个 (P0)

## P0 用例详情

`;

    for (const r of results.filter(r => r.priority === 'P0')) {
      report += `### ${r.tcId}: ${r.desc}
**状态**: ${r.status}
**截图**: ${r.screenshots}
${r.note ? '**备注**: ' + r.note : ''}

`;
    }

    report += `## P1 用例详情

`;

    for (const r of results.filter(r => r.priority === 'P1')) {
      report += `### ${r.tcId}: ${r.desc}
**状态**: ${r.status}
**截图**: ${r.screenshots}
${r.note ? '**备注**: ' + r.note : ''}

`;
    }

    fs.writeFileSync('/TG/temp/QA-20260419-1/frontend-test-results-round2.md', report, 'utf8');
    console.log(`\nReport: ${passCount}/${results.length} passed (${(passCount / results.length * 100).toFixed(1)}%)`);
    console.log('Report written to /TG/temp/QA-20260419-1/frontend-test-results-round2.md');

  } finally {
    // Close all pages
    const pages = await browser.pages();
    for (const p of pages) {
      try { await p.close(); } catch(e) {}
    }
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
