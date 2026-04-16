# 修复方案：助教离店后水牌台桌号未清除

## 问题描述
助教状态变为非工作状态（休息/公休/请假/下班）时，`table_no` 字段没有被自动清空。

## 根因分析

逐个操作路径审查：

### 1. PUT /api/water-boards/:coach_no/status（water-boards.js）
- ✅ '下班' 时清除了 `clock_in_time`
- ❌ 所有 off-status（休息/公休/请假/下班）都**没有清除 `table_no`**
- ❌ '下班' 以外的 off-status（休息/公休/请假）没有清除 `clock_in_time`

### 2. applications.js 审批通过公休申请
- ✅ 更新了 status = '公休'
- ❌ **没有清除 `table_no`**
- ❌ **没有清除 `clock_in_time`**

### 3. coaches.js 批量修改班次 (PUT /batch-shift)
- 只做 working↔working 映射（早班空闲↔晚班空闲等）
- 不涉及 off-status 变更 → 本次不修改

### 4. coaches.js 单个修改班次 (PUT /:coach_no/shift)
- 同批量修改班次，只做 working↔working 映射
- 不涉及 off-status 变更 → 本次不修改

## 修复方案

### 修改点 1：water-boards.js — PUT /:coach_no/status

**位置**：状态更新 SQL 构建逻辑

**修改**：在构建 `updateFields` 时增加 off-state 清理逻辑：

```javascript
const offStatuses = ['下班', '休息', '公休', '请假'];
if (status && offStatuses.includes(status)) {
  // 状态变为非工作状态时，清除台桌号
  updateFields.push('table_no = NULL');
  // 下班状态额外清除签到时间
  if (status === '下班') {
    updateFields.push('clock_in_time = NULL');
  }
}
```

**注意**：如果 request body 同时传了 `table_no` 值（有意设置台桌号），
应尊重用户显式输入，不强制清除。因此需要先检查 `table_no !== undefined`。

### 修改点 2：applications.js — 审批通过公休申请

**位置**：approveStatus === 1 分支中，`公休申请` 的 water_boards 更新

**修改**：将：
```javascript
await tx.run(`
  UPDATE water_boards 
  SET status = ?, updated_at = ? 
  WHERE coach_no = ?
`, [newStatus, TimeUtil.nowDB(), coach.coach_no]);
```

改为：
```javascript
await tx.run(`
  UPDATE water_boards 
  SET status = ?, table_no = NULL, clock_in_time = NULL, updated_at = ? 
  WHERE coach_no = ?
`, [newStatus, TimeUtil.nowDB(), coach.coach_no]);
```

**同时修改** `newValue` 对象，将 `table_no` 改为 `null`。

## 修改文件清单

| 文件 | 修改点 | 变更内容 |
|------|--------|----------|
| `backend/routes/water-boards.js` | PUT /:coach_no/status | off-state 时清除 table_no；下班时清除 clock_in_time |
| `backend/routes/applications.js` | 审批通过公休申请 | 清除 table_no + clock_in_time |

## 编码规范检查

- ✅ 时间处理：使用 `TimeUtil.nowDB()`
- ✅ 数据库连接：复用 `../db` 模块
- ✅ 数据库写入：使用 `runInTransaction` 内 `tx.run()`
- ✅ 无新建数据库连接
- ✅ 无裸开事务
- ✅ code-style-check --git-only 全通过（0 违规）

## 实施结果

### Git 提交
- Commit: `ac5862c`
- 分支: master
- 已推送: ✅

### 修改详情

**water-boards.js** (2 处修改):
```diff
+ // 状态变为非工作状态且未显式设置台桌号时，清除台桌号
+ if (status && offStatuses.includes(status) && table_no === undefined) {
+   updateFields.push('table_no = NULL');
+ }

  const newValue = {
    status: status || currentWaterBoard.status,
-   table_no: table_no !== undefined ? table_no : currentWaterBoard.table_no
+   table_no: (table_no !== undefined) ? table_no : (status && offStatuses.includes(status) ? null : currentWaterBoard.table_no)
  };
```

**applications.js** (2 处修改):
```diff
  await tx.run(`
    UPDATE water_boards 
-   SET status = ?, updated_at = ? 
+   SET status = ?, table_no = NULL, clock_in_time = NULL, updated_at = ? 
    WHERE coach_no = ?
  `, [newStatus, TimeUtil.nowDB(), coach.coach_no]);

  const newValue = {
    status: newStatus,
-   table_no: currentWaterBoard.table_no
+   table_no: null
  };
```

### 业务逻辑说明

| 操作路径 | 原行为 | 修复后行为 |
|----------|--------|------------|
| 后台手动改状态为休息/公休/请假 | table_no 保留 | table_no → NULL |
| 后台手动改状态为下班 | clock_in_time → NULL, table_no 保留 | clock_in_time → NULL, table_no → NULL |
| 后台手动改状态时显式传 table_no | 按传入值设置 | 按传入值设置（尊重用户意图） |
| 审批通过公休申请 | table_no 保留 | table_no → NULL, clock_in_time → NULL |
| 批量修改班次 | 不修改 | 不修改（无 off-state 变更） |
| 单个修改班次 | 不修改 | 不修改（无 off-state 变更） |
