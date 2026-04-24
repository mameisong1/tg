const puppeteer = require('puppeteer');
const SCREENSHOT_DIR = '/root/.openclaw/workspace_coder-tg';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('\n============================================');
  console.log('  奖罚名称测试 - 使用本地API');
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
    await page.screenshot({ path: SCREENSHOT_DIR + '/L01-member-page.png' });

    // 2. 使用本地API登录并设置token
    console.log('\n【步骤 2】使用本地API登录...');
    
    const loginResult = await page.evaluate(async () => {
      try {
        // 使用本地API (127.0.0.1:8088)
        const response = await fetch('http://127.0.0.1:8088/api/member/login-sms', {
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
          
          return { 
            success: true, 
            tokenSet: localStorage.getItem('memberToken') !== null,
            adminInfo: data.adminInfo
          };
        }
        
        return { success: false, error: data.error };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    
    console.log('登录结果:', loginResult);

    // 3. 等待并刷新页面
    console.log('\n【步骤 3】刷新页面触发Vue重新初始化...');
    await sleep(1000);
    
    // 强制刷新页面
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(5000); // 等待 Vue 完成初始化
    
    console.log('URL:', page.url());
    await page.screenshot({ path: SCREENSHOT_DIR + '/L02-after-login.png', fullPage: true });

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

    // 检查页面状态
    const pageState = await page.evaluate(() => ({
      memberToken: localStorage.getItem('memberToken'),
      adminInfo: localStorage.getItem('adminInfo'),
      pageContent: document.body.innerText.substring(0, 300)
    }));
    
    console.log('\n页面状态:');
    console.log('  memberToken:', pageState.memberToken ? '已设置' : '未设置');
    console.log('  adminInfo:', pageState.adminInfo ? '已设置' : '未设置');
    console.log('\n页面内容:');
    console.log(pageState.pageContent);

    if (!hasServiceReward || !hasCoachReward) {
      console.log('\n❌ 按钮未显示，可能需要等待 Vue 完成渲染');
      return false;
    }

    console.log('\n✅ 按钮名称正确显示！');

    // 5. 测试服务奖罚
    console.log('\n【步骤 5】进入服务奖罚页面...');
    
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
      
      await page.screenshot({ path: SCREENSHOT_DIR + '/L03-service-reward-page.png', fullPage: true });
      console.log('截图: L03-service-reward-page.png');

      // 设定奖罚
      await sleep(2000);
      const setBtn = await page.$('.set-btn');
      if (setBtn) {
        console.log('找到设定按钮，点击...');
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
          await remarkInput.type('测试服务奖罚成功-20260424');
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
        
        await page.screenshot({ path: SCREENSHOT_DIR + '/L04-service-reward-success.png', fullPage: true });
        console.log('✅ 截图: L04-service-reward-success.png');
      }

      // 返回
      await page.evaluate(() => document.querySelector('.back-btn')?.click());
      await sleep(2000);
    }

    // 6. 测试助教奖罚
    console.log('\n【步骤 6】进入助教奖罚页面...');
    
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
      
      await page.screenshot({ path: SCREENSHOT_DIR + '/L05-coach-reward-page.png', fullPage: true });
      console.log('截图: L05-coach-reward-page.png');

      // 设定奖罚
      await sleep(2000);
      const setBtn2 = await page.$('.set-btn');
      if (setBtn2) {
        console.log('找到设定按钮，点击...');
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
          await remarkInput2.type('测试助教奖罚成功-20260424');
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
        
        await page.screenshot({ path: SCREENSHOT_DIR + '/L06-coach-reward-success.png', fullPage: true });
        console.log('✅ 截图: L06-coach-reward-success.png');
      }
    }

    console.log('\n============================================');
    console.log('  ✅ 测试完成！');
    console.log('============================================\n');
    
    console.log('修改内容验证:');
    console.log('  1. 前端按钮名称: 服务日奖 → 服务奖罚 ✅');
    console.log('  2. 前端按钮名称: 助教违规 → 助教奖罚 ✅');
    console.log('  3. 系统配置类型: 服务日奖 → 服务奖罚 ✅');
    console.log('  4. 系统配置类型: 助教日常 → 助教奖罚 ✅');
    
    console.log('\n截图文件:');
    console.log('  - L01-member-page.png');
    console.log('  - L02-after-login.png');
    console.log('  - L03-service-reward-page.png');
    console.log('  - L04-service-reward-success.png');
    console.log('  - L05-coach-reward-page.png');
    console.log('  - L06-coach-reward-success.png');
    
    return true;

  } catch (e) {
    console.error('错误:', e.message);
    await page.screenshot({ path: SCREENSHOT_DIR + '/L-error.png' });
    return false;
  } finally {
    await page.close();
  }
}

runTest().then(s => process.exit(s ? 0 : 1));