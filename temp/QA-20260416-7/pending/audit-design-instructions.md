你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
```
# QA-20260416-7 技术方案设计

> **日期**: 2026-04-16
> **设计者**: 程序员A
> **需求来源**: 水牌显示优化 + 公安备案号显示

---

## 一、需求概述

### 1.1 水牌显示优化（前台H5）

涉及两个页面：
- **水牌查看** (`/pages/internal/water-board-view.vue`) — 普通助教查看
- **水牌管理** (`/pages/internal/water-board.vue`) — 管理员查看+状态修改

优化内容：
1. 删除「下班」筛选按钮
2. 将下班助教卡片根据班次移入「早班空闲」/「晚班空闲」组
3. 下班助教排在末尾，和空闲助教分行显示
4. 下班助教卡片不显示头像，底色变深灰色
5. 下班助教当天有已同意加班审批时，卡片右上角显示红色粗体加班小时数
6. 加班小时数批量接口（一次返回所有）
7. 30秒刷新同时刷新加班小时数数据

### 1.2 公安备案号显示

在首页底部铭牌和会员中心底部信息栏新增公安备案号：`京公网安备11010102000001号`

---

## 二、现有代码分析

### 2.1 水牌相关后端 API

| 文件 | 路径 | 说明 |
|------|------|------|
| `backend/routes/water-boards.js` | `/api/water-boards` | 水牌管理 API |
| `backend/routes/applications.js` | `/api/applications` | 申请审批 API |

**GET /api/water-boards** 返回数据结构：
```javascript
{
  coach_no, stage_name, status, table_no, updated_at, clock_in_time,
  shift, photos, employee_id, table_no_list
}
```

**关键发现**：
- `coaches.shift` 字段区分「早班」/「晚班」
- `water_boards.status` 包含「下班」状态
- `applications` 表通过 `applicant_phone` 关联助教，`extra_data` JSON 字段存储 `{hours: N}`
- `applications.status`: 0=待处理, 1=已同意, 2=已拒绝
- 已有 `/api/applications/approved-recent` 接口返回近期审批记录

### 2.2 水牌相关前端页面

| 文件 | 说明 |
|------|------|
| `pages/internal/water-board-view.vue` | 水牌查看页面 |
| `pages/internal/water-board.vue` | 水牌管理页面 |
| `utils/api-v2.js` | API 封装，含 `waterBoards` 和 `applications` |
| `utils/time-util.js` | 前端时间工具 |

**关键数据结构**：
```javascript
const workStatusList = ['早班上桌', '早班空闲', '晚班上桌', '晚班空闲', '乐捐']
const offStatusList = ['休息', '公休', '请假', '下班', '早加班', '晚加班']
const freeStatuses = ['早班空闲', '晚班空闲']
```

**`groupedBoards` 计算逻辑**：按 `status` 分组，空闲状态按 `clock_in_time` 倒序，其他按 `updated_at` 倒序。

### 2.3 公安备案号位置

| 文件 | 位置 | 现有备案号样式 |
|------|------|---------------|
| `pages/index/index.vue` | 底部铭牌 `.plate-icp` 之后 | `color: #6a6040` |
| `pages/member/member.vue` | 底部 `.footer-icp` 之后 | `color: rgba(255,255,255,0.5)` |

---

## 三、技术方案

### 3.1 文件变更清单

| 操作 | 文件 | 变更内容 |
|------|------|---------|
| **新增** | `backend/routes/applications.js` | 新增 `GET /api/applications/today-approved-overtime` 接口 |
| **修改** | `pages/internal/water-board-view.vue` | 删除下班筛选、分组逻辑、卡片样式、加班小时数显示 |
| **修改** | `pages/internal/water-board.vue` | 同上（管理页面） |
| **修改** | `utils/api-v2.js` | 新增 `applications.getTodayApprovedOvertime` 方法 |
| **修改** | `pages/index/index.vue` | 铭牌底部新增公安备案号 |
| **修改** | `pages/member/member.vue` | 会员页底部新增公安备案号 |

### 3.2 数据库变更

**无需数据库变更**。`applications` 表已有 `extra_data` 字段存储加班小时数。

