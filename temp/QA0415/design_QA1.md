# QA1 助教乐捐报备流程修改 - 技术方案

**日期**: 2026-04-15  
**设计者**: 程序员A1  

---

## 一、需求概述

将当前乐捐报备流程从「提交即生效」改为「预约→定时生效→归来结算」三段式流程：

1. **预约**：助教指定整点开始时间，提交后不立即变状态，到时间自动变为乐捐
2. **归来**：助教管理/店长在乐捐一览点击「乐捐归来」，计算外出小时数，恢复水牌为空闲
3. **截图**：助教可在近2天的乐捐记录中提交/修改付款截图

---

## 二、数据库表结构变更

### 2.1 新建 `lejuan_records` 表

**原因**：`applications` 表是通用申请表，字段有限且存储乐捐业务数据的 `extra_data` JSON 不便于查询。新建专用表更清晰。

```sql
CREATE TABLE IF NOT EXISTS lejuan_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coach_no TEXT NOT NULL,               -- 助教编号
    employee_id TEXT NOT NULL,            -- 工号（冗余，方便查询）
    stage_name TEXT,                      -- 艺名（冗余）
    
    -- 预约信息
    scheduled_start_time TEXT NOT NULL,   -- 预约开始时间 "YYYY-MM-DD HH:00:00"（整点）
    extra_hours INTEGER,                  -- 预计外出小时数（参考值）
    remark TEXT,                          -- 备注
    
    -- 状态管理
    lejuan_status TEXT DEFAULT 'pending', -- pending=待出发, active=乐捐中, returned=已归来
    scheduled INTEGER DEFAULT 0,          -- 0=未调度, 1=已调度（定时器已设）
    
    -- 实际执行信息
    actual_start_time TEXT,               -- 实际变乐捐的时间 "YYYY-MM-DD HH:MM:SS"
    return_time TEXT,                     -- 乐捐归来时间 "YYYY-MM-DD HH:MM:SS"
    lejuan_hours INTEGER,                 -- 乐捐外出小时数（向上取整整数）
    proof_image_url TEXT,                 -- 付款截图 URL
    proof_image_updated_at TEXT,          -- 截图最后更新时间
    
    -- 审计
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,                      -- 操作人（助教工号或管理员用户名）
    returned_by TEXT                      -- 归来操作人（助教管理/店长用户名）
);
```

### 2.2 索引

```sql
CREATE INDEX IF NOT EXISTS idx_lejuan_coach ON lejuan_records(coach_no);
CREATE INDEX IF NOT EXISTS idx_lejuan_status ON lejuan_records(lejuan_status);
CREATE INDEX IF NOT EXISTS idx_lejuan_scheduled ON lejuan_records(scheduled_start_time);
CREATE INDEX IF NOT EXISTS idx_lejuan_status_time ON lejuan_records(lejuan_status, scheduled_start_time);
```

### 2.3 `applications` 表变更

**保持不变**，但修改乐捐报备提交逻辑：提交 `乐捐报备` 类型申请时不再立即更新水牌状态，改为创建 `lejuan_records` 记录。

---

## 三、后端API变更

### 3.1 新建路由文件：`backend/routes/lejuan-records.js`

```javascript
/**
 * 乐捐记录 API
 * 路径: /api/lejuan-records
 */
```

所有接口统一使用：
- `auth.required` 中间件
- `requireBackendPermission(['all'])`（助教可访问）或 `requireBackendPermission(['coachManagement'])`（管理操作）

### 3.2 API 接口清单

#### 3.2.1 `POST /api/lejuan-records` — 提交乐捐报备（助教）

**请求体**：
```json
{
    "employee_id": "26",
    "scheduled_start_time": "2026-04-15 14:00:00",  // 必须是整点
    "extra_hours": 3,
    "remark": "和客人外出"
}
```

**校验规则**：
- `scheduled_start_time` 必须是整点（分钟=00）
- `scheduled_start_time` 必须在未来（≥ 当前时间）
- 同一助教不能有重叠的 pending/active 乐捐记录

**处理逻辑**：
1. 通过 `employee_id` 查询 `coaches` 表获取 `coach_no`, `stage_name`
2. 校验时间有效性
3. 检查该助教是否已有 pending 或 active 的乐捐记录（如有则拒绝）
4. 使用 `runInTransaction` 创建记录，`lejuan_status = 'pending'`, `scheduled = 0`
5. 返回记录ID

