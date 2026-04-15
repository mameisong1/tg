# 设计稿：助教管理页面「同步水牌」功能

> QA编号：QA-20260415-04
> 日期：2026-04-15
> 设计：程序员A

---

## 1. 后端 API 设计

### 1.1 预览同步差异（两阶段：先预览，后执行）

采用**预览+执行**两阶段设计，避免误操作。

#### 接口 1：预览同步差异

| 项目 | 值 |
|------|------|
| 路径 | `GET /api/admin/coaches/sync-water-boards/preview` |
| 权限 | `authMiddleware` + `requireBackendPermission(['coachManagement'])` |
| 请求参数 | 无 |
| 响应格式 | JSON |

**响应示例**：

```json
{
  "orphanRecords": [
    { "coach_no": 57, "stage_name": "某某", "wb_status": "早班空闲", "reason": "coaches表不存在" },
    { "coach_no": 12, "stage_name": "小红", "wb_status": "晚班上桌", "reason": "coaches.status=离职" }
  ],
  "missingRecords": [
    { "coach_no": 5, "stage_name": "小美", "status": "全职", "shift": "早班" },
    { "coach_no": 8, "stage_name": "小丽", "status": "兼职", "shift": "晚班" }
  ],
  "summary": {
    "orphanCount": 2,
    "missingCount": 2
  }
}
```

> 如果无差异，返回 `orphanRecords: []`, `missingRecords: []`。

#### 接口 2：执行同步

| 项目 | 值 |
|------|------|
| 路径 | `POST /api/admin/coaches/sync-water-boards/execute` |
| 权限 | `authMiddleware` + `requireBackendPermission(['coachManagement'])` |
| 请求参数 | JSON Body |

**请求参数**：

```json
{
  "deleteOrphanIds": [57, 12],
  "addMissingIds": [5, 8]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| deleteOrphanIds | number[] | 是（可为空数组） | 要删除的水牌孤儿记录 coach_no 列表 |
| addMissingIds | number[] | 是（可为空数组） | 要添加的水牌缺失记录 coach_no 列表 |

**响应格式**：

```json
{
  "success": true,
  "deleted": 2,
  "added": 2,
  "errors": []
}
```

```json
{
  "success": false,
  "error": "部分操作失败",
  "deleted": 1,
  "added": 2,
  "errors": ["coach_no=57: 删除失败，记录已被其他进程修改"]
}
```

---

## 2. 同步逻辑

### 2.1 孤儿数据检测 SQL

```sql
-- 孤儿类型A：water_boards中存在但coaches表中不存在的记录
SELECT wb.coach_no, wb.stage_name, wb.status AS wb_status,
       'coaches表不存在' AS reason
FROM water_boards wb
LEFT JOIN coaches c ON wb.coach_no = c.coach_no
WHERE c.coach_no IS NULL

UNION ALL

-- 孤儿类型B：coaches中status='离职'但water_boards中仍有记录的
SELECT wb.coach_no, wb.stage_name, wb.status AS wb_status,
       'coaches.status=离职' AS reason
FROM water_boards wb
INNER JOIN coaches c ON wb.coach_no = c.coach_no
WHERE c.status = '离职'

ORDER BY coach_no;
```

### 2.2 缺失数据检测 SQL

```sql
-- coaches表中全职/兼职但未在水牌表中的助教
SELECT c.coach_no, c.stage_name, c.status, c.shift
FROM coaches c
LEFT JOIN water_boards wb ON c.coach_no = wb.coach_no
WHERE c.status IN ('全职', '兼职')
  AND wb.coach_no IS NULL
ORDER BY c.coach_no;
```

### 2.3 删除逻辑

```
对每个要删除的 coach_no：
  DELETE FROM water_boards WHERE coach_no = ?
  验证：SELECT id FROM water_boards WHERE coach_no = ? → 应返回 null
  记录操作日志
```

### 2.4 插入逻辑

```
对每个要添加的 coach_no：
  从 coaches 表获取 stage_name, shift
  根据班次设置初始水牌状态：
    shift='晚班' → status='晚班空闲'
    shift='早班' → status='早班空闲'
  INSERT INTO water_boards (coach_no, stage_name, status, created_at, updated_at)
    VALUES (?, ?, ?, TimeUtil.nowDB(), TimeUtil.nowDB())
  验证：SELECT id FROM water_boards WHERE coach_no = ? → 应返回非空
  记录操作日志
```

### 2.5 事务封装

```
所有删除和插入操作在同一个 runInTransaction 中执行：

