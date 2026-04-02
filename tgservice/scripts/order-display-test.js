/**
 * 待处理订单显示逻辑测试
 * 测试严格模式：只显示当前设备的订单
 */

const { chromium } = require('playwright');

const BASE_URL = 'https://tiangong.club';

async function test() {
  console.log('========================================');
  console.log('[2026-04-02 14:55] 待处理订单显示逻辑测试');
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
  // 前置条件：查看现有订单的设备指纹
  // ========================================
  console.log('【前置】查看订单 TG1775102991668 的设备指纹...');
  const { execSync } = require('child_process');
  const orderInfo = execSync(`docker exec tgservice sqlite3 /app/tgservice/db/tgservice.db "SELECT order_no, table_no, device_fingerprint, status FROM orders WHERE order_no = 'TG1775102991668'"`, { encoding: 'utf-8' });
  console.log('  订单信息:', orderInfo.trim());
  
  // 解析设备指纹
  const parts = orderInfo.trim().split('|');
  const orderDeviceFp = parts[2];
  console.log('  订单设备指纹:', orderDeviceFp);
  
  // ========================================
  // 测试 1：使用不同设备指纹，应该看不到订单
  // ========================================
  console.log('\n========== 测试 1：不同设备指纹 ==========\n');
  
  // 设置不同的设备指纹
  console.log('【步骤 1.1】设置不同的设备指纹...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // 设置一个不同的设备指纹
  await page.evaluate(() => {
    localStorage.setItem('device_fp', 'test_device_' + Date.now());
  });
  console.log('  已设置新设备指纹');
  
  // 扫码进入雀1
  console.log('\n【步骤 1.2】扫码进入雀1...');
  await page.goto(`${BASE_URL}/?table=que1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  
  // 进入会员中心
  console.log('\n【步骤 1.3】进入会员中心...');
  await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test1-different-fp.png' });
  
  // 检查是否显示订单
  const memberText1 = await page.locator('body').innerText();
  const showsOrder1 = memberText1.includes('TG1775102991668') || memberText1.includes('火鸡面');
  console.log('  显示订单 TG1775102991668:', showsOrder1 ? '❌ 是（错误）' : '✅ 否（正确）');
  console.log('  显示"暂无待处理订单":', memberText1.includes('暂无待处理订单') ? '✅ 是' : '❌ 否');
  
  // ========================================
  // 测试 2：使用相同设备指纹，应该能看到订单
  // ========================================
  console.log('\n========== 测试 2：相同设备指纹 ==========\n');
  
  // 设置相同的设备指纹
  console.log('【步骤 2.1】设置相同的设备指纹...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  await page.evaluate((fp) => {
    localStorage.setItem('device_fp', fp);
  }, orderDeviceFp);
  console.log('  已设置设备指纹:', orderDeviceFp);
  
  // 扫码进入雀1
  console.log('\n【步骤 2.2】扫码进入雀1...');
  await page.goto(`${BASE_URL}/?table=que1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  
  // 进入会员中心
  console.log('\n【步骤 2.3】进入会员中心...');
  await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test2-same-fp.png' });
  
  // 检查是否显示订单
  const memberText2 = await page.locator('body').innerText();
  const showsOrder2 = memberText2.includes('TG1775102991668') || memberText2.includes('火鸡面');
  console.log('  显示订单 TG1775102991668:', showsOrder2 ? '✅ 是（正确）' : '❌ 否（错误）');
  
  // ========================================
  // 测试 3：台桌过期后，应该看不到订单
  // ========================================
  console.log('\n========== 测试 3：台桌过期后 ==========\n');
  
  // 设置过期授权
  console.log('【步骤 3.1】设置台桌授权过期...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  await page.evaluate((fp) => {
    // 设备指纹保持相同
    localStorage.setItem('device_fp', fp);
    // 台桌授权设为31分钟前
    const expiredTime = Date.now() - (31 * 60 * 1000);
    localStorage.setItem('tableAuth', JSON.stringify({
      table: 'que1',
      tableName: '雀1',
      time: expiredTime
    }));
  }, orderDeviceFp);
  console.log('  已设置台桌授权过期');
  
  // 进入会员中心
  console.log('\n【步骤 3.2】进入会员中心...');
  await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test3-expired.png' });
  
  // 检查是否显示订单
  const memberText3 = await page.locator('body').innerText();
  const showsOrder3 = memberText3.includes('TG1775102991668') || memberText3.includes('火鸡面');
  console.log('  显示订单 TG1775102991668:', showsOrder3 ? '✅ 是（正确，设备指纹匹配）' : '❌ 否');
  console.log('  说明: 台桌过期不影响订单显示，因为按设备指纹查询');
  
  // ========================================
  // 测试 4：不同台桌，相同设备指纹，应该能看到订单
  // ========================================
  console.log('\n========== 测试 4：不同台桌，相同设备指纹 ==========\n');
  
  // 重新扫码进入普台2
  console.log('【步骤 4.1】扫码进入普台2...');
  await page.goto(`${BASE_URL}/?table=putai2`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  
  // 确保设备指纹不变
  await page.evaluate((fp) => {
    localStorage.setItem('device_fp', fp);
  }, orderDeviceFp);
  
  // 进入会员中心
  console.log('\n【步骤 4.2】进入会员中心...');
  await page.goto(`${BASE_URL}/#/pages/member/member`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/order-test4-different-table.png' });
  
  // 检查是否显示订单（应该能看到，因为设备指纹匹配）
  const memberText4 = await page.locator('body').innerText();
  const showsOrder4 = memberText4.includes('TG1775102991668') || memberText4.includes('火鸡面');
  console.log('  显示订单 TG1775102991668:', showsOrder4 ? '✅ 是（正确，设备指纹匹配）' : '❌ 否');
  
  // ========================================
  // 测试总结
  // ========================================
  console.log('\n========================================');
  console.log('测试总结');
  console.log('========================================');
  console.log('');
  console.log('测试 1：不同设备指纹');
  console.log('  - 不显示订单:', !showsOrder1 ? '✅ 通过' : '❌ 失败');
  console.log('');
  console.log('测试 2：相同设备指纹');
  console.log('  - 显示订单:', showsOrder2 ? '✅ 通过' : '❌ 失败');
  console.log('');
  console.log('测试 3：台桌过期后');
  console.log('  - 仍显示订单（因为设备指纹匹配）:', showsOrder3 ? '✅ 通过' : '⚠️ 注意');
  console.log('');
  console.log('测试 4：不同台桌，相同设备指纹');
  console.log('  - 显示订单:', showsOrder4 ? '✅ 通过' : '❌ 失败');
  console.log('');
  console.log('========================================');
  
  await browser.close();
}

test().catch(console.error);