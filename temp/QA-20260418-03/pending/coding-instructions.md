你是程序员A。请按设计稿编码实现。

## 设计稿
```
# 编码规范修复设计方案 — 时间处理违规修复

**QA编号**: QA-20260418-03  
**日期**: 2026-04-18  
**负责人**: 程序员A  

---

## 问题概述

编码规范检查发现 6 个文件共 12 处 TIME 规则违规（时间处理不规范）。

| 文件 | 违规数 | 违规类型 |
|------|--------|----------|
| server.js | 4 | `new Date().toISOString()` |
| cashier-dashboard.html | 2 | `new Date().toISOString()` |
| reward-penalty-stats.html | 3 | `toISOString().slice(0, 7)` |
| vip-rooms.html | 1 | `new Date().toISOString()` |
| test-coding-rules.js | 1 | 测试文件，可豁免 |
| time-util.js | 1 | 工具类注释，可豁免 |

**根因分析**:  
`toISOString()` 返回 UTC 时间（零时区），而服务器容器时区为 Asia/Shanghai（UTC+8）。
- 北京时间凌晨 1:00 → `toISOString()` 输出 `17:00 UTC`（前一天）
- 导致日期/月份/年份可能偏移，日志时间不准确

---

## 修复策略

### 1. 后端 server.js（4 处）

**文件**: `/TG/tgservice/backend/server.js`  
**状态**: 已引入 `TimeUtil`（L6）

| 行号 | 原代码 | 修复方案 |
|------|--------|----------|
| L404 | `new Date().toISOString()` | `TimeUtil.nowDB()` |
| L4903 | `new Date().toISOString()` | `TimeUtil.nowDB()` |
| L4936 | `new Date().toISOString()` | `TimeUtil.nowDB()` |
| L4964 | `new Date().toISOString()` | `TimeUtil.nowDB()` |

**说明**: 这 4 处都是生成日志/健康检查的 timestamp 字段，`TimeUtil.nowDB()` 返回 `"YYYY-MM-DD HH:MM:SS"` 北京时间，完全适用。

### 2. 前端 admin/ 文件（6 处）

**核心思路**: 在 `admin/js/time-util.js` 中新增两个工具函数，前端页面统一调用。

#### 2.1 新增工具函数

**文件**: `/TG/tgservice/admin/js/time-util.js`

```javascript
/**
 * 生成当前北京时间的完整时间字符串
 * 返回: "2026-04-18 22:45:00"
 */
nowDB() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
},

/**
 * 获取当前北京时间的年月
 * 返回: "2026-04"
 */
getBeijingMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
},
```

**注意**: `new Date()` 在容器时区为 Asia/Shanghai 下就是北京时间，直接取本地时间分量即可。...
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
2. 修复记录写入 /TG/temp/QA-20260418-03/fix-log.md（如有修复）