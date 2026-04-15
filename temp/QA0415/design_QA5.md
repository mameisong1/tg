# QA5 技术方案：后台助教管理 - 水牌联动

> 设计日期：2026-04-15
> 设计者：A5
> 状态：待审核

---

## 一、需求描述

### Bug
删除助教后水牌还能看到她。

### 正确联动规则
| # | 场景 | 期望行为 | 当前状态 |
|---|------|----------|----------|
| 1 | 新增助教 | 自动创建水牌记录 | ✅ 已实现 |
| 2 | 删除助教 | 删除水牌记录 | ❌ **未实现** |
| 3 | 助教改为离职 | 删除水牌记录 | ❌ **未实现** |
| 4 | 改为全职/兼职 | 确认水牌记录存在 | ❌ **未实现** |

---

## 二、代码现状分析

### 2.1 涉及的接口位置

| 接口 | 文件 | 行号 | 功能 |
|------|------|------|------|
| `POST /api/admin/coaches` | `server.js` | ~2668 | 创建助教（含创建水牌） |
| `PUT /api/admin/coaches/:coachNo` | `server.js` | ~2720 | 更新助教（含status修改） |
| `DELETE /api/admin/coaches/:coachNo` | `server.js` | ~2767 | 删除助教 |
| `PUT /api/admin/coaches/:coachNo/shift` | `server.js` | ~2792 | 专用修改班次 |
| `PUT /api/coaches/v2/:coach_no/shift` | `routes/coaches.js` | ~223 | v2修改班次（已同步水牌） |

### 2.2 现有实现问题

#### 问题1：DELETE 未联动删除水牌
```javascript
// server.js 第 2767-2783 行（当前代码）
app.delete('/api/admin/coaches/:coachNo', ... , async (req, res) => {
    // 只检查状态
    const coach = await dbGet('SELECT status FROM coaches WHERE coach_no = ?', [req.params.coachNo]);
    // 只能删除离职助教
    if (coach.status !== '离职') {
      return res.status(400).json({ error: '只能删除离职助教' });
    }
    // ❌ 只删除了 coaches 表，没删除 water_boards
    await enqueueRun('DELETE FROM coaches WHERE coach_no = ?', [req.params.coachNo]);
    ...
});
```

#### 问题2：PUT 更新助教状态未联动水牌
```javascript
// server.js 第 2720-2762 行（当前代码）
app.put('/api/admin/coaches/:coachNo', ... , async (req, res) => {
    // ... 处理各种字段
    await enqueueRun(
      `UPDATE coaches SET ..., status = ?, shift = ?, ... WHERE coach_no = ?`,
      [..., status || '全职', resolvedShift, TimeUtil.nowDB(), req.params.coachNo]
    );
    // ❌ 没有根据 status 变化联动 water_boards
    ...
});
```

#### 问题3：PUT shift 专用接口未联动水牌
```javascript
// server.js 第 2792-2817 行（当前代码）
app.put('/api/admin/coaches/:coachNo/shift', ... , async (req, res) => {
    // 只更新班次
    await enqueueRun('UPDATE coaches SET shift = ?, updated_at = ? WHERE coach_no = ?', 
      [shift, TimeUtil.nowDB(), req.params.coachNo]);
    // ❌ 没有联动 water_boards 的状态映射
    ...
});
```

> **对比**：`routes/coaches.js` 中的 `PUT /api/coaches/v2/:coach_no/shift`（~223行）
> 已经实现了水牌状态映射联动（早班空闲↔晚班空闲等），可以参考复用。

### 2.3 前端行为
- `coaches.html` 中 `saveCoach()` 调用 `PUT /api/admin/coaches/:coachNo`，可以修改 status（全职/兼职/离职）
- `coaches.html` 中 `deleteCoach()` 调用 `DELETE /api/admin/coaches/:coachNo`
- `coaches.html` 批量班次页面调用 `PUT /api/admin/coaches/:coachNo/shift`

---

## 三、修改方案

### 3.1 修改1：DELETE 助教时同步删除水牌

**文件**：`server.js` 第 2767-2783 行

**改动**：在删除 coaches 记录之前，先删除 water_boards 记录。

```javascript
app.delete('/api/admin/coaches/:coachNo', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const coach = await dbGet('SELECT stage_name, status FROM coaches WHERE coach_no = ?', [req.params.coachNo]);
    if (!coach) {
      return res.status(404).json({ error: '助教不存在' });
    }

    // 全职和兼职助教不允许删除
    if (coach.status !== '离职') {
      return res.status(400).json({ error: '只能删除离职助教' });
    }

    // ✅ 先删除 water_boards 记录
    await enqueueRun('DELETE FROM water_boards WHERE coach_no = ?', [req.params.coachNo]);
    
    // 再删除 coaches 记录
    await enqueueRun('DELETE FROM coaches WHERE coach_no = ?', [req.params.coachNo]);
    
    operationLog.info(`删除助教: ${coach.stage_name}(${req.params.coachNo}), 水牌记录已同步删除`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});
```

