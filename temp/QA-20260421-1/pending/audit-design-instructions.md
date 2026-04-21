你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
```
# QA-20260421-1 技术设计方案

## 需求概要

### 需求1：水牌上加助教等级标志

**需求描述**：在水牌页面的助教卡片上显示等级图标（青铜/白银/黄金/钻石），仅针对特定状态的卡片。

**目标状态**：
- 早班空闲
- 早班上桌
- 晚班空闲
- 晚班上桌
- 乐捐

**等级对应图标**：
| 等级 | 图标 | 材质 |
|------|------|------|
| 初级 | 🔸 或自定义SVG | 青铜（暖橙色 #CD7F32） |
| 中级 | 🔹 或自定义SVG | 白银（银色 #C0C0C0） |
| 高级 | 🔶 或自定义SVG | 黄金（金色 #FFD700） |
| 女神 | 💎 或自定义SVG | 钛金/钻石（蓝白渐变） |

**注意**：青铜图标和黄金图标要明显区分，避免混淆。

### 需求2：上班打卡提交截图

**需求描述**：助教上班打卡时，要求提交一张打卡截图证明。

**复用要求**：
- 前端复用公共图片上传模块 `useImageUpload`（已存在于 `/TG/tgservice-uniapp/src/utils/image-upload.js`）
- 图片上传到 OSS 临时目录 `TgTemp/`
- 数据复用现有 `attendance_records` 表

### 霹求3：新增打卡审查页面

**需求描述**：后台管理新增打卡审查页面，供店长/助教管理/管理员查看打卡记录。

**入口**：管理功能版块的管理分组里

**权限**：店长、助教管理、管理员

**功能要点**：
- 日期切换：今天-早班、今天-晚班、昨天-早班、昨天-晚班（4个按钮）
- 显示字段：工号、艺名、班次、上班打卡时间、下班时间、打卡记录照片、早晚加班小时数、是否迟到
- 迟到判断：应上班时间（早班14:00，晚班18:00），如有加班则顺延；上班打卡时间 > 应上班时间 = 迟到
- 排序：打卡时间倒序

---

## 技术方案设计

### 一、需求1：水牌等级标志

#### 1.1 数据来源

**现有数据**：`coaches` 表已有 `level` 字段，值为：初级/中级/高级/女神

```sql
-- coaches 表结构（已存在）
CREATE TABLE coaches (
  coach_no INTEGER PRIMARY KEY,
  employee_id TEXT,      -- 助教工号（显示用）
  stage_name TEXT,       -- 艺名
  level TEXT DEFAULT '初级',  -- 等级字段已存在
  ...
);
```

#### 1.2 API变更

**无需新增API**，现有水牌查询 API 已返回 coach 信息：

```
GET /api/water-boards
```

返回数据已包含关联的 coach 信息，需要确保返回 `level` 字段。

**修改点**：`routes/water-boards.js` 的查询 SQL 需要添加 `level` 字段：

```javascript
// 修改前
SELECT wb.coach_no, wb.stage_name, wb.status, wb.table_no, wb.updated_at, wb.clock_in_time, c.shift, c.photos, c.employee_id
FROM water_boards wb
LEFT JOIN coaches c ON wb.coach_no = c.coach_no

// 修改后（添加 level 字段）
SELECT wb.coach_no, wb.stage_name, wb.status, wb.table_no, wb.updated_at, wb.clock_in_time, 
       c.shift, c.photos, c.employee_id, c.level
FROM water_boards wb
LEFT JOIN coaches c ON wb.coach_no = c.coach_no
```

#### 1.3 前端变更

**修改文件**：
- `/TG/tgservice-uniapp/src/pages/internal/water-board.vue`（水牌管理页面）
- `/TG/tgservice-uniapp/src/pages/internal/water-board-view.vue`（水牌查看页面）

**实现方式**：

1. **等级图标设计**：使用 emoji 或 SVG 图标，颜色区分明显
   - 青铜：🟠 橙色圆形（#CD7F32）
   - 白银：⚪ 银色圆形（#E8E8E8）
   - 黄金：🟡 金色圆形（#FFD700）
   - 女神：💎 钻石图标（蓝白渐变）

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
       '初级': '🟠',  // 青铜（橙色，明显区别于黄金）
       '中级': '⚪',  // 白银（银白色）
       '高级': '🟡',  // 黄金（纯金色）
       '女神': '💎'   // 钛金/钻石
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

### 二、需求2：上班打卡提交截图

#### 2.1 数据库变更

**修改表**：`attendance_records` 表新增字段

```sql
-- v2.3-attendance-photo.sql
ALTER TABLE attendance_records ADD COLUMN clock_in_photo TEXT;
-- 存储打卡截图 URL（JSON数组格式，支持多图，虽然需求是1张，但预留扩展）
```

**迁移文件位置**：`/TG/tgservice/backend/db/migrations/v2.3-attendance-photo.sql`

#### 2.2 API变更

**新增API**：修改上班打卡接口，接收打卡截图

```
POST /api/coaches/:coach_no/clock-in
```

**请求参数变更**：

```javascript
// 原参数
{ } // 无参数

