你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
```
# 编码规范修复设计方案 — 时间处理违规修复

**QA编号**: QA-20260418-03  
**日期**: 2026-04-18  
**负责人**: 程序员A  

---

## 问题概述

编码规范检查发现 6 个文件共 12 处 TIME 规则违规（时间处理不规范）。

| 文件 | 违规数 | 违规类型 |
|------|--------|----------|
| server.js | 4 | `new Date().toISOString()` |
| cashier-dashboard.html | 2 | `new Date().toISOString()` |
| reward-penalty-stats.html | 3 | `toISOString().slice(0, 7)` |
| vip-rooms.html | 1 | `new Date().toISOString()` |
| test-coding-rules.js | 1 | 测试文件，可豁免 |
| time-util.js | 1 | 工具类注释，可豁免 |

**根因分析**:  
`toISOString()` 返回 UTC 时间（零时区），而服务器容器时区为 Asia/Shanghai（UTC+8）。
- 北京时间凌晨 1:00 → `toISOString()` 输出 `17:00 UTC`（前一天）
- 导致日期/月份/年份可能偏移，日志时间不准确

---

## 修复策略

### 1. 后端 server.js（4 处）

**文件**: `/TG/tgservice/backend/server.js`  
**状态**: 已引入 `TimeUtil`（L6）

| 行号 | 原代码 | 修复方案 |
|------|--------|----------|
| L404 | `new Date().toISOString()` | `TimeUtil.nowDB()` |
| L4903 | `new Date().toISOString()` | `TimeUtil.nowDB()` |
| L4936 | `new Date().toISOString()` | `TimeUtil.nowDB()` |
| L4964 | `new Date().toISOString()` | `TimeUtil.nowDB()` |

**说明**: 这 4 处都是生成日志/健康检查的 timestamp 字段，`TimeUtil.nowDB()` 返回 `"YYYY-MM-DD HH:MM:SS"` 北京时间，完全适用。

### 2. 前端 admin/ 文件（6 处）

**核心思路**: 在 `admin/js/time-util.js` 中新增两个工具函数，前端页面统一调用。

#### 2.1 新增工具函数

**文件**: `/TG/tgservice/admin/js/time-util.js`

```javascript
/**
 * 生成当前北京时间的完整时间字符串
 * 返回: "2026-04-18 22:45:00"
 */
nowDB() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
},

/**
 * 获取当前北京时间的年月
 * 返回: "2026-04"
 */
getBeijingMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
},
```

**注意**: `new Date()` 在容器时区为 Asia/Shanghai 下就是北京时间，直接取本地时间分量即可。

#### 2.2 cashier-dashboard.html（2 处）

**文件**: `/TG/tgservice/admin/cashier-dashboard.html`  
**状态**: 已引入 time-util.js（L295），已使用 TimeUtil

| 行号 | 原代码 | 修复方案 |
|------|--------|----------|
| L352 | `new Date().toISOString()` | `TimeUtil.nowDB()` |
| L506 | `new Date().toISOString()` | `TimeUtil.nowDB()` |

#### 2.3 reward-penalty-stats.html（3 处）

**文件**: `/TG/tgservice/admin/reward-penalty-stats.html`  
**状态**: 已引入 time-util.js（L203），未使用 TimeUtil 函数

| 行号 | 原代码 | 修复方案 |
|------|--------|----------|
| L241 | `now.toISOString().slice(0, 7)` | `TimeUtil.getBeijingMonth()` |
| L257 | `now.toISOString().slice(0, 7)` | `TimeUtil.getBeijingMonth()` |
| L260 | `last.toISOString().slice(0, 7)` | 计算上月: `getPrevMonth()` |

**上月计算**: 新增 `TimeUtil.getPrevMonth()` 函数，或内联处理：
```javascript
// 上月 = 当前月往前推1个月
const d = new Date();
d.setMonth(d.getMonth() - 1);
currentMonth = TimeUtil.getBeijingMonth.call({ d }); // 或独立函数
```

更简洁方案：新增 `TimeUtil.getPrevBeijingMonth()` 函数。

#### 2.4 vip-rooms.html（1 处）

**文件**: `/TG/tgservice/admin/vip-rooms.html`  
**状态**: 未引入 time-util.js

| 行号 | 原代码 | 修复方案 |
|------|--------|----------|
| L298 | `new Date().toISOString()` | `TimeUtil.nowDB()` |

**操作**: 
1. 添加 `<script src="js/time-util.js"></script>`
2. 替换 `new Date().toISOString()` → `TimeUtil.nowDB()`

### 3. 豁免文件（2 处）

- **test-coding-rules.js**: 测试脚本中的正则表达式匹配模式，非运行时时间处理，**豁免**
- **time-util.js（注释）**: 工具类文档注释中的示例代码，非运行时，**豁免**

**处理方式**: 将这两个文件加入编码规范检查脚本的豁免列表。

---

## 验收标准

运行 `node ~/.openclaw/workspace_coder-tg/skills/code-style-check/scripts/check-style.js` 返回退出码 0（无违规）。

---

## 风险说明

1. **TimeUtil.nowDB() 格式变更**: `toISOString()` 返回 ISO 8601 格式（如 `"2026-04-18T14:45:00.000Z"`），`TimeUtil.nowDB()` 返回 `"2026-04-18 22:45:00"`。所有使用处都是日志记录/错误上报，不影响功能。
2. **reward-penalty-stats.html 上月计算**: 需确保跨年场景正确（1月→上年12月）。
3. **vip-rooms.html 新增 script 标签**: 需确认 js/time-util.js 路径正确。

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