const puppeteer = require('puppeteer');
const fs = require('fs');

async function main() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  // 测试1: 会员中心页面
  console.log('\n=== 会员中心页面 ===');
  const page1 = await browser.newPage();
  await page1.goto('http://127.0.0.1:8089/#/pages/member/center', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  
  const content1 = await page1.content();
  console.log('页面URL:', page1.url());
  console.log('内容长度:', content1.length);
  console.log('前2000字符:', content1.substring(0, 2000));
  fs.writeFileSync('/TG/temp/fulltest/member-center.html', content1);
  
  await page1.close();
  
  // 测试2: 首页
  console.log('\n=== 首页 ===');
  const page2 = await browser.newPage();
  await page2.goto('http://127.0.0.1:8089/#/pages/index/index', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  
  const content2 = await page2.content();
  console.log('页面URL:', page2.url());
  console.log('内容长度:', content2.length);
  console.log('前2000字符:', content2.substring(0, 2000));
  fs.writeFileSync('/TG/temp/fulltest/index.html', content2);
  
  await page2.close();
  
  // 测试3: 登录页
  console.log('\n=== 登录页 ===');
  const page3 = await browser.newPage();
  await page3.goto('http://127.0.0.1:8089/#/pages/auth/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  
  const content3 = await page3.content();
  console.log('页面URL:', page3.url());
  console.log('内容长度:', content3.length);
  console.log('前2000字符:', content3.substring(0, 2000));
  fs.writeFileSync('/TG/temp/fulltest/login.html', content3);
  
  await page3.close();
  
  await browser.disconnect();
  console.log('\n分析完成，HTML已保存到 /TG/temp/fulltest/');
}

main().catch(console.error);