**SQL**（在事务中执行）：
```sql
INSERT INTO lejuan_records (
    coach_no, employee_id, stage_name,
    scheduled_start_time, extra_hours, remark,
    lejuan_status, scheduled, created_by
) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?)
```

#### 3.2.2 `GET /api/lejuan-records/my` — 我的乐捐记录（助教，近2天）

**请求参数**：
- `employee_id`（query string，或从认证信息获取）

**返回**：
```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "coach_no": "26",
            "stage_name": "四瑶",
            "scheduled_start_time": "2026-04-15 14:00:00",
            "extra_hours": 3,
            "lejuan_status": "pending",
            "actual_start_time": null,
            "return_time": null,
            "lejuan_hours": null,
            "proof_image_url": null,
            "remark": "和客人外出",
            "created_at": "2026-04-15 13:30:00"
        }
    ]
}
```

**SQL**：
```sql
SELECT * FROM lejuan_records 
WHERE employee_id = ? 
    AND date(created_at) >= date('now', '-2 days', '+8 hours')  -- 北京时间近2天
ORDER BY scheduled_start_time DESC
```

> **注意**：SQLite 的 `date('now')` 使用 UTC。由于数据库存的是北京时间字符串（无时区标记），需要转换。方案：用 `TimeUtil` 计算北京时间2天前的日期字符串，直接比较。

#### 3.2.3 `GET /api/lejuan-records/list` — 乐捐一览（助教管理/店长）

**请求参数**：
- `status`（query string，可选）：`pending` / `active` / `returned` / `all`
- `days`（query string，默认 3）

**返回**：所有符合条件的乐捐记录

**SQL**：
```sql
SELECT lr.*, c.shift 
FROM lejuan_records lr
LEFT JOIN coaches c ON lr.coach_no = c.coach_no
WHERE lr.lejuan_status IN (?, ?, ...)
    AND date(lr.created_at) >= date(?)
ORDER BY 
    CASE lr.lejuan_status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
    lr.scheduled_start_time DESC
```

#### 3.2.4 `POST /api/lejuan-records/:id/return` — 乐捐归来（助教管理/店长）

**请求体**：
```json
{
    "operator": "admin_username"
}
```

**处理逻辑**：
1. 获取记录，验证 `lejuan_status = 'active'`
2. 计算外出小时数：`(return_time - actual_start_time)` 向上取整到整数小时
   - **哪怕只过了01分钟，也算1小时**
   - 公式：`Math.ceil((returnTimeMs - actualStartMs) / (60 * 60 * 1000))`
3. 获取助教的 `shift`（早班/晚班），将水牌状态改为对应的「早班空闲」或「晚班空闲」
4. 使用 `runInTransaction` 更新记录和水牌
5. 记录操作日志

**SQL**（在事务中）：
```sql
-- 更新乐捐记录
UPDATE lejuan_records 
SET lejuan_status = 'returned',
    return_time = ?,
    lejuan_hours = ?,
    returned_by = ?,
    updated_at = ?
WHERE id = ? AND lejuan_status = 'active'

-- 更新水牌状态
UPDATE water_boards 
SET status = ?, updated_at = ?
WHERE coach_no = ?
```

#### 3.2.5 `PUT /api/lejuan-records/:id/proof` — 提交/修改付款截图（助教，近2天）

**请求体**：
```json
{
    "proof_image_url": "https://oss.example.com/proof/xxx.jpg"
}
```

**校验规则**：
- 记录必须是该助教自己的
- 记录创建时间必须在近2天内
- `lejuan_status` 可以是任意状态（pending/active/returned 都可以补交截图）

#### 3.2.6 `GET /api/lejuan-records/pending-timers` — 获取待调度定时器（内部）

**返回**：所有 `scheduled = 0` 且 `scheduled_start_time <= 当前时间+1分钟` 的记录

用于：
- 服务启动时恢复定时器
- 定时轮询补充遗漏的定时器

### 3.3 修改 `applications.js`

**变更**：当 `application_type === '乐捐报备'` 时：
- **不再**立即更新水牌状态
- **不再**记录操作日志中的水牌变更
- 改为：在 `extra_data` 中记录 `lejuan_record_id`，关联到新表
- 或者：**完全移除** applications 表的乐捐报备插入（推荐），改由 `lejuan-records` 路由处理

**建议方案**：保留 applications 表的乐捐报备功能作为「兼容模式」（前端先切到新API，旧入口保留但标记 deprecated），同时新增 `lejuan-records` 路由。

