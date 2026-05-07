/**
 * QA-20260505: 前端错误上报测试脚本 V3
 * 限流测试放最后，避免消耗配额影响其他测试
 * 用法: node /TG/temp/test/error-report-test-v3.js
 */

const { Automator } = require('/TG/tgservice-uniapp/node_modules/@dcloudio/uni-automator');
const http = require('http');
const fs = require('fs');

const WS_PORT = 9526;
const PROJECT_PATH = '/TG/tgservice-uniapp';
const LOG_PATH = '/TG/tgservice/logs/frontend-error.log';

async function postToBackend(body) {
  const data = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1', port: 8088,
      path: '/api/admin/frontend-error-log', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(buf) }); } catch { resolve({ status: res.statusCode, data: buf }); } });
    });
    req.on('error', e => resolve({ status: 0, data: e.message }));
    req.write(data); req.end();
  });
}

function readErrorLog() {
  try {
    if (!fs.existsSync(LOG_PATH)) return [];
    return fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter(l => l.trim());
  } catch { return []; }
}
function clearErrorLog() { try { fs.writeFileSync(LOG_PATH, ''); } catch {} }

async function main() {
  let program;
  const results = {};

  try {
    // ============================
    // 测试1: 后端无鉴权上报（基本验证，不测限流）
    // ============================
    console.log('\n=== 测试1: 后端无鉴权上报 ===');
    clearErrorLog();

    const r1 = await postToBackend({ type: 'test_no_auth', message: 'QA测试:无token上报' });
    results['1a'] = r1.status === 200 && r1.data?.success;
    console.log(`  1a(无token上报): ${results['1a'] ? '✅' : '❌'} status=${r1.status}`);

    const log1 = readErrorLog();
    results['1b'] = log1.some(l => l.includes('test_no_auth'));
    console.log(`  1b(日志写入): ${results['1b'] ? '✅' : '❌'} ${log1.length}条`);

    // ============================
    // 测试2-5: uni-automator 前端测试
    // ============================
    console.log('\n🚀 启动 uni-automator...');
    const automator = new Automator();
    program = await automator.launch({ platform: 'h5', projectPath: PROJECT_PATH, port: WS_PORT });
    program.on('console', msg => {
      const text = msg.text || (msg.args?.join ? msg.args.join(' ') : '');
      if (text.includes('ErrorReporter') || text.includes('上报') || text.includes('错误') || text.includes('成功'))
        console.log(`  [前端] ${text.substring(0, 200)}`);
    });

    await program.switchTab('/pages/member/member');
    await new Promise(r => setTimeout(r, 5000));
    const page = await program.currentPage();

    // ============================
    // 测试2: loginBySms catch errorReporter.report()
    // ============================
    console.log('\n=== 测试2: loginBySms catch 上报 ===');
    // 清空旧数据
    for (const k of ['memberToken','memberInfo','coachToken','coachInfo','adminToken','adminInfo','preferredRole','device_fp'])
      await program.callUniMethod('removeStorageSync', k);
    await program.callUniMethod('setStorageSync', 'agreed', true);
    clearErrorLog();

    // 用错误验证码登录 → 触发 catch 块
    await page.callMethod('setTestInput', '18600000004', '000000');
    await new Promise(r => setTimeout(r, 2000));
    await page.callMethod('loginBySms');
    await new Promise(r => setTimeout(r, 10000));

    const log2 = readErrorLog();
    results['2a'] = log2.some(l => l.includes('login_sms_error'));
    results['2b'] = log2.some(l => l.includes('api_error'));
    console.log(`  2a(login_sms_error上报): ${results['2a'] ? '✅' : '❌'}`);
    console.log(`  2b(request api_error自动上报): ${results['2b'] ? '✅' : '❌'}`);
    log2.forEach(l => console.log(`    ${l.substring(0, 150)}`));

    // ============================
    // 测试3: 全局错误上报格式
    // ============================
    console.log('\n=== 测试3: 全局错误格式 ===');
    clearErrorLog();

    const r3 = await postToBackend({
      type: 'js_error', message: 'ReferenceError: Buffer is not defined',
      stack: 'at getDeviceFingerprint', route: '/pages/member/member',
      userAgent: 'QA Test', user: { type: 'anonymous' }
    });
    results['3a'] = r3.status === 200 && r3.data?.success;
    console.log(`  3a(接收成功): ${results['3a'] ? '✅' : '❌'} status=${r3.status}`);

    const log3 = readErrorLog();
    results['3b'] = log3.some(l => l.includes('Buffer'));
    console.log(`  3b(Buffer错误记录): ${results['3b'] ? '✅' : '❌'}`);

    // ============================
    // 测试4: Buffer 修复验证
    // ============================
    console.log('\n=== 测试4: Buffer修复 + 登录 ===');
    for (const k of ['memberToken','memberInfo','coachToken','coachInfo','adminToken','adminInfo','preferredRole','device_fp'])
      await program.callUniMethod('removeStorageSync', k);
    await program.callUniMethod('setStorageSync', 'agreed', true);
    clearErrorLog();

    await page.callMethod('setTestInput', '18600000004', '888888');
    await new Promise(r => setTimeout(r, 2000));
    await page.callMethod('loginBySms');
    await new Promise(r => setTimeout(r, 12000));

    const token4 = await program.callUniMethod('getStorageSync', 'memberToken');
    const fp4 = await program.callUniMethod('getStorageSync', 'device_fp');
    const log4 = readErrorLog();

    results['4a'] = !!token4;
    results['4b'] = !!fp4;
    results['4c'] = !log4.some(l => l.includes('Buffer'));
    console.log(`  4a(登录成功): ${results['4a'] ? '✅' : '❌'}`);
    console.log(`  4b(device_fp生成): ${results['4b'] ? '✅' : '❌'} fp=${fp4}`);
    console.log(`  4c(无Buffer错误): ${results['4c'] ? '✅' : '❌'}`);

    // ============================
    // 测试5: sms_send_error 格式
    // ============================
    console.log('\n=== 测试5: sms_send_error 格式 ===');
    clearErrorLog();

    const r5 = await postToBackend({ type: 'sms_send_error', message: '发送验证码失败', phone: '18600000004' });
    results['5'] = r5.status === 200 && r5.data?.success;
    console.log(`  5(sms_send_error格式): ${results['5'] ? '✅' : '❌'} status=${r5.status}`);

    // ============================
    // 测试6: 限流（放最后，避免影响其他测试）
    // ============================
    console.log('\n=== 测试6: 限流验证 ===');
    let rateLimited = false;
    for (let i = 0; i < 35; i++) {
      const r = await postToBackend({ type: 'rate_limit_test', message: `#${i}` });
      if (r.status === 429) { rateLimited = true; console.log(`  限流触发 #${i}`); break; }
    }
    results['6'] = rateLimited;
    console.log(`  6(限流生效): ${rateLimited ? '✅' : '⚠️ 35次未触发'}`);

    // ============================
    // 汇总
    // ============================
    console.log('\n========================================');
    const allTests = [
      ['1a. 无token上报', results['1a']],
      ['1b. 日志写入文件', results['1b']],
      ['2a. login_sms_error catch上报', results['2a']],
      ['2b. request() api_error自动上报', results['2b']],
      ['3a. 全局错误格式接收', results['3a']],
      ['3b. Buffer错误记录到日志', results['3b']],
      ['4a. 清空device_fp后登录成功', results['4a']],
      ['4b. device_fp重新生成', results['4b']],
      ['4c. 无Buffer错误', results['4c']],
      ['5. sms_send_error格式', results['5']],
      ['6. 限流生效', results['6']],
    ];
    allTests.forEach(([n, p]) => console.log(`  ${p ? '✅' : '❌'} ${n}`));
    const allPassed = allTests.every(([_, p]) => p);
    console.log(`\n${allPassed ? '✅ 所有测试通过' : '❌ 有测试未通过'}`);
    console.log('========================================');

  } catch (e) {
    console.error('❌ 错误:', e.message);
  } finally {
    if (program) try { await program.teardown(); } catch {}
  }
}

main();