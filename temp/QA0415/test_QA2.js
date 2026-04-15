/**
 * QA2 测试脚本：助教重复上桌功能支持
 * 测试员: B2
 * 日期: 2026-04-15
 */

const http = require('http');

const API_BASE = 'http://127.0.0.1:8088';
const TEST_COACH_NO = '10007';
const TEST_COACH_NAME = '小月';

const results = [];
let adminToken = null;

function log(msg) {
  const time = new Date().toISOString().slice(11, 23);
  console.log(`[${time}] ${msg}`);
}

function addResult(testId, name, status, detail = '') {
  results.push({ testId, name, status, detail });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${testId}: ${name} → ${status}${detail ? ' | ' + detail : ''}`);
}

// 简化的 API 请求函数
async function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {}
    };
    if (adminToken) opts.headers['Authorization'] = `Bearer ${adminToken}`;
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }

    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: { raw: data } });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 获取水牌状态
async function getWaterStatus() {
  return apiCall('GET', `/api/coaches/${TEST_COACH_NO}/water-status`);
}

// 获取水牌列表
async function getWaterBoards() {
  return apiCall('GET', '/api/water-boards');
}

// 获取单个水牌
async function getWaterBoard() {
  return apiCall('GET', `/api/water-boards/${TEST_COACH_NO}`);
}

// 提交上下桌单
async function submitTable(orderType, tableNo) {
  return apiCall('POST', '/api/table-action-orders', {
    order_type: orderType,
    table_no: tableNo,
    coach_no: TEST_COACH_NO,
    stage_name: TEST_COACH_NAME,
    action_category: '普通课'
  });
}

// 更新水牌状态
async function updateStatus(status, tableNo) {
  return apiCall('PUT', `/api/water-boards/${TEST_COACH_NO}/status`, {
    status,
    table_no: tableNo
  });
}

// 延迟
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 检查水牌状态并提取字段
function extractWB(resp) {
  // apiCall returns { status, data }
  // water-status returns { success, data: { coach_no, table_no, status, table_no_list, ... } }
  const d = resp && resp.data;
  if (!d) return { table_no: null, status: 'N/A', table_no_list: [] };
  // If wrapped in success/data structure
  const inner = d.data || d;
  return {
    table_no: inner.table_no !== undefined ? inner.table_no : null,
    status: inner.status || 'N/A',
    table_no_list: Array.isArray(inner.table_no_list) ? inner.table_no_list : []
  };
}

// ==================== 主测试 ====================
async function main() {
  log('========== QA2 测试开始 ==========');

  // 1. 登录
  log('获取 admin token...');
  const loginRes = await apiCall('POST', '/api/admin/login', {
    username: 'tgadmin',
    password: 'mms633268'
  });
  if (loginRes.status === 200 && loginRes.data?.success) {
    adminToken = loginRes.data.token;
    addResult('SETUP', '登录', 'PASS', '获取 token 成功');
  } else {
    addResult('SETUP', '登录', 'FAIL', JSON.stringify(loginRes.data));
    return;
  }

  // 2. 初始化为空闲
  log('初始化助教状态为晚班空闲...');
  await updateStatus('晚班空闲', null);
  await sleep(500);
  let ws = await getWaterStatus();
  let wb = extractWB(ws);
  log(`初始状态: table_no=${wb.table_no}, status=${wb.status}`);
  addResult('SETUP', '初始化', 'PASS', `status=${wb.status}, table_no=${wb.table_no}`);

  // ==================== 功能测试 ====================
  log('\n===== 功能测试 =====');

  // TC-F01: 空闲首次上桌 A1
  log('TC-F01: 空闲助教上桌 A1');
  let resp = await submitTable('上桌单', 'A1');
  await sleep(600);
  ws = await getWaterStatus();
  wb = extractWB(ws);
  log(`  上桌响应: ${JSON.stringify(resp.data)}`);
  log(`  水牌状态: table_no=${wb.table_no}, status=${wb.status}`);
  if (resp.status === 200 && resp.data?.success && wb.table_no === 'A1' && wb.status === '晚班上桌') {
    addResult('TC-F01', '空闲助教首次上桌', 'PASS', `table_no=A1, status=${wb.status}`);
  } else {
    addResult('TC-F01', '空闲助教首次上桌', 'FAIL', `API=${resp.status} ${JSON.stringify(resp.data)}, table_no=${wb.table_no}, status=${wb.status}`);
  }

  // TC-F02: 再上 A3
  log('TC-F02: 已在A1上，再上A3');
  resp = await submitTable('上桌单', 'A3');
  await sleep(600);
  ws = await getWaterStatus();
  wb = extractWB(ws);
  if (resp.status === 200 && resp.data?.success && wb.table_no === 'A1,A3' && wb.status === '晚班上桌') {
    addResult('TC-F02', '已在桌上再上另一桌', 'PASS', `table_no=A1,A3, status=${wb.status}`);
  } else {
    addResult('TC-F02', '已在桌上再上另一桌', 'FAIL', `API=${resp.status} ${JSON.stringify(resp.data)}, table_no=${wb.table_no}, status=${wb.status}`);
  }

  // TC-F03: 上 B2
  log('TC-F03: 多桌助教上B2');
  resp = await submitTable('上桌单', 'B2');
  await sleep(600);
  ws = await getWaterStatus();
  wb = extractWB(ws);
  if (resp.status === 200 && resp.data?.success && wb.table_no === 'A1,A3,B2' && wb.status === '晚班上桌') {
    addResult('TC-F03', '多桌助教上第三桌', 'PASS', `table_no=A1,A3,B2, status=${wb.status}`);
  } else {
    addResult('TC-F03', '多桌助教上第三桌', 'FAIL', `API=${resp.status} ${JSON.stringify(resp.data)}, table_no=${wb.table_no}, status=${wb.status}`);
  }

  // TC-F04: 下桌 A1
  log('TC-F04: 下桌单移除A1');
  resp = await submitTable('下桌单', 'A1');
  await sleep(600);
  ws = await getWaterStatus();
  wb = extractWB(ws);
  if (resp.status === 200 && resp.data?.success && wb.table_no === 'A3,B2' && wb.status === '晚班上桌') {
    addResult('TC-F04', '下桌单移除指定台桌', 'PASS', `table_no=A3,B2, status=${wb.status}`);
  } else {
    addResult('TC-F04', '下桌单移除指定台桌', 'FAIL', `API=${resp.status} ${JSON.stringify(resp.data)}, table_no=${wb.table_no}, status=${wb.status}`);
  }

  // TC-F05: 下桌 B2
  log('TC-F05: 继续下桌B2');
  resp = await submitTable('下桌单', 'B2');
  await sleep(600);
  ws = await getWaterStatus();
  wb = extractWB(ws);
  if (resp.status === 200 && resp.data?.success && wb.table_no === 'A3' && wb.status === '晚班上桌') {
    addResult('TC-F05', '继续下桌直到剩余一桌', 'PASS', `table_no=A3, status=${wb.status}`);
  } else {
    addResult('TC-F05', '继续下桌直到剩余一桌', 'FAIL', `API=${resp.status} ${JSON.stringify(resp.data)}, table_no=${wb.table_no}, status=${wb.status}`);
  }

  // TC-F06: 最后下桌 A3 变空闲
  log('TC-F06: 最后下桌A3变空闲');
  resp = await submitTable('下桌单', 'A3');
  await sleep(600);
  ws = await getWaterStatus();
  wb = extractWB(ws);
  const isEmptyTable = wb.table_no === null || wb.table_no === '' || wb.table_no === undefined;
  if (resp.status === 200 && resp.data?.success && wb.status === '晚班空闲' && isEmptyTable) {
    addResult('TC-F06', '最后一桌下桌变空闲', 'PASS', `status=${wb.status}, table_no=${wb.table_no}`);
  } else {
    addResult('TC-F06', '最后一桌下桌变空闲', 'FAIL', `API=${resp.status} ${JSON.stringify(resp.data)}, table_no=${wb.table_no}, status=${wb.status}`);
  }

  // 重新上桌 A1,A3 以便后续测试
  log('重新上桌A1,A3...');
  await submitTable('上桌单', 'A1');
  await sleep(600);
  await submitTable('上桌单', 'A3');
  await sleep(600);
  ws = await getWaterStatus();
  wb = extractWB(ws);
  log(`  重新上桌后: table_no=${wb.table_no}`);

  // TC-F07: 一致性检查（A1在列表）
  log('TC-F07: 一致性检查-A1在列表中');
  const listA = wb.table_no_list || [];
  if (listA.includes('A1')) {
    addResult('TC-F07', '一致性检查-A1在列表中', 'PASS', `A1 ∈ ${JSON.stringify(listA)}`);
  } else {
    addResult('TC-F07', '一致性检查-A1在列表中', 'FAIL', `A1 ∉ ${JSON.stringify(listA)}`);
  }

  // TC-F08: 一致性检查（B2不在列表）
  log('TC-F08: 一致性检查-B2不在列表中');
  if (!listA.includes('B2')) {
    addResult('TC-F08', '一致性检查-B2不在列表中', 'PASS', `B2 ∉ ${JSON.stringify(listA)}（应被拒绝）`);
  } else {
    addResult('TC-F08', '一致性检查-B2不在列表中', 'FAIL', `B2 ∈ ${JSON.stringify(listA)}`);
  }

  // ==================== 边界测试 ====================
  log('\n===== 边界测试 =====');

  // TC-B01: 重复上A1
  log('TC-B01: 重复上同一桌A1');
  resp = await submitTable('上桌单', 'A1');
  if (resp.status === 400 && resp.data?.error && resp.data.error.includes('不能重复上桌')) {
    addResult('TC-B01', '重复上同一桌', 'PASS', resp.data.error);
  } else {
    addResult('TC-B01', '重复上同一桌', 'FAIL', `status=${resp.status}, data=${JSON.stringify(resp.data)}`);
  }

  // TC-B02: 下桌不存在的B99
  log('TC-B02: 下桌选择不在桌上的台桌号B99');
  resp = await submitTable('下桌单', 'B99');
  if (resp.status === 400 && resp.data?.error && resp.data.error.includes('不在台桌')) {
    addResult('TC-B02', '下桌选择不在桌上的台桌号', 'PASS', resp.data.error);
  } else {
    addResult('TC-B02', '下桌选择不在桌上的台桌号', 'FAIL', `status=${resp.status}, data=${JSON.stringify(resp.data)}`);
  }

  // TC-B03: 空闲状态下下桌
  log('TC-B03: 空闲状态下下桌');
  await updateStatus('晚班空闲', null);
  await sleep(600);
  resp = await submitTable('下桌单', 'A1');
  if (resp.status === 400) {
    addResult('TC-B03', '空闲状态下下桌', 'PASS', resp.data?.error || '400');
  } else {
    addResult('TC-B03', '空闲状态下下桌', 'FAIL', `status=${resp.status}, data=${JSON.stringify(resp.data)}`);
  }

  // TC-B04: 取消单
  log('TC-B04: 取消单移除A1');
  await submitTable('上桌单', 'A1');
  await sleep(600);
  await submitTable('上桌单', 'B2');
  await sleep(600);
  resp = await submitTable('取消单', 'A1');
  await sleep(600);
  ws = await getWaterStatus();
  wb = extractWB(ws);
  if (resp.status === 200 && resp.data?.success && wb.table_no === 'A3,B2' && wb.status === '晚班上桌') {
    addResult('TC-B04', '取消单移除指定台桌', 'PASS', `table_no=A3,B2`);
  } else {
    addResult('TC-B04', '取消单移除指定台桌', 'FAIL', `API=${resp.status} ${JSON.stringify(resp.data)}, table_no=${wb.table_no}`);
  }

  // TC-B05: 取消全部后变空闲
  log('TC-B05: 取消全部后变空闲');
  resp = await submitTable('取消单', 'B2');
  await sleep(600);
  resp = await submitTable('取消单', 'A3');
  await sleep(600);
  ws = await getWaterStatus();
  wb = extractWB(ws);
  const isEmptyB5 = wb.table_no === null || wb.table_no === '' || wb.table_no === undefined;
  if (resp.status === 200 && resp.data?.success && wb.status === '晚班空闲' && isEmptyB5) {
    addResult('TC-B05', '取消全部后变空闲', 'PASS', `status=${wb.status}`);
  } else {
    addResult('TC-B05', '取消全部后变空闲', 'FAIL', `API=${resp.status} ${JSON.stringify(resp.data)}, table_no=${wb.table_no}, status=${wb.status}`);
  }

  // ==================== 显示测试 ====================
  log('\n===== 显示测试 =====');

  // 重新上桌 A1,A3
  await submitTable('上桌单', 'A1');
  await sleep(600);
  await submitTable('上桌单', 'A3');
  await sleep(600);

  // TC-D01: 水牌列表
  log('TC-D01: 水牌列表显示多桌号');
  resp = await getWaterBoards();
  if (resp.status === 200 && resp.data?.success && resp.data?.data) {
    const coachData = resp.data.data.find(d => d.coach_no === TEST_COACH_NO);
    if (coachData && coachData.table_no === 'A1,A3' &&
        Array.isArray(coachData.table_no_list) &&
        coachData.table_no_list.includes('A1') && coachData.table_no_list.includes('A3')) {
      addResult('TC-D01', '水牌列表显示多桌号', 'PASS', `table_no=${coachData.table_no}, table_no_list=${JSON.stringify(coachData.table_no_list)}`);
    } else {
      addResult('TC-D01', '水牌列表显示多桌号', 'FAIL', `table_no=${coachData?.table_no}, table_no_list=${JSON.stringify(coachData?.table_no_list)}`);
    }
  } else {
    addResult('TC-D01', '水牌列表显示多桌号', 'FAIL', `API失败`);
  }

  // TC-D02: 水牌单条
  log('TC-D02: 水牌单条查询显示多桌号');
  resp = await getWaterBoard();
  if (resp.status === 200 && resp.data?.success) {
    const d = resp.data.data;
    if (d.table_no === 'A1,A3' && Array.isArray(d.table_no_list) &&
        d.table_no_list.includes('A1') && d.table_no_list.includes('A3')) {
      addResult('TC-D02', '水牌单条查询显示多桌号', 'PASS', `table_no=${d.table_no}, table_no_list=${JSON.stringify(d.table_no_list)}`);
    } else {
      addResult('TC-D02', '水牌单条查询显示多桌号', 'FAIL', `table_no=${d?.table_no}, table_no_list=${JSON.stringify(d?.table_no_list)}`);
    }
  } else {
    addResult('TC-D02', '水牌单条查询显示多桌号', 'FAIL', `API失败`);
  }

  // TC-D03: 水牌状态查询
  log('TC-D03: 水牌状态查询显示多桌号');
  ws = await getWaterStatus();
  wb = extractWB(ws);
  if (wb.table_no === 'A1,A3' && Array.isArray(wb.table_no_list) &&
      wb.table_no_list.includes('A1') && wb.table_no_list.includes('A3')) {
    addResult('TC-D03', '水牌状态查询显示多桌号', 'PASS', `table_no=${wb.table_no}, table_no_list=${JSON.stringify(wb.table_no_list)}`);
  } else {
    addResult('TC-D03', '水牌状态查询显示多桌号', 'FAIL', `table_no=${wb.table_no}, table_no_list=${JSON.stringify(wb.table_no_list)}, raw=${JSON.stringify(ws.data)}`);
  }

  // TC-D04: 前端默认台桌号为空
  log('TC-D04: 前端商品页默认台桌号（跳过浏览器测试，需前端配合）');
  addResult('TC-D04', '前端商品页默认台桌号为空', 'WARN', '需要前端H5登录后验证，本次跳过');

  // ==================== API格式验证 ====================
  log('\n===== API格式验证 =====');

  // TC-A01: water-boards table_no_list
  log('TC-A01: water-boards返回table_no_list数组');
  resp = await getWaterBoards();
  if (resp.status === 200 && resp.data?.success) {
    const cd = resp.data.data?.find(d => d.coach_no === TEST_COACH_NO);
    if (cd && Array.isArray(cd.table_no_list)) {
      addResult('TC-A01', 'water-boards返回table_no_list', 'PASS', JSON.stringify(cd.table_no_list));
    } else {
      addResult('TC-A01', 'water-boards返回table_no_list', 'FAIL', `缺少数组字段`);
    }
  } else {
    addResult('TC-A01', 'water-boards返回table_no_list', 'FAIL', `API失败`);
  }

  // TC-A02: water-status table_no_list
  log('TC-A02: water-status返回table_no_list数组');
  ws = await getWaterStatus();
  wb = extractWB(ws);
  if (Array.isArray(wb.table_no_list)) {
    addResult('TC-A02', 'water-status返回table_no_list', 'PASS', JSON.stringify(wb.table_no_list));
  } else {
    addResult('TC-A02', 'water-status返回table_no_list', 'FAIL', `table_no_list=${wb.table_no_list}, raw=${JSON.stringify(ws.data)}`);
  }

  // ==================== 生成报告 ====================
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const warnCount = results.filter(r => r.status === 'WARN').length;

  let report = `# QA2 测试结果：助教重复上桌功能支持\n\n`;
  report += `**测试日期**: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}\n`;
  report += `**测试员**: B2\n`;
  report += `**测试环境**: 后端 ${API_BASE} (PM2 tgservice-dev)\n`;
  report += `**测试助教**: ${TEST_COACH_NO} ${TEST_COACH_NAME}\n\n`;
  report += `## 测试概览\n\n`;
  report += `| 项目 | 数量 |\n|------|------|\n`;
  report += `| 总计 | ${results.length} |\n`;
  report += `| ✅ 通过 | ${passCount} |\n`;
  report += `| ❌ 失败 | ${failCount} |\n`;
  report += `| ⚠️ 警告 | ${warnCount} |\n\n`;
  report += `## 通过率\n\n`;
  const passRate = ((passCount / (results.length - warnCount)) * 100).toFixed(1);
  report += `**${passRate}%** (${passCount}/${results.length - warnCount} 不含警告项)\n\n`;
  report += `## 详细结果\n\n`;
  report += `| # | 测试用例 | 结果 | 详情 |\n|---|---------|------|------|\n`;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    report += `| ${r.testId} | ${r.name} | ${icon} ${r.status} | ${r.detail || '-'} |\n`;
  }
  report += `\n## 结论\n\n`;
  if (failCount === 0) {
    report += `**全部通过！** QA2 功能实现正确。\n`;
  } else {
    report += `**存在 ${failCount} 个失败项**，需要修复。\n\n`;
    report += `### 失败项分析\n\n`;
    results.filter(r => r.status === 'FAIL').forEach(r => {
      report += `- **${r.testId}** ${r.name}: ${r.detail}\n`;
    });
  }

  const fs = require('fs');
  fs.writeFileSync('/TG/temp/QA0415/test_result_QA2.md', report, 'utf8');
  log('\n测试报告已保存: /TG/temp/QA0415/test_result_QA2.md');
  log('========== QA2 测试结束 ==========');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
