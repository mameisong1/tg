/**
 * uni-automator v13 - console 监听调试
 * 
 * 监听 loginBySms 执行过程中的 console 输出
 */

const { Automator } = require('/TG/tgservice-uniapp/node_modules/@dcloudio/uni-automator');

async function test() {
  console.log('=== uni-automator v13 console 调试 ===');
  
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
      console.log('APP:', JSON.stringify(msg));
    });
    
    await program.switchTab('/pages/member/member');
    await new Promise(r => setTimeout(r, 5000));
    
    const page = await program.currentPage();
    console.log('当前页面:', page.path);
    
    await program.callUniMethod('clearStorageSync');
    await page.callMethod('setTestInput', '18600000004', '888888');
    await new Promise(r => setTimeout(r, 3000));
    
    // 使用 callMethod 调用 loginBySms
    console.log('\n=== 调用 loginBySms ===');
    try {
      const result = await page.callMethod('loginBySms');
      console.log('loginBySms 返回:', result);
    } catch(e) {
      console.log('loginBySms 失败:', e.message);
    }
    
    // 等待
    await new Promise(r => setTimeout(r, 15000));
    
    // 检查结果
    const memberToken = await program.callUniMethod('getStorageSync', 'memberToken');
    console.log('\nmemberToken:', memberToken);
    
    await program.teardown();
    console.log('测试完成');
    
  } catch (e) {
    console.error('测试失败:', e.message);
    if (program) {
      try { await program.teardown(); } catch(x) {}
    }
  }
}

test();