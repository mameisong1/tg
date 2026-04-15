# QA4 技术方案：水牌管理/水牌查看页面改进

> 设计人：程序员A4 | 日期：2026-04-15

---

## 一、需求分析

### 需求1：手机屏幕宽度不够时自适应
- **筛选按钮**：12个按钮（全部 + 11种状态）在窄屏上自动折行
- **水牌卡片**：助教圆形卡片在窄屏上自动折行

### 需求2：每隔30秒自动刷新数据
- **水牌管理**（`water-board.vue`）：定时刷新，保持数据实时
- **水牌查看**（`water-board-view.vue`）：定时刷新，保持数据实时

---

## 二、现有代码分析

### 涉及文件

| 文件 | 说明 |
|------|------|
| `tgservice-uniapp/src/pages/internal/water-board.vue` | 水牌管理页面（可编辑状态） |
| `tgservice-uniapp/src/pages/internal/water-board-view.vue` | 水牌查看页面（只读） |
| `tgservice-uniapp/src/utils/api-v2.js` | API工具（waterBoards.getList） |
| `tgservice-uniapp/src/utils/time-util.js` | 前端时间工具 |
| `tgservice/backend/routes/water-boards.js` | 后端水牌API |

### 现有CSS状态（已有部分自适应）

当前两个页面的CSS **已设置** `flex-wrap: wrap`，理论上已支持折行：

```css
/* 筛选按钮栏 */
.filter-bar { display: flex; flex-wrap: wrap; padding: 8px 12px; gap: 6px; }

/* 助教卡片容器 */
.coach-chips { display: flex; flex-wrap: wrap; gap: 10px/12px; }
```

**问题诊断**：
- `flex-wrap: wrap` 确实已存在，但缺少媒体查询来优化窄屏体验
- 助教卡片 `width: 80px` 固定宽度，在极窄屏（<360px）上每行只能排4个，间距过大
- 筛选按钮 `font-size: 12px` + `padding: 6px 12px`，在窄屏上每个按钮约70-90px宽，12个按钮必然多行折行（这是正确的）
- **核心问题**：没有 `@media` 查询来针对不同屏幕宽度优化间距和尺寸

### 现有刷新机制
- 水牌管理页面：有手动刷新按钮（🔄），调用 `loadData()`
- 水牌查看页面：**无**刷新按钮，仅 `onMounted` 时加载一次
- **两个页面都没有自动刷新机制**

---

## 三、技术方案

### 3.1 需求1：CSS响应式变更

#### 方案：添加媒体查询优化窄屏布局

**目标屏幕断点**：

| 断点 | 屏幕宽度 | 策略 |
|------|----------|------|
| 默认 | > 420px | 保持现有布局 |
| 窄屏 | ≤ 420px | 缩小间距和字号 |
| 极窄屏 | ≤ 360px | 进一步缩小卡片尺寸 |

#### 3.1.1 水牌管理页面（water-board.vue）CSS变更

在 `<style scoped>` 末尾追加：

```css
/* === 窄屏响应式优化 === */

/* 窄屏：≤420px */
@media (max-width: 420px) {
  .filter-bar {
    gap: 4px;
    padding: 6px 8px;
  }
  .filter-item {
    padding: 5px 8px;
    font-size: 11px;
  }
  .coach-chips {
    gap: 6px;
  }
  .coach-chip {
    width: 68px;
    padding: 6px 2px;
  }
  .coach-chip-avatar {
    width: 40px;
    height: 40px;
  }
  .coach-chip-id {
    font-size: 11px;
  }
  .coach-chip-name {
    font-size: 11px;
    max-width: 60px;
  }
  .coach-chip-table {
    font-size: 9px;
  }
  .status-section {
    padding: 8px;
    margin-bottom: 8px;
  }
}

/* 极窄屏：≤360px */
@media (max-width: 360px) {
  .filter-bar {
    gap: 3px;
    padding: 4px 6px;
  }
  .filter-item {
    padding: 4px 6px;
    font-size: 10px;
    border-radius: 12px;
  }
  .coach-chips {
    gap: 4px;
  }
  .coach-chip {
    width: 60px;
    padding: 4px 2px;
  }
  .coach-chip-avatar {
    width: 34px;
    height: 34px;
    border-width: 1px;
  }
  .coach-chip-id {
    font-size: 10px;
  }
  .coach-chip-name {
    font-size: 10px;
    max-width: 52px;
  }
  .coach-chip-table {
    font-size: 8px;
  }
  .board-list {
    padding: 0 8px 8px;
  }
}
```

#### 3.1.2 水牌查看页面（water-board-view.vue）CSS变更

同样在 `<style scoped>` 末尾追加相同结构的媒体查询，但使用查看页面特有的类名（`.coach-avatar` 而非 `.coach-chip-avatar`）：

