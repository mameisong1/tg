你是程序员A。请按设计稿编码实现。

## 设计稿
```
# 天宫QA技术设计方案 - 空调控制功能适配

## QA需求概述

1. 现有灯控制功能加设备类型=灯筛选
2. 复制生成空调控制3大功能
3. 空调MQTT指令适配

## 验收重点

- 设备类型筛选（device_type=灯/空调）
- 空调MQTT指令格式（Topic、Payload）
- 系统配置加载（temp_set、fan_speed_enum）

---

## 一、文件清单

### 1.1 新增文件

| 文件路径 | 说明 |
|---------|------|
| `/TG/tgservice/backend/services/ac-switch.js` | 空调MQTT控制服务（新建） |
| `/TG/tgservice/backend/services/auto-off-ac.js` | 空调自动关服务（新建） |

### 1.2 修改文件

| 文件路径 | 说明 |
|---------|------|
| `/TG/tgservice/backend/routes/switch-routes.js` | 新增空调控制API路由 |
| `/TG/tgservice/backend/services/mqtt-switch.js` | 新增空调MQTT发送函数 |
| `/TG/tgservice-uniapp/src/pages/internal/switch-control.vue` | 新增空调控制UI模块 |
| `/TG/tgservice-uniapp/src/pages/internal/ac-control.vue` | 新建空调管理页面（可选，或集成到switch-control） |

---

## 二、数据库结构

### 2.1 switch_device 表（已存在，无需修改）

```sql
-- 现有字段已支持 device_type
CREATE TABLE switch_device (
  id INTEGER PRIMARY KEY,
  switch_id TEXT NOT NULL,
  switch_seq TEXT NOT NULL,
  switch_label TEXT NOT NULL,
  auto_off_start TEXT DEFAULT '',
  auto_off_end TEXT DEFAULT '',
  auto_on_start TEXT DEFAULT '',
  auto_on_end TEXT DEFAULT '',
  device_type TEXT DEFAULT '灯',  -- ⭐ 新增：'灯' 或 '空调'
  remark TEXT DEFAULT '',
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(switch_id, switch_seq)
);
```

### 2.2 system_config 表（已存在，无需修改）

```sql
-- 空调默认配置已存在
INSERT INTO system_config (key, value, description)
VALUES ('ac_control', '{"temp_set":23,"fan_speed_enum":"middle"}', '空调设定配置');
```

---

## 三、API变更

### 3.1 设备类型筛选（现有API已支持）

```http
GET /api/admin/switches?device_type=灯
GET /api/admin/switches?device_type=空调
```

**说明**：`switch-routes.js` 第 26-45 行已支持 `device_type` 参数筛选。

### 3.2 新增空调控制API

#### 3.2.1 空调场景执行

```http
POST /api/ac/scene/:id
```

**功能**：执行空调场景（类似 `/api/switch/scene/:id`）

**参数**：无

**响应**：
```json
{
  "success": true,
  "count": 5  // 成功发送的设备数
}
```

#### 3.2.2 空调标签批量控制

```http
POST /api/ac/label-control
```

**参数**：
```json
{
  "label": "空调一组",  // 开关标签
  "action": "ON"       // ON=开空调, OFF=关空调
}
```

**响应**：
```json
{
 ...
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
2. 修复记录写入 /TG/temp/QA-20260425-001/fix-log.md（如有修复）