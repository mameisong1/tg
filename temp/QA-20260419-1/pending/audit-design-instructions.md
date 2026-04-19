你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
```
# QA 需求技术方案：新增助教申请事项

**日期**: 2026-04-19
**设计者**: 程序员A
**需求**: 新增班次切换申请、请假申请、休息申请

---

## 一、现有系统分析

### 1.1 applications 表结构（已有）

```sql
CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    applicant_phone TEXT NOT NULL,      -- 申请人手机号
    application_type TEXT NOT NULL,      -- 申请类型
    remark TEXT,                         -- 备注
    proof_image_url TEXT,               -- 证明图片 URL
    status INTEGER DEFAULT 0,            -- 0=待处理 / 1=同意 / 2=拒绝
    approver_phone TEXT,                -- 审批人手机号
    approve_time DATETIME,              -- 审批时间
    extra_data TEXT,                    -- 额外数据（JSON）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 1.2 现有申请类型
- 早加班申请
- 晚加班申请
- 公休申请
- 约客记录
- （需删除：乐捐报备 → 乐捐已独立为 lejuan_records 表）

### 1.3 现有 API 路由（`backend/routes/applications.js`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/applications` | `['all']` | 提交申请 |
| GET | `/api/applications` | `['all']` | 获取申请列表 |
| PUT | `/:id/approve` | `['coachManagement']` | 审批申请 |
| GET | `/approved-recent` | `['coachManagement']` | 近期审批记录 |
| GET | `/today-approved-overtime` | `['waterBoardManagement']` | 当天加班小时数 |

### 1.4 审批通过时的水牌状态变更逻辑（已有）
- 早加班申请 → 水牌状态 → `早加班`
- 晚加班申请 → 水牌状态 → `晚加班`
- 公休申请 → 水牌状态 → `公休`
- **关键约束**：正在上桌（`早班上桌`/`晚班上桌`）的助教不能审批通过

### 1.5 coaches 表关键字段
- `shift`：`早班` / `晚班`
- `employee_id`：助教工号（页面显示用）
- `coach_no`：内部编号（不显示在页面）
- `stage_name`：艺名

### 1.6 权限矩阵（`backend/middleware/permission.js`）
- **助教权限**（`userType='coach'`）：通过 `COACH_ALLOWED_PERMISSIONS` 中的 `'all'` 访问 applications API
- **管理权限**：`助教管理`、`店长`、`管理员` → `isManager = true`
- **审批权限**：`requireBackendPermission(['coachManagement'])`

### 1.7 乐捐定时器模式（`backend/services/lejuan-timer.js`）
- 内存 `setTimeout` + 数据库 `scheduled` 字段标记
- 服务启动时恢复所有 pending 定时器
- 每分钟轮询兜底
- **可复用于休息/请假定时执行**

### 1.8 前端现有页面结构
- H5 页面在 `/TG/tgservice-uniapp/src/pages/internal/`
- 路由在 `src/pages.json` 注册
- API 封装在 `src/utils/api-v2.js` 的 `applications` 模块
- 图片上传使用 `useImageUpload` composable

---

## 二、数据库变更

### 2.1 applications 表变更

**不需要 ALTER TABLE**，复用现有字段：

| 字段 | 用途 |
|------|------|
| `application_type` | 新增类型：`班次切换申请`、`请假申请`、`休息申请` |
| `extra_data` (JSON) | 存储各类型特有字段（见下表） |
| `images` | 请假申请的照片（最多3张，JSON 数组） |
| `remark` | 申请理由/备注 |

### 2.2 extra_data JSON 结构约定

**班次切换申请**：
```json
{
  "target_shift": "早班",
  "cancel_requested": false
}
```

**休息申请**：
```json
{
  "rest_date": "2026-04-25",
  "scheduled": 0,
  "timer_set": false
}
```

**请假申请**：
```json
{
  "leave_type": "事假",
  "leave_date": "2026-04-25",
  "scheduled": 0,
  "timer_set": false
}
```

### 2.3 新增索引（性能优化）

```sql
-- 用于月度次数限制查询（按月统计申请通过数）
CREATE INDEX IF NOT EXISTS idx_applications_type_status_created 
ON applications(application_type, status, created_at);
```

### 2.4 删除旧类型

