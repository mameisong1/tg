#!/usr/bin/env node
/**
 * 台桌状态同步工具
 * 用法: node sync-tables-status.js
 * 
 * 功能:
 * 1. 自动检测并启动 mychrome（如需要）
 * 2. 打开或刷新台桌概览页面
 * 3. 采集台桌状态数据
 * 4. 更新 tables 表和 vip_rooms 表
 * 5. 关闭台桌概览标签页
 * 6. 写入日志文件
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const Database = require('better-sqlite3');

// 配置
const CDP_PORT = 9998;
const TARGET_URL = 'http://admin.taikeduo.com/#/storeOverview/tableOverview';
const AREAS = ['大厅区', 'TV区', '包厢区', '棋牌区', '虚拟区', '斯诺克区'];
const DB_PATH = '/TG/tgservice/db/tgservice.db';
const LOG_PATH = '/TG/tgservice/scripts/sync-tables-status.log';
const SYNC_STATUS_PATH = '/TG/tgservice/scripts/sync-status.json';
const CHROME_START_CMD = 'bash /root/chrome-sync';
const CREDENTIALS_PATH = '/root/.openclaw/credentials.json';

// 随机停顿函数（防止操作过快导致网络异常）
function randomSleep(minMs = 200, maxMs = 500) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// 获取台客多登录凭证
function getTaikeduoCredentials() {
  try {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    return credentials.taikeduo;
  } catch (err) {
    log(`读取凭证文件失败: ${err.message}`);
    return null;
  }
}

// 日志函数
function log(message) {
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const logLine = `[${timestamp}] ${message}`;
  
  // 只写入日志文件，不打印到 stdout（避免 cron 重定向导致重复）
  try {
    fs.appendFileSync(LOG_PATH, logLine + '\n', 'utf8');
  } catch (err) {
    console.error('写日志失败:', err.message);
  }
}

// 检查 Chrome 是否运行
async function isChromeRunning() {
  try {
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`, {
      timeout: 3000
    });
    return response.ok;
  } catch (err) {
    return false;
  }
}

// 检测是否有台桌关键元素（登录成功的标志）
async function checkTableElements(wsUrl) {
  try {
    const script = `
      (function() {
        const text = document.body.innerText;
        const html = document.body.innerHTML;
        
        // 检查台桌名称格式（普台1、普台2、TV1等）
        const hasTableNames = /普台\\d+|TV\\d+|包厢\\d+/.test(text);
        // 检查统计数据区域
        const hasStats = text.includes('今日营业额') || text.includes('台桌开台数');
        // 检查状态关键词
        const hasStatus = text.includes('空闲') || text.includes('计费中');
        
        // 新增：检测 Vue 应用是否已渲染
        const app = document.querySelector('#app');
        const appHasContent = app && app.innerHTML.length > 100;
        const bodyHasContent = text.length > 50;
        
        return {
          hasTableElements: hasTableNames || hasStats || hasStatus,
          hasTableNames: hasTableNames,
          hasStats: hasStats,
          hasStatus: hasStatus,
          // 新增字段
          appHasContent: appHasContent,
          bodyHasContent: bodyHasContent,
          bodyTextLength: text.length,
          appHTMLLength: app ? app.innerHTML.length : 0
        };
      })()
    `;
    const result = await executeScript(wsUrl, script);
    if (!result) {
      log('⚠️ checkTableElements 返回空结果');
      return {
        hasTableElements: false,
        hasTableNames: false,
        hasStats: false,
        hasStatus: false,
        appHasContent: false,
        bodyHasContent: false,
        bodyTextLength: 0,
        appHTMLLength: 0
      };
    }
    return result;
  } catch (err) {
    log(`❌ checkTableElements 失败: ${err.message}`);
    return {
      hasTableElements: false,
      hasTableNames: false,
      hasStats: false,
      hasStatus: false,
      appHasContent: false,
      bodyHasContent: false,
      bodyTextLength: 0,
      appHTMLLength: 0
    };
  }
}

// 检测是否有登录元素（需要登录的标志）
async function checkLoginElements(wsUrl) {
  try {
    const script = `
      (function() {
        const text = document.body.innerText;
        const html = document.body.innerHTML;
        const url = window.location.href;
        
        // 检查登录按钮
        const hasLoginBtn = text.includes('密码登录') || 
                            text.includes('登 录') ||
                            (text.includes('登录') && !text.includes('今日营业额'));
        
        // 检查登录输入框
        const hasPhoneInput = document.querySelector('input[placeholder*="手机号"]') !== null ||
                              document.querySelector('input[type="text"]') !== null;
        const hasPasswordInput = document.querySelector('input[type="password"]') !== null;
        
        // 检查URL是否包含login
        const isLoginUrl = url.includes('login');
        
        // 检查是否有侧边栏（登录后会有）
        const hasSidebar = document.querySelector('.sidebar, .el-menu, .nav-menu') !== null;
        
        // 新增：检测 Vue 应用是否已渲染
        const app = document.querySelector('#app');
        const appHasContent = app && app.innerHTML.length > 100;
        const bodyHasContent = text.length > 50;
        
        return {
          hasLoginElements: (hasLoginBtn || isLoginUrl) && !hasSidebar,
          hasLoginBtn: hasLoginBtn,
          hasPhoneInput: hasPhoneInput,
          hasPasswordInput: hasPasswordInput,
          isLoginUrl: isLoginUrl,
          hasSidebar: hasSidebar,
          url: url,
          // 新增字段
          appHasContent: appHasContent,
          bodyHasContent: bodyHasContent,
          bodyTextLength: text.length
        };
      })()
    `;
    const result = await executeScript(wsUrl, script);
    if (!result) {
      log('⚠️ checkLoginElements 返回空结果');
      return {
        hasLoginElements: false,
        hasLoginBtn: false,
        hasPhoneInput: false,
        hasPasswordInput: false,
        isLoginUrl: false,
        hasSidebar: false,
        url: '',
        appHasContent: false,
        bodyHasContent: false,
        bodyTextLength: 0
      };
    }
    return result;
  } catch (err) {
    log(`❌ checkLoginElements 失败: ${err.message}`);
    return {
      hasLoginElements: false,
      hasLoginBtn: false,
      hasPhoneInput: false,
      hasPasswordInput: false,
      isLoginUrl: false,
      hasSidebar: false,
      url: '',
      appHasContent: false,
      bodyHasContent: false,
      bodyTextLength: 0
    };
  }
}

// 检测是否在登录页面（兼容旧代码）
async function checkLoginPage(wsUrl) {
  const result = await checkLoginElements(wsUrl);
  return {
    isLoginPage: result.hasLoginElements,
    hasLoginBtn: result.hasLoginBtn,
    url: result.url
  };
}

// 自动登录
async function autoLogin(wsUrl) {
  log('检测到登录页面，尝试自动登录...');
  
  const credentials = getTaikeduoCredentials();
  if (!credentials) {
    throw new Error('无法获取台客多登录凭证');
  }
  
  log(`使用账号: ${credentials.username}`);
  
  // 点击密码登录按钮（必须点击内部的span元素）
  const clickPwdLogin = `
    (function() {
      // 必须点击内部的span.switch-text元素，外部div不会触发事件
      const span = document.querySelector('span.switch-text');
      if (span && span.innerText.includes('密码登录')) {
        span.click();
        return '已点击密码登录(span)';
      }
      
      // 备用：查找所有span
      const spans = document.querySelectorAll('span');
      for (const s of spans) {
        if (s.innerText === '密码登录') {
          s.click();
          return '已点击密码登录(备用)';
        }
      }
      
      return '未找到密码登录按钮';
    })()
  `;
  const pwdResult = await executeScript(wsUrl, clickPwdLogin);
  log(pwdResult);
  await randomSleep(1500, 2500); // 等待表单切换（随机1.5-2.5秒）
  
  // 查找并填写输入框（逐个填写，每个操作后随机停顿）
  const fillUsername = `
    (function() {
      const inputs = document.querySelectorAll('input');
      for (const input of inputs) {
        const type = input.type || 'text';
        const placeholder = input.placeholder || '';
        
        if (type === 'text' || placeholder.includes('手机号') || placeholder.includes('账号')) {
          input.focus();
          input.value = '${credentials.username}';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return '用户名已填写: ' + input.value;
        }
      }
      return '未找到用户名输入框';
    })()
  `;
  const usernameResult = await executeScript(wsUrl, fillUsername);
  log(usernameResult);
  await randomSleep(300, 600); // 填写用户名后随机停顿
  
  const fillPassword = `
    (function() {
      const inputs = document.querySelectorAll('input');
      for (const input of inputs) {
        if (input.type === 'password') {
          input.focus();
          input.value = '${credentials.password}';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return '密码已填写';
        }
      }
      return '未找到密码输入框';
    })()
  `;
  const passwordResult = await executeScript(wsUrl, fillPassword);
  log(passwordResult);
  await randomSleep(500, 1000); // 填写密码后随机停顿（稍长一些）
  
  // 点击登录按钮
  const clickLogin = `
    (function() {
      // 查找登录按钮（多种方式）
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.innerText;
        if (text.includes('登') && text.includes('录')) {
          btn.click();
          return '已点击登录按钮: ' + text;
        }
      }
      
      // 备用方式
      const allElements = document.querySelectorAll('button, div.button, span.button');
      for (const el of allElements) {
        if (el.innerText === '登 录' || el.innerText === '登录') {
          el.click();
          return '已点击登录按钮(备用)';
        }
      }
      
      return '未找到登录按钮';
    })()
  `;
  const loginResult = await executeScript(wsUrl, clickLogin);
  log(loginResult);
  
  // 等待登录完成（最长等待3分钟）
  log('等待登录完成（最长等待3分钟）...');
  const MAX_WAIT_MS = 3 * 60 * 1000; // 3分钟
  const CHECK_INTERVAL_MS = 5000; // 每5秒检查一次
  const startTime = Date.now();
  let attempt = 0;
  
  while (Date.now() - startTime < MAX_WAIT_MS) {
    attempt++;
    await randomSleep(CHECK_INTERVAL_MS, CHECK_INTERVAL_MS + 2000); // 5-7秒间隔
    
    const checkResult = await checkLoginPage(wsUrl);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    
    if (!checkResult.isLoginPage) {
      log(`自动登录成功（第 ${attempt} 次检查，耗时 ${elapsed} 秒）`);
      return true;
    }
    
    // 检查是否有台桌元素（可能已登录但URL没变）
    const tableCheck = await checkTableElements(wsUrl);
    if (tableCheck.hasTableElements) {
      log(`检测到台桌元素，登录成功（第 ${attempt} 次检查，耗时 ${elapsed} 秒）`);
      return true;
    }
    
    log(`登录检查第 ${attempt} 次: 仍在登录页面，已等待 ${elapsed} 秒`);
  }
  
  const totalElapsed = Math.round((Date.now() - startTime) / 1000);
  throw new Error(`自动登录失败，等待 ${totalElapsed} 秒后仍在登录页面且无台桌元素`);
}

// 启动 Chrome
async function startChrome() {
  log('mychrome 未运行，正在启动...');
  
  try {
    // 使用 spawn 在后台启动，确保 DISPLAY 环境变量
    const child = spawn('bash', ['/root/chrome-sync'], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, DISPLAY: ':1' }
    });
    child.unref();
    
    // 等待 Chrome 启动
    let retries = 0;
    while (retries < 30) {
      await new Promise(r => setTimeout(r, 1000));
      if (await isChromeRunning()) {
        log('mychrome 启动成功');
        return true;
      }
      retries++;
    }
    
    throw new Error('Chrome 启动超时');
  } catch (err) {
    throw new Error(`启动 Chrome 失败: ${err.message}`);
  }
}

// CDP 命令封装
function sendCommand(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Date.now() + Math.random();
    const handler = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          ws.off('message', handler);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      } catch (err) { reject(err); }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { ws.off('message', handler); reject(new Error(`Timeout: ${method}`)); }, 30000);
  });
}

// 获取所有页面
async function getPages() {
  const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  return await response.json();
}

// 创建新标签页并导航到目标URL
async function createNewTab() {
  // 方法1: 使用 /json/new API (需要 PUT 方法)
  try {
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(TARGET_URL)}`, {
      method: 'PUT'
    });
    const page = await response.json();
    if (page && page.id) {
      return page;
    }
  } catch (err) {
    log(`/json/new 失败: ${err.message}`);
  }
  
  // 方法2: 使用 CDP Target.createTarget
  try {
    const ws = new WebSocket(`ws://127.0.0.1:${CDP_PORT}/devtools/browser`);
    const result = await new Promise((resolve, reject) => {
      const id = 1;
      ws.on('open', () => {
        ws.send(JSON.stringify({
          id,
          method: 'Target.createTarget',
          params: { url: TARGET_URL }
        }));
      });
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          ws.close();
          resolve(msg.result);
        }
      });
      ws.on('error', reject);
      setTimeout(() => reject(new Error('超时')), 5000);
    });
    
    if (result && result.targetId) {
      // 等待页面创建
      await new Promise(r => setTimeout(r, 2000));
      const pages = await getPages();
      return pages.find(p => p.id === result.targetId);
    }
  } catch (err) {
    log(`Target.createTarget 失败: ${err.message}`);
  }
  
  return null;
}

// 通过 WebSocket 执行脚本
function executeScript(wsUrl, script) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let resolved = false;
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: script, returnByValue: true }
      }));
    });
    
    ws.on('message', (data) => {
      if (resolved) return;
      resolved = true;
      
      try {
        const msg = JSON.parse(data.toString());
        resolve(msg.result?.result?.value);
      } catch (err) {
        reject(err);
      }
      ws.close();
    });
    
    ws.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });
    
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        reject(new Error('执行脚本超时'));
      }
    }, 15000);
  });
}

// 导航到指定页面
function navigateTo(wsUrl, url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let resolved = false;
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Page.navigate',
        params: { url }
      }));
    });
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === 1) {
        if (resolved) return;
        resolved = true;
        ws.close();
        resolve();
      }
    });
    
    ws.on('error', reject);
    setTimeout(() => { 
      if (!resolved) { 
        resolved = true; 
        ws.close(); 
        resolve(); 
      } 
    }, 10000);
  });
}

// 等待页面加载完成（方案C：混合方案）
// 1. 启用 Page 域，监听 loadEventFired
// 2. 轮询检查关键元素是否存在
// 3. 最长等待30秒，超时报错
// 等待页面加载完成（改进版）
// 1. 启用 Page 域，监听 loadEventFired
// 2. 轮询检查关键元素是否存在（改进检测逻辑）
// 3. load事件触发后立即检查
// 4. 超时时先检查元素再决定是否失败（不轻易放弃）
// 5. 单一监听器处理所有消息（避免混乱）
async function waitForPageReady(wsUrl, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let resolved = false;
    let loadFired = false;
    let pollInterval = null;
    const startTime = Date.now();
    
    // 改进的元素检测表达式（建议2）
    const checkExpression = `
      (function() {
        const text = document.body.innerText;
        // 检查台桌名称格式（普台1、普台2等）
        const hasTableNames = /普台\\d+|TV\\d+|包厢\\d+/.test(text);
        // 检查统计数据区域
        const hasStats = text.includes('今日营业额') || text.includes('台桌开台数');
        // 检查状态关键词
        const hasStatus = text.includes('空闲') || text.includes('计费中');
        
        return hasTableNames || hasStats || hasStatus;
      })()
    `;
    
    // 获取详细页面状态的表达式（超时检查用）
    const detailCheckExpression = `
      (function() {
        const text = document.body.innerText;
        const hasTableNames = /普台\\d+|TV\\d+|包厢\\d+/.test(text);
        const hasStats = text.includes('今日营业额') || text.includes('台桌开台数');
        const hasStatus = text.includes('空闲') || text.includes('计费中');
        const hasLogin = text.includes('密码登录') || text.includes('登 录');
        
        return {
          hasElements: hasTableNames || hasStats || hasStatus,
          hasLogin: hasLogin,
          bodyPreview: text.substring(0, 100)
        };
      })()
    `;
    
    // 发送元素检测请求
    function sendCheck(checkId) {
      ws.send(JSON.stringify({
        id: checkId,
        method: 'Runtime.evaluate',
        params: { expression: checkExpression, returnByValue: true }
      }));
    }
    
    // 单一监听器处理所有消息（建议3）
    ws.on('message', (data) => {
      if (resolved) return;
      
      try {
        const msg = JSON.parse(data.toString());
        
        // Page.enable 响应 - 先等待 Vue 渲染，再开始轮询
        if (msg.id === 1) {
          // 等待 5 秒让 Vue 应用渲染
          setTimeout(() => {
            if (!resolved) sendCheck(100); // 首次检测（延迟5秒）
            pollInterval = setInterval(() => {
              if (!resolved) sendCheck(100 + Date.now() % 1000); // 每次用不同ID避免冲突
            }, 2000); // 每2秒轮询
          }, 5000);
          return;
        }
        
        // loadEventFired 事件 - 立即检查（建议5）
        if (msg.method === 'Page.loadEventFired') {
          loadFired = true;
          log('页面 load 事件触发');
          sendCheck(101); // 立即发送检测请求
          return;
        }
        
        // 元素检测结果
        if (msg.id >= 100 && msg.id < 2000 && msg.result?.result) {
          if (msg.result.result.value === true) {
            resolved = true;
            if (pollInterval) clearInterval(pollInterval);
            ws.send(JSON.stringify({ id: 2, method: 'Page.disable' }));
            ws.close();
            log(`页面加载完成，耗时 ${Date.now() - startTime}ms`);
            resolve();
          }
          // 如果检测失败，继续等待下一次轮询
        }
        
        // 详细检测结果（超时时的最终检查）
        if (msg.id === 900 || msg.id === 901) {
          const result = msg.result?.result?.value;
          if (result && result.hasElements) {
            log(`超时后检查发现页面元素已存在！内容预览: ${result.bodyPreview}`);
            resolved = true;
            if (pollInterval) clearInterval(pollInterval);
            ws.send(JSON.stringify({ id: 2, method: 'Page.disable' }));
            ws.close();
            resolve();
          } else {
            log(`超时后检查结果: hasElements=${result?.hasElements}, hasLogin=${result?.hasLogin}`);
          }
        }
        
      } catch (err) {
        // 忽略解析错误，继续等待
      }
    });
    
    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
    });
    
    ws.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        if (pollInterval) clearInterval(pollInterval);
        reject(err);
      }
    });
    
    // 总超时 - 超时时多次检查元素，不轻易放弃
    setTimeout(async () => {
      if (!resolved) {
        log(`到达超时时间 (${timeoutMs}ms)，进行最后检查...`);
        
        // 发送详细检测请求
        ws.send(JSON.stringify({
          id: 900,
          method: 'Runtime.evaluate',
          params: { expression: detailCheckExpression, returnByValue: true }
        }));
        
        // 等待响应
        await new Promise(r => setTimeout(r, 2000));
        
        // 如果仍未解决，再检查一次
        if (!resolved) {
          ws.send(JSON.stringify({
            id: 901,
            method: 'Runtime.evaluate',
            params: { expression: detailCheckExpression, returnByValue: true }
          }));
          
          await new Promise(r => setTimeout(r, 2000));
        }
        
        // 确实超时失败
        if (!resolved) {
          resolved = true;
          if (pollInterval) clearInterval(pollInterval);
          ws.close();
          reject(new Error(`页面加载超时 (${timeoutMs}ms)，多次检查后仍未找到关键元素`));
        }
      }
    }, timeoutMs);
  });
}

// 关闭标签页
async function closeTab(targetId) {
  try {
    const ws = new WebSocket(`ws://127.0.0.1:${CDP_PORT}/devtools/page/${targetId}`);
    
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ id: 1, method: 'Page.close' }));
      });
      
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === 1) {
          ws.close();
          resolve();
        }
      });
      
      ws.on('error', resolve);
      setTimeout(resolve, 3000);
    });
  } catch (err) {
    log(`关闭标签页失败: ${err.message}`);
  }
}

// 获取或打开目标页面（改进版）
// 1. 打开概览页面后检测页面
// 2. 如果有台桌关键元素 → 登录成功，进入台桌页面
// 3. 如果没有台桌元素 → 检测是否有登录元素 → 进入重新登录流程
async function getTargetPage() {
  const pages = await getPages();
  
  // 查找台客多相关页面
  const findTaikeduoPage = (pageList) => {
    return pageList.find(p => p.url && p.url.includes('admin.taikeduo.com'));
  };
  
  // 查找可用的标签页（新标签页或空白页）
  const findUsablePage = (pageList) => {
    return pageList.find(p => 
      p.webSocketDebuggerUrl && (
        p.url?.includes('chrome://newtab') || 
        p.url?.includes('about:blank') ||
        p.url?.includes('chrome-untrusted')
      )
    );
  };
  
  // 获取当前所有页面并等待页面稳定
  let currentPage = findTaikeduoPage(pages);
  
  // 检查找到的台客多页面是否需要刷新（Vue 应用未渲染）
  if (currentPage && currentPage.url.includes('tableOverview')) {
    log(`找到台桌概览页面，检查渲染状态...`);
    
    // 检测页面是否有内容
    const renderCheck = await checkTableElements(currentPage.webSocketDebuggerUrl);
    
    if (!renderCheck.bodyHasContent || !renderCheck.appHasContent) {
      log(`页面内容为空（body=${renderCheck.bodyTextLength}, app=${renderCheck.appHTMLLength}），需要刷新页面`);
      // 刷新页面
      await executeScript(currentPage.webSocketDebuggerUrl, 'location.reload()');
      log('已刷新页面，等待重新加载...');
      await randomSleep(10000, 15000); // 刷新后等待 10-15 秒
    } else {
      log(`页面已有内容（body=${renderCheck.bodyTextLength}, app=${renderCheck.appHTMLLength}）`);
    }
  }
  
  // 如果没有台客多页面，找一个可用的标签页
  if (!currentPage) {
    currentPage = findUsablePage(pages);
  }
  
  // 还是没有，尝试创建新标签页
  if (!currentPage) {
    log('没有可用标签页，尝试创建新标签页...');
    await createNewTab();
    await new Promise(r => setTimeout(r, 2000));
    const newPages = await getPages();
    currentPage = findTaikeduoPage(newPages) || findUsablePage(newPages);
  }
  
  if (!currentPage) {
    throw new Error('无法找到或创建可用标签页');
  }
  
  log(`使用页面: ${currentPage.url}`);
  
  // 步骤1: 导航到台桌概览页面
  log(`导航到台桌概览页面: ${TARGET_URL}`);
  await navigateTo(currentPage.webSocketDebuggerUrl, TARGET_URL);
  
  // 等待页面加载（台客多页面打开非常慢，至少等待15秒）
  log('等待页面渲染（台客多页面较慢，等待15秒）...');
  await randomSleep(12000, 18000); // 随机12-18秒
  
  // 步骤2: 检测是否有台桌关键元素（多次检测，不轻易放弃）
  // 台客多页面可能需要3分钟才能加载完成，所以最多检测18次，每次间隔10秒
  log('检测台桌关键元素（最多检测18次，总时长约3分钟）...');
  
  const maxAttempts = 18;  // 最多检测18次
  const checkIntervalMs = 10000;  // 每次间隔10秒
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const elapsedSec = Math.round((attempt - 1) * checkIntervalMs / 1000 + 15);
    log(`元素检测第 ${attempt} 次（已等待约 ${elapsedSec} 秒）...`);
    
    const tableCheck = await checkTableElements(currentPage.webSocketDebuggerUrl);
    
    // 新增：输出详细检测信息
    log(`检测结果: body=${tableCheck.bodyTextLength}, app=${tableCheck.appHTMLLength}, tables=${tableCheck.hasTableNames}, stats=${tableCheck.hasStats}`);
    
    if (tableCheck.hasTableElements) {
      log('✓ 检测到台桌元素，登录成功');
      // 等待页面完全加载（使用 waitForPageReady 的长超时）
      await waitForPageReady(currentPage.webSocketDebuggerUrl, 180000); // 3分钟超时
      
      // 重新获取页面确保是最新的
      const finalPages = await getPages();
      const finalPage = finalPages.find(p => p.url && p.url.includes('tableOverview'));
      return { page: finalPage || currentPage, shouldClose: true };
    }
    
    // 检测是否有登录元素（需要登录）
    const loginCheck = await checkLoginElements(currentPage.webSocketDebuggerUrl);
    
    if (loginCheck.hasLoginElements) {
      log('✓ 检测到登录元素，需要重新登录');
      log(`当前URL: ${loginCheck.url}`);
      
      // 执行自动登录
      await autoLogin(currentPage.webSocketDebuggerUrl);
      
      // 登录后重新导航到台桌概览
      log('登录成功，导航到台桌概览...');
      await navigateTo(currentPage.webSocketDebuggerUrl, TARGET_URL);
      
      // 等待页面加载（登录后也要等够时间）
      log('等待页面渲染（15秒）...');
      await randomSleep(12000, 18000);
      
      // 再次检测台桌元素（多次检测，登录后最多检测10次）
      for (let loginAttempt = 1; loginAttempt <= 10; loginAttempt++) {
        const recheck = await checkTableElements(currentPage.webSocketDebuggerUrl);
        if (recheck.hasTableElements) {
          log('✓ 登录后检测到台桌元素');
          await waitForPageReady(currentPage.webSocketDebuggerUrl, 180000);
          
          const finalPages = await getPages();
          const finalPage = finalPages.find(p => p.url && p.url.includes('tableOverview'));
          return { page: finalPage || currentPage, shouldClose: true };
        }
        
        log(`登录后元素检测第 ${loginAttempt} 次: 未检测到台桌元素`);
        if (loginAttempt < 10) {
          await randomSleep(8000, 12000); // 等待8-12秒再检查
        }
      }
      
      throw new Error('登录后多次检测仍未找到台桌元素，登录可能失败');
    }
    
    // 既没有台桌元素也没有登录元素，继续等待
    log(`第 ${attempt} 次检测: 未检测到台桌元素或登录元素，继续等待...`);
    
    if (attempt < maxAttempts) {
      // 等待10秒再试（固定间隔，便于计算总时间）
      await new Promise(r => setTimeout(r, checkIntervalMs));
    }
  }
  
  // 18次检测后仍未找到元素（已等待约3分钟），输出调试信息
  const pageUrl = await executeScript(currentPage.webSocketDebuggerUrl, 'window.location.href');
  const pageTitle = await executeScript(currentPage.webSocketDebuggerUrl, 'document.title');
  const bodyPreview = await executeScript(currentPage.webSocketDebuggerUrl, 'document.body.innerText.substring(0, 200)');
  log(`页面调试信息 - URL: ${pageUrl}, 标题: ${pageTitle}, 内容预览: ${bodyPreview}`);
  
  throw new Error('等待3分钟后仍无法识别页面状态，既没有台桌元素也没有登录元素');
}

// 获取页面内容
async function getPageContent(wsUrl) {
  const content = await executeScript(wsUrl, 'document.body.innerText');
  if (!content) {
    throw new Error('无法获取页面内容');
  }
  return content;
}

// 解析台桌数据
function parseTableData(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const result = [];
  let currentArea = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (AREAS.includes(line)) {
      currentArea = line;
      continue;
    }
    
    if (line === '空闲' || line.startsWith('计费中') || line.startsWith('已暂停')) {
      const tableName = lines[i - 1];
      if (tableName && !AREAS.includes(tableName) && 
          tableName !== '空闲' && !tableName.startsWith('计费中') && !tableName.startsWith('已暂停') &&
          !tableName.includes('营业额') && !tableName.includes('未结') && !tableName.includes('开台数')) {
        
        let status = '空闲';
        if (line.startsWith('计费中')) status = '计费中';
        else if (line.startsWith('已暂停')) status = '已暂停';
        
        result.push({
          area: currentArea,
          name: tableName,
          status: status
        });
      }
    }
  }
  
  return result;
}

// 状态转换：空闲保持空闲，已暂停保持已暂停，其他统一为"接待中"
function convertStatus(status) {
  if (status === '空闲') return '空闲';
  if (status === '已暂停') return '已暂停';
  return '接待中';
}

// 写入同步状态文件
function writeSyncStatus(success, tablesCount = 0, errorMsg = '') {
  const status = {
    success,
    lastSyncTime: new Date().toISOString(),
    lastSyncTimeLocal: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    tablesCount,
    errorMsg
  };
  
  try {
    fs.writeFileSync(SYNC_STATUS_PATH, JSON.stringify(status, null, 2), 'utf8');
  } catch (err) {
    log(`写入状态文件失败: ${err.message}`);
  }
}

// 更新数据库
function updateDatabase(tables) {
  const db = new Database(DB_PATH);
  
  // 更新 tables 表
  const updateTable = db.prepare(`
    UPDATE tables 
    SET status = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE name = ?
  `);
  
  let tablesUpdated = 0;
  for (const table of tables) {
    const dbStatus = convertStatus(table.status);
    const result = updateTable.run(dbStatus, table.name);
    if (result.changes > 0) {
      tablesUpdated++;
    }
  }
  
  // 更新 vip_rooms 表（name 匹配台桌名前缀）
  const updateVipRoom = db.prepare(`
    UPDATE vip_rooms 
    SET status = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE name LIKE ? || '%'
  `);
  
  let vipRoomsUpdated = 0;
  for (const table of tables) {
    const dbStatus = convertStatus(table.status);
    const result = updateVipRoom.run(dbStatus, table.name);
    if (result.changes > 0) {
      vipRoomsUpdated += result.changes;
    }
  }
  
  db.close();
  
  return { tablesUpdated, vipRoomsUpdated };
}

// 主函数
async function main() {
  const startTime = Date.now();
  log('开始同步...');
  
  try {
    // 1. 检查并启动 Chrome
    if (!await isChromeRunning()) {
      await startChrome();
    }
    
    // 2. 获取或打开目标页面（会自动等待页面加载完成）
    const { page, shouldClose } = await getTargetPage();
    log(`页面URL: ${page.url}`);
    
    // 3. 获取页面内容
    const pages = await getPages();
    const currentPage = pages.find(p => p.url && p.url.includes('tableOverview') && !p.url.includes('login'));
    
    if (!currentPage) {
      throw new Error('无法找到台桌概览页面');
    }
    
    const content = await getPageContent(currentPage.webSocketDebuggerUrl);
    log('页面内容获取成功');
    log(`页面内容长度: ${content.length} 字符`);
    
    // 4. 解析数据
    const tables = parseTableData(content);
    
    if (tables.length === 0) {
      // 输出页面内容以便调试
      log('=== 页面内容预览 (前500字符) ===');
      log(content.substring(0, 500));
      log('=== 页面内容预览结束 ===');
      throw new Error('未能解析到任何台桌数据，页面可能未正确加载');
    }
    
    log(`采集到 ${tables.length} 个台桌`);
    
    // 输出部分数据样本
    log('台桌数据样本: ' + JSON.stringify(tables.slice(0, 3)));
    
    // 5. 更新数据库
    const { tablesUpdated, vipRoomsUpdated } = updateDatabase(tables);
    log(`tables 表更新: ${tablesUpdated} 条`);
    log(`vip_rooms 表更新: ${vipRoomsUpdated} 条`);
    
    // 6. 关闭标签页
    if (shouldClose && currentPage.id) {
      await closeTab(currentPage.id);
      log('已关闭台桌概览标签页');
    }
    
    // 7. 写入同步状态（成功）
    const elapsed = Date.now() - startTime;
    writeSyncStatus(true, tables.length);
    log(`同步完成，耗时 ${elapsed}ms`);
    
  } catch (err) {
    // 写入同步状态（失败）
    const elapsed = Date.now() - startTime;
    writeSyncStatus(false, 0, err.message);
    
    // 调用错误上报接口
    try {
      const apiUrl = process.env.TGSERVICE_API_URL || 'http://127.0.0.1:8081';
      const response = await fetch(`${apiUrl}/api/admin/sync/tables/error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_message: err.message,
          tablesCount: 0,
          elapsedMs: elapsed
        })
      });
      if (response.ok) {
        log('错误已上报到服务器');
      } else {
        log(`错误上报失败: HTTP ${response.status}`);
      }
    } catch (reportErr) {
      log(`错误上报请求失败: ${reportErr.message}`);
    }
    
    // 完整错误日志输出
    log('=== 同步失败 ===');
    log(`错误类型: ${err.name}`);
    log(`错误消息: ${err.message}`);
    log(`错误堆栈: ${err.stack}`);
    log(`耗时: ${elapsed}ms`);
    
    // 尝试获取当前页面状态用于调试
    try {
      const pages = await getPages();
      const page = pages.find(p => p.url && p.url.includes('admin.taikeduo.com'));
      if (page) {
        const pageUrl = await executeScript(page.webSocketDebuggerUrl, 'window.location.href');
        const pageTitle = await executeScript(page.webSocketDebuggerUrl, 'document.title');
        const bodyPreview = await executeScript(page.webSocketDebuggerUrl, 'document.body.innerText.substring(0, 300)');
        log(`当前页面 - URL: ${pageUrl}, 标题: ${pageTitle}`);
        log(`页面内容预览: ${bodyPreview}`);
      }
    } catch (debugErr) {
      log(`获取页面调试信息失败: ${debugErr.message}`);
    }
    
    log('=== 错误日志结束 ===');
    process.exit(1);
  }
}

main();