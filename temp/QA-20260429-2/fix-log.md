# QA-20260429-2 修复记录

## 修复1：前端API调用方式错误

**问题**：notification-list.vue 和 notification-manage.vue 使用了错误的 API 调用方式 `api.default({ url: '...' })`

**修复**：
- 在 api.js 中添加 notifications 模块，提供 7 个 API 方法
- 修改前端页面使用 `api.notifications.xxx()` 方式调用

**文件**：
- `/TG/tgservice-uniapp/src/utils/api.js`
- `/TG/tgservice-uniapp/src/pages/internal/notification-list.vue`
- `/TG/tgservice-uniapp/src/pages/internal/notification-manage.vue`
- `/TG/tgservice-uniapp/src/pages/member/member.vue`

---

## 完成清单

1. ✅ 后端路由创建（7个API接口）
2. ✅ 数据库表创建（notifications + notification_recipients）
3. ✅ server.js 注册路由
4. ✅ permission.js 添加权限
5. ✅ 前端页面创建（notification-list.vue + notification-manage.vue）
6. ✅ pages.json 注册页面
7. ✅ member.vue 添加通知按钮和通知管理按钮
8. ✅ api.js 添加 notifications 模块
9. ✅ time.js 前端时间工具创建
10. ✅ 代码提交到 Git
11. ✅ 测试环境重启（pm2 restart tgservice-dev）
12. ✅ API 功能测试通过

---

_修复完成时间：2026-04-29 13:35_