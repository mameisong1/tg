# QA-20260420-4 技术方案设计

## 需求概述

申请和审批时间段规定及水牌状态限制:

### 1. 申请和审批时间段规定

| 申请类型 | 申请时间段 | 审批时间段 | 备注 |
|---------|-----------|-----------|------|
| 加班/公休申请 | 0:00 - 14:00 | 12:00 - 18:00 | 审批只能审批当天提交的申请,过期申请只能拒绝 |
| 请假/休息申请 | 0:00 - 16:00 可见当日选项 | 12:00 - 18:00 | 过了 16:00 只能选择明天以后的日期 |

### 2. 水牌状态限制

| 操作类型 | 前置状态要求 | 目标状态 | 状态不符时处理 |
|---------|------------|---------|--------------|
| 加班/公休申请 | 必须是「下班」状态 | - | API拒绝提交 |
| 加班/公休审批同意 | 必须是「下班」状态才能变更水牌 | 早加班/晚加班/公休 | 审批成功,但**不修改水牌** |
| 请假/休息审批同意（当天） | 审批时间 ≥ Timer时间 → 不设置Timer，直接修改水牌 | 审批成功，立刻改水牌，无Timer |
| 请假/休息审批同意（当天） | 审批时间 < Timer时间 → 设置Timer | 审批成功，立刻改水牌，有Timer |
| 请假/休息审批同意（未来） | Timer在未来 → 设置Timer | 审批成功，不立即改水牌，有Timer |
| Timer 执行恢复 | 必须是请假/休息状态 | 班次空闲 | 跳过恢复,记录skip_reason |

---

## 一、新增/修改的文件

### 后端文件(2个)

| 文件 | 修改内容 |
|------|---------|
| `backend/routes/applications.js` | 新增时间段校验函数、水牌状态校验逻辑 |
| `backend/services/timer-manager.js` | 修改 executeApplicationRecovery,新增水牌状态校验 |

### 前端文件(8个)

| 文件 | 修改内容 |
|------|---------|
| `src/pages/internal/overtime-apply.vue` | 新增提示栏、水牌状态检查 |
| `src/pages/internal/leave-apply.vue` | 新增提示栏、水牌状态检查 |
| `src/pages/internal/overtime-approval.vue` | 新增提示栏、过期申请拒绝逻辑 |
| `src/pages/internal/leave-approval.vue` | 新增提示栏、过期申请拒绝逻辑 |
| `src/pages/internal/rest-apply.vue` | 新增提示栏、日期选项时间限制 |
| `src/pages/internal/rest-approval.vue` | 新增提示栏 |
| `src/pages/internal/leave-request-apply.vue` | 新增提示栏、日期选项时间限制 |
| `src/pages/internal/leave-request-approval.vue` | 新增提示栏 |

---

## 二、API 变更

### 2.1 POST /api/applications - 申请提交

**新增校验逻辑**:

#### 加班/公休申请时间校验
```javascript
// 校验函数:validateOvertimeApplyTime
function validateOvertimeApplyTime(nowHour) {
  // 加班/公休申请时间:0:00 - 14:00
  if (nowHour >= 14) {
    return {
      valid: false,
      error: '加班/公休申请时间已截止(仅限 0:00 - 14:00),请明天再申请'
    };
  }
  return { valid: true };
}
```

#### 水牌状态校验
```javascript
// 校验函数:validateWaterBoardStatusForOvertimeApply
async function validateWaterBoardStatusForOvertimeApply(tx, applicant_phone) {
  const coach = await tx.get(
    'SELECT coach_no, stage_name FROM coaches WHERE employee_id = ? OR phone = ?',
    [applicant_phone, applicant_phone]
  );
  if (!coach) return { valid: true }; // 没找到助教,跳过校验

  const waterBoard = await tx.get(
    'SELECT status FROM water_boards WHERE coach_no = ?',
    [coach.coach_no]
  );
  if (!waterBoard) return { valid: true };

  // 加班/公休申请:只能从「下班」状态申请
  if (waterBoard.status !== '下班') {
    return {
      valid: false,
      error: `当前水牌状态为「${waterBoard.status}」,只能从「下班」状态申请加班/公休`
    };
  }
  return { valid: true };
}
```

**返回值变更**:
```javascript
// 成功:不变
{ success: true, data: { id: xxx, status: 0 } }

// 失败:新增具体错误提示
{ success: false, error: '加班/公休申请时间已截止(仅限 0:00 - 14:00)...' }
{ success: false, error: '当前水牌状态为「早班空闲」,只能从「下班」状态申请...' }
```

