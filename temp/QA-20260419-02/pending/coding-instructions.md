你是程序员A。请按设计稿编码实现。

## 设计稿
```
# QA-20260419-02 设计方案：上下班打卡时间记录功能

> 日期：2026-04-19 | 设计：程序员A

---

## 一、现状分析

### 1.1 现有打卡机制

项目**已有**助教上下班打卡功能，位于 `backend/routes/coaches.js`：

| 端点 | 方法 | 功能 |
|------|------|------|
| `POST /api/coaches/v2/:coach_no/clock-in` | 上班 | 根据班次将水牌状态改为「早班空闲」/「晚班空闲」，记录 clock_in_time 到 water_boards 表 |
| `POST /api/coaches/v2/:coach_no/clock-out` | 下班 | 将水牌状态改为「下班」，清除 clock_in_time |

**问题**：现有机制只更新 water_boards 表的当前状态，**不保存历史打卡记录**。每次下班时 clock_in_time 被清空，无法追溯。

### 1.2 相关数据表

**coaches 表**（已有）：
```sql
coach_no INTEGER PRIMARY KEY AUTOINCREMENT,
employee_id TEXT,        -- 助教工号（页面显示用）
stage_name TEXT,         -- 艺名
shift TEXT DEFAULT '晚班' -- 班次：早班/晚班
...
```

**water_boards 表**（已有）：
```sql
coach_no TEXT NOT NULL,
stage_name TEXT NOT NULL,
status TEXT DEFAULT '下班',
clock_in_time DATETIME,  -- 当前上班打卡时间（下班时被清空）
...
```

### 1.3 前端打卡页面

`src/pages/internal/clock.vue` 提供上班/下班按钮，调用 `api.coachesV2.clockIn/clockOut`。

---

## 二、需求理解

| 需求 | 说明 |
|------|------|
| 新增打卡表 | 记录：日期、工号、艺名、上班时间、下班时间 |
| 上班打卡 | 助教点"上班"时，在打卡表新增一条记录，记录上班时间和日期 |
| 下班打卡 | 助教点"下班"时，查找该助教当天最新的一条未打卡下班的上班记录，填入下班时间 |
| 无上班记录时 | 下班打卡被丢弃（不写入打卡表），但水牌状态变更照常执行 |

---

## 三、技术方案

### 3.1 数据库变更

#### 新增表：attendance_records

```sql
CREATE TABLE IF NOT EXISTS attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,              -- 日期 "YYYY-MM-DD"
    coach_no INTEGER NOT NULL,       -- 助教工号（内部编号，对应 coaches.coach_no）
    employee_id TEXT,                -- 助教工号（页面显示用）
    stage_name TEXT NOT NULL,        -- 艺名
    clock_in_time TEXT,              -- 上班时间 "YYYY-MM-DD HH:MM:SS"
    clock_out_time TEXT,             -- 下班时间 "YYYY-MM-DD HH:MM:SS"，NULL 表示未下班
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coach_no) REFERENCES coaches(coach_no)
);

-- 索引：按日期+助教查询
CREATE INDEX idx_attendance_date_coach ON attendance_records(date, coach_no);
-- 索引：按助教查询历史记录
CREATE INDEX idx_attendance_coach_no ON attendance_records(coach_no);
-- 索引：...
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
2. 修复记录写入 /TG/temp/QA-20260419-02/fix-log.md（如有修复）