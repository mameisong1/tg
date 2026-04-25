你是测试员B。请执行API接口测试。

## 测试地址
- 后端API：http://127.0.0.1:8088
- **严禁使用 8081 和 8083 端口！**

## 测试用例
```
# 天宫QA - 空调控制功能API测试用例

**测试环境**: http://127.0.0.1:8088  
**测试日期**: 2026-04-25  
**测试员**: B  
**严禁使用端口**: 8081、8083

---

## 测试环境准备

### 1. 认证Token获取

```bash
# 方式1：通过登录接口获取
curl -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}'

# 方式2：直接查询数据库验证用户存在
sqlite3 /TG/run/db/tgservice.db "SELECT username, role FROM admin_users WHERE username='tgadmin';"
```

**预期结果**：返回包含 `token` 字段的JSON，或数据库存在 tgadmin 用户。

### 2. 测试数据准备

```bash
# 检查现有设备数据
sqlite3 /TG/run/db/tgservice.db "SELECT id, switch_id, switch_seq, switch_label, device_type FROM switch_device LIMIT 5;"

# 检查空调配置
sqlite3 /TG/run/db/tgservice.db "SELECT key, value FROM system_config WHERE key='ac_control';"

# 检查台桌设备关系
sqlite3 /TG/run/db/tgservice.db "SELECT id, table_name_en, switch_seq, switch_label FROM table_device LIMIT 3;"
```

---

## P0 - 核心功能测试用例

### TC-P0-01: 灯控制API - device_type=灯筛选

**优先级**: P0（核心）  
**测试目标**: 验证灯控制API只返回灯设备，不返回空调设备  
**测试地址**: `/api/admin/switches`

#### 测试步骤

```bash
# 步骤1：获取认证Token（假设已获取）
TOKEN="test_token_placeholder"

# 步骤2：请求灯设备列表（device_type=灯）
curl -X GET "http://127.0.0.1:8088/api/admin/switches?device_type=灯" \
  -H "Authorization: Bearer $TOKEN"

# 步骤3：验证数据库中灯设备数量
sqlite3 /TG/run/db/tgservice.db "SELECT COUNT(*) FROM switch_device WHERE device_type='灯';"

# 步骤4：请求空调设备列表（device_type=空调）- 验证分离
curl -X GET "http://127.0.0.1:8088/api/admin/switches?device_type=空调" \
  -H "Authorization: Bearer $TOKEN"
```

#### 预期结果

1. `device_type=灯` 请求返回的JSON中，所有设备的 `device_type` 字段都等于 `"灯"`
2. 返回数量与数据库查询结果一致
3. `device_type=空调` 请求返回的JSON中，所有设备的 `device_type` 字段都等于 `"空调"`（如无空调设备则返回空数组）
4. 状态码 200

#### 异常流程

```bash
# 测试无效的device_type
curl -X GET "http://127.0.0.1:8088/api/admin/switches?device_type=无效类型" \
  -H "Authorization: Bearer $TOKEN"
```

**预期**: 返回空数组或状态码 200（无匹配数据）

---

### TC-P0-02: 空调设定配置 - 读取

**优先级**: P0（核心）  
**测试目标**: 验证空调设定配置API能正确读取ac_control配置  
**测试地址**: `/api/admin/ac-control`

#### 测试步骤

```bash
# 步骤1：直接查询数据库验证配置存在
sqlite3 /TG/run/db/tgservice.db "SELECT value FROM system_config WHERE key='ac_control';"

# 步骤2：API读取配置
curl -X GET "http://127.0.0.1:8088/api/admin/ac-control" \
  -H "Authorization: Bearer $TOKEN"
```

#### 预期结果

1. 数据库返回JSON格式：`{"temp_set":23,"fan_speed_enum":"middle"}`
2. API返回：
   ```json
   {
     "success": true,
     "config": {
       "temp_set": 23,
       "fan_speed_enum": "middle"
     }
   }
   ```
3. 状态码 200

#### 异常流程

```bash
# 测试无权限访问（无Token）
curl -X GET "http://127.0.0.1:8088/api/admin/ac-control"
```

**预期**: 状态码 401 或 403

---

### TC-P0-03: 空调设定配置 - 更新

**优先级**: P0（核心）  
**测试目标**: 验证空调设定配置API能正确更新温度和风速  
**测试地址**: `/api/admin/ac-control`

#### 测试步骤

```bash
# 步骤1：更新温度为25℃
curl -X PUT "http://127.0.0.1:8088/api/admin/ac-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"temp_set":25}'

# 步骤2：验证数据库更新
sqlite3 /TG/run/db/tgservice.db "SELECT value FROM system_config WHERE key='ac_control';"

