# Fix Log - QA-20260420-3 计时器系统重构

## 修改概览

**Commit**: `1f35463` - refactor: 合并计时器系统到timer-manager

## 修改文件清单

### 1. services/timer-manager.js（大幅修改）

**改动内容**：
- 扩展 `createTimer` 签名：新增 `coachInfo` 参数（可选，向后兼容）
- `activeTimers` 存储结构新增 `coachInfo` 字段
- **新增方法**：
  - `scheduleApplicationTimer(record, coachInfo)` — 注册申请定时器
  - `scheduleLejuanTimer(record, coachInfo)` — 注册乐捐定时器
  - `cancelApplicationTimer(applicationId)` — 取消申请定时器
  - `cancelLejuanTimer(recordId)` — 取消乐捐定时器
  - `executeApplicationRecovery(applicationId)` — 从 application-timer.js 迁入
  - `executeLejuanActivation(recordId)` — 从 lejuan-timer.js 迁入
  - `recoverApplicationTimers()` — 修改为内部直接调用，无需回调
  - `recoverLejuanTimers()` — 修改为内部直接调用，无需回调
  - `pollCheck()` — 修改为自包含，调用内部业务方法
- `init()` 简化：不再需要 callbacks 参数，一行调用
- `getActiveTimersWithDetails()` 优化：优先从内存 coachInfo 读取，兜底查库

**编码规范**：
- 时间处理：全部使用 `TimeUtil.nowDB()`
- 数据库操作：复用 `db/index.js`（get/all/enqueueRun/runInTransaction）
- 页面显示：coachInfo 中 employee_id 页面显示用，coach_no 仅内部使用

### 2. routes/applications.js（4处修改）

- import: `applicationTimer` → `timerManager`
- 休息申请创建：`applicationTimer.addNewRecord()` → `timerManager.scheduleApplicationTimer()`
- 请假申请创建：`applicationTimer.addNewRecord()` → `timerManager.scheduleApplicationTimer()`
- 取消申请：`applicationTimer.cancelRecord()` → `timerManager.cancelApplicationTimer()`

### 3. routes/lejuan-records.js（3处修改）

- import: `lejuanTimer` → `timerManager`
- 创建乐捐：`lejuanTimer.addNewRecord()` → `timerManager.scheduleLejuanTimer()` + 查 employee_id
- 删除乐捐：`lejuanTimer.cancelRecord()` → `timerManager.cancelLejuanTimer()`

### 4. server.js（简化）

- 删除 `LejuanTimer` 和 `ApplicationTimer` 引用
- `TimerManager.init({...callbacks...})` → `TimerManager.init()` 一行

### 5. 删除文件

- `services/application-timer.js` — 业务逻辑已迁入 timer-manager.js
- `services/lejuan-timer.js` — 业务逻辑已迁入 timer-manager.js

## 验收对照

| 验收项 | 状态 | 说明 |
|--------|------|------|
| 系统启动恢复所有定时器 | ✅ | `init()` 内部调用 `recoverApplicationTimers()` + `recoverLejuanTimers()` |
| active-timers API 显示完整列表 | ✅ | `getActiveTimersWithDetails()` 从 coachInfo 直接读取，兜底查库 |
| 正常流程创建的定时器能显示 | ✅ | `scheduleApplicationTimer`/`scheduleLejuanTimer` 创建时即存 coachInfo |
| 编码规范：TimeUtil | ✅ | 全部使用 `TimeUtil.nowDB()` |
| 编码规范：db/index.js | ✅ | 使用 get/all/enqueueRun/runInTransaction |
| 无 coach_no 页面泄露 | ✅ | coachInfo.employee_id 用于页面显示，coach_no 仅内部使用 |
