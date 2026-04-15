# QA3 技术方案：前台H5加班审批/公休审批页面改造

> 设计日期：2026-04-15
> 设计者：程序员A3

---

## 一、需求回顾

1. **添加标签页按钮**：等待审批 / 已同意 / 已拒绝
2. **已同意/已拒绝标签页**：显示2天内的审批结果，不显示照片，只显示：班次、助教工号、艺名、申请小时数、审批结果
3. **等待审批页面**：申请照片改小，点击可放大连续查看（已实现预览功能，只需缩小缩略图）

**涉及页面**：
- `overtime-approval.vue` — 加班审批（早加班+晚加班）
- `leave-approval.vue` — 公休审批

---

## 二、现有代码分析

### 2.1 数据库表结构

```sql
-- applications 表（已有）
id INTEGER PRIMARY KEY
applicant_phone TEXT          -- 申请人手机号
application_type TEXT         -- 早加班申请/晚加班申请/公休申请/...
remark TEXT                   -- 备注（当前小时数写在这里，如"加班3小时"）
images TEXT                   -- JSON数组，图片URL
status INTEGER                -- 0待处理/1同意/2拒绝
approver_phone TEXT           -- 审批人
approve_time DATETIME         -- 审批时间
extra_data TEXT               -- JSON额外数据（目前未用于加班/公休）
created_at DATETIME
updated_at DATETIME
```

### 2.2 现有后端 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `GET /api/applications` | GET | 获取申请列表（支持 application_type、status 筛选） |
| `PUT /api/applications/:id/approve` | PUT | 审批申请（status: 1=同意, 2=拒绝） |

**现有 API 限制**：
- 不支持时间范围过滤（无法查"2天内"的数据）
- `getList` 查询时 `application_type` 只能传一个值

### 2.3 现有前端页面结构

两个审批页面结构几乎相同：
- 只显示 `status=0`（待处理）的记录
- 点击同意/拒绝按钮后刷新列表
- 图片显示较大（`max-width: 200px`）

### 2.4 申请小时数来源

当前加班/公休申请的小时数存储在 `remark` 字段中：
- 加班：`remark = "加班3小时"`
- 公休：`remark = "通宵加班到7点以后"`

**问题**：非结构化，难以精确提取小时数。

---

## 三、后端改造方案

### 3.1 修改前端提交时写入 extra_data.hours

**文件**：`/TG/tgservice-uniapp/src/pages/internal/overtime-apply.vue`

提交加班申请时增加 `extra_data.hours`：
```javascript
// 当前 setHours 函数已设置 form.remark = `加班${hours}小时`
// 需要同时保存结构化的小时数
await applications.create({
  applicant_phone: phone,
  application_type: applicationType.value,
  remark: form.value.remark,
  images: imageUrls.value.length > 0 ? JSON.stringify(imageUrls.value) : null,
  extra_data: { hours: parsedHours }  // 新增
})
```

**文件**：`/TG/tgservice-uniapp/src/pages/internal/leave-apply.vue`

提交公休申请时增加 `extra_data.hours`（从 remark 中提取）：
```javascript
// setHours 设置 remark = `通宵加班到${hours}点以后`
// 需要计算申请小时数（通宵到X点 = X-0 = X小时，或根据实际情况）
await applications.create({
  applicant_phone: phone,
  application_type: '公休申请',
  remark: form.value.remark,
  images: imageUrls.value.length > 0 ? JSON.stringify(imageUrls.value) : null,
  extra_data: { hours: parsedHours }  // 新增
})
```

### 3.2 后端 API 扩展

**文件**：`/TG/tgservice/backend/routes/applications.js`

#### 3.2.1 扩展 GET /api/applications：支持 since 参数和时间过滤

在现有的 `GET /api/applications` 中增加 `since` 参数支持：

```javascript
// 在现有参数解析后，增加 since 参数
const { since } = req.query;

if (since) {
  sql += ' AND a.created_at >= ?';
  params.push(since);
}
```

同时支持 `status` 传数组（逗号分隔），如 `status=1,2`：

```javascript
if (status !== undefined) {
  // 支持逗号分隔的多状态，如 "1,2"
  const statusList = status.split(',').map(s => parseInt(s.trim()));
  if (statusList.length > 1) {
    sql += ' AND a.status IN (' + statusList.map(() => '?').join(',') + ')';
    params.push(...statusList);
  } else {
    sql += ' AND a.status = ?';
    params.push(statusList[0]);
  }
}
```

