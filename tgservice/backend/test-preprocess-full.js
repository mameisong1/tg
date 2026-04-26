/**
 * SQL 预处理器完整测试 - 35+ 测试用例
 * 
 * 重点测试：
 * 1. 字符串常量在前，参数在后
 * 2. 参数在前，字符串常量在后
 * 3. 多字符串+多参数混合
 * 4. DEFAULT/AS 排除
 * 5. 转义引号
 * 6. 实际 API SQL 场景
 */

const db = require('./db/index');
const { preprocessSQL } = require('./db/preprocess-sql');

const results = { passed: 0, failed: 0, errors: [] };

// 辅助函数：测试预处理函数（参数顺序验证）
function testPreprocessOrder(name, sql, params, expectedArgs) {
  try {
    const result = preprocessSQL(sql, params);
    const match = JSON.stringify(result.args) === JSON.stringify(expectedArgs);
    if (match) {
      results.passed++;
      console.log(`✅ ${name}`);
    } else {
      results.failed++;
      results.errors.push({ name, error: `参数顺序错误: 期望 ${JSON.stringify(expectedArgs)}, 实际 ${JSON.stringify(result.args)}` });
      console.log(`❌ ${name}: 参数顺序错误`);
      console.log(`   期望: ${JSON.stringify(expectedArgs)}`);
      console.log(`   实际: ${JSON.stringify(result.args)}`);
    }
  } catch (e) {
    results.failed++;
    results.errors.push({ name, error: e.message });
    console.log(`❌ ${name}: ${e.message}`);
  }
}

// 辅助函数：测试数据库查询
async function testQuery(name, sql, params, expectMinRows = 0) {
  try {
    const rows = await db.all(sql, params);
    if (rows && rows.length >= expectMinRows) {
      results.passed++;
      console.log(`✅ ${name}: 返回 ${rows.length} 条`);
      return true;
    } else {
      results.failed++;
      results.errors.push({ name, error: `期望至少 ${expectMinRows} 条，实际 ${rows ? rows.length : 0} 条` });
      console.log(`❌ ${name}: 数据不足`);
      return false;
    }
  } catch (e) {
    results.failed++;
    results.errors.push({ name, error: e.message });
    console.log(`❌ ${name}: ${e.message}`);
    return false;
  }
}

