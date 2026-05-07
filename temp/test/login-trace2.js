/**
 * 登录跟踪脚本 V2 - 使用 setData 设置值 + 手动触发
 * 用法: node /TG/temp/test/login-trace2.js
 */

const { Automator } = require('/TG/tgservice-uniapp/node_modules/@dcloudio/uni-automator');

const TEST_PHONE = '18600000004';
const TEST_CODE = '888888';
const WS_PORT = 9522;
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
      console.log(`[前端 ${type}] ${text}`);
    });

    program.on('pageerror', err => {
      console.log(`[前端 ERROR] ${err.message || JSON.stringify(err)}`);
    });

    console.log('📱 导航到会员中心...');
    await program.switchTab('/pages/member/member');
    await new Promise(r => setTimeout(r, 5000));

    const page = await program.currentPage();

    // 先用 setTestInput 方法设置值（用 try/catch 包裹 callMethod）
    console.log('⌨️ callMethod setTestInput...');
    try {
      await page.callMethod('setTestInput', TEST_PHONE, TEST_CODE);
      console.log('✅ setTestInput 成功');
    } catch (e) {
      console.log('⚠️ setTestInput callMethod 失败:', e.message);
      console.log('🔄 用 setData 方式设置...');
      try {
        await page.setData({ smsPhone: TEST_PHONE });
        await page.setData({ smsCode: TEST_CODE });
        await page.setData({ agreed: true });
        console.log('✅ setData 设置完成');
      } catch (e2) {
        console.log('⚠️ setData 也失败:', e2.message);
      }
    }

    await new Promise(r => setTimeout(r, 3000));

    // 截图看当前状态
    await program.screenshot({ path: '/TG/temp/test/login-before.png' });
    console.log('📸 截图: login-before.png');

    // 触发登录
    console.log('🔐 callMethod loginBySms...');
    try {
      await page.callMethod('loginBySms');
      console.log('✅ loginBySms 调用成功（注意：callMethod不等待async完成）');
    } catch (e) {
      console.log('⚠️ loginBySms callMethod 失败:', e.message);
    }

    // 等待登录流程完成（包括可能的网络请求和身份选择）
    console.log('⏳ 等待 15 秒...');
    await new Promise(r => setTimeout(r, 15000));

    // 检查 Storage
    const keys = ['memberToken', 'memberInfo', 'coachToken', 'coachInfo', 
                   'adminToken', 'adminInfo', 'preferredRole', 'agreed'];
    for (const key of keys) {
      const val = await program.callUniMethod('getStorageSync', key);
      if (val) {
        console.log(`  Storage[${key}] = ${typeof val === 'object' ? JSON.stringify(val) : String(val).substring(0, 100)}`);
      } else {
        console.log(`  Storage[${key}] = (空)`);
      }
    }

    // 截图看登录后状态
    await program.screenshot({ path: '/TG/temp/test/login-after.png' });
    console.log('📸 截图: login-after.png');

    // 如果登录成功但有角色选择弹框，尝试选择 member
    const memberToken = await program.callUniMethod('getStorageSync', 'memberToken');
    if (memberToken) {
      console.log('✅ 登录成功! memberToken 已获取');
      
      // 检查是否有角色弹框
      const coachToken = await program.callUniMethod('getStorageSync', 'coachToken');
      if (!coachToken) {
        console.log('🔄 尝试 selectRole member...');
        try {
          await page.callMethod('selectRole', 'member');
          await new Promise(r => setTimeout(r, 5000));
          const afterCoach = await program.callUniMethod('getStorageSync', 'coachToken');
          console.log('  coachToken after selectRole:', afterCoach ? '有' : '无');
        } catch (e) {
          console.log('⚠️ selectRole 失败:', e.message);
        }
      }
    } else {
      console.log('❌ 登录失败! memberToken 为空');
    }

    // 最终截图
    await program.screenshot({ path: '/TG/temp/test/login-final.png' });
    console.log('📸 最终截图: login-final.png');

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