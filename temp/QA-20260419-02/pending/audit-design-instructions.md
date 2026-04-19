你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
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
-- 索引：按日期查询
CREATE INDEX idx_attendance_date ON attendance_records(date);
```

#### 迁移脚本

新建文件：`backend/db/migrations/v2.2-attendance.sql`

```sql
-- v2.2: 上下班打卡记录表
-- 日期：2026-04-19

CREATE TABLE IF NOT EXISTS attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    coach_no INTEGER NOT NULL,
    employee_id TEXT,
    stage_name TEXT NOT NULL,
    clock_in_time TEXT,
    clock_out_time TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coach_no) REFERENCES coaches(coach_no)
);

CREATE INDEX IF NOT EXISTS idx_attendance_date_coach ON attendance_records(date, coach_no);
CREATE INDEX IF NOT EXISTS idx_attendance_coach_no ON attendance_records(coach_no);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
```

#### 迁移执行

在 `server.js` 启动时自动执行迁移（参考现有迁移机制），或手动执行：

```bash
sqlite3 /TG/tgservice/backend/db/tgservice.db < /TG/tgservice/backend/db/migrations/v2.2-attendance.sql
```

### 3.2 后端 API 变更

#### 修改文件：`backend/routes/coaches.js`

**无需新增 API 端点**，在现有 clock-in/clock-out 端点中增加打卡记录逻辑。

#### 3.2.1 上班打卡逻辑修改

**当前**：只更新 water_boards 表的 status 和 clock_in_time。

**修改后**：在同一事务中，额外插入一条 attendance_records 记录。

```javascript
// POST /api/coaches/:coach_no/clock-in
// 在事务内，更新水牌状态后新增：

const TimeUtil = require('../utils/time');
const { dbRun, enqueueRun } = require('../db');

// ... 现有 water_board 更新逻辑保持不变 ...

// 新增：写入打卡记录
const nowDB = TimeUtil.nowDB();
const todayStr = TimeUtil.todayStr();

await tx.run(`
  INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, clock_out_time, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
`, [todayStr, coach_no, coach.employee_id, coach.stage_name, nowDB, nowDB, nowDB]);
```

**说明**：
- 使用 `tx.run()` 因为在 `runInTransaction` 事务内
- `employee_id` 和 `stage_name` 从 coaches 表读取（已有 coach 对象）
- `date` 用 `TimeUtil.todayStr()` 获取当天日期
- `clock_in_time` 用 `TimeUtil.nowDB()` 获取当前时间
- `clock_out_time` 初始为 NULL

#### 3.2.2 下班打卡逻辑修改

**当前**：只更新 water_boards 表的 status，清除 clock_in_time。

**修改后**：在同一事务中，查找该助教当天最新的未打卡下班的上班记录，更新下班时间。**如果没有找到，丢弃数据（不写入打卡表）**。

```javascript
// POST /api/coaches/:coach_no/clock-out
// 在事务内，更新水牌状态后新增：

const nowDB = TimeUtil.nowDB();
const todayStr = TimeUtil.todayStr();

// 查找当天最新的未打卡下班的上班记录
const attendanceRecord = await tx.get(`
  SELECT id FROM attendance_records
  WHERE coach_no = ? AND date = ? AND clock_out_time IS NULL
  ORDER BY clock_in_time DESC LIMIT 1
`, [coach_no, todayStr]);

if (attendanceRecord) {
  // 有对应的上班记录，更新下班时间
  await tx.run(`
    UPDATE attendance_records
    SET clock_out_time = ?, updated_at = ?
    WHERE id = ?
  `, [nowDB, nowDB, attendanceRecord.id]);
} else {
  // 无对应的上班记录，丢弃数据（不写入打卡表）
  console.log(`[attendance] 下班打卡丢弃：coach_no=${coach_no}, 当天无上班记录`);
}
```

**说明**：
- 按 `date + coach_no` 查找当天该助教的记录
- 条件 `clock_out_time IS NULL` 确保只匹配未下班的记录
- `ORDER BY clock_in_time DESC LIMIT 1` 确保取最新的一条
- 如果找不到，**不写入任何记录**（需求：丢弃数据）
- 水牌状态变更**照常执行**（打卡记录只是附加功能）

### 3.3 数据库写入规范检查

| 操作 | 使用方式 | 符合规范 |
|------|----------|----------|
| 上班 INSERT | `await tx.run('INSERT ...', [...])` | ✅ 在 runInTransaction 内 |
| 下班 UPDATE | `await tx.run('UPDATE ...', [...])` | ✅ 在 runInTransaction 内 |
| 查询 | `await tx.get('SELECT ...', [...])` | ✅ 在 runInTransaction 内 |
| 时间处理 | `TimeUtil.nowDB()` / `TimeUtil.todayStr()` | ✅ 统一工具类 |
| 数据库连接 | 复用 `require('../db')` | ✅ 唯一连接 |

### 3.4 前端变更

#### 打卡页面（clock.vue）

**无需修改**。现有打卡页面调用的是 clock-in/clock-out API，后端会自动记录打卡时间到 attendance_records 表。

#### 新增：后台管理页面

新建 `admin/attendance.html` — 助教打卡记录查看页面。

- 按日期筛选
- 按助教工号/艺名搜索
- 显示：日期、工号（employee_id）、艺名、上班时间、下班时间、时长
- 页面**只显示 employee_id**，不显示 coach_no

**页面列**：

| 列 | 数据来源 |
|---|---|
| 日期 | `date` |
| 助教工号 | `employee_id`（不是 coach_no） |
| 艺名 | `stage_name` |
| 上班时间 | `clock_in_time` |
| 下班时间 | `clock_out_time` |
| 工作时长 | 计算字段（下班时间 - 上班时间） |

#### 新增 API 端点（可选，供管理页面使用）

```
GET /api/admin/attendance?date=YYYY-MM-DD&employee_id=xxx&page=1&pageSize=20
```

**注意**：此需求核心是打卡记录功能，管理页面可后续开发。本次 QA 重点是打卡记录的准确性。

### 3.5 前后端交互流程

```
┌─────────────┐                          ┌──────────────┐
│  助教 H5     │                          │   后端 API    │
│  clock.vue   │                          │  coaches.js  │
└──────┬───────┘                          └──────┬───────┘
       │                                         │
       │  POST /api/coaches/v2/:coach_no/clock-in│
       │─────────────────────────────────────────▶│
       │                                         │  1. 获取助教信息
       │                                         │  2. 获取水牌状态
       │                                         │  3. 更新水牌状态
       │                                         │  4. INSERT attendance_records  ✅
       │                                         │     (date, coach_no, employee_id,
       │                                         │      stage_name, clock_in_time)
       │  { success: true }                      │
       │◀────────────────────────────────────────│
       │                                         │
       │  POST /api/coaches/v2/:coach_no/clock-out│
       │─────────────────────────────────────────▶│
       │                                         │  1. 获取水牌状态
       │                                         │  2. 更新水牌状态
       │                                         │  3. SELECT 查找当天未下班记录
       │                                         │  4a. 找到 → UPDATE clock_out_time ✅
       │                                         │  4b. 未找到 → 丢弃，不写入 ⚠️
       │  { success: true }                      │
       │◀────────────────────────────────────────│
       │                                         │
