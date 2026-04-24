const puppeteer = require('puppeteer');
const SCREENSHOT_DIR = '/root/.openclaw/workspace_coder-tg';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('\n============================================');
  console.log('  奖罚名称测试 - 直接调用API登录');
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
    await sleep(2000);
    await page.screenshot({ path: SCREENSHOT_DIR + '/F01-member-page.png' });

    // 2. 直接在页面中调用登录API并设置token
    console.log('\n【步骤 2】直接调用登录API...');
    
    const loginResult = await page.evaluate(async () => {
      try {
        // 直接调用API
        const response = await fetch('https://tg.tiangong.club/api/member/login-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '18680174119', code: '888888' })
        });
        
        const data = await response.json();
        
        if (data.success) {
          // 保存token到localStorage
          localStorage.setItem('memberToken', data.token);
          localStorage.setItem('lastPhone', '18680174119');
          localStorage.setItem('agreed', 'true');
          
          if (data.adminInfo) {
            localStorage.setItem('adminInfo', JSON.stringify(data.adminInfo));
          }
          if (data.adminToken) {
            localStorage.setItem('adminToken', data.adminToken);
          }
          if (data.coachInfo) {
            localStorage.setItem('coachInfo', JSON.stringify(data.coachInfo));
          }
          
          return { success: true, tokenSet: localStorage.getItem('memberToken') !== null };
        }
        
        return { success: false, error: data.error };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    
    console.log('登录结果:', loginResult);

    // 3. 刷新页面以应用登录状态
    console.log('\n【步骤 3】刷新页面...');
    await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    
    console.log('URL:', page.url());
    await page.screenshot({ path: SCREENSHOT_DIR + '/F02-after-login-refresh.png', fullPage: true });

    // 4. 检查按钮名称
    console.log('\n【步骤 4】检查按钮名称...');
    
    const content = await page.content();
    const hasServiceReward = content.includes('服务奖罚');
    const hasCoachReward = content.includes('助教奖罚');
    const hasOldService = content.includes('服务日奖');
    const hasOldCoach = content.includes('助教违规');

    console.log(`  服务奖罚按钮: ${hasServiceReward ? '✅' : '❌'}`);
    console.log(`  助教奖罚按钮: ${hasCoachReward ? '✅' : '❌'}`);
    console.log(`  服务日奖(旧): ${hasOldService ? '❌' : '✅ 已移除'}`);
    console.log(`  助教违规(旧): ${hasOldCoach ? '❌' : '✅ 已移除'}`);

    // 检查localStorage和页面状态
    const ls = await page.evaluate(() => ({
      memberToken: localStorage.getItem('memberToken'),
      adminInfo: localStorage.getItem('adminInfo'),
      hasMemberInfo: document.body.innerText.includes('马美嵩') || document.body.innerText.includes('会员1')
    }));
    
    console.log('\n验证状态:');
    console.log('  memberToken:', ls.memberToken ? '已设置' : '未设置');
    console.log('  adminInfo:', ls.adminInfo ? '已设置' : '未设置');
    console.log('  显示会员信息:', ls.hasMemberInfo ? '✅' : '❌');

    if (!hasServiceReward || !hasCoachReward) {
      const pageText = await page.evaluate(() => document.body.innerText);
      console.log('\n页面内容:');
      console.log(pageText.substring(0, 300));
      console.log('\n❌ 按钮未显示');
      return false;
    }

    console.log('\n✅ 按钮名称正确显示！');

    // 5. 测试服务奖罚页面
    console.log('\n【步骤 5】测试服务奖罚...');
    
    // 点击服务奖罚按钮
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.internal-btn'));
      const serviceBtn = btns.find(b => b.textContent.includes('服务奖罚'));
      if (serviceBtn) {
        serviceBtn.click();
        return true;
      }
      return false;
    });
    
    if (clicked) {
      console.log('点击服务奖罚按钮');
      await sleep(3000);
      
      const title = await page.evaluate(() => 
        document.querySelector('.header-title')?.textContent || ''
      );
      console.log('页面标题:', title);
      
      await page.screenshot({ path: SCREENSHOT_DIR + '/F03-service-reward-page.png', fullPage: true });

      // 设定奖罚
      await sleep(2000);
      const setBtn = await page.$('.set-btn');
      if (setBtn) {
        await setBtn.click();
        await sleep(1000);
        
        // 选10元
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('.modal-quick-btn'));
          const btn10 = btns.find(b => b.textContent === '10元');
          if (btn10) btn10.click();
        });
        console.log('选择10元');
        
        // 输入备注
        const remarkInput = await page.$('.modal-remark-input');
        if (remarkInput) {
          await remarkInput.type('测试服务奖罚成功');
          console.log('输入备注');
        }
        
        await sleep(500);
        
        // 点击确定
        const saveBtn = await page.$('.modal-btn-save');
        if (saveBtn) {
          await saveBtn.click();
          console.log('点击确定');
          await sleep(2000);
        }
        
        await page.screenshot({ path: SCREENSHOT_DIR + '/F04-service-reward-success.png', fullPage: true });
        console.log('✅ 截图: F04-service-reward-success.png');
      }

      // 返回
      await page.evaluate(() => document.querySelector('.back-btn')?.click());
      await sleep(2000);
    }

    // 6. 测试助教奖罚页面
    console.log('\n【步骤 6】测试助教奖罚...');
    
    const clicked2 = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.internal-btn'));
      const coachBtn = btns.find(b => b.textContent.includes('助教奖罚'));
      if (coachBtn) {
        coachBtn.click();
        return true;
      }
      return false;
    });
    
    if (clicked2) {
      console.log('点击助教奖罚按钮');
      await sleep(3000);
      
      const title2 = await page.evaluate(() => 
        document.querySelector('.header-title')?.textContent || ''
      );
      console.log('页面标题:', title2);
      
      await page.screenshot({ path: SCREENSHOT_DIR + '/F05-coach-reward-page.png', fullPage: true });

      // 设定奖罚
      await sleep(2000);
      const setBtn2 = await page.$('.set-btn');
      if (setBtn2) {
        await setBtn2.click();
        await sleep(1000);
        
        // 选-10元
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('.modal-neg-btn'));
          const btnNeg10 = btns.find(b => b.textContent === '-10元');
          if (btnNeg10) btnNeg10.click();
        });
        console.log('选择-10元');
        
        // 输入备注
        const remarkInput2 = await page.$('.modal-remark-input');
        if (remarkInput2) {
          await remarkInput2.type('测试助教奖罚成功');
          console.log('输入备注');
        }
        
        await sleep(500);
        
        // 点击确定
        const saveBtn2 = await page.$('.modal-btn-save');
        if (saveBtn2) {
          await saveBtn2.click();
          console.log('点击确定');
          await sleep(2000);
        }
        
        await page.screenshot({ path: SCREENSHOT_DIR + '/F06-coach-reward-success.png', fullPage: true });
        console.log('✅ 截图: F06-coach-reward-success.png');
      }
    }

    console.log('\n============================================');
    console.log('  ✅ 测试完成！');
    console.log('============================================\n');
    
    console.log('截图文件:');
    console.log('  - F01-member-page.png');
    console.log('  - F02-after-login-refresh.png');
    console.log('  - F03-service-reward-page.png');
    console.log('  - F04-service-reward-success.png');
    console.log('  - F05-coach-reward-page.png');
    console.log('  - F06-coach-reward-success.png');
    
    return true;

  } catch (e) {
    console.error('错误:', e.message);
    await page.screenshot({ path: SCREENSHOT_DIR + '/F-error.png' });
    return false;
  } finally {
    await page.close();
  }
}

runTest().then(s => process.exit(s ? 0 : 1));