### 3.3 后端 API 变更

#### 新增接口：`GET /api/applications/today-approved-overtime`

**功能**：批量返回当天所有已同意（status=1）的加班申请的小时数。

**权限**：`auth.required` + `requireBackendPermission(['waterBoardManagement'])`（与水牌列表接口保持一致）

**请求参数**：无

**返回格式**：
```json
{
  "success": true,
  "data": {
    "13800138001": { "hours": 3, "coach_no": "A001", "shift": "早班" },
    "13800138002": { "hours": 5, "coach_no": "A002", "shift": "晚班" }
  }
}
```

**key** 为 `applicant_phone`（对应前端的 `employee_id`），值为 `{hours, coach_no, shift}`。

**实现位置**：`backend/routes/applications.js`

```javascript
/**
 * GET /api/applications/today-approved-overtime
 * 获取当天所有已同意的加班申请的小时数（批量接口）
 */
router.get('/today-approved-overtime', auth.required, requireBackendPermission(['waterBoardManagement']), async (req, res) => {
  try {
    const todayStr = TimeUtil.todayStr(); // "YYYY-MM-DD"
    
    const records = await db.all(`
      SELECT a.applicant_phone, a.extra_data, a.remark,
             c.coach_no, c.shift
      FROM applications a
      LEFT JOIN coaches c ON a.applicant_phone = c.employee_id OR a.applicant_phone = c.phone
      WHERE a.status = 1
        AND a.application_type IN ('早加班申请', '晚加班申请')
        AND date(a.created_at) = ?
    `, [todayStr]);
    
    // 构建 phone -> { hours, coach_no, shift } 映射
    const result = {};
    for (const r of records) {
      let hours = null;
      if (r.extra_data) {
        try {
          const extra = JSON.parse(r.extra_data);
          hours = extra.hours || null;
        } catch (e) {}
      }
      if (hours === null && r.remark) {
        const match = r.remark.match(/(\d+)小时/);
        if (match) hours = parseInt(match[1], 10);
      }
      if (hours !== null) {
        result[r.applicant_phone] = {
          hours,
          coach_no: r.coach_no || '-',
          shift: r.shift || '-'
        };
      }
    }
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取当天加班小时数失败:', error);
    res.status(500).json({ success: false, error: '获取当天加班小时数失败' });
  }
});
```

> **注意**：使用 `TimeUtil.todayStr()` 获取当天日期（编码规范），不使用 `datetime('now')`。

### 3.4 前端变更详解

#### 3.4.1 水牌查看页面 (`water-board-view.vue`)

##### A. 删除「下班」筛选按钮

```javascript
// offStatusList 中移除 '下班'
const offStatusList = ['休息', '公休', '请假', '早加班', '晚加班']
// 同时从 statusList 中移除 '下班'，不再作为独立分组
```

##### B. 下班助教移入空闲组（核心逻辑变更）

修改 `groupedBoards` 计算属性：

```javascript
const groupedBoards = computed(() => {
  const groups = {}
  statusList.forEach(s => { groups[s] = [] })
  // 下班助教不参与独立分组，后续合并到空闲组
  
  waterBoards.value.forEach(b => {
    if (b.status === '下班') {
      // 根据班次合并到对应空闲组
      if (b.shift === '晚班') {
        groups['晚班空闲'].push({ ...b, _offDuty: true })
      } else {
        groups['早班空闲'].push({ ...b, _offDuty: true })
      }
    } else if (groups[b.status]) {
      groups[b.status].push({ ...b, _offDuty: false })
    }
  })
  
  // 排序：空闲组内，正常助教在前（按 clock_in_time 倒序），下班助教在后
  freeStatuses.forEach(s => {
    const normal = groups[s].filter(c => !c._offDuty)
    const offDuty = groups[s].filter(c => c._offDuty)
    
    normal.sort((a, b) => {
      const ta = a.clock_in_time ? new Date(a.clock_in_time + '+08:00').getTime() : 0
      const tb = b.clock_in_time ? new Date(b.clock_in_time + '+08:00').getTime() : 0
      return tb - ta
    })
    
    // 下班助教保持原有排序（按 updated_at 倒序）
    offDuty.sort((a, b) => {
      const ta = a.updated_at ? new Date(a.updated_at + '+08:00').getTime() : 0
      const tb = b.updated_at ? new Date(b.updated_at + '+08:00').getTime() : 0
      return tb - ta
    })
    
    groups[s] = [...normal, ...offDuty]
  })
  
  // 其他非空闲组排序（不变）
  statusList.filter(s => !freeStatuses.includes(s)).forEach(s => {
    groups[s].sort((a, b) => {
      const ta = a.updated_at ? new Date(a.updated_at + '+08:00').getTime() : 0
      const tb = b.updated_at ? new Date(b.updated_at + '+08:00').getTime() : 0
      return tb - ta
    })
  })
  
  return statusList.filter(s => groups[s].length > 0).map(s => ({ status: s, coaches: groups[s] }))
})
```

