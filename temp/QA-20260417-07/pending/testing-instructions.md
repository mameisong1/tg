你是测试员B。请执行API接口测试。

## 测试地址
- 后端API：http://127.0.0.1:8088
- **严禁使用 8081 和 8083 端口！**

## 测试用例
```
# 测试报告：天宫（台桌无关）自动关灯脚本

| 项目 | 内容 |
|------|------|
| QA编号 | QA-20260417-07 |
| 测试日期 | 2026-04-17 |
| 测试环境 | 测试环境（http://127.0.0.1:8088） |
| 脚本位置（测试） | /TG/tgservice/scripts/ |
| 脚本位置（生产） | /app/tgservice/scripts/ |

---

## 功能概述

脚本功能：从 DB 查询出台桌无关的开关（即不在 `table_device` 表中关联任何台桌的开关），判断当前时间是否在该开关的自动关灯时段内，如果是则发出 MQTT 关灯指令。

**受 `system_settings.switch_auto_off_enabled` 控制**，开关关闭时脚本直接退出。

**关灯对象 SQL**：
```sql
SELECT DISTINCT A.开关ID, A.开关序号
FROM 设备开关表 A
LEFT JOIN 台桌设备关系表 B
  ON lower(A.开关标签) = lower(B.开关标签)
  AND lower(A.开关序号) = lower(B.开关序号)
WHERE B.台桌名 IS NULL
  AND 当前时间 BETWEEN A.自动关灯开始 AND A.自动关灯结束
```

---

## 测试数据准备

### 数据库表说明

| 表名 | 说明 |
|------|------|
| `switch_device` | 设备开关表，含 `switch_id`, `switch_seq`, `switch_label`, `auto_off_start`, `auto_off_end` |
| `table_device` | 台桌设备关系表，含 `table_name_en`, `switch_seq`, `switch_label` |
| `system_settings` | 系统设置表，`key='switch_auto_off_enabled'` 控制智能省电-自动 |

### 现有数据快照

```bash
# 查看现有开关数据
sqlite3 /TG/tgservice/db/tgservice.db "SELECT * FROM switch_device;"

# 查看现有台桌设备关系
sqlite3 /TG/tgservice/db/tgservice.db "SELECT * FROM table_device;"

# 查看智能省电开关状态
sqlite3 /TG/tgservice/db/tgservice.db "SELECT * FROM system_settings WHERE key='switch_auto_off_enabled';"
```

---

## 测试用例

### TC-001：智能省电开关关闭时脚本直接退出

| 属性 | 内容 |
|------|------|
| 优先级 | **P0 核心** |
| 测试目标 | 验证脚本启动时检查 `switch_auto_off_enabled`，值为 `0` 时直接退出，不执行后续操作 |
| 前置条件 | 数据库中存在至少一条台桌无关开关数据 |

**操作步骤：**

```bash
# 步骤1：确保智能省电开关为关闭状态
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE system_settings SET value='0' WHERE key='switch_auto_off_enabled';"

# 步骤2：确认开关值已更新
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT key, value FROM system_settings WHERE key='switch_auto_off_enabled';"
# 预期：返回 switch_auto_off_enabled | 0

# 步骤3：执行脚本
cd /TG/tgservice && node scripts/auto-off-non-table-lights.js 2>&1
# 或脚本实际文件名

# 步骤4：检查日志输出
cat /TG/tgservice/scripts/auto-off-non-table-lights.log 2>/dev/null | tail -5
```

**预期结果：**
- 脚本退出码为 0
- 日志中包含"功能未开启"或"已退出"等提示
- **未**发送任何 MQTT 关灯指令

---

### TC-002：智能省电开关开启 + 存在台桌无关开关且在关灯时段内

| 属性 | 内容 |
|------|------|
| 优先级 | **P0 核心** |
| 测试目标 | 验证脚本能正确查询台桌无关开关，并在关灯时段内发送关灯指令 |
| 前置条件 | 准备一条台桌无关开关数据，且当前时间在其 auto_off_start ~ auto_off_end 范围内 |

**操作步骤：**

```bash
# 步骤1：开启智能省电开关
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE system_settings SET value='1' WHERE key='switch_auto_off_enabled';"

