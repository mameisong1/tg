/**
 * uni-automator 登录测试脚本 v2
 * 使用 UniApp 官方自动化测试工具进行界面操作登录
 */

const { Automator } = require('/TG/tgservice-uniapp/node_modules/@dcloudio/uni-automator');

async function test() {
  console.log('=== uni-automator 登录测试 v2 ===');
  
  let program;
  try {
    const automator = new Automator();
    
    // 连接到已运行的 H5 开发服务器
    // 不需要自动编译，直接连接已有的服务
    program = await automator.launch({
      platform: 'h5',
      projectPath: '/TG/tgservice-uniapp',
      // 指定已有 H5 的 URL，避免重新编译
      h5: {
        url: 'http://127.0.0.1:8089'  // 测试环境地址
      }
    });
    
    console.log('应用已连接');
    
    // 导航到 member 登录页面
    await program.navigateTo('/pages/member/member');
    await program.currentPage().waitFor(3000);
    
    const page = await program.currentPage();
    console.log('当前页面:', page.path);
    
    // 清空 Storage
    await program.callUniMethod('removeStorageSync', 'memberToken');
    await program.callUniMethod('removeStorageSync', 'memberInfo');
    await program.callUniMethod('removeStorageSync', 'coachToken');
    await program.callUniMethod('removeStorageSync', 'coachInfo');
    
    // 查找手机号输入框
    const phoneInput = await page.$('input[type="number"]');
    if (phoneInput) {
      console.log('找到手机号输入框，输入手机号...');
      // 使用 uni-automator 的 input.input() 方法！
      // 这是专门处理 UniApp v-model 的方法
      await phoneInput.input('18600000004');
      
      // 验证值
      const phoneValue = await phoneInput.value();
      console.log('手机号值:', phoneValue);
    } else {
      console.log('未找到手机号输入框');
      // 查看页面上所有元素
      const inputs = await page.$$('input');
      console.log('所有 input 元素数量:', inputs.length);
      for (const inp of inputs) {
        const tag = await inp.attribute('type');
        console.log('  input type:', tag);
      }
    }
    
    // 查找验证码输入框
    const codeInputs = await page.$$('input');
    if (codeInputs.length > 1) {
      console.log('输入验证码...');
      await codeInputs[1].input('888888');
      const codeValue = await codeInputs[1].value();
      console.log('验证码值:', codeValue);
    }
    
    // 勾选协议
    const agreement = await page.$('.h5-agreement .agreement-text');
    if (agreement) {
      console.log('点击协议勾选');
      await agreement.tap();
      await page.waitFor(500);
    }
    
    // 检查协议状态
    const checkbox = await page.$('.h5-agreement .checkbox');
    if (checkbox) {
      const checked = await checkbox.attribute('class');
      console.log('协议勾选状态:', checked);
    }
    
    // 点击登录按钮
    const loginBtn = await page.$('.h5-login-btn');
    if (loginBtn) {
      console.log('点击登录按钮');
      await loginBtn.tap();
      await page.waitFor(5000);
    } else {
      console.log('未找到登录按钮');
    }
    
    // 检查登录结果
    const memberToken = await program.callUniMethod('getStorageSync', 'memberToken');
    const memberInfo = await program.callUniMethod('getStorageSync', 'memberInfo');
    console.log('memberToken:', memberToken);
    console.log('memberInfo:', memberInfo);
    
    // 检查页面变化
    const currentPage = await program.currentPage();
    console.log('登录后页面:', currentPage.path);
    
    await program.teardown();
    console.log('测试完成');
    
  } catch (e) {
    console.error('测试失败:', e.message);
    console.error('详细:', e.stack);
    if (program) {
      try { await program.teardown(); } catch(x) {}
    }
  }
}

test();