### 2.2 PUT /api/applications/:id/approve - 审批同意

**新增校验逻辑**:

#### 审批时间校验
```javascript
// 校验函数:validateApprovalTime
function validateApprovalTime(nowHour, applicationType) {
  // 审批时间:12:00 - 18:00
  if (nowHour < 12 || nowHour >= 18) {
    return {
      valid: false,
      error: '审批时间仅限 12:00 - 18:00'
    };
  }
  return { valid: true };
}
```

#### 过期申请校验(加班/公休)
```javascript
// 校验函数:validateExpiredApplication
function validateExpiredApplication(application, nowDate, nowHour, approveStatus) {
  if (approveStatus !== 1) return { valid: true }; // 拒绝不检查过期

  // 加班/公休审批:只能审批当天提交的申请
  const applyDate = application.created_at.substring(0, 10);
  if (applyDate !== nowDate) {
    return {
      valid: false,
      error: '只能审批当天提交的加班/公休申请,过期申请只能拒绝'
    };
  }
  return { valid: true };
}
```

#### 水牌状态检查(审批同意时决定是否变更水牌)

**重要:水牌状态不对不拒绝审批,只决定是否修改水牌**

```javascript
// 检查函数:checkWaterBoardStatusForApproval
// 返回值:{ canChangeWaterBoard: boolean, currentStatus: string }
async function checkWaterBoardStatusForApproval(tx, coach_no, applicationType) {
  const waterBoard = await tx.get(
    'SELECT status FROM water_boards WHERE coach_no = ?',
    [coach_no]
  );
  if (!waterBoard) return { canChangeWaterBoard: true, currentStatus: null }; // 无水牌记录,允许变更

  const currentStatus = waterBoard.status;

  // 加班/公休审批:只有「下班」状态才能变更水牌
  if (['早加班申请', '晚加班申请', '公休申请'].includes(applicationType)) {
    if (currentStatus !== '下班') {
      // 状态不符,审批仍成功,但不修改水牌
      console.log(`[审批同意] 水牌状态为「${currentStatus}」,不修改水牌`);
      return { canChangeWaterBoard: false, currentStatus };
    }
  }

  // 请假/休息审批:只有离店状态才能立即变更水牌
  if (['请假申请', '休息申请'].includes(applicationType)) {
    const offStatuses = ['下班', '公休', '请假', '休息'];
    if (!offStatuses.includes(currentStatus)) {
      // 状态不符,审批仍成功,但不立即修改水牌
      // 但仍需要设置Timer,因为Timer到期时状态可能已经变了
      console.log(`[审批同意] 水牌状态为「${currentStatus}」非离店状态,不立即修改水牌,但设置Timer`);
      return { canChangeWaterBoardNow: false, currentStatus, needTimer: true }; // ⭐ 请假/休息仍需Timer
    }
  }

  return { canChangeWaterBoardNow: true, currentStatus, needTimer: true }; // 请假/休息离店状态也需要Timer
}
```

**审批同意处理逻辑**:
```javascript
// 审批同意流程
async function approveApplication(applicationId, approveStatus) {
  if (approveStatus !== 1) {
    // 拒绝:直接更新申请状态为2
    await tx.run('UPDATE applications SET status = 2 ...');
    return { success: true }; // 拒绝永远成功
  }

  // 同意:
  // 1. 更新申请状态为1(已同意)
  await tx.run('UPDATE applications SET status = 1 ...');

  // 2. 检查水牌状态
  const { canChangeWaterBoard, currentStatus } = await checkWaterBoardStatusForApproval(tx, coach_no, applicationType);

  if (canChangeWaterBoardNow) {
    // 水牌状态符合,立即变更水牌
    await tx.run('UPDATE water_boards SET status = ? ...', [newStatus]);
  } else {
    // 水牌状态不符,记录日志但不立即修改水牌
    const extraData = JSON.parse(application.extra_data || '{}');
    extraData.water_board_skipped = true;
    extraData.water_board_skipped_reason = `水牌状态为「${currentStatus}」,不满足立即变更条件`;
    await tx.run('UPDATE applications SET extra_data = ? ...', [JSON.stringify(extraData)]);
  }

  // 请假/休息:无论水牌状态如何,都要设置Timer
  // 因为Timer到期时水牌状态可能已经变了,到时候再判断
  if (needTimer && ['请假申请', '休息申请'].includes(applicationType)) {
    await scheduleRecoveryTimer(applicationId, endTime);
  }

  return { success: true, waterBoardChangedNow: canChangeWaterBoardNow }; // 审批永远成功
}
```