将 `乐捐报备` 从 validTypes 列表中移除（乐捐已独立为 lejuan_records 表），
**不删除数据库中的历史数据**（仅代码层限制新提交）。

---

## 三、后端 API 变更

### 3.1 修改现有 API

#### 3.1.1 POST /api/applications — 提交申请

**修改 validTypes**：
```javascript
const validTypes = [
  '早加班申请',
  '晚加班申请',
  '公休申请',
  '约客记录',
  '班次切换申请',    // 新增
  '请假申请',        // 新增
  '休息申请'         // 新增
];
// 删除 '乐捐报备'（不再接受新提交）
```

**新增验证逻辑**（在 INSERT 之前）：

```javascript
// 班次切换：校验每月2次限制
if (application_type === '班次切换申请') {
  const monthStart = TimeUtil.todayStr().substring(0, 7) + '-01 00:00:00';
  const monthEnd = TimeUtil.todayStr().substring(0, 7) + '-31 23:59:59';
  const count = await tx.get(
    `SELECT COUNT(*) as cnt FROM applications 
     WHERE applicant_phone = ? AND application_type = ? AND status = 1
     AND created_at >= ? AND created_at <= ?`,
    [applicant_phone, '班次切换申请', monthStart, monthEnd]
  );
  if (count.cnt >= 2) {
    throw { status: 400, error: '本月班次切换次数已达上限（2次/月）' };
  }
  // 校验 target_shift
  if (!extra_data || !extra_data.target_shift || !['早班', '晚班'].includes(extra_data.target_shift)) {
    throw { status: 400, error: '请选择目标班次（早班/晚班）' };
  }
}

// 休息申请：校验每月4天限制 + 日期范围
if (application_type === '休息申请') {
  if (!extra_data || !extra_data.rest_date) {
    throw { status: 400, error: '请选择休息日期' };
  }
  const todayStr = TimeUtil.todayStr();
  const restDate = extra_data.rest_date;
  if (restDate < todayStr) {
    throw { status: 400, error: '不能选择过去的日期' };
  }
  const maxDate = TimeUtil.offsetDB(30 * 24).substring(0, 10);
  if (restDate > maxDate) {
    throw { status: 400, error: '只能选择今天起未来30天内的日期' };
  }
  // 检查是否已有该日期的休息/请假申请
  const existing = await tx.get(
    `SELECT id FROM applications 
     WHERE applicant_phone = ? AND application_type IN ('休息申请', '请假申请')
     AND status = 1 AND extra_data LIKE ?`,
    [applicant_phone, `%"${restDate}"%`]
  );
  if (existing) {
    throw { status: 400, error: '该日期已有审批通过的休息/请假申请' };
  }
  // 月度4天限制（统计当月 status=1 的休息+请假天数）
  const monthStart = todayStr.substring(0, 7) + '-01 00:00:00';
  const monthEnd = todayStr.substring(0, 7) + '-31 23:59:59';
  const restRecords = await tx.all(
    `SELECT extra_data FROM applications 
     WHERE applicant_phone = ? AND application_type IN ('休息申请', '请假申请') 
     AND status = 1 AND created_at >= ? AND created_at <= ?`,
    [applicant_phone, monthStart, monthEnd]
  );
  const restDays = new Set();
  for (const r of restRecords) {
    try {
      const ed = JSON.parse(r.extra_data);
      if (ed.rest_date) restDays.add(ed.rest_date);
      if (ed.leave_date) restDays.add(ed.leave_date);
    } catch(e) {}
  }
  if (restDays.size >= 4) {
    throw { status: 400, error: '本月休息日已达上限（4天/月）' };
  }
}

// 请假申请：校验必填字段
if (application_type === '请假申请') {
  if (!extra_data || !extra_data.leave_type || !['事假', '病假'].includes(extra_data.leave_type)) {
    throw { status: 400, error: '请选择请假类型（事假/病假）' };
  }
  if (!extra_data || !extra_data.leave_date) {
    throw { status: 400, error: '请选择请假日期' };
  }
  if (!remark || remark.trim() === '') {
    throw { status: 400, error: '请假必须输入理由' };
  }
  // 日期范围、重复检查同休息申请（复用逻辑）
  // ...
}
```

