/**
 * 登录跟踪脚本 - 捕获前端 console 日志和 Storage 变化
 * 用法: node /TG/temp/test/login-trace.js
 */

const { Automator } = require('/TG/tgservice-uniapp/node_modules/@dcloudio/uni-automator');

const TEST_PHONE = '18600000004';
const TEST_CODE = '888888';
const WS_PORT = 9521;  // 用不同端口避免冲突
const PROJECT_PATH = '/TG/tgservice-uniapp';

const STORAGE_KEYS = [
  'memberToken', 'memberInfo', 'coachToken', 'coachInfo',
  'adminToken', 'adminInfo', 'preferredRole', 'sessionId',
  'tablePinyin', 'tableName', 'tableAuth', 'highlightProduct',
  'agreed', 'lastPhone', 'device_fp'
];

async function clearStorage(program) {
  for (const key of STORAGE_KEYS) {
    await program.callUniMethod('removeStorageSync', key);
  }
}

async function dumpStorage(program) {
  const result = {};
  for (const key of STORAGE_KEYS) {
    const val = await program.callUniMethod('getStorageSync', key);
    if (val) result[key] = typeof val === 'object' ? JSON.stringify(val) : val;
  }
  return result;
}

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
      const text = msg.text || msg.args?.join(' ') || JSON.stringify(msg);
      console.log(`[前端 ${type}] ${text}`);
    });

    // 监听页面错误
    program.on('pageerror', err => {
      console.log(`[前端 ERROR] ${err.message || JSON.stringify(err)}`);
    });

    console.log('📱 导航到会员中心...');
    await program.switchTab('/pages/member/member');
    await new Promise(r => setTimeout(r, 5000));

    console.log('📦 登录前 Storage:', JSON.stringify(await dumpStorage(program)));

    const page = await program.currentPage();

    // 清空旧数据
    console.log('🧹 清空旧 Storage...');
    await clearStorage(program);

    console.log('📦 清空后 Storage:', JSON.stringify(await dumpStorage(program)));

    // 设置输入
    console.log('⌨️ 设置 smsPhone=%s smsCode=%s agreed=true', TEST_PHONE, TEST_CODE);
    await page.callMethod('setTestInput', TEST_PHONE, TEST_CODE);
    await new Promise(r => setTimeout(r, 2000));

    // 验证 Vue ref 值
    const phoneVal = await page.callMethod('smsPhone');
    const codeVal = await page.callMethod('smsCode');
    const agreedVal = await page.callMethod('agreed');
    console.log(`🔍 Vue ref 验证: smsPhone=${JSON.stringify(phoneVal)}, smsCode=${JSON.stringify(codeVal)}, agreed=${JSON.stringify(agreedVal)}`);

    console.log('🔐 开始登录...');
    await page.callMethod('loginBySms');
    await new Promise(r => setTimeout(r, 10000));

    console.log('📦 登录后 Storage:', JSON.stringify(await dumpStorage(program)));

    const memberToken = await program.callUniMethod('getStorageSync', 'memberToken');
    const memberInfo = await program.callUniMethod('getStorageSync', 'memberInfo');

    if (memberToken) {
      console.log('✅ 登录成功! token:', memberToken);
      if (memberInfo) {
        console.log('✅ memberInfo:', typeof memberInfo === 'string' ? memberInfo : JSON.stringify(memberInfo));
      }

      // 检查是否有多角色选择
      const coachToken = await program.callUniMethod('getStorageSync', 'coachToken');
      const coachInfo = await program.callUniMethod('getStorageSync', 'coachInfo');
      if (coachToken) {
        console.log('⚠️ 有 coachToken，说明已选择身份');
      }
    } else {
      console.log('❌ 登录失败! memberToken 为空');
      // 截图看页面状态
      await program.screenshot({ path: '/TG/temp/test/login-fail.png' });
      console.log('📸 截图保存到 /TG/temp/test/login-fail.png');
    }

  } catch (e) {
    console.error('❌ 脚本错误:', e.message);
    console.error(e.stack);
  } finally {
    if (program) {
      try { await program.teardown(); } catch (x) {}
    }
  }
}

main();