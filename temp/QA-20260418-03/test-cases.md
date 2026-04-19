# API 测试用例 - 修复时间处理违规（12处）

**QA编号**: QA-20260418-03  
**测试类型**: 回归测试（代码重构）  
**测试地址**: `http://127.0.0.1:8088`  
**测试策略**: 仅 API/curl 测试，无需浏览器测试  

---

## 验收标准

| # | 验收项 | 通过条件 |
|---|--------|----------|
| AC-1 | 编码规范检查脚本返回 0 违规 | 排除豁免文件后，无 TIME 规则违规 |
| AC-2 | 被修改的 API 接口仍正常工作 | 所有健康检查用例返回 HTTP 200 |

---

## 第一部分：编码规范检查（核心验收）

### TC-01: 编码规范检查 - 全量扫描

**目的**: 验证修复后 TIME 规则违规数为 0（排除豁免文件）

**执行步骤**:
```bash
node ~/.openclaw/workspace_coder-tg/skills/code-style-check/scripts/check-style.js
echo "EXIT_CODE=$?"
```

**预期结果**:
- 输出中 TIME 规则：`通过文件 = 85`（或更高），`失败文件 = 0`，`违规数 = 0`
- 或显示 `🎉 全部通过！所有文件符合编码规范。`
- 退出码 = `0`

**豁免文件说明**（不计入违规统计）:
- `test-coding-rules.js`: 测试文件，豁免
- `time-util.js`: 时间工具类文件，豁免

**通过条件**: 
- 若 report 显示 TIME 规则失败文件=0、违规数=0，则通过
- 若仅有豁免文件出现在失败列表，仍视为通过

---

### TC-02: 编码规范检查 - Git 变更模式

**目的**: 验证 `--git-only` 模式无违规

**执行步骤**:
```bash
node ~/.openclaw/workspace_coder-tg/skills/code-style-check/scripts/check-style.js --git-only
echo "EXIT_CODE=$?"
```

**预期结果**:
- 退出码 = `0`
- 或显示 `ℹ️ 没有找到需要检查的文件。`（当天无 git 提交）

**通过条件**: `EXIT_CODE=0`

---

## 第二部分：API 健康检查（回归验证）

> 以下 API 接口涉及被修复的代码行，需确保修复后仍正常工作。

### TC-10: 健康检查接口

**目的**: 验证 `/api/health` 接口正常返回

**关联违规**: `server.js` 第 404 行（如有）

**执行步骤**:
```bash
curl -s -w "\nHTTP_CODE=%{http_code}" http://127.0.0.1:8088/api/health
```

**预期结果**:
- HTTP 状态码 = `200`
- 响应包含 `"status": "ok"`
- 响应包含 `timestamp` 字段

**通过条件**: `HTTP_CODE=200` 且 JSON 含 status 字段

---

### TC-11: 后端服务整体状态

**目的**: 确认后端服务运行正常，响应时间合理

**执行步骤**:
```bash
curl -s -o /dev/null -w "HTTP_CODE=%{http_code}\nTIME_TOTAL=%{time_total}s\n" \
  http://127.0.0.1:8088/api/health
```

**预期结果**:
- HTTP 状态码 = `200`
- 响应时间 < 5 秒

**通过条件**: `HTTP_CODE=200` 且 `TIME_TOTAL < 5`

---

### TC-12: 奖罚类型接口

**目的**: 验证 `/api/admin/reward-penalty/types` 接口正常（reward-penalty-stats.html 页面依赖）

**关联违规**: `reward-penalty-stats.html` 第 241/257/260 行

**前置条件**: 需登录认证

**执行步骤**:
```bash
# Step 1: 登录获取 token
LOGIN_RESP=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}')

TOKEN=$(echo "$LOGIN_RESP" | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"$//')

# Step 2: 获取奖罚类型
curl -s -w "\nHTTP_CODE=%{http_code}" \
  http://127.0.0.1:8088/api/admin/reward-penalty/types \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**:
- 登录成功，获取 token
- 奖罚类型接口 HTTP 状态码 = `200`
- 响应包含 `types` 或 `success` 字段

**通过条件**: `HTTP_CODE=200`

---

### TC-13: 奖罚统计摘要接口

**目的**: 验证 `/api/reward-penalty/stats/summary` 接口正常（时间处理相关）

**前置条件**: 需登录认证

**执行步骤**:
```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"$//')

curl -s -w "\nHTTP_CODE=%{http_code}" \
  http://127.0.0.1:8088/api/reward-penalty/stats/summary \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**:
- HTTP 状态码 = `200`
- 响应为有效 JSON

**通过条件**: `HTTP_CODE=200`

---

### TC-14: VIP房间上传错误日志接口

**目的**: 验证 `/api/upload-error` 接口正常（vip-rooms.html 依赖）

**关联违规**: `vip-rooms.html` 第 298 行

**执行步骤**:
```bash
curl -s -w "\nHTTP_CODE=%{http_code}" \
  -X POST http://127.0.0.1:8088/api/upload-error \
  -H "Content-Type: application/json" \
  -d '{"errorType":"test_type","errorMessage":"test message","timestamp":"2026-04-18T22:00:00Z"}'
```

**预期结果**:
- HTTP 状态码 = `200` 或 `401`（需认证）
- 返回有效 JSON 响应

**通过条件**: `HTTP_CODE=200` 或 `HTTP_CODE=401`（接口存在且响应正常）

---

### TC-15: 时间字段格式验证（可选）

**目的**: 确认修复后时间字段格式正确（北京时间而非 UTC）

**执行步骤**:
```bash
RESP=$(curl -s http://127.0.0.1:8088/api/health)
echo "$RESP"

# 检查 timestamp 格式
# 若使用 TimeUtil.nowDB() 应为 "YYYY-MM-DD HH:MM:SS"
# 若使用 getBeijingDate() 应为 "YYYY-MM-DD"
echo "timestamp 字段: $(echo "$RESP" | grep -o '"timestamp":"[^"]*"')"
```

**预期结果**:
- timestamp 字段存在且非空
- 格式正确（北京时间格式或 ISO 格式均可，但不应出现 UTC 时区偏移错误）

**通过条件**: timestamp 字段存在

---

## 测试执行顺序

```
1. TC-01（编码规范检查 - 全量） ← 核心验收
2. TC-02（编码规范检查 - Git模式）
   ↓ 全部通过后
3. TC-10 ~ TC-15（API 健康检查）
```

---

## 测试结果记录模板

| 用例编号 | 用例名称 | 执行状态 | HTTP状态码 | 备注 |
|----------|----------|----------|------------|------|
| TC-01 | 编码规范检查-全量 | ⬜ 待执行 | - | 核心验收项 |
| TC-02 | 编码规范检查-Git模式 | ⬜ 待执行 | - | |
| TC-10 | /api/health | ⬜ 待执行 | - | |
| TC-11 | 服务整体状态 | ⬜ 待执行 | - | |
| TC-12 | /api/admin/reward-penalty/types | ⬜ 待执行 | - | |
| TC-13 | /api/reward-penalty/stats/summary | ⬜ 待执行 | - | |
| TC-14 | /api/upload-error | ⬜ 待执行 | - | |
| TC-15 | 时间字段格式验证 | ⬜ 待执行 | - | 可选 |

---

## 附：12处违规详情对照表

根据需求描述，原始违规分布：

| # | 文件 | 原违规数 | 违规类型 | 豁免状态 |
|---|------|----------|----------|----------|
| 1 | `server.js` | 4 | `new Date().toISOString()` | 已修复 |
| 2 | `cashier-dashboard.html` | 2 | `new Date().toISOString()` | 已修复 |
| 3 | `reward-penalty-stats.html` | 3 | `toISOString().slice()` | 待修复 |
| 4 | `vip-rooms.html` | 1 | `new Date().toISOString()` | 待修复 |
| 5 | `test-coding-rules.js` | 1 | `new Date().toISOString()` | **豁免**（测试文件） |
| 6 | `time-util.js` | 1 | `new Date().toISOString()` | **豁免**（工具类） |

**验收关键**: 修复后，编码规范检查脚本应返回 TIME 规则违规数 = 0（排除豁免文件）。

---

## 快速执行脚本

```bash
#!/bin/bash
# 快速执行所有测试用例

echo "=== TC-01: 编码规范检查 ==="
node ~/.openclaw/workspace_coder-tg/skills/code-style-check/scripts/check-style.js 2>&1 | tail -30
echo ""

echo "=== TC-10: 健康检查 ==="
curl -s -w "\nHTTP: %{http_code}\n" http://127.0.0.1:8088/api/health
echo ""

echo "=== TC-12: 奖罚类型（需登录） ==="
TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"$//')
curl -s -w "\nHTTP: %{http_code}\n" \
  http://127.0.0.1:8088/api/admin/reward-penalty/types \
  -H "Authorization: Bearer $TOKEN"
echo ""

echo "=== 测试完成 ==="
```