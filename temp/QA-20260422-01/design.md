# QA-20260422-01 打卡审查改进 - 设计方案

> 设计者：程序员A | 日期：2026-04-22

---

## 一、需求理解

| # | 需求 | 说明 |
|---|------|------|
| 1 | 打卡表新增两个字段 | `is_late`（是否迟到）、`is_reviewed`（是否审查完毕） |
| 2 | 上班打卡时计算迟到 | 提交上班打卡时，根据班次+加班情况计算是否迟到，写入打卡表 |
| 3 | 打卡审查按钮加角标 | 显示"当天迟到且未审查"的人数 |
| 4 | 审查页面新增两条提示 | ①审查打卡时间和截图时间是否一致 ②处理迟到的处罚 |
| 5 | 审查页面不再计算迟到 | 直接读取打卡表的 `is_late` 字段 |
| 6 | 每条未审查数据增加审查完毕按钮 | 逐条标记为已审查 |

---

## 二、现状分析

### 2.1 现有数据库表 `attendance_records`

```sql
CREATE TABLE attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    coach_no INTEGER NOT NULL,
    employee_id TEXT,
    stage_name TEXT NOT NULL,
    clock_in_time TEXT,
    clock_out_time TEXT,
    clock_in_photo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**当前缺失字段**：`is_late`、`is_reviewed`

### 2.2 现有上班打卡 API（`/api/coaches/v2/:coach_no/clock-in`）

- 位置：`/TG/tgservice/backend/routes/coaches.js`
- 当前逻辑：写入 `attendance_records` 时，**不计算** `is_late`
- 使用 `runInTransaction` 事务，符合编码规范

### 2.3 现有打卡审查 API（`/api/attendance-review`）

- 位置：`/TG/tgservice/backend/routes/attendance-review.js`
- 当前逻辑：**每次查询时动态计算**是否迟到
  - 早班应上班时间：`14:00 - 早加班小时数`
  - 晚班应上班时间：`18:00 - 晚加班小时数`
  - 比较 `clock_in_time > expectedTime` 判断是否迟到
- 前端 `attendance-review.vue` 使用 `record.is_late_text` 显示

### 2.4 现有打卡审查按钮

- 位置：`/TG/tgservice-uniapp/src/pages/member/member.vue` 第 227 行
- 当前：无角标
- 参考模式：审批按钮组（第 263-296 行）已有角标实现

### 2.5 现有角标实现模式

```vue
<view class="internal-btn" @click="navigateTo('...')">
  <text class="internal-btn-text">xxx</text>
  <view class="badge" v-if="xxxCount > 0">{{ xxxCount }}</view>
</view>
```

- `.badge` CSS 已定义（红色圆角角标，absolute 定位）
- 数据通过 `loadPendingCounts()` 从 API 加载

---

## 三、技术方案

### 3.1 数据库变更

**文件**：`/TG/tgservice/backend/db/migrations/v2.4-attendance-late-reviewed.sql`（新增）

```sql
-- v2.4: 打卡表新增迟到和审查状态字段
-- 日期：2026-04-22
-- 说明：上班打卡时预计算迟到状态，审查页面直接读取

ALTER TABLE attendance_records ADD COLUMN is_late INTEGER DEFAULT 0;
ALTER TABLE attendance_records ADD COLUMN is_reviewed INTEGER DEFAULT 0;

-- 查询优化索引
CREATE INDEX IF NOT EXISTS idx_attendance_late_unreviewed 
    ON attendance_records(date, is_late, is_reviewed);
```

**字段说明**：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `is_late` | INTEGER | 0 | 0=正常, 1=迟到 |
| `is_reviewed` | INTEGER | 0 | 0=未审查, 1=已审查 |

**执行方式**：
- 在测试环境执行：`sqlite3 /TG/tgservice/db/tgservice.db < backend/db/migrations/v2.4-attendance-late-reviewed.sql`
- ⚠️ **生产环境数据库由用户自行操作，不得自动执行**

---

### 3.2 后端变更

#### 3.2.1 修改：上班打卡 API 计算迟到

**文件**：`/TG/tgservice/backend/routes/coaches.js`

**变更位置**：上班打卡路由中的 `INSERT INTO attendance_records` 语句

**修改内容**：

```javascript
// 新增：计算是否迟到
const isLate = calculateIsLate(nowDB, coach.shift, coach.coach_no, todayStr, tx);