##### C. 模板变更 — 下班助教分行显示

在 `.coach-grid` 中，将下班助教单独放一行：

```vue
<view class="coach-grid">
  <!-- 正常助教 -->
  <view class="coach-card" v-for="coach in group.coaches.filter(c => !c._offDuty)" :key="coach.coach_no">
    <image class="coach-avatar" :src="getAvatar(coach)" mode="aspectFill" />
    <text class="coach-id">{{ coach.employee_id || coach.coach_no }}</text>
    <text class="coach-name">{{ coach.stage_name }}</text>
  </view>
</view>
<!-- 下班助教单独一行 -->
<view class="coach-grid off-duty-row" v-if="group.coaches.some(c => c._offDuty)">
  <view class="coach-card coach-card--offduty"
        v-for="coach in group.coaches.filter(c => c._offDuty)"
        :key="'off-' + coach.coach_no">
    <!-- 无头像 -->
    <text class="coach-id">{{ coach.employee_id || coach.coach_no }}</text>
    <text class="coach-name">{{ coach.stage_name }}</text>
    <!-- 加班小时数 -->
    <text class="overtime-hours"
          v-if="getOvertimeHours(coach) > 0">
      {{ getOvertimeHours(coach) }}h
    </text>
  </view>
</view>
```

##### D. 下班助教卡片样式

```css
/* 下班助教卡片：深灰色底 */
.coach-card--offduty {
  background: rgba(60, 60, 60, 0.6) !important;
  border-color: rgba(100, 100, 100, 0.3) !important;
}

/* 下班助教卡片：隐藏头像 */
.coach-card--offduty .coach-avatar {
  display: none !important;
}

/* 下班助教独立行样式 */
.coach-grid.off-duty-row {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed rgba(255,255,255,0.08);
}

/* 加班小时数：红色粗体右上角 */
.overtime-hours {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 11px;
  font-weight: bold;
  color: #ff3b30;
  line-height: 1;
}

.coach-card--offduty {
  position: relative; /* 为绝对定位的加班小时数提供定位上下文 */
}
```

##### E. 加班小时数数据获取

```javascript
// 加班小时数映射（phone -> hours）
const overtimeHoursMap = ref({})

const loadOvertimeHours = async () => {
  try {
    const res = await api.applications.getTodayApprovedOvertime()
    overtimeHoursMap.value = res.data || {}
  } catch (e) {
    // 静默失败，不影响水牌显示
  }
}

const getOvertimeHours = (coach) => {
  const key = coach.employee_id
  if (!key || !overtimeHoursMap.value[key]) return 0
  return overtimeHoursMap.value[key].hours || 0
}
```

##### F. 30秒刷新逻辑变更

在现有的 `loadData()` 后追加调用 `loadOvertimeHours()`：

```javascript
const loadData = async () => {
  try {
    const res = await api.waterBoards.getList()
    waterBoards.value = res.data || []
    // 同时刷新加班小时数
    await loadOvertimeHours()
  } catch (e) { uni.showToast({ title: '加载失败', icon: 'none' }) }
}
```

`onMounted` 中初始化时也要调用 `loadOvertimeHours()`。

##### G. 放大弹窗中的下班助教卡片

弹窗中也要应用相同的下班助教样式（无头像、深灰色底、加班小时数）。

