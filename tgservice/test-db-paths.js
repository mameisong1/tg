/**
 * 全面测试 index-turso.js 所有 DB 操作路径
 * 确保 SQL 审计改动没有引入任何回归
 */
require('dotenv').config();
const { db, all, get, run, runInTransaction, beginTransaction, dbTx, dbTxAsync, enqueueRun } = require('./backend/db/index');
const TimeUtil = require('./backend/utils/time');
const fs = require('fs');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}`);
    failed++;
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function testAllExport() {
  console.log('\n=== 1. all() 导出函数 ===');
  
  // 基本查询
  const rows = await all('SELECT * FROM coaches LIMIT 5');
  assert(Array.isArray(rows), 'all() 返回数组');
  assert(rows.length <= 5, 'all() LIMIT 5 生效');
  assert(rows.length > 0, 'all() 有数据返回');
  assert(rows[0].coach_no !== undefined, 'all() 字段正确');
  
  // 带参数查询
  const rows2 = await all('SELECT * FROM coaches WHERE shift = ? LIMIT 5', ['早班']);
  assert(Array.isArray(rows2), 'all() 带参数返回数组');
  
  // 空结果
  const rows3 = await all('SELECT * FROM coaches WHERE coach_no = ?', ['NOTEXIST999']);
  assert(Array.isArray(rows3) && rows3.length === 0, 'all() 空结果返回空数组');
  
  // 大查询（触发审计）
  fs.writeFileSync('./logs/sql-audit.log', '', 'utf-8');
  const bigRows = await all('SELECT * FROM cron_log ORDER BY id DESC LIMIT 400');
  assert(Array.isArray(bigRows), 'all() 大查询返回数组');
  const auditContent = fs.readFileSync('./logs/sql-audit.log', 'utf-8').trim();
  const auditEntries = auditContent ? auditContent.split('\n').map(l => JSON.parse(l)) : [];
  const hasAudit = auditEntries.some(e => e.rows >= 300 && e.sql.includes('cron_log'));
  assert(hasAudit, 'all() 大查询触发审计');
}

async function testGetExport() {
  console.log('\n=== 2. get() 导出函数 ===');
  
  const row = await get('SELECT * FROM coaches LIMIT 1');
  assert(row !== undefined && row !== null, 'get() 返回单行对象');
  assert(row.coach_no !== undefined, 'get() 字段正确');
  
  // 空结果
  const row2 = await get('SELECT * FROM coaches WHERE coach_no = ?', ['NOTEXIST999']);
  assert(row2 === undefined, 'get() 空结果返回 undefined');
  
  // 带参数
  const row3 = await get('SELECT * FROM coaches WHERE shift = ? LIMIT 1', ['早班']);
  assert(row3 !== undefined, 'get() 带参数返回结果');
}

async function testRunExport() {
  console.log('\n=== 3. run() 导出函数 ===');
  
  // 先创建一条测试数据
  const testId = 'TEST_DB_PATH_' + Date.now();
  const insertResult = await run(
    'INSERT INTO operation_logs (operator_phone, operation_type, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [testId, '测试', 'test', '0', 'DB路径测试', TimeUtil.nowDB()]
  );
  assert(insertResult.lastID > 0, 'run() INSERT 返回 lastID');
  assert(insertResult.changes === 1, 'run() INSERT changes = 1');
  
  // UPDATE
  const updateResult = await run(
    'UPDATE operation_logs SET detail = ? WHERE operator_phone = ?',
    ['DB路径测试-更新', testId]
  );
  assert(updateResult.changes >= 1, 'run() UPDATE changes >= 1');
  
  // DELETE 清理
  const deleteResult = await run(
    'DELETE FROM operation_logs WHERE operator_phone = ?',
    [testId]
  );
  assert(deleteResult.changes >= 1, 'run() DELETE changes >= 1');
}

async function testEnqueueRun() {
  console.log('\n=== 4. enqueueRun() 写入队列 ===');
  
  const testId = 'TEST_ENQUEUE_' + Date.now();
  const result = await enqueueRun(
    'INSERT INTO operation_logs (operator_phone, operation_type, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [testId, '测试', 'test', '0', 'enqueueRun测试', TimeUtil.nowDB()]
  );
  assert(result.lastID > 0, 'enqueueRun() INSERT 返回 lastID');
  assert(result.changes === 1, 'enqueueRun() INSERT changes = 1');
  
  // 清理
  await enqueueRun('DELETE FROM operation_logs WHERE operator_phone = ?', [testId]);
}

async function testRunInTransaction() {
  console.log('\n=== 5. runInTransaction() ===');
  
  const testId = 'TEST_TX_' + Date.now();
  
  // tx.run()
  const result = await runInTransaction(async (tx) => {
    const r = await tx.run(
      'INSERT INTO operation_logs (operator_phone, operation_type, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [testId, '测试', 'test', '0', 'tx.run测试', TimeUtil.nowDB()]
    );
    return r;
  });
  assert(result.lastID > 0, 'tx.run() INSERT 返回 lastID');
  
  // tx.get()
  const getResult = await runInTransaction(async (tx) => {
    return await tx.get('SELECT * FROM operation_logs WHERE operator_phone = ?', [testId]);
  });
  assert(getResult !== undefined, 'tx.get() 返回结果');
  assert(getResult.operator_phone === testId, 'tx.get() 字段正确');
  
  // tx.all()
  const allResult = await runInTransaction(async (tx) => {
    return await tx.all('SELECT * FROM operation_logs WHERE operator_phone = ?', [testId]);
  });
  assert(Array.isArray(allResult), 'tx.all() 返回数组');
  assert(allResult.length === 1, 'tx.all() 返回正确行数');
  
  // tx.all() 大查询审计
  fs.writeFileSync('./logs/sql-audit.log', '', 'utf-8');
  await runInTransaction(async (tx) => {
    return await tx.all('SELECT * FROM cron_log ORDER BY id DESC LIMIT 400');
  });
  const auditContent = fs.readFileSync('./logs/sql-audit.log', 'utf-8').trim();
  const auditEntries = auditContent ? auditContent.split('\n').map(l => JSON.parse(l)) : [];
  const hasAudit = auditEntries.some(e => e.rows >= 300 && e.sql.includes('cron_log'));
  assert(hasAudit, 'tx.all() 大查询触发审计');
  
  // tx 多步操作
  const multiResult = await runInTransaction(async (tx) => {
    await tx.run(
      'UPDATE operation_logs SET detail = ? WHERE operator_phone = ?',
      ['tx多步测试', testId]
    );
    const updated = await tx.get('SELECT detail FROM operation_logs WHERE operator_phone = ?', [testId]);
    return updated;
  });
  assert(multiResult.detail === 'tx多步测试', 'tx 多步操作正确');
  
  // 清理
  await enqueueRun('DELETE FROM operation_logs WHERE operator_phone = ?', [testId]);
}

async function testBeginTransaction() {
  console.log('\n=== 6. beginTransaction() ===');
  
  const testId = 'TEST_BEGIN_' + Date.now();
  
  const tx = await beginTransaction();
  
  // transaction.run()
  const r = await tx.run(
    'INSERT INTO operation_logs (operator_phone, operation_type, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [testId, '测试', 'test', '0', 'transaction.run测试', TimeUtil.nowDB()]
  );
  assert(r.lastID > 0, 'transaction.run() INSERT 返回 lastID');
  
  // transaction.get()
  const g = await tx.get('SELECT * FROM operation_logs WHERE operator_phone = ?', [testId]);
  assert(g !== undefined, 'transaction.get() 返回结果');
  assert(g.operator_phone === testId, 'transaction.get() 字段正确');
  
  // transaction.all()
  const a = await tx.all('SELECT * FROM operation_logs WHERE operator_phone = ?', [testId]);
  assert(Array.isArray(a), 'transaction.all() 返回数组');
  assert(a.length === 1, 'transaction.all() 返回正确行数');
  
  // transaction.all() 大查询审计
  fs.writeFileSync('./logs/sql-audit.log', '', 'utf-8');
  await tx.all('SELECT * FROM cron_log ORDER BY id DESC LIMIT 400');
  const auditContent = fs.readFileSync('./logs/sql-audit.log', 'utf-8').trim();
  const auditEntries = auditContent ? auditContent.split('\n').map(l => JSON.parse(l)) : [];
  const hasAudit = auditEntries.some(e => e.rows >= 300 && e.sql.includes('cron_log'));
  assert(hasAudit, 'transaction.all() 大查询触发审计');
  
  await tx.commit();
  
  // 清理
  await enqueueRun('DELETE FROM operation_logs WHERE operator_phone = ?', [testId]);
}

async function testDbTx() {
  console.log('\n=== 7. dbTx() 回调风格 ===');
  
  const testId = 'TEST_DBTX_' + Date.now();
  
  const result = await new Promise((resolve, reject) => {
    dbTx((mockDb, done) => {
      mockDb.run(
        'INSERT INTO operation_logs (operator_phone, operation_type, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [testId, '测试', 'test', '0', 'mockDb.run测试', TimeUtil.nowDB()],
        (err, r) => {
          if (err) return done(err);
          
          mockDb.get('SELECT * FROM operation_logs WHERE operator_phone = ?', [testId], (err2, row) => {
            if (err2) return done(err2);
            
            mockDb.all('SELECT * FROM operation_logs WHERE operator_phone = ?', [testId], (err3, rows) => {
              if (err3) return done(err3);
              done(null, { insertResult: r, getResult: row, allResult: rows });
            });
          });
        }
      );
    }).then(resolve).catch(reject);
  });
  
  assert(result.insertResult.lastID > 0, 'mockDb.run() INSERT 返回 lastID');
  assert(result.getResult !== undefined, 'mockDb.get() 返回结果');
  assert(Array.isArray(result.allResult), 'mockDb.all() 返回数组');
  assert(result.allResult.length === 1, 'mockDb.all() 返回正确行数');
  
  // mockDb.all() 大查询审计
  fs.writeFileSync('./logs/sql-audit.log', '', 'utf-8');
  await new Promise((resolve, reject) => {
    dbTx((mockDb, done) => {
      mockDb.all('SELECT * FROM cron_log ORDER BY id DESC LIMIT 400', [], (err, rows) => {
        if (err) return done(err);
        done(null, rows);
      });
    }).then(resolve).catch(reject);
  });
  const auditContent = fs.readFileSync('./logs/sql-audit.log', 'utf-8').trim();
  const auditEntries = auditContent ? auditContent.split('\n').map(l => JSON.parse(l)) : [];
  const hasAudit = auditEntries.some(e => e.rows >= 300 && e.sql.includes('cron_log'));
  assert(hasAudit, 'mockDb.all() 大查询触发审计');
  
  // 清理
  await enqueueRun('DELETE FROM operation_logs WHERE operator_phone = ?', [testId]);
}

async function testDbTxAsync() {
  console.log('\n=== 8. dbTxAsync() ===');
  
  const testId = 'TEST_DBTXASYNC_' + Date.now();
  
  const result = await dbTxAsync(async (mockDb) => {
    await new Promise((resolve, reject) => {
      mockDb.run(
        'INSERT INTO operation_logs (operator_phone, operation_type, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [testId, '测试', 'test', '0', 'dbTxAsync测试', TimeUtil.nowDB()],
        (err) => { if (err) reject(err); else resolve(); }
      );
    });
    
    const row = await new Promise((resolve, reject) => {
      mockDb.get('SELECT * FROM operation_logs WHERE operator_phone = ?', [testId], (err, r) => {
        if (err) reject(err); else resolve(r);
      });
    });
    
    return row;
  });
  
  assert(result !== undefined, 'dbTxAsync mockDb.get() 返回结果');
  assert(result.operator_phone === testId, 'dbTxAsync 字段正确');
  
  // 清理
  await enqueueRun('DELETE FROM operation_logs WHERE operator_phone = ?', [testId]);
}

async function testDbCallbackStyle() {
  console.log('\n=== 9. db 对象回调风格 ===');
  
  // db.all()
  const allRows = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM coaches LIMIT 3', [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
  assert(Array.isArray(allRows), 'db.all() 回调返回数组');
  assert(allRows.length <= 3, 'db.all() LIMIT 3 生效');
  
  // db.get()
  const getRow = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM coaches LIMIT 1', [], (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
  assert(getRow !== undefined, 'db.get() 回调返回对象');
  
  // db.run()
  const testId = 'TEST_DB_CALLBACK_' + Date.now();
  const runResult = await new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO operation_logs (operator_phone, operation_type, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [testId, '测试', 'test', '0', 'db.run回调测试', TimeUtil.nowDB()],
      (err, r) => { if (err) reject(err); else resolve(r); }
    );
  });
  assert(runResult.lastID > 0, 'db.run() 回调返回 lastID');
  
  // db.all() 大查询审计
  fs.writeFileSync('./logs/sql-audit.log', '', 'utf-8');
  await new Promise((resolve, reject) => {
    db.all('SELECT * FROM cron_log ORDER BY id DESC LIMIT 400', [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
  const auditContent = fs.readFileSync('./logs/sql-audit.log', 'utf-8').trim();
  const auditEntries = auditContent ? auditContent.split('\n').map(l => JSON.parse(l)) : [];
  const hasAudit = auditEntries.some(e => e.rows >= 300 && e.sql.includes('cron_log'));
  assert(hasAudit, 'db.all() 回调大查询触发审计');
  
  // 清理
  await new Promise((resolve) => {
    db.run('DELETE FROM operation_logs WHERE operator_phone = ?', [testId], () => resolve());
  });
}

async function testAuditCooldown() {
  console.log('\n=== 10. 审计冷却期 ===');
  
  fs.writeFileSync('./logs/sql-audit.log', '', 'utf-8');
  
  // 同一 SQL 第一次应记录
  await all('SELECT * FROM cron_log ORDER BY id DESC LIMIT 400');
  let content = fs.readFileSync('./logs/sql-audit.log', 'utf-8').trim();
  let entries = content ? content.split('\n').map(l => JSON.parse(l)) : [];
  assert(entries.length === 1, '首次查询记录1条审计');
  
  // 同一 SQL 立即再查，冷却期内不记录
  await all('SELECT * FROM cron_log ORDER BY id DESC LIMIT 400');
  content = fs.readFileSync('./logs/sql-audit.log', 'utf-8').trim();
  entries = content ? content.split('\n').map(l => JSON.parse(l)) : [];
  assert(entries.length === 1, '冷却期内不重复记录');
  
  // 不同 SQL 应记录
  await all('SELECT * FROM timer_log ORDER BY id DESC LIMIT 400');
  content = fs.readFileSync('./logs/sql-audit.log', 'utf-8').trim();
  entries = content ? content.split('\n').map(l => JSON.parse(l)) : [];
  assert(entries.length === 2, '不同SQL各记录1条');
}

async function testRealAPIEndpoints() {
  console.log('\n=== 11. 真实 API 端点测试 ===');
  
  // guest-invitations 无 date 参数（3天过滤）
  const gi1 = await all('SELECT COUNT(*) as cnt FROM guest_invitation_results WHERE date >= ?', 
    [TimeUtil.offsetDB(-72).split(' ')[0]]);
  const gi2 = await all('SELECT COUNT(*) as cnt FROM guest_invitation_results');
  assert(gi1[0].cnt <= gi2[0].cnt, 'guest-invitations 3天过滤结果 <= 全量');
  console.log(`    全量: ${gi2[0].cnt}, 3天: ${gi1[0].cnt}`);
  
  // applications approved-recent future_only 模式
  const threeDaysAgo = TimeUtil.offsetDB(-72).split(' ')[0] + ' 00:00:00';
  const app1 = await all('SELECT COUNT(*) as cnt FROM applications WHERE status = 1 AND created_at >= ?', [threeDaysAgo]);
  const app2 = await all('SELECT COUNT(*) as cnt FROM applications WHERE status = 1');
  assert(app1[0].cnt <= app2[0].cnt, 'applications 3天过滤结果 <= 全量');
  console.log(`    全量: ${app2[0].cnt}, 3天: ${app1[0].cnt}`);
}

async function testErrorHandling() {
  console.log('\n=== 12. 错误处理 ===');
  
  // 无效SQL
  let error1 = null;
  try {
    await all('SELECT * FROM nonexistent_table');
  } catch (e) {
    error1 = e;
  }
  assert(error1 !== null, 'all() 无效SQL抛出错误');
  
  // runInTransaction 中错误不影响后续操作
  let error2 = null;
  try {
    await runInTransaction(async (tx) => {
      await tx.all('SELECT * FROM nonexistent_table');
    });
  } catch (e) {
    error2 = e;
  }
  assert(error2 !== null, 'tx.all() 无效SQL抛出错误');
  
  // 错误后正常操作应不受影响
  const normalResult = await all('SELECT 1 as val');
  assert(normalResult[0].val === 1, '错误后正常操作不受影响');
}

// ========== 主流程 ==========
(async () => {
  console.log('🧪 开始全面测试 index-turso.js 所有 DB 路径...');
  console.log(`环境: ${process.env.TGSERVICE_ENV || 'unknown'}`);
  console.log(`数据库: ${process.env.TURSO_DATABASE_URL || 'unknown'}`);
  
  try {
    await testAllExport();
    await testGetExport();
    await testRunExport();
    await testEnqueueRun();
    await testRunInTransaction();
    await testBeginTransaction();
    await testDbTx();
    await testDbTxAsync();
    await testDbCallbackStyle();
    await testAuditCooldown();
    await testRealAPIEndpoints();
    await testErrorHandling();
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 测试结果: ✅ ${passed} 通过, ❌ ${failed} 失败`);
    console.log('='.repeat(50));
    
    process.exit(failed > 0 ? 1 : 0);
  } catch (e) {
    console.error('\n💥 测试异常中断:', e);
    process.exit(1);
  }
})();