await runInTransaction(async (tx) => {
  // 1. 批量删除孤儿记录
  for (const coachNo of deleteOrphanIds) {
    await tx.run('DELETE FROM water_boards WHERE coach_no = ?', [coachNo]);
    // 验证删除
    const wbCheck = await tx.get('SELECT id FROM water_boards WHERE coach_no = ?', [coachNo]);
    if (wbCheck) throw new Error(`coach_no=${coachNo} 删除验证失败`);
  }
  
  // 2. 批量添加缺失记录
  for (const coachNo of addMissingIds) {
    const coach = await tx.get('SELECT stage_name, shift FROM coaches WHERE coach_no = ?', [coachNo]);
    if (!coach) throw new Error(`coach_no=${coachNo} 在coaches表中不存在`);
    const initialStatus = coach.shift === '晚班' ? '晚班空闲' : '早班空闲';
    await tx.run(
      'INSERT INTO water_boards (coach_no, stage_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [coachNo, coach.stage_name, initialStatus, TimeUtil.nowDB(), TimeUtil.nowDB()]
    );
    // 验证插入
    const wbCheck = await tx.get('SELECT id FROM water_boards WHERE coach_no = ?', [coachNo]);
    if (!wbCheck) throw new Error(`coach_no=${coachNo} 插入验证失败`);
  }
  
  // 3. 记录操作日志
  operationLog.info(`同步水牌: 删除${deleteOrphanIds.length}条孤儿记录, 添加${addMissingIds.length}条缺失记录`);
});
```

---

## 3. 前端交互设计

### 3.1 按钮位置

在助教管理页面 header 的「+ 添加助教」按钮**左侧**添加「🔄 同步水牌」按钮：

```html
<div class="page-header">
  <div class="page-title">助教管理</div>
  <div style="display:flex;gap:12px">
    <button class="btn btn-primary" style="background:linear-gradient(135deg,#3498db,#2980b9);color:#fff" onclick="openSyncModal()">🔄 同步水牌</button>
    <button class="btn btn-primary" onclick="showModal()">+ 添加助教</button>
  </div>
</div>
```

> 使用蓝色渐变区分于主操作按钮的金色渐变，降低视觉优先级。

### 3.2 同步弹窗

复用现有 `.modal` 样式，新增一个 `syncModal`：

```
┌──────────────────────────────────────────────┐
│  🔄 同步水牌                                  │
├──────────────────────────────────────────────┤
│                                              │
│  📊 检测结果                                  │
│  ─────────────────────────────────────       │
│                                              │
│  ⚠️ 孤儿数据（3条）— 将从水牌删除：            │
│  ┌──────────────────────────────────────┐    │
│  │ 编号 │ 艺名   │ 当前状态   │ 原因     │    │
│  │  57  │ 某某   │ 早班空闲   │ 不存在   │    │
│  │  12  │ 小红   │ 晚班上桌   │ 已离职   │    │
│  │  33  │ 小李   │ 休息     │ 已离职   │    │
│  └──────────────────────────────────────┘    │
│  [✓ 全选删除]                                 │
│                                              │
│  ➕ 缺失数据（2条）— 将添加到水牌：            │
│  ┌──────────────────────────────────────┐    │
│  │ 编号 │ 艺名   │ 状态   │ 班次  │ 初始状态│   │
│  │  5   │ 小美   │ 全职   │ 早班  │ 早班空闲│   │
│  │  8   │ 小丽   │ 兼职   │ 晚班  │ 晚班空闲│   │
│  └──────────────────────────────────────┘    │
│  [✓ 全选添加]                                 │
│                                              │
│  ─────────────────────────────────────       │
│  摘要：将删除 3 条，添加 2 条                  │
│                                              │
├──────────────────────────────────────────────┤
│  [取消]              [确认同步]               │
└──────────────────────────────────────────────┘
```

### 3.3 交互流程

```
1. 用户点击「🔄 同步水牌」按钮
   ↓
2. 前端调用 GET /api/admin/coaches/sync-water-boards/preview
   ↓
3. 如果 orphanRecords 和 missingRecords 都为空：
   → 显示 toast "✅ 水牌数据已同步，无需操作"
   → 关闭弹窗
   ↓
4. 否则：渲染检测结果到弹窗，展示表格
   - 默认全选（所有孤儿记录勾选删除，所有缺失记录勾选添加）
   - 用户可取消勾选某条记录（不删除/不添加）
   ↓
5. 用户点击「确认同步」
   → 收集被勾选的 coach_no 列表
   → 调用 POST /api/admin/coaches/sync-water-boards/execute
   ↓
6. 成功 → 显示 toast "✅ 同步完成：删除X条，添加X条" → 关闭弹窗 → 刷新助教列表
   失败 → 显示 toast "❌ 同步失败：错误信息" → 保持弹窗打开
