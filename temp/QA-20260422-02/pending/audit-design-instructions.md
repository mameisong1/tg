你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
```
# 助教门迎排序功能 - 技术设计方案

> QA 编号：QA-20260422-02  
> 设计日期：2026-04-22  
> 设计者：程序员A

---

## 一、现有代码分析

### 1.1 批处理脚本实现方式

**参考文件**：`/TG/tgservice/backend/services/cron-scheduler.js`

现有 cron 调度器模式：
- 使用 `cron_tasks` 表管理任务配置和状态（task_name, task_type, cron_expression, next_run, last_status）
- 使用 `cron_log` 表记录执行历史
- 每分钟检查 `next_run <= now()` 的任务并触发执行
- 内部任务通过 **HTTP 调用内部 API** 执行（如 `taskLockGuestInvitation` 调用 `POST /api/guest-invitations/internal/lock`）
- 内部接口通过检查 IP（`127.0.0.1` / `::1`）限制外部访问

```javascript
// 参考：lock_guest_invitation_morning 的内部 HTTP 调用模式
const options = {
    hostname: '127.0.0.1',
    port: parseInt(process.env.PORT) || (process.env.TGSERVICE_ENV === 'test' ? 8088 : 80),
    path: '/api/guest-invitations/internal/lock',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
};
```

### 1.2 系统配置表结构

**参考文件**：`/TG/tgservice/backend/server.js` (L3631)

```sql
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT,                    -- JSON 格式存储
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

现有配置项：
- `sms_provider` — 短信服务商
- `reward_penalty_types` — 奖罚类型配置 JSON

### 1.3 水牌管理页面

**参考文件**：`/TG/tgservice-uniapp/src/pages/internal/water-board.vue`

- 长按助教卡片触发 `showStatusChange(coach)`，弹出修改状态弹窗
- H5 环境通过 `contextmenu` 事件阻止浏览器默认长按菜单
- 助教卡片使用 `@longpress="showStatusChange(coach)"` 绑定
- 卡片结构：头像 + 工号（`formatCoachId`）+ 艺名
- 空闲状态卡片有特殊的白色背景样式（`.free-section .coach-card`）

### 1.4 水牌查看页面

**参考文件**：`/TG/tgservice-uniapp/src/pages/internal/water-board-view.vue`

- 只读页面，无长按交互
- 数据结构与水牌管理页面相同
- 空闲/上桌助教卡片样式类似

### 1.5 water_boards 表结构

```
water_boards:
  id, coach_no, stage_name, status, table_no, clock_in_time, updated_at, created_at
```

- `clock_in_time` 存储上班打卡时间（已存在，用于排序）
- `status` 枚举：早班上桌/早班空闲/晚班上桌/晚班空闲/早加班/晚加班/休息/公休/请假/乐捐/下班

### 1.6 数据库操作规范

- **唯一连接**：`/TG/tgservice/backend/db/index.js`
- **写操作**：使用 `runInTransaction` 或 `enqueueRun`
- **时间处理**：使用 `TimeUtil.nowDB()`, `TimeUtil.todayStr()`

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────┐
│                  cron-scheduler.js                   │
│  14:00 → POST /api/guest-rankings/internal/batch    │
│  18:00 → POST /api/guest-rankings/internal/batch    │
│  00:00 → POST /api/guest-rankings/internal/clear    │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP
                       ▼
