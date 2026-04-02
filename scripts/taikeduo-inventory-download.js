#!/usr/bin/env node
/**
 * 台客多库存报表下载工具
 * 用法: node taikeduo-inventory-download.js [--output <filepath>]
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const CDP_PORT = 9222;
const TARGET_URL = 'https://admin.taikeduo.com/#/reportCenter/InventorySection/InventoryInformationReport';
const DEFAULT_DOWNLOAD_DIR = '/root/Downloads';
const DEFAULT_OUTPUT_DIR = '/TG/data';

let config = {};

function parseArgs() {
  const args = process.argv.slice(2);
  config = {
    output: path.join(DEFAULT_OUTPUT_DIR, 'inventory-report.json'),
    keepXlsx: false,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') {
      config.output = args[++i];
    } else if (args[i] === '--keep-xlsx') {
      config.keepXlsx = true;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      config.verbose = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
台客多库存报表下载工具

用法:
  node taikeduo-inventory-download.js [选项]

选项:
  --output, -o <file>   JSON输出文件路径
  --keep-xlsx           保留原始xlsx文件
  --verbose, -v         显示详细日志
`);
      process.exit(0);
    }
  }

  return config;
}

// 获取或打开目标页面
async function getTargetPage() {
  const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const pages = await response.json();
  
  // 查找库存报表页面
  let targetPage = pages.find(p => 
    p.url && p.url.includes('admin.taikeduo.com') && p.url.includes('InventoryInformationReport')
  );
  
  if (targetPage) {
    // 找到了，刷新页面
    console.error('找到库存报表页面，正在刷新...');
    await refreshPage(targetPage.webSocketDebuggerUrl);
  } else {
    // 没找到，查找台客多页面并导航
    const taikeduoPage = pages.find(p => p.url && p.url.includes('admin.taikeduo.com'));
    
    if (taikeduoPage) {
      console.error('找到台客多页面，正在导航到库存报表...');
      await navigatePage(taikeduoPage.webSocketDebuggerUrl, TARGET_URL);
    } else {
      throw new Error('未找到台客多页面，请确保已在Chrome中登录台客多后台');
    }
    
    // 重新获取页面
    await new Promise(r => setTimeout(r, 2000));
    const response2 = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const pages2 = await response2.json();
    targetPage = pages2.find(p => p.url && p.url.includes('InventoryInformationReport'));
    
    if (!targetPage) {
      throw new Error('导航失败，请手动打开库存报表页面');
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

// CDP命令封装
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

async function evaluateScript(ws, script) {
  const result = await sendCommand(ws, 'Runtime.evaluate', { expression: script, returnByValue: true });
  return result.result?.value;
}

// 点击导出按钮并等待下载
async function downloadReport(ws) {
  // 设置下载行为（使用Page.setDownloadBehavior而不是Browser.setDownloadBehavior）
  try {
    await sendCommand(ws, 'Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: DEFAULT_DOWNLOAD_DIR
    });
    if (config.verbose) console.error('已设置下载路径:', DEFAULT_DOWNLOAD_DIR);
  } catch (e) {
    if (config.verbose) console.error('设置下载路径失败，使用默认路径');
  }
  
  const clickResult = await evaluateScript(ws, `
    (function() {
      const buttons = document.querySelectorAll('button, .el-button');
      for (const btn of buttons) {
        if (btn.innerText.includes('导出excel') || btn.innerText.includes('导出Excel') || btn.innerText.includes('导出')) {
          btn.click();
          return '已点击导出按钮';
        }
      }
      return '未找到导出按钮';
    })()
  `);
  
  if (config.verbose) console.error(clickResult);
  
  if (clickResult.includes('未找到')) {
    throw new Error('未找到导出按钮，请检查页面是否正确加载');
  }
  
  if (config.verbose) console.error('等待下载...');
  await new Promise(r => setTimeout(r, 5000));
  
  const files = fs.readdirSync(DEFAULT_DOWNLOAD_DIR)
    .filter(f => f.endsWith('.xlsx') && f.includes('库存'))
    .map(f => ({
      name: f,
      path: path.join(DEFAULT_DOWNLOAD_DIR, f),
      time: fs.statSync(path.join(DEFAULT_DOWNLOAD_DIR, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);
  
  if (files.length === 0) {
    throw new Error('下载失败，未找到xlsx文件');
  }
  
  return files[0];
}

function parseXlsx(xlsxPath) {
  if (config.verbose) console.error('解析xlsx文件:', xlsxPath);
  
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(ws);
  
  const data = rawData.slice(1);
  
  const headers = [
    '商品名称', '商品分类', '总库存', '总成本', '可用库存', '可用成本',
    '冻结库存', '冻结成本', '寄存数量', '零售价', '库存平均价', '末次进价',
    '商品状态', '更新时间'
  ];
  
  const products = data.map(row => {
    const values = Object.values(row);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || '';
    });
    return obj;
  });
  
  const stats = {
    total: products.length,
    categories: {}
  };
  
  products.forEach(p => {
    const cat = p['商品分类'] || '未知';
    stats.categories[cat] = (stats.categories[cat] || 0) + 1;
  });
  
  return { products, stats };
}

async function main() {
  parseArgs();
  
  console.error('正在连接Chrome DevTools...');
  
  try {
    const page = await getTargetPage();
    
    // 重新获取websocket连接
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const pages = await response.json();
    const currentPage = pages.find(p => p.url && p.url.includes('InventoryInformationReport'));
    
    console.error(`页面URL: ${currentPage.url}`);
    
    const ws = new WebSocket(currentPage.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('WebSocket连接超时')), 10000);
    });
    
    // 等待页面加载完成
    console.error('等待页面加载...');
    await new Promise(r => setTimeout(r, 3000));
    
    console.error('正在下载库存报表...');
    const downloadedFile = await downloadReport(ws);
    console.error(`已下载: ${downloadedFile.path}`);
    
    ws.close();
    
    const { products, stats } = parseXlsx(downloadedFile.path);
    
    console.error('\n========================================');
    console.error('库存报表下载完成！');
    console.error(`商品总数: ${stats.total}`);
    console.error(`分类统计:`);
    Object.entries(stats.categories)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        console.error(`  ${cat}: ${count}`);
      });
    console.error('========================================\n');
    
    const output = {
      timestamp: new Date().toISOString(),
      shop: '中山天宫国际台球城',
      source: downloadedFile.name,
      ...stats,
      products
    };
    
    const outputDir = path.dirname(config.output);
    if (outputDir && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(config.output, JSON.stringify(output, null, 2), 'utf8');
    console.error(`已保存到: ${config.output}\n`);
    
    const xlsxCopy = path.join(DEFAULT_OUTPUT_DIR, downloadedFile.name);
    fs.copyFileSync(downloadedFile.path, xlsxCopy);
    console.error(`xlsx副本: ${xlsxCopy}`);
    
    console.log(JSON.stringify(output, null, 2));
    
  } catch (err) {
    console.error('错误:', err.message);
    process.exit(1);
  }
}

main();