```

---

## 四、边界情况和异常处理

### 4.1 重复打卡

| 场景 | 处理方式 |
|------|----------|
| 同一天重复点"上班" | 会插入多条 attendance_records 记录（每条 clock_out_time 为 NULL）。下班时会匹配最新的一条。这是合理行为（允许误操作后重新打卡）。 |
| 同一天重复点"下班" | 第一次下班找到记录并更新 clock_out_time；第二次下班时 `clock_out_time IS NOT NULL`，不会被匹配到，丢弃。符合需求。 |
| 跨天未下班 | 第二天上班时，前一天的记录 clock_out_time 仍为 NULL（异常数据，可在管理页面标记）。新的一天会创建新记录。 |

### 4.2 助教信息变更

| 场景 | 处理方式 |
|------|----------|
| 助教修改艺名 | 打卡记录保存的是打卡时的 stage_name，历史数据不变（快照式存储） |
| 助教修改 employee_id | 同上，历史数据不变 |

### 4.3 异常情况

| 异常 | 处理 |
|------|------|
| coaches 表中找不到助教 | 现有逻辑已处理：返回 404 |
| water_boards 表中找不到记录 | 现有逻辑已处理：返回 404 |
| INSERT/UPDATE 失败 | 事务回滚，water_board 状态也不会变更 |
| 服务器时间错误 | 依赖服务器时区设置（容器已设 Asia/Shanghai），使用 TimeUtil.nowDB() 保证一致性 |

### 4.4 并发安全

- 所有写操作都在 `runInTransaction` 中执行，通过 `enqueueWrite` 串行化
- SQLite WAL 模式 + busy_timeout=3000 确保并发安全
- 同一助教的 clock-in 和 clock-out 不会交叉执行

---

## 五、文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| **新建** | `backend/db/migrations/v2.2-attendance.sql` | 数据库迁移脚本 |
| **修改** | `backend/routes/coaches.js` | clock-in 端点增加 INSERT，clock-out 端点增加 UPDATE/丢弃逻辑 |
| **新建** | `admin/attendance.html` | 后台打卡记录查看页面（可选，本期 QA 可不做） |
| **新建** | `backend/routes/attendance.js` | 管理端打卡记录查询 API（可选，本期 QA 可不做） |

---

## 六、验收检查

| 验收点 | 检查方法 |
|--------|----------|
| 打卡表结构正确，字段完整 | 执行迁移后 `SELECT * FROM attendance_records LIMIT 0` 查看列 |
| 上班打卡正常记录 | 点上班后 `SELECT * FROM attendance_records WHERE coach_no=X AND date=今天` 应有一条 clock_in_time 非空、clock_out_time 为 NULL 的记录 |
| 下班打卡能正确关联上班记录 | 点下班后上述记录的 clock_out_time 应有值 |
| 无上班记录时下班打卡被丢弃 | 删除 attendance_records 中该助教当天记录后点下班，打卡表不应有新记录插入 |

---

## 七、测试用例

### TC-1：正常上下班打卡

```
步骤：
1. 助教 A（coach_no=1, employee_id="T001", stage_name="小美"）点上班
2. 查询 attendance_records，应有 1 条记录
3. 助教 A 点下班
4. 查询 attendance_records，该记录 clock_out_time 应有值
```

### TC-2：无上班记录时下班打卡丢弃

```
步骤：
1. 清空助教 B 当天的 attendance_records 记录
2. 助教 B 点下班
3. 查询 attendance_records，不应有新记录
4. 水牌状态应变为「下班」（打卡记录丢弃不影响水牌）
```

### TC-3：同一天多次上下班

```
步骤：
1. 助教 C 点上班 → 记录1（clock_in_time=T1）
2. 助教 C 点下班 → 记录1（clock_out_time=T2）
3. 助教 C 再点上班 → 记录2（clock_in_time=T3）
4. 助教 C 点下班 → 记录2（clock_out_time=T4）
5. 应有 2 条完整记录
```

### TC-4：只有上班无下班

```
步骤：
1. 助教 D 点上班
2. 不点下班
3. 查询 attendance_records，应有 1 条 clock_out_time 为 NULL 的记录
```

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