**要点**：
- 使用 `enqueueRun` 串行化写操作（符合编码规范）
- 先删 water_boards，再删 coaches（避免外键依赖问题）

---

### 3.2 修改2：PUT 更新助教时联动水牌

**文件**：`server.js` 第 2720-2762 行

**改动**：在更新 coaches 之后，根据 status 变化联动处理 water_boards。

```javascript
app.put('/api/admin/coaches/:coachNo', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { employeeId, stageName, realName, phone, level, price, age, height, photos, video, intro, isPopular, status, shift } = req.body;

    const validShifts = ['早班', '晚班'];
    const finalShift = (shift && validShifts.includes(shift)) ? shift : undefined;

    const existing = await dbGet(
      'SELECT coach_no FROM coaches WHERE employee_id = ? AND stage_name = ? AND coach_no != ?',
      [employeeId, stageName, req.params.coachNo]
    );
    if (existing) {
      return res.status(400).json({ error: '该工号和艺名组合已被其他助教使用' });
    }

    const currentCoach = await dbGet('SELECT photos, videos, intro, age, height, shift, status FROM coaches WHERE coach_no = ?', [req.params.coachNo]);

    let finalPhotos = photos;
    if (!photos || (Array.isArray(photos) && photos.length === 0)) {
      finalPhotos = currentCoach?.photos ? JSON.parse(currentCoach.photos) : [];
    }

    let finalVideos = currentCoach?.videos ? JSON.parse(currentCoach.videos) : [];
    let finalIntro = intro !== undefined ? intro : (currentCoach?.intro || '');
    let finalAge = age !== undefined ? age : currentCoach?.age;
    let finalHeight = height !== undefined ? height : currentCoach?.height;
    let resolvedShift = finalShift !== undefined ? finalShift : (currentCoach?.shift || '早班');

    const newStatus = status || '全职';
    const oldStatus = currentCoach?.status || '全职';

    // 更新 coaches 表
    await enqueueRun(
      `UPDATE coaches SET employee_id = ?, stage_name = ?, real_name = ?, phone = ?, level = ?, price = ?, age = ?, height = ?, photos = ?, video = ?, intro = ?, videos = ?, is_popular = ?, status = ?, shift = ?, updated_at = ? WHERE coach_no = ?`,
      [employeeId, stageName, realName, phone || null, level, price, finalAge, finalHeight, JSON.stringify(finalPhotos || []), video, finalIntro, JSON.stringify(finalVideos || []), isPopular ? 1 : 0, newStatus, resolvedShift, TimeUtil.nowDB(), req.params.coachNo]
    );

    // ✅ 联动 water_boards 处理
    if (newStatus === '离职' && oldStatus !== '离职') {
      // 改为离职 → 删除水牌
      await enqueueRun('DELETE FROM water_boards WHERE coach_no = ?', [req.params.coachNo]);
      operationLog.info(`助教改为离职: ${req.params.coachNo}, 水牌记录已同步删除`);
    } else if ((newStatus === '全职' || newStatus === '兼职') && oldStatus === '离职') {
      // 从离职改为全职/兼职 → 创建水牌
      await enqueueRun(
        `INSERT INTO water_boards (coach_no, stage_name, status, created_at, updated_at)
         VALUES (?, ?, '下班', ?, ?)`,
        [req.params.coachNo, stageName, TimeUtil.nowDB(), TimeUtil.nowDB()]
      );
      operationLog.info(`助教恢复为${newStatus}: ${req.params.coachNo}, 水牌记录已同步创建`);
    }
    // 其他状态变化（全职↔兼职）：水牌已存在，不需要额外操作

    operationLog.info(`更新助教: ${req.params.coachNo}`);
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '该工号和艺名组合已被其他助教使用' });
    }
    logger.error(`更新助教失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});