# 步骤2：清理可能干扰的测试数据
sqlite3 /TG/tgservice/db/tgservice.db \
  "DELETE FROM switch_device WHERE switch_label LIKE 'QA_NON_TABLE_%';"

# 步骤3：插入台桌无关测试开关（确保 switch_label 不在 table_device 中）
# 假设当前时间为 10:30，设置关灯时段 08:00~14:00
sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT INTO switch_device (switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, auto_on_start, auto_on_end, created_at, updated_at)
   VALUES ('0xQATEST001', 'state_l1', 'QA_NON_TABLE_01', '08:00', '14:00', '', '', datetime('now'), datetime('now'));"

# 步骤4：确认该 switch_label 不在 table_device 中（即台桌无关）
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT COUNT(*) FROM table_device WHERE switch_label='QA_NON_TABLE_01';"
# 预期：返回 0

# 步骤5：执行脚本
cd /TG/tgservice && node scripts/auto-off-non-table-lights.js 2>&1

# 步骤6：检查日志
cat /TG/tgservice/scripts/auto-off-non-table-lights.log 2>/dev/null | tail -10
```

**预期结果：**
- 日志显示查询到台桌无关开关 `0xQATEST001 | state_l1`
- 日志显示发送了 MQTT OFF 指令（测试环境显示"测试环境，跳过发送"或记录到日志）
- 脚本正常退出

---

### TC-003：台桌无关开关不在关灯时段内

| 属性 | 内容 |
|------|------|
| 优先级 | **P0 核心** |
| 测试目标 | 验证当前时间不在关灯时段内的开关不会被发送关灯指令 |
| 前置条件 | 智能省电开关已开启 |

**操作步骤：**

```bash
# 步骤1：确保智能省电开关开启
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE system_settings SET value='1' WHERE key='switch_auto_off_enabled';"

# 步骤2：插入台桌无关测试开关，关灯时段为 22:00~04:00（当前时间10:30不在范围内）
sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT INTO switch_device (switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, auto_on_start, auto_on_end, created_at, updated_at)
   VALUES ('0xQATEST002', 'state_l1', 'QA_NON_TABLE_02', '22:00', '04:00', '', '', datetime('now'), datetime('now'));"

# 步骤3：确认该 switch_label 不在 table_device 中
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT COUNT(*) FROM table_device WHERE switch_label='QA_NON_TABLE_02';"
# 预期：返回 0

# 步骤4：执行脚本
cd /TG/tgservice && node scripts/auto-off-non-table-lights.js 2>&1

# 步骤5：检查日志
cat /TG/tgservice/scripts/auto-off-non-table-lights.log 2>/dev/null | tail -10
```

**预期结果：**
- 日志显示查询到台桌无关开关，但不在关灯时段内
- **未**发送任何 MQTT 关灯指令
- 脚本正常退出

---

### TC-004：台桌无关开关的关灯时段跨午夜（22:00~06:00）

| 属性 | 内容 |
|------|------|
| 优先级 | **P0 核心** |
| 测试目标 | 验证跨午夜时间窗口判断正确（start > end 的情况） |
| 前置条件 | 智能省电开关已开启，当前时间 10:30（不在 22:00~06:00 范围内） |

**操作步骤：**

```bash
# 步骤1：确保智能省电开关开启
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE system_settings SET value='1' WHERE key='switch_auto_off_enabled';"

# 步骤2：插入跨午夜时段开关（22:00~06:00），当前时间10:30不在范围内
sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT INTO switch_device (switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, auto_on_start, auto_on_end, created_at, updated_at)
   VALUES ('0xQATEST003', 'state_l1', 'QA_NON_TABLE_03', '22:00', '06:00', '', '', datetime('now'), datetime('now'));"

