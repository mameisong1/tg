你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
```
# 后台Admin奖罚统计页面改造 - 技术设计方案

> QA编号: QA-20260418-02  
> 日期: 2026-04-18  
> 设计: 程序员A  

---

## 一、需求分析

### 1.1 核心需求

| # | 需求 | 说明 |
|---|------|------|
| 1 | 初始只查询统计结果 | 不要一次性把所有明细查询出来，数据量太大 |
| 2 | 弹框查看明细 | 点击统计结果的"查看明细"按钮，在弹框里显示所有明细 |
| 3 | 明细不可删除，金额可改为0 | 明细框里不能删除数据，只能把明细金额改为0 |
| 4 | 金额修改后统计结果跟着变 | 明细金额修改后，对应统计行的金额要实时更新 |
| 5 | 执行完毕按钮 | 每条统计数据里有两个按钮：查看明细 + 执行完毕，点击执行完毕把里面所有明细都设为已执行 |

### 1.2 现有问题分析

- **当前 `/api/reward-penalty/stats` 接口返回所有明细记录**，按人员分组后全量返回。当月奖罚记录多时，响应数据量巨大，前端渲染卡顿。
- **当前页面使用内联展开行**显示明细，而非弹框模式。
- **当前页面只有"全部执行"按钮**，没有"查看明细"按钮。

---

## 二、现有代码梳理

### 2.1 数据库表

**reward_penalties** (奖罚明细表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| type | TEXT NOT NULL | 奖罚类型（如"助教日常"、"服务日奖"） |
| confirm_date | TEXT NOT NULL | 确定日期 (YYYY-MM-DD) |
| phone | TEXT NOT NULL | 手机号（关联人员） |
| name | TEXT NOT NULL | 姓名 |
| amount | REAL NOT NULL | 金额（正=奖金，负=罚金） |
| remark | TEXT | 备注 |
| exec_status | TEXT DEFAULT '未执行' | 执行状态 |
| exec_date | TEXT | 执行日期 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

**唯一索引**: `idx_rp_unique(confirm_date, type, phone)`  
**其他索引**: phone, type, confirm_date, exec_status

**coaches** (助教表) - 用于关联获取 employee_id

| 字段 | 说明 |
|------|------|
| coach_no | 助教编号 |
| employee_id | 工号（**页面显示用**） |
| stage_name | 艺名 |
| real_name | 真实姓名 |
| phone | 手机号 |
| status | 状态 |

### 2.2 现有 API（只读分析，不修改）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reward-penalty/stats` | **本次需改造** - 当前返回全量明细分组数据 |
| POST | `/api/reward-penalty/batch-execute` | 批量执行（按 id 数组） |
| POST | `/api/reward-penalty/execute/:id` | 单条执行 |
| POST | `/api/reward-penalty/unexecute/:id` | 撤销执行 |
| GET | `/api/admin/reward-penalty/types` | 获取奖罚类型配置 |
| GET | `/api/reward-penalty/stats/summary` | 按类型汇总（已存在但不适用当前需求） |

### 2.3 现有前端

**文件**: `/TG/tgservice/admin/reward-penalty-stats.html`

- 使用内联展开行（`detail-row` CSS 类）显示明细
- 所有数据在 `loadData()` 中一次性加载到 `allRecords` 数组
- 筛选条件：月份（本月/上月）、奖罚类型、执行状态
- 批量操作：勾选后底部弹出批量执行栏

---

## 三、设计方案

### 3.1 设计原则

1. **两阶段加载**：首次只加载统计摘要，按需加载明细
2. **弹框模式**：明细在模态对话框中展示，支持编辑
3. **金额可改不可删**：金额可改为 0，但记录永不删除
4. **数据库写入统一走 writeQueue**：所有 UPDATE 通过 `enqueueRun` 或 `runInTransaction`
5. **时间统一使用 TimeUtil**：后端用 `TimeUtil.nowDB()`，前端用 `TimeUtil` 工具
6. **显示 employee_id，不显示 coach_no**：通过 LEFT JOIN coaches 获取

### 3.2 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `/TG/tgservice/backend/server.js` | **修改** | 改造 stats 接口 + 新增 2 个 API |
| `/TG/tgservice/admin/reward-penalty-stats.html` | **修改** | 改为弹框模式 + 两阶段加载 |

### 3.3 数据库变更

**无数据库变更。** 无需新增表、字段或索引。利用现有表和索引即可满足需求。

---

## 四、API 设计

### 4.1 改造：统计摘要接口（原有接口改造）

**请求**

