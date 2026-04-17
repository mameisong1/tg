你是程序员A。请按设计稿编码实现。

## 设计稿
```
# 下桌单缺失统计功能 — 设计方案

> QA编号：QA-20260417-08 | 设计：程序员A | 日期：2026-04-17

---

## 1. 需求理解

### 1.1 业务逻辑

助教每次**上桌**应产生一张 `上桌单`（`order_type = '上桌单'`），完成后应产生一张对应的**下桌单**（`order_type = '下桌单'`）。

**对应关系判定条件**（三字段一致）：
- `coach_no`（助教工号）
- `table_no`（桌号）
- `stage_name`（艺名）

**缺失判定**：
- 下桌单的 `created_at` 必须在 上桌单 `created_at` 之后 **15 小时内**
- 若找不到对应的下桌单 → 属于**下桌单缺失**

### 1.2 功能要求

| 维度 | 要求 |
|------|------|
| 入口 | H5 会员中心 → 管理功能（`isManager = true`） |
| 权限 | 店长、助教管理、管理员 |
| 周期选项 | 昨天 / 前天 / 本月 / 上月 |
| 统计展示 | 工号、艺名、缺失数量，按数量**倒序** |
| 明细弹框 | 上桌日期、上桌时间、桌号、下桌单（无） |
| 性能 | 查询必须有索引支持 |

---

## 2. 技术选型与依据

### 2.1 数据来源

**表：`table_action_orders`**（依据：`db/index.js` schema + `routes/table-action-orders.js`）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| order_time | DATETIME | 下单时间 |
| table_no | TEXT | 台桌号 |
| coach_no | TEXT | 助教编号 |
| order_type | TEXT | '上桌单' / '下桌单' / '取消单' |
| action_category | TEXT | 上桌类别（普通课/标签课） |
| stage_name | TEXT | 助教艺名 |
| status | TEXT | '待处理' / '已完成' / '已取消' |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

**表：`coaches`**（依据：`db/index.js` schema）

| 字段 | 类型 | 说明 |
|------|------|------|
| coach_no | INTEGER PK | 助教系统编号 |
| employee_id | TEXT | 助教工号（页面显示用） |
| stage_name | TEXT | 艺名 |
| status | TEXT | 状态（全职/离职等） |

### 2.2 现有索引（依据：`db/index.js` schema）

```sql
-- table_action_orders 已有
CREATE INDEX idx_table_action_orders_type ON table_action_orders(order_type);
CREATE INDEX idx_table_action_orders_coach_no ON table_action_orders(coach_no);
CREATE INDEX idx_table_action_orders_created_at ON table_action_orders(created_at);
```

### 2.3 权限矩阵

依据 `middleware/permission.js`，新增权限字段 `missingTableOutStats`：

| 角色 | missingTableOutStats |
|------|---------------------|
| 管理员 | `true` |
| 店长 | `true` |
| 助教管理 | `true` |
| 其他角色 | `false`（继承现有逻辑） |

---

## 3. 新增 / 修改文件清单

### 3.1 后端文件

| 操作 | 文件 | 说明 |
|------|------|------|
| **新增** | `backend/routes/missing-table-out-orders.js` | 新 API 路由 |
| **修改** | `backend/server....
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
2. 修复记录写入 /TG/temp/QA-20260417-08/fix-log.md（如有修复）