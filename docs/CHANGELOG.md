
## 2026-04-24 邀请助教上桌功能

### 背景
- H5助教详情页面需要"邀请上桌"功能
- 顾客扫码进入时可能未登录，需公开API

### 修改内容

#### 1. 后端新增公开API
- **文件**: `server.js`
- **接口**: `POST /api/service-orders/guest`（无需认证）
- **参数**: `table_no`, `requirement`, `coach_no`
- **自动填充**: `requester_name=顾客`, `requester_type=顾客`

#### 2. 前端功能实现
- **文件**: `pages/coach-detail/coach-detail.vue`
- **按钮**: "预约教练" → "邀请上桌"
- **状态**: 水牌空闲时可用，非空闲时禁用
- **检测**: 进入页面检查台桌号Storage有效性
- **对话框**: 失效提示/确认邀请/成功提示
- **服务单格式**: `助教上桌邀请函（工号 艺名）`

#### 3. Bug修复
- 服务单内容格式从 `邀请 XX 上桌` 修正为 `助教上桌邀请函（工号 艺名）`

---


### 背景
- 服务下单页面按钮多，空间不足
- 需求内容未分类，用户选择困难

### 修改内容

#### 1. 服务订单数据分析
- 分析生产环境 242 条服务订单
- 按需求内容归类为三大类别：酒水冰块、器具用品、人工服务

#### 2. 系统配置新增
- **表**: `system_config`
- **key**: `service_order_categories`
- **内容**: 分类按钮配置 JSON

#### 3. 后端新增 API
- **文件**: `routes/system-config.js`（新建）
- **接口**: `GET /api/system-config/service-categories`
- **缓存**: 服务端内存缓存 1 小时

#### 4. 前端页面改造
- **文件**: `pages/internal/service-order.vue`
- **改造**: 从硬编码改为读取配置
- **缓存**: 本地存储缓存 1 小时
- **布局**: 分类按钮改为竖向排列
- **样式**: 去掉台桌号标签、去掉下单人显示

#### 5. 数据库迁移
- 开发环境：`/TG/tgservice/db/tgservice.db`
- 生产环境：`/TG/run/db/tgservice.db`

### 分类配置
| 类别 | 按钮数 | 颜色 |
|------|--------|------|
| 酒水冰块 | 5 | #3498db（蓝色）|
| 器具用品 | 8 | #e67e22（橙色）|
| 人工服务 | 6 | #e74c3c（红色）|

### Git提交
- `0a27d84`: feat: 服务下单页面改造为分类按钮模式
- `297c137`: style: 服务下单页面分类按钮改为竖向排列
- `862aa0f`: style: 服务下单页面去掉台桌号标签
- `93ee3f7`: style: 服务下单页面去掉下单人显示

---

## 2026-04-22 班次切换审批水牌状态修改限制

### 问题
- 22号助教（小泡）未打卡但水牌状态被改为"晚班空闲"
- 原因：班次切换审批无条件将水牌设为"空闲"，不管当前状态

### 修复内容

#### 班次切换审批逻辑修改
- **文件**: `routes/applications.js`
- **修改**: 只有上桌/空闲/加班状态才能修改水牌
- **状态映射**:
  - 早班上桌 → 晚班上桌
  - 晚班上桌 → 早班上桌
  - 早班空闲 → 晚班空闲
  - 晚班空闲 → 早班空闲
  - 早加班 → 晚加班
  - 晚加班 → 早加班

#### 禁止修改水牌的状态
- 下班、休息、公休、请假、乐捐
- 原因：这些状态表示助教不在店，不应因班次切换改变

#### 测试结果
- 允许修改：六六(晚班空闲→早班空闲) ✅
- 禁止修改：歪歪(下班状态保持不变) ✅

### Git提交
- `d0f7c0f`: 班次切换审批水牌状态修改限制

---

## 2026-04-21 漏单统计逻辑修复 + 奖罚表唯一约束变更

### 问题1：漏单统计误判
- 漏单统计页面显示江江有2条漏单（普台11+普台16）
- 但奖罚同步只生成1条（普台11）
- 原因：上桌单后有取消单也被计入漏单

### 问题2：奖罚表唯一约束不支持同一天多条漏单
- 唯一约束 `(confirm_date, type, phone)` 不包含 remark
- 同一天同一助教漏多个台桌只能存一条

### 修复内容

#### 1. 漏单统计逻辑修复
- `missing-table-out-orders.js`: 统计和明细SQL添加排除取消单的 NOT EXISTS
- `cron-scheduler.js`: 奖罚同步的漏单查询添加排除取消单的 NOT EXISTS
- 效果：有取消单的上桌单不算漏单

#### 2. 奖罚表唯一约束变更
- 数据库：`idx_rp_unique` 改为 `(confirm_date, type, phone, remark)`
- 代码：所有 ON CONFLICT 和 DELETE 语句添加 remark
- 效果：同一天同一助教可存储多条不同台桌的漏单罚金

#### 3. SQL语法修复
- SQLite字符串连接用单引号而非反引号
- `'漏单 ' || t_in.table_no` 修复 `` `漏单 ` `` 语法冲突

### Git提交
- `8489999`: 漏单统计逻辑修复
- `9fc6a45`: 奖罚表唯一约束变更
- `363cdf8`: SQL语法修复

### 生产发布
- 镜像版本：20260421V2
- 发布时间：2026-04-21 14:12

