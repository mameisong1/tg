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
    // 1. 打开会员中心
    console.log('【步骤 1】打开会员中心...');
    await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    console.log('URL:', page.url());
    await page.screenshot({ path: SCREENSHOT_DIR + '/TC01-member-page.png' });

    // 2. 登录
    console.log('\n【步骤 2】登录...');
    
    // 输入手机号 (h5-form-input 第一个)
    const phoneInput = await page.$('.h5-form-input');
    if (phoneInput) {
      await phoneInput.click({ clickCount: 3 });
      await phoneInput.type('18680174119');
      console.log('输入手机号: 18680174119');
    }
    await sleep(500);

    // 点击获取验证码 (h5-code-btn)
    const codeBtn = await page.$('.h5-code-btn');
    if (codeBtn) {
      await codeBtn.click();
      console.log('点击获取验证码');
      await sleep(2000);
    }

    // 输入验证码 (第二个 h5-form-input)
    const inputs = await page.$$('.h5-form-input');
    if (inputs.length > 1) {
      await inputs[1].click({ clickCount: 3 });
      await inputs[1].type('888888');
      console.log('输入验证码: 888888');
    }
    await sleep(500);

    // 勾选协议 (checkbox)
    const checkbox = await page.$('.checkbox');
    if (checkbox) {
      await checkbox.click();
      console.log('勾选协议');
    }
    await sleep(500);

    await page.screenshot({ path: SCREENSHOT_DIR + '/TC02-before-login.png' });

    // 点击登录按钮 (h5-login-btn) - 这是正确的登录按钮
    const loginBtn = await page.$('.h5-login-btn');
    if (loginBtn) {
      await loginBtn.click();
      console.log('点击登录按钮 (.h5-login-btn)');
      await sleep(5000);
    }

    console.log('登录后 URL:', page.url());
    await page.screenshot({ path: SCREENSHOT_DIR + '/TC03-after-login.png' });

    // 3. 检查按钮名称
    console.log('\n【步骤 3】检查按钮名称...');
    
    const content = await page.content();
    const hasServiceReward = content.includes('服务奖罚');
    const hasCoachReward = content.includes('助教奖罚');
    const hasOldService = content.includes('服务日奖');
    const hasOldCoach = content.includes('助教违规');

    console.log(`  服务奖罚按钮: ${hasServiceReward ? '✅' : '❌'}`);
    console.log(`  助教奖罚按钮: ${hasCoachReward ? '✅' : '❌'}`);
    console.log(`  服务日奖(旧): ${hasOldService ? '❌' : '✅ 已移除'}`);
    console.log(`  助教违规(旧): ${hasOldCoach ? '❌' : '✅ 已移除'}`);

    if (!hasServiceReward || !hasCoachReward) {
      const pageText = await page.evaluate(() => document.body.innerText);
      console.log('\n页面内容:');
      console.log(pageText.substring(0, 200));
      
      const ls = await page.evaluate(() => ({
        memberToken: localStorage.getItem('memberToken'),
        adminInfo: localStorage.getItem('adminInfo')
      }));
      console.log('\nlocalStorage:');
      console.log('  memberToken:', ls.memberToken ? '已设置' : '未设置');
      console.log('  adminInfo:', ls.adminInfo);
      
      console.log('\n❌ 登录未成功或按钮未显示');
      return false;
    }

    await page.screenshot({ path: SCREENSHOT_DIR + '/TC04-member-center.png', fullPage: true });
    console.log('截图: TC04-member-center.png');

    // 4. 测试服务奖罚
    console.log('\n【步骤 4】测试服务奖罚页面...');
    
    const serviceBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('.internal-btn'));
      return btns.find(b => b.textContent.includes('服务奖罚'));
    });
    
    if (serviceBtn.asElement()) {
      await serviceBtn.asElement().click();
      console.log('点击服务奖罚按钮');
      await sleep(3000);
      
      const title = await page.evaluate(() => 
        document.querySelector('.header-title')?.textContent || ''
      );
      console.log('页面标题:', title);
      
      await page.screenshot({ path: SCREENSHOT_DIR + '/TC05-service-reward-page.png' });

      // 设定奖罚
      const setBtn = await page.$('.set-btn');
      if (setBtn) {
        await setBtn.click();
        await sleep(1000);
        
        // 选10元
        const btn10 = await page.evaluateHandle(() => {
          const btns = Array.from(document.querySelectorAll('.modal-quick-btn'));
          return btns.find(b => b.textContent === '10元');
        });
        if (btn10.asElement()) {
          await btn10.asElement().click();
          console.log('选择10元');
        }
        
        // 输入备注
        const remarkInput = await page.$('.modal-remark-input');
        if (remarkInput) {
          await remarkInput.type('测试服务奖罚成功');
          console.log('输入备注');
        }
        
        // 点击确定
        const saveBtn = await page.$('.modal-btn-save');
        if (saveBtn) {
          await saveBtn.click();
          console.log('点击确定');
          await sleep(2000);
          
          await page.screenshot({ path: SCREENSHOT_DIR + '/TC06-service-reward-success.png' });
          console.log('✅ 截图: TC06-service-reward-success.png');
        }
      }

      // 返回
      await page.evaluate(() => document.querySelector('.back-btn')?.click());
      await sleep(2000);
    }

    // 5. 测试助教奖罚
    console.log('\n【步骤 5】测试助教奖罚页面...');
    
    const coachBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('.internal-btn'));
      return btns.find(b => b.textContent.includes('助教奖罚'));
    });
    
    if (coachBtn.asElement()) {
      await coachBtn.asElement().click();
      console.log('点击助教奖罚按钮');
      await sleep(3000);
      
      const title2 = await page.evaluate(() => 
        document.querySelector('.header-title')?.textContent || ''
      );
      console.log('页面标题:', title2);
      
      await page.screenshot({ path: SCREENSHOT_DIR + '/TC07-coach-reward-page.png' });

      // 设定奖罚
      const setBtn2 = await page.$('.set-btn');
      if (setBtn2) {
        await setBtn2.click();
        await sleep(1000);
        
        // 选-10元
        const btnNeg10 = await page.evaluateHandle(() => {
          const btns = Array.from(document.querySelectorAll('.modal-neg-btn'));
          return btns.find(b => b.textContent === '-10元');
        });
        if (btnNeg10.asElement()) {
          await btnNeg10.asElement().click();
          console.log('选择-10元');
        }
        
        // 输入备注
        const remarkInput2 = await page.$('.modal-remark-input');
        if (remarkInput2) {
          await remarkInput2.type('测试助教奖罚成功');
          console.log('输入备注');
        }
        
        // 点击确定
        const saveBtn2 = await page.$('.modal-btn-save');
        if (saveBtn2) {
          await saveBtn2.click();
          console.log('点击确定');
          await sleep(2000);
          
          await page.screenshot({ path: SCREENSHOT_DIR + '/TC08-coach-reward-success.png' });
          console.log('✅ 截图: TC08-coach-reward-success.png');
        }
      }
    }

    console.log('\n============================================');
    console.log('  ✅ 测试完成！');
    console.log('============================================\n');
    
    return true;

  } catch (e) {
    console.error('错误:', e.message);
    await page.screenshot({ path: SCREENSHOT_DIR + '/TC-error.png' });
    return false;
  } finally {
    await page.close();
  }
}

runTest().then(s => process.exit(s ? 0 : 1));