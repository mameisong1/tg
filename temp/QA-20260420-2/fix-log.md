# Fix Log — QA-20260420-2 活跃计时器

> 程序员A 编码实现 | 2026-04-20 17:39

---

## 修改文件

### 1. backend/services/timer-manager.js
- **新增** `enrichLejuanTimer(detail, recordId)` — 通过 JOIN lejuan_records + coaches 补全助教信息
- **新增** `enrichApplicationTimer(detail, recordId)` — 通过 JOIN applications + coaches 补全助教信息 + application_type
- **新增** `getActiveTimersWithDetails()` — 遍历内存定时器，计算 remainingSeconds，调用 enrich 方法补全详情
- **修改** `module.exports` — 新增导出 `getActiveTimersWithDetails`

### 2. backend/routes/system-report.js
- **新增** `GET /api/system-report/active-timers` — 调用 timerManager.getActiveTimersWithDetails()，返回 {success, data, total}

### 3. admin/system-report.html
- **新增** Tab 按钮「活跃计时器」（data-tab="activeTimers"）
- **新增** Tab 内容区 `#tab-activeTimers` — 统计卡片 + 类型过滤 + 数据表格
- **新增** JS 变量 `currentActiveTimerType`
- **新增** JS 函数 `setActiveTimerType()` — 类型过滤切换
- **新增** JS 函数 `loadActiveTimers()` — 获取数据、统计、渲染表格
- **新增** JS 函数 `formatRemainingTime()` — 秒数转可读格式
- **新增** JS 函数 `escapeHtml()` — XSS 防护
- **修改** `switchTab()` — 增加 `activeTimers` 分支
- **修改** IIFE 初始化 — 增加 10 秒自动刷新（仅在 Tab 可见时）

---

## 编码规范检查

| 规范 | 状态 | 说明 |
|------|------|------|
| 时间：TimeUtil.nowDB() | ✅ | enrich 方法中使用 `new Date(TimeUtil.nowDB() + '+08:00')` |
| 数据库连接：复用 db/index.js | ✅ | 使用 timer-manager 已有的 `get` 方法 |
| 页面只显示 employee_id | ✅ | 前端表格列：助教工号(employee_id)、姓名(stage_name)，无 coach_no |
| 禁止 datetime('now') | ✅ | 未使用 |
| 禁止手动时区偏移 | ✅ | 使用 `+08:00` 显式指定时区 |

---

## Git 提交

```
commit: 1000e0b
message: feat: 新增活跃计时器API和前端Tab
```
