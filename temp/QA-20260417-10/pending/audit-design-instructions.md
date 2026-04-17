你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
```
# QA-20260417-10 设计方案：会员管理 — 同步助教

> 作者：程序员A | 日期：2026-04-17 | 状态：待评审

---

## 一、需求概述

后台 Admin 会员管理页面新增「同步助教」按钮，功能：
1. 点击后根据手机号匹配助教表（coaches）中的助教
2. 列出匹配清单，用户勾选是否同步
3. 同步逻辑：
   - 将助教工号（employee_id）和艺名（stage_name）写入会员备注（remark）
   - 会员性别为空时，自动设为「女」
   - 会员姓名为空时，自动填入助教艺名

---

## 二、数据库表结构

### members 表
| 字段 | 类型 | 说明 |
|------|------|------|
| member_no | INTEGER PK | 会员号 |
| phone | TEXT UNIQUE | 手机号 |
| openid | TEXT | 微信openid |
| name | TEXT | 姓名 |
| gender | TEXT | 性别（男/女/空） |
| remark | TEXT | 备注 |
| created_at | DATETIME | 注册时间 |
| updated_at | DATETIME | 更新时间 |

### coaches 表
| 字段 | 类型 | 说明 |
|------|------|------|
| coach_no | INTEGER PK | 助教内部编号 |
| employee_id | TEXT | 助教工号 |
| stage_name | TEXT | 艺名 |
| phone | TEXT | 手机号 |
| status | TEXT | 状态（全职/兼职/离职等） |

**匹配键**：`members.phone = coaches.phone`（精确匹配）

---

## 三、后端 API 设计

### 3.1 匹配接口

```
POST /api/admin/members/sync-coaches/preview
权限：authMiddleware + requireBackendPermission(['coachManagement'])
```

**请求体**：无参数（全量匹配所有有手机号的会员）

**响应**：
```json
{
  "success": true,
  "matches": [
    {
      "member_no": 1,
      "phone": "13800138000",
      "name": "张三",
      "gender": "",
      "remark": "",
      "coach_employee_id": "T001",
      "coach_stage_name": "小美",
      "coach_status": "全职"
    }
  ],
  "summary": {
    "totalMembers": 100,
    "totalCoaches": 20,
    "matchedCount": 5
  }
}
```

**匹配 SQL**：
```sql
SELECT 
  m.member_no, m.phone, m.name, m.gender, m.remark,
  c.employee_id AS coach_employee_id, 
  c.stage_name AS coach_stage_name,
  c.status AS coach_status
FROM members m
INNER JOIN coaches c ON m.phone = c.phone
WHERE m.phone IS NOT NULL AND m.phone != ''
  AND c.phone IS NOT NULL AND c.phone != ''
  AND c.status != '离职'
ORDER BY m.member_no
```

**设计说明**：
- 使用 `INNER JOIN` 只返回有匹配的记录
- 排除 `status = '离职'` 的助教（在职助教才有同步意义）
- 排除空手机号
- 返回完整的会员和助教信息，方便前端展示对比

---

### 3.2 执行同步接口

```
POST /api/admin/members/sync-coaches/execute
权限：authMiddleware + requireBackendPermission(['coachManagement'])
```

**请求体**：
```json
{
  "items": [
    {
      "member_no": 1,
      "coach_employee_id": "T001",
      "coach_stage_name": "小美"
    },
    {
      "member_no": 3,
      "coach_employee_id": "T003",
      "coach_stage_name": "小雪"
    }
  ]
}
```

**响应**：
```json
{
  "success": true,
  "syncedCount": 2,
  "details": [
    { "member_no": 1, "status": "success", "updated_fields": ["remark", "gender", "name"] },
    { "member_no": 3, "status": "success", "updated_fields": ["remark"] }
  ],
  "errors": []
}
```

**同步逻辑（逐条处理）**：

对每个 item：
1. 校验 member_no 存在
2. 读取当前会员记录（检查 name、gender、remark 是否为空）
3. 构建更新：
   - **remark**：追加格式 `[助教] 工号:XX, 艺名:XXX`
     - 如果已有该助教标记，则更新该标记（幂等）
     - 如果已有其他备注，则追加到末尾（用分号分隔）
   - **gender**：`IFNULL(gender, '') = ''` → 设为 `'女'`
   - **name**：`IFNULL(name, '') = ''` → 设为教练 stage_name
4. 使用 `enqueueRun` 执行 UPDATE
5. 记录 `updated_at = TimeUtil.nowDB()`

**核心 SQL 模板**：
```sql
UPDATE members 
SET remark = ?, 
    gender = CASE WHEN IFNULL(gender, '') = '' THEN '女' ELSE gender END,
    name = CASE WHEN IFNULL(name, '') = ? THEN ? ELSE name END,
    updated_at = ?
