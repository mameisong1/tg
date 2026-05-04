/**
 * uni-automator 登录测试脚本 v3
 * 使用 UniApp 官方自动化测试工具，连接已运行的 H5 应用
 */

const { Automator } = require('/TG/tgservice-uniapp/node_modules/@dcloudio/uni-automator');

async function test() {
  console.log('=== uni-automator 登录测试 v3 ===');
  
  let program;
  try {
    const automator = new Automator();
    
    // 启动 H5 应用（自动编译 + 自动打开浏览器）
    program = await automator.launch({
      platform: 'h5',
      projectPath: '/TG/tgservice-uniapp',
      port: 9520, // uni-automator WebSocket 端口
    });
    
    console.log('应用已启动');
    
    // 导航到 member 登录页面
    console.log('导航到 member 页面...');
    await program.switchTab('/pages/member/member');
    await new Promise(r => setTimeout(r, 3000));
    
    const page = await program.currentPage();
    console.log('当前页面:', page.path);
    
    // 清空 Storage
    await program.callUniMethod('clearStorageSync');
    console.log('Storage 已清空');
    
    // 查找输入框
    console.log('\n查找输入框...');
    const inputs = await page.$$('input');
    console.log('找到 input 元素:', inputs.length);
    
    for (let i = 0; i < inputs.length; i++) {
      const type = await inputs[i].attribute('type');
      const placeholder = await inputs[i].attribute('placeholder');
      const cls = await inputs[i].attribute('class');
      console.log(`  input[${i}]: type=${type}, placeholder=${placeholder}, class=${cls}`);
    }
    
    // 输入手机号（第一个 number 类型 input）
    if (inputs.length >= 2) {
      console.log('\n输入手机号...');
      await inputs[0].input('18600000004');
      const phoneValue = await inputs[0].value();
      console.log('手机号值:', phoneValue);
      
      // 输入验证码
      console.log('输入验证码...');
      await inputs[1].input('888888');
      const codeValue = await inputs[1].value();
      console.log('验证码值:', codeValue);
    }
    
    // 勾选协议
    const agreement = await page.$('.agreement-text');
    if (agreement) {
      console.log('点击协议');
      await agreement.tap();
      await page.waitFor(500);
    }
    
    // 点击登录按钮
    const loginBtn = await page.$('.h5-login-btn');
    if (loginBtn) {
      console.log('点击登录按钮');
      await loginBtn.tap();
      await page.waitFor(5000);
    }
    
    // 检查登录结果
    const memberToken = await program.callUniMethod('getStorageSync', 'memberToken');
    const memberInfo = await program.callUniMethod('getStorageSync', 'memberInfo');
    console.log('\n=== 登录结果 ===');
    console.log('memberToken:', memberToken);
    console.log('memberInfo:', memberInfo ? JSON.stringify(memberInfo) : null);
    
    const currentPage = await program.currentPage();
    console.log('登录后页面:', currentPage.path);
    
    if (memberToken) {
      console.log('\n✅ 登录成功！uni-automator 能正确触发 v-model！');
    } else {
      console.log('\n❌ 登录失败，需要进一步调试');
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