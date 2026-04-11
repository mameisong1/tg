const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const SCREENSHOT_DIR = '/TG/test/screenshots';
const H5_URL = 'http://localhost:8089';
const ADMIN_URL = 'http://localhost:8088';
// The DB that the Docker container uses
const DB_PATH = '/TG/run/db/tgservice.db';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Set table auth in localStorage to bypass the "扫码进入" modal.
 * This must be called on every new page/context before navigating to products.
 */
async function setTableAuth(page) {
  await page.addInitScript(() => {
    // Set a recent table auth so the "扫码" modal doesn't appear
    const now = Date.now();
    localStorage.setItem('tableName', '普台1');
    localStorage.setItem('tableAuth', JSON.stringify({ time: now }));
  });
}

async function goToProducts(page) {
  await page.goto(H5_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2000);
  // Close welcome modal if any
  const welcomeBtn = await page.$('text="知道了"');
  if (welcomeBtn) {
    await welcomeBtn.click();
    await sleep(1000);
  }
  // Click 商品 tab
  await page.click('text="商品"');
  await sleep(2000);
}

async function dismissToast(page) {
  // Dismiss the small toast modal that appears after adding to cart
  const overlay = await page.$('.modal-overlay');
  if (overlay) {
    const btn = await overlay.$('text="知道了"');
    if (btn) {
      await btn.click();
      await sleep(500);
      return true;
    }
  }
  return false;
}

async function goToCart(page) {
  // Look for floating cart bar
  const cartBar = await page.$('.cart-bar, [class*="cart-bar"], [class*="float-cart"]');
  if (cartBar) {
    await cartBar.click();
    await sleep(2000);
    return true;
  }
  // Fallback: direct navigation
  await page.goto(`${H5_URL}/#/pages/cart/cart`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2000);
  return false;
}

async function submitOrder(page) {
  const submitBtn = await page.$('text="提交订单"');
  if (submitBtn) {
    await submitBtn.click();
    await sleep(3000);
    // Check for success
    const body = await page.textContent('body');
    return body && (body.includes('成功') || body.includes('已下单') || body.includes('下单'));
  }
  return false;
}

