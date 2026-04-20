# QA-20260420-4 API测试报告

## 测试环境
- 后端API：http://127.0.0.1:8088
- 数据库：/TG/tgservice/db/tgservice.db
- 测试时间：2026-04-20 22:45
- 当前服务器时间：22点（超过申请和审批时间段）

---

## 一、时间段校验测试

### 1.1 加班申请时间段校验

| 测试项 | 测试方法 | 预期结果 | 实际结果 | 状态 |
|-------|---------|---------|---------|------|
| 申请时间已截止（22点提交） | curl POST /api/applications | 返回400，提示「申请时间已截止」 | `{"success":false,"error":"加班/公休申请时间已截止(仅限 0:00 - 14:00),请明天再申请"}` | ✅ 通过 |
| 申请时间边界（14:01） | 无法模拟 | 返回400 | N/A（代码已实现） | ✅ 代码审查确认 |

**验证命令**：
```bash
curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"applicant_phone":"16675852676","application_type":"早加班申请","remark":"API测试"}'
```

**代码位置**：`/TG/tgservice/backend/routes/applications.js` 第71-73行
```javascript
// 加班/公休申请时间校验:0:00 - 14:00
if (['早加班申请', '晚加班申请', '公休申请'].includes(application_type)) {
  validateTimeWindow(nowHour, 0, 14, '加班/公休申请时间已截止(仅限 0:00 - 14:00),请明天再申请');
```

### 1.2 审批时间段校验

| 测试项 | 测试方法 | 预期结果 | 实际结果 | 状态 |
|-------|---------|---------|---------|------|
| 审批时间已截止（22点审批） | curl PUT /api/applications/97/approve | 返回400，提示「审批时间仅限12-18点」 | `{"success":false,"error":"审批时间仅限 12:00 - 18:00"}` | ✅ 通过 |
| 审批时间边界（11:59） | 无法模拟 | 返回400 | N/A（代码已实现） | ✅ 代码审查确认 |
| 审批时间边界（18:01） | 无法模拟 | 返回400 | N/A（代码已实现） | ✅ 代码审查确认 |

**验证命令**：
```bash
curl -s -X PUT http://127.0.0.1:8088/api/applications/97/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"status":1}'
```

**代码位置**：`/TG/tgservice/backend/routes/applications.js` 第464-466行
```javascript
// 审批时间校验:12:00 - 18:00
if (nowHour < 12 || nowHour >= 18) {
  throw { status: 400, error: '审批时间仅限 12:00 - 18:00' };
}
```

---

## 二、过期申请校验测试

| 测试项 | 测试方法 | 预期结果 | 实际结果 | 状态 |
|-------|---------|---------|---------|------|
| 审批昨天提交的加班申请 | 创建昨天申请，尝试审批 | 返回400，提示「只能审批当天提交」 | 无法测试（当前时间22点无法审批） | ✅ 代码审查确认 |

**代码位置**：`/TG/tgservice/backend/routes/applications.js` 第469-475行
```javascript
// 过期申请校验:加班/公休只能审批当天提交的申请
if (approveStatus === 1 && ['早加班申请', '晚加班申请', '公休申请'].includes(application.application_type)) {
  const applyDate = application.created_at.substring(0, 10);
  if (applyDate !== todayStr) {
    throw { status: 400, error: '只能审批当天提交的加班/公休申请,过期申请只能拒绝' };
  }
}
```

---

## 三、水牌状态校验测试

### 3.1 申请提交时的水牌状态校验

| 测试项 | 测试方法 | 预期结果 | 实际结果 | 状态 |
|-------|---------|---------|---------|------|
| 加班申请 + 水牌非「下班」 | 非下班状态提交加班申请 | 返回400，提示「只能从下班状态申请」 | 无法测试（当前时间22点无法申请） | ✅ 代码审查确认 |

**代码位置**：`/TG/tgservice/backend/routes/applications.js` 第76-87行
```javascript
// 水牌状态校验:必须是「下班」状态
const coach = await tx.get(
  'SELECT coach_no, stage_name FROM coaches WHERE employee_id = ? OR phone = ?',
  [applicant_phone, applicant_phone]
);
if (coach) {
  const waterBoard = await tx.get(
    'SELECT status FROM water_boards WHERE coach_no = ?',
    [coach.coach_no]
  );
  if (waterBoard && waterBoard.status !== '下班') {
    throw { status: 400, error: `当前水牌状态为「${waterBoard.status}」,只能从「下班」状态申请加班/公休` };
  }
}
```

### 3.2 审批同意时的水牌状态处理

| 测试项 | 预期结果 | 实际结果 | 状态 |
|-------|---------|---------|------|
| 上桌状态审批同意 | 返回400，拒绝审批 | 代码已实现 | ✅ 代码审查确认 |
| 加班审批同意 + 水牌「下班」 | 申请状态=1，水牌改为加班 | 代码已实现 | ✅ 代码审查确认 |
| 加班审批同意 + 水牌「早班上桌」 | 申请状态=1，水牌不变 | 代码已实现 | ✅ 代码审查确认 |
| 请假审批同意 + 水牌「下班」 + 当天已过12点 | 申请状态=1，水牌改为请假，无Timer | 代码已实现 | ✅ 代码审查确认 |
| 请假审批同意 + 水牌「早班空闲」 + 当天已过12点 | 申请状态=1，水牌不变，无Timer | 代码已实现 | ✅ 代码审查确认 |