#### 3.4.2 水牌管理页面 (`water-board.vue`)

变更内容与查看页面完全一致，区别仅在于管理页面支持长按修改状态。

#### 3.4.3 API 封装 (`utils/api-v2.js`)

```javascript
export const applications = {
  create: (data) => request({ url: '/applications', method: 'POST', data }),
  getList: (params) => request({ url: '/applications', data: params }),
  approve: (id, data) => request({ url: `/applications/${id}/approve`, method: 'PUT', data }),
  getApprovedRecent: (params) => request({ url: '/applications/approved-recent', data: params }),
  // 新增
  getTodayApprovedOvertime: () => request({ url: '/applications/today-approved-overtime' })
}
```

#### 3.4.4 公安备案号 — 首页 (`pages/index/index.vue`)

在 `.plate-icp` 后面新增公安备案号：

```vue
<!-- #ifdef H5 -->
<a href="https://beian.miit.gov.cn" target="_blank" class="plate-icp" style="text-decoration: none; color: #6a6040;">粤ICP备2026027219号</a>
<!-- #endif -->
<!-- #ifndef H5 -->
<text class="plate-icp">粤ICP备2026027219号</text>
<!-- #endif -->
<!-- 新增：公安备案号（与工信部备案号颜色一致 #6a6040） -->
<text class="plate-psb-icp">京公网安备11010102000001号</text>
```

新增样式：
```css
.plate-psb-icp {
  font-size: 10px;
  color: #6a6040;
  margin-top: 2px;
}
```

#### 3.4.5 公安备案号 — 会员中心 (`pages/member/member.vue`)

在 `.footer-icp` 后面新增：

```vue
<!-- #ifdef H5 -->
<a href="https://beian.miit.gov.cn" target="_blank" class="footer-icp" style="text-decoration: none; color: rgba(255,255,255,0.5);">粤ICP备2026027219号</a>
<!-- #endif -->
<!-- #ifndef H5 -->
<text class="footer-icp">粤ICP备2026027219号</text>
<!-- #endif -->
<!-- 新增：公安备案号 -->
<text class="footer-psb-icp">京公网安备11010102000001号</text>
```

新增样式：
```css
.footer-psb-icp {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  display: block;
  margin-top: 2px;
}
```

---

## 四、前后端交互流程

### 4.1 页面加载流程

```
1. 页面 onMounted
   ├─ loadData()
   │   ├─ GET /api/water-boards → 获取全部水牌数据
   │   └─ GET /api/applications/today-approved-overtime → 获取当天加班小时数
   └─ 启动 30 秒定时器

2. groupedBoards 计算属性
   ├─ 遍历 waterBoards
   ├─ status='下班' 的按 shift 合并到早班空闲/晚班空闲组
   ├─ 标记 _offDuty=true
   └─ 正常助教在前，下班助教在后

3. 渲染
   ├─ 空闲组：正常教练卡片 + 分隔线 + 下班教练卡片
   ├─ 下班卡片：无头像、深灰底、右上角红色粗体加班小时数
   └─ 非空闲组：正常渲染
```

### 4.2 30秒刷新流程

```
每 30 秒触发:
  loadData()
    ├─ GET /api/water-boards → 更新 waterBoards
    └─ GET /api/applications/today-approved-overtime → 更新 overtimeHoursMap
  → groupedBoards 自动重新计算 → 视图自动更新
```

### 4.3 状态变更后的行为

当管理员将下班助教状态改为「空闲」时：
1. PUT /api/water-boards/:coach_no/status → 状态变为 早班空闲/晚班空闲
2. 下次 30 秒刷新后，该助教不再标记 `_offDuty=true`
3. 卡片恢复正常样式（有头像、正常底色）
4. 加班小时数自动消失（因为 `getOvertimeHours` 只在 `_offDuty=true` 的卡片上渲染）

---

## 五、边界情况和异常处理

### 5.1 水牌显示

