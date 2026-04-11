const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = '/TG/test/screenshots';
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function screenshot(page, name) {
    const filePath = path.join(SCREENSHOTS_DIR, name);
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`✅ 截图: ${name}`);
    return filePath;
}

async function run() {
    console.log('连接Chrome...');
    const browser = await puppeteer.connect({
        browserURL: 'http://127.0.0.1:9222',
        defaultViewport: { width: 390, height: 844 }
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    const BASE = 'http://localhost:8089';

    // TC-01: 无选项商品正常下单
    console.log('\n=== TC-01: 无选项商品 ===');
    await page.goto(`${BASE}/#/pages/products/products`, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    // 选择零食分类
    const snackBtn = await page.$$('view[class*="category-text"]');
    for (const btn of snackBtn) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text.includes('零食')) {
            await btn.click();
            break;
        }
    }
    await new Promise(r => setTimeout(r, 1500));
    await screenshot(page, 'tc01-snack-category.png');

    // 点击一个零食商品加购物车
    const addBtns = await page.$$('view[class*="add-cart-btn"]');
    if (addBtns.length > 0) {
        await addBtns[0].click();
        await new Promise(r => setTimeout(r, 1500));
    }
    await screenshot(page, 'tc01-no-options-order.png');

    // TC-02: 奶茶店选项
    console.log('\n=== TC-02: 奶茶店选项 ===');
    // 点击奶茶店分类
    const categoryBtns = await page.$$('view[class*="category-text"]');
    for (const btn of categoryBtns) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text.includes('奶茶店')) {
            await btn.click();
            break;
        }
    }
    await new Promise(r => setTimeout(r, 2000));
    await screenshot(page, 'tc02-milk-tea-category.png');

    // 点击第一个奶茶商品
    const milkAddBtns = await page.$$('view[class*="add-cart-btn"]');
    if (milkAddBtns.length > 0) {
        await milkAddBtns[0].click();
    }
    await new Promise(r => setTimeout(r, 2000));
    // 截图选项弹窗
    await screenshot(page, 'tc02-milk-tea-options.png');

    // 选择温度(第一个)
    const tempOptions = await page.$$('view[class*="option-item"]');
    if (tempOptions.length > 0) {
        // 找到温度区域的第一个选项
        await tempOptions[0].click();
        await new Promise(r => setTimeout(r, 500));
    }
    // 选择糖度
    if (tempOptions.length > 1) {
        await tempOptions[1].click();
        await new Promise(r => setTimeout(r, 500));
    }
    // 点击确定
    const confirmBtn = await page.$('view[class*="btn-confirm"]');
    if (confirmBtn) await confirmBtn.click();
    await new Promise(r => setTimeout(r, 1500));
    await screenshot(page, 'tc02-added-to-cart.png');

    // TC-03: 购物车管理
    console.log('\n=== TC-03: 购物车管理 ===');
    // 点击购物车浮动按钮
    const cartFloat = await page.$('view[class*="cart-float"]');
    if (cartFloat) {
        await cartFloat.click();
        await new Promise(r => setTimeout(r, 2000));
    } else {
        await page.goto(`${BASE}/#/pages/cart/cart`, { waitUntil: 'networkidle0', timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000));
    }
    await screenshot(page, 'tc03-cart-manage.png');

    // TC-04: 饮料通配
    console.log('\n=== TC-04: 饮料通配 ===');
    await page.goto(`${BASE}/#/pages/products/products`, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));
    // 选择饮料分类
    const catBtns = await page.$$('view[class*="category-text"]');
    for (const btn of catBtns) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text.includes('饮料')) {
            await btn.click();
            break;
        }
    }
    await new Promise(r => setTimeout(r, 2000));
    // 点击第一个饮料商品
    const drinkAddBtns = await page.$$('view[class*="add-cart-btn"]');
    if (drinkAddBtns.length > 0) {
        await drinkAddBtns[0].click();
    }
    await new Promise(r => setTimeout(r, 2000));
    await screenshot(page, 'tc04-drink-wildcard.png');

    // TC-05: 数据库验证
    console.log('\n=== TC-05: 数据库验证 ===');
    const { execSync } = require('child_process');
    const result = execSync('sqlite3 /TG/tgservice/db/tgservice.db "SELECT items FROM orders ORDER BY id DESC LIMIT 1;"').toString();
    console.log('订单items:', result);
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'tc05-db-order-options.txt'), result);
    // 截图终端输出 - 用页面显示
    await page.setContent(`<pre style="padding:20px;font-size:14px;background:#1a1a2e;color:#fff;min-height:400px;">${result.replace(/</g, '&lt;')}</pre>`);
    await screenshot(page, 'tc05-db-order-options.png');

    // TC-06: 收银看板
    console.log('\n=== TC-06: 收银看板 ===');
    const page2 = await browser.newPage();
    await page2.goto('http://localhost:8088/admin/cashier-dashboard.html', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    await screenshot(page2, 'tc06-cashier-dashboard.png');

    console.log('\n=== 测试完成 ===');
    browser.disconnect();
}

run().catch(err => {
    console.error('测试失败:', err.message);
    process.exit(1);
});