┌─────────────────────────────────────────────────────┐
│          guest-rankings.js (新路由)                  │
│                                                     │
│  POST /internal/batch     — 批处理排序（14点/18点） │
│  POST /internal/clear     — 午夜清空                 │
│  POST /internal/after-clock — 打卡后排序            │
│  PUT  /exempt/:coach_no   — 设置免门迎              │
│  GET  /today              — 获取今日排序             │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│       services/guest-ranking-service.js (新服务)     │
│                                                     │
│  class GuestRankingService                          │
│    ├── loadTodayData()    加载今日排序+免门迎清单    │
│    ├── batchRank(shift)   批处理排序（14点/18点）    │
│    ├── afterClockRank()   打卡后排序                │
│    ├── clearAll()         午夜清空                  │
│    ├── setExempt(coachNo) 设置免门迎                │
│    └── getRanking()       获取排序数据              │
│                                                     │
│  数据持久化：system_config 表                        │
│    - today_guest_ranking:  JSON {coach_no: rank}   │
│    - today_guest_exempt:   JSON [coach_no, ...]    │
└─────────────────────────────────────────────────────┘
```

---

## 三、文件清单

| # | 操作 | 文件路径 | 说明 |
|---|------|----------|------|
| 1 | **新增** | `backend/services/guest-ranking-service.js` | 门迎排序核心服务类 |
| 2 | **新增** | `backend/routes/guest-rankings.js` | 门迎排序 API 路由 |
| 3 | **修改** | `backend/server.js` | 注册新路由 + 新增 cron 任务 + 启动时加载排序数据 |
| 4 | **修改** | `backend/services/cron-scheduler.js` | 新增 3 个 cron 任务 |
| 5 | **修改** | `backend/routes/coaches.js` | 打卡成功后调用门迎排序 |
| 6 | **修改** | `uniapp/src/pages/internal/water-board.vue` | 长按新增[免门迎] + 显示圆圈序号 |
| 7 | **修改** | `uniapp/src/pages/internal/water-board-view.vue` | 显示圆圈序号 |
| 8 | **修改** | `uniapp/src/utils/api-v2.js` | 新增 guestRankings API |

---

## 四、数据库变更

### 4.1 system_config 表新增配置项（无需 DDL，运行时自动初始化）

| key | value 格式 | 说明 |
|-----|-----------|------|
| `today_guest_ranking` | `{"1": 3, "2": 1, "5": 2, ...}` | 今日门迎排序，key=coach_no, value=序号 |
| `today_guest_exempt` | `["3", "7", ...]` | 今日免门迎助教 coach_no 列表 |
| `today_guest_ranking_date` | `"2026-04-22"` | 排序日期标记，用于检测跨天 |

**变更原因**：复用已有的 `system_config` 表（key-value + JSON 模式），无需新增表。

### 4.2 water_boards 表（无需变更）

- `clock_in_time` 字段已存在，用于排序

### 4.3 cron_tasks 表（无需 DDL，运行时自动初始化）

新增 3 条任务记录：

| task_name | task_type | cron_expression | description |
|-----------|-----------|-----------------|-------------|
| `guest_ranking_morning` | `guest_ranking` | `0 14 * * *` | 下午14点早班门迎排序 |
| `guest_ranking_evening` | `guest_ranking` | `0 18 * * *` | 晚上18点晚班门迎排序 |
| `guest_ranking_midnight` | `guest_ranking` | `0 0 * * *` | 午夜0点清空门迎排序 |

---

## 五、类设计：GuestRankingService

### 5.1 核心类

**文件**：`backend/services/guest-ranking-service.js`

```javascript
const { get, runInTransaction, enqueueRun } = require('../db');
const TimeUtil = require('../utils/time');

/**
 * 门迎排序服务
 * 管理每日助教门迎排序逻辑
 */
class GuestRankingService {

  /**
   * 从 system_config 加载今日排序和免门迎清单到内存
   * 系统启动时调用，确保内存数据与数据库一致
   */
  async loadTodayData() { ... }

  /**
   * 持久化今日排序数据到 system_config
   * 每次排序变更后自动调用
   */
  async _saveRanking() { ... }

  /**
   * 持久化免门迎清单到 system_config
   */
  async _saveExempt() { ... }

  /**
   * 批处理排序（14点/18点调用）
   * @param {string} shift - '早班' | '晚班'
   * @param {number} startRank - 起始序号（早班=1，晚班=51）
   * @param {number} maxRank - 最大序号（早班=50，晚班=100）
   */
  async batchRank(shift, startRank, maxRank) { ... }

