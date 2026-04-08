// 第3轮测试：权限控制验证
// 测试5个账号的菜单权限

const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOT_DIR = '/TG/docs/temp/screenshots';

const testAccounts = [
  {
    name: '管理员',
    username: 'tgadmin',
    password: 'mms633268',
    expected: 'PASS',
    expectedMenus: ['数据概览', '收银看板', '助教管理', '订单管理', '会员管理', '商品管理', '包房管理', '水牌管理', '约客审查', '操作日志', '配置'],
    description: '应可见全部菜单'
  },
  {
    name: '收银',
    username: '13800138002',
    password: 'test123',
    expected: 'PASS',
    expectedMenus: ['收银看板', '商品管理'],
    unexpectedMenus: ['助教管理', '订单管理', '会员管理', '包房管理', '水牌管理', '约客审查', '操作日志', '配置', '数据概览'],
    description: '应仅见：收银看板、商品管理'
  },
  {
    name: '前厅管理',
    username: '13800138003',
    password: 'test123',
    expected: 'PASS',
    expectedMenus: ['收银看板', '商品管理', '包房管理'],
    unexpectedMenus: ['助教管理', '订单管理', '会员管理', '水牌管理', '约客审查', '操作日志', '配置', '数据概览'],
    description: '应仅见：收银看板、商品管理、包房管理'
  },
  {
    name: '教练',
    username: '13800138004',
    password: 'test123',
    expected: 'PASS',
    expectedMenus: ['水牌管理'],
    unexpectedMenus: ['收银看板', '商品管理', '助教管理', '订单管理', '会员管理', '包房管理', '约客审查', '操作日志', '配置', '数据概览'],
    description: '应仅见：水牌管理(只读)'
  },
  {
    name: '服务员',
    username: '13800138005',
    password: 'test123',
    expected: 'FAIL_LOGIN',
    description: '应禁止登录后台'
  }
];

const results = [];

async function getSidebarMenus(page) {
  // 获取侧边栏菜单项
  await page.waitForTimeout(2000); // 等待菜单渲染
  
  const menus = await page.evaluate(() => {
    // 尝试多种选择器
    const selectors = [
      '.sidebar-menu a',
      '.nav-menu a',
      '.el-menu a',
      '.menu a',
      '.sidebar a',
      '.left-nav a',
      '#side-menu a',
      '.nav a',
      'nav a',
      '.el-submenu__title',
      '.el-menu-item',
    ];
    
    for (const sel of selectors) {
      const items = document.querySelectorAll(sel);
      if (items.length > 0) {
        return Array.from(items).map(el => el.textContent.trim()).filter(t => t.length > 0);
      }
    }
    return [];
  });
  
  return menus;
}

