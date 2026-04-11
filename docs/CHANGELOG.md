
## 2026-04-11 台桌选择器优化 + 助教台桌号一致性检查

### 需求1：台桌选择后统一更新 storage
- service-order.vue 的台桌选择回调新增写入 `tableAuth`，与扫码成功行为一致
- products.vue 和 cart.vue 已有此逻辑，无需修改

### 需求2：水牌上台助教台桌号不一致警告
- cart.vue 下单流程新增 `checkCoachTableConsistency()` 检查
- 助教水牌状态为「早班上桌/晚班上桌」时，若水牌台桌号 ≠ 当前选择台桌号
- 弹出警告弹框：显示水牌台桌号和选择台桌号，用户确认后继续下单
- 后台用户（非助教）不受此检查影响

### 需求3：台桌选择器区域排序
- TableSelector.vue 的 `areas` 计算属性改为固定排序：
  - **包厢区 → 大厅区 → 斯诺克区 → 棋牌区 → TV区 → 其他**
- 前端所有使用 TableSelector 的页面（商品页、购物车、上桌单、服务下单）自动生效

### 涉及文件
- `src/components/TableSelector.vue` - 区域排序
- `src/pages/cart/cart.vue` - 台桌号一致性检查 + 警告弹框
- `src/pages/internal/service-order.vue` - 台桌选择后更新 tableAuth

---

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
