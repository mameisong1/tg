# 乐捐功能优化 - 技术设计方案

> **日期**: 2026-04-15  
> **设计者**: 程序员A（阿天）  
> **QA编号**: QA-20260415-02

---

## 一、需求概述

### 前台H5乐捐报备页面
1. 删除"预计外出小时数"表单组件
2. 更新乐捐流程提示文字（删除"找助教管理/店长点乐捐归来"相关内容，改为"助教自己点上班按钮结束乐捐"）
3. 乐捐中状态允许点"上班"按钮，点击后乐捐结束，回到空闲状态（保持原班次）
4. 乐捐报备页面记录列表：待出发/乐捐中的记录置顶
5. 重复报备检查：有待出发或乐捐中记录时，提交新乐捐时弹提示（不阻止进入页面）

### 前台H5乐捐一览页面
6. 删除"乐捐归来"按钮
7. 显示乐捐截图（默认小图，点击放大）— **已有实现，无需改动**

---

## 二、现状代码分析

### 2.1 涉及文件清单

| 文件 | 路径 | 角色 |
|------|------|------|
| 乐捐报备页 | `tgservice-uniapp/src/pages/internal/lejuan.vue` | 前端 |
| 乐捐一览页 | `tgservice-uniapp/src/pages/internal/lejuan-list.vue` | 前端 |
| 上班/下班页 | `tgservice-uniapp/src/pages/internal/clock.vue` | 前端 |
| 乐捐API | `tgservice/backend/routes/lejuan-records.js` | 后端 |
| 助教上班API | `tgservice/backend/routes/coaches.js` | 后端 |
| 乐捐定时器 | `tgservice/backend/services/lejuan-timer.js` | 后端 |

### 2.2 数据库表 `lejuan_records` 现有字段

```sql
id, coach_no, employee_id, stage_name, scheduled_start_time,
extra_hours, remark, lejuan_status (pending/active/returned),
scheduled, actual_start_time, return_time, lejuan_hours,
proof_image_url, proof_image_updated_at,
created_at, updated_at, created_by, returned_by
```

**结论：无需新增字段，使用现有 `proof_image_url` 存储乐捐截图。**

### 2.3 关键现状

#### 报备页 `lejuan.vue`
- **流程提示文字**（第14-16行）：
  ```html
  <view class="hint-banner">
    <text class="hint-title">📌 乐捐流程</text>
    <text class="hint-text">1.选择日期时间提交预约 → 2.到时间自动变为乐捐状态 → 3.回店后找助教管理/店长点击乐捐归来 → 4.提交付款截图</text>
  </view>
  ```
- 表单包含"预计外出小时数"picker（第41行起，`form.extraHours`，选项1-8小时）
- 提交时调用 `api.lejuanRecords.create()`，传入 `extra_hours`（第194行）
- 记录列表按 `scheduled_start_time DESC` 排序，无状态优先级

#### 一览页 `lejuan-list.vue`
- **付款截图展示**（第92-95行）：
  ```html
  <view class="lj-proof" v-if="item.proof_image_url" @click="previewProof(item.proof_image_url)">
    <text class="lj-proof-label">付款截图</text>
    <image :src="item.proof_image_url" mode="aspectFill" class="lj-proof-thumb" />
  </view>
  ```
  - 小图尺寸 50x50（样式第263行：`.lj-proof-thumb { width: 50px; height: 50px; border-radius: 6px; }`）
  - 点击调用 `previewProof(url)` → `uni.previewImage({ urls: [url] })`（第180-182行）
  - **✅ 已有实现，无需改动**
  - 用户反馈"看不到图片"原因：数据中 `proof_image_url` 为 NULL 的记录不显示图片区域（`v-if` 条件），并非前端缺组件
- `active` 状态显示"乐捐归来"按钮（第99-102行），调用 `handleReturn()` → `api.lejuanRecords.returnRecord()`（第184行起）
- 后端列表已有排序：`active → pending → returned`（需求4的后端已就绪）

#### 上班页 `clock.vue`
- `canClockIn` 计算属性排除了 `'乐捐'` 状态
- 注释明确："乐捐状态不能自行上班，必须由助教管理/店长操作乐捐归来"

#### 上班API `coaches.js` POST `/coaches/v2/:coach_no/clock-in`
- 当前代码第46行：`if (waterBoard.status === '乐捐') throw '乐捐状态无法自行上班...'`
- 上班逻辑：根据班次设置水牌为 `早班空闲` 或 `晚班空闲`

