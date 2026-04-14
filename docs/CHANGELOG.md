
## 2026-04-14 助教上班时间记录 + 水牌排序优化

### 需求
- 助教点上班后，记录具体的上班时间
- 水牌页面各状态分段的助教按时间排序

### 变更内容

#### 数据库
- **water_boards 表新增 `clock_in_time` 字段**（DATETIME，北京时间）
- 存量数据初始化为 `updated_at` 值

#### 后端 API
- **POST /api/coaches/:coach_no/clock-in**（上班）：写入 `clock_in_time = TimeUtil.nowDB()`
- **POST /api/coaches/:coach_no/clock-out**（下班）：清空 `clock_in_time = NULL`
- **PUT /api/water-boards/:coach_no/status**：从下班状态变为工作状态时写入 `clock_in_time`，变为下班时清空
- **GET /api/water-boards**：返回 `clock_in_time` 字段
- **server.js**：CORS 新增 `127.0.0.1:8088/8089` 地址

#### 前端排序
- **water-board-view.vue**（H5 水牌查看）：
  - 早班空闲/晚班空闲：按 `clock_in_time` 倒序
  - 其他状态：按 `updated_at` 倒序
- **water-board.vue**（水牌管理）：同上

### 测试结果
- 所有状态排序验证通过（clock_in_time 倒序 / updated_at 倒序）
- 生产环境发布成功（镜像 `mameisong/tgservice:20260414-v3`）

---

## 2026-04-14 时区统一改造

### 问题
- 后台数据概览页面"今日订单"在 00:00-08:00 显示为 0
- orders 表使用 `datetime('now')` 存储 UTC 时间,其他表存储北京时间,时区不一致
- 前端多处使用 `+ 8h` 手动偏移和 `+ ' UTC'` 拼接,存在重复偏移 bug

### 改造内容
- **新增工具类**:`backend/utils/time.js`(后端)+ `admin/js/time-util.js`(前端)
- **后端**:server.js 全部 60+ 处 `datetime()` 调用改为 `TimeUtil.nowDB()` 参数化
- **前端**:7 个页面统一使用 `TimeUtil`,删除手动偏移和 `' UTC'` 拼接
- **数据迁移**:orders / service_orders / table_action_orders 存量 UTC 时间转为北京时间
- **同步脚本**:`sync-products.js` SQL 时间参数化

### 修复结果
- 后台数据概览"今日订单"正常显示（测试：11 条）
- 所有表时间字段统一为北京时间 `YYYY-MM-DD HH:MM:SS`
- 前端页面全部正确加载，无 JavaScript 错误
- 单元测试 56/56 通过

### 追加修复（2026-04-14 10:41）
- **设备访问统计时区**：`visit_date` 存储从 UTC 改为北京时间，修复凌晨 00:00-08:00 期间统计漏数
- **周计算边界**：`getWeekStart()` 和 12 周数据计算从 `toISOString()` 改为北京时间，消除周边界漂移
- **清理过期数据**：SQL `date('now', '-90 days')` 改为参数化北京日期
- **今日订单日期格式 bug**：`TimeUtil.today()` 从 `toLocaleDateString.replace` 改为 `split + padStart`，修复单数字月份无法匹配 SQLite `DATE()` 的问题

### H5 前端时区修复（2026-04-14 10:57）
- **问题**：H5 前端 8 处 `new Date().toISOString().split('T')[0]` 导致北京时间 20:00-08:00 期间日期差一天
- **影响**：约客审查（晚班 20:00 后完全不可用）、乐捐报备、约客上传
- **修复**：新建 `src/utils/time-util.js` 北京时间工具，替换所有 `toISOString()` 调用
- **formatTime 修复**：`invitation-review.vue` 中 `new Date(t.replace(' ', 'T'))` 改为显式 `+08:00`

### 路由时区修复（2026-04-14 11:49）
- **约客时间校验**：`guest-invitations.js` 中 `toISOString().split('T')[0]` 改为 `TimeUtil.todayStr()`，修复凌晨 00:00-08:00 时间校验失效
- **约客审查时间**：`reviewed_at` / `generated_at` 改为 `TimeUtil.nowDB()`（北京时间）
- **审批时间**：`applications.js` 中 `approve_time` 改为 `TimeUtil.nowDB()`

### 安全修复（2026-04-14 10:45）
- `.config` 从 Git 历史中彻底移除（`git filter-branch`），消除阿里云 AccessKey 泄露风险
- 添加 `.config.example` 模板文件供开发者参考

---

## 2026-04-11 台桌选择器优化 + 助教台桌号一致性检查

### 需求1:台桌选择后统一更新 storage
- service-order.vue 的台桌选择回调新增写入 `tableAuth`,与扫码成功行为一致
- products.vue 和 cart.vue 已有此逻辑,无需修改

### 需求2:水牌上台助教台桌号不一致警告
- cart.vue 下单流程新增 `checkCoachTableConsistency()` 检查
- 助教水牌状态为「早班上桌/晚班上桌」时,若水牌台桌号 ≠ 当前选择台桌号
- 弹出警告弹框:显示水牌台桌号和选择台桌号,用户确认后继续下单
- 后台用户(非助教)不受此检查影响

### 需求3:台桌选择器区域排序
- TableSelector.vue 的 `areas` 计算属性改为固定排序:
  - **包厢区 → 大厅区 → 斯诺克区 → 棋牌区 → TV区 → 其他**
- 前端所有使用 TableSelector 的页面(商品页、购物车、上桌单、服务下单)自动生效

### 涉及文件
- `src/components/TableSelector.vue` - 区域排序
- `src/pages/cart/cart.vue` - 台桌号一致性检查 + 警告弹框
- `src/pages/internal/service-order.vue` - 台桌选择后更新 tableAuth

---

## 2026-04-11 助教权限系统优化

### 新增功能
- 助教权限白名单:支持助教访问收银看板、水牌管理、打卡等功能
- OSS签名URL直传:前端直接上传到OSS,绕过后端代理权限问题

### 修复问题
- clock.vue 添加 onShow,解决先进入页面再登录时无法获取水牌状态的问题
- 退出登录时清理 adminToken 和 adminInfo
- 给 '教练' 角色添加收银看板和打卡权限

### 权限白名单
助教可访问的后台权限:
- `cashierDashboard` - 上下桌单、服务单
- `serviceOrder` - 服务单查看
- `coachManagement` - 打卡
- `waterBoardManagement` - 水牌状态查看
- `invitationReview` - 约客提交
- `all` - 申请(加班、请假、乐捐)

### 技术细节
- authMiddleware 支持 JWT (adminToken) 和 base64 (coachToken) 两种 token 解析
- permissionMiddleware 新增 COACH_ALLOWED_PERMISSIONS 白名单 + coachSelfOnly 选项