  /**
   * 打卡后排序
   * 助教上班打卡后调用，将新打卡助教排到最后
   * @param {string} coachNo - 打卡助教 coach_no
   * @param {string} shift - 班次
   */
  async afterClockRank(coachNo, shift) { ... }

  /**
   * 设置免门迎助教
   * @param {string} coachNo - 助教 coach_no
   */
  async setExempt(coachNo) { ... }

  /**
   * 取消免门迎
   */
  async removeExempt(coachNo) { ... }

  /**
   * 获取今日排序数据（供前端查询）
   */
  async getTodayRanking() { ... }

  /**
   * 获取某助教的门迎序号（供水牌列表接口注入）
   */
  getCoachRank(coachNo) { ... }

  /**
   * 判断某助教是否免门迎
   */
  isExempt(coachNo) { ... }

  /**
   * 午夜清空所有排序数据
   */
  async clearAll() { ... }

  /**
   * 检查是否需要跨天重置（对比日期标记）
   */
  async checkAndResetIfNewDay() { ... }
}

module.exports = new GuestRankingService();
```

### 5.2 内存状态

```javascript
// 单例对象内部状态
this._ranking = {};      // { coach_no: rank } 序号 1-100
this._exempt = new Set(); // Set<coach_no> 免门迎清单
this._date = '';          // 当前排序日期 "YYYY-MM-DD"
```

### 5.3 核心方法详细设计

#### `batchRank(shift, startRank, maxRank)`

```
1. 查询 water_boards + coaches 联表
   WHERE c.shift = ?
     AND wb.status IN (空闲状态列表)
     AND wb.coach_no NOT IN (免门迎清单)

2. 按 clock_in_time DESC 排序（打卡时间倒序）

3. 分配序号：从 startRank 开始递增
   例如早班：序号 1,2,3... 最多到 50
   例如晚班：序号 51,52,53... 最多到 100

4. 更新内存 this._ranking
   删除不在列表中的旧数据（该班次的）

5. 持久化 this._saveRanking()
```

**空闲状态列表**：
- 早班：`['早班空闲']`（含合并到空闲组的下班、加班助教？按需求只排"空闲/上桌"状态）
- 按需求原文："空闲/上桌状态" → 早班 `['早班空闲', '早班上桌']`，晚班 `['晚班空闲', '晚班上桌']`

#### `afterClockRank(coachNo, shift)`

```
1. 检查当前时间
   - 14点后 + 早班 → 从当前早班最大序号+1 开始排
   - 18点后 + 晚班 → 从当前晚班最大序号+1 开始排
   - 其他时间 → 不处理（未开始排序的时间段）

2. 检查是否在免门迎清单 → 是则跳过

3. 检查当前状态是否为空闲/上桌 → 不是则跳过

4. 分配序号：当前该班次最大序号 + 1
   如果超过 maxRank，不分配

5. 更新内存 + 持久化
```

#### `setExempt(coachNo)`

```
1. 从 this._ranking 中删除该助教
2. 加入 this._exempt
3. 持久化 _saveRanking() + _saveExempt()
```

#### `clearAll()`

```
1. 清空 this._ranking = {}
2. 清空 this._exempt = new Set()
3. 更新 system_config：
   - today_guest_ranking = '{}'
   - today_guest_exempt = '[]'
   - today_guest_ranking_date = 今日日期
