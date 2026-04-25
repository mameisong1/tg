# 天宫QA - 空调控制功能API测试用例 V2

**测试环境**: http://127.0.0.1:8088  
**测试日期**: 2026-04-25  
**测试员**: B  
**严禁使用端口**: 8081、8083  
**测试用例总数**: 32个

---

## 测试环境准备

### 1. 认证Token获取

```bash
# 登录获取Token
curl -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}'
```

**预期结果**: 返回包含 `token` 字段的JSON，保存为环境变量 `TOKEN`

### 2. 测试数据准备

```bash
# 检查设备数据
sqlite3 /TG/tgservice/db/tgservice.db "SELECT device_type, COUNT(*) FROM switch_device GROUP BY device_type;"

# 检查空调配置
sqlite3 /TG/tgservice/db/tgservice.db "SELECT key, value FROM system_config WHERE key='ac_control';"

# 检查台桌设备关系
sqlite3 /TG/tgservice/db/tgservice.db "SELECT COUNT(*) FROM table_device;"
```

---

## 模块1: 灯控制API加device_type筛选（5个用例）

### TC-01-01: 获取灯设备列表 - device_type=灯筛选

**优先级**: P0  
**测试目标**: 验证灯控制API正确筛选灯设备  
**API**: `GET /api/admin/switches?device_type=灯`

#### 测试步骤

```bash
# 步骤1: 获取灯设备列表
curl -X GET "http://127.0.0.1:8088/api/admin/switches?device_type=灯" \
  -H "Authorization: Bearer $TOKEN"

# 步骤2: 验证数据库灯设备数量
sqlite3 /TG/tgservice/db/tgservice.db "SELECT COUNT(*) FROM switch_device WHERE device_type='灯';"
```

#### 预期结果
1. API返回200，JSON数组中所有设备的 `device_type` 字段等于 `"灯"`
2. 返回数量与数据库查询结果一致
3. 不包含任何空调设备

---

### TC-01-02: 获取空调设备列表 - device_type=空调筛选

**优先级**: P0  
**测试目标**: 验证灯控制API能筛选空调设备  
**API**: `GET /api/admin/switches?device_type=空调`

#### 测试步骤

```bash
# 步骤1: 获取空调设备列表
curl -X GET "http://127.0.0.1:8088/api/admin/switches?device_type=空调" \
  -H "Authorization: Bearer $TOKEN"

# 步骤2: 验证数据库空调设备数量
sqlite3 /TG/tgservice/db/tgservice.db "SELECT COUNT(*) FROM switch_device WHERE device_type='空调';"
```

#### 预期结果
1. API返回200，JSON数组中所有设备的 `device_type` 字段等于 `"空调"`
2. 返回数量与数据库查询结果一致（如有空调设备）
3. 如无空调设备，返回空数组 `[]`

---

### TC-01-03: 灯控制API无筛选参数 - 返回所有设备

**优先级**: P1  
**测试目标**: 验证无device_type参数时返回所有设备  
**API**: `GET /api/admin/switches`

#### 测试步骤

```bash
# 步骤1: 获取所有设备列表（无筛选）
curl -X GET "http://127.0.0.1:8088/api/admin/switches" \
  -H "Authorization: Bearer $TOKEN"

# 步骤2: 验证数据库设备总数
sqlite3 /TG/tgservice/db/tgservice.db "SELECT COUNT(*) FROM switch_device;"
```

#### 预期结果
1. API返回200，包含所有设备（灯+空调）
2. 返回数量与数据库总数一致
3. 包含灯设备和空调设备（如果有）

---

### TC-01-04: 标签控制API - 只返回灯设备标签

**优先级**: P0  
**测试目标**: 验证灯标签控制API只返回灯设备，不含空调  
**API**: `GET /api/switch/labels`

#### 测试步骤

```bash
# 步骤1: 获取标签列表（需要店长/助教管理/管理员权限）
curl -X GET "http://127.0.0.1:8088/api/switch/labels" \
  -H "Authorization: Bearer $TOKEN"

# 步骤2: 验证数据库灯设备标签
sqlite3 /TG/tgservice/db/tgservice.db "SELECT DISTINCT switch_label FROM switch_device WHERE device_type='灯';"
```

#### 预期结果
1. API返回200，标签列表中只包含灯设备的标签
2. 不包含空调设备的标签（如果空调和灯标签不同）
3. 返回格式：`[{"switch_label":"普台区"}, {"switch_label":"VIP区"}]`

---

### TC-01-05: 台桌控制API - 只返回灯设备关联

**优先级**: P0  
**测试目标**: 验证台桌控制API只返回灯设备关联，不含空调  
**API**: `GET /api/switch/tables`

#### 测试步骤

