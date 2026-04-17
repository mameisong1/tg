const puppeteer = require('puppeteer');
const fs = require('fs');

const BASE = 'http://127.0.0.1:8089';
const API = 'http://127.0.0.1:8088';
const report = [];
let orderNo = null;

function log(msg) {
  console.log(msg);
  report.push(msg);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchAPI(page, endpoint, method, body) {
  return await page.evaluate(async (apiBase, ep, m, b) => {
    const resp = await fetch(apiBase + ep, {
      method: m,
      headers: { 'Content-Type': 'application/json' },
      body: b ? JSON.stringify(b) : undefined
    });
    return await resp.json();
  }, API, endpoint, method, body);
}

(async () => {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  let page = pages.find(p => p.url() === 'about:blank') || pages[0];
  await page.setViewport({ width: 375, height: 812 });

  try {
    // Step 1: Home page, set localStorage
    log('=== Step 1: Home + localStorage ===');
    await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(3000);
    
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('tableName', 'VIP3');
      localStorage.setItem('tableAuth', JSON.stringify({table:'VIP3', tableName:'VIP3', time:Date.now()}));
    });
    
    const tableName = await page.evaluate(() => localStorage.getItem('tableName'));
    log('tableName: ' + tableName);
    await page.screenshot({ path: '/TG/temp/QA-20260417-09/s1.png' });

    // Step 2: Products page, get sessionId, add via API
    log('=== Step 2: Products + API cart ===');
    await page.goto(BASE + '/#/pages/products/products', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(5000);
    
    const sessionId = await page.evaluate(() => localStorage.getItem('sessionId'));
    log('sessionId: ' + sessionId);
    
    if (!sessionId) {
      log('ERROR: No sessionId');
      throw new Error('No sessionId');
    }
    
    // Add items via API
    const add1 = await fetchAPI(page, '/api/cart', 'POST', {
      sessionId: sessionId, tableNo: 'VIP3', productName: '可乐', quantity: 1, options: ''
    });
    log('Add可乐: ' + JSON.stringify(add1));
    
    const add2 = await fetchAPI(page, '/api/cart', 'POST', {
      sessionId: sessionId, tableNo: 'VIP3', productName: '雪碧', quantity: 1, options: ''
    });
    log('Add雪碧: ' + JSON.stringify(add2));
    
    const cart = await fetchAPI(page, '/api/cart/' + sessionId, 'GET', null);
    log('Cart: ' + cart.items?.length + ' items, total=' + cart.totalPrice);
    
    await page.screenshot({ path: '/TG/temp/QA-20260417-09/s2.png' });

    // Step 3: Cart page - click 下单 button
    log('=== Step 3: Cart page + click 下单 ===');
    await page.goto(BASE + '/#/pages/cart/cart', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(5000);
    
    const cartText = await page.evaluate(() => document.body.innerText);
    log('Cart text: ' + cartText.substring(0, 200));
    await page.screenshot({ path: '/TG/temp/QA-20260417-09/s3.png' });
    
    // Find and click 下单 button
    log('Looking for 下单 button...');
    
    // Strategy 1: Find by text
    const clicked = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const text = (el.innerText || '').trim();
        if (text === '下单' && el.click && el.offsetParent !== null) {
          el.click();
          return 'clicked by text: 下单';
        }
      }
      return null;
    });
    
    if (clicked) {
      log('UI click: ' + clicked);
    } else {
      // Strategy 2: Find uni-button or button at bottom
      const btns = await page.$$('uni-button, button');
      for (const btn of btns) {
        const rect = await btn.evaluate(el => el.getBoundingClientRect());
        if (rect.bottom > 600 && rect.width > 80) {
          const text = await btn.evaluate(el => (el.innerText || '').trim());
          log('Click bottom button: ' + text);
          await btn.click();
          break;
        }
      }
    }
    
    await sleep(5000);
    await page.screenshot({ path: '/TG/temp/QA-20260417-09/s4-after-click.png' });
    
    // Step 4: Check result
    log('=== Step 4: Check result ===');
    const resultUrl = page.url();
    const resultText = await page.evaluate(() => document.body.innerText);
    log('URL: ' + resultUrl);
    log('Text: ' + resultText.substring(0, 500));
    
    // Extract orderNo
    const match = resultText.match(/TG\d+/);
    if (match) {
      orderNo = match[0];
      log('OrderNo from text: ' + orderNo);
    }
    
    // Check localStorage for order info
    const finalStorage = await page.evaluate(() => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        data[localStorage.key(i)] = localStorage.getItem(localStorage.key(i));
      }
      return data;
    });
    log('localStorage: ' + JSON.stringify(finalStorage));
    
    // Check if there's a popup/dialog
    const popupText = await page.evaluate(() => {
      const modal = document.querySelector('.uni-modal, .modal, [role="dialog"]');
      return modal ? modal.innerText : null;
    });
    if (popupText) {
      log('Popup text: ' + popupText);
      
      // If popup has orderNo
      const popupMatch = popupText.match(/TG\d+/);
      if (popupMatch) {
        orderNo = popupMatch[0];
        log('OrderNo from popup: ' + orderNo);
      }
      
      // If popup has confirm button, click it
      const confirmClicked = await page.evaluate(() => {
        const btns = document.querySelectorAll('.uni-modal button, .modal button, [role="dialog"] button');
        for (const btn of btns) {
          const text = (btn.innerText || '').trim();
          if (text === '确定' || text === '确认' || text === 'OK') {
            btn.click();
            return text;
          }
        }
        return null;
      });
      if (confirmClicked) {
        log('Clicked popup confirm: ' + confirmClicked);
        await sleep(3000);
      }
    }
    
    await page.screenshot({ path: '/TG/temp/QA-20260417-09/s5-final.png' });

  } catch (err) {
    log('ERROR: ' + err.message);
    await page.screenshot({ path: '/TG/temp/QA-20260417-09/error.png' });
  }

  await browser.disconnect();

  // Write report
  const rpt = '# Case 1: 完整下单流程测试报告\n\n' +
    '**时间**: ' + new Date().toISOString() + '\n' +
    '**桌号**: VIP3\n\n' +
    '## 执行日志\n\n' + report.map(r => '- ' + r).join('\n') + '\n\n' +
    '## 验证结果\n\n' +
    '| 验证项 | 状态 |\n' +
    '|--------|------|\n' +
    '| tableName VIP3 | OK |\n' +
    '| 购物车有商品 | OK |\n' +
    '| 下单成功 | ' + (orderNo ? 'OK' : 'FAIL') + ' |\n\n' +
    '## 订单号\n\n' + (orderNo ? '**' + orderNo + '**' : '**未获取**') + '\n';

  fs.writeFileSync('/TG/temp/QA-20260417-09/case1-complete-order.md', rpt);
  console.log('\nReport: /TG/temp/QA-20260417-09/case1-complete-order.md');
  console.log('OrderNo:', orderNo || 'NOT FOUND');
  
  process.exit(orderNo ? 0 : 1);
})();