#### 3.1.2 PUT /api/applications/:id/approve — 审批申请

**新增审批通过时的业务逻辑**：

```javascript
if (approveStatus === 1) {
  // ... 现有水上牌检查逻辑保留 ...
  
  if (application.application_type === '班次切换申请') {
    // 自动切换班次
    const targetShift = JSON.parse(application.extra_data).target_shift;
    await tx.run(
      'UPDATE coaches SET shift = ?, updated_at = ? WHERE coach_no = ?',
      [targetShift, TimeUtil.nowDB(), coach.coach_no]
    );
    // 同步更新水牌状态
    const newWaterStatus = targetShift === '早班' ? '早班空闲' : '晚班空闲';
    await tx.run(
      'UPDATE water_boards SET status = ?, updated_at = ? WHERE coach_no = ?',
      [newWaterStatus, TimeUtil.nowDB(), coach.coach_no]
    );
  }
  
  if (application.application_type === '休息申请') {
    // 审批通过：水牌状态立即变为「休息」
    await tx.run(
      'UPDATE water_boards SET status = ?, updated_at = ? WHERE coach_no = ?',
      ['休息', TimeUtil.nowDB(), coach.coach_no]
    );
    // 设定执行计时器：到休息日12:00自动恢复为班次空闲
    const restDate = JSON.parse(application.extra_data).rest_date;
    const execTime = restDate + ' 12:00:00';
    await tx.run(
      'UPDATE applications SET extra_data = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify({...JSON.parse(application.extra_data), scheduled: 1, timer_set: true, exec_time: execTime}),
       TimeUtil.nowDB(), id]
    );
    // 调用定时器服务
    applicationTimer.addNewRecord({
      id: parseInt(id),
      application_type: '休息申请',
      applicant_phone: application.applicant_phone,
      coach_no: coach.coach_no,
      stage_name: coach.stage_name,
      exec_time: execTime,
      current_shift: coach.shift
    });
  }
  
  if (application.application_type === '请假申请') {
    // 审批通过：水牌状态变为「请假」
    await tx.run(
      'UPDATE water_boards SET status = ?, updated_at = ? WHERE coach_no = ?',
      ['请假', TimeUtil.nowDB(), coach.coach_no]
    );
    // 设定执行计时器
    const leaveDate = JSON.parse(application.extra_data).leave_date;
    const execTime = leaveDate + ' 12:00:00';
    await tx.run(
      'UPDATE applications SET extra_data = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify({...JSON.parse(application.extra_data), scheduled: 1, timer_set: true, exec_time: execTime}),
       TimeUtil.nowDB(), id]
    );
    applicationTimer.addNewRecord({
      id: parseInt(id),
      application_type: '请假申请',
      applicant_phone: application.applicant_phone,
      coach_no: coach.coach_no,
      stage_name: coach.stage_name,
      exec_time: execTime,
      current_shift: coach.shift
    });
  }
}
```

### 3.2 新增 API

#### 3.2.1 GET /api/applications/pending-count — 待审批数字指示器

```
GET /api/applications/pending-count
权限: ['coachManagement']（助教管理/店长/管理员）

响应:
{
  "success": true,
  "data": {
    "shift_change": 3,    // 班次切换待审批数
    "leave": 1,           // 请假待审批数
    "rest": 2,            // 休息待审批数
    "total": 6,           // 总计
    // 保留兼容现有
    "overtime": 0,        // 加班待审批数
    "public_leave": 0     // 公休待审批数
  }
}
```

**实现**：
```javascript
router.get('/pending-count', requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const [shiftChange, leaveReq, restReq, overtime, publicLeave] = await Promise.all([
      db.get('SELECT COUNT(*) as cnt FROM applications WHERE application_type = ? AND status = 0', ['班次切换申请']),
      db.get('SELECT COUNT(*) as cnt FROM applications WHERE application_type = ? AND status = 0', ['请假申请']),
      db.get('SELECT COUNT(*) as cnt FROM applications WHERE application_type = ? AND status = 0', ['休息申请']),
      db.get("SELECT COUNT(*) as cnt FROM applications WHERE application_type IN ('早加班申请','晚加班申请') AND status = 0", []),
      db.get("SELECT COUNT(*) as cnt FROM applications WHERE application_type = '公休申请' AND status = 0", [])
    ]);
    res.json({
      success: true,
      data: {
        shift_change: shiftChange.cnt,
        leave: leaveReq.cnt,
        rest: restReq.cnt,
        total: shiftChange.cnt + leaveReq.cnt + restReq.cnt,
        overtime: overtime.cnt,
        public_leave: publicLeave.cnt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取待审批数量失败' });
  }
});
```