```
GET /api/reward-penalty/stats?month=2026-04&type=&execStatus=未执行
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| month | string | 否 | 月份 YYYY-MM，默认本月 |
| type | string | 否 | 奖罚类型，空表示全部 |
| execStatus | string | 否 | 执行状态：`未执行`/`已执行`，空表示全部 |

**返回**

```json
{
  "success": true,
  "data": [
    {
      "phone": "16675852676",
      "name": "余莉桦",
      "employee_id": "1",
      "personTotal": 150.00,
      "totalCount": 5,
      "executedCount": 2,
      "pendingCount": 3,
      "pendingIds": [101, 102, 103]
    }
  ],
  "summary": {
    "totalAmount": 1200.50,
    "totalBonus": 2500.00,
    "totalPenalty": -1299.50,
    "totalCount": 50,
    "pendingCount": 30,
    "executedCount": 20
  }
}
```

**字段说明**

| 字段 | 说明 |
|------|------|
| phone | 手机号（人员标识） |
| name | 姓名 |
| employee_id | 工号，通过 LEFT JOIN coaches 获取；非助教人员为 `null` |
| personTotal | 该人员所有匹配记录的金额合计 |
| totalCount | 该人员匹配记录总数 |
| executedCount | 已执行记录数 |
| pendingCount | 未执行记录数 |
| pendingIds | 未执行记录的 id 数组（用于"执行完毕"按钮） |

**SQL 实现思路**

```sql
-- 统计摘要查询（按筛选条件分组聚合）
SELECT 
    rp.phone,
    rp.name,
    c.employee_id,
    SUM(rp.amount) as personTotal,
    COUNT(*) as totalCount,
    SUM(CASE WHEN rp.exec_status = '已执行' THEN 1 ELSE 0 END) as executedCount,
    SUM(CASE WHEN rp.exec_status = '未执行' THEN 1 ELSE 0 END) as pendingCount
FROM reward_penalties rp
LEFT JOIN coaches c ON c.phone = rp.phone
WHERE rp.confirm_date LIKE ?
  [AND rp.type = ?]
  [AND rp.exec_status = ?]
GROUP BY rp.phone, rp.name, c.employee_id
ORDER BY rp.phone;
```

> **注意**：`pendingIds` 不在 SQL 中直接获取（避免子查询 GROUP_CONCAT 在数据量大时影响性能）。改为在 JS 中拿到统计结果后，再按需查询未执行的 id 列表。具体做法：对每个有 pendingCount > 0 的人员，执行一个简单的 `SELECT id FROM reward_penalties WHERE phone=? AND confirm_date LIKE ? AND [筛选条件] AND exec_status='未执行'` 获取 id 列表。

**更优方案**：用一条 SQL 同时获取统计数据和 pendingIds：

```sql
SELECT 
    rp.phone,
    rp.name,
    c.employee_id,
    SUM(rp.amount) as personTotal,
    COUNT(*) as totalCount,
    SUM(CASE WHEN rp.exec_status = '已执行' THEN 1 ELSE 0 END) as executedCount,
    SUM(CASE WHEN rp.exec_status = '未执行' THEN 1 ELSE 0 END) as pendingCount,
    GROUP_CONCAT(CASE WHEN rp.exec_status = '未执行' THEN rp.id END) as pendingIdsStr
FROM reward_penalties rp
LEFT JOIN coaches c ON c.phone = rp.phone
WHERE rp.confirm_date LIKE ?
  [AND rp.type = ?]
  [AND rp.exec_status = ?]
GROUP BY rp.phone
ORDER BY rp.phone;
```

GROUP_CONCAT 在单人员几十条记录的规模下性能可接受。后端将 `pendingIdsStr` 字符串 split 成数组返回。

### 4.2 新增：明细查询接口

**请求**

```
GET /api/reward-penalty/stats/detail?phone=16675852676&month=2026-04&type=&execStatus=
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| phone | string | **是** | 手机号 |
| month | string | 否 | 月份 YYYY-MM，默认本月 |
| type | string | 否 | 奖罚类型，空表示全部 |
| execStatus | string | 否 | 执行状态，空表示全部 |

**返回**

```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "type": "助教日常",
      "confirm_date": "2026-04-10",
      "amount": 50.00,
      "remark": "迟到",
      "exec_status": "未执行",
      "exec_date": null
    },
    {
      "id": 102,
      "type": "服务日奖",
      "confirm_date": "2026-04-12",
      "amount": -30.00,
      "remark": "",
      "exec_status": "已执行",
      "exec_date": "2026-04-13"
    }
  ]
}
```

**SQL 实现**

```sql
SELECT id, type, confirm_date, amount, remark, exec_status, exec_date
FROM reward_penalties
WHERE phone = ? AND confirm_date LIKE ?
  [AND type = ?]
  [AND exec_status = ?]
ORDER BY confirm_date, id;
```

### 4.3 新增：更新明细金额接口