**返回值变更**:
```javascript
// 成功(不变):
{ success: true, data: { id: xxx, status: 1, waterBoardChanged: true/false } }

// 失败(只有时间段和过期拒绝):
{ success: false, error: '审批时间仅限 12:00 - 18:00' }
{ success: false, error: '只能审批当天提交的加班/公休申请,过期申请只能拒绝' }
```

---

## 三、数据库变更

**无新增表/字段**。

现有表结构已满足需求:
- `applications` 表已有 `status`、`created_at`、`approve_time`、`extra_data` 字段
- `water_boards` 表已有 `status`、`coach_no` 字段

---

## 四、前后端交互流程

### 4.1 加班/公休申请流程

```
┌─────────────────────────────────────────────────────────────┐
│                      加班/公休申请流程                        │
└─────────────────────────────────────────────────────────────┘

前端页面加载
  │
  ├─► 获取服务器时间 (/api/server-time)
  │     └─► 计算当前小时 nowHour
  │
  ├─► 检查时间段提示
  │     ├─► nowHour >= 14 ? 显示红色提示栏:「申请时间已截止」
  │     └─► nowHour < 14  ? 显示绿色提示栏:「申请时间 0:00-14:00」
  │
  ├─► 检查水牌状态(可选,前端预检)
  │     └─► 水牌状态非「下班」?显示黄色提示栏
  │
用户点击提交
  │
  ├─► POST /api/applications
  │     │
  │     ├─► 后端校验1:时间段校验
  │     │     ├─► nowHour >= 14 ? 返回 400 错误
  │     │     └─► nowHour < 14  ? 继续
  │     │
  │     ├─► 后端校验2:水牌状态校验
  │     │     ├─► 状态非「下班」?返回 400 错误
  │     │     └─► 状态为「下班」?继续
  │     │
  │     └─► 创建申请记录,返回成功
  │
  └─► 前端显示成功弹窗
```

### 4.2 加班/公休审批流程

```
┌─────────────────────────────────────────────────────────────┐
│                      加班/公休审批流程                        │
└─────────────────────────────────────────────────────────────┘

前端页面加载
  │
  ├─► 获取服务器时间
  │     └─► 计算当前小时 nowHour、当前日期 nowDate
  │
  ├─► 检查时间段提示
  │     ├─► nowHour < 12 || nowHour >= 18 ? 显示红色提示栏
  │     └─► nowHour >= 12 && nowHour < 18 ? 显示绿色提示栏
  │
  ├─► 加载待审批列表
  │     └─► 标记过期申请(created_at 日期 ≠ nowDate)
  │
用户点击「同意」
  │
  ├─► 前端检查:申请是否过期?
  │     ├─► 过期?弹窗提示「只能拒绝,不能同意」
  │     └─► 未过期?继续
  │
  ├─► PUT /api/applications/:id/approve { status: 1 }
  │     │
  │     ├─► 后端校验1:审批时间校验
  │     │     ├─► 不在 12-18 点?返回 400 错误
  │     │     └─► 在 12-18 点?继续
  │     │
  │     ├─► 后端校验2:过期申请校验
  │     │     ├─► 申请日期 ≠ 当天日期?返回 400 错误
  │     │     └─► 申请日期 = 当天日期?继续
  │     │
  │     ├─► 后端校验3:水牌状态校验
  │     │     ├─► 状态非「下班」?返回 400 错误
  │     │     └─► 状态为「下班」?继续
  │     │
  │     └─► 更新申请状态 + 水牌状态,返回成功
  │
  └─► 前端刷新列表

用户点击「拒绝」(过期申请也可以拒绝)
  │
  ├─► PUT /api/applications/:id/approve { status: 2 }
  │     │
  │     ├─► 后端校验1:审批时间校验
  │     │     ├─► 不在 12-18 点?返回 400 错误
  │     │     └─► 在 12-18 点?继续
  │     │
  │     └─► 更新申请状态为「已拒绝」,返回成功
```

### 4.3 请假/休息申请流程