#### 3.2.2 GET /api/applications/shift-stats — 班次切换审批页显示当前早晚班人数

```
GET /api/applications/shift-stats
权限: ['coachManagement']

响应:
{
  "success": true,
  "data": {
    "early_shift": 8,     // 早班人数
    "late_shift": 6,      // 晚班人数
    "total": 14
  }
}
```

#### 3.2.3 DELETE /api/applications/:id — 申请取消（助教本人）

```
DELETE /api/applications/:id?applicant_phone=xxx
权限: ['all']（助教可取消自己的待审批申请）

规则：
- 只能取消 status=0（待处理）的申请
- 申请人必须匹配
- 班次切换/休息/请假类型均可取消

响应:
{ "success": true, "message": "申请已取消" }
```

**实现**：
```javascript
router.delete('/:id', requireBackendPermission(['all']), async (req, res) => {
  try {
    const { id } = req.params;
    const { applicant_phone } = req.query;
    
    if (!applicant_phone) {
      throw { status: 400, error: '缺少 applicant_phone 参数' };
    }
    
    const application = await db.get(
      'SELECT * FROM applications WHERE id = ? AND applicant_phone = ?',
      [id, applicant_phone]
    );
    if (!application) {
      throw { status: 404, error: '申请记录不存在或不是您的申请' };
    }
    if (application.status !== 0) {
      throw { status: 400, error: '只能取消待处理状态的申请' };
    }
    
    // 如果是休息/请假且已设置定时器，取消定时器
    if (['休息申请', '请假申请'].includes(application.application_type)) {
      applicationTimer.cancelRecord(parseInt(id));
    }
    
    await runInTransaction(async (tx) => {
      await tx.run('DELETE FROM applications WHERE id = ?', [id]);
    });
    
    res.json({ success: true, message: '申请已取消' });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.error });
    }
    res.status(500).json({ success: false, error: '取消申请失败' });
  }
});
```

#### 3.2.4 GET /api/applications/my-month-count — 我的本月申请次数

```
GET /api/applications/my-month-count?applicant_phone=xxx&application_type=xxx
权限: ['all']

响应:
{
  "success": true,
  "data": {
    "count": 1,
    "limit": 2,
    "remaining": 1
  }
}
```

### 3.3 新增定时器服务

**文件**: `backend/services/application-timer.js`

复用 `lejuan-timer.js` 的模式，管理休息/请假审批通过后的定时恢复：

```javascript
/**
 * 申请定时器服务
 * 休息/请假审批通过后，到指定日期12:00自动恢复水牌状态
 */
const { all, get, enqueueRun, runInTransaction } = require('../db');
const TimeUtil = require('../utils/time');
const operationLogService = require('./operation-log');

const applicationTimers = {};

/**
 * 定时执行：恢复水牌状态为班次空闲
 */
async function executeRecovery(applicationId) {
    try {
        await runInTransaction(async (tx) => {
            const application = await tx.get(
                'SELECT * FROM applications WHERE id = ? AND status = 1',
                [applicationId]
            );
            if (!application) {
                console.log(`[申请定时器] 记录 ${applicationId} 已无效，跳过`);
                return;
            }
            
            const extraData = JSON.parse(application.extra_data);
            const coach = await tx.get(
                'SELECT coach_no, stage_name, shift FROM coaches WHERE employee_id = ? OR phone = ?',
                [application.applicant_phone, application.applicant_phone]
            );
            if (!coach) return;
            
            const waterBoard = await tx.get(
                'SELECT * FROM water_boards WHERE coach_no = ?',
                [coach.coach_no]
            );
            if (!waterBoard) return;
            
            // 恢复为对应班次的空闲状态
            const newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
            await tx.run(
                'UPDATE water_boards SET status = ?, updated_at = ? WHERE coach_no = ?',
                [newStatus, TimeUtil.nowDB(), coach.coach_no]
            );
            
            await operationLogService.create(tx, {
                operator_phone: 'system',
                operator_name: '系统定时任务',
                operation_type: '申请定时恢复',
                target_type: 'water_board',
                target_id: waterBoard.id,
                old_value: JSON.stringify({ status: waterBoard.status }),
                new_value: JSON.stringify({ status: newStatus }),
                remark: `${application.application_type}定时结束，${coach.stage_name}恢复为${newStatus}`
            });
        });
        
        delete applicationTimers[applicationId];
        console.log(`[申请定时器] 记录 ${applicationId} 已执行恢复`);
    } catch (err) {
        console.error(`[申请定时器] 执行恢复 ${applicationId} 失败:`, err);
    }
}

/** 调度、恢复、轮询、init、addNewRecord、cancelRecord ... (同 lejuan-timer 模式) */
```

