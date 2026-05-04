/**
 * uni-automator 登录测试 v11 - mock API + callMethod
 * 
 * 问题分析: loginBySms 调用 uni.showLoading/hideLoading/showToast/reLaunch
 * 这些 API 在 Playwright 环境中可能行为异常
 * 
 * 策略: mock showToast/showLoading/hideLoading，让 loginBySms 顺利执行
 */

const { Automator } = require('/TG/tgservice-uniapp/node_modules/@dcloudio/uni-automator');

async function test() {
  console.log('=== uni-automator 登录测试 v11 ===');
  
  let program;
  try {
    const automator = new Automator();
    program = await automator.launch({
      platform: 'h5',
      projectPath: '/TG/tgservice-uniapp',
      port: 9520,
    });
    
    console.log('应用已启动');
    
    // mock uni API
    await program.mockUniMethod('showToast', { errMsg: 'showToast:ok' });
    await program.mockUniMethod('showLoading', { errMsg: 'showLoading:ok' });
    await program.mockUniMethod('hideLoading', { errMsg: 'hideLoading:ok' });
    await program.mockUniMethod('reLaunch', { errMsg: 'reLaunch:ok' });
    console.log('mock API 完成');
    
    await program.switchTab('/pages/member/member');
    await new Promise(r => setTimeout(r, 5000));
    
    const page = await program.currentPage();
    console.log('当前页面:', page.path);
    
    // 清空 Storage
    await program.callUniMethod('clearStorageSync');
    
    // 设置值
    await page.callMethod('setTestInput', '18600000004', '888888');
    console.log('setTestInput 完成');
    await new Promise(r => setTimeout(r, 3000));
    
    // 验证
    const data = await page.data();
    console.log('smsPhone:', typeof data.smsPhone === 'object' ? data.smsPhone._value : data.smsPhone);
    
    // 使用 callMethod 调用 loginBySms
    console.log('\n=== callMethod loginBySms ===');
    try {
      const result = await page.callMethodWithCallback('loginBySms');
      console.log('loginBySms 结果:', JSON.stringify(result));
    } catch(e) {
      console.log('callMethodWithCallback 失败:', e.message);
    }
    
    // 等待
    await new Promise(r => setTimeout(r, 10000));
    
    // 检查结果
    const memberToken = await program.callUniMethod('getStorageSync', 'memberToken');
    const memberInfo = await program.callUniMethod('getStorageSync', 'memberInfo');
    console.log('\n=== 登录结果 ===');
    console.log('memberToken:', memberToken);
    console.log('memberInfo:', memberInfo ? JSON.stringify(memberInfo) : null);
    
    if (memberToken) {
      console.log('\n✅✅✅ 登录成功！');
    } else {
      console.log('\n❌ 登录失败，尝试界面操作');
      
      // 清空 Storage 重新测试
      await program.callUniMethod('clearStorageSync');
      await page.callMethod('setTestInput', '18600000004', '888888');
      await new Promise(r => setTimeout(r, 3000));
      
      // 界面操作: 点击登录按钮
      const loginBtn = await page.$('.h5-login-btn');
      if (loginBtn) {
        await loginBtn.tap();
        console.log('登录按钮已点击');
      }
      
      await new Promise(r => setTimeout(r, 10000));
      
      const memberToken2 = await program.callUniMethod('getStorageSync', 'memberToken');
      console.log('界面操作 memberToken:', memberToken2);
    }
    
    await program.teardown();
    console.log('\n测试完成');
    
  } catch (e) {
    console.error('测试失败:', e.message);
    console.error(e.stack);
    if (program) {
      try { await program.teardown(); } catch(x) {}
    }
  }
}

test();