```
┌─────────────────────────────────────────────────────────────┐
│                      请假/休息申请流程                        │
└─────────────────────────────────────────────────────────────┘

前端页面加载
  │
  ├─► 获取服务器时间
  │     └─► 计算当前小时 nowHour、当前日期 nowDate
  │
  ├─► 检查时间段提示
  │     ├─► nowHour < 16 ? 显示提示:「可申请当日」
  │     └─► nowHour >= 16 ? 显示提示:「只能选择明天以后」
  │
  ├─► 生成日期选项
  │     ├─► nowHour < 16 ? 显示今天 + 未来 30 天
  │     └─► nowHour >= 16 ? 只显示明天 + 未来 30 天(不含今天)
  │
用户点击提交
  │
  ├─► POST /api/applications
  │     │
  │     └─► 创建申请记录,返回成功
  │           (请假/休息申请无时间段 API 限制)
  │
  └─► 前端显示成功弹窗
```

### 4.4 请假/休息审批流程

```
┌─────────────────────────────────────────────────────────────┐
│                      请假/休息审批流程                        │
└─────────────────────────────────────────────────────────────┘

前端页面加载
  │
  ├─► 获取服务器时间
  │     └─► 计算当前小时 nowHour
  │
  ├─► 检查时间段提示
  │     ├─► nowHour < 12 || nowHour >= 18 ? 显示红色提示栏
  │     └─► nowHour >= 12 && nowHour < 18 ? 显示绿色提示栏
  │
用户点击「同意」
  │
  ├─► PUT /api/applications/:id/approve { status: 1 }
  │     │
  │     ├─► 后端校验1:审批时间校验
  │     │     ├─► 不在 12-18 点?返回 400 错误
  │     │     └─► 在 12-18 点?继续
  │     │
  │     ├─► 后端校验2:水牌状态校验
  │     │     ├─► 不在离店状态?返回 400 错误
  │     │     └─► 在离店状态?继续
  │     │
  │     └─► 更新申请状态 + 设置 Timer + 水牌状态,返回成功
  │
  └─► 前端刷新列表
```

---

## 五、Timer 执行时的水牌状态校验

### 5.1 executeApplicationRecovery 修改

在 `timer-manager.js` 的 `executeApplicationRecovery` 函数中,新增水牌状态校验:

```javascript
async function executeApplicationRecovery(applicationId) {
  try {
    await runInTransaction(async (tx) => {
      // 1. 查询申请记录(现有逻辑)
      const application = await tx.get(...);

      // 2. 查询教练信息(现有逻辑)
      const coach = await tx.get(...);

      // 3. 查询水牌(现有逻辑)
      const waterBoard = await tx.get(...);

      // ===== 新增校验 =====
      // 4. 水牌状态校验:必须处于请假/休息状态
      const currentStatus = waterBoard.status;
      if (currentStatus !== '请假' && currentStatus !== '休息') {
        // 状态不符合,标记已执行但不改变水牌
        console.log(`[TimerManager] 申请 ${applicationId} 水牌状态为「${currentStatus}」,不符合恢复条件,跳过`);
        const extraData = JSON.parse(application.extra_data || '{}');
        extraData.executed = 1;
        extraData.skip_reason = `水牌状态为「${currentStatus}」,不符合恢复条件`;
        await tx.run(
          'UPDATE applications SET extra_data = ?, updated_at = ? WHERE id = ?',
          [JSON.stringify(extraData), TimeUtil.nowDB(), applicationId]
        );
        return; // 不执行恢复
      }

      // 5. 恢复水牌状态(现有逻辑)
      const newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
      await tx.run(...);

      // ... 后续逻辑不变
    });
  } catch (err) {
    console.error(`[TimerManager] 申请 ${applicationId} 恢复失败:`, err);
  }
}
```

---

## 六、边界情况和异常处理

### 6.1 时间段边界情况

| 场景 | 处理方式 |
|------|---------|
| 凌晨 0:00-1:00 申请加班 | 允许(时间段为 0-14) |
| 14:00 整点申请 | 允许(时间段为 0-14,包含 14:00) |
| 14:01 申请 | 拒绝,提示「申请时间已截止」 |
| 12:00 整点审批 | 允许(时间段为 12-18) |
| 18:00 整点审批 | 允许(时间段为 12-18,包含 18:00) |
| 18:01 审批 | 拒绝,提示「审批时间仅限 12:00-18:00」 |
| 16:00 整点申请请假 | 允许选择当日(时间段为 0-16,包含 16:00) |
| 16:01 申请请假 | 只能选择明天以后 |