// 新参数
{
  clock_in_photo: string  // 图片URL（单张或JSON数组）
}
```

**后端修改**：`routes/coaches.js` 的 `clock-in` 接口

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

**修改文件**：`/TG/tgservice-uniapp/src/pages/internal/clock.vue`

**实现方式**：

1. **复用公共模块**：引入 `useImageUpload`

```javascript
import { useImageUpload } from '@/utils/image-upload.js'

const { imageUrls, uploading, uploadProgress, uploadText, chooseAndUpload, removeImage } =
  useImageUpload({ maxCount: 1, ossDir: 'TgTemp/', errorType: 'clock_in_photo' })
```

2. **修改打卡流程**：
   - 上班打卡前先选择图片
   - 图片上传成功后，携带 URL 调用打卡接口

```vue
<template>
  <!-- 原内容保持不变 -->
  
  <!-- 新增：打卡截图上传区域 -->
  <view class="photo-section">
    <text class="photo-title">上传打卡截图（必填）</text>
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

**修改API调用方法**：`utils/api-v2.js`

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
| 未上传图片点击上班 | Toast提示"请先上传打卡截图"，按钮禁用 |
| 图片上传失败 | 显示错误提示，允许重新上传 |
| 图片过大 | 由 `useImageUpload` 模块自动压缩 |
| 网络中断上传 | 显示"网络错误，请检查网络连接" |

---

### 三、需求3：打卡审查页面

#### 3.1 数据库查询

**查询逻辑**：从 `attendance_records` 表查询打卡记录，关联 `coaches` 表获取班次和加班信息。

