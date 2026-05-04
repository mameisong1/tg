/**
 * memberInfo Storage 测试用例
 * 
 * 使用登录脚本和退出脚本测试：
 * - login.js: 登录
 * - logout.js: 退出登录
 */

const puppeteer = require('/usr/lib/node_modules/puppeteer');
const { execSync } = require('child_process');

const LOGIN_SCRIPT = '/root/.openclaw/workspace_coder-tg/skills/frontend-testing/login.js';
const LOGOUT_SCRIPT = '/root/.openclaw/workspace_coder-tg/skills/frontend-testing/logout.js';
const CHROME_PORT = 9222;
const BASE_URL = 'http://127.0.0.1:8089';
const TEST_PHONE = '18600000004';

const STORAGE_KEYS = [
  'memberToken', 'memberInfo', 'coachToken', 'coachInfo',
  'adminToken', 'adminInfo', 'preferredRole', 'sessionId',
  'tablePinyin', 'tableName', 'tableAuth', 'highlightProduct'
];

let results = { passed: 0, failed: 0, details: [] };

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getStorage(page) {
  return page.evaluate((keys) => {
    const r = {};
    keys.forEach(k => r[k] = localStorage.getItem(k));
    return r;
  }, STORAGE_KEYS);
}

// ========== 用例1：登录后 memberInfo 存储 ==========
async function test1_loginStoresMemberInfo() {
  log('\n=== 用例1：登录后 memberInfo 存储 ===');
  
  // 先退出登录（清理状态）
  log('先退出登录清理状态');
  try {
    execSync(`node ${LOGOUT_SCRIPT}`, { stdio: 'ignore' });
  } catch {}
  await sleep(2000);
  
  // 执行登录脚本
  log('执行登录脚本');
  try {
    execSync(`node ${LOGIN_SCRIPT} ${TEST_PHONE} coach`, { stdio: 'inherit' });
  } catch (e) {
    log('❌ 登录脚本执行失败');
    results.failed++;
    results.details.push({ case: 1, result: 'FAIL', reason: '登录失败' });
    return;
  }
  
  await sleep(2000);
  
  // 连接 Chrome 检查 Storage
  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${CHROME_PORT}`,
    defaultViewport: { width: 375, height: 812 }
  });
  const pages = await browser.pages();
  const page = pages[pages.length - 1];
  
  const storage = await getStorage(page);
  const memberInfo = storage.memberInfo ? JSON.parse(storage.memberInfo) : null;
  
  log(`Storage:`);
  log(`  memberToken: ${storage.memberToken ? '有值' : '空'}`);
  log(`  memberInfo: ${storage.memberInfo ? storage.memberInfo : '空'}`);
  
  if (storage.memberToken && memberInfo && memberInfo.phone === TEST_PHONE) {
    log('✅ 用例1 通过');
    results.passed++;
    results.details.push({ case: 1, result: 'PASS' });
  } else {
    log('❌ 用例1 失败');
    results.failed++;
    results.details.push({ case: 1, result: 'FAIL', reason: 'memberInfo 未正确存储' });
  }
  
  browser.disconnect();
}

// ========== 用例2：页面刷新后 memberInfo 加载 ==========
async function test2_refreshLoadsMemberInfo() {
  log('\n=== 用例2：页面刷新后 memberInfo 加载 ===');
  
  // 已登录状态（用例1已登录）
  
  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${CHROME_PORT}`,
    defaultViewport: { width: 375, height: 812 }
  });
  const pages = await browser.pages();
  const page = pages[pages.length - 1];
  
  // 刷新页面
  log('刷新页面');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(5000);
  
  // 检查页面是否显示用户信息
  const pageText = await page.evaluate(() => document.body.innerText);
  const showsUserInfo = pageText.includes('测试助教') || pageText.includes('186****0004');
  
  log(`页面显示用户信息: ${showsUserInfo ? '是' : '否'}`);
  
  if (showsUserInfo) {
    log('✅ 用例2 通过');
    results.passed++;
    results.details.push({ case: 2, result: 'PASS' });
  } else {
    log('❌ 用例2 失败');
    results.failed++;
    results.details.push({ case: 2, result: 'FAIL', reason: '页面未显示用户信息' });
  }
  
  browser.disconnect();
}

