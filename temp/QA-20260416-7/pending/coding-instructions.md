你是程序员A。请按设计稿编码实现。

## 设计稿
```
# QA-20260416-7 技术方案设计

> **日期**: 2026-04-16
> **设计者**: 程序员A
> **需求来源**: 水牌显示优化 + 公安备案号显示

---

## 一、需求概述

### 1.1 水牌显示优化（前台H5）

涉及两个页面：
- **水牌查看** (`/pages/internal/water-board-view.vue`) — 普通助教查看
- **水牌管理** (`/pages/internal/water-board.vue`) — 管理员查看+状态修改

优化内容：
1. 删除「下班」筛选按钮
2. 将下班助教卡片根据班次移入「早班空闲」/「晚班空闲」组
3. 下班助教排在末尾，和空闲助教分行显示
4. 下班助教卡片不显示头像，底色变深灰色
5. 下班助教当天有已同意加班审批时，卡片右上角显示红色粗体加班小时数
6. 加班小时数批量接口（一次返回所有）
7. 30秒刷新同时刷新加班小时数数据

### 1.2 公安备案号显示

在首页底部铭牌和会员中心底部信息栏新增公安备案号：`京公网安备11010102000001号`

---

## 二、现有代码分析

### 2.1 水牌相关后端 API

| 文件 | 路径 | 说明 |
|------|------|------|
| `backend/routes/water-boards.js` | `/api/water-boards` | 水牌管理 API |
| `backend/routes/applications.js` | `/api/applications` | 申请审批 API |

**GET /api/water-boards** 返回数据结构：
```javascript
{
  coach_no, stage_name, status, table_no, updated_at, clock_in_time,
  shift, photos, employee_id, table_no_list
}
```

**关键发现**：
- `coaches.shift` 字段区分「早班」/「晚班」
- `water_boards.status` 包含「下班」状态
- `applications` 表通过 `applicant_phone` 关联助教，`extra_data` JSON 字段存储 `{hours: N}`
- `applications.status`: 0=待处理, 1=已同意, 2=已拒绝
- 已有 `/api/applications/approved-recent` 接口返回近期审批记录

### 2.2 水牌相关前端页面

| 文件 | 说明 |
|------|------|
| `pages/internal/water-board-view.vue` | 水牌查看页面 |
| `pages/internal/water-board.vue` | 水牌管理页面 |
| `utils/api-v2.js` | API 封装，含 `waterBoards` 和 `applications` |
| `utils/time-util.js` | 前端时间工具 |

**关键数据结构**：
```javascript
const workStatusList = ['早班上桌', '早班空闲', '晚班上桌', '晚班空闲', '乐捐']
const offStatusList = ['休息', '公休', '请假', '下班', '早加班', '晚加班']
const freeStatuses = ['早班空闲', '晚班空闲']
```

**`groupedBoards` 计算逻辑**：按 `status` 分组，空闲状态按 `clock_in_time` 倒序，其他按 `updated_at` 倒序。

### 2.3 公安备案号位置

| 文件 | 位置 | 现有备案号样式 |
|------|------|---------------|
| `pages/index/index.vue` | 底部铭牌 `.plate-icp` 之后 | `color: #6a6040` |
| `pages/member/member.vue` | 底部 `.footer-icp` 之后 | `color: rgba(255,255,255,0.5)` |

---

## 三、技术方案

### 3.1 文件变更清单

| 操作 | 文件 | 变更内容 |
|------|------|---------|
| **新增** | `backend/routes/applicati...
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

## 工作目录

所有设计/代码产出写入指定工作目录。

## 输出要求

- 设计方案：写入 `design.md`
- 代码实现：直接修改项目代码，提交Git
- 修复记录：写入工作目录的 `fix-log.md`


## 完成要求
1. 代码提交到Git
2. 修复记录写入 /TG/temp/QA-20260416-7/fix-log.md（如有修复）