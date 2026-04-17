你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
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

**无**。脚本为独立运行，不修改现有后端代码、API 或数据库。

### 2.3 API 变更

**无**。本脚本为独立脚本，通过 cron 定时执行，不涉及 API 变更。

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
├─────────────────────────────────────────────────┤
│  2. 检查智能省电开关                              │
│     └─ SELECT value FROM system_settings         │
│        WHERE key = 'switch_auto_off_enabled'     │
│     └─ value != '1' → 打印日志，退出              │
├─────────────────────────────────────────────────┤
│  3. 查询台桌无关的关灯对象                        │
│     └─ SQL: LEFT JOIN table_device               │
│        WHERE B.台桌名 IS NULL                    │
│        AND 当前时间在自动关灯时段内               │
├─────────────────────────────────────────────────┤
│  4. 查询结果为空 → 打印日志，退出                  │
├─────────────────────────────────────────────────┤
│  5. 发送 MQTT 关灯指令                            │
│     └─ 复用 mqtt-switch.js 的 sendBatchCommand   │
├─────────────────────────────────────────────────┤
│  6. 输出执行结果并退出                            │
└─────────────────────────────────────────────────┘
```

### 3.2 核心 SQL

```sql
SELECT DISTINCT sd.switch_id, sd.switch_seq
FROM switch_device sd
LEFT JOIN table_device td 
  ON LOWER(sd.switch_label) = LOWER(td.switch_label) 
  AND LOWER(sd.switch_seq) = LOWER(td.switch_seq)
WHERE td.table_name_en IS NULL
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

**SQL 说明**：
- `LEFT JOIN table_device`：尝试匹配台桌设备关系
- `WHERE td.table_name_en IS NULL`：匹配不到的即为台桌无关开关
- 时间判断：复用 `auto-off-lighting.js` 的跨午夜逻辑（如 22:00~06:00）
- `TIME(?)` 参数由 `TimeUtil.nowDB()` 传入当前北京时间

### 3.3 模块依赖

| 模块 | 用途 |
|------|------|
| `../utils/time` | `TimeUtil.nowDB()` 获取当前北京时间 |
| `../db/index` | `get()` / `all()` 数据库读写（唯一连接） |
| `../services/mqtt-switch` | `sendBatchCommand()` 发送 MQTT 关灯指令 |

### 3.4 关键实现要点

#### 时间处理（编码规范 🔴）
```javascript
const TimeUtil = require('../utils/time');
const now = TimeUtil.nowDB();  // "2026-04-17 10:30:00"
```
**禁止**使用 `datetime('now')`、手动时区偏移。

#### 数据库连接（编码规范 🔴）
```javascript
const { all, get } = require('../db/index');
```
**禁止**使用 `new sqlite3.Database()`。

#### 数据库写入
本脚本**只有读取操作**（查询开关），不涉及数据库写入。发送关灯指令通过 MQTT，不写 DB。
（如后续需要记录执行日志，应使用 `enqueueRun()` 或 `runInTransaction()`）

### 3.5 测试/生产环境兼容

脚本通过读取 `.config` 文件中的 `env.name` 判断环境：
- **测试环境** (`env.name === 'test'`)：`mqtt-switch.js` 的 `sendBatchCommand` 会自动降级为只写日志、不发送真实 MQTT 指令
- **生产环境**：真实发送 MQTT 关灯指令

配置加载路径：
```javascript
const env = process.env.TGSERVICE_ENV || 'production';
const configPath = path.join(__dirname, '../../' + (env === 'test' ? '.config.env' : '.config'));
```

### 3.6 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 正常执行（含：功能未开启、无需要关的灯） |
| 1 | 执行异常（SQL 错误、MQTT 错误等） |

---

## 4. 边界情况和异常处理

### 4.1 智能省电开关未开启
- **现象**：`switch_auto_off_enabled` 值不为 `'1'`
- **处理**：打印 `[自动关灯-台桌无关] 功能未开启，跳过`，正常退出（exit 0）

### 4.2 没有台桌无关的开关在时段内
- **现象**：SQL 查询结果为空
- **处理**：打印 `[自动关灯-台桌无关] 无需要关的灯`，正常退出（exit 0）

### 4.3 开关的自动关灯时段为空
- **处理**：SQL 中已有 `auto_off_start != '' AND auto_off_end != ''` 过滤条件，自动排除

### 4.4 跨午夜时段（如 22:00~06:00）
- **处理**：SQL 使用 CASE WHEN 判断，`auto_off_start > auto_off_end` 时用 OR 连接条件
- 与现有 `auto-off-lighting.js` 逻辑一致

### 4.5 MQTT 客户端不可用
- **处理**：`mqtt-switch.js` 的 `sendBatchCommand` 会返回失败列表，脚本打印失败详情后正常退出
- 单个开关发送失败不影响其他开关

