const puppeteer = require('/usr/lib/node_modules/puppeteer-core');

(async () => {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222'
  });

  let pages = await browser.pages();
  const page = pages[0];
  await page.setViewport({ width: 375, height: 812 });

  try {
    console.log('\n=== 浏览器测试（直接调用API）===');

    // Step 1: 打开页面并清空localStorage
    console.log('\nStep 1: 准备环境...');
    await page.goto('http://127.0.0.1:8089/#/pages/member/member', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    await new Promise(r => setTimeout(r, 2000));
    
    // 清空localStorage
    await page.evaluate(() => localStorage.clear());
    console.log('  localStorage已清空');
    
    await page.screenshot({ path: '/TG/temp/QA-20260416-02/screenshots/01-before-login.png' });

    // Step 2: 直接通过JavaScript调用API登录
    console.log('\nStep 2: 调用API登录...');
    
    const loginResult = await page.evaluate(async () => {
      try {
        // 直接调用API
        const response = await fetch('http://127.0.0.1:8088/api/member/login-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '18680174119', code: '888888' })
        });
        
        const data = await response.json();
        console.log('API响应:', JSON.stringify(data));
        
        if (data.success) {
          // 保存到localStorage
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
            const coachToken = btoa(`${data.coachInfo.coachNo}:${Date.now()}`);
            localStorage.setItem('coachToken', coachToken);
            localStorage.setItem('coachInfo', JSON.stringify(data.coachInfo));
          }
          
          return { 
            success: true, 
            coachInfo: data.coachInfo,
            hasPhone: data.coachInfo?.phone ? true : false
          };
        } else {
          return { success: false, error: data.error };
        }
      } catch (err) {
        return { success: false, error: err.message };
      }
    });
    
    console.log('  登录结果:', JSON.stringify(loginResult, null, 2));

    // Step 3: 验证localStorage
    console.log('\nStep 3: 验证localStorage...');
    const storage = await page.evaluate(() => {
      const coachInfo = localStorage.getItem('coachInfo');
      return {
        memberToken: localStorage.getItem('memberToken'),
        adminToken: localStorage.getItem('adminToken'),
        coachToken: localStorage.getItem('coachToken'),
        coachInfo: coachInfo,
        coachInfoParsed: coachInfo ? JSON.parse(coachInfo) : null
      };
    });
    
    console.log('  memberToken:', storage.memberToken ? '✅' : '❌');
    console.log('  adminToken:', storage.adminToken ? '✅' : '❌');
    console.log('  coachToken:', storage.coachToken ? '✅' : '❌');
    
    if (storage.coachInfoParsed) {
      console.log('\n  coachInfo详情:');
      console.log('    phone:', storage.coachInfoParsed.phone || '❌缺失');
      console.log('    employeeId:', storage.coachInfoParsed.employeeId || '❌缺失');
      console.log('    shift:', storage.coachInfoParsed.shift || '❌缺失');
      
      // 核心验证
      if (storage.coachInfoParsed.phone) {
        console.log('\n  ✅✅✅ 核心修复验证成功：phone字段存在！');
      } else {
        console.log('\n  ❌ 核心修复验证失败：phone字段缺失');
      }
    }
    
    // 刷新页面让Vue读取新的localStorage
    await page.goto('http://127.0.0.1:8089/#/pages/member/member', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    await new Promise(r => setTimeout(r, 2000));
    
    await page.screenshot({ path: '/TG/temp/QA-20260416-02/screenshots/02-after-login.png' });
    console.log('\n  截图: 02-after-login.png');

    // Step 4: 加班申请页面
    console.log('\nStep 4: 加班申请页面...');
    await page.goto('http://127.0.0.1:8089/#/pages/internal/overtime-apply', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    await new Promise(r => setTimeout(r, 2000));
    
    await page.screenshot({ path: '/TG/temp/QA-20260416-02/screenshots/03-overtime-apply.png' });
    console.log('  截图已保存');

    // Step 5: 检查页面是否有phone信息
    console.log('\nStep 5: 检查页面phone显示...');
    const pagePhoneInfo = await page.evaluate(() => {
      const coachInfo = JSON.parse(localStorage.getItem('coachInfo') || '{}');
      return {
        hasPhone: !!coachInfo.phone,
        phone: coachInfo.phone,
        canSubmit: !!coachInfo.phone || !!coachInfo.employeeId
      };
    });
    console.log('  页面phone信息:', JSON.stringify(pagePhoneInfo));

    // 填写表单
    const hourBtns = await page.$$('.hour-btn');
    if (hourBtns.length >= 2) {
      await hourBtns[1].click();
      console.log('  选择2小时');
    }
    await new Promise(r => setTimeout(r, 500));
    
    await page.screenshot({ path: '/TG/temp/QA-20260416-02/screenshots/04-form-filled.png' });
    console.log('  截图已保存');

    pages = await browser.pages();
    console.log('\n最终标签页数:', pages.length);
    
    console.log('\n✅ 测试完成');

  } catch (err) {
    console.error('\n❌ 错误:', err.message);
    await page.screenshot({ path: '/TG/temp/QA-20260416-02/screenshots/error.png' });
  } finally {
    browser.disconnect();
  }
})();