**请求**

```
POST /api/reward-penalty/detail/:id
Content-Type: application/json

{
  "amount": 0,
  "remark": "调整为0"
}
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | path | **是** | 记录 id |
| amount | number | **是** | 新金额（≥ 0 或 < 0 均可，不删除记录） |
| remark | string | 否 | 备注（不传则不修改） |

**校验规则**

- `amount` 必须为数字类型
- 不校验非负（因为奖罚金额可正可负）
- 记录必须存在，否则返回 404

**返回**

```json
{
  "success": true,
  "record": {
    "id": 101,
    "amount": 0,
    "remark": "调整为0",
    "exec_status": "未执行",
    "updated_at": "2026-04-18 21:30:00"
  }
}
```

**实现要点**

- 使用 `enqueueRun` 执行 UPDATE
- 使用 `TimeUtil.nowDB()` 更新 `updated_at`
- **不删除记录**，即使 amount = 0（区别于 batch-set 接口中 amount=0 时 DELETE 的行为）

### 4.4 新增：批量执行某个人员的奖罚

**请求**

```
POST /api/reward-penalty/stats/execute-person
Content-Type: application/json

{
  "phone": "16675852676",
  "month": "2026-04",
  "type": "",
  "execStatus": "未执行"
}
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| phone | string | **是** | 手机号 |
| month | string | 否 | 月份 YYYY-MM，默认本月 |
| type | string | 否 | 奖罚类型 |
| execStatus | string | 否 | 默认只执行"未执行"的记录 |

**返回**

```json
{
  "success": true,
  "updated": 3
}
```

**实现要点**

- 使用 `runInTransaction` 确保事务一致性
- 只更新 `exec_status = '未执行'` 的记录（双重保护）
- 使用 `TimeUtil.nowDB()` 设置 `exec_date` 和 `updated_at`

---

## 五、前端交互流程

### 5.1 整体流程

```
[页面加载]
    │
    ▼
[loadData()] ──► GET /api/reward-penalty/stats
    │                  │
    │                  ▼
    │            返回统计摘要（无明细）
    │
    ▼
[渲染统计表格]
    │
    ├─ 每行显示: employee_id, 姓名, 类型, 确定日期, 金额, 状态
    ├─ [查看明细] 按钮 ──► 打开弹框
    │       │
    │       ▼
    │  [loadDetail(phone)] ──► GET /api/reward-penalty/stats/detail
    │       │                      │
    │       │                      ▼
    │       │                 返回明细列表
    │       │
    │       ▼
    │  [渲染弹框中的明细表格]
    │       │
    │       ├─ 可编辑金额输入框（已执行记录只读）
    │       ├─ 修改金额后 ──► POST /api/reward-penalty/detail/:id
    │       │                      │
    │       │                      ▼
    │       │                 保存成功 → 更新弹框内合计 → 更新主表统计行
    │       │
    │       └─ [关闭] 按钮 ──► 关闭弹框
    │
    └─ [执行完毕] 按钮 ──► POST /api/reward-penalty/stats/execute-person
                               │
                               ▼
                          执行成功 → 刷新统计数据
```

### 5.2 统计表格渲染

表格列（修改后）：

| 列 | 字段 | 说明 |
|----|------|------|
| ☑ | checkbox | 批量选择 |
| 工号 | employee_id | 从 coaches 表 LEFT JOIN 获取，非助教显示 `-` |
| 姓名 | name | |
| 奖罚类型 | type 分布 | 该人员涉及的所有类型 |
| 确定日期 | confirm_date 范围 | 最早~最晚日期 |
| 金额 | personTotal | 绿色（正）/ 红色（负） |
| 执行状态 | pendingCount/totalCount | 如 `3/5 未执行` |
| 操作 | 按钮 | [查看明细] [执行完毕] |

> **注意**：不显示 `coach_no`，只显示 `employee_id`。

### 5.3 明细弹框

**弹框标题**: `{employee_id}号 {name} - 奖罚明细`

**弹框内容**:

```
┌────────────────────────────────────────────────────┐
│  余莉桦 (工号: 1) - 奖罚明细         [×]           │
├────────────────────────────────────────────────────┤
│  统计: 合计 ¥150.00 | 奖金 +¥200.00 | 罚金 -¥50.00 │
├────────────────────────────────────────────────────┤
│  类型      │ 日期       │ 金额      │ 备注  │ 状态   │
│  ──────────┼────────────┼───────────┼───────┼────────│
│  助教日常  │ 2026-04-10 │ [50.00]   │ 迟到  │ 未执行 │
│  服务日奖  │ 2026-04-12 │ [-30.00]  │       │ 已执行 │
│  助教日常  │ 2026-04-15 │ [0.00]    │ 调整为│ 未执行 │
├────────────────────────────────────────────────────┤
│  [关闭]                                            │
└────────────────────────────────────────────────────┘
```

