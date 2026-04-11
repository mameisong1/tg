const { chromium } = require('playwright');

async function explore3() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });

  // Navigate to products
  await page.goto('http://localhost:8089', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.click('text="商品"');
  await new Promise(r => setTimeout(r, 2000));

  // Click "零食" tab
  await page.click('text="零食"');
  await new Promise(r => setTimeout(r, 1500));

  // Get first product card HTML
  const firstCard = await page.$('.product-card');
  if (firstCard) {
    const html = await firstCard.innerHTML();
    console.log('=== First snack product card HTML ===');
    console.log(html);
  }

  // Click the "+" button on first snack product
  const addBtn = await page.$('.product-card .add-btn, .product-card button, .product-card [class*="add"], .product-card text:has-text("+")');
  if (addBtn) {
    console.log('\nClicking add button on first snack product...');
    await addBtn.click();
    await new Promise(r => setTimeout(r, 2000));
    
    // Check for popup
    const popupVisible = await page.isVisible('.uni-popup, .modal, [class*="popup"], [class*="dialog"], [class*="spec"], [class*="option"]');
    console.log('Popup visible after snack add:', popupVisible);
    
    const bodyText = await page.textContent('body');
    console.log('Body after snack add (first 1000 chars):', bodyText?.substring(0, 1000));
    await page.screenshot({ path: '/TG/test/screenshots/explore-snack-add.png', fullPage: true });
  }

  // Go back and try milk tea
  await page.click('text="奶茶店"');
  await new Promise(r => setTimeout(r, 1500));

  const milkCard = await page.$('.product-card');
  if (milkCard) {
    const html = await milkCard.innerHTML();
    console.log('\n=== First milk tea product card HTML ===');
    console.log(html);
  }

  const milkAddBtn = await page.$('.product-card .add-btn, .product-card button, .product-card [class*="add"], .product-card text:has-text("+")');
  if (milkAddBtn) {
    console.log('\nClicking add button on first milk tea product...');
    await milkAddBtn.click();
    await new Promise(r => setTimeout(r, 2500));
    
    const popupVisible = await page.isVisible('.uni-popup, .modal, [class*="popup"], [class*="dialog"], [class*="spec"], [class*="option"]');
    console.log('Popup visible after milk tea add:', popupVisible);
    
    if (popupVisible) {
      // Get popup content
      const popupContent = await page.$('.uni-popup, .modal, [class*="popup"], [class*="dialog"], [class*="spec"], [class*="option"]');
      if (popupContent) {
        const popupHtml = await popupContent.innerHTML();
        console.log('=== Popup HTML (first 2000 chars) ===');
        console.log(popupHtml?.substring(0, 2000));
      }
      
      // Try to click "确定"
      const confirmBtn = await page.$('text="确定"');
      if (confirmBtn) {
        await confirmBtn.click();
        await new Promise(r => setTimeout(r, 1500));
        console.log('Clicked 确定');
      }
    }
    
    const bodyText = await page.textContent('body');
    console.log('Body after milk tea add (first 1000 chars):', bodyText?.substring(0, 1000));
    await page.screenshot({ path: '/TG/test/screenshots/explore-milk-add.png', fullPage: true });
  }

  // Check cart
  await new Promise(r => setTimeout(r, 1000));
  // Look for cart icon or link
  const cartLink = await page.$('text="购物车", [class*="cart"]');
  if (cartLink) {
    await cartLink.click();
    await new Promise(r => setTimeout(r, 2000));
    console.log('\n=== Cart page ===');
    console.log('Cart URL:', page.url());
    const cartBody = await page.textContent('body');
    console.log('Cart body (first 1500 chars):', cartBody?.substring(0, 1500));
    await page.screenshot({ path: '/TG/test/screenshots/explore-cart-content.png', fullPage: true });
  }

  // Also check if there's a floating cart bar
  const allLinks = await page.$$eval('a, [class*="cart"], [class*="float"]', els =>
    els.map(e => ({ tag: e.tagName, text: e.textContent?.trim().substring(0, 30), href: e.href, class: e.className?.substring(0, 40) }))
  );
  console.log('\nCart/float links:', JSON.stringify(allLinks, null, 2));

  await browser.close();
}

explore3().catch(e => console.error(e));