### 6.2 申请日期判断

```javascript
// 精确判断:只看日期部分,不看时间
const applyDate = application.created_at.substring(0, 10); // "2026-04-20"
const nowDate = TimeUtil.todayStr();                       // "2026-04-20"
const isExpired = applyDate !== nowDate;
```

### 6.3 水牌状态变更时机

| 操作 | 校验时机 | 校验对象 |
|------|---------|---------|
| 加班申请提交 | POST /api/applications 时 | 当前水牌状态 |
| 加班审批同意 | PUT approve 时 | 审批前水牌状态 |
| 请假审批同意 | PUT approve 时 | 审批前水牌状态 |
| Timer 执行恢复 | executeApplicationRecovery 时 | Timer 执行前水牌状态 |

**关键点**:所有水牌状态校验都在事务内执行,确保状态检查和变更在同一事务中,避免并发问题。

### 6.4 异常处理

```javascript
// 统一错误格式
{
  success: false,
  error: '具体错误原因(用户可见)'
}

// 错误分类
const ERRORS = {
  APPLY_TIME_EXPIRED: '加班/公休申请时间已截止(仅限 0:00 - 14:00)',
  APPROVAL_TIME_INVALID: '审批时间仅限 12:00 - 18:00',
  APPLICATION_EXPIRED: '只能审批当天提交的加班/公休申请,过期申请只能拒绝',
  WATER_BOARD_STATUS_INVALID: '当前水牌状态为「X」,只能从「下班」状态申请加班/公休',
  WATER_BOARD_STATUS_NOT_OFF: '当前水牌状态为「X」,只能从离店状态审批请假/休息',
  TIMER_STATUS_INVALID: '水牌状态为「X」,不符合恢复条件'
};
```

---

## 七、前端提示栏设计

### 7.1 提示栏组件样式

```html
<!-- 提示栏模板 -->
<view class="time-notice" :class="noticeClass">
  <text class="notice-icon">{{ noticeIcon }}</text>
  <text class="notice-text">{{ noticeText }}</text>
</view>
```

```css
/* 提示栏样式 */
.time-notice {
  margin: 12px 16px;
  padding: 12px 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.time-notice.success {
  background: rgba(46,204,113,0.15);
  border: 1px solid rgba(46,204,113,0.3);
}
.time-notice.warning {
  background: rgba(241,196,15,0.15);
  border: 1px solid rgba(241,196,15,0.3);
}
.time-notice.error {
  background: rgba(231,76,60,0.15);
  border: 1px solid rgba(231,76,60,0.3);
}
.notice-icon { font-size: 16px; }
.notice-text { font-size: 13px; color: rgba(255,255,255,0.8); }
```

### 7.2 各页面提示内容

| 页面 | 时间段 | 提示内容 |
|------|-------|---------|
| overtime-apply.vue | 0-14 | ✅ 申请时间:0:00 - 14:00 |
| overtime-apply.vue | ≥14 | ❌ 申请时间已截止(仅限 0:00 - 14:00) |
| overtime-apply.vue | 水牌非下班 | ⚠️ 当前状态:早班空闲,只能从「下班」状态申请 |
| leave-apply.vue | 0-14 | ✅ 申请时间:0:00 - 14:00 |
| leave-apply.vue | ≥14 | ❌ 申请时间已截止 |
| overtime-approval.vue | 12-18 | ✅ 审批时间:12:00 - 18:00 |
| overtime-approval.vue | 其他 | ❌ 审批时间仅限 12:00 - 18:00 |
| rest-apply.vue | 0-16 | ✅ 可申请当日休息 |
| rest-apply.vue | ≥16 | ⚠️ 当前时间已过16:00,只能选择明天以后的日期 |
| rest-approval.vue | 12-18 | ✅ 审批时间:12:00 - 18:00 |
| rest-approval.vue | 其他 | ❌ 审批时间仅限 12:00 - 18:00 |
| leave-request-apply.vue | 0-16 | ✅ 可申请当日请假 |
| leave-request-apply.vue | ≥16 | ⚠️ 当前时间已过16:00,只能选择明天以后的日期 |
| leave-request-approval.vue | 12-18 | ✅ 审批时间:12:00 - 18:00 |
| leave-request-approval.vue | 其他 | ❌ 审批时间仅限 12:00 - 18:00 |

---

## 八、实现优先级

