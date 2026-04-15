/**
 * 诊断H5登录页面结构
 */
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });

  // 尝试访问登录页
  await page.goto('http://127.0.0.1:8089/#/pages/internal/admin-login', { 
    waitUntil: 'networkidle0', 
    timeout: 15000 
  });

  await new Promise(r => setTimeout(r, 3000));

  // 获取页面完整HTML
  const html = await page.content();
  console.log('=== PAGE HTML (first 5000 chars) ===');
  console.log(html.substring(0, 5000));

  // 获取所有input元素
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type,
      placeholder: i.placeholder,
      className: i.className,
      id: i.id,
      name: i.name
    }));
  });
  console.log('\n=== INPUTS ===');
  console.log(JSON.stringify(inputs, null, 2));

  // 获取所有button元素
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, [class*="btn"], [class*="login"]')).map(b => ({
      tag: b.tagName,
      className: b.className,
      text: b.textContent?.substring(0, 50),
      type: b.type
    }));
  });
  console.log('\n=== BUTTONS ===');
  console.log(JSON.stringify(buttons, null, 2));

  // 获取所有可见的文本
  const visibleText = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const texts = [];
    let node;
    while (node = walker.nextNode()) {
      const t = node.textContent.trim();
      if (t.length > 2) texts.push(t.substring(0, 80));
    }
    return [...new Set(texts)];
  });
  console.log('\n=== VISIBLE TEXT ===');
  console.log(visibleText.join('\n'));

  // 当前URL
  console.log('\n=== CURRENT URL ===');
  console.log(page.url());

  await browser.close();
})();
