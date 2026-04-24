const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/root/.openclaw/workspace_coder-tg';
const TEST_URL = 'http://127.0.0.1:8089';
const DB_PATH = '/TG/tgservice/db/tgservice.db';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('\n============================================');
  console.log('  奖罚类型名称测试');
  console.log('  测试时间: ' + new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
  console.log('============================================\n');

  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  try {
    // Step 1: 打开测试页面
    console.log('【步骤 1】打开测试页面...');
    await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);
    console.log('✅ 页面加载完成');

    // Step 2: 登录
    console.log('\n【步骤 2】登录...');
    
    // 检查是否已在登录页
    const url = page.url();
    console.log('当前 URL:', url);

    // 如果在首页，点击会员中心
    if (url === TEST_URL + '/' || url === TEST_URL) {
      console.log('在首页，需要进入会员中心...');
      
      // 查找会员中心入口（通常在底部导航）
      const memberTab = await page.$('.uni-tabbar__item:nth-child(3)') || 
                        await page.$('[class*="member"]') ||
                        await page.$('text=会员');
      
      if (memberTab) {
        await memberTab.click();
        await sleep(2000);
        console.log('点击会员中心');
      }
    }

    // 检查是否需要登录
    const needLogin = await page.$('input[placeholder*="手机号"]') || 
                      await page.$('.login-page');
    
    if (needLogin) {
      console.log('需要登录...');
      
      // 输入手机号
      const phoneInput = await page.$('input[type="tel"]') || 
                         await page.$('input[placeholder*="手机号"]');
      if (phoneInput) {
        await phoneInput.type('16675852676', { delay: 50 });
        console.log('输入手机号: 16675852676');
      }

      // 发送验证码
      const sendBtn = await page.$('button:has-text("发送验证码")') ||
                       await page.$('.send-code-btn') ||
                       await page.$('[class*="code"]');
      if (sendBtn) {
        await sendBtn.click();
        await sleep(1000);
        console.log('点击发送验证码');
      }

      // 输入验证码
      const codeInputs = await page.$$('input[type="tel"]');
      if (codeInputs.length > 1) {
        await codeInputs[1].type('888888', { delay: 50 });
        console.log('输入验证码: 888888');
      } else {
        // 可能是单独的验证码输入框
        const codeInput = await page.$('input[placeholder*="验证码"]');
        if (codeInput) {
          await codeInput.type('888888', { delay: 50 });
          console.log('输入验证码: 888888');
        }
      }

      // 勾选协议
      const agreeCheckbox = await page.$('input[type="checkbox"]') ||
                            await page.$('.agreement-checkbox');
      if (agreeCheckbox) {
        await agreeCheckbox.click();
        console.log('勾选同意协议');
      }

      // 点击登录
      const loginBtn = await page.$('button:has-text("登录")') ||
                       await page.$('.login-btn');
      if (loginBtn) {
        await loginBtn.click();
        await sleep(3000);
        console.log('点击登录');
      }
    }

    await sleep(3000);
    const loginUrl = page.url();
    console.log('登录后 URL:', loginUrl);

    // Step 3: 检查按钮名称
    console.log('\n【步骤 3】检查按钮名称...');
    
    // 截图会员中心页面
    const memberScreenshot = path.join(SCREENSHOT_DIR, 'member-center-buttons.png');
    await page.screenshot({ path: memberScreenshot, fullPage: false });
    console.log('截图保存:', memberScreenshot);

    // 查找按钮文字
    const pageContent = await page.content();
    
    // 检查新名称是否存在
    const hasServiceReward = pageContent.includes('服务奖罚');
    const hasCoachReward = pageContent.includes('助教奖罚');
    
    // 检查旧名称是否不存在
    const hasOldServiceName = pageContent.includes('服务日奖');
    const hasOldCoachName = pageContent.includes('助教违规');
    
    console.log('\n按钮名称检查:');
    console.log(`  服务奖罚按钮: ${hasServiceReward ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`  助教奖罚按钮: ${hasCoachReward ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`  旧名称服务日奖: ${hasOldServiceName ? '❌ 仍存在（未修改成功）' : '✅ 已移除'}`);
    console.log(`  旧名称助教违规: ${hasOldCoachName ? '❌ 仍存在（未修改成功）' : '✅ 已移除'}`);

    // Step 4: 进入服务奖罚页面
    console.log('\n【步骤 4】测试服务奖罚页面...');
    
    // 点击服务奖罚按钮
    const serviceBtn = await page.$('text=服务奖罚') ||
                       await page.$('[class*="internal-btn"]:has-text("服务奖罚")');
    if (serviceBtn) {
      await serviceBtn.click();
      await sleep(3000);
      console.log('点击服务奖罚按钮');

      // 截图服务奖罚页面
      const serviceScreenshot = path.join(SCREENSHOT_DIR, 'service-reward-page.png');
      await page.screenshot({ path: serviceScreenshot, fullPage: true });
      console.log('截图保存:', serviceScreenshot);

      // 检查页面标题
      const serviceTitle = await page.$eval('.header-title', el => el.textContent).catch(() => '');
      console.log('页面标题:', serviceTitle);
      console.log(`标题包含"服务奖罚": ${serviceTitle.includes('服务奖罚') ? '✅' : '❌'}`);

      // 设定奖罚（找一个服务员）
      console.log('尝试给服务员设定奖罚...');
      
      // 等待人员列表加载
      await sleep(2000);
      
      // 查找第一个设定按钮
      const setBtn = await page.$('.set-btn');
      if (setBtn) {
        await setBtn.click();
        await sleep(1000);
        console.log('点击设定按钮');

        // 选择金额
        const tenBtn = await page.$('.modal-quick-btn:has-text("10元")');
        if (tenBtn) {
          await tenBtn.click();
          console.log('选择 10元');
        }

        // 输入备注
        const remarkInput = await page.$('.modal-remark-input') ||
                            await page.$('input[placeholder*="备注"]');
        if (remarkInput) {
          await remarkInput.type('测试服务奖罚', { delay: 50 });
          console.log('输入备注: 测试服务奖罚');
        }

        // 点击确定
        const confirmBtn = await page.$('.modal-btn-save') ||
                          await page.$('button:has-text("确定")');
        if (confirmBtn) {
          await confirmBtn.click();
          await sleep(2000);
          console.log('点击确定');

          // 截图设定成功
          const successScreenshot = path.join(SCREENSHOT_DIR, 'service-reward-success.png');
          await page.screenshot({ path: successScreenshot, fullPage: true });
          console.log('截图保存:', successScreenshot);
        }
      }

      // 返回会员中心
      const backBtn = await page.$('.back-btn');
      if (backBtn) {
        await backBtn.click();
        await sleep(2000);
        console.log('返回会员中心');
      }
    } else {
      console.log('❌ 未找到服务奖罚按钮');
    }

    // Step 5: 进入助教奖罚页面
    console.log('\n【步骤 5】测试助教奖罚页面...');
    
    // 点击助教奖罚按钮
    const coachBtn = await page.$('text=助教奖罚') ||
                     await page.$('[class*="internal-btn"]:has-text("助教奖罚")');
    if (coachBtn) {
      await coachBtn.click();
      await sleep(3000);
      console.log('点击助教奖罚按钮');

      // 截图助教奖罚页面
      const coachScreenshot = path.join(SCREENSHOT_DIR, 'coach-reward-page.png');
      await page.screenshot({ path: coachScreenshot, fullPage: true });
      console.log('截图保存:', coachScreenshot);

      // 检查页面标题
      const coachTitle = await page.$eval('.header-title', el => el.textContent).catch(() => '');
      console.log('页面标题:', coachTitle);
      console.log(`标题包含"助教奖罚": ${coachTitle.includes('助教奖罚') ? '✅' : '❌'}`);

      // 设定奖罚（找一个助教）
      console.log('尝试给助教设定奖罚...');
      
      // 等待人员列表加载
      await sleep(2000);
      
      // 查找第一个设定按钮
      const setBtn = await page.$('.set-btn');
      if (setBtn) {
        await setBtn.click();
        await sleep(1000);
        console.log('点击设定按钮');

        // 选择金额（-10元）
        const negTenBtn = await page.$('.modal-neg-btn:has-text("-10元")');
        if (negTenBtn) {
          await negTenBtn.click();
          console.log('选择 -10元');
        }

        // 输入备注
        const remarkInput = await page.$('.modal-remark-input') ||
                            await page.$('input[placeholder*="备注"]');
        if (remarkInput) {
          await remarkInput.type('测试助教奖罚', { delay: 50 });
          console.log('输入备注: 测试助教奖罚');
        }

        // 点击确定
        const confirmBtn = await page.$('.modal-btn-save') ||
                          await page.$('button:has-text("确定")');
        if (confirmBtn) {
          await confirmBtn.click();
          await sleep(2000);
          console.log('点击确定');

          // 截图设定成功
          const successScreenshot = path.join(SCREENSHOT_DIR, 'coach-reward-success.png');
          await page.screenshot({ path: successScreenshot, fullPage: true });
          console.log('截图保存:', successScreenshot);
        }
      }
    } else {
      console.log('❌ 未找到助教奖罚按钮');
    }

    // 测试结果汇总
    console.log('\n============================================');
    console.log('  测试结果汇总');
    console.log('============================================\n');
    
    const allPassed = hasServiceReward && hasCoachReward && !hasOldServiceName && !hasOldCoachName;
    
    console.log(`按钮名称修改: ${allPassed ? '✅ 全部正确' : '❌ 存在问题'}`);
    console.log(`截图已保存到: ${SCREENSHOT_DIR}`);

    // 列出截图文件
    const screenshots = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
    console.log('截图文件:', screenshots.join(', '));

    return allPassed;

  } catch (error) {
    console.error('测试执行失败:', error);
    
    // 错误截图
    const errorScreenshot = path.join(SCREENSHOT_DIR, 'test-error.png');
    await page.screenshot({ path: errorScreenshot, fullPage: true });
    console.log('错误截图保存:', errorScreenshot);
    
    return false;
  } finally {
    // 关闭页面
    const allPages = await browser.pages();
    for (const p of allPages) {
      if (p !== page) {
        await p.close().catch(() => {});
      }
    }
    console.log('\n已关闭多余标签页');
  }
}

runTest().then(success => {
  console.log('\n测试完成:', success ? '✅ 成功' : '❌ 失败');
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});