你是程序员A。请按设计稿编码实现。

## 设计稿
```
# QA-20260417-10 设计方案：会员管理 — 同步助教

> 作者：程序员A | 日期：2026-04-17 | 状态：待评审

---

## 一、需求概述

后台 Admin 会员管理页面新增「同步助教」按钮，功能：
1. 点击后根据手机号匹配助教表（coaches）中的助教
2. 列出匹配清单，用户勾选是否同步
3. 同步逻辑：
   - 将助教工号（employee_id）和艺名（stage_name）写入会员备注（remark）
   - 会员性别为空时，自动设为「女」
   - 会员姓名为空时，自动填入助教艺名

---

## 二、数据库表结构

### members 表
| 字段 | 类型 | 说明 |
|------|------|------|
| member_no | INTEGER PK | 会员号 |
| phone | TEXT UNIQUE | 手机号 |
| openid | TEXT | 微信openid |
| name | TEXT | 姓名 |
| gender | TEXT | 性别（男/女/空） |
| remark | TEXT | 备注 |
| created_at | DATETIME | 注册时间 |
| updated_at | DATETIME | 更新时间 |

### coaches 表
| 字段 | 类型 | 说明 |
|------|------|------|
| coach_no | INTEGER PK | 助教内部编号 |
| employee_id | TEXT | 助教工号 |
| stage_name | TEXT | 艺名 |
| phone | TEXT | 手机号 |
| status | TEXT | 状态（全职/兼职/离职等） |

**匹配键**：`members.phone = coaches.phone`（精确匹配）

---

## 三、后端 API 设计

### 3.1 匹配接口

```
POST /api/admin/members/sync-coaches/preview
权限：authMiddleware + requireBackendPermission(['coachManagement'])
```

**请求体**：无参数（全量匹配所有有手机号的会员）

**响应**：
```json
{
  "success": true,
  "matches": [
    {
      "member_no": 1,
      "phone": "13800138000",
      "name": "张三",
      "gender": "",
      "remark": "",
      "coach_employee_id": "T001",
      "coach_stage_name": "小美",
      "coach_status": "全职"
    }
  ],
  "summary": {
    "totalMembers": 100,
    "totalCoaches": 20,
    "matchedCount": 5
  }
}
```

**匹配 SQL**：
```sql
SELECT 
  m.member_no, m.phone, m.name, m.gender, m.remark,
  c.employee_id AS coach_employee_id, 
  c.stage_name AS coach_stage_name,
  c.status AS coach_status
FROM members m
INNER JOIN coaches c ON m.phone = c.phone
WHERE m.phone IS NOT NULL AND m.phone != ''
  AND c.phone IS NOT NULL AND c.phone != ''
  AND c.status != '离职'
ORDER BY m.member_no
```

**设计说明**：
- 使用 `INNER JOIN` 只返回有匹配的记录
- 排除 `status = '离职'` 的助教（在职助教才有同步意义）
- 排除空手机号
- 返回完整的会员和助教信息，方便前端展示对比

---

### 3.2 执行同步接口

```
POST /api/admin/members/sync-coaches/execute
权限：authMiddleware + requireBackendPermission(['coachManagement'...
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
2. 修复记录写入 /TG/temp/QA-20260417-10/fix-log.md（如有修复）