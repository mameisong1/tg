# QA2 技术方案：助教重复上桌功能支持

**日期**: 2026-04-15  
**设计师**: 程序员A2  
**关联**: QA415 需求列表

---

## 一、现状分析

### 1.1 当前数据库结构

`water_boards` 表中 `table_no` 字段为单值 TEXT：

```
0|id|INTEGER|0||1
1|coach_no|TEXT|1||0
2|stage_name|TEXT|1||0
3|status|TEXT|0|'下班'|0
4|table_no|TEXT|0||0        ← 单值，只能存一个台桌号
5|updated_at|DATETIME|0|CURRENT_TIMESTAMP|0
6|created_at|DATETIME|0|CURRENT_TIMESTAMP|0
7|clock_in_time|DATETIME|0||0
```

### 1.2 当前业务逻辑

| 操作 | 条件 | 行为 |
|------|------|------|
| 上桌单 | 状态=早班空闲/晚班空闲 | 状态→上桌，写入单个 table_no |
| 下桌单 | 状态=早班上桌/晚班上桌 | 状态→空闲，清空 table_no=NULL |
| 取消单 | 状态=早班上桌/晚班上桌 | 状态→空闲，清空 table_no=NULL |
| 点商品 | 无限制 | 员工默认显示水牌 table_no |

### 1.3 涉及文件清单（后端）

| 文件 | 涉及点 |
|------|--------|
| `backend/routes/table-action-orders.js` | 上桌/下桌/取消的核心逻辑，水牌状态更新 |
| `backend/routes/water-boards.js` | 水牌列表/单条查询、状态手动更新 |
| `backend/routes/coaches.js` | 上班/下班（clock-in/clock-out）时清空 table_no |
| `backend/server.js` | `/api/coaches/:coachNo/water-status` 返回 table_no |
| `backend/server.js` | 订单创建时检查助教水牌 table_no 与购物车一致性 |

### 1.4 涉及文件清单（前端 uniapp）

| 文件 | 涉及点 |
|------|--------|
| `src/pages/internal/table-action.vue` | 上下桌单页面，显示/选择 table_no，下桌单确认 |
| `src/pages/internal/clock.vue` | 上下班页面，显示 table_no |
| `src/pages/internal/water-board-view.vue` | 水牌查看页面，显示 table_no |
| `src/pages/internal/water-board.vue` | 水牌管理页面，显示 table_no |
| `src/pages/cart/cart.vue` | 购物车页面，加载默认 table_no（从水牌），一致性检查 |
| `src/pages/products/products.vue` | 商品页，加载默认 table_no（从水牌），quickAdd 传 table_no |
| `src/components/TableInfo.vue` | 台桌信息显示组件 |

### 1.5 涉及文件清单（后台管理 H5）

| 文件 | 涉及点 |
|------|--------|
| `frontend/admin/cashier-dashboard.html` | 收银看板，显示上下桌单的 table_no |

---

## 二、方案设计

### 2.1 核心思路：table_no 改存逗号分隔字符串

**不改表结构**，`table_no` 仍为 TEXT 类型，但存储格式从 `"A1"` 改为 `"A1,A3,B2"`。

**理由**：
- 零迁移成本，不需要 ALTER TABLE
- SQLite 的 LIKE 查询仍然可用（`LIKE '%A1%'` 不够精确，用 JSON 函数或应用层判断）
- 应用层用 `split/join` 处理，逻辑清晰

**辅助函数**（后端/前端共用逻辑）：

```javascript
// 解析 table_no 字符串 → 数组
function parseTables(tableNoStr) {
  if (!tableNoStr || tableNoStr.trim() === '') return [];
  return tableNoStr.split(',').map(t => t.trim()).filter(t => t);
}

// 数组 → table_no 字符串
function joinTables(tableArr) {
  if (!tableArr || tableArr.length === 0) return null;
  return tableArr.join(',');
}
```

### 2.2 数据库变更

**仅需新增一个字段**（可选，推荐）：

```sql
-- 可选：增加 table_in_time 字段，记录最新上桌时间
-- 用于判断助教的上桌顺序，非必须但有助于后续功能
ALTER TABLE water_boards ADD COLUMN table_in_time DATETIME;
```

**不新增**：table_no 复用现有字段。

### 2.3 后端 API 变更

#### 2.3.1 `table-action-orders.js` — 提交上桌单/下桌单