# 步骤3：更新风速为high
curl -X PUT "http://127.0.0.1:8088/api/admin/ac-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fan_speed_enum":"high"}'

# 步骤4：同时更新温度和风速
curl -X PUT "http://127.0.0.1:8088/api/admin/ac-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"temp_set":22,"fan_speed_enum":"auto"}'
```

#### 预期结果

1. 每次更新后API返回成功：`{"success": true, "config": {...}}`
2. 数据库中的value字段正确更新为新的JSON值
3. 状态码 200

#### 异常流程

```bash
# 测试无效温度（超出范围）
curl -X PUT "http://127.0.0.1:8088/api/admin/ac-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"temp_set":35}'
```

**预期**: 状态码 400，返回错误信息 `"温度范围: 16-30℃"`

```bash
# 测试无效风速
curl -X PUT "http://127.0.0.1:8088/api/admin/ac-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fan_speed_enum":"invalid"}'
```

**预期**: 状态码 400，返回错误信息包含有效风速选项

---

## P1 - 重要功能测试用例

### TC-P1-01: 空调控制 - 场景执行

**优先级**: P1（重要）  
**测试目标**: 验证空调场景控制API存在且能执行场景  
**测试地址**: `/api/switch/scene/:id`  
**前置条件**: switch_scene表中存在空调相关场景

#### 测试步骤

```bash
# 步骤1：检查场景表
sqlite3 /TG/run/db/tgservice.db "SELECT id, scene_name, action, switches FROM switch_scene LIMIT 5;"

# 步骤2：执行场景（假设场景ID=1）
curl -X POST "http://127.0.0.1:8088/api/switch/scene/1" \
  -H "Authorization: Bearer $TOKEN"

# 步骤3：验证日志输出（开发环境只写日志，不发送MQTT）
pm2 logs tgservice-dev --lines 30 | grep "MQTT"
```

#### 预期结果

1. 场景执行返回 `{"success": true, "count": X}`
2. 开发环境日志显示 `[MQTT][测试环境] 跳过真实发送`
3. 状态码 200

#### 异常流程

```bash
# 测试不存在场景
curl -X POST "http://127.0.0.1:8088/api/switch/scene/99999" \
  -H "Authorization: Bearer $TOKEN"
```

**预期**: 状态码 404

---

### TC-P1-02: 空调控制 - 标签批量控制

**优先级**: P1（重要）  
**测试目标**: 验证空调标签批量控制API  
**测试地址**: `/api/switch/label-control`

#### 测试步骤

```bash
# 步骤1：查询现有标签
curl -X GET "http://127.0.0.1:8088/api/switch/labels" \
  -H "Authorization: Bearer $TOKEN"

# 步骤2：批量控制（假设标签=1，动作=ON）
curl -X POST "http://127.0.0.1:8088/api/switch/label-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"1","action":"ON"}'

# 步骤3：验证日志
pm2 logs tgservice-dev --lines 30 | grep "MQTT"
```

#### 预期结果

1. 返回 `{"success": true, "count": X}`
2. 开发环境日志显示跳过真实发送
3. 状态码 200

#### 异常流程

```bash
# 测试无效动作
curl -X POST "http://127.0.0.1:8088/api/switch/label-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"1","action":"INVALID"}'
```

**预期**: 状态码 400，返回 `"动作只能是 ON 或 OFF"`

---

### TC-P1-03: 空调控制 - 台桌控制

**优先级**: P1（重要）  
**测试目标**: 验证空调台桌控制API  
**测试地址**: `/api/switch/table-control`

#### 测试步骤

```bash
# 步骤1：查询台桌列表
curl -X GET "http://127.0.0.1:8088/api/switch/tables" \
  -H "Authorization: Bearer $TOKEN"

# 步骤2：控制指定台桌（假设table_name_en=vip1）
curl -X POST "http://127.0.0.1:8088/api/switch/table-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table_name_en":"vip1","action":"OFF"}'

# 步骤3：验证日志
pm2 logs tgservice-dev --lines 30 | grep "MQTT"
```

#### 鐔期结果

1. 返回 `{"success": true, "count": X, "table_name_en": "vip1"}`
2. 开发环境日志显示跳过真实发送
3. 状态码 200

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

### TC-P1-04: 空调MQTT指令格式验证

**优先级**: P1（重要）  
**测试目标**: 验证开发环境MQTT指令只写日志，格式正确  
**测试地址**: 无（日志验证）

#### 测试步骤

```bash
# 步骤1：触发一次开关操作（通过场景或标签）
curl -X POST "http://127.0.0.1:8088/api/switch/label-control" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"1","action":"ON"}'

