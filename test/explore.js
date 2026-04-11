const { chromium } = require('playwright');

async function explore() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  
  // 1. Go to products page
  await page.goto('http://localhost:8089/pages/products/products', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('=== Products Page ===');
  console.log('URL:', page.url());
  console.log('Title:', await page.title());
  
  // Get all visible text
  const bodyText = await page.textContent('body');
  console.log('Body text (first 2000 chars):', bodyText?.substring(0, 2000));
  
  // Get all buttons
  const buttons = await page.$$eval('button, .btn, [role="button"], [class*="btn"]', els => 
    els.map(e => ({ tag: e.tagName, text: e.textContent?.trim(), class: e.className?.substring(0, 50) }))
  );
  console.log('Buttons:', JSON.stringify(buttons, null, 2));
  
  // Get tabs/categories
  const tabs = await page.$$eval('.tab, .category, [class*="tab"], [class*="category"], .uni-tab, .nav', els =>
    els.map(e => ({ tag: e.tagName, text: e.textContent?.trim().substring(0, 30), class: e.className?.substring(0, 50) }))
  );
  console.log('Tabs/Categories:', JSON.stringify(tabs, null, 2));
  
  // Screenshot
  await page.screenshot({ path: '/TG/test/screenshots/explore-products.png', fullPage: true });
  
  // Try clicking "零食" tab
  const snackTab = await page.$('text="零食"');
  if (snackTab) {
    await snackTab.click();
    await new Promise(r => setTimeout(r, 2000));
    const afterSnack = await page.textContent('body');
    console.log('After snack tab (first 1000 chars):', afterSnack?.substring(0, 1000));
    await page.screenshot({ path: '/TG/test/screenshots/explore-snack-tab.png', fullPage: true });
    
    // Find products
    const products = await page.$$eval('.product, .goods, .item, [class*="product"], [class*="goods"]', els =>
      els.map(e => ({ tag: e.tagName, text: e.textContent?.trim().substring(0, 80), class: e.className?.substring(0, 50) }))
    );
    console.log('Products:', JSON.stringify(products, null, 2));
  }
  
  // Try clicking "奶茶" tab
  const milkTab = await page.$('text="奶茶"');
  if (milkTab) {
    await milkTab.click();
    await new Promise(r => setTimeout(r, 2000));
    const afterMilk = await page.textContent('body');
    console.log('After milk tab (first 1000 chars):', afterMilk?.substring(0, 1000));
    await page.screenshot({ path: '/TG/test/screenshots/explore-milk-tab.png', fullPage: true });
    
    const products = await page.$$eval('.product, .goods, .item, [class*="product"], [class*="goods"]', els =>
      els.map(e => ({ tag: e.tagName, text: e.textContent?.trim().substring(0, 80), class: e.className?.substring(0, 50) }))
    );
    console.log('Products:', JSON.stringify(products, null, 2));
  }

  // Go to cart
  await page.goto('http://localhost:8089/pages/cart/cart', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  const cartText = await page.textContent('body');
  console.log('Cart page (first 1000 chars):', cartText?.substring(0, 1000));
  await page.screenshot({ path: '/TG/test/screenshots/explore-cart.png', fullPage: true });

  await browser.close();
}

explore().catch(e => console.error(e));