# 步骤3：执行脚本
cd /TG/tgservice && node scripts/auto-off-non-table-lights.js 2>&1

# 步骤4：检查日志
cat /TG/tgservice/scripts/auto-off-non-table-lights.log 2>/dev/null | tail -10
```

**预期结果：**
- 日志显示 `QA_NON_TABLE_03` 不在关灯时段内（10:30 不在 22:00~06:00）
- **未**发送 MQTT 关灯指令

> **注意**：如果需要在该时段内测试，可以将当前时间不在范围内的开关改为在范围内（如设置 auto_off_start='08:00', auto_off_end='12:00'），或调整测试时间。

---

### TC-005：台桌关联开关不应被脚本处理

| 属性 | 内容 |
|------|------|
| 优先级 | **P0 核心** |
| 测试目标 | 验证脚本不会处理台桌关联的开关（即 switch_label 存在于 table_device 中的开关） |
| 前置条件 | 智能省电开关已开启 |

**操作步骤：**

```bash
# 步骤1：确保智能省电开关开启
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE system_settings SET value='1' WHERE key='switch_auto_off_enabled';"

# 步骤2：查看现有 table_device 中的 switch_label 和 switch_seq
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT DISTINCT switch_label, switch_seq FROM table_device LIMIT 5;"

# 步骤3：选取一个已在 table_device 中的开关组合（例如 switch_label='tv', switch_seq='state_l1'）
# 确认它在 switch_device 中且在关灯时段内
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT switch_id, switch_seq, switch_label, auto_off_start, auto_off_end
   FROM switch_device
   WHERE switch_label='tv' AND switch_seq='state_l1';"

# 步骤4：执行脚本
cd /TG/tgservice && node scripts/auto-off-non-table-lights.js 2>&1

# 步骤5：检查日志
cat /TG/tgservice/scripts/auto-off-non-table-lights.log 2>/dev/null | tail -10
```

**预期结果：**
- 日志中**不包含** `tv | state_l1` 这个台桌关联开关
- 脚本只处理台桌无关的开关

---

### TC-006：混合场景——台桌无关和台桌关联开关同时存在

| 属性 | 内容 |
|------|------|
| 优先级 | **P1 重要** |
| 测试目标 | 验证脚本能正确区分台桌无关和台桌关联开关，只处理无关的 |
| 前置条件 | 智能省电开关已开启，两种开关数据均存在 |

**操作步骤：**

```bash
# 步骤1：确保智能省电开关开启
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE system_settings SET value='1' WHERE key='switch_auto_off_enabled';"

# 步骤2：插入台桌无关开关（不在 table_device 中）
sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT OR IGNORE INTO switch_device (switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, auto_on_start, auto_on_end, created_at, updated_at)
   VALUES ('0xQATEST_MIX_01', 'state_l1', 'QA_MIX_INDEP', '00:00', '23:59', '', '', datetime('now'), datetime('now'));"

# 步骤3：确认 QA_MIX_INDEP 不在 table_device 中
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT COUNT(*) FROM table_device WHERE switch_label='QA_MIX_INDEP';"
# 预期：返回 0

# 步骤4：插入台桌关联开关（在 table_device 中存在对应关系）
sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT OR IGNORE INTO switch_device (switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, auto_on_start, auto_on_end, created_at, updated_at)
   VALUES ('0xQATEST_MIX_02', 'state_l1', 'QA_MIX_TABLE', '00:00', '23:59', '', '', datetime('now'), datetime('now'));"

# 同时在 table_device 中建立关联
sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT OR IGNORE INTO table_device (table_name_en, switch_seq, switch_label, created_at, updated_at)
   VALUES ('qa_test_table', 'state_l1', 'QA_MIX_TABLE', datetime('now'), datetime('now'));"

