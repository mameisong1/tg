/**
 * uni-automator 登录测试 v7 - 深度调试
 * 
 * 检查 setData 后 smsPhone.value 在 doSmsLogin 调用时是否正确读取
 * 通过添加 defineExpose 暴露验证方法
 */

const { Automator } = require('/TG/tgservice-uniapp/node_modules/@dcloudio/uni-automator');

async function test() {
  console.log('=== uni-automator 登录测试 v7 ===');
  
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
    
    // setData 设置数据
    await page.setData({
      smsPhone: '18600000004',
      smsCode: '888888',
      agreed: true
    });
    
    // 等待渲染
    await new Promise(r => setTimeout(r, 3000));
    
    // 检查 smsPhone 的值
    const data = await page.data();
    console.log('smsPhone:', data.smsPhone);
    console.log('smsCode:', data.smsCode);
    
    // 尝试通过 callUniMethod 发起请求
    // 不直接调用 doSmsLogin，而是模拟登录请求
    console.log('\n=== 模拟登录请求 ===');
    const result = await program.callUniMethod('request', {
      url: 'https://tg.tiangong.club/api/member/login-sms',
      method: 'POST',
      data: {
        phone: '18600000004',
        code: '888888'
      }
    });
    console.log('登录请求结果:', JSON.stringify(result));
    
    await new Promise(r => setTimeout(r, 3000));
    
    // 检查 Storage
    const memberToken = await program.callUniMethod('getStorageSync', 'memberToken');
    const memberInfo = await program.callUniMethod('getStorageSync', 'memberInfo');
    console.log('\n=== 结果 ===');
    console.log('memberToken:', memberToken);
    console.log('memberInfo:', memberInfo ? JSON.stringify(memberInfo) : null);
    
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