/**
 * 编码规范修复测试脚本 v2
 * 测试编码规范修复的12个修改点
 * 
 * 运行方式: node /TG/tgservice/backend/test-coding-rules.js
 */

const fs = require('fs');
const path = require('path');

const BACKEND = '/TG/tgservice/backend';
const FRONTEND = '/TG/tgservice-uniapp/src';

let passCount = 0;
let failCount = 0;
const results = [];

function test(name, passed, detail = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  if (passed) passCount++; else failCount++;
  results.push({ name, passed, detail });
  console.log(`  ${status} [${results.length}] ${name}`);
  if (detail) console.log(`        ${detail}`);
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return null;
  }
}

// ============================================================
// 🔴 铁律1：后端 INSERT 时间修复（6项）
// ============================================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔴 铁律1：后端 INSERT 时间修复（6项）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

/**
 * 精准检查 INSERT INTO <tableName> 语句是否包含 created_at 列。
 * 策略：提取 INSERT INTO tableName (...) 的列定义部分，严格匹配。
 */
function checkInsertCreatedAt(filePath, tableName, label) {
  const content = readFile(filePath);
  if (!content) {
    test(`${label}: ${tableName} INSERT created_at`, false, `文件不存在: ${filePath}`);
    return;
  }

  // 检查是否引入了 TimeUtil
  const hasTimeUtil = /require\(['"]\.\.\/utils\/time['"]\)|require\(['"]\.\/utils\/time['"]\)/.test(content);
  test(`${label}: 引入 TimeUtil`, hasTimeUtil, 
    hasTimeUtil ? '已引入' : '❌ 未引入 TimeUtil');

  // 精准匹配 INSERT INTO tableName 的列定义
  // 策略：找到 "INSERT INTO tableName (" 然后逐行收集列直到 ")"
  const lines = content.split('\n');
  const insertBlocks = [];
  let inInsert = false;
  let parenDepth = 0;
  let currentBlock = '';
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inInsert && new RegExp(`INSERT INTO ${tableName}\\s*\\(`, 'i').test(line)) {
      inInsert = true;
      startLine = i + 1;
      currentBlock = line;
      parenDepth = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
      if (parenDepth <= 0) {
        // 单行完成
        insertBlocks.push({ sql: currentBlock, line: startLine });
        inInsert = false;
      }
      continue;
    }
    if (inInsert) {
      currentBlock += '\n' + line;
      parenDepth += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
      if (parenDepth <= 0) {
        insertBlocks.push({ sql: currentBlock, line: startLine });
        inInsert = false;
      }
    }
  }

  if (insertBlocks.length === 0) {
    test(`${label}: 找到 INSERT INTO ${tableName}`, false, '未找到 INSERT 语句');
    return;
  }

  test(`${label}: 找到 INSERT INTO ${tableName}`, true, `找到 ${insertBlocks.length} 处`);

  let allHaveCreatedAt = true;
  let allUseNowDB = true;

  for (const block of insertBlocks) {
    // 提取列定义部分：INSERT INTO tableName ( columns... )
    const colMatch = block.sql.match(new RegExp(`INSERT INTO ${tableName}\\s*\\(([^)]+)\\)`, 'i'));
    if (!colMatch) {
      test(`${label}: L${block.line} INSERT 包含 created_at`, false, '无法解析列定义');
      allHaveCreatedAt = false;
      continue;
    }

    const columns = colMatch[1];
    const hasCreatedAt = /\bcreated_at\b/i.test(columns);

    test(`${label}: L${block.line} INSERT 包含 created_at 列`, hasCreatedAt,
      hasCreatedAt 
        ? `列定义中包含 created_at` 
        : `❌ 列定义中不包含 created_at（依赖 DEFAULT CURRENT_TIMESTAMP = UTC 时间）`
    );

    if (!hasCreatedAt) {
      allHaveCreatedAt = false;
      continue;
    }

    // 检查对应的 VALUES 中是否使用 TimeUtil.nowDB() 或 nowDB 变量
    // 注意：TimeUtil.nowDB() 在 SQL 模板字符串外的值数组中，需要看完整上下文
    // 从文件内容中定位 SQL 块位置，然后向后查找
    const sqlInContent = content.indexOf(block.sql);
    const contextEnd = Math.min(sqlInContent + block.sql.length + 600, content.length);
    const fullContext = content.substring(sqlInContent, contextEnd);
    const usesNowDB = fullContext.includes('TimeUtil.nowDB()') ||
                      /\bnowDB\b/.test(fullContext);

    test(`${label}: L${block.line} 使用 TimeUtil.nowDB()`, usesNowDB,
      usesNowDB ? '使用 TimeUtil.nowDB() 或 nowDB 变量' : '❌ 未使用 TimeUtil.nowDB()'
    );
    if (!usesNowDB) allUseNowDB = false;
  }

  // 检查文件是否还有 CURRENT_TIMESTAMP（表定义中的不算，INSERT 中的才算）
  // 只检查 INSERT ... VALUES 附近的 CURRENT_TIMESTAMP
  const insertSectionMatch = content.match(/INSERT[\s\S]{0,2000}?VALUES[\s\S]{0,500}?/g) || [];
  let hasCTInInsert = false;
  for (const section of insertSectionMatch) {
    if (/CURRENT_TIMESTAMP/i.test(section)) {
      hasCTInInsert = true;
      break;
    }
  }

  test(`${label}: INSERT 不依赖 CURRENT_TIMESTAMP`, !hasCTInInsert,
    !hasCTInInsert ? '✓ 未使用 CURRENT_TIMESTAMP' : '❌ INSERT 中使用了 CURRENT_TIMESTAMP'
  );
}

