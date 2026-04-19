const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/root/.openclaw/workspace_coder-tg/screenshots';
const BASE_URL = 'http://127.0.0.1:8089';
const SMS_CODE = '888888';

// Helper: screenshot with label
async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`📸 Screenshot: ${name}.png`);
  return filePath;
}

// Helper: wait for page to settle
async function waitSettle(page, ms = 2000) {
  await new Promise(r => setTimeout(r, ms));
}

// Helper: login by SMS
async function loginBySms(page, phone, code = SMS_CODE) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await waitSettle(page, 1000);
  
  // Enter phone
  await page.evaluate((p) => {
    const inputs = document.querySelectorAll('input');
    for (const inp of inputs) {
      if (inp.placeholder && inp.placeholder.includes('手机号')) {
        inp.value = p;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        break;
      }
    }
  }, phone);
  await waitSettle(page, 300);
  
  // Enter code
  await page.evaluate((c) => {
    const inputs = document.querySelectorAll('input');
    for (const inp of inputs) {
      if (inp.placeholder && inp.placeholder.includes('验证码')) {
        inp.value = c;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        break;
      }
    }
  }, code);
  await waitSettle(page, 300);
  
  // Click agreement checkbox if not checked
  await page.evaluate(() => {
    const checkboxes = document.querySelectorAll('.checkbox');
    for (const cb of checkboxes) {
      if (!cb.classList.contains('checked')) {
        cb.click();
        break;
      }
    }
  });
  await waitSettle(page, 300);
  
  // Click login button
  await page.evaluate(() => {
    const loginBtn = document.querySelector('.h5-login-btn');
    if (loginBtn) loginBtn.click();
  });
  await waitSettle(page, 3000);
}

// Helper: get localStorage values
async function getStorageValues(page) {
  return await page.evaluate(() => {
    const vals = {};
    const keys = ['memberToken', 'adminToken', 'adminInfo', 'coachInfo', 'coachToken', 'memberInfo', 'lastPhone'];
    for (const key of keys) {
      try {
        vals[key] = JSON.parse(localStorage.getItem(key));
      } catch {
        vals[key] = localStorage.getItem(key);
      }
    }
    return vals;
  });
}

// Helper: get visible text content of page sections
async function getPageSections(page) {
  return await page.evaluate(() => {
    const sections = [];
    const titles = document.querySelectorAll('.section-title');
    for (const t of titles) {
      sections.push(t.textContent.trim());
    }
    return sections;
  });
}

// Helper: get button texts in a grid
async function getButtonLabels(page) {
  return await page.evaluate(() => {
    const labels = [];
    const btns = document.querySelectorAll('.internal-btn-text, .btn-label');
    for (const b of btns) {
      labels.push(b.textContent.trim());
    }
    return labels;
  });
}

// Helper: check if specific text is visible on page
async function hasText(page, text) {
  return await page.evaluate((t) => {
    return Array.from(document.querySelectorAll('*')).some(el => 
      el.textContent.includes(t) && el.children.length === 0
    );
  }, text);
}

