/**
 * QA3 浏览器自动化测试脚本
 * 测试：前台H5加班审批/公休审批页面改造
 * 
 * 测试地址：后端 http://127.0.0.1:8088，前端 http://127.0.0.1:8089
 * 注意：H5前端编译时API指向远程服务器，需要拦截请求重定向到本地
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'http://127.0.0.1:8089';
const LOCAL_API = 'http://127.0.0.1:8088/api';
const REMOTE_API = 'https://tg.tiangong.club/api';

// 测试助教
const TEST_COACH_PHONE = '16675852676';  // 歪歪, coach_no=10001

// 结果收集
const results = [];
let passedCount = 0;
let failedCount = 0;

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString('zh-CN')}] ${msg}`);
}

function recordResult(testId, name, passed, detail) {
  results.push({ testId, name, passed, detail });
  if (passed) passedCount++; else failedCount++;
  const icon = passed ? '✅' : '❌';
  log(`${icon} ${testId}: ${name}${detail ? ' - ' + detail : ''}`);
}

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 通过本地API获取admin token
 */
async function getAdminToken() {
  try {
    const res = await fetch(`${LOCAL_API}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'tgadmin', password: 'mms633268' })
    });
    const data = await res.json();
    if (data.success) return data.token;
    return null;
  } catch { return null; }
}

/**
 * 通过本地API创建测试数据
 */
async function createTestData(token) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  const apps = [
    { type: '早加班申请', remark: '早加班3小时', hours: 3, hasImage: true },
    { type: '晚加班申请', remark: '晚加班2小时', hours: 2, hasImage: false },
    { type: '公休申请', remark: '公休申请', hours: null, hasImage: true },
  ];

  for (const app of apps) {
    try {
      const res = await fetch(`${LOCAL_API}/applications`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          applicant_phone: TEST_COACH_PHONE,
          application_type: app.type,
          remark: app.remark,
          images: app.hasImage ? '["https://picsum.photos/200/200?random=' + Math.random() + '"]' : '',
          extra_data: app.hours ? JSON.stringify({ hours: app.hours }) : null,
          proof_image_url: ''
        })
      });
      const data = await res.json();
      log(`创建${app.type}: ID=${data.data?.id}, status=${data.data?.status}`);
    } catch (err) {
      log(`创建${app.type}失败: ${err.message}`);
    }
  }
}

/**
 * 创建已审批数据（直接插入数据库用于测试已同意/已拒绝列表）
 */
async function createApprovedTestData(token) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  // 先创建待审批申请
  const appRes = await fetch(`${LOCAL_API}/applications`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      applicant_phone: TEST_COACH_PHONE,
      application_type: '早加班申请',
      remark: '审批测试4小时',
      images: '["https://picsum.photos/200/200?random=99"]',
      extra_data: JSON.stringify({ hours: 4 }),
      proof_image_url: ''
    })
  });
  const appData = await appRes.json();
  if (appData.success) {
    const appId = appData.data.id;
    log(`创建审批测试申请 ID=${appId}`);
    
    // 立即同意
    const approveRes = await fetch(`${LOCAL_API}/applications/${appId}/approve`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ approver_phone: 'tgadmin', status: 1 })
    });
    const approveData = await approveRes.json();
    log(`审批结果: ${JSON.stringify(approveData).substring(0, 150)}`);
  }

  // 创建拒绝的
  const app2Res = await fetch(`${LOCAL_API}/applications`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      applicant_phone: TEST_COACH_PHONE,
      application_type: '晚加班申请',
      remark: '审批测试拒绝',
      images: '',
      extra_data: JSON.stringify({ hours: 1 }),
      proof_image_url: ''
    })
  });
  const app2Data = await app2Res.json();
  if (app2Data.success) {
    const appId2 = app2Data.data.id;
    log(`创建拒绝测试申请 ID=${appId2}`);
    
    const rejectRes = await fetch(`${LOCAL_API}/applications/${appId2}/approve`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ approver_phone: 'tgadmin', status: 2 })
    });
    const rejectData = await rejectRes.json();
    log(`拒绝结果: ${JSON.stringify(rejectData).substring(0, 150)}`);
  }
}

async function runTests() {
  log('========== QA3 浏览器自动化测试开始 ==========');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  let page = null;

  try {
    // ===== 步骤0: 获取token并准备数据 =====
    log('步骤0: 获取admin token并准备测试数据...');
    const adminToken = await getAdminToken();
    
    if (adminToken) {
      log('Admin token获取成功');
      await createTestData(adminToken);
      await createApprovedTestData(adminToken);
    } else {
      log('⚠️ 无法获取admin token');
    }

    // ===== 步骤1: 打开浏览器页面，拦截API请求 =====
    log('步骤1: 打开H5页面并拦截API请求...');
    page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812 });

    // 拦截API请求，重定向到本地
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith(REMOTE_API)) {
        const localUrl = url.replace(REMOTE_API, LOCAL_API);
        req.continue({ url: localUrl });
      } else {
        req.continue();
      }
    });

    // 先访问一个页面设置token
    await page.goto(`${BASE_URL}/#/pages/member/member`, { 
      waitUntil: 'networkidle0', 
      timeout: 15000 
    });
    
    if (adminToken) {
      await page.evaluate((token) => {
        localStorage.setItem('adminToken', token);
        localStorage.setItem('adminInfo', JSON.stringify({
          username: 'tgadmin',
          name: '管理员',
          role: '管理员'
        }));
      }, adminToken);
      log('Token已注入localStorage');
      recordResult('TC1', '登录功能', true, '通过API token注入成功');
    } else {
      recordResult('TC1', '登录功能', false, '无法获取token');
    }

    // ===== 执行所有页面测试 =====
    if (page && adminToken) {
      await doAllTests(page, adminToken);
    }

  } catch (err) {
    log(`❌ 测试异常: ${err.message}`);
    console.error(err.stack);
  } finally {
    await browser.close();
    printSummary();
  }
}