async function loginAndTest(browser, account) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  
  try {
    console.log(`\n========== 测试: ${account.name} (${account.username}) ==========`);
    
    // 导航到登录页
    await page.goto('https://tg.tiangong.club/admin/login.html', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    await page.waitForTimeout(1000);
    
    // 填写登录表单
    // 先查看页面结构
    const pageContent = await page.content();
    
    // 找到用户名和密码输入框
    const usernameInput = await page.$('input[placeholder*="用户名"], input[placeholder*="账号"], input[placeholder*="手机"], input[name="username"], input[type="text"]:not([type="submit"])');
    const passwordInput = await page.$('input[type="password"], input[placeholder*="密码"]');
    const loginButton = await page.$('button[type="submit"], button:has-text("登录"), .login-btn, input[type="submit"]');
    
    if (!usernameInput || !passwordInput) {
      // 尝试用更通用的方式
      const inputs = await page.$$('input');
      console.log(`  找到 ${inputs.length} 个input元素`);
      for (let i = 0; i < inputs.length; i++) {
        const type = await inputs[i].getAttribute('type');
        const placeholder = await inputs[i].getAttribute('placeholder');
        const name = await inputs[i].getAttribute('name');
        console.log(`  input[${i}]: type=${type}, placeholder=${placeholder}, name=${name}`);
      }
    }
    
    if (usernameInput && passwordInput && loginButton) {
      await usernameInput.click();
      await usernameInput.fill(account.username);
      await page.waitForTimeout(300);
      await passwordInput.click();
      await passwordInput.fill(account.password);
      await page.waitForTimeout(300);
      await loginButton.click();
      
      // 等待登录结果
      await page.waitForTimeout(3000);
      
      const currentUrl = page.url();
      console.log(`  登录后URL: ${currentUrl}`);
      
      if (account.expected === 'FAIL_LOGIN') {
        // 服务员应该无法登录
        if (currentUrl.includes('login') || currentUrl.includes('Login')) {
          // 仍在登录页，可能被拒绝了
          const errorMsg = await page.evaluate(() => {
            const el = document.querySelector('.el-message, .alert, .error-msg, .msg, .message, [class*="message"], [class*="error"], [class*="toast"]');
            return el ? el.textContent.trim() : '';
          });
          console.log(`  错误信息: ${errorMsg || '(无)'}`);
          
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `TC-v3-${account.name}-拒绝登录.png`),
            fullPage: false
          });
          
          results.push({
            account: account.name,
            status: 'PASS',
            message: `服务员被拒绝登录后台 ✅`,
            url: currentUrl
          });
        } else {
          // 成功登录了，这是BUG
          const menus = await getSidebarMenus(page);
          console.log(`  菜单: ${menus.join(', ')}`);
          
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `TC-v3-${account.name}-错误登录.png`),
            fullPage: false
          });
          
          results.push({
            account: account.name,
            status: 'FAIL',
            message: `服务员不应能登录后台，但成功登录了！菜单: ${menus.join(', ')}`,
            url: currentUrl,
            menus: menus
          });
        }
      } else {
        // 其他角色应该能登录
        if (currentUrl.includes('login') || currentUrl.includes('Login')) {
          // 登录失败
          const errorMsg = await page.evaluate(() => {
            const el = document.querySelector('.el-message, .alert, .error-msg, .msg, .message, [class*="message"], [class*="error"], [class*="toast"]');
            return el ? el.textContent.trim() : '';
          });
          
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `TC-v3-${account.name}-登录失败.png`),
            fullPage: false
          });
          
          results.push({
            account: account.name,
            status: 'FAIL',
            message: `登录失败: ${errorMsg || '未知原因'}`,
            url: currentUrl
          });
        } else {
          // 登录成功，检查菜单
          const menus = await getSidebarMenus(page);
          console.log(`  实际菜单: ${menus.join(', ')}`);
          
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `TC-v3-${account.name}-菜单.png`),
            fullPage: false
          });
          
          // 验证菜单
          let issues = [];
          
          // 检查应出现的菜单是否都出现了
          if (account.expectedMenus) {
            for (const expected of account.expectedMenus) {
              const found = menus.some(m => m.includes(expected));
              if (!found) {
                issues.push(`缺少应显示的菜单: ${expected}`);
              }
            }
          }
          
          // 检查不应出现的菜单是否出现了
          if (account.unexpectedMenus) {
            for (const unexpected of account.unexpectedMenus) {
              const found = menus.some(m => m.includes(unexpected));
              if (found) {
                issues.push(`不应显示的菜单出现了: ${unexpected}`);
              }
            }
          }
          
          if (issues.length === 0) {
            results.push({
              account: account.name,
              status: 'PASS',
              message: `菜单正确: ${menus.join(', ')}`,
              url: currentUrl,
              menus: menus
            });
          } else {
            results.push({
              account: account.name,
              status: 'FAIL',
              message: issues.join('; '),
              url: currentUrl,
              menus: menus,
              issues: issues
            });
          }
        }
      }
    } else {
      console.log(`  未能找到登录表单元素!`);
      
      // 截图
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `TC-v3-${account.name}-页面错误.png`),
        fullPage: false
      });
      
      results.push({
        account: account.name,
        status: 'ERROR',
        message: `无法找到登录表单元素`,
        url: page.url()
      });
    }
    
  } catch (err) {
    console.error(`  测试出错: ${err.message}`);
    results.push({
      account: account.name,
      status: 'ERROR',
      message: err.message
    });
  } finally {
    await context.close();
  }
}