**在 server.js 中初始化**：
```javascript
require('./services/application-timer').init();  // 放在 lejuan-timer.init() 旁边
```

---

## 四、前端变更

### 4.1 新增 H5 页面（助教专用版块）

#### 4.1.1 `src/pages/internal/shift-change-apply.vue` — 班次切换申请

**权限**：助教（`isCoach`）

**UI 要素**：
- 标题：班次切换申请
- 当前班次显示（从 coachInfo 获取 shift）
- 目标班次选择：单选按钮（早班 ↔ 晚班，排除当前班次）
- 本月已用次数提示（调用 `my-month-count` API）
- 备注输入（选填）
- 提交按钮

**提交逻辑**：
```javascript
await api.applications.create({
  applicant_phone: phone,
  application_type: '班次切换申请',
  remark: form.remark,
  extra_data: { target_shift: form.targetShift }
})
```

**取消功能**：在「我的申请记录」卡片中，待处理状态的申请显示「取消」按钮

#### 4.1.2 `src/pages/internal/rest-apply.vue` — 休息申请

**权限**：助教（`isCoach`）

**UI 要素**：
- 标题：休息申请
- 本月已休息天数提示（调用 API）
- 日期选择器：今天 ~ 未来30天（`uni-app picker mode="date"`）
- 备注输入（选填）
- 提交按钮

**日期范围限制**：
```javascript
const today = getBeijingDate()
const maxDate = offsetBeijingDate(30)  // 需要在 time-util.js 新增此函数
```

#### 4.1.3 `src/pages/internal/leave-apply.vue` — 请假申请

**权限**：助教（`isCoach`）

> ⚠️ 已有 `leave-apply.vue`（公休申请），需**新建 `leave-request-apply.vue`** 或重命名现有文件。
> 
> **方案：重命名现有文件**
> - `leave-apply.vue` → `public-leave-apply.vue`（公休申请）
> - 新建 `leave-apply.vue`（请假申请）← 但这会破坏现有路由
> 
> **最佳方案：保留原文件，新建不同名称**
> - 现有 `leave-apply.vue` 保持不变（公休申请）
> - 新建 `leave-request-apply.vue`（请假申请）

**UI 要素**：
- 标题：请假申请
- 请假类型：单选（事假 / 病假）
- 请假日期：选择器（当天 ~ 未来30天）
- 请假理由：**必填**，textarea，maxlength=200
- 照片上传：最多3张（复用 `useImageUpload`）
- 提交按钮

### 4.2 新增管理页面（管理功能版块）

#### 4.2.1 `src/pages/internal/shift-change-approval.vue` — 班次切换审批

**权限**：`isManager`（助教管理/店长/管理员）

**UI 要素**：
- 顶部统计栏：当前早班 X 人 / 晚班 Y 人（调用 `shift-stats` API）
- 待审批列表（tab 1）：
  - 助教工号（`employee_id`，**不显示 coach_no**）
  - 艺名、当前班次 → 目标班次
  - 申请时间
  - 同意/拒绝按钮
- 已同意列表（tab 2）
- 已拒绝列表（tab 3）

#### 4.2.2 `src/pages/internal/leave-request-approval.vue` — 请假审批

**权限**：`isManager`

