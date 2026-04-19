你是程序员A。请按设计稿编码实现。

## 设计稿
```
# QA 需求技术方案：新增助教申请事项

**日期**: 2026-04-19
**设计者**: 程序员A
**需求**: 新增班次切换申请、请假申请、休息申请

---

## 一、现有系统分析

### 1.1 applications 表结构（已有）

```sql
CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    applicant_phone TEXT NOT NULL,      -- 申请人手机号
    application_type TEXT NOT NULL,      -- 申请类型
    remark TEXT,                         -- 备注
    proof_image_url TEXT,               -- 证明图片 URL
    status INTEGER DEFAULT 0,            -- 0=待处理 / 1=同意 / 2=拒绝
    approver_phone TEXT,                -- 审批人手机号
    approve_time DATETIME,              -- 审批时间
    extra_data TEXT,                    -- 额外数据（JSON）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 1.2 现有申请类型
- 早加班申请
- 晚加班申请
- 公休申请
- 约客记录
- （需删除：乐捐报备 → 乐捐已独立为 lejuan_records 表）

### 1.3 现有 API 路由（`backend/routes/applications.js`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/applications` | `['all']` | 提交申请 |
| GET | `/api/applications` | `['all']` | 获取申请列表 |
| PUT | `/:id/approve` | `['coachManagement']` | 审批申请 |
| GET | `/approved-recent` | `['coachManagement']` | 近期审批记录 |
| GET | `/today-approved-overtime` | `['waterBoardManagement']` | 当天加班小时数 |

### 1.4 审批通过时的水牌状态变更逻辑（已有）
- 早加班申请 → 水牌状态 → `早加班`
- 晚加班申请 → 水牌状态 → `晚加班`
- 公休申请 → 水牌状态 → `公休`
- **关键约束**：正在上桌（`早班上桌`/`晚班上桌`）的助教不能审批通过

### 1.5 coaches 表关键字段
- `shift`：`早班` / `晚班`
- `employee_id`：助教工号（页面显示用）
- `coach_no`：内部编号（不显示在页面）
- `stage_name`：艺名

### 1.6 权限矩阵（`backend/middleware/permission.js`）
- **助教权限**（`userType='coach'`）：通过 `COACH_ALLOWED_PERMISSIONS` 中的 `'all'` 访问 applications API
- **管理权限**：`助教管理`、`店长`、`管理员` → `isManager = true`
- **审批权限**：`requireBackendPermission(['coachManagement'])`

### 1.7 乐捐定时器模式（`backend/services/lejuan-timer.js`）
- 内存 `setTimeout` + 数据库 `scheduled` 字段标记
- 服务启动时恢复所有 pending 定时器
- 每分钟轮询兜底
- **可复用于休息/请假定时执行**

### 1.8 前端现有页面结构
- H5 页面在 `/TG/tgservice-uniapp/src/pages/internal/`
- 路由在 `src/pages.json` 注册
- API 封装在 `src/utils/a...
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
2. 修复记录写入 /TG/temp/QA-20260419-1/fix-log.md（如有修复）