const puppeteer = require('puppeteer');

async function test() {
  console.log('=== 购物车页面 uni验证 ===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222'
  });
  
  const page = await browser.newPage();
  
  // 先进入首页设置localStorage
  await page.goto('http://127.0.0.1:8089/', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.setItem('tableName', '测试台桌');
    localStorage.setItem('coachToken', '助教token');
  });
  
  console.log('首页 localStorage.tableName:', await page.evaluate(() => localStorage.getItem('tableName')));
  
  // 进入购物车页面
  await page.goto('http://127.0.0.1:8089/pages/cart/cart', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  // 在购物车页面检查uni
  const uniCheck = await page.evaluate(() => {
    const result = {
      uniExists: typeof uni !== 'undefined',
      uniKeys: []
    };
    
    if (typeof uni !== 'undefined') {
      result.getStorageSync = typeof uni.getStorageSync !== 'undefined';
      result.removeStorageSync = typeof uni.removeStorageSync !== 'undefined';
      
      // 用uni读取localStorage
      result.coachToken_viaUni = uni.getStorageSync ? uni.getStorageSync('coachToken') : 'no function';
      result.tableName_viaUni = uni.getStorageSync ? uni.getStorageSync('tableName') : 'no function';
    }
    
    return result;
  });
  
  console.log('购物车页面 uni状态:', JSON.stringify(uniCheck, null, 2));
  
  // 检查localStorage变化
  const afterStorage = await page.evaluate(() => ({
    tableName: localStorage.getItem('tableName'),
    coachToken: localStorage.getItem('coachToken')
  }));
  
  console.log('购物车页面 localStorage:', JSON.stringify(afterStorage, null, 2));
  
  await page.close();
  browser.disconnect();
}

test().catch(console.error);