**UI 要素**：
- 待审批列表：
  - 助教工号、艺名
  - 请假类型（事假/病假）
  - 请假日期
  - 理由（可展开）
  - 照片（缩略图，可预览）
  - 同意/拒绝按钮
- 已同意/已拒绝 tab

#### 4.2.3 `src/pages/internal/rest-approval.vue` — 休息审批

**权限**：`isManager`

**UI 要素**：
- 待审批列表：
  - 助教工号、艺名
  - 休息日期
  - 同意/拒绝按钮
- 已同意/已拒绝 tab

### 4.3 修改现有页面

#### 4.3.1 `src/pages/internal/internal-home.vue`

**助教专用版块**：新增 3 个按钮
```html
<view class="action-btn" @click="navigate('/pages/internal/shift-change-apply')">
  <text class="btn-icon">🔄</text>
  <text class="btn-label">班次切换申请</text>
</view>
<view class="action-btn" @click="navigate('/pages/internal/rest-apply')">
  <text class="btn-icon">🏖️</text>
  <text class="btn-label">休息申请</text>
</view>
<view class="action-btn" @click="navigate('/pages/internal/leave-request-apply')">
  <text class="btn-icon">📝</text>
  <text class="btn-label">请假申请</text>
</view>
```

**管理功能版块**：新增 3 个按钮 + 修改现有按钮显示待审批数字
```html
<!-- 修改现有 -->
<view class="action-btn" @click="navigate('/pages/internal/overtime-approval')">
  <text class="btn-icon">✅</text>
  <text class="btn-label">加班审批 ({{ overtimeCount }})</text>
</view>

<!-- 新增 -->
<view class="action-btn" @click="navigate('/pages/internal/shift-change-approval')">
  <text class="btn-icon">🔄</text>
  <text class="btn-label">班次切换审批 ({{ shiftChangeCount }})</text>
</view>
<view class="action-btn" @click="navigate('/pages/internal/leave-request-approval')">
  <text class="btn-icon">📝</text>
  <text class="btn-label">请假审批 ({{ leaveRequestCount }})</text>
</view>
<view class="action-btn" @click="navigate('/pages/internal/rest-approval')">
  <text class="btn-icon">🏖️</text>
  <text class="btn-label">休息审批 ({{ restCount }})</text>
</view>
```

**`loadPendingCounts` 改造**：
```javascript
const loadPendingCounts = async () => {
  try {
    const res = await api.applications.getPendingCount()
    const d = res.data || {}
    overtimeCount.value = d.overtime || 0
    leaveCount.value = d.public_leave || 0          // 公休
    shiftChangeCount.value = d.shift_change || 0    // 新增
    leaveRequestCount.value = d.leave || 0          // 新增
    restCount.value = d.rest || 0                   // 新增
  } catch (e) {}
}
```

#### 4.3.2 `src/utils/api-v2.js`

新增/修改 applications 模块：
```javascript
export const applications = {
  create: (data) => request({ url: '/applications', method: 'POST', data }),
  getList: (params) => request({ url: '/applications', data: params }),
  approve: (id, data) => request({ url: `/applications/${id}/approve`, method: 'PUT', data }),
  getApprovedRecent: (params) => request({ url: '/applications/approved-recent', data: params }),
  getTodayApprovedOvertime: () => request({ url: '/applications/today-approved-overtime' }),
  // 新增
  getPendingCount: () => request({ url: '/applications/pending-count' }),
  getShiftStats: () => request({ url: '/applications/shift-stats' }),
  delete: (id, phone) => request({ url: `/applications/${id}?applicant_phone=${phone}`, method: 'DELETE' }),
  getMyMonthCount: (phone, type) => request({ url: `/applications/my-month-count?applicant_phone=${phone}&application_type=${type}` })
}
```

#### 4.3.3 `src/utils/time-util.js`

新增函数（如不存在）：
```javascript
// 获取偏移N天后的日期字符串
export function offsetBeijingDate(days) {
  const now = new Date()
  now.setDate(now.getDate() + days)
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
```

#### 4.3.4 `src/pages.json`