// 修改 INSERT，增加 is_late 字段
await tx.run(`
  INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, clock_out_time, clock_in_photo, is_late, is_reviewed, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 0, ?, ?)
`, [todayStr, coach_no, coach.employee_id, coach.stage_name, nowDB, clock_in_photo || null, isLate, nowDB, nowDB]);
```

**新增辅助函数** `calculateIsLate(clockInTime, shift, coachNo, date, tx)`：

```javascript
/**
 * 计算是否迟到
 * @param {string} clockInTime - 打卡时间 "YYYY-MM-DD HH:MM:SS"
 * @param {string} shift - 班次 "早班" 或 "晚班"
 * @param {number} coachNo - 助教工号
 * @param {string} date - 日期 "YYYY-MM-DD"
 * @param {object} tx - 数据库事务对象
 * @returns {number} 0=正常, 1=迟到
 */
async function calculateIsLate(clockInTime, shift, coachNo, date, tx) {
  if (!shift) return 0;

  // 查询当天已审批的加班申请小时数
  const coach = await tx.get(
    'SELECT phone FROM coaches WHERE coach_no = ?',
    [coachNo]
  );
  if (!coach || !coach.phone) return 0;

  const app = await tx.get(`
    SELECT COALESCE(CAST(JSON_EXTRACT(extra_data, '$.hours') AS INTEGER), 0) as hours
    FROM applications
    WHERE applicant_phone = ?
      AND application_type IN ('早加班申请', '晚加班申请')
      AND status = 1
      AND date(created_at) = ?
    LIMIT 1
  `, [coach.phone, date]);

  const overtimeHours = app ? app.hours : 0;

  // 计算应上班时间
  let expectedHour;
  if (shift === '早班') {
    expectedHour = 14 - overtimeHours;
  } else if (shift === '晚班') {
    expectedHour = 18 - overtimeHours;
  } else {
    return 0;
  }

  const expectedTime = `${date} ${String(expectedHour).padStart(2, '0')}:00:00`;

  // 字符串比较（"YYYY-MM-DD HH:MM:SS" 格式可直接比较）
  return clockInTime > expectedTime ? 1 : 0;
}
```

**编码规范检查**：
- ✅ 使用 `TimeUtil` 获取时间（外层已有 `const TimeUtil = require('../utils/time')`）
- ✅ 使用 `tx.run()` / `tx.get()` 在事务内操作
- ✅ 使用 `runInTransaction` 包裹
- ❌ 禁止使用 `datetime('now')` 或手动时区偏移

---

#### 3.2.2 修改：打卡审查列表 API 读取 is_late

**文件**：`/TG/tgservice/backend/routes/attendance-review.js`

**变更 1**：SQL 查询增加 `ar.is_late`, `ar.is_reviewed` 字段

```javascript
const sql = `
  SELECT
    ar.employee_id,
    ar.stage_name,
    c.shift,
    ar.clock_in_time,
    ar.clock_out_time,
    ar.clock_in_photo,
    ar.date,
    ar.coach_no,
    ar.is_late,          -- 新增
    ar.is_reviewed,      -- 新增
    c.phone,
    ...
```

**变更 2**：删除 `parsedRecords.map()` 中的动态计算逻辑（约第 56-78 行）

```javascript
// 删除以下代码：
// let isLate = 0;
// if (r.clock_in_time && r.shift) { ... }

// 改为直接读取数据库字段：
return {
  ...
  is_late: r.is_late || 0,
  is_late_text: (r.is_late === 1) ? '迟到' : '正常',
  is_reviewed: r.is_reviewed || 0,
  ...
};
```

---

#### 3.2.3 新增：打卡审查角标计数 API

**文件**：`/TG/tgservice/backend/routes/attendance-review.js`

**新增路由**：