// 1. service-orders.js -> service_orders
checkInsertCreatedAt(
  path.join(BACKEND, 'routes/service-orders.js'),
  'service_orders',
  '#1 service-orders.js'
);

// 2. applications.js -> applications
checkInsertCreatedAt(
  path.join(BACKEND, 'routes/applications.js'),
  'applications',
  '#2 applications.js'
);

// 3. guest-invitations.js -> guest_invitation_results（批量创建）
// 批量创建是循环中的 INSERT（约 L93）
const guestContent = readFile(path.join(BACKEND, 'routes/guest-invitations.js'));
if (guestContent) {
  // 精准检查 L93 附近的批量创建 INSERT
  const batchInsert = guestContent.substring(
    guestContent.indexOf('INSERT INTO guest_invitation_results'),
    guestContent.indexOf('INSERT INTO guest_invitation_results') + 500
  );
  const hasBatchCreatedAt = /\bcreated_at\b/i.test(batchInsert);
  test('#3 guest-invitations 批量创建: INSERT 包含 created_at', hasBatchCreatedAt,
    hasBatchCreatedAt ? '✓ 包含 created_at' : '❌ 未包含 created_at（依赖 DEFAULT CURRENT_TIMESTAMP）'
  );
  
  // 检查是否有 nowDB/TimeUtil.nowDB()
  const batchUsesNowDB = /TimeUtil\.nowDB\(\)|\bnowDB\b/.test(batchInsert);
  test('#3 guest-invitations 批量创建: 使用 TimeUtil.nowDB()', batchUsesNowDB,
    batchUsesNowDB ? '✓ 使用 TimeUtil.nowDB()' : '❌ 未使用'
  );

  // 4. 单个创建（约 L251）
  const singleInsertStart = guestContent.lastIndexOf('INSERT INTO guest_invitation_results');
  const singleInsert = guestContent.substring(singleInsertStart, singleInsertStart + 500);
  const hasSingleCreatedAt = /\bcreated_at\b/i.test(singleInsert);
  test('#4 guest-invitations 单个创建: INSERT 包含 created_at', hasSingleCreatedAt,
    hasSingleCreatedAt ? '✓ 包含 created_at' : '❌ 未包含 created_at'
  );
  
  const singleUsesNowDB = /TimeUtil\.nowDB\(\)|\bnowDB\b/.test(singleInsert);
  test('#4 guest-invitations 单个创建: 使用 TimeUtil.nowDB()', singleUsesNowDB,
    singleUsesNowDB ? '✓ 使用 TimeUtil.nowDB()' : '❌ 未使用'
  );
}

// 5. table-action-orders.js -> table_action_orders
checkInsertCreatedAt(
  path.join(BACKEND, 'routes/table-action-orders.js'),
  'table_action_orders',
  '#5 table-action-orders.js'
);

// 6. lejuan-records.js -> lejuan_records
checkInsertCreatedAt(
  path.join(BACKEND, 'routes/lejuan-records.js'),
  'lejuan_records',
  '#6 lejuan-records.js'
);

// ============================================================
// 🔴 铁律1：前端 new Date() 修复（3项）
// ============================================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔴 铁律1：前端 new Date() 修复（3项）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

function checkFrontendDateUsage(filePath, fileName, checks) {
  const content = readFile(filePath);
  if (!content) {
    test(`${fileName}`, false, `❌ 文件不存在: ${filePath}`);
    return;
  }

  for (const { pattern, desc } of checks) {
    const found = content.match(pattern);
    const passed = !found;
    test(`${fileName}: ${desc}`, passed,
      passed 
        ? '✓ 已修复' 
        : `❌ 仍在使用: "${found[0]}"（第 ${content.substring(0, found.index).split('\n').length} 行）`
    );
  }
}

// 7. overtime-apply.vue
checkFrontendDateUsage(
  path.join(FRONTEND, 'pages/internal/overtime-apply.vue'),
  '#7 overtime-apply.vue',
  [
    { pattern: /new Date\(\)\.getHours\(\)/, desc: '不使用 new Date().getHours() 判断班次' }
  ]
);

// 8. invitation-upload.vue
checkFrontendDateUsage(
  path.join(FRONTEND, 'pages/internal/invitation-upload.vue'),
  '#8 invitation-upload.vue',
  [
    { pattern: /new Date\(\)\.getHours\(\)/, desc: '不使用 new Date().getHours() 判断班次' }
  ]
);

