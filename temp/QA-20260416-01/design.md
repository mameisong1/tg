# 设计方案：申请提交接口 status 变量未定义 Bug 修复

## 问题概述

**文件**: `/TG/tgservice/backend/routes/applications.js`  
**错误**: `ReferenceError: status is not defined`  
**影响**: 所有通过 POST `/api/applications` 提交的申请均失败（500 错误）

## 根因分析

提交 `bb4d5bc`（2026-04-15）清理「乐捐报备」代码时，误删了以下代码段：

```javascript
let status = 0;
if (application_type === '乐捐报备') {
  status = 1;
}
```

由于 `乐捐报备` 已从 `validTypes` 列表中移除，if 分支不再需要。但 INSERT 语句和 operationLogService 中仍引用 `status` 变量，导致 `ReferenceError`。

## 代码分析

### 当前代码结构（POST `/api/applications`）

```
第32行: 解构 req.body
第38行: 必填字段验证
第41行: validTypes 定义（不含乐捐报备）
第46行: validTypes 验证
第50行: INSERT INTO applications（使用 status 变量）← 报错点
第68行: operationLogService.create（使用 status 变量）
第75行: return { id, status }
```

### 引用 `status` 的位置

| 位置 | 代码片段 | 行号 |
|------|----------|------|
| INSERT VALUES | `status` | ~58 |
| operationLogService.new_value | `status === 0 ? '待处理' : '有效'` | ~73 |
| 返回值 | `status` | ~75 |

## 修复方案

### 方案：在 validTypes 验证后、INSERT 前定义 status 变量

```javascript
// 在 validTypes.includes 验证之后、INSERT 语句之前添加：
const status = 0; // 新申请状态为待处理
```

### 为什么是 `0`？

- `0` = 待处理（新提交的申请默认状态）
- `1` = 已同意（审批通过后）
- `2` = 已拒绝（审批拒绝后）

所有新申请提交时状态均为待处理（`0`），这是业务逻辑决定的。

### 修复后代码位置

```javascript
// 第46行: validTypes 验证
if (!validTypes.includes(application_type)) {
  throw { status: 400, error: '无效的申请类型' };
}

// ✅ 新增：定义 status 变量
const status = 0; // 新申请状态为待处理

// 第50行: INSERT 语句（正常使用 status）
const insertResult = await tx.run(`INSERT INTO applications ...`, [..., status, ...]);
```

## 风险评估

- **风险等级**: 低
- **影响范围**: 仅修复 bug，不改变业务逻辑
- **回归风险**: 无（原逻辑就是 status=0）
- **兼容性**: 完全兼容

## 测试建议

1. 提交一个早加班申请 → 验证 status 字段值为 0
2. 提交一个约客记录 → 验证 status 字段值为 0
3. 查看申请列表 → 验证新申请状态显示为「待处理」
