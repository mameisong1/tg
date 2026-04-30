# QA-20260430-1 修复记录

## 任务：订单管理页面实现

### 新增文件
- `/TG/tgservice/admin/orders.html` - 订单管理页面（全新实现）

### 修改文件
- `/TG/tgservice/admin/sidebar.js` - 前厅分组添加「订单管理」菜单，店长和前厅管理角色添加 orders.html 权限
- `/TG/tgservice/backend/server.js` - 新增3个API

### 新增API

**1. GET /api/admin/orders/:id - 订单详情**
- 权限：`requireBackendPermission(['cashierDashboard'])`
- 返回订单详情 + 商品图片/类别（使用 getProductMap）
- 404处理

**2. DELETE /api/admin/orders/:id - 删除订单**
- 权限：`requireBackendPermission(['cashierDashboard'])`
- 业务规则：只允许删除已取消或已完成的订单，待处理订单返回400错误
- 使用 `enqueueRun` 写入
- 操作日志记录

**3. PUT /api/admin/orders/:id/status - 更新订单状态**
- 权限：`requireBackendPermission(['cashierDashboard'])`
- 参数：`{ status: '待处理'|'已完成'|'已取消' }`
- 使用 `TimeUtil.nowDB()` 更新 updated_at
- 使用 `enqueueRun` 写入
- 操作日志记录

### 页面功能
1. 页面标题 + 统计栏（总数、待处理、已完成、已取消）
2. 工具栏：搜索框（订单号/台桌号/会员手机）、状态筛选按钮、日期筛选
3. 订单列表表格（订单号、台桌号、商品数、总价、状态badge、会员手机、创建时间、操作按钮）
4. 订单详情弹窗（基本信息 + 商品列表含图片 + 状态修改按钮）
5. 删除按钮（仅已取消/已完成订单显示）
6. Toast 提示

### 编码规范遵守
- ✅ 后端使用 `TimeUtil.nowDB()` 处理时间
- ✅ 前端使用 `TimeUtil.format()` / `TimeUtil.formatFull()` 格式化时间
- ✅ 数据库连接使用 `db/index.js` 的 `dbGet`, `dbAll`, `enqueueRun`
- ✅ 数据库写入使用 `enqueueRun`
- ✅ 页面不显示 coach_no，只显示 employee_id（订单表无此字段）
- ✅ 使用 `js/sidebar.js` 自动生成菜单
- ✅ 使用 `js/time-util.js` 时间工具

### Git提交
- Commit: `feat: 新增订单管理页面`
- 已push到origin/master

### 测试环境重启
- `pm2 restart tgservice-dev` ✓

---
完成时间：2026-04-30 08:18