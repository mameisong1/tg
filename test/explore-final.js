const { chromium } = require('playwright');

async function explore() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  
  // Set table auth
  await page.addInitScript(() => {
    const now = Date.now();
    localStorage.setItem('tableName', '普台1');
    localStorage.setItem('tableAuth', JSON.stringify({ time: now }));
  });
  
  // Navigate to products
  await page.goto('http://localhost:8089', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  
  // Close welcome
  const welcomeBtn = await page.$('text="知道了"');
  if (welcomeBtn) { await welcomeBtn.click(); await new Promise(r => setTimeout(r, 1000)); }
  
  // Click 商品 tab
  await page.click('text="商品"');
  await new Promise(r => setTimeout(r, 2000));
  
  // ===================== Check category tabs =====================
  console.log('\n=== Category tabs ===');
  const tabs = await page.$$eval('[class*="category"], .category-tab, .tab-item, .tab, .uni-tab', els =>
    els.map(e => ({ tag: e.tagName, text: e.textContent?.trim().substring(0, 20), class: e.className?.substring(0, 50) }))
  );
  console.log('Category tabs:', JSON.stringify(tabs, null, 2));
  
  // Also check all elements that look like tabs
  const allTabs = await page.$$eval('[class*="tab"]', els =>
    els.map(e => ({ tag: e.tagName, text: e.textContent?.trim().substring(0, 30), class: e.className }))
  );
  console.log('All tab-like:', JSON.stringify(allTabs, null, 2));

  // ===================== Click 饮料 tab and check products =====================
  console.log('\n=== Clicking 饮料 tab ===');
  
  // Find 饮料 tab
  const drinkTab = await page.$('text="饮料"');
  if (drinkTab) {
    await drinkTab.click();
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Check how many product cards are visible
  const products = await page.$$('.product-card');
  console.log('Product cards count:', products.length);
  
  // Get first 3 product names and categories
  for (let i = 0; i < Math.min(3, products.length); i++) {
    const name = await products[i].$eval('.product-name span', el => el.textContent).catch(() => '?');
    const cat = await products[i].$eval('.product-category span', el => el.textContent).catch(() => '?');
    console.log(`  Product ${i}: ${name} (category: ${cat})`);
  }
  
  // Check active tab
  const activeTab = await page.$$eval('[class*="active"], .tab-active, .tab.active', els =>
    els.map(e => e.textContent?.trim().substring(0, 20))
  );
  console.log('Active tabs:', activeTab);

  // ===================== Add a drink and check popup =====================
  console.log('\n=== Adding first drink ===');
  const firstProduct = products[0];
  if (firstProduct) {
    const name = await firstProduct.$eval('.product-name span', el => el.textContent).catch(() => '?');
    const cat = await firstProduct.$eval('.product-category span', el => el.textContent).catch(() => '?');
    console.log(`  Product: ${name} (${cat})`);
    
    // Check if it has "选项" label
    const optionLabel = await firstProduct.$eval('.product-option, text="选项"', el => el.textContent).catch(() => null);
    console.log(`  Option label: ${optionLabel}`);
    
    await firstProduct.$('.add-cart-btn')?.then(b => b.click());
    await new Promise(r => setTimeout(r, 2500));
    
    // Check modal
    const overlay = await page.$('.modal-overlay');
    if (overlay) {
      const text = await overlay.textContent();
      console.log('  Modal text:', text?.substring(0, 500));
      
      // Save screenshot
      await page.screenshot({ path: '/TG/test/screenshots/explore-drink-popup.png', fullPage: true });
      
      // Find and click 确定
      const confirmBtn = await page.$('text="确定"');
      if (confirmBtn) {
        await confirmBtn.click();
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    // Dismiss toast
    const toastOverlay = await page.$('.modal-overlay');
    if (toastOverlay) {
      const toastText = await toastOverlay.textContent();
      console.log('  Toast text:', toastText?.substring(0, 200));
      const toastBtn = await toastOverlay.$('text="知道了"');
      if (toastBtn) { await toastBtn.click(); await new Promise(r => setTimeout(r, 500)); }
    }
  }
  
  // ===================== Add a milk tea and check popup =====================
  console.log('\n=== Clicking 奶茶店 tab ===');
  const milkTab = await page.$('text="奶茶店"');
  if (milkTab) {
    await milkTab.click();
    await new Promise(r => setTimeout(r, 2000));
  }
  
  const milkProducts = await page.$$('.product-card');
  console.log('Milk tea products:', milkProducts.length);
  
  if (milkProducts.length > 0) {
    const name = await milkProducts[0].$eval('.product-name span', el => el.textContent).catch(() => '?');
    const cat = await milkProducts[0].$eval('.product-category span', el => el.textContent).catch(() => '?');
    const optionLabel = await milkProducts[0].$eval('.product-option, text="选项"', el => el.textContent).catch(() => null);
    console.log(`  Product: ${name} (${cat}), option label: ${optionLabel}`);
    
    await milkProducts[0].$('.add-cart-btn')?.then(b => b.click());
    await new Promise(r => setTimeout(r, 3000));
    
    const overlay = await page.$('.modal-overlay');
    if (overlay) {
      const text = await overlay.textContent();
      console.log('  Milk tea modal text:', text?.substring(0, 800));
      await page.screenshot({ path: '/TG/test/screenshots/explore-milktea-popup.png', fullPage: true });
      
      // Click 确定
      const confirmBtn = await page.$('text="确定"');
      if (confirmBtn) {
        await confirmBtn.click();
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  
  // ===================== Check cart =====================
  console.log('\n=== Going to cart ===');
  // Click the cart bar (the bottom bar with "下单" button)
  const orderBtn = await page.$('text="下单"');
  if (orderBtn) {
    await orderBtn.click();
    await new Promise(r => setTimeout(r, 2000));
  }
  
  const cartText = await page.textContent('body');
  console.log('Cart text:', cartText?.substring(0, 800));
  await page.screenshot({ path: '/TG/test/screenshots/explore-cart-detail.png', fullPage: true });
  
  // Check for + - delete buttons
  const plusBtn = await page.$('.add-cart-btn');
  console.log('Plus button found:', !!plusBtn);
  
  const minusBtn = await page.$('.reduce-btn, .minus-btn');
  console.log('Minus button found:', !!minusBtn);
  
  const deleteBtn = await page.$('.delete-btn, text="删除"');
  console.log('Delete button found:', !!deleteBtn);

  await browser.close();
}

explore().catch(e => console.error(e));
