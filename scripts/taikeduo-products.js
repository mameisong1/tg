#!/usr/bin/env node
/**
 * 台客多后台商品列表数据采集工具
 * 用法: node taikeduo-products.js [--output <filepath>]
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const CDP_PORT = 9222;
const TARGET_URL = 'https://admin.taikeduo.com/#/productManagement/productList';

function parseArgs() {
  const args = process.argv.slice(2);
  const config = { output: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') config.output = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`用法: node taikeduo-products.js [-o output.json]`);
      process.exit(0);
    }
  }
  return config;
}

// 获取或打开目标页面
async function getTargetPage() {
  const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const pages = await response.json();
  
  // 查找商品列表页面
  let targetPage = pages.find(p => 
    p.url && p.url.includes('admin.taikeduo.com') && p.url.includes('productList')
  );
  
  if (targetPage) {
    // 找到了，刷新页面
    console.error('找到商品列表页面，正在刷新...');
    await refreshPage(targetPage.webSocketDebuggerUrl);
  } else {
    // 没找到，查找台客多页面并导航
    const taikeduoPage = pages.find(p => p.url && p.url.includes('admin.taikeduo.com'));
    
    if (taikeduoPage) {
      console.error('找到台客多页面，正在导航到商品列表...');
      await navigatePage(taikeduoPage.webSocketDebuggerUrl, TARGET_URL);
    } else {
      throw new Error('未找到台客多页面，请确保已在Chrome中登录台客多后台');
    }
    
    // 重新获取页面
    await new Promise(r => setTimeout(r, 2000));
    const response2 = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const pages2 = await response2.json();
    targetPage = pages2.find(p => p.url && p.url.includes('productList'));
    
    if (!targetPage) {
      throw new Error('导航失败，请手动打开商品列表页面');
    }
  }
  
  return targetPage;
}

// 刷新页面
function refreshPage(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let resolved = false;
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: 'location.reload()', returnByValue: true }
      }));
    });
    
    ws.on('message', () => {
      if (resolved) return;
      resolved = true;
      ws.close();
      setTimeout(resolve, 2000);
    });
    
    ws.on('error', () => { if (!resolved) { resolved = true; resolve(); } });
    setTimeout(() => { if (!resolved) { resolved = true; ws.close(); resolve(); } }, 5000);
  });
}

// 导航到指定页面
function navigatePage(wsUrl, url) {
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
        setTimeout(resolve, 2000);
      }
    });
    
    ws.on('error', reject);
    setTimeout(() => { if (!resolved) { resolved = true; ws.close(); resolve(); } }, 10000);
  });
}

// 在浏览器端执行的采集函数
const BROWSER_SCRIPT = `
(async function() {
  const allProducts = [];
  let pageNum = 1;
  
  function getTotalCount() {
    const match = document.body.innerText.match(/共\\s*(\\d+)\\s*条/);
    return match ? parseInt(match[1]) : 0;
  }
  
  function getCurrentPageProducts() {
    const products = [];
    const rows = document.querySelectorAll('.el-table__body-wrapper tbody tr');
    
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 11) return;
      
      const name = cells[0].innerText.trim();
      const imgEl = cells[1].querySelector('img');
      const image = imgEl ? imgEl.src : '';
      const price = cells[2].innerText.trim();
      
      const stockText = cells[3].innerText;
      const totalMatch = stockText.match(/总:\\s*(\\d+)/);
      const availMatch = stockText.match(/可用:\\s*(\\d+)/);
      const frozenMatch = stockText.match(/冻结:\\s*(\\d+)/);
      
      const category = cells[4].innerText.trim();
      const statusText = cells[7].innerText;
      const status = statusText.includes('上架') ? '上架' : '下架';
      const creator = cells[9].innerText.trim();
      const createTime = cells[10].innerText.trim();
      
      if (name) {
        products.push({
          name, image, price,
          stock: {
            total: totalMatch ? parseInt(totalMatch[1]) : 0,
            available: availMatch ? parseInt(availMatch[1]) : 0,
            frozen: frozenMatch ? parseInt(frozenMatch[1]) : 0
          },
          category, status, creator, createTime
        });
      }
    });
    return products;
  }
  
  function clickNextPage() {
    const nextBtn = document.querySelector('.btn-next');
    if (nextBtn && !nextBtn.classList.contains('disabled')) {
      nextBtn.click();
      return true;
    }
    return false;
  }
  
  function waitForNewData(prevCount) {
    return new Promise(resolve => {
      let attempts = 0;
      const check = () => {
        const rows = document.querySelectorAll('.el-table__body-wrapper tbody tr');
        if (rows.length > 0 && rows.length !== prevCount) {
          resolve(true);
        } else if (attempts++ < 30) {
          setTimeout(check, 200);
        } else {
          resolve(false);
        }
      };
      setTimeout(check, 500);
    });
  }
  
  const totalCount = getTotalCount();
  console.log('总记录数:', totalCount);
  
  console.log('采集第 1 页...');
  allProducts.push(...getCurrentPageProducts());
  console.log('已采集:', allProducts.length);
  
  while (true) {
    const prevFirst = document.querySelector('.el-table__body-wrapper tbody tr td')?.innerText;
    
    if (!clickNextPage()) {
      console.log('已到最后一页');
      break;
    }
    
    pageNum++;
    await new Promise(r => setTimeout(r, 1500));
    await waitForNewData(20);
    
    console.log('采集第', pageNum, '页...');
    const products = getCurrentPageProducts();
    console.log('本页:', products.length, '条');
    
    const newFirst = document.querySelector('.el-table__body-wrapper tbody tr td')?.innerText;
    if (newFirst === prevFirst) {
      console.log('检测到循环，停止');
      break;
    }
    
    allProducts.push(...products);
    console.log('已采集:', allProducts.length);
    
    if (pageNum > 15 || allProducts.length >= totalCount) break;
  }
  
  return { totalCount, collectedCount: allProducts.length, pages: pageNum, products: allProducts };
})()
`;

async function main() {
  const config = parseArgs();
  console.error('正在连接Chrome DevTools...');
  
  try {
    const page = await getTargetPage();
    
    // 重新获取websocket连接
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const pages = await response.json();
    const currentPage = pages.find(p => p.url && p.url.includes('productList'));
    
    console.error(`页面URL: ${currentPage.url}`);
    
    const ws = new WebSocket(currentPage.webSocketDebuggerUrl);
    
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('连接超时')), 10000);
    });
    
    console.error('开始采集（浏览器端执行）...\n');
    
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    
    ws.send(JSON.stringify({
      id: 2,
      method: 'Runtime.evaluate',
      params: { expression: BROWSER_SCRIPT, returnByValue: true, awaitPromise: true }
    }));
    
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('采集超时')), 180000);
      
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        
        if (msg.method === 'Runtime.consoleAPICalled') {
          const args = msg.params?.args || [];
          const log = args.map(a => a.value || '').join(' ');
          console.error(log);
        }
        
        if (msg.id === 2) {
          clearTimeout(timeout);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result?.result?.value);
        }
      });
    });
    
    ws.close();
    
    const data = typeof result === 'string' ? JSON.parse(result) : result;
    
    console.error('\n========================================');
    console.error(`采集完成！`);
    console.error(`总记录数: ${data.totalCount}`);
    console.error(`实际采集: ${data.collectedCount}`);
    console.error(`总页数: ${data.pages}`);
    console.error('========================================\n');
    
    const output = JSON.stringify({
      timestamp: new Date().toISOString(),
      shop: '中山天宫国际台球城',
      ...data
    }, null, 2);
    
    if (config.output) {
      const dir = path.dirname(config.output);
      if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(config.output, output, 'utf8');
      console.error(`已保存到: ${config.output}\n`);
    }
    
    console.log(output);
    
  } catch (err) {
    console.error('错误:', err.message);
    process.exit(1);
  }
}

main();