#!/usr/bin/env node
/**
 * 台客多后台台桌数据采集工具
 * 用法: node taikeduo-tables.js [--output <filepath>] [--format json|summary]
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// 配置
const CDP_PORT = 9222;
const TARGET_URL = 'https://admin.taikeduo.com/#/storeOverview/tableOverview';
const AREAS = ['大厅区', 'TV区', '包厢区', '棋牌区', '虚拟区', '斯诺克区'];

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    output: null,
    format: 'json'
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') {
      config.output = args[++i];
    } else if (args[i] === '--format' || args[i] === '-f') {
      config.format = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
台客多台桌数据采集工具

用法:
  node taikeduo-tables.js [选项]

选项:
  --output, -o <file>   输出文件路径
  --format, -f <type>   输出格式: json | summary (默认: json)
  --help, -h            显示帮助信息
`);
      process.exit(0);
    }
  }

  return config;
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

// 获取或打开目标页面
async function getTargetPage() {
  const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const pages = await response.json();
  
  // 查找台桌概览页面
  let targetPage = pages.find(p => 
    p.url && p.url.includes('admin.taikeduo.com') && p.url.includes('tableOverview')
  );
  
  if (targetPage) {
    // 找到了，刷新页面
    console.error('找到台桌概览页面，正在刷新...');
    await refreshPage(targetPage.webSocketDebuggerUrl);
  } else {
    // 没找到，查找台客多页面并导航
    const taikeduoPage = pages.find(p => p.url && p.url.includes('admin.taikeduo.com'));
    
    if (taikeduoPage) {
      console.error('找到台客多页面，正在导航到台桌概览...');
      await navigatePage(taikeduoPage.webSocketDebuggerUrl, TARGET_URL);
    } else {
      throw new Error('未找到台客多页面，请确保已在Chrome中登录台客多后台');
    }
    
    // 重新获取页面
    await new Promise(r => setTimeout(r, 2000));
    const response2 = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const pages2 = await response2.json();
    targetPage = pages2.find(p => p.url && p.url.includes('tableOverview'));
    
    if (!targetPage) {
      throw new Error('导航失败，请手动打开台桌概览页面');
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

// 通过CDP获取页面内容
function getPageContent(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let resolved = false;
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `document.body.innerText`,
          returnByValue: true
        }
      }));
    });
    
    ws.on('message', (data) => {
      if (resolved) return;
      resolved = true;
      
      try {
        const msg = JSON.parse(data.toString());
        if (msg.result?.result?.value) {
          resolve(msg.result.result.value);
        } else {
          reject(new Error('无法获取页面内容'));
        }
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
        reject(new Error('获取页面内容超时'));
      }
    }, 10000);
  });
}

// 解析台桌数据
function parseTableData(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const result = [];
  let currentArea = '';
  const stats = {
    totalRevenue: 0,
    unsettled: 0,
    activeTables: 0,
    totalTables: 0
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('今日营业额')) {
      const match = line.match(/今日营业额[：:]\s*([\d.]+)元/);
      if (match) stats.totalRevenue = parseFloat(match[1]);
    }
    if (line.includes('台桌未结')) {
      const match = line.match(/台桌未结[：:]\s*([\d.]+)元/);
      if (match) stats.unsettled = parseFloat(match[1]);
    }
    if (line.includes('台桌开台数')) {
      const match = line.match(/台桌开台数[：:]\s*(\d+)\/(\d+)/);
      if (match) {
        stats.activeTables = parseInt(match[1]);
        stats.totalTables = parseInt(match[2]);
      }
    }
    
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
  
  return { tables: result, stats };
}

// 按区域分组
function groupByArea(tables) {
  const grouped = {};
  tables.forEach(item => {
    if (!grouped[item.area]) grouped[item.area] = [];
    grouped[item.area].push({ name: item.name, status: item.status });
  });
  return grouped;
}

// 格式化输出
function formatOutput(data, format) {
  const { tables, stats } = data;
  const grouped = groupByArea(tables);
  
  if (format === 'summary') {
    let output = `台桌实况 (${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })})\n`;
    output += `================================\n`;
    output += `店铺: 中山天宫国际台球城\n`;
    output += `今日营业额: ${stats.totalRevenue}元\n`;
    output += `台桌未结: ${stats.unsettled}元\n`;
    output += `开台率: ${stats.activeTables}/${stats.totalTables}\n\n`;
    
    output += `区域统计:\n`;
    output += `--------------------------------\n`;
    
    Object.keys(grouped).forEach(area => {
      const areaTables = grouped[area];
      const busy = areaTables.filter(t => t.status === '计费中').length;
      const idle = areaTables.filter(t => t.status === '空闲').length;
      const paused = areaTables.filter(t => t.status === '已暂停').length;
      output += `${area}: ${areaTables.length}桌 (计费中:${busy}, 空闲:${idle}, 已暂停:${paused})\n`;
    });
    
    const busyTables = tables.filter(t => t.status === '计费中');
    if (busyTables.length > 0) {
      output += `\n当前计费中的台桌:\n`;
      output += `--------------------------------\n`;
      busyTables.forEach(t => {
        output += `  ${t.area} - ${t.name}\n`;
      });
    }
    
    return output;
  }
  
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    shop: '中山天宫国际台球城',
    stats: stats,
    tables: grouped
  }, null, 2);
}

// 主函数
async function main() {
  const config = parseArgs();
  
  console.error('正在连接Chrome DevTools...');
  
  try {
    const page = await getTargetPage();
    console.error(`页面URL: ${page.url}`);
    
    // 重新获取websocket连接（刷新后可能变化）
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const pages = await response.json();
    const currentPage = pages.find(p => p.url && p.url.includes('tableOverview'));
    
    const content = await getPageContent(currentPage.webSocketDebuggerUrl);
    console.error('页面内容获取成功');
    
    const data = parseTableData(content);
    console.error(`解析完成: ${data.tables.length}个台桌`);
    
    const output = formatOutput(data, config.format);
    
    if (config.output) {
      const dir = path.dirname(config.output);
      if (dir && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(config.output, output, 'utf8');
      console.error(`结果已保存到: ${config.output}`);
      console.log(output);
    } else {
      console.log(output);
    }
    
  } catch (err) {
    console.error('错误:', err.message);
    process.exit(1);
  }
}

main();