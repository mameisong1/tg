你是程序员A。请按设计稿编码实现。

## 设计稿
```
# 后台Admin左侧菜单栏公共化改造 - 设计方案

## QA需求
将15个HTML页面中重复的菜单栏HTML提取为公共模板，通过sidebar.js动态加载+自动高亮+角色权限过滤。解决菜单不一致问题（不同页面看到的菜单项不同）。

---

## 1. 现状分析

### 1.1 文件清单
共15个HTML页面包含侧边栏（login.html除外）：
- `index.html` - 数据概览
- `members.html` - 会员管理
- `cashier-dashboard.html` - 收银看板
- `products.html` - 商品管理
- `vip-rooms.html` - 包房管理
- `tables.html` - 台桌管理
- `categories.html` - 商品分类
- `coaches.html` - 助教列表
- `operation-logs.html` - 操作日志
- `home.html` - 首页配置
- `users.html` - 用户管理
- `settings.html` - 系统配置
- `switch-devices.html` - 设备开关管理
- `table-devices.html` - 台桌设备关系
- `switch-scenes.html` - 开关场景管理

### 1.2 发现的不一致问题

| 问题类型 | 影响页面数 | 具体情况 |
|---------|-----------|---------|
| **缺少"设备管理"分组** | 11个 | members, categories, coaches, home, products, settings, tables, users, vip-rooms, cashier-dashboard, operation-logs |
| **缺少"批量更新班次"链接** | 3个 | switch-devices, switch-scenes, table-devices |
| **CSS样式重复** | 15个 | 每个页面都有约50行sidebar相关CSS |
| **active状态硬编码** | 15个 | 每个页面手动设置active class |
| **toggleGroup函数重复** | 15个 | 每个页面都定义了toggleGroup函数 |
| **图标格式不一致** | 混合 | 部分使用`<span class="nav-icon">💰</span>`，部分直接用`💰` |

### 1.3 完整菜单结构（应该是统一的标准）

```
数据概览 (index.html)
会员管理 (members.html)

【前厅】(默认展开)
  - 收银看板 (cashier-dashboard.html)
  - 商品管理 (products.html)
  - 包房管理 (vip-rooms.html)
  - 台桌管理 (tables.html)
  - 商品分类 (categories.html)

【助教管理】
  - 助教列表 (coaches.html)
  - 批量更新班次 (coaches.html#batch-shift)

【设备管理】
  - 设备开关管理 (switch-devices.html)
  - 台桌设备关系 (table-devices.html)
  - 开关场景管理 (switch-scenes.html)

【系统】
  - 操作日志 (operation-logs.html)
  - 首页配置 (home.html)
  - 用户管理 (users.html)
  - 系统配置 (settings.html)
```

共16个菜单项 + 4个分组

### 1.4 现有角色权限系统

已有 `nav-control.js` 实现角色过滤：
- 管理员/店长/助教管理 → 全部菜单
- 前厅管理 → 收银看板、商品管理、包房管理、台桌管理、商品分类、会员管理
- 收银 → 仅收银看板
- 教练/服务员 → 禁止访问后台

---

## 2. 技术方案

### 2.1 方案选择

**方案：JavaScript动态渲染 + 内联配置**

- 将菜单配置内联到sidebar.js中，避免异步fetch导致的时序问题
- sidebar.js在页面加载时同步渲染侧边栏HTML
- 自动检测当前页面并设置active高亮
- 内置角色权限过滤，渲染时只显示允许的菜单项
- 提取CSS到独立文件sidebar.css

**为何不使用fetch加载sidebar.html：**
1. 异步加载会导致nav-con...
```

## 编码要求
# 程序员A — 任务指令模板

## 角色

你是程序员A，负责天宫QA项目的设计方案和编码实现。

**禁止**：编写测试用例、运行测试。

## 设计规范

1. 明确列出新增/修改的文件
2. 说明API变更（路径、方法、参数、返回值）
3. 说明数据库变更（新表、字段、索引）
4. 说明前后端交互流程
5. 考虑边界情况和异常处理

## 编码规范（必须遵守）

### 🔴 时间处理

- ✅ 后端：`const TimeUtil = require('./utils/time'); TimeUtil.nowDB()`
- ✅ 前端：`TimeUtil.today()` / `TimeUtil.format(timeStr)`
- ❌ 禁止：`datetime('now')`、手动时区偏移、`new Date().getTime() + 8*60*60*1000`

### 🔴 数据库连接

- ✅ 唯一连接：`const { db, dbRun, dbAll, dbGet } = require('./db/index');`
- ❌ 禁止：`new sqlite3.Database()`、自行实例化

### 🔴 数据库写入

- ✅ `await enqueueRun('INSERT ...', [...])`
- ✅ `await runInTransaction(async (tx) => { ... })`
- ❌ 禁止：`db.run('BEGIN TRANSACTION')`、裸开事务

## 工作目录

所有设计/代码产出写入指定工作目录。

## 输出要求

- 设计方案：写入 `design.md`
- 代码实现：直接修改项目代码，提交Git
- 修复记录：写入工作目录的 `fix-log.md`


## 完成要求
1. 代码提交到Git
2. 修复记录写入 /TG/temp/QA-20260416-06/fix-log.md（如有修复）