```

### 3.4 弹窗 HTML 结构（新增）

```html
<!-- 同步水牌弹窗 -->
<div class="modal" id="syncModal">
  <div class="modal-content" style="max-width:600px">
    <div class="modal-title">🔄 同步水牌</div>
    
    <!-- 加载中 -->
    <div id="syncLoading" style="text-align:center;padding:40px;display:none">
      <div>⏳ 检测中...</div>
    </div>
    
    <!-- 检测结果 -->
    <div id="syncResult" style="display:none">
      <!-- 孤儿数据区 -->
      <div id="orphanSection" style="display:none;margin-bottom:16px">
        <div style="font-size:14px;color:#e74c3c;margin-bottom:8px">⚠️ 孤儿数据（<span id="orphanCount">0</span>条）— 将从水牌删除：</div>
        <table style="width:100%;font-size:13px;border-collapse:collapse">
          <thead><tr style="color:rgba(255,255,255,0.5);border-bottom:1px solid rgba(255,255,255,0.1)">
            <th style="padding:8px;text-align:left"><input type="checkbox" id="orphanSelectAll" onchange="toggleOrphanAll(this.checked)"></th>
            <th style="padding:8px;text-align:left">编号</th>
            <th style="padding:8px;text-align:left">艺名</th>
            <th style="padding:8px;text-align:left">当前状态</th>
            <th style="padding:8px;text-align:left">原因</th>
          </tr></thead>
          <tbody id="orphanTableBody"></tbody>
        </table>
      </div>
      
      <!-- 缺失数据区 -->
      <div id="missingSection" style="display:none;margin-bottom:16px">
        <div style="font-size:14px;color:#2ecc71;margin-bottom:8px">➕ 缺失数据（<span id="missingCount">0</span>条）— 将添加到水牌：</div>
        <table style="width:100%;font-size:13px;border-collapse:collapse">
          <thead><tr style="color:rgba(255,255,255,0.5);border-bottom:1px solid rgba(255,255,255,0.1)">
            <th style="padding:8px;text-align:left"><input type="checkbox" id="missingSelectAll" onchange="toggleMissingAll(this.checked)"></th>
            <th style="padding:8px;text-align:left">编号</th>
            <th style="padding:8px;text-align:left">艺名</th>
            <th style="padding:8px;text-align:left">状态</th>
            <th style="padding:8px;text-align:left">班次</th>
            <th style="padding:8px;text-align:left">初始状态</th>
          </tr></thead>
          <tbody id="missingTableBody"></tbody>
        </table>
      </div>
      
      <!-- 摘要 -->
      <div id="syncSummary" style="padding:12px;background:rgba(255,255,255,0.05);border-radius:8px;font-size:13px">
        将删除 <span id="summaryDelete">0</span> 条，添加 <span id="summaryAdd">0</span> 条
      </div>
    </div>
    
    <!-- 无需同步提示 -->
    <div id="syncNoDiff" style="display:none;text-align:center;padding:40px">
      <div style="font-size:48px;margin-bottom:16px">✅</div>
      <div style="font-size:16px;color:#2ecc71">水牌数据已同步，无需操作</div>
    </div>
    
    <div class="modal-actions">
      <button class="btn btn-cancel" onclick="closeSyncModal()">关闭</button>
      <button class="btn btn-primary" id="syncConfirmBtn" onclick="executeSync()" style="display:none">确认同步</button>
    </div>
  </div>
</div>
```

### 3.5 前端 JS 逻辑

```javascript
// ===== 同步水牌功能 =====

let syncData = { orphans: [], missing: [] };

async function openSyncModal() {
  document.getElementById('syncModal').classList.add('show');
  document.getElementById('syncLoading').style.display = 'block';
  document.getElementById('syncResult').style.display = 'none';
  document.getElementById('syncNoDiff').style.display = 'none';
  document.getElementById('syncConfirmBtn').style.display = 'none';
  
  try {
    const data = await api('/api/admin/coaches/sync-water-boards/preview');
    document.getElementById('syncLoading').style.display = 'none';
    
    if (data.orphanRecords.length === 0 && data.missingRecords.length === 0) {
      document.getElementById('syncNoDiff').style.display = 'block';
      return;
    }
    
    syncData = { orphans: data.orphanRecords, missing: data.missingRecords };
    renderSyncResult();
    document.getElementById('syncResult').style.display = 'block';
    document.getElementById('syncConfirmBtn').style.display = 'inline-block';
  } catch (err) {
    document.getElementById('syncLoading').style.display = 'none';
    showToast('❌ 检测失败：' + (err.message || '网络错误'));
    setTimeout(closeSyncModal, 2000);
  }
}

