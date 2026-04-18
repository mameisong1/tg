# 奖罚管理功能 - 技术设计方案

> 项目：天宫国际 tgservice
> 日期：2026-04-18
> 设计者：程序员A

---

## 一、需求概述

实现员工奖罚管理功能，包括：
1. 系统配置新增奖罚类型设定（JSON 存储）
2. 数据库新增奖罚表
3. 后台用户表新增在职状态字段
4. 前台 H5 新增奖金设定页面（店长给服务员设日奖）
5. 前台 H5 新增奖金查看页面（服务员/助教查看自己奖罚明细）
6. 后台 admin 新增人事目录 + 奖罚统计页面（人事执行奖罚）

---

## 二、数据库设计

### 2.1 系统配置表 `system_config`（已有表，新增 key）

**复用现有表**，新增一条 key = `'reward_penalty_types'` 的配置记录。

```sql
-- 表结构（已有，不需修改）
-- CREATE TABLE IF NOT EXISTS system_config (
--   key TEXT PRIMARY KEY,
--   value TEXT,
--   description TEXT,
--   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
-- );

-- 初始化默认奖罚类型 JSON
INSERT OR IGNORE INTO system_config (key, value, description) 
VALUES ('reward_penalty_types', 
  '[{"奖罚类型":"服务日奖","对象":"服务员"},{"奖罚类型":"未约客罚金","对象":"助教"},{"奖罚类型":"漏单罚金","对象":"助教"}]',
  '奖罚类型配置JSON: [{奖罚类型, 对象}]');
```

### 2.2 奖罚表 `reward_penalties`（新建）

```sql
CREATE TABLE IF NOT EXISTS reward_penalties (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,  -- 奖罚No（自增主键）
  type          TEXT NOT NULL,                       -- 奖罚类型（如：服务日奖、未约客罚金、漏单罚金）
  confirm_date  TEXT NOT NULL,                       -- 确定日期（日奖=YYYY-MM-DD，月罚=YYYY-MM）
  phone         TEXT NOT NULL,                       -- 手机号
  name          TEXT NOT NULL,                       -- 姓名
  amount        REAL NOT NULL,                       -- 金额（罚金为负数）
  remark        TEXT,                                -- 备注
  exec_status   TEXT DEFAULT '未执行',               -- 执行状态：已执行 / 未执行
  exec_date     TEXT,                                -- 执行日期
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 唯一约束：确定日期 + 奖罚类型 + 手机号
CREATE UNIQUE INDEX idx_rp_unique ON reward_penalties(confirm_date, type, phone);

-- 查询优化索引
CREATE INDEX idx_rp_phone ON reward_penalties(phone);
CREATE INDEX idx_rp_type ON reward_penalties(type);
CREATE INDEX idx_rp_confirm_date ON reward_penalties(confirm_date);
CREATE INDEX idx_rp_exec_status ON reward_penalties(exec_status);
```

### 2.3 后台用户表 `admin_users`（已有表，新增字段）

```sql
-- 新增在职状态字段
ALTER TABLE admin_users ADD COLUMN employment_status TEXT DEFAULT '在职';
-- 值域：'在职' / '离职'
```

**注意**：SQLite 的 `ALTER TABLE ADD COLUMN` 不影响已有数据，已有用户的 `employment_status` 自动为 `'在职'`。

### 2.4 数据库变更初始化代码

在 `server.js` 的 `initSystemConfigTable()` 函数中新增初始化逻辑，同时在启动时执行表结构创建：

```javascript
// server.js 启动流程中添加
const initRewardPenaltyTable = async () => {
  try {
    await enqueueRun(`CREATE TABLE IF NOT EXISTS reward_penalties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      confirm_date TEXT NOT NULL,
      phone TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      remark TEXT,
      exec_status TEXT DEFAULT '未执行',
      exec_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await enqueueRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_rp_unique ON reward_penalties(confirm_date, type, phone)`);
    await enqueueRun(`CREATE INDEX IF NOT EXISTS idx_rp_phone ON reward_penalties(phone)`);
    await enqueueRun(`CREATE INDEX IF NOT EXISTS idx_rp_type ON reward_penalties(type)`);
    await enqueueRun(`CREATE INDEX IF NOT EXISTS idx_rp_confirm_date ON reward_penalties(confirm_date)`);
    await enqueueRun(`CREATE INDEX IF NOT EXISTS idx_rp_exec_status ON reward_penalties(exec_status)`);
  } catch (err) {
    // 表已存在，忽略
  }
};

const initAdminUserEmploymentStatus = async () => {
  try {
    await enqueueRun(`ALTER TABLE admin_users ADD COLUMN employment_status TEXT DEFAULT '在职'`);
  } catch (err) {
    // 字段已存在，忽略
  }
};
```