```bash
# 步骤1: 获取台桌列表及其关联开关
curl -X GET "http://127.0.0.1:8088/api/switch/tables" \
  -H "Authorization: Bearer $TOKEN"

# 步骤2: 验证数据库台桌设备关系（灯设备）
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT td.table_name_en, sd.device_type FROM table_device td 
   JOIN switch_device sd ON sd.switch_seq=td.switch_seq AND sd.switch_label=td.switch_label 
   WHERE sd.device_type='灯' LIMIT 5;"
```

#### 预期结果
1. API返回200，台桌关联的开关都是灯设备
2. 每个台桌的 `switches` 数组包含灯设备的 `switch_id` 和 `switch_seq`
3. 不包含空调设备关联（如果空调台桌关系单独管理）

---

## 模块2: 空调设备管理（4个用例）

### TC-02-01: 查询空调设备列表

**优先级**: P0  
**测试目标**: 验证查询空调设备API  
**API**: `GET /api/admin/switches?device_type=空调`

#### 测试步骤

```bash
# 步骤1: 查询空调设备列表
curl -X GET "http://127.0.0.1:8088/api/admin/switches?device_type=空调" \
  -H "Authorization: Bearer $TOKEN"

# 步骤2: 验证数据库空调设备
sqlite3 /TG/tgservice/db/tgservice.db "SELECT id, switch_id, switch_seq, switch_label FROM switch_device WHERE device_type='空调' LIMIT 5;"
```

#### 预期结果
1. API返回200，包含空调设备列表
2. 每个设备的 `device_type` 字段为 `"空调"`
3. 返回字段包含：`id`, `switch_id`, `switch_seq`, `switch_label`, `auto_off_start`, `auto_off_end`, `remark`

---

### TC-02-02: 新增空调设备

**优先级**: P0  
**测试目标**: 验证新增空调设备API  
**API**: `POST /api/admin/switches`

#### 测试步骤

```bash
# 步骤1: 新增空调设备（测试用）
curl -X POST "http://127.0.0.1:8088/api/admin/switches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"switch_id":"test_ac_switch_001","switch_seq":"state_ac1","switch_label":"TEST_AC_01","device_type":"空调","auto_off_start":"02:00","auto_off_end":"14:00","remark":"测试空调设备01"}'

# 步骤2: 验证数据库新增
sqlite3 /TG/tgservice/db/tgservice.db "SELECT id, switch_id, device_type FROM switch_device WHERE switch_id='test_ac_switch_001';"
```

#### 预期结果
1. API返回200，`{"success": true}`
2. 数据库新增一条空调设备记录
3. `device_type` 字段为 `"空调"`

#### 异常流程

```bash
# 测试重复新增（UNIQUE约束）
curl -X POST "http://127.0.0.1:8088/api/admin/switches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"switch_id":"test_ac_switch_001","switch_seq":"state_ac1","switch_label":"TEST_AC_01","device_type":"空调"}'
```

**预期**: 状态码 400，返回 `"该开关ID+开关序号已存在"`

---

### TC-02-03: 修改空调设备

**优先级**: P1  
**测试目标**: 验证修改空调设备API  
**API**: `PUT /api/admin/switches/:id`

#### 测试步骤

```bash
# 步骤1: 获取新增空调设备的ID
AC_ID=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT id FROM switch_device WHERE switch_id='test_ac_switch_001';")

# 步骤2: 修改空调设备信息
curl -X PUT "http://127.0.0.1:8088/api/admin/switches/$AC_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"auto_off_start":"03:00","auto_off_end":"15:00","remark":"修改后的备注"}'

# 步骤3: 验证数据库更新
sqlite3 /TG/tgservice/db/tgservice.db "SELECT auto_off_start, auto_off_end, remark FROM switch_device WHERE id=$AC_ID;"
```

#### 预期结果
1. API返回200，`{"success": true}`
2. 数据库记录已更新
3. `auto_off_start` 改为 `"03:00"`, `auto_off_end` 改为 `"15:00"`, `remark` 改为 `"修改后的备注"`

---

### TC-02-04: 删除空调设备

**优先级**: P1  
**测试目标**: 验证删除空调设备API  
**API**: `DELETE /api/admin/switches/:id`

#### 测试步骤

```bash
# 步骤1: 获取空调设备ID
AC_ID=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT id FROM switch_device WHERE switch_id='test_ac_switch_001';")

# 步骤2: 删除空调设备
curl -X DELETE "http://127.0.0.1:8088/api/admin/switches/$AC_ID" \
  -H "Authorization: Bearer $TOKEN"

# 步骤3: 验证数据库删除
sqlite3 /TG/tgservice/db/tgservice.db "SELECT COUNT(*) FROM switch_device WHERE switch_id='test_ac_switch_001';"
```

#### 预期结果
1. API返回200，`{"success": true}`
2. 数据库记录已删除，COUNT返回0
3. 操作日志记录删除操作