```

**要点**：
- 新增获取 `oldStatus` 用于判断状态变化方向
- `离职` → 删除水牌（规则3）
- `离职` → `全职/兼职` → 创建水牌，初始状态为「下班」（规则4）
- `全职` ↔ `兼职` 互切 → 水牌已存在，无需操作

---

### 3.3 修改3：PUT shift 专用接口联动水牌

**文件**：`server.js` 第 2792-2817 行

**改动**：参考 `routes/coaches.js` 中的 v2 班次修改接口，增加水牌状态映射联动。

```javascript
app.put('/api/admin/coaches/:coachNo/shift', authMiddleware, requireBackendPermission(['coachManagement']), async (req, res) => {
  try {
    const { shift } = req.body;

    if (shift !== '早班' && shift !== '晚班') {
      return res.status(400).json({ error: '班次必须是早班或晚班' });
    }

    const coach = await dbGet('SELECT coach_no, stage_name, shift FROM coaches WHERE coach_no = ?', [req.params.coachNo]);
    if (!coach) {
      return res.status(404).json({ error: '助教不存在' });
    }

    const oldShift = coach.shift || '早班';

    // 更新班次
    await enqueueRun('UPDATE coaches SET shift = ?, updated_at = ? WHERE coach_no = ?', 
      [shift, TimeUtil.nowDB(), req.params.coachNo]);

    // ✅ 联动水牌状态映射（参考 routes/coaches.js v2 接口）
    const waterBoard = await dbGet('SELECT id, status FROM water_boards WHERE coach_no = ?', [req.params.coachNo]);
    if (waterBoard) {
      const statusMap = {
        '早班空闲': '晚班空闲',
        '晚班空闲': '早班空闲',
        '早班上桌': '晚班上桌',
        '晚班上桌': '早班上桌',
        '早加班': '晚加班',
        '晚加班': '早加班'
      };

      const oldStatus = waterBoard.status;
      const newStatus = statusMap[oldStatus];
      
      if (newStatus) {
        await enqueueRun(
          'UPDATE water_boards SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE coach_no = ?',
          [newStatus, req.params.coachNo]
        );
        operationLog.info(`班次变更联动: ${coach.stage_name}(${req.params.coachNo}) 水牌 ${oldStatus}→${newStatus}`);
      }
    }
    // 水牌不存在的情况（如离职助教）：静默跳过

    operationLog.info(`修改班次: ${coach.stage_name}(${req.params.coachNo}) ${oldShift} → ${shift}`);
    res.json({ success: true, coach_no: req.params.coachNo, old_shift: oldShift, new_shift: shift });
  } catch (err) {
    logger.error(`修改班次失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});
```

**要点**：
- 复用了 `routes/coaches.js` v2 接口的 `statusMap` 映射逻辑
- 早班↔晚班切换时，水牌状态也对应切换
- 水牌不存在时静默跳过（离职助教没有水牌是正常的）

---

## 四、涉及文件清单

| 文件 | 修改内容 |
|------|----------|
| `/TG/tgservice/backend/server.js` | 3处修改（DELETE、PUT、PUT shift） |

---

## 五、测试场景

| 场景 | 操作 | 预期结果 |
|------|------|----------|
| 删除离职助教 | 后台点击删除 | coaches 和 water_boards 两条记录都删除 |
| 全职改为离职 | 后台编辑助教，状态改为离职 | water_boards 记录被删除 |
| 离职恢复为全职 | 后台编辑助教，状态改为全职 | 新建 water_boards 记录，status='下班' |
| 离职恢复为兼职 | 后台编辑助教，状态改为兼职 | 新建 water_boards 记录，status='下班' |
| 全职改兼职 | 后台编辑助教，状态改为兼职 | 水牌记录不变（已存在） |
| 兼职改全职 | 后台编辑助教，状态改为全职 | 水牌记录不变（已存在） |
| 早班改晚班 | 批量班次页面修改 | water_boards 状态从早班*映射为晚班* |
| 晚班改早班 | 批量班次页面修改 | water_boards 状态从晚班*映射为早班* |
| 新增助教 | 后台添加助教 | 同时创建 water_boards 记录 |

---

## 六、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 删除 water_boards 时教练还有上桌状态 | 可能丢失数据 | 删除助教前提要求 status='离职'，离职时不可能在桌上 |
| 恢复离职助教时 water_boards 已存在 | UNIQUE 约束冲突 | INSERT 前可加 `NOT EXISTS` 检查，或先 DELETE 再 INSERT |
| enqueueRun 两次连续写 | 队列串行化，安全 | 符合编码规范第3条 |

**注意**：对于场景4（离职恢复为全职/兼职），需要额外防御：如果 water_boards 记录意外已存在（比如并发操作），INSERT 会因 UNIQUE 约束失败。改进方案：

```javascript
// 安全写法：先确保不存在，再创建
await enqueueRun('DELETE FROM water_boards WHERE coach_no = ?', [req.params.coachNo]);
await enqueueRun(
  `INSERT INTO water_boards (coach_no, stage_name, status, created_at, updated_at)
   VALUES (?, ?, '下班', ?, ?)`,
  [req.params.coachNo, stageName, TimeUtil.nowDB(), TimeUtil.nowDB()]
);
```

---

## 七、编码规范符合性检查

| 规范 | 是否符合 | 说明 |
|------|----------|------|
| 时间处理用时间类 | ✅ | 使用 `TimeUtil.nowDB()` |
| db操作复用 db/index.js | ✅ | 使用 `dbGet`, `enqueueRun` |
| db写入用 writeQueue | ✅ | 所有写操作通过 `enqueueRun` |