```javascript
/**
 * GET /api/attendance-review/pending-count
 * 获取当天迟到且未审查的人数（用于角标）
 */
router.get('/pending-count', auth.required, requireBackendPermission(['店长', '助教管理', '管理员']), async (req, res) => {
  try {
    const todayStr = TimeUtil.todayStr();
    const result = await db.get(
      'SELECT COUNT(*) as cnt FROM attendance_records WHERE date = ? AND is_late = 1 AND is_reviewed = 0',
      [todayStr]
    );
    res.json({
      success: true,
      data: { count: result.cnt || 0 }
    });
  } catch (error) {
    console.error('获取打卡审查待审数量失败:', error);
    errorLogger.logApiRejection(req, error);
    res.status(500).json({ success: false, error: '获取打卡审查待审数量失败' });
  }
});
```

**编码规范检查**：
- ✅ 使用 `db.get()`（从 `../db` 导入的 `get` 方法）
- ✅ 使用 `TimeUtil.todayStr()` 获取日期
- ✅ 权限校验：`requireBackendPermission(['店长', '助教管理', '管理员'])`

---

#### 3.2.4 新增：标记审查完毕 API

**文件**：`/TG/tgservice/backend/routes/attendance-review.js`

**新增路由**：

```javascript
/**
 * PUT /api/attendance-review/:id/review
 * 标记单条打卡记录为已审查
 * 
 * 参数：
 * - id: attendance_records 表的主键 ID
 */
router.put('/:id/review', auth.required, requireBackendPermission(['店长', '助教管理', '管理员']), async (req, res) => {
  try {
    const { id } = req.params;
    const nowDB = TimeUtil.nowDB();

    const result = await db.run(
      'UPDATE attendance_records SET is_reviewed = 1, updated_at = ? WHERE id = ?',
      [nowDB, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '打卡记录不存在' });
    }

    res.json({ success: true, data: { id: parseInt(id) } });
  } catch (error) {
    console.error('标记审查完毕失败:', error);
    errorLogger.logApiRejection(req, error);
    res.status(500).json({ success: false, error: '标记审查完毕失败' });
  }
});
```

---

### 3.3 前端变更

#### 3.3.1 修改：member.vue 打卡审查按钮加角标

**文件**：`/TG/tgservice-uniapp/src/pages/member/member.vue`

**变更 1**：在打卡审查按钮上增加 badge

找到第 227-230 行的打卡审查按钮：

```vue
<!-- 修改前 -->
<view class="internal-btn" @click="navigateTo('/pages/internal/attendance-review')">
  <text class="internal-btn-icon">📋</text>
  <text class="internal-btn-text">打卡审查</text>
</view>

<!-- 修改后 -->
<view class="internal-btn" @click="navigateTo('/pages/internal/attendance-review')">
  <text class="internal-btn-icon">📋</text>
  <text class="internal-btn-text">打卡审查</text>
  <view class="badge" v-if="attendanceReviewCount > 0">{{ attendanceReviewCount }}</view>
</view>
```

**变更 2**：新增 ref 变量

在 `const lejuanCount = ref(0)` 之后（约第 1190 行）添加：

```javascript
const attendanceReviewCount = ref(0)
```

**变更 3**：在 `loadPendingCounts()` 函数中加载计数

```javascript
const loadPendingCounts = async () => {
  try {
    // ... 原有代码 ...

    // 新增：加载打卡审查待审数量
    const arRes = await api.attendanceReview.getPendingCount()
    attendanceReviewCount.value = arRes.data?.count || 0
  } catch (e) {
    // ... 原有 catch ...
  }
}
```

**变更 4**：将 `attendanceReviewCount` 加入 `postMessage` 数据

在 `postMessage` 中的 `state` 对象添加 `attendanceReviewCount` 字段。

---

#### 3.3.2 修改：api-v2.js 新增 API

**文件**：`/TG/tgservice-uniapp/src/utils/api-v2.js`

在 `attendanceReview` 对象中添加：

```javascript
export const attendanceReview = {
  getList: (params) => request({ url: '/attendance-review', data: params }),
  getPendingCount: () => request({ url: '/attendance-review/pending-count' }),   // 新增
  markReviewed: (id) => request({ url: `/attendance-review/${id}/review`, method: 'PUT' })  // 新增
}
```

---

#### 3.3.3 修改：attendance-review.vue 审查页面

