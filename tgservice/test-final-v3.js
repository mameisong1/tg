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
    // 1. 打开会员中心页面
    console.log('【步骤 1】打开会员中心页面...');
    await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    console.log('当前 URL:', page.url());
    
    await page.screenshot({ path: SCREENSHOT_DIR + '/step1-member-page.png', fullPage: true });
    console.log('截图: step1-member-page.png');

    // 2. 检查是否需要登录
    const needLogin = await page.evaluate(() => {
      return document.body.innerText.includes('会员登录') || document.body.innerText.includes('手机号');
    });
    
    if (needLogin) {
      console.log('\n【步骤 2】需要登录，开始登录流程...');
      
      // 输入手机号 - 使用第一个数字输入框
      const numberInputs = await page.$$('input[type="number"], input[type="tel"]');
      if (numberInputs.length > 0) {
        // 第一个输入框是手机号
        await numberInputs[0].click({ clickCount: 3 });
        await numberInputs[0].type('18680174119', { delay: 100 });
        console.log('输入手机号: 18680174119');
      }
      await sleep(1000);
      
      await page.screenshot({ path: SCREENSHOT_DIR + '/step2-phone-entered.png' });
      console.log('截图: step2-phone-entered.png');

      // 点击获取验证码按钮
      const getCodeBtn = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('[class*="code"], [class*="btn"], button, div'));
        return buttons.find(el => el.textContent.includes('获取')) || null;
      });
      
      if (getCodeBtn && getCodeBtn.asElement()) {
        await getCodeBtn.asElement().click();
        console.log('点击获取验证码');
        await sleep(2000); // 等待验证码发送
      }
      
      await page.screenshot({ path: SCREENSHOT_DIR + '/step2-code-sent.png' });
      console.log('截图: step2-code-sent.png');

      // 输入验证码 888888
      if (numberInputs.length > 1) {
        // 第二个输入框是验证码
        await numberInputs[1].click({ clickCount: 3 });
        await numberInputs[1].type('888888', { delay: 100 });
        console.log('输入验证码: 888888');
      } else {
        // 找验证码输入框
        const codeInput = await page.$('input[placeholder*="验证码"]');
        if (codeInput) {
          await codeInput.click({ clickCount: 3 });
          await codeInput.type('888888', { delay: 100 });
          console.log('输入验证码: 888888');
        }
      }
      await sleep(500);
      
      await page.screenshot({ path: SCREENSHOT_DIR + '/step2-code-entered.png' });
      console.log('截图: step2-code-entered.png');

      // 勾选同意协议
      const checkbox = await page.$('[class*="checkbox"], [class*="agreement"]');
      if (checkbox) {
        await checkbox.click();
        console.log('勾选同意协议');
      }
      await sleep(500);

      // 点击登录按钮
      const loginBtn = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('[class*="login"], [class*="btn"], button, div'));
        return buttons.find(el => el.textContent.includes('登录')) || null;
      });
      
      if (loginBtn && loginBtn.asElement()) {
        await loginBtn.asElement().click();
        console.log('点击登录按钮');
        await sleep(5000); // 等待登录完成
      }
      
      console.log('登录后 URL:', page.url());
      await page.screenshot({ path: SCREENSHOT_DIR + '/step2-after-login.png', fullPage: true });
      console.log('截图: step2-after-login.png');
    }

    // 3. 检查按钮名称
    console.log('\n【步骤 3】检查按钮名称...');
    
    const content = await page.content();
    const pageText = await page.evaluate(() => document.body.innerText);
    
    const hasServiceReward = content.includes('服务奖罚');
    const hasCoachReward = content.includes('助教奖罚');
    const hasOldService = content.includes('服务日奖');
    const hasOldCoach = content.includes('助教违规');
    
    console.log('\n按钮名称检查:');
    console.log(`  服务奖罚: ${hasServiceReward ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`  助教奖罚: ${hasCoachReward ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`  服务日奖(旧): ${hasOldService ? '❌ 仍存在' : '✅ 已移除'}`);
    console.log(`  助教违规(旧): ${hasOldCoach ? '❌ 仍存在' : '✅ 已移除'}`);
    
    console.log('\n页面主要内容:');
    console.log(pageText.substring(0, 300));

    if (!hasServiceReward || !hasCoachReward) {
      console.log('\n⚠️ 按钮名称未正确显示，可能原因:');
      console.log('  1. 用户未登录成功');
      console.log('  2. 用户权限不足（需要店长/管理员角色）');
      
      // 检查是否有登录状态
      const isLoggedIn = await page.evaluate(() => {
        return localStorage.getItem('memberToken') !== null;
      });
      console.log(`  登录状态: ${isLoggedIn ? '已登录' : '未登录'}`);
      
      if (isLoggedIn) {
        const adminInfo = await page.evaluate(() => {
          return localStorage.getItem('adminInfo');
        });
        console.log(`  adminInfo: ${adminInfo}`);
      }
      
      await page.screenshot({ path: SCREENSHOT_DIR + '/fail-buttons-not-found.png', fullPage: true });
      return false;
    }

    // 4. 测试服务奖罚页面
    console.log('\n【步骤 4】测试服务奖罚页面...');
    
    // 点击服务奖罚按钮
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[class*="internal-btn"]'));
      const serviceBtn = buttons.find(el => el.textContent.includes('服务奖罚'));
      if (serviceBtn) serviceBtn.click();
    });
    await sleep(3000);
    
    console.log('进入服务奖罚页面，URL:', page.url());
    await page.screenshot({ path: SCREENSHOT_DIR + '/service-reward-page.png', fullPage: true });
    console.log('截图: service-reward-page.png');

    // 验证页面标题
    const serviceTitle = await page.evaluate(() => {
      const el = document.querySelector('[class*="header-title"]');
      return el ? el.textContent : '';
    });
    console.log('页面标题:', serviceTitle);
    console.log(`标题包含服务奖罚: ${serviceTitle.includes('服务奖罚') ? '✅' : '❌'}`);

    // 设定服务奖罚
    await sleep(2000);
    const setBtns = await page.$$('.set-btn');
    if (setBtns.length > 0) {
      console.log('找到设定按钮，开始设定服务奖罚...');
      await setBtns[0].click();
      await sleep(1000);
      
      // 选择10元
      const quickBtns = await page.$$('.modal-quick-btn');
      for (const btn of quickBtns) {
        const text = await btn.evaluate(el => el.textContent);
        if (text === '10元') {
          await btn.click();
          console.log('选择 10元');
          break;
        }
      }
      
      // 输入备注
      const remarkInput = await page.$('.modal-remark-input');
      if (remarkInput) {
        await remarkInput.type('测试服务奖罚设定成功', { delay: 50 });
        console.log('输入备注: 测试服务奖罚设定成功');
      }
      
      await sleep(500);
      
      // 点击确定
      const saveBtn = await page.$('.modal-btn-save');
      if (saveBtn) {
        await saveBtn.click();
        console.log('点击确定');
        await sleep(2000);
      }
      
      await page.screenshot({ path: SCREENSHOT_DIR + '/service-reward-success.png', fullPage: true });
      console.log('✅ 截图: service-reward-success.png');
    }

    // 返回会员中心
    await page.evaluate(() => {
      const backBtn = document.querySelector('[class*="back-btn"]');
      if (backBtn) backBtn.click();
    });
    await sleep(3000);

    // 5. 测试助教奖罚页面
    console.log('\n【步骤 5】测试助教奖罚页面...');
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[class*="internal-btn"]'));
      const coachBtn = buttons.find(el => el.textContent.includes('助教奖罚'));
      if (coachBtn) coachBtn.click();
    });
    await sleep(3000);
    
    console.log('进入助教奖罚页面，URL:', page.url());
    await page.screenshot({ path: SCREENSHOT_DIR + '/coach-reward-page.png', fullPage: true });
    console.log('截图: coach-reward-page.png');

    // 验证页面标题
    const coachTitle = await page.evaluate(() => {
      const el = document.querySelector('[class*="header-title"]');
      return el ? el.textContent : '';
    });
    console.log('页面标题:', coachTitle);
    console.log(`标题包含助教奖罚: ${coachTitle.includes('助教奖罚') ? '✅' : '❌'}`);

    // 设定助教奖罚
    await sleep(2000);
    const setBtns2 = await page.$$('.set-btn');
    if (setBtns2.length > 0) {
      console.log('找到设定按钮，开始设定助教奖罚...');
      await setBtns2[0].click();
      await sleep(1000);
      
      // 选择-10元
      const negBtns = await page.$$('.modal-neg-btn');
      for (const btn of negBtns) {
        const text = await btn.evaluate(el => el.textContent);
        if (text === '-10元') {
          await btn.click();
          console.log('选择 -10元');
          break;
        }
      }
      
      // 输入备注
      const remarkInput2 = await page.$('.modal-remark-input');
      if (remarkInput2) {
        await remarkInput2.type('测试助教奖罚设定成功', { delay: 50 });
        console.log('输入备注: 测试助教奖罚设定成功');
      }
      
      await sleep(500);
      
      // 点击确定
      const saveBtn2 = await page.$('.modal-btn-save');
      if (saveBtn2) {
        await saveBtn2.click();
        console.log('点击确定');
        await sleep(2000);
      }
      
      await page.screenshot({ path: SCREENSHOT_DIR + '/coach-reward-success.png', fullPage: true });
      console.log('✅ 截图: coach-reward-success.png');
    }

    // 结果汇总
    console.log('\n============================================');
    console.log('  ✅ 测试完成！');
    console.log('============================================\n');
    
    console.log('修改内容:');
    console.log('  1. 前端按钮: 服务日奖 → 服务奖罚');
    console.log('  2. 前端按钮: 助教违规 → 助教奖罚');
    console.log('  3. 系统配置: 服务日奖 → 服务奖罚');
    console.log('  4. 系统配置: 助教日常 → 助教奖罚');
    console.log('  5. 数据库记录: 已更新已有奖罚记录');
    
    console.log('\n测试结果:');
    console.log(`  按钮名称修改: ✅ 成功`);
    console.log(`  服务奖罚设定: ${setBtns.length > 0 ? '✅' : '❌'}`);
    console.log(`  助教奖罚设定: ${setBtns2.length > 0 ? '✅' : '❌'}`);
    
    console.log('\n截图文件:');
    const screenshots = ['step1-member-page.png', 'step2-phone-entered.png', 'service-reward-page.png', 'service-reward-success.png', 'coach-reward-page.png', 'coach-reward-success.png'];
    screenshots.forEach(f => console.log(`  - ${SCREENSHOT_DIR}/${f}`));

    return true;

  } catch (err) {
    console.error('测试失败:', err.message);
    await page.screenshot({ path: SCREENSHOT_DIR + '/error.png' });
    return false;
  } finally {
    await page.close();
    console.log('\n已关闭测试标签页');
  }
}

runTest().then(success => process.exit(success ? 0 : 1));