const { chromium } = require('playwright');

async function getVerifyCode() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  
  // 重新打开登录页面
  await page.goto('http://kltx.sms10000.com.cn/login.jsp');
  await page.waitForTimeout(2000);
  
  // 填写账号密码
  await page.fill('#userId', '5889');
  await page.fill('#userPsw', 'mms6332628');
  
  // 查找验证码图片
  const imgs = await page.$$('img');
  console.log('找到图片数量:', imgs.length);
  
  // 截取所有图片
  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i];
    const src = await img.getAttribute('src');
    console.log('图片', i, 'src:', src);
    await img.screenshot({ path: `/tmp/kltx_img_${i}.png` });
  }
  
  // 截取整个页面
  await page.screenshot({ path: '/tmp/kltx_full.png', fullPage: false });
  
  console.log('完成');
  await browser.close();
}

getVerifyCode();