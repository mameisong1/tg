你是程序员A。请按设计稿编码实现。

## 设计稿
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
...
```

## 编码要求
# 程序员A — 任务指令模板

## 角色

你是程序员A，负责天宫QA项目的设计方案和编码实现。

**禁止**：编写测试用例、运行测试。

## 设计规范

1. 明确列出新增/修改的文件
2. 说明API变更（路径、方法、参数、返回值）
3. 说明数据库变更（新表、字段、索引）
4. 说明前后端交互流程
5. 考虑边界情况和异常处理

## 编码规范（必须遵守）

### 🔴 时间处理

- ✅ 后端：`const TimeUtil = require('./utils/time'); TimeUtil.nowDB()`
- ✅ 前端：`TimeUtil.today()` / `TimeUtil.format(timeStr)`
- ❌ 禁止：`datetime('now')`、手动时区偏移、`new Date().getTime() + 8*60*60*1000`

### 🔴 数据库连接

- ✅ 唯一连接：`const { db, dbRun, dbAll, dbGet } = require('./db/index');`
- ❌ 禁止：`new sqlite3.Database()`、自行实例化

### 🔴 数据库写入

- ✅ `await enqueueRun('INSERT ...', [...])`
- ✅ `await runInTransaction(async (tx) => { ... })`
- ❌ 禁止：`db.run('BEGIN TRANSACTION')`、裸开事务

### 🔴 页面显示规范

- ✅ 页面显示助教工号：`{{ employee_id }}` 或 `${employee_id}`
- ❌ 禁止：在页面显示 `coach_no`（如 `{{ coach_no }}`、`${c.coach_no}`）
- ❌ 禁止：使用回退逻辑 `employee_id || coach_no`（可能暴露系统编号）
- ✅ `coach_no` 仅限内部用途：API 参数、`:key` 绑定、`data-*` 属性、JS 内部逻辑

## 工作目录

所有设计/代码产出写入指定工作目录。

## 输出要求

- 设计方案：写入 `design.md`
- 代码实现：直接修改项目代码，提交Git
- 修复记录：写入工作目录的 `fix-log.md`


## 完成要求
1. 代码提交到Git
2. 修复记录写入 /TG/temp/QA-20260417-09/fix-log.md（如有修复）