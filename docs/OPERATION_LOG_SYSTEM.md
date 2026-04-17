# 操作日志系统文档

## 1. 系统概述

天宫国际系统采用双轨日志策略，确保所有用户操作可追溯：

| 日志类型 | 存储位置 | 写入条件 | 用途 |
|----------|----------|----------|------|
| 文件日志 | `logs/operation.log` | **始终写入** | 运维排查、审计追溯 |
| 数据库日志 | `operation_logs` 表 | `ENABLE_OPERATION_LOG=true` | 结构化查询、数据分析 |

---

## 2. 日志写入机制

### 2.1 核心服务

**文件路径**：`backend/services/operation-log.js`

```javascript
// Winston 文件日志器
const fileLogger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ message, timestamp }) => `[${timestamp}] ${message}`)
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/operation.log' })
  ]
});

// 无论开关状态，都写入文件日志
async function create(transaction, logData) {
  // ✅ 始终写入文件
  fileLogger.info(logMessage);
  
  // 数据库日志（受开关控制）
  if (ENABLE_OPERATION_LOG) {
    await transaction.run(...);
  }
}
```

### 2.2 调用方式

**方式一：通过事务调用（推荐）**

```javascript
await operationLogService.create(tx, {
  operator_phone: user.username,
  operator_name: user.name,
  operation_type: '水牌状态变更',
  target_type: 'water_board',
  target_id: waterBoard.id,
  old_value: JSON.stringify(oldValue),
  new_value: JSON.stringify(newValue),
  remark: `手动更新水牌状态：${oldValue.status} → ${newValue.status}`
});
```

**方式二：直接写入文件（无事务场景）**

```javascript
operationLogService.logToFile({
  operator_phone: user.username,
  operator_name: user.name,
  operation_type: '创建设备开关',
  target_type: 'switch_device',
  new_value: JSON.stringify({ switch_id, switch_label }),
  remark: `新增开关: ${switch_label}`
});
```

---

## 3. 日志覆盖范围

### 3.1 后端路由模块

| 路由文件 | 日志覆盖 | 主要操作 |
|----------|----------|----------|
| `applications.js` | ✅ 4处 | 加班/请假审批 |
| `coaches.js` | ✅ 7处 | 助教管理、上下班 |
| `guest-invitations.js` | ✅ 5处 | 约客管理 |
| `lejuan-records.js` | ✅ 3处 | 乐捐管理 |
| `service-orders.js` | ✅ 3处 | 服务单管理 |
| `switch-routes.js` | ✅ 14处 | 智能开关管理 |
| `table-action-orders.js` | ✅ 3处 | 上下桌单管理 |
| `water-boards.js` | ✅ 2处 | 水牌状态变更 |

### 3.2 server.js 内联日志（49处）

- 购物车操作
- 订单创建/完成/取消
- 助教登录/更新信息
- 短信发送
- 会员登录/注册
- 后台登录
- 用户管理（创建/更新/删除）
- 分类管理
- 商品管理
- 台桌管理
- 包房管理
- 黑名单管理
- 首页配置
- 短信配置

---

## 4. 日志文件位置

### 4.1 Docker 生产环境

| 环境 | 容器内路径 | 容器外路径 |
|------|------------|------------|
| 生产 | `/app/tgservice/logs/operation.log` | `/TG/run/logs/operation.log` |
| 测试 | `/TG/tgservice/logs/operation.log` | `/TG/tgservice/logs/operation.log` |

### 4.2 查看命令

```bash
# 查看最新日志
tail -f /TG/run/logs/operation.log

# 搜索特定操作
grep "水牌状态变更" /TG/run/logs/operation.log

# 查看今天的日志
grep "$(date +%Y-%m-%d)" /TG/run/logs/operation.log
```

---

## 5. 日志格式示例

```
[2026-04-17T07:19:06.471Z] [水牌状态变更] 操作人:tgadmin 目标:water_board#123 {"status":"早班空闲"} → {"status":"早加班"} 备注:手动更新水牌状态
[2026-04-17T07:12:15.123Z] [创建设备开关] 操作人:tgadmin 目标:switch_device#- {"switch_id":"SW001","switch_label":"VIP1"} → - 备注:新增开关: VIP1#1
[2026-04-17T07:08:22.456Z] [订单创建] TG1776393228148, 台桌: VIP7, 商品: 1件, 金额: 8, 钉钉通知成功
```

---

## 6. 历史问题与修复

### 6.1 问题（2026-04-17）

**现象**：水牌状态变更无日志记录，无法追溯谁手动设置了加班状态。

**原因**：
1. `operation-log.js` 默认关闭数据库日志（`ENABLE_OPERATION_LOG` 未设置）
2. 文件日志未写入（缺少 Winston 调用）

**影响**：21号、61号助教水牌被手动设为"早加班"，但无日志记录。

### 6.2 修复（2026-04-17）

**修改文件**：
- `backend/services/operation-log.js`：添加 Winston 文件日志，导出 `logToFile`
- `backend/routes/service-orders.js`：补充文件日志
- `backend/routes/switch-routes.js`：补充13个操作的文件日志

**修复原则**：
- 文件日志：**始终写入**（不受开关控制）
- 数据库日志：受 `ENABLE_OPERATION_LOG` 控制（减少 SQLite 锁竞争）

---

## 7. 最佳实践

### 7.1 添加新操作的日志

```javascript
// ✅ 正确做法
operationLogService.logToFile({
  operator_phone: user.username,
  operator_name: user.name,
  operation_type: '操作类型',
  target_type: '目标表名',
  target_id: recordId,
  old_value: JSON.stringify(oldData),
  new_value: JSON.stringify(newData),
  remark: '简要说明'
});
```

### 7.2 日志字段规范

| 字段 | 类型 | 说明 |
|------|------|------|
| `operator_phone` | string | 操作人用户名/手机号 |
| `operator_name` | string | 操作人姓名 |
| `operation_type` | string | 操作类型（中文） |
| `target_type` | string | 目标表名/模块名 |
| `target_id` | number/string | 目标记录ID |
| `old_value` | JSON | 操作前数据 |
| `new_value` | JSON | 操作后数据 |
| `remark` | string | 简要说明 |

---

_文档创建：2026-04-17_
_最后更新：2026-04-17_