**关键变更**：

```javascript
// 上桌单（POST /api/table-action-orders）
if (order_type === '上桌单') {
  // 原逻辑：仅当 status=空闲时允许
  // 新逻辑：status=空闲 OR status=上桌 都允许，但不能重复上桌已有台桌
  
  const currentTables = parseTables(waterBoard.table_no);
  
  // 检查是否已在该桌上
  if (currentTables.includes(table_no)) {
    throw { status: 400, error: `已在台桌 ${table_no} 上，不能重复上桌` };
  }
  
  // 添加到列表
  currentTables.push(table_no);
  newTableNo = joinTables(currentTables);
  
  // 如果原来是空闲，状态变为上桌
  if (['早班空闲', '晚班空闲'].includes(waterBoard.status)) {
    newStatus = waterBoard.status === '早班空闲' ? '早班上桌' : '晚班上桌';
  }
  // 如果已经在上桌状态，状态不变
}

// 下桌单/取消单
if (order_type === '下桌单' || order_type === '取消单') {
  const currentTables = parseTables(waterBoard.table_no);
  
  // 移除指定的台桌号
  const idx = currentTables.indexOf(table_no);
  if (idx === -1) {
    throw { status: 400, error: `当前不在台桌 ${table_no} 上` };
  }
  currentTables.splice(idx, 1);
  newTableNo = joinTables(currentTables);
  
  // 如果列表为空，状态变空闲
  if (currentTables.length === 0) {
    newStatus = waterBoard.status === '早班上桌' ? '早班空闲' : '晚班空闲';
  }
  // 如果还有台桌，状态保持上桌不变
}
```

#### 2.3.2 `water-boards.js` — 水牌查询

**关键变更**：所有返回 `table_no` 的 API 增加 `table_no_list` 字段：

```javascript
// GET /api/water-boards 和 GET /api/water-boards/:coach_no
res.json({
  success: true,
  data: {
    ...waterBoard,
    table_no_list: parseTables(waterBoard.table_no)  // 新增字段，方便前端使用
  }
});
```

**手动更新状态**时（PUT `/:coach_no/status`）：
- 如果设置为空闲/下班等非上桌状态，清空 `table_no`
- 如果设置为上桌状态但 `table_no` 为 null，保持 null（由上下桌单管理）

#### 2.3.3 `coaches.js` — 上班/下班

```javascript
// clock-in: 上班时清空 table_no（保持不变）
// clock-out: 下班时清空 table_no（保持不变）
```

**注意**：如果助教正在多桌上桌时点下班，需要先清空所有台桌号再变为下班。

#### 2.3.4 `server.js` — 水牌状态查询

```javascript
// GET /api/coaches/:coachNo/water-status
// 增加 table_no_list 字段
res.json({
  success: true,
  data: {
    ...waterBoard,
    table_no_list: parseTables(waterBoard.table_no)
  }
});
```

#### 2.3.5 `server.js` — 订单创建时的一致性检查

```javascript
// 原逻辑：检查助教水牌 table_no === 购物车 tableNo
// 新逻辑：检查购物车 tableNo 是否在助教 table_no_list 中

const coachWaterTableList = parseTables(coachWaterInfo.table_no);
if (isOnTable && coachWaterTableList.length > 0 && !coachWaterTableList.includes(tableName)) {
  // 水牌台桌号不包含当前选择台桌号，弹出警告
}
```

### 2.4 前端变更（uniapp）

#### 2.4.1 `table-action.vue` — 上下桌单页面

**上桌单**：
- 台桌选择器不再默认选中水牌 table_no（需求5）
- 允许在"早班上桌"/"晚班上桌"状态下提交上桌单
- 显示已上桌台桌号列表（用逗号分隔显示）
- 台桌选择器过滤掉已在桌上的台桌号（防重复）

```vue
<!-- 状态显示 -->
<text class="table-info" v-if="waterBoard?.table_no">
  当前台桌: {{ waterBoard.table_no }}  <!-- "A1,A3" 原样显示 -->
</text>

<!-- 上桌单：不在空闲状态也允许显示 -->
<!-- 下桌单：改为选择要下桌的台桌号 -->
```

**下桌单**：
- **增加台桌号选择器**，仅显示当前助教在桌上的台桌号
- 一次只能选一个台桌号下桌
- 确认下桌时传递选中的台桌号