// ========== 用例3：退出登录清空 Storage ==========
async function test3_logoutClearsStorage() {
  log('\n=== 用例3：退出登录清空 Storage ===');
  
  // 执行退出脚本
  log('执行退出脚本');
  try {
    execSync(`node ${LOGOUT_SCRIPT}`, { stdio: 'inherit' });
  } catch (e) {
    log('❌ 退出脚本执行失败');
    results.failed++;
    results.details.push({ case: 3, result: 'FAIL', reason: '退出失败' });
    return;
  }
  
  await sleep(2000);
  
  // 连接 Chrome 检查 Storage
  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${CHROME_PORT}`,
    defaultViewport: { width: 375, height: 812 }
  });
  const pages = await browser.pages();
  const page = pages[pages.length - 1];
  
  const storage = await getStorage(page);
  
  // 检查登录相关字段（8个）是否清空
  const loginKeys = ['memberToken', 'memberInfo', 'coachToken', 'coachInfo',
                      'adminToken', 'adminInfo', 'preferredRole', 'sessionId'];
  const loginCleared = loginKeys.every(k => storage[k] === null);
  
  log(`Storage:`);
  loginKeys.forEach(k => log(`  ${k}: ${storage[k] === null ? '空' : '有值'}`));
  
  if (loginCleared) {
    log('✅ 用例3 通过');
    results.passed++;
    results.details.push({ case: 3, result: 'PASS' });
  } else {
    const notCleared = loginKeys.filter(k => storage[k] !== null);
    log(`❌ 用例3 失败，未清空: ${notCleared.join(',')}`);
    results.failed++;
    results.details.push({ case: 3, result: 'FAIL', reason: `未清空: ${notCleared.join(',')}` });
  }
  
  browser.disconnect();
}

// ========== 用例4：重新登录后数据正确 ==========
async function test4_reloginWorks() {
  log('\n=== 用例4：重新登录后数据正确 ===');
  
  // 执行登录脚本
  log('执行登录脚本');
  try {
    execSync(`node ${LOGIN_SCRIPT} ${TEST_PHONE} coach`, { stdio: 'inherit' });
  } catch (e) {
    log('❌ 登录脚本执行失败');
    results.failed++;
    results.details.push({ case: 4, result: 'FAIL', reason: '登录失败' });
    return;
  }
  
  await sleep(2000);
  
  // 连接 Chrome 检查
  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${CHROME_PORT}`,
    defaultViewport: { width: 375, height: 812 }
  });
  const pages = await browser.pages();
  const page = pages[pages.length - 1];
  
  const storage = await getStorage(page);
  const memberInfo = storage.memberInfo ? JSON.parse(storage.memberInfo) : null;
  
  if (storage.memberToken && memberInfo && memberInfo.phone === TEST_PHONE) {
    log('✅ 用例4 通过');
    results.passed++;
    results.details.push({ case: 4, result: 'PASS' });
  } else {
    log('❌ 用例4 失败');
    results.failed++;
    results.details.push({ case: 4, result: 'FAIL', reason: '重新登录失败' });
  }
  
  browser.disconnect();
}

// ========== 主函数 ==========
async function runTests() {
  log('=== memberInfo Storage 测试开始 ===');
  log(`时间: ${new Date().toLocaleString()}`);
  log(`使用脚本: login.js + logout.js`);
  
  try {
    await test1_loginStoresMemberInfo();
    await test2_refreshLoadsMemberInfo();
    await test3_logoutClearsStorage();
    await test4_reloginWorks();
    
    // 最后退出清理
    log('\n最后退出清理');
    try {
      execSync(`node ${LOGOUT_SCRIPT}`, { stdio: 'ignore' });
    } catch {}
    
    log('\n=== 测试汇总 ===');
    log(`通过: ${results.passed}`);
    log(`失败: ${results.failed}`);
    
    results.details.forEach(d => {
      log(`用例${d.case}: ${d.result} ${d.reason ? '- ' + d.reason : ''}`);
    });
    
  } catch (e) {
    log(`测试异常: ${e.message}`);
  }
}

runTests().catch(e => console.error('错误:', e));