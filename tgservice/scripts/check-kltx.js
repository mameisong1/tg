/**
 * 使用 playwright 连接 mychrome (CDP 9222)
 * 登录 kltx 平台查看账号状态
 */

const { chromium } = require('playwright');

// 账号信息
const KLTX_UID = '5889';
const KLTX_PSW = 'mms6332628';

async function checkKltx() {
  console.log('===== 登录 kltx 平台检查账号状态 =====');
  console.log('账号:', KLTX_UID);
  console.log('');

  // 连接 Chrome CDP
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  console.log('已连接 Chrome');

  // 获取现有页面
  const contexts = browser.contexts();
  const context = contexts[0] || await browser.newContext();
  const pages = context.pages();

  // 找一个页面或新建
  let page = pages.find(p => p.url().includes('kltx.sms10000')) || pages[0];
  if (!page) {
    page = await context.newPage();
  }

  console.log('打开 kltx 平台...');
  await page.goto('http://kltx.sms10000.com.cn/login.jsp', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // 截图 - 登录前
  await page.screenshot({ path: '/tmp/kltx_1_before.png', fullPage: true });
  console.log('截图 1: 登录前页面');

  // 查找所有输入框
  console.log('');
  console.log('查找页面元素...');
  
  const inputs = await page.$$eval('input', els => els.map(e => ({
    type: e.type,
    name: e.name,
    id: e.id,
    placeholder: e.placeholder
  })));
  console.log('输入框:', JSON.stringify(inputs, null, 2));

  const buttons = await page.$$eval('button, input[type="submit"], input[type="button"]', els => els.map(e => ({
    type: e.type,
    text: e.innerText || e.value,
    name: e.name,
    id: e.id
  })));
  console.log('按钮:', JSON.stringify(buttons, null, 2));

  // 填写账号密码
  console.log('');
  console.log('填写账号密码...');
  
  // 尝试多种方式找到输入框
  const uidSelectors = ['input[name="uid"]', 'input[name="username"]', 'input[name="user"]', 'input[type="text"]'];
  const pswSelectors = ['input[name="psw"]', 'input[name="password"]', 'input[name="pwd"]', 'input[type="password"]'];
  
  let uidInput = null;
  let pswInput = null;
  
  for (const sel of uidSelectors) {
    uidInput = await page.$(sel);
    if (uidInput) break;
  }
  
  for (const sel of pswSelectors) {
    pswInput = await page.$(sel);
    if (pswInput) break;
  }
  
  if (uidInput && pswInput) {
    await uidInput.fill(KLTX_UID);
    await pswInput.fill(KLTX_PSW);
    console.log('已填写账号:', KLTX_UID);
    console.log('已填写密码:', KLTX_PSW);
    
    // 截图 - 填写后
    await page.screenshot({ path: '/tmp/kltx_2_filled.png', fullPage: true });
    console.log('截图 2: 填写后');
    
    // 查找并点击登录按钮
    console.log('');
    console.log('查找登录按钮...');
    
    const btnSelectors = [
      'button:has-text("登录")',
      'button:has-text("登陆")',
      'input[value="登录"]',
      'input[value="登陆"]',
      'input[type="submit"]',
      'button[type="submit"]',
      '.login-btn',
      '#loginBtn'
    ];
    
    let loginBtn = null;
    for (const sel of btnSelectors) {
      try {
        loginBtn = await page.$(sel);
        if (loginBtn) {
          console.log('找到按钮:', sel);
          break;
        }
      } catch (e) {}
    }
    
    if (loginBtn) {
      console.log('点击登录按钮...');
      await loginBtn.click();
      await page.waitForTimeout(5000);
      
      // 截图 - 登录后
      await page.screenshot({ path: '/tmp/kltx_3_after.png', fullPage: true });
      console.log('截图 3: 登录后');
      
      console.log('');
      console.log('登录后 URL:', page.url());
      console.log('登录后标题:', await page.title());
      
      // 尝试获取账号信息
      const bodyText = await page.$eval('body', el => el.innerText);
      console.log('');
      console.log('页面内容（前500字）:', bodyText.substring(0, 500));
      
      // 检查是否有错误提示
      const errorEl = await page.$('.error, .alert, .msg, #msg');
      if (errorEl) {
        const errorText = await errorEl.innerText();
        console.log('错误提示:', errorText);
      }
      
      // 检查是否有余额显示
      const balanceEl = await page.$('.balance, #balance, .money');
      if (balanceEl) {
        const balanceText = await balanceEl.innerText();
        console.log('余额:', balanceText);
      }
    } else {
      console.log('未找到登录按钮，尝试按 Enter 键...');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(5000);
      
      await page.screenshot({ path: '/tmp/kltx_3_after.png', fullPage: true });
      console.log('截图 3: Enter 后');
      
      console.log('当前 URL:', page.url());
      const bodyText = await page.$eval('body', el => el.innerText);
      console.log('页面内容:', bodyText.substring(0, 500));
    }
  } else {
    console.log('找不到输入框');
    console.log('uidInput:', uidInput ? 'found' : 'not found');
    console.log('pswInput:', pswInput ? 'found' : 'not found');
  }

  // 最终截图
  await page.screenshot({ path: '/tmp/kltx_final.png', fullPage: true });
  console.log('');
  console.log('最终截图: /tmp/kltx_final.png');

  await browser.close();
  console.log('完成');
}

checkKltx().catch(e => {
  console.error('错误:', e.message);
  process.exit(1);
});