/**
 * 登录手动流程追踪 V3 - 模拟真实用户操作流程
 * 1. 先发送验证码（模拟用户点"发送验证码"按钮）
 * 2. 然后输入验证码并登录
 * 3. 追踪每一步的 console 输出和 Storage 变化
 * 用法: node /TG/temp/test/login-trace3.js
 */

const { Automator } = require('/TG/tgservice-uniapp/node_modules/@dcloudio/uni-automator');

const TEST_PHONE = '18600000004';
const TEST_CODE = '888888';
const WS_PORT = 9523;
const PROJECT_PATH = '/TG/tgservice-uniapp';

async function main() {
  let program;
  try {
    console.log('🚀 启动 uni-automator...');
    const automator = new Automator();
    program = await automator.launch({
      platform: 'h5',
      projectPath: PROJECT_PATH,
      port: WS_PORT,
    });

    // 监听前端 console
    program.on('console', msg => {
      const type = msg.type || msg.level || 'log';
      const text = msg.text || (msg.args && msg.args.join ? msg.args.join(' ') : JSON.stringify(msg));
      // 只记录关键日志，过滤掉无关的
      if (text.includes('登录') || text.includes('验证码') || text.includes('sms') || 
          text.includes('error') || text.includes('token') || text.includes('角色') ||
          text.includes('身份') || text.includes('会员') || text.includes('fail') ||
          text.includes('Success') || text.includes('成功') || text.includes('失败') ||
          text.includes('coach') || text.includes('member') || text.includes('selectRole') ||
          text.includes('handle') || text.includes('Storage') || text.includes('clear') ||
          text.includes('API') || text.includes('request') || text.includes('POST')) {
        console.log(`[前端 ${type}] ${text}`);
      }
    });

    program.on('pageerror', err => {
      console.log(`[前端 ERROR] ${err.message || JSON.stringify(err)}`);
    });

    console.log('📱 导航到会员中心...');
    await program.switchTab('/pages/member/member');
    await new Promise(r => setTimeout(r, 5000));

    const page = await program.currentPage();

    // ===== 步骤1: 设置输入 + 发送验证码 =====
    console.log('\n=== 步骤1: 设置输入值 ===');
    await page.callMethod('setTestInput', TEST_PHONE, TEST_CODE);
    await new Promise(r => setTimeout(r, 2000));

    console.log('拨打 sendSmsCode...');
    try {
      await page.callMethod('sendSmsCode');
      console.log('✅ sendSmsCode 调用成功');
    } catch (e) {
      console.log('⚠️ sendSmsCode 失败:', e.message);
    }
    await new Promise(r => setTimeout(r, 5000));

    // ===== 步骤2: 登录 =====
    console.log('\n=== 步骤2: 短信登录 ===');
    try {
      await page.callMethod('loginBySms');
      console.log('✅ loginBySms 调用成功');
    } catch (e) {
      console.log('⚠️ loginBySms 失败:', e.message);
    }

    console.log('⏳ 等待 20 秒（登录+可能的身份选择）...');
    await new Promise(r => setTimeout(r, 20000));

    // ===== 步骤3: 检查结果 =====
    console.log('\n=== 步骤3: 检查 Storage ===');
    const keys = ['memberToken', 'memberInfo', 'coachToken', 'coachInfo', 
                   'adminToken', 'adminInfo', 'preferredRole', 'agreed', 'lastPhone'];
    for (const key of keys) {
      const val = await program.callUniMethod('getStorageSync', key);
      if (val) {
        const display = typeof val === 'object' ? JSON.stringify(val) : String(val);
        console.log(`  ${key} = ${display.substring(0, 200)}`);
      } else {
        console.log(`  ${key} = (空)`);
      }
    }

    // 截图
    await program.screenshot({ path: '/TG/temp/test/login-v3-result.png' });
    console.log('📸 截图: login-v3-result.png');

    const memberToken = await program.callUniMethod('getStorageSync', 'memberToken');
    if (memberToken) {
      console.log('\n✅✅✅ 登录成功! 18600000004 + 888888 完全可用');
    } else {
      console.log('\n❌❌❌ 登录失败! memberToken 为空');
      
      // 如果失败，尝试看看有没有身份选择弹框
      console.log('🔄 尝试 selectRole(member)...');
      try {
        await page.callMethod('selectRole', 'member');
        await new Promise(r => setTimeout(r, 5000));
        const afterToken = await program.callUniMethod('getStorageSync', 'memberToken');
        console.log('  memberToken after selectRole:', afterToken ? '有' : '无');
      } catch (e) {
        console.log('  selectRole 失败:', e.message);
      }
    }

  } catch (e) {
    console.error('❌ 脚本错误:', e.message);
    console.error(e.stack);
  } finally {
    if (program) {
      try { await program.teardown(); } catch (x) { console.log('teardown error:', x.message); }
    }
  }
}

main();