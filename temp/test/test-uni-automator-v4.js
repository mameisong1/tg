/**
 * uni-automator 登录测试脚本 v4
 * 尝试多种方式设置 Vue 响应式数据
 */

const { Automator } = require('/TG/tgservice-uniapp/node_modules/@dcloudio/uni-automator');

async function test() {
  console.log('=== uni-automator 登录测试 v4 ===');
  
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
    console.log('Storage 已清空');
    
    // 方式1: 使用 page.setData() 直接设置 Vue 响应式数据
    console.log('\n=== 方式1: page.setData() ===');
    try {
      await page.setData({
        smsPhone: '18600000004',
        smsCode: '888888',
        agreed: true
      });
      console.log('setData 成功');
      
      // 验证
      const data = await page.data();
      console.log('页面数据 smsPhone:', data.smsPhone);
      console.log('页面数据 smsCode:', data.smsCode);
      console.log('页面数据 agreed:', data.agreed);
    } catch(e) {
      console.log('setData 失败:', e.message);
    }
    
    // 方式2: 使用 page.callMethod() 调用 Vue 方法
    console.log('\n=== 方式2: page.callMethod() ===');
    try {
      // 检查页面上有什么方法
      const data = await page.data();
      console.log('页面 data keys:', Object.keys(data || {}));
    } catch(e) {
      console.log('获取 data 失败:', e.message);
    }
    
    // 方式3: 用 uni-automator 的 input 方法，找到原生 input
    console.log('\n=== 方式3: 找内部原生 input ===');
    const nativeInputs = await page.$$('.h5-form-input input');
    console.log('原生 input 数量:', nativeInputs.length);
    
    for (let i = 0; i < nativeInputs.length; i++) {
      const type = await nativeInputs[i].attribute('type');
      const placeholder = await nativeInputs[i].attribute('placeholder');
      console.log(`  native input[${i}]: type=${type}, placeholder=${placeholder}`);
      
      if (i === 0) {
        console.log('  输入手机号...');
        await nativeInputs[i].input('18600000004');
        const val = await nativeInputs[i].value();
        console.log('  手机号值:', val);
      }
      if (i === 1) {
        console.log('  输入验证码...');
        await nativeInputs[i].input('888888');
        const val = await nativeInputs[i].value();
        console.log('  验证码值:', val);
      }
    }
    
    // 勾选协议 + 点击登录
    const agreement = await page.$('.agreement-text');
    if (agreement) {
      await agreement.tap();
      await new Promise(r => setTimeout(r, 500));
    }
    
    const loginBtn = await page.$('.h5-login-btn');
    if (loginBtn) {
      console.log('点击登录按钮');
      await loginBtn.tap();
      await new Promise(r => setTimeout(r, 8000));
    }
    
    // 检查结果
    const memberToken = await program.callUniMethod('getStorageSync', 'memberToken');
    const memberInfo = await program.callUniMethod('getStorageSync', 'memberInfo');
    console.log('\n=== 登录结果 ===');
    console.log('memberToken:', memberToken);
    console.log('memberInfo:', memberInfo ? JSON.stringify(memberInfo) : null);
    
    if (memberToken) {
      console.log('\n✅ 登录成功！');
    } else {
      console.log('\n❌ 登录失败');
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