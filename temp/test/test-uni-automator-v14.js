/**
 * uni-automator 登录测试 v14 - CORS 修复后
 * 
 * 修复: 
 * 1. api.clearLoginStorage 加入 default export
 * 2. CORS 允许 localhost/172.16.110.0 的所有端口(8080-8109)
 */

const { Automator } = require('/TG/tgservice-uniapp/node_modules/@dcloudio/uni-automator');

async function test() {
  console.log('=== uni-automator 登录测试 v14 (CORS 修复) ===');
  
  let program;
  try {
    const automator = new Automator();
    program = await automator.launch({
      platform: 'h5',
      projectPath: '/TG/tgservice-uniapp',
      port: 9520,
    });
    
    // 监听 console
    program.on('console', msg => {
      if (msg.type === 'error') console.log('APP ERROR:', JSON.stringify(msg));
      else if (msg.args?.[0]?.includes?.('[QA]')) console.log('APP QA:', JSON.stringify(msg));
    });
    
    console.log('应用已启动');
    
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
    
    // 调用 loginBySms
    console.log('\n=== 调用 loginBySms ===');
    const result = await page.callMethod('loginBySms');
    console.log('loginBySms 返回:', result);
    
    // 等待登录完成
    await new Promise(r => setTimeout(r, 15000));
    
    // 检查结果
    const memberToken = await program.callUniMethod('getStorageSync', 'memberToken');
    const memberInfo = await program.callUniMethod('getStorageSync', 'memberInfo');
    const preferredRole = await program.callUniMethod('getStorageSync', 'preferredRole');
    console.log('\n=== 登录结果 ===');
    console.log('memberToken:', memberToken);
    console.log('memberInfo:', memberInfo ? JSON.stringify(memberInfo) : null);
    console.log('preferredRole:', preferredRole);
    
    if (memberToken) {
      console.log('\n✅✅✅ 登录成功！uni-automator 方案完全可行！');
      
      // 测试退出
      await program.callUniMethod('removeStorageSync', 'memberToken');
      await program.callUniMethod('removeStorageSync', 'memberInfo');
      await program.callUniMethod('removeStorageSync', 'preferredRole');
      await program.callUniMethod('removeStorageSync', 'coachToken');
      await program.callUniMethod('removeStorageSync', 'coachInfo');
      await program.callUniMethod('removeStorageSync', 'sessionId');
      await program.callUniMethod('removeStorageSync', 'tablePinyin');
      await program.callUniMethod('removeStorageSync', 'tableName');
      await program.callUniMethod('removeStorageSync', 'tableAuth');
      await program.callUniMethod('removeStorageSync', 'highlightProduct');
      
      const tokenAfter = await program.callUniMethod('getStorageSync', 'memberToken');
      console.log('退出后 memberToken:', tokenAfter || '(空)');
      if (!tokenAfter) console.log('✅ 退出成功！');
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