const { chromium } = require('playwright');

async function explore4() {
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

  // Close any welcome modal first
  const knowBtn = await page.$('text="知道了"');
  if (knowBtn) {
    console.log('Closing welcome modal...');
    await knowBtn.click();
    await new Promise(r => setTimeout(r, 1500));
  }

  // Check if modal overlay gone
  const overlayStill = await page.$('.modal-overlay');
  console.log('Modal overlay still present:', !!overlayStill);

  // Click "零食" tab
  await page.click('text="零食"');
  await new Promise(r => setTimeout(r, 1500));

  // Add snack to cart
  console.log('\nAdding snack to cart...');
  await page.click('.product-card .add-cart-btn');
  await new Promise(r => setTimeout(r, 2000));
  
  // Check what appears
  const modalOverlay = await page.$('.modal-overlay');
  if (modalOverlay) {
    const modalHtml = await modalOverlay.innerHTML();
    console.log('Modal overlay HTML:', modalHtml?.substring(0, 500));
    // Click to dismiss
    const dismissBtn = await page.$('.modal-overlay .btn, .modal-overlay button, text="知道了", text="确定"');
    if (dismissBtn) {
      await dismissBtn.click();
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  // Check for toast
  const toastEl = await page.$('.uni-toast, .toast, [class*="toast"], [class*="message"]');
  if (toastEl) {
    const toastText = await toastEl.textContent();
    console.log('Toast:', toastText);
  }

  await page.screenshot({ path: '/TG/test/screenshots/explore-snack-added.png', fullPage: true });

  // Now click "奶茶店" tab
  console.log('\nClicking 奶茶店 tab...');
  await page.click('text="奶茶店"');
  await new Promise(r => setTimeout(r, 1500));

  // Add milk tea to cart
  console.log('Adding milk tea to cart...');
  await page.click('.product-card .add-cart-btn');
  await new Promise(r => setTimeout(r, 2500));
  
  // Check for options popup
  const optionsPopup = await page.$('.modal-overlay, .uni-popup, .spec-popup, .option-dialog');
  if (optionsPopup) {
    const optionsHtml = await optionsPopup.innerHTML();
    console.log('Options popup HTML (first 2000 chars):', optionsHtml?.substring(0, 2000));
    
    // Get popup text content
    const popupText = await optionsPopup.textContent();
    console.log('Popup text:', popupText?.substring(0, 500));
    
    // Check for temperature options
    const tempLabels = await page.$$('text="正常冰", text="去冰", text="常温", text="热"');
    console.log('Temperature options found:', tempLabels.length);
    
    // Check for sugar options
    const sugarLabels = await page.$$('text="少糖", text="半糖", text="全糖", text="无糖", text="标准糖"');
    console.log('Sugar options found:', sugarLabels.length);
    
    // Select first temp option
    if (tempLabels.length > 0) {
      await tempLabels[0].click();
      await new Promise(r => setTimeout(r, 500));
    }
    // Select first sugar option
    if (sugarLabels.length > 0) {
      await sugarLabels[0].click();
      await new Promise(r => setTimeout(r, 500));
    }
    
    // Click confirm
    const confirmBtn = await page.$('text="确定"');
    if (confirmBtn) {
      await confirmBtn.click();
      await new Promise(r => setTimeout(r, 1500));
      console.log('Clicked 确定');
    }
  }

  await page.screenshot({ path: '/TG/test/screenshots/explore-milk-added.png', fullPage: true });

  // Find and click cart - look for floating cart bar
  const cartElements = await page.$$eval('[class*="cart-bar"], [class*="cart-float"], [class*="cart-wrap"], .cart-bar, .float-cart', els =>
    els.map(e => ({ tag: e.tagName, text: e.textContent?.trim().substring(0, 30), class: e.className }))
  );
  console.log('\nCart bar elements:', JSON.stringify(cartElements, null, 2));

  // Try to find clickable cart element
  const cartBar = await page.$('.cart-bar, [class*="cart-bar"], [class*="cart-float"]');
  if (cartBar) {
    await cartBar.click();
    await new Promise(r => setTimeout(r, 2000));
    console.log('\n=== Cart page ===');
    console.log('Cart URL:', page.url());
    const cartBody = await page.textContent('body');
    console.log('Cart body (first 2000 chars):', cartBody?.substring(0, 2000));
    await page.screenshot({ path: '/TG/test/screenshots/explore-cart-final.png', fullPage: true });
    
    // Check for submit button
    const submitBtn = await page.$('text="提交订单", .submit-btn, button:has-text("提交")');
    if (submitBtn) {
      console.log('Found submit order button');
    }
  }

  await browser.close();
}

explore4().catch(e => console.error(e));