```css
/* === 窄屏响应式优化 === */

/* 窄屏：≤420px */
@media (max-width: 420px) {
  .filter-bar { gap: 4px; padding: 6px 8px; }
  .filter-item { padding: 5px 8px; font-size: 11px; }
  .coach-chips { gap: 6px; }
  .coach-chip { width: 68px; padding: 6px 2px; }
  .coach-avatar { width: 40px; height: 40px; }
  .coach-id { font-size: 11px; }
  .coach-name { font-size: 11px; max-width: 60px; }
  .coach-table { font-size: 9px; }
  .status-section { padding: 8px; margin-bottom: 8px; }
}

/* 极窄屏：≤360px */
@media (max-width: 360px) {
  .filter-bar { gap: 3px; padding: 4px 6px; }
  .filter-item { padding: 4px 6px; font-size: 10px; border-radius: 12px; }
  .coach-chips { gap: 4px; }
  .coach-chip { width: 60px; padding: 4px 2px; }
  .coach-avatar { width: 34px; height: 34px; border-width: 1px; }
  .coach-id { font-size: 10px; }
  .coach-name { font-size: 10px; max-width: 52px; }
  .coach-table { font-size: 8px; }
  .board-list { padding: 0 8px 8px; }
}
```

> **注意**：水牌查看页面的放大弹窗（`.expand-chip` 等）也需要响应式优化，但弹窗本身 `max-width: 600px` + `width: 90%` 已能自适应，无需额外修改。

### 3.2 需求2：30秒自动刷新

#### 方案：`setInterval` 定时轮询

**核心逻辑**：
1. `onMounted` 时启动定时器，每30秒调用 `loadData()`
2. `onUnmounted` 时清除定时器，避免内存泄漏
3. 刷新时静默更新，不打断用户操作（不弹提示）
4. 水牌管理页面保留手动刷新按钮，作为即时刷新手段

#### 3.2.1 水牌管理页面（water-board.vue）

在 `<script setup>` 中修改：

```javascript
// 已有的导入中追加 onUnmounted
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ===== 自动刷新机制 =====
let refreshTimer = null
const REFRESH_INTERVAL = 30000 // 30秒

// 在 onMounted 中启动定时器
onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  const adminInfo = uni.getStorageSync('adminInfo') || {}
  isEditable.value = ['店长', '助教管理'].includes(adminInfo.role)
  loadData()
  // 启动30秒自动刷新
  refreshTimer = setInterval(() => {
    loadData() // 静默刷新，不弹提示
  }, REFRESH_INTERVAL)
})

// 新增 onUnmounted 清理定时器
onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
```

> **已有的 `onUnmounted`**：H5环境下的长按事件清理已存在，需要合并到同一个 `onUnmounted` 中。

**合并后的完整 `onUnmounted`**（注意条件编译块也要加上定时器清理）：

```javascript
// H5 环境下的长按事件清理
// #ifdef H5
onUnmounted(() => {
  document.removeEventListener('contextmenu', contextmenuHandler, true)
  document.removeEventListener('selectstart', selectstartHandler, true)
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
// #endif

// 非H5环境的定时器清理
// #ifndef H5
onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
// #endif
```

#### 3.2.2 水牌查看页面（water-board-view.vue）

在 `<script setup>` 中添加：

```javascript
// 修改导入，追加 onUnmounted
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ===== 自动刷新机制 =====
let refreshTimer = null
const REFRESH_INTERVAL = 30000 // 30秒

// 修改 onMounted，追加定时器启动
onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  loadData()
  // 启动30秒自动刷新
  refreshTimer = setInterval(() => {
    loadData() // 静默刷新
  }, REFRESH_INTERVAL)
})

// 新增 onUnmounted
onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
```

---

## 四、编码规范遵守检查

| 规范 | 遵守情况 |
|------|----------|
| 时间处理用时间类 | ✅ 现有代码已使用 `new Date(time + '+08:00')` 显式指定时区，无需改动。本次不涉及时间写入。 |
| db操作复用 db/index.js | ✅ 本次仅修改前端Vue页面，不涉及后端db操作。 |
| db写入用 writeQueue 队列 | ✅ 本次不涉及db写入。 |

---

## 五、修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `tgservice-uniapp/src/pages/internal/water-board.vue` | 1. `<style scoped>` 追加响应式媒体查询<br>2. `<script setup>` 添加自动刷新逻辑（`setInterval` + `onUnmounted` 清理） |
| `tgservice-uniapp/src/pages/internal/water-board-view.vue` | 1. `<style scoped>` 追加响应式媒体查询<br>2. `<script setup>` 添加自动刷新逻辑（`setInterval` + `onUnmounted` 清理） |

**无需修改后端**：API `GET /api/water-boards` 已满足刷新需求。

---

## 六、风险评估

| 风险 | 等级 | 应对 |
|------|------|------|
| 频繁刷新导致服务器压力 | 低 | 30秒间隔较长，且API查询简单（单SQL），无压力 |
| 页面隐藏后定时器仍在运行 | 低 | `onUnmounted` 会清除定时器；uniapp页面切换会触发unmount |
| CSS媒体查询与uniapp H5兼容性 | 低 | 标准CSS `@media` 查询，所有现代浏览器支持 |
| 刷新时打断用户操作 | 低 | `loadData()` 仅更新数据，不弹窗、不跳转，用户无感知 |

---

## 七、测试建议

1. **响应式测试**：
   - Chrome DevTools 模拟 iPhone SE（375px）、iPhone 12 mini（375px）、Galaxy Fold（280px展开态）
   - 验证筛选按钮是否正常折行、助教卡片是否正常折行
   - 验证卡片在窄屏上不会互相重叠或溢出

2. **自动刷新测试**：
   - 打开页面后观察30秒，确认数据自动更新
   - 在其他标签页修改某助教状态，等待30秒确认页面自动同步
   - 离开页面（返回上一页）后确认定时器已清理（无后台请求）
   - 手动刷新按钮与自动刷新共存，互不干扰
