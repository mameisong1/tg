你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
```
# QA 设计方案：助教和内部员工下单严格化

> **日期**：2026-04-17
> **需求编号**：QA-20260417-09
> **设计者**：程序员A（阿天）

---

## 一、问题描述

助教频繁切换台桌后，系统记住旧台桌号，导致经常下错单到错误的台桌号。

### 根因分析

经调查，台桌号通过 `uni.setStorageSync('tableName', ...)` 持久化存储，在以下场景不会清空：

| 场景 | 当前行为 | 问题 |
|------|----------|------|
| 进入购物车页面 | `onShow` 从 storage 恢复旧值 | 显示旧台桌号 |
| 进入商品点单页 | `onMounted` 从 storage 恢复旧值 | 使用旧台桌号加车 |
| 进入服务下单页 | `onMounted` 从水牌加载默认台桌号 | 自动选中旧台桌号 |

---

## 二、调查结果

### 2.1 台桌号存储位置

| Storage Key | 含义 | 写入位置 |
|-------------|------|----------|
| `tableName` | 台桌名称（如 "普台5"） | 多处 `setStorageSync` |
| `tableAuth` | `{ table, tableName, time }` 授权对象 | 扫码/选桌时写入 |
| `tablePinyin` | 台桌拼音名 | App.vue 扫码时写入 |

### 2.2 涉及的前端页面

| 页面 | 文件路径 | 读取 storage | 写入 storage | 当前验证 |
|------|----------|-------------|-------------|---------|
| 商品点单 | `src/pages/products/products.vue` | ✅ `onMounted` | ✅ `onTableSelected` | ✅ 无台桌号时弹窗选桌 |
| 购物车 | `src/pages/cart/cart.vue` | ✅ `onMounted` + `onShow` | ✅ `onTableSelected` | ✅ 未选台桌号时阻断下单 |
| 服务下单 | `src/pages/internal/service-order.vue` | ❌ 不读 | ✅ `onTableSelected` | ✅ 未选台桌号时阻断提交 |

### 2.3 关键代码位置

**products.vue 第 228 行**（台桌号初始化）：
```javascript
const tableName = ref(uni.getStorageSync('tableName') || '')
```

**cart.vue 第 99 行**（台桌号初始化）：
```javascript
const tableName = ref(uni.getStorageSync('tableName') || '')
```

**service-order.vue 第 115-120 行**（自动加载默认台桌）：
```javascript
onMounted(() => {
  // ...
  if (coachInfo.value?.coachNo) {
    loadDefaultTable()  // ← 自动从水牌加载旧台桌号
  }
})
```

**service-order.vue 第 137 行**（提交验证）：
```javascript
if (!form.value.table_no) return uni.showToast({ title: '请选择台桌', icon: 'none' })
```

### 2.4 涉及的后端 API

| API | 文件 | 说明 |
|-----|------|------|
| `GET /api/coaches/:coachNo/water-status` | `server.js:1015` | 查询助教水牌状态（status + table_no） |
| `POST /api/order` | `server.js:731` | 创建订单，从购物车取 table_no 验证 |
| `POST /api/service-orders` | `routes/service-orders.js` | 创建服务单，验证 table_no 非空 |
| `GET /api/tables` | `server.js` | 获取台桌列表（TableSelector 使用） |

---

## 三、设计方案

### 3.1 需求映射表

| 需求 | 实现方案 | 涉及文件 |
|------|----------|----------|
| ① 进入购物车/商品页自动清空 storage 台桌号 | `onShow` 中判断员工身份，清空 storage | `cart.vue`、`products.vue` |
| ② 未选台桌号下单报错 | 已有验证，保持不变 | - |
| ③ 退出页面后再进入再次清空 | `onShow` 每次触发都清空 | `cart.vue`、`products.vue`、`service-order.vue` |
| ④ 助教上桌且水牌单台桌→点台桌自动选中；多台桌→禁止自动选中 | 台桌选择器打开时查询水牌状态，单台桌自动填充 | `service-order.vue`、`products.vue`、`cart.vue` |

### 3.2 员工身份判断

复用已有逻辑（所有三个页面均已有）：

```javascript
const isEmployee = computed(() => {
  return !!(uni.getStorageSync('adminToken') || uni.getStorageSync('coachToken'))
})
```

### 3.3 详细设计

#### 3.3.1 购物车页面（cart.vue）修改

**修改位置：`onShow` 生命周期**

```javascript
onShow(() => {
  // 【新增】员工进入时清空旧台桌号
  if (isEmployee.value) {
    uni.removeStorageSync('tableName')
    uni.removeStorageSync('tableAuth')
    tableName.value = ''
  }
  
  // 原有逻辑：同步 ref + 加载数据
  tableName.value = uni.getStorageSync('tableName') || ''
  tableInfoRef.value?.loadTableInfo()
  loadCart()
})
```

**下单验证（已有，无需修改）**：
```javascript
if (isEmployee.value) {
  if (!tableName.value) {
    resultTitle.value = '提示'
    resultContent.value = '请先选择台桌号'
    showResultModal.value = true
    return
  }
  // ... 水牌一致性检查
}
```

#### 3.3.2 商品点单页面（products.vue）修改

**修改位置：`onShow` 生命周期**

```javascript
onShow(() => {
  // 【新增】员工进入时清空旧台桌号
  if (isEmployee.value) {
    uni.removeStorageSync('tableName')
    uni.removeStorageSync('tableAuth')
    tableName.value = ''
  }
  
  // 原有逻辑
  tableInfoRef.value?.loadTableInfo()
  loadCart()
  loadProducts().then(() => {
    checkHighlightProduct()
  })
})
```

**加车验证（已有，无需修改）**：
```javascript
if (isEmployee.value) {
  if (!tableName.value) {
    await loadDefaultTableNo()
    showTableSelector.value = true
    return
  }
  // ... 直接加车
}
```

#### 3.3.3 服务下单页面（service-order.vue）修改

**修改 1：移除自动加载默认台桌号（onMounted）**

```javascript
// 修改前：
onMounted(() => {
  // ...
  if (coachInfo.value?.coachNo) {
    loadDefaultTable()  // ❌ 删除此行
  }
})

