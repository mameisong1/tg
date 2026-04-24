const puppeteer = require('puppeteer');
const SCREENSHOT_DIR = '/root/.openclaw/workspace_coder-tg';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('\n============================================');
  console.log('  奖罚名称完整测试');
  console.log('============================================\n');

  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });

  const page = await browser.newPage();

  try {
    // 直接导航到会员中心
    await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    console.log('打开会员中心，URL:', page.url());

    // 登录流程 - 使用正确的选择器
    const inputs = await page.$$('input');
    console.log('找到输入框数量:', inputs.length);

    // 输入手机号到第一个输入框
    if (inputs.length > 0) {
      await inputs[0].evaluate(el => el.value = '');
      await inputs[0].type('18680174119');
      console.log('输入手机号: 18680174119');
    }
    await sleep(1000);

    // 点击获取验证码按钮
    const buttons = await page.$$('div, button');
    let codeBtnClicked = false;
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.innerText || '');
      if (text.includes('获取')) {
        await btn.click();
        console.log('点击获取验证码');
        codeBtnClicked = true;
        await sleep(2000);
        break;
      }
    }

    // 输入验证码到第二个输入框
    if (inputs.length > 1) {
      await inputs[1].evaluate(el => el.value = '');
      await inputs[1].type('888888');
      console.log('输入验证码: 888888');
    }
    await sleep(500);

    // 勾选协议 - 找checkbox区域
    const checkboxArea = await page.$('[class*="checkbox"], [class*="agreement"]');
    if (checkboxArea) {
      // 点击整个checkbox区域
      await checkboxArea.click();
      console.log('勾选协议');
    }
    await sleep(500);

    await page.screenshot({ path: SCREENSHOT_DIR + '/before-login-click.png' });

    // 点击登录按钮 - 要找到正确的登录按钮（不是协议链接）
    for (const btn of buttons) {
      const className = await btn.evaluate(el => el.className || '');
      const text = await btn.evaluate(el => el.innerText || '');
      // 登录按钮通常有 login 相关的class
      if (className.includes('login') && text.includes('登录')) {
        await btn.click();
        console.log('点击登录按钮');
        await sleep(5000);
        break;
      }
    }

    console.log('登录后 URL:', page.url());
    await page.screenshot({ path: SCREENSHOT_DIR + '/after-login.png' });

    // 如果跳转到协议页面，返回会员中心
    if (page.url().includes('agreement')) {
      console.log('跳转到协议页面，返回会员中心...');
      await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2' });
      await sleep(3000);
      console.log('返回后 URL:', page.url());
    }

    // 再次检查是否已登录
    const currentUrl = page.url();
    console.log('当前 URL:', currentUrl);
    
    await page.screenshot({ path: SCREENSHOT_DIR + '/member-center-final.png', fullPage: true });

    // 检查按钮名称
    const content = await page.content();
    const hasServiceReward = content.includes('服务奖罚');
    const hasCoachReward = content.includes('助教奖罚');
    const hasOldService = content.includes('服务日奖');
    const hasOldCoach = content.includes('助教违规');

    console.log('\n按钮名称检查:');
    console.log(`  服务奖罚: ${hasServiceReward ? '✅' : '❌'}`);
    console.log(`  助教奖罚: ${hasCoachReward ? '✅' : '❌'}`);
    console.log(`  服务日奖(旧): ${hasOldService ? '❌' : '✅'}`);
    console.log(`  助教违规(旧): ${hasOldCoach ? '❌' : '✅'}`);

    if (!hasServiceReward || !hasCoachReward) {
      // 检查页面内容
      const pageText = await page.evaluate(() => document.body.innerText);
      console.log('\n页面内容（前300字）:');
      console.log(pageText.substring(0, 300));
      
      // 检查 localStorage
      const ls = await page.evaluate(() => {
        return {
          memberToken: localStorage.getItem('memberToken'),
          adminInfo: localStorage.getItem('adminInfo'),
          coachInfo: localStorage.getItem('coachInfo')
        };
      });
      console.log('\nlocalStorage:');
      console.log('  memberToken:', ls.memberToken ? '已设置' : '未设置');
      console.log('  adminInfo:', ls.adminInfo);
      console.log('  coachInfo:', ls.coachInfo);
      
      return false;
    }

    // 测试服务奖罚
    console.log('\n测试服务奖罚页面...');
    
    // 使用 XPath 点击服务奖罚按钮
    const serviceBtnHandle = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('[class*="internal-btn"]'));
      return btns.find(b => b.textContent.includes('服务奖罚'));
    });
    
    if (serviceBtnHandle.asElement()) {
      await serviceBtnHandle.asElement().click();
      console.log('点击服务奖罚按钮');
      await sleep(3000);
      
      await page.screenshot({ path: SCREENSHOT_DIR + '/service-reward-page.png' });
      console.log('截图: service-reward-page.png');
      
      // 设定服务奖罚
      const setBtn = await page.$('.set-btn');
      if (setBtn) {
        await setBtn.click();
        await sleep(1000);
        
        // 选10元
        const btns = await page.$$('.modal-quick-btn');
        for (const b of btns) {
          const t = await b.evaluate(el => el.textContent);
          if (t === '10元') {
            await b.click();
            console.log('选择10元');
            break;
          }
        }
        
        // 输入备注
        const input = await page.$('.modal-remark-input');
        if (input) {
          await input.type('测试服务奖罚成功');
          console.log('输入备注');
        }
        
        // 点击确定
        const saveBtn = await page.$('.modal-btn-save');
        if (saveBtn) {
          await saveBtn.click();
          console.log('点击确定');
          await sleep(2000);
          
          await page.screenshot({ path: SCREENSHOT_DIR + '/service-reward-success.png' });
          console.log('✅ 截图: service-reward-success.png');
        }
      }
      
      // 返回
      await page.evaluate(() => {
        document.querySelector('[class*="back-btn"]')?.click();
      });
      await sleep(2000);
    }

    // 测试助教奖罚
    console.log('\n测试助教奖罚页面...');
    
    const coachBtnHandle = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('[class*="internal-btn"]'));
      return btns.find(b => b.textContent.includes('助教奖罚'));
    });
    
    if (coachBtnHandle.asElement()) {
      await coachBtnHandle.asElement().click();
      console.log('点击助教奖罚按钮');
      await sleep(3000);
      
      await page.screenshot({ path: SCREENSHOT_DIR + '/coach-reward-page.png' });
      console.log('截图: coach-reward-page.png');
      
      // 设定助教奖罚
      const setBtn = await page.$('.set-btn');
      if (setBtn) {
        await setBtn.click();
        await sleep(1000);
        
        // 选-10元
        const btns = await page.$$('.modal-neg-btn');
        for (const b of btns) {
          const t = await b.evaluate(el => el.textContent);
          if (t === '-10元') {
            await b.click();
            console.log('选择-10元');
            break;
          }
        }
        
        // 输入备注
        const input = await page.$('.modal-remark-input');
        if (input) {
          await input.type('测试助教奖罚成功');
          console.log('输入备注');
        }
        
        // 点击确定
        const saveBtn = await page.$('.modal-btn-save');
        if (saveBtn) {
          await saveBtn.click();
          console.log('点击确定');
          await sleep(2000);
          
          await page.screenshot({ path: SCREENSHOT_DIR + '/coach-reward-success.png' });
          console.log('✅ 截图: coach-reward-success.png');
        }
      }
    }

    console.log('\n============================================');
    console.log('  ✅ 测试完成');
    console.log('============================================\n');
    return true;

  } catch (e) {
    console.error('错误:', e.message);
    await page.screenshot({ path: SCREENSHOT_DIR + '/error.png' });
    return false;
  } finally {
    await page.close();
  }
}

runTest().then(s => process.exit(s ? 0 : 1));