# 步骤2：查看日志输出
pm2 logs tgservice-dev --lines 50 | grep -E "MQTT|测试环境"

# 步骤3：验证日志格式是否包含关键信息
pm2 logs tgservice-dev --lines 50 | grep "跳过真实发送"
```

#### 预期结果

1. 日志包含 `[MQTT][测试环境] 跳过真实发送: switchId switchSeq action`
2. 日志包含开关ID、序号、动作信息
3. 不存在真实的MQTT连接日志（证明测试环境跳过）

---

### TC-P1-05: 新增空调设备API

**优先级**: P1（重要）  
**测试目标**: 验证能新增空调类型设备  
**测试地址**: `/api/admin/switches`

#### 测试步骤

```bash
# 步骤1：新增空调设备
curl -X POST "http://127.0.0.1:8088/api/admin/switches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"switch_id":"0xa4c138new","switch_seq":"state_ac1","switch_label":"VIP1空调","device_type":"空调","remark":"VIP1空调开关"}'

# 步骤2：验证数据库
sqlite3 /TG/run/db/tgservice.db "SELECT * FROM switch_device WHERE device_type='空调' LIMIT 5;"

# 步骤3：查询空调设备列表
curl -X GET "http://127.0.0.1:8088/api/admin/switches?device_type=空调" \
  -H "Authorization: Bearer $TOKEN"
```

#### 预期结果

1. 新增成功，返回 `{"success": true}`
2. 数据库中存在新增的空调设备记录
3. 查询空调设备列表返回新增的设备

---

## P2 - 次要功能测试用例

### TC-P2-01: 空调设备 - 更新

**优先级**: P2（次要）  
**测试目标**: 验证空调设备信息更新  
**测试地址**: `/api/admin/switches/:id`

#### 测试步骤

```bash
# 步骤1：更新空调设备备注
curl -X PUT "http://127.0.0.1:8088/api/admin/switches/1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"remark":"更新后的备注"}'

# 步骤2：验证数据库
sqlite3 /TG/run/db/tgservice.db "SELECT remark FROM switch_device WHERE id=1;"
```

#### 预期结果

1. 更新成功，返回 `{"success": true}`
2. 数据库中remark字段已更新

---

### TC-P2-02: 空调设备 - 删除

**优先级**: P2（次要）  
**测试目标**: 验证空调设备删除功能  
**测试地址**: `/api/admin/switches/:id`

#### 测试步骤

```bash
# 步骤1：删除空调设备（先新增一个用于删除）
curl -X POST "http://127.0.0.1:8088/api/admin/switches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"switch_id":"test_ac_delete","switch_seq":"test_seq","switch_label":"测试空调","device_type":"空调"}'

# 步骤2：获取新增设备的ID
sqlite3 /TG/run/db/tgservice.db "SELECT id FROM switch_device WHERE switch_id='test_ac_delete';"

# 步骤3：删除该设备（假设ID=100）
curl -X DELETE "http://127.0.0.1:8088/api/admin/switches/100" \
  -H "Authorization: Bearer $TOKEN"

# 步骤4：验证删除
sqlite3 /TG/run/db/tgservice.db "SELECT COUNT(*) FROM switch_device WHERE switch_id='test_ac_delete';"
```

#### 鐔期结果

1. 删除成功，返回 `{"success": true}`
2. 数据库中该设备记录已不存在

---

### TC-P2-03: 前台H5智能空调入口 - 页面路由验证

**优先级**: P2（次要）  
**测试目标**: 验证前台H5智能空调页面路由是否存在  
**测试地址**: 前端路由验证

#### 测试步骤

```bash
# 步骤1：检查前端路由配置文件
ls -la /TG/tgservice-uniapp/src/pages.json

# 步骤2：查看路由配置中是否有空调相关页面
grep -i "空调\|ac\|air" /TG/tgservice-uniapp/src/pages.json || echo "未找到空调页面配置"

# 步骤3：检查pages目录是否有空调相关页面
ls -la /TG/tgservice-uniapp/src/pages/ | grep -i "ac\|air\|conditioner" || echo "未找到空调页面目录"

# 步骤4：验证API层面是否存在空调前台控制接口
curl -X GET "http://127.0.0.1:8088/api/switch/ac-scenes" \
  -H "Authorization: Bearer $TOKEN" || echo "空调场景API不存在"