| 场景 | 处理方式 |
|------|---------|
| 某班次（早/晚）没有空闲助教，只有下班助教 | 下班助教正常显示在空闲组，分组框照常渲染 |
| 下班助教的 employee_id 为空 | 显示 coach_no 作为卡片标识，加班小时数匹配使用 employee_id（若为空则不匹配） |
| 同一助教有多条已同意加班申请 | API 返回最后一条（或总和），前端取第一个匹配值 |
| 加班小时数接口请求失败 | 静默失败，waterBoards 正常显示，加班小时数视为 0 |
| 空闲组和下班助教混合后总人数超过 4 的倍数 | CSS Grid 自动换行，下班助教在独立行继续按 4 列排列 |

### 5.2 加班小时数

| 场景 | 处理方式 |
|------|---------|
| extra_data 为空但 remark 中有小时数 | 从 remark 正则解析（已有逻辑复用） |
| extra_data 和 remark 都无小时数 | hours=null，该记录不加入返回结果 |
| 跨天的加班申请（created_at 不是今天） | 不返回，只返回 `date(created_at) = 今天` 的记录 |
| 助教状态从下班变为空闲 | 不再渲染加班小时数（`_offDuty=false` 不显示） |

### 5.3 公安备案号

| 场景 | 处理方式 |
|------|---------|
| 小程序环境 | 公安备案号仍然显示（用 `<text>` 而非 `<a>`） |
| H5 环境 | 公安备案号显示为纯文本（不添加超链接，按需求） |

---

## 六、编码规范检查

### 时间处理
- ✅ 后端使用 `TimeUtil.todayStr()` 获取当天日期
- ✅ 后端使用 `TimeUtil.nowDB()`（已有代码，本次不修改）
- ❌ 禁止使用 `datetime('now')`、手动时区偏移
- ✅ 前端解析数据库时间使用 `new Date(time + '+08:00')`（已有代码，保持不变）

### 数据库连接
- ✅ 使用 `const db = require('../db')` 和 `const { runInTransaction } = require('../db')`
- ❌ 禁止 `new sqlite3.Database()`

### 数据库写入
- ✅ 使用 `runInTransaction`（已有代码，本次新增接口只有读操作，不涉及写入）

---

## 七、测试要点（QA验收对照）

| # | 验收项 | 测试方法 |
|---|--------|---------|
| 1 | 下班筛选按钮已删除 | 打开水牌页面，确认筛选栏中无「下班」按钮 |
| 2 | 下班助教卡片在早班空闲/晚班空闲组 | 设置某早班助教为下班状态，确认其出现在早班空闲组末尾 |
| 3 | 下班助教分行显示 | 确认下班助教与正常空闲助教之间有分隔线，视觉上分行 |
| 4 | 下班助教无头像 | 确认下班助教卡片上不显示头像图片 |
| 5 | 下班助教深灰色底 | 确认下班助教卡片背景为深灰色 |
| 6 | 加班小时数红色粗体显示 | 提交并审批通过加班申请后，下班助教卡片右上角显示红色粗体小时数 |
| 7 | 状态变空闲后不显示小时数 | 将下班助教状态改为空闲，确认加班小时数消失 |
| 8 | 批量接口一次返回 | 抓包确认 30 秒刷新只调一次加班小时数接口 |
| 9 | 30 秒刷新包含加班数据 | 等待 30 秒自动刷新，确认加班小时数同步更新 |
| 10 | 首页底部公安备案号 | 确认首页底部显示 `京公网安备11010102000001号`，颜色与备案号一致 |
| 11 | 会员中心底部公安备案号 | 确认会员中心底部显示 `京公网安备11010102000001号`，颜色与备案号一致 |

---

## 八、修改文件总览

```
backend/routes/applications.js          — 新增 GET /api/applications/today-approved-overtime
tgservice-uniapp/src/utils/api-v2.js    — 新增 getTodayApprovedOvertime 方法
tgservice-uniapp/src/pages/internal/water-board-view.vue  — 水牌查看页全面改版
tgservice-uniapp/src/pages/internal/water-board.vue       — 水牌管理页全面改版
tgservice-uniapp/src/pages/index/index.vue                — 新增公安备案号
tgservice-uniapp/src/pages/member/member.vue              — 新增公安备案号
```

**新增 API**: 1 个（只读）
**数据库变更**: 无
**前端变更**: 6 个文件

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