---

## 四、定时器实现方案

### 4.1 核心设计：内存定时器 + 数据库持久化 + 启动恢复

```
┌─────────────────────────────────────────────────┐
│                 服务启动                         │
│                                                   │
│  1. 查询 lejuan_records WHERE                    │
│     scheduled = 0 AND                            │
│     scheduled_start_time <= NOW + 1分钟           │
│                                                   │
│  2. 对每条记录:                                   │
│     a. 如果 scheduled_start_time <= NOW:          │
│        → 立即激活（调 activateLejuan）            │
│     b. 如果 scheduled_start_time > NOW:           │
│        → 计算延迟毫秒数                           │
│        → setTimeout(activateLejuan, delay)        │
│        → 更新 scheduled = 1                       │
│                                                   │
│  3. 启动轮询检查（每分钟执行一次）                  │
│     → 处理新增的 pending 记录                     │
│     → 兜底：防止 setTimeout 丢失                   │
└─────────────────────────────────────────────────┘
```

### 4.2 定时器模块：`backend/services/lejuan-timer.js`

```javascript
const { runInTransaction, get, all, run: dbRun } = require('../db');
const TimeUtil = require('../utils/time');
const operationLogService = require('../operation-log');

const lejuanTimers = {}; // Map<record_id, Timer对象>

/**
 * 激活乐捐：到时间后自动设为乐捐状态
 */
async function activateLejuan(recordId) {
    try {
        await runInTransaction(async (tx) => {
            const record = await tx.get(
                'SELECT * FROM lejuan_records WHERE id = ? AND lejuan_status = ?',
                [recordId, 'pending']
            );
            if (!record) return; // 已被处理或取消
            
            const now = TimeUtil.nowDB();
            
            // 更新乐捐记录状态
            await tx.run(
                `UPDATE lejuan_records 
                 SET lejuan_status = 'active', 
                     actual_start_time = ?, 
                     scheduled = 1,
                     updated_at = ?
                 WHERE id = ?`,
                [now, now, recordId]
            );
            
            // 更新水牌状态为「乐捐」
            const currentWaterBoard = await tx.get(
                'SELECT * FROM water_boards WHERE coach_no = ?',
                [record.coach_no]
            );
            
            if (currentWaterBoard) {
                await tx.run(
                    `UPDATE water_boards 
                     SET status = '乐捐', updated_at = ? 
                     WHERE coach_no = ?`,
                    [now, record.coach_no]
                );
                
                // 操作日志
                await operationLogService.create(tx, {
                    operator_phone: 'system',
                    operator_name: '系统定时任务',
                    operation_type: '乐捐自动生效',
                    target_type: 'water_board',
                    target_id: currentWaterBoard.id,
                    old_value: JSON.stringify({ status: currentWaterBoard.status }),
                    new_value: JSON.stringify({ status: '乐捐' }),
                    remark: `乐捐报备自动生效（预约时间: ${record.scheduled_start_time}）`
                });
            }
        });
        
        delete lejuanTimers[recordId];
        console.log(`[乐捐定时器] 记录 ${recordId} 已激活: ${record.stage_name}`);
    } catch (err) {
        console.error(`[乐捐定时器] 激活记录 ${recordId} 失败:`, err);
    }
}

/**
 * 调度单个定时器
 */
function scheduleRecord(record) {
    const now = new Date(TimeUtil.nowDB() + '+08:00');
    const startTime = new Date(record.scheduled_start_time + '+08:00');
    const delay = startTime.getTime() - now.getTime();
    
    if (delay <= 0) {
        // 时间已到或已过，立即激活
        activateLejuan(record.id);
        return;
    }
    
    const timerId = setTimeout(() => {
        activateLejuan(record.id);
    }, delay);
    
    lejuanTimers[record.id] = timerId;
    console.log(`[乐捐定时器] 记录 ${record.id} 已调度，延迟 ${Math.round(delay/1000)}秒 后激活`);
}

/**
 * 恢复所有待调度定时器（服务启动时调用）
 */
async function recoverTimers() {
    try {
        const TimeUtil = require('../utils/time');
        const now = TimeUtil.nowDB();
        // 查询未来1小时内的 pending 记录（含已过期的）
        const pendingRecords = await all(`
            SELECT * FROM lejuan_records 
            WHERE lejuan_status = 'pending' 
                AND scheduled_start_time <= datetime(?, '+1 hours')
            ORDER BY scheduled_start_time
        `, [now]);
        
        console.log(`[乐捐定时器] 恢复定时器: 找到 ${pendingRecords.length} 条待处理记录`);
        
        for (const record of pendingRecords) {
            scheduleRecord(record);
            // 标记为已调度（防止重复恢复）
            await dbRun(
                'UPDATE lejuan_records SET scheduled = 1 WHERE id = ?',
                [record.id]
            );
        }
    } catch (err) {
        console.error('[乐捐定时器] 恢复定时器失败:', err);
    }
}

/**
 * 轮询检查：每分钟执行，兜底处理遗漏的定时器
 */
async function pollCheck() {
    try {
        const TimeUtil = require('../utils/time');
        const now = TimeUtil.nowDB();
        
        // 查找 scheduled=0 且时间已到或接近的 pending 记录
        const missedRecords = await all(`
            SELECT * FROM lejuan_records 
            WHERE lejuan_status = 'pending' 
                AND scheduled = 0
                AND scheduled_start_time <= datetime(?, '+1 minutes')
            ORDER BY scheduled_start_time
        `, [now]);
        
        for (const record of missedRecords) {
            console.log(`[乐捐定时器] 轮询发现待处理记录 ${record.id}`);
            scheduleRecord(record);
            await dbRun(
                'UPDATE lejuan_records SET scheduled = 1 WHERE id = ?',
                [record.id]
            );
        }
    } catch (err) {
        console.error('[乐捐定时器] 轮询检查失败:', err);
    }
}

/**
 * 初始化：启动恢复 + 轮询
 */
function init() {
    // 1. 恢复已持久化的定时器
    recoverTimers();
    
    // 2. 启动轮询（每分钟）
    setInterval(pollCheck, 60 * 1000);
    
    console.log('[乐捐定时器] 已初始化');
}

/**
 * 新增记录时调用（从 API 路由调用）
 */
function addNewRecord(record) {
    scheduleRecord(record);
    // 标记为已调度
    dbRun('UPDATE lejuan_records SET scheduled = 1 WHERE id = ?', [record.id]);
}

/**
 * 取消定时器（如果助教需要取消预约）
 */
function cancelRecord(recordId) {
    if (lejuanTimers[recordId]) {
        clearTimeout(lejuanTimers[recordId]);
        delete lejuanTimers[recordId];
        console.log(`[乐捐定时器] 记录 ${recordId} 定时器已取消`);
    }
}

module.exports = {
    init,
    addNewRecord,
    cancelRecord,
    activateLejuan
};
```