#### 乐捐创建API `lejuan-records.js` POST `/lejuan-records`
- 已有重复检查：检查 `pending` 或 `active` 状态，返回400错误
- **需修改**：从"阻止提交"改为"弹提示但允许进入页面"

---

## 三、技术方案

### 3.1 数据库变更

**无变更。** 所有功能使用现有字段。

---

### 3.2 前端修改

#### 修改1：`lejuan.vue` — 删除"预计外出小时数"组件

**位置**: `tgservice-uniapp/src/pages/internal/lejuan.vue`

**改动内容**:

1. **Template**: 删除整个"预计外出小时数" form-item（约第41-48行）
   ```html
   <!-- 删除以下整个 form-item -->
   <view class="form-item">
     <text class="form-label">预计外出小时数（可选）</text>
     <picker :range="hourOptions2" ...>
       ...
     </picker>
   </view>
   ```

2. **Script**: 
   - 删除 `hourOptions2` 常量（`[1, 2, 3, 4, 5, 6, 7, 8]`）
   - 删除 `form.extraHours` 初始化
   - `submitLejuan()` 中删除 `extra_hours` 参数
   - 重置时删除 `form.value.extraHours = null`

3. **API调用变更**:
   ```javascript
   // 修改前
   await api.lejuanRecords.create({
     employee_id: coachInfo.value.employeeId,
     scheduled_start_time: scheduledTime,
     extra_hours: form.value.extraHours,
     remark: form.value.remark
   })

   // 修改后
   await api.lejuanRecords.create({
     employee_id: coachInfo.value.employeeId,
     scheduled_start_time: scheduledTime,
     remark: form.value.remark
   })
   ```

#### 修改2：`lejuan.vue` — 更新乐捐流程提示文字

**位置**: `tgservice-uniapp/src/pages/internal/lejuan.vue` 第14-16行

**改动内容**: 修改 `.hint-text` 文案，反映新的乐捐结束流程

```html
<!-- 修改前 -->
<text class="hint-text">1.选择日期时间提交预约 → 2.到时间自动变为乐捐状态 → 3.回店后找助教管理/店长点击乐捐归来 → 4.提交付款截图</text>

<!-- 修改后 -->
<text class="hint-text">1.选择日期时间提交预约 → 2.到时间自动变为乐捐状态 → 3.助教自己点"上班"按钮结束乐捐 → 4.提交付款截图</text>
```

**变更要点**:
- 删除"回店后找助教管理/店长"表述
- 改为"助教自己点'上班'按钮结束乐捐"
- 不再涉及"预计外出小时数"相关内容

#### 修改3：`lejuan.vue` — 记录排序（待出发/乐捐中置顶）

**位置**: `tgservice-uniapp/src/pages/internal/lejuan.vue` → `loadMyRecords()`

**改动内容**: 后端返回的记录在前端按状态排序

```javascript
const loadMyRecords = async () => {
  try {
    const res = await api.lejuanRecords.getMyList({ employee_id: coachInfo.value.employeeId })
    let records = res.data || []
    // 排序：乐捐中 > 待出发 > 已归来
    const statusPriority = { active: 0, pending: 1, returned: 2 }
    records.sort((a, b) => {
      const pa = statusPriority[a.lejuan_status] ?? 9
      const pb = statusPriority[b.lejuan_status] ?? 9
      if (pa !== pb) return pa - pb
      return b.scheduled_start_time.localeCompare(a.scheduled_start_time)
    })
    myRecords.value = records
  } catch (e) {
    // 静默失败
  }
}
```

#### 修改4：`lejuan.vue` — 重复报备检查（提交时弹提示）

**位置**: `tgservice-uniapp/src/pages/internal/lejuan.vue` → `submitLejuan()`

**改动内容**: 提交前检查已有待出发/乐捐中记录，弹提示后中止

```javascript
const submitLejuan = async () => {
  if (!canSubmit.value) return uni.showToast({ title: '请选择日期和时间', icon: 'none' })

  // 检查是否有待出发或乐捐中的记录
  const activeRecord = myRecords.value.find(r => 
    r.lejuan_status === 'pending' || r.lejuan_status === 'active'
  )
  if (activeRecord) {
    const statusText = activeRecord.lejuan_status === 'pending' ? '待出发' : '乐捐中'
    return uni.showToast({ 
      title: `已有${statusText}的乐捐记录，请先处理`, 
      icon: 'none',
      duration: 3000
    })
  }

  const scheduledTime = `${form.value.scheduledDate} ${String(form.value.scheduledHour).padStart(2, '0')}:00:00`
  // ... 后续提交逻辑不变
}
```

