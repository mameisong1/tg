const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOT_DIR = '/TG/docs/temp/screenshots';
const results = [];

async function loginTest(browser, account) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  
  try {
    console.log(`\n🔍 测试: ${account.name} (${account.username})`);
    
    // 导航到登录页
    await page.goto('https://tg.tiangong.club/admin/login.html', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page.waitForTimeout(1500);
    
    // 填写登录表单
    const usernameInput = page.locator('input[placeholder*="用户名"]');
    const passwordInput = page.locator('input[type="password"]');
    const loginButton = page.locator('button:has-text("登录"), .login-btn');
    
    await usernameInput.fill(account.username);
    await page.waitForTimeout(300);
    await passwordInput.fill(account.password);
    await page.waitForTimeout(300);
    await loginButton.click();
    
    // 等待登录结果
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log(`   URL: ${currentUrl}`);
    
    if (account.expected === 'FAIL_LOGIN') {
      // 服务员应该无法登录
      const errorMsg = await page.evaluate(() => {
        const el = document.querySelector('.el-message, .alert, .error-msg, .msg, [class*="error"], [class*="message"]');
        return el ? el.textContent.trim() : '';
      });
      console.log(`   错误: ${errorMsg || '(无)'}`);
      
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `TC-v3-${account.name}-拒绝登录.png`),
        fullPage: false
      });
      
      const blocked = currentUrl.includes('login') || errorMsg.includes('不允许') || errorMsg.includes('拒绝');
      results.push({
        account: account.name,
        status: blocked ? 'PASS' : 'FAIL',
        message: blocked ? `服务员被拒绝登录 ✅` : `服务员不应能登录后台！`,
        url: currentUrl,
        error: errorMsg
      });
    } else {
      // 其他角色应该能登录
      if (currentUrl.includes('login')) {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `TC-v3-${account.name}-登录失败.png`),
          fullPage: false
        });
        results.push({
          account: account.name,
          status: 'FAIL',
          message: `登录失败`,
          url: currentUrl
        });
      } else {
        // 登录成功，获取菜单
        await page.waitForTimeout(1000);
        
        const menus = await page.evaluate(() => {
          const items = [];
          // 侧边栏菜单项
          document.querySelectorAll('.sidebar a, .nav a, .el-menu a, .menu a, nav a, .el-menu-item, .sidebar-menu a, [class*="menu"] a').forEach(el => {
            const text = el.textContent.trim();
            if (text && text.length > 0 && !items.includes(text)) {
              items.push(text);
            }
          });
          return items;
        });
        
        console.log(`   菜单: ${menus.slice(0, 10).join(', ')}${menus.length > 10 ? '...' : ''}`);
        
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `TC-v3-${account.name}-菜单.png`),
          fullPage: false
        });
        
        // 验证菜单
        let issues = [];
        
        if (account.expectedMenus) {
          for (const expected of account.expectedMenus) {
            const found = menus.some(m => m.includes(expected));
            if (!found) issues.push(`缺少: ${expected}`);
          }
        }
        
        if (account.unexpectedMenus) {
          for (const unexpected of account.unexpectedMenus) {
            const found = menus.some(m => m.includes(unexpected));
            if (found) issues.push(`不应有: ${unexpected}`);
          }
        }
        
        results.push({
          account: account.name,
          status: issues.length === 0 ? 'PASS' : 'FAIL',
          message: issues.length === 0 ? `菜单正确` : issues.join('; '),
          url: currentUrl,
          menus: menus,
          issues: issues
        });
      }
    }
  } catch (err) {
    console.error(`   错误: ${err.message}`);
    results.push({
      account: account.name,
      status: 'ERROR',
      message: err.message
    });
  } finally {
    await context.close();
  }
}

async function main() {
  console.log('🎱 第3轮测试: 权限控制验证');
  console.log('时间:', new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
  
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  
  const testAccounts = [
    {
      name: '管理员',
      username: 'tgadmin',
      password: 'mms633268',
      expected: 'PASS',
      expectedMenus: ['数据概览', '收银看板', '商品管理', '包房管理', '助教管理', '水牌管理', '约客审查', '操作日志', '配置'],
    },
    {
      name: '收银',
      username: '13800138002',
      password: 'test123',
      expected: 'PASS',
      expectedMenus: ['收银看板', '商品管理'],
      unexpectedMenus: ['数据概览', '助教管理', '订单管理', '会员管理', '包房管理', '水牌管理', '约客审查', '操作日志', '配置'],
    },
    {
      name: '前厅管理',
      username: '13800138003',
      password: 'test123',
      expected: 'PASS',
      expectedMenus: ['收银看板', '商品管理', '包房管理'],
      unexpectedMenus: ['数据概览', '助教管理', '订单管理', '会员管理', '水牌管理', '约客审查', '操作日志', '配置'],
    },
    {
      name: '教练',
      username: '13800138004',
      password: 'test123',
      expected: 'PASS',
      expectedMenus: ['水牌管理'],
      unexpectedMenus: ['数据概览', '收银看板', '商品管理', '助教管理', '订单管理', '会员管理', '包房管理', '约客审查', '操作日志', '配置'],
    },
    {
      name: '服务员',
      username: '13800138005',
      password: 'test123',
      expected: 'FAIL_LOGIN',
    }
  ];
  
  for (const account of testAccounts) {
    await loginTest(browser, account);
    await new Promise(r => setTimeout(r, 1500));
  }
  
  // 输出结果
  console.log('\n========== 测试结果汇总 ==========');
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${r.account}: ${r.message}`);
  }
  
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const errorCount = results.filter(r => r.status === 'ERROR').length;
  console.log(`\n总计: ${results.length} | ✅ ${passCount} | ❌ ${failCount} | ⚠️ ${errorCount}`);
  console.log(`通过率: ${((passCount / results.length) * 100).toFixed(0)}%`);
  
  // 写入结果
  const fs = require('fs');
  fs.writeFileSync('/TG/docs/temp/test-results-v3.json', JSON.stringify(results, null, 2));
  
  await browser.close();
}

main().catch(console.error);