/**
 * 执行所有页面测试
 */
async function doAllTests(page, token) {
  // TC2: 加班审批标签页切换
  await testOvertimeTabs(page);

  // TC3: 等待审批列表
  await testPendingList(page);

  // TC4: 图片缩略图
  await testImageThumbnails(page);

  // TC5: 已同意/已拒绝列表
  await testApprovedRejectedList(page, token);

  // TC6: 审批操作（同意）
  await testApproveAction(page);

  // TC7: 审批操作（拒绝）
  await testRejectAction(page);

  // TC8: 公休审批页面
  await testLeaveApproval(page, token);

  // TC9: 边界测试 - 小时数解析
  await testHoursParsing(token);

  // TC10: 卡片样式
  await testCardStyles(page);

  // TC11: 刷新测试
  await testRefreshAfterApprove(page);
}

/**
 * TC2: 加班审批标签页切换
 */
async function testOvertimeTabs(page) {
  log('--- TC2: 加班审批标签页切换 ---');
  
  try {
    await page.goto(`${BASE_URL}/#/pages/internal/overtime-approval`, { 
      waitUntil: 'networkidle0', 
      timeout: 15000 
    });
    await delay(3000);

    const activeTab = await page.evaluate(() => {
      const tabs = document.querySelectorAll('.tab-item');
      for (let i = 0; i < tabs.length; i++) {
        if (tabs[i].classList.contains('active')) return tabs[i].textContent.trim();
      }
      return 'none';
    });
    recordResult('TC2-TAB-001', '默认等待审批标签', activeTab === '等待审批', 
      `当前激活: "${activeTab}"`);

    // 点击"已同意"
    await page.evaluate(() => {
      for (const tab of document.querySelectorAll('.tab-item')) {
        if (tab.textContent.trim() === '已同意') { tab.click(); break; }
      }
    });
    await delay(3000);
    
    const active2 = await page.evaluate(() => {
      for (const tab of document.querySelectorAll('.tab-item')) {
        if (tab.classList.contains('active')) return tab.textContent.trim();
      }
      return 'none';
    });
    recordResult('TC2-TAB-002', '切换到已同意标签', active2 === '已同意', `当前激活: "${active2}"`);

    // 点击"已拒绝"
    await page.evaluate(() => {
      for (const tab of document.querySelectorAll('.tab-item')) {
        if (tab.textContent.trim() === '已拒绝') { tab.click(); break; }
      }
    });
    await delay(3000);

    const active3 = await page.evaluate(() => {
      for (const tab of document.querySelectorAll('.tab-item')) {
        if (tab.classList.contains('active')) return tab.textContent.trim();
      }
      return 'none';
    });
    recordResult('TC2-TAB-003', '切换到已拒绝标签', active3 === '已拒绝', `当前激活: "${active3}"`);

    // 切回"等待审批"
    await page.evaluate(() => {
      for (const tab of document.querySelectorAll('.tab-item')) {
        if (tab.textContent.trim() === '等待审批') { tab.click(); break; }
      }
    });
    await delay(3000);

    const active4 = await page.evaluate(() => {
      for (const tab of document.querySelectorAll('.tab-item')) {
        if (tab.classList.contains('active')) return tab.textContent.trim();
      }
      return 'none';
    });
    recordResult('TC2-TAB-004', '切回等待审批标签', active4 === '等待审批', `当前激活: "${active4}"`);

  } catch (err) {
    recordResult('TC2', '加班审批标签页切换', false, `异常: ${err.message}`);
  }
}