---

## 三、后端 API 设计

### 3.1 系统配置 API

#### 3.1.1 获取奖罚类型配置

```
GET /api/admin/reward-penalty/types
权限：requireBackendPermission(['coachManagement'])
认证：authMiddleware（后台用户 token）

响应：
{
  "success": true,
  "types": [
    {"奖罚类型": "服务日奖", "对象": "服务员"},
    {"奖罚类型": "未约客罚金", "对象": "助教"},
    {"奖罚类型": "漏单罚金", "对象": "助教"}
  ]
}
```

#### 3.1.2 更新奖罚类型配置

```
PUT /api/admin/reward-penalty/types
权限：requireBackendPermission(['coachManagement'])
认证：authMiddleware

请求体：
{
  "types": [
    {"奖罚类型": "服务日奖", "对象": "服务员"},
    {"奖罚类型": "未约客罚金", "对象": "助教"},
    {"奖罚类型": "漏单罚金", "对象": "助教"}
  ]
}

响应：
{ "success": true }
```

### 3.2 奖罚数据 API

#### 3.2.1 写入/更新奖罚记录（upsert）

```
POST /api/reward-penalty/upsert
权限：requireBackendPermission(['coachManagement'])
认证：authMiddleware

请求体：
{
  "type": "服务日奖",
  "confirmDate": "2026-04-18",
  "phone": "13800138000",
  "name": "张三",
  "amount": 20,
  "remark": "表现优秀"
}

响应：
{ "success": true, "action": "created" }  // 或 "updated" / "deleted"
```

**业务逻辑**：
- 如果 `amount === 0` → 删除记录
- 如果唯一约束已存在 → 更新（UPDATE amount, name, remark, updated_at）
- 否则 → 插入新记录

#### 3.2.2 查询奖罚记录列表

```
GET /api/reward-penalty/list
权限：authMiddleware
认证：authMiddleware

查询参数：
- type: 奖罚类型（可选，不传则查全部）
- confirmDate: 确定日期（可选，支持 YYYY-MM-DD 或 YYYY-MM）
- phone: 手机号（可选，按登录用户过滤）
- execStatus: 执行状态（可选：已执行/未执行）

响应：
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "服务日奖",
      "confirm_date": "2026-04-18",
      "phone": "13800138000",
      "name": "张三",
      "amount": 20,
      "remark": "表现优秀",
      "exec_status": "未执行",
      "exec_date": null,
      "created_at": "2026-04-18 10:00:00"
    }
  ],
  "total": 1,
  "sumAmount": 20
}
```

#### 3.2.3 批量查询奖罚记录（按月份统计）

```
GET /api/reward-penalty/stats
权限：requireBackendPermission(['coachManagement'])
认证：authMiddleware

查询参数：
- month: 月份，如 "2026-04"（可选，默认本月）
- type: 奖罚类型（可选）
- execStatus: 执行状态（可选）

响应：
{
  "success": true,
  "data": [
    {
      "phone": "13800138000",
      "name": "张三",
      "role": "服务员",
      "records": [
        { "type": "服务日奖", "confirm_date": "2026-04-18", "amount": 20 }
      ],
      "totalAmount": 20
    }
  ]
}
```

#### 3.2.4 批量执行奖罚

```
POST /api/reward-penalty/batch-execute
权限：requireBackendPermission(['coachManagement'])
认证：authMiddleware

请求体：
{
  "ids": [1, 2, 3],
  "execDate": "2026-04-18"
}

响应：
{ "success": true, "updated": 3 }
```

