通知功能技术设计方案 - 修正版

新增文件(4个)：backend/routes/notifications.js, backend/services/notification-service.js, pages/internal/notification-list.vue, pages/internal/notification-manage.vue

修改文件(4个)：backend/server.js(注册路由), backend/middleware/permission.js(通知管理权限), pages.json(2个新页面), pages/member/member.vue(通知图标+角标+管理按钮)

数据库：新增notifications表+notification_recipients表+2个索引

API接口(7个)：
1. GET /api/notifications - 我的通知列表(分页,pageSize上限50)
2. GET /api/notifications/unread-count - 未阅数量
3. POST /api/notifications/:id/read - 标记已阅(不可改回)
4. POST /api/notifications/manage/send - 发送通知(全员/指定)
5. GET /api/notifications/manage/list - 已发送列表(分页,最多50条)
6. GET /api/notifications/manage/:id/recipients - 接收者详情(LIMIT 50)
7. GET /api/notifications/manage/employees - 可选员工(LIMIT 50,搜索+筛选)

修正项：(1)3个查询接口加LIMIT上限50 (2)统一A/B的API路径和参数格式 (3)补充5个缺失测试场景