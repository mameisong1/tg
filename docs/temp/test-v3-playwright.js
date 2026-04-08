const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/TG/docs/temp/screenshots';

async function main() {
  console.log('🎱 第3轮测试: 权限控制验证');
  
  // Connect to existing browser
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  
  const testAccounts = [
    {
      name: '管理员',
      username: 'tgadmin',
      password: 'mms633268',
      expected: 'login',
      expectedMenus: ['数据概览', '收银看板', '商品管理', '包房管理', '助教管理', '水牌管理', '约客审查', '操作日志', '配置'],
    },
    {
      name: '收银',
      username: '13800138002',
      password: 'test123',
      expected: 'login',
      expectedMenus: ['收银看板', '商品管理'],
      unexpectedMenus: ['数据概览', '助教管理', '包房管理', '水牌管理', '约客审查', '操作日志', '配置'],
    },
    {
      name: '前厅管理',
      username: '13800138003',
      password: 'test123',
      expected: 'login',
      expectedMenus: ['收银看板', '商品管理', '包房管理'],
      unexpectedMenus: ['数据概览', '助教管理', '水牌管理', '约客审查', '操作日志', '配置'],
    },
    {
      name: '教练',
      username: '13800138004',
      password: 'test123',
      expected: 'login',
      expectedMenus: ['水牌管理'],
      unexpectedMenus: ['数据概览', '收银看板', '商品管理', '助教管理', '包房管理', '约客审查', '操作日志', '配置'],
    },
    {
      name: '服务员',
      username: '13800138005',
      password: 'test123',
      expected: 'reject',
    }
  ];
  
  const results = [];
  
  for (const account of testAccounts) {
    console.log(`\n🔍 测试: ${account.name} (${account.username})`);
    
    // Navigate to login
    const page = await context.newPage();
    try {
      await page.goto('https://tg.tiangong.club/admin/login.html', {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      await page.waitForTimeout(1500);
      
      // Fill login form
      await page.locator('input[placeholder*="用户名"]').fill(account.username);
      await page.waitForTimeout(200);
      await page.locator('input[type="password"]').fill(account.password);
      await page.waitForTimeout(200);
      await page.locator('button:has-text("登录"), .login-btn').click();
      
      // Wait for login
      await page.waitForTimeout(3000);
      
      const url = page.url();
      console.log(`   URL: ${url}`);
      
      if (account.expected === 'reject') {
        const errorMsg = await page.evaluate(() => {
          const el = document.querySelector('.el-message, .alert, .error-msg, [class*="error"], [class*="message"]');
          return el ? el.textContent.trim() : '';
        });
        console.log(`   Error: ${errorMsg || '(none)'}`);
        
        const blocked = url.includes('login') || (errorMsg && errorMsg.includes('不允许'));
        
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `TC-v3-${account.name}-拒绝登录.png`),
          fullPage: false
        });
        
        results.push({
          account: account.name,
          status: blocked ? 'PASS' : 'FAIL',
          message: blocked ? `服务员被拒绝登录 ✅ (${errorMsg})` : `服务员不应能登录！`,
          url,
          error: errorMsg
        });
      } else {
        if (url.includes('login')) {
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `TC-v3-${account.name}-登录失败.png`),
            fullPage: false
          });
          results.push({
            account: account.name,
            status: 'FAIL',
            message: `登录失败`,
            url
          });
        } else {
          await page.waitForTimeout(1000);
          
          const menus = await page.evaluate(() => {
            const items = [];
            document.querySelectorAll('.nav-item, .nav-group-title').forEach(el => {
              const text = el.textContent.trim().replace(/[📊💰📦️👩📋📜⚙️👩🔄☀️👥️🏠▼]/g, '').trim();
              if (text && text.length > 0 && !items.includes(text)) {
                items.push(text);
              }
            });
            return items;
          });
          
          console.log(`   Menus: ${menus.join(', ')}`);
          
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `TC-v3-${account.name}-菜单.png`),
            fullPage: false
          });
          
          // Validate menus
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
            url,
            menus,
            issues
          });
        }
      }
    } catch (err) {
      console.error(`   Error: ${err.message}`);
      results.push({
        account: account.name,
        status: 'ERROR',
        message: err.message
      });
    } finally {
      await page.close();
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Output summary
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
  
  fs.writeFileSync('/TG/docs/temp/test-results-v3.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to /TG/docs/temp/test-results-v3.json');
  
  await browser.close();
}

main().catch(console.error);