# 步骤5：执行脚本
cd /TG/tgservice && node scripts/auto-off-non-table-lights.js 2>&1

# 步骤6：检查日志
cat /TG/tgservice/scripts/auto-off-non-table-lights.log 2>/dev/null | tail -10
```

**预期结果：**
- 日志中**包含** `QA_MIX_INDEP`（台桌无关）的处理记录
- 日志中**不包含** `QA_MIX_TABLE`（台桌关联）的处理记录
- 脚本正确区分两类开关

---

### TC-007：无台桌无关开关时脚本正常退出

| 属性 | 内容 |
|------|------|
| 优先级 | **P1 重要** |
| 测试目标 | 验证当没有台桌无关开关时脚本正常退出，不报错 |
| 前置条件 | 智能省电开关已开启 |

**操作步骤：**

```bash
# 步骤1：确保智能省电开关开启
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE system_settings SET value='1' WHERE key='switch_auto_off_enabled';"

# 步骤2：删除所有台桌无关的测试数据（保留台桌关联数据）
sqlite3 /TG/tgservice/db/tgservice.db \
  "DELETE FROM switch_device WHERE switch_label LIKE 'QA_%';"

# 步骤3：验证所有剩余 switch_label 都在 table_device 中
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT DISTINCT sd.switch_label
   FROM switch_device sd
   LEFT JOIN table_device td ON LOWER(sd.switch_label) = LOWER(td.switch_label) AND LOWER(sd.switch_seq) = LOWER(td.switch_seq)
   WHERE td.table_name_en IS NULL;"
# 预期：返回空或只有不应处理的记录

# 步骤4：执行脚本
cd /TG/tgservice && node scripts/auto-off-non-table-lights.js 2>&1

# 步骤5：检查日志
cat /TG/tgservice/scripts/auto-off-non-table-lights.log 2>/dev/null | tail -10
```

**预期结果：**
- 脚本正常退出（退出码 0）
- 日志显示"无台桌无关开关需要处理"或类似信息
- 无报错

---

### TC-008：自动关灯时段为空时开关不应被处理

| 属性 | 内容 |
|------|------|
| 优先级 | **P1 重要** |
| 测试目标 | 验证 auto_off_start 或 auto_off_end 为空的开关不会被处理 |
| 前置条件 | 智能省电开关已开启 |

**操作步骤：**

```bash
# 步骤1：确保智能省电开关开启
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE system_settings SET value='1' WHERE key='switch_auto_off_enabled';"

# 步骤2：插入 auto_off_start 和 auto_off_end 为空的台桌无关开关
sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT OR IGNORE INTO switch_device (switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, auto_on_start, auto_on_end, created_at, updated_at)
   VALUES ('0xQATEST_EMPTY_TIME', 'state_l1', 'QA_EMPTY_TIME', '', '', '', '', datetime('now'), datetime('now'));"

# 步骤3：确认不在 table_device 中
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT COUNT(*) FROM table_device WHERE switch_label='QA_EMPTY_TIME';"
# 预期：返回 0

# 步骤4：执行脚本
cd /TG/tgservice && node scripts/auto-off-non-table-lights.js 2>&1

# 步骤5：检查日志
cat /TG/tgservice/scripts/auto-off-non-table-lights.log 2>/dev/null | tail -10
```

**预期结果：**
- 日志中**不包含** `QA_EMPTY_TIME` 的处理记录
- 该开关因时段为空被排除

---

### TC-009：多个台桌无关开关批量关灯

| 属性 | 内容 |
|------|------|
| 优先级 | **P1 重要** |
| 测试目标 | 验证多个台桌无关开关同时符合关灯条件时，全部发送关灯指令 |
| 前置条件 | 智能省电开关已开启 |

**操作步骤：**

```bash
# 步骤1：确保智能省电开关开启
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE system_settings SET value='1' WHERE key='switch_auto_off_enabled';"