### 3.3 后台用户管理 API 扩展

#### 3.3.1 获取用户列表（返回在职状态）

```
GET /api/admin/users
现有接口，修改响应增加 employment_status 字段。
```

#### 3.3.2 更新用户在职状态

```
PUT /api/admin/users/:username/status
权限：requireBackendPermission(['coachManagement'])
认证：authMiddleware

请求体：
{
  "employmentStatus": "在职"  // 或 "离职"
}

响应：
{ "success": true }
```

---

## 四、前端页面设计

### 4.1 前台 H5 页面

#### 4.1.1 奖金设定页面

**文件**: `/TG/tgservice-uniapp/src/pages/internal/reward-penalty-set.vue`

**路由注册**: `pages.json` 新增

```json
{
  "path": "pages/internal/reward-penalty-set",
  "style": { "navigationBarTitleText": "奖罚管理" }
}
```

**入口**: 会员中心 → 管理功能板块 → 新增「服务日奖」按钮

```vue
<view class="internal-btn" @click="navigateTo('/pages/internal/reward-penalty-set')">
  <text class="internal-btn-icon">🏆</text>
  <text class="internal-btn-text">服务日奖</text>
</view>
```

**页面功能**：

1. **奖罚类型选择**：
   - 从系统配置读取所有奖罚类型作为 picker 选项
   - 当 URL 参数传入 `type=服务日奖` 时，固定显示该类型不可切换
   - 其他类型时显示 picker 可切换

2. **确定日期选择**：
   - 服务日奖：近4天日期选择（含今天），默认今天
   - 其他类型：月份选择（YYYY-MM），默认本月

3. **奖罚对象卡片列表**：
   - 根据当前选中的奖罚类型的"对象"（服务员/助教），列出对应角色的人员卡片
   - 排除离职人员（`admin_users.employment_status != '离职'` 或 `coaches.status != '离职'`）
   - 显示格式：
     - 服务员：姓名（从 admin_users.name）
     - 助教：`工号 + 艺名 + 姓名`（如 `01号 小美 张美丽`）
   - 一行 2 个卡片，网格布局

4. **设定奖金**：
   - 每个卡片内有 10/20/50 元快捷按钮
   - 奖金输入框，默认 0 元
   - 点击确定立即写入
   - `amount === 0` → 删除该记录
   - 已有记录 → 更新
   - 新记录 → 插入
   - 所有操作无需确认，直接执行
   - 卡片内显示"保存成功"提示，自动消失

**权限控制**：
- 仅店长、助教管理可访问
- 复用 `isManager` 判断逻辑（参考 member.vue 中 `['店长', '助教管理'].includes(adminInfo.role)`）

#### 4.1.2 奖金查看页面

**文件**: `/TG/tgservice-uniapp/src/pages/internal/reward-penalty-view.vue`

**路由注册**: `pages.json` 新增

```json
{
  "path": "pages/internal/reward-penalty-view",
  "style": { "navigationBarTitleText": "我的奖罚" }
}
```

**入口**：
- 教练个人中心 → 新增入口（助教查看自己）
- 服务员登录后查看会员中心 → 新增入口

**页面功能**：

1. **筛选栏**：
   - 确定日期：本月 / 上月（picker 切换）
   - 奖罚类型：根据登录角色筛选
     - 服务员：只显示"服务日奖"
     - 助教：显示"未约客罚金"、"漏单罚金"

2. **奖罚明细列表**：
   - 每条记录显示：类型、日期、金额、备注、执行状态
   - 金额正数绿色，负数红色

3. **统计栏**：
   - 合计奖罚金额（正数合计 + 负数合计 = 净额）

---

### 4.2 后台 admin 页面

#### 4.2.1 侧边栏新增「人事」分组

**文件**: `/TG/tgservice/admin/sidebar.js`

修改 `MENU_CONFIG`，在现有分组后新增：

```javascript
// 【人事】（新增分组）
{ label: '奖罚统计', icon: '🏆', href: 'reward-penalty-stats.html', group: '人事' },

// 分组图标
var GROUP_ICONS = {
  '前厅': '🏠',
  '助教管理': '👩‍🏫',
  '设备管理': '💡',
  '系统': '⚙️',
  '人事': '👥'  // 新增
};
```

