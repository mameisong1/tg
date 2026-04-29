## QA-20260429-3 设计摘要

### 需求
台桌状态同步 + 系统通知改造

### 改动文件（7个）
1. **backend/server.js** — 修改sync/tables成功时写cron_log + 新增sync/tables/error接口
2. **backend/routes/system-report.js** — cron-logs增加taskType过滤参数
3. **backend/routes/notifications.js** — 新增sendSystemNotificationToAdmins函数+导出
4. **backend/services/cron-scheduler.js** — 各任务catch块添加系统通知发送
5. **backend/services/timer-manager.js** — executeTimer catch块添加系统通知发送
6. **admin/system-report.html** — Cron日志tab增加task_type筛选+台桌同步详情展示
7. **scripts/sync-tables-status.js** — 失败时调用error上报接口

### 新增API
- POST /api/admin/sync/tables/error（无需认证，同步脚本调用，写cron_log+发通知）

### 修改API
- POST /api/admin/sync/tables（成功后增加写cron_log）
- GET /api/system-report/cron-logs（增加taskType参数）

### 数据库变更
- 无新建表、无修改字段，完全复用现有cron_log、notifications、notification_recipients表

### error_type枚举
- table_sync_error / cron_error / timer_error

### 管理员定义
- admin_users表中role IN ('店长', '助教管理', '管理员')