function renderSyncResult() {
  // 渲染孤儿表格
  const orphanSection = document.getElementById('orphanSection');
  if (syncData.orphans.length > 0) {
    orphanSection.style.display = 'block';
    document.getElementById('orphanCount').textContent = syncData.orphans.length;
    document.getElementById('orphanTableBody').innerHTML = syncData.orphans.map((o, i) => `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
        <td style="padding:8px"><input type="checkbox" class="orphan-check" data-index="${i}" checked onchange="updateSyncSummary()"></td>
        <td style="padding:8px">${o.coach_no}</td>
        <td style="padding:8px">${o.stage_name}</td>
        <td style="padding:8px">${o.wb_status}</td>
        <td style="padding:8px;color:rgba(255,255,255,0.5)">${o.reason}</td>
      </tr>
    `).join('');
  } else {
    orphanSection.style.display = 'none';
  }
  
  // 渲染缺失表格
  const missingSection = document.getElementById('missingSection');
  if (syncData.missing.length > 0) {
    missingSection.style.display = 'block';
    document.getElementById('missingCount').textContent = syncData.missing.length;
    document.getElementById('missingTableBody').innerHTML = syncData.missing.map((m, i) => {
      const initStatus = m.shift === '晚班' ? '晚班空闲' : '早班空闲';
      return `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
          <td style="padding:8px"><input type="checkbox" class="missing-check" data-index="${i}" checked onchange="updateSyncSummary()"></td>
          <td style="padding:8px">${m.coach_no}</td>
          <td style="padding:8px">${m.stage_name}</td>
          <td style="padding:8px">${m.status}</td>
          <td style="padding:8px">${m.shift}</td>
          <td style="padding:8px;color:#2ecc71">${initStatus}</td>
        </tr>
      `;
    }).join('');
  } else {
    missingSection.style.display = 'none';
  }
  
  // 全选checkbox状态
  document.getElementById('orphanSelectAll').checked = true;
  document.getElementById('missingSelectAll').checked = true;
  
  updateSyncSummary();
}

function toggleOrphanAll(checked) {
  document.querySelectorAll('.orphan-check').forEach(cb => cb.checked = checked);
  updateSyncSummary();
}

function toggleMissingAll(checked) {
  document.querySelectorAll('.missing-check').forEach(cb => cb.checked = checked);
  updateSyncSummary();
}

function updateSyncSummary() {
  const deleteCount = document.querySelectorAll('.orphan-check:checked').length;
  const addCount = document.querySelectorAll('.missing-check:checked').length;
  document.getElementById('summaryDelete').textContent = deleteCount;
  document.getElementById('summaryAdd').textContent = addCount;
}

async function executeSync() {
  const deleteOrphanIds = [];
  document.querySelectorAll('.orphan-check:checked').forEach(cb => {
    deleteOrphanIds.push(syncData.orphans[parseInt(cb.dataset.index)].coach_no);
  });
  
  const addMissingIds = [];
  document.querySelectorAll('.missing-check:checked').forEach(cb => {
    addMissingIds.push(syncData.missing[parseInt(cb.dataset.index)].coach_no);
  });
  
  if (deleteOrphanIds.length === 0 && addMissingIds.length === 0) {
    showToast('请至少选择一条操作');
    return;
  }
  
  const btn = document.getElementById('syncConfirmBtn');
  btn.disabled = true;
  btn.textContent = '同步中...';
  
  try {
    const result = await api('/api/admin/coaches/sync-water-boards/execute', {
      method: 'POST',
      body: JSON.stringify({ deleteOrphanIds, addMissingIds })
    });
    
    if (result.error) {
      showToast('❌ 同步失败：' + result.error);
    } else {
      showToast(`✅ 同步完成：删除${result.deleted}条，添加${result.added}条`);
      closeSyncModal();
      loadCoaches(); // 刷新助教列表
    }
  } catch (err) {
    showToast('❌ 同步失败：网络错误');
  } finally {
    btn.disabled = false;
    btn.textContent = '确认同步';
  }
}

function closeSyncModal() {
  document.getElementById('syncModal').classList.remove('show');
  syncData = { orphans: [], missing: [] };
}
```

---

## 4. 修改文件清单

| 文件 | 修改点 | 类型 |
|------|--------|------|
| `backend/server.js` | 新增 `GET /api/admin/coaches/sync-water-boards/preview` 接口（约第2900行后） | 新增 |
| `backend/server.js` | 新增 `POST /api/admin/coaches/sync-water-boards/execute` 接口 | 新增 |
| `admin/coaches.html` | 新增「🔄 同步水牌」按钮（page-header 区域） | 新增 |
| `admin/coaches.html` | 新增 `#syncModal` 弹窗 HTML | 新增 |
| `admin/coaches.html` | 新增同步水牌相关 JS 函数（openSyncModal/renderSyncResult/executeSync 等） | 新增 |