#### 4.2.2 用户管理页面扩展（在职状态 curd）

**文件**: `/TG/tgservice/admin/users.html`

修改：
- 表格新增「在职状态」列
- 编辑弹窗新增在职状态下拉框（在职/离职）
- 保存时包含 `employment_status` 字段

#### 4.2.3 奖罚统计页面

**文件**: `/TG/tgservice/admin/reward-penalty-stats.html`（新建）

**页面功能**：

1. **筛选栏**：
   - 月份筛选：本月 / 上月（按钮切换）
   - 奖罚类型筛选：所有系统配置中的奖罚类型（按钮组）

2. **数据列表**：
   - 按人员分组，每人一行汇总
   - 展开显示该人员的所有奖罚明细
   - 列：姓名 | 角色 | 奖罚类型 | 日期 | 金额 | 执行状态 | 操作

3. **执行奖罚功能**：
   - 单条执行：每条数据后有「执行」按钮，点击后设为"已执行"
   - 批量执行：复选框勾选多条，底部「批量执行」按钮

---

## 五、前后端交互流程

### 5.1 奖金设定流程

```
[前端 H5] 打开奖金设定页面
    ↓
[前端] GET /api/admin/reward-penalty/types → 获取奖罚类型列表
    ↓
[前端] 根据类型获取对应人员列表
    - 对象=服务员 → 查询 admin_users WHERE role='服务员' AND employment_status='在职'
    - 对象=助教 → 查询 coaches WHERE status!='离职' AND employee_id IS NOT NULL
    ↓
[前端] 用户选择快捷金额或输入金额，点击确定
    ↓
[前端] POST /api/reward-penalty/upsert
    ↓
[后端] 校验 → upsert → 返回结果
    ↓
[前端] 显示"保存成功"，3秒后消失
```

### 5.2 奖金查看流程

```
[前端 H5] 打开奖金查看页面
    ↓
[前端] 从登录信息获取当前用户手机号
    ↓
[前端] GET /api/reward-penalty/list?phone=xxx&type=xxx&confirmDate=xxx
    ↓
[后端] 根据 phone 过滤数据 → 返回列表 + 合计
    ↓
[前端] 渲染明细列表 + 统计栏
```

### 5.3 奖罚统计流程

```
[后台 admin] 打开奖罚统计页面
    ↓
[前端] GET /api/reward-penalty/stats?month=2026-04&type=服务日奖
    ↓
[后端] 按月份和类型筛选 → 按人员分组汇总 → 返回
    ↓
[前端] 渲染按人员分组的表格
    ↓
[前端] 用户勾选记录，点击批量执行
    ↓
[前端] POST /api/reward-penalty/batch-execute {ids: [...], execDate: '2026-04-18'}
    ↓
[后端] 更新 exec_status='已执行', exec_date → 返回更新数量
```

---

## 六、权限矩阵更新

### 6.1 后端权限 (`middleware/permission.js`)

**PERMISSION_MATRIX** 新增权限字段：

```javascript
// 在所有角色的权限对象中新增
rewardPenaltyManagement: true/false
```

权限分配：
- 管理员：`true`
- 店长：`true`
- 助教管理：`true`
- 教练：`false`
- 前厅管理：`false`
- 收银：`false`
- 服务员：`false`

### 6.2 前端权限 (`FRONTEND_PERMISSION_MATRIX`)

```javascript
// 新增
rewardPenaltySet: true/false      // 奖金设定（店长/助教管理）
rewardPenaltyView: true/false     // 奖金查看（服务员/助教）
```

权限分配：
- 店长：`rewardPenaltySet: true`
- 助教管理：`rewardPenaltySet: true`
- 助教（教练）：`rewardPenaltyView: true`
- 服务员：`rewardPenaltyView: true`

---

## 七、文件变更清单

### 7.1 后端文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/server.js` | 修改 | 新增奖罚相关 API 路由 + 数据库初始化 |
| `backend/middleware/permission.js` | 修改 | 新增 `rewardPenaltyManagement` 权限 |