4. 记录 cron_log
```

---

## 六、API 设计

### 6.1 内部接口（Cron / 系统调用）

**文件**：`backend/routes/guest-rankings.js`

#### `POST /api/guest-rankings/internal/batch`

批处理排序，Cron 定时调用。

**请求体**：
```json
{
  "shift": "早班",       // 或 "晚班"
  "startRank": 1,       // 起始序号
  "maxRank": 50         // 最大序号
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "shift": "早班",
    "ranked_count": 23,
    "rankings": { "1": 3, "2": 1, "5": 2 }
  }
}
```

**安全**：仅允许 `127.0.0.1` / `::1` 来源（同 `guest-invitations/internal/lock`）。

#### `POST /api/guest-rankings/internal/clear`

午夜清空排序。

**响应**：
```json
{ "success": true, "data": { "cleared": true } }
```

**安全**：仅允许 `127.0.0.1` / `::1` 来源。

#### `POST /api/guest-rankings/internal/after-clock`

打卡后排序触发。

**请求体**：
```json
{
  "coachNo": "1",
  "shift": "早班"
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "rank": 24,
    "message": "已排到第24位"
  }
}
```

### 6.2 业务接口

#### `PUT /api/guest-rankings/exempt/:coach_no`

设置免门迎助教。

**权限**：需要 `waterBoardManagement` 权限

**响应**：
```json
{
  "success": true,
  "data": {
    "coach_no": "1",
    "stage_name": "小美",
    "exempt": true
  }
}
```

#### `DELETE /api/guest-rankings/exempt/:coach_no`

取消免门迎。

**权限**：需要 `waterBoardManagement` 权限

#### `GET /api/guest-rankings/today`

获取今日全部排序数据。

**响应**：
```json
{
  "success": true,
  "data": {
    "date": "2026-04-22",
    "ranking": { "1": 3, "2": 1, "5": 2, ... },
    "exempt": ["3", "7", ...]
  }
}
```

---

## 七、Cron 任务集成

**文件**：`backend/services/cron-scheduler.js`

### 7.1 新增任务配置（initDefaultTasks）

```javascript
{
    task_name: 'guest_ranking_morning',
    task_type: 'guest_ranking',
    description: '下午14点自动执行早班门迎排序',
    cron_expression: '0 14 * * *',
    next_run: calcNextRun('0 14 * * *')
},
{
    task_name: 'guest_ranking_evening',
    task_type: 'guest_ranking',
    description: '晚上18点自动执行晚班门迎排序',
    cron_expression: '0 18 * * *',
    next_run: calcNextRun('0 18 * * *')
},
{
    task_name: 'guest_ranking_midnight',
    task_type: 'guest_ranking',
    description: '午夜0点清空门迎排序',
    cron_expression: '0 0 * * *',
    next_run: calcNextRun('0 0 * * *')
}
```

### 7.2 新增任务执行方法

```javascript
/**
 * 任务：门迎批处理排序
 */
async function taskGuestRanking(shift, startRank, maxRank) {
    const taskName = shift === '早班' ? 'guest_ranking_morning' : 
                     (shift === '晚班' ? 'guest_ranking_evening' : 'guest_ranking_midnight');
    // 内部 HTTP 调用 POST /api/guest-rankings/internal/batch
    // 或 clear
}
```

### 7.3 checkAndRunTasks 新增分支

```javascript
} else if (task.task_type === 'guest_ranking') {
    if (task.task_name === 'guest_ranking_midnight') {
        await taskGuestRanking('全部', 0, 0); // clear
    } else {
        const shiftType = task.task_name === 'guest_ranking_morning' ? '早班' : '晚班';
        const startRank = shiftType === '早班' ? 1 : 51;
        const maxRank = shiftType === '早班' ? 50 : 100;
        await taskGuestRanking(shiftType, startRank, maxRank);
    }
}
```

---

## 八、打卡后排序触发

**文件**：`backend/routes/coaches.js`

在 `POST /api/coaches/:coach_no/clock-in` 路由的 **上班成功返回前**，增加门迎排序触发：

```javascript
// 现有打卡逻辑成功后，新增：
// 触发门迎排序（非阻塞，不等待结果）
const guestRankingService = require('../services/guest-ranking-service');
const http = require('http');

// 内部调用门迎排序
const coachNo = req.params.coach_no;
const shift = coach.shift;

