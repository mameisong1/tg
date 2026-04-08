// Capture screenshots from browser
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const SCREENSHOT_DIR = '/TG/docs/temp/screenshots';
const CDP_PORT = 9222;

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
  console.log(`  📷 Saved: ${filename}`);
  return filepath;
}

async function main() {
  // Get browser WebSocket URL
  const versionReq = () => new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: CDP_PORT,
      path: '/json/version',
      method: 'GET'
    }, (res) => {
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
  
  const version = await versionReq();
  const browserWs = version.webSocketDebuggerUrl;
  console.log('Browser WS:', browserWs);
  
  // Get all pages
  const pagesReq = () => new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: CDP_PORT,
      path: '/json',
      method: 'GET'
    }, (res) => {
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
  
  const pages = await pagesReq();
  const loginPage = pages.find(p => p.type === 'page' && p.url.includes('admin'));
  
  if (!loginPage) {
    console.log('No admin page found');
    process.exit(1);
  }
  
  console.log('Page:', loginPage.url);
  const pageWs = loginPage.webSocketDebuggerUrl;
  
  // Take current page screenshot
  await takeScreenshot(pageWs, 'TC-v3-当前页面.png');
  
  console.log('Done');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