### 7.2 前端 H5 文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/pages/internal/reward-penalty-set.vue` | **新建** | 奖金设定页面 |
| `src/pages/internal/reward-penalty-view.vue` | **新建** | 奖金查看页面 |
| `src/pages.json` | 修改 | 注册新页面路由 |
| `src/pages/member/member.vue` | 修改 | 管理功能板块新增「服务日奖」入口 |
| `src/pages/coach-profile/coach-profile.vue` | 修改 | 助教个人中心新增「我的奖罚」入口 |
| `src/utils/api.js` | 修改 | 新增奖罚相关 API 方法 |

### 7.3 后台 admin 文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `admin/sidebar.js` | 修改 | 新增「人事」分组 + 奖罚统计菜单 |
| `admin/sidebar.css` | 修改 | 新增「人事」分组样式（如需） |
| `admin/users.html` | 修改 | 表格+弹窗新增在职状态字段 |
| `admin/reward-penalty-stats.html` | **新建** | 奖罚统计页面 |

---

## 八、边界情况与异常处理

### 8.1 奖罚类型配置

| 场景 | 处理 |
|------|------|
| 系统配置中无奖罚类型 | 返回空数组，前端显示"请先配置奖罚类型" |
| 格式错误的 JSON | 后端解析失败返回 500，前端显示错误 |
| 修改后类型名变更 | 已有奖罚记录的 type 字段保留原值，不受影响 |

### 8.2 奖金设定

| 场景 | 处理 |
|------|------|
| 金额输入 0 | 视为删除操作，调用 delete 逻辑 |
| 输入负数金额 | 前端校验拦截，金额必须 >= 0 |
| 同一人同一天同一类型已存在 | 后端 upsert 更新，返回 `action: "updated"` |
| 未选择日期 | 使用默认日期（今天/本月） |
| 对象列表为空 | 显示"暂无可设定的人员"提示 |
| 网络请求失败 | 显示"保存失败，请重试" |

### 8.3 奖金查看

| 场景 | 处理 |
|------|------|
| 用户无对应角色 | 根据登录角色过滤，服务员只看服务日奖，助教只看罚金 |
| 无记录 | 显示"暂无奖罚记录" |
| 日期筛选切换 | 本月 → confirm_date LIKE '2026-04%'，上月同理 |

### 8.4 奖罚统计

| 场景 | 处理 |
|------|------|
| 无数据 | 显示"本月暂无奖罚数据" |
| 批量执行部分失败 | 记录成功数量，提示"X 条成功，Y 条失败" |
| 重复执行 | 已执行的记录再次执行，忽略或提示"已执行" |

### 8.5 在职状态

| 场景 | 处理 |
|------|------|
| 用户设为离职 | 奖金设定时排除该用户，但已有奖罚记录保留 |
| 离职用户重新设为在职 | 恢复显示在列表中 |
| 已有用户无此字段 | ALTER TABLE 自动填充默认值 '在职' |

---

## 九、SQL 语句汇总

### 9.1 初始化

```sql
-- 1. 创建奖罚表
CREATE TABLE IF NOT EXISTS reward_penalties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  confirm_date TEXT NOT NULL,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  remark TEXT,
  exec_status TEXT DEFAULT '未执行',
  exec_date TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_rp_unique ON reward_penalties(confirm_date, type, phone);

-- 3. 查询索引
CREATE INDEX IF NOT EXISTS idx_rp_phone ON reward_penalties(phone);
CREATE INDEX IF NOT EXISTS idx_rp_type ON reward_penalties(type);
CREATE INDEX IF NOT EXISTS idx_rp_confirm_date ON reward_penalties(confirm_date);
CREATE INDEX IF NOT EXISTS idx_rp_exec_status ON reward_penalties(exec_status);

-- 4. 用户表新增字段
ALTER TABLE admin_users ADD COLUMN employment_status TEXT DEFAULT '在职';

-- 5. 奖罚类型默认配置
INSERT OR IGNORE INTO system_config (key, value, description) 
VALUES ('reward_penalty_types', 
  '[{"奖罚类型":"服务日奖","对象":"服务员"},{"奖罚类型":"未约客罚金","对象":"助教"},{"奖罚类型":"漏单罚金","对象":"助教"}]',
  '奖罚类型配置JSON');
```