// 只在排序时间段内触发（14点后早班，18点后晚班）
const now = new Date(TimeUtil.nowDB() + '+08:00');
const currentHour = now.getHours();
if ((shift === '早班' && currentHour >= 14) || 
    (shift === '晚班' && currentHour >= 18)) {
    // 非阻塞调用
    const postData = JSON.stringify({ coachNo, shift });
    const options = {
        hostname: '127.0.0.1',
        port: parseInt(process.env.PORT) || 8088,
        path: '/api/guest-rankings/internal/after-clock',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    };
    const req2 = http.request(options, (res) => {
        // 忽略响应
    });
    req2.write(postData);
    req2.end();
}
```

---

## 九、前端设计

### 9.1 水牌管理页面修改

**文件**：`uniapp/src/pages/internal/water-board.vue`

#### 9.1.1 长按菜单扩展

当前长按 `showStatusChange(coach)` 弹出状态修改弹窗。

**新增**：在弹窗中增加「免门迎」选项按钮。

```vue
<!-- 修改状态弹窗内新增 -->
<view class="modal-exempt" @click="setExempt(selectedCoach)">
  <text class="exempt-text">免门迎</text>
</view>
```

**样式**：蓝色字体 `#3498db`，加粗，区别于其他状态按钮。

#### 9.1.2 门迎序号显示

在助教卡片上，艺名右侧显示圆圈数字序号：

```vue
<!-- 原有结构 -->
<text class="coach-name">{{ coach.stage_name }}</text>
<!-- 新增序号 -->
<text class="rank-badge" v-if="getRankBadge(coach)">{{ getRankBadge(coach) }}</text>
```

**显示条件**：
- 该助教在 `today_guest_ranking` 中有排名
- 仅空闲/上桌状态显示（与水牌排序范围一致）

**序号映射逻辑**：
- 水牌列表 API 返回数据中注入 `guest_rank` 字段
- 前端 `waterBoards.getList()` 获取列表后，调用 `GET /api/guest-rankings/today` 获取排名映射
- 在 `groupedBoards` 计算属性中为每个助教注入 `guest_rank`

#### 9.1.3 setExempt 方法

```javascript
const setExempt = async (coach) => {
  if (!coach) return
  try {
    await api.guestRankings.setExempt(coach.coach_no)
    uni.showToast({ title: `${coach.stage_name}: 已设免门迎`, icon: 'success' })
    closeModal()
    loadData()
  } catch (e) {
    uni.showToast({ title: e.error || '设置失败', icon: 'none' })
  }
}
```

### 9.2 水牌查看页面修改

**文件**：`uniapp/src/pages/internal/water-board-view.vue`

仅新增序号显示，与 water-board.vue 同样的 `rank-badge` 元素和样式。

无长按交互。

### 9.3 序号徽章样式

```css
.rank-badge {
  position: absolute;
  top: 2px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ff6b35;    /* 橙红色 */
  color: #fff;
  font-size: 10px;
  font-weight: bold;
  line-height: 18px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

/* 空闲状态下的序号 */
.free-section .rank-badge {
  background: #e74c3c;
}

/* 序号 > 50（晚班）用不同颜色 */
.rank-badge.late-shift {
  background: #9b59b6;    /* 紫色 */
}
```

### 9.4 API 模块新增

**文件**：`uniapp/src/utils/api-v2.js`

```javascript
export const guestRankings = {
  // 获取今日排序
  getToday: () => request({ url: '/guest-rankings/today' }),
  // 设置免门迎
  setExempt: (coachNo) => request({ url: `/guest-rankings/exempt/${coachNo}`, method: 'PUT' }),
  // 取消免门迎
  removeExempt: (coachNo) => request({ url: `/guest-rankings/exempt/${coachNo}`, method: 'DELETE' }),
}
```

---

## 十、前后端交互流程

### 10.1 系统启动