#### 3.2.2 新增 GET /api/applications/approved-recent：获取近N天已审批记录

```javascript
/**
 * GET /api/applications/approved-recent
 * 获取近N天内已审批（同意/拒绝）的申请记录
 * 参数：
 *   - application_types: 逗号分隔的申请类型，如 "早加班申请,晚加班申请"
 *   - days: 天数，默认2
 *   - status: 1=已同意, 2=已拒绝
 */
router.get('/approved-recent', requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { application_types, days = 2, status } = req.query;
    const daysNum = parseInt(days, 10);
    const sinceTime = TimeUtil.offsetDB(-daysNum * 24); // 2天前
    
    let sql = `
      SELECT a.id, a.applicant_phone, a.application_type, a.remark, 
             a.status, a.approver_phone, a.approve_time, a.extra_data, a.created_at,
             c.stage_name, c.coach_no, c.shift
      FROM applications a
      LEFT JOIN coaches c ON a.applicant_phone = c.employee_id OR a.applicant_phone = c.phone
      WHERE a.status IN (1, 2)
        AND a.created_at >= ?
    `;
    const params = [sinceTime];
    
    if (application_types) {
      const types = application_types.split(',').map(t => t.trim());
      sql += ' AND a.application_type IN (' + types.map(() => '?').join(',') + ')';
      params.push(...types);
    }
    
    if (status !== undefined) {
      sql += ' AND a.status = ?';
      params.push(parseInt(status, 10));
    }
    
    sql += ' ORDER BY a.approve_time DESC';
    
    const records = await db.all(sql, params);
    
    // 格式化返回：提取小时数
    const formatted = records.map(r => {
      let hours = null;
      if (r.extra_data) {
        try {
          const extra = JSON.parse(r.extra_data);
          hours = extra.hours || null;
        } catch (e) {}
      }
      // 如果 extra_data 没有，尝试从 remark 解析
      if (hours === null && r.remark) {
        const match = r.remark.match(/(\d+)小时/);
        if (match) hours = parseInt(match[1], 10);
      }
      
      return {
        id: r.id,
        applicant_phone: r.applicant_phone,
        coach_no: r.coach_no || '-',
        stage_name: r.stage_name || '未知',
        shift: r.shift || '-',
        application_type: r.application_type,
        hours: hours,
        status: r.status,
        approve_time: r.approve_time,
        created_at: r.created_at
      };
    });
    
    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('获取近期审批记录失败:', error);
    res.status(500).json({ success: false, error: '获取近期审批记录失败' });
  }
});
```

### 3.3 前端 API 客户端扩展

**文件**：`/TG/tgservice-uniapp/src/utils/api-v2.js`

```javascript
export const applications = {
  // 已有
  create: (data) => request({ url: '/applications', method: 'POST', data }),
  getList: (params) => request({ url: '/applications', data: params }),
  approve: (id, data) => request({ url: `/applications/${id}/approve`, method: 'PUT', data }),
  getLejuanList: (params) => request({ url: '/applications/lejuan', data: params }),
  // 新增
  getApprovedRecent: (params) => request({ url: '/applications/approved-recent', data: params }),
}
```

---

## 四、前端改造方案

### 4.1 加班审批页面改造

**文件**：`/TG/tgservice-uniapp/src/pages/internal/overtime-approval.vue`

#### 4.1.1 模板改造：添加标签页

