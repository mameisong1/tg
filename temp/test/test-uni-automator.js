/**
 * uni-automator 测试脚本
 * 使用 UniApp 官方自动化测试工具进行登录测试
 * 
 * 优势：uni-automator 直接操作 UniApp 组件层，
 *       内置 input.input() 方法能正确触发 Vue v-model 响应式更新
 */

const { Automator } = require('/TG/tgservice-uniapp/node_modules/@dcloudio/uni-automator');

async function test() {
  console.log('=== uni-automator 登录测试 ===');
  
  try {
    // 方式1: 连接已运行的 H5 应用（通过 WebSocket）
    // 需要在项目启动时加上 --auto-port 参数
    
    // 方式2: 自动编译并启动 H5 应用
    // 这需要 HBuilderX CLI 或 uni cli
    
    // 先尝试连接方式
    console.log('尝试自动启动 H5 应用...');
    
    const automator = new Automator();
    const program = await automator.launch({
      platform: 'h5',
      projectPath: '/TG/tgservice-uniapp',
      // 不指定 cliPath，让它自动查找
    });
    
    console.log('应用已启动');
    
    // 获取当前页面
    const page = await program.currentPage();
    console.log('当前页面:', page.path);
    
    // 导航到 member 页面
    await page.callMethod('navigateTo', '/pages/member/member');
    await page.waitFor(2000);
    
    const memberPage = await program.currentPage();
    console.log('member 页面:', memberPage.path);
    
    // 使用 uni-automator 的 $() 方法选择元素
    const phoneInput = await memberPage.$('.h5-form-input input');
    console.log('找到手机号输入框:', phoneInput ? 'yes' : 'no');
    
    if (phoneInput) {
      // 使用 uni-automator 的 input.input() 方法！
      // 这是专门处理 UniApp v-model 的方法
      console.log('输入手机号...');
      await phoneInput.input('18600000004');
      
      // 验证输入是否生效
      const value = await phoneInput.value();
      console.log('手机号输入值:', value);
    }
    
    // 关闭
    await program.close();
    console.log('测试完成');
    
  } catch (e) {
    console.error('测试失败:', e.message);
    console.error('详细:', e.stack);
  }
}

test();