# 步骤2：插入多个台桌无关开关（均在关灯时段内，当前时间约10:30）
sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT OR IGNORE INTO switch_device (switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, auto_on_start, auto_on_end, created_at, updated_at)
   VALUES
     ('0xQATEST_BULK_01', 'state_l1', 'QA_BULK_01', '08:00', '14:00', '', '', datetime('now'), datetime('now')),
     ('0xQATEST_BULK_02', 'state_l1', 'QA_BULK_02', '08:00', '14:00', '', '', datetime('now'), datetime('now')),
     ('0xQATEST_BULK_03', 'state_l2', 'QA_BULK_03', '06:00', '18:00', '', '', datetime('now'), datetime('now'));"

# 步骤3：确认这些 label 不在 table_device 中
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT COUNT(*) FROM table_device WHERE switch_label IN ('QA_BULK_01','QA_BULK_02','QA_BULK_03');"
# 预期：返回 0

# 步骤4：执行脚本
cd /TG/tgservice && node scripts/auto-off-non-table-lights.js 2>&1

# 步骤5：检查日志
cat /TG/tgservice/scripts/auto-off-non-table-lights.log 2>/dev/null | tail -15
```

**预期结果：**
- 日志显示查询到 3 个台桌无关开关
- 日志显示向 3 个开关都发送了 OFF 指令
- 脚本正常退出

---

### TC-010：MQTT 配置读取验证

| 属性 | 内容 |
|------|------|
| 优先级 | **P1 重要** |
| 测试目标 | 验证脚本能正确读取 .config 文件中的 MQTT 配置 |
| 前置条件 | 脚本已存在 |

**操作步骤：**

```bash
# 步骤1：查看 .config 文件中的 MQTT 配置
cat /TG/tgservice/.config | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('mqtt',{}), indent=2))"

# 步骤2：开启智能省电开关
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE system_settings SET value='1' WHERE key='switch_auto_off_enabled';"

# 步骤3：确保有至少一个台桌无关开关在关灯时段内
sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT OR IGNORE INTO switch_device (switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, auto_on_start, auto_on_end, created_at, updated_at)
   VALUES ('0xQATEST_MQTT', 'state_l1', 'QA_MQTT_TEST', '00:00', '23:59', '', '', datetime('now'), datetime('now'));"

# 步骤4：执行脚本（测试环境应仅记录日志，不真实发送 MQTT）
cd /TG/tgservice && node scripts/auto-off-non-table-lights.js 2>&1

# 步骤5：检查日志中的 MQTT 相关输出
cat /TG/tgservice/scripts/auto-off-non-table-lights.log 2>/dev/null | grep -i "MQTT\|mqtt\|指令" | tail -10
```

**预期结果：**
- 日志中包含 MQTT 相关输出（测试环境显示"测试环境，跳过发送"或"指令已记录"）
- 无配置文件加载错误

---

### TC-011：脚本文件路径验证（测试环境）

| 属性 | 内容 |
|------|------|
| 优先级 | **P2 次要** |
| 测试目标 | 验证脚本在测试环境目录 /TG/tgservice/scripts/ 下可正常执行 |
| 前置条件 | 脚本已部署到测试环境 |

**操作步骤：**

```bash
# 步骤1：确认脚本文件存在
ls -la /TG/tgservice/scripts/auto-off-non-table-lights.js

# 步骤2：确认脚本有可执行权限
file /TG/tgservice/scripts/auto-off-non-table-lights.js

# 步骤3：执行脚本
cd /TG/tgservice && node scripts/auto-off-non-table-lights.js 2>&1

