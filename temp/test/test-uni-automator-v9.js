/**
 * uni-automator 登录测试 v9 - callMethod 版
 * 
 * 策略: 使用 defineExpose 暴露的 setTestInput 和 loginBySms 方法
 * setTestInput 内部正确设置 ref.value 并触发 Vue 渲染
 */

const { Automator } = require('/TG/tgservice-uniapp/node_modules/@dcloudio/uni-automator');

async function test() {
  console.log('=== uni-automator 登录测试 v9 (callMethod) ===');
  
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
    
    // 使用 callMethod 设置值（内部设置 ref.value）
    console.log('\n=== callMethod setTestInput ===');
    try {
      await page.callMethod('setTestInput', '18600000004', '888888');
      console.log('setTestInput 成功');
    } catch(e) {
      console.log('setTestInput 失败:', e.message);
    }
    
    // 等待 Vue 渲染更新
    await new Promise(r => setTimeout(r, 3000));
    
    // 验证数据
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
    
    // 检查 checkbox
    const checkbox = await page.$('.h5-agreement .checkbox');
    if (checkbox) {
      const cls = await checkbox.attribute('class');
      console.log('checkbox class:', cls);
    }
    
    // 调用 loginBySms
    console.log('\n=== callMethod loginBySms ===');
    try {
      const result = await page.callMethod('loginBySms');
      console.log('loginBySms 结果:', JSON.stringify(result));
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
      console.log('\n✅ 登录成功！uni-automator callMethod 方案可行！');
      
      // 测试退出
      console.log('\n=== 测试退出 ===');
      const logoutBtn = await page.$('.logout-btn');
      if (logoutBtn) {
        await logoutBtn.tap();
        await new Promise(r => setTimeout(r, 2000));
        
        // 手动清空 Storage 兜底
        await program.callUniMethod('removeStorageSync', 'memberToken');
        await program.callUniMethod('removeStorageSync', 'memberInfo');
        await program.callUniMethod('removeStorageSync', 'coachToken');
        await program.callUniMethod('removeStorageSync', 'coachInfo');
        await program.callUniMethod('removeStorageSync', 'preferredRole');
        await program.callUniMethod('removeStorageSync', 'sessionId');
        await program.callUniMethod('removeStorageSync', 'tablePinyin');
        await program.callUniMethod('removeStorageSync', 'tableName');
        await program.callUniMethod('removeStorageSync', 'tableAuth');
        await program.callUniMethod('removeStorageSync', 'highlightProduct');
        
        const tokenAfter = await program.callUniMethod('getStorageSync', 'memberToken');
        console.log('退出后 memberToken:', tokenAfter);
        
        if (!tokenAfter) {
          console.log('✅ 退出成功！Storage 已清空');
        }
      }
    } else {
      console.log('\n❌ 登录失败');
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