---

## 模块3: 空调控制 - 场景（3个用例）

### TC-03-01: 获取空调场景列表

**优先级**: P0  
**测试目标**: 验证空调场景列表API（前台）  
**API**: `GET /api/switch/scenes`

#### 测试步骤

```bash
# 步骤1: 获取场景列表
curl -X GET "http://127.0.0.1:8088/api/switch/scenes" \
  -H "Authorization: Bearer $TOKEN"

# 步骤2: 验证数据库场景数据
sqlite3 /TG/tgservice/db/tgservice.db "SELECT id, scene_name, action, switches FROM switch_scene ORDER BY sort_order;"
```

#### 预期结果
1. API返回200，包含场景列表
2. 返回字段：`id`, `scene_name`, `action`, `switches`, `sort_order`
3. 场景包含"全部开灯"、"全部关灯"等（空调场景如有）

---

### TC-03-02: 执行全部开空调场景

**优先级**: P0  
**测试目标**: 验证空调场景执行API  
**API**: `POST /api/switch/scene/:id`  
**前置条件**: switch_scene表中有开空调场景（如无则测试开灯场景）

#### 测试步骤

```bash
# 步骤1: 查找ON动作场景
SCENE_ID=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT id FROM switch_scene WHERE action='ON' LIMIT 1;")

# 步骤2: 执行场景
curl -X POST "http://127.0.0.1:8088/api/switch/scene/$SCENE_ID" \
  -H "Authorization: Bearer $TOKEN"

# 步骤3: 查看测试环境日志（只写日志不发送MQTT）
pm2 logs tgservice-dev --lines 30 | grep -E "MQTT|测试环境"
```

#### 预期结果
1. API返回200，`{"success": true, "count": X}`
2. 测试环境日志显示 `[MQTT][测试环境] 跳过真实发送`
3. 不真实发送MQTT指令

---

### TC-03-03: 执行全部关空调场景

**优先级**: P0  
**测试目标**: 验证空调场景关闭API  
**API**: `POST /api/switch/scene/:id`  
**前置条件**: switch_scene表中有OFF动作场景

#### 测试步骤

```bash
# 步骤1: 查找OFF动作场景
SCENE_ID=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT id FROM switch_scene WHERE action='OFF' LIMIT 1;")

# 步骤2: 执行场景
curl -X POST "http://127.0.0.1:8088/api/switch/scene/$SCENE_ID" \
  -H "Authorization: Bearer $TOKEN"

# 步骤3: 查看日志
pm2 logs tgservice-dev --lines 30 | grep -E "MQTT|测试环境"
```

#### 预期结果
1. API返回200，`{"success": true, "count": X}`
2. 测试环境日志显示跳过真实发送
3. 操作日志记录场景执行

---

## 模块4: 空调控制 - 标签（3个用例）

### TC-04-01: 获取空调标签列表

**优先级**: P0  
**测试目标**: 验证空调标签列表API（前台）  
**API**: `GET /api/switch/labels`

#### 测试步骤

```bash
# 步骤1: 获取标签列表
curl -X GET "http://127.0.0.1:8088/api/switch/labels" \
  -H "Authorization: Bearer $TOKEN"

# 步骤2: 验证数据库标签
sqlite3 /TG/tgservice/db/tgservice.db "SELECT DISTINCT switch_label FROM switch_device WHERE device_type='空调';"
```

#### 预期结果
1. API返回200，包含标签列表
2. 返回格式：`[{"switch_label":"VIP区"}, {"switch_label":"大厅"}]`
3. 包含空调设备标签（如有空调设备）

---

### TC-04-02: 按标签开空调

**优先级**: P0  
**测试目标**: 验证空调标签批量控制API  
**API**: `POST /api/switch/label-control`

#### 测试步骤

```bash
# 步骤1: 获取空调标签
AC_LABEL=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT switch_label FROM switch_device WHERE device_type='空调' LIMIT 1;")

# 步骤2: 按标签开空调
curl -X POST "http://127.0.0.1:8088/api/switch/label-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"label\":\"$AC_LABEL\",\"action\":\"ON\"}"

# 步骤3: 查看日志
pm2 logs tgservice-dev --lines 30 | grep -E "MQTT|标签控制"
```

#### 预期结果
1. API返回200，`{"success": true, "count": X}`
2. 测试环境日志显示跳过真实发送
3. 操作日志记录标签控制

---

### TC-04-03: 按标签关空调

**优先级**: P0  
**测试目标**: 验证空调标签批量关闭API  
**API**: `POST /api/switch/label-control`

#### 测试步骤

