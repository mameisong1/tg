const puppeteer = require('/usr/lib/node_modules/puppeteer');

async function main() {
  console.log('开始查看页面内容...');
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 },
    protocolTimeout: 180000
  });
  
  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();
  
  // 获取页面标题
  const title = await page.title();
  console.log('页面标题:', title);
  
  // 获取页面 URL
  const url = page.url();
  console.log('页面 URL:', url);
  
  // 获取页面内容（简化版）
  const content = await page.evaluate(() => {
    // 查找页面主要结构
    const bodyText = document.body?.innerText?.substring(0, 500) || '';
    
    // 查找登录相关元素
    const loginSection = document.querySelector('.login-section, .h5-login-card, .member-section');
    const loginSectionClass = loginSection?.className || '未找到';
    
    // 查找 view 元素（uni-app 使用 view 而不是 div）
    const views = document.querySelectorAll('view');
    const viewCount = views.length;
    
    // 查找 text 元素
    const texts = document.querySelectorAll('text');
    const textCount = texts.length;
    
    // 查找 input 元素（可能是自定义组件）
    const inputs = document.querySelectorAll('input');
    const inputCount = inputs.length;
    
    // 获取所有 class 包含 login/form 的元素
    const loginElements = [];
    document.querySelectorAll('[class*="login"], [class*="form"], [class*="member"]').forEach(el => {
      loginElements.push({
        tag: el.tagName,
        class: el.className?.substring(0, 50),
        text: el.innerText?.substring(0, 30)
      });
    });
    
    return {
      bodyText,
      loginSectionClass,
      viewCount,
      textCount,
      inputCount,
      loginElements: loginElements.slice(0, 10)
    };
  });
  
  console.log('\n=== 页面内容分析 ===');
  console.log('Body 文本:', content.bodyText);
  console.log('Login section class:', content.loginSectionClass);
  console.log('View 元素数量:', content.viewCount);
  console.log('Text 元素数量:', content.textCount);
  console.log('Input 元素数量:', content.inputCount);
  console.log('\n登录相关元素:');
  content.loginElements.forEach((el, i) => {
    console.log(`  ${i}: tag=${el.tag}, class="${el.class}", text="${el.text}"`);
  });
  
  // 获取页面 HTML（完整）
  const html = await page.content();
  console.log('\n=== HTML 长度 ===');
  console.log('HTML 总长度:', html.length);
  
  // 查找关键内容
  if (html.includes('h5-login-card')) {
    console.log('包含 h5-login-card');
  }
  if (html.includes('login-section')) {
    console.log('包含 login-section');
  }
  if (html.includes('member-section')) {
    console.log('包含 member-section');
  }
  if (html.includes('isCheckingLogin')) {
    console.log('页面可能在 loading 状态');
  }
  
  // 截图
  await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/debug-page-content.png', fullPage: true });
  console.log('\n截图保存: debug-page-content.png');
  
  await browser.disconnect();
  console.log('\n调试结束');
}

main().catch(console.error);