```
server.js 启动
  → GuestRankingService.loadTodayData()
    从 system_config 读取 today_guest_ranking 和 today_guest_exempt
    加载到内存 _ranking 和 _exempt
  → cron-scheduler.init()
    注册 3 个新 cron 任务
```

### 10.2 14:00 批处理排序

```
cron-scheduler (14:00)
  → 触发 guest_ranking_morning 任务
    → POST /api/guest-rankings/internal/batch { shift: '早班', startRank: 1, maxRank: 50 }
      → GuestRankingService.batchRank('早班', 1, 50)
        → 查询空闲/上桌早班助教（排除免门迎）
        → 按 clock_in_time DESC 排序
        → 分配序号 1-50
        → _saveRanking() 持久化
  → 前端 30 秒自动刷新，显示新序号
```

### 10.3 18:00 批处理排序

```
cron-scheduler (18:00)
  → 触发 guest_ranking_evening 任务
    → POST /api/guest-rankings/internal/batch { shift: '晚班', startRank: 51, maxRank: 100 }
      → GuestRankingService.batchRank('晚班', 51, 100)
        → 查询空闲/上桌晚班助教（排除免门迎）
        → 按 clock_in_time DESC 排序
        → 分配序号 51-100
        → _saveRanking() 持久化
```

### 10.4 打卡后排序

```
助教打卡上班 (coaches.js)
  → 判断当前时间是否在排序时间段
    → 是 → POST /api/guest-rankings/internal/after-clock { coachNo, shift }
      → GuestRankingService.afterClockRank(coachNo, shift)
        → 检查免门迎 → 跳过
        → 检查空闲/上桌状态 → 跳过
        → 获取当前该班次最大序号
        → 分配 maxRank + 1
        → _saveRanking() 持久化
  → 前端 30 秒刷新，显示新序号
```

### 10.5 设置免门迎

```
水牌管理页面 → 长按助教卡片 → 点击[免门迎]
  → PUT /api/guest-rankings/exempt/:coach_no
    → GuestRankingService.setExempt(coachNo)
      → _ranking 删除该助教
      → _exempt 添加该助教
      → _saveRanking() + _saveExempt() 持久化
  → 前端刷新，序号消失
```

### 10.6 00:00 午夜清空

```
cron-scheduler (00:00)
  → 触发 guest_ranking_midnight 任务
    → POST /api/guest-rankings/internal/clear
      → GuestRankingService.clearAll()
        → _ranking = {}
        → _exempt = new Set()
        → system_config 清空 + 更新日期标记
```

---

## 十一、排序规则详细设计

### 11.1 参与排序的状态

| 班次 | 参与排序的状态 |
|------|---------------|
| 早班 | `早班空闲`, `早班上桌` |
| 晚班 | `晚班空闲`, `晚班上桌` |

**排除条件**：
- 免门迎清单中的助教
- 非空闲/上桌状态的助教（如乐捐、休息、公休、请假、下班、加班）

### 11.2 排序规则

| 时机 | 排序方向 | 排序依据 |
|------|---------|---------|
| 14:00 批处理 | DESC（倒序） | clock_in_time DESC |
| 18:00 批处理 | DESC（倒序） | clock_in_time DESC |
| 打卡后 | ASC 从最后位往后排 | 取当前最大序号 + 1 |

**DESC 含义**：打卡时间越早（数值越小），序号越小（越靠前）。
- 例：A 8:00打卡，B 9:00打卡，C 10:00打卡
- DESC 排序后：C(10:00), B(9:00), A(8:00) → 序号 C=1, B=2, A=3
- 即：**晚打卡的排前面**

> **注意**：需求描述"按打卡时间DESC排序"，SQL 中 `ORDER BY clock_in_time DESC` 表示晚打卡的在前。
> 如果实际业务需求是"早打卡排前面"，则应改为 `ORDER BY clock_in_time ASC`。
> **本方案严格按照需求原文"DESC"实现。**