**文件**：`/TG/tgservice-uniapp/src/pages/internal/attendance-review.vue`

**变更 1**：页面顶部新增两条提示信息

在日期班次切换栏之后、打卡记录列表之前添加：

```vue
<!-- 审查提示 -->
<view class="review-tips">
  <view class="tip-item">
    <text class="tip-icon">📌</text>
    <text class="tip-text">请审查打卡时间和截图时间是否一致</text>
  </view>
  <view class="tip-item">
    <text class="tip-icon">⚠️</text>
    <text class="tip-text">迟到人员请按迟到处罚规则处理</text>
  </view>
</view>
```

**变更 2**：每条记录增加审查完毕按钮

修改记录卡片模板：

```vue
<view v-for="(record, index) in records" :key="index" class="record-card">
  <view class="record-header">
    <text class="record-id">{{ record.employee_id }}号</text>
    <text class="record-name">{{ record.stage_name }}</text>
    <text class="record-shift">{{ record.shift }}</text>
    <view class="late-badge" :class="{ 'is-late': record.is_late === 1 }">
      <text>{{ record.is_late_text }}</text>
    </view>
  </view>
  <view class="record-content">
    <view class="record-info">
      <!-- 原有内容 -->
    </view>
    <view class="record-photo" v-if="record.clock_in_photo">
      <image :src="record.clock_in_photo" mode="aspectFill" class="photo-img" @click="previewPhoto(record.clock_in_photo)" />
    </view>
  </view>
  <!-- 新增：审查完毕按钮（未审查时显示） -->
  <view v-if="record.is_reviewed === 0" class="review-action">
    <view class="review-btn" @click="handleMarkReviewed(record)">
      <text>审查完毕</text>
    </view>
  </view>
  <view v-else class="review-done">
    <text class="done-text">✓ 已审查</text>
  </view>
</view>
```

**变更 3**：新增 `handleMarkReviewed` 方法

```javascript
// 标记审查完毕
const handleMarkReviewed = async (record) => {
  uni.showModal({
    title: '确认',
    content: '确定标记此条打卡记录为已审查吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '处理中...' })
          await api.attendanceReview.markReviewed(record.id)
          uni.hideLoading()
          uni.showToast({ title: '已标记', icon: 'success' })
          // 重新加载列表
          await loadRecords()
        } catch (e) {
          uni.hideLoading()
          uni.showToast({ title: e.error || '操作失败', icon: 'none' })
        }
      }
    }
  })
}
```

**注意**：`attendance_records` 表的主键 `id` 需要在前端可用。当前 SQL 查询未返回 `id`，需要在后端 SQL 中添加 `ar.id` 字段，前端数据中也需包含 `id`。

**变更 4**：CSS 样式

```css
/* 审查提示 */
.review-tips { margin: 0 16px 16px; padding: 12px; background: rgba(255,193,7,0.1); border: 1px solid rgba(255,193,7,0.3); border-radius: 10px; }
.tip-item { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.tip-item:last-child { margin-bottom: 0; }
.tip-icon { font-size: 14px; }
.tip-text { font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.4; }

/* 审查操作按钮 */
.review-action { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); }
.review-btn { height: 32px; background: rgba(46,204,113,0.2); border: 1px solid rgba(46,204,113,0.3); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.review-btn text { font-size: 13px; color: #2ecc71; font-weight: 600; }
.review-done { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center; }
.done-text { font-size: 12px; color: rgba(46,204,113,0.6); }
```

**变更 5**：后端 SQL 补充 `ar.id` 字段

在 `attendance-review.js` 的 SQL 查询中，在 SELECT 列表最前面添加：

```sql
SELECT
  ar.id,                -- 新增：记录主键ID，供审查按钮使用
  ar.employee_id,
  ...
```

前端 `parsedRecords` 返回中增加 `id: r.id`。

---

## 四、文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/db/migrations/v2.4-attendance-late-reviewed.sql` | **新增** | 数据库迁移脚本 |
| `backend/routes/coaches.js` | **修改** | 上班打卡时计算 is_late |
| `backend/routes/attendance-review.js` | **修改** | 读取 is_late、新增 pending-count 和 review 接口 |
| `src/utils/api-v2.js` | **修改** | 新增 getPendingCount、markReviewed API |
| `src/pages/member/member.vue` | **修改** | 打卡审查按钮加角标 |
| `src/pages/internal/attendance-review.vue` | **修改** | 提示、审查按钮、显示 is_reviewed |

