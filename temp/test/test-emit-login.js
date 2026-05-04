const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function test() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });
  
  const pages = await browser.pages();
  let page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
  
  // 清空 Storage
  await page.evaluate(() => localStorage.clear());
  
  await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 10000));
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('smsPhone') || text.includes('smsCode') || text.includes('agreed') || text.includes('登录')) {
      console.log('CONSOLE:', text.substring(0, 200));
    }
  });
  
  // 使用 Vue emit 触发 update:modelValue（这是掘金文章推荐的方式）
  const inputResult = await page.evaluate(() => {
    // 手机号输入框
    const phoneUniInput = document.querySelectorAll('.h5-form-input')[0];
    const phoneNativeInput = phoneUniInput.querySelector('input');
    const phoneVueComp = phoneUniInput.__vueParentComponent;
    
    // 设置原生 input 值 + emit update:modelValue
    phoneNativeInput.value = '18600000004';
    phoneVueComp.emit('update:modelValue', '18600000004');
    
    // 验证码输入框
    const codeUniInput = document.querySelectorAll('.h5-form-input')[1];
    const codeNativeInput = codeUniInput.querySelector('input');
    const codeVueComp = codeUniInput.__vueParentComponent;
    
    codeNativeInput.value = '888888';
    codeVueComp.emit('update:modelValue', '888888');
    
    return {
      phoneValue: phoneNativeInput.value,
      codeValue: codeNativeInput.value
    };
  });
  
  console.log('输入结果:', inputResult);
  
  // 等待 Vue 响应式更新
  await new Promise(r => setTimeout(r, 500));
  
  // 勾选协议
  await page.evaluate(() => {
    const checkbox = document.querySelector('.h5-agreement .checkbox');
    if (!checkbox?.classList.contains('checked')) {
      const text = document.querySelector('.h5-agreement .agreement-text');
      text?.click();
    }
  });
  await new Promise(r => setTimeout(r, 500));
  
  const agreed = await page.evaluate(() => 
    document.querySelector('.h5-agreement .checkbox')?.classList.contains('checked')
  );
  console.log('协议勾选:', agreed);
  
  if (!agreed) {
    // 再试一次
    await page.evaluate(() => document.querySelector('.h5-agreement .checkbox')?.click());
    await new Promise(r => setTimeout(r, 500));
  }
  
  // 点击登录按钮
  console.log('点击登录按钮');
  await page.evaluate(() => document.querySelector('.h5-login-btn')?.click());
  await new Promise(r => setTimeout(r, 8000));
  
  // 检查后端是否有请求
  console.log('\n检查结果');
  
  // 检查页面变化
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 100));
  console.log('页面:', pageText);
  
  // 检查 Storage
  const storage = await page.evaluate(() => ({
    memberToken: localStorage.getItem('memberToken'),
    memberInfo: localStorage.getItem('memberInfo'),
    coachToken: localStorage.getItem('coachToken')
  }));
  console.log('Storage:', JSON.stringify(storage, null, 2));
  
  browser.disconnect();
}

test();