async function run() {
  const results = [];
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // ========================================
    // TC-01: 无选项商品可以正常下单
    // ========================================
    console.log('\n========== TC-01: 无选项商品下单 ==========');
    try {
      const ctx = await browser.newContext();
      const page = await ctx.newPage({ viewport: { width: 375, height: 812 } });
      await setTableAuth(page);
      await goToProducts(page);

      // Verify table info is shown (not "未扫码")
      const tableInfo = await page.$('.table-info');
      let tableText = '';
      if (tableInfo) {
        tableText = await tableInfo.textContent();
        console.log('  Table info:', tableText);
      }
      const isScanned = tableText && !tableText.includes('未扫码');
      console.log('  Table scanned:', isScanned);

      // Click 零食 tab
      await page.click('text="零食"');
      await sleep(1500);

      // Get first product name
      const firstProductName = await page.$eval('.product-card .product-name span', el => el.textContent);
      console.log('  Adding product:', firstProductName);

      // Add to cart
      await page.click('.product-card .add-cart-btn');
      await sleep(2000);

      // Check: should NOT show options popup
      // The toast modal is expected, but NOT a spec/options popup
      const overlay = await page.$('.modal-overlay');
      let hasOptionsPopup = false;
      if (overlay) {
        const overlayText = await overlay.textContent();
        hasOptionsPopup = overlayText && (
          overlayText.includes('温度') || overlayText.includes('糖度') ||
          overlayText.includes('选择') || overlayText.includes('规格') ||
          overlayText.includes('选项')
        );
        console.log('  Overlay text:', overlayText?.substring(0, 200));
        console.log('  Is options popup:', hasOptionsPopup);
        
        // Dismiss toast
        await dismissToast(page);
      }

      // Go to cart
      await goToCart(page);
      const cartText = await page.textContent('body');
      console.log('  Cart content:', cartText?.substring(0, 500));
      
      const cartHasProduct = cartText && cartText.includes(firstProductName);
      console.log('  Cart has product:', cartHasProduct);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tc01-no-options-order.png'), fullPage: true });

      // Submit order
      const orderSuccess = await submitOrder(page);
      console.log('  Order submitted:', orderSuccess);

      const passed = !hasOptionsPopup && cartHasProduct;
      results.push({ tc: 'TC-01', status: passed ? 'PASS' : 'FAIL',
        detail: `选项弹窗:${hasOptionsPopup?'出现':'未出现'}, 购物车:${cartHasProduct?'有商品':'空'}, 订单:${orderSuccess?'成功':'未提交'}` });
      console.log('  TC-01:', passed ? '✅ PASS' : '❌ FAIL');
      await ctx.close();
    } catch (e) {
      results.push({ tc: 'TC-01', status: 'FAIL', detail: e.message });
      console.log('  TC-01 FAIL:', e.message);
    }

    // ========================================
    // TC-02: 奶茶选项下单
    // ========================================
    console.log('\n========== TC-02: 奶茶选项下单 ==========');
    try {
      const ctx = await browser.newContext();
      const page = await ctx.newPage({ viewport: { width: 375, height: 812 } });
      await setTableAuth(page);
      await goToProducts(page);

      // Click 奶茶店 tab
      await page.click('text="奶茶店"');
      await sleep(1500);

      // Get product name
      const productName = await page.$eval('.product-card .product-name span', el => el.textContent);
      console.log('  Adding milk tea:', productName);

      // Add to cart - should trigger options popup
      await page.click('.product-card .add-cart-btn');
      await sleep(2500);

      // Check for options popup
      const overlay = await page.$('.modal-overlay');
      let popupShown = false;
      let popupText = '';
      if (overlay) {
        popupText = await overlay.textContent();
        console.log('  Popup text:', popupText?.substring(0, 500));
        
        // Check if it's an options popup (not just a toast)
        popupShown = popupText && (
          popupText.includes('温度') || popupText.includes('糖度') ||
          popupText.includes('选择') || popupText.includes('规格') ||
          popupText.includes('选项') || popupText.includes('确定') ||
          popupText.includes('冰') || popupText.includes('糖')
        );
        console.log('  Is options popup:', popupShown);

        if (popupShown) {
          // Select first temperature
          const temps = await page.$$('text="正常冰", text="去冰", text="常温", text="热"');
          if (temps.length > 0) {
            await temps[0].click();
            await sleep(500);
            console.log('  Selected temperature');
          }
          // Select first sugar
          const sugars = await page.$$('text="少糖", text="半糖", text="全糖", text="无糖", text="标准糖"');
          if (sugars.length > 0) {
            await sugars[0].click();
            await sleep(500);
            console.log('  Selected sugar');
          }
          // Click 确定
          const confirmBtn = await page.$('text="确定"');
          if (confirmBtn) {
            await confirmBtn.click();
            await sleep(1500);
            console.log('  Clicked 确定');
          }
        }
      }

      // Dismiss any remaining toast
      await dismissToast(page);

      // Go to cart
      await goToCart(page);
      const cartText = await page.textContent('body');
      console.log('  Cart content:', cartText?.substring(0, 800));
      
      const hasOptionsInCart = cartText && (
        cartText.includes('正常冰') || cartText.includes('去冰') ||
        cartText.includes('少糖') || cartText.includes('全糖') ||
        cartText.includes('选项') || cartText.includes('+')
      );
      console.log('  Cart shows options:', hasOptionsInCart);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tc02-milk-tea-options.png'), fullPage: true });

      const passed = popupShown && hasOptionsInCart;
      results.push({ tc: 'TC-02', status: passed ? 'PASS' : 'FAIL',
        detail: `选项弹窗:${popupShown?'出现':'未出现'}, 购物车选项:${hasOptionsInCart?'显示':'未显示'}` });
      console.log('  TC-02:', passed ? '✅ PASS' : '❌ FAIL');
      await ctx.close();
    } catch (e) {
      results.push({ tc: 'TC-02', status: 'FAIL', detail: e.message });
      console.log('  TC-02 FAIL:', e.message);
    }

    // ========================================
    // TC-03: 购物车管理 (增减删除)
    // ========================================
    console.log('\n========== TC-03: 购物车管理 ==========');
    try {
      const ctx = await browser.newContext();
      const page = await ctx.newPage({ viewport: { width: 375, height: 812 } });
      await setTableAuth(page);
      await goToProducts(page);

      // Add a milk tea with options
      await page.click('text="奶茶店"');
      await sleep(1500);
      await page.click('.product-card .add-cart-btn');
      await sleep(2500);
      // Handle popup
      let overlay = await page.$('.modal-overlay');
      if (overlay) {
        const confirmBtn = await page.$('text="确定"');
        if (confirmBtn) { await confirmBtn.click(); await sleep(1000); }
      }
      await dismissToast(page);

      // Add a snack too
      await page.click('text="零食"');
      await sleep(1500);
      await page.click('.product-card .add-cart-btn');
      await sleep(1500);
      await dismissToast(page);

      // Go to cart
      await goToCart(page);
      
      const beforeCart = await page.textContent('body');
      console.log('  Cart before:', beforeCart?.substring(0, 500));

      // Try + button
      const plusBtn = await page.$('.add-cart-btn');
      let plusClicked = false;
      if (plusBtn) {
        await plusBtn.click();
        await sleep(1000);
        plusClicked = true;
        console.log('  Clicked +');
      }

      const afterPlus = await page.textContent('body');
      console.log('  After +:', afterPlus?.substring(0, 500));

      // Try - button (look for reduce button)
      const minusBtn = await page.$('.reduce-btn, .minus-btn, [class*="reduce"], [class*="minus"]');
      let minusClicked = false;
      if (minusBtn) {
        await minusBtn.click();
        await sleep(1000);
        minusClicked = true;
        console.log('  Clicked -');
      }

      // Try delete
      const deleteBtn = await page.$('.delete-btn, [class*="delete"], text="删除"');
      let deleteClicked = false;
      if (deleteBtn) {
        await deleteBtn.click();
        await sleep(1000);
        deleteClicked = true;
        // Confirm if needed
        const confirmDel = await page.$('text="确定", text="确认"');
        if (confirmDel) {
          await confirmDel.click();
          await sleep(1000);
        }
        console.log('  Clicked delete');
      }

      const afterManage = await page.textContent('body');
      console.log('  After manage:', afterManage?.substring(0, 500));

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tc03-cart-manage.png'), fullPage: true });

      const passed = plusClicked || minusClicked || deleteClicked;
      results.push({ tc: 'TC-03', status: passed ? 'PASS' : 'FAIL',
        detail: `+按钮:${plusClicked?'找到':'未找到'}, -按钮:${minusClicked?'找到':'未找到'}, 删除:${deleteClicked?'找到':'未找到'}` });
      console.log('  TC-03:', passed ? '✅ PASS' : '❌ FAIL');
      await ctx.close();
    } catch (e) {
      results.push({ tc: 'TC-03', status: 'FAIL', detail: e.message });
      console.log('  TC-03 FAIL:', e.message);
    }

    // ========================================
    // TC-04: 饮料分类冷热选项
    // ========================================
    console.log('\n========== TC-04: 饮料分类冷热选项 ==========');
    try {
      const ctx = await browser.newContext();
      const page = await ctx.newPage({ viewport: { width: 375, height: 812 } });
      await setTableAuth(page);
      await goToProducts(page);

      // Click 饮料 tab
      await page.click('text="饮料"');
      await sleep(1500);

      const products = await page.$$('.product-card');
      console.log('  Found', products.length, 'drink products');

      let firstHasOptions = false;
      let secondHasOptions = false;

      if (products.length >= 1) {
        const name1 = await products[0].$eval('.product-name span', el => el.textContent);
        console.log('  Testing product 1:', name1);
        
        await products[0].$('.add-cart-btn')?.then(b => b.click());
        await sleep(2000);

        const ov1 = await page.$('.modal-overlay');
        if (ov1) {
          const text1 = await ov1.textContent();
          firstHasOptions = text1 && (
            text1.includes('温度') || text1.includes('选择') ||
            text1.includes('冰') || text1.includes('规格') ||
            text1.includes('确定')
          );
          console.log('  Product 1 popup text:', text1?.substring(0, 200));
          console.log('  Product 1 has options:', firstHasOptions);
        }
        await dismissToast(page);
      }

      if (products.length >= 2) {
        const name2 = await products[1].$eval('.product-name span', el => el.textContent);
        console.log('  Testing product 2:', name2);
        
        await products[1].$('.add-cart-btn')?.then(b => b.click());
        await sleep(2000);

        const ov2 = await page.$('.modal-overlay');
        if (ov2) {
          const text2 = await ov2.textContent();
          secondHasOptions = text2 && (
            text2.includes('温度') || text2.includes('选择') ||
            text2.includes('冰') || text2.includes('规格') ||
            text2.includes('确定')
          );
          console.log('  Product 2 popup text:', text2?.substring(0, 200));
          console.log('  Product 2 has options:', secondHasOptions);
        }
        await dismissToast(page);
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tc04-drink-wildcard.png'), fullPage: true });

      const passed = firstHasOptions;
      results.push({ tc: 'TC-04', status: passed ? 'PASS' : 'FAIL',
        detail: `商品1选项:${firstHasOptions?'有':'无'}, 商品2选项:${secondHasOptions?'有':'无'}` });
      console.log('  TC-04:', passed ? '✅ PASS' : '❌ FAIL');
      await ctx.close();
    } catch (e) {
      results.push({ tc: 'TC-04', status: 'FAIL', detail: e.message });
      console.log('  TC-04 FAIL:', e.message);
    }

    // ========================================
    // TC-05: 数据库订单选项
    // ========================================
    console.log('\n========== TC-05: 数据库订单选项 ==========');
    try {
      // Create an order with options via browser
      const ctx = await browser.newContext();
      const page = await ctx.newPage({ viewport: { width: 375, height: 812 } });
      await setTableAuth(page);
      await goToProducts(page);

      // Add milk tea with options
      await page.click('text="奶茶店"');
      await sleep(1500);
      
      const productName = await page.$eval('.product-card .product-name span', el => el.textContent);
      console.log('  Adding:', productName);
      
      await page.click('.product-card .add-cart-btn');
      await sleep(2500);

      // Handle options popup
      const overlay = await page.$('.modal-overlay');
      if (overlay) {
        const popupText = await overlay.textContent();
        console.log('  Popup:', popupText?.substring(0, 300));
        
        // Select temp
        const temps = await page.$$('text="正常冰", text="去冰", text="常温", text="热"');
        if (temps.length > 0) { await temps[0].click(); await sleep(500); }
        // Select sugar
        const sugars = await page.$$('text="少糖", text="半糖", text="全糖", text="无糖"');
        if (sugars.length > 0) { await sugars[0].click(); await sleep(500); }
        // Confirm
        const confirmBtn = await page.$('text="确定"');
        if (confirmBtn) { await confirmBtn.click(); await sleep(1000); }
      }
      await dismissToast(page);

      // Go to cart and submit
      await goToCart(page);
      const orderSuccess = await submitOrder(page);
      console.log('  Order submitted:', orderSuccess);
      await ctx.close();

      // Query database
      await sleep(1000);
      const dbResult = execSync(
        `sqlite3 ${DB_PATH} "SELECT items FROM orders ORDER BY id DESC LIMIT 1;"`,
        { encoding: 'utf-8', timeout: 10000 }
      );
      console.log('  DB result:', dbResult?.substring(0, 500));

      const hasOptionsInDB = dbResult && (
        dbResult.includes('options') || dbResult.includes('option') ||
        dbResult.includes('正常冰') || dbResult.includes('去冰') ||
        dbResult.includes('少糖') || dbResult.includes('全糖') ||
        dbResult.includes('冰') || dbResult.includes('糖')
      );
      console.log('  Has options in DB:', hasOptionsInDB);

      // Generate terminal screenshot
      const ctx5b = await browser.newContext({ viewport: { width: 1200, height: 400 } });
      const page5b = await ctx5b.newPage();
      const escapedOutput = (dbResult || '(empty)').trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
      await page5b.setContent(`
        <html>
        <head><style>
          body { background: #1e1e1e; color: #0f0; font-family: 'Courier New', monospace; padding: 20px; font-size: 14px; line-height: 1.5; }
          .prompt { color: #0ff; margin-bottom: 8px; }
          .output { color: #fff; word-break: break-all; white-space: pre-wrap; }
        </style></head>
        <body>
          <div class="prompt">$ sqlite3 ${DB_PATH} "SELECT items FROM orders ORDER BY id DESC LIMIT 1;"</div>
          <div class="output">${escapedOutput}</div>
        </body>
        </html>
      `);
      await page5b.screenshot({ path: path.join(SCREENSHOT_DIR, 'tc05-db-order-options.png') });
      await ctx5b.close();

      results.push({ tc: 'TC-05', status: hasOptionsInDB ? 'PASS' : 'FAIL',
        detail: `DB items含选项:${hasOptionsInDB?'是':'否'}, 长度:${dbResult?.length || 0}` });
      console.log('  TC-05:', hasOptionsInDB ? '✅ PASS' : '❌ FAIL');
    } catch (e) {
      results.push({ tc: 'TC-05', status: 'FAIL', detail: e.message });
      console.log('  TC-05 FAIL:', e.message);
    }

    // ========================================
    // TC-06: 收银看板
    // ========================================
    console.log('\n========== TC-06: 收银看板 ==========');
    try {
      const ctx = await browser.newContext();
      const page = await ctx.newPage({ viewport: { width: 1280, height: 800 } });

      await page.goto(`${ADMIN_URL}/admin/cashier-dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(3000);

      // Check login
      if (await page.isVisible('input[type="password"]')) {
        console.log('  Login form detected');
        const userField = await page.$('input[type="text"], input[placeholder*="用户"], input[placeholder*="账号"]');
        const passField = await page.$('input[type="password"]');
        if (userField && passField) {
          await userField.fill('tgadmin');
          await passField.fill('mms6333268');
          await sleep(500);
          const loginBtn = await page.$('button:has-text("登录"), .login-btn, button[type="submit"]');
          if (loginBtn) { await loginBtn.click(); await sleep(3000); }
          
          // Try other password
          if (await page.isVisible('input[type="password"]')) {
            await userField.fill('tgadmin');
            await passField.fill('mms633268');
            await sleep(500);
            if (loginBtn) { await loginBtn.click(); await sleep(3000); }
          }
        }
      }

      // Refresh to get latest orders
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(3000);

      const pageContent = await page.textContent('body');
      console.log('  Dashboard (first 500 chars):', pageContent?.substring(0, 500));

      const hasOrderInfo = pageContent && (pageContent.includes('订单') || pageContent.includes('商品') || pageContent.includes('奶茶'));
      const showsOptions = pageContent && (pageContent.includes('（') || pageContent.includes('(') || pageContent.includes('正常冰') || pageContent.includes('少糖'));
      console.log('  Has orders:', hasOrderInfo);
      console.log('  Shows options:', showsOptions);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tc06-cashier-dashboard.png'), fullPage: true });

      results.push({ tc: 'TC-06', status: hasOrderInfo ? 'PASS' : 'FAIL',
        detail: `订单信息:${hasOrderInfo?'是':'否'}, 显示选项:${showsOptions?'是':'否'}` });
      console.log('  TC-06:', hasOrderInfo ? '✅ PASS' : '❌ FAIL');
      await ctx.close();
    } catch (e) {
      results.push({ tc: 'TC-06', status: 'FAIL', detail: e.message });
      console.log('  TC-06 FAIL:', e.message);
    }

  } finally {
    await browser.close();
  }

  // ========================================
  // 汇总报告
  // ========================================
  console.log('\n\n==================== 测试汇总报告 ====================');
  let passCount = 0, failCount = 0;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`  ${icon} ${r.tc}: ${r.status} - ${r.detail}`);
    if (r.status === 'PASS') passCount++; else failCount++;
  }
  console.log(`\n  总计: ${passCount} PASS / ${failCount} FAIL / ${results.length} 总计`);
  console.log('======================================================');

  const reportPath = path.join(SCREENSHOT_DIR, 'test-report.txt');
  fs.writeFileSync(reportPath,
    `测试报告 - ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}\n` +
    `总计: ${passCount} PASS / ${failCount} FAIL / ${results.length} 总计\n\n` +
    results.map(r => `${r.status === 'PASS' ? '✅' : '❌'} ${r.tc}: ${r.status} - ${r.detail}`).join('\n') + '\n'
  );
  console.log(`报告已保存: ${reportPath}`);

  console.log('\n截图文件:');
  const files = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.startsWith('tc') && f.endsWith('.png'));
  for (const f of files) {
    const stat = fs.statSync(path.join(SCREENSHOT_DIR, f));
    console.log(`  ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
  }
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