### P0(必须实现)
1. 后端时间段校验(申请/审批 API)
2. 后端水牌状态校验(审批 API + Timer)
3. 前端申请页面提示栏

### P1(重要)
1. 前端审批页面提示栏
2. 前端过期申请标记(UI 显示)
3. 前端日期选项时间限制(请假/休息)

### P2(优化)
1. 前端水牌状态预检(申请页面)
2. 错误提示优化(更友好的文案)

---

## 九、编码规范检查清单

### 时间处理
- ✅ 使用 `TimeUtil.nowDB()` 获取当前时间
- ✅ 使用 `TimeUtil.todayStr()` 获取当前日期
- ❌ 禁止 `datetime('now')` 或手动时区偏移

### 数据库连接
- ✅ 使用 `runInTransaction(async (tx) => {...})`
- ✅ 使用 `tx.get()`、`tx.run()`、`tx.all()`
- ❌ 禁止 `new sqlite3.Database()`

### 数据库写入
- ✅ 在事务内使用 `tx.run()`
- ❌ 禁止 `db.run('BEGIN TRANSACTION')`

### 页面显示
- ✅ 显示 `employee_id`(助教工号)
- ❌ 禁止显示 `coach_no`

---

## 十、测试验收要点

### 10.1 时间段限制准确性
- [ ] 加班申请:14:01 提交被拒绝
- [ ] 加班审批:11:59 同意被拒绝
- [ ] 加班审批:18:01 同意被拒绝
- [ ] 请假申请:16:01 无法选择当日日期

### 10.2 水牌状态变更限制正确性
- [ ] 加班申请:水牌为「早班空闲」时提交被拒绝
- [ ] 加班审批同意:水牌为「下班」 → 申请状态=1,水牌改为加班状态
- [ ] 加班审批同意:水牌为「早班上桌」 → 申请状态=1,水牌保持不变
- [ ] 请假审批同意:水牌为「下班」 → 申请状态=1,水牌改为请假,有Timer
- [ ] 请假审批同意：水牌为「早班空闲」 → 申请状态=1，水牌保持不变，**有Timer**（Timer到期再判断）
- [ ] Timer恢复:水牌为「早班空闲」时不执行恢复

### 10.3 页面提示栏显示
- [ ] 加班申请页:14:00 后显示红色提示
- [ ] 加班审批页:12:00 前显示红色提示
- [ ] 请假申请页:16:00 后显示黄色提示
- [ ] 水牌非下班:申请页显示黄色提示

### 10.4 API拒绝提示清晰
- [ ] 所有拒绝场景返回中文提示
- [ ] 提示包含当前状态和限制条件
- [ ] 前端 toast 显示错误内容

---

## 十一、开发进度计划

| 任务 | 预估工时 | 负责人 |
|------|---------|--------|
| 后端时间段校验函数 | 1h | 程序员A |
| 后端水牌状态校验逻辑 | 1h | 程序员A |
| Timer 恢复校验修改 | 0.5h | 程序员A |
| 前端申请页面提示栏(4页) | 2h | 程序员A |
| 前端审批页面提示栏(4页) | 2h | 程序员A |
| 前端过期申请标记 | 1h | 程序员A |
| 前端日期选项限制 | 0.5h | 程序员A |
| 联调测试 | 1h | 程序员B |

**总计**:约 8 小时

---

*设计完成时间:2026-04-20*
*设计负责人:程序员A*

---

## 设计修改记录

### 修改日期:2026-04-20 21:37
### 修改内容:

1. **审批同意不拒绝**:审批同意时,水牌状态不对 → API允许同意(更新申请状态=1),但**不立即修改水牌状态**
2. **水牌状态只影响状态变更**:水牌状态校验只决定是否立即修改水牌,不影响审批操作本身
3. 具体变更:
   - 加班审批同意 + 水牌非「下班」 → 审批成功,申请状态=1,水牌不变
   - 请假审批同意 + 水牌非离店状态 → 审批成功,申请状态=1,水牌不变,**但设置Timer**(Timer到期再判断)
4. 返回值新增 `waterBoardChangedNow` 字段告知前端是否立即修改了水牌

---

### 修改日期:2026-04-20 21:43
### 修改内容:

**请假/休息Timer逻辑修正**：请假/休息审批同意时，无论水牌状态如何，**都要设置Timer**。因为Timer到期时水牌状态可能已经变了，到时候再判断是否恢复。