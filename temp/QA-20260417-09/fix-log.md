# 修复记录 - QA-20260417-09

**修复人**: 程序员A (阿天)
**修复时间**: 2026-04-17 19:24
**Git Commit**: `a00e5fa`

---

## Bug 1: TC-BR-01 - 普通用户 tableName 被清空

**文件**: `src/pages/products/products.vue`

**问题描述**: 未登录用户（普通顾客）设置 tableName="VIP3" 后进入商品页，tableName 被清空。

**根因分析**: 
- `products.vue` 的 `onShow` 中，员工清空逻辑在 `if (isEmployee.value)` 内
- 但非员工用户在 `onShow` 时没有重新从 storage 读取 `tableName`
- `tableName` 是组件初始化时从 storage 读取一次，之后不再刷新
- 如果其他页面（如 cart.vue）误清了 storage 中的 tableName，回到商品页时 ref 值仍然是空的

**修复内容**:
```javascript
// 修改前：非员工 onShow 时不刷新 tableName
onShow(() => {
  if (isEmployee.value) {
    uni.removeStorageSync('tableName')
    uni.removeStorageSync('tableAuth')
    tableName.value = ''
  }
  // ... 原有逻辑
})

// 修改后：非员工 onShow 时重新读取 tableName
onShow(() => {
  if (isEmployee.value) {
    uni.removeStorageSync('tableName')
    uni.removeStorageSync('tableAuth')
    tableName.value = ''
  } else {
    // 普通用户：重新读取 tableName 防止被其他页面误清
    tableName.value = uni.getStorageSync('tableName') || ''
  }
  // ... 原有逻辑
})
```

**注意**: 经排查发现 `cart.vue` 的 `onShow` 中也有类似的员工清空逻辑（在 `if` 内清空后又在 `if` 外重新读取 tableName），cart 页面的代码实际上不会导致问题（清空后又重新读了）。products 页面的问题在于没有 else 分支来重新读取。

---

## Bug 2: F4 - 单台桌自动选中未触发

**文件**: `src/pages/internal/service-order.vue`

**问题描述**: 助教（coach_no=10011）水牌状态为"晚班上桌"、table_no="VIP3"（单台桌），进入服务下单页点击台桌号字段后，未自动选中VIP3。

**根因分析**: 
- 代码逻辑本身是正确的：检查 `coachInfo.value?.coachNo` → 调用 `api.waterBoards.getOne()` → 判断 `isOnTable` → 单台桌自动选中
- 需要添加详细调试日志来定位到底是哪一步出了问题

**可能的原因**:
1. `coachInfo.value.coachNo` 为空（coachInfo 未正确加载）
2. `api.waterBoards.getOne()` 返回的数据格式与预期不同
3. `waterStatus` 不是 '早班上桌' 或 '晚班上桌'
4. `waterTableNo` 为空或解析异常

**修复内容**: 在 `handleTableFieldClick` 方法中增加详细的 console.log 调试信息：
- 输出 `coachInfo` 和 `coachNo` 值
- 输出 API 返回的完整 response
- 输出 `waterStatus`、`waterTableNo`、`isOnTable` 判断结果
- 输出 `tableList` 解析结果和长度
- 输出每个分支的走向（自动选中/多台桌/不满足条件/无 coachNo）

**后续排查**: 部署后通过浏览器控制台查看 `[service-order]` 开头的日志，确定具体卡在哪一步。

---

## 修改文件清单

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `src/pages/products/products.vue` | 修复 | onShow 增加 else 分支，非员工重新读取 tableName |
| `src/pages/internal/service-order.vue` | 调试 | handleTableFieldClick 增加详细 console.log |
