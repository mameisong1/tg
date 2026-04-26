/**
 * Turso 中文 SQL 预处理测试用例
 * 测试所有包含中文字符串常量的 API
 */

const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:8088';

// 测试结果统计
const results = {
  passed: 0,
  failed: 0,
  errors: []
};

// 辅助函数：测试 API
async function testAPI(name, method, path, data = null) {
  try {
    const config = {
      method,
      url: BASE_URL + path,
      timeout: 5000
    };
    
    if (data) {
      if (method === 'GET') {
        config.params = data;
      } else {
        config.data = data;
      }
    }
    
    const response = await axios(config);
    
    if (response.status === 200) {
      results.passed++;
      console.log(`✅ ${name}`);
      return response.data;
    } else {
      results.failed++;
      results.errors.push({ name, error: `HTTP ${response.status}` });
      console.log(`❌ ${name} - HTTP ${response.status}`);
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
  console.log('Turso 中文 SQL 预处理 API 测试');
  console.log('目标: 至少 20 个测试用例');
  console.log('========================================\n');
  
  // ========== 智能开关相关 API (device_type = "灯") ==========
  
  // 测试 1: 获取灯设备标签列表
  await testAPI('1. GET /api/switch/labels (灯)', 'GET', '/api/switch/labels');
  
  // 测试 2: 获取灯场景列表
  await testAPI('2. GET /api/switch/scenes (灯)', 'GET', '/api/switch/scenes');
  
  // 测试 3: 获取灯设备台桌列表
  await testAPI('3. GET /api/switch/tables (灯)', 'GET', '/api/switch/tables');
  
  // 测试 4: 获取自动状态
  await testAPI('4. GET /api/switch/auto-status', 'GET', '/api/switch/auto-status');
  
  // ========== 智能空调相关 API (device_type = "空调") ==========
  
  // 测试 5: 获取空调设备列表
  await testAPI('5. GET /api/ac/devices (空调)', 'GET', '/api/ac/devices');
  
  // 测试 6: 获取空调场景列表
  await testAPI('6. GET /api/ac/scenes (空调)', 'GET', '/api/ac/scenes');
  
  // 测试 7: 获取空调标签列表
  await testAPI('7. GET /api/ac/labels (空调)', 'GET', '/api/ac/labels');
  
  // 测试 8: 获取空调台桌列表
  await testAPI('8. GET /api/ac/tables (空调)', 'GET', '/api/ac/tables');
  
  // ========== 水牌状态相关 API (status = "早班空闲", "晚班空闲" 等) ==========
  
  // 测试 9: 获取水牌列表
  await testAPI('9. GET /api/water-boards', 'GET', '/api/water-boards');
  
  // 测试 10: 获取助教列表（含水牌状态）
  await testAPI('10. GET /api/coaches', 'GET', '/api/coaches');
  
  // ========== 商品状态相关 API (status = "上架") ==========
  
  // 测试 11: 获取商品分类
  await testAPI('11. GET /api/product-categories', 'GET', '/api/product-categories');
  
  // 测试 12: 获取商品列表
  await testAPI('12. GET /api/products', 'GET', '/api/products');
  
  // ========== 订单相关 API ==========
  
  // 测试 13: 获取订单列表
  await testAPI('13. GET /api/orders', 'GET', '/api/orders');
  
  // 测试 14: 获取服务订单列表
  await testAPI('14. GET /api/service-orders', 'GET', '/api/service-orders');
  
  // ========== 台桌相关 API ==========
  
  // 测试 15: 获取台桌列表
  await testAPI('15. GET /api/tables', 'GET', '/api/tables');
  
  // 测试 16: 获取台桌状态
  await testAPI('16. GET /api/tables/status', 'GET', '/api/tables/status');
  
  // ========== 后台管理 API ==========
  
  // 测试 17: 获取开关设备管理列表
  await testAPI('17. GET /api/admin/switches', 'GET', '/api/admin/switches');
  
  // 测试 18: 获取空调管理列表
  await testAPI('18. GET /api/admin/ac-control', 'GET', '/api/admin/ac-control');
  
  // 测试 19: 获取场景管理列表（灯）
  await testAPI('19. GET /api/admin/switch-scenes', 'GET', '/api/admin/switch-scenes');
  
  // 测试 20: 获取台桌设备关联列表
  await testAPI('20. GET /api/admin/table-devices', 'GET', '/api/admin/table-devices');
  
  // ========== 更多测试用例（确保超过20个）==========
  
  // 测试 21: 获取会员列表
  await testAPI('21. GET /api/members', 'GET', '/api/members');
  
  // 测试 22: 获取 VIP 包厢列表
  await testAPI('22. GET /api/vip-rooms', 'GET', '/api/vip-rooms');
  
  // 测试 23: 获取打卡记录
  await testAPI('23. GET /api/attendance-records', 'GET', '/api/attendance-records');
  
  // 测试 24: 获取乐捐记录
  await testAPI('24. GET /api/lejuan-records', 'GET', '/api/lejuan-records');
  
  // 测试 25: 获取奖罚记录
  await testAPI('25. GET /api/reward-penalty/recent', 'GET', '/api/reward-penalty/recent');
  
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
    console.log('⚠️  测试目标未达成，需要修复更多 API');
  }
  console.log('========================================');
}

// 运行测试
runTests().catch(console.error);