```

#### 鐔期结果

1. pages.json中存在空调页面路由配置
2. pages目录中存在空调相关页面目录
3. 或者API层面存在空调前台控制接口
4. 如果以上都不存在，说明需要新增（记录为待实现功能）

---

### TC-P2-04: 空调系统配置 - 默认值测试

**优先级**: P2（次要）  
**测试目标**: 验证空调配置不存在时的默认值  
**测试地址**: `/api/admin/ac-control`

#### 测试步骤

```bash
# 步骤1：临时删除ac_control配置（备份）
sqlite3 /TG/run/db/tgservice.db "SELECT value FROM system_config WHERE key='ac_control';" > /TG/temp/ac_backup.txt
sqlite3 /TG/run/db/tgservice.db "DELETE FROM system_config WHERE key='ac_control';"

# 步骤2：请求空调配置（应返回默认值）
curl -X GET "http://127.0.0.1:8088/api/admin/ac-control" \
  -H "Authorization: Bearer $TOKEN"

# 步骤3：恢复配置
BACKUP_VALUE=$(cat /TG/temp/ac_backup.txt)
sqlite3 /TG/run/db/tgservice.db "INSERT INTO system_config (key, value, description, updated_at) VALUES ('ac_control', '$BACKUP_VALUE', '空调设定配置', datetime('now', 'localtime'));"
```

#### 鐔期结果

1. 配置不存在时，返回默认值：
   ```json
   {
     "success": true,
     "config": {
       "temp_set": 23,
       "fan_speed_enum": "middle"
     }
   }
   ```
2. 状态码 200

---

## 测试总结表

| 用例编号 | 功能点 | 优先级 | 测试地址 | 验证方式 |
|---------|--------|--------|----------|----------|
| TC-P0-01 | 灯控制API筛选 | P0 | /api/admin/switches | curl + sqlite3 |
| TC-P0-02 | 空调配置读取 | P0 | /api/admin/ac-control | curl + sqlite3 |
| TC-P0-03 | 空调配置更新 | P0 | /api/admin/ac-control | curl + sqlite3 |
| TC-P1-01 | 空调场景执行 | P1 | /api/switch/scene/:id | curl + 日志 |
| TC-P1-02 | 空调标签批量控制 | P1 | /api/switch/label-control | curl + 日志 |
| TC-P1-03 | 空调台桌控制 | P1 | /api/switch/table-control | curl + 日志 |
| TC-P1-04 | MQTT指令格式 | P1 | 日志验证 | pm2 logs |
| TC-P1-05 | 新增空调设备 | P1 | /api/admin/switches | curl + sqlite3 |
| TC-P2-01 | 空调设备更新 | P2 | /api/admin/switches/:id | curl + sqlite3 |
| TC-P2-02 | 空调设备删除 | P2 | /api/admin/switches/:id | curl + sqlite3 |
| TC-P2-03 | 前台H5入口 | P2 | 路由验证 | ls + grep |
| TC-P2-04 | 空调默认配置 | P2 | /api/admin/ac-control | curl + sqlite3 |

---

## 测试执行顺序建议

1. **环境准备** - 获取Token，验证数据库
2. **P0核心测试** - TC-P0-01 → TC-P0-02 → TC-P0-03
3. **P1重要测试** - TC-P1-05（先新增空调设备）→ TC-P1-01 → TC-P1-02 → TC-P1-03 → TC-P1-04
4. **P2次要测试** - TC-P2-01 → TC-P2-02 → TC-P2-03 → TC-P2-04

---

## 注意事项

1. **严禁使用8081和8083端口** - 这些是生产环境端口
2. **测试环境只写日志** - MQTT指令不会真实发送，只验证日志格式
3. **认证Token必须有效** - 使用tgadmin账号登录获取
4. **数据库操作谨慎** - 删除操作前先备份
5. **测试数据隔离** - 使用测试专用开关ID和序号

---

_测试用例编写完成 - 测试员B_
```

## 测试策略
- **只用 API/curl 测试，不需要浏览器测试**
- 核心测试：通过 curl 调用后端API，验证接口逻辑
- 测试数据：先用 sqlite3 查数据库找现成数据，没有就直接 INSERT 创建
- 不要反复调 API 找数据，直接操作数据库更快

## curl 测试示例
```bash
# 查询
curl -s http://127.0.0.1:8088/api/xxx?param=value

# 提交
curl -s -X POST http://127.0.0.1:8088/api/xxx \
  -H 'Content-Type: application/json' \
  -d '{"key":"value"}'
```

## 验证要点
- 状态码是否符合预期（200/400/404）
- 响应体中的 success 字段
- 数据库中的数据是否正确写入

## 验收重点
设备类型筛选、空调MQTT指令格式、系统配置加载

## 输出要求
- 测试结果写入：/TG/temp/QA-20260425-001/test-results.md
- 格式：表格（用例ID、测试项、优先级、预期结果、实际结果、状态）
- 状态：✅通过 / ❌失败 / ⏭️跳过