async function main() {
  console.log('🚀 Starting frontend tests...\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const results = [];
  let page = null;

  // ============================================================
  // TC-H001: 助教身份登录 - 16675852676
  // ============================================================
  try {
    console.log('📋 TC-H001: 助教身份登录 (16675852676)');
    page = await browser.newPage();
    
    await loginBySms(page, '16675852676');
    await waitSettle(page, 2000);
    
    const storage = await getStorageValues(page);
    const sections = await getPageSections(page);
    const btnLabels = await getButtonLabels(page);
    
    console.log('  adminInfo:', JSON.stringify(storage.adminInfo));
    console.log('  coachInfo:', JSON.stringify(storage.coachInfo));
    console.log('  Sections:', sections);
    console.log('  Buttons:', btnLabels);
    
    await screenshot(page, 'TC-H001-coach-login-member-page');
    
    const hasCoachSection = sections.some(s => s.includes('助教专用'));
    const hasShiftApply = btnLabels.includes('班次切换申请');
    const hasRestApply = btnLabels.includes('休息申请');
    const hasLeaveApply = btnLabels.includes('请假申请');
    
    results.push({
      tc: 'TC-H001',
      desc: '助教身份登录会员中心',
      coachInfo: storage.coachInfo ? JSON.stringify(storage.coachInfo) : 'null',
      adminInfo: storage.adminInfo ? JSON.stringify(storage.adminInfo) : 'null',
      sections: sections.join(', '),
      hasCoachSection,
      hasShiftApply,
      hasRestApply,
      hasLeaveApply,
      status: 'completed'
    });
    
    await page.close();
    page = null;
  } catch (err) {
    console.error('  TC-H001 failed:', err.message);
    if (page) { await page.close(); page = null; }
    results.push({ tc: 'TC-H001', desc: '助教身份登录', status: 'error', error: err.message });
  }

  // ============================================================
  // TC-H002: 管理员身份登录 - tgadmin
  // ============================================================
  try {
    console.log('\n📋 TC-H002: 管理员身份登录 (tgadmin)');
    page = await browser.newPage();
    
    // Admin login uses password, not SMS
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await waitSettle(page, 1000);
    
    // Check if there's an admin login link
    const hasAdminLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, span, text, view'));
      return links.some(l => l.textContent && (l.textContent.includes('管理员') || l.textContent.includes('后台') || l.textContent.includes('admin')));
    });
    
    // Try SMS login with tgadmin phone if we can find it
    // Actually tgadmin is an admin account, let's try the admin login page
    await page.goto(BASE_URL + '/#/pages/internal/admin-login', { waitUntil: 'networkidle0', timeout: 15000 });
    await waitSettle(page, 1000);
    
    // Try to login via admin login page
    const adminLoginResult = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      const usernameInput = inputs[0];
      const passwordInput = inputs[1];
      if (usernameInput && passwordInput) {
        usernameInput.value = 'tgadmin';
        usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
        passwordInput.value = 'mms633268';
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
        const btn = document.querySelector('button, .login-btn, [class*="login"]');
        if (btn) { btn.click(); return true; }
      }
      return false;
    });
    await waitSettle(page, 3000);
    
    const storage = await getStorageValues(page);
    console.log('  adminInfo:', JSON.stringify(storage.adminInfo));
    console.log('  adminToken:', storage.adminToken ? 'exists' : 'null');
    
    await screenshot(page, 'TC-H002-admin-login-page');
    
    // If admin login page doesn't work, try going to member page
    await page.goto(BASE_URL + '/#/pages/member/member', { waitUntil: 'networkidle0', timeout: 15000 });
    await waitSettle(page, 2000);
    
    const storage2 = await getStorageValues(page);
    const sections = await getPageSections(page);
    const btnLabels = await getButtonLabels(page);
    
    console.log('  After member page - adminInfo:', JSON.stringify(storage2.adminInfo));
    console.log('  Sections:', sections);
    console.log('  Buttons:', btnLabels);
    
    await screenshot(page, 'TC-H002-admin-member-page');
    
    results.push({
      tc: 'TC-H002',
      desc: '管理员身份登录会员中心',
      adminInfo: JSON.stringify(storage2.adminInfo || storage.adminInfo),
      adminRole: (storage2.adminInfo || storage.adminInfo)?.role || 'unknown',
      sections: sections.join(', '),
      buttons: btnLabels.join(', '),
      hasShiftApproval: btnLabels.some(b => b.includes('班次切换审批')),
      hasLeaveApproval: btnLabels.some(b => b.includes('请假审批')),
      hasRestApproval: btnLabels.some(b => b.includes('休息审批')),
      status: 'completed'
    });
    
    await page.close();
    page = null;
  } catch (err) {
    console.error('  TC-H002 failed:', err.message);
    if (page) { await page.close(); page = null; }
    results.push({ tc: 'TC-H002', desc: '管理员身份登录', status: 'error', error: err.message });
  }

  // ============================================================
  // TC-H003: 18680174119 登录（用户报告账号）- 重点排查
  // ============================================================
  try {
    console.log('\n📋 TC-H003: 18680174119 登录（用户报告账号）');
    page = await browser.newPage();
    
    await loginBySms(page, '18680174119');
    await waitSettle(page, 2000);
    
    const storage = await getStorageValues(page);
    const sections = await getPageSections(page);
    const btnLabels = await getButtonLabels(page);
    
    console.log('  memberInfo:', JSON.stringify(storage.memberInfo));
    console.log('  adminInfo:', JSON.stringify(storage.adminInfo));
    console.log('  coachInfo:', JSON.stringify(storage.coachInfo));
    console.log('  adminToken:', storage.adminToken ? 'exists' : 'null');
    console.log('  coachToken:', storage.coachToken ? 'exists' : 'null');
    console.log('  Sections:', sections);
    console.log('  Buttons:', btnLabels);
    
    await screenshot(page, 'TC-H003-user186-member-page');
    
    // Check for "助教专用" section
    const hasCoachSection = sections.some(s => s.includes('助教专用'));
    const hasManageSection = sections.some(s => s.includes('管理功能'));
    const hasCommonSection = sections.some(s => s.includes('常用功能'));
    
    // Check for new application buttons
    const hasShiftApply = btnLabels.includes('班次切换申请');
    const hasRestApply = btnLabels.includes('休息申请');
    const hasLeaveApply = btnLabels.includes('请假申请');
    const hasShiftApproval = btnLabels.some(b => b.includes('班次切换审批'));
    const hasLeaveApproval = btnLabels.some(b => b.includes('请假审批'));
    const hasRestApproval = btnLabels.some(b => b.includes('休息审批'));
    
    results.push({
      tc: 'TC-H003',
      desc: '18680174119登录会员中心',
      memberInfo: JSON.stringify(storage.memberInfo),
      adminInfo: storage.adminInfo ? JSON.stringify(storage.adminInfo) : 'null',
      adminRole: storage.adminInfo?.role || 'N/A',
      coachInfo: storage.coachInfo ? JSON.stringify(storage.coachInfo) : 'null',
      coachStatus: storage.coachInfo?.status || 'N/A',
      adminToken: storage.adminToken ? 'exists' : 'null',
      coachToken: storage.coachToken ? 'exists' : 'null',
      hasCoachSection,
      hasManageSection,
      hasCommonSection,
      hasShiftApply,
      hasRestApply,
      hasLeaveApply,
      hasShiftApproval,
      hasLeaveApproval,
      hasRestApproval,
      sectionsFound: sections.join(', '),
      buttonsFound: btnLabels.join(', '),
      status: 'completed'
    });
    
    // Also check internal-home page for this user
    console.log('  Checking internal-home for 18680174119...');
    await page.goto(BASE_URL + '/#/pages/internal/internal-home', { waitUntil: 'networkidle0', timeout: 15000 });
    await waitSettle(page, 2000);
    
    const internalSections = await getPageSections(page);
    const internalBtns = await getButtonLabels(page);
    
    console.log('  Internal-home sections:', internalSections);
    console.log('  Internal-home buttons:', internalBtns);
    
    await screenshot(page, 'TC-H003-user186-internal-home');
    
    results.push({
      tc: 'TC-H003-internal',
      desc: '18680174119内部专用页面',
      sections: internalSections.join(', '),
      buttons: internalBtns.join(', '),
      hasShiftApply: internalBtns.includes('班次切换申请'),
      hasRestApply: internalBtns.includes('休息申请'),
      hasLeaveApply: internalBtns.includes('请假申请'),
      hasShiftApproval: internalBtns.some(b => b.includes('班次切换审批')),
      hasLeaveApproval: internalBtns.some(b => b.includes('请假审批')),
      hasRestApproval: internalBtns.some(b => b.includes('休息审批')),
      status: 'completed'
    });
    
    await page.close();
    page = null;
  } catch (err) {
    console.error('  TC-H003 failed:', err.message);
    if (page) { await page.close(); page = null; }
    results.push({ tc: 'TC-H003', desc: '18680174119登录', status: 'error', error: err.message });
  }

  // ============================================================
  // TC-S001: 班次切换申请页面
  // ============================================================
  try {
    console.log('\n📋 TC-S001: 班次切换申请页面');
    page = await browser.newPage();
    
    await page.goto(BASE_URL + '/#/pages/internal/shift-change-apply', { waitUntil: 'networkidle0', timeout: 15000 });
    await waitSettle(page, 2000);
    
    const pageTitle = await page.evaluate(() => {
      const h = document.querySelector('h1, .page-title, .header-title, text[class*="title"]');
      return h ? h.textContent : document.title;
    });
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    
    console.log('  Page title:', pageTitle);
    console.log('  Page text (first 500):', pageText.substring(0, 200));
    
    await screenshot(page, 'TC-S001-shift-change-apply');
    
    results.push({
      tc: 'TC-S001',
      desc: '班次切换申请页面',
      pageTitle,
      pageText: pageText.substring(0, 200),
      status: 'completed'
    });
    
    await page.close();
    page = null;
  } catch (err) {
    console.error('  TC-S001 failed:', err.message);
    if (page) { await page.close(); page = null; }
    results.push({ tc: 'TC-S001', desc: '班次切换申请页面', status: 'error', error: err.message });
  }

  // ============================================================
  // TC-R001: 休息申请页面
  // ============================================================
  try {
    console.log('\n📋 TC-R001: 休息申请页面');
    page = await browser.newPage();
    
    await page.goto(BASE_URL + '/#/pages/internal/rest-apply', { waitUntil: 'networkidle0', timeout: 15000 });
    await waitSettle(page, 2000);
    
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    
    console.log('  Page text (first 500):', pageText.substring(0, 200));
    
    await screenshot(page, 'TC-R001-rest-apply');
    
    results.push({
      tc: 'TC-R001',
      desc: '休息申请页面',
      pageText: pageText.substring(0, 200),
      status: 'completed'
    });
    
    await page.close();
    page = null;
  } catch (err) {
    console.error('  TC-R001 failed:', err.message);
    if (page) { await page.close(); page = null; }
    results.push({ tc: 'TC-R001', desc: '休息申请页面', status: 'error', error: err.message });
  }

  // ============================================================
  // TC-L001: 请假申请页面
  // ============================================================
  try {
    console.log('\n📋 TC-L001: 请假申请页面');
    page = await browser.newPage();
    
    await page.goto(BASE_URL + '/#/pages/internal/leave-request-apply', { waitUntil: 'networkidle0', timeout: 15000 });
    await waitSettle(page, 2000);
    
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    
    console.log('  Page text (first 500):', pageText.substring(0, 200));
    
    await screenshot(page, 'TC-L001-leave-request-apply');
    
    results.push({
      tc: 'TC-L001',
      desc: '请假申请页面',
      pageText: pageText.substring(0, 200),
      status: 'completed'
    });
    
    await page.close();
    page = null;
  } catch (err) {
    console.error('  TC-L001 failed:', err.message);
    if (page) { await page.close(); page = null; }
    results.push({ tc: 'TC-L001', desc: '请假申请页面', status: 'error', error: err.message });
  }

  // ============================================================
  // TC-SA001: 班次切换审批页面
  // ============================================================
  try {
    console.log('\n📋 TC-SA001: 班次切换审批页面');
    page = await browser.newPage();
    
    await page.goto(BASE_URL + '/#/pages/internal/shift-change-approval', { waitUntil: 'networkidle0', timeout: 15000 });
    await waitSettle(page, 2000);
    
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    
    console.log('  Page text (first 500):', pageText.substring(0, 200));
    
    await screenshot(page, 'TC-SA001-shift-change-approval');
    
    results.push({
      tc: 'TC-SA001',
      desc: '班次切换审批页面',
      pageText: pageText.substring(0, 200),
      status: 'completed'
    });
    
    await page.close();
    page = null;
  } catch (err) {
    console.error('  TC-SA001 failed:', err.message);
    if (page) { await page.close(); page = null; }
    results.push({ tc: 'TC-SA001', desc: '班次切换审批页面', status: 'error', error: err.message });
  }

  // ============================================================
  // TC-LA001: 请假审批页面
  // ============================================================
  try {
    console.log('\n📋 TC-LA001: 请假审批页面');
    page = await browser.newPage();
    
    await page.goto(BASE_URL + '/#/pages/internal/leave-request-approval', { waitUntil: 'networkidle0', timeout: 15000 });
    await waitSettle(page, 2000);
    
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    
    console.log('  Page text (first 500):', pageText.substring(0, 200));
    
    await screenshot(page, 'TC-LA001-leave-request-approval');
    
    results.push({
      tc: 'TC-LA001',
      desc: '请假审批页面',
      pageText: pageText.substring(0, 200),
      status: 'completed'
    });
    
    await page.close();
    page = null;
  } catch (err) {
    console.error('  TC-LA001 failed:', err.message);
    if (page) { await page.close(); page = null; }
    results.push({ tc: 'TC-LA001', desc: '请假审批页面', status: 'error', error: err.message });
  }

  // ============================================================
  // TC-RA001: 休息审批页面
  // ============================================================
  try {
    console.log('\n📋 TC-RA001: 休息审批页面');
    page = await browser.newPage();
    
    await page.goto(BASE_URL + '/#/pages/internal/rest-approval', { waitUntil: 'networkidle0', timeout: 15000 });
    await waitSettle(page, 2000);
    
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    
    console.log('  Page text (first 500):', pageText.substring(0, 200));
    
    await screenshot(page, 'TC-RA001-rest-approval');
    
    results.push({
      tc: 'TC-RA001',
      desc: '休息审批页面',
      pageText: pageText.substring(0, 200),
      status: 'completed'
    });
    
    await page.close();
    page = null;
  } catch (err) {
    console.error('  TC-RA001 failed:', err.message);
    if (page) { await page.close(); page = null; }
    results.push({ tc: 'TC-RA001', desc: '休息审批页面', status: 'error', error: err.message });
  }

  // ============================================================
  // TC-NAV001: 直接URL访问测试 - 登录后
  // ============================================================
  try {
    console.log('\n📋 TC-NAV001: 直接URL访问测试（先登录助教账号）');
    page = await browser.newPage();
    
    // First login as coach
    await loginBySms(page, '16675852676');
    await waitSettle(page, 2000);
    
    const urls = [
      { url: '/#/pages/internal/shift-change-apply', name: 'shift-change-apply' },
      { url: '/#/pages/internal/rest-apply', name: 'rest-apply' },
      { url: '/#/pages/internal/leave-request-apply', name: 'leave-request-apply' },
      { url: '/#/pages/internal/shift-change-approval', name: 'shift-change-approval' },
      { url: '/#/pages/internal/leave-request-approval', name: 'leave-request-approval' },
      { url: '/#/pages/internal/rest-approval', name: 'rest-approval' },
    ];
    
    const navResults = [];
    for (const { url, name } of urls) {
      await page.goto(BASE_URL + url, { waitUntil: 'networkidle0', timeout: 15000 });
      await waitSettle(page, 1500);
      
      const pageText = await page.evaluate(() => document.body.innerText.substring(0, 300));
      await screenshot(page, `TC-NAV001-${name}`);
      
      navResults.push({ url, name, pageText: pageText.substring(0, 200) });
      console.log(`  ${name}: ${pageText.substring(0, 100)}...`);
    }
    
    results.push({
      tc: 'TC-NAV001',
      desc: '直接URL访问测试（助教已登录）',
      urls: navResults,
      status: 'completed'
    });
    
    await page.close();
    page = null;
  } catch (err) {
    console.error('  TC-NAV001 failed:', err.message);
    if (page) { await page.close(); page = null; }
    results.push({ tc: 'TC-NAV001', desc: '直接URL访问测试', status: 'error', error: err.message });
  }

  // ============================================================
  // Write results to file
  // ============================================================
  const reportPath = '/TG/temp/QA-20260419-1/frontend-test-results.md';
  
  let report = `# 前端测试报告 - 助教申请事项 6 页面测试\n\n`;
  report += `**测试时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
  report += `**测试环境**: http://127.0.0.1:8089 (dev)\n`;
  report += `**Chrome**: ${browser.wsEndpoint()}\n\n`;
  
  report += `## 测试结果\n\n`;
  
  for (const r of results) {
    report += `### ${r.tc}: ${r.desc}\n`;
    report += `- **状态**: ${r.status}\n`;
    for (const [key, val] of Object.entries(r)) {
      if (['tc', 'desc', 'status'].includes(key)) continue;
      if (key === 'error') {
        report += `- **错误**: ${val}\n`;
      } else if (key === 'urls') {
        for (const u of val) {
          report += `- ${u.name}: ${u.pageText.substring(0, 100)}\n`;
        }
      } else {
        report += `- **${key}**: ${val}\n`;
      }
    }
    report += `\n`;
  }
  
  report += `## 关键发现\n\n`;
  
  // Find TC-H003 results
  const tc003 = results.find(r => r.tc === 'TC-H003');
  if (tc003) {
    report += `### 18680174119 账号分析\n\n`;
    report += `- coachInfo: ${tc003.coachInfo}\n`;
    report += `- adminInfo: ${tc003.adminInfo}\n`;
    report += `- adminToken: ${tc003.adminToken}\n`;
    report += `- coachToken: ${tc003.coachToken}\n`;
    report += `- 助教专用版块: ${tc003.hasCoachSection ? '✅ 可见' : '❌ 不可见'}\n`;
    report += `- 管理功能版块: ${tc003.hasManageSection ? '✅ 可见' : '❌ 不可见'}\n`;
    report += `- 常用功能版块: ${tc003.hasCommonSection ? '✅ 可见' : '❌ 不可见'}\n`;
    report += `- 班次切换申请按钮: ${tc003.hasShiftApply ? '✅ 可见' : '❌ 不可见'}\n`;
    report += `- 休息申请按钮: ${tc003.hasRestApply ? '✅ 可见' : '❌ 不可见'}\n`;
    report += `- 请假申请按钮: ${tc003.hasLeaveApply ? '✅ 可见' : '❌ 不可见'}\n`;
    report += `- 班次切换审批按钮: ${tc003.hasShiftApproval ? '✅ 可见' : '❌ 不可见'}\n`;
    report += `- 请假审批按钮: ${tc003.hasLeaveApproval ? '✅ 可见' : '❌ 不可见'}\n`;
    report += `- 休息审批按钮: ${tc003.hasRestApproval ? '✅ 可见' : '❌ 不可见'}\n`;
    report += `- 页面版块: ${tc003.sectionsFound}\n`;
    report += `- 页面按钮: ${tc003.buttonsFound}\n\n`;
  }
  
  const tc003i = results.find(r => r.tc === 'TC-H003-internal');
  if (tc003i) {
    report += `### 18680174119 内部专用页面分析\n\n`;
    report += `- 页面版块: ${tc003i.sections}\n`;
    report += `- 页面按钮: ${tc003i.buttons}\n`;
    report += `- 班次切换申请: ${tc003i.hasShiftApply ? '✅' : '❌'}\n`;
    report += `- 休息申请: ${tc003i.hasRestApply ? '✅' : '❌'}\n`;
    report += `- 请假申请: ${tc003i.hasLeaveApply ? '✅' : '❌'}\n`;
    report += `- 班次切换审批: ${tc003i.hasShiftApproval ? '✅' : '❌'}\n`;
    report += `- 请假审批: ${tc003i.hasLeaveApproval ? '✅' : '❌'}\n`;
    report += `- 休息审批: ${tc003i.hasRestApproval ? '✅' : '❌'}\n\n`;
  }
  
  report += `## 根因分析\n\n`;
  report += `根据代码分析：\n\n`;
  report += `1. **member.vue（会员中心页面）**的"助教专用"和"管理功能"版块中**没有**包含新增的6个申请/审批按钮\n`;
  report += `2. **internal-home.vue（内部专用页面）**中**已包含**全部6个新增按钮\n`;
  report += `3. 用户可能从会员中心页面看不到新按钮，因为新按钮只添加到了内部专用页面\n\n`;
  
  fs.writeFileSync(reportPath, report);
  console.log(`\n📝 Report written to: ${reportPath}`);
  
  // Close browser connection (don't disconnect, just let Chrome keep running)
  console.log('\n✅ All tests completed!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
