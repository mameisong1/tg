# 奖罚管理功能 - 编码修复记录

> 日期: 2026-04-18
> 程序员: A
> 任务: 奖罚管理功能编码实现

---

## 修改文件清单

### 后端文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/server.js` | 修改 | 新增奖罚表初始化、奖罚类型配置初始化、admin_users新增employment_status字段、9个API路由 |
| `admin/sidebar.js` | 修改 | 新增「人事」分组及「奖罚统计」菜单项 |
| `admin/users.html` | 修改 | 表格新增「在职状态」列，编辑弹窗新增在职状态下拉框，saveUser包含employmentStatus |
| `admin/reward-penalty-stats.html` | **新建** | 奖罚统计页面（筛选+按人员分组+批量执行） |

### 前端H5文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/pages/internal/reward-penalty-set.vue` | **新建** | 奖金设定页面（类型选择+日期选择+人员卡片+快捷金额+upsert） |
| `src/pages/internal/reward-penalty-view.vue` | **新建** | 奖金查看页面（本月/上月筛选+类型筛选+明细列表+统计栏） |
| `src/pages.json` | 修改 | 注册两个新页面路由 |
| `src/pages/member/member.vue` | 修改 | 常用功能新增「我的奖罚」入口，管理功能新增「服务日奖」入口 |
| `src/pages/coach-profile/coach-profile.vue` | 修改 | 新增「我的奖罚」入口链接 |
| `src/utils/api.js` | 修改 | 新增11个奖罚相关API方法 |

---

## 数据库变更

### 新建表: reward_penalties
- id (自增主键)
- type (奖罚类型)
- confirm_date (确定日期)
- phone (手机号)
- name (姓名)
- amount (金额，负数=罚金)
- remark (备注)
- exec_status (执行状态: 未执行/已执行)
- exec_date (执行日期)
- created_at / updated_at

### 索引
- idx_rp_unique: (confirm_date, type, phone) 唯一约束
- idx_rp_phone / idx_rp_type / idx_rp_confirm_date / idx_rp_exec_status: 查询优化

### admin_users 表
- 新增字段: employment_status TEXT DEFAULT '在职'

### system_config 表
- 新增 key: reward_penalty_types (JSON)
- 默认值: [{"奖罚类型":"服务日奖","对象":"服务员"},{"奖罚类型":"未约客罚金","对象":"助教"},{"奖罚类型":"漏单罚金","对象":"助教"}]

---

## API 端点

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /api/admin/reward-penalty/types | 获取奖罚类型配置 | coachManagement |
| PUT | /api/admin/reward-penalty/types | 更新奖罚类型配置 | coachManagement |
| POST | /api/reward-penalty/upsert | 写入/更新/删除奖罚记录 | coachManagement |
| GET | /api/reward-penalty/list | 查询奖罚记录列表 | authMiddleware |
| GET | /api/reward-penalty/stats | 按月统计奖罚数据 | coachManagement |
| POST | /api/reward-penalty/batch-execute | 批量执行奖罚 | coachManagement |
| POST | /api/reward-penalty/execute/:id | 单条执行奖罚 | coachManagement |
| GET | /api/reward-penalty/targets | 获取奖罚对象列表(服务员/助教) | coachManagement |
| PUT | /api/admin/users/:username/status | 更新用户在职状态 | coachManagement |

---

## 编码规范遵守情况

| 规范 | 状态 | 说明 |
|------|------|------|
| 时间处理: TimeUtil.nowDB() | ✅ | 所有写入时间使用 TimeUtil.nowDB() |
| 数据库连接: db/index.js | ✅ | 使用 dbGet, dbAll, enqueueRun |
| 数据库写入: enqueueRun | ✅ | 所有写操作使用 enqueueRun() |
| 页面显示: 不显示 coach_no | ✅ | 页面显示 employee_id 和 displayName |

---

## Git 提交

- commit: `9bffee1`
- message: `feat: 奖罚管理功能实现 - 数据库+后端API+后台admin页面+前台H5页面`

---

## 待测试项

1. 奖罚类型配置是否正确初始化
2. 奖罚表是否创建成功
3. admin_users.employment_status 字段是否添加
4. 奖金设定 upsert 功能（新增/更新/删除）
5. 奖金查看页面角色筛选
6. 奖罚统计页面筛选+批量执行
7. 在职状态过滤