```bash
# 步骤1: 获取空调标签
AC_LABEL=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT switch_label FROM switch_device WHERE device_type='空调' LIMIT 1;")

# 步骤2: 按标签关空调
curl -X POST "http://127.0.0.1:8088/api/switch/label-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"label\":\"$AC_LABEL\",\"action\":\"OFF\"}"

# 步骤3: 查看日志
pm2 logs tgservice-dev --lines 30 | grep -E "MQTT|标签控制"
```

#### 预期结果
1. API返回200，`{"success": true, "count": X}`
2. 测试环境日志显示跳过真实发送

#### 异常流程

```bash
# 测试无效动作
curl -X POST "http://127.0.0.1:8088/api/switch/label-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"VIP区","action":"INVALID"}'
```

**预期**: 状态码 400，返回 `"动作只能是 ON 或 OFF"`

---

## 模块5: 空调控制 - 台桌（3个用例）

### TC-05-01: 获取台桌空调关联列表

**优先级**: P0  
**测试目标**: 验证台桌空调关联列表API  
**API**: `GET /api/switch/tables`

#### 测试步骤

```bash
# 步骤1: 获取台桌列表及其关联开关
curl -X GET "http://127.0.0.1:8088/api/switch/tables" \
  -H "Authorization: Bearer $TOKEN"

# 步骤2: 验证数据库台桌空调关系
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT td.table_name_en, sd.switch_id, sd.device_type FROM table_device td 
   JOIN switch_device sd ON sd.switch_seq=td.switch_seq AND sd.switch_label=td.switch_label 
   WHERE sd.device_type='空调' LIMIT 5;"
```

#### 预期结果
1. API返回200，包含台桌列表
2. 每个台桌包含 `switches` 数组（空调设备的switch_id和switch_seq）
3. 台桌包含中英文名：`table_name_en`, `table_name_cn`, `area`

---

### TC-05-02: 按台桌开空调

**优先级**: P0  
**测试目标**: 验证台桌空调控制API  
**API**: `POST /api/switch/table-control`

#### 测试步骤

```bash
# 步骤1: 获取有空调关联的台桌
TABLE_NAME=$(sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT td.table_name_en FROM table_device td 
   JOIN switch_device sd ON sd.switch_seq=td.switch_seq AND sd.switch_label=td.switch_label 
   WHERE sd.device_type='空调' LIMIT 1;")

# 步骤2: 按台桌开空调
curl -X POST "http://127.0.0.1:8088/api/switch/table-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"table_name_en\":\"$TABLE_NAME\",\"action\":\"ON\"}"

# 步骤3: 查看日志
pm2 logs tgservice-dev --lines 30 | grep -E "MQTT|台桌控制"
```

#### 预期结果
1. API返回200，`{"success": true, "count": X, "table_name_en": "xxx"}`
2. 测试环境日志显示跳过真实发送

---

### TC-05-03: 按台桌关空调

**优先级**: P0  
**测试目标**: 验证台桌空调关闭API  
**API**: `POST /api/switch/table-control`

#### 测试步骤

```bash
# 步骤1: 获取有空调关联的台桌
TABLE_NAME=$(sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT td.table_name_en FROM table_device td 
   JOIN switch_device sd ON sd.switch_seq=td.switch_seq AND sd.switch_label=td.switch_label 
   WHERE sd.device_type='空调' LIMIT 1;")

# 步骤2: 按台桌关空调
curl -X POST "http://127.0.0.1:8088/api/switch/table-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"table_name_en\":\"$TABLE_NAME\",\"action\":\"OFF\"}"

# 步骤3: 查看日志
pm2 logs tgservice-dev --lines 30 | grep -E "MQTT|台桌控制"
```

#### 预期结果
1. API返回200，`{"success": true, "count": X}`
2. 测试环境日志显示跳过真实发送

#### 异常流程

```bash
# 测试不存在台桌
curl -X POST "http://127.0.0.1:8088/api/switch/table-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table_name_en":"invalid_table","action":"OFF"}'
```

**预期**: 状态码 400，返回 `"台桌 xxx 下没有关联开关"`

---

## 模块6: 空调MQTT指令格式（4个用例）

### TC-06-01: 空调开指令格式验证

**优先级**: P0  
**测试目标**: 验证空调MQTT指令格式正确  
**API**: `POST /api/switch/label-control`  
**验证方式**: 日志输出

#### 测试步骤

```bash
# 步骤1: 触发空调开指令
curl -X POST "http://127.0.0.1:8088/api/switch/label-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"VIP1","action":"ON"}'

# 步骤2: 查看日志输出格式
pm2 logs tgservice-dev --lines 50 | grep "跳过真实发送"

# 步骤3: 验证日志格式是否包含关键信息
pm2 logs tgservice-dev --lines 50 | grep -E "switch_id|switch_seq|ON"
```

#### 预期结果
1. 日志显示 `[MQTT][测试环境] 跳过真实发送: switchId switchSeq ON`
2. 日志包含开关ID、开关序号、动作（ON）
3. 不存在真实MQTT连接日志