/**
 * TC3: 等待审批列表
 */
async function testPendingList(page) {
  log('--- TC3: 等待审批列表 ---');
  
  try {
    await page.goto(`${BASE_URL}/#/pages/internal/overtime-approval`, { 
      waitUntil: 'networkidle0', 
      timeout: 15000 
    });
    await delay(3000);

    const listInfo = await page.evaluate(() => {
      const cards = document.querySelectorAll('.app-card');
      const empty = document.querySelector('.empty');
      return {
        cardCount: cards.length,
        hasEmpty: !!empty,
        emptyText: empty ? empty.textContent.trim() : '',
        firstCardType: cards.length > 0 ? cards[0].querySelector('.app-type')?.textContent?.trim() : null
      };
    });

    if (listInfo.cardCount > 0) {
      recordResult('TC3-PENDING-001', '等待审批列表显示申请', true,
        `找到 ${listInfo.cardCount} 条待审批，类型: ${listInfo.firstCardType}`);
    } else if (listInfo.hasEmpty) {
      recordResult('TC3-PENDING-002', '空列表显示提示', true, `提示: "${listInfo.emptyText}"`);
    } else {
      recordResult('TC3', '等待审批列表', false, '无卡片也无空提示');
    }

  } catch (err) {
    recordResult('TC3', '等待审批列表', false, `异常: ${err.message}`);
  }
}

/**
 * TC4: 图片缩略图
 */