### 4.3 在 `server.js` 中集成

在 `server.js` 的 `app.listen` 回调中添加：

```javascript
// 在 app.listen 回调中
app.listen(PORT, () => {
    logger.info(`天宫国际线上服务已启动: http://localhost:${PORT}`);
    console.log(`🚀 服务已启动: http://localhost:${PORT}`);
    
    // 初始化乐捐定时器（恢复 + 轮询）
    require('./services/lejuan-timer').init();
});
```

### 4.4 重启恢复保证

| 场景 | 处理方式 |
|------|----------|
| 服务正常重启 | `recoverTimers()` 查询 `scheduled=0` 的 pending 记录，为未到期的重新设 setTimeout，已过期的立即激活 |
| 服务崩溃重启 | 同上，`pollCheck` 每分钟兜底 |
| `scheduled_start_time` 已过期 | 立即调用 `activateLejuan()`，不等定时器 |
| 定时器丢失（Node.js 事件循环异常） | `pollCheck` 每分钟兜底，确保不会遗漏 |

---

## 五、前端页面变更

### 5.1 助教端（uniapp）

#### 5.1.1 修改 `src/pages/internal/lejuan.vue` — 乐捐报备页

**变更内容**：

| 原有 | 变更后 |
|------|--------|
| 日期选择器 | 日期选择器 + 整点时间选择器（合并为「开始时间」） |
| 外出小时数选择器 | 预计小时数选择器（可选，仅作参考） |
| 证明图片上传 | **移除** |
| 提交后水牌立即变乐捐 | 提交后显示预约成功，水牌不变 |

**新的表单字段**：
```javascript
form: {
    scheduledDate: '2026-04-15',    // 日期
    scheduledHour: 14,              // 整点小时 (0-23)
    extraHours: 3,                  // 预计外出小时数（可选）
    remark: ''                      // 备注
}
```

**整点时间选择器实现**：
```javascript
// 可用小时选项：从下一个整点开始
const availableHours = computed(() => {
    const now = new Date()
    const currentHour = now.getHours()
    // 显示从当前小时+1到23
    const options = []
    for (let h = currentHour + 1; h <= 23; h++) {
        options.push(h)
    }
    return options
})
```

**提交逻辑变更**：
```javascript
const submitLejuan = async () => {
    const scheduledTime = `${form.value.scheduledDate} ${String(form.value.scheduledHour).padStart(2,'0')}:00:00`
    
    await api.lejuanRecords.create({
        employee_id: coachInfo.value.employeeId,
        scheduled_start_time: scheduledTime,
        extra_hours: form.value.extraHours,
        remark: form.value.remark
    })
    // 成功提示：预约成功，到时间自动生效
}
```

**新增：我的乐捐记录列表（近2天）**：
- 在乐捐报备页面下方展示近2天的乐捐记录卡片
- 每条记录显示：状态（待出发/乐捐中/已归来）、预约时间、实际开始时间、小时数
- 可点击记录进入截图上传页面

#### 5.1.2 修改 `src/pages/internal/lejuan-list.vue` → 重命名/重构

**变更**：此页面改为**助教管理/店长**专用的「乐捐一览」页面，从 admin 后台访问（见5.2）。

助教端的记录查看改为在 `lejuan.vue` 页面内嵌展示。

#### 5.1.3 新增 `src/pages/internal/lejuan-proof.vue` — 提交付款截图

- 从「我的乐捐记录」中点击某条记录进入
- 显示记录详情
- 提供图片上传按钮（可上传/替换付款截图）
- 调用 `PUT /api/lejuan-records/:id/proof`

#### 5.1.4 修改 `src/pages/internal/clock.vue` — 上班/下班页

**变更**：
- `canClockIn` 计算属性中，**移除** `'乐捐'`：
```javascript
const canClockIn = computed(() => {
    if (!waterBoard.value) return false
    const status = waterBoard.value.status
    // 移除 '乐捐'：乐捐状态的助教不能自己点上班
    return ['早加班', '晚加班', '休息', '公休', '请假', '下班'].includes(status)
})
```

#### 5.1.5 修改 `src/utils/api-v2.js` — 新增乐捐API

```javascript
export const lejuanRecords = {
    // 提交乐捐报备
    create: (data) => request({ url: '/lejuan-records', method: 'POST', data }),
    // 我的乐捐记录（近2天）
    getMyList: (params) => request({ url: '/lejuan-records/my', data: params }),
    // 提交/修改付款截图
    updateProof: (id, data) => request({ url: `/lejuan-records/${id}/proof`, method: 'PUT', data }),
    // 乐捐一览（管理）
    getList: (params) => request({ url: '/lejuan-records/list', data: params }),
    // 乐捐归来（管理）
    returnRecord: (id, data) => request({ url: `/lejuan-records/${id}/return`, method: 'POST', data }),
}
```

### 5.2 管理端（admin HTML）

#### 5.2.1 新增 `frontend/admin/lejuan-records.html` — 乐捐一览

**功能**：
- 乐捐记录列表（按状态分组：乐捐中 / 待出发 / 已归来）
- 每条记录显示：工号、艺名、预约时间、状态、预计小时
- 「乐捐中」的记录显示【乐捐归来】按钮
- 点击【乐捐归来】：
  1. 弹出确认框
  2. 调用 `POST /api/lejuan-records/:id/return`
  3. 成功后刷新列表，显示本次乐捐的小时数
- 支持按日期、状态筛选

**核心交互代码**：
```javascript
async function handleReturn(recordId) {
    if (!confirm('确认乐捐归来？将自动计算外出小时数并恢复水牌为空闲。')) return;
    
    const res = await fetch(`/api/lejuan-records/${recordId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': getToken() },
        body: JSON.stringify({ operator: currentUser.username })
    });
    
    const data = await res.json();
    if (data.success) {
        alert(`乐捐归来成功！外出 ${data.data.lejuan_hours} 小时`);
        loadRecords();
    } else {
        alert(data.error || '操作失败');
    }
}
```

#### 5.2.2 在 `frontend/admin/index.html` 侧边栏添加入口

在侧边栏导航中添加：
```html
<a href="lejuan-records.html">🎱 乐捐管理</a>
```

### 5.3 前端时间处理规范

管理端（admin HTML）需新增 `frontend/admin/js/time-util.js`：

```javascript
/**
 * 管理端北京时间工具
 */
const TimeUtil = {
    /** 当前北京时间 "YYYY-MM-DD" */
    today() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    },
    /** 当前北京时间 "YYYY-MM-DD HH:MM:SS" */
    now() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    },
    /** 格式化显示 */
    format(timeStr) {
        if (!timeStr) return '-';
        return timeStr.replace('T', ' ').substring(0, 16);
    },
    /** 计算小时差（向上取整） */
    calcHours(startTime, endTime) {
        const start = new Date(startTime + '+08:00');
        const end = new Date(endTime + '+08:00');
        return Math.ceil((end - start) / (60 * 60 * 1000));
    }
};
```

---

## 六、业务逻辑流程图

### 6.1 乐捐报备 → 定时生效 → 归来 完整流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        助教操作                                 │
│                                                                 │
│  1. 打开「乐捐报备」页面                                         │
│  2. 选择日期（默认今天）                                         │
│  3. 选择整点时间（如 14:00）                                     │
│  4. （可选）填写预计外出小时数                                    │
│  5. （可选）填写备注                                             │
│  6. 点击「提交预约」                                             │
│                                                                 │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     系统处理（提交时）                            │
│                                                                 │
│  1. 校验：时间必须是整点且在未来                                  │
│  2. 校验：该助教无 pending/active 乐捐记录                       │
│  3. 创建 lejuan_records 记录                                    │
│     lejuan_status = 'pending'                                   │
│     scheduled = 0                                               │
│  4. 设置定时器                                                   │
│     scheduled = 1                                               │
│  5. 返回预约成功                                                │
│  6. 水牌状态不变                                                │
│                                                                 │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  系统定时触发（到预约时间）                        │
│                                                                 │
│  1. 定时器触发（setTimeout 到期）                                │
│  2. 查询记录确认仍是 'pending'                                   │
│  3. 更新: lejuan_status = 'active'                              │
│     actual_start_time = 当前时间                                │
│  4. 更新水牌: status = '乐捐'                                   │
│  5. 记录操作日志                                                │
│                                                                 │
│  ⚠️ 此时助教水牌变为「乐捐」                                     │
│     助教无法点上班按钮                                           │
│     助教无法自己恢复到空闲状态                                    │
│                                                                 │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    助教回店后操作                                 │
│                                                                 │
│  1. 助教找到助教管理/店长                                        │
│  2. 管理员打开「乐捐一览」页面                                   │
│  3. 找到该助教的「乐捐中」记录                                   │
│  4. 点击【乐捐归来】按钮                                         │
│                                                                 │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  系统处理（乐捐归来）                              │
│                                                                 │
│  1. 获取当前时间作为 return_time                                 │
│  2. 计算小时数:                                                  │
│     lejuan_hours = ceil((return_time - actual_start_time) / 1h) │
│     哪怕只过1分钟，也算1小时                                      │
│  3. 更新 lejuan_records:                                        │
│     lejuan_status = 'returned'                                  │
│     return_time = 当前时间                                       │
│     lejuan_hours = 计算结果                                      │
│     returned_by = 操作管理员                                     │
│  4. 更新水牌:                                                    │
│     根据助教班次 → '早班空闲' 或 '晚班空闲'                      │
│  5. 记录操作日志                                                │
│  6. 返回操作结果（含计算出的小时数）                              │
│                                                                 │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    助教补充截图                                   │
│                                                                 │
│  1. 助教打开「乐捐报备」页面                                     │
│  2. 查看近2天的乐捐记录                                          │
│  3. 点击某条记录                                                │
│  4. 上传/替换付款截图                                           │
│  5. 调用 PUT /api/lejuan-records/:id/proof                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 系统重启恢复流程

```
服务启动
  │
  ├─ require('./services/lejuan-timer').init()
  │     │
  │     ├─ recoverTimers()
  │     │     │
  │     │     └─ SELECT * FROM lejuan_records
  │     │          WHERE lejuan_status = 'pending'
  │     │            AND scheduled_start_time <= NOW + 1h
  │     │
  │     │        对每条记录:
  │     │        ├─ 如果时间已过 → 立即 activateLejuan()
  │     │        └─ 如果时间未到 → setTimeout(activateLejuan, delay)
  │     │
  │     └─ setInterval(pollCheck, 60000)
  │           │
  │           └─ 每分钟检查是否有遗漏的 pending 记录
  │
  └─ 服务正常运行
```

---

## 七、编码规范遵守说明

### 7.1 时间处理

| 位置 | 使用 |
|------|------|
| 后端 `lejuan-records.js` | `const TimeUtil = require('../utils/time');` → `TimeUtil.nowDB()` |
| 后端 `lejuan-timer.js` | `TimeUtil.nowDB()` 获取当前北京时间 |
| 前端 `lejuan.vue` | `import { getBeijingDate } from '@/utils/time-util.js'` |
| 前端 admin `lejuan-records.html` | 新增 `js/time-util.js`，`TimeUtil.today()` / `TimeUtil.now()` |
| 数据库时间比较 | 存北京时间 `YYYY-MM-DD HH:MM:SS`，解析时 `new Date(time + '+08:00')` |

### 7.2 数据库连接

| 用法 | 说明 |
|------|------|
| `const { all, get, run: dbRun } = require('../db');` | 只读查询 |
| `const { runInTransaction } = require('../db');` | 写操作（必须） |
| `const { enqueueRun } = require('../db');` | 单个写入 |

**禁止**：在 `lejuan-records.js` 或 `lejuan-timer.js` 中直接 `require('sqlite3')` 创建新连接。

### 7.3 WriteQueue 队列

所有写入操作必须通过：
- `runInTransaction(async (tx) => { ... })` — 多步事务
- `enqueueRun(sql, params)` — 单步写入

定时器中的 `activateLejuan` 使用 `runInTransaction`。

---

## 八、文件变更清单

### 8.1 后端（tgservice）

| 操作 | 文件路径 | 说明 |
|------|----------|------|
| **新增** | `backend/routes/lejuan-records.js` | 乐捐记录 API 路由 |
| **新增** | `backend/services/lejuan-timer.js` | 乐捐定时器服务 |
| **修改** | `backend/server.js` | 添加乐捐定时器初始化 + 表创建 |
| **修改** | `backend/routes/applications.js` | 乐捐报备逻辑调整（可选：移除立即生效逻辑） |

### 8.2 前端 uniapp（tgservice-uniapp）

| 操作 | 文件路径 | 说明 |
|------|----------|------|
| **修改** | `src/pages/internal/lejuan.vue` | 改为预约表单 + 近2天记录展示 |
| **修改** | `src/pages/internal/lejuan-list.vue` | 改为助教个人记录（或废弃，功能合并到 lejuan.vue） |
| **新增** | `src/pages/internal/lejuan-proof.vue` | 提交/修改付款截图页面 |
| **修改** | `src/pages/internal/clock.vue` | `canClockIn` 移除 '乐捐' |
| **修改** | `src/utils/api-v2.js` | 新增 `lejuanRecords` API 对象 |
| **修改** | `src/pages.json` | 新增 `lejuan-proof` 页面路由 |

### 8.3 前端 admin（tgservice）

| 操作 | 文件路径 | 说明 |
|------|----------|------|
| **新增** | `frontend/admin/lejuan-records.html` | 乐捐一览管理页面 |
| **新增** | `frontend/admin/js/time-util.js` | 管理端时间工具 |
| **修改** | `frontend/admin/index.html` | 侧边栏添加「乐捐管理」入口 |

---

## 九、风险点与注意事项

### 9.1 并发安全

- `activateLejuan` 和 `pollCheck` 可能同时操作同一条记录
- **解决**：`activateLejuan` 中使用 `WHERE id = ? AND lejuan_status = 'pending'` 确保幂等，只有第一个执行的能成功更新
- `runInTransaction` 通过 writeQueue 串行化，天然防并发冲突

### 9.2 定时器可靠性

- Node.js `setTimeout` 在长时间运行时可能不可靠（事件循环阻塞等）
- **解决**：
  1. `pollCheck` 每分钟兜底
  2. 数据库 `scheduled` 字段防止重复调度
  3. 服务启动时全量恢复

### 9.3 助教无法上班的边界

- 需求要求「乐捐出去的助教无法自己点上班按钮」
- **实现**：在 `clock.vue` 的 `canClockIn` 中移除 `'乐捐'`
- 同时在 `coaches.js` 的 `clock-in` 路由中也需校验（后端防御）：

```javascript
// coaches.js clock-in 路由中添加
if (waterBoard.status === '乐捐') {
    throw { status: 400, error: '乐捐状态无法自行上班，请联系助教管理或店长' };
}
```

### 9.4 小时数计算

- 需求：「哪怕是01分也算一个小时」→ 使用 `Math.ceil` 向上取整
- 示例：
  - 14:00 开始，14:01 归来 → 1 小时
  - 14:00 开始，15:00 归来 → 1 小时
  - 14:00 开始，15:01 归来 → 2 小时
  - 14:00 开始，17:30 归来 → 4 小时

### 9.5 截图上传时效限制

- 仅近2天的乐捐记录可提交/修改截图
- 后端需校验 `created_at >= 2天前`
- 前端也需隐藏超过2天记录的截图按钮

### 9.6 旧数据兼容

- 已有的 `applications` 表中 `application_type = '乐捐报备'` 的记录需要处理
- **方案**：
  1. 保留旧记录，不迁移
  2. 新功能只使用 `lejuan_records` 表
  3. `lejuan-list.vue`（助教端）可以合并显示两边的数据（或仅显示新表）

### 9.7 数据库迁移脚本

建议在 `server.js` 启动时自动创建表和索引：

```javascript
// server.js 中新增
const initLejuanRecordsTable = async () => {
    try {
        await dbRun(`CREATE TABLE IF NOT EXISTS lejuan_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            coach_no TEXT NOT NULL,
            employee_id TEXT NOT NULL,
            stage_name TEXT,
            scheduled_start_time TEXT NOT NULL,
            extra_hours INTEGER,
            remark TEXT,
            lejuan_status TEXT DEFAULT 'pending',
            scheduled INTEGER DEFAULT 0,
            actual_start_time TEXT,
            return_time TEXT,
            lejuan_hours INTEGER,
            proof_image_url TEXT,
            proof_image_updated_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            returned_by TEXT
        )`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_lejuan_coach ON lejuan_records(coach_no)`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_lejuan_status ON lejuan_records(lejuan_status)`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_lejuan_scheduled ON lejuan_records(scheduled_start_time)`);
        console.log('✅ lejuan_records 表初始化完成');
    } catch (err) {
        if (!err.message.includes('already exists')) {
            console.error('lejuan_records 表初始化失败:', err);
        }
    }
};
```

---

## 十、测试用例建议

| 编号 | 场景 | 预期结果 |
|------|------|----------|
| T1 | 助教提交乐捐报备，时间=下一个整点 | 创建记录 pending，定时器设定成功，水牌不变 |
| T2 | 定时器到时间 | 记录变 active，水牌变乐捐 |
| T3 | 助教在乐捐状态点上班 | 后端拒绝，提示「乐捐状态无法自行上班」 |
| T4 | 助教管理点击乐捐归来（过了1分钟） | 小时数=1，水牌变空闲 |
| T5 | 助教管理点击乐捐归来（过了2小时5分钟） | 小时数=3，水牌变空闲 |
| T6 | 服务重启后恢复定时器 | 未到期的记录重新设定，已过期的立即激活 |
| T7 | 助教上传付款截图（近2天） | 截图保存成功 |
| T8 | 助教上传付款截图（超过2天） | 后端拒绝，提示超时 |
| T9 | 同一助教已有pending记录，再提交 | 拒绝，提示「已有待出发的乐捐」 |
| T10 | 提交时间不是整点（如14:30） | 前端校验阻止 / 后端校验拒绝 |

---

## 附录：相关现有文件索引

| 文件 | 路径 |
|------|------|
| 申请事项路由 | `/TG/tgservice/backend/routes/applications.js` |
| 助教路由 | `/TG/tgservice/backend/routes/coaches.js` |
| 水牌路由 | `/TG/tgservice/backend/routes/water-boards.js` |
| 数据库模块 | `/TG/tgservice/backend/db/index.js` |
| 时间工具(后端) | `/TG/tgservice/backend/utils/time.js` |
| 服务入口 | `/TG/tgservice/backend/server.js` |
| 乐捐报备(前端) | `/TG/tgservice-uniapp/src/pages/internal/lejuan.vue` |
| 乐捐一览(前端) | `/TG/tgservice-uniapp/src/pages/internal/lejuan-list.vue` |
| 上班下班(前端) | `/TG/tgservice-uniapp/src/pages/internal/clock.vue` |
| 时间工具(前端) | `/TG/tgservice-uniapp/src/utils/time-util.js` |
| API封装(前端) | `/TG/tgservice-uniapp/src/utils/api-v2.js` |