**说明**: 助教仍可进入报备页面（因为要上传照片凭证），只是在"提交预约"时检查并弹提示。

#### 修改5：`lejuan-list.vue` — 删除"乐捐归来"按钮

**位置**: `tgservice-uniapp/src/pages/internal/lejuan-list.vue`

**改动内容**:

1. **Template**: 删除 `lj-actions` 整个区块（约第99-103行）
   ```html
   <!-- 删除以下整个区块 -->
   <view class="lj-actions" v-if="item.lejuan_status === 'active'">
     <view class="lj-btn-return" @click="handleReturn(item)">
       <text class="lj-btn-text">乐捐归来</text>
     </view>
   </view>
   ```

2. **Script**: 删除 `handleReturn` 函数（第184行起，不再需要）

3. **Style**: 可保留 `.lj-actions` 等样式（不影响功能），或清理

#### 修改6：`clock.vue` — 乐捐状态允许点上班

**位置**: `tgservice-uniapp/src/pages/internal/clock.vue`

**改动内容**: `canClockIn` 计算属性增加 `'乐捐'` 状态

```javascript
// 修改前
const canClockIn = computed(() => {
  if (!waterBoard.value) return false
  const status = waterBoard.value.status
  return ['早加班', '晚加班', '休息', '公休', '请假', '下班'].includes(status)
})

// 修改后
const canClockIn = computed(() => {
  if (!waterBoard.value) return false
  const status = waterBoard.value.status
  return ['早加班', '晚加班', '休息', '公休', '请假', '下班', '乐捐'].includes(status)
})
```

---

### 3.3 后端修改

#### 修改7：`coaches.js` — 上班API处理乐捐结束

**位置**: `tgservice/backend/routes/coaches.js` → `POST /:coach_no/clock-in`

**改动内容**: 当水牌状态为 `'乐捐'` 时，先结束乐捐记录，再设置水牌为空闲

```javascript
// 修改前（第44-46行附近）
if (waterBoard.status === '乐捐') {
  throw { status: 400, error: '乐捐状态无法自行上班，请联系助教管理或店长' };
}

// 修改后
// 乐捐状态：自动结束乐捐，然后进入空闲
if (waterBoard.status === '乐捐') {
  // 查找该助教的 active 乐捐记录
  const activeLejuan = await tx.get(
    `SELECT id, actual_start_time FROM lejuan_records 
     WHERE coach_no = ? AND lejuan_status = 'active' 
     ORDER BY actual_start_time DESC LIMIT 1`,
    [coach_no]
  );

  if (activeLejuan) {
    const nowDB = TimeUtil.nowDB();
    // 计算外出小时数（向上取整，最小1小时）
    const actualStart = new Date(activeLejuan.actual_start_time + '+08:00');
    const nowTime = new Date(nowDB + '+08:00');
    const diffMs = nowTime.getTime() - actualStart.getTime();
    const lejuanHours = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)));

    // 更新乐捐记录为已归来
    await tx.run(
      `UPDATE lejuan_records 
       SET lejuan_status = 'returned',
           return_time = ?,
           lejuan_hours = ?,
           returned_by = ?,
           updated_at = ?
       WHERE id = ? AND lejuan_status = 'active'`,
      [nowDB, lejuanHours, req.user.username || employee_id, nowDB, activeLejuan.id]
    );
  }
  // 继续执行后续的上班逻辑（设水牌为空闲）
}
```

**注意**: 修改后需要删除原有的 `else if` 链中的乐捐判断分支，让代码继续走到设置 `newStatus` 的逻辑。

