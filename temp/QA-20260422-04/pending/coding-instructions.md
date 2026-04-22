你是程序员A。请按设计稿编码实现。

## 设计稿
```
# api.js 合并方案设计文档

## 一、现状分析

### 1.1 文件结构对比

| 文件 | 导出方式 | 行数 | 主要用途 |
|------|----------|------|----------|
| api.js | 默认导出 `export default {}` | ~300行 | 公共API（首页、商品、订单、教练等） |
| api-v2.js | 具名导出 + 默认导出 | ~220行 | 内部专用模块（水牌、服务单、上下桌等） |

### 1.2 api.js 导出结构

```javascript
export default {
  // 首页、商品、购物车、订单、教练、台桌等公共API
  getHome: () => request(...),
  getProducts: (category) => request(...),
  // ...
  
  // 部分嵌套模块
  applications: { getPendingCount: () => request(...) },
  rewardPenalty: { getRecentCount: () => request(...) }
}
```

### 1.3 api-v2.js 导出结构

```javascript
// 具名导出模块
export const waterBoards = { getList, getOne, updateStatus }
export const serviceOrders = { create, getList, updateStatus }
export const tableActionOrders = { create, getList, getStats, updateStatus }
export const applications = { create, getList, approve, ... }
export const guestInvitations = { create, getList, review, ... }
export const coachesV2 = { clockIn, clockOut, batchShift, updateShift }
export const operationLogs = { getList }
export const authV2 = { checkPermission }
export const lejuanRecords = { create, getMyList, ... }
export const missingTableOutOrders = { getStats, getDetail }
export const rewardPenalty = { getRecentCount }
export const leaveCalendar = { getStats, getDayCount }
export const attendanceReview = { getList, getPendingCount, markReviewed }
export const guestRankings = { getToday, setExempt, removeExempt }

// 默认导出（引用上述模块）
export default {
  getFrontConfig: () => request(...),
  waterBoards,
  serviceOrders,
  // ...所有模块
}
```

### 1.4 request 函数差异

| 特性 | api.js | api-v2.js |
|------|--------|-----------|
| authType 参数 | 支持 'member'/'coach'/'admin' | 不支持 |
| Token 选择逻辑 | `adminToken || coachToken || memberToken` | `adminToken || coachToken` |
| 401 处理 | 按类型跳转不同登录页 | 统一跳转（无 member 处理） |

**结论**：api.js 的 request 更完整，能覆盖 api-v2.js 的需求。

### 1.5 引用情况

**共 26 个文件引用 api-v2.js**：

| Import 方式 | 文件数 | 示例 |
|-------------|--------|------|
| 默认导入 `import api from '@/utils/ap...
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
2. 修复记录写入 /TG/temp/QA-20260422-04/fix-log.md（如有修复）