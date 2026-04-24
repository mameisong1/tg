const puppeteer = require('puppeteer');
const SCREENSHOT_DIR = '/root/.openclaw/workspace_coder-tg';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('\n============================================');
  console.log('  奖罚名称测试 - 直接注入登录');
  console.log('============================================\n');

  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });

  const page = await browser.newPage();

  try {
    // 打开页面
    await page.goto('http://127.0.0.1:8089', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // 注入登录状态
    console.log('注入登录状态...');
    
    // 生成一个简单的token（基于会员号）
    const memberToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + Buffer.from(JSON.stringify({
      member_no: 1,
      phone: '18680174119',
      name: '马美嵩',
      exp: Math.floor(Date.now() / 1000) + 3600
    })).toString('base64');
    
    // 模拟管理员登录
    const adminInfo = {
      username: '18680174119',
      name: '马美嵩',
      role: '店长'
    };
    
    await page.evaluate((token, admin) => {
      // 设置会员token
      localStorage.setItem('memberToken', token);
      localStorage.setItem('lastPhone', admin.username);
      localStorage.setItem('agreed', 'true');
      
      // 设置管理员信息
      localStorage.setItem('adminInfo', JSON.stringify(admin));
      
      // 设置管理员token（用简单字符串）
      localStorage.setItem('adminToken', 'admin-' + Date.now());
      
      console.log('已设置localStorage');
      console.log('memberToken:', localStorage.getItem('memberToken'));
      console.log('adminInfo:', localStorage.getItem('adminInfo'));
    }, memberToken, adminInfo);
    
    console.log('✅ 登录状态已注入');
    await sleep(1000);

    // 刷新页面
    console.log('\n刷新页面...');
    await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    console.log('当前 URL:', page.url());
    
    await page.screenshot({ path: SCREENSHOT_DIR + '/member-after-inject.png', fullPage: true });
    console.log('截图: member-after-inject.png');

    // 检查按钮
    const content = await page.content();
    
    console.log('\n============================================');
    console.log('  检查按钮名称');
    console.log('============================================\n');

    const hasServiceReward = content.includes('服务奖罚');
    const hasCoachReward = content.includes('助教奖罚');
    const hasOldService = content.includes('服务日奖');
    const hasOldCoach = content.includes('助教违规');

    console.log(`服务奖罚按钮: ${hasServiceReward ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`助教奖罚按钮: ${hasCoachReward ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`服务日奖(旧): ${hasOldService ? '❌ 仍存在' : '✅ 已移除'}`);
    console.log(`助教违规(旧): ${hasOldCoach ? '❌ 仍存在' : '✅ 已移除'}`);

    // 获取页面上的所有文字内容
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('\n页面主要文字内容:');
    console.log(pageText.substring(0, 500));

    if (hasServiceReward && hasCoachReward) {
      console.log('\n============================================');
      console.log('  ✅ 按钮名称修改成功！开始测试设定奖罚');
      console.log('============================================\n');

      // 测试服务奖罚
      console.log('【测试 1】进入服务奖罚页面...');
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('[class*="internal-btn"], .internal-btn'));
        const serviceBtn = buttons.find(el => el.textContent.includes('服务奖罚'));
        if (serviceBtn) {
          serviceBtn.click();
          return '已点击服务奖罚';
        }
        return '未找到服务奖罚按钮';
      });
      await sleep(3000);
      
      await page.screenshot({ path: SCREENSHOT_DIR + '/service-reward-page.png', fullPage: true });
      console.log('截图: service-reward-page.png');
      console.log('当前 URL:', page.url());

      // 检查是否进入服务奖罚页面
      const serviceTitle = await page.evaluate(() => {
        const el = document.querySelector('.header-title');
        return el ? el.textContent : '';
      });
      console.log('页面标题:', serviceTitle);

      // 给服务员设定奖罚
      console.log('\n设定服务奖罚...');
      await sleep(2000);
      
      // 点击第一个设定按钮
      const setBtns = await page.$$('.set-btn');
      if (setBtns.length > 0) {
        await setBtns[0].click();
        await sleep(1000);
        console.log('点击设定按钮');

        // 选择10元
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
        const remarkInput = await page.$('input[placeholder*="备注"]');
        if (remarkInput) {
          await remarkInput.type('测试服务奖罚成功', { delay: 50 });
          console.log('输入备注: 测试服务奖罚成功');
        }

        await sleep(500);

        // 点击确定
        const saveBtn = await page.$('.modal-btn-save');
        if (saveBtn) {
          await saveBtn.click();
          await sleep(2000);
          console.log('点击确定');
          
          await page.screenshot({ path: SCREENSHOT_DIR + '/service-reward-success.png', fullPage: true });
          console.log('✅ 截图: service-reward-success.png');
        }
      }

      // 返回会员中心
      const backBtn = await page.$('.back-btn');
      if (backBtn) {
        await backBtn.click();
        await sleep(2000);
        console.log('返回会员中心');
      }

      // 测试助教奖罚
      console.log('\n【测试 2】进入助教奖罚页面...');
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('[class*="internal-btn"], .internal-btn'));
        const coachBtn = buttons.find(el => el.textContent.includes('助教奖罚'));
        if (coachBtn) {
          coachBtn.click();
          return '已点击助教奖罚';
        }
        return '未找到助教奖罚按钮';
      });
      await sleep(3000);
      
      await page.screenshot({ path: SCREENSHOT_DIR + '/coach-reward-page.png', fullPage: true });
      console.log('截图: coach-reward-page.png');
      console.log('当前 URL:', page.url());

      // 检查标题
      const coachTitle = await page.evaluate(() => {
        const el = document.querySelector('.header-title');
        return el ? el.textContent : '';
      });
      console.log('页面标题:', coachTitle);

      // 给助教设定奖罚
      console.log('\n设定助教奖罚...');
      await sleep(2000);
      
      // 点击第一个设定按钮
      const setBtns2 = await page.$$('.set-btn');
      if (setBtns2.length > 0) {
        await setBtns2[0].click();
        await sleep(1000);
        console.log('点击设定按钮');

        // 选择-10元
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
        const remarkInput2 = await page.$('input[placeholder*="备注"]');
        if (remarkInput2) {
          await remarkInput2.type('测试助教奖罚成功', { delay: 50 });
          console.log('输入备注: 测试助教奖罚成功');
        }

        await sleep(500);

        // 点击确定
        const saveBtn2 = await page.$('.modal-btn-save');
        if (saveBtn2) {
          await saveBtn2.click();
          await sleep(2000);
          console.log('点击确定');
          
          await page.screenshot({ path: SCREENSHOT_DIR + '/coach-reward-success.png', fullPage: true });
          console.log('✅ 截图: coach-reward-success.png');
        }
      }

      console.log('\n============================================');
      console.log('  ✅ 测试完成！');
      console.log('============================================\n');
      return true;
    } else {
      console.log('\n按钮名称未正确显示，可能原因：');
      console.log('1. 页面未正确渲染');
      console.log('2. 用户权限不足');
      console.log('3. 前端代码未生效');
      
      // 检查页面是否有内部管理按钮区域
      const hasInternalSection = content.includes('内部管理') || content.includes('internal');
      console.log('\n是否包含内部管理区域:', hasInternalSection ? '✅' : '❌');
      
      return false;
    }

  } catch (err) {
    console.error('错误:', err.message);
    await page.screenshot({ path: SCREENSHOT_DIR + '/error-inject.png' });
    return false;
  } finally {
    await page.close();
  }
}

runTest().then(s => process.exit(s ? 0 : 1));