```vue
<template>
  <view class="page">
    <!-- 固定头部（不变） -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">加班审批</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- 标签页 -->
    <view class="tabs">
      <view class="tab-item" :class="{ active: activeTab === 'pending' }" @click="switchTab('pending')">
        <text>等待审批</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'approved' }" @click="switchTab('approved')">
        <text>已同意</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'rejected' }" @click="switchTab('rejected')">
        <text>已拒绝</text>
      </view>
    </view>

    <!-- 等待审批列表（照片改小） -->
    <view class="list-section" v-if="activeTab === 'pending'">
      <view class="app-card" v-for="app in pendingList" :key="app.id">
        <view class="app-header">
          <text class="app-type">{{ app.application_type }}</text>
          <text class="app-status status-0">待处理</text>
        </view>
        <view class="app-body">
          <text class="app-name">{{ app.stage_name || '未知' }}</text>
          <text class="app-phone">{{ app.applicant_phone }}</text>
          <text class="app-remark" v-if="app.remark">{{ app.remark }}</text>
          <text class="app-time">{{ app.created_at }}</text>
          <!-- 缩略图（改小） -->
          <scroll-view v-if="getImageUrls(app).length > 0" class="image-scroll" scroll-x>
            <image 
              v-for="(url, idx) in getImageUrls(app)" 
              :key="idx" 
              :src="url" 
              mode="aspectFill" 
              class="app-image-thumb" 
              @click="previewImages(app, idx)" 
            />
          </scroll-view>
        </view>
        <view class="app-actions">
          <view class="action-btn reject" @click="approve(app.id, 2)"><text>拒绝</text></view>
          <view class="action-btn approve" @click="approve(app.id, 1)"><text>同意</text></view>
        </view>
      </view>
      <view class="empty" v-if="pendingList.length === 0"><text>暂无待审批申请</text></view>
    </view>

    <!-- 已同意/已拒绝列表（不显示照片） -->
    <view class="list-section" v-if="activeTab !== 'pending'">
      <view class="result-card" v-for="item in approvedRecentList" :key="item.id">
        <view class="result-row">
          <text class="result-label">班次</text>
          <text class="result-value">{{ item.shift }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">助教工号</text>
          <text class="result-value">{{ item.coach_no }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">艺名</text>
          <text class="result-value">{{ item.stage_name }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">申请小时</text>
          <text class="result-value">{{ item.hours !== null ? item.hours + '小时' : '-' }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">审批结果</text>
          <text class="result-value" :class="activeTab === 'approved' ? 'text-approved' : 'text-rejected'">
            {{ activeTab === 'approved' ? '已同意' : '已拒绝' }}
          </text>
        </view>
        <view class="result-row result-time">
          <text class="result-label">审批时间</text>
          <text class="result-value">{{ item.approve_time || item.created_at }}</text>
        </view>
      </view>
      <view class="empty" v-if="approvedRecentList.length === 0">
        <text>{{ activeTab === 'approved' ? '2天内无已同意记录' : '2天内无已拒绝记录' }}</text>
      </view>
    </view>
  </view>
</template>
```

#### 4.1.2 脚本改造

```javascript
<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api-v2.js'

const statusBarHeight = ref(0)
const adminInfo = ref({})
const activeTab = ref('pending')  // pending | approved | rejected

const pendingList = ref([])
const approvedRecentList = ref([])

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  adminInfo.value = uni.getStorageSync('adminInfo') || {}
  loadData()
})

const switchTab = (tab) => {
  activeTab.value = tab
  loadData()
}

const loadData = async () => {
  if (activeTab.value === 'pending') {
    loadPending()
  } else {
    loadApprovedRecent()
  }
}

const loadPending = async () => {
  try {
    const res1 = await api.applications.getList({ application_type: '早加班申请', status: 0, limit: 50 })
    const res2 = await api.applications.getList({ application_type: '晚加班申请', status: 0, limit: 50 })
    pendingList.value = [...(res1.data || []), ...(res2.data || [])]
  } catch (e) { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

const loadApprovedRecent = async () => {
  try {
    const status = activeTab.value === 'approved' ? 1 : 2
    const res = await api.applications.getApprovedRecent({
      application_types: '早加班申请,晚加班申请',
      days: 2,
      status: status
    })
    approvedRecentList.value = res.data || []
  } catch (e) { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

// 解析图片 URL 数组（不变）
const getImageUrls = (record) => { ... }
const previewImages = (record, idx) => { ... }

const approve = async (id, status) => {
  const msg = status === 1 ? '同意' : '拒绝'
  uni.showModal({ title: `确认${msg}`, content: `确定${msg}该申请？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await api.applications.approve(id, { approver_phone: adminInfo.value.username, status })
          uni.showToast({ title: '操作成功', icon: 'success' })
          loadData()  // 审批后刷新当前标签页
        } catch (e) { uni.showToast({ title: e.error || '操作失败', icon: 'none' }) }
      }
    }
  })
}

