const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/TG/temp/QA-20260415-01/screenshots';
const BASE_URL = 'http://127.0.0.1:8089';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 450, height: 900 }); // >420px to test default breakpoint

  try {
    // 先尝试各种方式获取token
    console.log('尝试获取认证token...');
    
    // 方式1: 直接调用API
    const accounts = [
      { u: '13800138000', p: '123456' },
      { u: 'tgadmin', p: 'mms633268' },
      { u: '13800138000', p: '888888' },
      { u: 'admin', p: 'admin' },
    ];

    let token = null;
    for (const acc of accounts) {
      try {
        const res = await page.evaluate(async (acc) => {
          const r = await fetch('http://127.0.0.1:8088/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: acc.u, password: acc.p })
          });
          return await r.json();
        }, acc);
        console.log(`登录 ${acc.u}:`, JSON.stringify(res).substring(0, 200));
        if (res && res.token) { token = res.token; break; }
      } catch(e) { console.log(`登录失败: ${e.message}`); }
    }

    // 方式2: 尝试教练端登录
    if (!token) {
      for (const acc of accounts) {
        try {
          const res = await page.evaluate(async (acc) => {
            const r = await fetch('http://127.0.0.1:8088/api/coach/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone: acc.u, password: acc.p })
            });
            return await r.json();
          }, acc);
          console.log(`教练登录 ${acc.u}:`, JSON.stringify(res).substring(0, 200));
          if (res && res.token) { token = res.token; break; }
        } catch(e) {}
      }
    }

    if (token) {
      console.log('✅ 获取到token，设置到localStorage...');
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.evaluate((t) => {
        localStorage.setItem('adminToken', t);
        localStorage.setItem('coachToken', t);
      }, token);
    }

    // 访问水牌查看页面
    console.log('\n访问水牌查看页面 (450px宽度)...');
    await page.goto(`${BASE_URL}/#/pages/internal/water-board-view`, { 
      waitUntil: 'networkidle2', timeout: 30000 
    });
    await sleep(5000);
    
    // 截图
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_water-board-view.png'), fullPage: false });
    console.log('已截图 01_water-board-view.png');

    // 获取页面数据
    const viewData = await page.evaluate(() => {
      const filters = Array.from(document.querySelectorAll('.filter-item'));
      const chips = Array.from(document.querySelectorAll('.coach-chip'));
      const avatars = Array.from(document.querySelectorAll('.coach-avatar'));
      
      return {
        url: window.location.href,
        filters: filters.map(el => {
          const s = getComputedStyle(el);
          return {
            text: el.textContent.trim(),
            fontSize: parseFloat(s.fontSize),
            paddingTop: parseFloat(s.paddingTop),
            paddingRight: parseFloat(s.paddingRight),
            paddingBottom: parseFloat(s.paddingBottom),
            paddingLeft: parseFloat(s.paddingLeft),
            borderRadius: parseFloat(s.borderRadius),
            marginBottom: parseFloat(s.marginBottom),
          };
        }),
        chips: chips.slice(0, 3).map(el => {
          const s = getComputedStyle(el);
          return { width: parseFloat(s.width), height: parseFloat(s.height), borderRadius: s.borderRadius };
        }),
        avatars: avatars.slice(0, 3).map(el => {
          const s = getComputedStyle(el);
          return { width: parseFloat(s.width), height: parseFloat(s.height) };
        }),
        chipCount: chips.length,
        hasHScroll: document.body.scrollWidth > document.body.clientWidth,
        pageText: document.body.innerText.substring(0, 300),
        viewportWidth: window.innerWidth,
      };
    });

    console.log('查看页 viewportWidth:', viewData.viewportWidth);
    console.log('查看页 filterCount:', viewData.filters.length);
    console.log('查看页 chipCount:', viewData.chipCount);
    console.log('查看页 text:', viewData.pageText.substring(0, 200));
    if (viewData.filters.length > 0) {
      console.log('查看页 第一个按钮:', JSON.stringify(viewData.filters[0]));
    }
    if (viewData.chips.length > 0) {
      console.log('查看页 第一个卡片:', JSON.stringify(viewData.chips[0]));
    }
    if (viewData.avatars.length > 0) {
      console.log('查看页 第一个头像:', JSON.stringify(viewData.avatars[0]));
    }

    // 访问水牌管理页面
    console.log('\n访问水牌管理页面...');
    await page.goto(`${BASE_URL}/#/pages/internal/water-board`, { 
      waitUntil: 'networkidle2', timeout: 30000 
    });
    await sleep(5000);
    
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_water-board-manage.png'), fullPage: false });
    console.log('已截图 02_water-board-manage.png');

    const manageData = await page.evaluate(() => {
      const filters = Array.from(document.querySelectorAll('.filter-item'));
      const chips = Array.from(document.querySelectorAll('.coach-chip'));
      const avatars = Array.from(document.querySelectorAll('.coach-chip-avatar'));
      return {
        filters: filters.map(el => {
          const s = getComputedStyle(el);
          return { text: el.textContent.trim(), fontSize: parseFloat(s.fontSize), paddingTop: parseFloat(s.paddingTop), paddingRight: parseFloat(s.paddingRight), borderRadius: parseFloat(s.borderRadius) };
        }),
        chips: chips.slice(0, 3).map(el => {
          const s = getComputedStyle(el);
          return { width: parseFloat(s.width), height: parseFloat(s.height) };
        }),
        avatars: avatars.slice(0, 3).map(el => {
          const s = getComputedStyle(el);
          return { width: parseFloat(s.width), height: parseFloat(s.height) };
        }),
        chipCount: chips.length,
        hasHScroll: document.body.scrollWidth > document.body.clientWidth,
        pageText: document.body.innerText.substring(0, 300),
      };
    });

    console.log('管理页 chipCount:', manageData.chipCount);
    console.log('管理页 text:', manageData.pageText.substring(0, 200));
    if (manageData.filters.length > 0) {
      console.log('管理页 第一个按钮:', JSON.stringify(manageData.filters[0]));
    }

    // 测试筛选功能
    console.log('\n测试筛选功能...');
    await page.goto(`${BASE_URL}/#/pages/internal/water-board-view`, { 
      waitUntil: 'networkidle2', timeout: 15000 
    });
    await sleep(3000);

    const beforeFilter = await page.evaluate(() => document.querySelectorAll('.coach-chip').length);
    
    // 点击"早班上桌"筛选
    await page.evaluate(() => {
      const filters = Array.from(document.querySelectorAll('.filter-item'));
      const target = filters.find(f => f.textContent.includes('早班上桌'));
      if (target) { target.click(); }
    });
    await sleep(2000);
    
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_filter-clicked.png'), fullPage: false });
    
    const afterFilter = await page.evaluate(() => document.querySelectorAll('.coach-chip').length);
    console.log(`筛选: ${beforeFilter} -> ${afterFilter}`);

  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await browser.close();
  }
})();
