# 门迎排序功能 - 编码完成记录

> QA 编号：QA-20260422-02  
> 编码日期：2026-04-22  
> 编码者：程序员A

---

## 已完成文件（8个）

### ✅ 1. 新增 `backend/services/guest-ranking-service.js`
- 单例类 `GuestRankingService`
- 内存状态：`_ranking` (object), `_exempt` (Set), `_date` (string)
- 核心方法：
  - `loadTodayData()` — 从 system_config 加载
  - `batchRank(shift, startRank, maxRank)` — 批处理排序
  - `afterClockRank(coachNo, shift)` — 打卡后排序
  - `setExempt(coachNo)` — 设置免门迎
  - `removeExempt(coachNo)` — 取消免门迎
  - `getTodayRanking()` — 获取今日全部数据
  - `clearAll()` — 午夜清空
  - `checkAndResetIfNewDay()` — 跨天检测
- 持久化到 system_config 表：`today_guest_ranking`, `today_guest_exempt`, `today_guest_ranking_date`

### ✅ 2. 新增 `backend/routes/guest-rankings.js`
- 内部接口：
  - `POST /internal/batch` — 批处理排序（IP限制 127.0.0.1）
  - `POST /internal/clear` — 午夜清空（IP限制）
  - `POST /internal/after-clock` — 打卡后排序（IP限制）
- 业务接口：
  - `PUT /exempt/:coach_no` — 设置免门迎（waterBoardManagement 权限）
  - `DELETE /exempt/:coach_no` — 取消免门迎（waterBoardManagement 权限）
  - `GET /today` — 获取今日排序（waterBoardManagement 权限）

### ✅ 3. 修改 `backend/server.js`
- 新增路由导入：`const guestRankingsRouter = require('./routes/guest-rankings')`
- 注册路由：`app.use('/api/guest-rankings', guestRankingsRouter)`
- 启动时加载：`guestRankingService.loadTodayData()`

### ✅ 4. 修改 `backend/services/cron-scheduler.js`
- `initDefaultTasks()` 新增 3 个 cron 任务：
  - `guest_ranking_morning` — 14:00 早班门迎排序
  - `guest_ranking_evening` — 18:00 晚班门迎排序
  - `guest_ranking_midnight` — 00:00 清空门迎排序
- 新增 `taskGuestRanking()` 方法
- `checkAndRunTasks()` 新增 `guest_ranking` 任务类型处理

### ✅ 5. 修改 `backend/routes/coaches.js`
- 新增 `http` 模块导入
- 上班打卡成功后，非阻塞触发门迎排序
- 仅在排序时间段内触发（14点后早班，18点后晚班）

### ✅ 6. 修改 `src/pages/internal/water-board.vue`
- 长按弹窗新增蓝色「免门迎」选项
- 助教卡片艺名右侧显示圆圈数字序号（rank-badge）
- 新增方法：`loadGuestRanking()`, `getRankBadge()`, `setExempt()`
- 新增 CSS 样式：`.rank-badge`, `.name-row`, `.modal-exempt`, `.exempt-text`
- 30秒自动刷新时同步加载排序数据

### ✅ 7. 修改 `src/pages/internal/water-board-view.vue`
- 助教卡片艺名右侧显示圆圈数字序号（rank-badge）
- 新增方法：`loadGuestRanking()`, `getRankBadge()`
- 新增 CSS 样式：`.rank-badge`, `.name-row`, `.expand-name-row`

### ✅ 8. 修改 `src/utils/api-v2.js`
- 新增 `guestRankings` 模块：
  - `getToday()` — 获取今日排序
  - `setExempt(coachNo)` — 设置免门迎
  - `removeExempt(coachNo)` — 取消免门迎
- 已导出到 default

---

## 编码规范检查

| 规范项 | 状态 |
|--------|------|
| 时间处理使用 TimeUtil | ✅ 使用 TimeUtil.nowDB(), TimeUtil.todayStr() |
| 数据库连接使用 require('../db') | ✅ 使用 get, runInTransaction, enqueueRun |
| 数据库写入使用 runInTransaction/enqueueRun | ✅ |
| 页面显示 employee_id 不显示 coach_no | ✅ 页面使用 employee_id，coach_no 仅用于内部逻辑 |

---

## Git 提交

- 仓库: `/TG`
- Commit: `73b8990 feat: 新增助教门迎排序功能`
- 包含后端 + 前端所有修改

---

## 注意事项

1. `batchRank` 方法中，由于 SQL 中免门迎过滤在 JS 层面完成，SQL 查询使用了 `NOT IN (SELECT coach_no FROM coaches WHERE 0 = 1)` 作为占位符（始终为真，不过滤），真正的免门迎过滤在 JS 中通过 `this._exempt` Set 完成
2. 打卡后排序使用非阻塞 HTTP 调用，不影响打卡主流程
3. 跨天检测在每次排序操作前自动执行
4. 前端序号徽章：早班 1-50（橙红），晚班 51-100（紫色）
