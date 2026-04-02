/**
 * 下单功能测试脚本
 * 测试台桌授权和购物车功能
 */

const { chromium } = require('playwright');

const BASE_URL = 'https://tiangong.club';
const EXPIRE_MINUTES = 30; // 生产环境授权有效期

async function test() {
  console.log('========================================');
  console.log('[2026-04-02 12:05] 下单功能测试');
  console.log('========================================\n');
  
  // 连接 Chrome
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();
  let page = pages.find(p => p.url().includes('tiangong')) || pages[0];
  
  if (!page || !page.url().includes('tiangong')) {
    page = await context.newPage();
  }
  
  // ========================================
  // 测试 1：未扫码进入
  // ========================================
  console.log('\n========== 测试 1：未扫码进入 ==========\n');
  
  // 1.1：清除台桌授权
  console.log('【步骤 1.1】清除台桌授权...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // 清除台桌授权
  await page.evaluate(() => {
    localStorage.removeItem('tableAuth');
    localStorage.removeItem('tableName');
    localStorage.removeItem('tablePinyin');
  });
  console.log('  清除成功');
  
  // 1.2：进入会员中心
  console.log('\n【步骤 1.2】进入会员中心...');
  await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test1-member.png' });
  
  const memberText = await page.locator('body').innerText();
  const hasScanTip1a = memberText.includes('未扫码') || memberText.includes('扫码') || memberText.includes('请用手机相机扫码');
  console.log('  a. 有扫码提示:', hasScanTip1a ? '✅ 是' : '❌ 否');
  
  // 1.3：进入商品一览
  console.log('\n【步骤 1.3】进入商品一览...');
  await page.goto(`${BASE_URL}/#/pages/products/products`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test1-products.png' });
  
  const productsText = await page.locator('body').innerText();
  const hasScanTip1b = productsText.includes('扫码') || productsText.includes('选台') || productsText.includes('请先扫码');
  console.log('  b. 有扫码提示:', hasScanTip1b ? '✅ 是' : '❌ 否');
  
  // 1.4：尝试加购
  console.log('\n【步骤 1.4】尝试加购...');
  
  // 找一个商品点击
  const productItems = await page.locator('[class*="product"], [class*="item"]').all();
  let canAddToCart = false;
  
  if (productItems.length > 0) {
    try {
      // 点击第一个商品
      await productItems[0].click();
      await page.waitForTimeout(2000);
      
      // 检查是否有加购按钮
      const addBtn = page.locator('[class*="add"], [class*="cart"]').first();
      if (await addBtn.isVisible()) {
        await addBtn.click();
        await page.waitForTimeout(1000);
        canAddToCart = true;
      }
    } catch (e) {
      console.log('  点击商品失败:', e.message);
    }
  }
  
  // 检查是否有提示阻止加购
  const pageContent = await page.locator('body').innerText();
  const blockedByTip = pageContent.includes('请先扫码') || pageContent.includes('请扫台桌');
  
  console.log('  c. 无法加购:', blockedByTip || !canAddToCart ? '✅ 正确' : '❌ 可以加购（错误）');
  await page.screenshot({ path: '/tmp/order-test1-add-cart.png' });
  
  // 1.5：进入购物车
  console.log('\n【步骤 1.5】进入购物车...');
  await page.goto(`${BASE_URL}/#/pages/cart/cart`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test1-cart.png' });
  
  const cartText = await page.locator('body').innerText();
  const cannotOrder = cartText.includes('请扫码') || cartText.includes('未选台') || !cartText.includes('提交') || cartText.includes('选台');
  console.log('  d. 无法下单:', cannotOrder ? '✅ 正确' : '❌ 可以下单（错误）');
  
  // ========================================
  // 测试 2：扫码进入 (que1)
  // ========================================
  console.log('\n========== 测试 2：扫码进入 (que1) ==========\n');
  
  // 2.1：扫码进入
  console.log('【步骤 2.1】扫码进入 que1...');
  await page.goto(`${BASE_URL}/?table=que1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  console.log('  URL:', page.url());
  await page.screenshot({ path: '/tmp/order-test2-scan-enter.png' });
  
  // 2.2：进入会员中心检查台桌名
  console.log('\n【步骤 2.2】进入会员中心...');
  await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test2-member.png' });
  
  const memberText2 = await page.locator('body').innerText();
  const hasTableName2a = memberText2.includes('雀') || memberText2.includes('que1') || memberText2.includes('斯诺克');
  console.log('  a. 有台桌名:', hasTableName2a ? '✅ 是' : '❌ 否');
  console.log('  台桌信息:', memberText2.substring(0, 200));
  
  // 2.3：进入商品一览
  console.log('\n【步骤 2.3】进入商品一览...');
  await page.goto(`${BASE_URL}/#/pages/products/products`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test2-products.png' });
  
  const productsText2 = await page.locator('body').innerText();
  const noScanTip2b = !productsText2.includes('请先扫码') && !productsText2.includes('请扫码选台');
  console.log('  b. 无扫码提示:', noScanTip2b ? '✅ 是' : '❌ 否（有提示）');
  
  // 2.4：加购商品
  console.log('\n【步骤 2.4】加购商品...');
  
  let addedToCart = false;
  const addButtons = await page.locator('[class*="add-btn"], [class*="cart-btn"]').all();
  
  if (addButtons.length > 0) {
    try {
      await addButtons[0].click();
      await page.waitForTimeout(1000);
      addedToCart = true;
      console.log('  点击加购成功');
    } catch (e) {
      console.log('  点击失败:', e.message);
    }
  } else {
    // 尝试其他方式：点击商品详情页的加购
    const productCards = await page.locator('[class*="product-card"], [class*="goods"]').all();
    if (productCards.length > 0) {
      await productCards[0].click();
      await page.waitForTimeout(2000);
      
      // 在详情页找加购按钮
      const detailAddBtn = page.locator('[class*="add"]').first();
      if (await detailAddBtn.isVisible()) {
        await detailAddBtn.click();
        addedToCart = true;
        console.log('  详情页加购成功');
      }
    }
  }
  
  console.log('  c. 可以加购:', addedToCart ? '✅ 是' : '❌ 否');
  await page.screenshot({ path: '/tmp/order-test2-add-cart.png' });
  
  // 2.5：进入购物车
  console.log('\n【步骤 2.5】进入购物车...');
  await page.goto(`${BASE_URL}/#/pages/cart/cart`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test2-cart.png' });
  
  const cartText2 = await page.locator('body').innerText();
  const hasTableInCart2d = cartText2.includes('雀') || cartText2.includes('斯诺克');
  console.log('  d. 购物车有台桌名:', hasTableInCart2d ? '✅ 是' : '❌ 否');
  
  // 检查是否可以下单
  const canOrder2 = cartText2.includes('提交') || cartText2.includes('下单') || cartText2.includes('结算');
  console.log('  可以下单:', canOrder2 ? '✅ 是' : '❌ 否');
  
  // 实际下单测试（可选）
  if (canOrder2 && addedToCart) {
    console.log('\n【步骤 2.6】尝试下单...');
    const orderBtn = page.locator('[class*="submit"], [class*="order"]').first();
    try {
      if (await orderBtn.isVisible()) {
        await orderBtn.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: '/tmp/order-test2-order-result.png' });
        
        const orderResult = await page.locator('body').innerText();
        const orderSuccess = orderResult.includes('成功') || orderResult.includes('订单') || !orderResult.includes('失败');
        console.log('  下单结果:', orderSuccess ? '✅ 成功' : '❌ 失败');
      }
    } catch (e) {
      console.log('  下单失败:', e.message);
    }
  }
  
  // ========================================
  // 测试 3：台桌码失效
  // ========================================
  console.log('\n========== 测试 3：台桌码失效（模拟过期） ==========\n');
  
  // 3.1：模拟台桌授权过期（修改 localStorage 时间戳）
  console.log('【步骤 3.1】模拟授权过期...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  // 设置过期的授权时间（30分钟前）
  await page.evaluate(() => {
    const expiredTime = Date.now() - (31 * 60 * 1000); // 31分钟前
    const tableAuth = {
      table: 'que1',
      tableName: '雀斯诺克1号房',
      time: expiredTime
    };
    localStorage.setItem('tableAuth', JSON.stringify(tableAuth));
    localStorage.setItem('tableName', '雀斯诺克1号房');
    localStorage.setItem('tablePinyin', 'que1');
  });
  console.log('  已设置过期授权（31分钟前）');
  
  // 3.2：进入会员中心
  console.log('\n【步骤 3.2】进入会员中心...');
  await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test3-member.png' });
  
  const memberText3 = await page.locator('body').innerText();
  const hasScanTip3a = memberText3.includes('未扫码') || memberText3.includes('请用手机相机扫码') || memberText3.includes('扫码进入');
  console.log('  a. 有扫码提示:', hasScanTip3a ? '✅ 是' : '❌ 否');
  
  // 3.3：进入商品一览
  console.log('\n【步骤 3.3】进入商品一览...');
  await page.goto(`${BASE_URL}/#/pages/products/products`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test3-products.png' });
  
  const productsText3 = await page.locator('body').innerText();
  const hasScanTip3b = productsText3.includes('扫码') || productsText3.includes('选台');
  console.log('  b. 有扫码提示:', hasScanTip3b ? '✅ 是' : '❌ 否');
  
  // 3.4：尝试加购
  console.log('\n【步骤 3.4】尝试加购...');
  
  // 清空购物车后再测试
  await page.evaluate(() => {
    localStorage.removeItem('sessionId');
  });
  
  const addButtons3 = await page.locator('[class*="add-btn"], [class*="cart-btn"]').all();
  let canAdd3 = false;
  
  if (addButtons3.length > 0) {
    try {
      await addButtons3[0].click();
      await page.waitForTimeout(1000);
      
      // 检查是否有阻止提示
      const afterClickText = await page.locator('body').innerText();
      if (afterClickText.includes('请先扫码') || afterClickText.includes('扫码')) {
        canAdd3 = false;
        console.log('  有阻止提示');
      } else {
        canAdd3 = true;
      }
    } catch (e) {
      console.log('  点击失败');
    }
  }
  
  console.log('  c. 无法加购:', !canAdd3 ? '✅ 正确' : '❌ 可以加购（错误）');
  await page.screenshot({ path: '/tmp/order-test3-add-cart.png' });
  
  // 3.5：进入购物车
  console.log('\n【步骤 3.5】进入购物车...');
  await page.goto(`${BASE_URL}/#/pages/cart/cart`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test3-cart.png' });
  
  const cartText3 = await page.locator('body').innerText();
  const cannotOrder3 = cartText3.includes('请扫码') || cartText3.includes('未选台') || !cartText3.includes('提交');
  console.log('  d. 无法下单:', cannotOrder3 ? '✅ 正确' : '❌ 可以下单（错误）');
  
  // ========================================
  // 测试 4：重新扫码进入
  // ========================================
  console.log('\n========== 测试 4：重新扫码进入 (que1) ==========\n');
  
  // 4.1：重新扫码
  console.log('【步骤 4.1】重新扫码 que1...');
  await page.goto(`${BASE_URL}/?table=que1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  console.log('  URL:', page.url());
  await page.screenshot({ path: '/tmp/order-test4-scan-enter.png' });
  
  // 4.2：会员中心
  console.log('\n【步骤 4.2】会员中心...');
  await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test4-member.png' });
  
  const memberText4 = await page.locator('body').innerText();
  const hasTableName4a = memberText4.includes('雀') || memberText4.includes('斯诺克');
  console.log('  a. 有台桌名:', hasTableName4a ? '✅ 是' : '❌ 否');
  
  // 4.3：商品一览
  console.log('\n【步骤 4.3】商品一览...');
  await page.goto(`${BASE_URL}/#/pages/products/products`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test4-products.png' });
  
  const productsText4 = await page.locator('body').innerText();
  const noScanTip4b = !productsText4.includes('请先扫码');
  console.log('  b. 无扫码提示:', noScanTip4b ? '✅ 是' : '❌ 否');
  
  // 4.4：加购
  console.log('\n【步骤 4.4】加购...');
  const addButtons4 = await page.locator('[class*="add-btn"], [class*="cart-btn"]').all();
  let added4 = false;
  
  if (addButtons4.length > 0) {
    try {
      await addButtons4[0].click();
      await page.waitForTimeout(1000);
      added4 = true;
    } catch (e) {}
  }
  
  console.log('  c. 可以加购:', added4 ? '✅ 是' : '❌ 否');
  await page.screenshot({ path: '/tmp/order-test4-add-cart.png' });
  
  // 4.5：购物车下单
  console.log('\n【步骤 4.5】购物车...');
  await page.goto(`${BASE_URL}/#/pages/cart/cart`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test4-cart.png' });
  
  const cartText4 = await page.locator('body').innerText();
  const hasTable4d = cartText4.includes('雀') || cartText4.includes('斯诺克');
  const canOrder4 = cartText4.includes('提交') || cartText4.includes('下单');
  console.log('  d. 有台桌名:', hasTable4d ? '✅ 是' : '❌ 否');
  console.log('  可以下单:', canOrder4 ? '✅ 是' : '❌ 否');
  
  // ========================================
  // 测试 5：换台桌扫码 (putai2)
  // ========================================
  console.log('\n========== 测试 5：换台桌扫码 (putai2) ==========\n');
  
  // 5.1：扫码进入普台2
  console.log('【步骤 5.1】扫码进入 putai2...');
  await page.goto(`${BASE_URL}/?table=putai2`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  console.log('  URL:', page.url());
  await page.screenshot({ path: '/tmp/order-test5-scan-enter.png' });
  
  // 5.2：会员中心
  console.log('\n【步骤 5.2】会员中心...');
  await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test5-member.png' });
  
  const memberText5 = await page.locator('body').innerText();
  const hasPutai2a = memberText5.includes('普台2') || memberText5.includes('普台') && memberText5.includes('2');
  console.log('  a. 有台桌名普台2:', hasPutai2a ? '✅ 是' : '❌ 否');
  console.log('  台桌信息:', memberText5.substring(0, 200));
  
  // 5.3：商品一览
  console.log('\n【步骤 5.3】商品一览...');
  await page.goto(`${BASE_URL}/#/pages/products/products`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test5-products.png' });
  
  const productsText5 = await page.locator('body').innerText();
  const noScanTip5b = !productsText5.includes('请先扫码');
  console.log('  b. 无扫码提示:', noScanTip5b ? '✅ 是' : '❌ 否');
  
  // 5.4：加购
  console.log('\n【步骤 5.4】加购...');
  const addButtons5 = await page.locator('[class*="add-btn"], [class*="cart-btn"]').all();
  let added5 = false;
  
  if (addButtons5.length > 0) {
    try {
      await addButtons5[0].click();
      await page.waitForTimeout(1000);
      added5 = true;
    } catch (e) {}
  }
  
  console.log('  c. 可以加购:', added5 ? '✅ 是' : '❌ 否');
  await page.screenshot({ path: '/tmp/order-test5-add-cart.png' });
  
  // 5.5：购物车
  console.log('\n【步骤 5.5】购物车...');
  await page.goto(`${BASE_URL}/#/pages/cart/cart`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test5-cart.png' });
  
  const cartText5 = await page.locator('body').innerText();
  const hasPutai2d = cartText5.includes('普台2') || cartText5.includes('普台') && cartText5.includes('2');
  const canOrder5 = cartText5.includes('提交') || cartText5.includes('下单');
  console.log('  d. 有台桌名普台2:', hasPutai2d ? '✅ 是' : '❌ 否');
  console.log('  可以下单:', canOrder5 ? '✅ 是' : '❌ 否');
  
  // ========================================
  // 测试总结
  // ========================================
  console.log('\n========================================');
  console.log('测试总结');
  console.log('========================================');
  console.log('');
  console.log('测试 1：未扫码进入');
  console.log('  a. 会员中心有扫码提示:', hasScanTip1a ? '✅ 通过' : '❌ 失败');
  console.log('  b. 商品一览有扫码提示:', hasScanTip1b ? '✅ 通过' : '❌ 失败');
  console.log('  c. 无法加购:', blockedByTip || !canAddToCart ? '✅ 通过' : '❌ 失败');
  console.log('  d. 无法下单:', cannotOrder ? '✅ 通过' : '❌ 失败');
  console.log('');
  console.log('测试 2：扫码进入 (que1)');
  console.log('  a. 会员中心有台桌名:', hasTableName2a ? '✅ 通过' : '❌ 失败');
  console.log('  b. 商品一览无扫码提示:', noScanTip2b ? '✅ 通过' : '❌ 失败');
  console.log('  c. 可以加购:', addedToCart ? '✅ 通过' : '❌ 失败');
  console.log('  d. 购物车可下单:', canOrder2 ? '✅ 通过' : '❌ 失败');
  console.log('');
  console.log('测试 3：台桌码失效');
  console.log('  a. 会员中心有扫码提示:', hasScanTip3a ? '✅ 通过' : '❌ 失败');
  console.log('  b. 商品一览有扫码提示:', hasScanTip3b ? '✅ 通过' : '❌ 失败');
  console.log('  c. 无法加购:', !canAdd3 ? '✅ 通过' : '❌ 失败');
  console.log('  d. 无法下单:', cannotOrder3 ? '✅ 通过' : '❌ 失败');
  console.log('');
  console.log('测试 4：重新扫码进入');
  console.log('  a. 会员中心有台桌名:', hasTableName4a ? '✅ 通过' : '❌ 失败');
  console.log('  b. 商品一览无扫码提示:', noScanTip4b ? '✅ 通过' : '❌ 失败');
  console.log('  c. 可以加购:', added4 ? '✅ 通过' : '❌ 失败');
  console.log('  d. 购物车可下单:', canOrder4 ? '✅ 通过' : '❌ 失败');
  console.log('');
  console.log('测试 5：换台桌扫码 (putai2)');
  console.log('  a. 会员中心有台桌名普台2:', hasPutai2a ? '✅ 通过' : '❌ 失败');
  console.log('  b. 商品一览无扫码提示:', noScanTip5b ? '✅ 通过' : '❌ 失败');
  console.log('  c. 可以加购:', added5 ? '✅ 通过' : '❌ 失败');
  console.log('  d. 购物车有台桌名普台2:', hasPutai2d ? '✅ 通过' : '❌ 失败');
  console.log('');
  console.log('========================================');
  
  await browser.close();
}

test().catch(console.error);