---

## 2026-04-16 修复 admin 后台侧边栏公共化迁移遗留的布局问题

### 问题
- 提交 ea5a115 将 15 个页面的内联侧边栏迁移为公共组件时，迁移不完整
- 全部 15 个 HTML 内联 `<style>` 末尾残留截断的无效 CSS
- 7 个页面残留孤儿 `</div>`，破坏 `<body>` 的 flex 布局
- 收银看板 `.main` 使用 `height: 100vh` 导致全屏底部大空白

### 修复内容

#### Step 1：删除截断 CSS（15 个 HTML 文件）
- 删除无效的 `.nav-group.open` 和 `.nav-submenu` 无属性值规则

#### Step 2：删除孤儿 `</div>`（7 个页面）
- 涉及：home.html, coaches.html, categories.html, members.html, products.html, tables.html, vip-rooms.html

#### Step 3：修复收银看板布局
- `cashier-dashboard.html`：`.main` 改为 `flex column` + `height: 100vh`
- `.three-columns` 改为 `flex: 1` 自适应撑满剩余空间
- 移除硬编码的 `calc(100vh - 180px)`

### 修复问题
1. 页面变窄靠左不居中
2. 批量更新班次筛选条件折行乱版
3. 收银看板全屏后底部大空白

---

## 2026-04-16 同步水牌新增离店助教残留台桌号检测与清理

### 需求
- 助教状态为离店（休息/公休/请假/下班）时，如果水牌中还有台桌号，列举出来让用户确认后清空
- 只清空台桌号（table_no = NULL），不删除水牌记录

### 变更内容

#### 后端
- **server.js**：
  - `GET /api/admin/coaches/sync-water-boards/preview` 返回值新增 `offDutyWithTables` 字段和 `summary.offDutyCount`
  - `POST /api/admin/coaches/sync-water-boards/execute` 新增 `clearTableCoachNos` 参数，在事务中 `UPDATE water_boards SET table_no = NULL`
  - 清理操作记录操作日志（operation_type: '清理残留台桌'）

#### 前端
- **admin/coaches.html**：
  - 同步弹窗新增「离店残留台桌」区域，显示助教编号、艺名、状态、残留台桌号（标签样式）
  - 支持全选/取消勾选
  - 摘要区增加「清空 X 人台桌号」计数

### 测试结果
- QA 测试用例 7/7 全部通过
- 编码规范检查 63/63 文件通过

---

## 2026-04-14 修复 SQLite 事务嵌套冲突（BUG-0414）

### 问题
- 购物车添加商品时报错 `SQLITE_ERROR: cannot start a transaction within a transaction`
- 根因：三套互相冲突的事务机制共用同一个 SQLite 数据库连接
  - `dbTx()` — 走写队列串行化
  - `beginTransaction()` — 不走写队列
  - 裸 `dbRun('BEGIN TRANSACTION')` — 不走写队列

### 修复方案
- **所有数据库写入操作统一通过 writeQueue 串行化**

### 变更内容

#### 核心模块
- **db/index.js**：新增 `runInTransaction()`（事务排队）、`enqueueRun()`（非事务写入排队），`dbTx` 增加事务恢复逻辑

#### 后端路由
- **server.js**：教练创建改用 `runInTransaction()`，54 处 `dbRun()` → `enqueueRun()`
- **routes/coaches.js**：4 处 `beginTransaction()` → `runInTransaction()`
- **routes/applications.js**：2 处
- **routes/guest-invitations.js**：4 处
- **routes/water-boards.js**：1 处
- **routes/table-action-orders.js**：2 处
- **routes/service-orders.js**：4 处 `db.run()` → `enqueueRun()`

### 测试结果
- 37/37 测试用例全部通过
- 并发测试：5 个同时购物车写入全部成功
- 回归测试：事务恢复场景正常工作
- 生产环境发布成功（镜像 `mameisong/tgservice:20260414-v4`）

---

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

---

## 2026-04-22 前端错误日志自动收集上报框架

### 新功能
- 全局自动捕获：Vue错误、JS错误、Promise未捕获错误
- 统一上报工具：`src/utils/error-reporter.js`
- 去重机制：Map缓存 + 60秒时间窗口
- 日志清理：文件修改时间判断，超过3天自动清空，超过10MB截断
- 日志路径：`/app/tgservice/logs/frontend-error.log`（挂载目录）

### 修改文件
- 新建：`tgservice-uniapp/src/utils/error-reporter.js`
- 修改：`tgservice-uniapp/src/main.js` - 新增全局错误处理器
- 修改：`tgservice-uniapp/src/App.vue` - 新增 onError
- 修改：`tgservice-uniapp/src/pages/member/member.vue` - 清理重复代码
- 修改：`tgservice-uniapp/src/pages/internal/reward-penalty-view.vue` - 清理重复代码
- 修改：`tgservice-uniapp/src/pages/internal/leave-calendar.vue` - 清理重复代码
- 修改：`tgservice-uniapp/src/pages/internal/switch-control.vue` - 清理重复代码
- 修改：`tgservice/backend/server.js` - 日志清理逻辑

### Git提交
- `b23883e`: feat: 前端错误日志自动收集上报框架

### 使用方式
```javascript
// 页面业务追踪
import errorReporter from '@/utils/error-reporter.js'
errorReporter.track('action_name', { detail1: 'value1' })

// 自动捕获的全局错误无需手动调用
```