// 9. switch-control.vue
checkFrontendDateUsage(
  path.join(FRONTEND, 'pages/internal/switch-control.vue'),
  '#9 switch-control.vue',
  [
    { pattern: new RegExp('new Date\\(\\)' + '\\.toISOString\\(\\)'), desc: '不使用 new Date() + toISOString() 记录时间' }
  ]
);

// ============================================================
// 🟠 铁律3：数据库写入规范化（3项）
// ============================================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🟠 铁律3：数据库写入规范化（3项）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const serverContent = readFile(path.join(BACKEND, 'server.js'));
if (serverContent) {
  const lines = serverContent.split('\n');

  // 收集所有 dbTx / dbTxAsync / runInTransaction 调用（排除 require 行）
  const dbTxCalls = [];
  const dbTxAsyncCalls = [];
  const runInTransactionCalls = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/await\s+dbTx\s*\(/.test(line)) {
      dbTxCalls.push({ line: i + 1, code: line.trim() });
    }
    if (/await\s+dbTxAsync\s*\(/.test(line)) {
      dbTxAsyncCalls.push({ line: i + 1, code: line.trim() });
    }
    if (/await\s+runInTransaction\s*\(/.test(line)) {
      runInTransactionCalls.push({ line: i + 1, code: line.trim() });
    }
  }

  // 10. 购物车区域（~584行）
  const cartDbTx = dbTxCalls.filter(c => c.line >= 570 && c.line <= 600);
  const cartRunInTx = runInTransactionCalls.filter(c => c.line >= 570 && c.line <= 600);
  test('#10 server.js:584 购物车使用 runInTransaction', 
    cartDbTx.length === 0 && cartRunInTx.length > 0,
    cartDbTx.length === 0 && cartRunInTx.length > 0
      ? '✓ 已使用 runInTransaction'
      : `❌ dbTx 调用: ${cartDbTx.map(c => `L${c.line}`).join(', ') || '无'}，runInTransaction: ${cartRunInTx.map(c => `L${c.line}`).join(', ') || '无'}`
  );

  // 11. 商品同步区域（~2506行）
  const syncDbTxAsync = dbTxAsyncCalls.filter(c => c.line >= 2490 && c.line <= 2530);
  const syncRunInTx = runInTransactionCalls.filter(c => c.line >= 2490 && c.line <= 2530);
  test('#11 server.js:2514 商品同步使用 runInTransaction',
    syncDbTxAsync.length === 0 && syncRunInTx.length > 0,
    syncDbTxAsync.length === 0 && syncRunInTx.length > 0
      ? '✓ 已使用 runInTransaction'
      : `❌ dbTxAsync 调用: ${syncDbTxAsync.map(c => `L${c.line}`).join(', ') || '无'}，runInTransaction: ${syncRunInTx.map(c => `L${c.line}`).join(', ') || '无'}`
  );

  // 12. 台桌同步区域（~3599行）
  const tableDbTxAsync = dbTxAsyncCalls.filter(c => c.line >= 3580 && c.line <= 3620);
  const tableRunInTx = runInTransactionCalls.filter(c => c.line >= 3580 && c.line <= 3620);
  test('#12 server.js:3604 台桌同步使用 runInTransaction',
    tableDbTxAsync.length === 0 && tableRunInTx.length > 0,
    tableDbTxAsync.length === 0 && tableRunInTx.length > 0
      ? '✓ 已使用 runInTransaction'
      : `❌ dbTxAsync 调用: ${tableDbTxAsync.map(c => `L${c.line}`).join(', ') || '无'}，runInTransaction: ${tableRunInTx.map(c => `L${c.line}`).join(', ') || '无'}`
  );

  // 全局统计
  console.log(`\n  📊 server.js 事务调用统计:`);
  console.log(`     dbTx 调用: ${dbTxCalls.length} 处 [${dbTxCalls.map(c => `L${c.line}`).join(', ')}]`);
  console.log(`     dbTxAsync 调用: ${dbTxAsyncCalls.length} 处 [${dbTxAsyncCalls.map(c => `L${c.line}`).join(', ')}]`);
  console.log(`     runInTransaction 调用: ${runInTransactionCalls.length} 处 [${runInTransactionCalls.map(c => `L${c.line}`).join(', ')}]`);
}

// ============================================================
// 汇总
// ============================================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 测试结果汇总');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  ✅ PASS: ${passCount}`);
console.log(`  ❌ FAIL: ${failCount}`);
console.log(`  📝 TOTAL: ${passCount + failCount}`);

if (failCount > 0) {
  console.log('\n  ⚠️  以下测试未通过，需要修复：');
  results.filter(r => !r.passed).forEach((r, i) => {
    console.log(`    ${i + 1}. ${r.name}`);
    if (r.detail) console.log(`       ${r.detail}`);
  });
} else {
  console.log('\n  🎉  所有测试通过！编码规范修复完成！');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

process.exit(failCount > 0 ? 1 : 0);