// 修改后：
onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  adminInfo.value = uni.getStorageSync('adminInfo') || {}
  coachInfo.value = uni.getStorageSync('coachInfo') || {}
  // 不再自动加载默认台桌，要求用户主动选择
})
```

**修改 2：onShow 清空台桌号**

```javascript
onShow(() => {
  // 清空台桌号，要求重新选择
  form.value.table_no = ''
})
```

**修改 3：打开台桌选择器时自动填充（核心逻辑）**

将台桌号点击事件改为异步处理：

```javascript
// 修改前：
// <view class="form-item" @click="showTableSelector = true">

// 修改后：
// <view class="form-item" @click="handleTableFieldClick">

const handleTableFieldClick = async () => {
  // 仅对助教执行自动填充逻辑
  if (coachInfo.value?.coachNo) {
    try {
      const res = await api.waterBoards.getOne(coachInfo.value.coachNo)
      const waterStatus = res.data?.status
      const waterTableNo = res.data?.table_no
      
      // 判断是否为上桌状态
      const isOnTable = waterStatus === '早班上桌' || waterStatus === '晚班上桌'
      
      if (isOnTable && waterTableNo) {
        const tableList = waterTableNo.split(',').map(t => t.trim()).filter(t => t)
        
        if (tableList.length === 1) {
          // 【单台桌自动选中】
          form.value.table_no = tableList[0]
          // 同步到 localStorage
          uni.setStorageSync('tableName', tableList[0])
          uni.setStorageSync('tableAuth', JSON.stringify({ 
            table: tableList[0], 
            time: Date.now() 
          }))
          uni.showToast({ title: `已自动选中台桌 ${tableList[0]}`, icon: 'success' })
          return // 不弹出选择器
        }
        // 多台桌：不自动选中，弹出选择器让用户手动选择
      }
    } catch (e) {
      console.log('获取水牌状态失败，弹出选择器', e)
    }
  }
  
  // 默认：弹出选择器
  showTableSelector.value = true
}
```

#### 3.3.4 TableSelector 组件修改（可选优化）

**当前行为**：`TableSelector` 在打开时自动加载台桌列表并显示，用户手动点击选中。

**是否需要修改**：不需要。自动填充逻辑在上层页面处理（`handleTableFieldClick`），`TableSelector` 保持现有行为不变。

> **注**：如果后续需要将「单台桌自动选中」逻辑下沉到 `TableSelector` 组件中，可以通过添加 `autoSelectWhenSingle` prop 实现。但当前方案在上层处理更简单。

---

## 四、修改文件清单

| # | 文件 | 修改类型 | 修改内容 |
|---|------|----------|----------|
| 1 | `src/pages/cart/cart.vue` | 修改 | `onShow` 增加员工身份判断 + 清空 storage |
| 2 | `src/pages/products/products.vue` | 修改 | `onShow` 增加员工身份判断 + 清空 storage |
| 3 | `src/pages/internal/service-order.vue` | 修改 | ① 移除 `onMounted` 中的 `loadDefaultTable()` ② 增加 `onShow` 清空台桌号 ③ 台桌号字段点击改为 `handleTableFieldClick` ④ 新增 `handleTableFieldClick` 方法 |

---

## 五、API 变更

**无后端 API 变更**。

- 已有的 `GET /api/water-boards/:coachNo` 返回的 `table_no` 字段已包含所需信息
- 已有的 `GET /api/coaches/:coachNo/water-status` 同样可用
- `service-order.vue` 当前使用 `api.waterBoards.getOne()` (api-v2.js)，该 API 返回 `table_no` 和 `status`

---

## 六、数据库变更

**无数据库变更**。

- `water_boards` 表的 `status` 和 `table_no` 字段已存在
- 无需新增字段或修改表结构

---

## 七、边界情况与异常处理

### 7.1 边界情况

| 场景 | 处理方式 |
|------|----------|
| 助教未上桌（状态为空闲/下班等） | 不自动填充，弹出选择器 |
| 助教上桌但水牌 `table_no` 为空 | 不自动填充，弹出选择器 |
| 助教上桌且水牌有多个台桌号 | 不自动填充，弹出选择器（禁止自动选中） |
| 助教上桌且水牌只有 1 个台桌号 | 自动选中该台桌号 |
| 后台用户（非助教）进入服务下单页 | 不执行水牌查询，直接弹出选择器 |
| 获取水牌状态 API 失败 | catch 异常，降级为弹出选择器 |
| 非员工（普通顾客） | 不受影响，走原有扫码逻辑 |

### 7.2 状态判断

上桌状态判定（复用 cart.vue 已有逻辑）：
```javascript
const isOnTable = waterStatus === '早班上桌' || waterStatus === '晚班上桌'
```

> **注**：`water_boards.status` 字段的取值包括：
> - 工作状态：`早班上桌`、`晚班上桌`、`早班空闲`、`晚班空闲`、`加班`
> - 非工作状态：`迟到`、`早退`、`公休`、`事假`、`病假`、`下班`、`辞职` 等

### 7.3 异常降级

| 异常 | 降级策略 |
|------|----------|
| 网络异常导致水牌查询失败 | catch → 弹出选择器，不影响用户操作 |
| 水牌数据格式异常 | catch → 弹出选择器 |

---

## 八、前后端交互流程

### 8.1 购物车页面 - 员工进入流程

```
用户进入购物车页面
    ↓
