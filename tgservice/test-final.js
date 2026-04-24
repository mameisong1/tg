const puppeteer = require('puppeteer');

const SCREENSHOT_DIR = '/root/.openclaw/workspace_coder-tg';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('\n============================================');
  console.log('  奖罚名称最终测试');
  console.log('============================================\n');

  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });

  const page = await browser.newPage();

  try {
    // 打开测试地址
    await page.goto('http://127.0.0.1:8089', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    // 直接访问会员中心页面
    console.log('直接访问会员中心...');
    await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    console.log('当前 URL:', page.url());

    await page.screenshot({ path: SCREENSHOT_DIR + '/member-direct.png', fullPage: true });
    console.log('截图: member-direct.png');

    // 检查是否是会员中心页面
    const content = await page.content();
    const isMemberPage = content.includes('会员中心') || content.includes('会员') || content.includes('我的');
    console.log('是否会员中心页面:', isMemberPage ? '✅ 是' : '❌ 否');

    // 检查是否需要登录
    const needLogin = content.includes('手机号') && content.includes('验证码');
    console.log('是否需要登录:', needLogin ? '✅ 是' : '❌ 否');

    if (needLogin) {
      console.log('\n开始登录...');
      
      // 输入手机号
      const phoneInputs = await page.$$('input');
      for (const input of phoneInputs) {
        const type = await input.evaluate(el => el.type);
        if (type === 'tel' || type === 'number' || type === 'text') {
          await input.click({ clickCount: 3 });
          await input.type('18680174119', { delay: 100 });
          console.log('输入手机号: 18680174119');
          break;
        }
      }
      await sleep(1000);

      // 发送验证码
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await btn.evaluate(el => el.textContent);
        if (text.includes('发送') || text.includes('验证码')) {
          await btn.click();
          console.log('点击发送验证码');
          await sleep(2000);
          break;
        }
      }

      // 输入验证码
      const inputs = await page.$$('input');
      let codeEntered = false;
      for (const input of inputs) {
        const val = await input.evaluate(el => el.value);
        if (val === '') {
          const ph = await input.evaluate(el => el.placeholder);
          if (!ph || !ph.includes('手机')) {
            await input.type('888888', { delay: 100 });
            console.log('输入验证码: 888888');
            codeEntered = true;
            break;
          }
        }
      }
      if (!codeEntered) {
        // 找第二个输入框
        if (inputs.length >= 2) {
          await inputs[1].type('888888', { delay: 100 });
          console.log('输入验证码到第二个输入框');
        }
      }
      await sleep(1000);

      // 勾选协议
      const checkbox = await page.$('input[type="checkbox"]');
      if (checkbox) {
        await checkbox.click();
        console.log('勾选协议');
      }
      await sleep(500);

      // 点击登录
      for (const btn of buttons) {
        const text = await btn.evaluate(el => el.textContent);
        if (text.includes('登录') || text.includes('登')) {
          await btn.click();
          console.log('点击登录');
          await sleep(5000);
          break;
        }
      }

      await page.screenshot({ path: SCREENSHOT_DIR + '/after-login-final.png', fullPage: true });
      console.log('截图: after-login-final.png');
      console.log('登录后 URL:', page.url());
    }

    // 检查按钮
    const pageContent = await page.content();
    console.log('\n============================================');
    console.log('  检查按钮名称');
    console.log('============================================\n');

    const hasServiceReward = pageContent.includes('服务奖罚');
    const hasCoachReward = pageContent.includes('助教奖罚');
    const hasOldService = pageContent.includes('服务日奖');
    const hasOldCoach = pageContent.includes('助教违规');

    console.log(`服务奖罚按钮: ${hasServiceReward ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`助教奖罚按钮: ${hasCoachReward ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`服务日奖(旧): ${hasOldService ? '❌ 仍存在' : '✅ 已移除'}`);
    console.log(`助教违规(旧): ${hasOldCoach ? '❌ 仍存在' : '✅ 已移除'}`);

    // 最终截图
    await page.screenshot({ path: SCREENSHOT_DIR + '/final-check.png', fullPage: true });
    console.log('\n截图: final-check.png');

    // 输出页面上的所有按钮文字
    console.log('\n页面所有可见按钮/链接文字:');
    const allTexts = await page.evaluate(() => {
      const elements = document.querySelectorAll('button, a, [class*="btn"], [class*="link"], text');
      return Array.from(elements).map(el => el.textContent.trim()).filter(t => t && t.length < 20);
    });
    console.log(allTexts.slice(0, 20).join(', '));

    return hasServiceReward && hasCoachReward;

  } catch (err) {
    console.error('错误:', err.message);
    await page.screenshot({ path: SCREENSHOT_DIR + '/error-final.png' });
    return false;
  } finally {
    await page.close();
  }
}

runTest().then(s => process.exit(s ? 0 : 1));
