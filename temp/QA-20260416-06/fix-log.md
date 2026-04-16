# 修复记录 - 后台侧边栏公共化改造

**日期**: 2026-04-16
**任务**: QA-20260416-06
**执行者**: 程序员A

## 修改概述

将15个HTML页面中重复的侧边栏HTML提取为公共组件，通过 sidebar.js 动态渲染 + 自动高亮 + 角色权限过滤。

## 新增文件

| 文件 | 说明 |
|------|------|
| `admin/sidebar.js` | 侧边栏渲染引擎，含菜单配置、角色权限过滤、自动高亮 |
| `admin/sidebar.css` | 公共侧边栏样式（sidebar容器、导航项、折叠菜单组等） |

## 删除文件

| 文件 | 原因 |
|------|------|
| `admin/nav-control.js` | 功能已整合到 sidebar.js |

## 修改文件（15个HTML页面）

| 文件 | 原始大小 | 修改后大小 | 减少 |
|------|----------|-----------|------|
| index.html | 25975B | 21644B | -4331B |
| members.html | 13644B | 10044B | -3600B |
| cashier-dashboard.html | 48864B | 45315B | -3549B |
| products.html | 20164B | 16562B | -3602B |
| vip-rooms.html | 24866B | 21264B | -3602B |
| tables.html | 29688B | 26078B | -3610B |
| categories.html | 11979B | 8412B | -3567B |
| coaches.html | 42761B | 39159B | -3602B |
| switch-devices.html | 14980B | 11461B | -3519B |
| table-devices.html | 12536B | 9061B | -3475B |
| switch-scenes.html | 13768B | 10293B | -3475B |
| operation-logs.html | 13894B | 10393B | -3501B |
| home.html | 13925B | 10323B | -3602B |
| users.html | 15131B | 11564B | -3567B |
| settings.html | 20704B | 17132B | -3572B |

**总计减少**: 约 52KB 重复代码

## 每个页面的修改内容

1. ✅ 移除内联侧边栏HTML（约50行）→ 替换为 `<div class="sidebar"></div>`
2. ✅ 移除内联sidebar相关CSS（约40行）
3. ✅ 移除 nav-control.js 引用
4. ✅ 移除 toggleGroup 函数定义
5. ✅ 添加 sidebar.css 引用（`<link rel="stylesheet" href="sidebar.css">`）
6. ✅ 添加 sidebar.js 引用（`<script src="sidebar.js"></script>`）
7. ✅ 保留 `.sidebar` 容器

## 关键技术实现

### sidebar.js 功能

1. **菜单配置内联**（MENU_CONFIG）- 避免异步 fetch 时序问题
2. **角色权限过滤同步执行** - 渲染时只显示允许的菜单项
   - 管理员/店长/助教管理 → 全部菜单
   - 前厅管理 → 数据概览、会员管理、前厅5项
   - 收银 → 仅收银看板
   - 教练/服务员 → 禁止后台
3. **自动高亮** - 检测当前 URL 设置 active 和 open 状态
4. **折叠菜单** - window.toggleGroup 全局函数

### 兼容性保证

- 收银看板全屏功能不受影响（`.sidebar` 容器保留）
- 所有页面保持原有的 `logout()`、`showToast()`、`api()` 函数
- JWT 解析逻辑从 nav-control.js 迁移到 sidebar.js

## Git 提交

```
commit ea5a115
refactor: 后台侧边栏公共化改造
18 files changed, 468 insertions(+), 1267 deletions(-)
```

## 验收要点

- [x] 15个HTML页面侧边栏容器为空 `<div class="sidebar"></div>`
- [x] 所有页面引用 sidebar.css 和 sidebar.js
- [x] nav-control.js 已删除
- [x] 无内联 sidebar CSS 残留
- [x] 无内联 toggleGroup 函数残留
- [x] HTML 结构完整（`<html>` 标签配对）