### 4.6 数据库连接失败
- **处理**：`db/index.js` 连接失败时会在控制台打印错误，脚本捕获异常后打印错误日志并 exit 1

### 4.7 配置文件缺失
- **处理**：`mqtt-switch.js` 已处理配置加载失败的情况，会打印警告并跳过真实 MQTT 发送

### 4.8 重复执行
- **说明**：脚本每次执行都是独立的全量扫描，无状态依赖
- 重复执行不会产生副作用（已关的灯再次发送 OFF 指令无影响）

### 4.9 脚本执行时 MQTT broker 断开
- **处理**：`mqtt-switch.js` 的 `getClient()` 有重连机制和 15s 超时保护
- 超时后返回失败，脚本记录失败详情

---

## 5. 定时调度方案

### 5.1 推荐方案：Crontab

在容器内通过 crontab 定时执行：

```bash
# 生产环境 Docker 容器内 crontab 配置
# 每 10 分钟执行一次
*/10 * * * * cd /app/tgservice && node scripts/auto-off-table-independent.js >> logs/auto-off-independent.log 2>&1
```

### 5.2 替代方案：Docker CMD 多进程

在 `docker-entrypoint.sh` 中同时启动后端服务和定时脚本：

```bash
# docker-entrypoint.sh 中追加
(while true; do 
  cd /app/tgservice && node scripts/auto-off-table-independent.js >> logs/auto-off-independent.log 2>&1
  sleep 600  # 每 10 分钟
done) &
```

### 5.3 调度频率建议
- 建议 **每 10 分钟** 执行一次
- 与现有 `sync/tables` 的自动关灯频率协调（`sync/tables` 更新 >=40 条时触发）
- 台桌无关开关没有状态变化驱动，需要定时轮询

---

## 6. 脚本代码结构

```
auto-off-table-independent.js
├── 配置加载（.config 文件）
├── 模块导入
│   ├── TimeUtil（时间处理）
│   ├── db/index（数据库连接）
│   └── mqtt-switch（MQTT 指令）
├── main()
│   ├── Step 1: 检查智能省电开关
│   ├── Step 2: 查询台桌无关关灯对象
│   ├── Step 3: 发送关灯指令
│   └── Step 4: 输出结果
└── 错误处理（try-catch）
```

---

## 7. 与现有自动关灯的关系

| 维度 | 台桌相关自动关灯 | 台桌无关自动关灯（新增） |
|------|------------------|--------------------------|
| 触发方式 | sync/tables 接口触发 | cron 定时触发 |
| 开关筛选 | 关联台桌 + 空闲状态 + 时段内 | 不关联任何台桌 + 时段内 |
| 共用组件 | mqtt-switch.js | mqtt-switch.js |
| 共用开关控制 | switch_auto_off_enabled | switch_auto_off_enabled |
| 共用时间逻辑 | CASE WHEN 跨午夜 | CASE WHEN 跨午夜 |

---

## 8. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| MQTT 发送失败 | 部分灯未关闭 | 返回失败列表，日志可追溯 |
| 数据库查询慢 | 脚本执行超时 | 查询仅涉及两张表 + DISTINCT，数据量小 |
| 时段配置错误 | 不该关的灯被关 | SQL 严格匹配 time range，支持测试环境验证 |
| cron 未配置 | 脚本不执行 | 部署时需确认 crontab 配置 |

---

## 9. 测试验证方案

### 9.1 测试环境验证步骤
1. 在测试环境部署脚本
2. 确认 `switch_auto_off_enabled = '1'`
3. 在 `switch_device` 表中确保有台桌无关的开关且处于关灯时段内
4. 手动执行脚本：`cd /TG/tgservice && node scripts/auto-off-table-independent.js`
5. 检查日志输出：
   - 查询到的开关数量和 ID
   - MQTT 指令发送结果（测试环境只写日志）
6. 验证关闭开关后再次执行不重复发送

### 9.2 预期日志输出
```
[自动关灯-台桌无关] ========== 开始执行 ==========
[自动关灯-台桌无关] 智能省电开关：已开启
[自动关灯-台桌无关] 当前时间: 2026-04-17 10:30:00
[自动关灯-台桌无关] 查询到台桌无关开关 3 个: 0xabc1 l1, 0xabc1 l2, 0xdef2 l1
[自动关灯-台桌无关] 批量发送结果: 成功 3/3
[自动关灯-台桌无关] ========== 执行完毕 ==========
```

---

## 10. 部署检查清单

- [ ] 脚本文件已添加到 `/TG/tgservice/scripts/`
- [ ] 代码规范检查通过（TimeUtil、db/index、无裸事务）
- [ ] 测试环境手动执行验证通过
- [ ] Docker 构建后脚本包含在 `/app/tgservice/scripts/`
- [ ] 生产环境 crontab 配置完成
- [ ] 生产环境首次执行验证通过

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