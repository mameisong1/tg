/**
 * uni-automator 登录测试 v10 - setTestInput + 界面操作
 * 
 * 策略: callMethod('setTestInput') 设置 Vue ref + tap() 点击登录按钮
 * 
 * v9 已证明: setTestInput 能正确设置 smsPhone/smsCode/agreed 的 ref.value
 * uni-input modelValue 和 checkbox 状态都正确更新了
 * 
 * 现在需要: 通过界面点击登录按钮触发 loginBySms
 */

const { Automator } = require('/TG/tgservice-uniapp/node_modules/@dcloudio/uni-automator');

async function test() {
  console.log('=== uni-automator 登录测试 v10 ===');
  
  let program;
  try {
    const automator = new Automator();
    program = await automator.launch({
      platform: 'h5',
      projectPath: '/TG/tgservice-uniapp',
      port: 9520,
    });
    
    console.log('应用已启动');
    
    await program.switchTab('/pages/member/member');
    await new Promise(r => setTimeout(r, 5000));
    
    const page = await program.currentPage();
    console.log('当前页面:', page.path);
    
    // 清空 Storage
    await program.callUniMethod('clearStorageSync');
    
    // 设置 Vue ref 值
    await page.callMethod('setTestInput', '18600000004', '888888');
    console.log('setTestInput 完成');
    
    await new Promise(r => setTimeout(r, 3000));
    
    // 验证
    const data = await page.data();
    console.log('smsPhone:', typeof data.smsPhone === 'object' ? data.smsPhone._value : data.smsPhone);
    console.log('smsCode:', typeof data.smsCode === 'object' ? data.smsCode._value : data.smsCode);
    
    // 检查 uni-input 和 checkbox
    const uniInputs = await page.$$('.h5-form-input');
    for (let i = 0; i < uniInputs.length; i++) {
      const mv = await uniInputs[i].property('modelValue');
      console.log(`uni-input[${i}] modelValue:`, mv);
    }
    
    const checkbox = await page.$('.h5-agreement .checkbox');
    if (checkbox) {
      const cls = await checkbox.attribute('class');
      console.log('checkbox:', cls);
    }
    
    // 界面操作: 点击登录按钮
    console.log('\n=== 界面操作: 点击登录按钮 ===');
    const loginBtn = await page.$('.h5-login-btn');
    if (loginBtn) {
      await loginBtn.tap();
      console.log('登录按钮已点击');
    } else {
      console.log('找不到登录按钮');
    }
    
    // 等待登录请求和响应
    await new Promise(r => setTimeout(r, 10000));
    
    // 检查登录结果
    const memberToken = await program.callUniMethod('getStorageSync', 'memberToken');
    const memberInfo = await program.callUniMethod('getStorageSync', 'memberInfo');
    console.log('\n=== 登录结果 ===');
    console.log('memberToken:', memberToken);
    console.log('memberInfo:', memberInfo ? JSON.stringify(memberInfo) : null);
    
    if (memberToken) {
      console.log('\n✅✅✅ 登录成功！！！uni-automator + setTestInput + 界面操作方案可行！');
    } else {
      console.log('\n❌ 登录失败');
      
      // 尝试 mock uni.showToast 避免 mock API 冲突
      console.log('\n=== 尝试 mock showToast ===');
      await program.mockUniMethod('showToast', { errMsg: 'showToast:ok' });
      await program.mockUniMethod('showLoading', { errMsg: 'showLoading:ok' });
      await program.mockUniMethod('hideLoading', { errMsg: 'hideLoading:ok' });
      
      // 清空 Storage 重新登录
      await program.callUniMethod('clearStorageSync');
      await page.callMethod('setTestInput', '18600000004', '888888');
      await new Promise(r => setTimeout(r, 2000));
      
      const loginBtn2 = await page.$('.h5-login-btn');
      if (loginBtn2) {
        await loginBtn2.tap();
        console.log('第二次点击登录按钮');
      }
      
      await new Promise(r => setTimeout(r, 10000));
      
      const memberToken2 = await program.callUniMethod('getStorageSync', 'memberToken');
      console.log('第二次 memberToken:', memberToken2);
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