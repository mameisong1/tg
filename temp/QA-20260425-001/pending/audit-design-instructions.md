你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
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
  "success": true,
  "count": 17
}
```

#### 3.2.3 空调全部开/关

```http
POST /api/ac/all-control
```

**参数**：
```json
{
  "action": "ON"  // ON=全部开空调, OFF=全部关空调
}
```

#### 3.2.4 空调自动关（手动触发）

```http
POST /api/ac/auto-off-manual
```

**功能**：手动触发一次空调自动关（类似灯的智能省电-手动）

**响应**：
```json
{
  "success": true,
  "turnedOffCount": 15,
  "maybeOffCount": 20,
  "cannotOffCount": 5
}
```

#### 3.2.5 空调配置读取（已存在）

```http
GET /api/admin/ac-control
PUT /api/admin/ac-control
```

**说明**：`switch-routes.js` 第 502-562 行已实现。

---

## 四、MQTT指令差异

### 4.1 灯控制（现有）

**Topic**：配置文件 `config.mqtt.topic`

**Payload（开）**：
```json
{"id":"6ceaf318ebda5c1211piog","1":"ON"}
```

**Payload（关）**：
```json
{"id":"6ceaf318ebda5c1211piog","1":"OFF"}
```

**格式**：`{ "id": switch_id, [switch_seq]: "ON/OFF" }`

### 4.2 空调控制（新）

**Topic**：`tiangongguojikongtiao`（固定，不从配置读取）

**Payload（关）**：
```json
{
  "dev_id": "6cedfa65e9e0d2f95bv8dw",
  "node_id": "3",
  "switch": false
}
```

**Payload（开）**：
```json
{
  "dev_id": "6cedfa65e9e0d2f95bv8dw",
  "node_id": "3",
  "switch": true,
  "temp_set": 23,
  "mode": "cold",
  "fan_speed_enum": "auto"
}
```

**格式差异**：
| 项目 | 灯 | 空调 |
|------|-----|------|
| Topic | config.mqtt.topic | tiangongguojikongtiao |
| ID字段 | id | dev_id |
| 序号字段 | 直接作为key | node_id |
| 动作字段 | ON/OFF | switch: true/false |
| 开启参数 | 无 | temp_set, mode, fan_speed_enum |

**参数来源**：
- `temp_set`, `fan_speed_enum`：从 `system_config.ac_control` 读取
- `mode`：固定 `"cold"`（制冷模式）

---

## 五、前端页面结构

### 5.1 方案A：集成到现有页面（推荐）

在 `switch-control.vue` 新增空调控制模块：

```vue
<template>
  <!-- 现有灯控制模块 -->
  
  <!-- 新增：空调控制卡片 -->
  <view class="card ac-card">
    <view class="card-header">
      <text class="card-icon">❄️</text>
      <text class="card-title">空调控制</text>
    </view>
    <view class="card-body">
      <!-- 空调场景 -->
      <view class="ac-scene-grid">
        <view class="ac-btn ac-on" @click="acControl('all', 'ON')">
          <text>全部开空调</text>
        </view>
        <view class="ac-btn ac-off" @click="acControl('all', 'OFF')">
          <text>全部关空调</text>
        </view>
      </view>
      
      <!-- 空调标签选择 -->
      <picker mode="selector" :range="acLabels" @change="onAcLabelChange">
        <view class="ac-picker">
          <text>{{ selectedAcLabel || '选择空调组' }}</text>
        </view>
      </picker>
      
      <!-- 标签控制 -->
      <view class="ac-actions" v-if="selectedAcLabel">
        <view class="ac-btn ac-on" @click="acControl('label', 'ON')">开空调</view>
        <view class="ac-btn ac-off" @click="acControl('label', 'OFF')">关空调</view>
      </view>
    </view>
  </view>
</template>
```

### 5.2 方案B：独立页面（可选）

新建 `/TG/tgservice-uniapp/src/pages/internal/ac-control.vue`，结构类似 `switch-control.vue`。

---

## 六、后端服务设计

### 6.1 ac-switch.js（空调MQTT控制）

```javascript
/**
 * 空调MQTT控制服务
 * 
 * Topic: tiangongguojikongtiao
 * Payload格式不同于灯控制
 */

const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
const { get } = require('../db/index');

const AC_TOPIC = 'tiangongguojikongtiao';

// 加载配置（判断是否测试环境）
const env = process.env.TGSERVICE_ENV || 'production';
const configFileName = env === 'test' ? '.config.env' : '.config';
const configPath = path.join(__dirname, '../../' + configFileName);
let config = {};
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (err) {
  console.error('[AC-MQTT] 加载配置文件失败:', err.message);
}