---

## 五、前后端交互流程

### 5.1 上班打卡流程（需求 1、2）

```
助教端 clock.vue
  └─ 上传打卡截图 → 点击"上班"
     └─ POST /api/coaches/v2/{coach_no}/clock-in
        { clock_in_photo: "https://..." }
        │
        后端 coaches.js
        ├─ 获取助教信息（shift、phone）
        ├─ 查询当天加班申请小时数
        ├─ 计算 expectedTime = (14或18 - overtimeHours):00:00
        ├─ 比较 clockInTime > expectedTime → is_late
        └─ INSERT attendance_records (..., is_late, is_reviewed=0, ...)
           │
           返回 { success: true, data: { coach_no, stage_name, status } }
```

### 5.2 打卡审查列表 + 角标流程（需求 3、5）

```
member.vue (onShow)
  └─ GET /api/attendance-review/pending-count
     │
     后端 attendance-review.js
     ├─ SELECT COUNT(*) WHERE date=today AND is_late=1 AND is_reviewed=0
     └─ 返回 { success: true, data: { count: 3 } }
        │
        角标显示: attendanceReviewCount = 3

点击"打卡审查"进入 attendance-review.vue
  └─ GET /api/attendance-review?date=2026-04-22&shift=早班
     │
     后端 attendance-review.js
     ├─ SELECT ... is_late, is_reviewed FROM attendance_records ...
     ├─ 直接读取数据库 is_late 字段（不再动态计算）
     └─ 返回每条记录的 is_late、is_late_text、is_reviewed
        │
        前端显示：迟到徽章 + 审查状态 + 审查完毕按钮
```

### 5.3 标记审查完毕流程（需求 6）

```
attendance-review.vue
  └─ 点击某条记录的"审查完毕"按钮
     └─ PUT /api/attendance-review/{id}/review
        │
        后端 attendance-review.js
        ├─ UPDATE attendance_records SET is_reviewed=1 WHERE id=?
        └─ 返回 { success: true }
           │
           前端刷新列表
           该条记录显示"✓ 已审查"
           角标数量 -1
```

---

## 六、边界情况和异常处理

### 6.1 迟到计算边界

| 场景 | 处理 |
|------|------|
| 助教没有班次（shift 为 NULL） | is_late = 0（不判断迟到） |
| 助教没有手机号 | 无法查加班申请，overtimeHours = 0，按默认时间判断 |
| 当天无加班申请 | overtimeHours = 0，早班 14:00、晚班 18:00 |
| 加班时间 > 14 小时 | expectedHour 可能为负数，需限制最小值为 0 |
| 打卡时间为 NULL | 不判断迟到（理论上不会出现） |

**防御性处理**：

```javascript
const expectedHour = Math.max(0, baseHour - overtimeHours);
```

### 6.2 并发安全

- 上班打卡：使用 `runInTransaction` 包裹，确保计算迟到和写入记录在同一事务中
- 标记审查完毕：单条 UPDATE，使用 `db.run`（通过 writeQueue 串行化）
- 角标计数：只读 SELECT，无并发问题

### 6.3 数据一致性

| 场景 | 处理 |
|------|------|
| 历史数据（迁移前已有打卡记录） | ALTER TABLE 后 is_late=0, is_reviewed=0（默认值），历史数据不算迟到 |
| 助教改班次后重新打卡 | 新记录按新班次计算迟到，旧记录不变 |
| 重复打卡 | 现有逻辑允许同一天多条记录，每条独立计算迟到 |

### 6.4 权限控制

- 打卡审查列表：`requireBackendPermission(['店长', '助教管理', '管理员'])`
- 角标计数：同上
- 标记审查完毕：同上
- 上班打卡：`coachSelfOnly: true`（助教只能打自己的卡）

### 6.5 异常处理