完整修改区域（约第44-57行）:
```javascript
// 修改前
if (waterBoard.status === '乐捐') {
  throw { status: 400, error: '乐捐状态无法自行上班，请联系助教管理或店长' };
} else if (['早加班', '休息', '公休', '请假', '下班'].includes(waterBoard.status)) {
  newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
} else if (waterBoard.status === '早班空闲' || waterBoard.status === '晚班空闲') {
  throw { status: 400, error: '助教已在班状态，无需重复上班' };
} else {
  if (waterBoard.status === '早班上桌' || waterBoard.status === '晚班上桌') {
    throw { status: 400, error: '上桌状态不能点上班' };
  }
  newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
}

// 修改后
let lejuanEnded = false;
if (waterBoard.status === '乐捐') {
  // 自动结束乐捐，然后进入空闲
  const activeLejuan = await tx.get(
    `SELECT id, actual_start_time FROM lejuan_records 
     WHERE coach_no = ? AND lejuan_status = 'active' 
     ORDER BY actual_start_time DESC LIMIT 1`,
    [coach_no]
  );

  if (activeLejuan) {
    const nowDB = TimeUtil.nowDB();
    const actualStart = new Date(activeLejuan.actual_start_time + '+08:00');
    const nowTime = new Date(nowDB + '+08:00');
    const diffMs = nowTime.getTime() - actualStart.getTime();
    const lejuanHours = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)));

    await tx.run(
      `UPDATE lejuan_records 
       SET lejuan_status = 'returned',
           return_time = ?,
           lejuan_hours = ?,
           returned_by = ?,
           updated_at = ?
       WHERE id = ? AND lejuan_status = 'active'`,
      [nowDB, lejuanHours, req.user.username || 'system', nowDB, activeLejuan.id]
    );
    lejuanEnded = true;
  }
  newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
} else if (['早加班', '休息', '公休', '请假', '下班'].includes(waterBoard.status)) {
  newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
} else if (waterBoard.status === '早班空闲' || waterBoard.status === '晚班空闲') {
  throw { status: 400, error: '助教已在班状态，无需重复上班' };
} else {
  if (waterBoard.status === '早班上桌' || waterBoard.status === '晚班上桌') {
    throw { status: 400, error: '上桌状态不能点上班' };
  }
  newStatus = coach.shift === '早班' ? '早班空闲' : '晚班空闲';
}
```

#### 修改8：`lejuan-records.js` — 创建API的重复检查

**位置**: `tgservice/backend/routes/lejuan-records.js` → `POST /`

**当前代码**（约第58-65行）已有重复检查，**保持不变**。

前端已有重复检查（修改4），后端也保留检查作为双重保障。两者行为一致：返回400错误 + 错误信息。

#### 修改9：`lejuan-records.js` — 列表排序（前端报备页的"我的记录"）

**位置**: `tgservice/backend/routes/lejuan-records.js` → `GET /my`

**当前代码**排序: `ORDER BY scheduled_start_time DESC`

**修改为**: 乐捐中/待出发优先

```sql
-- 修改前
ORDER BY scheduled_start_time DESC

-- 修改后
ORDER BY 
    CASE lejuan_status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
    scheduled_start_time DESC
```

这样前端报备页的"近2天记录"也会自动按状态优先级排序，前端的二次排序（修改3）作为兜底。

---

## 四、修改文件汇总

| # | 文件 | 修改内容 | 变更类型 |
|---|------|---------|---------|
| 1 | `tgservice-uniapp/src/pages/internal/lejuan.vue` | 删除"预计外出小时数"组件及相关逻辑 | 前端 |
| 2 | `tgservice-uniapp/src/pages/internal/lejuan.vue` | 更新乐捐流程提示文字 | 前端 |
| 3 | `tgservice-uniapp/src/pages/internal/lejuan.vue` | 记录列表排序：待出发/乐捐中置顶 | 前端 |
| 4 | `tgservice-uniapp/src/pages/internal/lejuan.vue` | 提交时检查重复报备，弹提示 | 前端 |
| 5 | `tgservice-uniapp/src/pages/internal/lejuan-list.vue` | 删除"乐捐归来"按钮及 handleReturn 函数 | 前端 |
| 6 | `tgservice-uniapp/src/pages/internal/clock.vue` | canClockIn 增加 '乐捐' 状态 | 前端 |
| 7 | `tgservice/backend/routes/coaches.js` | clock-in API 处理乐捐状态：自动结束乐捐并设空闲 | 后端 |
| 8 | `tgservice/backend/routes/lejuan-records.js` | /my 接口排序优化（active/pending 优先） | 后端 |

---

## 五、数据表变更

**无变更。** 使用现有 `lejuan_records` 表和 `proof_image_url` 字段。

---

## 六、前后端交互流程变更

### 6.1 乐捐报备流程（不变）

```
助教选择日期时间 → 提交报备 → 后端创建 pending 记录
→ 到时间定时器自动激活为 active → 水牌变为"乐捐"
```

### 6.2 乐捐结束流程（变更）

**旧流程**:
```
水牌"乐捐" → 助教管理/店长在乐捐一览页点"乐捐归来" → 计算小时数 → 水牌变空闲
```

**新流程**:
```
水牌"乐捐" → 助教在上班/下班页点"上班" → 后端自动结束乐捐(计算小时数) → 水牌变空闲
```

### 6.3 重复报备检查（新增）

