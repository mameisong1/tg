# QA-20260416-03 设计方案：同步水牌增加离店助教残留台桌号检测

## 1. 需求概述

后台 Admin 助教管理页面的「🔄 同步水牌」按钮，在现有同步（孤儿数据删除 + 缺失数据添加）的基础上，**增加对离店助教残留台桌号的检测和清理功能**。

- **触发场景**：用户点击「同步水牌」按钮
- **检测目标**：水牌状态为离店（`休息`、`公休`、`请假`、`下班`）的助教，如果 `table_no` 字段非空（还有台桌号），则列举出来
- **用户操作**：在弹窗中显示残留台桌信息，用户勾选确认后，仅清除这些助教的 `table_no` 字段
- **约束**：只清空台桌号，不删除水牌记录本身（助教数据保留）

## 2. 现有代码分析

### 2.1 同步水牌弹窗位置

- **前端页面**：`/TG/tgservice/admin/coaches.html`（Docker 部署后映射到 `/admin/coaches.html`）
- **同步弹窗**：id=`syncModal`，包含加载状态、孤儿数据区、缺失数据区、摘要区
- **同步按钮**：页面顶部的 `🔄 同步水牌` 按钮，调用 `openSyncModal()`

### 2.2 现有同步 API（server.js）

| API | 方法 | 路径 | 权限 |
|-----|------|------|------|
| 预览同步 | GET | `/api/admin/coaches/sync-water-boards/preview` | `coachManagement` |
| 执行同步 | POST | `/api/admin/coaches/sync-water-boards/execute` | `coachManagement` |

现有流程：
1. `preview` → 检测孤儿记录（coaches 表不存在的、status=离职的）和缺失记录（coaches 表存在但 water_boards 表缺失的）
2. `execute` → 在事务中批量删除孤儿记录、插入缺失记录

### 2.3 清除台桌号的现有能力

- **`PUT /api/water-boards/:coach_no/status`**（`water-boards.js`）：已支持同时更新 `status` 和 `table_no`
- 只需传 `{ table_no: null }` 即可清空台桌号
- 已有 operation log 记录，但需要增加新类型

### 2.4 相关数据模型