WHERE member_no = ?
```

**备注处理逻辑**：
```javascript
function buildRemark(currentRemark, employeeId, stageName) {
  const newTag = `[助教] 工号:${employeeId}, 艺名:${stageName}`;
  if (!currentRemark || currentRemark.trim() === '') {
    return newTag;
  }
  // 如果已有相同工号的助教标记，替换它
  const regex = /\[助教\]\s*工号:[^,]+,\s*艺名:[^\]]*/g;
  if (regex.test(currentRemark)) {
    return currentRemark.replace(regex, newTag);
  }
  // 否则追加
  return currentRemark + '；' + newTag;
}
```

---

## 四、前端设计

### 4.1 页面布局修改

在 `admin/members.html` 的 `page-header` 区域，在「+ 添加会员」按钮旁边新增「同步助教」按钮：

```html
<div class="page-header">
  <div class="page-title">会员管理</div>
  <div>
    <button class="btn btn-secondary" onclick="openSyncCoachModal()" style="margin-right: 8px;">🔄 同步助教</button>
    <button class="btn btn-primary" onclick="showModal()">+ 添加会员</button>
  </div>
</div>
```

样式补充：
```css
.btn-secondary { background: rgba(255,255,255,0.1); color: #d4af37; border: 1px solid rgba(218,165,32,0.3); }
.btn-secondary:hover { background: rgba(212,175,55,0.15); }
.btn-danger { background: rgba(255,77,79,0.8); color: #fff; }
```

### 4.2 同步弹窗 HTML

在现有编辑弹窗之后新增同步弹窗：

```html
<!-- 同步助教弹窗 -->
<div class="modal" id="syncCoachModal">
  <div class="modal-content" style="max-width: 700px;">
    <div class="modal-title">🔄 同步助教信息到会员</div>
    <div id="syncCoachLoading" style="text-align:center; padding: 40px; color: rgba(255,255,255,0.5);">正在匹配...</div>
    <div id="syncCoachSummary" style="display:none; margin-bottom: 16px;"></div>
    <div id="syncCoachList" style="display:none; max-height: 400px; overflow-y: auto;">
      <table class="member-table" style="font-size: 13px;">
        <thead>
          <tr>
            <th style="width: 40px;"><input type="checkbox" id="syncAllCheck" onchange="toggleAllSync(this.checked)"></th>
            <th>会员号</th>
            <th>手机号</th>
            <th>姓名</th>
            <th>性别</th>
            <th>备注</th>
            <th>助教工号</th>
            <th>助教艺名</th>
            <th>同步后效果</th>
          </tr>
        </thead>
        <tbody id="syncCoachTableBody"></tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button class="btn btn-cancel" onclick="closeSyncCoachModal()">取消</button>
      <button class="btn btn-primary" onclick="executeSync()" id="syncExecBtn" disabled>确认同步 (<span id="syncCount">0</span>)</button>
    </div>
  </div>
</div>
```

### 4.3 同步弹窗 JS 逻辑

```javascript
// ===== 同步助教功能 =====

let syncCoachMatches = []; // 匹配结果缓存

async function openSyncCoachModal() {
  document.getElementById('syncCoachModal').classList.add('show');
  document.getElementById('syncCoachLoading').style.display = 'block';
  document.getElementById('syncCoachSummary').style.display = 'none';
  document.getElementById('syncCoachList').style.display = 'none';
  document.getElementById('syncExecBtn').disabled = true;
  
  try {
    const data = await api('/api/admin/members/sync-coaches/preview', { method: 'POST' });
    syncCoachMatches = data.matches || [];
    
    document.getElementById('syncCoachLoading').style.display = 'none';
    
    if (syncCoachMatches.length === 0) {
      document.getElementById('syncCoachSummary').style.display = 'block';
      document.getElementById('syncCoachSummary').innerHTML = 
        '<div style="text-align:center; padding: 20px; color: rgba(255,255,255,0.5);">暂无匹配到助教的会员</div>';
      return;
    }
    
    // 显示汇总
    const summary = data.summary || {};
    document.getElementById('syncCoachSummary').style.display = 'block';
    document.getElementById('syncCoachSummary').innerHTML = 
      `<span style="color: #d4af37;">共 ${summary.matchedCount || syncCoachMatches.length} 位会员匹配到助教信息</span>`;
    
    // 渲染列表
    renderSyncCoachList();
    document.getElementById('syncCoachList').style.display = 'block';
    
  } catch (err) {
    document.getElementById('syncCoachLoading').style.display = 'none';
    showToast('匹配失败：' + (err.error || '网络错误'));
  }
}

function closeSyncCoachModal() {
  document.getElementById('syncCoachModal').classList.remove('show');
  syncCoachMatches = [];
}

function renderSyncCoachList() {
  const tbody = document.getElementById('syncCoachTableBody');
  tbody.innerHTML = syncCoachMatches.map((m, i) => `
    <tr>
      <td><input type="checkbox" class="sync-check" data-index="${i}" onchange="updateSyncCount()"></td>
      <td>${m.member_no}</td>
      <td style="font-family: monospace; color: #d4af37;">${maskPhone(m.phone)}</td>
      <td>${m.name || '<span style="color:rgba(255,255,255,0.3)">空</span>'}</td>
      <td>${m.gender || '<span style="color:rgba(255,255,255,0.3)">空</span>'}</td>
      <td style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${m.remark || ''}">${m.remark || '-'}</td>
      <td style="color: #3498db;">${m.coach_employee_id || '-'}</td>
      <td style="color: #e91e63;">${m.coach_stage_name || '-'}</td>
      <td style="font-size: 12px; color: rgba(255,255,255,0.5);">
        ${m.gender ? '' : '性别→女'}${(!m.gender && !m.name) ? ' ' : ''}${m.name ? '' : '姓名→' + m.coach_stage_name}
      </td>
    </tr>
  `).join('');
}

function toggleAllSync(checked) {
  document.querySelectorAll('.sync-check').forEach(cb => cb.checked = checked);
  updateSyncCount();
}

function updateSyncCount() {
  const count = document.querySelectorAll('.sync-check:checked').length;
  document.getElementById('syncCount').textContent = count;
  document.getElementById('syncExecBtn').disabled = count === 0;
}

async function executeSync() {
  const checkedBoxes = document.querySelectorAll('.sync-check:checked');
  if (checkedBoxes.length === 0) {
    showToast('请勾选需要同步的会员');
    return;
  }
  
  const items = [];
  checkedBoxes.forEach(cb => {
    const idx = parseInt(cb.dataset.index);
    const m = syncCoachMatches[idx];
    items.push({
      member_no: m.member_no,
      coach_employee_id: m.coach_employee_id,
      coach_stage_name: m.coach_stage_name
    });
  });
  
  const btn = document.getElementById('syncExecBtn');
  btn.disabled = true;
  btn.textContent = '同步中...';
  
  try {
    const data = await api('/api/admin/members/sync-coaches/execute', {
      method: 'POST',
      body: JSON.stringify({ items })
    });
    
    showToast(`同步成功！已更新 ${data.syncedCount} 位会员`);
    closeSyncCoachModal();
    loadMembers(); // 刷新列表
    
  } catch (err) {
    showToast('同步失败：' + (err.error || '网络错误'));
    btn.disabled = false;
    btn.innerHTML = '确认同步 (<span id="syncCount">0</span>)';
  }
}
```

---

## 五、后端代码实现位置

在 `/TG/tgservice/backend/server.js` 中，会员管理 API 区域（约第 3221 行之后）新增两个路由：

```javascript
// =============== 会员同步助教 API ===============

/**
 * POST /api/admin/members/sync-coaches/preview
 * 匹配会员与助教（根据手机号）
 */
app.post('/api/admin/members/sync-coaches/preview', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    // 匹配查询
    const matches = await dbAll(`
      SELECT 
        m.member_no, m.phone, m.name, m.gender, m.remark,
        c.employee_id AS coach_employee_id, 
        c.stage_name AS coach_stage_name,
        c.status AS coach_status
      FROM members m
      INNER JOIN coaches c ON m.phone = c.phone
      WHERE m.phone IS NOT NULL AND m.phone != ''
        AND c.phone IS NOT NULL AND c.phone != ''
        AND c.status != '离职'
      ORDER BY m.member_no
    `);

    // 统计
    const totalMembers = await dbGet('SELECT COUNT(*) as cnt FROM members');
    const totalCoaches = await dbGet("SELECT COUNT(*) as cnt FROM coaches WHERE status != '离职'");

    res.json({
      success: true,
      matches: matches || [],
      summary: {
        totalMembers: totalMembers?.cnt || 0,
        totalCoaches: totalCoaches?.cnt || 0,
        matchedCount: matches ? matches.length : 0
      }
    });
  } catch (err) {
    logger.error(`会员同步助教预览失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * POST /api/admin/members/sync-coaches/execute
 * 执行同步
 */
app.post('/api/admin/members/sync-coaches/execute', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: '请选择需要同步的会员' });
    }

    const details = [];
    const errors = [];

    for (const item of items) {
      const { member_no, coach_employee_id, coach_stage_name } = item;
      
      try {
        // 读取当前会员信息
        const member = await dbGet(
          'SELECT member_no, name, gender, remark FROM members WHERE member_no = ?',
          [member_no]
        );
        
        if (!member) {
          errors.push({ member_no, status: 'not_found', message: '会员不存在' });
          continue;
        }

        // 构建新备注
        const newRemark = buildRemark(member.remark, coach_employee_id, coach_stage_name);
        
        // 判断需要更新的字段
        const updatedFields = ['remark'];
        const genderUpdate = (!member.gender || member.gender.trim() === '') ? '女' : null;
        if (genderUpdate) updatedFields.push('gender');
        
        const nameUpdate = (!member.name || member.name.trim() === '') ? coach_stage_name : null;
        if (nameUpdate) updatedFields.push('name');

        // 执行更新（使用 enqueueRun 写入队列）
        await enqueueRun(
          `UPDATE members 
           SET remark = ?, 
               gender = CASE WHEN IFNULL(gender, '') = '' THEN ? ELSE gender END,
               name = CASE WHEN IFNULL(name, '') = '' THEN ? ELSE name END,
               updated_at = ?
           WHERE member_no = ?`,
          [newRemark, genderUpdate || member.gender, nameUpdate || member.name, TimeUtil.nowDB(), member_no]
        );

        details.push({ member_no, status: 'success', updated_fields: updatedFields });
        
      } catch (err) {
        errors.push({ member_no, status: 'error', message: err.message });
      }
    }

    operationLog.info(`会员同步助教: 成功 ${details.length} 条, 失败 ${errors.length} 条`);

    res.json({
      success: true,
      syncedCount: details.length,
      details,
      errors
    });
  } catch (err) {
    logger.error(`会员同步助教执行失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 构建备注字符串（幂等处理）
 */
function buildRemark(currentRemark, employeeId, stageName) {
  const newTag = `[助教] 工号:${employeeId}, 艺名:${stageName}`;
  if (!currentRemark || currentRemark.trim() === '') {
    return newTag;
  }
  // 如果已有相同工号的助教标记，替换它
  const regex = /\[助教\]\s*工号:[^,]+,\s*艺名:[^\]]*/g;
  if (regex.test(currentRemark)) {
    return currentRemark.replace(regex, newTag);
  }
  // 否则追加
  return currentRemark + '；' + newTag;
}
```

---

## 六、验收测试用例

### 6.1 手机号匹配逻辑
| 用例 | 会员phone | 助教phone | 预期结果 |
|------|-----------|-----------|----------|
| T1 | 13800138000 | 13800138000 | ✅ 匹配成功 |
| T2 | 13800138000 | (空) | ❌ 不匹配 |
| T3 | (空) | 13800138000 | ❌ 不匹配 |
| T4 | 13800138000 | 13800138001 | ❌ 不匹配 |
| T5 | 13800138000 | 13800138000(助教已离职) | ❌ 不匹配 |

### 6.2 同步清单弹窗
| 用例 | 场景 | 预期 |
|------|------|------|
| T6 | 有匹配结果 | 弹窗显示匹配列表，含 checkbox |
| T7 | 无匹配结果 | 弹窗显示"暂无匹配到助教的会员" |
| T8 | 全选 checkbox | 所有行被勾选，同步按钮显示数量 |
| T9 | 取消勾选 | 同步按钮数量减少，全0时按钮禁用 |

### 6.3 备注字段格式
| 用例 | 会员原备注 | 助教信息 | 预期新备注 |
|------|-----------|----------|-----------|
| T10 | (空) | T001/小美 | `[助教] 工号:T001, 艺名:小美` |
| T11 | "VIP客户" | T001/小美 | `VIP客户；[助教] 工号:T001, 艺名:小美` |
| T12 | `[助教] 工号:T001, 艺名:小红` | T001/小美 | `[助教] 工号:T001, 艺名:小美`（替换） |
| T13 | `[助教] 工号:T001, 艺名:小红` | T002/小雪 | `[助教] 工号:T002, 艺名:小雪`（正则只匹配一次，注意幂等问题） |

> ⚠️ T13 需要注意：正则 `/\[助教\]\s*工号:[^,]+,\s*艺名:[^\]]*/g` 会匹配所有助教标记。如果会员备注中已有多个助教标记（不太可能但理论上），replace 会把所有标记都替换为新的。实际场景中一个会员只会匹配一个助教（phone 唯一），所以这不是问题。

### 6.4 性别和姓名空值判断
| 用例 | 原性别 | 原姓名 | 预期 |
|------|--------|--------|------|
| T14 | (空/null) | (空/null) | gender→女, name→助教艺名 |
| T15 | (空/null) | "张三" | gender→女, name不变 |
| T16 | "男" | (空/null) | gender不变, name→助教艺名 |
| T17 | "男" | "张三" | 都不变，只更新备注 |

### 6.5 勾选批量同步
| 用例 | 场景 | 预期 |
|------|------|------|
| T18 | 勾选3条执行同步 | 3条会员记录被更新 |
| T19 | 勾选2条，其中1条会员不存在 | 1条成功，1条失败进入 errors |
| T20 | 勾选0条点击同步 | 按钮禁用，无法点击 |

---

## 七、修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `backend/server.js` | 新增 2 个 API 路由 + 1 个辅助函数 |
| `admin/members.html` | 新增按钮 + 同步弹窗 HTML + JS 逻辑 |

---

## 八、编码规范遵守检查

| 规范 | 遵守情况 |
|------|----------|
| 🔴 时间处理用 TimeUtil | ✅ 所有 updated_at 使用 `TimeUtil.nowDB()` |
| 🔴 数据库连接复用 db/index.js | ✅ 使用 `dbAll`、`dbGet`、`enqueueRun` |
| 🔴 数据库写入用 writeQueue | ✅ 所有 UPDATE 使用 `enqueueRun` |
| 🔴 页面禁止显示 coach_no | ✅ 前端只展示 employee_id，不展示 coach_no |
| SQL 参数化查询 | ✅ 所有查询使用 `?` 参数化，无 SQL 注入风险 |

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