# QA-20260420-2: 活跃计时器功能 — 技术方案设计

> 设计者：程序员A | 日期：2026-04-20

---

## 一、需求概述

在系统报告页面新增「活跃计时器」Tab，展示当前内存中所有计时器的实时状态，包含助教完整信息（工号、姓名）和计时器详情（申请事项/乐捐信息、剩余时间等）。**不修改数据库表结构。**

### 验收重点
1. 活跃计时器列表显示完整助教信息
2. 能实时反映内存状态
3. 剩余时间计算准确

---

## 二、现有架构分析

### 2.1 计时器三层架构

```
┌──────────────────────────────────────────────────────────┐
│                    timer-manager.js                       │
│  activeTimers Map: {timerId, type, recordId, execTime}   │
│  用途: 系统报告统计、5分钟轮询兜底                         │
│  数据源: 仅恢复/轮询时创建的定时器                         │
└──────────────────┬───────────────────────────────────────┘
                   │ callbacks
         ┌─────────┴──────────┐
         ▼                    ▼
┌─────────────────┐  ┌────────────────────┐
│ lejuan-timer.js │  │ application-timer  │
│ lejuanTimers Map│  │ applicationTimers  │
│ 真正的乐捐定时器 │  │ 真正的申请定时器    │
│ 被路由直接调用   │  │ 被路由直接调用      │
└─────────────────┘  └────────────────────┘
```

### 2.2 关键发现

| 模块 | 内存 Map 内容 | 谁在用 | 数据来源 |
|------|-------------|--------|---------|
| timer-manager | 仅恢复/轮询时 | system-report API | 不完整 |
| lejuan-timer | 全部乐捐定时器 | lejuan-records 路由 | 完整 |
| application-timer | 全部申请定时器 | applications 路由 | 完整 |

**核心问题：** `timer-manager.js` 的 `activeTimers` 只记录了 `type` 和 `recordId`，缺少助教详细信息。且正常流程中通过 `addNewRecord` 创建的定时器不会注册到 timer-manager。

### 2.3 现有数据结构

**timer-manager `activeTimers` Map：**
```javascript
{
  "lejuan_123": {
    timerId: Timeout,        // setTimeout 引用
    type: "lejuan",          // 类型
    recordId: "123",         // 记录 ID
    execTime: "2026-04-20 18:00:00"  // 执行时间
  }
}
```

**coaches 表相关字段：**
```
coach_no (TEXT, 内部编号)
employee_id (TEXT, 页面显示用工号)
stage_name (TEXT, 艺名/姓名)
phone (TEXT, 手机号)
```

**lejuan_records 表相关字段：**
```
id, coach_no, stage_name, scheduled_start_time, lejuan_status, scheduled
```

**applications 表相关字段：**
```
id, applicant_phone, application_type, status, extra_data(JSON: {exec_time, timer_set, executed})
```

---

## 三、技术方案

### 3.1 总体策略

采用**查询时 enrichment（数据丰富化）**方案：
- **不修改**计时器创建流程（避免影响现有定时逻辑）
- **扩展** `timer-manager.js` 的 `getActiveTimers()` 方法，查询时从数据库补充助教信息
- 新增 API 端点和前端 Tab

**理由：** 最小化变更范围，降低回归风险；内存中只保留必要字段，数据库作为信息补充源。

### 3.2 修改文件清单

| # | 文件 | 操作 | 说明 |
|---|------|------|------|
| 1 | `backend/services/timer-manager.js` | **修改** | 扩展 `getActiveTimers()` 为 `getActiveTimersWithDetails()` |
| 2 | `backend/routes/system-report.js` | **修改** | 新增 `/active-timers` API 路由 |
| 3 | `admin/system-report.html` | **修改** | 新增「活跃计时器」Tab |

**不修改数据库表结构。**

---

## 四、详细设计

### 4.1 后端：timer-manager.js 扩展

#### 4.1.1 新增方法 `getActiveTimersWithDetails()`

