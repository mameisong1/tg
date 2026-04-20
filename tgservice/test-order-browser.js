const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/TG/tgservice/test-screenshots';
const FRONTEND_URL = 'http://127.0.0.1:8089';
const CHROME_PORT = 9222;

// 确保截图目录存在
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForToast(page, text, timeout = 5000) {
  try {
    await page.waitForFunction(
      (searchText) => {
        const toasts = document.querySelectorAll('.van-toast, .toast, [class*="toast"]');
        for (const toast of toasts) {
          if (toast.textContent.includes(searchText)) return true;
        }
        // 也检查可能的 uni-app toast
        const uniToast = document.querySelector('.uni-toast, .uni-sample-toast');
        if (uniToast && uniToast.textContent.includes(searchText)) return true;
        return false;
      },
      { timeout },
      text
    );
    return true;
  } catch (e) {
    return false;
  }
}

async function checkNoToast(page, text, waitTime = 3000) {
  await sleep(waitTime);
  const found = await page.evaluate((searchText) => {
    const toasts = document.querySelectorAll('.van-toast, .toast, [class*="toast"]');
    for (const toast of toasts) {
      if (toast.textContent.includes(searchText)) return true;
    }
    const uniToast = document.querySelector('.uni-toast, .uni-sample-toast');
    if (uniToast && uniToast.textContent.includes(searchText)) return true;
    return false;
  }, text);
  return !found;
}

async function clearStorage(page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function setUserAuth(page, tablePinyin, tableName) {
  await page.evaluate((tp, tn) => {
    localStorage.setItem('tablePinyin', tp);
    localStorage.setItem('tableName', tn);
    localStorage.setItem('tableAuth', JSON.stringify({
      table: tp,
      tableName: tn,
      time: Date.now()
    }));
  }, tablePinyin, tableName);
}

async function setCoachAuth(page, tablePinyin, tableName, coachToken) {
  await page.evaluate((tp, tn, ct) => {
    localStorage.setItem('tablePinyin', tp);
    localStorage.setItem('tableName', tn);
    localStorage.setItem('tableAuth', JSON.stringify({
      table: tp,
      tableName: tn,
      time: Date.now()
    }));
    localStorage.setItem('coachToken', ct);
  }, tablePinyin, tableName, coachToken);
}

async function setExpiredAuth(page, tablePinyin, tableName) {
  await page.evaluate((tp, tn) => {
    localStorage.setItem('tablePinyin', tp);
    localStorage.setItem('tableName', tn);
    // 设置 3 分钟前过期
    localStorage.setItem('tableAuth', JSON.stringify({
      table: tp,
      tableName: tn,
      time: Date.now() - 180000
    }));
  }, tablePinyin, tableName);
}

async function screenshot(page, filename) {
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`截图保存: ${filepath}`);
  return filepath;
}