---

### TC-06-02: 空调关指令格式验证

**优先级**: P0  
**测试目标**: 验证空调MQTT关指令格式  
**API**: `POST /api/switch/label-control`  
**验证方式**: 日志输出

#### 测试步骤

```bash
# 步骤1: 触发空调关指令
curl -X POST "http://127.0.0.1:8088/api/switch/label-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"VIP1","action":"OFF"}'

# 步骤2: 查看日志输出
pm2 logs tgservice-dev --lines 50 | grep "跳过真实发送"

# 步骤3: 验证日志格式
pm2 logs tgservice-dev --lines 50 | grep -E "switch_id|switch_seq|OFF"
```

#### 预期结果
1. 日志显示 `[MQTT][测试环境] 跳过真实发送: switchId switchSeq OFF`
2. 日志包含开关ID、开关序号、动作（OFF）

---

### TC-06-03: MQTT指令缺少参数验证

**优先级**: P1  
**测试目标**: 验证MQTT指令缺少参数时的错误处理  
**API**: `POST /api/switch/label-control`

#### 测试步骤

```bash
# 步骤1: 测试缺少action参数
curl -X POST "http://127.0.0.1:8088/api/switch/label-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"VIP1"}'

# 步骤2: 测试缺少label参数
curl -X POST "http://127.0.0.1:8088/api/switch/label-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"ON"}'

# 步骤3: 测试空请求体
curl -X POST "http://127.0.0.1:8088/api/switch/label-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### 预期结果
1. 缺少action或label时，返回状态码 400
2. 返回错误信息 `"缺少参数"` 或 `"动作只能是 ON 或 OFF"`
3. 不发送MQTT指令

---

### TC-06-04: 测试环境MQTT只写日志验证

**优先级**: P0  
**测试目标**: 验证测试环境（TGSERVICE_ENV=test）MQTT指令不真实发送  
**验证方式**: 日志 + 配置检查

#### 测试步骤

```bash
# 步骤1: 检查测试环境配置
grep "TGSERVICE_ENV" /TG/tgservice/.config.env || echo "未配置TGSERVICE_ENV"

# 步骤2: 检查mqtt-switch.js中的isTestEnv逻辑
grep "isTestEnv" /TG/tgservice/backend/services/mqtt-switch.js

# 步骤3: 执行MQTT操作并验证日志
curl -X POST "http://127.0.0.1:8088/api/switch/scene/1" \
  -H "Authorization: Bearer $TOKEN"

pm2 logs tgservice-dev --lines 50 | grep "测试环境"
```

#### 预期结果
1. 测试环境配置中 `env.name = "test"` 或 `TGSERVICE_ENV = "test"`
2. 日志显示 `[MQTT][测试环境] 跳过真实发送`
3. 不存在真实MQTT连接成功日志（如 `[MQTT] 连接成功`）

---

## 模块7: ac_control系统配置（4个用例）

### TC-07-01: 读取空调设定配置

**优先级**: P0  
**测试目标**: 验证空调设定配置读取API  
**API**: `GET /api/admin/ac-control`

#### 测试步骤

```bash
# 步骤1: 读取空调配置
curl -X GET "http://127.0.0.1:8088/api/admin/ac-control" \
  -H "Authorization: Bearer $TOKEN"

# 步骤2: 验证数据库配置
sqlite3 /TG/tgservice/db/tgservice.db "SELECT value FROM system_config WHERE key='ac_control';"
```

#### 预期结果
1. API返回200，格式：
   ```json
   {
     "success": true,
     "config": {
       "temp_set": 23,
       "fan_speed_enum": "middle"
     }
   }
   ```
2. 数据库返回JSON字符串：`{"temp_set":23,"fan_speed_enum":"middle"}`
3. 如无配置，返回默认值

---

### TC-07-02: 更新空调温度设定

**优先级**: P0  
**测试目标**: 验证空调温度更新API  
**API**: `PUT /api/admin/ac-control`

#### 测试步骤

```bash
# 步骤1: 更新温度为25℃
curl -X PUT "http://127.0.0.1:8088/api/admin/ac-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"temp_set":25}'

# 步骤2: 验证数据库更新
sqlite3 /TG/tgservice/db/tgservice.db "SELECT value FROM system_config WHERE key='ac_control';"

# 步骤3: 再次读取配置验证
curl -X GET "http://127.0.0.1:8088/api/admin/ac-control" \
  -H "Authorization: Bearer $TOKEN"
```

#### 预期结果
1. API返回200，`{"success": true, "config": {"temp_set": 25, ...}}`
2. 数据库value字段更新为 `{"temp_set":25,"fan_speed_enum":"middle"}`
3. 操作日志记录更新

---

### TC-07-03: 更新温度边界值验证

**优先级**: P0  
**测试目标**: 验证温度范围校验（16-30℃）  
**API**: `PUT /api/admin/ac-control`

#### 测试步骤

```bash
# 步骤1: 测试最小温度16℃
curl -X PUT "http://127.0.0.1:8088/api/admin/ac-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"temp_set":16}'

