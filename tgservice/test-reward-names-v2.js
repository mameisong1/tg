const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/root/.openclaw/workspace_coder-tg';
const TEST_URL = 'http://127.0.0.1:8089';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('\n============================================');
  console.log('  奖罚类型名称测试');
  console.log('  测试时间: ' + new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
  console.log('============================================\n');

  // 确保 Chrome 启动
  const chromeCheck = await new Promise(resolve => {
    require('http').get('http://127.0.0.1:9222/json/version', res => resolve(res.statusCode === 200)).on('error', () => resolve(false));
  });
  
  if (!chromeCheck) {
    console.log('启动 Chrome...');
    require('child_process').exec('bash /root/chrome &');
    await sleep(5000);
  }

  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });

  let page = await browser.newPage();

  try {
    // Step 1: 打开首页
    console.log('【步骤 1】打开首页...');
    await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);
    
    // 截图首页
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'homepage.png') });
    console.log('✅ 首页截图: homepage.png');
    console.log('当前 URL:', page.url());

    // Step 2: 点击会员中心（底部导航第三个）
    console.log('\n【步骤 2】进入会员中心...');
    
    // 尝试多种方式找到会员中心按钮
    const memberTab = await page.evaluate(() => {
      // 找底部导航栏的会员按钮
      const tabs = document.querySelectorAll('.uni-tabbar, [class*="tabbar"], nav');
      if (tabs.length > 0) {
        const items = tabs[0].querySelectorAll('[class*="item"], button, a');
        if (items.length >= 3) {
          items[2].click(); // 会员通常是第三个
          return '点击成功';
        }
      }
      
      // 尝试直接找会员文字
      const memberText = Array.from(document.querySelectorAll('*')).find(el => el.textContent.includes('会员'));
      if (memberText) {
        memberText.click();
        return '点击会员文字成功';
      }
      
      return '未找到会员入口';
    });
    
    console.log('会员中心点击结果:', memberTab);
    await sleep(3000);
    
    // 截图
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'after-member-click.png') });
    console.log('截图: after-member-click.png');
    console.log('当前 URL:', page.url());

    // Step 3: 检查是否需要登录
    console.log('\n【步骤 3】检查登录状态...');
    
    const pageContent = await page.content();
    const needLogin = pageContent.includes('手机号') || pageContent.includes('验证码') || page.url().includes('login');
    
    if (needLogin) {
      console.log('需要登录，开始登录流程...');
      
      // 使用管理员手机号
      const phone = '18680174119'; // 店长账号
      
      // 输入手机号
      const phoneInput = await page.$('input[type="tel"], input[type="number"], input[placeholder*="手机"]');
      if (phoneInput) {
        await phoneInput.click({ clickCount: 3 }); // 清空
        await phoneInput.type(phone, { delay: 100 });
        console.log('输入手机号:', phone);
      } else {
        console.log('❌ 未找到手机号输入框');
      }
      
      await sleep(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'login-phone.png') });

      // 发送验证码
      const sendBtn = await page.$('button, [class*="send"], [class*="code"]');
      if (sendBtn) {
        const btnText = await sendBtn.evaluate(el => el.textContent);
        if (btnText.includes('发送') || btnText.includes('验证码')) {
          await sendBtn.click();
          console.log('点击发送验证码');
          await sleep(2000);
        }
      }

      // 输入验证码
      const codeInputs = await page.$$('input');
      for (const input of codeInputs) {
        const placeholder = await input.evaluate(el => el.placeholder || '');
        if (placeholder.includes('验证码') || placeholder.includes('码')) {
          await input.type('888888', { delay: 100 });
          console.log('输入验证码: 888888');
          break;
        }
      }
      
      // 或找单独的验证码输入框
      const codeInput = await page.$('input[placeholder*="验证码"], input[placeholder*="码"]');
      if (codeInput && await codeInput.evaluate(el => el.value) === '') {
        await codeInput.type('888888', { delay: 100 });
        console.log('输入验证码: 888888');
      }

      // 勾选协议
      const checkbox = await page.$('input[type="checkbox"], [class*="agreement"], [class*="agree"]');
      if (checkbox) {
        await checkbox.click();
        console.log('勾选同意协议');
      }

      await sleep(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'login-ready.png') });

      // 点击登录按钮
      const loginBtn = await page.$('button, [class*="login"]');
      if (loginBtn) {
        const btnText = await loginBtn.evaluate(el => el.textContent);
        if (btnText.includes('登录')) {
          await loginBtn.click();
          console.log('点击登录');
          await sleep(5000);
        }
      }
      
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'after-login.png') });
      console.log('登录后 URL:', page.url());
    }

    // Step 4: 查找并点击服务奖罚按钮
    console.log('\n【步骤 4】查找服务奖罚按钮...');
    
    // 截图当前页面
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'member-center-full.png'), fullPage: true });
    console.log('截图: member-center-full.png');

    // 检查按钮名称
    const pageContent2 = await page.content();
    const hasServiceReward = pageContent2.includes('服务奖罚');
    const hasCoachReward = pageContent2.includes('助教奖罚');
    const hasOldService = pageContent2.includes('服务日奖');
    const hasOldCoach = pageContent2.includes('助教违规');
    
    console.log('\n按钮名称检查:');
    console.log(`  服务奖罚: ${hasServiceReward ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`  助教奖罚: ${hasCoachReward ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`  服务日奖(旧): ${hasOldService ? '❌ 仍存在' : '✅ 已移除'}`);
    console.log(`  助教违规(旧): ${hasOldCoach ? '❌ 仍存在' : '✅ 已移除'}`);

    // 点击服务奖罚按钮
    if (hasServiceReward) {
      console.log('\n点击服务奖罚按钮...');
      
      // 使用 XPath 或 evaluate 点击
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('[class*="internal-btn"], button, a'));
        const serviceBtn = buttons.find(el => el.textContent.includes('服务奖罚'));
        if (serviceBtn) serviceBtn.click();
      });
      
      await sleep(3000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'service-reward-page.png'), fullPage: true });
      console.log('截图: service-reward-page.png');
      console.log('当前 URL:', page.url());

      // 检查页面标题
      const title = await page.evaluate(() => {
        const el = document.querySelector('.header-title, h1, [class*="title"]');
        return el ? el.textContent : '';
      });
      console.log('页面标题:', title);

      // 给服务员设定奖罚
      console.log('\n设定服务奖罚...');
      await sleep(2000);
      
      // 点击第一个设定按钮
      const setBtns = await page.$$('.set-btn');
      if (setBtns.length > 0) {
        await setBtns[0].click();
        await sleep(1000);
        console.log('点击设定按钮');

        // 选择 10元
        const quickBtns = await page.$$('.modal-quick-btn');
        for (const btn of quickBtns) {
          const text = await btn.evaluate(el => el.textContent);
          if (text.includes('10')) {
            await btn.click();
            console.log('选择 10元');
            break;
          }
        }

        // 输入备注
        const remarkInput = await page.$('.modal-remark-input, input[placeholder*="备注"]');
        if (remarkInput) {
          await remarkInput.type('测试服务奖罚成功', { delay: 50 });
          console.log('输入备注: 测试服务奖罚成功');
        }

        // 点击确定
        const saveBtn = await page.$('.modal-btn-save, button:contains("确定")');
        if (saveBtn) {
          await saveBtn.click();
          await sleep(2000);
          console.log('点击确定');
          
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'service-reward-success.png'), fullPage: true });
          console.log('截图: service-reward-success.png');
        }
      }

      // 返回
      await page.evaluate(() => {
        const backBtn = document.querySelector('.back-btn, [class*="back"]');
        if (backBtn) backBtn.click();
      });
      await sleep(2000);
    }

    // 点击助教奖罚按钮
    if (hasCoachReward) {
      console.log('\n点击助教奖罚按钮...');
      
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('[class*="internal-btn"], button, a'));
        const coachBtn = buttons.find(el => el.textContent.includes('助教奖罚'));
        if (coachBtn) coachBtn.click();
      });
      
      await sleep(3000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'coach-reward-page.png'), fullPage: true });
      console.log('截图: coach-reward-page.png');
      console.log('当前 URL:', page.url());

      // 检查页面标题
      const title = await page.evaluate(() => {
        const el = document.querySelector('.header-title, h1, [class*="title"]');
        return el ? el.textContent : '';
      });
      console.log('页面标题:', title);

      // 给助教设定奖罚
      console.log('\n设定助教奖罚...');
      await sleep(2000);
      
      // 点击第一个设定按钮
      const setBtns = await page.$$('.set-btn');
      if (setBtns.length > 0) {
        await setBtns[0].click();
        await sleep(1000);
        console.log('点击设定按钮');

        // 选择 -10元
        const negBtns = await page.$$('.modal-neg-btn');
        for (const btn of negBtns) {
          const text = await btn.evaluate(el => el.textContent);
          if (text.includes('-10')) {
            await btn.click();
            console.log('选择 -10元');
            break;
          }
        }

        // 输入备注
        const remarkInput = await page.$('.modal-remark-input, input[placeholder*="备注"]');
        if (remarkInput) {
          await remarkInput.type('测试助教奖罚成功', { delay: 50 });
          console.log('输入备注: 测试助教奖罚成功');
        }

        // 点击确定
        const saveBtn = await page.$('.modal-btn-save, button');
        if (saveBtn) {
          const text = await saveBtn.evaluate(el => el.textContent);
          if (text.includes('确定')) {
            await saveBtn.click();
            await sleep(2000);
            console.log('点击确定');
            
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'coach-reward-success.png'), fullPage: true });
            console.log('截图: coach-reward-success.png');
          }
        }
      }
    }

    // 结果汇总
    console.log('\n============================================');
    console.log('  测试结果汇总');
    console.log('============================================\n');
    
    const success = hasServiceReward && hasCoachReward && !hasOldService && !hasOldCoach;
    console.log(`按钮名称修改: ${success ? '✅ 成功' : '❌ 失败'}`);
    
    // 列出截图
    const screenshots = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
    console.log(`截图文件 (${screenshots.length} 个):`);
    screenshots.forEach(f => console.log(`  - ${f}`));

    return success;

  } catch (error) {
    console.error('测试失败:', error.message);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'test-error-final.png') });
    return false;
  } finally {
    await page.close();
    console.log('\n已关闭测试标签页');
  }
}

runTest().then(success => {
  process.exit(success ? 0 : 1);
});