| 异常 | 处理 |
|------|------|
| 数据库连接失败 | API 返回 500，前端显示"操作失败" |
| 记录不存在（markReviewed） | 返回 404，前端提示"记录不存在" |
| 网络超时 | 前端 catch 显示错误提示，不自动重试 |

---

## 七、数据库迁移执行说明

### ⚠️ 生产环境数据库操作必须由用户确认

```bash
# 测试环境执行：
sqlite3 /TG/tgservice/db/tgservice.db < backend/db/migrations/v2.4-attendance-late-reviewed.sql

# 生产环境：用户手动执行或确认后执行
# 数据目录：/TG/run/tgservice.db
sqlite3 /TG/run/tgservice.db < backend/db/migrations/v2.4-attendance-late-reviewed.sql
```

**执行后验证**：

```sql
-- 确认新字段存在
PRAGMA table_info(attendance_records);
-- 应该看到 is_late 和 is_reviewed 两列

-- 确认索引创建
SELECT * FROM sqlite_master WHERE type='index' AND name='idx_attendance_late_unreviewed';
```

---

## 八、测试计划（测试环境）

### 8.1 测试步骤

| # | 测试项 | 预期结果 |
|---|--------|----------|
| 1 | 数据库迁移执行 | is_late、is_reviewed 字段存在，默认值为 0 |
| 2 | 早班助教正常时间打卡（14:00 前） | is_late = 0 |
| 3 | 早班助教迟到打卡（14:01） | is_late = 1 |
| 4 | 早班助教有 2 小时早加班，12:01 打卡 | is_late = 1 |
| 5 | 审查页面查看迟到记录 | 显示红色"迟到"徽章，is_late 字段正确 |
| 6 | 点击"审查完毕"按钮 | 记录 is_reviewed 变为 1，显示"✓ 已审查" |
| 7 | 角标数量 | 当天迟到且未审查人数 = 实际数量 |
| 8 | 审查完毕后角标减少 | 角标数量 -1 |
| 9 | 切换日期/班次 | 列表数据正确刷新 |
| 10 | 两条提示显示 | 页面顶部显示黄色提示区域 |

### 8.2 禁止在生产环境测试

> ⚠️ 用户明确要求：没有用户指令不能操作生产环境数据库，不能在生产环境测试。
> 所有测试仅在 PM2 测试环境（tg.tiangong.club:8088）进行。

---

## 九、编码规范检查清单

| 规范项 | 检查点 | 状态 |
|--------|--------|------|
| 🔴 时间处理 | 使用 `TimeUtil.nowDB()` / `TimeUtil.todayStr()` | ✅ |
| 🔴 时间处理 | 禁止 `datetime('now')`、手动时区偏移 | ✅ |
| 🔴 数据库连接 | 使用 `require('../db')` 的导出方法 | ✅ |
| 🔴 数据库连接 | 禁止 `new sqlite3.Database()` | ✅ |
| 🔴 数据库写入 | 使用 `runInTransaction` 或 `enqueueRun` | ✅ |
| 🔴 数据库写入 | 禁止 `db.run('BEGIN TRANSACTION')` | ✅ |
| 🔴 页面显示 | 显示 `employee_id`，不显示 `coach_no` | ✅ |
| 🔴 页面显示 | 禁止 `employee_id \|\| coach_no` 回退 | ✅ |

---

## 十、部署步骤（测试环境）

```bash
# 1. 执行数据库迁移
cd /TG/tgservice && sqlite3 db/tgservice.db < backend/db/migrations/v2.4-attendance-late-reviewed.sql

# 2. 提交代码
cd /TG/tgservice && git add -A && git commit -m "feat: 打卡审查改进 - 新增is_late/is_reviewed字段"
cd /TG/tgservice-uniapp && git add -A && git commit -m "feat: 打卡审查改进 - 角标+审查按钮+提示"

# 3. 重启测试后端
pm2 restart tgservice-dev

# 4. 重新构建 H5
cd /TG/tgservice-uniapp && npm run build:h5:dev
cd /TG/tgservice && ./deploy-h5.sh
pm2 restart tgservice-uniapp-dev

# 5. 验证
pm2 logs tgservice-dev --lines 20
```

---

*设计方案完成。待测试员B验收。*