# 步骤2: 测试最大温度30℃
curl -X PUT "http://127.0.0.1:8088/api/admin/ac-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"temp_set":30}'

# 步骤3: 验证数据库更新
sqlite3 /TG/tgservice/db/tgservice.db "SELECT value FROM system_config WHERE key='ac_control';"
```

#### 预期结果
1. 16℃和30℃都返回成功，状态码 200
2. 数据库value字段更新为对应温度值

---

### TC-07-04: 温度非法值验证

**优先级**: P0  
**测试目标**: 验证温度非法值校验（超出范围、非整数）  
**API**: `PUT /api/admin/ac-control`

#### 测试步骤

```bash
# 步骤1: 测试超低温度15℃
curl -X PUT "http://127.0.0.1:8088/api/admin/ac-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"temp_set":15}'

# 步骤2: 测试超高温度31℃
curl -X PUT "http://127.0.0.1:8088/api/admin/ac-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"temp_set":31}'

# 步骤3: 测试非整数温度
curl -X PUT "http://127.0.0.1:8088/api/admin/ac-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"temp_set":23.5}'

# 步骤4: 测试无效风速
curl -X PUT "http://127.0.0.1:8088/api/admin/ac-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fan_speed_enum":"invalid_speed"}'
```

#### 预期结果
1. 15℃和31℃返回状态码 400，错误信息 `"温度范围: 16-30℃"`
2. 23.5℃返回状态码 400（非整数）
3. 无效风速返回状态码 400，错误信息 `"风速可选: auto, low, middle, high"`

---

## 模块8: 自动关空调功能（4个用例）

### TC-08-01: 台桌相关自动关空调 - 空闲台桌触发

**优先级**: P0  
**测试目标**: 验证空闲台桌触发自动关空调逻辑  
**API**: `POST /api/switch/auto-off-manual`  
**前置条件**: switch_device表中有空调设备，且配置了auto_off_start/auto_off_end时段

#### 测试步骤

```bash
# 步骤1: 检查自动关灯功能开启状态
curl -X GET "http://127.0.0.1:8088/api/switch/auto-status" \
  -H "Authorization: Bearer $TOKEN"

# 步骤2: 如未开启，先开启
curl -X POST "http://127.0.0.1:8088/api/switch/auto-off-toggle" \
  -H "Authorization: Bearer $TOKEN"

# 步骤3: 设置空闲台桌状态（模拟）
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE tables SET status='空闲' WHERE name_pinyin='vip1';"

# 步骤4: 手动触发自动关空调
curl -X POST "http://127.0.0.1:8088/api/switch/auto-off-manual" \
  -H "Authorization: Bearer $TOKEN"

# 步骤5: 查看日志
pm2 logs tgservice-dev --lines 50 | grep -E "自动关灯|台桌"
```

#### 预期结果
1. API返回200，包含 `turnedOffCount` 和 `independentTurnedOffCount`
2. 日志显示自动关灯逻辑执行（空调设备也包含在逻辑中）
3. 测试环境日志显示跳过真实发送

---

### TC-08-02: 台桌无关自动关空调 - 非台桌关联空调触发

**优先级**: P1  
**测试目标**: 验证非台桌关联空调设备自动关闭  
**API**: `POST /api/switch/auto-off-manual`

#### 测试步骤

```bash
# 步骤1: 检查台桌无关的空调设备
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT sd.switch_id, sd.switch_seq FROM switch_device sd 
   LEFT JOIN table_device td ON sd.switch_seq=td.switch_seq AND sd.switch_label=td.switch_label 
   WHERE td.table_name_en IS NULL AND sd.device_type='空调' LIMIT 5;"

# 步骤2: 手动触发自动关空调
curl -X POST "http://127.0.0.1:8088/api/switch/auto-off-manual" \
  -H "Authorization: Bearer $TOKEN"

# 步骤3: 查看日志
pm2 logs tgservice-dev --lines 50 | grep -E "台桌无关|independent"
```

#### 预期结果
1. API返回200，包含 `independentTurnedOffCount`
2. 日志显示台桌无关开关关闭数量
3. 如有台桌无关空调设备，包含在关闭逻辑中

---

### TC-08-03: 自动关空调功能未开启验证

**优先级**: P1  
**测试目标**: 验证功能未开启时不执行自动关空调  
**API**: `POST /api/switch/auto-off-manual`

#### 测试步骤

```bash
# 步骤1: 关闭自动关灯功能
curl -X POST "http://127.0.0.1:8088/api/switch/auto-off-toggle" \
  -H "Authorization: Bearer $TOKEN"