```sql
-- 查询指定日期和班次的打卡记录
SELECT 
  ar.employee_id,
  ar.stage_name,
  c.shift,
  ar.clock_in_time,
  ar.clock_out_time,
  ar.clock_in_photo,
  -- 计算加班小时数（从 applications 表查询当天已批准的加班申请）
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
        CASE WHEN overtime_hours > 0 THEN '14:00:00' ELSE '14:00:00' END  -- 简化：加班顺延暂不实现复杂逻辑
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

**迟到判断逻辑细化**：
- 早班应上班时间：14:00
- 晚班应上班时间：18:00
- 如果有加班申请（早加班/晚加班），应上班时间顺延加班小时数
  - 例：早班 + 早加班2小时 → 应上班时间 = 14:00 - 2小时 = 12:00
- 判断：`clock_in_time > 应上班时间` = 迟到

#### 3.2 API新增

**新增路由文件**：`/TG/tgservice/backend/routes/attendance-review.js`

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
 * - date: 日期（YYYY-MM-DD），默认今天
 * - shift: 班次（早班/晚班），可选
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

// 辅助函数：查询指定日期和班次的打卡记录
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
  
  // 解析打卡照片（JSON数组或单URL）
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

#### 3.3 前端新增页面

**新增文件**：`/TG/tgservice/admin/attendance-review.html`

**页面结构**：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>打卡审查 - 天宫国际</title>
  <link rel="stylesheet" href="sidebar.css">
  <style>
    /* 页面样式（参考其他后台页面） */
    .date-shift-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
    .date-shift-btn { 
      padding: 8px 16px; 
      border: 1px solid rgba(218,165,32,0.3); 
      background: rgba(20,20,30,0.6); 
      color: rgba(255,255,255,0.6); 
      border-radius: 6px; 
      cursor: pointer; 
    }
    .date-shift-btn.active { 
      background: rgba(218,165,32,0.25); 
      color: #FFD700; 
      border-color: rgba(218,165,32,0.6); 
    }
    
    .attendance-table { width: 100%; background: rgba(20,20,30,0.6); border-radius: 12px; }
    .attendance-table th, .attendance-table td { padding: 12px 16px; text-align: left; }
    .attendance-table th { background: rgba(212,175,55,0.1); color: rgba(255,255,255,0.7); }
    
    .photo-thumb { width: 60px; height: 60px; border-radius: 8px; cursor: pointer; }
    .late-badge { 
      padding: 4px 8px; 
      border-radius: 12px; 
      font-size: 12px; 
      background: rgba(231,76,60,0.2); 
      color: #e74c3c; 
    }
    .normal-badge { 
      padding: 4px 8px; 
      border-radius: 12px; 
      font-size: 12px; 
      background: rgba(46,204,113,0.2); 
      color: #2ecc71; 
    }
  </style>
</head>
<body>
  <div class="sidebar"></div>
  <div class="main">
    <div class="page-header">
      <div class="page-title">打卡审查</div>
    </div>
    
    <!-- 日期班次切换 -->
    <div class="date-shift-tabs">
      <button class="date-shift-btn active" data-date="today" data-shift="早班">今天-早班</button>
      <button class="date-shift-btn" data-date="today" data-shift="晚班">今天-晚班</button>
      <button class="date-shift-btn" data-date="yesterday" data-shift="早班">昨天-早班</button>
      <button class="date-shift-btn" data-date="yesterday" data-shift="晚班">昨天-晚班</button>
    </div>
    
    <!-- 打卡记录表格 -->
    <table class="attendance-table">
      <thead>
        <tr>
          <th>工号</th>
          <th>艺名</th>
          <th>班次</th>
          <th>上班时间</th>
          <th>下班时间</th>
          <th>打卡照片</th>
          <th>加班小时</th>
          <th>迟到状态</th>
        </tr>
      </thead>
      <tbody id="attendanceBody">
        <tr><td colspan="8" style="text-align:center;color:rgba(255,255,255,0.3)">加载中...</td></tr>
      </tbody>
    </table>
  </div>
  
  <script src="js/time-util.js"></script>
  <script src="sidebar.js"></script>
  <script>
    const token = localStorage.getItem('adminToken');
    
    // 初始化
    let currentDate = 'today';
    let currentShift = '早班';
    
    // 格式化时间
    function formatTime(timeStr) {
      if (!timeStr) return '-';
      return timeStr.substring(11, 16);  // 只显示 HH:MM
    }
    
    // 加载打卡记录
    async function loadAttendance() {
      const todayStr = TimeUtil.today();
      const yesterdayDate = new Date(todayStr + 'T00:00:00+08:00');
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = yesterdayDate.toISOString().substring(0, 10);
      
      const dateStr = currentDate === 'today' ? todayStr : yesterdayStr;
      
      try {
        const res = await fetch(`/api/attendance-review?date=${dateStr}&shift=${currentShift}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (!data.success) {
          document.getElementById('attendanceBody').innerHTML = 
            `<tr><td colspan="8" style="text-align:center;color:#e74c3c">${data.error}</td></tr>`;
          return;
        }
        
        const records = data.data || [];
        if (records.length === 0) {
          document.getElementById('attendanceBody').innerHTML = 
            `<tr><td colspan="8" style="text-align:center;color:rgba(255,255,255,0.3)">暂无打卡记录</td></tr>`;
          return;
        }
        
        document.getElementById('attendanceBody').innerHTML = records.map(r => `
          <tr>
            <td>${r.employee_id || '-'}</td>
            <td>${r.stage_name || '-'}</td>
            <td>${r.shift || '-'}</td>
            <td>${formatTime(r.clock_in_time)}</td>
            <td>${formatTime(r.clock_out_time)}</td>
            <td>
              ${r.clock_in_photo_list && r.clock_in_photo_list.length > 0 
                ? `<img class="photo-thumb" src="${r.clock_in_photo_list[0]}" onclick="previewPhoto('${r.clock_in_photo_list[0]}')">` 
                : '-'}
            </td>
            <td>${r.overtime_hours || 0}h</td>
            <td>
              <span class="${r.is_late === 1 ? 'late-badge' : 'normal-badge'}">
                ${r.is_late_text}
              </span>
            </td>
          </tr>
        `).join('');
      } catch (e) {
        document.getElementById('attendanceBody').innerHTML = 
          `<tr><td colspan="8" style="text-align:center;color:#e74c3c">加载失败</td></tr>`;
      }
    }
    
    // 切换日期班次
    document.querySelectorAll('.date-shift-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.date-shift-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDate = btn.dataset.date;
        currentShift = btn.dataset.shift;
        loadAttendance();
      });
    });
    
    // 预览照片
    function previewPhoto(url) {
      window.open(url, '_blank');
    }
    
    // 初始加载
    loadAttendance();
  </script>
</body>
</html>
```

#### 3.4 菜单入口

**修改文件**：`/TG/tgservice/admin/sidebar.js`

**添加菜单项**：

```javascript
var MENU_CONFIG = [
  // ... 原有菜单 ...
  
  // 【管理】分组
  { label: '打卡审查', icon: '⏰', href: 'attendance-review.html', group: '管理' },
];

// 分组图标
var GROUP_ICONS = {
  '前厅': '🏠',
  '助教管理': '👩‍🎓',
  '设备管理': '💡',
  '系统': '⚙️',
  '人事': '👥',
  '管理': '📊'  // 新增分组
};