```vue
<!-- 下桌单改为带选择器 -->
<view class="form-section" v-if="currentTab === 'table-out'">
  <view class="form-item" @click="showTableOutSelector = true">
    <text class="form-label">选择下桌台桌号</text>
    <view class="form-value">
      <text :class="{ placeholder: !form.table_out_no }">
        {{ form.table_out_no || '请选择要下桌的台桌' }}
      </text>
      <text class="arrow">›</text>
    </view>
  </view>
  <view class="submit-btn danger" @click="submitTableOut"><text>提交下桌单</text></view>
</view>
```

**取消单**：
- 同上，增加台桌号选择器

#### 2.4.2 `clock.vue` — 上下班页面

**显示**：
- `table_no` 改为显示 `table_no_list`（逗号分隔）
- 如果有多个台桌号，分行显示或滚动显示

```vue
<text class="table-info" v-if="waterBoard?.table_no">
  当前台桌: {{ waterBoard.table_no }}
</text>
```

（显示逻辑不变，因为逗号分隔的字符串本身就显示为 "A1,A3"）

#### 2.4.3 `water-board-view.vue` / `water-board.vue` — 水牌页面

**显示**：
- `coach.table_no` 原样显示（逗号分隔字符串）
- 如果太长，可以换行或截断

```vue
<text class="coach-table" v-if="coach.table_no">
  {{ coach.table_no }}  <!-- "A1,A3" 或 "A1,A3,B2" -->
</text>
```

**水牌管理**的 `changeStatus` 函数：
- 设置非上桌状态时，清空 table_no
- 保持现有逻辑不变

#### 2.4.4 `cart/cart.vue` — 购物车页面

**loadDefaultTableNo 修改**：

```javascript
// 原逻辑：如果水牌有 table_no，用它作为默认值
// 新逻辑：不再从水牌加载默认值（需求5）
const loadDefaultTableNo = async () => {
  if (tableName.value) {
    defaultTableNo.value = tableName.value
    return
  }
  // 不再从水牌加载默认值，默认值为空
  defaultTableNo.value = ''
}
```

**checkCoachTableConsistency 修改**：

```javascript
const checkCoachTableConsistency = async () => {
  // ...
  const isOnTable = waterStatus === '早班上桌' || waterStatus === '晚班上桌'
  
  // 解析水牌台桌号列表
  const waterTableList = waterTableNo ? waterTableNo.split(',').map(t => t.trim()).filter(t => t) : []
  
  if (isOnTable && waterTableList.length > 0 && !waterTableList.includes(tableName.value)) {
    // 不一致，弹出警告
  }
  // ...
}
```

#### 2.4.5 `products/products.vue` — 商品页

**loadDefaultTableNo 修改**：同 cart.vue，不再从水牌加载默认值。

**quickAdd** 逻辑不变，仍然用 `tableName.value`。

### 2.5 后台管理 H5 变更

#### 2.5.1 `cashier-dashboard.html` — 收银看板

- 上下桌单卡片中显示 `table_no`，现在可能是逗号分隔字符串
- 无需代码变更，原样显示即可

---

## 三、完整变更清单

### 3.1 后端文件

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `backend/routes/table-action-orders.js` | **核心变更** | 上桌：追加 table_no；下桌：移除指定 table_no |
| `backend/routes/water-boards.js` | 小改 | 返回增加 `table_no_list` 字段 |
| `backend/routes/coaches.js` | 不变 | 上班/下班仍清空 table_no |
| `backend/server.js` | 小改 | `/water-status` 返回增加 `table_no_list`；订单一致性检查改用列表匹配 |
| `backend/db/index.js` | 不变 | 可新增 `parseTables/joinTables` 工具函数 |

### 3.2 前端文件

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/pages/internal/table-action.vue` | **核心变更** | 下桌单加台桌选择器；上桌单允许重复上桌；过滤已上桌台桌 |
| `src/pages/internal/clock.vue` | 小改 | 显示多个台桌号 |
| `src/pages/internal/water-board-view.vue` | 小改 | 显示多个台桌号 |
| `src/pages/internal/water-board.vue` | 小改 | 显示多个台桌号 |
| `src/pages/cart/cart.vue` | 小改 | loadDefaultTableNo 不从水牌加载；一致性检查改用列表 |
| `src/pages/products/products.vue` | 小改 | loadDefaultTableNo 不从水牌加载 |

### 3.3 后台管理

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `frontend/admin/cashier-dashboard.html` | 无需变更 | 原样显示逗号分隔字符串 |

---

## 四、数据流示例

### 4.1 助教挂桌上桌场景

```
助教A（工号C001，早班）

