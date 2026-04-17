const puppeteer = require('puppeteer');

async function test() {
  console.log('=== uni对象完整分析 ===\n');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222'
  });
  
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8089/pages/cart/cart', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const uniAnalysis = await page.evaluate(() => {
    const result = {};
    
    if (typeof uni !== 'undefined') {
      // 列出uni的所有属性
      const keys = Object.keys(uni);
      result.keys = keys;
      result.keyCount = keys.length;
      
      // 检查是否有storage相关
      result.hasGetStorageSync = keys.includes('getStorageSync');
      result.hasRemoveStorageSync = keys.includes('removeStorageSync');
      result.hasSetStorageSync = keys.includes('setStorageSync');
      
      // 检查是否有getStorage（异步版本）
      result.hasGetStorage = keys.includes('getStorage');
      
      // 检查__proto__
      if (uni.__proto__) {
        const protoKeys = Object.keys(uni.__proto__);
        result.protoKeys = protoKeys;
        result.protoHasGetStorageSync = protoKeys.includes('getStorageSync');
      }
      
      // 尝试直接调用
      try {
        const testVal = uni.getStorageSync ? uni.getStorageSync('test') : 'method not found';
        result.testCall = testVal;
      } catch (e) {
        result.testCallError = e.message;
      }
      
      // 检查uni的__uniConfig和__uniRoutes
      result.__uniConfig = uni.__uniConfig;
      result.__uniRoutes = uni.__uniRoutes;
    }
    
    return result;
  });
  
  console.log('uni对象分析:', JSON.stringify(uniAnalysis, null, 2));
  
  await page.close();
  browser.disconnect();
}

test().catch(console.error);