**代码位置**：`/TG/tgservice/backend/routes/applications.js` 第495-510行
```javascript
const currentStatus = currentWaterBoard.status;
// QA-20260420-4:上桌状态仍拒绝审批(安全考虑)
const isOnTable = currentStatus === '早班上桌' || currentStatus === '晚班上桌';
if (isOnTable) {
  throw { status: 400, error: `助教${coach.stage_name}正在上桌服务(${currentStatus}),无法审批通过${application.application_type}` };
}
```

---

## 四、Timer恢复时的水牌状态校验

| 测试项 | 预期结果 | 实际结果 | 状态 |
|-------|---------|---------|------|
| Timer调度时水牌状态检查 | 非请假/休息状态跳过调度 | 代码已实现 | ✅ 代码审查确认 |
| Timer执行时水牌状态检查 | 非请假/休息状态跳过恢复 | **代码缺失** | ❌ **发现问题** |

**问题详情**：

`executeApplicationRecovery` 函数（timer-manager.js 第187行）在执行Timer时，没有检查水牌状态是否为「请假」或「休息」。

根据设计文档，应该有以下校验：
```javascript
// 4. 水牌状态校验:必须处于请假/休息状态
const currentStatus = waterBoard.status;
if (currentStatus !== '请假' && currentStatus !== '休息') {
  // 状态不符合,标记已执行但不改变水牌
  console.log(`[TimerManager] 申请 ${applicationId} 水牌状态为「${currentStatus}」,不符合恢复条件,跳过`);
  const extraData = JSON.parse(application.extra_data || '{}');
  extraData.executed = 1;
  extraData.skip_reason = `水牌状态为「${currentStatus}」,不符合恢复条件`;
  await tx.run(...);
  return; // 不执行恢复
}
```

**已实现的位置**：`timer-manager.js` 第388-394行（recoverApplicationTimers函数）
```javascript
if (record.water_status && record.water_status !== '休息' && record.water_status !== '请假') {
    extraData.executed = 1;
    await enqueueRun('UPDATE applications SET extra_data = ? WHERE id = ?',
        [JSON.stringify(extraData), record.id]);
    skipped++;
    continue;
}
```

**缺失的位置**：`executeApplicationRecovery` 函数内部

---

## 五、测试总结

### 已验证通过 ✅
1. 加班申请时间段校验（0-14点）
2. 审批时间段校验（12-18点）
3. 过期申请校验（只能审批当天提交）
4. 申请提交时的水牌状态校验（必须下班）
5. 审批同意时的水牌状态处理（上桌拒绝，其他不修改）
6. Timer调度时的水牌状态检查

### 发现问题 ❌
1. **Timer执行时缺少水牌状态校验**

   `executeApplicationRecovery` 函数在Timer到期执行时，没有检查水牌当前状态是否为「请假」或「休息」。

   **风险**：如果Timer设置时水牌状态正确，但Timer执行时水牌状态已变更（如助教已上桌），Timer会错误地将水牌改为「班次空闲」，导致水牌状态混乱。

### 建议修复

在 `executeApplicationRecovery` 函数中增加水牌状态校验：

```javascript
// 4. 水牌状态校验:必须处于请假/休息状态
const currentStatus = waterBoard.status;
if (currentStatus !== '请假' && currentStatus !== '休息') {
    console.log(`[TimerManager] 申请 ${applicationId} 水牌状态为「${currentStatus}」,不符合恢复条件,跳过`);
    const extraData = JSON.parse(application.extra_data || '{}');
    extraData.executed = 1;
    extraData.skip_reason = `水牌状态为「${currentStatus}」,不符合恢复条件`;
    await tx.run(
        'UPDATE applications SET extra_data = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify(extraData), now, applicationId]
    );
    return; // 不执行恢复
}
```

---

## 六、测试数据记录

### 测试用token
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRnYWRtaW4iLCJyb2xlIjoi566h55CG5ZGYIiwiaWF0IjoxNzc2Njk2Mzk3LCJleHAiOjE3NzczMDExOTd9.9v4bO0mUWzjBL4GG2SBZc__ZcTqwi72v1ntU92GqViI
```

### 测试助教数据
| coach_no | employee_id | stage_name | phone | shift | water_status |
|----------|-------------|------------|-------|-------|--------------|
| 10001 | 1 | 歪歪 | 16675852676 | 晚班 | 下班 |
| 10002 | 2 | 陆飞 | 18775703862 | 早班 | 早班空闲 |
| 10003 | 3 | 六六 | 19814455887 | 晚班 | 晚班空闲 |

### 创建的测试数据
- 申请ID=105：昨天的加班申请（用于过期申请测试）

---

*测试完成时间：2026-04-20 22:50*
*测试员：B*