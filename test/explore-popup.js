const { chromium } = require('playwright');

async function explorePopup() {
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
  
  // Click 奶茶店 tab
  console.log('Clicking 奶茶店 tab...');
  await page.click('text="奶茶店"');
  await new Promise(r => setTimeout(r, 2000));
  
  // Get product info
  const products = await page.$$('.product-card');
  console.log('Milk tea products:', products.length);
  
  for (let i = 0; i < Math.min(3, products.length); i++) {
    const name = await products[i].$eval('.product-name span', el => el.textContent).catch(() => '?');
    const cat = await products[i].$eval('.product-category span', el => el.textContent).catch(() => '?');
    // Check for option label
    const optionEl = await products[i].$('.product-option, text="选项"');
    const optionText = optionEl ? await optionEl.textContent() : null;
    console.log(`  Product ${i}: ${name} (${cat}), option label: ${optionText}`);
  }
  
  // Add first milk tea
  console.log('\nAdding first milk tea...');
  const firstProduct = products[0];
  const addBtn = await firstProduct.$('.add-cart-btn');
  if (addBtn) {
    await addBtn.click();
    await new Promise(r => setTimeout(r, 3000));
    
    // Check for any overlay/modal
    const modalMask = await page.$('.modal-mask');
    const modalOverlay = await page.$('.modal-overlay');
    const popup = modalMask || modalOverlay;
    
    if (popup) {
      const text = await popup.textContent();
      console.log('Modal text:', text?.substring(0, 1000));
      
      // Check for specific option-related elements
      const hasTemp = text.includes('温度') || text.includes('冰');
      const hasSugar = text.includes('糖度') || text.includes('糖');
      const hasOptions = text.includes('选项') || text.includes('选择') || text.includes('规格');
      console.log('Has temp options:', hasTemp);
      console.log('Has sugar options:', hasSugar);
      console.log('Has options text:', hasOptions);
      
      // Save screenshot
      await page.screenshot({ path: '/TG/test/screenshots/explore-popup-full.png', fullPage: true });
      
      // Look for option-related elements in the popup
      const allElements = await popup.$$eval('*', els =>
        els.filter(e => {
          const t = e.textContent?.trim();
          return t && (t.includes('冰') || t.includes('糖') || t.includes('温度') || t.includes('选择') || t.includes('确定'));
        }).map(e => ({ tag: e.tagName, text: e.textContent?.trim().substring(0, 30), class: e.className?.substring(0, 40) }))
      );
      console.log('Option-related elements:', JSON.stringify(allElements, null, 2));
      
      // Click 确定 if present
      const confirmBtn = await page.$('text="确定"');
      if (confirmBtn) {
        await confirmBtn.click();
        await new Promise(r => setTimeout(r, 1000));
        console.log('Clicked 确定');
      }
    } else {
      console.log('No modal/popup appeared!');
      // Check if there's a toast
      const toast = await page.$('.uni-toast, .toast');
      if (toast) {
        const toastText = await toast.textContent();
        console.log('Toast:', toastText);
      }
      // Check if product was added
      const cartBar = await page.$('text="下单"');
      if (cartBar) {
        console.log('Cart bar visible (product was added)');
      }
    }
    
    // Dismiss any remaining modal
    const remainingModal = await page.$('.modal-mask, .modal-overlay');
    if (remainingModal) {
      const remainingText = await remainingModal.textContent();
      console.log('Remaining modal text:', remainingText?.substring(0, 300));
      const dismissBtn = await remainingModal.$('text="知道了", text="确定"');
      if (dismissBtn) {
        await dismissBtn.click();
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }
  
  // Now check cart
  console.log('\nChecking cart...');
  const orderBtn = await page.$('text="下单"');
  if (orderBtn) {
    await orderBtn.click();
    await new Promise(r => setTimeout(r, 2000));
    
    const cartText = await page.textContent('body');
    console.log('Cart text:', cartText?.substring(0, 800));
    await page.screenshot({ path: '/TG/test/screenshots/explore-cart-after.png', fullPage: true });
    
    // Check for +/-/delete buttons
    const plusBtn = await page.$('.add-cart-btn');
    const minusBtn = await page.$('.reduce-btn, .minus-btn, [class*="reduce"], [class*="minus"]');
    const deleteBtn = await page.$('.delete-btn, [class*="delete"]');
    
    console.log('Plus button:', !!plusBtn);
    console.log('Minus button:', !!minusBtn);
    console.log('Delete button:', !!deleteBtn);
    
    // Get all button-like elements
    const buttons = await page.$$eval('button, [class*="btn"], [class*="button"]', els =>
      els.map(e => ({ tag: e.tagName, text: e.textContent?.trim(), class: e.className?.substring(0, 40) }))
    );
    console.log('Buttons:', JSON.stringify(buttons, null, 2));
  }

  await browser.close();
}

explorePopup().catch(e => console.error(e));