onShow 触发
    ↓
isEmployee = true (有 coachToken/adminToken)
    ↓
清空 tableName + tableAuth (uni.removeStorageSync)
    ↓
页面显示「台桌：未选择」+「切换台桌」按钮
    ↓
用户点击「切换台桌」→ 弹出 TableSelector
    ↓
用户选择台桌 → 保存到 storage → 更新页面
    ↓
下单时验证 tableName 非空 → 通过则下单
```

### 8.2 服务下单页面 - 助教进入流程

```
助教进入服务下单页面
    ↓
onShow 触发
    ↓
form.table_no = '' (清空)
    ↓
页面显示「台桌号：请选择台桌」
    ↓
助教点击台桌号字段
    ↓
handleTableFieldClick 执行
    ↓
调用 GET /api/water-boards/{coachNo}
    ↓
判断水牌状态
    ├── 早班/晚班上桌 + 单台桌 → 自动填充，toast 提示，不弹选择器
    ├── 早班/晚班上桌 + 多台桌 → 弹出 TableSelector
    └── 非上桌状态 → 弹出 TableSelector
    ↓
用户确认台桌号
    ↓
提交时验证 form.table_no 非空 → 通过则提交
```

---

## 九、验收测试用例

| # | 测试场景 | 预期结果 |
|---|----------|----------|
| 1 | 助教进入购物车页面 | storage 中 tableName 被清空，页面显示「未选择」 |
| 2 | 助教进入商品点单页 | storage 中 tableName 被清空，加车时弹出选桌 |
| 3 | 助教进入服务下单页 | form.table_no 为空，不自动填充 |
| 4 | 未选台桌号直接下单（购物车） | 弹出提示「请先选择台桌号」，阻断下单 |
| 5 | 未选台桌号直接提交（服务单） | 弹出提示「请选择台桌」，阻断提交 |
| 6 | 助教已上桌，水牌只有 1 个台桌号，点击台桌字段 | 自动选中该台桌号，不弹出选择器 |
| 7 | 助教已上桌，水牌有 2+ 个台桌号，点击台桌字段 | 弹出选择器，不自动选中任何台桌 |
| 8 | 助教未上桌（空闲/下班），点击台桌字段 | 弹出选择器 |
| 9 | 后台用户进入服务下单页 | 弹出选择器，不查询水牌 |
| 10 | 水牌 API 请求失败 | 降级弹出选择器，不影响操作 |
| 11 | 退出页面后再次进入 | 再次清空台桌号 |

---

## 十、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 清空 storage 影响非员工 | 非员工不受影响（isEmployee 判断） | 清空逻辑仅在 `isEmployee.value` 为 true 时执行 |
| 自动填充逻辑误判 | 仅限单台桌场景 | 严格判断 `tableList.length === 1` |
| API 超时导致用户体验差 | 最多 1-2 秒延迟 | catch 后直接弹出选择器 |

---

## 十一、不需要修改的部分

| 部分 | 原因 |
|------|------|
| 后端 API | 已有接口满足需求 |
| 数据库表结构 | 已有字段满足需求 |
| TableSelector 组件 | 保持现有行为，自动填充由页面层处理 |
| 购物车下单验证逻辑 | 已有验证，无需修改 |
| 商品点单加车验证逻辑 | 已有验证，无需修改 |
| 非员工（普通顾客）流程 | 不受影响 |
| 后端订单创建 API | 已有 table_no 验证 |
| 后端服务单创建 API | 已有 table_no 验证 |

```

