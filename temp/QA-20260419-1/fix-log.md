# QA-20260419-1 修复日志

**日期**: 2026-04-19
**程序员**: A（编码实现）

---

## 修改文件清单

### 后端

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/routes/applications.js` | 修改 | 新增3种申请类型、月度限制、审批业务逻辑、4个新API |
| `backend/services/application-timer.js` | 新增 | 休息/请假定时恢复服务，支持重启自动恢复 |
| `backend/server.js` | 修改 | 注册 `application-timer.init()` |

### 前端

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/pages/internal/shift-change-apply.vue` | 新增 | 班次切换申请页面 |
| `src/pages/internal/rest-apply.vue` | 新增 | 休息申请页面 |
| `src/pages/internal/leave-request-apply.vue` | 新增 | 请假申请页面 |
| `src/pages/internal/shift-change-approval.vue` | 新增 | 班次切换审批页面 |
| `src/pages/internal/leave-request-approval.vue` | 新增 | 请假审批页面 |
| `src/pages/internal/rest-approval.vue` | 新增 | 休息审批页面 |
| `src/pages/internal/internal-home.vue` | 修改 | 新增6个按钮+角标，改用 pending-count API |
| `src/utils/api-v2.js` | 修改 | 新增4个API方法 |
| `src/pages.json` | 修改 | 新增6个路由 |

---

## 编码细节

### 1. applications.js — validTypes 变更

```javascript
// 新增
'班次切换申请',
'请假申请',
'休息申请'
// 删除: '乐捐报备'
```

### 2. POST 月度限制

| 类型 | 限制 | 实现 |
|------|------|------|
| 班次切换 | 每月2次 | COUNT status=1 的当月记录 |
| 休息+请假 | 合并每月4天 | 解析 extra_data 中的 rest_date/leave_date，Set 去重统计 |

### 3. PUT approve 业务逻辑

| 类型 | 审批通过时 |
|------|-----------|
| 班次切换 | UPDATE coaches.shift → UPDATE water_boards.status → 班次空闲 |
| 休息申请 | water_boards.status = '休息' → 设置定时器 exec_time = rest_date + 12:00 |
| 请假申请 | water_boards.status = '请假' → 设置定时器 exec_time = leave_date + 12:00 |

### 4. application-timer.js 重启恢复

```
启动时 recoverTimers():
  1. 查询所有 timer_set=true 且 status=1 的记录
  2. 跳过 executed=1 的记录
  3. 检查水牌状态：已不是"休息"/"请假" → 标记 executed=1 并跳过
  4. exec_time 已过 → 立即 executeRecovery()
  5. exec_time 未到 → setTimeout 重新注册

每分钟 pollCheck():
  兜底检查，防止遗漏
```

### 5. 新增 API

| API | 权限 | 说明 |
|-----|------|------|
| GET /pending-count | coachManagement | 返回各类待审批数量 |
| GET /shift-stats | coachManagement | 返回当前早晚班人数 |
| DELETE /:id | all | 助教取消自己的待处理申请 |
| GET /my-month-count | all | 查询本人本月申请次数 |

---

## 编码规范检查

- ✅ 时间处理：后端全部使用 TimeUtil.nowDB() / TimeUtil.todayStr() / TimeUtil.offsetDB()
- ✅ DB连接：复用 db/index.js，无新建连接
- ✅ DB写入：全部使用 runInTransaction 或 enqueueRun
- ✅ 页面显示：所有页面只显示 employee_id，不显示 coach_no

---

## Git 提交

| 提交 | hash | 说明 |
|------|------|------|
| feat: 新增助教申请事项 | 1f182b9 | 首次提交全部代码 |
| fix: 修复 application-timer.js | 21cb5f3 | 重启恢复逻辑修复 |
