你是程序员A。请按设计稿编码实现。

## 设计稿
```
# 天宫QA项目 - 强制钉钉打卡翻牌设计方案

## QA需求概述

**核心目标**：用户上班打卡不再提交钉钉打卡截图证明打卡时间，改为系统直接使用钉钉推送的打卡时间或系统主动调用接口获取钉钉打卡时间。

**流程设计**：
1. 如果已收到钉钉接口推送的打卡时间 → 直接打卡成功，不需提交截图
2. 系统主动获取10分钟内的钉钉打卡时间 → 成功获取则打卡成功
3. 如果前两个都未成功 → 弹框告知用户必须先钉钉打卡，确认后进入轮询获取
4. 沙漏对话框 + 后台每隔10秒调用接口获取钉钉打卡数据 → 5分钟超时未获取则打卡失败

**验收重点**：
1. 前端打卡流程（提示、勾选框、弹框、沙漏、超时处理）
2. 后端获取钉钉打卡时间（推送+主动查询）
3. 时间写入正确性（Clock_in_time = 钉钉打卡时间）
4. 各场景（上班打卡、乐捐归来、双重场景）处理正确性
5. 5分钟超时逻辑

---

## 技术方案设计

### 1. 新增/修改的文件

#### 1.1 后端新增文件

| 文件路径 | 说明 |
|---------|------|
| `/TG/tgservice/backend/routes/dingtalk-attendance-query.js` | 新增钉钉打卡查询 API（主动查询+轮询状态） |

#### 1.2 后端修改文件

| 文件路径 | 说明 |
|---------|------|
| `/TG/tgservice/backend/routes/coaches.js` | 修改 clock-in API：强制使用钉钉打卡时间（含正常上班 + 乐捐状态上班双重场景） |
| `/TG/tgservice/backend/services/dingtalk-service.js` | 新增轮询查询方法 |
| `/TG/tgservice/backend/server.js` | 注册新路由 `dingtalk-attendance-query` |

**⚠️ 本次不修改**：管理端手动乐捐归来（`lejuan-records.js` 的 return API）本次不做任何修改，维持现状。该功能由助教管理/店长操作，不需要强制钉钉打卡。

#### 1.3 前端修改文件

| 文件路径 | 说明 |
|---------|------|
| `/TG/tgservice-uniapp/src/pages/internal/clock.vue` | 上班打卡页面：新增提示+勾选框、隐藏截图上传、沙漏弹框、超时处理 |
| `/TG/tgservice-uniapp/src/pages/internal/lejuan-return.vue` | 乐捐归来页面（如有）：同上改造 |
| `/TG/tgservice-uniapp/src/utils/api.js` | 新增 API 调用方法 |

#### 1.4 数据库变更

**无需新增表/字段**，现有表结构已支持：
- `attendance_records.dingtalk_in_time` - 钉钉上班打卡时间
- `attendance_records.clock_in_time` - 系统打卡时间（将改为同步钉钉时间）
- `lejuan_records.dingtalk_return_time` - 钉钉乐捐归来时间
- `lejuan_records.return_time` - 系统归来时间（将改为同步钉钉时间）

---

### 2. API 变更设计

#### 2.1 新增 API：钉钉打卡轮询查询

```
POST /api/dingtalk-attendance/query
```

**请求参数**：
```json
{
  "coach_no": "TG001",
  "clock_type": "in",  // in=上班打卡, return=乐捐归来
  "lejuan_id": 123,    // 仅 clock_type=return 时需要
  "timeout_seconds": 300  // 轅时时间，默认300秒（5分钟）
}
```

**响应格式**：
```json
{
  "success": true,
  "data": {
    "status": "found",  // found=已查到, pending=等待中, timeout=超时
    "dingtalk_time": "2026-05-01 14:00:00",  // 钉钉打卡时间
    "message": "已获取钉钉打卡时间"
  }
}
```

**实现逻辑**：...
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

- ✅ 唯一连接：`const { db, dbRun, dbAll, dbGet } = require('./db/index');`（连接 Turso 云端 DB）
- ❌ 禁止：`new sqlite3.Database()`、自行实例化
- ❌ 禁止 `sqlite3` CLI 操作本地 .db 文件（已废弃）

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
2. 修复记录写入 /TG/temp/QA-20260501-1/fix-log.md（如有修复）