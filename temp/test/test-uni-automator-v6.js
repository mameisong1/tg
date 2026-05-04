/**
 * uni-automator 登录测试 v6
 * 
 * 策略: page.setData() 设置 Vue 数据 + evaluate 同步 UI 显示 + tap 点击按钮
 * 
 * 问题: setData 设置了 smsPhone.value 但 uni-input 的 modelValue 未更新
 * 解决: 通过 evaluate 在浏览器中手动同步原生 input 的值
 */

const { Automator } = require('/TG/tgservice-uniapp/node_modules/@dcloudio/uni-automator');

async function test() {
  console.log('=== uni-automator 登录测试 v6 ===');
  
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
    
    // 方法1: setData 设置 Vue 数据
    await page.setData({
      smsPhone: '18600000004',
      smsCode: '888888',
      agreed: true
    });
    console.log('setData 完成');
    
    // 检查 setData 结果
    const data = await page.data();
    console.log('smsPhone:', data.smsPhone, 'smsCode:', data.smsCode, 'agreed:', data.agreed);
    
    // 方法2: evaluate 同步 UI 显示值
    // setData 设置了 Vue ref 的值，但 uni-input 组件可能没有触发 DOM 更新
    // 我们需要用 evaluate 直接在浏览器中同步 input 的显示值
    console.log('\n同步 UI 显示...');
    await program.evaluate((phone, code) => {
      // 同步原生 input 的显示值
      const inputs = document.querySelectorAll('.h5-form-input input');
      if (inputs[0]) inputs[0].value = phone;
      if (inputs[1]) inputs[1].value = code;
      
      // 勾选协议（如果未勾选）
      const checkbox = document.querySelector('.h5-agreement .checkbox');
      if (checkbox && !checkbox.classList.contains('checked')) {
        document.querySelector('.h5-agreement .agreement-text')?.click();
      }
    }, '18600000004', '888888');
    
    await new Promise(r => setTimeout(r, 2000));
    
    // 检查 UI 状态
    const uiState = await program.evaluate(() => ({
      phoneInputValue: document.querySelectorAll('.h5-form-input input')[0]?.value,
      codeInputValue: document.querySelectorAll('.h5-form-input input')[1]?.value,
      checkboxClass: document.querySelector('.h5-agreement .checkbox')?.className,
      loginBtnExists: !!document.querySelector('.h5-login-btn')
    }));
    console.log('UI 状态:', JSON.stringify(uiState));
    
    // 点击登录按钮
    console.log('\n点击登录按钮...');
    const loginBtn = await page.$('.h5-login-btn');
    if (loginBtn) {
      await loginBtn.tap();
    } else {
      // fallback: evaluate 点击
      await program.evaluate(() => {
        document.querySelector('.h5-login-btn')?.click();
      });
    }
    
    await new Promise(r => setTimeout(r, 8000));
    
    // 检查登录结果
    const memberToken = await program.callUniMethod('getStorageSync', 'memberToken');
    const memberInfo = await program.callUniMethod('getStorageSync', 'memberInfo');
    console.log('\n=== 登录结果 ===');
    console.log('memberToken:', memberToken);
    console.log('memberInfo:', memberInfo ? JSON.stringify(memberInfo) : null);
    
    if (memberToken) {
      console.log('\n✅ 登录成功！uni-automator + setData + evaluate 方案可行！');
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