# 步骤4：检查日志文件是否生成在正确位置
ls -la /TG/tgservice/scripts/auto-off-non-table-lights.log 2>/dev/null
```

**预期结果：**
- 脚本文件存在
- 脚本可正常执行
- 日志文件生成在 `/TG/tgservice/scripts/` 目录下

---

### TC-012：SQL 查询结果去重验证

| 属性 | 内容 |
|------|------|
| 优先级 | **P2 次要** |
| 测试目标 | 验证脚本使用 DISTINCT 去重，同一开关不会被重复处理 |
| 前置条件 | 智能省电开关已开启 |

**操作步骤：**

```bash
# 步骤1：确保智能省电开关开启
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE system_settings SET value='1' WHERE key='switch_auto_off_enabled';"

# 步骤2：插入相同的开关数据（模拟重复数据场景）
sqlite3 /TG/tgservice/db/tgservice.db \
  "INSERT OR IGNORE INTO switch_device (switch_id, switch_seq, switch_label, auto_off_start, auto_off_end, auto_on_start, auto_on_end, created_at, updated_at)
   VALUES ('0xQATEST_DUP', 'state_l1', 'QA_DUP_TEST', '00:00', '23:59', '', '', datetime('now'), datetime('now'));"

# 步骤3：模拟验证 SQL 的去重效果
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT DISTINCT A.switch_id, A.switch_seq
   FROM switch_device A
   LEFT JOIN table_device B
     ON LOWER(A.switch_label) = LOWER(B.switch_label)
     AND LOWER(A.switch_seq) = LOWER(B.switch_seq)
   WHERE B.table_name_en IS NULL
     AND A.switch_label = 'QA_DUP_TEST'
     AND TIME('now', '+8 hours') BETWEEN TIME(A.auto_off_start) AND TIME(A.auto_off_end);"

# 步骤4：执行脚本
cd /TG/tgservice && node scripts/auto-off-non-table-lights.js 2>&1

# 步骤5：检查日志中该开关是否只被处理一次
cat /TG/tgservice/scripts/auto-off-non-table-lights.log 2>/dev/null | grep "QA_DUP_TEST" | wc -l
```

**预期结果：**
- SQL 查询结果去重，同一开关只出现一次
- 日志中该开关只被处理一次（只发送一次 MQTT 指令）

---

### TC-013：脚本退出码验证

| 属性 | 内容 |
|------|------|
| 优先级 | **P2 次要** |
| 测试目标 | 验证脚本在各种场景下的退出码均为 0（正常退出） |
| 前置条件 | 脚本已部署 |

**操作步骤：**

```bash
# 场景A：智能省电开关关闭
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE system_settings SET value='0' WHERE key='switch_auto_off_enabled';"
cd /TG/tgservice && node scripts/auto-off-non-table-lights.js 2>&1; echo "Exit code: $?"

# 场景B：智能省电开关开启，有台桌无关开关需处理
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE system_settings SET value='1' WHERE key='switch_auto_off_enabled';"
cd /TG/tgservice && node scripts/auto-off-non-table-lights.js 2>&1; echo "Exit code: $?"

# 场景C：智能省电开关开启，无台桌无关开关需处理
sqlite3 /TG/tgservice/db/tgservice.db \
  "DELETE FROM switch_device WHERE switch_label LIKE 'QA_%';"
cd /TG/tgservice && node scripts/auto-off-non-table-lights.js 2>&1; echo "Exit code: $?"
```

**预期结果：**
- 三种场景的退出码均为 `0`
- 无未捕获异常导致崩溃

---

## 测试数据清理

所有测试用例执行完毕后，清理测试数据：

```bash
# 清理所有 QA 测试数据
sqlite3 /TG/tgservice/db/tgservice.db \
  "DELETE FROM switch_device WHERE switch_label LIKE 'QA_%' OR switch_id LIKE '0xQATEST%';"

sqlite3 /TG/tgservice/db/tgservice.db \
  "DELETE FROM table_device WHERE table_name_en LIKE 'qa_%';"

# 恢复智能省电开关原始状态（按需）
sqlite3 /TG/tgservice/db/tgservice.db \
  "UPDATE system_settings SET value='0' WHERE key='switch_auto_off_enabled';"