# 步骤2: 验证关闭状态
curl -X GET "http://127.0.0.1:8088/api/switch/auto-status" \
  -H "Authorization: Bearer $TOKEN"

# 步骤3: 手动触发自动关空调（应跳过）
curl -X POST "http://127.0.0.1:8088/api/switch/auto-off-manual" \
  -H "Authorization: Bearer $TOKEN"

# 步骤4: 查看日志（应显示功能未开启）
pm2 logs tgservice-dev --lines 30 | grep "功能未开启"

# 步骤5: 重新开启功能
curl -X POST "http://127.0.0.1:8088/api/switch/auto-off-toggle" \
  -H "Authorization: Bearer $TOKEN"
```

#### 预期结果
1. 功能关闭后，auto-status返回 `{"auto_off_enabled": false}`
2. 手动触发时，日志显示 `[自动关灯] 功能未开启，跳过`
3. 不执行关空调逻辑

---

### TC-08-04: 自动关空调时段验证 - 不在时段内

**优先级**: P1  
**测试目标**: 验证不在自动关空调时段内不执行  
**前置条件**: 空调设备配置了auto_off_start和auto_off_end时段

#### 测试步骤

```bash
# 步骤1: 查看空调设备时段配置
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT switch_id, auto_off_start, auto_off_end FROM switch_device WHERE device_type='空调' LIMIT 5;"

# 步骤2: 获取当前时间
echo "当前时间: $(date '+%H:%M')"

# 步骤3: 判断当前时间是否在时段内（示例时段02:00-14:00）
# 如果当前时间不在时段内，手动触发应跳过这些设备

# 步骤4: 手动触发并查看日志
curl -X POST "http://127.0.0.1:8088/api/switch/auto-off-manual" \
  -H "Authorization: Bearer $TOKEN"

pm2 logs tgservice-dev --lines 50 | grep -E "自动关灯|无需要关"
```

#### 预期结果
1. 如果当前时间不在空调设备的auto_off时段内，这些设备不关闭
2. 日志显示时段判断逻辑
3. 只关闭在时段内的设备

---

## 模块9: 前端页面（2个用例）

### TC-09-01: 前端空调控制页面路由验证

**优先级**: P1  
**测试目标**: 验证前端H5空调控制页面路由存在  
**验证方式**: 文件检查

#### 测试步骤

```bash
# 步骤1: 检查pages.json路由配置
cat /TG/tgservice-uniapp/src/pages.json | grep -i "空调\|ac-control\|smart-switch"

# 步骤2: 检查pages目录是否存在空调页面
ls -la /TG/tgservice-uniapp/src/pages/ | grep -i "switch\|smart\|ac"

# 步骤3: 检查现有智能开关页面（灯控制页面是否存在）
ls -la /TG/tgservice-uniapp/src/pages/smart-switch/ 2>/dev/null || echo "smart-switch目录不存在"
```

#### 预期结果
1. pages.json中存在空调控制页面路由（或智能开关页面可复用）
2. pages目录中存在空调相关页面目录（或smart-switch页面）
3. 如不存在，记录为待实现功能

---

### TC-09-02: 前端空调控制页面权限校验

**优先级**: P1  
**测试目标**: 验证空调控制页面权限校验逻辑  
**验证方式**: 代码检查 + API权限

#### 测试步骤

```bash
# 步骤1: 检查页面权限逻辑
grep -rn "requireSwitchPermission\|店长\|助教管理\|管理员" /TG/tgservice/backend/routes/switch-routes.js

# 步骤2: 测试无权限用户访问API（普通用户）
# 使用普通用户Token访问空调控制API，验证权限校验