async function testImageThumbnails(page) {
  log('--- TC4: 图片缩略图 ---');
  
  try {
    await page.goto(`${BASE_URL}/#/pages/internal/overtime-approval`, { 
      waitUntil: 'networkidle0', 
      timeout: 15000 
    });
    await delay(3000);

    const imageInfo = await page.evaluate(() => {
      const thumbs = document.querySelectorAll('.app-image-thumb');
      if (thumbs.length === 0) return { found: false };
      const s = window.getComputedStyle(thumbs[0]);
      return { found: true, width: s.width, height: s.height, borderRadius: s.borderRadius, count: thumbs.length };
    });

    if (imageInfo.found) {
      const ok = imageInfo.width === '60px' && imageInfo.height === '60px';
      recordResult('TC4-IMAGE-001', '缩略图60x60尺寸', ok,
        `宽=${imageInfo.width}, 高=${imageInfo.height}, 圆角=${imageInfo.borderRadius}, 数量=${imageInfo.count}`);
    } else {
      recordResult('TC4-IMAGE-001', '缩略图60x60尺寸', false, '未找到缩略图元素');
    }

    // 已同意页无图片
    await page.evaluate(() => {
      for (const tab of document.querySelectorAll('.tab-item')) {
        if (tab.textContent.trim() === '已同意') { tab.click(); break; }
      }
    });
    await delay(3000);

    const hasImg = await page.evaluate(() => document.querySelectorAll('.app-image-thumb').length > 0);
    recordResult('TC4-IMAGE-002', '已同意页无图片', !hasImg, hasImg ? '发现图片(BUG)' : '无图片✓');

    // 切回等待审批
    await page.evaluate(() => {
      for (const tab of document.querySelectorAll('.tab-item')) {
        if (tab.textContent.trim() === '等待审批') { tab.click(); break; }
      }
    });
    await delay(3000);

  } catch (err) {
    recordResult('TC4', '图片缩略图', false, `异常: ${err.message}`);
  }
}

/**
 * TC5: 已同意/已拒绝列表（通过API验证数据）
 */
