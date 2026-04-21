# QA-20260421-1 技术设计方案

## 需求概要

### 需求1:水牌上加助教等级标志

**需求描述**:在水牌页面的助教卡片上显示等级图标(青铜/白银/黄金/钻石),仅针对特定状态的卡片。

**目标状态**:
- 早班空闲
- 早班上桌
- 晚班空闲
- 晚班上桌
- 乐捐

**等级对应图标**(差别明显):
| 等级 | 图标 | 说明 |
|------|------|------|
| 初级 | 🛡️ 或 SVG盾牌 | 青铜盾牌(颜色 #CD7F32,盾牌形状) |
| 中级 | ⭐ 或 SVG星星 | 白银星星(颜色 #E8E8E8,五角星) |
| 高级 | 👑 或 SVG皇冠 | 黄金皇冠(颜色 #FFD700,皇冠形状) |
| 女神 | 💎 或 SVG钻石 | 钛金钻石(蓝白渐变,菱形) |

**设计要点**:
- 青铜=盾牌(守护之意),黄金=皇冠(荣耀之意)--形状完全不同
- 四个等级用四种不同形状:盾牌/星星/皇冠/钻石
- 视觉上一眼就能区分

### 需求2:上班打卡提交截图

**需求描述**:助教上班打卡时,要求提交一张打卡截图证明。

**复用要求**:
- 前端复用公共图片上传模块 `useImageUpload`(已存在于 `/TG/tgservice-uniapp/src/utils/image-upload.js`)
- 图片上传到 OSS 临时目录 `TgTemp/`
- 数据复用现有 `attendance_records` 表

### 霹求3:新增打卡审查页面(H5内部页面)

**需求描述**:前台H5会员中心新增打卡审查页面,供店长/助教管理/管理员查看打卡记录。

**入口**:前台H5会员中心页面的管理功能版块的管理分组里

**页面路径**:`/TG/tgservice-uniapp/src/pages/internal/attendance-review.vue`

**权限**:店长、助教管理、管理员

**功能要点**:
- 日期切换:今天-早班、今天-晚班、昨天-早班、昨天-晚班(4个按钮)
- 显示字段:工号、艺名、班次、上班打卡时间、下班时间、打卡记录照片、早晚加班小时数、是否迟到
- 迟到判断:应上班时间(早班14:00,晚班18:00),如有加班则顺延;上班打卡时间 > 应上班时间 = 迟到
- 排序:打卡时间倒序

---

## 技术方案设计

### 一、需求1:水牌等级标志

#### 1.1 数据来源

**现有数据**:`coaches` 表已有 `level` 字段,值为:初级/中级/高级/女神

```sql
-- coaches 表结构(已存在)
CREATE TABLE coaches (
  coach_no INTEGER PRIMARY KEY,
  employee_id TEXT,      -- 助教工号(显示用)
  stage_name TEXT,       -- 艺名
  level TEXT DEFAULT '初级',  -- 等级字段已存在
  ...
);
```

#### 1.2 API变更

**无需新增API**,现有水牌查询 API 已返回 coach 信息:

```
GET /api/water-boards
```

返回数据已包含关联的 coach 信息,需要确保返回 `level` 字段。

**修改点**:`routes/water-boards.js` 的查询 SQL 需要添加 `level` 字段:

```javascript
// 修改前
SELECT wb.coach_no, wb.stage_name, wb.status, wb.table_no, wb.updated_at, wb.clock_in_time, c.shift, c.photos, c.employee_id
FROM water_boards wb
LEFT JOIN coaches c ON wb.coach_no = c.coach_no

// 修改后(添加 level 字段)
SELECT wb.coach_no, wb.stage_name, wb.status, wb.table_no, wb.updated_at, wb.clock_in_time,
       c.shift, c.photos, c.employee_id, c.level
FROM water_boards wb
LEFT JOIN coaches c ON wb.coach_no = c.coach_no
```

#### 1.3 前端变更

**修改文件**:
- `/TG/tgservice-uniapp/src/pages/internal/water-board.vue`(水牌管理页面)
- `/TG/tgservice-uniapp/src/pages/internal/water-board-view.vue`(水牌查看页面)

**实现方式**：

1. **等级图标设计**：使用不同形状的图标，视觉差异明显
   - 青铜：🛡️ 盾牌（#CD7F32）——守护之意
   - 白银：⭐ 星星（#E8E8E8）——五角星
   - 黄金：👑 皇冠（#FFD700）——荣耀之意
   - 女神：💎 钻石（蓝白渐变）——钻石形状

2. **显示位置**：在助教卡片右上角或头像右下角添加等级徽章

3. **显示条件**：仅在以下状态时显示等级标志
   ```javascript
   const showLevelStatuses = ['早班空闲', '早班上桌', '晚班空闲', '晚班上桌', '乐捐'];
   const shouldShowLevel = (status) => showLevelStatuses.includes(status);
   ```

4. **代码示例**：
   ```vue
   <template>
     <view class="coach-card">
       <image class="coach-avatar" :src="getCoachPhoto(coach)" />
       <!-- 等级徽章 -->
       <view class="level-badge" :class="'level-' + coach.level" 
             v-if="shouldShowLevel(coach.status)">
         <text class="level-icon">{{ getLevelIcon(coach.level) }}</text>
       </view>
       <text class="coach-id">{{ coach.employee_id || '未知' }}</text>
       <text class="coach-name">{{ coach.stage_name }}</text>
     </view>
   </template>
   
   <script>
   const getLevelIcon = (level) => {
     const icons = {
       '初级': '🛡️',  // 青铜盾牌
       '中级': '⭐',   // 白银星星
       '高级': '👑',   // 黄金皇冠
       '女神': '💎'    // 钛金钻石
     };   
     return icons[level] || ''; 
   };

   const shouldShowLevel = (status) => {
     return ['早班空闲', '早班上桌', '晚班空闲', '晚班上桌', '乐捐'].includes(status);
   };
   </script>

   <style>
   .level-badge {
     position: absolute;
     top: 2px;
     right: 2px;
     width: 20px;
     height: 20px;
     border-radius: 50%;
     display: flex;
     align-items: center;
     justify-content: center;
   }
   .level-badge.level-初级 { background: #CD7F32; }  /* 青铜 */
   .level-badge.level-中级 { background: #E8E8E8; }  /* 白银 */
   .level-badge.level-高级 { background: #FFD700; }  /* 黄金 */
   .level-badge.level-女神 { background: linear-gradient(135deg, #B9F2FF, #FFFFFF); }  /* 钛金 */
   </style>
   ```

#### 1.4 影响范围

| 文件 | 修改内容 |
|------|----------|
| `routes/water-boards.js` | 查询 SQL 添加 `c.level` 字段 |
| `water-board.vue` | 添加等级徽章显示逻辑 |
| `water-board-view.vue` | 添加等级徽章显示逻辑 |

---

### 二、需求2:上班打卡提交截图

#### 2.1 数据库变更

**修改表**:`attendance_records` 表新增字段

```sql
-- v2.3-attendance-photo.sql
ALTER TABLE attendance_records ADD COLUMN clock_in_photo TEXT;
-- 存储打卡截图 URL(JSON数组格式,支持多图,虽然需求是1张,但预留扩展)
```

**迁移文件位置**:`/TG/tgservice/backend/db/migrations/v2.3-attendance-photo.sql`

#### 2.2 API变更

**新增API**:修改上班打卡接口,接收打卡截图

```
POST /api/coaches/:coach_no/clock-in
```

**请求参数变更**:

```javascript
// 原参数
{ } // 无参数

// 新参数
{
  clock_in_photo: string  // 图片URL(单张或JSON数组)
}
```

**后端修改**:`routes/coaches.js` 的 `clock-in` 接口

```javascript
router.post('/:coach_no/clock-in', auth.required, ..., async (req, res) => {
  const { clock_in_photo } = req.body;  // 新增参数

  // ... 原有逻辑 ...

  // 写入打卡记录时添加 photo 字段
  await tx.run(`
    INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, clock_in_photo, ...)
    VALUES (?, ?, ?, ?, ?, ?, ...)
  `, [todayStr, coach_no, coach.employee_id, coach.stage_name, nowDB, clock_in_photo || null, ...]);
});
```

#### 2.3 前端变更

**修改文件**:`/TG/tgservice-uniapp/src/pages/internal/clock.vue`

**实现方式**:

1. **复用公共模块**:引入 `useImageUpload`

```javascript
import { useImageUpload } from '@/utils/image-upload.js'

const { imageUrls, uploading, uploadProgress, uploadText, chooseAndUpload, removeImage } =
  useImageUpload({ maxCount: 1, ossDir: 'TgTemp/', errorType: 'clock_in_photo' })
```

2. **修改打卡流程**:
   - 上班打卡前先选择图片
   - 图片上传成功后,携带 URL 调用打卡接口

```vue
<template>
  <!-- 原内容保持不变 -->

  <!-- 新增:打卡截图上传区域 -->
  <view class="photo-section">
    <text class="photo-title">上传打卡截图(必填)</text>
    <view class="photo-grid">
      <view v-if="imageUrls.length > 0" class="photo-item">
        <image :src="imageUrls[0]" mode="aspectFill" class="photo-img" @click="previewImage" />
        <view class="photo-remove" @click="removeImage(0)"><text>✕</text></view>
      </view>
      <view v-else class="photo-upload" @click="chooseAndUpload">
        <text class="photo-icon">📷</text>
        <text class="photo-text">点击上传</text>
      </view>
    </view>
    <text class="photo-tip">请拍摄能证明您已到岗的照片</text>
  </view>

  <!-- 上传进度 -->
  <view class="upload-progress" v-if="uploading">
    <text>{{ uploadText }}</text>
    <view class="progress-bar">
      <view class="progress-fill" :style="{ width: uploadProgress + '%' }"></view>
    </view>
  </view>

  <!-- 原打卡按钮 -->
  <view class="action-section">
    <view class="action-btn clock-in-btn"
          :class="{ disabled: !canClockIn || imageUrls.length === 0 }"
          @click="handleClockIn">
      <text class="action-icon">⏰</text>
      <text class="action-text">上班</text>
    </view>
    ...
  </view>
</template>

<script setup>
import { useImageUpload } from '@/utils/image-upload.js'

const { imageUrls, uploading, chooseAndUpload, removeImage } =
  useImageUpload({ maxCount: 1, ossDir: 'TgTemp/', errorType: 'clock_in' })

const handleClockIn = async () => {
  if (!canClockIn.value) return
  if (imageUrls.value.length === 0) {
    uni.showToast({ title: '请先上传打卡截图', icon: 'none' })
    return
  }

  try {
    uni.showLoading({ title: '上班中...' })
    await api.coachesV2.clockIn(coachInfo.value.coachNo, {
      clock_in_photo: imageUrls.value[0]  // 传递图片URL
    })
    uni.hideLoading()
    uni.showToast({ title: '上班成功', icon: 'success' })
    await loadWaterBoard()
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '上班失败', icon: 'none' })
  }
}
</script>
```

#### 2.4 API调用变更

**修改API调用方法**:`utils/api-v2.js`

```javascript
// coachesV2.clockIn 需要支持传递参数
clockIn: async (coachNo, data = {}) => {
  return await request(`/api/coaches/${coachNo}/clock-in`, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}
```

#### 2.5 边界情况

| 场景 | 处理方式 |
|------|----------|
| 未上传图片点击上班 | Toast提示"请先上传打卡截图",按钮禁用 |
| 图片上传失败 | 显示错误提示,允许重新上传 |
| 图片过大 | 由 `useImageUpload` 模块自动压缩 |
| 网络中断上传 | 显示"网络错误,请检查网络连接" |

---

### 三、需求3:打卡审查页面

#### 3.1 数据库查询

**查询逻辑**:从 `attendance_records` 表查询打卡记录,关联 `coaches` 表获取班次和加班信息。

```sql
-- 查询指定日期和班次的打卡记录
SELECT
  ar.employee_id,
  ar.stage_name,
  c.shift,
  ar.clock_in_time,
  ar.clock_out_time,
  ar.clock_in_photo,
  -- 计算加班小时数(从 applications 表查询当天已批准的加班申请)
  (
    SELECT COALESCE(
      JSON_EXTRACT(extra_data, '$.hours'), 0
    ) FROM applications
    WHERE applicant_phone = c.phone
      AND application_type LIKE '%加班申请'
      AND status = 1
      AND date(created_at) = ar.date
    LIMIT 1
  ) as overtime_hours,
  -- 判断是否迟到
  CASE
    WHEN ar.clock_in_time IS NULL THEN NULL
    WHEN c.shift = '早班' AND
      ar.clock_in_time > TIME(ar.date || ' ' ||
        CASE WHEN overtime_hours > 0 THEN '14:00:00' ELSE '14:00:00' END  -- 简化:加班顺延暂不实现复杂逻辑
      , '+08:00') THEN 1
    WHEN c.shift = '晚班' AND
      ar.clock_in_time > TIME(ar.date || ' 18:00:00', '+08:00') THEN 1
    ELSE 0
  END as is_late
FROM attendance_records ar
LEFT JOIN coaches c ON ar.coach_no = c.coach_no
WHERE ar.date IN (?, ?)  -- 今天/昨天
ORDER BY ar.clock_in_time DESC
```

**迟到判断逻辑细化**:
- 早班应上班时间:14:00
- 晚班应上班时间:18:00
- 如果有加班申请(早加班/晚加班),应上班时间顺延加班小时数
  - 例:早班 + 早加班2小时 → 应上班时间 = 14:00 - 2小时 = 12:00
- 判断:`clock_in_time > 应上班时间` = 迟到

#### 3.2 API新增

**新增路由文件**:`/TG/tgservice/backend/routes/attendance-review.js`

```javascript
/**
 * 打卡审查 API
 * 路径: /api/attendance-review
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const TimeUtil = require('../utils/time');

/**
 * GET /api/attendance-review
 * 获取打卡审查列表
 *
 * Query params:
 * - date: 日期(YYYY-MM-DD),默认今天
 * - shift: 班次(早班/晚班),可选
 */
router.get('/', auth.required, requireBackendPermission(['店长', '助教管理', '管理员']), async (req, res) => {
  try {
    const { date, shift } = req.query;

    // 构建日期参数
    const todayStr = TimeUtil.todayStr();
    const yesterdayDate = new Date(todayStr + 'T00:00:00+08:00');
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = TimeUtil.formatDateObj(yesterdayDate);

    // 查询条件
    let dateFilter = date || todayStr;
    if (shift) {
      // 指定班次查询
      const records = await getRecordsByDateAndShift(dateFilter, shift);
      res.json({ success: true, data: records });
    } else {
      // 默认查询今天的记录
      const records = await getRecordsByDateAndShift(todayStr, null);
      res.json({ success: true, data: records });
    }
  } catch (error) {
    console.error('获取打卡审查列表失败:', error);
    res.status(500).json({ success: false, error: '获取打卡审查列表失败' });
  }
});

// 辅助函数:查询指定日期和班次的打卡记录
async function getRecordsByDateAndShift(dateStr, shiftFilter) {
  const sql = `
    SELECT
      ar.employee_id,
      ar.stage_name,
      c.shift,
      ar.clock_in_time,
      ar.clock_out_time,
      ar.clock_in_photo,
      ar.date,
      -- 查询当天加班申请的小时数
      (
        SELECT COALESCE(
          CAST(JSON_EXTRACT(extra_data, '$.hours') AS INTEGER), 0
        ) FROM applications
        WHERE applicant_phone = c.phone
          AND (application_type = '早加班申请' OR application_type = '晚加班申请')
          AND status = 1
          AND date(created_at) = ar.date
        LIMIT 1
      ) as overtime_hours,
      -- 判断是否迟到
      CASE
        WHEN ar.clock_in_time IS NULL THEN 0
        WHEN c.shift = '早班' THEN
          CASE
            WHEN ar.clock_in_time > ar.date || ' ' ||
              CASE WHEN (
                SELECT COALESCE(CAST(JSON_EXTRACT(extra_data, '$.hours') AS INTEGER), 0)
                FROM applications
                WHERE applicant_phone = c.phone AND application_type = '早加班申请' AND status = 1 AND date(created_at) = ar.date LIMIT 1
              ) > 0
              THEN printf('%02d:00:00', 14 - overtime_hours)  -- 顺延加班时间
              ELSE '14:00:00'
              END
            THEN 1
            ELSE 0
          END
        WHEN c.shift = '晚班' THEN
          CASE
            WHEN ar.clock_in_time > ar.date || ' ' ||
              CASE WHEN overtime_hours > 0
              THEN printf('%02d:00:00', 18 - overtime_hours)
              ELSE '18:00:00'
              END
            THEN 1
            ELSE 0
          END
        ELSE 0
      END as is_late
    FROM attendance_records ar
    LEFT JOIN coaches c ON ar.coach_no = c.coach_no
    WHERE ar.date = ?
      AND (? IS NULL OR c.shift = ?)
    ORDER BY ar.clock_in_time DESC
  `;

  const records = await db.all(sql, [dateStr, shiftFilter, shiftFilter]);

  // 解析打卡照片(JSON数组或单URL)
  return records.map(r => ({
    ...r,
    clock_in_photo_list: parsePhotoUrls(r.clock_in_photo),
    is_late_text: r.is_late === 1 ? '迟到' : '正常',
    overtime_hours: r.overtime_hours || 0
  }));
}

function parsePhotoUrls(photoStr) {
  if (!photoStr) return [];
  try {
    const parsed = JSON.parse(photoStr);
    return Array.isArray(parsed) ? parsed : [photoStr];
  } catch (e) {
    return [photoStr];
  }
}

module.exports = router;
```

#### 3.3 前端新增页面(H5内部页面)

**新增文件**:`/TG/tgservice-uniapp/src/pages/internal/attendance-review.vue`(H5内部页面)

**入口位置**:`/TG/tgservice-uniapp/src/pages/member/member.vue`的管理功能版块的管理分组里

**页面结构**:

```vue
<template>
  <view class="page">
    <!-- 标题 -->
    <view class="page-header">
      <text class="page-title">打卡审查</text>
    </view>
    
    <!-- 日期班次切换 -->
    <view class="date-shift-tabs">
      <view class="date-shift-btn" :class="{ active: currentDate === 'today' && currentShift === '早班' }" 
            @click="selectDateShift('today', '早班')">
        <text>今天-早班</text>
      </view>
      <view class="date-shift-btn" :class="{ active: currentDate === 'today' && currentShift === '晚班' }" 
            @click="selectDateShift('today', '晚班')">
        <text>今天-晚班</text>
      </view>
      <view class="date-shift-btn" :class="{ active: currentDate === 'yesterday' && currentShift === '早班' }" 
            @click="selectDateShift('yesterday', '早班')">
        <text>昨天-早班</text>
      </view>
      <view class="date-shift-btn" :class="{ active: currentDate === 'yesterday' && currentShift === '晚班' }" 
            @click="selectDateShift('yesterday', '晚班')">
        <text>昨天-晚班</text>
      </view>
    </view>
    
    <!-- 打卡记录列表 -->
    <view class="attendance-list">
      <view v-if="records.length === 0" class="empty-tip">
        <text>暂无打卡记录</text>
      </view>
      <view v-for="record in records" :key="record.employee_id + record.clock_in_time" class="record-card">
        <view class="record-header">
          <text class="record-id">{{ record.employee_id || '-' }}号</text>
          <text class="record-name">{{ record.stage_name }}</text>
          <text class="record-shift">{{ record.shift }}</text>
        </view>
        <view class="record-body">
          <view class="record-row">
            <text class="label">上班时间:</text>
            <text class="value">{{ formatTime(record.clock_in_time) }}</text>
          </view>
          <view class="record-row">
            <text class="label">下班时间:</text>
            <text class="value">{{ formatTime(record.clock_out_time) || '-' }}</text>
          </view>
          <view class="record-row">
            <text class="label">加班小时:</text>
            <text class="value">{{ record.overtime_hours || 0 }}小时</text>
          </view>
        </view>
        <!-- 打卡照片 -->
        <view class="record-photo" v-if="record.clock_in_photo">
          <image :src="record.clock_in_photo" mode="aspectFill" class="photo-img" @click="previewPhoto(record.clock_in_photo)" />
        </view>
        <!-- 迟到状态 -->
        <view class="late-badge" :class="{ 'is-late': record.is_late === 1 }">
          <text>{{ record.is_late === 1 ? '迟到' : '正常' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api-v2.js'
import { format, toDate } from '@/utils/time-util.js'

const currentDate = ref('today')
const currentShift = ref('早班')
const records = ref([])

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return ''
  const d = toDate(timeStr)
  if (!d) return timeStr
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 选择日期班次
const selectDateShift = async (dateType, shift) => {
  currentDate.value = dateType
  currentShift.value = shift
  await loadRecords()
}

// 加载打卡记录
const loadRecords = async () => {
  try {
    const todayStr = TimeUtil.today()
    let dateStr = todayStr
    if (currentDate.value === 'yesterday') {
      const d = toDate(todayStr)
      d.setDate(d.getDate() - 1)
      dateStr = format(d, 'YYYY-MM-DD')
    }
    const result = await api.getAttendanceReview({ date: dateStr, shift: currentShift.value })
    records.value = result.data || []
  } catch (e) {
    uni.showToast({ title: e.error || '加载失败', icon: 'none' })
  }
}

// 预览照片
const previewPhoto = (url) => {
  uni.previewImage({ urls: [url] })
}

onMounted(() => {
  loadRecords()
})
</script>

<style scoped>
.page { padding: 20px; background: #1a1a2e; min-height: 100vh; }
.page-header { margin-bottom: 20px; }
.page-title { font-size: 20px; color: #FFD700; font-weight: bold; }

.date-shift-tabs { display: flex; gap: 10px; margin-bottom: 20px; }
.date-shift-btn {
  padding: 8px 16px; border-radius: 8px; background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6);
}
.date-shift-btn.active { background: rgba(218,165,32,0.3); color: #FFD700; }

.record-card { background: rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.record-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.record-id { color: #FFD700; font-weight: bold; }
.record-name { color: #fff; font-size: 16px; }
.record-shift { color: rgba(255,255,255,0.5); font-size: 12px; }

.record-row { display: flex; margin-bottom: 8px; }
.label { color: rgba(255,255,255,0.5); width: 80px; }
.value { color: #fff; }

.record-photo { margin-top: 12px; }
.photo-img { width: 80px; height: 80px; border-radius: 8px; }

.late-badge { padding: 4px 8px; border-radius: 12px; font-size: 12px; }
.late-badge.is-late { background: rgba(231,76,60,0.2); color: #e74c3c; }
.late-badge:not(.is-late) { background: rgba(46,204,113,0.2); color: #2ecc71; }
</style>
```

#### 3.4 页面入口配置

**修改文件**:`/TG/tgservice-uniapp/src/pages/member/member.vue`

在管理功能版块的管理分组里添加入口按钮:

```vue
<!-- 管理功能版块的管理分组 -->
<view class="internal-group" v-if="memberInfo.memberNo && isManager">
  <view class="group-title">管理分组</view>
  <view class="manage-rows">
    <!-- 现有按钮保持不变 -->
    
    <!-- 新增:打卡审查按钮 -->
    <view class="manage-item" @click="goAttendanceReview">
      <text class="manage-icon">📋</text>
      <text class="manage-text">打卡审查</text>
    </view>
  </view>
</view>

<script>
// 新增跳转函数
const goAttendanceReview = () => {
  uni.navigateTo({ url: '/pages/internal/attendance-review' })
}
</script>
```

#### 3.5 pages.json配置

**修改文件**:`/TG/tgservice-uniapp/src/pages.json`

新增页面路由:

```json
{
  "path": "pages/internal/attendance-review",
  "style": {
    "navigationBarTitleText": "打卡审查",
    "navigationBarBackgroundColor": "#1a1a2e",
    "navigationBarTextStyle": "white"
  }
}
```

#### 3.6 影响范围

| 文件 | 修改内容 |
|------|----------|
| `routes/attendance-review.js` | 新增打卡审查API |
| `pages/internal/attendance-review.vue` | 新增H5打卡审查页面 |
| `pages/member/member.vue` | 添加入口按钮 |
| `pages.json` | 添加页面路由 |
| `server.js` | 注册路由 |

---

## 四、边界情况和异常处理

### 4.1 水牌等级标志

| 场景 | 处理方式 |
|------|----------|
| 等级字段为空 | 不显示等级徽章 |
| 等级值非法 | 显示默认图标或不显示 |
| 状态不在目标列表 | 不显示等级徽章 |

### 4.2 打卡截图

| 场景 | 处理方式 |
|------|----------|
| 未上传图片点击上班 | Toast提示“请先上传打卡截图”,按钮禁用 |
| 图片上传失败 | 显示错误提示,允许重新上传 |
| 图片过大 | 自动压缩 |
| 网络中断 | 显示“网络错误,请检查网络连接” |

### 4.3 打卡审查

| 场景 | 处理方式 |
|------|----------|
| 无打卡记录 | 显示“暂无打卡记录” |
| 加班申请未关联 | overtime_hours = 0 |
| 下班时间为空 | 显示“-”或“未下班” |
| 照片URL无效 | 显示占位图或隐藏 |

---

## 五、测试要点

### P0核心测试

1. **水牌等级**:
   - API返回level字段
   - 仅特定状态显示等级
   - 图标视觉差异明显(盾牌/星星/皇冠/钻石)

2. **打卡截图**:
   - API接收clock_in_photo参数
   - 数据库写入正确
   - 前端上传流程正常

3. **打卡审查**:
   - API权限验证(店长/助教管理/管理员)
   - 迟到判断正确
   - 数据按时间倒序

---

## 六、时间线估算

| 任务 | 预估时间 |
|------|----------|
| 水牌等级标志 | 2小时 |
| 打卡截图 | 1小时 |
| 打卡审查页面(H5) | 2小时 |
| 测试验证 | 1小时 |
| **总计** | **6小时** |