async function testApiPermission() {
  // 测试后端API权限校验
  console.log('\n========== 测试: 后端API权限校验 ==========\n');
  
  const apiResults = [];
  
  // 先用收银账号登录获取token
  const context = await chromium.launchPersistentContext('/tmp/test-cache-cashier', {
    headless: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  
  try {
    await page.goto('https://tg.tiangong.club/admin/login.html', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    await page.waitForTimeout(1000);
    
    const inputs = await page.$$('input');
    for (let i = 0; i < inputs.length; i++) {
      const type = await inputs[i].getAttribute('type');
      const placeholder = await inputs[i].getAttribute('placeholder');
      const name = await inputs[i].getAttribute('name');
      if (type === 'password') {
        // 前一个是用户名
        if (i > 0) {
          await inputs[i-1].fill('13800138002');
          await page.waitForTimeout(300);
          await inputs[i].fill('test123');
          await page.waitForTimeout(300);
        }
      }
    }
    
    const loginButton = await page.$('button[type="submit"], button:has-text("登录"), .login-btn');
    if (loginButton) {
      await loginButton.click();
      await page.waitForTimeout(3000);
      
      const currentUrl = page.url();
      console.log(`  收银登录后URL: ${currentUrl}`);
      
      if (!currentUrl.includes('login')) {
        // 登录成功，尝试访问受限页面
        const restrictedPages = [
          { url: 'https://tg.tiangong.club/admin/coaches.html', name: '助教管理' },
          { url: 'https://tg.tiangong.club/admin/members.html', name: '会员管理' },
          { url: 'https://tg.tiangong.club/admin/orders.html', name: '订单管理' },
        ];
        
        for (const rp of restrictedPages) {
          await page.goto(rp.url, { waitUntil: 'networkidle', timeout: 15000 });
          await page.waitForTimeout(2000);
          
          const pageText = await page.evaluate(() => document.body.innerText);
          const isRedirected = page.url().includes('login') || page.url().includes('403') || page.url().includes('forbidden');
          const hasNoAccess = pageText.includes('权限') || pageText.includes('无权限') || pageText.includes('403') || pageText.includes('拒绝') || isRedirected;
          
          console.log(`  收银访问${rp.name}: ${hasNoAccess ? '被拒绝 ✅' : '可访问 ❌'} (URL: ${page.url()})`);
          
          apiResults.push({
            role: '收银',
            page: rp.name,
            url: rp.url,
            status: hasNoAccess ? 'PASS' : 'FAIL',
            message: hasNoAccess ? '权限校验生效' : '权限校验缺失，可访问受限页面',
            finalUrl: page.url()
          });
          
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `TC-v3-API-收银-${rp.name}.png`),
            fullPage: false
          });
        }
      }
    }
  } catch (err) {
    console.error(`  API测试出错: ${err.message}`);
  } finally {
    await context.close();
  }
  
  return apiResults;
}

async function main() {
  console.log('🎱 第3轮测试开始: 权限控制验证');
  console.log('测试时间:', new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
  console.log('');
  
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
  });
  
  try {
    // 逐个测试账号
    for (const account of testAccounts) {
      await loginAndTest(browser, account);
      // 账号之间等待一下，避免session冲突
      await new Promise(r => setTimeout(r, 1000));
    }
    
    // 测试API权限
    const apiResults = await testApiPermission();
    results.push(...apiResults);
    
    // 输出结果
    console.log('\n========== 测试结果汇总 ==========');
    for (const r of results) {
      const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${icon} ${r.account}: ${r.message}`);
    }
    
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    const errorCount = results.filter(r => r.status === 'ERROR').length;
    console.log(`\n总计: ${results.length} 项 | ✅ ${passCount} 通过 | ❌ ${failCount} 失败 | ⚠️ ${errorCount} 错误`);
    
    // 写入JSON结果供报告生成使用
    const fs = require('fs');
    fs.writeFileSync('/TG/docs/temp/test-results-v3.json', JSON.stringify(results, null, 2));
    console.log('\n结果已保存到 /TG/docs/temp/test-results-v3.json');
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