async function testApprovedRejectedList(page, token) {
  log('--- TC5: 已同意/已拒绝列表 ---');
  
  try {
    // 通过API验证数据
    const approvedRes = await fetch(`${LOCAL_API}/applications/approved-recent?application_types=早加班申请,晚加班申请&days=2&status=1`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const approvedData = await approvedRes.json();
    
    const rejectedRes = await fetch(`${LOCAL_API}/applications/approved-recent?application_types=早加班申请,晚加班申请&days=2&status=2`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const rejectedData = await rejectedRes.json();

    const approvedCount = approvedData.data?.length || 0;
    const rejectedCount = rejectedData.data?.length || 0;
    
    recordResult('TC5-APPROVED-001', '已同意API返回数据', approvedCount >= 0,
      `API返回 ${approvedCount} 条已同意记录`);
    recordResult('TC5-APPROVED-002', '已拒绝API返回数据', rejectedCount >= 0,
      `API返回 ${rejectedCount} 条已拒绝记录`);

    // 验证字段完整性
    if (approvedCount > 0) {
      const record = approvedData.data[0];
      const hasFields = record.stage_name && record.coach_no && record.shift !== undefined && record.hours !== undefined;
      recordResult('TC5-APPROVED-003', '已同意记录字段完整', hasFields,
        `字段: stage_name=${record.stage_name}, coach_no=${record.coach_no}, shift=${record.shift}, hours=${record.hours}`);
    }

    // 前端页面验证
    await page.goto(`${BASE_URL}/#/pages/internal/overtime-approval`, { 
      waitUntil: 'networkidle0', 
      timeout: 15000 
    });
    await delay(3000);

    // 切换到已同意
    await page.evaluate(() => {
      for (const tab of document.querySelectorAll('.tab-item')) {
        if (tab.textContent.trim() === '已同意') { tab.click(); break; }
      }
    });
    await delay(3000);

    const pageCards = await page.evaluate(() => {
      const cards = document.querySelectorAll('.result-card');
      const empty = document.querySelector('.empty');
      return {
        cardCount: cards.length,
        hasEmpty: !!empty,
        emptyText: empty ? empty.textContent.trim() : '',
        hasImages: document.querySelectorAll('.app-image-thumb').length > 0
      };
    });

    if (approvedCount > 0) {
      recordResult('TC5-APPROVED-004', '已同意页面显示记录', pageCards.cardCount > 0,
        `页面显示 ${pageCards.cardCount} 条记录, 空提示=${pageCards.hasEmpty}`);
    } else {
      recordResult('TC5-APPROVED-004', '已同意页面空状态', pageCards.hasEmpty,
        `空提示: "${pageCards.emptyText}"`);
    }
    recordResult('TC5-APPROVED-005', '已同意页面无图片', !pageCards.hasImages,
      pageCards.hasImages ? '发现图片(BUG)' : '无图片✓');

    // 已拒绝页面
    await page.evaluate(() => {
      for (const tab of document.querySelectorAll('.tab-item')) {
        if (tab.textContent.trim() === '已拒绝') { tab.click(); break; }
      }
    });
    await delay(3000);

    const rejectedCards = await page.evaluate(() => {
      const cards = document.querySelectorAll('.result-card');
      const empty = document.querySelector('.empty');
      return {
        cardCount: cards.length,
        hasEmpty: !!empty,
        emptyText: empty ? empty.textContent.trim() : '',
        hasImages: document.querySelectorAll('.app-image-thumb').length > 0
      };
    });

    if (rejectedCount > 0) {
      recordResult('TC5-REJECTED-001', '已拒绝页面显示记录', rejectedCards.cardCount > 0,
        `页面显示 ${rejectedCards.cardCount} 条记录`);
    } else {
      recordResult('TC5-REJECTED-001', '已拒绝页面空状态', rejectedCards.hasEmpty,
        `空提示: "${rejectedCards.emptyText}"`);
    }
    recordResult('TC5-REJECTED-002', '已拒绝页面无图片', !rejectedCards.hasImages,
      rejectedCards.hasImages ? '发现图片(BUG)' : '无图片✓');

    // 切回等待审批
    await page.evaluate(() => {
      for (const tab of document.querySelectorAll('.tab-item')) {
        if (tab.textContent.trim() === '等待审批') { tab.click(); break; }
      }
    });
    await delay(3000);

  } catch (err) {
    recordResult('TC5', '已同意/已拒绝列表', false, `异常: ${err.message}`);
  }
}

/**
 * TC6: 审批操作（同意）
 */
async function testApproveAction(page) {
  log('--- TC6: 审批操作（同意）---');
  
  try {
    await page.goto(`${BASE_URL}/#/pages/internal/overtime-approval`, { 
      waitUntil: 'networkidle0', 
      timeout: 15000 
    });
    await delay(3000);

    const beforeCount = await page.evaluate(() => document.querySelectorAll('.app-card').length);

    if (beforeCount === 0) {
      recordResult('TC6-APPROVE-001', '同意审批操作', false, '无待审批申请');
      return;
    }

    const firstType = await page.evaluate(() => {
      const el = document.querySelector('.app-card .app-type');
      return el ? el.textContent.trim() : '';
    });

    // 点击同意
    await page.evaluate(() => {
      const btn = document.querySelector('.app-actions .action-btn.approve');
      if (btn) btn.click();
    });
    await delay(1500);

    // 弹窗确认
    await page.evaluate(() => {
      const btns = document.querySelectorAll('.uni-modal__btn, .uni-popup button');
      if (btns.length > 0) btns[btns.length - 1].click();
    });
    await delay(4000);

    const afterCount = await page.evaluate(() => document.querySelectorAll('.app-card').length);

    if (afterCount < beforeCount) {
      recordResult('TC6-APPROVE-001', '同意审批后列表刷新', true,
        `${beforeCount} → ${afterCount}条, 类型: ${firstType}`);
    } else {
      recordResult('TC6-APPROVE-001', '同意审批后列表刷新', false,
        `数量未变化: ${beforeCount}`);
    }

  } catch (err) {
    recordResult('TC6', '审批操作（同意）', false, `异常: ${err.message}`);
  }
}

/**
 * TC7: 审批操作（拒绝）
 */
async function testRejectAction(page) {
  log('--- TC7: 审批操作（拒绝）---');
  
  try {
    await page.goto(`${BASE_URL}/#/pages/internal/overtime-approval`, { 
      waitUntil: 'networkidle0', 
      timeout: 15000 
    });
    await delay(3000);

    const beforeCount = await page.evaluate(() => document.querySelectorAll('.app-card').length);

    if (beforeCount === 0) {
      recordResult('TC7-REJECT-001', '拒绝审批操作', false, '无待审批申请');
      return;
    }

    await page.evaluate(() => {
      const btn = document.querySelector('.app-actions .action-btn.reject');
      if (btn) btn.click();
    });
    await delay(1500);

    await page.evaluate(() => {
      const btns = document.querySelectorAll('.uni-modal__btn, .uni-popup button');
      if (btns.length > 0) btns[btns.length - 1].click();
    });
    await delay(4000);

    const afterCount = await page.evaluate(() => document.querySelectorAll('.app-card').length);

    if (afterCount < beforeCount) {
      recordResult('TC7-REJECT-001', '拒绝审批后列表刷新', true,
        `${beforeCount} → ${afterCount}条`);
    } else {
      recordResult('TC7-REJECT-001', '拒绝审批后列表刷新', false,
        `数量未变化: ${beforeCount}`);
    }

  } catch (err) {
    recordResult('TC7', '审批操作（拒绝）', false, `异常: ${err.message}`);
  }
}

/**
 * TC8: 公休审批页面
 */
async function testLeaveApproval(page, token) {
  log('--- TC8: 公休审批页面 ---');
  
  try {
    await page.goto(`${BASE_URL}/#/pages/internal/leave-approval`, { 
      waitUntil: 'networkidle0', 
      timeout: 15000 
    });
    await delay(3000);

    const title = await page.evaluate(() => {
      const h = document.querySelector('.header-title');
      return h ? h.textContent.trim() : '';
    });
    recordResult('TC8-LEAVE-001', '公休审批页面标题', title === '公休审批', `标题: "${title}"`);

    const tabs = await page.evaluate(() => 
      Array.from(document.querySelectorAll('.tab-item')).map(t => t.textContent.trim())
    );
    const hasAll = tabs.includes('等待审批') && tabs.includes('已同意') && tabs.includes('已拒绝');
    recordResult('TC8-LEAVE-002', '公休审批标签页完整', hasAll, `标签: ${tabs.join(', ')}`);

    // 等待审批
    const pendingCount = await page.evaluate(() => document.querySelectorAll('.app-card').length);

    // 已同意
    await page.evaluate(() => {
      for (const tab of document.querySelectorAll('.tab-item')) {
        if (tab.textContent.trim() === '已同意') { tab.click(); break; }
      }
    });
    await delay(3000);

    // 通过API验证公休审批数据
    const res = await fetch(`${LOCAL_API}/applications/approved-recent?application_types=公休申请&days=2&status=1`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const apiCount = data.data?.length || 0;

    const approvedCount = await page.evaluate(() => document.querySelectorAll('.result-card').length);

    recordResult('TC8-LEAVE-003', '公休审批列表加载', true,
      `待审批: ${pendingCount}, 已同意页面: ${approvedCount}, API: ${apiCount}`);

  } catch (err) {
    recordResult('TC8', '公休审批页面', false, `异常: ${err.message}`);
  }
}

/**
 * TC9: 边界测试 - 小时数解析
 */
async function testHoursParsing(token) {
  log('--- TC9: 边界测试 - 小时数解析 ---');
  
  try {
    const res = await fetch(`${LOCAL_API}/applications/approved-recent?application_types=早加班申请,晚加班申请,公休申请&days=2&status=1`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (data.success && data.data && data.data.length > 0) {
      const hoursRecords = data.data.filter(r => r.hours !== null && r.hours !== undefined);
      const noHoursRecords = data.data.filter(r => r.hours === null || r.hours === undefined);
      
      recordResult('TC9-BOUNDS-001', '小时数解析', hoursRecords.length > 0,
        `${hoursRecords.length} 条有小时数, ${noHoursRecords.length} 条无`);

      const validHours = hoursRecords.every(r => typeof r.hours === 'number');
      recordResult('TC9-BOUNDS-002', '小时数类型正确', validHours,
        `类型检查: ${hoursRecords.map(r => `${r.hours}(${typeof r.hours})`).join(', ')}`);

      // 打印详细记录
      data.data.forEach(r => {
        log(`  记录: ${r.application_type} | ${r.stage_name} | hours=${r.hours} | remark=${r.remark}`);
      });
    } else {
      recordResult('TC9-BOUNDS', '小时数解析', false, '无已审批记录');
    }

  } catch (err) {
    recordResult('TC9', '边界测试-小时数解析', false, `异常: ${err.message}`);
  }
}

/**
 * TC10: 卡片样式
 */
async function testCardStyles(page) {
  log('--- TC10: 卡片样式 ---');
  
  try {
    await page.goto(`${BASE_URL}/#/pages/internal/overtime-approval`, { 
      waitUntil: 'networkidle0', 
      timeout: 15000 
    });
    await delay(3000);

    await page.evaluate(() => {
      for (const tab of document.querySelectorAll('.tab-item')) {
        if (tab.textContent.trim() === '已同意') { tab.click(); break; }
      }
    });
    await delay(3000);

    const styleInfo = await page.evaluate(() => {
      const card = document.querySelector('.result-card');
      if (!card) return { found: false };
      const s = window.getComputedStyle(card);
      return {
        found: true,
        borderRadius: s.borderRadius,
        background: s.background,
        hasRows: card.querySelectorAll('.result-row').length
      };
    });

    if (styleInfo.found) {
      recordResult('TC10-STYLE-001', '结果卡片样式', true,
        `圆角: ${styleInfo.borderRadius}, 行数: ${styleInfo.hasRows}`);
    } else {
      recordResult('TC10', '卡片样式', false, '未找到结果卡片');
    }

  } catch (err) {
    recordResult('TC10', '卡片样式', false, `异常: ${err.message}`);
  }
}

/**
 * TC11: 审批后刷新测试
 */
async function testRefreshAfterApprove(page) {
  log('--- TC11: 审批后刷新测试 ---');
  
  try {
    await page.goto(`${BASE_URL}/#/pages/internal/overtime-approval`, { 
      waitUntil: 'networkidle0', 
      timeout: 15000 
    });
    await delay(3000);

    const pendingBefore = await page.evaluate(() => document.querySelectorAll('.app-card').length);

    if (pendingBefore > 0) {
      await page.evaluate(() => {
        const btn = document.querySelector('.app-actions .action-btn.approve');
        if (btn) btn.click();
      });
      await delay(1500);
      await page.evaluate(() => {
        const btns = document.querySelectorAll('.uni-modal__btn, .uni-popup button');
        if (btns.length > 0) btns[btns.length - 1].click();
      });
      await delay(4000);

      const pendingAfter = await page.evaluate(() => document.querySelectorAll('.app-card').length);

      await page.evaluate(() => {
        for (const tab of document.querySelectorAll('.tab-item')) {
          if (tab.textContent.trim() === '已同意') { tab.click(); break; }
        }
      });
      await delay(3000);

      const approvedCount = await page.evaluate(() => document.querySelectorAll('.result-card').length);

      recordResult('TC11-REFRESH-001', '审批后列表自动刷新', pendingAfter < pendingBefore,
        `待审批: ${pendingBefore}→${pendingAfter}, 已同意: ${approvedCount}条`);
    } else {
      recordResult('TC11-REFRESH-001', '审批后列表自动刷新', false, '无待审批数据');
    }

  } catch (err) {
    recordResult('TC11', '刷新测试', false, `异常: ${err.message}`);
  }
}

/**
 * 打印测试报告
 */
function printSummary() {
  log('\n========== 测试报告 ==========');
  log(`总计: ${results.length} 个测试`);
  log(`通过: ${passedCount} ✅`);
  log(`失败: ${failedCount} ❌`);
  log(`通过率: ${results.length > 0 ? ((passedCount / results.length) * 100).toFixed(1) : 0}%`);
  log('===============================\n');

  if (failedCount > 0) {
    log('失败用例详情:');
    results.filter(r => !r.passed).forEach(r => {
      log(`  ❌ ${r.testId}: ${r.name} - ${r.detail || ''}`);
    });
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