新增 6 个页面路由：
```json
{
  "path": "pages/internal/shift-change-apply",
  "style": { "navigationBarTitleText": "班次切换申请", "navigationStyle": "custom" }
},
{
  "path": "pages/internal/rest-apply",
  "style": { "navigationBarTitleText": "休息申请", "navigationStyle": "custom" }
},
{
  "path": "pages/internal/leave-request-apply",
  "style": { "navigationBarTitleText": "请假申请", "navigationStyle": "custom" }
},
{
  "path": "pages/internal/shift-change-approval",
  "style": { "navigationBarTitleText": "班次切换审批", "navigationStyle": "custom" }
},
{
  "path": "pages/internal/leave-request-approval",
  "style": { "navigationBarTitleText": "请假审批", "navigationStyle": "custom" }
},
{
  "path": "pages/internal/rest-approval",
  "style": { "navigationBarTitleText": "休息审批", "navigationStyle": "custom" }
}
```

---

## 五、文件变更清单

### 5.1 后端文件

| 操作 | 文件 | 说明 |
|------|------|------|
| **修改** | `backend/routes/applications.js` | 新增 validTypes、月度限制、审批逻辑、新 API |
| **新增** | `backend/services/application-timer.js` | 休息/请假定时恢复服务 |
| **修改** | `backend/server.js` | 注册 application-timer.init()、新增索引 |
| **修改** | `backend/db/v2.0.sql` | 新增索引定义（或新建 v2.2.sql） |

### 5.2 前端文件

| 操作 | 文件 | 说明 |
|------|------|------|
| **新增** | `src/pages/internal/shift-change-apply.vue` | 班次切换申请页 |
| **新增** | `src/pages/internal/rest-apply.vue` | 休息申请页 |
| **新增** | `src/pages/internal/leave-request-apply.vue` | 请假申请页 |
| **新增** | `src/pages/internal/shift-change-approval.vue` | 班次切换审批页 |
| **新增** | `src/pages/internal/leave-request-approval.vue` | 请假审批页 |
| **新增** | `src/pages/internal/rest-approval.vue` | 休息审批页 |
| **修改** | `src/pages/internal/internal-home.vue` | 新增按钮 + 待审批数字 |
| **修改** | `src/utils/api-v2.js` | applications 模块新增方法 |
| **修改** | `src/utils/time-util.js` | 新增 offsetBeijingDate |
| **修改** | `src/pages.json` | 新增 6 个页面路由 |

---

## 六、关键业务流程

### 6.1 班次切换申请流程

```
助教提交申请 → 写入 applications (status=0)
              → 校验月度次数(≤2次)
              → 提交成功

管理审批同意 → status=1
              → UPDATE coaches.shift = target_shift
              → UPDATE water_boards.status = '早班空闲'/'晚班空闲'
              → 记录操作日志
              
管理审批拒绝 → status=2，不变更任何状态
```

### 6.2 休息申请流程

```
助教提交申请 → 选择日期(今天~30天内)
              → 校验月度天数(≤4天，含请假)
              → 校验日期不重复
              → 提交成功

管理审批同意 → status=1
              → water_boards.status = '休息'
              → 设定定时器: 到 rest_date 12:00 执行
              → 定时器触发: water_boards.status = '早班空闲'/'晚班空闲'
              
管理审批拒绝 → status=2
```

### 6.3 请假申请流程

```
助教提交申请 → 选择类型(事假/病假) + 理由(必填) + 照片(可选≤3张)
              → 选择日期(今天~30天内)
              → 校验月度天数(≤4天，含休息)
              → 提交成功

管理审批同意 → status=1
              → water_boards.status = '请假'
              → 设定定时器: 到 leave_date 12:00 执行
              → 定时器触发: water_boards.status = '早班空闲'/'晚班空闲'
              
管理审批拒绝 → status=2
```

### 6.4 申请取消流程

```
助教在「我的申请记录」中点击取消
  → 检查 status=0（待处理）
  → 如果是休息/请假且已设定时器 → 取消定时器
  → DELETE FROM applications
  → 提示"申请已取消"
```

---

## 七、边界情况与异常处理

### 7.1 月度次数限制

| 场景 | 处理 |
|------|------|
| 跨月切换（月末提交，次月审批） | 按**提交时间**(`created_at`)的月份计算，不按审批时间 |
| 助教切换手机号 | 通过 `applicant_phone` 关联，换手机号视为新人（现有系统行为） |
| 取消后重新申请 | 取消后释放名额，可重新申请 |

