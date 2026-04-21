你是程序员A。请按设计稿编码实现。

## 设计稿
```
# QA-20260422-01 打卡审查改进 - 设计方案

> 设计者：程序员A | 日期：2026-04-22

---

## 一、需求理解

| # | 需求 | 说明 |
|---|------|------|
| 1 | 打卡表新增两个字段 | `is_late`（是否迟到）、`is_reviewed`（是否审查完毕） |
| 2 | 上班打卡时计算迟到 | 提交上班打卡时，根据班次+加班情况计算是否迟到，写入打卡表 |
| 3 | 打卡审查按钮加角标 | 显示"当天迟到且未审查"的人数 |
| 4 | 审查页面新增两条提示 | ①审查打卡时间和截图时间是否一致 ②处理迟到的处罚 |
| 5 | 审查页面不再计算迟到 | 直接读取打卡表的 `is_late` 字段 |
| 6 | 每条未审查数据增加审查完毕按钮 | 逐条标记为已审查 |

---

## 二、现状分析

### 2.1 现有数据库表 `attendance_records`

```sql
CREATE TABLE attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    coach_no INTEGER NOT NULL,
    employee_id TEXT,
    stage_name TEXT NOT NULL,
    clock_in_time TEXT,
    clock_out_time TEXT,
    clock_in_photo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**当前缺失字段**：`is_late`、`is_reviewed`

### 2.2 现有上班打卡 API（`/api/coaches/v2/:coach_no/clock-in`）

- 位置：`/TG/tgservice/backend/routes/coaches.js`
- 当前逻辑：写入 `attendance_records` 时，**不计算** `is_late`
- 使用 `runInTransaction` 事务，符合编码规范

### 2.3 现有打卡审查 API（`/api/attendance-review`）

- 位置：`/TG/tgservice/backend/routes/attendance-review.js`
- 当前逻辑：**每次查询时动态计算**是否迟到
  - 早班应上班时间：`14:00 - 早加班小时数`
  - 晚班应上班时间：`18:00 - 晚加班小时数`
  - 比较 `clock_in_time > expectedTime` 判断是否迟到
- 前端 `attendance-review.vue` 使用 `record.is_late_text` 显示

### 2.4 现有打卡审查按钮

- 位置：`/TG/tgservice-uniapp/src/pages/member/member.vue` 第 227 行
- 当前：无角标
- 参考模式：审批按钮组（第 263-296 行）已有角标实现

### 2.5 现有角标实现模式

```vue
<view class="internal-btn" @click="navigateTo('...')">
  <text class="internal-btn-text">xxx</text>
  <view class="badge" v-if="xxxCount > 0">{{ xxxCount }}</view>
</view>
```

- `.badge` CSS 已定义（红色圆角角标，absolute 定位）
- 数据通过 `loadPendingCounts()` 从 API 加载

---

## 三、技术方案

### 3.1 数据库变更

**文件**：`/TG/tgservice/backend/db/migrations/v2.4-attendance-late-reviewed.sql`（新增）

```sql
-- v2.4: 打卡表新增迟到和审查状态字段
-- 日期：2026-04-22
-- 说明：上班打卡时预计算迟到状态，审查页面直接读取

ALTER TABLE attendance_records ADD COLUMN is_late INTEGER DEFAULT 0;
ALTER TABLE...
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
2. 修复记录写入 /TG/temp/QA-20260422-01/fix-log.md（如有修复）