你是程序员A。请按设计稿编码实现。

## 设计稿
```
# 后台Admin奖罚统计页面改造 - 技术设计方案

> QA编号: QA-20260418-02  
> 日期: 2026-04-18  
> 设计: 程序员A  

---

## 一、需求分析

### 1.1 核心需求

| # | 需求 | 说明 |
|---|------|------|
| 1 | 初始只查询统计结果 | 不要一次性把所有明细查询出来，数据量太大 |
| 2 | 弹框查看明细 | 点击统计结果的"查看明细"按钮，在弹框里显示所有明细 |
| 3 | 明细不可删除，金额可改为0 | 明细框里不能删除数据，只能把明细金额改为0 |
| 4 | 金额修改后统计结果跟着变 | 明细金额修改后，对应统计行的金额要实时更新 |
| 5 | 执行完毕按钮 | 每条统计数据里有两个按钮：查看明细 + 执行完毕，点击执行完毕把里面所有明细都设为已执行 |

### 1.2 现有问题分析

- **当前 `/api/reward-penalty/stats` 接口返回所有明细记录**，按人员分组后全量返回。当月奖罚记录多时，响应数据量巨大，前端渲染卡顿。
- **当前页面使用内联展开行**显示明细，而非弹框模式。
- **当前页面只有"全部执行"按钮**，没有"查看明细"按钮。

---

## 二、现有代码梳理

### 2.1 数据库表

**reward_penalties** (奖罚明细表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| type | TEXT NOT NULL | 奖罚类型（如"助教日常"、"服务日奖"） |
| confirm_date | TEXT NOT NULL | 确定日期 (YYYY-MM-DD) |
| phone | TEXT NOT NULL | 手机号（关联人员） |
| name | TEXT NOT NULL | 姓名 |
| amount | REAL NOT NULL | 金额（正=奖金，负=罚金） |
| remark | TEXT | 备注 |
| exec_status | TEXT DEFAULT '未执行' | 执行状态 |
| exec_date | TEXT | 执行日期 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

**唯一索引**: `idx_rp_unique(confirm_date, type, phone)`  
**其他索引**: phone, type, confirm_date, exec_status

**coaches** (助教表) - 用于关联获取 employee_id

| 字段 | 说明 |
|------|------|
| coach_no | 助教编号 |
| employee_id | 工号（**页面显示用**） |
| stage_name | 艺名 |
| real_name | 真实姓名 |
| phone | 手机号 |
| status | 状态 |

### 2.2 现有 API（只读分析，不修改）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reward-penalty/stats` | **本次需改造** - 当前返回全量明细分组数据 |
| POST | `/api/reward-penalty/batch-execute` | 批量执行（按 id 数组） |
| POST | `/api/reward-penalty/execute/:id` | 单条执行 |
| POST | `/api/reward-penalty/unexecute/:id` | 撤销执行 |
| GET | `/api/admin/reward-penalty/types` | 获取奖罚类型配置 |
| GET | `/api/reward-penalty/stats/summary` | 按类型汇总（已存在但不适用当前需求） |

### 2.3 现有前端

**文件**: `/TG/tgservice/admin/reward-penalty-stats.html`

- 使用内联展开行（`detail-row` CSS 类）显示明细
- 所有数据在 `loadData()` 中一次性加载到 `allRecords` 数组
- 筛选条件：月份（本月/上月）、奖罚类型、执行状态
- 批量操作：勾选后底部弹出批量执行栏

---

## 三、设计方案

### 3....
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
2. 修复记录写入 /TG/temp/QA-20260418-02/fix-log.md（如有修复）