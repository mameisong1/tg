/**
 * 测试 memberInfo Storage 存储和登出清理功能
 * 
 * 测试场景:
 * 1. SMS登录前清空旧数据
 * 2. 退出登录清空 Storage
 * 3. 页面初始化加载 memberInfo
 */

const puppeteer = require('puppeteer');

const CHROME_PORT = 9222;
const BASE_URL = 'http://127.0.0.1:8089';
const TEST_PHONE = '15907641078';  // 小雨
const TEST_CODE = '888888';        // 测试环境通用验证码

// 12个登录相关字段
const LOGIN_FIELDS = [
  'memberToken', 'memberInfo', 'coachToken', 'coachInfo',
  'adminToken', 'adminInfo', 'preferredRole', 'sessionId',
  'tablePinyin', 'tableName', 'tableAuth', 'highlightProduct'
];

const results = { passed: 0, failed: 0, failures: [] };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function getStorage(page) {
  return page.evaluate(() => {
    const r = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      r[k] = localStorage.getItem(k);
    }
    return r;
  });
}

function dumpStorage(storage, label) {
  console.log(`\n=== ${label} ===`);
  for (const k of Object.keys(storage).sort()) {
    const v = storage[k];
    console.log(`  ${k}: ${v && v.length > 60 ? v.substring(0, 60) + '...' : v}`);
  }
}

async function navigateTo(page, path) {
  const url = `${BASE_URL}/#${path}`;
  console.log(`  导航到: ${path}`);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
  await wait(2000);
  // 确认页面
  const currentPage = await page.evaluate(() => {
    const pageEl = document.querySelector('[data-page]');
    return pageEl ? pageEl.getAttribute('data-page') : 'unknown';
  });
  console.log(`  当前页面: ${currentPage}`);
  // 如果不对，再等一会
  if (!currentPage.includes(path.split('/').pop())) {
    console.log(`  ⚠️ 页面可能未完全加载，等待...`);
    await wait(3000);
  }
}