const isTestEnv = (config.env?.name === 'test') || (env === 'test');

/**
 * 发送单个空调指令
 * @param {string} switchId - 空调设备ID（dev_id）
 * @param {string} switchSeq - 空调序号（node_id）
 * @param {string} action - 'ON' 或 'OFF'
 * @returns {Object} { ok: boolean, error?: string }
 */
async function sendAcCommand(switchId, switchSeq, action) {
  // 开发约束：测试环境只写日志，不执行真实指令
  if (isTestEnv) {
    console.log(`[AC-MQTT][测试环境] 跳过真实发送: ${switchId} ${switchSeq} ${action}`);
    return { ok: true, error: null };
  }

  // 从 system_config 加载空调配置
  const acConfig = await get('SELECT value FROM system_config WHERE key = "ac_control"');
  let temp_set = 23;
  let fan_speed_enum = 'middle';
  if (acConfig) {
    try {
      const parsed = JSON.parse(acConfig.value);
      temp_set = parsed.temp_set || 23;
      fan_speed_enum = parsed.fan_speed_enum || 'middle';
    } catch (e) {
      console.warn('[AC-MQTT] 解析空调配置失败，使用默认值');
    }
  }

  // 构建Payload
  const payload = {
    dev_id: switchId,
    node_id: switchSeq,
    switch: action === 'ON'
  };

  // 开空调时添加额外参数
  if (action === 'ON') {
    payload.temp_set = temp_set;
    payload.mode = 'cold';
    payload.fan_speed_enum = fan_speed_enum;
  }

  // 发送MQTT指令（复用 mqtt-switch.js 的 getClient）
  try {
    const mqttClient = await getClient(); // 从 mqtt-switch.js 导入
    if (!mqttClient) {
      return { ok: false, error: 'MQTT客户端不可用' };
    }
    mqttClient.publish(AC_TOPIC, JSON.stringify(payload), { qos: 1 });
    console.log(`[AC-MQTT] 指令已发送: ${switchId} ${switchSeq} ${action}`);
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * 批量发送空调指令
 * @param {Array} devices - [{switch_id, switch_seq}]
 * @param {string} action - 'ON' 或 'OFF'
 */
async function sendAcBatchCommand(devices, action) {
  const failures = [];
  let successCount = 0;
  for (const d of devices) {
    const result = await sendAcCommand(d.switch_id, d.switch_seq, action);
    if (result.ok) successCount++;
    else failures.push({ ...d, error: result.error });
    await new Promise(r => setTimeout(r, 100)); // 100ms间隔
  }
  console.log(`[AC-MQTT] 批量发送完成: ${successCount}/${devices.length}`);
  return { successCount, totalCount: devices.length, failures };
}

module.exports = {
  sendAcCommand,
  sendAcBatchCommand,
  AC_TOPIC
};
```

### 6.2 auto-off-ac.js（空调自动关服务）

```javascript
/**
 * 空调自动关服务
 * 
 * 由台桌状态同步接口触发
 * 逻辑：空闲台桌关联的空调 -> 检查自动关时段 -> 关空调
 */

const TimeUtil = require('../utils/time');
const { all, get } = require('../db/index');
const { sendAcBatchCommand } = require('./ac-switch');

/**
 * 执行空调自动关
 * @returns {Object} { status, maybeOffCount, turnedOffCount }
 */
async function executeAutoOffAc() {
  // 1. 检查空调自动关功能是否开启
  const setting = await get("SELECT value FROM system_settings WHERE key = 'ac_auto_off_enabled'");
  if (!setting || setting.value !== '1') {
    console.log('[空调自动关] 功能未开启，跳过');
    return { status: 'disabled' };
  }

  const now = TimeUtil.nowDB();

  // 2. 查询空闲台桌关联的空调设备
  const acDevices = await all(`
    SELECT DISTINCT sd.switch_id, sd.switch_seq
    FROM tables t
    JOIN table_device td ON LOWER(td.table_name_en) = LOWER(t.name_pinyin)
    JOIN switch_device sd ON sd.switch_seq = td.switch_seq AND sd.switch_label = td.switch_label
    WHERE t.status = '空闲'
      AND sd.device_type = '空调'
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
  `, [now, now, now, now]);

  if (acDevices.length === 0) {
    console.log('[空调自动关] 无需要关的空调');
    return { status: 'ok', maybeOffCount: 0, turnedOffCount: 0 };
  }

  console.log(`[空调自动关] 查询到 ${acDevices.length} 个空闲台桌关联空调`);

  // 3. 发送MQTT关空调指令
  const result = await sendAcBatchCommand(acDevices, 'OFF');
  
  return {
    status: 'ok',
    maybeOffCount: acDevices.length,
    turnedOffCount: result.successCount
  };
}

/**
 * 执行台桌无关空调自动关
 */
async function executeAutoOffAcIndependent() {
  // 类似 auto-off-lighting.js 的台桌无关逻辑
  // ...
}

module.exports = { executeAutoOffAc, executeAutoOffAcIndependent };
```

---

## 七、台桌状态同步接口触发空调自动关

### 7.1 修改 switch-routes.js

在 `triggerAutoOffIfEligible` 函数中增加空调自动关：

```javascript
async function triggerAutoOffIfEligible(tablesUpdated, vipRoomsUpdated) {
  const totalUpdated = tablesUpdated + vipRoomsUpdated;
  if (totalUpdated < 40) {
    return { triggered: false, reason: `更新条数 ${totalUpdated} < 40` };
  }

  try {
    // 灯自动关（现有）
    const lightResult = await executeAutoOffLighting();
    const independentResult = await executeAutoOffTableIndependent();
    
    // 新增：空调自动关
    const acResult = await executeAutoOffAc();
    
    return {
      triggered: true,
      lightTurnedOff: lightResult.turnedOffCount || 0,
      independentTurnedOff: independentResult?.turnedOffCount || 0,
      acTurnedOff: acResult.turnedOffCount || 0  // 新增
    };
  } catch (err) {
    console.error(`[自动关触发] 执行失败: ${err.message}`);
    return { triggered: true, status: 'error', error: err.message };
  }
}
```

### 7.2 触发条件

- 台桌状态同步接口更新 >= 40 条台桌数据
- 空调自动关功能开关已开启（system_settings.ac_auto_off_enabled = '1'）
- 当前时间在空调自动关时段内

---

## 八、前端H5逻辑

### 8.1 新增API请求函数

```javascript
// 空调控制
async function acControl(type, action) {
  if (type === 'all') {
    await apiRequest('/ac/all-control', 'POST', { action });
    uni.showToast({ title: action === 'ON' ? '已开启全部空调' : '已关闭全部空调', icon: 'success' });
  } else if (type === 'label') {
    await apiRequest('/ac/label-control', 'POST', {
      label: selectedAcLabel.value,
      action
    });
    uni.showToast({ title: '操作成功', icon: 'success' });
  }
}

// 加载空调标签
async function loadAcLabels() {
  const res = await apiRequest('/ac/labels');
  acLabels.value = res?.map(l => l.switch_label) || [];
}
```

---

## 九、开发约束

### 9.1 禁止执行真实MQTT指令

**约束**：开发测试时，只能把开关指令写日志，不发送真实MQTT指令。

**实现**：在 `ac-switch.js` 中判断测试环境：

```javascript
const isTestEnv = (config.env?.name === 'test') || (env === 'test');

if (isTestEnv) {
  console.log(`[AC-MQTT][测试环境] 跳过真实发送: ${switchId} ${switchSeq} ${action}`);
  return { ok: true, error: null };
}
```

**验收方法**：
- 测试环境日志显示 `[AC-MQTT][测试环境] 跳过真实发送`
- 不连接真实MQTT broker
- 不发送任何真实指令

### 9.2 日志格式

```log
[AC-MQTT][测试环境] 跳过真实发送: 6cedfa65e9e0d2f95bv8dw 1 ON
[AC-MQTT][测试环境] Payload: {"dev_id":"6cedfa65e9e0d2f95bv8dw","node_id":"1","switch":true,"temp_set":23,"mode":"cold","fan_speed_enum":"middle"}
```

---

## 十、空调数据预置

### 10.1 第一组（17台）

```sql
INSERT INTO switch_device (switch_id, switch_seq, switch_label, device_type, auto_off_start, auto_off_end)
VALUES 
('6ceaf318ebda5c1211piog', '1', '空调一组', '空调', '22:00', '06:00'),
('6ceaf318ebda5c1211piog', '2', '空调一组', '空调', '22:00', '06:00'),
...
('6ceaf318ebda5c1211piog', '17', '空调一组', '空调', '22:00', '06:00');
```

### 10.2 第二组（18台）

```sql
INSERT INTO switch_device (switch_id, switch_seq, switch_label, device_type, auto_off_start, auto_off_end)
VALUES 
('6cedfa65e9e0d2f95bv8dw', '1', '空调二组', '空调', '22:00', '06:00'),
('6cedfa65e9e0d2f95bv8dw', '2', '空调二组', '空调', '22:00', '06:00'),
...
('6cedfa65e9e0d2f95bv8dw', '18', '空调二组', '空调', '22:00', '06:00');
```

---

## 十一、验收测试清单

### 11.1 设备类型筛选

- [ ] `GET /api/admin/switches?device_type=灯` 只返回灯设备
- [ ] `GET /api/admin/switches?device_type=空调` 只返回空调设备
- [ ] 前端页面能切换设备类型筛选

### 11.2 空调MQTT指令

- [ ] 关空调Payload格式正确：`{"dev_id":"xxx","node_id":"3","switch":false}`
- [ ] 开空调Payload包含额外参数：temp_set, mode, fan_speed_enum
- [ ] Topic固定为 `tiangongguojikongtiao`

### 11.3 系统配置加载

- [ ] 从 `system_config.ac_control` 正确读取 temp_set
- [ ] 从 `system_config.ac_control` 正确读取 fan_speed_enum
- [ ] 配置不存在时使用默认值（23℃, middle）

### 11.4 测试环境日志

- [ ] 测试环境显示 `[AC-MQTT][测试环境] 跳过真实发送`
- [ ] 不发送真实MQTT指令

---

## 十二、编码规范遵守

### 12.1 时间处理

```javascript
// ✅ 正确
const TimeUtil = require('./utils/time');
const now = TimeUtil.nowDB();

// ❌ 禁止
const now = new Date().toISOString();
```

### 12.2 数据库连接

```javascript
// ✅ 正确
const { db, dbRun, dbAll, get, all, run } = require('./db/index');

// ❌ 禁止
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database(path);
```

### 12.3 数据库写入

```javascript
// ✅ 正确
await runInTransaction(async (tx) => {
  await tx.run('INSERT INTO ...', params);
});

// 或
await enqueueRun('INSERT INTO ...', params);
```

---

## 十三、风险与注意事项

### 13.1 MQTT Topic差异

空调和灯使用不同的MQTT Topic：
- 灯：`config.mqtt.topic`
- 空调：`tiangongguojikongtiao`（固定）

**风险**：误用Topic会导致指令发送失败。

### 13.2 Payload字段命名

空调Payload使用 `dev_id` 和 `node_id`，而非 `id` 和直接key。

**风险**：字段命名错误会导致空调不响应。

### 13.3 空调配置缺失

`system_config.ac_control` 可能不存在。

**应对**：使用默认值 `{"temp_set":23,"fan_speed_enum":"middle"}`。

---

## 十四、实施步骤

1. **新增 ac-switch.js**：空调MQTT控制服务
2. **新增 auto-off-ac.js**：空调自动关服务
3. **修改 switch-routes.js**：新增空调控制API
4. **修改 mqtt-switch.js**：导出 getClient 函数供空调服务复用
5. **修改 switch-control.vue**：新增空调控制UI
6. **预置空调设备数据**：35条设备记录
7. **测试环境验证**：日志确认不发送真实指令

---

## 设计完成时间

2026-04-25 22:10

---

**程序员A 签名**
```

## 审计检查清单
# 代码审计检查清单

## 编码规范检查（自动化）

运行 `check-style.js` 脚本，检查：

| 规则ID | 检查项 | 禁止 | 必须 |
|--------|--------|------|------|
| TIME | 时间处理 | `datetime('now')`、手动时区偏移 | `TimeUtil` |
| DB_CONN | 数据库连接 | `new sqlite3.Database()` | `db/index.js` |
| DB_WRITE | 数据库写入 | 裸开事务 | `writeQueue` |

## 人工审计检查项

### 逻辑正确性

- [ ] API路径、方法、参数与设计方案一致
- [ ] 数据库字段名、类型与设计一致
- [ ] 业务逻辑分支完整（if/else覆盖所有情况）
- [ ] 边界值处理（空值、最大值、最小值）

### 安全性

- [ ] 输入验证（参数类型、长度、范围）
- [ ] SQL注入防护（参数化查询）
- [ ] 权限校验（用户身份验证）

### 错误处理

- [ ] API错误有明确的错误码和消息
- [ ] 数据库操作有try/catch
- [ ] 异常情况有fallback处理

### 代码质量

- [ ] 变量命名清晰
- [ ] 函数单一职责
- [ ] 无死代码（未使用的变量/函数）
- [ ] Git提交信息描述清晰

### 前后端一致性

- [ ] API请求/响应格式前后端匹配
- [ ] 前端字段名与后端返回一致
- [ ] 错误处理前后端对齐


## 输出要求
1. 审计结果：通过/不通过
2. 如不通过，列出具体问题（对应检查清单的哪些项）
3. 如果通过，提取设计摘要（改了什么文件、新增什么API、数据表变更等）

这是第 1/3 次审计。