步骤1: 发送上桌单 → 台桌 A1
  water_boards: status='早班上桌', table_no='A1'

步骤2: 发送上桌单 → 台桌 A3
  water_boards: status='早班上桌', table_no='A1,A3'

步骤3: 发送下桌单 → 台桌 A1
  water_boards: status='早班上桌', table_no='A3'

步骤4: 发送下桌单 → 台桌 A3
  water_boards: status='早班空闲', table_no=NULL

步骤5: 点下班
  water_boards: status='下班', table_no=NULL, clock_in_time=NULL
```

### 4.2 点商品一致性检查

```
助教A 水牌: table_no='A1,A3', status='早班上桌'

购物车 tableNo='A1' → 在列表中 → 直接下单 ✅
购物车 tableNo='A3' → 在列表中 → 直接下单 ✅
购物车 tableNo='B2' → 不在列表中 → 弹出警告 ⚠️
```

---

## 五、边界情况处理

| 场景 | 处理 |
|------|------|
| 助教在桌上时上班 | 保持原有逻辑：报错"上桌状态不能点上班" |
| 助教多桌时下班 | 清空所有 table_no，状态变为下班 |
| 手动修改水牌状态为空闲 | 清空 table_no |
| 手动修改水牌状态为上桌 | table_no 保持原值（由管理员手动维护） |
| 台桌号格式包含逗号 | 台桌号本身不含逗号（系统命名规则），无冲突 |
| 并发上桌同一台桌 | 现有 `updated_at` 乐观锁保护 |
| table_no 超长 | SQLite TEXT 无长度限制，但建议限制最大 10 个台桌 |

---

## 六、开发顺序建议

1. **Phase 1**：后端 `table_no` 解析/拼接工具函数 + `table-action-orders.js` 核心逻辑改造
2. **Phase 2**：后端 `water-boards.js` + `server.js` 接口调整
3. **Phase 3**：前端 `table-action.vue` 下桌单选择器改造
4. **Phase 4**：前端各页面 table_no 显示适配（cart, products, clock, water-board）
5. **Phase 5**：联调测试 + 收银看板确认

---

## 七、编码规范遵守

- ✅ 时间处理统一使用 `backend/utils/time.js` 的 `TimeUtil.nowDB()`
- ✅ 数据库操作复用 `db/index.js` 的连接（`db`, `dbGet`, `dbAll`, `dbRun`）
- ✅ 数据库写入使用 `writeQueue` 队列（通过 `runInTransaction` / `enqueueRun`）
- ✅ 状态更新使用 `updated_at` 乐观锁（现有机制保留）

---

## 八、测试用例

### 8.1 后端 API 测试

| # | 测试 | 预期 |
|---|------|------|
| 1 | 空闲助教提交上桌单 A1 | table_no='A1', status=上桌 |
| 2 | 已在A1上，再提交上桌单 A3 | table_no='A1,A3', status=上桌 |
| 3 | 已在A1上，再提交上桌单 A1 | 400 错误"不能重复上桌" |
| 4 | 在A1,A3上，提交下桌单 A1 | table_no='A3', status=上桌 |
| 5 | 在A1,A3上，提交下桌单 A3 | table_no='A1', status=上桌 |
| 6 | 在A1上，提交下桌单 A1 | table_no=NULL, status=空闲 |
| 7 | 在A1上，提交下桌单 B2 | 400 错误"不在台桌B2上" |
| 8 | 多桌状态下下班 | table_no=NULL, status=下班 |

### 8.2 前端测试

| # | 测试 | 预期 |
|---|------|------|
| 1 | 已上桌助教打开上桌单页面 | 可以提交新的上桌单 |
| 2 | 已上桌助教打开下桌单页面 | 显示已上桌台桌号选择器 |
| 3 | 多桌助教点商品，选择不一致的台桌 | 弹出警告 |
| 4 | 上下班页面显示多桌 | 逗号分隔显示 |
| 5 | 水牌页面显示多桌 | 逗号分隔显示 |
| 6 | 商品页 quickAdd | 不默认出现水牌台桌号 |