```javascript
/**
 * 获取所有活跃计时器的详细信息（含助教信息）
 * @returns {Array} 活跃计时器详情列表
 */
async function getActiveTimersWithDetails() {
    const timers = getActiveTimers(); // 获取现有基础数据
    const detailedTimers = [];

    for (const timer of timers) {
        const detail = {
            timerId: timer.timerId,
            type: timer.type,
            recordId: timer.recordId,
            execTime: timer.execTime,
            employee_id: null,
            stage_name: null,
            coach_no: null,
            application_type: null,
            remainingSeconds: null
        };

        // 计算剩余时间
        if (timer.execTime) {
            const now = new Date(TimeUtil.nowDB() + '+08:00');
            const execDate = new Date(timer.execTime + '+08:00');
            detail.remainingSeconds = Math.max(0, Math.round((execDate.getTime() - now.getTime()) / 1000));
        }

        // 根据类型从数据库获取详细信息
        if (timer.type === 'lejuan') {
            await enrichLejuanTimer(detail, timer.recordId);
        } else if (timer.type === 'application') {
            await enrichApplicationTimer(detail, timer.recordId);
        }

        detailedTimers.push(detail);
    }

    return detailedTimers;
}
```

#### 4.1.2 乐捐定时器信息补全

```javascript
/**
 * 补全乐捐定时器详细信息
 */
async function enrichLejuanTimer(detail, recordId) {
    try {
        const record = await get(`
            SELECT lr.coach_no, lr.stage_name, c.employee_id
            FROM lejuan_records lr
            LEFT JOIN coaches c ON lr.coach_no = c.coach_no
            WHERE lr.id = ?
        `, [recordId]);

        if (record) {
            detail.coach_no = record.coach_no;
            detail.employee_id = record.employee_id || '-';
            detail.stage_name = record.stage_name || '-';
        }
    } catch (err) {
        console.error(`[TimerManager] 补全乐捐定时器 ${recordId} 信息失败:`, err);
    }
}
```

#### 4.1.3 申请定时器信息补全

```javascript
/**
 * 补全申请定时器详细信息
 */
async function enrichApplicationTimer(detail, recordId) {
    try {
        const record = await get(`
            SELECT a.id, a.application_type, a.applicant_phone,
                   a.extra_data,
                   c.coach_no, c.stage_name, c.employee_id
            FROM applications a
            LEFT JOIN coaches c ON a.applicant_phone = c.employee_id 
                                OR a.applicant_phone = c.phone
            WHERE a.id = ?
        `, [recordId]);

        if (record) {
            detail.application_type = record.application_type || '-';
            detail.coach_no = record.coach_no;
            detail.employee_id = record.employee_id || '-';
            detail.stage_name = record.stage_name || '-';
        }
    } catch (err) {
        console.error(`[TimerManager] 补全申请定时器 ${recordId} 信息失败:`, err);
    }
}
```

#### 4.1.4 exports 更新

在 module.exports 中新增导出：
```javascript
module.exports = {
    // ... 原有导出
    getActiveTimersWithDetails,  // 新增
};
```

### 4.2 后端：system-report.js 新增 API

#### 4.2.1 新增路由

```javascript
/**
 * GET /api/system-report/active-timers
 * 获取当前内存中所有活跃计时器的详细信息
 */
router.get('/active-timers', async (req, res) => {
    try {
        const timers = await timerManager.getActiveTimersWithDetails();
        
        res.json({
            success: true,
            data: timers,
            total: timers.length
        });
    } catch (err) {
        console.error(`获取活跃计时器失败: ${err.message}`);
        res.status(500).json({ error: '服务器错误' });
    }
});
```

#### 4.2.2 API 响应格式

```json
{
  "success": true,
  "data": [
    {
      "timerId": "lejuan_123",
      "type": "lejuan",
      "recordId": "123",
      "execTime": "2026-04-20 18:00:00",
      "employee_id": "TG001",
      "stage_name": "小明",
      "coach_no": "C001",
      "application_type": null,
      "remainingSeconds": 3600
    },
    {
      "timerId": "application_456",
      "type": "application",
      "recordId": "456",
      "execTime": "2026-04-21 12:00:00",
      "employee_id": "TG002",
      "stage_name": "小红",
      "coach_no": "C002",
      "application_type": "休息申请",
      "remainingSeconds": 68400
    }
  ],
  "total": 2
}
```

### 4.3 前端：system-report.html 新增 Tab

#### 4.3.1 新增 Tab 按钮

在现有 tabs 区域新增按钮（放在「计时器日志」之后）：

