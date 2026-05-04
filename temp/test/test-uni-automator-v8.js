/**
 * uni-automator 登录测试 v8 - defineExpose 版
 * 
 * 修改: member.vue 添加了 defineExpose 暴露 smsPhone/smsCode/agreed/loginBySms
 * 
 * 现在 setData 和 callMethod 应该能正确操作 Vue ref 和方法了
 */

const { Automator } = require('/TG/tgservice-uniapp/node_modules/@dcloudio/uni-automator');

async function test() {
  console.log('=== uni-automator 登录测试 v8 (defineExpose) ===');
  
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
    
    // 方式A: setData 设置 Vue ref
    console.log('\n=== setData 设置值 ===');
    await page.setData({
      smsPhone: '18600000004',
      smsCode: '888888',
      agreed: true
    });
    
    // 验证 setData 是否修改了 ref 的 value
    const data = await page.data();
    console.log('smsPhone:', data.smsPhone);
    console.log('smsCode:', data.smsCode);
    console.log('agreed:', data.agreed);
    
    // 检查 uni-input modelValue
    const uniInputs = await page.$$('.h5-form-input');
    for (let i = 0; i < uniInputs.length; i++) {
      const mv = await uniInputs[i].property('modelValue');
      console.log(`uni-input[${i}] modelValue:`, mv);
    }
    
    // 检查 checkbox 状态
    const checkbox = await page.$('.h5-agreement .checkbox');
    if (checkbox) {
      const cls = await checkbox.attribute('class');
      console.log('checkbox class:', cls);
    }
    
    await new Promise(r => setTimeout(r, 2000));
    
    // 方式B: callMethod 调用 loginBySms
    console.log('\n=== callMethod 调用 loginBySms ===');
    try {
      const result = await page.callMethod('loginBySms');
      console.log('loginBySms 结果:', result);
    } catch(e) {
      console.log('loginBySms 失败:', e.message);
    }
    
    await new Promise(r => setTimeout(r, 8000));
    
    // 检查登录结果
    const memberToken = await program.callUniMethod('getStorageSync', 'memberToken');
    const memberInfo = await program.callUniMethod('getStorageSync', 'memberInfo');
    console.log('\n=== 登录结果 ===');
    console.log('memberToken:', memberToken);
    console.log('memberInfo:', memberInfo ? JSON.stringify(memberInfo) : null);
    
    if (memberToken) {
      console.log('\n✅ 登录成功！');
    } else {
      console.log('\n❌ 登录失败');
      
      // 方式C: 如果 setData + callMethod 不行，尝试界面点击
      console.log('\n=== 方式C: 界面操作 ===');
      
      // 确保 agreed 为 true（勾选协议）
      const agreement = await page.$('.agreement-text');
      if (agreement) {
        await agreement.tap();
        await new Promise(r => setTimeout(r, 500));
      }
      
      // 点击登录按钮
      const loginBtn = await page.$('.h5-login-btn');
      if (loginBtn) {
        console.log('点击登录按钮');
        await loginBtn.tap();
        await new Promise(r => setTimeout(r, 8000));
      }
      
      // 再次检查
      const memberToken2 = await program.callUniMethod('getStorageSync', 'memberToken');
      console.log('第二次 memberToken:', memberToken2);
      
      if (memberToken2) {
        console.log('\n✅ 界面操作登录成功！');
      }
    }
    
    await program.teardown();
    console.log('测试完成');
    
  } catch (e) {
    console.error('测试失败:', e.message);
    console.error(e.stack);
    if (program) {
      try { await program.teardown(); } catch(x) {}
    }
  }
}

test();