# 验证清理结果
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT COUNT(*) FROM switch_device WHERE switch_label LIKE 'QA_%';"
sqlite3 /TG/tgservice/db/tgservice.db \
  "SELECT COUNT(*) FROM table_device WHERE table_name_en LIKE 'qa_%';"
```

---

## 测试执行记录

| 用例ID | 测试项 | 优先级 | 操作步骤 | 预期结果 | 实际结果 | 状态 |
|--------|--------|--------|----------|----------|----------|------|
| TC-001 | 智能省电开关关闭时脚本退出 | P0 | 见上方 | 脚本退出，不发指令 | ⏳待执行 | ⏭️跳过 |
| TC-002 | 台桌无关开关在关灯时段内 | P0 | 见上方 | 发送 MQTT OFF 指令 | ⏳待执行 | ⏭️跳过 |
| TC-003 | 台桌无关开关不在关灯时段内 | P0 | 见上方 | 不发指令 | ⏳待执行 | ⏭️跳过 |
| TC-004 | 跨午夜时段判断 | P0 | 见上方 | 不在时段内不发指令 | ⏳待执行 | ⏭️跳过 |
| TC-005 | 台桌关联开关不被处理 | P0 | 见上方 | 台桌关联开关不被处理 | ⏳待执行 | ⏭️跳过 |
| TC-006 | 混合场景：无关+关联开关 | P1 | 见上方 | 只处理无关开关 | ⏳待执行 | ⏭️跳过 |
| TC-007 | 无台桌无关开关时正常退出 | P1 | 见上方 | 正常退出无报错 | ⏳待执行 | ⏭️跳过 |
| TC-008 | 关灯时段为空时不处理 | P1 | 见上方 | 不发指令 | ⏳待执行 | ⏭️跳过 |
| TC-009 | 多个开关批量关灯 | P1 | 见上方 | 全部发送指令 | ⏳待执行 | ⏭️跳过 |
| TC-010 | MQTT 配置读取验证 | P1 | 见上方 | 配置读取正常 | ⏳待执行 | ⏭️跳过 |
| TC-011 | 脚本文件路径验证 | P2 | 见上方 | 脚本可执行 | ⏳待执行 | ⏭️跳过 |
| TC-012 | SQL 查询结果去重验证 | P2 | 见上方 | 同一开关只处理一次 | ⏳待执行 | ⏭️跳过 |
| TC-013 | 脚本退出码验证 | P2 | 见上方 | 退出码均为0 | ⏳待执行 | ⏭️跳过 |

---

## 优先级说明

| 优先级 | 数量 | 说明 |
|--------|------|------|
| **P0 核心** | 5 | 必须通过，覆盖核心功能：开关控制、台桌无关识别、时段判断、SQL JOIN 逻辑 |
| **P1 重要** | 5 | 重要功能：混合场景、空数据处理、时段为空、批量处理、配置读取 |
| **P2 次要** | 3 | 次要验证：路径、去重、退出码 |

---

## 备注

1. 测试环境为**测试模式**，MQTT 指令**仅写日志不真实发送**，通过日志确认即可
2. 测试数据使用 `QA_` 前缀，方便批量清理
3. 当前时间约 10:30（北京时间），所有时段设计以此为准
4. 脚本名称 `auto-off-non-table-lights.js` 为暂定，实际以开发者实现为准
5. 日志文件路径参考已有脚本模式：`/TG/tgservice/scripts/auto-off-non-table-lights.log`

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
脚本能正确查询台桌无关的开关，并在指定时间内发出关灯指令；受智能省电开关控制

## 输出要求
- 测试结果写入：/TG/temp/QA-20260417-07/test-results.md
- 格式：表格（用例ID、测试项、优先级、预期结果、实际结果、状态）
- 状态：✅通过 / ❌失败 / ⏭️跳过