```html
<button class="tab-btn" data-tab="activeTimers" onclick="switchTab('activeTimers')">活跃计时器</button>
```

#### 4.3.2 新增 Tab 内容区

```html
<!-- Tab: 活跃计时器 -->
<div class="tab-content" id="tab-activeTimers">
  <div class="stats-row" id="activeTimerStats"></div>
  <div class="filter-bar">
    <div class="filter-group" id="activeTimerTypeFilter">
      <button class="btn btn-outline active" data-type="" onclick="setActiveTimerType('')">全部</button>
      <button class="btn btn-outline" data-type="lejuan" onclick="setActiveTimerType('lejuan')">乐捐</button>
      <button class="btn btn-outline" data-type="application" onclick="setActiveTimerType('application')">申请</button>
    </div>
    <button class="btn btn-primary" onclick="loadActiveTimers()">🔄 刷新</button>
  </div>
  <table class="data-table">
    <thead>
      <tr>
        <th>助教工号</th>
        <th>姓名</th>
        <th>类型</th>
        <th>申请事项</th>
        <th>计划执行时间</th>
        <th>剩余时间</th>
        <th>记录ID</th>
      </tr>
    </thead>
    <tbody id="activeTimerTable">
      <tr><td colspan="7" class="empty-state">
        <div class="empty-state-icon">⏱️</div>
        <div>加载中...</div>
      </td></tr>
    </tbody>
  </table>
</div>
```

#### 4.3.3 新增 JavaScript 逻辑

```javascript
// ==================== 活跃计时器 ====================
var currentActiveTimerType = '';
var activeTimersRefreshInterval = null;

function setActiveTimerType(type) {
    currentActiveTimerType = type;
    var btns = document.querySelectorAll('#activeTimerTypeFilter .btn-outline');
    for (var i = 0; i < btns.length; i++) {
        btns[i].className = btns[i].getAttribute('data-type') === type 
            ? 'btn btn-outline active' : 'btn btn-outline';
    }
    loadActiveTimers();
}

function loadActiveTimers() {
    fetch(API_BASE + '/system-report/active-timers', {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') }
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (!data.success) { showToast('加载失败', 'error'); return; }

        var timers = data.data || [];
        
        // 按类型过滤
        if (currentActiveTimerType) {
            timers = timers.filter(function(t) { return t.type === currentActiveTimerType; });
        }

        // 统计卡片
        var allTimers = data.data || [];
        var lejuanCount = allTimers.filter(function(t) { return t.type === 'lejuan'; }).length;
        var appCount = allTimers.filter(function(t) { return t.type === 'application'; }).length;
        
        var statsHtml = '';
        statsHtml += '<div class="stat-card"><div class="stat-label">总计</div><div class="stat-value gold">' + allTimers.length + '</div></div>';
        statsHtml += '<div class="stat-card"><div class="stat-label">乐捐定时器</div><div class="stat-value gold">' + lejuanCount + '</div></div>';
        statsHtml += '<div class="stat-card"><div class="stat-label">申请定时器</div><div class="stat-value gold">' + appCount + '</div></div>';
        document.getElementById('activeTimerStats').innerHTML = statsHtml;

        // 表格渲染
        var html = '';
        if (timers.length === 0) {
            html = '<tr><td colspan="7" class="empty-state"><div class="empty-state-icon">⏱️</div><div>暂无活跃计时器</div></td></tr>';
        } else {
            for (var i = 0; i < timers.length; i++) {
                var t = timers[i];
                var typeClass = t.type === 'lejuan' ? 'badge-pending' : 'badge-active';
                var typeText = t.type === 'lejuan' ? '乐捐' : '申请';
                var remainingText = formatRemainingTime(t.remainingSeconds);
                var appTypeText = t.application_type || '-';

                html += '<tr>';
                html += '<td>' + escapeHtml(t.employee_id || '-') + '</td>';
                html += '<td>' + escapeHtml(t.stage_name || '-') + '</td>';
                html += '<td><span class="badge ' + typeClass + '">' + typeText + '</span></td>';
                html += '<td>' + escapeHtml(appTypeText) + '</td>';
                html += '<td>' + escapeHtml(t.execTime || '-') + '</td>';
                html += '<td>' + remainingText + '</td>';
                html += '<td>' + escapeHtml(t.recordId || '-') + '</td>';
                html += '</tr>';
            }
        }
        document.getElementById('activeTimerTable').innerHTML = html;
    })
    .catch(function(err) {
        showToast('加载失败: ' + err.message, 'error');
    });
}

/**
 * 格式化剩余时间
 */
function formatRemainingTime(seconds) {
    if (seconds === null || seconds === undefined) return '-';
    if (seconds <= 0) return '<span style="color:#e74c3c">已到期</span>';
    
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    
    var parts = [];
    if (h > 0) parts.push(h + '小时');
    if (m > 0) parts.push(m + '分');
    if (s > 0 && h === 0) parts.push(s + '秒');
    
    return parts.join('') || '<1秒';
}

/**
 * HTML 转义（防 XSS）
 */
function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}
```