# 步骤3: 检查后台管理空调设备页面权限
grep -rn "vipRoomManagement" /TG/tgservice/backend/routes/switch-routes.js
```

#### 预期结果
1. 前台空调控制API需要店长/助教管理/管理员权限
2. 后台空调设备管理API需要vipRoomManagement权限
3. 无权限用户返回状态码 403，错误信息 `"权限不足"`

---

## 测试总结表

| 用例编号 | 功能模块 | 优先级 | 测试API | 验证方式 |
|---------|---------|--------|---------|----------|
| TC-01-01 | 灯控制筛选 | P0 | /api/admin/switches?device_type=灯 | curl + sqlite3 |
| TC-01-02 | 空调设备筛选 | P0 | /api/admin/switches?device_type=空调 | curl + sqlite3 |
| TC-01-03 | 无筛选参数 | P1 | /api/admin/switches | curl + sqlite3 |
| TC-01-04 | 标签控制筛选 | P0 | /api/switch/labels | curl + sqlite3 |
| TC-01-05 | 台桌控制筛选 | P0 | /api/switch/tables | curl + sqlite3 |
| TC-02-01 | 查询空调设备 | P0 | /api/admin/switches?device_type=空调 | curl + sqlite3 |
| TC-02-02 | 新增空调设备 | P0 | POST /api/admin/switches | curl + sqlite3 |
| TC-02-03 | 修改空调设备 | P1 | PUT /api/admin/switches/:id | curl + sqlite3 |
| TC-02-04 | 删除空调设备 | P1 | DELETE /api/admin/switches/:id | curl + sqlite3 |
| TC-03-01 | 场景列表 | P0 | /api/switch/scenes | curl + sqlite3 |
| TC-03-02 | 执行开空调场景 | P0 | POST /api/switch/scene/:id | curl + logs |
| TC-03-03 | 执行关空调场景 | P0 | POST /api/switch/scene/:id | curl + logs |
| TC-04-01 | 空调标签列表 | P0 | /api/switch/labels | curl + sqlite3 |
| TC-04-02 | 按标签开空调 | P0 | POST /api/switch/label-control | curl + logs |
| TC-04-03 | 按标签关空调 | P0 | POST /api/switch/label-control | curl + logs |
| TC-05-01 | 台桌空调关联 | P0 | /api/switch/tables | curl + sqlite3 |
| TC-05-02 | 按台桌开空调 | P0 | POST /api/switch/table-control | curl + logs |
| TC-05-03 | 按台桌关空调 | P0 | POST /api/switch/table-control | curl + logs |
| TC-06-01 | 开指令格式 | P0 | POST /api/switch/label-control | logs |
| TC-06-02 | 关指令格式 | P0 | POST /api/switch/label-control | logs |
| TC-06-03 | 缺少参数验证 | P1 | POST /api/switch/label-control | curl |
| TC-06-04 | 测试环境验证 | P0 | logs + config | logs + grep |
| TC-07-01 | 读取空调配置 | P0 | GET /api/admin/ac-control | curl + sqlite3 |
| TC-07-02 | 更新温度设定 | P0 | PUT /api/admin/ac-control | curl + sqlite3 |
| TC-07-03 | 温度边界值 | P0 | PUT /api/admin/ac-control | curl + sqlite3 |
| TC-07-04 | 温度非法值 | P0 | PUT /api/admin/ac-control | curl |
| TC-08-01 | 台桌相关关空调 | P0 | POST /api/switch/auto-off-manual | curl + logs |
| TC-08-02 | 台桌无关关空调 | P1 | POST /api/switch/auto-off-manual | curl + logs |
| TC-08-03 | 功能未开启 | P1 | POST /api/switch/auto-off-manual | curl + logs |
| TC-08-04 | 时段验证 | P1 | POST /api/switch/auto-off-manual | logs |
| TC-09-01 | 前端路由验证 | P1 | 文件检查 | ls + grep |
| TC-09-02 | 前端权限校验 | P1 | 代码检查 | grep |

**总计**: 32个测试用例

---

## 测试执行顺序建议

1. **环境准备** - 获取Token，验证数据库
2. **模块1** - 灯控制API筛选（TC-01-01 ~ TC-01-05）
3. **模块2** - 空调设备管理（TC-02-01 ~ TC-02-04）
4. **模块7** - 空调配置（TC-07-01 ~ TC-07-04）
5. **模块3** - 空调场景控制（TC-03-01 ~ TC-03-03）
6. **模块4** - 空调标签控制（TC-04-01 ~ TC-04-03）
7. **模块5** - 空调台桌控制（TC-05-01 ~ TC-05-03）
8. **模块6** - MQTT指令格式（TC-06-01 ~ TC-06-04）
9. **模块8** - 自动关空调（TC-08-01 ~ TC-08-04）
10. **模块9** - 前端页面（TC-09-01 ~ TC-09-02）

---

## 注意事项

1. **严禁使用8081和8083端口** - 这些是生产环境端口
2. **测试环境MQTT只写日志** - 不真实发送MQTT指令
3. **认证Token必须有效** - 使用tgadmin账号登录获取
4. **数据库操作谨慎** - 删除操作前先备份
5. **测试数据隔离** - 使用测试专用开关ID（test_ac_switch_001）
6. **测试完成后清理** - 删除测试新增的空调设备
7. **自动关空调时段判断** - 注意跨午夜时段（如22:00~06:00）

---

## 测试完成清理脚本

```bash
# 清理测试新增的空调设备
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM switch_device WHERE switch_id='test_ac_switch_001';"

# 清理测试新增的台桌设备关系（如有）
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM table_device WHERE switch_label='TEST_AC_01';"

# 恢复空调配置（如测试中修改）
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE system_config SET value='{"temp_set":23,"fan_speed_enum":"middle"}' WHERE key='ac_control';"
```

---

_测试用例编写完成 - 测试员B - V2版本 - 32个用例_