### 9.2 核心查询

```sql
-- 获取服务员列表（在职）
SELECT username as phone, name, role FROM admin_users 
WHERE role = '服务员' AND employment_status = '在职';

-- 获取助教列表（在职）
SELECT coach_no, employee_id, stage_name, real_name, phone 
FROM coaches 
WHERE status != '离职' AND employee_id IS NOT NULL;

-- Upsert 奖罚记录
INSERT INTO reward_penalties (type, confirm_date, phone, name, amount, remark, updated_at)
VALUES (?, ?, ?, ?, ?, ?, TimeUtil.nowDB())
ON CONFLICT(confirm_date, type, phone) DO UPDATE SET
  name = excluded.name,
  amount = excluded.amount,
  remark = excluded.remark,
  updated_at = TimeUtil.nowDB();

-- 删除奖罚记录
DELETE FROM reward_penalties WHERE confirm_date = ? AND type = ? AND phone = ?;

-- 查询个人奖罚明细
SELECT * FROM reward_penalties 
WHERE phone = ? 
  AND type IN (?)
  AND confirm_date LIKE ?
ORDER BY confirm_date DESC;

-- 按月统计
SELECT 
  rp.phone, rp.name, rp.type, rp.confirm_date, rp.amount, rp.exec_status,
  SUM(rp.amount) OVER (PARTITION BY rp.phone) as person_total
FROM reward_penalties rp
WHERE rp.confirm_date LIKE ?
  AND (? IS NULL OR rp.type = ?)
  AND (? IS NULL OR rp.exec_status = ?)
ORDER BY rp.phone, rp.confirm_date;

-- 批量执行
UPDATE reward_penalties 
SET exec_status = '已执行', exec_date = ?, updated_at = TimeUtil.nowDB()
WHERE id IN (?, ?, ...);
```

---

## 十、编码规范遵守说明

| 规范 | 遵守方式 |
|------|----------|
| 时间处理 | 全部使用 `TimeUtil.nowDB()`, `TimeUtil.offsetDB()`, `TimeUtil.todayStr()` |
| 数据库连接 | 全部复用 `db/index.js` 的 `db`, `dbGet`, `dbAll`, `enqueueRun`, `runInTransaction` |
| 数据库写入 | 所有写操作使用 `enqueueRun()` 或 `runInTransaction()`，禁止裸开事务 |
| 页面显示 | 所有页面只显示 `employee_id`，不显示 `coach_no` |

---

## 十一、开发顺序建议

1. **Phase 1 - 数据库 + 后端 API**（优先级最高）
   - 数据库表创建 + 索引
   - 系统配置 API（读写奖罚类型 JSON）
   - 奖罚数据 API（upsert, list, stats, batch-execute）
   - 用户在职状态 API

2. **Phase 2 - 后台 admin 页面**
   - 侧边栏新增「人事」分组
   - 用户管理页面扩展（在职状态字段）
   - 奖罚统计页面

3. **Phase 3 - 前台 H5 页面**
   - 奖金设定页面
   - 奖金查看页面
   - 会员中心入口
   - 助教个人中心入口

---

## 十二、验收检查清单

对应验收重点：

| # | 验收重点 | 检查方式 |
|---|----------|----------|
| 1 | 系统配置正确存储奖罚类型 JSON | `SELECT value FROM system_config WHERE key='reward_penalty_types'` 验证 JSON 格式 |
| 2 | 奖罚表唯一约束生效 | 尝试插入重复的 (confirm_date, type, phone) 应报 UNIQUE constraint 错误 |
| 3 | 奖金设定写入/更新/删除正确 | 分别测试 insert、update（已存在）、delete（amount=0）三种场景 |
| 4 | 奖金查看页面按角色筛选正确 | 服务员登录只看服务日奖，助教登录只看罚金类型 |
| 5 | 奖罚统计页面筛选和执行状态正确 | 按月份和类型筛选后数据正确，执行后 exec_status 更新 |