#### 4.3.4 switchTab 扩展

修改现有的 `switchTab` 函数，增加 `activeTimers` 分支：

```javascript
function switchTab(tabName) {
    // ... 原有 Tab 切换逻辑 ...
    
    // 按需加载
    if (tabName === 'overview') loadOverview();
    else if (tabName === 'tasks') loadTasks();
    else if (tabName === 'cronLogs') loadCronLogs();
    else if (tabName === 'timerLogs') loadTimerLogs();
    else if (tabName === 'dbQueue') loadQueueStats();
    else if (tabName === 'activeTimers') loadActiveTimers();  // 新增
}
```

#### 4.3.5 自动刷新机制

在页面初始化中增加活跃计时器的自动刷新（每 10 秒）：

```javascript
// 在 (function(){ ... })(); 初始化函数中添加
setInterval(function() {
    var activeTab = document.querySelector('.tab-btn.active');
    if (activeTab && activeTab.getAttribute('data-tab') === 'activeTimers') {
        loadActiveTimers();
    }
}, 10000);
```

---

## 五、前后端交互流程

```
用户点击「活跃计时器」Tab
    │
    ▼
前端 switchTab('activeTimers')
    │
    ▼
前端 loadActiveTimers()
    │  GET /api/system-report/active-timers
    │  Header: Authorization: Bearer <token>
    ▼
后端 router.get('/active-timers')
    │
    ▼
timerManager.getActiveTimersWithDetails()
    │
    ├── 调用 getActiveTimers() → 获取内存中基础数据
    │     [{timerId, type, recordId, execTime}, ...]
    │
    ├── 遍历每个 timer
    │     │
    │     ├── type === 'lejuan' 
    │     │     └→ enrichLejuanTimer(recordId)
    │     │         └→ SELECT ... FROM lejuan_records LEFT JOIN coaches
    │     │             → 获取 employee_id, stage_name, coach_no
    │     │
    │     └── type === 'application'
    │           └→ enrichApplicationTimer(recordId)
    │               └→ SELECT ... FROM applications LEFT JOIN coaches
    │                   → 获取 employee_id, stage_name, coach_no, application_type
    │
    └── 返回 [{timerId, type, recordId, execTime, employee_id, 
               stage_name, coach_no, application_type, remainingSeconds}, ...]
    │
    ▼
前端接收数据 → 按类型过滤 → 渲染统计卡片 + 表格
```

---

## 六、边界情况与异常处理

### 6.1 助教信息缺失

**场景：** 计时器记录中的 `applicant_phone` 或 `coach_no` 在 coaches 表中找不到对应记录。

**处理：** 字段显示为 `'-'`（默认值），不阻塞其他字段展示。

```javascript
detail.employee_id = record.employee_id || '-';
detail.stage_name = record.stage_name || '-';
```

### 6.2 计时器执行时间已过

**场景：** `remainingSeconds <= 0`，说明计时器即将触发或已触发。

**处理：** 
- 前端显示为红色 `已到期` 标识
- 不自动从列表移除（因为内存中可能尚未清理）
- 下次轮询或手动刷新后自然消失

### 6.3 数据库查询失败

**场景：** enrich 查询时数据库出错。

**处理：**
- `try-catch` 捕获异常，打印错误日志
- 对应字段保持为 `null`，前端显示 `'-'`
- 不影响其他计时器的数据加载

### 6.4 空列表状态

**场景：** 当前没有任何活跃计时器。

**处理：** 前端显示空状态提示「暂无活跃计时器」，统计卡片显示 0。

