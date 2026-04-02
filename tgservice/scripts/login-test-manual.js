/**
 * 登录测试 - 手动注入验证码方式
 */

const { chromium } = require('playwright');

async function test() {
  console.log('========================================');
  console.log('[2026-04-02 11:45] 登录测试（手动验证码）');
  console.log('========================================\n');
  
  // 连接 Chrome
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();
  let page = pages.find(p => p.url().includes('tiangong')) || pages[0];
  
  console.log('当前URL:', page.url());
  
  // 先通过 API 直接注入验证码（绕过短信发送）
  // 或者直接用已有会员的 token
  
  // 方案1: 用已知会员的 token 登录
  // 从数据库获取会员信息
  
  // ========================================
  // 步骤 1：刷新会员中心页面
  // ========================================
  console.log('\n【步骤1】刷新会员中心...');
  await page.goto('https://tiangong.club/#/pages/member/member', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  
  // 截图
  await page.screenshot({ path: '/tmp/test-member-refresh.png' });
  
  // ========================================
  // 步骤 2：打开登录弹窗
  // ========================================
  console.log('\n【步骤2】打开登录弹窗...');
  
  const loginBtn = page.getByText('会员登录', { exact: true });
  await loginBtn.waitFor({ state: 'visible', timeout: 5000 });
  await loginBtn.click();
  console.log('  点击"会员登录"成功');
  await page.waitForTimeout(2000);
  
  // ========================================
  // 步骤 3：勾选协议并输入手机号
  // ========================================
  console.log('\n【步骤3】勾选协议...');
  
  // 找到 checkbox 并点击
  const checkbox = page.locator('.checkbox').first();
  await checkbox.click();
  console.log('  勾选成功');
  await page.waitForTimeout(500);
  
  // 输入手机号
  console.log('\n【步骤4】输入手机号...');
  const inputs = await page.locator('input').all();
  await inputs[0].fill('18680174119');
  console.log('  输入手机号: 18680174119');
  await page.waitForTimeout(500);
  
  // ========================================
  // 步骤 5：注入验证码（通过 API）
  // ========================================
  console.log('\n【步骤5】手动注入验证码...');
  
  // 通过 exec 工具直接在容器内执行命令
  // 由于短信发送失败，我们需要手动在内存中设置验证码
  // 但这在 Docker 内不可能...
  
  // 替代方案：使用已知验证码（假设测试环境有固定验证码）
  // 或者直接用数据库中的会员 token
  
  console.log('\n由于短信发送失败，无法完成登录测试');
  console.log('建议修复 Docker 挂载配置后再测试');
  
  // 截图当前状态
  await page.screenshot({ path: '/tmp/test-manual-code.png' });
  
  // ========================================
  // 替代测试：直接用 API 获取会员 token
  // ========================================
  console.log('\n【替代方案】直接查询数据库获取会员信息...');
  
  await browser.close();
}

test().catch(console.error);