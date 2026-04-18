你是程序员A。请按设计稿编码实现。

## 设计稿
```
# 奖罚管理功能 - 技术设计方案

> 项目：天宫国际 tgservice
> 日期：2026-04-18
> 设计者：程序员A

---

## 一、需求概述

实现员工奖罚管理功能，包括：
1. 系统配置新增奖罚类型设定（JSON 存储）
2. 数据库新增奖罚表
3. 后台用户表新增在职状态字段
4. 前台 H5 新增奖金设定页面（店长给服务员设日奖）
5. 前台 H5 新增奖金查看页面（服务员/助教查看自己奖罚明细）
6. 后台 admin 新增人事目录 + 奖罚统计页面（人事执行奖罚）

---

## 二、数据库设计

### 2.1 系统配置表 `system_config`（已有表，新增 key）

**复用现有表**，新增一条 key = `'reward_penalty_types'` 的配置记录。

```sql
-- 表结构（已有，不需修改）
-- CREATE TABLE IF NOT EXISTS system_config (
--   key TEXT PRIMARY KEY,
--   value TEXT,
--   description TEXT,
--   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
-- );

-- 初始化默认奖罚类型 JSON
INSERT OR IGNORE INTO system_config (key, value, description) 
VALUES ('reward_penalty_types', 
  '[{"奖罚类型":"服务日奖","对象":"服务员"},{"奖罚类型":"未约客罚金","对象":"助教"},{"奖罚类型":"漏单罚金","对象":"助教"}]',
  '奖罚类型配置JSON: [{奖罚类型, 对象}]');
```

### 2.2 奖罚表 `reward_penalties`（新建）

```sql
CREATE TABLE IF NOT EXISTS reward_penalties (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,  -- 奖罚No（自增主键）
  type          TEXT NOT NULL,                       -- 奖罚类型（如：服务日奖、未约客罚金、漏单罚金）
  confirm_date  TEXT NOT NULL,                       -- 确定日期（日奖=YYYY-MM-DD，月罚=YYYY-MM）
  phone         TEXT NOT NULL,                       -- 手机号
  name          TEXT NOT NULL,                       -- 姓名
  amount        REAL NOT NULL,                       -- 金额（罚金为负数）
  remark        TEXT,                                -- 备注
  exec_status   TEXT DEFAULT '未执行',               -- 执行状态：已执行 / 未执行
  exec_date     TEXT,                                -- 执行日期
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 唯一约束：确定日期 + 奖罚类型 + 手机号
CREATE UNIQUE INDEX idx_rp_unique ON reward_penalties(confirm_date, type, phone);

-- 查询优化索引
CREATE INDEX idx_rp_phone ON reward_penalties(phone);
CREATE INDEX idx_rp_type ON reward_penalties(type);
CREATE INDEX idx_rp_confirm_date ON reward_penalties(confirm_date);
CREATE INDEX idx_rp_exec_status ON reward_penalties(exec_status);
```

### 2.3 后台用户表 `admin_users`（已有表，新增字段）...
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
2. 修复记录写入 /TG/temp/QA-20260418-01/fix-log.md（如有修复）