### 11.3 打卡后排序规则

| 时间 | 班次 | 行为 |
|------|------|------|
| 14:00-17:59 | 早班 | 序号 = 当前早班最大序号 + 1（最多到 50） |
| 18:00-23:59 | 晚班 | 序号 = 当前晚班最大序号 + 1（最多到 100） |
| 其他时间 | 任意 | 不触发排序 |

---

## 十二、边界情况和异常处理

### 12.1 助教状态变更时的序号清理

当助教从空闲/上桌变为其他状态（如下桌、下班）时：
- **方案A**：在 `PUT /api/water-boards/:coach_no/status` 中检查，如果变为非空闲/上桌状态，则从排序中删除
- **方案B**：不清理，下次批处理时自动修正

**推荐方案A**，保证序号实时准确。

### 12.2 超过最大序号限制

- 早班最多 50 人，超过 50 的不分配序号
- 晚班最多 100 人，超过 100 的不分配序号
- 打卡后排序也受此限制

### 12.3 服务重启

- `loadTodayData()` 在服务启动时从 `system_config` 恢复内存数据
- 如果 `today_guest_ranking_date` 与今日日期不一致，自动执行清空

### 12.4 跨天检测

- `loadTodayData()` 和每次排序前检查 `today_guest_ranking_date`
- 如果日期不匹配，自动先执行 `clearAll()` 再执行排序

### 12.5 并发安全

- 所有写操作通过 `runInTransaction` 执行
- `system_config` 使用 `INSERT OR REPLACE` 避免冲突
- 内存数据操作后统一持久化

---

## 十三、开发优先级和阶段

### Phase 1：后端核心（优先级最高）

1. `services/guest-ranking-service.js` — 排序服务类
2. `routes/guest-rankings.js` — API 路由
3. `server.js` — 路由注册 + 启动加载
4. `cron-scheduler.js` — 新增 cron 任务
5. `routes/coaches.js` — 打卡后触发

### Phase 2：前端显示

6. `api-v2.js` — API 模块
7. `water-board.vue` — 长按免门迎 + 序号显示
8. `water-board-view.vue` — 序号显示

### Phase 3：测试和联调

9. 批处理排序测试（手动触发 cron 任务）
10. 打卡后排序测试
11. 免门迎设置测试
12. 午夜清空测试
13. 前端序号显示验证

---

## 十四、测试要点

| 测试场景 | 预期结果 |
|---------|---------|
| 手动触发 14:00 排序 | 早班空闲/上桌助教按 clock_in_time DESC 分配序号 1-N |
| 手动触发 18:00 排序 | 晚班空闲/上桌助教按 clock_in_time DESC 分配序号 51-N |
| 14点后早班打卡 | 新打卡助教排到早班最后位 |
| 18点后晚班打卡 | 新打卡助教排到晚班最后位 |
| 设置免门迎 | 该助教序号消失，不在后续排序中出现 |
| 午夜 00:00 | 所有序号清空，免门迎清单清空 |
| 服务重启 | 从 system_config 恢复今日排序数据 |
| 助教状态变为下班 | 序号自动删除 |
| 前端水牌页面 | 空闲/上桌助教艺名右侧显示圆圈序号 |

---

## 十五、注意事项

1. **TimeUtil 使用**：所有时间处理使用 `TimeUtil.nowDB()`, `TimeUtil.todayStr()`
2. **数据库写入**：所有写操作使用 `runInTransaction` 或 `enqueueRun`
3. **页面显示**：显示 `employee_id`，不显示 `coach_no`（但 `coach_no` 可用于内部逻辑和 `:key` 绑定）
4. **序号显示**：仅在前端页面显示圆圈数字，不存入数据库（序号是动态计算的，从 `_ranking` 映射中获取）
5. **cron 任务日志**：每次 cron 执行需记录 `cron_log`
6. **操作日志**：设置免门迎操作需记录 `operation_log`

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