async function main() {
  console.log('=== 开始真实浏览器下单测试 ===\n');
  
  let browser;
  let page;
  const results = [];
  
  try {
    // 连接 Chrome
    console.log('连接 Chrome 9222 端口...');
    browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${CHROME_PORT}`,
      defaultViewport: { width: 375, height: 812 }
    });
    
    const pages = await browser.pages();
    page = pages[0] || await browser.newPage();
    
    // ========== 用例1：用户扫码下单成功 ==========
    console.log('\n--- 用例1：用户扫码下单成功 ---');
    try {
      // 清空并设置认证
      await clearStorage(page);
      await setUserAuth(page, 'A1', 'A1台');
      
      // 进入商品页面
      console.log('进入商品页面...');
      await page.goto(`${FRONTEND_URL}/#/pages/goods/list`, { waitUntil: 'networkidle2', timeout: 10000 });
      await sleep(2000);
      
      // 查找商品"+"按钮
      console.log('查找商品"+"按钮...');
      const addButtonFound = await page.evaluate(() => {
        // 查找商品列表中的加号按钮
        const addButtons = document.querySelectorAll('.goods-add, .add-btn, .plus-btn, button[class*="add"], [class*="add-cart"]');
        if (addButtons.length > 0) {
          addButtons[0].click();
          return true;
        }
        // 尝试查找任何包含"+"的按钮
        const allButtons = document.querySelectorAll('button, .btn, [class*="button"]');
        for (const btn of allButtons) {
          if (btn.textContent.includes('+') || btn.textContent.includes('加入')) {
            btn.click();
            return true;
          }
        }
        // 尝试 van-icon
        const plusIcons = document.querySelectorAll('.van-icon-plus, .van-icon-add-o');
        if (plusIcons.length > 0) {
          plusIcons[0].click();
          return true;
        }
        return false;
      });
      
      if (!addButtonFound) {
        console.log('未找到加购按钮，尝试其他方式...');
        // 尝试点击第一个商品
        const goodsItem = await page.$('.goods-item, .product-item, [class*="goods"], [class*="product"]');
        if (goodsItem) {
          await goodsItem.click();
          await sleep(1000);
          // 然后找加入购物车按钮
          await page.evaluate(() => {
            const addCartBtn = document.querySelector('.add-cart, .van-button, button');
            if (addCartBtn) addCartBtn.click();
          });
        }
      }
      
      await sleep(1500);
      
      // 检查"已加入购物车" Toast
      const toastFound = await waitForToast(page, '已加入购物车', 3000);
      if (!toastFound) {
        // 再尝试一次检查页面内容
        const pageContent = await page.evaluate(() => document.body.innerText);
        console.log('页面内容片段:', pageContent.substring(0, 500));
      }
      
      if (toastFound) {
        console.log('✅ 看到提示："已加入购物车"');
        
        // 点击购物车按钮
        console.log('点击购物车按钮...');
        await page.evaluate(() => {
          const cartBtn = document.querySelector('.cart-btn, .van-icon-shopping-cart-o, .van-icon-cart-o, [class*="cart"]');
          if (cartBtn) cartBtn.click();
        });
        await sleep(1500);
        
        // 点击提交订单
        console.log('点击提交订单...');
        await page.evaluate(() => {
          const submitBtn = document.querySelector('.submit-btn, .van-button--primary, button[type="submit"], [class*="submit"]');
          if (submitBtn) submitBtn.click();
        });
        await sleep(2000);
        
        // 检查"下单成功"
        const orderSuccess = await waitForToast(page, '下单成功', 5000);
        if (orderSuccess) {
          console.log('✅ 看到提示："下单成功"');
          await screenshot(page, 'case1-success.png');
          results.push({ case: 1, status: '✅', msg: '下单成功', screenshot: 'case1-success.png' });
        } else {
          const pageContent = await page.evaluate(() => document.body.innerText);
          console.log('❌ 未看到"下单成功"，页面内容:', pageContent.substring(0, 300));
          await screenshot(page, 'case1-fail.png');
          results.push({ case: 1, status: '❌', msg: '未看到下单成功提示', screenshot: 'case1-fail.png' });
        }
      } else {
        console.log('❌ 未看到"已加入购物车"提示');
        await screenshot(page, 'case1-fail.png');
        results.push({ case: 1, status: '❌', msg: '未看到已加入购物车提示', screenshot: 'case1-fail.png' });
      }
    } catch (e) {
      console.log('❌ 用例1执行失败:', e.message);
      await screenshot(page, 'case1-error.png');
      results.push({ case: 1, status: '❌', msg: e.message, screenshot: 'case1-error.png' });
    }
    
    // ========== 用例2：有效期内再次下单成功 ==========
    console.log('\n--- 用例2：有效期内再次下单成功 ---');
    try {
      // 返回商品页
      await page.goto(`${FRONTEND_URL}/#/pages/goods/list`, { waitUntil: 'networkidle2', timeout: 10000 });
      await sleep(1500);
      
      // 点击商品"+"
      const addButtonFound = await page.evaluate(() => {
        const addButtons = document.querySelectorAll('.goods-add, .add-btn, .plus-btn, button[class*="add"]');
        if (addButtons.length > 0) {
          addButtons[0].click();
          return true;
        }
        const allButtons = document.querySelectorAll('button, .btn');
        for (const btn of allButtons) {
          if (btn.textContent.includes('+') || btn.textContent.includes('加入')) {
            btn.click();
            return true;
          }
        }
        return false;
      });
      
      await sleep(1500);
      
      const toastFound = await waitForToast(page, '已加入购物车', 3000);
      if (toastFound) {
        console.log('✅ 看到提示："已加入购物车"');
        
        // 点击购物车并提交
        await page.evaluate(() => {
          const cartBtn = document.querySelector('.cart-btn, .van-icon-shopping-cart-o, [class*="cart"]');
          if (cartBtn) cartBtn.click();
        });
        await sleep(1500);
        
        await page.evaluate(() => {
          const submitBtn = document.querySelector('.submit-btn, .van-button--primary, button');
          if (submitBtn) submitBtn.click();
        });
        await sleep(2000);
        
        const orderSuccess = await waitForToast(page, '下单成功', 5000);
        if (orderSuccess) {
          console.log('✅ 看到提示："下单成功"');
          await screenshot(page, 'case2-success.png');
          results.push({ case: 2, status: '✅', msg: '下单成功', screenshot: 'case2-success.png' });
        } else {
          await screenshot(page, 'case2-fail.png');
          results.push({ case: 2, status: '❌', msg: '未看到下单成功提示', screenshot: 'case2-fail.png' });
        }
      } else {
        console.log('❌ 未看到"已加入购物车"提示');
        await screenshot(page, 'case2-fail.png');
        results.push({ case: 2, status: '❌', msg: '未看到已加入购物车提示', screenshot: 'case2-fail.png' });
      }
    } catch (e) {
      console.log('❌ 用例2执行失败:', e.message);
      await screenshot(page, 'case2-error.png');
      results.push({ case: 2, status: '❌', msg: e.message, screenshot: 'case2-error.png' });
    }
    
    // ========== 用例3：过期后下单失败 ==========
    console.log('\n--- 用例3：过期后下单失败 ---');
    try {
      await clearStorage(page);
      await setExpiredAuth(page, 'A1', 'A1台');
      
      await page.goto(`${FRONTEND_URL}/#/pages/goods/list`, { waitUntil: 'networkidle2', timeout: 10000 });
      await sleep(2000);
      
      // 尝试点击商品
      const addButtonFound = await page.evaluate(() => {
        const addButtons = document.querySelectorAll('.goods-add, .add-btn, .plus-btn, button[class*="add"]');
        if (addButtons.length > 0) {
          addButtons[0].click();
          return true;
        }
        return false;
      });
      
      await sleep(1500);
      
      // 应该没有"已加入购物车"提示
      const noToast = await checkNoToast(page, '已加入购物车', 3000);
      if (noToast) {
        console.log('✅ 过期后正确阻止下单，无"已加入购物车"提示');
        await screenshot(page, 'case3-expired.png');
        results.push({ case: 3, status: '✅', msg: '过期阻止下单成功', screenshot: 'case3-expired.png' });
      } else {
        console.log('❌ 过期后仍能下单，安全漏洞！');
        await screenshot(page, 'case3-error.png');
        results.push({ case: 3, status: '❌', msg: '过期后仍能下单', screenshot: 'case3-error.png' });
      }
    } catch (e) {
      console.log('❌ 用例3执行失败:', e.message);
      await screenshot(page, 'case3-error.png');
      results.push({ case: 3, status: '❌', msg: e.message, screenshot: 'case3-error.png' });
    }
    
  } catch (e) {
    console.error('测试执行失败:', e.message);
    results.push({ case: 0, status: '❌', msg: `测试框架错误: ${e.message}` });
  } finally {
    if (browser) {
      await browser.disconnect();
    }
  }
  
  // 输出测试报告
  console.log('\n=== 测试报告 ===');
  for (const r of results) {
    console.log(`用例${r.case}: ${r.status} ${r.msg} [${r.screenshot || '无截图'}]`);
  }
  
  console.log('\n测试完成！');
}

main().catch(console.error);