**交互规则**:

1. 金额输入框初始显示当前值，点击后变为可编辑
2. 已执行记录的金额输入框为只读（disabled）
3. 金额修改后失焦（blur）或按 Enter，自动调用 `POST /api/reward-penalty/detail/:id`
4. 保存成功后：
   - 更新弹框顶部统计金额
   - 更新主表对应人员的 personTotal
5. 不显示删除按钮

### 5.4 筛选逻辑调整

保留现有筛选条件：

- **月份筛选**：本月 / 上月（按钮切换）
- **类型筛选**：全部类型 / 各具体类型
- **执行状态**：全部 / 未执行 / 已执行

筛选条件同时作用于统计摘要和明细查询。

---

## 六、边界情况与异常处理

### 6.1 数据相关

| 场景 | 处理方式 |
|------|----------|
| 人员无匹配的 coach 记录 | `employee_id` 显示为 `-`（LEFT JOIN 为 NULL） |
| 该人员无任何匹配记录 | 弹框中显示"暂无数据"，不报错 |
| 明细金额修改为 0 | 保留记录，不删除；统计金额自动重算 |
| 修改已执行记录的金额 | 前端禁止编辑（input disabled），后端也做校验 |
| 执行完毕后重复点击 | 后端只更新 `exec_status='未执行'` 的记录，返回 updated=0，前端提示"无可执行记录" |
| 明细修改时网络异常 | 弹框中显示"保存失败"toast，恢复原值 |
| 查询结果为空 | 表格显示"暂无奖罚数据" |

### 6.2 并发相关

| 场景 | 处理方式 |
|------|----------|
| 多人同时修改同一条明细 | `enqueueRun` 保证串行执行，后写者覆盖前者；通过 `updated_at` 可追溯 |
| 弹框打开期间数据被其他用户修改 | 弹框数据为快照，关闭弹框时刷新主表数据即可 |

### 6.3 参数校验

| 校验项 | 规则 |
|--------|------|
| month 格式 | 必须匹配 `/^\d{4}-\d{2}$/`，否则默认本月 |
| phone 参数 | 明细/执行接口必填，缺失返回 400 |
| amount 类型 | 必须为 number，NaN 返回 400 |
| 记录存在性 | 更新/执行前检查记录是否存在，不存在返回 404 |

### 6.4 权限

所有新增接口复用现有中间件：
- `authMiddleware` - 登录校验
- `requireBackendPermission(['coachManagement'])` - 权限校验

---

## 七、编码规范遵循

### 7.1 时间处理

- **后端**: 所有时间字段使用 `TimeUtil.nowDB()` 生成
  ```js
  const now = TimeUtil.nowDB();
  // "2026-04-18 21:30:00"
  ```

- **前端**: 使用 `TimeUtil` 工具类（已存在于 `admin/js/time-util.js`）
  ```js
  TimeUtil.today()      // "2026-04-18"
  TimeUtil.format(timeStr) // "04月18日 21:30"
  TimeUtil.toDate(timeStr) // Date 对象
  ```

### 7.2 数据库连接

- 所有数据库操作通过 `require('./db')` 获取连接
- 复用 `db/index.js` 中的唯一连接实例
- 查询使用 `dbAll` / `dbGet`
- 写入使用 `writeQueue` 机制

### 7.3 数据库写入

- **单条更新**: 使用 `enqueueRun(sql, params)`
  ```js
  await enqueueRun(
    'UPDATE reward_penalties SET amount = ?, updated_at = ? WHERE id = ?',
    [amount, TimeUtil.nowDB(), id]
  );
  ```

- **多条更新**: 使用 `runInTransaction(async (tx) => { ... })`
  ```js
  await runInTransaction(async (tx) => {
    await tx.run('UPDATE ... WHERE ...', [...]);
    await tx.run('UPDATE ... WHERE ...', [...]);
    // 自动 COMMIT，异常自动 ROLLBACK
  });
  ```

### 7.4 页面显示

- 显示 `employee_id`（工号），不显示 `coach_no`
- 通过 `LEFT JOIN coaches c ON c.phone = rp.phone` 获取
- 非助教人员（服务员等）employee_id 为 null，前端显示 `-`

---

## 八、实施步骤建议

1. **后端优先**: 先修改 `server.js` 中的 stats 接口和新增接口，确保 API 可用
2. **前端跟进**: 修改 `reward-penalty-stats.html`，实现两阶段加载和弹框
3. **联调测试**: 验证筛选、编辑金额、执行完毕等全流程
4. **性能验证**: 对比改造前后的响应时间和数据传输量

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