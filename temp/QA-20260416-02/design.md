# QA-20260416-02: login-sms 返回完整 coachInfo

## 问题

`/api/member/login-sms` 返回的 `coachInfo` 只有 3 个字段（coachNo, stageName, level），
而加班申请页面 `overtime-apply.vue` 需要 `phone` 字段，导致报错"未获取到手机号信息"。

## 根因分析

**文件**: `/TG/tgservice/backend/server.js`
**接口**: `POST /api/member/login-sms`（第 1431 行）

对比参考实现 `/api/member/profile`（第 1747 行），发现：

| 对比项 | login-sms（当前） | profile（参考） |
|--------|-------------------|-----------------|
| SQL 查询字段 | `coach_no, stage_name, level`（3个） | `coach_no, employee_id, stage_name, phone, level, shift, status`（7个） |
| coachInfo 返回字段 | 4个（status 为 undefined） | 7个完整字段 |

## 修改方案

### 修改 1: SQL 查询增加字段

**位置**: 第 1492 行

```diff
- const coach = await dbGet('SELECT coach_no, stage_name, level FROM coaches WHERE phone = ? AND status != ?', [phone, '离职']);
+ const coach = await dbGet('SELECT coach_no, employee_id, stage_name, phone, level, shift, status FROM coaches WHERE phone = ? AND status != ?', [phone, '离职']);
```

### 修改 2: coachInfo 增加返回字段

**位置**: 第 1519-1524 行

```diff
  coachInfo: coach ? {
    coachNo: coach.coach_no,
+   employeeId: coach.employee_id,
    stageName: coach.stage_name,
+   phone: coach.phone,
    level: coach.level,
+   shift: coach.shift || '晚班',
    status: coach.status
  } : null
```

## 影响范围

- 只影响 `login-sms` 接口的返回值（增加字段）
- 向后兼容（新增字段，不影响已有调用方）
- 数据库连接：复用 `db/index.js` 现有连接 ✅
- 不涉及时间处理 ✅
- 不涉及数据库写入 ✅

## 测试验证

1. 用手机号调用 `POST /api/member/login-sms`
2. 验证返回 `coachInfo` 包含 7 个字段：
   - coachNo, employeeId, stageName, phone, level, shift, status