### 6.5 XSS 防护

**场景：** 助教姓名或申请事项中包含特殊字符。

**处理：** 前端使用 `escapeHtml()` 函数对所有动态内容进行转义。

### 6.6 剩余时间计算时区

**场景：** 前端时间计算时区不一致。

**处理：** 后端统一使用 `TimeUtil.nowDB()` + `+08:00` 显式指定北京时间，计算 `remainingSeconds` 后返回秒数，前端只做格式化显示，**不做时间计算**。

### 6.7 自动刷新 Tab 可见性

**场景：** 用户在非「活跃计时器」Tab 时不应发起无意义的 API 请求。

**处理：** `setInterval` 中检查当前 active tab 是否为 `activeTimers`，只在可见时刷新。

---

## 七、不修改数据库

本方案**完全不修改数据库表结构**：
- 所有新增字段（`employee_id`, `stage_name`, `coach_no`, `application_type`）均为 API 响应层计算字段
- 通过 JOIN 查询从现有 `coaches`、`lejuan_records`、`applications` 表中获取
- 内存存储结构不变（仅扩展查询时的 enrichment 逻辑）

---

## 八、文件修改摘要

### 8.1 backend/services/timer-manager.js

| 变更 | 位置 | 说明 |
|------|------|------|
| 新增方法 | 文件末尾 | `getActiveTimersWithDetails()` — 获取 enriched 活跃计时器列表 |
| 新增方法 | 文件末尾 | `enrichLejuanTimer(detail, recordId)` — 乐捐信息补全 |
| 新增方法 | 文件末尾 | `enrichApplicationTimer(detail, recordId)` — 申请信息补全 |
| 修改 exports | module.exports | 新增导出 `getActiveTimersWithDetails` |

### 8.2 backend/routes/system-report.js

| 变更 | 位置 | 说明 |
|------|------|------|
| 新增路由 | 文件末尾前 | `GET /api/system-report/active-timers` |

### 8.3 admin/system-report.html

| 变更 | 位置 | 说明 |
|------|------|------|
| 新增 Tab 按钮 | `.tabs` 区域 | 「活跃计时器」按钮 |
| 新增 Tab 内容 | `.main` 区域 | `#tab-activeTimers` 内容区 |
| 新增 JS 变量 | `<script>` 区域 | `currentActiveTimerType` |
| 新增 JS 函数 | `<script>` 区域 | `setActiveTimerType()`, `loadActiveTimers()`, `formatRemainingTime()`, `escapeHtml()` |
| 修改 JS 函数 | `switchTab()` | 增加 `activeTimers` 分支 |
| 修改 JS 初始化 | `(function(){...})()` | 增加 10 秒自动刷新逻辑 |

---

## 九、测试要点

| 测试项 | 预期结果 |
|--------|---------|
| 无活跃计时器时打开 Tab | 显示空状态，统计卡片全为 0 |
| 有乐捐定时器时 | 显示助教工号、姓名、计划时间、剩余时间 |
| 有申请定时器时 | 额外显示申请事项类型 |
| 剩余时间计算 | 与实际倒计时一致，精度到秒 |
| 按类型过滤 | 乐捐/申请/全部切换正常 |
| 自动刷新 | 每 10 秒自动刷新，Tab 不可见时不请求 |
| 助教信息缺失 | 显示 '-' 不报错 |
| XSS 防护 | 特殊字符正确转义 |
| API 鉴权 | 无 token 返回 401 |

---

## 十、编码规范遵循检查

| 规范 | 遵循情况 |
|------|---------|
| ✅ 后端时间：TimeUtil.nowDB() | `enrich*` 方法中使用 TimeUtil.nowDB() |
| ✅ 数据库连接：复用 db/index.js | 使用 timer-manager 已有的 `get` 和 `all` |
| ✅ 数据库写入：enqueueRun 或 runInTransaction | 本方案只有读操作，不涉及写入 |
| ❌ 禁止页面显示 coach_no | 前端只显示 employee_id 和 stage_name，不显示 coach_no |
| ❌ 禁止 datetime('now') | 使用 TimeUtil.nowDB() |
| ❌ 禁止手动时区偏移 | 使用 `new Date(TimeUtil.nowDB() + '+08:00')` 显式指定 |
