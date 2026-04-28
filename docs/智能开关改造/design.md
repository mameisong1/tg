# 天宫智能开关改造 - 技术设计方案

> 版本: v1.0 | 日期: 2026-04-14 | 设计: 程序员A

---

## 目录

1. [数据库表设计](#1-数据库表设计)
2. [配置文件](#2-配置文件)
3. [后端 API 设计](#3-后端-api-设计)
4. [自动关灯功能设计](#4-自动关灯功能设计)
4A. [定时自动开灯功能设计](#4a-定时自动开灯功能设计)
5. [MQTT 指令模块设计](#5-mqtt-指令模块设计)
6. [后台 admin 管理页面设计](#6-后台-admin-管理页面设计)
7. [前台 H5 智能开关页面设计](#7-前台-h5-智能开关页面设计)
8. [数据导入方案](#8-数据导入方案)
9. [编码注意事项](#9-编码注意事项)
10. [文件清单](#10-文件清单)

---

## 1. 数据库表设计

### 1.1 设备开关表 (switch_device)

存储每个智能开关设备的信息。一个物理大开关（由开关ID标识）包含多个小开关（由开关序号标识）。

```sql
CREATE TABLE IF NOT EXISTS switch_device (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  switch_id         TEXT    NOT NULL,               -- 开关ID（大开关标识，如 0xa4c1380bbd942cbe）
  switch_seq        TEXT    NOT NULL,               -- 开关序号（小开关标识，如 state_l1）
  switch_label      TEXT    NOT NULL DEFAULT '',    -- 开关标签（数字标签，如 1, 2, tv 等）
  auto_off_start    TEXT    DEFAULT '',             -- 自动关灯开始时间（格式 HH:MM，如 04:00）
  auto_off_end      TEXT    DEFAULT '',             -- 自动关灯结束时间（格式 HH:MM，如 14:00）
  auto_on_start     TEXT    DEFAULT '',             -- 定时自动开灯开始时间（格式 HH:MM，如 06:00）
  auto_on_end       TEXT    DEFAULT '',             -- 定时自动开灯结束时间（格式 HH:MM，如 22:00）
  created_at        TEXT    NOT NULL,               -- 创建时间
  updated_at        TEXT    NOT NULL,               -- 更新时间
  UNIQUE(switch_id, switch_seq)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_switch_device_label ON switch_device(switch_label);
CREATE INDEX IF NOT EXISTS idx_switch_device_auto_off ON switch_device(auto_off_start, auto_off_end);
CREATE INDEX IF NOT EXISTS idx_switch_device_auto_on ON switch_device(auto_on_start, auto_on_end);
```

**字段说明**：
- `switch_id` + `switch_seq` 组成唯一约束，作为业务主键
- `switch_label`：开关标签，用于前台按标签批量操作。一个标签可能对应多个开关ID+序号组合
- `auto_off_start` / `auto_off_end`：自动关灯时间段。格式为 `HH:MM`，空字符串表示不启用自动关灯
- `auto_on_start` / `auto_on_end`：定时自动开灯时间段。格式为 `HH:MM`，空字符串表示不启用定时自动开灯
- 两个时间段**均支持跨午夜**（如 22:00~06:00），详见第4节和第4A节的SQL实现

### 1.2 台桌设备表 (table_device)

存储台桌与开关设备的多对多关联关系。说明台桌周边有哪些灯具设备。

```sql
CREATE TABLE IF NOT EXISTS table_device (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name_en   TEXT    NOT NULL,               -- 台桌英文名（如 putai1, tvtai）
  switch_seq      TEXT    NOT NULL,               -- 开关序号（如 state_l1）
  switch_label    TEXT    NOT NULL,               -- 开关标签（如 1, 2, tv 等）
  created_at      TEXT    NOT NULL,               -- 创建时间
  updated_at      TEXT    NOT NULL,               -- 更新时间
  UNIQUE(table_name_en, switch_seq, switch_label)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_table_device_table ON table_device(table_name_en);
CREATE INDEX IF NOT EXISTS idx_table_device_switch ON table_device(switch_seq, switch_label);
```

**字段说明**：
- `table_name_en` + `switch_seq` + `switch_label` 组成唯一约束（**严格对应需求**）
- 一个台桌可以关联多个开关，一个开关也可以关联多个台桌（多对多）
- 与 `switch_device` 表的关联通过 `switch_seq + switch_label` 进行 JOIN 查询

### 1.4 系统配置表 (system_settings)

存储系统级配置项（如自动关灯/开灯启停状态）。

```sql
CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 自动关灯状态：key='switch_auto_off_enabled', value='1'(开启)/'0'(关闭)
-- 定时自动开灯状态：key='switch_auto_on_enabled', value='1'(开启)/'0'(关闭)
```

### 1.3 开关场景表 (switch_scene)

存储预设的开关场景（如全部开灯、全部关灯、9点开灯等），用于一键操作。

```sql
CREATE TABLE IF NOT EXISTS switch_scene (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_name      TEXT    NOT NULL UNIQUE,        -- 场景名称（如 全部开灯, 全部关灯）
  action          TEXT    NOT NULL,               -- 动作：ON（开灯）/ OFF（关灯）
  switches        TEXT    NOT NULL,               -- 开关数组（JSON格式）
  sort_order      INTEGER NOT NULL DEFAULT 0,     -- 排序序号
  created_at      TEXT    NOT NULL,               -- 创建时间
  updated_at      TEXT    NOT NULL                -- 更新时间
);
```

**switches 字段 JSON 格式示例**：
```json
[
  {"switch_id": "0xa4c1380bbd942cbe", "switch_seq": "state_l1"},
  {"switch_id": "0xa4c1380bbd942cbe", "switch_seq": "state_l2"}
]
```

---

## 2. 配置文件

在 `.config` 文件中新增 `mqtt` 配置节：

```json
{
  "mqtt": {
    "host": "mqtt://8.134.248.240",
    "port": 1883,
    "username": "admin",
    "password": "mms6332628",
    "topic": "tiangongguoji",
    "_comment": "MQTT智能开关配置。测试环境仅写日志，不真实发送"
  }
}
```

**测试环境判断**：通过 `.config` 中已有的 `env.name` 字段判断：
- `name: "production"` → 真实发送 MQTT 指令
- `name: "test"` → 仅写入日志

---

## 3. 后端 API 设计

### 3.1 设备开关管理 API

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/admin/switches` | vipRoomManagement | 获取开关列表（支持标签筛选） |
| POST | `/api/admin/switches` | vipRoomManagement | 新增开关 |
| PUT | `/api/admin/switches/:id` | vipRoomManagement | 更新开关 |
| DELETE | `/api/admin/switches/:id` | vipRoomManagement | 删除开关 |
| POST | `/api/admin/switches/batch` | vipRoomManagement | 批量导入开关数据 |

### 3.2 台桌设备关系 API

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/admin/table-devices` | vipRoomManagement | 获取台桌设备关系列表 |
| POST | `/api/admin/table-devices` | vipRoomManagement | 新增台桌设备关系 |
| PUT | `/api/admin/table-devices/:id` | vipRoomManagement | 更新台桌设备关系 |
| DELETE | `/api/admin/table-devices/:id` | vipRoomManagement | 删除台桌设备关系 |
| POST | `/api/admin/table-devices/batch` | vipRoomManagement | 批量导入台桌设备数据 |

### 3.3 开关场景 API

> ⚠️ 需求原文要求开关场景表为 **CRD**（创建、读取、删除），**无更新（U）**。

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/admin/switch-scenes` | vipRoomManagement | 获取场景列表 |
| POST | `/api/admin/switch-scenes` | vipRoomManagement | 新增场景 |
| DELETE | `/api/admin/switch-scenes/:id` | vipRoomManagement | 删除场景 |

**注意**：不提供 `PUT /api/admin/switch-scenes/:id` 更新接口。如场景需要修改，先删除再重新创建。

### 3.4 智能开关控制 API（前台H5用）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/switch/auto-status` | 店长/助教管理 | 获取自动关灯/开灯功能状态 |
| POST | `/api/switch/auto-off-toggle` | 店长/助教管理 | 切换自动关灯启停 |
| POST | `/api/switch/auto-on-toggle` | 店长/助教管理 | 切换定时自动开灯启停 |
| POST | `/api/switch/scene/:id` | 店长/助教管理 | 执行场景（开灯/关灯） |
| POST | `/api/switch/label-control` | 店长/助教管理 | 按标签批量控制开关 |
| POST | `/api/switch/manual-control` | 店长/助教管理 | 手动控制指定开关 |
| GET | `/api/switch/labels` | 店长/助教管理 | 获取所有开关标签列表 |
| GET | `/api/switch/scenes` | 店长/助教管理 | 获取场景列表（前台用） |

### 3.5 定时自动开灯触发接口（新增）

**新增 cron 定时任务**：每 5 分钟执行一次，检查定时自动开灯条件。

```javascript
// server.js 中注册定时任务
const cron = require('node-cron');
const { executeAutoOnLighting } = require('./services/auto-on-lighting');

// 每5分钟执行一次定时自动开灯检查
cron.schedule('*/5 * * * *', async () => {
  try {
    await executeAutoOnLighting();
  } catch (err) {
    logger.error(`[定时自动开灯] 执行失败: ${err.message}`);
  }
});
```

详见第4A节。

### 3.6 台桌同步接口改造（新增触发逻辑）

**现有接口**：`POST /api/admin/sync/tables`（已存在，server.js 第3317行）

**改造方案**：在现有同步接口成功后，增加触发条件判断和自动关灯执行。

---

## 4. 自动关灯功能设计

### 4.1 触发逻辑

在现有台桌状态同步接口 `POST /api/admin/sync/tables` 中，成功更新数据后增加触发逻辑：

```
触发条件：
  1. 台桌数据正确更新 >= 40 条（tablesUpdated + vipRoomsUpdated >= 40）
  2. 自动关灯功能处于"开启"状态（通过 system_settings 表记录）

触发方式：同步执行（在同一个请求响应周期内完成）
```

**改造位置**：`server.js` 第3371行之后（台桌同步完成日志之后，返回响应之前）。

### 4.2 SQL 查询逻辑

采用集合差集算法：**可能要关的灯 - 不能关的灯 = 要关的灯**

#### ⚠️ 跨午夜时间判断核心逻辑

自动关灯时间段需要支持跨午夜场景（如 22:00~06:00）。SQL 判断逻辑如下：

```
-- 不跨午夜（如 04:00~14:00）：start <= end
--   判断：当前时间 >= start AND 当前时间 <= end

-- 跨午夜（如 22:00~06:00）：start > end
--   判断：当前时间 >= start OR 当前时间 <= end
```

#### 完整SQL实现

在 SQL 中使用 CASE 表达式实现跨午夜判断：

```sql
-- 时间窗口判断子表达式（在两个查询中复用）
(
  CASE
    WHEN sd.auto_off_start <= sd.auto_off_end THEN
      -- 不跨午夜：当前时间在 [start, end] 范围内
      (TIME(?) >= TIME(sd.auto_off_start) AND TIME(?) <= TIME(sd.auto_off_end))
    ELSE
      -- 跨午夜：当前时间在 [start, 23:59] 或 [00:00, end] 范围内
      (TIME(?) >= TIME(sd.auto_off_start) OR TIME(?) <= TIME(sd.auto_off_end))
  END
)
```

#### 步骤1：找出"可能要关的灯"

```sql
SELECT DISTINCT sd.switch_id, sd.switch_seq
FROM tables t
JOIN table_device td ON LOWER(td.table_name_en) = LOWER(t.name_pinyin)
JOIN switch_device sd ON sd.switch_seq = td.switch_seq AND sd.switch_label = td.switch_label
WHERE t.status = '空闲'
  AND sd.auto_off_start != ''
  AND sd.auto_off_end != ''
  AND (
    CASE
      WHEN sd.auto_off_start <= sd.auto_off_end THEN
        (TIME(?) >= TIME(sd.auto_off_start) AND TIME(?) <= TIME(sd.auto_off_end))
      ELSE
        (TIME(?) >= TIME(sd.auto_off_start) OR TIME(?) <= TIME(sd.auto_off_end))
    END
  )
```

说明：
- `?` 参数传入当前北京时间 `TimeUtil.nowDB()`，共传入 **4次**（CASE 的每个分支各2次）
- JOIN 条件使用 `switch_seq + switch_label`（对应修正后的 `table_device` 表结构）

#### 步骤2：找出"不能关的灯"

```sql
SELECT DISTINCT sd.switch_id, sd.switch_seq
FROM tables t
JOIN table_device td ON LOWER(td.table_name_en) = LOWER(t.name_pinyin)
JOIN switch_device sd ON sd.switch_seq = td.switch_seq AND sd.switch_label = td.switch_label
WHERE t.status != '空闲'
  AND sd.auto_off_start != ''
  AND sd.auto_off_end != ''
  AND (
    CASE
      WHEN sd.auto_off_start <= sd.auto_off_end THEN
        (TIME(?) >= TIME(sd.auto_off_start) AND TIME(?) <= TIME(sd.auto_off_end))
      ELSE
        (TIME(?) >= TIME(sd.auto_off_start) OR TIME(?) <= TIME(sd.auto_off_end))
    END
  )
```

#### 步骤3：集合差集（代码层面实现）

```javascript
// 可能要关的灯 - 不能关的灯 = 要关的灯
const maybeOffSet = new Set(maybeOff.map(s => `${s.switch_id}|${s.switch_seq}`));
const cannotOffSet = new Set(cannotOff.map(s => `${s.switch_id}|${s.switch_seq}`));

const toTurnOff = [...maybeOffSet]
  .filter(key => !cannotOffSet.has(key))
  .map(key => {
    const [switch_id, switch_seq] = key.split('|');
    return { switch_id, switch_seq };
  });

logger.info(`自动关灯: 可能要关 ${maybeOff.length} 个, 不能关 ${cannotOff.length} 个, 实际要关 ${toTurnOff.length} 个`);
```

#### 步骤4：发送 MQTT 关灯指令

遍历 `toTurnOff` 数组，逐个发送 MQTT 关灯指令（详见第5节）。

### 4.3 自动关灯状态管理

使用 `system_settings` 表存储自动关灯功能的启停状态：

```sql
-- 自动关灯状态：
-- key: 'switch_auto_off_enabled', value: '1' (开启) / '0' (关闭)
-- 定时自动开灯状态：
-- key: 'switch_auto_on_enabled', value: '1' (开启) / '0' (关闭)
```

API 接口：
- `GET /api/switch/auto-status` → 返回 `{ auto_off_enabled: true/false, auto_on_enabled: true/false }`
- `POST /api/switch/auto-off-toggle` → 切换自动关灯启停
- `POST /api/switch/auto-on-toggle` → 切换定时自动开灯启停

---

## 4A. 定时自动开灯功能设计

> 对应需求原文："实现根据开台情况自动关灯，**定时自动开灯**，手动批量开灯等功能"

### 4A.1 功能概述

定时自动开灯功能与自动关灯功能**对称设计**：
- 自动关灯：台桌**空闲**且在关灯时段内 → 关灯
- 定时自动开灯：台桌**空闲**且在开灯时段内 → 开灯

**业务场景**：球房营业期间，空闲台桌需要保持照明。当台桌在开灯时段内变为空闲时，自动打开该台桌关联的灯具。

### 4A.2 触发机制

采用 **cron 定时任务** 方式，每 5 分钟执行一次检查：

```
触发条件：
  1. 定时自动开灯功能处于"开启"状态
  2. 当前时间处于设备的 auto_on_start ~ auto_on_end 时段内（支持跨午夜）
  3. 台桌状态为"空闲"

触发方式：定时任务异步执行（不影响同步接口）
执行频率：每 5 分钟
```

### 4A.3 SQL 查询逻辑

同样采用集合差集算法：**可能要开的灯 - 已经在亮的灯 = 要开的灯**

#### 步骤1：找出"可能要开的灯"

```sql
SELECT DISTINCT sd.switch_id, sd.switch_seq
FROM tables t
JOIN table_device td ON LOWER(td.table_name_en) = LOWER(t.name_pinyin)
JOIN switch_device sd ON sd.switch_seq = td.switch_seq AND sd.switch_label = td.switch_label
WHERE t.status = '空闲'
  AND sd.auto_on_start != ''
  AND sd.auto_on_end != ''
  AND (
    CASE
      WHEN sd.auto_on_start <= sd.auto_on_end THEN
        (TIME(?) >= TIME(sd.auto_on_start) AND TIME(?) <= TIME(sd.auto_on_end))
      ELSE
        (TIME(?) >= TIME(sd.auto_on_start) OR TIME(?) <= TIME(sd.auto_on_end))
    END
  )
```

#### 步骤2：找出"已经在亮的灯"

> 注：当前系统没有灯具实时状态反馈，因此"已经在亮的灯"集合暂时为空。
> 后续如果 MQTT broker 支持状态反馈，可以补充此查询。

```sql
-- 暂不实现，返回空集合
-- 预留：当有灯具状态表时，查询当前状态为 ON 的灯
```

#### 步骤3：集合差集

```javascript
// 可能要开的灯 - 已经在亮的灯（暂为空） = 要开的灯
const maybeOnSet = new Set(maybeOn.map(s => `${s.switch_id}|${s.switch_seq}`));
// const alreadyOnSet = new Set(alreadyOn.map(s => `${s.switch_id}|${s.switch_seq}`));
const alreadyOnSet = new Set(); // 暂为空

const toTurnOn = [...maybeOnSet]
  .filter(key => !alreadyOnSet.has(key))
  .map(key => {
    const [switch_id, switch_seq] = key.split('|');
    return { switch_id, switch_seq };
  });

logger.info(`定时自动开灯: 可能要开 ${maybeOn.length} 个, 已经在亮 0 个, 实际要开 ${toTurnOn.length} 个`);
```

#### 步骤4：发送 MQTT 开灯指令

遍历 `toTurnOn` 数组，逐个发送 MQTT 开灯指令（`action = 'ON'`）。

### 4A.4 配置项

| 配置项 | 存储位置 | 说明 |
|--------|----------|------|
| `switch_auto_on_enabled` | system_settings | 定时自动开灯启停状态（'1'/'0'） |
| `sd.auto_on_start` | switch_device 表 | 每台设备的自动开灯开始时间（HH:MM） |
| `sd.auto_on_end` | switch_device 表 | 每台设备的自动开灯结束时间（HH:MM） |
| 执行频率 | 代码硬编码 | 每 5 分钟执行一次 |

### 4A.5 实现文件

新建文件：`/TG/tgservice/backend/services/auto-on-lighting.js`

```javascript
/**
 * 定时自动开灯服务
 * 每5分钟检查一次，对空闲台桌在开灯时段内的灯具发送MQTT开灯指令
 */

const TimeUtil = require('../utils/time');
const { all, get } = require('../db/index');
const { sendBatchCommand } = require('./mqtt-switch');

/**
 * 判断当前时间是否在指定时段内（支持跨午夜）
 * 内部 SQL 已处理跨午夜逻辑，此处为代码辅助判断
 */
function isInTimeWindow(currentTime, startTime, endTime) {
  if (!startTime || !endTime) return false;
  if (startTime <= endTime) {
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    // 跨午夜
    return currentTime >= startTime || currentTime <= endTime;
  }
}

/**
 * 执行定时自动开灯
 */
async function executeAutoOnLighting() {
  // 1. 检查定时自动开灯功能是否开启
  const setting = await get("SELECT value FROM system_settings WHERE key = 'switch_auto_on_enabled'");
  if (!setting || setting.value !== '1') {
    return { status: 'disabled' };
  }

  const now = TimeUtil.nowDB();
  const currentTime = now.split(' ')[1].substring(0, 5); // 提取 HH:MM

  // 2. 查询可能要开的灯（SQL 中已处理跨午夜逻辑）
  const maybeOn = await all(`
    SELECT DISTINCT sd.switch_id, sd.switch_seq
    FROM tables t
    JOIN table_device td ON LOWER(td.table_name_en) = LOWER(t.name_pinyin)
    JOIN switch_device sd ON sd.switch_seq = td.switch_seq AND sd.switch_label = td.switch_label
    WHERE t.status = '空闲'
      AND sd.auto_on_start != ''
      AND sd.auto_on_end != ''
      AND (
        CASE
          WHEN sd.auto_on_start <= sd.auto_on_end THEN
            (TIME(?) >= TIME(sd.auto_on_start) AND TIME(?) <= TIME(sd.auto_on_end))
          ELSE
            (TIME(?) >= TIME(sd.auto_on_start) OR TIME(?) <= TIME(sd.auto_on_end))
        END
      )
  `, [now, now, now, now]);

  if (maybeOn.length === 0) {
    logger.info('[定时自动开灯] 无需要开灯的设备');
    return { status: 'ok', turnedOn: 0 };
  }

  // 3. 暂不判断"已经在亮的灯"（无实时状态反馈）
  const toTurnOn = maybeOn;

  // 4. 发送 MQTT 开灯指令
  const successCount = await sendBatchCommand(toTurnOn, 'ON');

  logger.info(`[定时自动开灯] 可能要开 ${maybeOn.length} 个, 实际开 ${successCount} 个`);
  return { status: 'ok', turnedOn: successCount };
}

module.exports = { executeAutoOnLighting };
```

### 4A.6 与自动关灯的协调

| 场景 | 自动关灯 | 定时自动开灯 | 结果 |
|------|----------|-------------|------|
| 台桌空闲 + 在关灯时段内 | ✅ 关灯 | - | 灯关闭 |
| 台桌空闲 + 在开灯时段内 | - | ✅ 开灯 | 灯打开 |
| 台桌空闲 + 同时在两个时段 | ✅ 关灯 | ✅ 开灯 | **自动关灯优先**（因为台灯同步触发更快） |
| 台桌非空闲 | 不触发 | 不触发 | 不受影响 |

> **优先级说明**：自动关灯通过台桌同步接口实时触发（秒级），定时自动开灯每5分钟检查一次。
> 当两个时段重叠时，自动关灯优先执行。这是合理的，因为有人在使用台桌时关灯优先于开灯。

---

## 5. MQTT 指令模块设计

### 5.1 模块文件

新建文件：`/TG/tgservice/backend/services/mqtt-switch.js`

### 5.2 实现方案

```javascript
/**
 * MQTT 智能开关控制模块
 * 测试环境仅写日志，生产环境真实发送
 */

const mqtt = require('mqtt');
const config = require('../config-loader');  // 加载 .config 文件
const TimeUtil = require('../utils/time');

let client = null;

/**
 * 初始化 MQTT 连接（惰性初始化）
 */
async function getClient() {
  if (client && client.connected) return client;

  const mqttConfig = config.mqtt;
  if (!mqttConfig) {
    console.warn('[MQTT] 未配置 MQTT，跳过初始化');
    return null;
  }

  return new Promise((resolve, reject) => {
    const url = `${mqttConfig.host}:${mqttConfig.port}`;
    client = mqtt.connect(url, {
      username: mqttConfig.username,
      password: mqttConfig.password,
      clientId: `tgservice_switch_${Date.now()}`
    });

    client.on('connect', () => {
      console.log('[MQTT] 连接成功');
      resolve(client);
    });

    client.on('error', (err) => {
      console.error(`[MQTT] 连接失败: ${err.message}`);
      reject(err);
    });
  });
}

/**
 * 发送开关指令
 * @param {string} switchId - 开关ID
 * @param {string} switchSeq - 开关序号
 * @param {string} action - 'ON' 或 'OFF'
 */
async function sendSwitchCommand(switchId, switchSeq, action) {
  const mqttConfig = config.mqtt;
  if (!mqttConfig) {
    console.warn(`[MQTT] 未配置 MQTT，跳过指令: ${switchId} ${switchSeq} ${action}`);
    return false;
  }

  const envName = config.env?.name || 'production';
  const payload = JSON.stringify({
    id: switchId,
    [switchSeq]: action
  });

  // 测试环境：只写日志
  if (envName === 'test') {
    console.log(`[MQTT-TEST] 模拟发送指令: topic=${mqttConfig.topic}, payload=${payload}`);
    return true;
  }

  // 生产环境：真实发送
  try {
    const mqttClient = await getClient();
    if (!mqttClient) return false;

    mqttClient.publish(mqttConfig.topic, payload, { qos: 1 });
    console.log(`[MQTT] 指令已发送: ${switchId} ${switchSeq} ${action}`);
    return true;
  } catch (err) {
    console.error(`[MQTT] 发送失败: ${err.message}`);
    return false;
  }
}

/**
 * 批量发送指令
 * @param {Array} switches - [{switch_id, switch_seq, action}]
 */
async function sendBatchCommand(switches, action) {
  let successCount = 0;
  for (const sw of switches) {
    const ok = await sendSwitchCommand(sw.switch_id, sw.switch_seq, action);
    if (ok) successCount++;
    // 每个指令间隔 100ms，避免 MQTT broker 过载
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`[MQTT] 批量发送完成: ${successCount}/${switches.length} 成功`);
  return successCount;
}

module.exports = {
  getClient,
  sendSwitchCommand,
  sendBatchCommand
};
```

### 5.3 依赖安装

```bash
cd /TG/tgservice/backend
npm install mqtt --save
```

---

## 6. 后台 admin 管理页面设计

在 `/TG/tgservice/admin/index.html` 侧边栏新增 **"设备管理"** 折叠菜单组，包含3个子菜单。

### 6.1 侧边栏新增菜单

在 index.html 侧边栏的"系统"菜单组之前插入：

```html
<!-- 设备管理 -->
<div class="nav-group">
  <div class="nav-group-title" onclick="toggleGroup(this)">
    <span class="group-icon">💡</span>
    <span class="group-text">设备管理</span>
    <span class="arrow">▼</span>
  </div>
  <div class="nav-submenu">
    <a href="switch-devices.html" class="nav-item"><span class="nav-icon">🔌</span> 设备开关管理</a>
    <a href="table-devices.html" class="nav-item"><span class="nav-icon">🎱</span> 台桌设备关系</a>
    <a href="switch-scenes.html" class="nav-item"><span class="nav-icon">🎬</span> 开关场景管理</a>
  </div>
</div>
```

### 6.2 页面1：设备开关管理 (switch-devices.html)

**风格**：与现有 admin 页面一致（暗色主题 + 金色点缀）。

**功能**：
- 列表展示所有开关设备（分页）
- 新增/编辑/删除开关
- 按开关标签筛选
- 批量导入（从 Excel）

**表单字段**：
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 开关ID | 文本 | ✅ | 大开关标识 |
| 开关序号 | 文本 | ✅ | 小开关标识 |
| 开关标签 | 文本/数字 | ✅ | 标签号 |
| 自动关灯开始时间 | 文本 | | 格式 HH:MM（支持跨午夜） |
| 自动关灯结束时间 | 文本 | | 格式 HH:MM（支持跨午夜） |
| 定时自动开灯开始时间 | 文本 | | 格式 HH:MM（支持跨午夜） |
| 定时自动开灯结束时间 | 文本 | | 格式 HH:MM（支持跨午夜） |

### 6.3 页面2：台桌设备关系 (table-devices.html)

**功能**：
- 列表展示台桌与开关的关联关系
- 新增/编辑/删除关联
- 按台桌名筛选
- 批量导入

**表单字段**：
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 台桌英文名 | 下拉选择 | ✅ | 从 tables 表加载 |
| 开关序号 | 文本 | ✅ | 如 state_l1 |
| 开关标签 | 文本/数字 | ✅ | 如 1, 2, tv 等 |

### 6.4 页面3：开关场景管理 (switch-scenes.html)

**功能**：
- 列表展示所有场景
- 新增/删除场景（**⚠️ 不提供编辑功能，需求原文为 CRD**）
- 拖拽排序（sort_order）

> 如需修改场景，先删除再重新创建。

**新增场景表单**：
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 场景名称 | 文本 | ✅ | 如"全部开灯" |
| 动作 | 单选 | ✅ | ON（开灯）/ OFF（关灯） |
| 开关数组 | 多行文本 | ✅ | 每行一个开关，格式：`开关ID<TAB>开关序号` |
| 排序 | 数字 | | 数字越小越靠前 |

**多行文本解析逻辑**（前端 JS）：
```javascript
function parseSwitchesInput(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const switches = lines.map(line => {
    const parts = line.split('\t');  // TAB 分割
    if (parts.length >= 2) {
      return {
        switch_id: parts[0].trim(),
        switch_seq: parts[1].trim()
      };
    }
    return null;
  }).filter(Boolean);
  return JSON.stringify(switches);
}
```

**显示时反向转换**：
```javascript
function formatSwitchesInput(jsonStr) {
  const switches = JSON.parse(jsonStr);
  return switches.map(s => `${s.switch_id}\t${s.switch_seq}`).join('\n');
}
```

### 6.5 权限控制

后台菜单使用现有的 `requireBackendPermission(['vipRoomManagement'])` 中间件保护。

根据 permission.js，**管理员、店长、助教管理** 拥有 `vipRoomManagement` 权限，可以访问设备管理页面。

---

## 7. 前台 H5 智能开关页面设计

### 7.1 页面位置

新建页面：`/TG/tgservice-uniapp/src/pages/internal/switch-control.vue`

在内部功能菜单（internal 路由）中新增入口。

### 7.2 页面布局设计

```
┌──────────────────────────────────────┐
│  ← 智能开关管理                      │  顶部导航栏
├──────────────────────────────────────┤
│                                      │
│  ┌────────────────────────────────┐  │
│  │  ⚡ 自动关灯功能               │  │  状态卡片
│  │  [● 已开启]  ← 点击切换启停    │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  🎬 快捷场景                   │  │  场景按钮区域
│  │  [全部开灯] [全部关灯]         │  │  网格布局
│  │  [9点开灯]  [14点开灯]         │  │
│  │  [17点开灯]                    │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  🔌 标签控制                   │  │  标签控制区域
│  │  [下拉选择标签 ▼]              │  │
│  │  [💡 开灯]    [🌙 关灯]        │  │
│  └────────────────────────────────┘  │
│                                      │
└──────────────────────────────────────┘
```

### 7.3 页面代码结构

```vue
<template>
  <view class="page">
    <!-- 固定顶部导航 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">智能开关管理</text>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <scroll-view class="content" scroll-y>
      <!-- 自动关灯启停卡片 -->
      <view class="card auto-off-card">
        <view class="card-header">
          <text class="card-icon">⚡</text>
          <text class="card-title">自动关灯功能</text>
        </view>
        <view class="card-body">
          <view class="toggle-row" @click="toggleAutoOff">
            <text class="toggle-status" :class="autoOffEnabled ? 'on' : 'off'">
              {{ autoOffEnabled ? '已开启' : '已关闭' }}
            </text>
            <view class="toggle-switch" :class="{ active: autoOffEnabled }">
              <view class="toggle-thumb"></view>
            </view>
          </view>
          <text class="toggle-desc">开启后，台桌空闲且处于自动关灯时段时将自动关灯（支持跨午夜时段）</text>
        </view>
      </view>

      <!-- 定时自动开灯启停卡片 -->
      <view class="card auto-on-card">
        <view class="card-header">
          <text class="card-icon">🌅</text>
          <text class="card-title">定时自动开灯功能</text>
        </view>
        <view class="card-body">
          <view class="toggle-row" @click="toggleAutoOn">
            <text class="toggle-status" :class="autoOnEnabled ? 'on' : 'off'">
              {{ autoOnEnabled ? '已开启' : '已关闭' }}
            </text>
            <view class="toggle-switch" :class="{ active: autoOnEnabled }">
              <view class="toggle-thumb"></view>
            </view>
          </view>
          <text class="toggle-desc">开启后，空闲台桌在开灯时段内将自动开灯（每5分钟检查一次，支持跨午夜时段）</text>
        </view>
      </view>

      <!-- 快捷场景卡片 -->
      <view class="card scene-card">
        <view class="card-header">
          <text class="card-icon">🎬</text>
          <text class="card-title">快捷场景</text>
        </view>
        <view class="card-body">
          <view class="scene-grid">
            <view class="scene-btn"
                  v-for="scene in scenes"
                  :key="scene.id"
                  :class="scene.action === 'ON' ? 'scene-on' : 'scene-off'"
                  @click="executeScene(scene)">
              <text class="scene-btn-icon">{{ scene.action === 'ON' ? '💡' : '🌙' }}</text>
              <text class="scene-btn-text">{{ scene.scene_name }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 标签控制卡片 -->
      <view class="card label-card">
        <view class="card-header">
          <text class="card-icon">🔌</text>
          <text class="card-title">标签控制</text>
        </view>
        <view class="card-body">
          <picker mode="selector" :range="labelNames" :value="selectedLabelIndex" @change="onLabelChange">
            <view class="label-picker">
              <text class="label-picker-text">{{ selectedLabel || '选择开关标签' }}</text>
              <text class="label-picker-arrow">▼</text>
            </view>
          </picker>
          <view class="label-actions" v-if="selectedLabel">
            <view class="action-btn btn-on" @click="labelControl('ON')">
              <text>💡 开灯</text>
            </view>
            <view class="action-btn btn-off" @click="labelControl('OFF')">
              <text>🌙 关灯</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 操作确认弹窗 -->
    <view class="confirm-overlay" v-if="showConfirm" @click="closeConfirm">
      <view class="confirm-box" @click.stop>
        <text class="confirm-title">确认操作</text>
        <text class="confirm-text">{{ confirmText }}</text>
        <view class="confirm-buttons">
          <view class="confirm-btn cancel" @click="closeConfirm"><text>取消</text></view>
          <view class="confirm-btn ok" @click="confirmAction"><text>确认</text></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import api from '@/utils/api-v2.js'

const statusBarHeight = ref(20)
const autoOffEnabled = ref(false)
const autoOnEnabled = ref(false)
const scenes = ref([])
const labels = ref([])
const labelNames = computed(() => labels.value.map(l => l.label))
const selectedLabelIndex = ref(-1)
const selectedLabel = ref('')
const showConfirm = ref(false)
const confirmText = ref('')
let pendingAction = null

onLoad(() => {
  // 权限检查
  checkPermission()
  loadAllData()
})

async function checkPermission() {
  try {
    const res = await api.get('/api/auth/check-permission')
    const role = res.data?.role
    const allowed = ['店长', '助教管理', '管理员']
    if (!allowed.includes(role)) {
      uni.showToast({ title: '权限不足，仅店长和助教管理可用', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 1500)
    }
  } catch (e) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => uni.reLaunch({ url: '/pages/internal/admin-login' }), 1500)
  }
}

async function loadAllData() {
  await Promise.all([loadAutoStatus(), loadScenes(), loadLabels()])
}

async function loadAutoStatus() {
  try {
    const res = await api.get('/api/switch/auto-status')
    autoOffEnabled.value = res.data?.auto_off_enabled === true
    autoOnEnabled.value = res.data?.auto_on_enabled === true
  } catch (e) { /* ignore */ }
}

async function loadScenes() {
  try {
    const res = await api.get('/api/switch/scenes')
    scenes.value = res.data || []
  } catch (e) { /* ignore */ }
}

async function loadLabels() {
  try {
    const res = await api.get('/api/switch/labels')
    labels.value = res.data || []
  } catch (e) { /* ignore */ }
}

async function toggleAutoOff() {
  const action = autoOffEnabled.value ? '关闭' : '开启'
  confirmText.value = `确认${action}自动关灯功能？`
  pendingAction = 'toggleAutoOff'
  showConfirm.value = true
}

async function toggleAutoOn() {
  const action = autoOnEnabled.value ? '关闭' : '开启'
  confirmText.value = `确认${action}定时自动开灯功能？`
  pendingAction = 'toggleAutoOn'
  showConfirm.value = true
}

async function executeScene(scene) {
  confirmText.value = `确认执行场景"${scene.scene_name}"？（${scene.action === 'ON' ? '开灯' : '关灯'}）`
  pendingAction = { type: 'scene', scene }
  showConfirm.value = true
}

function onLabelChange(e) {
  selectedLabelIndex.value = e.detail.value
  selectedLabel.value = labelNames.value[e.detail.value]
}

function labelControl(action) {
  if (!selectedLabel.value) return
  confirmText.value = `确认对标签"${selectedLabel.value}"执行${action === 'ON' ? '开灯' : '关灯'}？`
  pendingAction = { type: 'label', action }
  showConfirm.value = true
}

async function confirmAction() {
  closeConfirm()
  try {
    if (pendingAction === 'toggleAutoOff') {
      await api.post('/api/switch/auto-off-toggle')
      autoOffEnabled.value = !autoOffEnabled.value
      uni.showToast({ title: autoOffEnabled.value ? '已开启' : '已关闭', icon: 'success' })
    } else if (pendingAction === 'toggleAutoOn') {
      await api.post('/api/switch/auto-on-toggle')
      autoOnEnabled.value = !autoOnEnabled.value
      uni.showToast({ title: autoOnEnabled.value ? '已开启' : '已关闭', icon: 'success' })
    } else if (pendingAction.type === 'scene') {
      await api.post(`/api/switch/scene/${pendingAction.scene.id}`)
      uni.showToast({ title: '场景执行成功', icon: 'success' })
    } else if (pendingAction.type === 'label') {
      await api.post('/api/switch/label-control', {
        label: selectedLabel.value,
        action: pendingAction.action
      })
      uni.showToast({ title: '操作成功', icon: 'success' })
    }
  } catch (e) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' })
  }
  pendingAction = null
}

function closeConfirm() {
  showConfirm.value = false
  pendingAction = null
}

function goBack() {
  uni.navigateBack()
}
</script>

<style scoped>
/* 页面基础 */
.page { background: #0a0a0f; min-height: 100vh; color: #fff; }

/* 固定顶部 */
.fixed-header { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(10,10,15,0.95); backdrop-filter: blur(10px); }
.status-bar-bg { background: rgba(10,10,15,0.95); }
.header-content { display: flex; align-items: center; height: 44px; padding: 0 16px; }
.back-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.back-icon { font-size: 24px; color: #d4af37; }
.header-title { flex: 1; text-align: center; font-size: 17px; font-weight: 500; }
.header-placeholder { width: 100%; }

/* 内容区 */
.content { padding: 16px; padding-bottom: 40px; }

/* 卡片通用样式 */
.card {
  background: rgba(20,20,30,0.8);
  border-radius: 16px;
  border: 1px solid rgba(218,165,32,0.15);
  margin-bottom: 16px;
  overflow: hidden;
}
.card-header {
  display: flex; align-items: center; gap: 8px;
  padding: 16px 16px 0;
}
.card-icon { font-size: 20px; }
.card-title { font-size: 16px; font-weight: 500; color: #d4af37; }
.card-body { padding: 12px 16px 16px; }

/* 自动关灯卡片 */
.auto-off-card .toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 0;
}
.toggle-status { font-size: 15px; font-weight: 500; }
.toggle-status.on { color: #22c55e; }
.toggle-status.off { color: #e74c3c; }
.toggle-switch {
  width: 48px; height: 28px; border-radius: 14px;
  background: rgba(255,255,255,0.15);
  position: relative; transition: background 0.3s;
}
.toggle-switch.active { background: rgba(34,197,94,0.5); }
.toggle-thumb {
  width: 24px; height: 24px; border-radius: 12px;
  background: #fff; position: absolute; top: 2px; left: 2px;
  transition: transform 0.3s;
}
.toggle-switch.active .toggle-thumb { transform: translateX(20px); }
.toggle-desc { font-size: 12px; color: rgba(255,255,255,0.4); display: block; margin-top: 8px; }

/* 场景按钮网格 */
.scene-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.scene-btn {
  flex: 1; min-width: calc(50% - 6px);
  padding: 16px 12px; border-radius: 12px;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  transition: all 0.2s;
}
.scene-on {
  background: rgba(218,165,32,0.15);
  border: 1px solid rgba(218,165,32,0.3);
}
.scene-off {
  background: rgba(100,100,150,0.15);
  border: 1px solid rgba(100,100,150,0.3);
}
.scene-btn:active { transform: scale(0.96); }
.scene-btn-icon { font-size: 24px; }
.scene-btn-text { font-size: 14px; }

/* 标签选择器 */
.label-picker {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: rgba(255,255,255,0.05);
  border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
}
.label-picker-text { font-size: 15px; color: #fff; }
.label-picker-arrow { font-size: 12px; color: rgba(255,255,255,0.4); }
.label-actions { display: flex; gap: 12px; margin-top: 12px; }
.action-btn {
  flex: 1; padding: 14px; border-radius: 10px;
  text-align: center; font-size: 15px; font-weight: 500;
}
.btn-on { background: rgba(218,165,32,0.2); color: #d4af37; }
.btn-off { background: rgba(100,100,150,0.2); color: #aaa; }
.action-btn:active { transform: scale(0.96); }

/* 确认弹窗 */
.confirm-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7); z-index: 200;
  display: flex; align-items: center; justify-content: center;
}
.confirm-box {
  background: rgba(20,20,30,0.95); border-radius: 16px;
  padding: 24px; width: 85%; max-width: 340px;
  border: 1px solid rgba(218,165,32,0.2);
}
.confirm-title { font-size: 17px; font-weight: 500; display: block; margin-bottom: 12px; }
.confirm-text { font-size: 14px; color: rgba(255,255,255,0.7); display: block; margin-bottom: 20px; line-height: 1.5; }
.confirm-buttons { display: flex; gap: 12px; }
.confirm-btn {
  flex: 1; padding: 12px; border-radius: 10px; text-align: center; font-size: 15px;
}
.confirm-btn.cancel { background: rgba(255,255,255,0.1); color: #fff; }
.confirm-btn.ok { background: linear-gradient(135deg, #d4af37, #ffd700); color: #000; font-weight: 500; }
</style>
```

### 7.4 权限控制

前端页面在 `onLoad` 时调用 `/api/auth/check-permission` 接口检查用户角色，仅允许以下角色访问：
- `店长`
- `助教管理`
- `管理员`

后端所有 `/api/switch/*` 接口均需加权限中间件：

```javascript
// server.js 中定义专用中间件
const requireSwitchPermission = (req, res, next) => {
  const user = req.user;
  if (!user || !user.role) return res.status(403).json({ error: '未授权' });
  const allowed = ['店长', '助教管理', '管理员'];
  if (!allowed.includes(user.role)) return res.status(403).json({ error: '权限不足' });
  next();
};
```

### 7.5 菜单入口

在内部功能页面的入口列表（如 index.vue 或 admin-login 后的功能列表）中新增：

```vue
<view class="menu-item" @click="navigateTo('/pages/internal/switch-control')">
  <text class="menu-icon">💡</text>
  <text class="menu-text">智能开关</text>
</view>
```

---

## 8. 数据导入方案

### 8.1 导入脚本

新建脚本：`/TG/tgservice/backend/scripts/import-switch-data.js`

### 8.2 设备开关表导入逻辑

读取 Excel 文件的【设备开关表】页面，提取列：
- `开关标签` → `switch_label`
- `开关ID` → `switch_id`
- `开关序号` → `switch_seq`
- `自动关灯时间段` → 解析 `HH:MM-->HH:MM` 格式，拆分为 `auto_off_start` 和 `auto_off_end`

```javascript
const XLSX = require('xlsx');
const TimeUtil = require('../utils/time');
const { enqueueRun } = require('../db');

const workbook = XLSX.readFile('/TG/docs/智能开关改造/SwitchManagement.xlsx');
const sheet = workbook.Sheets['设备开关表'];
const data = XLSX.utils.sheet_to_json(sheet);

for (const row of data) {
  if (!row['开关ID'] || !row['开关序号']) continue;

  // 解析时间段 "4:00-->14:00"
  let autoOffStart = '';
  let autoOffEnd = '';
  if (row['自动关灯时间段'] && typeof row['自动关灯时间段'] === 'string') {
    const parts = row['自动关灯时间段'].split('-->');
    if (parts.length === 2) {
      autoOffStart = parts[0].trim();
      autoOffEnd = parts[1].trim();
      // 统一格式化为 HH:MM（补零）
      autoOffStart = formatTime(autoOffStart);
      autoOffEnd = formatTime(autoOffEnd);
    }
  }

  await enqueueRun(
    `INSERT OR IGNORE INTO switch_device 
     (switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      String(row['开关ID']),
      String(row['开关序号']),
      String(row['开关标签'] || ''),
      autoOffStart,
      autoOffEnd,
      TimeUtil.nowDB(),
      TimeUtil.nowDB()
    ]
  );
}
```

### 8.3 台桌设备表导入逻辑

同样从【设备开关表】页面的 `关联台桌` 列提取数据。该列包含逗号分隔的台桌英文名（如 `putai1,putai2`）。

```javascript
for (const row of data) {
  if (!row['关联台桌'] || !row['开关序号'] || !row['开关标签']) continue;

  const tableNames = String(row['关联台桌']).split(',').map(t => t.trim()).filter(Boolean);

  for (const tableName of tableNames) {
    await enqueueRun(
      `INSERT OR IGNORE INTO table_device 
       (table_name_en, switch_seq, switch_label, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        tableName,
        String(row['开关序号']),
        String(row['开关标签']),
        TimeUtil.nowDB(),
        TimeUtil.nowDB()
      ]
    );
  }
}
```

### 8.4 场景数据导入

从 Excel 其他 Sheet 导入场景数据：

| Sheet 名 | 场景名称 | 动作 |
|----------|----------|------|
| 全部开灯 | 全部开灯 | ON |
| 全部关灯 | 全部关灯 | OFF |
| 手动开灯-9点 | 9点开灯 | ON |
| 手动开灯-14点 | 14点开灯 | ON |
| 手动开灯-17点 | 17点开灯 | ON |

```javascript
const sceneMap = [
  { sheet: '全部开灯', name: '全部开灯', action: 'ON', sort: 1 },
  { sheet: '全部关灯', name: '全部关灯', action: 'OFF', sort: 2 },
  { sheet: '手动开灯-9点', name: '9点开灯', action: 'ON', sort: 3 },
  { sheet: '手动开灯-14点', name: '14点开灯', action: 'ON', sort: 4 },
  { sheet: '手动开灯-17点', name: '17点开灯', action: 'ON', sort: 5 },
];

for (const scene of sceneMap) {
  if (!workbook.Sheets[scene.sheet]) continue;

  const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[scene.sheet]);
  const switches = sheetData
    .filter(r => r['开关ID'] && r['开关序号'])
    .map(r => ({
      switch_id: String(r['开关ID']),
      switch_seq: String(r['开关序号'])
    }));

  await enqueueRun(
    `INSERT OR REPLACE INTO switch_scene 
     (scene_name, action, switches, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      scene.name,
      scene.action,
      JSON.stringify(switches),
      scene.sort,
      TimeUtil.nowDB(),
      TimeUtil.nowDB()
    ]
  );
}
```

### 8.5 时间格式化工具函数

```javascript
function formatTime(timeStr) {
  // "4:00" -> "04:00", "14:00" -> "14:00"
  const parts = timeStr.split(':');
  if (parts.length !== 2) return timeStr;
  return String(parts[0]).padStart(2, '0') + ':' + String(parts[1]).padStart(2, '0');
}
```

---

## 9. 编码注意事项

### 9.1 时间处理

**必须** 使用 `TimeUtil`（`backend/utils/time.js`）：

```javascript
const TimeUtil = require('./utils/time');

// ✅ 正确
const now = TimeUtil.nowDB();       // "2026-04-14 22:30:00"
const ago5 = TimeUtil.offsetDB(-5);  // 5小时前
const today = TimeUtil.todayStr();   // "2026-04-14"

// ❌ 禁止
const now = new Date().toISOString();
const now = datetime('now');
```

### 9.2 数据库连接

**必须** 使用 `db/index.js` 中的唯一连接：

```javascript
const { db, all, get, run, enqueueRun, runInTransaction } = require('./db/index');

// ✅ 正确：使用唯一连接
const rows = await all('SELECT * FROM switch_device');

// ❌ 禁止：新建连接（本地 SQLite 已废弃，数据库在 Turso 云端）
const sqlite3 = require('sqlite3');
const db2 = new sqlite3.Database(path);  // ⚠️ 本地 SQLite 已废弃
```

### 9.3 数据库写入

**必须** 使用 `writequeue` 队列（通过 `enqueueRun`）：

```javascript
// ✅ 正确：通过写队列
await enqueueRun('INSERT INTO switch_device ...', [params]);

// ✅ 正确：事务中批量写入
await runInTransaction(async (tx) => {
  await tx.run('INSERT INTO ...', [params]);
  await tx.run('UPDATE ...', [params]);
});

// ❌ 禁止：直接 db.run
await db.run('INSERT INTO ...', [params]);
```

### 9.4 MQTT 测试环境限制

```javascript
const envName = config.env?.name || 'production';
if (envName === 'test') {
  // 测试环境只写日志
  logger.info(`[MQTT-TEST] 模拟发送: ${JSON.stringify(payload)}`);
  return true;
}
// 生产环境才真实发送
```

### 9.5 台桌同步接口改造注意事项

- 在现有 `POST /api/admin/sync/tables` 接口中添加触发逻辑
- 触发判断放在事务提交之后、返回响应之前
- 自动关灯查询和 MQTT 发送不影响同步接口的正常返回
- 如自动关灯出错，只记录日志，不影响同步接口返回成功

---

## 10. 文件清单

### 10.1 新增文件

| 文件 | 说明 |
|------|------|
| `backend/services/mqtt-switch.js` | MQTT 开关控制服务 |
| `backend/services/auto-on-lighting.js` | 定时自动开灯服务（新增） |
| `backend/scripts/import-switch-data.js` | Excel 数据导入脚本 |
| `backend/migrations/001-switch-tables.js` | 数据库迁移脚本 |
| `admin/switch-devices.html` | 后台-设备开关管理页面 |
| `admin/table-devices.html` | 后台-台桌设备关系页面 |
| `admin/switch-scenes.html` | 后台-开关场景管理页面 |
| `src/pages/internal/switch-control.vue` | 前台H5-智能开关页面 |

### 10.2 修改文件

| 文件 | 修改内容 |
|------|----------|
| `backend/server.js` | 1. 新增所有 /api/admin/switch* 和 /api/switch/* 路由<br>2. 改造台桌同步接口增加自动关灯触发<br>3. 新增 cron 定时任务注册（定时自动开灯） |
| `admin/index.html` | 侧边栏新增"设备管理"菜单组 |
| `.config` | 新增 mqtt 配置节 |
| `backend/middleware/permission.js` | 新增 switchManagement 权限项（可选，如需要细粒度控制） |
| 内部功能入口页面 | 新增"智能开关"菜单入口 |

### 10.3 新增 npm 依赖

| 依赖 | 用途 |
|------|------|
| `mqtt` | MQTT 客户端，用于连接 MQTT broker 发送开关指令 |
| `xlsx` | Excel 文件读取，用于数据导入（如尚未安装） |

---

## 附录 A：MQTT 消息格式

### 关灯指令 (OFF)
```json
{
  "id": "0xa4c1380bbd942cbe",
  "state_l1": "OFF"
}
```

### 开灯指令 (ON)
```json
{
  "id": "0xa4c1380bbd942cbe",
  "state_l1": "ON"
}
```

**Topic**: `tiangongguoji`

---

## 附录 B：自动关灯完整流程图

```
台桌状态同步接口被调用
  │
  ├─ 更新 tables 表状态
  ├─ 更新 vip_rooms 表状态
  │
  ├─ 检查：更新条数 >= 40？ ──否──→ 返回成功
  │
  是
  │
  ├─ 检查：自动关灯功能已开启？ ──否──→ 返回成功
  │
  是
  │
  ├─ 查询：可能要关的灯（空闲台桌 + 在自动关灯时段内）
  │     ⚠️ 跨午夜判断：start > end 时用 OR，否则用 AND
  ├─ 查询：不能关的灯（非空闲台桌 + 在自动关灯时段内）
  │     ⚠️ 跨午夜判断：start > end 时用 OR，否则用 AND
  ├─ 差集：可能要关的灯 - 不能关的灯 = 要关的灯
  │
  ├─ 遍历要关的灯，发送 MQTT OFF 指令（测试环境只写日志）
  │
  └─ 记录日志，返回成功
```

## 附录 C：权限矩阵（新增）

| 角色 | 后台设备管理 | 前台智能开关 |
|------|-------------|-------------|
| 管理员 | ✅ | ✅ |
| 店长 | ✅ | ✅ |
| 助教管理 | ✅ | ✅ |
| 教练 | ❌ | ❌ |
| 前厅管理 | ❌ | ❌ |
| 收银 | ❌ | ❌ |
| 服务员 | ❌ | ❌ |

后台设备管理复用 `vipRoomManagement` 权限（已有权限矩阵中管理员/店长/助教管理均有此权限）。
前台智能开关使用专用的 `requireSwitchPermission` 中间件。

---

## 附录 D：定时自动开灯完整流程图

```
Cron 定时任务触发（每5分钟）
  │
  ├─ 检查：定时自动开灯功能已开启？ ──否──→ 结束
  │
  是
  │
  ├─ 查询：可能要开的灯（空闲台桌 + 在自动开灯时段内）
  │     ⚠️ 跨午夜判断：start > end 时用 OR，否则用 AND
  │
  ├─ 判断：可能要开的灯数量 = 0？ ──是──→ 记录日志，结束
  │
  否
  │
  ├─ 注：暂不判断"已经在亮的灯"（无实时状态反馈）
  ├─ 可能要开的灯 = 要开的灯
  │
  ├─ 遍历要开的灯，发送 MQTT ON 指令（测试环境只写日志）
  │
  └─ 记录日志，结束
```
