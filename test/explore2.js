const { chromium } = require('playwright');

async function explore() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });

  // 1. Click "商品" tab in the bottom nav
  await page.goto('http://localhost:8089', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  
  // Click "商品" tabbar
  const productTab = await page.$('text="商品"');
  if (productTab) {
    console.log('Clicking 商品 tab...');
    await productTab.click();
    await new Promise(r => setTimeout(r, 3000));
  }
  
  console.log('=== After clicking 商品 tab ===');
  console.log('URL:', page.url());
  const bodyText = await page.textContent('body');
  console.log('Body text (first 3000 chars):', bodyText?.substring(0, 3000));
  await page.screenshot({ path: '/TG/test/screenshots/explore-product-tab.png', fullPage: true });

  // Try clicking "零食" category tab
  const snackTab = await page.$('text="零食"');
  if (snackTab) {
    console.log('\nClicking 零食 tab...');
    await snackTab.click();
    await new Promise(r => setTimeout(r, 2000));
    const afterSnack = await page.textContent('body');
    console.log('After snack (first 1500 chars):', afterSnack?.substring(0, 1500));
    await page.screenshot({ path: '/TG/test/screenshots/explore-snack-tab.png', fullPage: true });
    
    // Get all product cards
    const allElements = await page.$$eval('*', els => 
      els.filter(e => {
        const text = e.textContent?.trim();
        return text && (text.includes('¥') || text.includes('加入')) && e.children.length < 5;
      }).map(e => ({ tag: e.tagName, text: e.textContent?.trim().substring(0, 60), class: e.className?.substring(0, 40) }))
    );
    console.log('Product-like elements:', JSON.stringify(allElements.slice(0, 10), null, 2));
  }

  // Try clicking "奶茶" or "奶茶店" category tab  
  const milkTabs = await page.$$eval('text="奶茶", text="奶茶店"', els => els.map(e => e.textContent?.trim()));
  console.log('Milk tea tabs found:', milkTabs);
  
  const milkTab = await page.$('text="奶茶店"') || await page.$('text="奶茶"');
  if (milkTab) {
    console.log('\nClicking milk tea tab...');
    await milkTab.click();
    await new Promise(r => setTimeout(r, 2000));
    const afterMilk = await page.textContent('body');
    console.log('After milk (first 1500 chars):', afterMilk?.substring(0, 1500));
    await page.screenshot({ path: '/TG/test/screenshots/explore-milk-tab.png', fullPage: true });
  }

  // Try "饮料" tab
  const drinkTab = await page.$('text="饮料"');
  if (drinkTab) {
    console.log('\nClicking 饮料 tab...');
    await drinkTab.click();
    await new Promise(r => setTimeout(r, 2000));
    const afterDrink = await page.textContent('body');
    console.log('After drink (first 1500 chars):', afterDrink?.substring(0, 1500));
    await page.screenshot({ path: '/TG/test/screenshots/explore-drink-tab.png', fullPage: true });
  }

  // Get all category-like elements
  const allTabs = await page.$$eval('[class*="tab"], .tab, .category', els =>
    els.map(e => ({ tag: e.tagName, text: e.textContent?.trim().substring(0, 30), class: e.className?.substring(0, 50) }))
  );
  console.log('\nAll tab-like elements:', JSON.stringify(allTabs, null, 2));

  await browser.close();
}

explore().catch(e => console.error(e));
