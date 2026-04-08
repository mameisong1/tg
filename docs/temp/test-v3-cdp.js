// 第3轮测试 - 使用Chrome CDP直接测试
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const SCREENSHOT_DIR = '/TG/docs/temp/screenshots';
const CDP_HOST = '127.0.0.1';
const CDP_PORT = 9222;

function cdpRequest(methodPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CDP_HOST,
      port: CDP_PORT,
      path: methodPath,
      method
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } 
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function cdpCall(webSocketUrl, cmd, params = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(webSocketUrl);
    const id = Math.floor(Math.random() * 100000);
    
    ws.on('open', () => {
      ws.send(JSON.stringify({ id, method: cmd, params }));
    });
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        ws.close();
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
    
    ws.on('error', reject);
    setTimeout(() => { ws.close(); reject(new Error('Timeout')); }, 30000);
  });
}

async function takeScreenshot(webSocketUrl, filename) {
  const result = await cdpCall(webSocketUrl, 'Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(result.data, 'base64');
  const filepath = path.join(SCREENSHOT_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  console.log(`  📷 Saved: ${filepath}`);
  return filepath;
}

async function navigate(webSocketUrl, url) {
  await cdpCall(webSocketUrl, 'Page.navigate', { url });
  await new Promise(r => setTimeout(r, 2000));
}

async function fillInput(webSocketUrl, selector, value) {
  const result = await cdpCall(webSocketUrl, 'DOM.getDocument', { depth: -1 });
  const root = result.root;
  
  // Simple approach: use Runtime.evaluate
  await cdpCall(webSocketUrl, 'Runtime.evaluate', {
    expression: `
      (function() {
        const input = document.querySelector('${selector}');
        if (input) {
          input.focus();
          input.value = '${value}';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return 'ok';
        }
        return 'not found';
      })()
    `
  });
}

async function clickElement(webSocketUrl, selector) {
  await cdpCall(webSocketUrl, 'Runtime.evaluate', {
    expression: `(function() { const el = document.querySelector('${selector}'); if(el) { el.click(); return 'ok'; } return 'not found'; })()`
  });
}

async function getMenus(webSocketUrl) {
  const result = await cdpCall(webSocketUrl, 'Runtime.evaluate', {
    expression: `
      (function() {
        const items = [];
        document.querySelectorAll('.nav-item, .nav-group-title').forEach(el => {
          const text = el.textContent.trim();
          if (text && text.length > 0 && !items.includes(text)) {
            items.push(text);
          }
        });
        return JSON.stringify(items);
      })()
    `
  });
  return JSON.parse(result.result.value);
}

async function main() {
  console.log('🎱 第3轮测试: 权限控制验证');
  console.log('时间:', new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
  
  // Get page WebSocket URL
  const version = await cdpRequest('/json/version');
  const browserWs = version.webSocketDebuggerUrl;
  
  // Get all pages
  const pages = await cdpRequest('/json');
  const loginPage = pages.find(p => p.url.includes('login'));
  
  if (!loginPage) {
    console.log('❌ 找不到登录页面，正在打开...');
    // Open new page
    const newPage = await cdpRequest('/json/new?https://tg.tiangong.club/admin/login.html', 'PUT');
    console.log('新页面:', newPage);
  }
  
  const targetPage = pages.find(p => p.url.includes('admin')) || loginPage;
  if (!targetPage) {
    console.log('❌ 无法找到后台管理页面');
    process.exit(1);
  }
  
  const pageWs = targetPage.webSocketDebuggerUrl;
  console.log(`📄 使用页面: ${targetPage.url}`);
  
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
    
    try {
      // Navigate to login
      await navigate(pageWs, 'https://tg.tiangong.club/admin/login.html');
      
      // Fill form
      await fillInput(pageWs, 'input[placeholder*="用户名"]', account.username);
      await new Promise(r => setTimeout(r, 300));
      await fillInput(pageWs, 'input[type="password"]', account.password);
      await new Promise(r => setTimeout(r, 300));
      
      // Click login
      await clickElement(pageWs, 'button:has-text("登录"), .login-btn, button[type="submit"]');
      
      // Wait for login
      await new Promise(r => setTimeout(r, 3000));
      
      // Get current URL
      const urlResult = await cdpCall(pageWs, 'Runtime.evaluate', {
        expression: 'window.location.href'
      });
      const url = urlResult.result.value;
      console.log(`   URL: ${url}`);
      
      if (account.expected === 'reject') {
        // 服务员应该被拒绝
        const errorResult = await cdpCall(pageWs, 'Runtime.evaluate', {
          expression: `
            (function() {
              const el = document.querySelector('.el-message, .alert, .error-msg, [class*="error"], [class*="message"]');
              return el ? el.textContent.trim() : '';
            })()
          `
        });
        const errorMsg = errorResult.result.value;
        console.log(`   Error: ${errorMsg || '(none)'}`);
        
        const blocked = url.includes('login') || (errorMsg && errorMsg.includes('不允许'));
        
        await takeScreenshot(pageWs, `TC-v3-${account.name}-拒绝登录.png`);
        
        results.push({
          account: account.name,
          status: blocked ? 'PASS' : 'FAIL',
          message: blocked ? `服务员被拒绝登录 ✅ (${errorMsg})` : `服务员不应能登录！`,
          url,
          error: errorMsg
        });
      } else {
        if (url.includes('login')) {
          await takeScreenshot(pageWs, `TC-v3-${account.name}-登录失败.png`);
          results.push({
            account: account.name,
            status: 'FAIL',
            message: `登录失败`,
            url
          });
        } else {
          // Get menus
          const menus = await getMenus(pageWs);
          console.log(`   Menus: ${menus.join(', ')}`);
          
          await takeScreenshot(pageWs, `TC-v3-${account.name}-菜单.png`);
          
          // Validate
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
      console.error(`   ❌ Error: ${err.message}`);
      results.push({
        account: account.name,
        status: 'ERROR',
        message: err.message
      });
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Summary
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
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
