/**
 * 登录测试脚本 - 第二阶段（点击获取验证码）
 */

const { chromium } = require('playwright');

async function test() {
  console.log('========================================');
  console.log('[2026-04-02 11:38] 继续登录测试');
  console.log('========================================\n');
  
  // 连接 Chrome
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();
  let page = pages.find(p => p.url().includes('tiangong')) || pages[0];
  
  console.log('当前URL:', page.url());
  
  // ========================================
  // 查找所有可点击元素
  // ========================================
  console.log('\n分析页面可点击元素...');
  
  // 查找所有 view 类元素
  const clickables = await page.locator('[class*="btn"], [class*="button"], [class*="click"], .uni-view').all();
  console.log('可点击元素数量:', clickables.length);
  
  // 输出包含"获取"或"登录"的元素
  for (const el of clickables) {
    try {
      const text = await el.innerText();
      if (text && (text.includes('获取') || text.includes('登录') || text.includes('同意'))) {
        const className = await el.getAttribute('class');
        console.log(`  文本="${text}", class="${className}"`);
      }
    } catch (e) {}
  }
  
  // ========================================
  // 点击同意协议
  // ========================================
  console.log('\n【步骤1】勾选同意协议...');
  
  // 找同意协议的元素
  const agreeText = page.getByText('同意');
  try {
    // 检查是否是可点击的
    const agreeElements = await page.locator('[class*="agree"], [class*="checkbox"]').all();
    console.log('同意相关元素:', agreeElements.length);
    
    // 尝试点击"同意"前面的区域（可能是自定义 checkbox）
    for (const el of agreeElements) {
      const text = await el.innerText();
      console.log('  元素文本:', text);
      if (text.includes('同意')) {
        await el.click();
        console.log('点击同意成功');
        break;
      }
    }
  } catch (e) {
    console.log('点击同意失败:', e.message);
  }
  
  await page.waitForTimeout(1000);
  
  // ========================================
  // 输入手机号
  // ========================================
  console.log('\n【步骤2】输入手机号...');
  
  const inputs = await page.locator('input').all();
  console.log('输入框数量:', inputs.length);
  
  // 第一个输入框应该是手机号
  if (inputs.length >= 1) {
    try {
      await inputs[0].fill('18680174119');
      console.log('输入手机号成功');
    } catch (e) {
      console.log('输入失败:', e.message);
    }
  }
  
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/test-phone-filled.png' });
  
  // ========================================
  // 点击"获取"验证码
  // ========================================
  console.log('\n【步骤3】点击"获取"验证码...');
  
  // 用文本匹配找"获取"按钮
  const getCodeBtn = page.getByText('获取', { exact: true });
  try {
    await getCodeBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('找到"获取"按钮');
    
    // 点击
    await getCodeBtn.click();
    console.log('点击"获取"成功！验证码已发送');
    
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/test-code-requested.png' });
    
    // 去日志找验证码
    console.log('\n验证码已发送，等待后端处理...');
    console.log('请执行: docker logs tgservice --tail 20 | grep 验证码');
    
  } catch (e) {
    console.log('点击"获取"失败:', e.message);
    
    // 备用方案：找所有包含"获取"的元素
    const allElements = await page.locator('*').all();
    for (const el of allElements) {
      try {
        const text = await el.innerText();
        if (text === '获取') {
          console.log('找到精确匹配"获取"的元素');
          await el.click();
          console.log('点击成功');
          break;
        }
      } catch (e) {}
    }
  }
  
  // ========================================
  // 等待并去日志找验证码
  // ========================================
  console.log('\n【步骤4】等待验证码...');
  await page.waitForTimeout(5000);
  
  // 去容器日志找验证码
  console.log('\n去 Docker 日志查找验证码...');
  
  await browser.close();
}

test().catch(console.error);