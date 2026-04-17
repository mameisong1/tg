# Fix Log - QA-20260417-09 程序员A编码实现

## 修改时间
2026-04-17 18:14

## Git Commit
`tgservice-uniapp`: 3bb5514

## 修改文件清单

### 1. `src/pages/cart/cart.vue`
- **修改位置**: `onShow` 回调
- **修改内容**: 在 `onShow` 开头增加员工身份判断，当 `isEmployee.value` 为 true 时清空 `tableName` 和 `tableAuth` storage，并将 `tableName.value` 置空
- **目的**: 员工每次进入购物车页面时，清除旧的台桌号缓存，避免使用过期的台桌信息

### 2. `src/pages/products/products.vue`
- **修改位置**: `onShow` 回调
- **修改内容**: 在 `onShow` 开头增加员工身份判断，当 `isEmployee.value` 为 true 时清空 `tableName` 和 `tableAuth` storage，并将 `tableName.value` 置空
- **目的**: 员工每次进入商品页面时，清除旧的台桌号缓存，避免使用过期的台桌信息

### 3. `src/pages/internal/service-order.vue`
- **修改1**: 移除 `onMounted` 中的 `loadDefaultTable()` 调用
  - 原来：已上桌助教进入页面时自动加载水牌台桌号
  - 现在：不再自动加载，改为点击台桌号字段时智能处理
  
- **修改2**: 新增 `onShow` 回调清空台桌号
  - 每次页面显示时清空 `form.value.table_no`，要求重新选择
  
- **修改3**: 新增 `handleTableFieldClick` 方法
  - 助教单台桌：自动选中并设置 storage，不弹出选择器
  - 助教多台桌：不自动选中，弹出选择器
  - 非助教/获取失败：弹出选择器
  
- **修改4**: 模板中台桌号字段点击事件改为 `@click="handleTableFieldClick"`

- **修改5**: 引入 `onShow` from `@dcloudio/uni-app`

## 编码规范检查
- ✅ 无时间处理相关修改（纯前端逻辑）
- ✅ 无数据库操作（纯前端逻辑）
- ✅ 无页面显示 coach_no
