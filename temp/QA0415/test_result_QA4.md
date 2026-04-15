# QA4 测试结果报告：前端H5水牌管理/水牌查看页面改进

**测试日期**：2026-04-15  
**测试员**：B4（阿天）  
**测试环境**：前端 http://127.0.0.1:8089，后端 http://127.0.0.1:8088  
**测试方法**：静态代码分析 + 构建产物分析（浏览器端到端测试因浏览器工具不可用无法执行）

---

## 测试结论：❌ 未通过

当前 H5 构建产物中 **两个核心功能均未编译进去**，所有依赖这两个功能的运行时测试用例均无法通过。

---

## 发现的 Bug

### BUG-01: 🔴 严重 - CSS 响应式媒体查询未编译

| 项目 | 内容 |
|------|------|
| 文件 | `water-board-DjU98EkM.css`, `water-board-view-Cr5Zr8RN.css` |
| 预期 | 包含 `@media (max-width: 420px)` 和 `@media (max-width: 360px)` 规则 |
| 实际 | 0 条 `@media` 规则，0 个 `420px` 或 `360px` 断点 |
| 源代码 | `water-board.vue` 有 2 条 `@media` 规则，`water-board-view.vue` 有 2 条 |
| 影响 | 窄屏和极窄屏的 CSS 响应式适配在 H5 端完全不生效 |

**验证结果**：
```
water-board-DjU98EkM.css:
  @media规则数: 0
  包含420px: 0
  包含360px: 0

water-board-view-Cr5Zr8RN.css:
  @media规则数: 0
  包含420px: 0
  包含360px: 0
```

### BUG-02: 🔴 严重 - 30秒自动刷新定时器未编译

| 项目 | 内容 |
|------|------|
| 文件 | `pages-internal-water-board.ciioox3r.js`, `pages-internal-water-board-view.DgIMH-fh.js` |
| 预期 | 包含 `setInterval(loadData, 30000)` 用于30秒自动刷新 |
| 实际 | 0 次 `setInterval` 调用，0 次 `clearInterval` 调用，0 个 `30000` 常量 |
| 源代码 | 两个源文件各包含 1 次 `setInterval` 和 1 个 `30000` 常量 |
| 影响 | H5 端水牌页面不会自动刷新数据 |

**验证结果**：
```
pages-internal-water-board.ciioox3r.js:
  setInterval调用: 0
  clearInterval调用: 0
  30000常量: 0
  refreshTimer变量: 0

pages-internal-water-board-view.DgIMH-fh.js:
  setInterval调用: 0
  clearInterval调用: 0
  30000常量: 0
  refreshTimer变量: 0
```

---

## 测试用例执行结果

| 用例ID | 描述 | 结果 | 说明 |
|--------|------|------|------|
| TC-01 | 水牌管理 - 标准屏(>420px) | ⏭️ 跳过 | 需要浏览器端到端测试 |
| TC-02 | 水牌管理 - 窄屏(≤420px) | ❌ 失败 | BUG-01: CSS媒体查询未编译 |
| TC-03 | 水牌管理 - 极窄屏(≤360px) | ❌ 失败 | BUG-01: CSS媒体查询未编译 |
| TC-04 | 水牌查看 - 窄屏(≤420px) | ❌ 失败 | BUG-01: CSS媒体查询未编译 |
| TC-05 | 水牌查看 - 极窄屏(≤360px) | ❌ 失败 | BUG-01: CSS媒体查询未编译 |
| TC-06 | 卡片折行测试 | ❌ 失败 | BUG-01: CSS媒体查询未编译 |
| TC-07 | 溢出检测 | ❌ 失败 | BUG-01: CSS媒体查询未编译 |
| TC-08 | 水牌管理 - 30秒自动刷新 | ❌ 失败 | BUG-02: setInterval未编译 |
| TC-09 | 水牌查看 - 30秒自动刷新 | ❌ 失败 | BUG-02: setInterval未编译 |
| TC-10 | 页面卸载后定时器清理 | ❌ 失败 | BUG-02: setInterval未编译 |
| TC-11 | 手动刷新不干扰自动刷新 | ❌ 失败 | BUG-02: setInterval未编译 |
| TC-12 | 连续手动刷新 | ⏭️ 跳过 | 需要浏览器端到端测试 |

**统计**：
- 总计：12 项
- 通过：0 项
- 失败：10 项
- 跳过：2 项（需要浏览器交互测试）

---

## 源代码 vs 构建产物对比

| 特性 | water-board.vue 源码 | water-board-view.vue 源码 | H5构建CSS | H5构建JS |
|------|---------------------|--------------------------|-----------|----------|
| @media (420px) | ✅ 有 | ✅ 有 | ❌ 无 | N/A |
| @media (360px) | ✅ 有 | ✅ 有 | ❌ 无 | N/A |
| setInterval | ✅ 有 | ✅ 有 | N/A | ❌ 无 |
| clearInterval | ✅ 有 | ✅ 有 | N/A | ❌ 无 |
| 30000常量 | ✅ 有 | ✅ 有 | N/A | ❌ 无 |

---

## 根因分析（推测）

### CSS 媒体查询丢失原因

1. **uniapp H5 构建配置问题**：Vue SFC 的 scoped style 中的 `@media` 查询可能在 H5 构建时被 tree-shaking 或未正确处理
2. **Vite/PostCSS 配置**：可能需要检查 `vite.config.js` 中的 CSS 处理插件配置
3. **scoped 样式作用域**：scoped style 的 `@media` 可能需要特殊的处理才能在 H5 中生效

### JS 自动刷新丢失原因

1. **onMounted 多块合并问题**：源文件中存在两个 `onMounted` 调用（一个 `#ifdef H5` 条件块 + 一个共享块），H5 构建可能未正确合并
2. **条件编译干扰**：`#ifdef H5` / `#ifndef H5` 条件编译块可能影响了后续共享代码块的编译
3. **Tree Shaking**：未使用的 `refreshTimer` 变量可能被优化掉了

---

## 建议修复方向

### 1. CSS 媒体查询
- 检查 `vite.config.js` 中 CSS 的 PostCSS 配置
- 尝试将 `@media` 规则移到非 scoped 的 `<style>` 块
- 或使用 CSS-in-JS 方案动态注入样式

### 2. JS 自动刷新
- 将 `onMounted` 的两个块合并为一个
- 移除 `#ifdef H5` / `#ifndef H5` 的条件编译块，使用统一的 `onMounted`
- 示例修复代码：

```javascript
// 替换原来的多个 onMounted/onUnmounted 块为：
onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  const adminInfo = uni.getStorageSync('adminInfo') || {}
  isEditable.value = ['店长', '助教管理'].includes(adminInfo.role)
  
  // #ifdef H5
  // H5 长按阻止逻辑
  // ...
  // #endif
  
  loadData()
  
  // 启动30秒自动刷新（所有环境）
  refreshTimer = setInterval(() => {
    loadData()
  }, REFRESH_INTERVAL)
})

onUnmounted(() => {
  // #ifdef H5
  document.removeEventListener('contextmenu', contextmenuHandler, true)
  document.removeEventListener('selectstart', selectstartHandler, true)
  // #endif
  
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
```

---

## 后续

修复构建问题后需要：
1. 重新构建 H5 前端
2. 重新执行全部 12 项测试用例
3. 重点关注窄屏/极窄屏的 CSS 实际渲染效果
4. 验证 30 秒自动刷新的 network 请求行为