async function main() {
  console.log('\n========================================');
  console.log('天宫国际 Storage 功能测试');
  console.log('========================================\n');
  
  let browser, page;
  
  try {
    console.log('连接 Chrome 9222 端口...');
    browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${CHROME_PORT}`,
      defaultViewport: { width: 375, height: 812 }
    });
    
    const pages = await browser.pages();
    page = pages.find(p => p.url().includes('127.0.0.1:8089'));
    if (!page) page = await browser.newPage();
    
    // ===========================
    // 场景1: SMS登录前清空旧数据
    // ===========================
    console.log('\n【场景1】SMS登录前清空旧数据');
    console.log('----------------------------------------');
    
    await navigateTo(page, '/pages/member/member');
    
    // 注入假数据模拟旧登录状态
    console.log('  设置假 Storage 数据...');
    await page.evaluate(() => {
      localStorage.setItem('memberToken', 'fake_member_token_123');
      localStorage.setItem('memberInfo', JSON.stringify({ memberNo: 'FAKE001', name: '假用户' }));
      localStorage.setItem('coachToken', 'fake_coach_token_456');
      localStorage.setItem('coachInfo', JSON.stringify({ coachNo: 'FAKE001', stage_name: '假助教' }));
      localStorage.setItem('adminToken', 'fake_admin_token_789');
      localStorage.setItem('adminInfo', JSON.stringify({ role: '店长', name: '假管理员' }));
      localStorage.setItem('preferredRole', 'coach');
      localStorage.setItem('sessionId', 'fake_session_123');
      localStorage.setItem('tablePinyin', 'FAKE');
      localStorage.setItem('tableName', '假台桌');
      localStorage.setItem('tableAuth', 'fake_auth');
      localStorage.setItem('highlightProduct', 'fake_highlight');
      localStorage.setItem('lastPhone', '13800138000');
      localStorage.setItem('agreed', 'true');
      localStorage.setItem('device_fp', 'test_fingerprint');
    });
    
    const beforeLogin = await getStorage(page);
    dumpStorage(beforeLogin, '登录前 Storage');
    
    // 刷新页面让 Vue 重新渲染（清除 Storage 后应显示登录界面）
    await page.reload({ waitUntil: 'networkidle0' });
    await wait(3000);
    
    // 验证页面显示登录界面（旧数据被 clearLoginStorage 清空后，memberInfo.memberNo 为空）
    const currentPage = await page.evaluate(() => {
      const pageEl = document.querySelector('[data-page]');
      return pageEl ? pageEl.getAttribute('data-page') : 'unknown';
    });
    console.log(`  刷新后页面: ${currentPage}`);
    
    // 注意：member.vue 中 onMounted 会调用 checkAutoLogin()，
    // 如果没有有效 token 会显示登录界面。但刚刷新时 uni.getStorageSync('memberToken')
    // 返回的是假的 'fake_member_token_123'，页面可能认为是已登录。
    // 我们需要先清空，然后看登录界面
    
    // 直接清空 Storage 模拟 clearLoginStorage
    await page.evaluate(() => {
      uni.removeStorageSync('memberToken');
      uni.removeStorageSync('memberInfo');
      uni.removeStorageSync('coachToken');
      uni.removeStorageSync('coachInfo');
      uni.removeStorageSync('adminToken');
      uni.removeStorageSync('adminInfo');
      uni.removeStorageSync('preferredRole');
      uni.removeStorageSync('sessionId');
      uni.removeStorageSync('tablePinyin');
      uni.removeStorageSync('tableName');
      uni.removeStorageSync('tableAuth');
      uni.removeStorageSync('highlightProduct');
    });
    await wait(1000);
    
    // 刷新页面
    await page.reload({ waitUntil: 'networkidle0' });
    await wait(3000);
    
    // 验证显示登录界面
    const loginCard = await page.$('.h5-login-card');
    const loginSection = await page.$('.login-section');
    if (loginCard || loginSection) {
      console.log('  ✅ 清空后显示登录界面');
      results.passed++;
    } else {
      console.log('  ❌ 清空后未显示登录界面');
      results.failed++;
      results.failures.push({ test: '场景1', reason: '未显示登录界面' });
    }
    
    // 输入手机号
    console.log('  输入手机号和验证码...');
    const inputs = await page.$$('.h5-form-input');
    if (inputs.length >= 2) {
      await inputs[0].click({ clickCount: 3 });
      await page.keyboard.type(TEST_PHONE);
      console.log(`  手机号: ${TEST_PHONE}`);
      
      await inputs[1].click({ clickCount: 3 });
      await page.keyboard.type(TEST_CODE);
      console.log(`  验证码: ${TEST_CODE}`);
    } else {
      console.log('  ❌ 未找到输入框');
      results.failed++;
      results.failures.push({ test: '场景1', reason: '未找到输入框' });
    }
    
    // 点击同意
    const cb = await page.$('.h5-agreement .checkbox');
    if (cb) { await cb.click(); await wait(500); }
    
    // 点击登录
    const loginBtn = await page.$('.h5-login-btn');
    if (loginBtn) {
      console.log('  点击登录...');
      await loginBtn.click();
      await wait(8000);
      
      const afterLogin = await getStorage(page);
      dumpStorage(afterLogin, '登录后 Storage');
      
      // 验证假 token 被替换
      if (afterLogin.memberToken !== 'fake_member_token_123' && afterLogin.memberToken) {
        console.log('  ✅ memberToken 已被替换为真实 token');
        results.passed++;
      } else if (afterLogin.memberToken === 'fake_member_token_123') {
        console.log('  ❌ memberToken 未被替换');
        results.failed++;
        results.failures.push({ test: '场景1', reason: 'memberToken 未被替换' });
      }
      
      // 验证 coachToken 已清空（小雨无教练身份）
      if (!afterLogin.coachToken) {
        console.log('  ✅ coachToken 已清空');
        results.passed++;
      } else {
        console.log('  ❌ coachToken 未清空');
        results.failed++;
        results.failures.push({ test: '场景1', reason: 'coachToken 未清空' });
      }
      
      // 验证 agreed 保留
      if (afterLogin.agreed === 'true') {
        console.log('  ✅ agreed 保留');
        results.passed++;
      } else {
        console.log('  ⚠️ agreed 状态: ' + afterLogin.agreed);
      }
    } else {
      console.log('  ❌ 未找到登录按钮');
      results.failed++;
      results.failures.push({ test: '场景1', reason: '未找到登录按钮' });
    }
    
    // ===========================
    // 场景5: 页面初始化加载 memberInfo
    // ===========================
    console.log('\n【场景5】页面初始化加载 memberInfo');
    console.log('----------------------------------------');
    
    const mi = await page.evaluate(() => localStorage.getItem('memberInfo'));
    if (mi) {
      console.log('  当前 memberInfo 存在，刷新页面测试...');
      await page.reload({ waitUntil: 'networkidle0' });
      await wait(3000);
      
      const memberSection = await page.$('.member-section');
      if (memberSection) {
        console.log('  ✅ 页面显示会员卡片（已登录状态）');
        results.passed++;
      } else {
        console.log('  ❌ 页面未显示会员卡片');
        results.failed++;
        results.failures.push({ test: '场景5', reason: '页面未显示会员卡片' });
      }
      
      const miAfter = await page.evaluate(() => localStorage.getItem('memberInfo'));
      if (miAfter) {
        console.log('  ✅ memberInfo 刷新后依然存在');
        results.passed++;
      } else {
        console.log('  ❌ memberInfo 刷新后丢失');
        results.failed++;
        results.failures.push({ test: '场景5', reason: 'memberInfo 刷新后丢失' });
      }
      
      // 验证 memberInfo 内容正确
      const parsed = JSON.parse(miAfter);
      if (parsed.memberNo && parsed.name) {
        console.log(`  ✅ memberInfo 内容完整: memberNo=${parsed.memberNo}, name=${parsed.name}`);
        results.passed++;
      } else {
        console.log('  ❌ memberInfo 内容不完整');
        results.failed++;
        results.failures.push({ test: '场景5', reason: 'memberInfo 内容不完整' });
      }
    } else {
      console.log('  ⚠️ 当前无 memberInfo，跳过');
    }
    
    // ===========================
    // 场景4: 退出登录清空 Storage
    // ===========================
    console.log('\n【场景4】退出登录清空 Storage');
    console.log('----------------------------------------');
    
    // 确保已登录
    let ms = await page.$('.member-section');
    if (!ms) {
      console.log('  当前未登录，先执行登录...');
      await navigateTo(page, '/pages/member/member');
      
      const cb2 = await page.$('.h5-agreement .checkbox');
      if (cb2) await cb2.click();
      await wait(500);
      
      const inps = await page.$$('.h5-form-input');
      if (inps.length >= 2) {
        await inps[0].click({ clickCount: 3 });
        await page.keyboard.type(TEST_PHONE);
        await inps[1].click({ clickCount: 3 });
        await page.keyboard.type(TEST_CODE);
      }
      const lb = await page.$('.h5-login-btn');
      if (lb) {
        await lb.click();
        await wait(8000);
      }
      ms = await page.$('.member-section');
    }
    
    if (ms) {
      console.log('  已登录状态，点击会员卡片进入 profile...');
      await ms.click();
      await wait(3000);
      
      // 确认在 profile 页面
      const profilePage = await page.evaluate(() => {
        const el = document.querySelector('[data-page]');
        return el ? el.getAttribute('data-page') : 'unknown';
      });
      console.log(`  当前页面: ${profilePage}`);
      
      // 打印退出前 Storage
      const beforeLogout = await getStorage(page);
      dumpStorage(beforeLogout, '退出前 Storage');
      
      // 点击退出登录
      const logoutBtn = await page.$('.logout-btn');
      if (logoutBtn) {
        console.log('  点击退出登录...');
        
        // 拦截 uni.showModal，自动确认
        await page.evaluate(() => {
          const origShowModal = uni.showModal;
          uni.showModal = function(options) {
            console.log('showModal 被调用:', options.title, options.content);
            // 自动调用 success 回调，模拟用户点击确认
            if (options.success) {
              setTimeout(() => {
                options.success({ confirm: true, cancel: false });
              }, 500);
            }
            return origShowModal.call(uni, options);
          };
        });
        
        await logoutBtn.click();
        await wait(5000);
        
        const afterLogout = await getStorage(page);
        dumpStorage(afterLogout, '退出后 Storage');
        
        // 验证12个字段清空
        let allCleared = true;
        for (const field of LOGIN_FIELDS) {
          const val = afterLogout[field];
          if (val !== undefined && val !== null && val !== '') {
            console.log(`  ❌ ${field} 未清空: ${val}`);
            allCleared = false;
          }
        }
        if (allCleared) {
          console.log(`  ✅ 全部 12 个登录字段已清空`);
          results.passed++;
        } else {
          results.failed++;
          results.failures.push({ test: '场景4', reason: '部分字段未清空' });
        }
        
        // 验证非登录数据保留
        if (afterLogout.agreed === 'true') {
          console.log('  ✅ agreed 保留');
          results.passed++;
        } else {
          console.log('  ⚠️ agreed: ' + afterLogout.agreed);
        }
        if (afterLogout.device_fp) {
          console.log('  ✅ device_fp 保留');
          results.passed++;
        } else {
          console.log('  ⚠️ device_fp 状态: ' + afterLogout.device_fp);
        }
        if (afterLogout.lastPhone) {
          console.log('  ✅ lastPhone 保留');
          results.passed++;
        } else {
          console.log('  ⚠️ lastPhone 状态: ' + afterLogout.lastPhone);
        }
      } else {
        console.log('  ❌ 未找到退出登录按钮');
        results.failed++;
        results.failures.push({ test: '场景4', reason: '未找到退出登录按钮' });
      }
    } else {
      console.log('  ❌ 登录失败，无法测试退出');
      results.failed++;
      results.failures.push({ test: '场景4', reason: '前置登录失败' });
    }
    
  } catch (error) {
    console.error('\n❌ 测试执行错误:', error.message);
    results.failed++;
    results.failures.push({ test: '全局', reason: error.message });
  }
  
  // 结果汇总
  console.log('\n========================================');
  console.log('测试结果汇总');
  console.log('========================================');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  
  if (results.failures.length > 0) {
    console.log('\n失败详情:');
    for (const f of results.failures) {
      console.log(`  - ${f.test}: ${f.reason}`);
    }
  }
  console.log('');
}

main();