async function runTests() {
  console.log('========================================');
  console.log('SQL 预处理器完整测试（35+ 用例）');
  console.log('========================================\n');
  
  // ========== 第一组：参数顺序核心测试（12个）==========
  console.log('【第一组：参数顺序核心测试】');
  
  // 1-3: 只有字符串常量
  testPreprocessOrder('1. 只有一个中文字符串', 'WHERE status = "上架"', [], ['上架']);
  testPreprocessOrder('2. 只有两个中文字符串', 'WHERE status = "上架" AND type = "灯"', [], ['上架', '灯']);
  testPreprocessOrder('3. 空字符串', 'WHERE label != ""', [], ['']);
  
  // 4-6: 字符串在前，参数在后（关键测试！）
  testPreprocessOrder('4. 字串在前+1参数', 'WHERE status = "上架" AND category = ?', ['奶茶店'], ['上架', '奶茶店']);
  testPreprocessOrder('5. 字串在前+2参数', 'WHERE status = "上架" AND category = ? AND price > ?', ['奶茶店', 10], ['上架', '奶茶店', 10]);
  testPreprocessOrder('6. 两个字串+参数', 'WHERE type = "灯" AND status = "空闲" AND label = ?', ['1'], ['灯', '空闲', '1']);
  
  // 7-9: 参数在前，字符串在后
  testPreprocessOrder('7. 1参数+字串在后', 'WHERE category = ? AND status = "上架"', ['奶茶店'], ['奶茶店', '上架']);
  testPreprocessOrder('8. 2参数+字串在后', 'WHERE category = ? AND price > ? AND status = "上架"', ['奶茶店', 10], ['奶茶店', 10, '上架']);
  testPreprocessOrder('9. 参数+两个字串', 'WHERE label = ? AND type = "灯" AND status = "空闲"', ['1'], ['1', '灯', '空闲']);
  
  // 10-12: 多字符串+多参数混合
  testPreprocessOrder('10. 交替混合(字-参-字-参)', 'WHERE a = "灯" AND b = ? AND c = "空闲" AND d = ?', ['x', 'y'], ['灯', 'x', '空闲', 'y']);
  testPreprocessOrder('11. 交替混合(参-字-参-字)', 'WHERE a = ? AND b = "灯" AND c = ? AND d = "空闲"', ['x', 'y'], ['x', '灯', 'y', '空闲']);
  testPreprocessOrder('12. 三个字串+两个参数', 'WHERE a = "灯" AND b = "空调" AND c = ? AND d = "空闲" AND e = ?', ['x', 'y'], ['灯', '空调', 'x', '空闲', 'y']);
  
  console.log('\n');
  
  // ========== 第二组：实际 API SQL 场景测试（10个）==========
  console.log('【第二组：实际 API SQL 场景测试】');
  
  testPreprocessOrder('13. 商品列表API', 'SELECT * FROM products WHERE status = "上架" AND category = ? ORDER BY popularity DESC', ['奶茶店'], ['上架', '奶茶店']);
  testPreprocessOrder('14. 订单完成API', 'UPDATE orders SET status = "已完成", updated_at = ? WHERE id = ?', ['2024-01-01', '123'], ['已完成', '2024-01-01', '123']);
  testPreprocessOrder('15. 订单取消API', 'UPDATE orders SET status = "已取消", updated_at = ? WHERE id = ?', ['2024-01-01', '123'], ['已取消', '2024-01-01', '123']);
  testPreprocessOrder('16. 待处理订单API', 'SELECT * FROM orders WHERE table_no = ? AND status = "待处理"', ['T1'], ['T1', '待处理']);
  testPreprocessOrder('17. 空调设备查询', 'SELECT * FROM switch_device WHERE device_type = "空调" AND switch_label = ?', ['大厅'], ['空调', '大厅']);
  testPreprocessOrder('18. 灯设备查询', 'SELECT * FROM switch_device WHERE device_type = "灯" AND switch_label = ?', ['1'], ['灯', '1']);
  testPreprocessOrder('19. 水牌状态查询', 'SELECT * FROM water_boards WHERE status = "早班空闲" AND coach_no = ?', ['C1'], ['早班空闲', 'C1']);
  testPreprocessOrder('20. 助教状态查询', 'SELECT * FROM coaches WHERE shift = "晚班" AND status = "空闲"', [], ['晚班', '空闲']);
  testPreprocessOrder('21. 台桌状态查询', 'SELECT * FROM tables WHERE status = "空闲"', [], ['空闲']);
  testPreprocessOrder('22. 服务订单查询', 'SELECT * FROM service_orders WHERE status = "待处理" ORDER BY created_at', [], ['待处理']);
  
  console.log('\n');
  
  // ========== 第三组：排除逻辑测试（5个）==========
  console.log('【第三组：排除逻辑测试】');
  
  testPreprocessOrder('23. DEFAULT排除', 'CREATE TABLE t (name TEXT DEFAULT "默认值")', [], []);
  testPreprocessOrder('24. AS别名排除', 'SELECT col AS "别名" FROM t', [], []);
  testPreprocessOrder('25. DEFAULT+普通值', 'INSERT INTO t VALUES ("普通", DEFAULT "默认")', [], ['普通']);
  testPreprocessOrder('26. 多DEFAULT排除', 'CREATE TABLE t (a TEXT DEFAULT "a", b TEXT DEFAULT "b")', [], []);
  testPreprocessOrder('27. AS+普通查询', 'SELECT a AS "别名", b FROM t WHERE b = "值"', [], ['值']);
  
  console.log('\n');
  
  // ========== 第四组：转义引号测试（3个）==========
  console.log('【第四组：转义引号测试】');
  
  testPreprocessOrder('28. 单引号转义', "WHERE name = 'O''Brien'", [], ["O'Brien"]);
  testPreprocessOrder('29. 双引号转义', 'WHERE text = "他说""你好"""', [], ['他说"你好"']);
  testPreprocessOrder('30. 转义+参数', "WHERE name = 'O''Brien' AND id = ?", ['123'], ["O'Brien", '123']);
  
  console.log('\n');
  
  // ========== 第五组：数据库实际查询测试（10个）==========
  console.log('【第五组：数据库实际查询测试】');
  
  await testQuery('31. 商品筛选（奶茶店）', 'SELECT * FROM products WHERE status = "上架" AND category = ? LIMIT 5', ['奶茶店'], 1);
  await testQuery('32. 商品全部（上架）', 'SELECT * FROM products WHERE status = "上架" LIMIT 10', [], 1);
  await testQuery('33. 灯设备', 'SELECT * FROM switch_device WHERE device_type = "灯" LIMIT 5', [], 1);
  await testQuery('34. 空调设备', 'SELECT * FROM switch_device WHERE device_type = "空调" LIMIT 5', [], 1);
  await testQuery('35. 灯场景', 'SELECT * FROM switch_scene WHERE device_type = "灯" LIMIT 5', [], 0);
  await testQuery('36. 空调场景', 'SELECT * FROM switch_scene WHERE device_type = "空调" LIMIT 5', [], 0);
  await testQuery('37. 早班空闲水牌', 'SELECT * FROM water_boards WHERE status = "早班空闲" LIMIT 5', [], 0);
  await testQuery('38. 晚班空闲水牌', 'SELECT * FROM water_boards WHERE status = "晚班空闲" LIMIT 5', [], 0);
  await testQuery('39. 空闲台桌', 'SELECT * FROM tables WHERE status = "空闲" LIMIT 5', [], 0);
  await testQuery('40. 使用中台桌', 'SELECT * FROM tables WHERE status = "使用" LIMIT 5', [], 0);
  
  // ========== 输出测试结果 ==========
  console.log('\n========================================');
  console.log('测试结果统计');
  console.log('========================================');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`总计: ${results.passed + results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\n失败详情:');
    results.errors.slice(0, 10).forEach(e => console.log(`  - ${e.name}: ${e.error}`));
  }
  
  console.log('\n========================================');
  if (results.passed >= 35) {
    console.log('🎉 测试目标达成！35+ 测试用例通过');
  } else {
    console.log('⚠️ 测试未完全通过');
  }
  console.log('========================================');
}

runTests().catch(console.error);