## 审计检查清单
# 代码审计检查清单

## 编码规范检查（自动化）

运行 `check-style.js` 脚本，检查：

| 规则ID | 检查项 | 禁止 | 必须 |
|--------|--------|------|------|
| TIME | 时间处理 | `datetime('now')`、手动时区偏移 | `TimeUtil` |
| DB_CONN | 数据库连接 | `new sqlite3.Database()` | `db/index.js` |
| DB_WRITE | 数据库写入 | 裸开事务 | `writeQueue` |

## 人工审计检查项

### 逻辑正确性

- [ ] API路径、方法、参数与设计方案一致
- [ ] 数据库字段名、类型与设计一致
- [ ] 业务逻辑分支完整（if/else覆盖所有情况）
- [ ] 边界值处理（空值、最大值、最小值）

### 安全性

- [ ] 输入验证（参数类型、长度、范围）
- [ ] SQL注入防护（参数化查询）
- [ ] 权限校验（用户身份验证）

### 错误处理

- [ ] API错误有明确的错误码和消息
- [ ] 数据库操作有try/catch
- [ ] 异常情况有fallback处理

### 代码质量

- [ ] 变量命名清晰
- [ ] 函数单一职责
- [ ] 无死代码（未使用的变量/函数）
- [ ] Git提交信息描述清晰

### 前后端一致性

- [ ] API请求/响应格式前后端匹配
- [ ] 前端字段名与后端返回一致
- [ ] 错误处理前后端对齐


## 输出要求
1. 审计结果：通过/不通过
2. 如不通过，列出具体问题（对应检查清单的哪些项）
3. 如果通过，提取设计摘要（改了什么文件、新增什么API、数据表变更等）

这是第 1/3 次审计。