```
助教进入报备页面（允许） → 填写表单 → 点"提交预约"
→ 前端检查 myRecords 中是否有 pending/active → 有则弹提示
→ 同时后端也会检查并返回 400（双重保障）
```

---

## 七、修改A & B 代码验证记录

### 修改A：乐捐报备页面 - 流程提示文字

**验证方式**: 直接读取 `/TG/tgservice-uniapp/src/pages/internal/lejuan.vue` 第14-16行

**当前代码**:
```html
<!-- 第14-16行 -->
<view class="hint-banner">
  <text class="hint-title">📌 乐捐流程</text>
  <text class="hint-text">1.选择日期时间提交预约 → 2.到时间自动变为乐捐状态 → 3.回店后找助教管理/店长点击乐捐归来 → 4.提交付款截图</text>
</view>
```

**需修改为**:
```html
<view class="hint-banner">
  <text class="hint-title">📌 乐捐流程</text>
  <text class="hint-text">1.选择日期时间提交预约 → 2.到时间自动变为乐捐状态 → 3.助教自己点"上班"按钮结束乐捐 → 4.提交付款截图</text>
</view>
```

### 修改B：乐捐一览页面 - 显示乐捐截图

**验证方式**: 直接读取 `/TG/tgservice-uniapp/src/pages/internal/lejuan-list.vue` 第92-95行 + 后端列表接口

**前端已有实现**（第92-95行）:
```html
<view class="lj-proof" v-if="item.proof_image_url" @click="previewProof(item.proof_image_url)">
  <text class="lj-proof-label">付款截图</text>
  <image :src="item.proof_image_url" mode="aspectFill" class="lj-proof-thumb" />
</view>
```

**previewProof 函数**（第180-182行）:
```javascript
const previewProof = (url) => {
  uni.previewImage({ urls: [url] })
}
```

**样式**（第261-263行）:
```css
.lj-proof { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 8px; }
.lj-proof-label { font-size: 11px; color: rgba(255,255,255,0.4); }
.lj-proof-thumb { width: 50px; height: 50px; border-radius: 6px; }
```

**后端列表接口**（lejuan-records.js 第162行）:
```sql
SELECT * FROM lejuan_records 
ORDER BY scheduled_start_time DESC
```
→ `SELECT *` 包含 `proof_image_url` 字段

**结论**: ✅ 前端已有 proof_image_url 小图展示 + 点击放大预览功能，后端接口也返回该字段，**无需改动代码**。

**用户反馈"看不到图片"的可能原因**:
1. 乐捐记录中 `proof_image_url` 字段为 NULL（助教尚未上传截图）
2. 只有"已归来"状态的记录才可能有截图（流程是：归来后 → 上传截图）
3. 建议排查：检查数据库中是否有 proof_image_url 非空的记录

---

## 八、风险提示

1. **乐捐定时器冲突**: 助教点上班结束乐捐后，如果该乐捐之前设了定时器，定时器触发时记录已不是 `pending` 状态，`activateLejuan()` 中已有检查会跳过（第24-27行：`if (!record) { console.log(...跳过); return; }`），**无冲突风险**。

2. **并发安全**: 上班API的乐捐结束逻辑在 `runInTransaction` 事务内执行，`lejuan_records` 更新使用 `WHERE id = ? AND lejuan_status = 'active'` 条件，**不会出现重复结束**。

3. **已有乐捐记录**: 上线后，已处于 `active` 状态的乐捐记录可以通过新的"上班"按钮结束，无需数据迁移。

---

## 九、测试要点

| # | 测试场景 | 预期结果 |
|---|---------|---------|
| 1 | 报备页面不显示"预计外出小时数" | 表单项已删除 |
| 2 | 报备页面流程提示文字更新 | 显示"助教自己点上班按钮结束乐捐" |
| 3 | 提交报备时不带 extra_hours | 后端正常创建记录 |
| 4 | 乐捐中状态下点"上班" | 上班成功，乐捐自动结束，水牌变空闲 |
| 5 | 上班后查看乐捐记录 | 状态变为"已归来"，有 lejuan_hours 和 return_time |
| 6 | 有待出发/乐捐中记录时再次提交 | 弹提示"已有XX的乐捐记录，请先处理" |
| 7 | 乐捐一览页无"乐捐归来"按钮 | 按钮已删除 |
| 8 | 乐捐一览页截图展示（有 proof_image_url 的记录） | 小图50x50展示，点击放大预览 |
| 9 | 报备页记录排序 | 乐捐中 > 待出发 > 已归来 |