const goBack = () => { ... }
</script>
```

#### 4.1.3 样式改造

```css
<style scoped>
/* 保留原有样式 */
.page { min-height: 100vh; background: #0a0a0f; padding-bottom: 40px; }
/* ... 保留所有原有样式 ... */

/* 新增：标签页样式 */
.tabs {
  display: flex;
  padding: 0 16px;
  gap: 8px;
  margin-bottom: 12px;
}
.tab-item {
  flex: 1;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  transition: all 0.2s;
}
.tab-item text {
  font-size: 13px;
  color: rgba(255,255,255,0.5);
}
.tab-item.active {
  background: rgba(212,175,55,0.15);
  border-color: rgba(212,175,55,0.4);
}
.tab-item.active text {
  color: #d4af37;
  font-weight: 600;
}

/* 修改：图片缩略图改小 */
.app-image-thumb {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  margin-right: 6px;
  margin-top: 6px;
  flex-shrink: 0;
}
/* 保留原有 image-scroll */
.image-scroll { margin-top: 6px; white-space: nowrap; }

/* 新增：审批结果卡片样式 */
.result-card {
  background: rgba(20,20,30,0.6);
  border: 1px solid rgba(218,165,32,0.1);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}
.result-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}
.result-row:not(:last-child) {
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.result-label {
  font-size: 13px;
  color: rgba(255,255,255,0.5);
}
.result-value {
  font-size: 13px;
  color: #fff;
  font-weight: 500;
}
.text-approved { color: #2ecc71 !important; }
.text-rejected { color: #e74c3c !important; }
.result-time .result-label,
.result-time .result-value {
  font-size: 11px;
  color: rgba(255,255,255,0.3);
}
</style>
```

### 4.2 公休审批页面改造

**文件**：`/TG/tgservice-uniapp/src/pages/internal/leave-approval.vue`

改造逻辑与加班审批完全相同，区别仅在于：
- `loadPending()` 查询 `application_type: '公休申请'`
- `loadApprovedRecent()` 传 `application_types: '公休申请'`

---

## 五、改造文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/routes/applications.js` | 修改 | 扩展 getList 支持 since/status 数组；新增 approved-recent 端点 |
| `src/utils/api-v2.js` | 修改 | 新增 getApprovedRecent 方法 |
| `src/pages/internal/overtime-apply.vue` | 修改 | 提交时增加 extra_data.hours |
| `src/pages/internal/leave-apply.vue` | 修改 | 提交时增加 extra_data.hours |
| `src/pages/internal/overtime-approval.vue` | 改造 | 添加标签页、改小图片、新增已审批列表 |
| `src/pages/internal/leave-approval.vue` | 改造 | 同加班审批页面 |

---

## 六、数据流向

```
助教提交申请
  → extra_data: { hours: N }  ← 新增结构化小时数
  → remark: "加班3小时"        ← 保持原有文本（兼容旧数据）

审批人查看
  → 等待审批：status=0，显示缩略图（60x60）
  → 已同意：status=1，2天内，显示结果卡片（无图）
  → 已拒绝：status=2，2天内，显示结果卡片（无图）

审批操作
  → PUT /api/applications/:id/approve → status=1 或 2
  → 自动更新水牌状态（已有逻辑）
```

---

## 七、编码规范检查

| 规范 | 落实情况 |
|------|----------|
| 时间处理用时间类 | ✅ 后端使用 `TimeUtil.offsetDB()` 计算2天前 |
| db操作复用 db/index.js | ✅ 使用 `db.all()` 查询 |
| db写入用 writeQueue | ✅ 本次无新增写入操作（审批用已有事务） |

---

## 八、兼容性说明

- **旧数据兼容**：`extra_data.hours` 为空时，后端会从 `remark` 字段正则解析小时数（`/(\d+)小时/`），确保历史数据也能显示
- **新数据**：提交时同时写入 `extra_data.hours` 和 `remark` 文本，双保险
- **页面入口**：不修改 `pages.json`，入口不变，两个审批页各自独立

---

## 九、风险点

1. **小时数提取**：旧数据的 remark 格式不完全统一（如"通宵加班到7点以后"），正则可能无法全部匹配。建议：审批结果页面中对无法解析的显示 `-`
2. **2天边界**：使用 `TimeUtil.offsetDB(-48)` 计算时间，基于服务器北京时间，不会因服务器时区配置变化而出错
3. **图片点击预览**：缩小后的缩略图点击后使用 `uni.previewImage` 全屏预览，支持左右滑动（已有功能）