```sql
-- water_boards 表
CREATE TABLE water_boards (
  id INTEGER PRIMARY KEY,
  coach_no TEXT,
  stage_name TEXT,
  status TEXT,           -- 状态：'休息','公休','请假','下班','早班空闲',...
  table_no TEXT,         -- 台桌号，逗号分隔字符串，如 "A1,A3,B2"
  clock_in_time TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

- `table_no` 存储格式：逗号分隔字符串，如 `"A1,A3,B2"`
- `parseTables()` 函数（`db/index.js`）：将字符串解析为数组 `["A1", "A3", "B2"]`

### 2.5 离店状态定义

```javascript
const offStatuses = ['下班', '休息', '公休', '请假'];
```

该常量已存在于 `water-boards.js` 第 107 行。

## 3. 技术方案

### 3.1 后端新增 API

#### 3.1.1 新增：离店助教残留台桌检测 API

```
GET /api/admin/coaches/water-boards/off-duty-tables
权限：coachManagement
```

**功能**：查询所有状态为离店且 table_no 非空的助教记录。

**SQL 实现**：

```javascript
// server.js 或 water-boards.js 中新增路由
app.get('/api/admin/coaches/water-boards/off-duty-tables', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const records = await dbAll(`
      SELECT wb.coach_no, wb.stage_name, wb.status, wb.table_no, wb.updated_at, c.shift, c.photos
      FROM water_boards wb
      LEFT JOIN coaches c ON wb.coach_no = CAST(c.coach_no AS TEXT)
      WHERE wb.status IN ('休息', '公休', '请假', '下班')
        AND wb.table_no IS NOT NULL
        AND wb.table_no != ''
      ORDER BY CAST(wb.coach_no AS INTEGER)
    `);
    
    const data = (records || []).map(r => ({
      ...r,
      table_no_list: parseTables(r.table_no)  // 利用现有 parseTables 函数
    }));
    
    res.json({
      success: true,
      data: data,
      count: data.length
    });
  } catch (err) {
    logger.error(`查询离店助教残留台桌失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});
```

**返回示例**：

```json
{
  "success": true,
  "data": [
    {
      "coach_no": "12",
      "stage_name": "小美",
      "status": "下班",
      "table_no": "A1,A3",
      "table_no_list": ["A1", "A3"],
      "updated_at": "2026-04-16 10:30:00",
      "shift": "早班",
      "photos": [...]
    }
  ],
  "count": 1
}
```

#### 3.1.2 修改：同步水牌预览 API

在现有 `GET /api/admin/coaches/sync-water-boards/preview` 的返回中，**新增 `offDutyWithTables` 字段**：

```javascript
// 在 preview 接口返回前追加
const offDutyWithTables = await dbAll(`
  SELECT wb.coach_no, wb.stage_name, wb.status, wb.table_no, wb.updated_at, c.shift, c.photos
  FROM water_boards wb
  LEFT JOIN coaches c ON wb.coach_no = CAST(c.coach_no AS TEXT)
  WHERE wb.status IN ('休息', '公休', '请假', '下班')
    AND wb.table_no IS NOT NULL
    AND wb.table_no != ''
  ORDER BY CAST(wb.coach_no AS INTEGER)
`);

const offDutyData = (offDutyWithTables || []).map(r => ({
  coach_no: r.coach_no,
  stage_name: r.stage_name,
  status: r.status,
  table_no: r.table_no,
  table_no_list: parseTables(r.table_no),
  table_count: parseTables(r.table_no).length
}));

res.json({
  orphanRecords: orphanRecords || [],
  missingRecords: missingRecords || [],
  offDutyWithTables: offDutyData,   // ← 新增
  summary: {
    orphanCount: orphanRecords ? orphanRecords.length : 0,
    missingCount: missingRecords ? missingRecords.length : 0,
    offDutyCount: offDutyData.length  // ← 新增
  }
});
```

> **方案选择说明**：选择将新数据集成到现有 preview API 而非独立 API，原因：
> 1. 前端 `openSyncModal()` 已经调用此 API，一次请求即可获取全部三类数据
> 2. 减少前端改动，只需在现有渲染逻辑中追加一个区域
> 3. 用户在一个弹窗中处理所有水牌相关清理，体验连贯

#### 3.1.3 修改：同步水牌执行 API

在现有 `POST /api/admin/coaches/sync-water-boards/execute` 中，**新增 `clearTableCoachNos` 参数**：

```javascript
// 在 execute 接口的 runInTransaction 回调中，追加清理逻辑
const { deleteOrphanIds, addMissingIds, clearTableCoachNos } = req.body;

// clearTableCoachNos 是教练编号数组，表示用户确认要清理台桌号的教练
// 只清空 table_no 字段，不删除 water_boards 记录

if (Array.isArray(clearTableCoachNos) && clearTableCoachNos.length > 0) {
  let cleared = 0;
  const nowDB = TimeUtil.nowDB();
  
  for (const coachNo of clearTableCoachNos) {
    // 获取当前 table_no 用于操作日志
    const wb = await tx.get('SELECT id, coach_no, stage_name, table_no, status FROM water_boards WHERE coach_no = ?', [coachNo]);
    if (wb && wb.table_no) {
      await tx.run(
        'UPDATE water_boards SET table_no = NULL, updated_at = ? WHERE coach_no = ?',
        [nowDB, coachNo]
      );
      
      const user = req.user;
      await operationLogService.create(tx, {
        operator_phone: user.username,
        operator_name: user.name,
        operation_type: '清理残留台桌',
        target_type: 'water_board',
        target_id: wb.id,
        old_value: JSON.stringify({ table_no: wb.table_no, status: wb.status }),
        new_value: JSON.stringify({ table_no: null, status: wb.status }),
        remark: `同步水牌时清理${wb.stage_name}(${wb.coach_no})残留台桌号：${wb.table_no} → 空（状态：${wb.status}）`
      });
      
      cleared++;
    }
  }
  
  // 返回新增 cleared 计数
  res.json({ success: true, deleted, added, cleared, errors: [] });
}
```

> **编码规范遵守**：
> - 时间处理：使用 `TimeUtil.nowDB()`，不使用 `datetime('now')`
> - 数据库连接：使用 `dbAll`（从 `db/index.js` 导出的唯一连接）
> - 数据库写入：在 `runInTransaction` 中使用 `tx.run()`，不裸开事务

### 3.2 前端修改

#### 3.2.1 同步弹窗新增区域

在 `syncModal` 中，于「孤儿数据区」和「缺失数据区」之间（或之后），新增 **「离店残留台桌」区域**：

```html
<!-- 离店残留台桌区 -->
<div id="offDutyTableSection" style="display:none;margin-bottom:16px">
  <div style="font-size:14px;color:#f39c12;margin-bottom:8px">
    ⚠️ 离店助教残留台桌（<span id="offDutyTableCount">0</span>人）— 将清空台桌号：
  </div>
  <table style="width:100%;font-size:13px;border-collapse:collapse">
    <thead><tr style="color:rgba(255,255,255,0.5);border-bottom:1px solid rgba(255,255,255,0.1)">
      <th style="padding:8px;text-align:left">
        <input type="checkbox" id="offDutyTableSelectAll" onchange="toggleOffDutyTableAll(this.checked)">
      </th>
      <th style="padding:8px;text-align:left">编号</th>
      <th style="padding:8px;text-align:left">艺名</th>
      <th style="padding:8px;text-align:left">当前状态</th>
      <th style="padding:8px;text-align:left">残留台桌号</th>
    </tr></thead>
    <tbody id="offDutyTableTableBody"></tbody>
  </table>
</div>
```

**台桌号显示样式**：用 tag 样式显示每个台桌号，便于阅读：

```
[A1] [A3] [B2]
```

#### 3.2.2 新增 CSS 样式

```css
/* 台桌号标签样式 */
.table-tag {
  display: inline-block;
  padding: 2px 8px;
  margin: 2px 4px 2px 0;
  background: rgba(243,156,18,0.2);
  border: 1px solid rgba(243,156,18,0.4);
  border-radius: 4px;
  color: #f39c12;
  font-size: 12px;
}
```

#### 3.2.3 JavaScript 逻辑变更

**`openSyncModal()`** 渲染逻辑中，追加离店残留台桌数据的渲染：

```javascript
function renderSyncResult() {
  // ... 现有的 orphan 和 missing 渲染逻辑不变 ...
  
  // ===== 新增：离店残留台桌 =====
  const offDutyData = syncData.offDutyWithTables || [];
  const offDutySection = document.getElementById('offDutyTableSection');
  if (offDutyData.length > 0) {
    offDutySection.style.display = 'block';
    document.getElementById('offDutyTableCount').textContent = offDutyData.length;
    document.getElementById('offDutyTableTableBody').innerHTML = offDutyData.map((o, i) => {
      const tableTags = o.table_no_list.map(t => `<span class="table-tag">${t}</span>`).join('');
      return `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
          <td style="padding:8px">
            <input type="checkbox" class="offDutyTable-check" data-index="${i}" checked onchange="updateSyncSummary()">
          </td>
          <td style="padding:8px">${o.coach_no}</td>
          <td style="padding:8px">${o.stage_name}</td>
          <td style="padding:8px">${o.status}</td>
          <td style="padding:8px">${tableTags}</td>
        </tr>
      `;
    }).join('');
    document.getElementById('offDutyTableSelectAll').checked = true;
  } else {
    offDutySection.style.display = 'none';
  }
  
  updateSyncSummary();
}
```

**`toggleOffDutyTableAll()`** 全选/取消：

```javascript
function toggleOffDutyTableAll(checked) {
  document.querySelectorAll('.offDutyTable-check').forEach(cb => cb.checked = checked);
  updateSyncSummary();
}
```

**`updateSyncSummary()`** 更新摘要，增加清空台桌计数：

```javascript
function updateSyncSummary() {
  const deleteCount = document.querySelectorAll('.orphan-check:checked').length;
  const addCount = document.querySelectorAll('.missing-check:checked').length;
  const clearCount = document.querySelectorAll('.offDutyTable-check:checked').length;  // 新增
  document.getElementById('summaryDelete').textContent = deleteCount;
  document.getElementById('summaryAdd').textContent = addCount;
  // 新增摘要文本
  document.getElementById('syncSummary').innerHTML = 
    `将删除 <span id="summaryDelete">${deleteCount}</span> 条，添加 <span id="summaryAdd">${addCount}</span> 条，清空 <span id="summaryClear">${clearCount}</span> 人台桌号`;
}
```

**`executeSync()`** 执行时收集 offDutyTable 勾选数据：

```javascript
async function executeSync() {
  // ... 现有 deleteOrphanIds 和 addMissingIds 收集不变 ...
  
  // ===== 新增：收集要清理台桌的教练编号 =====
  const clearTableCoachNos = [];
  document.querySelectorAll('.offDutyTable-check:checked').forEach(cb => {
    clearTableCoachNos.push(syncData.offDutyWithTables[parseInt(cb.dataset.index)].coach_no);
  });
  
  // 全部都没选，提示
  if (deleteOrphanIds.length === 0 && addMissingIds.length === 0 && clearTableCoachNos.length === 0) {
    showToast('请至少选择一条操作');
    return;
  }
  
  // 调用 API 时新增 clearTableCoachNos 参数
  const result = await api('/api/admin/coaches/sync-water-boards/execute', {
    method: 'POST',
    body: JSON.stringify({ deleteOrphanIds, addMissingIds, clearTableCoachNos })
  });
  
  // 结果提示增加 cleared 计数
  if (result.success) {
    let msg = `✅ 同步完成`;
    if (result.deleted) msg += `：删除${result.deleted}条`;
    if (result.added) msg += `，添加${result.added}条`;
    if (result.cleared) msg += `，清空${result.cleared}人台桌号`;
    showToast(msg);
  }
}
```

## 4. 用户交互流程

```
用户点击「🔄 同步水牌」按钮
    │
    ▼
弹窗显示 syncModal，显示「⏳ 检测中...」
    │
    ▼
前端调用 GET /api/admin/coaches/sync-water-boards/preview
    │
    ▼
后端返回三类数据：
  1. orphanRecords   — 孤儿记录（coaches 表不存在 / 已离职）
  2. missingRecords  — 缺失记录（coaches 有但 water_boards 无）
  3. offDutyWithTables — 离店助教残留台桌号 ⭐ 新增
    │
    ▼
前端渲染三个区域：
  ┌─────────────────────────────────────────────────┐
  │ ⚠️ 孤儿数据（X条）— 将从水牌删除                │
  │   [☑] 编号 | 艺名 | 当前状态 | 原因             │
  ├─────────────────────────────────────────────────┤
  │ ➕ 缺失数据（X条）— 将添加到水牌               │
  │   [☑] 编号 | 艺名 | 状态 | 班次 | 初始状态      │
  ├─────────────────────────────────────────────────┤
  │ ⚠️ 离店助教残留台桌（X人）— 将清空台桌号 ⭐   │
  │   [☑] 编号 | 艺名 | 当前状态 | [A1] [A3] [B2]   │
  └─────────────────────────────────────────────────┘
    │
    ▼
摘要区：将删除 X 条，添加 X 条，清空 X 人台桌号
    │
    ▼
用户取消勾选不需要处理的项，点击「确认同步」
    │
    ▼
前端调用 POST /api/admin/coaches/sync-water-boards/execute
    参数: { deleteOrphanIds, addMissingIds, clearTableCoachNos }
    │
    ▼
后端在事务中执行：
  1. 删除孤儿 water_boards 记录
  2. 插入缺失 water_boards 记录
  3. UPDATE water_boards SET table_no = NULL WHERE coach_no IN (...) ⭐ 新增
  4. 记录操作日志
    │
    ▼
返回成功，弹窗关闭，提示「✅ 同步完成」
```

## 5. 数据库变更

**不需要数据库表结构变更。**

- `water_boards` 表已有 `table_no` 字段
- 只需将 `table_no` 更新为 `NULL` 即可清空
- 现有索引和约束不受影响

## 6. 文件变更清单

| 文件 | 变更类型 | 变更内容 |
|------|----------|----------|
| `backend/server.js` | 修改 | 1. `preview` API 返回值新增 `offDutyWithTables` 字段<br>2. `execute` API 新增 `clearTableCoachNos` 处理逻辑 |
| `admin/coaches.html` | 修改 | 1. 新增 offDutyTableSection HTML 区域<br>2. 新增 `.table-tag` CSS 样式<br>3. 新增 `renderSyncResult` 中离店台桌渲染<br>4. 新增 `toggleOffDutyTableAll` 函数<br>5. 修改 `updateSyncSummary` 增加清空计数<br>6. 修改 `executeSync` 增加 clearTableCoachNos 参数 |
| `backend/db/index.js` | 无变更 | 使用现有 `parseTables`、`runInTransaction`、`dbAll` |
| `backend/utils/time.js` | 无变更 | 使用现有 `TimeUtil.nowDB()` |

## 7. 边界情况处理

| 场景 | 处理方式 |
|------|----------|
| 离店助教 table_no 为空 | 不在检测结果中出现（SQL 已有 `table_no IS NOT NULL AND table_no != ''` 条件） |
| 助教既在孤儿列表中又在离店列表中 | 不会出现：孤儿列表要求 coaches 表不存在或 status=离职，离店列表要求 coaches 存在且 status 不是离职。如果助教已离职，同步水牌时会先删除其水牌记录，所以不会出现在离店列表中 |
| 清理台桌后 table_no 变为 NULL | 不影响水牌记录本身，助教数据完整保留 |
| 并发操作 | `runInTransaction` 通过 `enqueueWrite` 保证串行执行 |
| 操作日志 | 新增 `operation_type: '清理残留台桌'` 的操作日志记录 |

## 8. 验收标准

1. 点击「同步水牌」按钮，如果存在离店状态（休息/公休/请假/下班）且有台桌号的助教，弹窗中显示离店残留台桌区域
2. 离店残留台桌区域显示：助教编号、艺名、当前状态、残留台桌号（标签样式）
3. 默认全选，用户可取消勾选不需要的项
4. 点击「确认同步」后，勾选的助教 water_boards 记录中 `table_no` 被清空为 NULL
5. 助教的水牌记录（status、coach_no 等字段）保持不变
6. 操作日志中新增一条类型为「清理残留台桌」的记录
7. 如果不存在离店残留台桌数据，不显示该区域
8. 前端/后端代码遵守编码规范（TimeUtil、单连接、writeQueue 事务）
