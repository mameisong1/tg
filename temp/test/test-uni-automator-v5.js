/**
 * uni-automator 登录测试 v5 - setData + 界面操作
 * 
 * 关键发现: page.setData() 能设置 Vue 响应式数据
 * 但需要确保 UI 同步更新（原生 input 显示值同步）
 */

const { Automator } = require('/TG/tgservice-uniapp/node_modules/@dcloudio/uni-automator');

async function test() {
  console.log('=== uni-automator 登录测试 v5 ===');
  
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
    
    // 用 setData 设置 Vue 响应式数据
    await page.setData({
      smsPhone: '18600000004',
      smsCode: '888888',
      agreed: true
    });
    console.log('setData 完成');
    
    // 验证 setData 是否生效
    const data = await page.data();
    console.log('smsPhone:', data.smsPhone);
    console.log('smsCode:', data.smsCode);
    console.log('agreed:', data.agreed);
    
    // 检查协议勾选是否在 UI 上生效
    const checkbox = await page.$('.h5-agreement .checkbox');
    if (checkbox) {
      const cls = await checkbox.attribute('class');
      console.log('checkbox class:', cls);
    }
    
    // 等待 Vue 渲染更新
    await new Promise(r => setTimeout(r, 2000));
    
    // 检查 input 显示值
    const uniInputs = await page.$$('.h5-form-input');
    console.log('uni-input 数量:', uniInputs.length);
    
    for (let i = 0; i < uniInputs.length; i++) {
      // uni-input 是 Vue 组件，检查其 modelValue
      const modelValue = await uniInputs[i].property('modelValue');
      console.log(`uni-input[${i}] modelValue:`, modelValue);
    }
    
    // 使用 callMethod 直接调用 doSmsLogin
    console.log('\n=== 直接调用 doSmsLogin ===');
    try {
      const result = await page.callMethod('doSmsLogin');
      console.log('doSmsLogin 返回:', result);
    } catch(e) {
      console.log('doSmsLogin 失败:', e.message);
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
      // 检查后端日志
      console.log('检查后端是否有 login-sms 请求...');
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