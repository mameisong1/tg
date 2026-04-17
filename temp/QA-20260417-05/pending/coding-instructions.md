你是程序员A。请按设计稿编码实现。

## 设计稿
```
# QA-20260417-05 新规约客统计页面 - 技术方案

## 一、需求理解

### 1.1 功能概述
在 H5 会员中心 → 管理功能中新增「规约客统计」页面，提供按时间周期统计约课情况的能力。

### 1.2 权限控制
- 仅 **店长、助教管理、管理员** 三种角色可访问
- 前端通过 `isManager` computed 控制入口显示（已有逻辑，无需新增权限）

### 1.3 数据模型分析

**现有表**: `guest_invitation_results`

| 字段 | 说明 |
|------|------|
| date | 日期 YYYY-MM-DD |
| shift | 班次（早班/晚班） |
| coach_no | 助教编号 |
| stage_name | 艺名 |
| result | 结果状态 |
| invitation_image_url | 约客截图 |
| images | 约客图片 |

**result 状态值**:

| result 值 | 含义 | 约课统计归类 |
|-----------|------|-------------|
| `应约客` | 锁定空闲助教，但未提交截图 | **未约课** |
| `待审查` | 已提交截图，等待审查 | **已约课（待确认）** |
| `约客有效` | 审查通过，有效约课 | **有效约课** |
| `约客无效` | 审查不通过，无效约课 | **无效约课** |

** coaches 表**（用于获取助教详细信息）:

| 字段 | 说明 |
|------|------|
| coach_no | 助教编号（PK） |
| employee_id | 工号 |
| stage_name | 艺名 |
| photos | 头像（JSON 数组） |

### 1.4 约课率算法

```
未约课人数 = result = '应约客' 的记录数
有效约课人数 = result = '约客有效' 的记录数
无效约课人数 = result = '约客无效' 的记录数

应约客人数 = 未约课人数 + 无效约课人数 + 有效约课人数
约课率 = 有效约课人数 / 应约客人数 × 100%
```

> **注意**：`待审查` 不计入上述统计（既不算未约也不算已约），
> 但会显示为"待确认"供参考。

### 1.5 漏约定义
**漏约 = 未约课 + 无效约课**
- 同一助教在统计周期内可能有多条漏约记录（不同日期/班次）
- 按助教聚合，显示总漏约次数

---

## 二、技术方案

### 2.1 后端新增 API

#### 新增端点: `GET /api/guest-invitations/period-stats`

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| period | string | 是 | `yesterday` / `day-before-yesterday` / `this-month` / `last-month` |

**权限**: `invitationStats`（已有权限组）

**响应格式**:

```json
{
  "success": true,
  "data": {
    "period": "yesterday",
    "period_label": "昨天",
    "date_range": "2026-04-16",
    "summary": {
      "not_invited": 5,
      "valid": 12,
      "invalid": 3,
      "pending": 2,
      "total_should": 20,
      "invite_rate": "60.0%"
    },
    "missed_coaches": [
      {
        "coach_no": 15,
        "employee_id": "A003",
        "stage_name": "小美",
        "photo_url": "http://47.238.80.12:8081/uploads/...",
        "missed_count": 4
      }
    ]
  }
}
```

#### 后端实现逻辑

```javascript
// backend/routes/guest-invitations.js 新增路由

const TimeU...
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
2. 修复记录写入 /TG/temp/QA-20260417-05/fix-log.md（如有修复）