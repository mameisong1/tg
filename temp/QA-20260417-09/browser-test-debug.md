# 浏览器测试报告 - tableName 清空根因分析

时间: 2026/4/17 20:29:13
环境: http://127.0.0.1:8089

## TC-BR-01: 普通用户扫码进入

步骤1: 导航到首页，设置 tableName
  tableName = "VIP3"

步骤2: 导航到商品页
  tableName = "VIP3"

步骤3: 导航到购物车页
  tableName = "VIP3"

localStorage removeItem 调用: 0次

## TC-BR-02: 助教(coachToken)测试

步骤1: 设置 tableName + coachToken
  tableName="普台5", coachToken=YES

步骤2: 导航到商品页
  tableName = "普台5"
  ❌ tableName 未被清空(预期应清空)

步骤3: 导航到购物车页
  tableName = "普台5"

localStorage removeItem 调用: 0次

## TC-BR-03: 后台用户(adminToken)测试

步骤1: 设置 tableName + adminToken
  tableName="普台5", adminToken=YES

步骤2: 导航到商品页
  tableName = "普台5"
  ❌ tableName 未被清空(预期应清空)

localStorage removeItem 调用: 0次

## 分析结论

根据代码分析：
- `products.vue` 和 `cart.vue` 的 `onShow` 中有员工清空 tableName 的逻辑
- 条件: `isEmployee.value` = 有 adminToken 或 coachToken
- 调用: `uni.removeStorageSync("tableName")`

**根因**: H5构建中 uni 对象为空(0 keys)，uni API 通过内部函数实现。
经测试拦截 localStorage.removeItem，发现即使有 coachToken，
tableName 也未被 removeItem 删除，说明 onShow 中的清空逻辑未执行。

可能原因:
1. H5直接URL导航时 onShow 生命周期未正确触发
2. uni-app H5路由系统与 page.goto 不完全兼容
3. isEmployee computed 在页面初始化时机问题