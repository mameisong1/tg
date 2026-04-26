/**
 * Turso 中文 SQL 预处理测试用例 - 数据库层测试
 * 直接测试 db.all/get/run 方法，无需 API 认证
 */

const db = require('./db/index');

// 测试结果统计
const results = {
  passed: 0,
  failed: 0,
  errors: []
};

// 辅助函数：测试 SQL
async function testSQL(name, sql, params = [], expectMinRows = 0) {
  try {
    const rows = await db.all(sql, params);
    
    if (rows !== null && rows !== undefined) {
      if (rows.length >= expectMinRows) {
        results.passed++;
        console.log(`✅ ${name} - 返回 ${rows.length} 条数据`);
        return rows;
      } else {
        results.failed++;
        results.errors.push({ name, error: `期望至少 ${expectMinRows} 条，实际 ${rows.length} 条` });
        console.log(`⚠️ ${name} - 返回 ${rows.length} 条数据（期望至少 ${expectMinRows} 条）`);
        return rows;
      }
    } else {
      results.failed++;
      results.errors.push({ name, error: '返回 null 或 undefined' });
      console.log(`❌ ${name} - 返回 null`);
      return null;
    }
  } catch (e) {
    results.failed++;
    results.errors.push({ name, error: e.message });
    console.log(`❌ ${name} - ${e.message}`);
    return null;
  }
}

// 主测试函数
async function runTests() {
  console.log('========================================');
  console.log('Turso 中文 SQL 预处理测试');
  console.log('目标: 至少 20 个测试用例');
  console.log('========================================\n');
  
  // ========== 智能开关相关 SQL (device_type = "灯") ==========
  
  await testSQL('1. 灯设备标签列表', 'SELECT DISTINCT switch_label FROM switch_device WHERE device_type = "灯" AND switch_label != "" ORDER BY switch_label', [], 1);
  
  await testSQL('2. 灯场景列表', 'SELECT * FROM switch_scene WHERE device_type = "灯" ORDER BY sort_order, id', [], 0);
  
  await testSQL('3. 灯设备台桌关联', 'SELECT td.table_name_en, sd.switch_id FROM table_device td INNER JOIN switch_device sd ON td.switch_seq = sd.switch_seq AND sd.device_type = "灯" LIMIT 5', [], 1);
  
  await testSQL('4. 灯设备完整列表', 'SELECT * FROM switch_device WHERE device_type = "灯" ORDER BY switch_label LIMIT 10', [], 1);
  
  // ========== 智能空调相关 SQL (device_type = "空调") ==========
  
  await testSQL('5. 空调设备列表', 'SELECT * FROM switch_device WHERE device_type = "空调" ORDER BY switch_label LIMIT 10', [], 1);
  
  await testSQL('6. 空调场景列表', 'SELECT * FROM switch_scene WHERE device_type = "空调" ORDER BY sort_order, id', [], 0);
  
  await testSQL('7. 空调标签列表', 'SELECT DISTINCT switch_label FROM switch_device WHERE device_type = "空调" AND switch_label != "" ORDER BY switch_label', [], 1);
  
  await testSQL('8. 空调台桌关联', 'SELECT td.table_name_en, sd.switch_id FROM table_device td INNER JOIN switch_device sd ON td.switch_seq = sd.switch_seq AND sd.device_type = "空调" LIMIT 5', [], 1);
  
  // ========== 水牌状态相关 SQL (status 中文值) ==========
  
  await testSQL('9. 早班空闲水牌', 'SELECT * FROM water_boards WHERE status = "早班空闲" LIMIT 10', [], 0);
  
  await testSQL('10. 晚班空闲水牌', 'SELECT * FROM water_boards WHERE status = "晚班空闲" LIMIT 10', [], 0);
  
  await testSQL('11. 早班上桌水牌', 'SELECT * FROM water_boards WHERE status = "早班上桌" LIMIT 10', [], 0);
  
  await testSQL('12. 晚班上桌水牌', 'SELECT * FROM water_boards WHERE status = "晚班上桌" LIMIT 10', [], 0);
  
  await testSQL('13. 下班水牌', 'SELECT * FROM water_boards WHERE status = "下班" LIMIT 10', [], 0);
  
  // ========== 商品状态相关 SQL ==========
  
  await testSQL('14. 上架商品', 'SELECT * FROM products WHERE status = "上架" LIMIT 10', [], 0);
  
  // ========== 台桌状态相关 SQL ==========
  
  await testSQL('15. 空闲台桌', 'SELECT * FROM tables WHERE status = "空闲" LIMIT 10', [], 0);
  
  await testSQL('16. 使用中台桌', 'SELECT * FROM tables WHERE status = "使用" LIMIT 10', [], 0);
  
  // ========== MQTT 服务相关 SQL ==========
  
  await testSQL('17. MQTT灯设备查询', 'SELECT DISTINCT switch_id, switch_seq FROM switch_device WHERE switch_label = ? AND device_type = "灯"', ['1'], 0);
  
  await testSQL('18. MQTT空调设备查询', 'SELECT DISTINCT switch_id, switch_seq FROM switch_device WHERE switch_label = ? AND device_type = "空调"', ['1'], 0);
  
  // ========== 员工性别相关 SQL ==========
  
  await testSQL('19. 女性助教', 'SELECT coach_no, employee_id FROM coaches WHERE gender = "女" LIMIT 10', [], 0);
  
  await testSQL('20. 男性助教', 'SELECT coach_no, employee_id FROM coaches WHERE gender = "男" LIMIT 10', [], 0);
  
  // ========== 会员状态相关 SQL ==========
  
  await testSQL('21. 有效会员', 'SELECT * FROM members WHERE status = "有效" LIMIT 10', [], 0);
  
  // ========== 基础查询测试（无中文）==========
  
  await testSQL('22. 助教总数', 'SELECT COUNT(*) as cnt FROM coaches', [], 1);
  
  await testSQL('23. 台桌总数', 'SELECT COUNT(*) as cnt FROM tables', [], 1);
  
  await testSQL('24. 开关设备总数', 'SELECT COUNT(*) as cnt FROM switch_device', [], 1);
  
  await testSQL('25. 场景总数', 'SELECT COUNT(*) as cnt FROM switch_scene', [], 1);
  
  // ========== 输出测试结果 ==========
  
  console.log('\n========================================');
  console.log('测试结果统计');
  console.log('========================================');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`总计: ${results.passed + results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\n失败详情:');
    results.errors.forEach(e => {
      console.log(`  - ${e.name}: ${e.error}`);
    });
  }
  
  console.log('\n========================================');
  if (results.passed >= 20) {
    console.log('🎉 测试目标达成！至少 20 个测试用例通过');
  } else {
    console.log('⚠️  测试目标未达成，需要修复更多 SQL');
  }
  console.log('========================================');
}

// 运行测试
runTests().catch(console.error);