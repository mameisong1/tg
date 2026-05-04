/**
 * uni-automator v12 - 截图调试 + 界面操作
 */

const { Automator } = require('/TG/tgservice-uniapp/node_modules/@dcloudio/uni-automator');

async function test() {
  console.log('=== uni-automator v12 截图调试 ===');
  
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
    
    // 截图1: 初始状态
    await program.screenshot({ path: '/TG/temp/test/screenshot-01-initial.png' });
    console.log('截图1: 初始状态');
    
    // 设置值
    await program.callUniMethod('clearStorageSync');
    await page.callMethod('setTestInput', '18600000004', '888888');
    await new Promise(r => setTimeout(r, 3000));
    
    // 截图2: 输入后
    await program.screenshot({ path: '/TG/temp/test/screenshot-02-input.png' });
    console.log('截图2: 输入后');
    
    // 检查登录按钮
    const loginBtn = await page.$('.h5-login-btn');
    if (loginBtn) {
      console.log('找到登录按钮');
      const html = await loginBtn.outerHtml();
      console.log('登录按钮 HTML:', html);
      const offset = await loginBtn.offset();
      console.log('登录按钮位置:', JSON.stringify(offset));
      
      // 点击
      await loginBtn.tap();
      console.log('登录按钮已点击');
    } else {
      console.log('找不到登录按钮');
      // 查找所有按钮
      const allBtns = await page.$$('button');
      console.log('所有按钮数量:', allBtns.length);
      for (const btn of allBtns) {
        const text = await btn.text();
        console.log('按钮文本:', text);
      }
    }
    
    await new Promise(r => setTimeout(r, 5000));
    
    // 截图3: 登录后
    await program.screenshot({ path: '/TG/temp/test/screenshot-03-after-login.png' });
    console.log('截图3: 登录后');
    
    // 检查结果
    const memberToken = await program.callUniMethod('getStorageSync', 'memberToken');
    console.log('memberToken:', memberToken);
    
    // 检查后端日志（通过查看 loginBySms 的 console 输出）
    program.on('console', msg => {
      console.log('APP LOG:', JSON.stringify(msg));
    });
    
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