// 权限配置
var ROLE_ALLOWED = {
  '管理员': 'all',
  '店长': 'all',  // 包含打卡审查
  '助教管理': 'all',  // 包含打卡审查
  // ... 其他角色保持不变 ...
};
```

#### 3.5 路由注册

**修改文件**：`/TG/tgservice/backend/server.js`

```javascript
// 引入打卡审查路由
const attendanceReviewRouter = require('./routes/attendance-review');

// 注册路由
app.use('/api/attendance-review', attendanceReviewRouter);
```

---

## 文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `/TG/tgservice/backend/db/migrations/v2.3-attendance-photo.sql` | 数据库迁移：添加 clock_in_photo 字段 |
| `/TG/tgservice/backend/routes/attendance-review.js` | 打卡审查 API |
| `/TG/tgservice/admin/attendance-review.html` | 打卡审查后台页面 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `routes/water-boards.js` | 查询 SQL 添加 `c.level` 字段 |
| `routes/coaches.js` | clock-in 接口接收 `clock_in_photo` 参数，写入数据库 |
| `pages/internal/water-board.vue` | 添加等级徽章显示逻辑 |
| `pages/internal/water-board-view.vue` | 添加等级徽章显示逻辑 |
| `pages/internal/clock.vue` | 添加打卡截图上传功能 |
| `utils/api-v2.js` | coachesV2.clockIn 支持传递参数 |
| `admin/sidebar.js` | 添加打卡审查菜单项 |
| `backend/server.js` | 注册 attendance-review 路由 |

---

## 边界情况与异常处理

### 需求1：等级标志

| 场景 | 处理方式 |
|------|----------|
| 助教等级为空/null | 不显示等级徽章 |
| 状态不在目标列表 | 不显示等级徽章 |
| 图标颜色相近 | 青铜用橙色(#CD7F32)，黄金用纯金色(#FFD700)，明显区分 |

### 需求2：打卡截图

| 场景 | 处理方式 |
|------|----------|
| 未上传图片点击上班 | Toast 提示，按钮禁用状态 |
| 图片上传失败 | 显示错误信息，允许重试 |
| 网络中断 | useImageUpload 模块处理，显示网络错误提示 |
| 上传超时 | 30秒超时，提示重试 |

### 需求3：打卡审查

| 场景 | 处理方式 |
|------|----------|
| 查询日期无记录 | 显示"暂无打卡记录" |
| API 请求失败 | 显示"加载失败"，可刷新重试 |
| 权限不足 | sidebar.js 过滤菜单项，不显示入口 |
| 打卡照片为空 | 显示 "-" |

---

## 编码规范遵守检查

### ✅ 时间处理
- 后端使用 `TimeUtil.nowDB()` / `TimeUtil.todayStr()`
- 前端使用 `TimeUtil.today()` / `TimeUtil.format()`
- 禁止使用 `datetime('now')` 和手动时区偏移

### ✅ 数据库连接
- 复用 `const { db, dbRun, dbAll, dbGet } = require('./db/index')`
- 禁止 `new sqlite3.Database()`

### ✅ 数据库写入
- 使用 `runInTransaction(async (tx) => { ... })`
- 禁止裸开事务

### ✅ 页面显示规范
- 显示 `{{ employee_id }}` 或 `${employee_id || '-'}`
- 禁止显示 `coach_no`

---

## 验收要点

### 需求1验收
- [ ] 早班空闲/早班上桌/晚班空闲/晚班上桌/乐捐状态显示等级徽章
- [ ] 青铜图标与黄金图标明显区分（橙色 vs 纯金色）
- [ ] 其他状态不显示等级徽章

### 需求2验收
- [ ] 上班打卡前必须上传打卡截图
- [ ] 未上传时上班按钮禁用
- [ ] 图片上传到 OSS 临时目录
- [ ] 打卡成功后图片 URL 写入数据库

### 需求3验收
- [ ] 菜单入口在"管理"分组
- [ ] 权限：店长/助教管理/管理员可访问
- [ ] 4个日期班次切换按钮正常工作
- [ ] 显示工号、艺名、班次、上班时间、下班时间、照片、加班小时、迟到状态
- [ ] 迟到判断正确（早班14点、晚班18点，加班顺延）
- [ ] 打卡时间倒序排序

---

## 待确认事项

1. **等级图标样式**：使用 emoji 还是自定义 SVG？
   - 建议：先用 emoji（🟠/⚪/🟡/💎），后续可替换为 SVG
   
2. **加班顺延逻辑**：当前设计简化处理，是否需要精确计算？
   - 例：早班 + 早加班2小时 → 应上班时间 = 12:00
   - 当前方案：SQL 中动态计算
   
3. **打卡审查页面**：是否需要导出功能？
   - 当前设计：仅查看，无导出

---

**设计方案完成，请用户确认后方可编码。**
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