### 7.2 定时器相关

| 场景 | 处理 |
|------|------|
| 服务重启 | 启动时扫描 `extra_data.timer_set=true` 且 `status=1` 的记录，恢复定时器 |
| 定时器触发时助教已离职 | 检查教练是否存在，不存在则跳过 |
| 定时器触发时水牌状态已变更 | 仍执行恢复（覆盖），记录操作日志 |
| 审批同意后、定时器触发前被取消 | 需要新增"撤销审批"功能（不在本次范围） |

### 7.3 审批相关

| 场景 | 处理 |
|------|------|
| 重复审批 | 检查 `status !== 0`，返回"该申请已审批过" |
| 正在上桌时审批 | 返回"助教正在上桌服务，无法审批通过" |
| 助教已离职 | 审批时检查教练状态，提示"该助教已离职" |

### 7.4 日期相关

| 场景 | 处理 |
|------|------|
| 选择过去日期 | 前端禁用过去日期 + 后端校验 |
| 选择超过30天 | 前端限制 + 后端校验 |
| 同一天既申请休息又申请请假 | 校验日期不重复，返回"该日期已有审批通过的申请" |

### 7.5 图片上传

| 场景 | 处理 |
|------|------|
| 超过3张 | `useImageUpload` 限制 + 前端提示 |
| 上传失败 | 重试 + 错误上报 |
| 图片 URL 格式 | 存 JSON 数组：`["url1","url2","url3"]` |

---

## 八、权限设计

### 8.1 前端页面权限

| 页面 | 助教(`isCoach`) | 管理(`isManager`) |
|------|:-:|:-:|
| 班次切换申请 | ✅ | ❌ |
| 休息申请 | ✅ | ❌ |
| 请假申请 | ✅ | ❌ |
| 班次切换审批 | ❌ | ✅ |
| 请假审批 | ❌ | ✅ |
| 休息审批 | ❌ | ✅ |

### 8.2 后端 API 权限

| API | 权限要求 | 说明 |
|-----|---------|------|
| POST /api/applications | `['all']` | 助教可提交（已有） |
| GET /api/applications | `['all']` | 助教可查自己的（已有） |
| PUT /:id/approve | `['coachManagement']` | 管理审批（已有） |
| GET /pending-count | `['coachManagement']` | 管理查看待审批数 |
| GET /shift-stats | `['coachManagement']` | 管理查看班次统计 |
| DELETE /:id | `['all']` | 助教取消自己的申请 |
| GET /my-month-count | `['all']` | 助教查自己月度次数 |

### 8.3 权限矩阵更新

在 `PERMISSION_MATRIX` 和 `FRONTEND_PERMISSION_MATRIX` 中**无需新增权限字段**，
因为：
- 助教通过 `COACH_ALLOWED_PERMISSIONS` 中的 `'all'` 已可访问 applications API
- 管理通过 `coachManagement` 已有审批权限
- 前端通过 `isCoach` / `isManager` 计算属性控制页面可见性

---

## 九、实施步骤建议

1. **数据库**：新增索引（可合入 v2.1.sql 或新建 v2.2.sql）
2. **后端定时器服务**：新建 `application-timer.js`，在 server.js 初始化
3. **后端 API**：修改 `applications.js`，新增 validTypes、限制逻辑、新端点
4. **前端工具**：修改 `api-v2.js`、`time-util.js`
5. **前端页面**：6 个新页面
6. **前端首页**：修改 `internal-home.vue`
7. **路由注册**：修改 `pages.json`
8. **测试**：三种申请的完整提交流程、审批流程、定时器、取消、次数限制

---

## 十、与现有代码的兼容性

- **不修改** `leave-apply.vue`（公休申请）和 `leave-approval.vue`（公休审批），保持现有功能不变
- **不修改** `overtime-apply.vue` 和 `overtime-approval.vue`
- **不修改** `lejuan` 相关页面和 `lejuan-records` API
- 新增 API 与现有 API 共享同一 `/api/applications` 路由前缀
- 定时器服务独立于 `lejuan-timer.js`，互不干扰
- 现有 validTypes 中保留 `早加班申请`、`晚加班申请`、`公休申请`、`约客记录`，新增3个类型，移除 `乐捐报备`

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