你是程序员A。请按设计稿编码实现。

## 设计稿
```
# QA-20260417-07 设计方案：天宫（台桌无关）自动关灯脚本

## 1. 需求理解

### 1.1 背景
天宫国际当前已实现**台桌相关**的自动关灯功能：在同步台桌状态时，自动关闭空闲台桌周边的灯（由 `services/auto-off-lighting.js` 实现，通过 `sync/tables` 接口触发）。

### 1.2 新增需求
还有一些灯是**台桌无关**的（即没有关联到任何台桌的开关），也需要在指定时间段内自动关灯。

### 1.3 核心功能
- 从 DB 查询出台桌无关且处于自动关灯时段内的开关
- 对这些开关发送 MQTT 关灯指令
- 受 `system_settings.switch_auto_off_enabled` 智能省电开关控制

### 1.4 运行环境
| 环境 | 脚本目录 |
|------|----------|
| 生产环境 | `/app/tgservice/scripts/`（Docker 容器内） |
| 测试环境 | `/TG/tgservice/scripts/` |

### 1.5 验收重点
1. ✅ 脚本能正确查询台桌无关的开关
2. ✅ 在指定时间内发出关灯指令
3. ✅ 受智能省电开关控制

---

## 2. 技术方案

### 2.1 新增文件

| 文件 | 路径 | 说明 |
|------|------|------|
| `auto-off-table-independent.js` | `/TG/tgservice/scripts/` | 台桌无关自动关灯脚本（测试环境） |

**注意**：生产环境部署时，该文件会被 Docker 构建过程自动包含到容器内的 `/app/tgservice/scripts/` 目录。

### 2.2 修改文件

| 文件 | 路径 | 修改内容 |
|------|------|----------|
| `switch-routes.js` | `/TG/tgservice/backend/routes/switch-routes.js` | 增加调用台桌无关自动关灯 |
| `auto-off-lighting.js` | `/TG/tgservice/backend/services/auto-off-lighting.js` | 导出 `executeAutoOffTableIndependent` 函数供外部调用 |

**说明**：
- **批处理调用点1**：`triggerAutoOffIfEligible()` 函数（由 `sync/tables` 接口调用），在现有台桌相关关灯后，增加执行台桌无关关灯
- **批处理调用点2**：`/api/switch/auto-off-manual` 接口（H5 智能开关页面「智能省电-手动」按钮），在现有台桌相关关灯后，增加执行台桌无关关灯

### 2.3 API 变更

**无外部 API 变更**。本脚本为独立脚本，但后端内部增加两处调用点：

| 调用点 | 触发方式 | 返回值变化 |
|--------|----------|------------|
| `triggerAutoOffIfEligible()` | `sync/tables` 更新≥40条时触发 | 新增 `independentTurnedOffCount` 字段 |
| `/api/switch/auto-off-manual` | H5 页面手动按钮 | 新增 `independentTurnedOffCount` 字段 |

### 2.4 数据库变更

**无**。复用现有表结构：
- `switch_device` — 设备开关表（含 `auto_off_start`、`auto_off_end` 字段）
- `table_device` — 台桌设备关系表
- `system_settings` — 系统设置表（`switch_auto_off_enabled` 开关）

---

## 3. 脚本设计

### 3.1 执行流程

```
┌─────────────────────────────────────────────────┐
│  启动脚本                                        │
├─────────────────────────────────────────────────┤
│  1. 加载配置（.config 文件）                     │
│     └─ MQTT 配置、环境标识                       │
├──────...
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
2. 修复记录写入 /TG/temp/QA-20260417-07/fix-log.md（如有修复）