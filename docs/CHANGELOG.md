
## 2026-04-11 助教权限系统优化

### 新增功能
- 助教权限白名单：支持助教访问收银看板、水牌管理、打卡等功能
- OSS签名URL直传：前端直接上传到OSS，绕过后端代理权限问题

### 修复问题
- clock.vue 添加 onShow，解决先进入页面再登录时无法获取水牌状态的问题
- 退出登录时清理 adminToken 和 adminInfo
- 给 '教练' 角色添加收银看板和打卡权限

### 权限白名单
助教可访问的后台权限：
- `cashierDashboard` - 上下桌单、服务单
- `serviceOrder` - 服务单查看
- `coachManagement` - 打卡
- `waterBoardManagement` - 水牌状态查看
- `invitationReview` - 约客提交
- `all` - 申请（加班、请假、乐捐）

### 技术细节
- authMiddleware 支持 JWT (adminToken) 和 base64 (coachToken) 两种 token 解析
- permissionMiddleware 新增 COACH_ALLOWED_PERMISSIONS 白名单 + coachSelfOnly 选项