### 4.1 server.js 新增接口位置建议

**现有路由顺序**：
```
2667: GET    /api/admin/coaches
2681: POST   /api/admin/coaches
2734: PUT    /api/admin/coaches/:coachNo
2812: DELETE /api/admin/coaches/:coachNo
2851: PUT    /api/admin/coaches/:coachNo/shift
```

**路由匹配分析**：
- `GET /api/admin/coaches` (2667) 是精确匹配，不会匹配 `/api/admin/coaches/sync-water-boards/preview`
- `PUT /api/admin/coaches/:coachNo` (2734) 只匹配 PUT，不影响 GET/POST
- `DELETE /api/admin/coaches/:coachNo` (2812) 只匹配 DELETE，不影响 GET/POST

✅ 新接口可以安全地添加在 `PUT /api/admin/coaches/:coachNo/shift` 之后（约第 2900 行附近）。

### 4.2 coaches.html 验证

- ✅ `loadCoaches()` 函数已存在（第 295 行），刷新列表可直接调用
- ✅ 现有 `.modal` / `.modal-content` / `.modal-actions` 样式可复用
- ✅ 现有 `api()` 函数（第 286 行）可用于请求

### 4.2 权限复用

两个新接口复用现有权限体系：
- `authMiddleware` — 验证管理员登录态
- `requireBackendPermission(['coachManagement'])` — 验证助教管理权限

### 4.3 依赖模块

server.js 顶部已引入所需模块，无需新增 import：
- `TimeUtil` — 已在顶部引入
- `runInTransaction` — 已从 db/index.js 引入
- `operationLog` — 已有 operationLog 实例

---

## 5. 错误处理

### 5.1 降级策略

| 场景 | 处理方式 |
|------|----------|
| **Preview 接口请求超时/失败** | 前端显示 toast "检测失败：网络错误"，2秒后自动关闭弹窗 |
| **Execute 接口部分成功** | 返回 `success: false`，附带 `errors` 数组列出失败项，前端 toast 提示失败详情 |
| **数据库写冲突（SQLITE_BUSY）** | `runInTransaction` 内部已有 `busy_timeout=3000` 自动重试；超时后返回 500 错误 |
| **残留事务** | `runInTransaction` 已有 ROLLBACK 重试机制 |
| **并发点击** | 执行中禁用确认按钮（btn.disabled = true），防止重复提交 |
| **coaches表数据在预览和执行之间被修改** | Execute 接口中对每条操作重新查询 coaches 表验证，若数据不一致则跳过并记录到 errors |

### 5.2 数据一致性保障

1. **事务原子性**：所有删除和插入操作在同一个 `runInTransaction` 中执行，任一步骤失败则整体回滚。

2. **操作验证**：
   - 删除后执行 `SELECT id FROM water_boards WHERE coach_no = ?` 验证记录已删除
   - 插入后执行 `SELECT id FROM water_boards WHERE coach_no = ?` 验证记录已创建
   - 验证失败时抛出异常触发事务回滚

3. **操作日志**：同步完成后通过 `operationLog.info()` 记录操作摘要。

### 5.3 前端容错

| 场景 | 处理方式 |
|------|----------|
| 401 未授权 | 现有 api() 函数自动跳转 login.html |
| 网络断开 | fetch 超时/失败 → catch 块显示错误 toast |
| 响应解析失败 | try-catch 包裹 JSON 解析 |

---

## 6. 设计决策说明

### 为什么用预览+执行两阶段？

- 需求要求「向用户确认是否删除/添加」，两阶段设计天然支持
- 预览阶段只读（SELECT），不修改数据，安全
- 执行阶段用户可勾选/取消单条记录，灵活控制

### 为什么新接口写在 server.js 而不是独立路由文件？

- 现有 admin/coaches 相关接口全部写在 server.js 中（第 2667-2900 行）
- 保持与现有代码风格一致，降低维护成本

### 为什么用 `runInTransaction` 而不是 `beginTransaction`？

- `runInTransaction` 是 `enqueueWrite` 版本，确保写入串行化，不会与其他写操作冲突
- `beginTransaction` 是旧版（已标记 deprecated），不保证串行化
- 符合编码规范铁律第3条
